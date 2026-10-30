/* أدوات الذكاء في «أنا عقار»:
   1) مؤشر عدالة السعر مقارنة بالعقارات المشابهة   2) عقارات مشابهة   3) «مقترح لك» حسب ما تصفحه الزائر
   4) نبذة عن المنطقة (ذكاء اصطناعي) مع أرقام الموقع الفعلية   5) الميزات الحقيقية للعقار في صفحة التفاصيل
   6) أدوات للنماذج: بصمة الصور لكشف التكرار، وتصغير الصور للتحليل، واستدعاء دالة ai-tools */
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => Math.round(Number(n) || 0).toLocaleString('en-US') + ' درهم';
  const median = (a) => { const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const quant = (a, q) => { const s = a.slice().sort((x, y) => x - y); const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
  const price = (p) => Number(p.priceAED || p.price || 0);
  const area = (p) => Number(p.area_m2 || 0);
  const attrs = (p) => (window.AQFilters ? window.AQFilters.attrs(p) : { unit: '', commercial: false });
  const UNIT_AR = { apartment: 'شقة', studio: 'استوديو', villa: 'فيلا', townhouse: 'تاون هاوس', penthouse: 'بنتهاوس', duplex: 'دوبلكس', chalet: 'شاليه', hotel_apt: 'شقة فندقية', office: 'مكتب', shop: 'محل', warehouse: 'مستودع', showroom: 'معرض', land: 'أرض', building: 'مبنى' };

  // ---------- استدعاء دالة الأدوات ----------
  async function call(action, payload) {
    if (typeof supabaseClient === 'undefined' || !supabaseClient.functions) throw new Error('unavailable');
    const r = await Promise.race([supabaseClient.functions.invoke('ai-tools', { body: Object.assign({ action }, payload) }), new Promise((res) => setTimeout(() => res({ error: { message: 'timeout' } }), 45000))]);
    if (r.error) { const st = r.error.context && r.error.context.status; throw new Error(st === 503 ? 'not_configured' : st === 401 ? 'login_required' : st === 429 ? 'rate_limited' : 'failed'); }
    return r.data;
  }
  const errText = (e) => ({ not_configured: 'أدوات الذكاء الاصطناعي لم تُفعَّل بعد في الموقع.', login_required: 'سجّل الدخول أولًا لاستخدام هذه الأداة.', rate_limited: 'وصلت للحد المسموح هذه الساعة، حاول لاحقًا.' }[e && e.message] || 'تعذّر الاتصال بأداة الذكاء الاصطناعي، حاول مرة أخرى.');

  // ---------- 1) عدالة السعر ----------
  function comparables(p, pool, opts) {
    const a = attrs(p), deal = p.dealType === 'rent' ? 'rent' : 'sale';
    const base = pool.filter((x) => x !== p && String(x.id) !== String(p.id) && price(x) > 0 && area(x) > 0 && (x.dealType === 'rent' ? 'rent' : 'sale') === deal && (!p.city || x.city === p.city));
    let c = base.filter((x) => attrs(x).unit === a.unit && (opts && opts.beds && p.bedrooms != null ? Math.abs((x.bedrooms ?? -9) - p.bedrooms) <= 1 : true));
    if (c.length < 5) c = base.filter((x) => attrs(x).commercial === a.commercial);
    return c;
  }
  function fairness(p, pool) {
    if (!(price(p) > 0 && area(p) > 0)) return null;
    const c = comparables(p, pool);
    if (c.length < 5) return null;
    const ppm = price(p) / area(p), med = median(c.map((x) => price(x) / area(x)));
    const ratio = ppm / med;
    const level = ratio <= 0.9 ? 'good' : ratio >= 1.15 ? 'high' : 'fair';
    return { level, ratio, ppm, med, n: c.length, label: { good: 'سعر أقل من السوق', fair: 'ضمن سعر السوق', high: 'أعلى من متوسط السوق' }[level] };
  }

  // ---------- أنماط ----------
  const css = `
  .aq-pc-deal.aqi-good{background:#16a34a!important;color:#fff!important}
  .aqi-card{background:var(--aqi-c,#fff);border:1px solid var(--aqi-l,#e2e8f0);border-radius:16px;padding:16px;margin:14px 0;font-family:Tajawal,sans-serif}
  [data-theme="dark"] .aqi-card{--aqi-c:#162039;--aqi-l:#2b3654;color:#e2e8f0}
  .aqi-card h3{margin:0 0 8px;font-size:16px;font-weight:900;display:flex;gap:8px;align-items:center}
  .aqi-card p{margin:4px 0;font-size:14px;line-height:1.8}
  .aqi-meter{position:relative;height:10px;border-radius:6px;background:linear-gradient(90deg,#16a34a,#84cc16 40%,#f59e0b 62%,#e11d48);margin:12px 0 4px;direction:ltr}
  .aqi-meter i{position:absolute;top:-5px;width:4px;height:20px;background:#0f172a;border-radius:2px;transform:translateX(-50%)}
  [data-theme="dark"] .aqi-meter i{background:#fff}
  .aqi-sub{color:#64748b;font-size:12.5px}
  .aqi-strip{display:flex;gap:12px;overflow-x:auto;padding:4px 2px 10px;scrollbar-width:thin}
  .aqi-mini{flex:0 0 210px;background:var(--aqi-c,#fff);border:1px solid var(--aqi-l,#e2e8f0);border-radius:14px;overflow:hidden;text-decoration:none;color:inherit;font-family:Tajawal,sans-serif}
  [data-theme="dark"] .aqi-mini{--aqi-c:#162039;--aqi-l:#2b3654;color:#e2e8f0}
  .aqi-mini img{width:100%;height:118px;object-fit:cover;display:block;background:#0f172a}
  .aqi-mini div{padding:8px 10px}.aqi-mini b{display:block;color:#00897b;font-size:15px}.aqi-mini span{display:block;font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .aqi-mini small{color:#64748b;font-size:12px}
  .aqi-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.aqi-chips span{background:#e6f7f5;color:#028090;border-radius:999px;padding:3px 10px;font-size:12.5px;font-weight:800}
  .aqi-head{max-width:1250px;margin:18px auto 0;padding:0 16px;font-family:Tajawal,sans-serif}
  .aqi-head h2{font-size:19px;font-weight:900;margin:0 0 8px;display:flex;align-items:center;gap:8px}
  .aqi-tag{font-size:11px;background:#ede9fe;color:#6d28d9;border-radius:999px;padding:2px 8px;font-weight:800}`;
  function addCss() { if (!document.getElementById('aqiCss')) { const s = document.createElement('style'); s.id = 'aqiCss'; s.textContent = css; document.head.appendChild(s); } }
  const mini = (p, extra) => `<a class="aqi-mini" href="property-details.html?id=${encodeURIComponent(p.id)}"><img src="${esc(p.image || (p.imagesList || [])[0] || '')}" alt="" loading="lazy"><div><b>${money(price(p))}</b><span>${esc(p.title)}</span><small>${p.bedrooms === 0 ? 'استوديو' : p.bedrooms != null ? esc(p.bedrooms) + ' غرف' : ''}${area(p) ? ' · ' + esc(area(p)) + ' م²' : ''}${extra ? ' · ' + extra : ''}</small></div></a>`;

  // ---------- الصفحة الرئيسية: شارة السعر و«مقترح لك» ----------
  function similarTo(p, pool, n) {
    const a = attrs(p), pr = price(p);
    return pool.filter((x) => String(x.id) !== String(p.id) && (x.dealType === 'rent') === (p.dealType === 'rent') && (!p.city || x.city === p.city))
      .map((x) => { const b = attrs(x); let s = 0; if (b.unit === a.unit) s += 3; if (b.commercial === a.commercial) s += 1; if (p.bedrooms != null && x.bedrooms != null) s += Math.max(0, 2 - Math.abs(x.bedrooms - p.bedrooms)); if (pr && price(x)) s += Math.max(0, 3 - Math.abs(Math.log(price(x) / pr)) * 6); if (a.sea && b.sea) s += 1; if (a.luxury === b.luxury) s += 0.5; return [s, x]; })
      .sort((u, v) => v[0] - u[0]).slice(0, n).map((x) => x[1]);
  }
  function indexPage() {
    const box = document.getElementById('properties-container');
    if (!box || typeof getAllProperties !== 'function') return;
    addCss();
    const apply = () => {
      const pool = getAllProperties(); if (!pool.length) return;
      box.querySelectorAll('.aq-pcard').forEach((card) => {
        if (card.dataset.aqi) return; card.dataset.aqi = '1';
        const p = pool.find((x) => 'card-' + x.id === card.id); if (!p) return;
        const f = fairness(p, pool);
        const tags = card.querySelector('.aq-pc-tags');
        if (f && f.level === 'good' && tags) tags.insertAdjacentHTML('beforeend', `<span class="aq-pc-deal aqi-good" title="سعر المتر أقل بـ ${Math.round((1 - f.ratio) * 100)}% من متوسط ${f.n} عقارًا مشابهًا">سعر مناسب</span>`);
      });
    };
    new MutationObserver(apply).observe(box, { childList: true });
    let tries = 0; const t = setInterval(() => { tries++; if (getAllProperties().length || tries > 20) { clearInterval(t); apply(); forYou(); } }, 500);
  }
  function forYou() {
    let visited = [];
    try { visited = JSON.parse(localStorage.getItem('anaaqar_visited') || '[]'); } catch (e) {}
    if (visited.length < 2 || document.getElementById('aqiForYou')) return;
    const pool = getAllProperties();
    const seen = visited.slice(-10).map((id) => pool.find((p) => String(p.id) === String(id))).filter(Boolean);
    if (seen.length < 2) return;
    const scores = new Map();
    seen.forEach((s, i) => similarTo(s, pool, 30).forEach((x, j) => { if (visited.includes(String(x.id))) return; scores.set(x, (scores.get(x) || 0) + (30 - j) * (1 + i / seen.length)); }));
    const picks = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map((x) => x[0]);
    if (picks.length < 3) return;
    const sec = document.querySelector('.properties-section'); if (!sec) return;
    const el = document.createElement('section'); el.id = 'aqiForYou'; el.className = 'aqi-head';
    el.innerHTML = `<h2><i class="fas fa-wand-magic-sparkles" style="color:#8b5cf6"></i> مقترح لك <span class="aqi-tag">حسب ما تصفحته</span></h2><div class="aqi-strip">${picks.map((p) => mini(p)).join('')}</div>`;
    sec.parentNode.insertBefore(el, sec);
  }

  // ---------- صفحة التفاصيل ----------
  const AMEN_AR = { pool: 'مسبح', gym: 'نادي رياضي', parking: 'موقف سيارات', balcony: 'شرفة', maid: 'غرفة خادمة', central_ac: 'تكييف مركزي', security: 'حراسة وأمن', garden: 'حديقة', pets: 'يُسمح بالحيوانات الأليفة', kids: 'منطقة ألعاب أطفال' };
  const NEAR_AR = { beach: 'البحر', metro: 'المترو', mall: 'مول', school: 'مدارس', university: 'جامعة', hospital: 'مستشفى', mosque: 'مسجد', park: 'حديقة', supermarket: 'سوبرماركت', airport: 'المطار' };
  function areaName(p) {
    const t = p.title || '';
    const list = (window.AQPublic && AQPublic.AREAS) || [];
    for (const [k] of list) if (k.length > 3 && !/^(دبي|أبوظبي|الشارقة|عجمان)$/.test(k) && t.includes(k)) return k;
    const m = t.match(/(?:في|-)\s+([^،\-]+?)\s*(?:،|$)/); if (m && m[1].trim().length > 2) return m[1].trim();
    return p.city || '';
  }
  async function detailsPage(p) {
    if (!p) return;
    addCss();
    const anchor = document.getElementById('propFullDesc'); const host = anchor && anchor.closest('.info-section-card');
    if (!host) return;
    // الميزات الحقيقية بدل القائمة الثابتة
    const a = attrs(p), am = document.getElementById('secAmenities');
    if (am && window.AQFilters) {
      const items = [];
      if (a.furn) items.push({ furnished: 'مفروش', unfurnished: 'غير مفروش', partly: 'مفروش جزئيًا' }[a.furn]);
      if (a.sea) items.push({ beachfront: 'على البحر مباشرة', sea_view: 'إطلالة بحرية', near_sea: 'قريب من البحر' }[a.sea]);
      if (a.luxury) items.push('عقار فاخر');
      a.amen.forEach((k) => AMEN_AR[k] && items.push(AMEN_AR[k]));
      a.near.forEach((k) => k !== 'beach' && NEAR_AR[k] && items.push('قريب من ' + NEAR_AR[k]));
      const grid = am.querySelector('.amenities-list-grid');
      if (grid) { grid.innerHTML = items.map((x) => `<div class="amenity-item-bullet"><i class="fas fa-circle"></i> ${esc(x)}</div>`).join(''); am.style.display = items.length ? '' : 'none'; }
    }
    let pool = [];
    try { pool = window.AQPublic ? await AQPublic.loadListings() : []; } catch (e) {}
    const self = pool.find((x) => String(x.id) === String(p.id)) || p;
    // مؤشر السعر
    const f = fairness(self, pool);
    if (f) {
      const pos = Math.max(3, Math.min(97, 50 + (f.ratio - 1) * 100 * 1.6));
      host.insertAdjacentHTML('afterend', `<div class="aqi-card" id="aqiPrice"><h3><i class="fas fa-scale-balanced" style="color:#00a896"></i> هل السعر مناسب؟ <span class="aqi-tag">تحليل ذكي</span></h3>
        <p><b style="color:${f.level === 'good' ? '#16a34a' : f.level === 'high' ? '#e11d48' : '#d97706'}">${f.label}</b> — سعر المتر هنا ${money(f.ppm)}، ومتوسط ${f.n} عقارًا مشابهًا ${self.city ? 'في ' + esc(self.city) : ''} ${money(f.med)}.</p>
        <div class="aqi-meter"><i style="left:${pos}%"></i></div><div class="aqi-sub" style="display:flex;justify-content:space-between;direction:ltr"><span>أقل من السوق</span><span>أعلى من السوق</span></div>
        <p class="aqi-sub">مقارنة بالإعلانات المعروضة على أنا عقار، وليست تقييمًا رسميًا.</p></div>`);
    }
    // عقارات مشابهة
    const sim = similarTo(self, pool, 8);
    const after = document.getElementById('aqiPrice') || host;
    if (sim.length) after.insertAdjacentHTML('afterend', `<div class="aqi-card" id="aqiSimilar"><h3><i class="fas fa-clone" style="color:#00a896"></i> عقارات مشابهة</h3><div class="aqi-strip">${sim.map((x) => { const fx = fairness(x, pool); return mini(x, fx && fx.level === 'good' ? '<b style="display:inline;color:#16a34a;font-size:12px">سعر مناسب</b>' : ''); }).join('')}</div></div>`);
    // نبذة المنطقة
    const an = areaName(self);
    if (!an) return;
    const inArea = pool.filter((x) => (x.title || '').includes(an) || (an === x.city));
    const sale = inArea.filter((x) => x.dealType !== 'rent' && price(x) && area(x)).map((x) => price(x) / area(x));
    const rent = inArea.filter((x) => x.dealType === 'rent' && price(x)).map(price);
    const stats = [inArea.length ? `العقارات المعروضة هنا: ${inArea.length}` : '', sale.length >= 3 ? `متوسط سعر المتر للبيع ${money(median(sale))}` : '', rent.length >= 3 ? `متوسط الإيجار السنوي ${money(median(rent))}` : ''].filter(Boolean);
    const last = document.getElementById('aqiSimilar') || after;
    last.insertAdjacentHTML('afterend', `<div class="aqi-card" id="aqiArea"><h3><i class="fas fa-map-location-dot" style="color:#00a896"></i> عن منطقة ${esc(an)} <span class="aqi-tag">ذكاء اصطناعي</span></h3>
      ${stats.length ? `<div class="aqi-chips">${stats.map((s) => `<span>${esc(s)}</span>`).join('')}</div>` : ''}<div id="aqiAreaBody"><p class="aqi-sub"><i class="fas fa-spinner fa-spin"></i> جاري تجهيز النبذة...</p></div></div>`);
    try {
      const r = await call('area_summary', { area: an, city: self.city || '' });
      const body = document.getElementById('aqiAreaBody');
      if (!r.summary) { body.innerHTML = ''; if (!stats.length) document.getElementById('aqiArea').remove(); return; }
      body.innerHTML = `<p>${esc(r.summary)}</p>${(r.highlights || []).length ? `<ul style="margin:6px 0;padding-inline-start:20px;font-size:14px;line-height:1.8">${r.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}${(r.good_for || []).length ? `<div class="aqi-chips">${r.good_for.map((g) => `<span>مناسبة لـ ${esc(g)}</span>`).join('')}</div>` : ''}<p class="aqi-sub">نبذة عامة مولّدة آليًا، تحقّق من التفاصيل بنفسك.</p>`;
    } catch (e) {
      const body = document.getElementById('aqiAreaBody'); if (body) body.innerHTML = '';
      if (!stats.length) { const el = document.getElementById('aqiArea'); if (el) el.remove(); }
    }
  }

  // ---------- أدوات الصور ----------
  function loadImg(file) { return new Promise((res, rej) => { const u = URL.createObjectURL(file); const im = new Image(); im.onload = () => { res(im); setTimeout(() => URL.revokeObjectURL(u), 1000); }; im.onerror = rej; im.src = u; }); }
  async function dHash(file) {
    const im = await loadImg(file); const c = document.createElement('canvas'); c.width = 9; c.height = 8;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0, 9, 8); const d = g.getImageData(0, 0, 9, 8).data;
    let bits = '';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const i = (y * 9 + x) * 4, j = i + 4; const l = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114, r = d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114; bits += l > r ? '1' : '0'; }
    let hex = ''; for (let k = 0; k < 64; k += 4) hex += parseInt(bits.slice(k, k + 4), 2).toString(16);
    return hex;
  }
  async function toDataUrl(file, max) {
    const im = await loadImg(file); const s = Math.min(1, (max || 768) / Math.max(im.width, im.height));
    const c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.8);
  }

  // ---------- 7) تقييم جدية العميل (بدون ذكاء اصطناعي: قواعد واضحة) ----------
  function leadScore(l) {
    if (l.stage === 'won') return { score: 100, label: 'تمت الصفقة', cls: 'won' };
    if (l.stage === 'lost') return { score: 0, label: 'مغلق', cls: 'lost' };
    let s = 10; const why = [];
    if (l.buyer_phone) { s += 25; why.push('ترك رقمه'); }
    if (l.buyer_email) s += 8;
    if (l.budget) { s += 15; why.push('حدد ميزانيته'); }
    const msg = (l.message || '') + ' ' + (l.requirements || '');
    if (msg.trim().length > 40) { s += 12; why.push('كتب تفاصيل'); }
    if (/معاين|زيارة|متى|موعد|نقد|كاش|جاهز|فوري|هذا الأسبوع|viewing|cash/i.test(msg)) { s += 12; why.push('نية واضحة'); }
    const days = (Date.now() - new Date(l.created_at).getTime()) / 864e5;
    if (days < 2) s += 15; else if (days < 7) s += 8; else if (days > 30) s -= 10;
    if (['viewing', 'negotiating'].includes(l.stage)) { s += 15; why.push('في مرحلة متقدمة'); }
    s = Math.max(0, Math.min(99, s));
    return { score: s, label: s >= 70 ? '🔥 ساخن' : s >= 45 ? 'دافئ' : 'بارد', cls: s >= 70 ? 'hot' : s >= 45 ? 'warm' : 'cold', why };
  }

  window.AQAI = { call, errText, fairness, comparables, similarTo, detailsPage, dHash, toDataUrl, leadScore, median, quant, money, UNIT_AR, attrs };
  const page = (location.pathname.split('/').pop() || 'index.html');
  if (page === '' || page === 'index.html') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', indexPage); else indexPage(); }
})();
