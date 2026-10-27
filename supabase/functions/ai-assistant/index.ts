// ============================================================================
// ai-assistant: المساعد العقاري الذكي في «أنا عقار».
// يستقبل سؤال الزائر بالعربية، يختار من العقارات والمشاريع المنشورة الأنسب، ويرد بجملة قصيرة
// مع أرقام العقارات المقترحة. يعمل بنموذج Claude من Anthropic.
//
// الإعدادات (Edge Functions → Secrets):
//   ANTHROPIC_API_KEY   مفتاح Anthropic API (من console.anthropic.com)
//   AI_MODEL            اختياري، الافتراضي claude-haiku-5-5 (الأقل تكلفة)
// SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY متاحان تلقائيًا داخل Supabase.
// حدود الاستخدام: 20 سؤالًا في الساعة لكل زائر، و1500 سؤالًا في الساعة للموقع كله.
// ============================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const SITE = "https://anaaqar.com";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Item = { id: string; kind: "property" | "project"; line: string; text: string };

async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).slice(0, 12).map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "not_configured" }, 503);

  let body: { message?: string; history?: { role: string; content: string }[] };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const message = String(body.message ?? "").trim().slice(0, 600);
  if (message.length < 2) return json({ error: "empty" }, 400);
  const history = (Array.isArray(body.history) ? body.history : []).slice(-6)
    .filter((h) => (h.role === "user" || h.role === "assistant") && typeof h.content === "string")
    .map((h) => ({ role: h.role, content: h.content.slice(0, 800) }));

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ===== حدود الاستخدام =====
  const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  const hour = new Date(); hour.setMinutes(0, 0, 0);
  const bump = async (k: string, max: number) => {
    const { data } = await sb.from("ai_usage").select("n").eq("key", k).eq("hour", hour.toISOString()).maybeSingle();
    const n = (data?.n ?? 0) + 1;
    if (n > max) return false;
    await sb.from("ai_usage").upsert({ key: k, hour: hour.toISOString(), n });
    return true;
  };
  if (!(await bump("all", 1500)) || !(await bump("ip:" + (await sha(ip || "none")), 20))) return json({ error: "rate_limited" }, 429);

  // ===== المرشّحون: عقارات ومشاريع منشورة =====
  const items: Item[] = [];
  const { data: props } = await sb.from("properties")
    .select("id,title,city,deal_type,price_aed,bedrooms,bathrooms,area_m2,property_type,completion_status,has_offer,no_commission,is_golden")
    .eq("status", "approved").order("created_at", { ascending: false }).limit(500);
  for (const p of props ?? []) {
    const line = `sb-${p.id} | ${p.title} | ${p.city ?? ""} | ${p.deal_type === "rent" ? "إيجار" : "بيع"} | ${p.price_aed ?? "?"} درهم | ${p.bedrooms ?? "?"} غرف | ${p.area_m2 ?? "?"} م² | ${p.property_type ?? ""}${p.completion_status ? " | " + p.completion_status : ""}${p.has_offer ? " | عليه عرض" : ""}${p.no_commission ? " | بدون عمولة" : ""}`;
    items.push({ id: `sb-${p.id}`, kind: "property", line, text: line.toLowerCase() });
  }
  if ((props ?? []).length < 50) {
    // ما دامت العقارات الحقيقية قليلة، يُستعان بالعقارات المعروضة حاليًا في الموقع
    try {
      const demo = await fetch(`${SITE}/properties.json`).then((r) => r.json());
      for (const p of (demo as Record<string, unknown>[]).slice(0, 600)) {
        const line = `${p.id} | ${p.title} | ${p.city ?? ""} | ${p.dealType === "rent" ? "إيجار" : "بيع"} | ${p.priceAED ?? "?"} درهم | ${p.bedrooms ?? "?"} غرف | ${p.area_m2 ?? "?"} م² | ${p.propertyType ?? ""}`;
        items.push({ id: String(p.id), kind: "property", line, text: line.toLowerCase() });
      }
    } catch { /* ignore */ }
  }
  const { data: projs } = await sb.from("projects").select("id,name,city,area,price_from,handover,sale_status,payment_plan")
    .eq("review_status", "approved").limit(150);
  for (const p of projs ?? []) {
    const plan = Array.isArray(p.payment_plan) ? p.payment_plan.map((x: { label?: string; percent?: number }) => `${x.percent}% ${x.label ?? ""}`).join("، ") : "";
    const line = `project-${p.id} | مشروع على الخارطة: ${p.name} | ${p.city ?? ""} ${p.area ?? ""} | يبدأ من ${p.price_from ?? "?"} درهم | التسليم ${p.handover ?? "?"}${plan ? " | خطة السداد: " + plan : ""}`;
    items.push({ id: `project-${p.id}`, kind: "project", line, text: line.toLowerCase() });
  }

  // تصفية أولية بسيطة حسب كلمات السؤال حتى يبقى الطلب صغيرًا
  const words = (message + " " + history.filter((h) => h.role === "user").map((h) => h.content).join(" "))
    .toLowerCase().split(/[\s،,.؟?!]+/).filter((w) => w.length > 2);
  const scored = items.map((it) => ({ it, s: words.reduce((a, w) => a + (it.text.includes(w) ? 1 : 0), 0) }))
    .sort((a, b) => b.s - a.s).slice(0, 70).map((x) => x.it);

  const system = `أنت «مساعد أنا عقار»، مستشار عقاري ودود لمنصة أنا عقار في الإمارات (تبدأ من دبي).
- أجب بالعربية الفصحى المبسطة، بإيجاز (3 جمل كحد أقصى)، ثم اقترح حتى 6 عقارات أو مشاريع من القائمة فقط.
- لا تخترع عقارات أو أسعارًا أو معلومات غير موجودة في القائمة. إن لم يوجد ما يناسب فقل ذلك واقترح أن يترك طلبه في صفحة «اطلب عقارك».
- لا تقدّم وعودًا استثمارية أو قانونية، ولا تذكر أنك نموذج ذكاء اصطناعي من شركة معينة.
- إن سأل عن شيء خارج العقار فاعتذر بلطف وأعده إلى البحث العقاري.
- الرد يجب أن يكون JSON فقط بالشكل: {"reply":"...","ids":["sb-1","project-2"]}

القائمة المتاحة (المعرّف | التفاصيل):
${scored.map((i) => i.line).join("\n")}`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("AI_MODEL") || "claude-haiku-5-5",
      max_tokens: 700,
      system,
      messages: [...history, { role: "user", content: message }],
    }),
  });
  if (!r.ok) { console.error("anthropic", r.status, await r.text()); return json({ error: "ai_failed" }, 502); }
  const out = await r.json();
  const text: string = (out.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  let reply = text, ids: string[] = [];
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    reply = String(parsed.reply ?? "");
    ids = (Array.isArray(parsed.ids) ? parsed.ids : []).map(String).filter((id: string) => items.some((i) => i.id === id)).slice(0, 6);
  } catch { /* الرد نص عادي */ }
  return json({ reply, ids });
});
