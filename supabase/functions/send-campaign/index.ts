// ============================================================================
// send-campaign: إرسال الحملات البريدية من لوحة التحكم، وإلغاء الاشتراك منها.
//   POST (من لوحة التحكم، بحساب الإدارة): { campaign_id } ← يرسل دفعة (حتى 100 رسالة) ويعيد العدد
//   GET  ?unsubscribe=<id>&t=<توقيع>        ← رابط «إلغاء الاشتراك» في أسفل كل رسالة
//
// الإعدادات (Edge Functions → Secrets): نفس إعدادات notify-admin
//   SMTP_USER, SMTP_PASS, SMTP_HOST (اختياري), NOTIFY_SECRET (يُستعمل لتوقيع روابط الإلغاء)
// عند إنشاء الدالة: أوقفي خيار «Verify JWT» لأن رابط إلغاء الاشتراك يُفتح من البريد دون تسجيل دخول.
// ============================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const BATCH = 100;

async function sign(id: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(Deno.env.get("NOTIFY_SECRET") ?? "x"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(id));
  return Array.from(new Uint8Array(s)).slice(0, 16).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function encodeSubject(s: string) {
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(s)));
  return `=?UTF-8?B?${b64}?=`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ===== إلغاء الاشتراك =====
  if (req.method === "GET") {
    const id = url.searchParams.get("unsubscribe") ?? "";
    const ok = /^[0-9a-f-]{36}$/.test(id) && url.searchParams.get("t") === (await sign(id));
    if (ok) await admin.from("profiles").update({ email_opt_out: true }).eq("id", id);
    return new Response(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font-family:Tahoma,Arial;text-align:center;padding:40px;color:#0f172a">
      <h2 style="color:#00a896">${ok ? "تم إلغاء اشتراكك في رسائل أنا عقار التسويقية" : "الرابط غير صالح"}</h2>
      <p>${ok ? "لن تصلك رسائل تسويقية بعد الآن. ستبقى تصلك رسائل حسابك الضرورية فقط." : "تواصل معنا على info@anaaqar.com"}</p>
      <a href="https://anaaqar.com" style="color:#00a896">العودة إلى أنا عقار</a></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  if (req.method !== "POST") return json({ error: "method" }, 405);

  // ===== التحقق من حساب الإدارة =====
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data: isAdmin } = await userClient.rpc("is_app_admin");
  if (isAdmin !== true) return json({ error: "forbidden" }, 403);

  let body: { campaign_id?: number };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const { data: c } = await admin.from("email_campaigns").select("*").eq("id", body.campaign_id).maybeSingle();
  if (!c) return json({ error: "not_found" }, 404);
  if (c.status === "done") return json({ sent: c.sent_count, done: true });

  const { data: all, error } = await admin.rpc("campaign_recipients", { p_audience: c.audience });
  if (error) return json({ error: error.message }, 500);
  const list = (all ?? []).slice(c.sent_count, c.sent_count + BATCH);

  const user = Deno.env.get("SMTP_USER")!;
  const client = new SMTPClient({ connection: { hostname: Deno.env.get("SMTP_HOST") ?? "smtp.zoho.com", port: 465, tls: true, auth: { username: user, password: Deno.env.get("SMTP_PASS")! } } });
  const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-campaign`;
  let sent = 0;
  try {
    for (const r of list) {
      const unsub = `${fnUrl}?unsubscribe=${r.id}&t=${await sign(r.id)}`;
      const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="background:#00a896;color:#fff;padding:14px 18px;font-size:18px;font-weight:700">أنا عقار</div>
        <div style="padding:18px;font-size:15px;line-height:1.9;color:#0f172a">${r.full_name ? `<p>مرحبًا ${esc(r.full_name)}،</p>` : ""}${esc(c.body).replace(/\n/g, "<br>")}</div>
        <div style="padding:10px 18px;background:#f8fafc;color:#94a3b8;font-size:12px">وصلتك هذه الرسالة لأن لديك حسابًا في أنا عقار. <a href="${unsub}" style="color:#64748b">إلغاء الاشتراك في الرسائل التسويقية</a></div></div>`;
      try {
        await client.send({ from: `أنا عقار <${user}>`, to: r.email, subject: encodeSubject(c.subject), html, headers: { "List-Unsubscribe": `<${unsub}>` } });
        sent++;
      } catch (e) { console.error("send failed", r.email, e); }
      await new Promise((res) => setTimeout(res, 300));
    }
  } finally { try { await client.close(); } catch { /* ignore */ } }

  const total = c.sent_count + list.length;
  const done = total >= (all ?? []).length;
  await admin.from("email_campaigns").update({ sent_count: total, status: done ? "done" : "sending" }).eq("id", c.id);
  return json({ sent, total, remaining: Math.max(0, (all ?? []).length - total), done });
});
