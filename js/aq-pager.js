/* ترقيم الصفحات المشترك (24 إعلانًا في الصفحة مثل Bayut) — أرقام صفحات + السابق/التالي
   AQPager.PER                          عدد الإعلانات في الصفحة
   AQPager.page()                       رقم الصفحة من الرابط (?page=)
   AQPager.slice(list, page)            إعلانات الصفحة
   AQPager.render(el, total, page, go)  يرسم الأزرار؛ go(n) عند الاختيار
   AQPager.setUrl(page)                 يحفظ الرقم في الرابط (للرجوع والمشاركة)
   AQPager.range(total, page)           نص «1–24 من 548» */
(function () {
  'use strict';
  const PER = 24;
  const pages = (total) => Math.max(1, Math.ceil(total / PER));
  const clamp = (p, total) => Math.min(Math.max(1, p | 0 || 1), pages(total));
  function page() { const n = parseInt(new URLSearchParams(location.search).get('page'), 10); return n > 0 ? n : 1; }
  function setUrl(p) {
    try { const u = new URL(location.href); if (p > 1) u.searchParams.set('page', p); else u.searchParams.delete('page'); history.replaceState(history.state, '', u); } catch (e) {}
  }
  function slice(list, p) { const s = (clamp(p, list.length) - 1) * PER; return list.slice(s, s + PER); }
  function range(total, p) {
    if (!total) return '';
    const s = (clamp(p, total) - 1) * PER + 1, e = Math.min(total, s + PER - 1);
    return `${s.toLocaleString('en-US')}–${e.toLocaleString('en-US')} من ${total.toLocaleString('en-US')}`;
  }
  function nums(cur, last) {
    const out = new Set([1, last, cur, cur - 1, cur + 1]);
    if (cur <= 3) [2, 3, 4].forEach((n) => out.add(n));
    if (cur >= last - 2) [last - 1, last - 2, last - 3].forEach((n) => out.add(n));
    const arr = [...out].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b);
    const res = []; arr.forEach((n, i) => { if (i && n - arr[i - 1] > 1) res.push('…'); res.push(n); });
    return res;
  }
  let css = false;
  function style() {
    if (css) return; css = true;
    const s = document.createElement('style');
    s.textContent = `.aqpg{display:flex;justify-content:center;align-items:center;gap:6px;flex-wrap:wrap;margin:22px 0 6px}
.aqpg button{min-width:44px;height:44px;padding:0 12px;border-radius:12px;border:1.5px solid var(--line,#e2e8f0);background:var(--card,#fff);color:var(--ink,#0f172a);font-family:inherit;font-weight:800;font-size:15px;cursor:pointer;font-variant-numeric:tabular-nums;transition:background .15s,border-color .15s}
.aqpg button:hover:not([disabled]):not([aria-current]){border-color:#00857a;color:#00857a}
.aqpg button[aria-current="page"]{background:#00857a;border-color:#00857a;color:#fff;cursor:default}
.aqpg button[disabled]{opacity:.4;cursor:default}
.aqpg button:focus-visible{outline:3px solid #5eead4;outline-offset:2px}
.aqpg .gap{min-width:24px;text-align:center;color:var(--muted,#64748b);font-weight:800}
@media (max-width:480px){.aqpg button{min-width:40px;height:42px;padding:0 9px;font-size:14px}.aqpg .lbl{display:none}}`;
    document.head.appendChild(s);
  }
  function render(el, total, p, go) {
    if (!el) return;
    const last = pages(total); p = clamp(p, total);
    if (last <= 1) { el.innerHTML = ''; return; }
    style();
    el.innerHTML = `<nav class="aqpg" aria-label="صفحات النتائج">
      <button type="button" data-p="${p - 1}" ${p === 1 ? 'disabled' : ''} aria-label="الصفحة السابقة"><span aria-hidden="true">›</span> <span class="lbl">السابق</span></button>
      ${nums(p, last).map((n) => n === '…' ? '<span class="gap" aria-hidden="true">…</span>' : `<button type="button" data-p="${n}" ${n === p ? 'aria-current="page"' : ''} aria-label="الصفحة ${n}">${n}</button>`).join('')}
      <button type="button" data-p="${p + 1}" ${p === last ? 'disabled' : ''} aria-label="الصفحة التالية"><span class="lbl">التالي</span> <span aria-hidden="true">‹</span></button></nav>`;
    el.querySelectorAll('button[data-p]').forEach((b) => b.onclick = () => {
      const n = parseInt(b.dataset.p, 10); if (!n || n === p || b.disabled) return;
      setUrl(n); go(n);
    });
  }
  window.AQPager = { PER, page, slice, render, setUrl, range, pages };
})();
