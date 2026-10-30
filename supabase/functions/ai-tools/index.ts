// ============================================================================
// ai-tools: أدوات الذكاء الاصطناعي في «أنا عقار» (دالة واحدة بعدة أوامر)
//   POST { action: "write_listing",  data:{...بيانات العقار} }            ← للمسجلين فقط: عنوان ووصف بالعربية والإنجليزية
//   POST { action: "analyze_images", images:["data:image/jpeg;base64,..."] } ← للمسجلين فقط: صفات العقار من الصور وملاحظات جودة
//   POST { action: "suggest_reply",  lead:{...}, tone? }                  ← للمسجلين فقط: رد مقترح على عميل
//   POST { action: "area_summary",   area, city, stats:{...} }            ← للجميع، مع حفظ النتيجة 30 يومًا
//
// الإعدادات (Edge Functions → Secrets): ANTHROPIC_API_KEY (نفس مفتاح المساعد الذكي)، AI_MODEL اختياري،
//   AI_DAILY_LIMIT اختياري: الحد اليومي المشترك مع ai-assistant (الافتراضي 300 طلب في اليوم)
// SUPABASE_URL و SUPABASE_ANON_KEY و SUPABASE_SERVICE_ROLE_KEY متاحة تلقائيًا.
// ============================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);

async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).slice(0, 12).map((x) => x.toString(16).padStart(2, "0")).join("");
}

// deno-lint-ignore no-explicit-any
async function claude(key: string, system: string, content: any, maxTokens = 900) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: Deno.env.get("AI_MODEL") || "claude-haiku-5-5", max_tokens: maxTokens, system, messages: [{ role: "user", content }] }),
  });
  if (!r.ok) { console.error("anthropic", r.status, await r.text()); throw new Error("ai_failed"); }
  const out = await r.json();
  const text: string = (out.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  try { return JSON.parse(m ? m[0] : text); } catch { return { text }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "not_configured" }, 503);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const action = String(body.action ?? "");
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ===== من المستخدم؟ =====
  let userId: string | null = null;
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (jwt) { const { data } = await sb.auth.getUser(jwt); userId = data?.user?.id ?? null; }
  if (["write_listing", "analyze_images", "suggest_reply"].includes(action) && !userId) return json({ error: "login_required" }, 401);

  // ===== حدود الاستخدام =====
  const hour = new Date(); hour.setMinutes(0, 0, 0);
  const bump = async (k: string, max: number) => {
    const { data } = await sb.from("ai_usage").select("n").eq("key", k).eq("hour", hour.toISOString()).maybeSingle();
    const n = (data?.n ?? 0) + 1;
    if (n > max) return false;
    await sb.from("ai_usage").upsert({ key: k, hour: hour.toISOString(), n });
    return true;
  };
  const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  const who = userId ? "u:" + userId : "ip:" + (await sha(ip || "none"));
  // ملخص المنطقة المحفوظ لا يُحسب من حدود الاستخدام لأنه لا يكلّف شيئًا
  let cachedArea: unknown = null;
  if (action === "area_summary") {
    const ck0 = "area:" + (String(body.area ?? "").slice(0, 80).trim() + "|" + String(body.city ?? "").slice(0, 40).trim()).toLowerCase();
    const { data: c0 } = await sb.from("ai_cache").select("value,created_at").eq("key", ck0).maybeSingle();
    if (c0 && Date.now() - new Date(c0.created_at).getTime() < 30 * 864e5) cachedArea = { ...c0.value, cached: true };
  }
  if (cachedArea) return json(cachedArea);
  if (!(await bump("tools-all", 2000)) || !(await bump("tools:" + who, userId ? 60 : 15))) return json({ error: "rate_limited" }, 429);

  // ===== الحد اليومي للموقع كله (مشترك بين المساعد والأدوات) حتى يكفي الرصيد الشهري =====
  const dailyLimit = Number(Deno.env.get("AI_DAILY_LIMIT") || 300);
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  const bumpDay = async () => {
    const { data } = await sb.from("ai_usage").select("n").eq("key", "ai-day").eq("hour", dayStart.toISOString()).maybeSingle();
    const n = (data?.n ?? 0) + 1;
    if (n > dailyLimit) return false;
    await sb.from("ai_usage").upsert({ key: "ai-day", hour: dayStart.toISOString(), n });
    return true;
  };
  if (!(await bumpDay())) return json({ error: "daily_limit" }, 429);

  try {
    // ---------- 1) كتابة الإعلان ----------
    if (action === "write_listing") {
      const d = body.data ?? {};
      const facts = Object.entries(d).filter(([, v]) => v !== null && v !== "" && v !== undefined)
        .map(([k, v]) => `${clip(k, 40)}: ${Array.isArray(v) ? v.map((x) => clip(x, 40)).join("، ") : clip(v, 400)}`).join("\n");
      const r = await claude(key, `أنت كاتب إعلانات عقارية محترف في الإمارات. اكتب إعلانًا صادقًا وجذابًا من البيانات المعطاة فقط.
- لا تضف أي معلومة غير موجودة في البيانات (لا مرافق ولا مسافات ولا عوائد ولا وعود).
- لا مبالغات مثل «الأفضل» أو «فرصة لا تتكرر» أو «عائد مضمون».
- العنوان حتى 90 حرفًا، والوصف 70 إلى 140 كلمة في فقرات قصيرة.
- أعد JSON فقط: {"title_ar":"","description_ar":"","title_en":"","description_en":""}`, `بيانات العقار:\n${facts}`, 1400);
      return json({ title_ar: clip(r.title_ar, 150), description_ar: clip(r.description_ar, 3000), title_en: clip(r.title_en, 150), description_en: clip(r.description_en, 3000) });
    }

    // ---------- 2) تحليل الصور ----------
    if (action === "analyze_images") {
      const imgs = (Array.isArray(body.images) ? body.images : []).slice(0, 4)
        .filter((s: unknown) => typeof s === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(s) && (s as string).length < 1_500_000);
      if (!imgs.length) return json({ error: "no_images" }, 400);
      // deno-lint-ignore no-explicit-any
      const content: any[] = imgs.map((s: string) => { const [h, b64] = s.split(","); return { type: "image", source: { type: "base64", media_type: h.slice(5, h.indexOf(";")), data: b64 } }; });
      content.push({ type: "text", text: "حلّل صور هذا العقار." });
      const r = await claude(key, `أنت مراجع إعلانات عقارية. انظر إلى الصور واستخرج فقط ما يظهر بوضوح، ولا تخمّن.
أعد JSON فقط بهذا الشكل:
{"unit_type":"apartment|studio|villa|townhouse|penthouse|duplex|chalet|hotel_apt|office|shop|warehouse|showroom|land|building|",
 "furnishing":"furnished|unfurnished|partly|", "sea_access":"sea_view|beachfront|", "is_luxury":true|false,
 "amenities":["pool","gym","parking","balcony","maid","central_ac","security","garden","kids"],
 "quality":[ "ملاحظات قصيرة بالعربية عن جودة الصور: إضاءة، وضوح، علامة مائية، أرقام هواتف أو شعارات ظاهرة، صورة غير عقارية، صورة من الإنترنت" ],
 "summary":"جملة واحدة بالعربية تصف ما في الصور"}
اترك الحقل فارغًا إن لم يكن واضحًا. ضع في amenities ما تراه فقط.`, content, 700);
      const AM = ["pool", "gym", "parking", "balcony", "maid", "central_ac", "security", "garden", "kids"];
      return json({
        unit_type: clip(r.unit_type, 20), furnishing: ["furnished", "unfurnished", "partly"].includes(r.furnishing) ? r.furnishing : "",
        sea_access: ["sea_view", "beachfront"].includes(r.sea_access) ? r.sea_access : "", is_luxury: r.is_luxury === true,
        amenities: (Array.isArray(r.amenities) ? r.amenities : []).filter((a: string) => AM.includes(a)),
        quality: (Array.isArray(r.quality) ? r.quality : []).slice(0, 6).map((q: unknown) => clip(q, 160)), summary: clip(r.summary, 300),
      });
    }

    // ---------- 3) رد مقترح على العميل ----------
    if (action === "suggest_reply") {
      const l = body.lead ?? {};
      const acts = (Array.isArray(l.activities) ? l.activities : []).slice(0, 8).map((a: unknown) => clip(a, 200)).join("\n");
      const r = await claude(key, `أنت مساعد وسيط عقاري في الإمارات. اكتب رسالة واتساب قصيرة (2 إلى 4 جمل) مهذبة وعملية للعميل، بالعربية إلا إن كتب العميل بالإنجليزية.
- خاطب العميل باسمه الأول، واذكر العقار إن وُجد، واقترح خطوة تالية واضحة (موعد اتصال أو معاينة أو إرسال خيارات).
- لا تذكر أسعارًا أو معلومات غير موجودة، ولا تعد بشيء.
- وأعطِ تقييمًا لجدية العميل من 1 إلى 5 مع سبب قصير.
أعد JSON فقط: {"reply":"","intent_score":1,"intent_reason":"","next_step":""}`,
        `اسم الوسيط: ${clip(l.me, 60)}\nالعميل: ${clip(l.name, 80)}\nالعقار: ${clip(l.property, 200)}\nرسالته: ${clip(l.message, 1000)}\nالمتطلبات: ${clip(l.requirements, 600)}\nالميزانية: ${clip(l.budget, 30)}\nالمرحلة: ${clip(l.stage, 30)}\nالنبرة المطلوبة: ${clip(body.tone || "ودية", 30)}\nآخر التواصل:\n${acts}`, 600);
      return json({ reply: clip(r.reply, 1200), intent_score: Math.max(1, Math.min(5, Number(r.intent_score) || 3)), intent_reason: clip(r.intent_reason, 200), next_step: clip(r.next_step, 200) });
    }

    // ---------- 4) ملخص المنطقة ----------
    if (action === "area_summary") {
      const area = clip(body.area, 80).trim(), city = clip(body.city, 40).trim();
      if (area.length < 2) return json({ error: "empty" }, 400);
      const ck = "area:" + (area + "|" + city).toLowerCase();
      const { data: c } = await sb.from("ai_cache").select("value,created_at").eq("key", ck).maybeSingle();
      if (c && Date.now() - new Date(c.created_at).getTime() < 30 * 864e5) return json({ ...c.value, cached: true });
      const r = await claude(key, `أنت دليل مناطق سكنية. اكتب نبذة عامة موجزة وحيادية عن المنطقة المذكورة بالعربية.
- اذكر فقط معلومات عامة معروفة وثابتة (طبيعة المنطقة، لمن تناسب، أبرز ما فيها، المواصلات). إن لم تكن متأكدًا من شيء فلا تذكره.
- لا تذكر أسعارًا أو أرقامًا أو أسماء مشاريع بعينها، ولا تقل إنها «الأفضل».
- إن لم تعرف المنطقة فأعد summary فارغًا.
أعد JSON فقط: {"summary":"3 إلى 4 جمل","good_for":["عائلات","مستثمرون"],"highlights":["3 نقاط قصيرة كحد أقصى"]}`, `المنطقة: ${area}\nالمدينة: ${city}`, 500);
      const v = { summary: clip(r.summary, 900), good_for: (r.good_for || []).slice(0, 4).map((x: unknown) => clip(x, 40)), highlights: (r.highlights || []).slice(0, 3).map((x: unknown) => clip(x, 120)) };
      if (v.summary) await sb.from("ai_cache").upsert({ key: ck, value: v, created_at: new Date().toISOString() });
      return json(v);
    }
    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "ai_failed" }, 502);
  }
});
