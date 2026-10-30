/* زر الرجوع في الجوال: يغلق النافذة المفتوحة (القائمة الجانبية، الفلاتر، النوافذ المنبثقة، الدردشة)
   بدل مغادرة الصفحة، وإلا يرجع للصفحة السابقة كالمعتاد. يعمل في المتصفح والتطبيق المثبّت. */
(function () {
  'use strict';
  if (window.__aqBack) return; window.__aqBack = true;

  // كل نوع نافذة: كيف نعرف أنها مفتوحة، وكيف نغلقها
  const KINDS = [
    { sel: '.aq-drawer.open', close: () => (typeof window.aqDrawer === 'function' ? window.aqDrawer(false) : null) },
    { sel: '.aqf-ov', close: (el) => { const x = el.querySelector('[data-x]'); x ? x.click() : el.remove(); } },
    { sel: '.aqi-ov', close: (el) => { const x = el.querySelector('[data-x]'); x ? x.click() : el.remove(); } },
    { sel: '.drawer-ov', close: (el) => { const x = el.querySelector('.x'); x ? x.click() : el.remove(); } },
    { sel: '.aqe-ov', close: (el) => { const x = el.querySelector('#aqeWSkip, .aqe-link, [data-x], .x'); x ? x.click() : el.remove(); } },
    { sel: '.aqe-chat:not([hidden])', close: () => window.AQEngage && window.AQEngage.closeChat && window.AQEngage.closeChat() },
    { sel: '.royal-modal-overlay', visible: (el) => getComputedStyle(el).display !== 'none', close: (el) => { el.style.display = 'none'; } },
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
