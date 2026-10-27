// ============================================================================
// notify-admin: يرسل بريداً فورياً إلى إدارة «أنا عقار» عند وصول:
//   • طلب خدمة جديد (service_requests)
//   • استفسار أو طلب معاينة على عقار (leads)
//   • عقار جديد بانتظار المراجعة (properties)
// يُستدعى من قاعدة البيانات (supabase/notify_triggers.sql) ويرسل عبر SMTP بريد Zoho.
//
// الإعدادات (Edge Functions → Secrets):
//   SMTP_USER      info@anaaqar.com
//   SMTP_PASS      كلمة مرور التطبيقات من Zoho (App Password)
//   SMTP_HOST      smtp.zoho.com   (اختياري)
//   NOTIFY_TO      info@anaaqar.com (اختياري — يمكن وضع أكثر من بريد مفصولة بفاصلة)
//   NOTIFY_SECRET  نفس القيمة المحفوظة في قاعدة البيانات (app_private_settings)
// ============================================================================
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SITE = "https://anaaqar.com";
const SERVICE_NAMES: Record<string, string> = {
  general: "تواصل عام", brokerage: "خدمات الوساطة العقارية", residency: "الإقامة وتأسيس الشركات",
  legal: "الاستشارات القانونية", property_services: "خدمات عقارية", engineering: "استشارات هندسية",
  contracting: "المقاولات", interior: "تصميم الديكور", citizenship: "الجنسية عبر الاستثمار",
  property_mgmt: "إدارة العقارات", maintenance: "الصيانة المنزلية", cleaning: "شركات النظافة", pest: "مكافحة الحشرات",
  garden: "العناية بالحدائق", pools: "المسابح", lighting: "الإضاءة", smart_home: "المنازل الذكية", security: "الأمن والسلامة",
  movers: "نقل الأثاث", domestic: "الخدم المنزلي والسائقون", care: "جليسات الأطفال وكبار السن والتمريض المنزلي",
  pets: "رعاية الحيوانات الأليفة", car_rental: "تأجير السيارات", immigration: "الهجرة والجنسية", recruitment: "التوظيف",
};

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// denomailer يرمّز العنوان العربي الطويل بطريقة تكسره في Zoho (=?utf-8?Q?...)،
// لذلك نرمّزه بأنفسنا بصيغة Base64 (RFC 2047) مقسّماً إلى أجزاء قصيرة،
// ونبدأه بنص إنجليزي حتى لا يعيد denomailer ترميزه.
function encodeSubject(text: string) {
  const enc = new TextEncoder();
  const words: string[] = [];
  let chunk = "";
  for (const ch of Array.from(text)) {
    if (enc.encode(chunk + ch).length > 45) { words.push(chunk); chunk = ""; }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  const b64 = (t: string) => btoa(String.fromCharCode(...enc.encode(t)));
  return "AnaAqar | " + words.map((w) => `=?UTF-8?B?${b64(w)}?=`).join(" ");
}

function row(label: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  return `<tr><td style="padding:6px 10px;color:#64748b;white-space:nowrap;vertical-align:top">${esc(label)}</td><td style="padding:6px 10px;color:#0f172a;font-weight:600">${esc(value)}</td></tr>`;
}

function build(table: string, r: Record<string, unknown>) {
  if (table === "service_requests") {
    const svc = SERVICE_NAMES[String(r.service)] ?? String(r.service ?? "");
    return {
      subject: `🛎️ طلب خدمة جديد: ${svc} — ${r.name ?? ""}`,
      title: `طلب خدمة جديد: ${svc}`,
      rows: row("الاسم", r.name) + row("الهاتف", r.phone) + row("البريد", r.email) + row("المدينة", r.city) + row("التفاصيل", r.details),
      link: `${SITE}/admin/service-requests.html`,
    };
  }
  if (table === "leads") {
    const viewing = r.status === "viewing";
    return {
      subject: `${viewing ? "📅 طلب معاينة" : "✉️ استفسار"} على عقار — ${r.buyer_name ?? ""}`,
      title: viewing ? "طلب معاينة جديد" : "استفسار جديد على عقار",
      rows: row("العقار", r.property_title) + row("الاسم", r.buyer_name) + row("الهاتف", r.buyer_phone) +
        row("البريد", r.buyer_email) + row("الرسالة", r.message),
      link: `${SITE}/admin/service-requests.html`,
    };
  }
  if (table === "service_providers") {
    const cat = SERVICE_NAMES[String(r.category)] ?? String(r.category ?? "");
    return {
      subject: `🏢 طلب إدراج شركة في دليل الخدمات: ${r.name_ar ?? ""}`,
      title: `طلب إدراج جديد — ${cat}`,
      rows: row("الشركة", r.name_ar) + row("بالإنجليزية", r.name_en) + row("الإمارة", r.emirate) + row("المنطقة", r.area) +
        row("الهاتف", r.phone) + row("البريد", r.email) + row("الموقع", r.website) + row("رقم الرخصة", r.license_number) + row("نبذة", r.description),
      link: `${SITE}/admin/service-providers.html`,
    };
  }
  if (table === "chat_messages") {
    return {
      subject: `💬 رسالة دردشة جديدة من ${r.name ?? "زائر"}`,
      title: "رسالة جديدة في الدردشة المباشرة",
      rows: row("الاسم", r.name) + row("الهاتف", r.phone) + row("البريد", r.email) + row("الصفحة", r.page) + row("الرسالة", r.body),
      link: `${SITE}/admin/index.html#s-chat`,
    };
  }
  if (table === "reports") {
    const KINDS: Record<string, string> = { listing: "إعلان عقار", broker: "وسيط أو مكتب", company: "شركة خدمات", site: "مشكلة في الموقع", other: "أخرى" };
    return {
      subject: `🚩 بلاغ جديد: ${KINDS[String(r.kind)] ?? ""}`,
      title: "بلاغ أو شكوى جديدة",
      rows: row("النوع", KINDS[String(r.kind)] ?? r.kind) + row("المعني بالبلاغ", r.target) + row("الرابط", r.target_url) +
        row("التفاصيل", r.details) + row("الاسم", r.name) + row("الهاتف", r.phone) + row("البريد", r.email),
      link: `${SITE}/admin/index.html#s-reports`,
    };
  }
  // properties
  return {
    subject: `🏠 عقار جديد بانتظار المراجعة — ${r.title ?? ""}`,
    title: "عقار جديد بانتظار المراجعة",
    rows: row("العنوان", r.title) + row("المدينة", r.city) + row("السعر (AED)", r.price_aed) +
      row("رقم التصريح", r.permit_number) + row("صفة المعلن", r.broker_role) + row("الباقة", r.subscription_plan),
    link: `${SITE}/admin/properties.html`,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = Deno.env.get("NOTIFY_SECRET");
  if (!secret || req.headers.get("x-notify-secret") !== secret) return new Response("Unauthorized", { status: 401 });

  let payload: { table?: string; record?: Record<string, unknown> };
  try { payload = await req.json(); } catch { return new Response("Bad request", { status: 400 }); }
  const table = String(payload.table ?? "");
  if (!["service_requests", "leads", "properties", "service_providers", "chat_messages", "reports"].includes(table) || !payload.record) {
    return new Response("Ignored", { status: 200 });
  }

  const m = build(table, payload.record);
  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
    <div style="background:#00a896;color:#fff;padding:14px 18px;font-size:18px;font-weight:700">${esc(m.title)}</div>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0">${m.rows}</table>
    <div style="padding:12px 18px 18px"><a href="${m.link}" style="display:inline-block;background:#192038;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700">فتح صفحة الإدارة</a></div>
    <div style="padding:10px 18px;background:#f8fafc;color:#94a3b8;font-size:12px">تنبيه تلقائي من منصة أنا عقار</div></div>`;

  const user = Deno.env.get("SMTP_USER")!;
  const client = new SMTPClient({
    connection: {
      hostname: Deno.env.get("SMTP_HOST") ?? "smtp.zoho.com",
      port: 465,
      tls: true,
      auth: { username: user, password: Deno.env.get("SMTP_PASS")! },
    },
  });
  try {
    await client.send({
      from: `أنا عقار <${user}>`,
      to: (Deno.env.get("NOTIFY_TO") ?? user).split(",").map((s) => s.trim()).filter(Boolean),
      subject: encodeSubject(m.subject),
      html,
    });
    await client.close();
    return new Response("Sent", { status: 200 });
  } catch (e) {
    console.error("notify-admin send failed", e);
    try { await client.close(); } catch { /* ignore */ }
    return new Response("Send failed", { status: 500 });
  }
});
