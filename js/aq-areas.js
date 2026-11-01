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


  window.AQAreas = { AREAS, find, summarize, marketRows, median };
})();
