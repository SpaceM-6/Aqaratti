/* شريط الإعلانات في «أنا عقار» + «شاهدته مؤخرًا» + «عمليات بحثك الأخيرة».
   الإعلانات تُدار من لوحة الإدارة (جدول ads)، وإن قلّت عن 10 تُكمَّل بإعلانات أنا عقار الداخلية.
   الاستعمال: <div data-aq-ads="home" data-title="الجديد على أنا عقار"></div> */
(function () {
  'use strict';
  if (window.AQAds) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var sb = function () { return (typeof supabaseClient !== 'undefined') ? supabaseClient : null; };

  // إعلانات أنا عقار الداخلية (تملأ الشريط حتى 10)
  var HOUSE = [
    { t: 'قيّم عقارك مجانًا', s: 'اعرف القيمة التقديرية لعقارك من أسعار المنطقة', b: 'عقارات', i: 'fa-chart-line', g: ['#ef4444', '#f97316'], u: 'valuation.html' },
    { t: 'إقامات قصيرة وإيجار يومي', s: 'شقق وفلل للحجز بالليلة مع تأكيد فوري', b: 'جديد', i: 'fa-umbrella-beach', g: ['#0ea5e9', '#6366f1'], u: 'stays.html' },
    { t: 'سيارات للبيع والإيجار', s: 'اشترِ أو استأجر سيارتك من أصحابها والمعارض', b: 'جديد', i: 'fa-car-side', g: ['#1e293b', '#475569'], u: 'cars.html' },
    { t: 'جاهز لعرض عقارك؟', s: 'أعلن مجانًا لأول 3 أشهر وصل للمشترين والمستأجرين', b: 'عقارات', i: 'fa-house-circle-check', g: ['#00a896', '#028090'], u: 'add-property.html' },
    { t: 'مشاريع جديدة على الخارطة', s: 'إطلاقات المطوّرين بخطط سداد مرنة', b: 'مشاريع', i: 'fa-rocket', g: ['#7c3aed', '#c026d3'], u: 'listings.html?cat=off_plan' },
    { t: 'احصل على شارة التوثيق', s: 'ظهور أكثر وثقة أعلى لإعلاناتك', b: 'للوسطاء', i: 'fa-certificate', g: ['#2563eb', '#0891b2'], u: 'broker-registration.html' },
    { t: 'عقارات الإقامة الذهبية', s: 'عقارات بقيمة تؤهّل للإقامة الذهبية', b: 'استثمار', i: 'fa-passport', g: ['#b45309', '#d4af37'], u: 'listings.html?cat=golden' },
    { t: 'اطلب عقارك والوسطاء يتواصلون', s: 'اكتب ما تريد ونرسله للوسطاء المناسبين', b: 'خدمة', i: 'fa-paper-plane', g: ['#0d9488', '#22c55e'], u: 'request.html' },
    { t: 'خدمات بيتك في مكان واحد', s: 'صيانة، تنظيف، نقل أثاث، ديكور وغيرها', b: 'خدمات', i: 'fa-screwdriver-wrench', g: ['#db2777', '#f43f5e'], u: 'services-directory.html' },
    { t: 'أعلن معنا هنا', s: 'اعرض شركتك أو مشروعك أمام آلاف الزوار', b: 'إعلان', i: 'fa-bullhorn', g: ['#192038', '#0b5e63'], u: 'mailto:info@anaaqar.com?subject=' + encodeURIComponent('إعلان على أنا عقار') }
  ];
  var ORDER = { home: 0, listings: 3, stays: 1, cars: 2, details: 5, services: 8, projects: 4, brokers: 5, home2: 6, home3: 9 };

  function css() {
    if (document.getElementById('aqads-css')) return;
    var st = document.createElement('style'); st.id = 'aqads-css';
    st.textContent = [
      '.aqad{margin:22px 0;font-family:Tajawal,Tahoma,sans-serif;direction:rtl}',
      '.aqad-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 10px}',
      '.aqad-h h2{margin:0;font-size:20px;font-weight:900;color:var(--ink,#0f172a)}',
      '.aqad-h .nav{display:flex;gap:6px}.aqad-h .nav button{width:34px;height:34px;border-radius:50%;border:1px solid var(--line,#e2e8f0);background:var(--card,#fff);color:var(--ink,#0f172a);cursor:pointer}',
      '@media(max-width:700px){.aqad-h .nav{display:none}}',
      '.aqad-row{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;padding:2px 2px 8px;-webkit-overflow-scrolling:touch}',
      '.aqad-row::-webkit-scrollbar{display:none}',
      '.aqad-c{flex:0 0 260px;scroll-snap-align:start;text-decoration:none;color:inherit;display:block;min-width:0}',
      '@media(max-width:520px){.aqad-c{flex-basis:72%}}',
      '.aqad-im{position:relative;height:150px;border-radius:16px;overflow:hidden;background:#0f172a center/cover no-repeat;display:grid;place-items:center;box-shadow:0 4px 14px rgba(15,23,42,.08)}',
      '.aqad-im i.big{font-size:58px;color:rgba(255,255,255,.95);filter:drop-shadow(0 6px 14px rgba(0,0,0,.25))}',
      '.aqad-im:before{content:"";position:absolute;width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,.10);left:-50px;bottom:-80px}',
      '.aqad-im:after{content:"";position:absolute;width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,.12);right:-20px;top:-30px}',
      '.aqad-im.img:before,.aqad-im.img:after{display:none}',
      '.aqad-b{position:absolute;top:10px;right:10px;z-index:1;background:#fff;color:#0f172a;font-size:11.5px;font-weight:900;letter-spacing:.3px;padding:4px 10px;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,.12)}',
      '.aqad-sp{position:absolute;bottom:8px;left:10px;z-index:1;color:#fff;font-size:10.5px;font-weight:800;opacity:.85;background:rgba(0,0,0,.25);padding:1px 7px;border-radius:6px}',
      '.aqad-c b{display:block;margin-top:8px;font-size:16px;font-weight:900;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.aqad-c small{display:block;color:var(--muted,#64748b);font-size:13.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.aqad-dots{display:flex;justify-content:center;gap:5px;margin-top:2px}.aqad-dots i{width:6px;height:6px;border-radius:50%;background:var(--line,#cbd5e1)}.aqad-dots i.on{background:var(--teal,#00a896);width:16px;border-radius:4px}',
      // شعارات الشركاء
      '.aqad-logo{flex:0 0 200px;scroll-snap-align:start;text-decoration:none;color:inherit;text-align:center}',
      '.aqad-logo div{height:84px;border-radius:14px;background:#fff center/contain no-repeat;border:1px solid var(--line,#e2e8f0);display:grid;place-items:center;font-weight:900;font-size:20px;color:#192038}',
      '.aqad-logo span{display:block;margin-top:6px;font-weight:700;font-size:14px}',
      // بانر التوثيق
      '.aqbn{display:flex;align-items:center;gap:16px;padding:18px;border-radius:18px;background:linear-gradient(135deg,#eff6ff,#e6f7f5);border:1px solid #dbeafe;text-decoration:none;color:#0f172a;margin:22px 0;font-family:Tajawal,Tahoma,sans-serif;direction:rtl}',
      '[data-theme="dark"] .aqbn{background:linear-gradient(135deg,#13254a,#0f2e33);border-color:#24365e;color:#e2e8f0}',
      '.aqbn .ic{flex:0 0 auto;width:62px;height:62px;border-radius:50%;display:grid;place-items:center;background:#2563eb;color:#fff;font-size:28px;box-shadow:0 0 0 8px rgba(37,99,235,.12)}',
      '.aqbn b{display:block;font-size:19px;font-weight:900}.aqbn small{display:block;color:#64748b;font-size:14.5px;font-weight:600}',
      '.aqbn .go{margin-inline-start:auto;font-size:20px;color:#2563eb}',
      // البطاقات الأفقية العامة (شاهدته مؤخرًا، الأكثر طلبًا...)
      '.aqr-c{flex:0 0 220px;scroll-snap-align:start;background:var(--card,#fff);border:1px solid var(--line,#e2e8f0);border-radius:14px;overflow:hidden;text-decoration:none;color:inherit;display:block;min-width:0;box-shadow:0 3px 10px rgba(15,23,42,.05)}',
      '@media(max-width:520px){.aqr-c{flex-basis:60%}}',
      '.aqr-c .im{height:130px;background:#e2e8f0 center/cover no-repeat;position:relative}',
      '.aqr-c .im .tg{position:absolute;top:8px;right:8px;background:rgba(25,32,56,.85);color:#fff;font-size:11px;font-weight:900;padding:3px 8px;border-radius:999px}',
      '.aqr-c .tx{padding:9px 11px 11px}.aqr-c .pr{color:#e11d48;font-weight:900;font-size:17px}',
      '.aqr-c .t1{font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.aqr-c .t2{color:var(--muted,#64748b);font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.aqr-dark{background:#111827;border-radius:20px;padding:16px;color:#fff}.aqr-dark .aqad-h h2{color:#fff}.aqr-dark .aqr-c{background:#1f2937;border-color:#374151;color:#fff}.aqr-dark .aqr-c .pr{color:#fff}',
      '.aqr-s{flex:0 0 auto;scroll-snap-align:start;display:flex;align-items:center;gap:10px;background:var(--card,#fff);border:1px solid var(--line,#e2e8f0);border-radius:14px;padding:10px 12px;text-decoration:none;color:inherit;max-width:300px}',
      '.aqr-s i{width:40px;height:40px;border-radius:10px;display:grid;place-items:center;background:#e6f7f5;color:#028090}.aqr-s b{display:block;font-size:14.5px}.aqr-s small{color:var(--muted,#64748b);font-weight:700;font-size:12.5px}',
      '.aqr-bud{flex:0 0 auto;scroll-snap-align:start;padding:12px 18px;border-radius:14px;border:1.5px solid var(--line,#e2e8f0);background:var(--card,#fff);text-decoration:none;color:inherit;font-weight:900;font-size:15px}',
      '.aqr-bud small{display:block;color:var(--muted,#64748b);font-weight:700;font-size:12px}',
      // شريط التنقل السفلي في الجوال
      '.aqbnav{display:none}',
      '@media(max-width:768px){.aqbnav{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:900;background:var(--card,#fff);border-top:1px solid var(--line,#e2e8f0);padding:6px 4px calc(6px + env(safe-area-inset-bottom,0px));font-family:Tajawal,Tahoma,sans-serif;direction:rtl;box-shadow:0 -4px 16px rgba(15,23,42,.06)}',
      '.aqbnav a,.aqbnav button{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;border:0;background:none;color:var(--muted,#64748b);font:inherit;font-size:11.5px;font-weight:800;text-decoration:none;cursor:pointer;padding:2px 0;min-width:0}',
      '.aqbnav i{font-size:19px}.aqbnav .on{color:var(--teal,#00a896)}',
      '.aqbnav .add i{width:34px;height:34px;border-radius:50%;background:#e11d48;color:#fff;display:grid;place-items:center;font-size:17px;margin-top:-2px}',
      'body.aq-has-bnav{padding-bottom:64px}body.aq-has-bnav .aqe-fbtn{bottom:calc(78px + env(safe-area-inset-bottom,0px))!important}}',
      // النوافذ السفلية المشتركة
      '.aqs-ov{position:fixed;inset:0;z-index:2147483400;background:rgba(2,8,23,.5);display:flex;align-items:flex-end;justify-content:center;font-family:Tajawal,Tahoma,sans-serif;direction:rtl}',
      '@media(min-width:760px){.aqs-ov{align-items:center}}',
      '.aqs-sheet{background:var(--card,#fff);color:var(--ink,#0f172a);width:100%;max-width:560px;max-height:90vh;display:flex;flex-direction:column;border-radius:22px 22px 0 0;padding:8px 18px calc(14px + env(safe-area-inset-bottom,0px));animation:aqsUp .22s ease-out;overflow:hidden}',
      '@media(min-width:760px){.aqs-sheet{border-radius:22px}}',
      '@keyframes aqsUp{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}',
      '.aqs-sheet:before{content:"";display:block;width:44px;height:5px;border-radius:3px;background:#cbd5e1;margin:2px auto 10px}',
      '.aqs-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.aqs-hd h3{margin:0;font-size:21px;font-weight:900}',
      '.aqs-x{width:38px;height:38px;border-radius:50%;border:0;background:#e2e8f0;color:#334155;font-size:17px;cursor:pointer;flex:0 0 auto}',
      '.aqs-opt{display:flex;align-items:center;gap:12px;padding:13px 4px;border-bottom:1px solid var(--line,#e2e8f0);text-decoration:none;color:inherit}',
      '.aqs-opt i{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:#e6f7f5;color:#028090;font-size:19px;flex:0 0 auto}',
      '.aqs-opt b{display:block;font-size:16px}.aqs-opt small{color:var(--muted,#64748b);font-weight:600}'
    ].join('\n');
    document.head.appendChild(st);
  }

  // ---------------- جلب الإعلانات ----------------
  var cache = null;
  function fetchAds() {
    if (cache) return cache;
    cache = new Promise(function (res) {
      try { var c = JSON.parse(sessionStorage.getItem('aq_ads') || 'null'); if (c && Date.now() - c.t < 10 * 60 * 1000) return res(c.v); } catch (e) {}
      var c2 = sb(); if (!c2) return res([]);
      c2.from('ads').select('id,title,subtitle,badge,image_url,link_url,placement,style,sort').order('sort').limit(100).then(function (r) {
        var v = (r && !r.error && r.data) || [];
        try { sessionStorage.setItem('aq_ads', JSON.stringify({ t: Date.now(), v: v })); } catch (e) {}
        res(v);
      }, function () { res([]); });
    });
    return cache;
  }
  function forPlacement(all, placement, style) {
    var base = String(placement).replace(/\d+$/, '');
    return all.filter(function (a) {
      var pl = String(a.placement || 'all').split(',').map(function (s) { return s.trim(); });
      return (a.style || 'card') === style && (pl.indexOf('all') > -1 || pl.indexOf(base) > -1);
    });
  }
  function houseFor(placement, n) {
    var off = ORDER[placement] || 0, out = [];
    for (var i = 0; i < HOUSE.length && out.length < n; i++) out.push(HOUSE[(i + off) % HOUSE.length]);
    // لا نعلن عن الصفحة التي يقف عليها الزائر
    var page = (location.pathname.split('/').pop() || 'index.html');
    return out.filter(function (h) { return h.u.split('?')[0] !== page; });
  }

  function cardHTML(a) {
    if (a._house) {
      return '<a class="aqad-c" href="' + esc(a.u) + '"><div class="aqad-im" style="background:linear-gradient(135deg,' + a.g[0] + ',' + a.g[1] + ')">' +
        '<span class="aqad-b">' + esc(a.b) + '</span><i class="fas ' + a.i + ' big"></i></div><b>' + esc(a.t) + '</b><small>' + esc(a.s) + '</small></a>';
    }
    var img = a.image_url ? ' img" style="background-image:url(\'' + esc(a.image_url) + '\')' : '" style="background:linear-gradient(135deg,#00a896,#192038)';
    return '<a class="aqad-c" href="' + esc(a.link_url || '#') + '" data-ad="' + a.id + '"' + (/^https?:/.test(a.link_url || '') ? ' target="_blank" rel="noopener sponsored"' : '') + '>' +
      '<div class="aqad-im' + img + '">' + (a.badge ? '<span class="aqad-b">' + esc(a.badge) + '</span>' : '') + (a.image_url ? '' : '<i class="fas fa-bullhorn big"></i>') +
      '<span class="aqad-sp">إعلان</span></div><b>' + esc(a.title) + '</b><small>' + esc(a.subtitle || '') + '</small></a>';
  }

  function head(title, rowId) {
    return '<div class="aqad-h"><h2>' + esc(title) + '</h2><div class="nav"><button type="button" aria-label="السابق" data-sc="-1" data-r="' + rowId + '"><i class="fas fa-chevron-right"></i></button><button type="button" aria-label="التالي" data-sc="1" data-r="' + rowId + '"><i class="fas fa-chevron-left"></i></button></div></div>';
  }
  var uid = 0;
  function wire(el) {
    el.querySelectorAll('[data-sc]').forEach(function (b) {
      b.onclick = function () { var r = document.getElementById(b.dataset.r); if (r) r.scrollBy({ left: (+b.dataset.sc) * -(r.clientWidth * 0.8), behavior: 'smooth' }); };
    });
    el.querySelectorAll('[data-ad]').forEach(function (a) {
      a.addEventListener('click', function () { try { sb() && sb().rpc('ad_click', { p_id: +a.dataset.ad }); } catch (e) {} });
    });
    var row = el.querySelector('.aqad-row'), dots = el.querySelector('.aqad-dots');
    if (row && dots) {
      var n = row.children.length;
      dots.innerHTML = new Array(Math.min(n, 10)).fill('<i></i>').join('');
      var upd = function () {
        var w = row.children[0] ? row.children[0].getBoundingClientRect().width + 12 : 1;
        var k = Math.min(n - 1, Math.round(Math.abs(row.scrollLeft) / w));
        dots.querySelectorAll('i').forEach(function (d, j) { d.classList.toggle('on', j === k); });
      };
      row.addEventListener('scroll', upd, { passive: true }); upd();
      // تمرير تلقائي هادئ كل 5 ثوانٍ ما لم يلمسه الزائر
      var touched = false; ['touchstart', 'mousedown', 'wheel'].forEach(function (ev) { row.addEventListener(ev, function () { touched = true; }, { passive: true }); });
      var timer = setInterval(function () {
        if (!document.body.contains(row)) return clearInterval(timer);
        if (touched || document.hidden) return;
        var r = row.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
        var w = row.children[0].getBoundingClientRect().width + 12, end = Math.abs(row.scrollLeft) + row.clientWidth >= row.scrollWidth - 4;
        row.scrollTo({ left: end ? 0 : row.scrollLeft - w, behavior: 'smooth' });
      }, 5000);
    }
  }

  // شريط إعلانات (10 بطاقات)
  function strip(el, placement, title) {
    css();
    placement = placement || el.getAttribute('data-aq-ads') || 'all';
    title = title || el.getAttribute('data-title') || 'الجديد على أنا عقار';
    el.classList.add('aqad');
    var rowId = 'aqadr' + (++uid);
    var draw = function (paid) {
      var list = paid.slice(0, 10).concat(houseFor(placement, 10).map(function (h) { return Object.assign({ _house: true }, h); })).slice(0, 10);
      el.innerHTML = head(title, rowId) + '<div class="aqad-row" id="' + rowId + '">' + list.map(cardHTML).join('') + '</div><div class="aqad-dots"></div>';
      wire(el);
    };
    draw([]);
    fetchAds().then(function (all) { var paid = forPlacement(all, placement, 'card'); if (paid.length) draw(paid); });
  }
  // شركاء مميزون (شعارات) — تظهر فقط إن أضافت الإدارة إعلانات بنمط «شعار»
  function logos(el, title) {
    css();
    fetchAds().then(function (all) {
      var l = all.filter(function (a) { return a.style === 'logo'; });
      if (!l.length) { el.hidden = true; return; }
      var rowId = 'aqadr' + (++uid);
      el.classList.add('aqad');
      el.innerHTML = head(title || 'شركاء مميزون', rowId) + '<div class="aqad-row" id="' + rowId + '">' + l.map(function (a) {
        return '<a class="aqad-logo" href="' + esc(a.link_url || '#') + '" data-ad="' + a.id + '"' + (/^https?:/.test(a.link_url || '') ? ' target="_blank" rel="noopener sponsored"' : '') + '><div style="' + (a.image_url ? "background-image:url('" + esc(a.image_url) + "')" : '') + '">' + (a.image_url ? '' : esc(a.title)) + '</div><span>' + esc(a.title) + '</span></a>';
      }).join('') + '</div>';
      wire(el);
    });
  }
  function banner(el, opts) {
    css();
    opts = opts || {};
    fetchAds().then(function (all) {
      var b = all.filter(function (a) { return a.style === 'banner'; })[0];
      if (b) {
        el.innerHTML = '<a class="aqbn" href="' + esc(b.link_url || '#') + '" data-ad="' + b.id + '">' + (b.image_url ? '<span class="ic" style="background:#fff center/cover url(\'' + esc(b.image_url) + '\')"></span>' : '<span class="ic"><i class="fas fa-bullhorn"></i></span>') +
          '<span><b>' + esc(b.title) + '</b><small>' + esc(b.subtitle || '') + '</small></span><i class="fas fa-arrow-left go"></i></a>';
        wire(el);
      }
    });
    el.innerHTML = '<a class="aqbn" href="' + esc(opts.href || 'broker-registration.html') + '"><span class="ic"><i class="fas fa-certificate"></i></span><span><b>' + esc(opts.title || 'هل حصلت على شارة التوثيق؟') + '</b><small>' + esc(opts.sub || 'ظهور أكثر لإعلاناتك، وثقة أعلى عند العملاء') + '</small></span><i class="fas fa-arrow-left go"></i></a>';
  }

  // ---------------- شاهدته مؤخرًا ----------------
  function track(item) {
    if (!item || !item.url) return;
    var l = LS.get('aq_recent_views', []).filter(function (x) { return x.url !== item.url; });
    l.unshift({ url: item.url, title: String(item.title || '').slice(0, 120), img: item.img || '', price: item.price || '', sub: String(item.sub || '').slice(0, 80), tag: item.tag || '', at: Date.now() });
    LS.set('aq_recent_views', l.slice(0, 20));
  }
  function recent() { return LS.get('aq_recent_views', []); }
  function trackSearch(s) {
    if (!s || !s.url) return;
    var l = LS.get('aq_recent_searches', []).filter(function (x) { return x.url !== s.url; });
    l.unshift({ url: s.url, title: s.title, sub: s.sub || '', icon: s.icon || 'fa-magnifying-glass', at: Date.now() });
    LS.set('aq_recent_searches', l.slice(0, 8));
  }

  // صف أفقي عام: items = [{url,img,price,t1,t2,tag}]
  function rail(el, title, items, opts) {
    css(); opts = opts || {};
    if (!items || !items.length) { el.hidden = true; return; }
    el.hidden = false;
    var rowId = 'aqadr' + (++uid);
    el.classList.add('aqad'); if (opts.dark) el.classList.add('aqr-dark');
    el.innerHTML = head(title, rowId).replace('</h2>', '</h2>' + (opts.more ? '<a href="' + esc(opts.more) + '" style="margin-inline-start:auto;color:var(--teal,#00a896);font-weight:900;text-decoration:none;font-size:14px">عرض الكل ←</a>' : '')) +
      '<div class="aqad-row" id="' + rowId + '">' + items.map(function (x) {
        if (opts.kind === 'search') return '<a class="aqr-s" href="' + esc(x.url) + '"><i class="fas ' + esc(x.icon || 'fa-magnifying-glass') + '"></i><span><b>' + esc(x.title) + '</b><small>' + esc(x.sub || '') + '</small></span></a>';
        if (opts.kind === 'budget') return '<a class="aqr-bud" href="' + esc(x.url) + '">' + esc(x.t1) + '<small>' + esc(x.t2 || '') + '</small></a>';
        return '<a class="aqr-c" href="' + esc(x.url) + '"><div class="im" style="background-image:url(\'' + esc(x.img || '') + '\')">' + (x.tag ? '<span class="tg">' + esc(x.tag) + '</span>' : '') + '</div><div class="tx">' +
          (x.price ? '<div class="pr">' + esc(x.price) + '</div>' : '') + '<div class="t1">' + esc(x.t1 || '') + '</div><div class="t2">' + esc(x.t2 || '') + '</div></div></a>';
      }).join('') + '</div>';
    wire(el);
  }

  // ---------------- شريط التنقل السفلي (الجوال) ----------------
  function bottomNav(active) {
    css();
    if (document.querySelector('.aqbnav, .mobile-bottom-app-bar')) return;
    var n = document.createElement('nav'); n.className = 'aqbnav'; n.setAttribute('aria-label', 'التنقل السريع');
    var it = function (k, href, ic, label) { return '<a href="' + href + '" class="' + (k === active ? 'on' : '') + '"><i class="fas ' + ic + '"></i>' + label + '</a>'; };
    n.innerHTML = it('home', 'index.html', 'fa-house', 'الرئيسية') + it('fav', 'my.html', 'fa-heart', 'المفضلة') +
      '<button type="button" class="add" data-add><i class="fas fa-plus"></i>أضف إعلانًا</button>' +
      it('stays', 'stays.html#mine', 'fa-calendar-check', 'حجوزاتي') +
      '<button type="button" data-menu><i class="fas fa-bars"></i>القائمة</button>';
    document.body.appendChild(n); document.body.classList.add('aq-has-bnav');
    n.querySelector('[data-menu]').onclick = function () {
      if (typeof window.aqDrawer === 'function') window.aqDrawer(true);
      else { var b = document.querySelector('.hamburger-menu-btn'); if (b) b.click(); else location.href = 'index.html'; }
    };
    n.querySelector('[data-add]').onclick = function () {
      var ov = document.createElement('div'); ov.className = 'aqs-ov';
      ov.innerHTML = '<div class="aqs-sheet"><div class="aqs-hd"><h3>ماذا تريد أن تعلن؟</h3><button class="aqs-x" data-x aria-label="إغلاق">✕</button></div>' +
        '<a class="aqs-opt" href="add-property.html"><i class="fas fa-building"></i><span><b>عقار للبيع أو الإيجار</b><small>للوسطاء والمكاتب والمطوّرين</small></span></a>' +
        '<a class="aqs-opt" href="add-property.html?stay=1"><i class="fas fa-umbrella-beach"></i><span><b>إقامة قصيرة / إيجار يومي</b><small>شقة أو فيلا للحجز بالليلة</small></span></a>' +
        '<a class="aqs-opt" href="add-car.html"><i class="fas fa-car-side"></i><span><b>سيارة للبيع أو الإيجار</b><small>لأصحاب السيارات والمعارض وشركات التأجير</small></span></a></div>';
      document.body.appendChild(ov);
      ov.onclick = function (e) { if (e.target === ov || e.target.closest('[data-x]')) ov.remove(); };
    };
  }

  window.AQAds = { strip: strip, logos: logos, banner: banner, rail: rail, track: track, recent: recent, trackSearch: trackSearch, bottomNav: bottomNav, fetchAds: fetchAds, HOUSE: HOUSE, esc: esc };
  function boot() {
    document.querySelectorAll('[data-aq-ads]').forEach(function (el) { strip(el); });
    document.querySelectorAll('[data-aq-logos]').forEach(function (el) { logos(el, el.getAttribute('data-title')); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
