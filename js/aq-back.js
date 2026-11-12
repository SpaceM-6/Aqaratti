/* زر الرجوع في الجوال: يغلق النافذة المفتوحة (القائمة الجانبية، الفلاتر، النوافذ المنبثقة، الدردشة)
   بدل مغادرة الصفحة، وإلا يرجع للصفحة السابقة كالمعتاد. يعمل في المتصفح والتطبيق المثبّت. */
(function () {
  'use strict';
  if (window.__aqBack) return; window.__aqBack = true;
  // كل صفحة تُفتح من أعلاها بشكل طبيعي، بلا تمرير متحرك للصفحة (إلا عند الرجوع للخلف فتعود لمكانك)
  try {
    var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {};
    var back = nav.type === 'back_forward';
    if ('scrollRestoration' in history) history.scrollRestoration = back ? 'auto' : 'manual';
    var st0 = document.createElement('style');
    st0.textContent = 'html,body{scroll-behavior:auto!important}';
    (document.head || document.documentElement).appendChild(st0);
    if (!back && !location.hash) {
      var top0 = function () { if (window.scrollY > 0 && !window.__aqUserScrolled) window.scrollTo(0, 0); };
      ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (ev) { window.addEventListener(ev, function () { window.__aqUserScrolled = true; }, { once: true, passive: true }); });
      top0(); document.addEventListener('DOMContentLoaded', top0); window.addEventListener('load', function () { top0(); setTimeout(top0, 300); });
    }
  } catch (e) {}
  // داخل التطبيق (آيفون/أندرويد): تحميل خصائص الجهاز (المشاركة بالصور، الإشعارات، الاهتزاز)
  try {
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && !document.querySelector('script[src*="aq-native.js"]')) {
      var ns = document.createElement('script'); ns.src = '/js/aq-native.js?v=118'; ns.defer = true; (document.head || document.documentElement).appendChild(ns);
    }
  } catch (e) {}
  // منع اهتزاز الصفحة يمينًا ويسارًا في الجوال: لا شيء يتجاوز عرض الشاشة
  try {
    const st = document.createElement('style');
    st.textContent = 'html,body{overflow-x:hidden;max-width:100%}@supports (overflow:clip){html,body{overflow-x:clip}}html,body{overscroll-behavior-x:none}';
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}

  // كل نوع نافذة: كيف نعرف أنها مفتوحة، وكيف نغلقها
  const KINDS = [
    { sel: '.aq-drawer.open', close: () => (typeof window.aqDrawer === 'function' ? window.aqDrawer(false) : null) },
    { sel: '.aqf-ov', close: (el) => { const x = el.querySelector('[data-x]'); x ? x.click() : el.remove(); } },
    { sel: '.aqi-ov', close: (el) => { const x = el.querySelector('[data-x]'); x ? x.click() : el.remove(); } },
    { sel: '.drawer-ov', close: (el) => { const x = el.querySelector('.x'); x ? x.click() : el.remove(); } },
    { sel: '.aqe-ov', close: (el) => { const x = el.querySelector('#aqeWSkip, .aqe-link, [data-x], .x'); x ? x.click() : el.remove(); } },
    { sel: '.aqe-chat:not([hidden])', close: () => window.AQEngage && window.AQEngage.closeChat && window.AQEngage.closeChat() },
    { sel: '.royal-modal-overlay', visible: (el) => getComputedStyle(el).display !== 'none', close: (el) => { el.style.display = 'none'; } },
    { sel: '.aqs-ov', close: (el) => { const x = el.querySelector('[data-x]'); x ? x.click() : el.remove(); if (!document.querySelector('.aqs-ov')) document.documentElement.style.overflow = ''; } },
    { sel: '.aqs-coach', close: (el) => { const x = el.querySelector('.skip, .nx'); x ? x.click() : el.remove(); } },
    { sel: '.aq-fab-wrap.open, #aqFabWrap.open', close: () => (typeof window.toggleAqFab === 'function' ? window.toggleAqFab(false) : null) }
  ];
  function openOnes() {
    const out = [];
    KINDS.forEach((k) => document.querySelectorAll(k.sel).forEach((el) => { if (!k.visible || k.visible(el)) out.push([k, el]); }));
    return out;
  }

  let pushed = false, skipPop = false, raf = 0;
  function sync() {
    raf = 0;
    const open = openOnes().length > 0;
    if (open && !pushed) {
      // خطوة وهمية في سجل التصفح، يستهلكها زر الرجوع لإغلاق النافذة
      try { history.pushState(Object.assign({}, history.state, { aqModal: 1 }), ''); pushed = true; } catch (e) {}
    } else if (!open && pushed) {
      // أُغلقت النافذة من زرها: نحذف الخطوة الوهمية حتى لا يحتاج الرجوع ضغطتين
      pushed = false;
      if (history.state && history.state.aqModal) { skipPop = true; history.back(); }
    }
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(sync); };
  new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });

  window.addEventListener('popstate', () => {
    if (skipPop) { skipPop = false; return; }
    const open = openOnes();
    if (pushed && open.length) {
      pushed = false;
      const [k, el] = open[open.length - 1];
      try { k.close(el); } catch (e) {}
      // إن بقيت نافذة أخرى مفتوحة تُضاف خطوة جديدة لها
      setTimeout(schedule, 50);
    } else { pushed = false; }
  });
})();

// شارة «جديد» بجانب الأقسام الجديدة في كل الصفحات (الروابط والبلاطات والقوائم)، تختفي وحدها بعد تاريخها
(function () {
  'use strict';
  var NEW = [ // [بداية الرابط، آخر يوم تظهر فيه الشارة]
    ['area/', '2026-12-01'], ['areas.html', '2026-12-01'], ['lands.html', '2026-12-01'],
    ['top-brokers.html', '2026-12-01'], ['find.html', '2026-12-01'], ['join.html', '2026-12-01'], ['agents.html', '2026-12-04'], ['schools.html', '2026-12-01'], ['transport.html', '2026-12-01']
  ];
  var today = new Date().toISOString().slice(0, 10);
  NEW = NEW.filter(function (x) { return today <= x[1]; });
  if (!NEW.length) return;
  var st = document.createElement('style');
  st.textContent = '.aq-new{display:inline-block;background:#ef4444;color:#fff!important;font-size:11px;font-weight:900;line-height:1.6;padding:0 7px;border-radius:6px;margin-inline-start:6px;vertical-align:middle;letter-spacing:0;white-space:nowrap}' +
    '.aq-tile .aq-new{position:absolute;top:10px;inset-inline-end:10px;margin:0}.aq-tile{position:relative}';
  document.head.appendChild(st);
  function isNew(href) {
    if (!href || href.charAt(0) === '#') return false;
    var path = href.replace(/^https?:\/\/[^/]+/, '').replace(/^\.?\//, '').split('#')[0];
    return NEW.some(function (x) { return path === x[0] || path === '/' + x[0]; }); // رابط القسم نفسه فقط، لا روابط تفاصيله
  }
  function mark(root) {
    var here = (location.pathname.split('/').pop() || '');
    (root || document).querySelectorAll('a[href]:not([data-aq-new])').forEach(function (a) {
      a.setAttribute('data-aq-new', '');
      var h = a.getAttribute('href');
      if (!isNew(h) || h === here) return;
      if (a.closest('.crumbs, .topbar, nav.aqbnav, footer .copyright')) return;
      var b = document.createElement('span'); b.className = 'aq-new'; b.textContent = 'جديد';
      var lab = a.querySelector('b, strong');
      (lab || a).appendChild(b);
    });
    (root || document).querySelectorAll('.aq-fm-search:not([data-aq-new])').forEach(function (f) {
      f.setAttribute('data-aq-new', ''); var b = document.createElement('span'); b.className = 'aq-new'; b.textContent = 'جديد'; f.insertBefore(b, f.querySelector('button'));
    });
  }
  function start() {
    mark();
    var t; new MutationObserver(function () { clearTimeout(t); t = setTimeout(mark, 120); }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

