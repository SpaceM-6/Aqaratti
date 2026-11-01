/* الثقة في «أنا عقار»:
   - لوحة «التحقق من الإعلان» في صفحة العقار: الرخصة، الملكية، تفويض التسويق، تأكيد التوافر (مع تاريخ كل فحص)
   - بطاقة أداء الوسيط بالأرقام في صفحة الوسيط: نسبة الرد، متوسط زمن الرد، الإعلانات النشطة والمحدّثة…
   تعتمد على supabase/trust_market.sql */
(function () {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var days = function (t) { return t ? Math.max(0, Math.floor((Date.now() - new Date(t).getTime()) / 86400000)) : null; };
  function ago(t) {
    var d = days(t); if (d == null) return '';
    if (d === 0) return 'اليوم'; if (d === 1) return 'أمس'; if (d === 2) return 'منذ يومين';
    if (d <= 10) return 'منذ ' + d + ' أيام'; if (d < 60) return 'منذ ' + d + ' يومًا';
    var m = Math.round(d / 30); return m <= 2 ? 'منذ شهرين' : m <= 10 ? 'منذ ' + m + ' أشهر' : 'منذ ' + m + ' شهرًا';
  }
  var fmtDate = function (t) { try { return new Date(t).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return ''; } };

  function css() {
    if (document.getElementById('aqTrustCss')) return;
    var s = document.createElement('style'); s.id = 'aqTrustCss';
    s.textContent = [
      '.aqtr{background:var(--card,#fff);border:1px solid var(--line,#e2e8f0);border-radius:16px;padding:14px 16px;margin:0 0 16px}',
      '.aqtr h3{margin:0 0 4px;font-size:16px;font-weight:900;display:flex;align-items:center;gap:8px}.aqtr h3 i{color:#16a34a}',
      '.aqtr .sub{margin:0 0 10px;color:var(--muted,#64748b);font-size:12.5px;font-weight:700}',
      '.aqtr ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}',
      '.aqtr li{display:flex;gap:10px;align-items:flex-start;font-size:14px;font-weight:700}',
      '.aqtr li .ic{flex:0 0 auto;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:12px;background:#f1f5f9;color:#94a3b8}',
      '.aqtr li.ok .ic{background:#dcfce7;color:#16a34a}.aqtr li.warn .ic{background:#fef3c7;color:#b45309}',
      '.aqtr li small{display:block;color:var(--muted,#64748b);font-weight:600;font-size:12px}',
      '.aqsc{background:var(--card,#fff);border:1px solid var(--line,#e2e8f0);border-radius:16px;padding:14px;margin:14px 0}',
      '.aqsc h3{margin:0 0 10px;font-size:16px;font-weight:900}.aqsc .g{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
      '.aqsc .k{background:var(--bg,#f8fafc);border-radius:12px;padding:10px;text-align:center}.aqsc .k b{display:block;font-size:20px;font-weight:900;color:#0f766e}',
      '.aqsc .k small{display:block;font-size:11.5px;font-weight:700;color:var(--muted,#64748b);line-height:1.5}',
      '.aqsc .bd{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.aqsc .bd span{background:#faf5ff;color:#7c3aed;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:900}',
      '.aqsc .bd span.g2{background:#dcfce7;color:#15803d}.aqsc p.n{margin:8px 0 0;font-size:11.5px;color:var(--muted,#64748b);font-weight:600}',
      '.aqfr{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:800;color:#15803d}.aqfr.old{color:#b45309}'
    ].join('');
    document.head.appendChild(s);
  }

  // لوحة التحقق في صفحة العقار
  function panel(el, p) {
    if (!el || !p) return;
    css();
    var c = p.checks;
    if (!c) { el.innerHTML = ''; return; } // إعلانات العرض التجريبي لا تُفحص
    var av = days(c.available);
    var rows = [
      ['license', 'رخصة المعلن', c.license, 'تحققنا من رقم ترخيص الوسيط أو المكتب', 'لم نتحقق من الرخصة بعد'],
      ['ownership', 'ملكية العقار', c.ownership, 'تحققنا من سند الملكية لدى الجهة المختصة', 'لم نتحقق من الملكية بعد'],
      ['mandate', 'تفويض التسويق', c.mandate, 'المعلن مفوَّض من المالك بتسويق هذا العقار', 'لم نتحقق من تفويض التسويق بعد'],
      ['available', 'توافر العقار', c.available, av != null && av > 30 ? 'لم يُحدَّث منذ مدة، تأكد من المعلن قبل الزيارة' : 'أكّد المعلن أن العقار ما زال متاحًا', 'لم يؤكد المعلن توافره بعد']
    ];
    var done = rows.filter(function (r) { return r[2]; }).length;
    el.innerHTML = '<div class="aqtr"><h3><i class="fas fa-shield-halved"></i> التحقق من الإعلان (' + done + ' من 4)</h3>' +
      '<p class="sub">كل فحص يظهر مع تاريخه. الإعلان الموثّق بالكامل يعني أن الرخصة والملكية والتفويض فُحصت.</p><ul>' +
      rows.map(function (r) {
        var cls = r[2] ? (r[0] === 'available' && av > 30 ? 'warn' : 'ok') : '';
        return '<li class="' + cls + '"><span class="ic"><i class="fas ' + (cls === 'ok' ? 'fa-check' : cls === 'warn' ? 'fa-clock' : 'fa-minus') + '"></i></span><span>' + r[1] +
          '<small>' + (r[2] ? esc(r[3]) + ' · ' + (r[0] === 'available' ? ago(r[2]) : fmtDate(r[2])) : esc(r[4])) + '</small></span></li>';
      }).join('') + '</ul></div>';
  }

  // شارة حداثة صغيرة للبطاقات: «محدّث منذ 3 أيام»
  function fresh(p) {
    var t = p && p.checks && p.checks.available; if (!t) return '';
    css();
    var d = days(t);
    return '<span class="aqfr' + (d > 30 ? ' old' : '') + '"><i class="fas ' + (d > 30 ? 'fa-clock' : 'fa-circle-check') + '"></i> ' + (d > 30 ? 'آخر تأكيد ' : 'متاح · ') + ago(t) + '</span>';
  }

  // بطاقة أداء الوسيط
  async function scorecard(el, brokerId) {
    if (!el || !brokerId || !/^[0-9a-f-]{36}$/i.test(brokerId) || typeof supabaseClient === 'undefined') return;
    css();
    var r; try { r = await supabaseClient.rpc('broker_scorecard', { p_broker: brokerId }); } catch (e) { return; }
    var s = r && r.data; if (!s || r.error) return;
    var hrs = s.avg_response_hrs, rt = hrs == null ? '—' : hrs < 1 ? 'أقل من ساعة' : hrs < 24 ? Math.round(hrs) + ' ساعة' : Math.round(hrs / 24) + ' يوم';
    var k = function (v, t) { return '<div class="k"><b>' + (v == null ? '—' : esc(v)) + '</b><small>' + t + '</small></div>'; };
    var badges = [];
    if (s.leads_90d >= 3 && s.responded_pct >= 90 && hrs != null && hrs <= 2) badges.push('<span><i class="fas fa-bolt"></i> سريع الاستجابة</span>');
    if (s.active >= 3 && s.fresh_pct >= 90) badges.push('<span class="g2"><i class="fas fa-rotate"></i> إعلانات محدّثة</span>');
    if (s.verified_listings >= 1) badges.push('<span class="g2"><i class="fas fa-shield-halved"></i> ' + s.verified_listings + ' إعلان موثّق بالكامل</span>');
    el.innerHTML = '<div class="aqsc"><h3><i class="fas fa-chart-simple" style="color:#0f766e"></i> أداء الوسيط بالأرقام</h3><div class="g">' +
      k(s.responded_pct == null ? null : s.responded_pct + '%', 'نسبة الرد على العملاء') + k(rt, 'متوسط زمن أول رد') +
      k(s.active, 'إعلانات نشطة') + k(s.fresh_pct == null ? null : s.fresh_pct + '%', 'إعلانات أُكّد توافرها خلال 30 يومًا') +
      k(s.closed, 'صفقات مكتملة على المنصة') + k(s.confirmed_reports, 'بلاغات مؤكدة') + '</div>' +
      (badges.length ? '<div class="bd">' + badges.join('') + '</div>' : '') +
      '<p class="n">محسوبة تلقائيًا من نشاط آخر 90 يومًا على «أنا عقار».</p></div>';
  }

  window.AQTrust = { panel: panel, fresh: fresh, scorecard: scorecard, ago: ago, days: days };
})();
