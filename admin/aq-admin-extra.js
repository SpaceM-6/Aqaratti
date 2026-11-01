/* لوحة التحكم — قسمان:
   1) «جودة الإعلانات والتحقق»: مؤشرات المخزون + مستويات التحقق لكل إعلان (الرخصة، الملكية، التفويض، التوافر)
   2) «بيانات السوق»: رفع ملف CSV المفتوح من دائرة الأراضي والأملاك (صفقات البيع أو عقود الإيجار)،
      وتحويله في المتصفح إلى ملخص شهري لكل منطقة يُحفظ في جدول area_market_stats.
   يعتمد على supabase/trust_market.sql */
(function () {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var num = function (n) { return n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('en-US'); };
  var sb = function () { return typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient; };
  var setupMsg = function (e) { return /function|relation|column|does not exist|schema cache/i.test((e && e.message) || '') ? 'شغّلي ملف supabase/trust_market.sql من SQL Editor أولًا.' : esc((e && e.message) || 'تعذّر التحميل'); };
  var fmt = function (t) { try { return new Date(t).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };

  // ===================== جودة الإعلانات والتحقق =====================
  var qFilter = 'stale';
  async function loadQuality(el) {
    el.innerHTML = '<div class="card">جاري التحميل…</div>';
    var r = await sb().rpc('admin_inventory_quality');
    if (r.error) { el.innerHTML = '<div class="card">' + setupMsg(r.error) + '</div>'; return; }
    var q = r.data || {};
    var st = function (v, t, hot) { return '<div class="stat"' + (hot && v > 0 ? ' style="border-color:#fca5a5"' : '') + '><b>' + num(v) + '</b><span>' + t + '</span></div>'; };
    el.innerHTML = '<div class="stats">' +
      st(q.active, 'إعلانات نشطة') + st(q.stale_30, 'لم يُؤكَّد توافرها منذ 30 يومًا', true) + st(q.stale_60, 'منذ 60 يومًا', true) +
      st(q.age_median_days, 'متوسط عمر الإعلان (يوم)') + st(q.duplicates, 'إعلانات بصور مكررة', true) + st(q.no_permit, 'بلا رقم تصريح', true) + st(q.fully_checked, 'موثّقة بالكامل') + '</div>' +
      '<div class="card"><b>النشطة في كل مدينة:</b> ' + (q.by_city || []).map(function (c) { return esc(c.city) + ' <b>' + num(c.n) + '</b>'; }).join(' · ') + '</div>' +
      '<div class="pills" id="qPills"><button class="pill' + (qFilter === 'stale' ? ' on' : '') + '" data-f="stale">الأقدم تأكيدًا أولًا</button><button class="pill' + (qFilter === 'unchecked' ? ' on' : '') + '" data-f="unchecked">لم تُفحص ملكيتها</button><button class="pill' + (qFilter === 'new' ? ' on' : '') + '" data-f="new">الأحدث</button></div>' +
      '<p class="sub">علّمي كل فحص بعد التحقق منه (رقم الرخصة في سجل دائرة الأراضي، سند الملكية، نموذج تفويض التسويق A، اتصال بالمعلن للتوافر). يظهر كل فحص للزوار مع تاريخه.</p><div id="qList"></div>';
    el.querySelectorAll('#qPills .pill').forEach(function (b) { b.onclick = function () { qFilter = b.dataset.f; loadQuality(el); }; });
    var qb = sb().from('properties').select('id,title,city,created_at,available_at,check_license_at,check_ownership_at,check_mandate_at,permit_number,license_number,broker_id').eq('status', 'approved').limit(80);
    if (qFilter === 'stale') qb = qb.order('available_at', { ascending: true, nullsFirst: true });
    else if (qFilter === 'unchecked') qb = qb.is('check_ownership_at', null).order('created_at', { ascending: false });
    else qb = qb.order('created_at', { ascending: false });
    var l = await qb;
    var box = el.querySelector('#qList');
    if (l.error) { box.innerHTML = '<div class="card">' + setupMsg(l.error) + '</div>'; return; }
    var K = [['license', 'الرخصة', 'check_license_at'], ['ownership', 'الملكية', 'check_ownership_at'], ['mandate', 'التفويض', 'check_mandate_at'], ['available', 'التوافر', 'available_at']];
    box.innerHTML = (l.data || []).map(function (p) {
      var d = p.available_at ? Math.floor((Date.now() - new Date(p.available_at)) / 864e5) : null;
      return '<div class="card"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><a href="../property-details.html?id=sb-' + esc(p.id) + '" target="_blank" style="font-weight:900;color:var(--navy)">' + esc(p.title) + '</a>' +
        '<small style="color:' + (d == null || d > 30 ? '#b91c1c' : 'var(--muted)') + ';font-weight:800">' + esc(p.city || '') + ' · التوافر: ' + (d == null ? 'لم يؤكَّد' : 'منذ ' + d + ' يوم') + (p.permit_number ? ' · تصريح ' + esc(p.permit_number) : ' · بلا تصريح') + '</small></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">' + K.map(function (k) {
          var on = !!p[k[2]];
          return '<button class="btn sm ' + (on ? 'teal' : 'ghost') + '" data-ck="' + k[0] + '" data-id="' + esc(p.id) + '" data-on="' + (on ? 1 : 0) + '" title="' + (on ? 'فُحص ' + fmt(p[k[2]]) : 'لم يُفحص') + '">' + (on ? '✓ ' : '') + k[1] + '</button>';
        }).join('') + '</div></div>';
    }).join('') || '<div class="card">لا توجد إعلانات.</div>';
    box.querySelectorAll('[data-ck]').forEach(function (b) {
      b.onclick = async function () {
        b.disabled = true;
        var x = await sb().rpc('admin_set_property_check', { p_id: b.dataset.id, p_kind: b.dataset.ck, p_on: b.dataset.on !== '1' });
        if (x.error) { alert(setupMsg(x.error)); b.disabled = false; return; }
        var on = b.dataset.on !== '1'; b.dataset.on = on ? 1 : 0; b.className = 'btn sm ' + (on ? 'teal' : 'ghost');
        b.textContent = (on ? '✓ ' : '') + b.textContent.replace(/^✓ /, ''); b.disabled = false;
      };
    });
  }

  // ===================== بيانات السوق (دائرة الأراضي) =====================
  // أسماء الأعمدة تختلف بين ملفات Dubai Pulse ومنصة دائرة الأراضي، فنبحث بعدة أسماء
  var COLS = {
    date: ['instance_date', 'contract_start_date', 'start_date_of_contract', 'transaction_date', 'trans_date', 'registration_date', 'contract_start_date', 'start_date', 'date'],
    area_en: ['area_name_en', 'area_en', 'area_name', 'area', 'master_project_en'],
    area_ar: ['area_name_ar', 'area_ar'],
    group: ['group_en', 'trans_group_en', 'transaction_type', 'trans_type', 'transaction_type_en', 'transaction_group_en', 'trans_group', 'procedure_name_en', 'procedure_en'],
    usage: ['property_usage_en', 'usage_en', 'property_usage', 'usage'],
    worth: ['actual_worth', 'trans_value', 'transaction_value', 'amount', 'property_value'],
    size: ['procedure_area', 'transaction_size_sq_m', 'property_size_sq_m', 'size_sq_m', 'actual_area_sq_m', 'actual_area', 'property_size_sq_m', 'size_sqm', 'area_sqm', 'area_m2'],
    ppm2: ['meter_sale_price', 'price_per_sqm', 'meter_price'],
    rent: ['annual_amount', 'annual_rent_amount', 'contract_amount', 'rent_value', 'annual_rent'],
    rppm2: ['meter_rent_price']
  };
  var norm = function (h) { return String(h || '').toLowerCase().replace(/^\ufeff/, '').trim().replace(/[^a-z0-9\u0600-\u06ff]+/g, '_').replace(/^_+|_+$/g, ''); };
  function pick(headers) {
    var m = {}, H = headers.map(norm);
    Object.keys(COLS).forEach(function (k) { for (var i = 0; i < COLS[k].length; i++) { var j = H.indexOf(COLS[k][i]); if (j > -1) { m[k] = headers[j]; break; } } });
    return m;
  }
  function month(v) {
    var s = String(v || '').trim(), m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})/))) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-01';
    if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/))) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-01';
    return null;
  }
  var toNum = function (v) { var n = parseFloat(String(v == null ? '' : v).replace(/[^\d.\-]/g, '')); return isFinite(n) && n > 0 ? n : null; };
  var median = function (a) { if (!a.length) return null; a.sort(function (x, y) { return x - y; }); var h = a.length >> 1; return a.length % 2 ? a[h] : (a[h - 1] + a[h]) / 2; };
  function usageOf(v) { var s = String(v || '').toLowerCase(); return /commercial|تجار/.test(s) ? 'commercial' : /resid|سكن/.test(s) ? 'residential' : 'all'; }

  function loadPapa() {
    return window.Papa ? Promise.resolve() : new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }

  var pending = null;
  async function loadMarket(el) {
    el.innerHTML = '<div class="card"><h2>بيانات السوق الرسمية</h2>' +
      '<p class="sub">تُبنى منها صفحات المناطق (متوسط سعر المتر، عدد الصفقات، الإيجارات، العائد الإيجاري). نحفظ ملخصًا شهريًا لكل منطقة فقط، لا الصفقات نفسها.</p>' +
      '<ol style="margin:0 0 12px;padding-inline-start:20px;line-height:1.9;font-size:14px"><li>من موقع دائرة الأراضي والأملاك ← البيانات المفتوحة (Open Data) حمّلي ملف <b>Transactions</b> (صفقات البيع) أو <b>Rents</b> (عقود الإيجار) بصيغة CSV للفترة التي تريدينها.</li>' +
      '<li>اختاري الملف هنا، وراجعي المعاينة، ثم اضغطي «حفظ».</li><li>كرري شهريًا لتبقى الأرقام محدّثة. رفع الشهر نفسه مرة أخرى يستبدل أرقامه.</li></ol>' +
      '<div class="grid2"><div class="fg"><label>نوع الملف</label><select id="mkKind"><option value="auto">تحديد تلقائي</option><option value="sale">صفقات بيع</option><option value="rent">عقود إيجار</option></select></div>' +
      '<div class="fg"><label>ملف CSV</label><input type="file" id="mkFile" accept=".csv,text/csv"></div></div><div id="mkOut"></div></div>' +
      '<div class="card" id="mkSaved">جاري تحميل الملخصات المحفوظة…</div>';
    el.querySelector('#mkFile').onchange = function (e) { var f = e.target.files[0]; if (f) parseFile(f, el); };
    var s = await sb().from('area_market_stats').select('kind,month,area_en,deals').order('month', { ascending: false }).limit(5000);
    var box = el.querySelector('#mkSaved');
    if (s.error) { box.innerHTML = setupMsg(s.error); return; }
    var rows = s.data || [];
    if (!rows.length) { box.innerHTML = 'لا توجد بيانات سوق محفوظة بعد.'; return; }
    var by = {}; rows.forEach(function (r) { var k = r.kind + '|' + r.month; by[k] = by[k] || { kind: r.kind, month: r.month, areas: 0, deals: 0 }; by[k].areas++; by[k].deals += r.deals; });
    box.innerHTML = '<b>المحفوظ:</b><div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px"><tr><th style="text-align:start">الشهر</th><th>النوع</th><th>المناطق</th><th>الصفقات</th></tr>' +
      Object.values(by).slice(0, 36).map(function (x) { return '<tr><td>' + esc(x.month.slice(0, 7)) + '</td><td>' + (x.kind === 'sale' ? 'بيع' : 'إيجار') + '</td><td style="text-align:center">' + num(x.areas) + '</td><td style="text-align:center">' + num(x.deals) + '</td></tr>'; }).join('') + '</table></div>';
  }

  async function parseFile(file, el) {
    var out = el.querySelector('#mkOut');
    out.innerHTML = '<p class="sub"><i class="fas fa-spinner fa-spin"></i> جاري قراءة الملف… (الملفات الكبيرة تأخذ دقيقة)</p>';
    try { await loadPapa(); } catch (e) { out.innerHTML = '<p class="sub">تعذّر تحميل قارئ الملفات.</p>'; return; }
    var map = null, kind = el.querySelector('#mkKind').value, agg = {}, n = 0, used = 0, skipped = 0;
    Papa.parse(file, {
      header: true, skipEmptyLines: true, worker: false,
      chunk: function (res) {
        if (!map) {
          map = pick(res.meta.fields || []);
          if (kind === 'auto') kind = map.rent && !map.ppm2 ? 'rent' : 'sale';
        }
        res.data.forEach(function (r) {
          n++;
          var mo = month(r[map.date]), area = String(r[map.area_en] || '').trim().toLowerCase().replace(/(^|[\s\-\/(])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
          if (!mo || !area) { skipped++; return; }
          if (kind === 'sale' && map.group && !/sale|sell|بيع|مبايع/i.test(r[map.group] || '')) { skipped++; return; }
          var price = kind === 'sale' ? toNum(r[map.worth]) : toNum(r[map.rent]);
          var size = toNum(r[map.size]);
          var ppm = kind === 'sale' ? (toNum(r[map.ppm2]) || (price && size ? price / size : null)) : (toNum(r[map.rppm2]) || (price && size ? price / size : null));
          if (!price) { skipped++; return; }
          var u = map.usage ? usageOf(r[map.usage]) : 'all';
          var k = area + '|' + mo + '|' + u;
          var a = agg[k] || (agg[k] = { area_en: area, area_ar: map.area_ar ? String(r[map.area_ar] || '').trim() || null : null, month: mo, usage: u, prices: [], ppm: [], total: 0 });
          a.prices.push(price); if (ppm && ppm < 1e6) a.ppm.push(ppm); a.total += price; used++;
        });
        out.innerHTML = '<p class="sub"><i class="fas fa-spinner fa-spin"></i> قُرئ ' + num(n) + ' سطرًا…</p>';
      },
      complete: function () {
        if (!map || !map.date || !map.area_en || !(map.worth || map.rent)) {
          out.innerHTML = '<p class="sub" style="color:#b91c1c">لم أتعرف على أعمدة الملف (التاريخ، المنطقة، القيمة). الأعمدة الموجودة: ' + esc(Object.values(map || {}).join('، ') || '—') + '</p>'; return;
        }
        var rows = Object.values(agg).map(function (a) {
          return { area_en: a.area_en, area_ar: a.area_ar, month: a.month, kind: kind, usage: a.usage, deals: a.prices.length, median_ppm2: a.ppm.length ? Math.round(median(a.ppm)) : null, median_price: Math.round(median(a.prices)), total_value: Math.round(a.total), source: 'DLD', updated_at: new Date().toISOString() };
        });
        pending = rows;
        var months = rows.map(function (r) { return r.month; }).sort();
        var top = {}; rows.forEach(function (r) { top[r.area_en] = (top[r.area_en] || 0) + r.deals; });
        var topL = Object.entries(top).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);
        out.innerHTML = '<div class="card" style="background:#f8fafc"><b>المعاينة — ' + (kind === 'sale' ? 'صفقات بيع' : 'عقود إيجار') + '</b>' +
          '<p class="sub" style="margin:6px 0">قُرئ ' + num(n) + ' سطرًا، استُخدم ' + num(used) + '، وتُرك ' + num(skipped) + ' (رهن أو هبة أو بيانات ناقصة). الفترة: ' + esc((months[0] || '').slice(0, 7)) + ' إلى ' + esc((months[months.length - 1] || '').slice(0, 7)) + '. عدد المناطق: ' + num(Object.keys(top).length) + '.</p>' +
          '<p class="sub" style="margin:0 0 6px">الأعمدة المستخدمة: ' + esc(Object.entries(map).map(function (e) { return e[0] + '=' + e[1]; }).join(' · ')) + '</p>' +
          '<b>أكثر المناطق صفقات:</b> ' + topL.map(function (t) { return esc(t[0]) + ' (' + num(t[1]) + ')'; }).join('، ') +
          '<div style="margin-top:10px"><button class="btn teal" id="mkSave"><i class="fas fa-floppy-disk"></i> حفظ ' + num(rows.length) + ' ملخصًا</button></div></div>';
        out.querySelector('#mkSave').onclick = function () { save(el, out); };
      },
      error: function (e) { out.innerHTML = '<p class="sub" style="color:#b91c1c">تعذّرت قراءة الملف: ' + esc(e && e.message) + '</p>'; }
    });
  }

  async function save(el, out) {
    if (!pending || !pending.length) return;
    var btn = out.querySelector('#mkSave'); btn.disabled = true;
    for (var i = 0; i < pending.length; i += 500) {
      btn.textContent = 'جاري الحفظ… ' + Math.min(100, Math.round(100 * i / pending.length)) + '%';
      var r = await sb().from('area_market_stats').upsert(pending.slice(i, i + 500), { onConflict: 'area_en,month,kind,usage' });
      if (r.error) { btn.disabled = false; btn.textContent = 'إعادة المحاولة'; alert(setupMsg(r.error)); return; }
    }
    pending = null;
    out.innerHTML = '<p class="sub" style="color:#15803d;font-weight:900">✅ حُفظت بيانات السوق، وتظهر الآن في صفحات المناطق.</p>';
    loadMarket(el);
  }

  window.AQAdminExtra = { loadQuality: loadQuality, loadMarket: loadMarket };
})();
