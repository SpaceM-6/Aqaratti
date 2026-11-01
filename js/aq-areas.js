/* المناطق وبيانات السوق الرسمية (دائرة الأراضي) — مشترك بين صفحة المناطق وصفحة تقدير السعر */
(function () {
  'use strict';
  const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
  // المناطق المعروفة واسمها في سجلات دائرة الأراضي (للمناطق التي يختلف اسمها الرسمي عن الشائع)
  const AREAS = [
    { ar: 'دبي مارينا', en: 'Dubai Marina', city: 'دبي', dld: ['Marsa Dubai', 'Dubai Marina'], words: ['دبي مارينا', 'مارينا', 'marina'] },
    { ar: 'وسط مدينة دبي', en: 'Downtown Dubai', city: 'دبي', dld: ['Burj Khalifa'], words: ['وسط مدينة دبي', 'داون تاون', 'downtown', 'برج خليفة'] },
    { ar: 'الخليج التجاري', en: 'Business Bay', city: 'دبي', dld: ['Business Bay'], words: ['الخليج التجاري', 'بيزنس باي', 'business bay'] },
    { ar: 'نخلة جميرا', en: 'Palm Jumeirah', city: 'دبي', dld: ['Palm Jumeirah'], words: ['نخلة جميرا', 'النخلة', 'palm jumeirah'] },
    { ar: 'أبراج بحيرات جميرا', en: 'JLT', city: 'دبي', dld: ['Al Thanyah Fifth', 'Jumeirah Lakes Towers'], words: ['أبراج بحيرات جميرا', 'بحيرات جميرا', 'jlt'] },
    { ar: 'قرية جميرا الدائرية', en: 'JVC', city: 'دبي', dld: ['Al Barsha South Fourth', 'Jumeirah Village Circle'], words: ['قرية جميرا الدائرية', 'jvc'] },
    { ar: 'مثلث قرية جميرا', en: 'JVT', city: 'دبي', dld: ['Jumeirah Village Triangle'], words: ['مثلث قرية جميرا', 'jvt'] },
    { ar: 'دبي هيلز', en: 'Dubai Hills Estate', city: 'دبي', dld: ['Hadaeq Sheikh Mohammed Bin Rashid', 'Dubai Hills'], words: ['دبي هيلز', 'dubai hills'] },
    { ar: 'جميرا بيتش ريزيدنس', en: 'JBR', city: 'دبي', dld: ['Jumeirah Beach Residence'], words: ['جميرا بيتش', 'jbr'] },
    { ar: 'المرابع العربية', en: 'Arabian Ranches', city: 'دبي', dld: ['Arabian Ranches'], words: ['المرابع العربية', 'arabian ranches'] },
    { ar: 'دبي الجنوب', en: 'Dubai South', city: 'دبي', dld: ['Dubai South', 'Madinat Al Mataar'], words: ['دبي الجنوب', 'dubai south'] },
    { ar: 'الفرجان', en: 'Al Furjan', city: 'دبي', dld: ['Al Furjan'], words: ['الفرجان', 'al furjan'] },
    { ar: 'موتور سيتي', en: 'Motor City', city: 'دبي', dld: ['Motor City'], words: ['موتور سيتي', 'motor city'] },
    { ar: 'المدينة الرياضية', en: 'Dubai Sports City', city: 'دبي', dld: ['Dubai Sports City'], words: ['المدينة الرياضية', 'sports city'] },
    { ar: 'ديرة', en: 'Deira', city: 'دبي', dld: ['Deira'], words: ['ديرة', 'deira'] },
    { ar: 'البرشاء', en: 'Al Barsha', city: 'دبي', dld: ['Al Barsha'], words: ['البرشاء', 'al barsha'] },
    { ar: 'واحة دبي للسيليكون', en: 'Dubai Silicon Oasis', city: 'دبي', dld: ['Dubai Silicon Oasis'], words: ['السيليكون', 'silicon oasis'] },
    { ar: 'المدينة العالمية', en: 'International City', city: 'دبي', dld: ['International City Ph 1', 'International City'], words: ['المدينة العالمية', 'international city'] },
    { ar: 'أرجان', en: 'Arjan', city: 'دبي', dld: ['Arjan'], words: ['أرجان', 'arjan'] },
    { ar: 'ديسكفري جاردنز', en: 'Discovery Gardens', city: 'دبي', dld: ['Discovery Gardens'], words: ['ديسكفري جاردنز', 'discovery gardens'] },
    { ar: 'دبي كريك هاربر', en: 'Dubai Creek Harbour', city: 'دبي', dld: ['Dubai Creek Harbour'], words: ['دبي كريك هاربر', 'خور دبي', 'creek harbour'] },
    { ar: 'جزيرة الريم', en: 'Al Reem Island', city: 'أبوظبي', dld: [], words: ['جزيرة الريم', 'reem island'] },
    { ar: 'جزيرة ياس', en: 'Yas Island', city: 'أبوظبي', dld: [], words: ['جزيرة ياس', 'yas island'] },
    { ar: 'جزيرة السعديات', en: 'Saadiyat Island', city: 'أبوظبي', dld: [], words: ['السعديات', 'saadiyat'] },
    { ar: 'جزيرة المرجان', en: 'Al Marjan Island', city: 'رأس الخيمة', dld: [], words: ['جزيرة المرجان', 'marjan'] }
  ];

  // المنطقة المعروفة من اسم أو كلمة (عربي/إنجليزي/الاسم الرسمي)
  function find(name) {
    const n = String(name || '').trim().toLowerCase(); if (!n) return null;
    return AREAS.find((a) => a.ar === name || a.en.toLowerCase() === n || (a.dld || []).some((d) => d.toLowerCase() === n) || (a.words || []).some((w) => n.includes(w.toLowerCase()) || w.toLowerCase() === n)) || null;
  }
  // ملخص بيانات دائرة الأراضي لمنطقة: آخر 12 شهرًا مقابل الـ12 التي قبلها
  // seg: 'all' (الكل) أو 'ready' (جاهز) أو 'offplan' (على الخارطة)
  function summarize(rows, kind, seg) {
    seg = seg || 'all';
    const r = rows.filter((x) => x.kind === kind && (x.segment || 'all') === seg);
    if (!r.length) return null;
    const months = [...new Set(r.map((x) => x.month))].sort();
    const lastM = months[months.length - 1], cut = new Date(lastM); cut.setMonth(cut.getMonth() - 11);
    const cutP = new Date(cut); cutP.setMonth(cutP.getMonth() - 12);
    const inR = (x, a, b) => { const d = new Date(x.month); return d >= a && d <= b; };
    const wmed = (list, key) => { const v = []; list.forEach((x) => { if (x[key] != null) for (let i = 0; i < Math.min(x.deals, 50); i++) v.push(Number(x[key])); }); return median(v); };
    const cur = r.filter((x) => inR(x, cut, new Date(lastM))), prev = r.filter((x) => inR(x, cutP, new Date(cut.getTime() - 1)));
    const byM = {}; r.forEach((x) => { const k = x.month; byM[k] = byM[k] || { m: k, deals: 0, list: [] }; byM[k].deals += x.deals; byM[k].list.push(x); });
    const series = Object.values(byM).sort((a, b) => a.m < b.m ? -1 : 1).slice(-24).map((b) => ({ m: b.m, deals: b.deals, ppm: wmed(b.list, 'median_ppm2') }));
    const ppm = wmed(cur, 'median_ppm2'), ppmP = wmed(prev, 'median_ppm2');
    return { lastM, deals: cur.reduce((a, x) => a + x.deals, 0), ppm, price: wmed(cur, 'median_price'), change: ppm && ppmP ? (ppm / ppmP - 1) * 100 : null, series };
  }

  async function marketRows(names) {
    if (typeof supabaseClient === 'undefined' || !names.length) return [];
    try {
      const v = (n) => '"' + n.replace(/["\\,()]/g, ' ').trim() + '"';
      const ors = names.map((n) => `area_en.ilike.${v(n)},area_ar.ilike.${v(n)}`).join(',');
      const r = await supabaseClient.from('area_market_stats').select('*').or(ors).in('usage', ['residential', 'all']).order('month').limit(2000);
      return r.data || [];
    } catch (e) { return []; }
  }


  // ===== مشاريع دائرة الأراضي (dld_projects) =====
  const title = (t) => String(t || '').toLowerCase().replace(/(^|[\s\-\/(&.])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bL\.?l\.?c\b/gi, 'LLC');
  const ST = { ACTIVE: ['قيد الإنشاء', '#0f766e', '#dcfce7'], PENDING: ['بانتظار البدء', '#92400e', '#fef3c7'], FINISHED: ['مكتمل', '#1d4ed8', '#dbeafe'], COMPLETED: ['مكتمل', '#1d4ed8', '#dbeafe'] };
  async function dldProjects(names, limit) {
    if (typeof supabaseClient === 'undefined') return [];
    try {
      let q = supabaseClient.from('dld_projects').select('*').neq('status', 'CANCELLED');
      if (names && names.length) { const v = (n) => '"' + n.replace(/["\\,()]/g, ' ').trim() + '"'; q = q.or(names.map((n) => `area_en.ilike.${v(n)}`).join(',')); }
      const r = await q.order('cnt_unit', { ascending: false }).limit(limit || 60);
      return r.data || [];
    } catch (e) { return []; }
  }
  function projectCard(p) {
    const e = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const st = ST[p.status] || [p.status || '', '#475569', '#f1f5f9'], pc = Math.max(0, Math.min(100, Number(p.percent_completed) || 0));
    const end = p.end_date ? new Date(p.end_date).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }) : '';
    const units = [p.cnt_unit ? p.cnt_unit.toLocaleString('en-US') + ' وحدة' : '', p.cnt_villa ? p.cnt_villa + ' فيلا' : '', p.cnt_building ? p.cnt_building + ' مبنى' : ''].filter(Boolean).join(' · ');
    return `<div class="dldp"><div class="t"><b>${e(title(p.name_en))}</b><span style="background:${st[2]};color:${st[1]}">${e(st[0])}</span></div>
      <small>${e(title(p.developer_en))}${p.area_en ? ' · ' + e(p.area_en) : ''}</small>
      <div class="bar" title="نسبة الإنجاز حسب آخر تفتيش"><i style="width:${pc}%"></i></div>
      <div class="m"><span>الإنجاز <b>${pc.toFixed(pc % 1 ? 1 : 0)}%</b></span>${end ? `<span>التسليم المتوقع <b>${e(end)}</b></span>` : ''}${units ? `<span>${e(units)}</span>` : ''}</div>
      ${p.inspection_date ? `<small class="ins">آخر تفتيش: ${new Date(p.inspection_date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })}</small>` : ''}</div>`;
  }
  const PROJECT_CSS = '.dldp{background:var(--card,#fff);border:1px solid var(--line,#e2e8f0);border-radius:14px;padding:12px 14px;min-width:0}.dldp .t{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.dldp .t b{font-size:15px;line-height:1.4}.dldp .t span{flex:0 0 auto;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:900}.dldp small{display:block;color:var(--muted,#64748b);font-weight:700;font-size:12.5px;margin-top:2px}.dldp .bar{height:8px;border-radius:99px;background:#e2e8f0;margin:10px 0 6px;overflow:hidden}.dldp .bar i{display:block;height:100%;background:linear-gradient(90deg,#14b8a6,#0f766e);border-radius:99px}.dldp .m{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;font-weight:700;color:var(--muted,#64748b)}.dldp .m b{color:var(--ink,#0f172a)}.dldp .ins{font-size:11.5px!important}.dldgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}@media(max-width:860px){.dldgrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.dldgrid{grid-template-columns:minmax(0,1fr)}}';
  function css() { if (document.getElementById('dldCss')) return; const st = document.createElement('style'); st.id = 'dldCss'; st.textContent = PROJECT_CSS; document.head.appendChild(st); }

  window.AQAreas = { AREAS, find, summarize, marketRows, median, dldProjects, projectCard, projectCss: css, title };
})();
