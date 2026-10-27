/* أدوات مشتركة للصفحات العامة الجديدة: المشاريع، الخريطة، المقارنة، الحاسبة، اطلب عقارك */
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => (n == null || n === '' || isNaN(n)) ? '—' : Number(n).toLocaleString('en-US') + ' درهم';

  // إحداثيات تقريبية لمناطق الإمارات، تُستعمل للعقارات التي لم يحدد صاحبها موقعها على الخريطة
  const AREAS = [
    ['دبي مارينا', 25.0805, 55.1403], ['marina', 25.0805, 55.1403], ['جميرا بيتش', 25.0780, 55.1340], ['JBR', 25.0780, 55.1340],
    ['أبراج بحيرات جميرا', 25.0693, 55.1416], ['JLT', 25.0693, 55.1416], ['نخلة جميرا', 25.1124, 55.1390], ['النخلة', 25.1124, 55.1390],
    ['وسط مدينة دبي', 25.1972, 55.2744], ['داون تاون', 25.1972, 55.2744], ['Downtown', 25.1972, 55.2744], ['الخليج التجاري', 25.1857, 55.2650], ['Business Bay', 25.1857, 55.2650],
    ['قرية جميرا الدائرية', 25.0590, 55.2066], ['JVC', 25.0590, 55.2066], ['مثلث قرية جميرا', 25.0450, 55.1890], ['JVT', 25.0450, 55.1890],
    ['دبي هيلز', 25.1035, 55.2450], ['المرابع العربية', 25.0450, 55.2630], ['الخليج الحضري', 25.0920, 55.1500],
    ['ديرة', 25.2697, 55.3095], ['بر دبي', 25.2532, 55.2953], ['الكرامة', 25.2440, 55.3040], ['القوز', 25.1500, 55.2400],
    ['البرشاء', 25.1100, 55.2000], ['الصفوح', 25.0980, 55.1700], ['تلال الإمارات', 25.0700, 55.1700], ['الينابيع', 25.0600, 55.1700],
    ['ميدان', 25.1600, 55.3000], ['دبي الجنوب', 24.8960, 55.1620], ['دبي لاند', 25.0500, 55.3000], ['الفرجان', 25.0300, 55.1500],
    ['موتور سيتي', 25.0450, 55.2350], ['المدينة الرياضية', 25.0400, 55.2200], ['ديسكفري جاردنز', 25.0400, 55.1400], ['الند الشبا', 25.1500, 55.3100],
    ['مردف', 25.2190, 55.4210], ['المزهر', 25.2350, 55.4300], ['الورقاء', 25.1900, 55.4100], ['السيليكون', 25.1240, 55.3850], ['واحة دبي للسيليكون', 25.1240, 55.3850],
    ['الجداف', 25.2200, 55.3300], ['خور دبي', 25.2050, 55.3500], ['جزر دبي', 25.3000, 55.3000], ['جميرا', 25.2000, 55.2400], ['أم سقيم', 25.1500, 55.2100],
    ['جزيرة الريم', 24.4980, 54.4060], ['جزيرة ياس', 24.4950, 54.6050], ['السعديات', 24.5400, 54.4300], ['الراحة', 24.4500, 54.6000], ['أبوظبي', 24.4539, 54.3773],
    ['الشارقة', 25.3463, 55.4209], ['عجمان', 25.4052, 55.5136], ['رأس الخيمة', 25.8007, 55.9762], ['جزيرة المرجان', 25.6650, 55.7400], ['أم القيوين', 25.5647, 55.5552], ['الفجيرة', 25.1288, 56.3265], ['العين', 24.2075, 55.7447],
    ['دبي', 25.2048, 55.2708], ['الرياض', 24.7136, 46.6753], ['جدة', 21.4858, 39.1925], ['الدمام', 26.4207, 50.0888], ['القاهرة', 30.0444, 31.2357], ['الدوحة', 25.2854, 51.5310], ['مسقط', 23.5880, 58.3829]
  ];
  function guessCoords(text, seed) {
    const t = String(text || '');
    for (const [k, la, ln] of AREAS) {
      if (t.toLowerCase().includes(k.toLowerCase())) {
        // إزاحة صغيرة ثابتة حتى لا تتطابق العلامات فوق بعضها
        let h = 0; String(seed || t).split('').forEach((c) => { h = (h * 31 + c.charCodeAt(0)) | 0; });
        return [la + ((h % 100) / 100 - 0.5) * 0.012, ln + (((h >> 7) % 100) / 100 - 0.5) * 0.012, true];
      }
    }
    return null;
  }

  async function loadListings() {
    let out = [];
    try { if (typeof fetchApprovedSupabaseProperties === 'function') out = await fetchApprovedSupabaseProperties(); } catch (e) {}
    let showDemo = true;
    try { if (typeof aqDemoListingsVisible === 'function') showDemo = await aqDemoListingsVisible(); } catch (e) {}
    if (showDemo) {
      try { const d = await fetch('properties.json').then((r) => r.json()); out = out.concat(d); } catch (e) {}
    }
    return out;
  }
  async function loadProjects() {
    try {
      const r = await supabaseClient.from('projects').select('*').eq('review_status', 'approved').order('created_at', { ascending: false }).limit(300);
      return r.data || [];
    } catch (e) { return []; }
  }
  const compare = {
    get() { try { return JSON.parse(localStorage.getItem('anaaqar_compare') || '[]'); } catch (e) { return []; } },
    toggle(id) {
      const l = compare.get(); const i = l.indexOf(String(id));
      if (i === -1) { if (l.length >= 4) return null; l.push(String(id)); } else l.splice(i, 1);
      try { localStorage.setItem('anaaqar_compare', JSON.stringify(l)); } catch (e) {}
      return l.includes(String(id));
    }
  };
  function toast(m) { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#192038;color:#fff;padding:11px 18px;border-radius:12px;font-weight:800;z-index:9999;max-width:92vw'; d.textContent = m; document.body.appendChild(d); setTimeout(() => d.remove(), 2800); }

  window.AQPublic = { esc, money, guessCoords, loadListings, loadProjects, compare, toast, AREAS };
})();
