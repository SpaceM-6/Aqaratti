/* شورت تيرم (الإيجار اليومي والشهري) في «أنا عقار»: التحميل، حساب السعر، التقويم، الضيوف، الإرشادات */
(function () {
  'use strict';
  if (window.AQStay) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const aed = (n) => num(n) + ' درهم';
  const LS = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  // ---------------- التواريخ ----------------
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const today = () => ymd(new Date());
  const nightsBetween = (a, b) => (a && b) ? Math.round((Date.UTC(...b.split('-').map((x, i) => i === 1 ? x - 1 : +x)) - Date.UTC(...a.split('-').map((x, i) => i === 1 ? x - 1 : +x))) / 864e5) : 0;
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const fmt = (s, withDay) => { if (!s) return ''; const d = parse(s); return (withDay ? DAYS[d.getDay()] + ' ' : '') + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); };
  const fmtRange = (a, b) => {
    if (!a || !b) return '';
    const A = parse(a), B = parse(b);
    if (A.getFullYear() === B.getFullYear() && A.getMonth() === B.getMonth()) return A.getDate() + ' – ' + B.getDate() + ' ' + MONTHS[A.getMonth()] + ' ' + A.getFullYear();
    return A.getDate() + ' ' + MONTHS[A.getMonth()] + ' – ' + B.getDate() + ' ' + MONTHS[B.getMonth()] + ' ' + B.getFullYear();
  };
  const nightsTxt = (n) => n === 1 ? 'ليلة واحدة' : n === 2 ? 'ليلتان' : n <= 10 ? n + ' ليالٍ' : n + ' ليلة';
  const resTxt = (n) => n === 0 ? 'لا نتائج' : n === 1 ? 'نتيجة واحدة' : n === 2 ? 'نتيجتين' : n <= 10 ? n + ' نتائج' : n + ' نتيجة';
  const guestsTxt = (a, c) => { const t = (a || 0) + (c || 0); return t === 1 ? 'ضيف واحد' : t === 2 ? 'ضيفان' : t + ' ضيوف'; };

  // ---------------- القوائم ----------------
  const CATS = [['', 'الكل', 'fa-border-all'], ['apartment', 'شقق', 'fa-building'], ['villa', 'فلل', 'fa-house'], ['hotel_apt', 'شقق فندقية', 'fa-hotel'], ['studio', 'استوديو', 'fa-couch'], ['room', 'غرف', 'fa-door-closed'], ['chalet', 'شاليهات', 'fa-umbrella-beach']];
  const CAT_AR = Object.fromEntries(CATS.map((c) => [c[0], c[1].replace(/^شقق$/, 'شقة').replace('فلل', 'فيلا').replace('شقق فندقية', 'شقة فندقية').replace('غرف', 'غرفة').replace('شاليهات', 'شاليه')]));
  const AMEN = [
    ['wifi', 'واي فاي', 'fa-wifi'], ['kitchen', 'مطبخ مجهّز', 'fa-kitchen-set'], ['washer', 'غسالة ملابس', 'fa-soap'], ['central_ac', 'تكييف', 'fa-snowflake'],
    ['tv', 'تلفاز', 'fa-tv'], ['workspace', 'مكان مخصص للعمل', 'fa-laptop'], ['pool', 'مسبح', 'fa-person-swimming'], ['gym', 'نادي رياضي', 'fa-dumbbell'],
    ['parking', 'موقف سيارات مجاني', 'fa-square-parking'], ['balcony', 'شرفة', 'fa-archway'], ['bbq', 'منطقة شواء', 'fa-fire-burner'], ['beach_access', 'دخول مباشر للشاطئ', 'fa-umbrella-beach'],
    ['city_center', 'في وسط المدينة', 'fa-city'], ['transport', 'قرب المواصلات العامة', 'fa-train-subway'], ['kids', 'مناسب للأطفال', 'fa-children'], ['pets', 'يُسمح بالحيوانات الأليفة', 'fa-paw'],
    ['security', 'أمن على مدار الساعة', 'fa-shield-halved'], ['garden', 'حديقة', 'fa-tree']
  ];
  const SPECIAL = ['beach_access', 'bbq', 'city_center', 'transport', 'pool', 'gym', 'parking', 'wifi', 'kitchen', 'washer', 'workspace', 'kids', 'pets'];
  const ACCESS = [['step_free', 'دخول بلا درج', 'fa-wheelchair'], ['wide_halls', 'ممرات واسعة (80 سم على الأقل)', 'fa-arrows-left-right'], ['elevator', 'مصعد', 'fa-elevator'], ['accessible_bath', 'حمام مهيأ لذوي الإعاقة', 'fa-restroom'], ['accessible_parking', 'موقف مخصص لذوي الإعاقة', 'fa-square-parking']];
  const AMEN_AR = Object.fromEntries(AMEN.concat(ACCESS).map((a) => [a[0], a]));
  const POLICY = {
    flexible: ['مرنة', 'إلغاء مجاني حتى 24 ساعة قبل موعد الوصول.'],
    moderate: ['معتدلة', 'إلغاء مجاني حتى 5 أيام قبل موعد الوصول، وبعدها تُحتسب الليلة الأولى.'],
    strict: ['صارمة', 'استرداد 50% عند الإلغاء قبل 7 أيام على الأقل من الوصول، ولا استرداد بعد ذلك.'],
    non_refundable: ['غير قابلة للاسترداد', 'هذا الحجز غير قابل للاسترداد عند الإلغاء.']
  };

  // مزايا العقار مع ما يُستنتج من بياناته
  function amenities(p) {
    const s = new Set((p.amenities || []).concat(p.nearby || []).map((x) => ({ beach: 'beach_access', metro: 'transport' }[x] || x)));
    if (p.seaAccess === 'beachfront') s.add('beach_access');
    return [...s].filter((k) => AMEN_AR[k]);
  }
  const catOf = (p) => p.stayCategory || (p.bedrooms === 0 ? 'studio' : /فيلا|villa/i.test(p.title + p.propertyType) ? 'villa' : /فندق/.test(p.title + p.propertyType) ? 'hotel_apt' : 'apartment');
  const nightly = (p) => Number(p.nightlyPrice || p.priceAED) || 0;

  // نفس معادلة قاعدة البيانات (aq_stay_quote)
  function quote(p, ci, co) {
    const n = nightsBetween(ci, co), nt = nightly(p);
    if (!n || n < 1 || !nt) return null;
    const base = nt * n;
    let disc = 0;
    if (n >= 28 && p.monthlyDiscount > 0) disc = Math.round(base * p.monthlyDiscount) / 100;
    else if (n >= 7 && p.weeklyDiscount > 0) disc = Math.round(base * p.weeklyDiscount) / 100;
    const sub = base - disc + (Number(p.cleaningFee) || 0);
    const vat = Math.round(sub * (Number(p.vatPct) || 0)) / 100;
    const tour = (Number(p.tourismFee) || 0) * n;
    return { nights: n, nightly: nt, base, discount: disc, cleaning: Number(p.cleaningFee) || 0, tourism: tour, service: 0, vat, total: Math.round((sub + vat + tour) * 100) / 100 };
  }
  function breakdownHTML(p, q) {
    if (!q) return '';
    const row = (a, b, cls) => `<div class="aqs-br ${cls || ''}"><span>${a}</span><span>${b}</span></div>`;
    return row(`${aed(q.nightly)} × ${nightsTxt(q.nights)}`, aed(q.base)) +
      (q.discount ? row(q.nights >= 28 ? `خصم الإقامة الشهرية (${p.monthlyDiscount}%)` : `خصم الإقامة الأسبوعية (${p.weeklyDiscount}%)`, '− ' + aed(q.discount), 'g') : '') +
      (q.cleaning ? row('رسوم التنظيف', aed(q.cleaning)) : '') +
      row('رسوم الخدمة', '<b style="color:#16a34a">لا توجد</b>') +
      (q.tourism ? row('رسم درهم السياحة', aed(q.tourism)) : '') +
      (q.vat ? row(`ضريبة القيمة المضافة ${p.vatPct}%`, aed(q.vat)) : '') +
      row('الإجمالي', aed(q.total), 'tot');
  }

  // ---------------- التحميل ----------------
  async function load() {
    let out = [];
    try { if (typeof fetchApprovedStays === 'function') out = await fetchApprovedStays(); } catch (e) {}
    let demo = true;
    try { if (typeof aqDemoListingsVisible === 'function') demo = await aqDemoListingsVisible(); } catch (e) {}
    if (demo || !out.length) {
      try { const d = await fetch('stays.json?v=1').then((r) => r.json()); out = out.concat(d.map((x) => Object.assign({ demo: true, rentPeriod: 'daily' }, x))); } catch (e) {}
    }
    return out;
  }
  async function unavailable(p) {
    if (!p || !p.rawId || typeof supabaseClient === 'undefined') return [];
    try { const r = await supabaseClient.rpc('stay_unavailable', { p_id: p.rawId }); return (r.data || []).map((x) => [x.start_date, x.end_date]); } catch (e) { return []; }
  }

  // ---------------- الأنماط ----------------
  function css() {
    if (document.getElementById('aqs-css')) return;
    const st = document.createElement('style'); st.id = 'aqs-css';
    st.textContent = `
.aqs-ov{position:fixed;inset:0;z-index:2147483400;background:rgba(2,8,23,.5);display:flex;align-items:flex-end;justify-content:center;font-family:Tajawal,Tahoma,sans-serif;direction:rtl}
@media(min-width:760px){.aqs-ov{align-items:center}}
.aqs-sheet{background:var(--card,#fff);color:var(--ink,#0f172a);width:100%;max-width:560px;max-height:90vh;display:flex;flex-direction:column;border-radius:22px 22px 0 0;padding:8px 18px calc(14px + env(safe-area-inset-bottom,0px));animation:aqsUp .22s ease-out;overflow:hidden}
@media(min-width:760px){.aqs-sheet{border-radius:22px}}
@keyframes aqsUp{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}
.aqs-sheet:before{content:"";display:block;width:44px;height:5px;border-radius:3px;background:#cbd5e1;margin:2px auto 10px}
.aqs-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px}
.aqs-hd h3{margin:0;font-size:21px;font-weight:900}
.aqs-x{width:38px;height:38px;border-radius:50%;border:0;background:#e2e8f0;color:#334155;font-size:17px;cursor:pointer;flex:0 0 auto}
.aqs-sub{color:var(--muted,#64748b);font-weight:600;font-size:14.5px;margin:0 0 8px}
.aqs-body{overflow:auto;flex:1;min-height:0;margin:0 -18px;padding:0 18px}
.aqs-ft{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid var(--line,#e2e8f0);padding-top:12px;margin-top:8px}
.aqs-ft .clr{background:none;border:0;font:inherit;font-weight:900;font-size:16px;color:var(--ink,#0f172a);text-decoration:underline;cursor:pointer;padding:10px 4px}
.aqs-ft .go{background:#192038;color:#fff;border:0;border-radius:12px;padding:13px 22px;font:inherit;font-weight:900;font-size:16px;cursor:pointer;min-width:160px}
.aqs-ft .go:disabled{opacity:.45;cursor:not-allowed}
.aqs-wd{display:grid;grid-template-columns:repeat(7,1fr);text-align:center;color:var(--muted,#64748b);font-weight:800;font-size:13px;padding:6px 0;border-bottom:1px solid var(--line,#e2e8f0);position:sticky;top:0;background:var(--card,#fff);z-index:1}
.aqs-mo h4{margin:16px 6px 8px;font-size:18px;font-weight:900}
.aqs-dg{display:grid;grid-template-columns:repeat(7,1fr);row-gap:4px}
.aqs-d{height:44px;border:0;background:none;font:inherit;font-size:16px;font-weight:700;color:var(--ink,#0f172a);cursor:pointer;position:relative}
.aqs-d:disabled{color:#cbd5e1;cursor:default;text-decoration:none}
.aqs-d.bk:disabled{text-decoration:line-through}
.aqs-d.tdy{color:#e11d48;font-weight:900}
.aqs-d.in-r{background:#e6f7f5}
.aqs-d span{display:inline-grid;place-items:center;width:40px;height:40px;border-radius:50%}
.aqs-d.s span,.aqs-d.e span{background:#192038;color:#fff}
.aqs-d.s.rng{background:linear-gradient(to left,transparent 50%,#e6f7f5 50%)}.aqs-d.e{background:linear-gradient(to right,transparent 50%,#e6f7f5 50%)}
.aqs-g{display:flex;align-items:center;justify-content:space-between;padding:16px 0;border-bottom:1px solid var(--line,#e2e8f0)}
.aqs-g b{display:block;font-size:17px}.aqs-g small{color:var(--muted,#64748b);font-weight:600;font-size:14.5px}
.aqs-st{display:flex;align-items:center;gap:14px}.aqs-st button{width:42px;height:42px;border-radius:50%;border:1.5px solid #0f172a;background:var(--card,#fff);color:var(--ink,#0f172a);font-size:20px;cursor:pointer;line-height:1}
.aqs-st button:disabled{border-color:#cbd5e1;color:#cbd5e1;cursor:default}.aqs-st output{min-width:22px;text-align:center;font-weight:900;font-size:18px}
.aqs-br{display:flex;justify-content:space-between;gap:10px;padding:6px 0;font-size:15.5px}.aqs-br.g span:last-child{color:#16a34a;font-weight:800}
.aqs-br.tot{font-weight:900;font-size:17px;border-top:1px solid var(--line,#e2e8f0);margin-top:4px;padding-top:10px}
.aqs-coach{position:fixed;inset:0;z-index:2147483450;font-family:Tajawal,Tahoma,sans-serif;direction:rtl}
.aqs-coach .hole{position:fixed;border-radius:12px;box-shadow:0 0 0 9999px rgba(2,8,23,.55);transition:all .25s;pointer-events:none;background:transparent;outline:4px solid #fff}
.aqs-coach .tip{position:fixed;left:16px;right:16px;max-width:420px;margin:0 auto;background:#fff;color:#0f172a;border-radius:18px;padding:16px 18px;box-shadow:0 14px 40px rgba(0,0,0,.25)}
.aqs-coach .tip b{display:block;font-size:17px;margin-bottom:2px}.aqs-coach .tip p{margin:0 0 12px;color:#64748b;font-weight:600;font-size:15px}
.aqs-coach .row{display:flex;align-items:center;gap:10px}.aqs-coach .dots{display:flex;gap:6px;margin-inline-end:auto}.aqs-coach .dots i{width:7px;height:7px;border-radius:50%;background:#cbd5e1}.aqs-coach .dots i.on{background:#0f172a}
.aqs-coach .skip{background:none;border:0;color:#94a3b8;font:inherit;font-weight:800;font-size:15px;cursor:pointer;padding:8px}
.aqs-coach .nx{background:#192038;color:#fff;border:0;border-radius:12px;padding:10px 20px;font:inherit;font-weight:900;font-size:15px;cursor:pointer}`;
    document.head.appendChild(st);
  }

  function sheet(html) {
    css();
    const ov = document.createElement('div'); ov.className = 'aqs-ov';
    ov.innerHTML = `<div class="aqs-sheet" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(ov);
    document.documentElement.style.overflow = 'hidden';
    const close = () => { ov.remove(); if (!document.querySelector('.aqs-ov')) document.documentElement.style.overflow = ''; };
    ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-x]')) close(); });
    return { el: ov, close };
  }

  // ---------------- التقويم ----------------
  // opts: {start, end, unavailable:[[s,e)], minNights, title, sub, cta:(n)=>text, onDone(start,end), allowEmpty}
  function pickDates(opts) {
    opts = opts || {};
    let s = opts.start || '', e = opts.end || '';
    const blocks = opts.unavailable || [];
    const busy = (d) => blocks.some(([a, b]) => d >= a && d < b);
    const firstBlockAfter = (d) => blocks.map((x) => x[0]).filter((a) => a > d).sort()[0] || null;
    const t0 = today();
    const S = sheet(`<div class="aqs-hd"><h3>${esc(opts.title || 'اختر التواريخ')}</h3><button class="aqs-x" data-x aria-label="إغلاق">✕</button></div>
      <p class="aqs-sub">${esc(opts.sub || 'الأسعار تختلف حسب التواريخ ومدة الإقامة.')}</p>
      <div class="aqs-body"><div class="aqs-wd">${['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map((d) => `<span>${d}</span>`).join('')}</div><div class="aqs-cal"></div></div>
      <div class="aqs-ft"><button class="clr" type="button">مسح الكل</button><button class="go" type="button"></button></div>`);
    const cal = S.el.querySelector('.aqs-cal'), go = S.el.querySelector('.go');
    function draw() {
      const now = new Date(); let html = '';
      const limit = s && !e ? firstBlockAfter(s) : null;
      for (let m = 0; m < 12; m++) {
        const first = new Date(now.getFullYear(), now.getMonth() + m, 1), days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
        html += `<div class="aqs-mo"><h4>${MONTHS[first.getMonth()]} ${first.getFullYear()}</h4><div class="aqs-dg">` + '<span></span>'.repeat(first.getDay());
        for (let d = 1; d <= days; d++) {
          const k = ymd(new Date(first.getFullYear(), first.getMonth(), d));
          let dis = k < t0, bk = false;
          if (!dis) {
            if (s && !e && k > s) { dis = (limit && k > limit) || nightsBetween(s, k) < (opts.minNights || 1); }
            else { bk = busy(k); dis = bk; }
          }
          const cls = [k === t0 ? 'tdy' : '', k === s ? 's' + (e ? ' rng' : '') : '', k === e ? 'e' : '', s && e && k > s && k < e ? 'in-r' : '', bk ? 'bk' : ''].join(' ');
          html += `<button type="button" class="aqs-d ${cls}" data-d="${k}" ${dis ? 'disabled' : ''}><span>${d}</span></button>`;
        }
        html += '</div></div>';
      }
      cal.innerHTML = html;
      const n = nightsBetween(s, e);
      go.textContent = opts.cta ? opts.cta(n, s, e) : (n ? `تم (${nightsTxt(n)})` : 'تم');
      go.disabled = opts.allowEmpty ? !!(s && !e) : !(s && e);
    }
    cal.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-d]'); if (!b || b.disabled) return;
      const k = b.dataset.d;
      if (!s || e || k <= s) { s = k; e = ''; } else e = k;
      const top = S.el.querySelector('.aqs-body').scrollTop; draw(); S.el.querySelector('.aqs-body').scrollTop = top;
    });
    S.el.querySelector('.clr').onclick = () => { s = ''; e = ''; draw(); };
    go.onclick = () => { S.close(); opts.onDone && opts.onDone(s, e); };
    draw();
    // نبدأ من الشهر المختار
    if (s) { const el = cal.querySelector(`[data-d="${s}"]`); if (el) setTimeout(() => el.closest('.aqs-mo').scrollIntoView({ block: 'start' }), 30); }
    return S;
  }

  // ---------------- الضيوف ----------------
  function pickGuests(opts) {
    opts = opts || {};
    let a = opts.adults || 0, c = opts.children || 0;
    const minA = opts.minAdults || 0, max = opts.max || 30;
    const S = sheet(`<div class="aqs-hd"><h3>الضيوف</h3><button class="aqs-x" data-x aria-label="إغلاق">✕</button></div>
      <div class="aqs-body">
        <div class="aqs-g"><div><b>البالغون</b><small>13 سنة فأكثر</small></div><div class="aqs-st" data-k="a"><button type="button" data-v="1" aria-label="زيادة">+</button><output></output><button type="button" data-v="-1" aria-label="إنقاص">−</button></div></div>
        <div class="aqs-g"><div><b>الأطفال</b><small>من عمر 0 إلى 12 سنة</small></div><div class="aqs-st" data-k="c"><button type="button" data-v="1" aria-label="زيادة">+</button><output></output><button type="button" data-v="-1" aria-label="إنقاص">−</button></div></div>
        ${opts.max ? `<p class="aqs-sub" style="margin-top:10px">الحد الأقصى لهذا العقار: ${guestsTxt(opts.max, 0)}</p>` : ''}
      </div>
      <div class="aqs-ft"><button class="clr" type="button">مسح الكل</button><button class="go" type="button"></button></div>`);
    const go = S.el.querySelector('.go');
    function draw() {
      S.el.querySelector('[data-k="a"] output').textContent = a; S.el.querySelector('[data-k="c"] output').textContent = c;
      S.el.querySelector('[data-k="a"] [data-v="-1"]').disabled = a <= minA; S.el.querySelector('[data-k="c"] [data-v="-1"]').disabled = c <= 0;
      S.el.querySelectorAll('[data-v="1"]').forEach((b) => { b.disabled = a + c >= max; });
      go.textContent = opts.cta ? opts.cta(a, c) : 'تم';
    }
    S.el.querySelectorAll('.aqs-st').forEach((st) => st.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-v]'); if (!b || b.disabled) return;
      if (st.dataset.k === 'a') a = Math.max(minA, a + +b.dataset.v); else c = Math.max(0, c + +b.dataset.v); draw();
    }));
    S.el.querySelector('.clr').onclick = () => { a = minA; c = 0; draw(); };
    go.onclick = () => { S.close(); opts.onDone && opts.onDone(a, c); };
    draw();
    return S;
  }

  // ---------------- الإرشادات أول مرة ----------------
  // steps: [{el, title, text}]
  function coach(key, steps) {
    if (LS.get('aq_coach_' + key, false)) return;
    steps = steps.filter((s) => s.el && s.el.getBoundingClientRect().width);
    if (!steps.length) return;
    css();
    let i = 0;
    const ov = document.createElement('div'); ov.className = 'aqs-coach';
    ov.innerHTML = '<div class="hole"></div><div class="tip"></div>';
    document.body.appendChild(ov);
    const end = () => { ov.remove(); LS.set('aq_coach_' + key, true); };
    function show() {
      const s = steps[i];
      s.el.scrollIntoView({ block: 'center', behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
      setTimeout(() => {
        const r = s.el.getBoundingClientRect(), h = ov.querySelector('.hole'), t = ov.querySelector('.tip');
        Object.assign(h.style, { left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' });
        const last = i === steps.length - 1;
        t.innerHTML = `<b>${esc(s.title)}</b><p>${esc(s.text)}</p><div class="row"><span class="dots">${steps.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</span>${last ? '' : '<button class="skip" type="button">تخطي</button>'}<button class="nx" type="button">${last ? 'تم' : 'التالي'}</button></div>`;
        const below = r.bottom + 14 + 170 < innerHeight;
        t.style.top = below ? r.bottom + 14 + 'px' : 'auto'; t.style.bottom = below ? 'auto' : (innerHeight - r.top + 14) + 'px';
        t.querySelector('.nx').onclick = () => { if (last) end(); else { i++; show(); } };
        const sk = t.querySelector('.skip'); if (sk) sk.onclick = end;
      }, 60);
    }
    show();
  }

  window.AQStay = { esc, num, aed, ymd, parse, addDays, today, nightsBetween, fmt, fmtRange, nightsTxt, guestsTxt, resTxt, MONTHS,
    CATS, CAT_AR, AMEN, AMEN_AR, SPECIAL, ACCESS, POLICY, amenities, catOf, nightly, quote, breakdownHTML,
    load, unavailable, css, sheet, pickDates, pickGuests, coach, LS };
  if (document.head) css(); else document.addEventListener('DOMContentLoaded', css);
})();
