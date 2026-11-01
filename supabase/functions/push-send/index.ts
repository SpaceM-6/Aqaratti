// ============================================================================
// push-send: يرسل إشعارًا فوريًا إلى آيفون صاحب الحساب عبر خدمة آبل (APNs).
// تستدعيه قاعدة البيانات عند كل تنبيه جديد في user_notifications (supabase/push_notifications.sql).
//
// الإعدادات (Edge Functions → Secrets):
//   APNS_KEY       محتوى ملف المفتاح ‎.p8‎ من حساب مطوّر آبل (كاملًا مع سطري BEGIN/END)
//   APNS_KEY_ID    رقم المفتاح (Key ID) — 10 خانات
//   APPLE_TEAM_ID  رقم الفريق (Team ID) — 10 خانات
//   NOTIFY_SECRET  موجود مسبقًا (نفس قيمة notify_secret في قاعدة البيانات)
//   APNS_SANDBOX   اختياري: true لنسخ التطوير من Xcode فقط (نسخ TestFlight والمتجر لا تحتاجه)
// SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY متوفران تلقائيًا في الدوال السحابية.
// ============================================================================
const BUNDLE_ID = "com.anaaqar.app";
const SITE = "https://anaaqar.com/";

const b64url = (buf: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof buf === "string" ? new TextEncoder().encode(buf) : new Uint8Array(buf as ArrayBuffer);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

// رمز الدخول لخدمة آبل (JWT بتوقيع ES256) — صالح ساعة، نجدده كل 50 دقيقة
let cached: { jwt: string; at: number } | null = null;
async function apnsJwt() {
  if (cached && Date.now() - cached.at < 50 * 60 * 1000) return cached.jwt;
  const pem = (Deno.env.get("APNS_KEY") ?? "").replace(/\\n/g, "\n");
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = b64url(JSON.stringify({ alg: "ES256", kid: Deno.env.get("APNS_KEY_ID") }));
  const claims = b64url(JSON.stringify({ iss: Deno.env.get("APPLE_TEAM_ID"), iat: Math.floor(Date.now() / 1000) }));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(`${head}.${claims}`));
  cached = { jwt: `${head}.${claims}.${b64url(sig)}`, at: Date.now() };
  return cached.jwt;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("NOTIFY_SECRET");
  if (!secret || req.headers.get("x-notify-secret") !== secret) return new Response("Unauthorized", { status: 401 });
  if (!Deno.env.get("APNS_KEY")) return new Response("APNS not configured", { status: 200 });

  const { user_id, title, body, url } = await req.json().catch(() => ({}));
  if (!user_id || !title) return new Response("bad request", { status: 400 });

  const SB = Deno.env.get("SUPABASE_URL")!, SK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const h = { apikey: SK, Authorization: `Bearer ${SK}` };
  const rows: { token: string }[] = await fetch(`${SB}/rest/v1/push_tokens?select=token&platform=eq.ios&user_id=eq.${encodeURIComponent(user_id)}`, { headers: h }).then((r) => r.json()).catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return new Response("no devices", { status: 200 });

  const host = Deno.env.get("APNS_SANDBOX") === "true" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  const jwt = await apnsJwt();
  const link = url ? (/^https?:/.test(url) ? url : SITE + String(url).replace(/^\//, "")) : SITE;
  const payload = JSON.stringify({ aps: { alert: { title: String(title).slice(0, 120), body: String(body ?? "").slice(0, 300) }, sound: "default" }, url: link });

  const results = await Promise.all(rows.map(async ({ token }) => {
    const r = await fetch(`${host}/3/device/${token}`, {
      method: "POST",
      headers: { authorization: `bearer ${jwt}`, "apns-topic": BUNDLE_ID, "apns-push-type": "alert", "apns-priority": "10", "content-type": "application/json" },
      body: payload,
    }).catch((e) => ({ status: 0, text: () => Promise.resolve(String(e)) } as unknown as Response));
    const txt = r.status === 200 ? "" : await r.text().catch(() => "");
    // جهاز لم يعد صالحًا (حُذف التطبيق مثلًا): نحذف رمزه
    if (r.status === 410 || /BadDeviceToken|Unregistered|DeviceTokenNotForTopic/.test(txt)) {
      await fetch(`${SB}/rest/v1/push_tokens?token=eq.${encodeURIComponent(token)}`, { method: "DELETE", headers: h }).catch(() => {});
    }
    return { status: r.status, reason: txt.slice(0, 120) };
  }));
  return new Response(JSON.stringify(results), { headers: { "content-type": "application/json" } });
});
