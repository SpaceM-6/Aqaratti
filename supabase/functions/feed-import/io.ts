// ===== التشغيل: تُستدعى كل 10 دقائق من pg_cron (بلا مفتاح)، وتعمل فقط على ما هو مستحق =====
const SB_URL = Deno.env.get('SUPABASE_URL')!;
const sb = createClient(SB_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const BUCKET = 'property-images';
const BUDGET_MS = 105_000;
const FEED_MAX_BYTES = 30 * 1024 * 1024;
const IMG_MAX_BYTES = 12 * 1024 * 1024;

// لا نقرأ إلا عناوين https عامة (لا عناوين داخلية ولا أرقام IP)
function safeUrl(u: string): URL | null {
  try {
    const x = new URL(u);
    if (x.protocol !== 'https:' || x.username || x.password) return null;
    const h = x.hostname.toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(h)) return null;
    if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|supabase\.co|supabase\.in)$/.test(h)) return null;
    return x;
  } catch { return null; }
}

async function readCapped(res: Response, max: number): Promise<Uint8Array> {
  const len = Number(res.headers.get('content-length') || 0);
  if (len > max) throw new Error('too_large');
  const reader = res.body!.getReader(); const parts: Uint8Array[] = []; let n = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    n += value.length; if (n > max) { try { await reader.cancel(); } catch { /* */ } throw new Error('too_large'); }
    parts.push(value);
  }
  const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
}

async function safeGet(u: string, timeoutMs: number, max: number): Promise<{ bytes: Uint8Array; type: string }> {
  let url = safeUrl(u); if (!url) throw new Error('bad_url');
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'AnaAqar-FeedImporter/1.0 (+https://anaaqar.com)', Accept: '*/*' } });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location'); try { await res.body?.cancel(); } catch { /* */ }
      url = next ? safeUrl(new URL(next, url).toString()) : null; if (!url) throw new Error('bad_redirect'); continue;
    }
    if (!res.ok) { try { await res.body?.cancel(); } catch { /* */ } throw new Error('http_' + res.status); }
    return { bytes: await readCapped(res, max), type: res.headers.get('content-type') || '' };
  }
  throw new Error('too_many_redirects');
}

// ---------- الصور: نتحقق من نوعها الحقيقي ونحذف بيانات EXIF (ومنها الموقع الجغرافي) ----------
function sniff(b: Uint8Array): 'jpg' | 'png' | 'webp' | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  return null;
}
function stripJpeg(b: Uint8Array): Uint8Array {
  const out: number[] = [0xff, 0xd8]; let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return b;                       // بنية غير متوقعة: نُبقي الملف كما هو
    const m = b[i + 1];
    if (m === 0xda) { for (let k = i; k < b.length; k++) out.push(b[k]); return new Uint8Array(out); }
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2 || i + 2 + len > b.length) return b;
    const drop = m === 0xe1 || m === 0xed || m === 0xfe; // EXIF/XMP و Photoshop والتعليقات
    if (!drop) for (let k = i; k < i + 2 + len; k++) out.push(b[k]);
    i += 2 + len;
  }
  return b;
}
async function copyImage(src: string, path: string): Promise<string> {
  const { bytes } = await safeGet(src, 20_000, IMG_MAX_BYTES);
  const kind = sniff(bytes); if (!kind) throw new Error('not_image');
  if (bytes.length < 8_000) throw new Error('image_too_small');
  const body = kind === 'jpg' ? stripJpeg(bytes) : bytes;
  const type = kind === 'jpg' ? 'image/jpeg' : kind === 'png' ? 'image/png' : 'image/webp';
  const { error } = await sb.storage.from(BUCKET).upload(`${path}.${kind}`, body, { contentType: type, upsert: true, cacheControl: '31536000' });
  if (error) throw new Error('upload: ' + error.message);
  return sb.storage.from(BUCKET).getPublicUrl(`${path}.${kind}`).data.publicUrl;
}

// ---------- قراءة ملف مستحق ----------
async function fetchFeed(feed: any) {
  try {
    const { bytes } = await safeGet(feed.url, 45_000, FEED_MAX_BYTES);
    const xml = new TextDecoder('utf-8').decode(bytes);
    const { format, items, found } = parseFeed(xml, XMLParser);
    if (!items.length) throw new Error(found ? 'no_valid_listings' : 'no_listings_found');
    const payload = items.map((it: any) => ({ ref: it.ref, hash: itemHash(it), data: it }));
    const { data, error } = await sb.rpc('feed_sync_items', { p_feed: feed.id, p_items: payload, p_format: format });
    if (error) throw new Error('sync: ' + error.message);
    return { feed: feed.id, format, ...(data as any) };
  } catch (e) {
    const msg = String((e as Error).message || e).slice(0, 300);
    await sb.from('listing_feeds').update({ last_error: msg, next_fetch_at: new Date(Date.now() + 6 * 3600e3).toISOString(), last_fetch_at: new Date().toISOString() }).eq('id', feed.id);
    return { feed: feed.id, error: msg };
  }
}

// ---------- معالجة إعلان واحد ----------
const owners = new Map<string, string>();
async function ownerOf(feedId: string): Promise<string> {
  if (!owners.has(feedId)) { const { data } = await sb.from('listing_feeds').select('owner_id').eq('id', feedId).single(); owners.set(feedId, data!.owner_id); }
  return owners.get(feedId)!;
}
const safeSeg = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60) || 'x';

async function processItem(row: any) {
  const it = row.data; const owner = await ownerOf(row.feed_id);
  const finish = (patch: Record<string, unknown>) => sb.from('listing_feed_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('feed_id', row.feed_id).eq('ref', row.ref);
  try {
    const bad = validate(it);
    if (bad) {
      if (row.property_id) await sb.from('properties').update({ status: 'paused' }).eq('id', row.property_id).in('status', ['approved', 'expired']);
      await finish({ state: 'skipped', last_error: bad }); return 'skipped';
    }
    // الصور: تُنسخ إلى تخزين المنصة فقط إن تغيّرت
    const key = it.photos.join('|');
    let urls: string[] = row.img_key === key && (row.img_urls || []).length >= 3 ? row.img_urls : [];
    if (!urls.length) {
      const tag = itemHash({ p: it.photos }).split(':')[0];
      const base = `${owner}/feeds/${String(row.feed_id).slice(0, 8)}/${safeSeg(row.ref)}`;
      const got = await Promise.all(it.photos.map((u: string, i: number) => copyImage(u, `${base}/${i + 1}-${tag}`).catch(() => null)));
      urls = got.filter(Boolean) as string[];
      if (urls.length < 3) { await finish({ state: 'skipped', last_error: 'photos_unreachable' }); return 'skipped'; }
    }
    const fields: Record<string, unknown> = { ...buildRow(it, { areas: AREAS }), image_urls: urls, feed_id: row.feed_id };
    for (const k of Object.keys(fields)) if (fields[k] === null && ['bedrooms', 'bathrooms'].includes(k)) delete fields[k];
    let pid = row.property_id as string | null;
    if (pid) {
      const { data: cur } = await sb.from('properties').select('status').eq('id', pid).maybeSingle();
      if (!cur) pid = null;
      else {
        if (['approved', 'expired', 'paused', 'pending'].includes(cur.status)) fields.status = 'approved'; // المباع/المؤجر يبقى كما حدده الوسيط
        const { error } = await sb.from('properties').update(fields).eq('id', pid);
        if (error) throw new Error('update: ' + error.message);
      }
    }
    if (!pid) {
      pid = crypto.randomUUID();
      const { error } = await sb.from('properties').insert({
        ...fields, id: pid, broker_id: owner, status: 'approved', reviewed_at: new Date().toISOString(),
        commission: '2%', broker_role: 'وسيط معتمد', nearby: [], floor_plan_urls: [], no_commission: false, has_offer: false, is_luxury: false,
      });
      if (error) throw new Error('insert: ' + error.message);
    }
    await finish({ state: 'done', property_id: pid, img_key: key, img_urls: urls, last_error: null });
    return 'done';
  } catch (e) {
    const msg = String((e as Error).message || e).slice(0, 300);
    await finish({ state: row.attempts >= 3 ? 'error' : 'pending', last_error: msg });
    return 'error';
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const t0 = Date.now();
  const out: Record<string, unknown> = { feeds: [], done: 0, skipped: 0, error: 0 };
  const touched = new Set<string>();
  try {
    for (let k = 0; k < 2 && Date.now() - t0 < 40_000; k++) {        // حتى ملفين مستحقين في كل تشغيل
      const { data: due, error } = await sb.rpc('feed_claim_due');
      if (error || !due || !due.length) break;
      const r = await fetchFeed(due[0]); (out.feeds as unknown[]).push(r); touched.add(due[0].id);
    }
    while (Date.now() - t0 < BUDGET_MS) {
      const { data: batch, error } = await sb.rpc('feed_claim_items', { p_limit: 4 });
      if (error || !batch || !batch.length) break;
      const res = await Promise.all(batch.map((r: any) => { touched.add(r.feed_id); return processItem(r); }));
      for (const r of res) (out as any)[r] = ((out as any)[r] || 0) + 1;
    }
    if (touched.size) await sb.rpc('feed_refresh_counts', { p_feeds: [...touched] });
  } catch (e) {
    out.fatal = String((e as Error).message || e).slice(0, 200);
  }
  out.ms = Date.now() - t0;
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
});
