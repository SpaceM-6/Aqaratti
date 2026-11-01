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
    rppm2: ['meter_rent_price'],
    reg: ['reg_type_en', 'registration_type_en', 'registration_type', 'reg_type'],
    proc: ['procedure_en', 'procedure_name_en', 'transaction_sub_type']
  };
  // جاهز أم على الخارطة (من «نوع التسجيل»، أو من اسم الإجراء: Pre-registration = على الخارطة)
  function segOf(r, map) {
    var g = String(map.reg ? r[map.reg] || '' : '');
    if (/off/i.test(g)) return 'offplan';
    if (/exist|ready|جاهز|قائم/i.test(g)) return 'ready';
    var p = String(map.proc ? r[map.proc] || '' : '');
    if (map.proc && p) return /pre.?reg|off.?plan|على الخارطة/i.test(p) ? 'offplan' : 'ready';
    return null;
  }
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
      '<li>يقبل أيضًا ملفات <b>Project</b> (المشاريع ونسب إنجازها) و<b>Broker</b> (الوسطاء المرخّصون، ومنه يُفحص ترخيص المعلن تلقائيًا) و<b>Developer</b> (المطوّرون). يتعرف على نوع الملف وحده.</li><li>اختاري الملف هنا، وراجعي المعاينة، ثم اضغطي «حفظ».</li><li>كرري شهريًا لتبقى الأرقام محدّثة. رفع الشهر نفسه مرة أخرى يستبدل أرقامه.</li></ol>' +
      '<div class="grid2"><div class="fg"><label>نوع الملف</label><select id="mkKind"><option value="auto">تحديد تلقائي</option><option value="sale">صفقات بيع</option><option value="rent">عقود إيجار</option></select></div>' +
      '<div class="fg"><label>ملف CSV</label><input type="file" id="mkFile" accept=".csv,text/csv"></div></div><div id="mkOut"></div></div>' +
      '<div class="card" id="mkSaved">جاري تحميل الملخصات المحفوظة…</div>';
    el.querySelector('#mkFile').onchange = function (e) { var f = e.target.files[0]; if (f) parseFile(f, el); };
    // Supabase يعيد 1000 صف كحد أقصى في الطلب الواحد، فنجلب على دفعات
    var s = { data: [], error: null };
    for (var off = 0; off < 50000; off += 1000) {
      var part = await sb().from('area_market_stats').select('*').order('month', { ascending: false }).order('area_en').range(off, off + 999);
      if (part.error) { s.error = part.error; break; }
      s.data = s.data.concat(part.data || []); if ((part.data || []).length < 1000) break;
    }
    var box = el.querySelector('#mkSaved');
    if (s.error) { box.innerHTML = setupMsg(s.error); return; }
    var rows = (s.data || []).filter(function (r) { return (r.segment || 'all') === 'all'; });
    if (!rows.length) { box.innerHTML = 'لا توجد بيانات سوق محفوظة بعد.'; return; }
    var by = {}; rows.forEach(function (r) { var k = r.kind + '|' + r.month; by[k] = by[k] || { kind: r.kind, month: r.month, areas: 0, deals: 0 }; by[k].areas++; by[k].deals += r.deals; });
    box.innerHTML = '<b>المحفوظ:</b><div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px"><tr><th style="text-align:start">الشهر</th><th>النوع</th><th>المناطق</th><th>الصفقات</th></tr>' +
      Object.values(by).slice(0, 36).map(function (x) { return '<tr><td>' + esc(x.month.slice(0, 7)) + '</td><td>' + (x.kind === 'sale' ? 'بيع' : 'إيجار') + '</td><td style="text-align:center">' + num(x.areas) + '</td><td style="text-align:center">' + num(x.deals) + '</td></tr>'; }).join('') + '</table></div>';
  }

  // ===== سجلات الدائرة: المشاريع والوسطاء والمطوّرون =====
  var d10 = function (v) { var m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m && m[1] > '1900' ? m[1] + '-' + m[2] + '-' + m[3] : null; };
  var txt = function (v) { var t = String(v == null ? '' : v).trim(); return t && t !== '0' ? t : null; };
  var int = function (v) { var n = parseInt(v, 10); return isFinite(n) ? n : null; };
  var REG = {
    projects: { table: 'dld_projects', key: 'project_number', title: 'سجل المشاريع', test: function (H) { return H.indexOf('project_number') > -1 && H.indexOf('percent_completed') > -1; },
      row: function (r) { return txt(r.PROJECT_NUMBER) && txt(r.PROJECT_EN) ? { project_number: txt(r.PROJECT_NUMBER), name_en: txt(r.PROJECT_EN), developer_number: txt(r.DEVELOPER_NUMBER), developer_en: txt(r.DEVELOPER_EN), status: txt(r.PROJECT_STATUS), percent_completed: toNum(r.PERCENT_COMPLETED) || 0, start_date: d10(r.START_DATE), end_date: d10(r.END_DATE), completion_date: d10(r.COMPLETION_DATE), inspection_date: d10(r.INSPECTION_DATE), area_en: txt(r.AREA_EN), zone_en: txt(r.ZONE_EN), master_project_en: txt(r.MASTER_PROJECT_EN), cnt_building: int(r.CNT_BUILDING), cnt_villa: int(r.CNT_VILLA), cnt_unit: int(r.CNT_UNIT), project_value: toNum(r.PROJECT_VALUE), description_en: txt(r.DESCRIPTION_EN), updated_at: new Date().toISOString() } : null; },
      stats: function (rows) { var a = rows.filter(function (x) { return x.status === 'ACTIVE'; }).length; return 'نشطة: ' + num(a) + ' · بانتظار البدء: ' + num(rows.filter(function (x) { return x.status === 'PENDING'; }).length) + ' · الوحدات: ' + num(rows.reduce(function (t, x) { return t + (x.cnt_unit || 0); }, 0)); } },
    brokers: { table: 'dld_brokers', key: 'broker_number', title: 'سجل الوسطاء المرخّصين', test: function (H) { return H.indexOf('broker_number') > -1 && H.indexOf('license_end_date') > -1; },
      row: function (r) { return txt(r.BROKER_NUMBER) && txt(r.BROKER_EN) ? { broker_number: txt(r.BROKER_NUMBER), name_en: txt(r.BROKER_EN), license_start: d10(r.LICENSE_START_DATE), license_end: d10(r.LICENSE_END_DATE), office_number: txt(r.REAL_ESTATE_NUMBER), office_name: txt(r.REAL_ESTATE_EN), updated_at: new Date().toISOString() } : null; },
      stats: function (rows) { var t = new Date().toISOString().slice(0, 10); return 'رخص سارية: ' + num(rows.filter(function (x) { return x.license_end && x.license_end >= t; }).length) + ' · مكاتب: ' + num(new Set(rows.map(function (x) { return x.office_number; })).size); } },
    developers: { table: 'dld_developers', key: 'developer_number', title: 'سجل المطوّرين', test: function (H) { return H.indexOf('developer_number') > -1 && H.indexOf('license_expiry_date') > -1 && H.indexOf('project_number') < 0; },
      row: function (r) { return txt(r.DEVELOPER_NUMBER) && txt(r.DEVELOPER_EN) ? { developer_number: txt(r.DEVELOPER_NUMBER), name_en: txt(r.DEVELOPER_EN), license_number: txt(r.LICENSE_NUMBER), license_source: txt(r.LICENSE_SOURCE_EN), license_issue: d10(r.LICENSE_ISSUE_DATE), license_expiry: d10(r.LICENSE_EXPIRY_DATE), registration_date: d10(r.REGISTRATION_DATE), updated_at: new Date().toISOString() } : null; },
      stats: function (rows) { var t = new Date().toISOString().slice(0, 10); return 'رخص سارية: ' + num(rows.filter(function (x) { return x.license_expiry && x.license_expiry >= t; }).length); } }
  };
  var regPending = null;
  function regKind(fields) {
    var H = (fields || []).map(norm);
    if (H.indexOf('land_type_en') > -1) return 'land';
    for (var k in REG) if (REG[k].test(H)) return k;
    return null;
  }
  function parseRegistry(file, el, k) {
    var out = el.querySelector('#mkOut');
    if (k === 'land') { out.innerHTML = '<p class="sub" style="color:#b45309;font-weight:800">هذا ملف الأراضي (Land). لا نستخدمه حاليًا، فلا حاجة لرفعه.</p>'; return; }
    var R = REG[k], rows = [], bad = 0, seen = {};
    Papa.parse(file, { header: true, skipEmptyLines: true,
      chunk: function (res) { res.data.forEach(function (r) { var x = R.row(r); if (!x) { bad++; return; } if (seen[x[R.key]] != null) rows[seen[x[R.key]]] = x; else { seen[x[R.key]] = rows.length; rows.push(x); } }); out.innerHTML = '<p class="sub"><i class="fas fa-spinner fa-spin"></i> قُرئ ' + num(rows.length) + ' سجلًا…</p>'; },
      complete: function () {
        regPending = { k: k, rows: rows };
        out.innerHTML = '<div class="card" style="background:#f8fafc"><b>المعاينة — ' + R.title + '</b><p class="sub" style="margin:6px 0">السجلات: ' + num(rows.length) + (bad ? ' · تُرك ' + num(bad) + ' ناقص' : '') + ' · ' + R.stats(rows) + '</p>' +
          '<p class="sub" style="margin:0 0 6px">مثال: ' + esc(Object.values(rows[0] || {}).slice(0, 5).filter(Boolean).join(' · ')) + '</p>' +
          '<button class="btn teal" id="mkSave"><i class="fas fa-floppy-disk"></i> حفظ ' + num(rows.length) + ' سجلًا</button></div>';
        out.querySelector('#mkSave').onclick = function () { saveRegistry(el, out); };
      },
      error: function (e) { out.innerHTML = '<p class="sub" style="color:#b91c1c">تعذّرت قراءة الملف: ' + esc(e && e.message) + '</p>'; }
    });
  }
  async function saveRegistry(el, out) {
    if (!regPending) return;
    var R = REG[regPending.k], rows = regPending.rows, btn = out.querySelector('#mkSave'); btn.disabled = true;
    for (var i = 0; i < rows.length; i += 500) {
      btn.textContent = 'جاري الحفظ… ' + Math.min(100, Math.round(100 * i / rows.length)) + '%';
      var r = await sb().from(R.table).upsert(rows.slice(i, i + 500), { onConflict: R.key });
      if (r.error) { btn.disabled = false; btn.textContent = 'إعادة المحاولة'; alert(/relation|does not exist|schema cache/i.test(r.error.message || '') ? 'شغّلي ملف supabase/dld_registry.sql من SQL Editor أولًا.' : r.error.message); return; }
    }
    var extra = '';
    if (regPending.k === 'brokers') { var x = await sb().rpc('aq_sync_license_checks'); if (!x.error) extra = ' وفُحصت رخصة المعلن تلقائيًا في ' + num(x.data || 0) + ' إعلانًا.'; }
    regPending = null;
    out.innerHTML = '<p class="sub" style="color:#15803d;font-weight:900">✅ حُفظ ' + R.title + ' (' + num(rows.length) + ' سجلًا).' + extra + '</p>';
  }

  async function parseFile(file, el) {
    var out = el.querySelector('#mkOut');
    out.innerHTML = '<p class="sub"><i class="fas fa-spinner fa-spin"></i> جاري قراءة الملف… (الملفات الكبيرة تأخذ دقيقة)</p>';
    try { await loadPapa(); } catch (e) { out.innerHTML = '<p class="sub">تعذّر تحميل قارئ الملفات.</p>'; return; }
    // نقرأ السطر الأول لنعرف نوع الملف: صفقات/إيجارات أم سجل (مشاريع، وسطاء، مطوّرون)
    var head = await file.slice(0, 4096).text();
    var rk = regKind(Papa.parse(head.split(/\r?\n/)[0]).data[0]);
    if (rk) return parseRegistry(file, el, rk);
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
          var segs = ['all'], sg = kind === 'sale' ? segOf(r, map) : null; if (sg) segs.push(sg);
          segs.forEach(function (seg) {
            var k = area + '|' + mo + '|' + u + '|' + seg;
            var a = agg[k] || (agg[k] = { area_en: area, area_ar: map.area_ar ? String(r[map.area_ar] || '').trim() || null : null, month: mo, usage: u, segment: seg, prices: [], ppm: [], total: 0 });
            a.prices.push(price); if (ppm && ppm < 1e6) a.ppm.push(ppm); a.total += price;
          });
          used++;
        });
        out.innerHTML = '<p class="sub"><i class="fas fa-spinner fa-spin"></i> قُرئ ' + num(n) + ' سطرًا…</p>';
      },
      complete: function () {
        if (!map || !map.date || !map.area_en || !(map.worth || map.rent)) {
          out.innerHTML = '<p class="sub" style="color:#b91c1c">لم أتعرف على أعمدة الملف (التاريخ، المنطقة، القيمة). الأعمدة الموجودة: ' + esc(Object.values(map || {}).join('، ') || '—') + '</p>'; return;
        }
        var rows = Object.values(agg).map(function (a) {
          return { area_en: a.area_en, area_ar: a.area_ar, month: a.month, kind: kind, usage: a.usage, segment: a.segment, deals: a.prices.length, median_ppm2: a.ppm.length ? Math.round(median(a.ppm)) : null, median_price: Math.round(median(a.prices)), total_value: Math.round(a.total), source: 'DLD', updated_at: new Date().toISOString() };
        });
        pending = rows;
        var months = rows.map(function (r) { return r.month; }).sort();
        var top = {}, segN = { ready: 0, offplan: 0 }; rows.forEach(function (r) { if (r.segment === 'all') top[r.area_en] = (top[r.area_en] || 0) + r.deals; else segN[r.segment] += r.deals; });
        var topL = Object.entries(top).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);
        out.innerHTML = '<div class="card" style="background:#f8fafc"><b>المعاينة — ' + (kind === 'sale' ? 'صفقات بيع' : 'عقود إيجار') + '</b>' +
          '<p class="sub" style="margin:6px 0">قُرئ ' + num(n) + ' سطرًا، استُخدم ' + num(used) + '، وتُرك ' + num(skipped) + ' (رهن أو هبة أو بيانات ناقصة). الفترة: ' + esc((months[0] || '').slice(0, 7)) + ' إلى ' + esc((months[months.length - 1] || '').slice(0, 7)) + '. عدد المناطق: ' + num(Object.keys(top).length) + '.</p>' +
          '<p class="sub" style="margin:0 0 6px">الأعمدة المستخدمة: ' + esc(Object.entries(map).map(function (e) { return e[0] + '=' + e[1]; }).join(' · ')) + '</p>' +
          (segN.ready + segN.offplan ? '<p class="sub" style="margin:0 0 6px">منها: جاهز ' + num(segN.ready) + ' · على الخارطة ' + num(segN.offplan) + '</p>' : '') +
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
      var r = await sb().from('area_market_stats').upsert(pending.slice(i, i + 500), { onConflict: 'area_en,month,kind,usage,segment' });
      if (r.error) { btn.disabled = false; btn.textContent = 'إعادة المحاولة'; alert(setupMsg(r.error)); return; }
    }
    pending = null;
    out.innerHTML = '<p class="sub" style="color:#15803d;font-weight:900">✅ حُفظت بيانات السوق، وتظهر الآن في صفحات المناطق.</p>';
    loadMarket(el);
  }

  // ===================== سجلات دائرة الأراضي (عرض وبحث للإدارة) =====================
  var regTab = 'brokers';
  async function loadRegistry(el) {
    var T = [['brokers', 'الوسطاء المرخّصون', 'fa-user-tie'], ['projects', 'المشاريع', 'fa-city'], ['developers', 'المطوّرون', 'fa-building'], ['market', 'أسعار المناطق', 'fa-chart-line']];
    el.innerHTML = '<div class="stats" id="rgStats"></div><div class="pills" id="rgTabs">' + T.map(function (t) { return '<button class="pill' + (t[0] === regTab ? ' on' : '') + '" data-t="' + t[0] + '"><i class="fas ' + t[2] + '"></i> ' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div class="fg"><input id="rgQ" type="search" placeholder="ابحث…"></div><div id="rgList"><div class="card">جاري التحميل…</div></div>';
    el.querySelectorAll('#rgTabs .pill').forEach(function (b) { b.onclick = function () { regTab = b.dataset.t; loadRegistry(el); }; });
    var today = new Date().toISOString().slice(0, 10);
    // الأعداد
    var cnt = async function (t, f) { try { var q = sb().from(t).select('*', { count: 'exact', head: true }); if (f) q = f(q); var r = await q; return r.error ? null : r.count; } catch (e) { return null; } };
    Promise.all([cnt('dld_brokers'), cnt('dld_brokers', function (q) { return q.gte('license_end', today); }), cnt('dld_projects'), cnt('dld_projects', function (q) { return q.eq('status', 'ACTIVE'); }), cnt('dld_developers'), cnt('area_market_stats')]).then(function (c) {
      var st = function (v, t) { return '<div class="stat"><b>' + (v == null ? '—' : num(v)) + '</b><span>' + t + '</span></div>'; };
      var box = el.querySelector('#rgStats'); if (box) box.innerHTML = st(c[0], 'وسيط في السجل') + st(c[1], 'رخصة سارية') + st(c[2], 'مشروع مسجّل') + st(c[3], 'قيد الإنشاء') + st(c[4], 'مطوّر') + st(c[5], 'ملخص سوق شهري');
    });
    var q = el.querySelector('#rgQ'), timer = null;
    q.placeholder = { brokers: 'ابحث برقم BRN أو اسم الوسيط أو المكتب…', projects: 'ابحث باسم المشروع أو المطوّر أو المنطقة…', developers: 'ابحث باسم المطوّر أو رقمه…', market: 'ابحث باسم المنطقة…' }[regTab];
    q.oninput = function () { clearTimeout(timer); timer = setTimeout(function () { drawRegistry(el, q.value.trim()); }, 300); };
    drawRegistry(el, '');
  }
  var like = function (v) { return '"%' + String(v).replace(/["\\,()%]/g, ' ').trim() + '%"'; };
  async function drawRegistry(el, term) {
    var box = el.querySelector('#rgList'), today = new Date().toISOString().slice(0, 10), r, html = '';
    var miss = function (e) { return '<div class="card">' + (/relation|does not exist|schema cache/i.test((e && e.message) || '') ? 'شغّلي ملف supabase/dld_registry.sql من SQL Editor، ثم ارفعي الملفات من «بيانات السوق».' : esc(e.message)) + '</div>'; };
    var row = function (title, sub, right) { return '<div class="card" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap"><div style="min-width:0;flex:1"><b>' + title + '</b><div class="sub" style="margin:2px 0 0">' + sub + '</div></div><div style="font-weight:800">' + (right || '') + '</div></div>'; };
    if (regTab === 'brokers') {
      var qb = sb().from('dld_brokers').select('*').order('license_end', { ascending: false }).limit(60);
      if (term) qb = /^\d+$/.test(term) ? qb.or('broker_number.eq.' + term + ',office_number.eq.' + term) : qb.or('name_en.ilike.' + like(term) + ',office_name.ilike.' + like(term));
      r = await qb; if (r.error) { box.innerHTML = miss(r.error); return; }
      html = (r.data || []).map(function (b) {
        var ok = b.license_end && b.license_end >= today;
        return row(esc(b.name_en), 'BRN ' + esc(b.broker_number) + ' · ' + esc(b.office_name || '') + (b.office_number ? ' (ORN ' + esc(b.office_number) + ')' : ''),
          '<span class="badge ' + (ok ? 'done' : 'new') + '">' + (ok ? 'سارية حتى ' : 'منتهية ') + esc(b.license_end || '') + '</span>');
      }).join('');
    } else if (regTab === 'projects') {
      var qp = sb().from('dld_projects').select('*').order('cnt_unit', { ascending: false }).limit(80);
      if (term) qp = qp.or('name_en.ilike.' + like(term) + ',developer_en.ilike.' + like(term) + ',area_en.ilike.' + like(term));
      r = await qp; if (r.error) { box.innerHTML = miss(r.error); return; }
      var ST = { ACTIVE: 'قيد الإنشاء', PENDING: 'بانتظار البدء', FINISHED: 'مكتمل', COMPLETED: 'مكتمل', CANCELLED: 'ملغى' };
      html = (r.data || []).map(function (p) {
        return row(esc(p.name_en), esc(p.developer_en || '') + ' · ' + esc(p.area_en || '') + ' · ' + num(p.cnt_unit || 0) + ' وحدة' + (p.end_date ? ' · التسليم ' + esc(p.end_date) : '') + (p.inspection_date ? ' · آخر تفتيش ' + esc(p.inspection_date) : ''),
          esc(ST[p.status] || p.status || '') + ' · ' + (Number(p.percent_completed) || 0) + '%');
      }).join('');
    } else if (regTab === 'developers') {
      var qd = sb().from('dld_developers').select('*').order('registration_date', { ascending: false }).limit(80);
      if (term) qd = /^\d+$/.test(term) ? qd.eq('developer_number', term) : qd.ilike('name_en', '%' + term.replace(/[%,()]/g, ' ') + '%');
      r = await qd; if (r.error) { box.innerHTML = miss(r.error); return; }
      html = (r.data || []).map(function (d) {
        var ok = d.license_expiry && d.license_expiry >= today;
        return row(esc(d.name_en), 'رقم المطوّر ' + esc(d.developer_number) + ' · رخصة ' + esc(d.license_number || '—') + ' · ' + esc(d.license_source || '') + (d.registration_date ? ' · سُجّل ' + esc(d.registration_date) : ''),
          '<span class="badge ' + (ok ? 'done' : 'new') + '">' + (ok ? 'سارية حتى ' : 'منتهية ') + esc(d.license_expiry || '') + '</span>');
      }).join('');
    } else {
      // أسعار المناطق: آخر 12 شهرًا لكل منطقة (البيع الكلي + الإيجار)
      var all = [];
      for (var off = 0; off < 60000; off += 1000) {
        var part = await sb().from('area_market_stats').select('*').order('area_en').order('month').range(off, off + 999);
        if (part.error) { box.innerHTML = miss(part.error); return; }
        all = all.concat(part.data || []); if ((part.data || []).length < 1000) break;
      }
      var by = {};
      all.filter(function (x) { return (x.segment || 'all') === 'all'; }).forEach(function (x) {
        var a = by[x.area_en] || (by[x.area_en] = { area: x.area_en, sale: 0, rent: 0, ppm: [], rentP: [] });
        if (x.kind === 'sale') { a.sale += x.deals; if (x.median_ppm2) for (var i = 0; i < Math.min(x.deals, 30); i++) a.ppm.push(+x.median_ppm2); }
        else { a.rent += x.deals; if (x.median_price) for (var j = 0; j < Math.min(x.deals, 30); j++) a.rentP.push(+x.median_price); }
      });
      var list = Object.values(by).filter(function (a) { return !term || a.area.toLowerCase().indexOf(term.toLowerCase()) > -1; }).sort(function (a, b) { return b.sale - a.sale; }).slice(0, 150);
      html = '<div class="card" style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:14px"><tr><th style="text-align:start">المنطقة</th><th>صفقات البيع</th><th>وسيط سعر المتر</th><th>عقود الإيجار</th><th>وسيط الإيجار السنوي</th></tr>' +
        list.map(function (a) { return '<tr style="border-top:1px solid var(--line)"><td><a href="../areas.html?a=' + encodeURIComponent(a.area) + '" target="_blank">' + esc(a.area) + '</a></td><td style="text-align:center">' + num(a.sale) + '</td><td style="text-align:center">' + (a.ppm.length ? num(median(a.ppm)) : '—') + '</td><td style="text-align:center">' + num(a.rent) + '</td><td style="text-align:center">' + (a.rentP.length ? num(median(a.rentP)) : '—') + '</td></tr>'; }).join('') + '</table></div>';
    }
    box.innerHTML = html || '<div class="card">لا نتائج.</div>';
  }

  window.AQAdminExtra = { loadQuality: loadQuality, loadMarket: loadMarket, loadRegistry: loadRegistry };
})();
