// مزايا التفاعل في أنا عقار: شريط الجديد، شارات العروض، التنبيه اليومي، الترحيب أول مرة،
// الدردشة المباشرة مع خدمة العملاء، إشعارات المستخدم، حفظ البحث، وملاحظات العقارات.
// يعتمد على supabaseClient من supabase-client.js، ويعمل بأمان إن لم تُفعَّل الجداول بعد.
(function () {
  'use strict';
  if (window.AQEngage) return;

  var sb = function () { return (typeof supabaseClient !== 'undefined') ? supabaseClient : null; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  var SS = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  };
  var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var isIndex = page === '' || page === 'index.html';
  var today = function () { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  var AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  function untilText(d) { if (!d) return ''; var p = String(d).split('-').map(Number); return 'حتى ' + p[2] + ' ' + AR_MONTHS[p[1] - 1]; }

  function toast(msg, type, action) {
    if (!action && typeof window.showAnaAqarToast === 'function') { window.showAnaAqarToast(msg, type || 'success'); return; }
    var t = document.createElement('div');
    t.className = 'aqe-toast' + (type === 'error' ? ' err' : '');
    t.innerHTML = '<span>' + esc(msg) + '</span>' + (action ? '<button type="button">' + esc(action.label) + '</button>' : '');
    document.body.appendChild(t);
    if (action) t.querySelector('button').onclick = function () { t.remove(); action.run(); };
    setTimeout(function () { t.classList.add('on'); }, 20);
    setTimeout(function () { t.classList.remove('on'); setTimeout(function () { t.remove(); }, 300); }, action ? 7000 : 3500);
  }

  // ===================== الأنماط =====================
  function css() {
    if (document.getElementById('aqe-css')) return;
    var st = document.createElement('style'); st.id = 'aqe-css';
    st.textContent = [
      '.aqe-ticker{position:relative;z-index:30;background:linear-gradient(90deg,#14203d,#192038 40%,#192038 60%,#14203d);color:#fff;font-family:Tajawal,Tahoma,sans-serif;direction:rtl;border-bottom:1px solid rgba(212,175,55,.5)}',
      '.aqe-ticker-in{max-width:1250px;margin:0 auto;display:flex;align-items:center;gap:10px;padding:6px 14px;min-height:38px}',
      '.aqe-ticker .lbl{flex:0 0 auto;background:#d4af37;color:#192038;font-weight:900;font-size:12px;border-radius:999px;padding:2px 10px}',
      '.aqe-ticker .win{flex:1;min-width:0;position:relative;height:24px;overflow:hidden}',
      '.aqe-ticker .msg{position:absolute;inset:0;display:flex;align-items:center;font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0;transform:translateY(8px);transition:opacity .4s,transform .4s;color:#fff;text-decoration:none}',
      '.aqe-ticker .msg.on{opacity:1;transform:none}',
      '.aqe-ticker .x{flex:0 0 auto;background:none;border:0;color:#cbd5e1;font-size:18px;cursor:pointer;width:30px;height:30px;line-height:1}',
      '.aqe-toast{position:fixed;left:50%;bottom:92px;transform:translate(-50%,20px);opacity:0;transition:.3s;z-index:2147483600;background:#192038;color:#fff;font-family:Tajawal,Tahoma,sans-serif;direction:rtl;padding:12px 16px;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);display:flex;gap:12px;align-items:center;max-width:min(92vw,520px);font-weight:700;font-size:14px}',
      '.aqe-toast.on{opacity:1;transform:translate(-50%,0)}.aqe-toast.err{background:#b91c1c}',
      '.aqe-toast button{background:#00a896;color:#fff;border:0;border-radius:10px;padding:7px 12px;font:inherit;font-weight:900;cursor:pointer;white-space:nowrap}',
      '.aqe-tip{position:fixed;right:12px;left:12px;bottom:84px;z-index:2147483500;max-width:520px;margin:0 auto;background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 14px 36px rgba(15,23,42,.2);padding:14px 16px 14px 44px;font-family:Tajawal,Tahoma,sans-serif;direction:rtl;animation:aqeUp .3s ease-out}',
      '.aqe-tip b{display:block;color:#00897b;font-size:14px;margin-bottom:4px}.aqe-tip p{margin:0;font-size:15px;line-height:1.7;font-weight:600}',
      '.aqe-tip .x{position:absolute;left:10px;top:10px;width:28px;height:28px;border:0;border-radius:8px;background:#f1f5f9;color:#334155;cursor:pointer;font-size:16px}',
      '@keyframes aqeUp{from{transform:translateY(14px);opacity:0}to{transform:none;opacity:1}}',
      '.aqe-ov{position:fixed;inset:0;background:rgba(2,8,23,.55);z-index:2147483550;display:flex;align-items:flex-end;justify-content:center;font-family:Tajawal,Tahoma,sans-serif;direction:rtl}',
      '@media(min-width:700px){.aqe-ov{align-items:center}}',
      '.aqe-sheet{background:#fff;color:#0f172a;width:100%;max-width:480px;max-height:92vh;overflow:auto;border-radius:22px 22px 0 0;padding:20px 18px calc(18px + env(safe-area-inset-bottom,0px));animation:aqeUp .25s ease-out}',
      '@media(min-width:700px){.aqe-sheet{border-radius:22px}}',
      '.aqe-sheet h3{margin:0 0 4px;font-size:21px;font-weight:900;color:#192038}.aqe-sheet .sub{margin:0 0 14px;color:#64748b;font-size:14px;font-weight:600}',
      '.aqe-choices{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}',
      '.aqe-choices button{border:1.5px solid #e2e8f0;background:#fff;border-radius:14px;padding:14px 8px;font:inherit;font-weight:800;font-size:14.5px;color:#0f172a;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px}',
      '.aqe-sheet .aqe-choices{margin-bottom:8px}.aqe-sheet .aqe-choices button{padding:11px 8px}',
      '.aqe-choices button i{font-size:20px;color:#00a896}.aqe-choices button.on{border-color:#00a896;background:#e6f7f5}',
      '.aqe-field{display:block;margin-bottom:10px}.aqe-field span{display:block;font-size:13px;font-weight:800;color:#64748b;margin-bottom:4px}',
      '.aqe-field input,.aqe-field select,.aqe-field textarea{width:100%;box-sizing:border-box;border:1.5px solid #e2e8f0;border-radius:12px;padding:11px 12px;font:inherit;font-size:15px;background:#fff;color:#0f172a;outline:none}',
      '.aqe-field input:focus,.aqe-field select:focus,.aqe-field textarea:focus{border-color:#00a896}',
      '.aqe-btn{display:flex;width:100%;justify-content:center;align-items:center;gap:8px;border:0;border-radius:14px;padding:13px;background:#00a896;color:#fff;font:inherit;font-weight:900;font-size:16px;cursor:pointer}',
      '.aqe-btn:disabled{opacity:.6}.aqe-link{display:block;margin:10px auto 0;background:none;border:0;color:#64748b;font:inherit;font-weight:700;cursor:pointer}',
      // الدردشة
      '.aqe-chat{position:fixed;z-index:2147483560;font-family:Tajawal,Tahoma,sans-serif;direction:rtl;background:#fff;color:#0f172a;display:flex;flex-direction:column;box-shadow:0 18px 50px rgba(2,8,23,.3);inset:0}',
      '@media(min-width:700px){.aqe-chat{inset:auto;left:18px;bottom:90px;width:380px;height:min(600px,80vh);border-radius:20px;overflow:hidden}}',
      '.aqe-chat-h{display:flex;align-items:center;gap:10px;padding:calc(12px + env(safe-area-inset-top,0px)) 14px 12px;background:linear-gradient(135deg,#00a896,#028090);color:#fff}',
      '.aqe-chat-h .av{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.2);display:grid;place-items:center;font-size:18px;flex:0 0 auto}',
      '.aqe-chat-h b{display:block;font-size:16px}.aqe-chat-h small{display:block;font-size:12px;opacity:.9}',
      '.aqe-chat-h .x{margin-right:auto;width:36px;height:36px;border:0;border-radius:10px;background:rgba(255,255,255,.2);color:#fff;font-size:18px;cursor:pointer}',
      '.aqe-chat-b{flex:1;overflow-y:auto;padding:14px;background:#f6f8fb;display:flex;flex-direction:column;gap:8px;overscroll-behavior:contain}',
      '.aqe-m{max-width:82%;padding:9px 12px;border-radius:14px;font-size:15px;line-height:1.6;white-space:pre-wrap;word-break:break-word}',
      '.aqe-m small{display:block;font-size:11px;opacity:.65;margin-top:2px}',
      '.aqe-m.u{align-self:flex-start;background:#00a896;color:#fff;border-bottom-right-radius:4px}',
      '.aqe-m.a{align-self:flex-end;background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-bottom-left-radius:4px}',
      '.aqe-m.sys{align-self:center;background:#e6f7f5;color:#028090;font-size:13px;font-weight:700;text-align:center;max-width:95%}',
      '.aqe-chat-f{display:flex;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));border-top:1px solid #e2e8f0;background:#fff}',
      '.aqe-chat-f textarea{flex:1;resize:none;border:1.5px solid #e2e8f0;border-radius:14px;padding:10px 12px;font:inherit;font-size:15px;max-height:120px;min-height:44px;outline:none;background:#fff;color:#0f172a}',
      '.aqe-chat-f button{flex:0 0 auto;width:46px;border:0;border-radius:14px;background:#00a896;color:#fff;font-size:18px;cursor:pointer}',
      '.aqe-chat-start{padding:16px;overflow:auto}',
      '.aqe-fbtn{position:fixed;left:14px;bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:2147483400;width:56px;height:56px;border-radius:50%;border:0;background:linear-gradient(135deg,#00a896,#028090);color:#fff;font-size:22px;box-shadow:0 10px 26px rgba(0,128,128,.38);cursor:pointer}',
      '.aqe-dot{position:absolute;top:-2px;right:-2px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#e11d48;color:#fff;font-size:11px;font-weight:900;display:grid;place-items:center;border:2px solid #fff;font-family:Tajawal,Tahoma,sans-serif}',
      '.aq-pc-deal.offer{background:#e11d48}',
      // الوضع الليلي
      '[data-theme="dark"] .aqe-tip,[data-theme="dark"] .aqe-sheet,[data-theme="dark"] .aqe-chat,[data-theme="dark"] .aqe-chat-f{background:#0f172a;color:#e2e8f0;border-color:#1e293b}',
      '[data-theme="dark"] .aqe-sheet h3{color:#f1f5f9}[data-theme="dark"] .aqe-chat-b{background:#0b1222}',
      '[data-theme="dark"] .aqe-m.a{background:#1e293b;color:#e2e8f0;border-color:#334155}',
      '[data-theme="dark"] .aqe-field input,[data-theme="dark"] .aqe-field select,[data-theme="dark"] .aqe-field textarea,[data-theme="dark"] .aqe-chat-f textarea{background:#1e293b;color:#e2e8f0;border-color:#334155}',
      '[data-theme="dark"] .aqe-choices button{background:#1e293b;color:#e2e8f0;border-color:#334155}[data-theme="dark"] .aqe-choices button.on{background:#0f2e33;border-color:#00a896}',
      '[data-theme="dark"] .aqe-tip .x{background:#1e293b;color:#e2e8f0}'
    ].join('');
    document.head.appendChild(st);
  }

  // ===================== البيانات العامة (الجديد والعروض والنصائح) =====================
  var pubCache = null;
  function loadPublic() {
    if (pubCache) return pubCache;
    try {
      var c = JSON.parse(SS.get('aqe_pub') || 'null');
      if (c && Date.now() - c.t < 5 * 60000) { pubCache = Promise.resolve(c.d); return pubCache; }
    } catch (e) {}
    var c2 = sb();
    if (!c2) return (pubCache = Promise.resolve({ news: [], offers: [], tips: [] }));
    var q = function (p) { return p.then(function (r) { return r.error ? [] : (r.data || []); }, function () { return []; }); };
    pubCache = Promise.all([
      q(c2.from('site_news').select('id,body,url,ends_on').order('sort').order('created_at', { ascending: false }).limit(20)),
      q(c2.from('site_offers').select('id,title,body,badge,image_url,url,property_ids,ends_on').order('sort').order('created_at', { ascending: false }).limit(60)),
      q(c2.from('daily_tips').select('id,body').order('sort').limit(200))
    ]).then(function (r) {
      var d = { news: r[0], offers: r[1], tips: r[2] };
      SS.set('aqe_pub', JSON.stringify({ t: Date.now(), d: d }));
      return d;
    });
    return pubCache;
  }

  // ===================== شريط الجديد =====================
  function ticker() {
    if (document.body.hasAttribute('data-no-ticker') || SS.get('aqe_ticker_off')) return;
    loadPublic().then(function (d) {
      var items = (d.news || []).filter(function (n) { return n && n.body; });
      if (!items.length || document.querySelector('.aqe-ticker')) return;
      var bar = document.createElement('div');
      bar.className = 'aqe-ticker'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'جديد أنا عقار');
      bar.innerHTML = '<div class="aqe-ticker-in"><span class="lbl">جديد</span><div class="win" aria-live="polite">' +
        items.map(function (n, i) {
          var safe = /^(https?:\/\/|[a-z0-9_\-]+\.html|\/|#)/i.test(n.url || '') ? n.url : '';
          return safe ? '<a class="msg' + (i ? '' : ' on') + '" href="' + esc(safe) + '">' + esc(n.body) + '</a>'
                      : '<span class="msg' + (i ? '' : ' on') + '">' + esc(n.body) + '</span>';
        }).join('') + '</div><button class="x" type="button" aria-label="إخفاء الشريط">×</button></div>';
      document.body.insertBefore(bar, document.body.firstChild);
      bar.querySelector('.x').onclick = function () { bar.remove(); SS.set('aqe_ticker_off', '1'); };
      var msgs = bar.querySelectorAll('.msg'), i = 0;
      if (msgs.length > 1) setInterval(function () { msgs[i].classList.remove('on'); i = (i + 1) % msgs.length; msgs[i].classList.add('on'); }, 4500);
    });
  }

  // ===================== شارات العروض على بطاقات العقارات =====================
  function offerFor(pid) {
    var list = (pubCache && pubCache._v) || [];
    for (var i = 0; i < list.length; i++) if ((list[i].property_ids || []).indexOf(String(pid)) >= 0) return list[i];
    return null;
  }
  function offerBadges() {
    var box = document.getElementById('properties-container');
    if (!box) return;
    loadPublic().then(function (d) {
      pubCache._v = d.offers || [];
      if (!pubCache._v.some(function (o) { return (o.property_ids || []).length; })) return;
      var apply = function () {
        box.querySelectorAll('.aq-pcard').forEach(function (card) {
          if (card.querySelector('.aq-pc-deal.offer')) return;
          var o = offerFor(card.id.replace(/^card-/, ''));
          var tags = card.querySelector('.aq-pc-tags');
          if (o && tags) tags.insertAdjacentHTML('afterbegin', '<span class="aq-pc-deal offer">' + esc(o.badge || 'عرض خاص') + '</span>');
        });
      };
      apply();
      new MutationObserver(apply).observe(box, { childList: true });
    });
  }

  // ===================== التنبيه اليومي =====================
  function dailyTip() {
    if (!isIndex || LS.get('aqe_tip_day', '') === today() || SS.get('aqe_welcomed_now')) return;
    loadPublic().then(function (d) {
      var tips = d.tips || [];
      if (!tips.length || document.querySelector('.aqe-tip')) return;
      var n = Math.floor(Date.now() / 86400000) % tips.length;
      setTimeout(function () {
        var el = document.createElement('div');
        el.className = 'aqe-tip'; el.setAttribute('role', 'status');
        el.innerHTML = '<button class="x" type="button" aria-label="إغلاق">×</button><b>🔔 تنبيه</b><p>' + esc(tips[n].body) + '</p>';
        document.body.appendChild(el);
        var close = function () { el.remove(); LS.set('aqe_tip_day', today()); };
        el.querySelector('.x').onclick = close;
        setTimeout(function () { if (el.isConnected) close(); }, 15000);
      }, 2500);
    });
  }

  // ===================== الترحيب أول مرة =====================
  // الدول المتاحة في الموقع (نفس قائمة الدول في أعلى الصفحة الرئيسية) ومدنها
  var COUNTRIES = [
    ['uae', 'الإمارات', 'ae', ['دبي', 'أبوظبي', 'الشارقة', 'عجمان', 'رأس الخيمة', 'أم القيوين', 'الفجيرة', 'العين']],
    ['saudi', 'السعودية', 'sa', ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الخبر']],
    ['egypt', 'مصر', 'eg', ['القاهرة الجديدة', 'العاصمة الإدارية', 'الشيخ زايد']],
    ['turkey', 'تركيا', 'tr', ['إسطنبول', 'أنطاليا', 'بورصة']],
    ['qatar', 'قطر', 'qa', ['الدوحة', 'اللؤلؤة', 'لوسيل']],
    ['oman', 'عُمان', 'om', ['مسقط', 'صلالة']],
    ['uk', 'بريطانيا', 'gb', ['لندن', 'مانشستر']],
    ['usa', 'أمريكا', 'us', ['نيويورك', 'ميامي']],
    ['france', 'فرنسا', 'fr', ['باريس', 'كان']],
    ['spain', 'إسبانيا', 'es', ['مدريد', 'برشلونة']],
    ['cyprus', 'قبرص', 'cy', ['ليماسول', 'لارنكا']],
    ['greece', 'اليونان', 'gr', ['أثينا', 'سانتوريني']]
  ];
  function countryOf(k) { for (var i = 0; i < COUNTRIES.length; i++) if (COUNTRIES[i][0] === k) return COUNTRIES[i]; return COUNTRIES[0]; }
  function applyProfile(p, withCountry) {
    if (!isIndex || !p) return;
    var tab = { all: 'all', sale: 'sale', rent: 'rent', invest: 'roi' }[p.intent];
    if (tab && typeof window.switchRoyalTab === 'function') {
      var b = document.querySelector('.royal-tab[data-type="' + tab + '"]');
      if (b) window.switchRoyalTab(b);
    }
    // اختيار الدولة أولًا (يبدّل المدن في البحث)، ثم المدينة
    // (عند الترحيب فقط؛ في الزيارات التالية تُستعاد آخر دولة اختارها الزائر من أعلى الصفحة)
    if (withCountry && p.country && typeof window.selectCustomCountry === 'function') {
      var c = countryOf(p.country);
      try { window.selectCustomCountry(c[0], c[1], 'https://flagcdn.com/w40/' + c[2] + '.png'); } catch (e) {}
    }
    var sel = document.getElementById('citySelector');
    if (sel && p.city) { var opt = Array.prototype.find.call(sel.options, function (o) { return o.value === p.city || o.textContent.trim() === p.city; }); if (opt) sel.value = opt.value; }
  }
  // الترحيب يظهر في كل دخول جديد للموقع أو التطبيق (مرة في كل جلسة)، مع اختيارات الزائر السابقة جاهزة ليغيّرها
  function welcome() {
    if (!isIndex) return;
    var prof = LS.get('aq_profile', null);
    if (SS.get('aqe_welcome_done')) { if (prof) setTimeout(function () { applyProfile(prof); }, 900); return; }
    if (prof) setTimeout(function () { applyProfile(prof); }, 900);
    setTimeout(function () {
      if (document.querySelector('.aqe-ov')) return;
      var choice = (prof && prof.intent) || '';
      var ov = document.createElement('div'); ov.className = 'aqe-ov';
      var opt = function (v, ic, t) { return '<button type="button" data-v="' + v + '" class="' + (choice === v ? 'on' : '') + '"><i class="fas ' + ic + '"></i>' + t + '</button>'; };
      ov.innerHTML = '<div class="aqe-sheet" role="dialog" aria-modal="true" aria-labelledby="aqeWT">' +
        '<h3 id="aqeWT">' + (prof ? 'أهلًا بعودتك إلى أنا عقار 👋' : 'أهلًا بك في أنا عقار 👋') + '</h3><p class="sub">' + (prof ? 'ماذا تريد أن نعرض لك هذه المرة؟' : 'أخبرنا بما تبحث عنه لنعرض لك الأنسب أولًا') + '</p>' +
        '<div class="aqe-choices">' + opt('all', 'fa-border-all', 'الكل: شراء وإيجار') + opt('sale', 'fa-key', 'أبحث عن شراء') + opt('rent', 'fa-building', 'أبحث عن إيجار') +
        opt('invest', 'fa-chart-line', 'أبحث عن استثمار') + '</div>' +
        '<div class="aqe-choices">' + opt('stays', 'fa-umbrella-beach', 'شورت تيرم: يومي وشهري') + opt('cars', 'fa-car-side', 'موتورات') + '</div>' +
        '<div class="aqe-choices" style="grid-template-columns:1fr">' + opt('broker', 'fa-user-tie', 'أنا وسيط أو مطوّر') + '</div>' +
        '<label class="aqe-field"><span>الدولة</span><select id="aqeWCountry">' +
        COUNTRIES.map(function (c) { return '<option value="' + c[0] + '">' + c[1] + '</option>'; }).join('') + '</select></label>' +
        '<label class="aqe-field"><span>المدينة المفضّلة</span><select id="aqeWCity"></select></label>' +
        '<button class="aqe-btn" type="button" id="aqeWGo"' + (choice ? '' : ' disabled') + '>' + (prof ? 'اعرض' : 'ابدأ') + '</button><button class="aqe-link" type="button" id="aqeWSkip">' + (prof ? 'تخطَّ' : 'ليس الآن') + '</button></div>';
      document.body.appendChild(ov);
      var go = ov.querySelector('#aqeWGo');
      var cSel = ov.querySelector('#aqeWCountry'), citySel = ov.querySelector('#aqeWCity');
      var fillCities = function () { var c = countryOf(cSel.value); citySel.innerHTML = '<option value="">كل مدن ' + c[1] + '</option>' + c[3].map(function (x) { return '<option>' + x + '</option>'; }).join(''); };
      try { var saved = (prof && prof.country) || localStorage.getItem('anaaqar_selected_country'); if (saved) cSel.value = saved; } catch (e) {}
      fillCities(); cSel.onchange = fillCities;
      if (prof && prof.city) citySel.value = prof.city;
      ov.querySelectorAll('.aqe-choices button').forEach(function (b) {
        b.onclick = function () { choice = b.dataset.v; ov.querySelectorAll('.aqe-choices button').forEach(function (x) { x.classList.toggle('on', x === b); }); go.disabled = false; };
      });
      ov.querySelector('#aqeWSkip').onclick = function () { ov.remove(); SS.set('aqe_welcome_done', '1'); };
      go.onclick = function () {
        var p = { intent: choice, country: cSel.value, city: citySel.value, at: new Date().toISOString() };
        LS.set('aq_profile', p); SS.set('aqe_welcome_done', '1'); SS.set('aqe_welcomed_now', '1'); ov.remove();
        if (choice === 'broker') {
          toast('مرحبًا بك! فعّل ملفك المهني وانشر عقاراتك', 'success', { label: 'فعّل ملفي', run: function () { location.href = 'claim-profile.html'; } });
        } else if (choice === 'stays' || choice === 'cars') {
          location.href = choice === 'stays' ? 'stays.html' : 'cars.html';
        } else {
          applyProfile(p, true);
          if (typeof window.executeSearch === 'function') { try { window.executeSearch(true); } catch (e) {} }
          toast('رتّبنا لك الصفحة حسب اختيارك ✨');
        }
      };
    }, 1200);
  }

  // ===================== الدردشة المباشرة =====================
  var chat = { el: null, poll: null, last: 0, sending: false };
  function chatState() { return LS.get('aq_chat', null); }
  function setBadge(n) {
    var targets = [document.getElementById('aqFabBtn'), document.querySelector('.aqe-fbtn')];
    targets.forEach(function (b) {
      if (!b) return;
      var d = b.querySelector('.aqe-dot');
      if (n > 0) { if (!d) { d = document.createElement('span'); d.className = 'aqe-dot'; b.style.position = b.style.position || 'relative'; b.appendChild(d); } d.textContent = n > 9 ? '9+' : n; }
      else if (d) d.remove();
    });
  }
  function fmtTime(t) { try { return new Date(t).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } }
  function addMsg(m) {
    var body = chat.el && chat.el.querySelector('.aqe-chat-b');
    if (!body) return;
    var d = document.createElement('div');
    d.className = 'aqe-m ' + (m.sender === 'admin' ? 'a' : m.sender === 'sys' ? 'sys' : 'u');
    d.innerHTML = esc(m.body) + (m.created_at ? '<small>' + esc(fmtTime(m.created_at)) + '</small>' : '');
    body.appendChild(d); body.scrollTop = body.scrollHeight;
  }
  function fetchMsgs() {
    var s = chatState(), c = sb();
    if (!s || !c || !chat.el) return Promise.resolve();
    return c.rpc('chat_fetch', { p_thread: s.id, p_token: s.token, p_after: chat.last }).then(function (r) {
      if (r.error) {
        if (/not_found/.test(r.error.message || '')) { LS.del('aq_chat'); renderChat(); }
        return;
      }
      (r.data || []).forEach(function (m) { chat.last = Math.max(chat.last, m.id); addMsg(m); });
      setBadge(0);
    });
  }
  function renderChat() {
    if (!chat.el) return;
    var s = chatState();
    var main = chat.el.querySelector('.aqe-chat-main');
    if (!s) {
      var prof = LS.get('aq_chat_profile', {}) || {};
      main.innerHTML = '<div class="aqe-chat-start"><p class="sub" style="margin:0 0 12px;color:#64748b;font-weight:700">مرحبًا! اكتب بياناتك لنبدأ المحادثة، ويرد عليك فريق أنا عقار في أقرب وقت.</p>' +
        '<label class="aqe-field"><span>الاسم</span><input id="aqeCN" autocomplete="name" maxlength="80" value="' + esc(prof.name || '') + '"></label>' +
        '<label class="aqe-field"><span>رقم الجوال أو واتساب</span><input id="aqeCP" type="tel" dir="ltr" autocomplete="tel" maxlength="30" value="' + esc(prof.phone || '') + '"></label>' +
        '<label class="aqe-field"><span>البريد الإلكتروني (اختياري)</span><input id="aqeCE" type="email" dir="ltr" autocomplete="email" maxlength="120" value="' + esc(prof.email || '') + '"></label>' +
        '<label class="aqe-field"><span>رسالتك</span><textarea id="aqeCM" rows="3" maxlength="2000" placeholder="كيف نقدر نساعدك؟"></textarea></label>' +
        '<button class="aqe-btn" id="aqeCGo" type="button"><i class="fas fa-paper-plane"></i> ابدأ المحادثة</button>' +
        '<p style="font-size:12px;color:#94a3b8;margin:10px 0 0;text-align:center">بإرسالك توافق على <a href="privacy-policy.html" style="color:#00a896">سياسة الخصوصية</a></p></div>';
      main.querySelector('#aqeCGo').onclick = startChat;
      return;
    }
    main.innerHTML = '<div class="aqe-chat-b" aria-live="polite"></div><form class="aqe-chat-f"><textarea rows="1" maxlength="2000" placeholder="اكتب رسالتك..." aria-label="رسالتك"></textarea><button type="submit" aria-label="إرسال"><i class="fas fa-paper-plane"></i></button></form>';
    chat.last = 0;
    addMsg({ sender: 'sys', body: 'أهلًا ' + (s.name || '') + '، فريق خدمة العملاء يرد عليك هنا. يمكنك إغلاق النافذة والعودة لاحقًا لمتابعة المحادثة.' });
    var f = main.querySelector('form'), ta = f.querySelector('textarea');
    ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 700) { e.preventDefault(); f.requestSubmit(); } });
    f.onsubmit = function (e) { e.preventDefault(); sendMsg(ta.value, ta); };
    fetchMsgs();
  }
  function errText(err) {
    var m = (err && err.message) || '';
    if (/rate_limited/.test(m)) return 'أرسلت رسائل كثيرة في وقت قصير، حاول بعد قليل.';
    if (/invalid_phone/.test(m)) return 'اكتب رقم جوال صحيحًا.';
    if (/invalid_name/.test(m)) return 'اكتب اسمك.';
    if (/does not exist|schema cache/.test(m)) return 'الدردشة لم تُفعَّل بعد، تواصل معنا بالبريد info@anaaqar.com';
    return 'تعذّر الإرسال الآن، حاول مرة أخرى.';
  }
  function startChat() {
    var c = sb(), m = chat.el.querySelector.bind(chat.el);
    var name = m('#aqeCN').value.trim(), phone = m('#aqeCP').value.trim(), email = m('#aqeCE').value.trim(), msg = m('#aqeCM').value.trim();
    if (name.length < 2) return toast('اكتب اسمك', 'error');
    if (phone.replace(/\D/g, '').length < 7) return toast('اكتب رقم جوال صحيحًا', 'error');
    if (!msg) return toast('اكتب رسالتك', 'error');
    if (!c) return toast('تعذّر الاتصال الآن', 'error');
    var btn = m('#aqeCGo'); btn.disabled = true;
    LS.set('aq_chat_profile', { name: name, phone: phone, email: email });
    c.rpc('chat_start', { p_name: name, p_phone: phone, p_email: email || null, p_page: location.pathname + location.search }).then(function (r) {
      if (r.error || !r.data || !r.data[0]) { btn.disabled = false; return toast(errText(r.error), 'error'); }
      var t = r.data[0];
      LS.set('aq_chat', { id: t.thread_id, token: t.token, name: name });
      return c.rpc('chat_send', { p_thread: t.thread_id, p_token: t.token, p_body: msg }).then(function () { renderChat(); });
    });
  }
  function sendMsg(text, ta) {
    var s = chatState(), c = sb(); text = (text || '').trim();
    if (!text || !s || !c || chat.sending) return;
    chat.sending = true;
    c.rpc('chat_send', { p_thread: s.id, p_token: s.token, p_body: text }).then(function (r) {
      chat.sending = false;
      if (r.error) return toast(errText(r.error), 'error');
      ta.value = ''; ta.style.height = 'auto'; fetchMsgs();
    });
  }
  function openChat() {
    css();
    if (typeof window.toggleAqFab === 'function') window.toggleAqFab(false);
    if (typeof window.aqDrawer === 'function') window.aqDrawer(false);
    if (chat.el) { chat.el.hidden = false; renderChat(); startPoll(); return; }
    chat.el = document.createElement('div');
    chat.el.className = 'aqe-chat'; chat.el.setAttribute('role', 'dialog'); chat.el.setAttribute('aria-label', 'الدردشة مع خدمة العملاء');
    chat.el.innerHTML = '<div class="aqe-chat-h"><span class="av"><i class="fas fa-headset"></i></span><span><b>خدمة عملاء أنا عقار</b><small>نرد عليك في أقرب وقت</small></span><button class="x" type="button" aria-label="إغلاق"><i class="fas fa-xmark"></i></button></div><div class="aqe-chat-main" style="flex:1;display:flex;flex-direction:column;min-height:0"></div>';
    document.body.appendChild(chat.el);
    chat.el.querySelector('.x').onclick = closeChat;
    renderChat(); startPoll();
  }
  function closeChat() { if (chat.el) chat.el.hidden = true; clearInterval(chat.poll); chat.poll = null; }
  function startPoll() { clearInterval(chat.poll); chat.poll = setInterval(function () { if (!document.hidden && chat.el && !chat.el.hidden) fetchMsgs(); }, 4000); }
  function checkUnread() {
    var s = chatState(), c = sb();
    if (!s || !c || (chat.el && !chat.el.hidden)) return;
    c.rpc('chat_unread', { p_thread: s.id, p_token: s.token }).then(function (r) {
      if (r.error) return;
      if (r.data === -1) { LS.del('aq_chat'); return; }
      setBadge(r.data || 0);
      if (r.data > 0 && !SS.get('aqe_chat_notified_' + r.data)) {
        SS.set('aqe_chat_notified_' + r.data, '1');
        toast('وصلك رد من خدمة العملاء', 'success', { label: 'افتح الدردشة', run: openChat });
      }
    });
  }
  function chatEntry() {
    // عنصر في نافذة التواصل العائمة (الصفحة الرئيسية)
    var menu = document.getElementById('aqFabMenu');
    if (menu && !menu.querySelector('[data-aqe-chat]')) {
      var head = menu.querySelector('.aq-fm-head');
      var b = document.createElement('button');
      b.className = 'aq-fm-item'; b.type = 'button'; b.setAttribute('data-aqe-chat', '');
      b.innerHTML = '<span class="aq-fm-ic" style="background:#dbeafe;color:#1d4ed8"><i class="fas fa-comment-dots"></i></span><span class="aq-fm-tx"><b>تحدث معنا الآن</b><small>دردشة مباشرة مع خدمة العملاء</small></span><i class="fas fa-chevron-left aq-fm-go"></i>';
      b.onclick = openChat;
      if (head && head.nextSibling) menu.insertBefore(b, head.nextSibling); else menu.appendChild(b);
    }
    // زر عائم في الصفحات التي ليس فيها زر تواصل
    if (!document.getElementById('aqFabWrap') && !document.body.hasAttribute('data-no-chat-btn') && !document.querySelector('.aqe-fbtn')) {
      var f = document.createElement('button');
      f.className = 'aqe-fbtn'; f.type = 'button'; f.setAttribute('aria-label', 'تحدث مع خدمة العملاء');
      f.innerHTML = '<i class="fas fa-comment-dots"></i>';
      if (document.querySelector('.mobile-bottom-app-bar')) f.style.bottom = 'calc(84px + env(safe-area-inset-bottom,0px))';
      f.onclick = openChat;
      document.body.appendChild(f);
    }
    document.querySelectorAll('[data-open-chat]').forEach(function (el) { el.addEventListener('click', function (e) { e.preventDefault(); openChat(); }); });
    if (/[?&#]chat=1/.test(location.search + location.hash)) setTimeout(openChat, 400);
  }

  // ===================== حساب المستخدم والإشعارات =====================
  var user = null;
  function getUser() {
    var c = sb();
    if (!c) return Promise.resolve(null);
    return c.auth.getSession().then(function (r) { user = (r.data && r.data.session && r.data.session.user) || null; return user; }, function () { return null; });
  }
  function unreadNotifications() {
    var c = sb();
    if (!user || !c) return Promise.resolve(0);
    return c.from('user_notifications').select('id,title,body,url,created_at', { count: 'exact' }).is('read_at', null).order('id', { ascending: false }).limit(5).then(function (r) {
      if (r.error) return 0;
      var n = r.count || 0;
      document.querySelectorAll('[data-aqe-notif-count]').forEach(function (el) { el.textContent = n ? '(' + n + ')' : ''; });
      document.querySelectorAll('.hamburger-menu-btn').forEach(function (b) {
        var d = b.querySelector('.aqe-dot');
        if (n) { if (!d) { d = document.createElement('span'); d.className = 'aqe-dot'; b.style.position = 'relative'; b.appendChild(d); } d.textContent = n > 9 ? '9+' : n; } else if (d) d.remove();
      });
      // تنبيه المتصفح لأحدث إشعار لم يُعرض بعد
      var top = (r.data || [])[0], seen = LS.get('aqe_notif_seen', 0);
      if (top && top.id > seen) {
        LS.set('aqe_notif_seen', top.id);
        if (seen && 'Notification' in window && Notification.permission === 'granted') {
          try { new Notification(top.title, { body: top.body || '', icon: 'icons/app-icon-v3-192.png' }); } catch (e) {}
        } else if (seen) {
          toast(top.title, 'success', { label: 'عرض', run: function () { location.href = 'my.html#notifications'; } });
        }
      }
      return n;
    }, function () { return 0; });
  }

  // روابط الإدارة (مثل «لوحة التحكم») مخفية للجميع، وتظهر لحساب الإدارة فقط
  function showAdminLinks(u) {
    var links = document.querySelectorAll('[data-admin-only]'), pro = document.querySelectorAll('[data-pro-only]'), non = document.querySelectorAll('[data-nonpro-only]'), c = sb();
    links.forEach(function (el) { el.hidden = true; }); pro.forEach(function (el) { el.hidden = true; }); non.forEach(function (el) { el.hidden = false; });
    if (!u || !c) return;
    // روابط المهنيين تظهر للوسطاء والمكاتب والمطوّرين والإدارة فقط
    Promise.all([
      c.rpc('is_app_admin').then(function (r) { return !r.error && r.data === true; }, function () { return false; }),
      c.from('profiles').select('account_type').eq('id', u.id).maybeSingle().then(function (r) { return (r.data && r.data.account_type) || ''; }, function () { return ''; })
    ]).then(function (x) {
      var admin = x[0], isPro = admin || ['broker', 'office', 'developer'].indexOf(x[1]) > -1;
      if (admin) links.forEach(function (el) { el.hidden = false; });
      pro.forEach(function (el) { el.hidden = !isPro; }); non.forEach(function (el) { el.hidden = isPro; });
    });
  }

  // ===================== حفظ البحث =====================
  function currentCriteria() {
    var val = function (id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
    var tab = (typeof currentTabType !== 'undefined') ? currentTabType : 'sale'; // eslint-disable-line no-undef
    return {
      deal: (tab === 'rent' || tab === 'sale') ? tab : '',
      tab: tab,
      city: val('citySelector') === 'all' ? '' : val('citySelector'),
      max_price: val('maxPriceInput'),
      keyword: val('searchInput')
    };
  }
  function criteriaName(c) {
    var parts = [];
    parts.push(c.deal === 'rent' ? 'إيجار' : c.deal === 'sale' ? 'شراء' : 'عقارات');
    if (c.city) parts.push('في ' + c.city);
    if (c.keyword) parts.push('«' + c.keyword + '»');
    if (c.max_price) parts.push('حتى ' + Number(c.max_price).toLocaleString('en-US') + ' درهم');
    return parts.join(' ');
  }
  function searchUrl(c) {
    var q = new URLSearchParams();
    if (c.tab) q.set('tab', c.tab); if (c.city) q.set('city', c.city); if (c.max_price) q.set('max', c.max_price); if (c.keyword) q.set('q', c.keyword);
    return 'index.html?' + q.toString() + '#search';
  }
  function saveSearch() {
    var c = currentCriteria(), name = criteriaName(c);
    var local = LS.get('aq_saved_searches', []);
    if (!local.some(function (x) { return JSON.stringify(x.criteria) === JSON.stringify(c); })) {
      local.unshift({ id: 'l' + Date.now(), name: name, criteria: c, at: new Date().toISOString() });
      LS.set('aq_saved_searches', local.slice(0, 30));
    }
    getUser().then(function (u) {
      var cl = sb();
      if (!u || !cl) {
        toast('حفظنا البحث في «قوائمي». سجّل الدخول لتصلك التنبيهات عند نزول عقار مطابق', 'success', {
          label: 'تسجيل الدخول', run: function () { if (typeof window.openLoginModal === 'function') window.openLoginModal(); else location.href = 'index.html'; }
        });
        return;
      }
      cl.from('saved_searches').insert({ name: name, criteria: c }).then(function (r) {
        if (r.error) { toast('حفظنا البحث على جهازك، وتعذّر تفعيل التنبيهات الآن', 'error'); return; }
        toast('تم حفظ البحث 🔔 سننبّهك عند نزول عقار مطابق', 'success', { label: 'قوائمي', run: function () { location.href = 'my.html#searches'; } });
        if ('Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) {} }
      });
    });
  }
  function runSearchFromUrl() {
    if (!isIndex) return;
    var p = new URLSearchParams(location.search);
    if (!p.has('tab') && !p.has('city') && !p.has('q') && !p.has('max')) return;
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (typeof window.executeSearch !== 'function' || !document.getElementById('citySelector') || (document.getElementById('citySelector').options.length < 2 && tries < 20)) return;
      clearInterval(t);
      var b = document.querySelector('.royal-tab[data-type="' + (p.get('tab') || 'sale') + '"]');
      if (b && typeof window.switchRoyalTab === 'function') window.switchRoyalTab(b);
      var set = function (id, v) { var el = document.getElementById(id); if (el && v != null) el.value = v; };
      set('citySelector', p.get('city') || 'all'); set('maxPriceInput', p.get('max') || ''); set('searchInput', p.get('q') || '');
      setTimeout(function () { try { window.executeSearch(); } catch (e) {} }, 200);
    }, 300);
  }

  // ===================== ملاحظات العقارات =====================
  var notes = {
    all: function () { return LS.get('aq_notes', {}) || {}; },
    get: function (pid) { return (LS.get('aq_notes', {}) || {})[pid] || ''; },
    set: function (pid, text) { var n = LS.get('aq_notes', {}) || {}; if (text) n[pid] = String(text).slice(0, 1000); else delete n[pid]; LS.set('aq_notes', n); }
  };

  window.AQEngage = {
    openChat: openChat, closeChat: closeChat, saveSearch: saveSearch, criteriaName: criteriaName, searchUrl: searchUrl,
    loadPublic: loadPublic, notes: notes, toast: toast, getUser: getUser, esc: esc, untilText: untilText,
    refreshNotifications: function () { return getUser().then(unreadNotifications); }
  };

  function boot() {
    css();
    ticker();
    offerBadges();
    welcome();
    dailyTip();
    chatEntry();
    runSearchFromUrl();
    setTimeout(checkUnread, 1500);
    setInterval(checkUnread, 45000);
    getUser().then(function (u) { unreadNotifications(); showAdminLinks(u); });
    try { sb() && sb().auth.onAuthStateChange(function (_e, session) { user = (session && session.user) || null; showAdminLinks(user); }); } catch (e) {}
    setInterval(function () { if (!document.hidden) unreadNotifications(); }, 120000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
