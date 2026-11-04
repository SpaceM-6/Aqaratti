/* «ابحث عن وسيط» — قائمة الوسطاء والمكاتب بطريقة عرض تفصيلية (agents.html)
   يعتمد على supabase/directory_v2.sql (directory_agents, directory_offices, directory_facets) */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => Number(n || 0).toLocaleString('en-US');
  const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
  const qs = new URLSearchParams(location.search);
  const S = { mode: qs.get('tab') === 'offices' ? 'offices' : 'agents', office: qs.get('office') || '', q: qs.get('q') || '',
    deal: '', type: '', lang: '', nat: '', ver: false, sort: 'featured', off: 0, rows: [], total: 0, facets: {} };
  const TYPES_AR = { apartment: 'شقة', villa: 'فيلا', townhouse: 'تاون هاوس', penthouse: 'بنتهاوس', studio: 'استوديو', land: 'أرض', office: 'مكتب', shop: 'محل تجاري', warehouse: 'مستودع', duplex: 'دوبلكس', compound: 'مجمّع سكني', building: 'مبنى كامل', hotel_apartment: 'شقة فندقية' };
  const initials = (s) => String(s || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const PAGE = 24;
  let loading = false;

  function setupMsg(e) {
    return /function|does not exist|schema cache/i.test((e && e.message) || '') ? 'نجهّز هذه الصفحة الآن، وتظهر النتائج قريبًا.' : 'تعذّر تحميل النتائج، حاول مرة أخرى.';
  }

  function filtersHTML() {
    const F = S.facets || {}, sel = (id, label, opts, val) => opts.length ? `<select id="${id}" aria-label="${label}"><option value="">${label}</option>${opts.map(([v, t]) => `<option value="${esc(v)}" ${val === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>` : '';
    const deals = []; if (F.sale > 0) deals.push(['sale', 'لديه عقارات للبيع']); if (F.rent > 0) deals.push(['rent', 'لديه عقارات للإيجار']);
    const out = [sel('fDeal', 'البيع أو الإيجار', deals, S.deal)];
    if (S.mode === 'agents') {
      out.push(sel('fType', 'نوع العقار', (F.types || []).map((t) => [t, TYPES_AR[t] || t]), S.type));
      out.push(sel('fLang', 'اللغة', (F.languages || []).map((l) => [l, l]), S.lang));
      out.push(sel('fNat', 'الجنسية', (F.nationalities || []).map((n) => [n, n]), S.nat));
    }
    return out.filter(Boolean).join('');
  }

  function sortHTML() {
    const F = S.facets || {}, o = [['featured', 'المميزون أولًا']];
    if (F.sale > 0) o.push(['sale', 'الأكثر عقارات للبيع']);
    if (F.rent > 0) o.push(['rent', 'الأكثر عقارات للإيجار']);
    return o.map(([v, t]) => `<option value="${v}" ${S.sort === v ? 'selected' : ''}>${t}</option>`).join('');
  }

  function agentCard(a) {
    const name = a.name_ar || a.name_en || 'وسيط عقاري';
    const ph = a.photo_url ? `<div class="ph" style="background-image:url('${esc(a.photo_url)}')"></div>` : `<div class="ph" style="background-image:url('/icons/avatar.svg');background-size:70%"></div>`;
    const tags = [a.verified || a.is_active ? '<span class="tag v"><i class="fas fa-award"></i> موثّق</span>' : '', a.license_active ? '<span class="tag l"><i class="fas fa-circle-check"></i> رخصة سارية</span>' : '<span class="tag x">الرخصة غير سارية</span>'].join('');
    const meta = [a.nationality ? `الجنسية: <span>${esc(a.nationality)}</span>` : '', (a.languages || []).length ? `اللغات: <span>${esc(a.languages.join('، '))}</span>` : '', `رقم الوسيط: <span>${esc(a.dld_broker_number || '—')}</span>`].filter(Boolean).join(' &nbsp; ');
    const cnt = (a.sale || a.rent) ? `<div class="cnt">${a.sale ? `<span>للبيع: ${num(a.sale)}</span>` : ''}${a.rent ? `<span>للإيجار: ${num(a.rent)}</span>` : ''}</div>` : '';
    return `<a class="ag" href="individual-broker-profile.html?id=${encodeURIComponent(a.id)}">${ph}<div class="bd">
      ${a.office_logo_url ? `<img class="lg" src="${esc(a.office_logo_url)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
      <b>${esc(name)}</b><div class="t">${esc(a.title || 'وسيط عقاري')}${a.office_name ? ' · ' + esc(a.office_name) : ''}</div>
      <div class="tags">${tags}</div><div class="meta">${meta}</div>${cnt}</div></a>`;
  }

  function officeCard(o) {
    const name = o.office_name || o.office_name_en || 'مكتب عقاري';
    const ph = o.logo_url ? `<div class="ph" style="background-image:url('${esc(o.logo_url)}');background-size:contain;background-color:#fff"></div>` : `<div class="ph off">${esc(initials(o.office_name_en || name))}</div>`;
    const cnt = (o.sale || o.rent) ? `<div class="cnt">${o.sale ? `<span>للبيع: ${num(o.sale)}</span>` : ''}${o.rent ? `<span>للإيجار: ${num(o.rent)}</span>` : ''}</div>` : '';
    return `<a class="ag" href="agents.html?office=${encodeURIComponent(o.office_number)}">${ph}<div class="bd">
      <b>${esc(name)}</b><div class="t">${o.office_name_en && o.office_name_en !== name ? esc(o.office_name_en) + ' · ' : ''}رقم المكتب ${esc(o.office_number)}</div>
      <div class="meta">الموقع: <span>دبي</span> &nbsp; الوسطاء: <span>${num(o.agents)}</span> &nbsp; رخص سارية: <span>${num(o.licensed)}</span></div>${cnt}</div></a>`;
  }

  async function load(reset) {
    if (loading) return; loading = true;
    if (reset) { S.off = 0; S.rows = []; $('list').innerHTML = '<div class="empty">جاري التحميل…</div>'; }
    const c = sb(); let r;
    try {
      r = S.mode === 'offices'
        ? await c.rpc('directory_offices', { p_q: S.q || null, p_deal: S.deal || null, p_sort: S.sort, p_limit: PAGE, p_offset: S.off })
        : await c.rpc('directory_agents', { p_q: S.q || null, p_office: S.office || null, p_language: S.lang || null, p_nationality: S.nat || null,
            p_deal: S.deal || null, p_type: S.type || null, p_verified: S.ver, p_sort: S.sort, p_limit: PAGE, p_offset: S.off });
    } catch (e) { r = { error: e }; }
    loading = false;
    if (r.error) { $('list').innerHTML = `<div class="empty">${setupMsg(r.error)}<br><a class="btn btn-soft" href="brokers-directory.html" style="margin-top:10px;display:inline-flex">الدليل الكلاسيكي</a></div>`; $('cnt').textContent = ''; $('more').innerHTML = ''; return; }
    const rows = r.data || [];
    S.rows = S.rows.concat(rows); S.off += rows.length; S.total = rows.length ? Number(rows[0].total_count) : (reset ? 0 : S.total);
    $('cnt').textContent = `${num(S.total)} نتيجة`;
    $('list').innerHTML = S.rows.map(S.mode === 'offices' ? officeCard : agentCard).join('') ||
      `<div class="empty">لا نتائج مطابقة. جرّب كلمة أخرى أو أزل أحد الفلاتر.</div>`;
    $('more').innerHTML = S.rows.length < S.total ? `<button class="btn btn-soft" id="mb">عرض المزيد (${num(S.total - S.rows.length)})</button>` : '';
    const mb = $('mb'); if (mb) mb.onclick = () => load(false);
  }

  async function officeHeader() {
    if (!S.office) { $('officeHead').innerHTML = ''; $('crOff').textContent = ''; return; }
    const r = await sb().rpc('directory_offices', { p_q: S.office, p_limit: 1 });
    const o = (r.data || []).find((x) => x.office_number === S.office) || (r.data || [])[0];
    if (!o) return;
    const name = o.office_name || o.office_name_en;
    $('crOff').innerHTML = ' › ' + esc(name);
    $('officeHead').innerHTML = `<div class="oh"><div class="lgx" style="${o.logo_url ? `background-image:url('${esc(o.logo_url)}');background-color:#fff` : ''}">${o.logo_url ? '' : esc(initials(o.office_name_en || name))}</div>
      <div><h1>${esc(name)}</h1><p>رقم المكتب (ORN): ${esc(o.office_number)}<br>${num(o.agents)} وسيط · ${num(o.licensed)} رخصة سارية${(o.sale || o.rent) ? ` · ${num(Number(o.sale) + Number(o.rent))} إعلان نشط` : ''}</p></div></div>`;
    document.title = name + ' | وسطاء المكتب — أنا عقار';
  }

  function paint() {
    document.querySelectorAll('#seg button').forEach((b) => b.classList.toggle('on', b.dataset.m === S.mode));
    $('seg').hidden = !!S.office;
    $('ttl').textContent = S.office ? 'وسطاء المكتب' : S.mode === 'offices' ? 'المكاتب والشركات' : 'الوسطاء';
    $('q').placeholder = S.mode === 'offices' ? 'ابحث باسم المكتب أو رقمه' : 'ابحث باسم الوسيط أو المكتب أو رقم الوسيط';
    $('flt').innerHTML = filtersHTML(); $('flt').hidden = !$('flt').innerHTML;
    $('sort').innerHTML = sortHTML(); $('sort').hidden = $('sort').options.length < 2;
    $('vWrap').hidden = S.mode !== 'agents';
    [['fDeal', 'deal'], ['fType', 'type'], ['fLang', 'lang'], ['fNat', 'nat']].forEach(([id, k]) => { const el = $(id); if (el) el.onchange = () => { S[k] = el.value; load(true); }; });
  }

  async function start() {
    if (!sb()) { $('list').innerHTML = '<div class="empty">تعذّر الاتصال، حاول لاحقًا.</div>'; return; }
    $('q').value = S.q;
    try { const f = await sb().rpc('directory_facets'); if (!f.error) S.facets = f.data || {}; } catch (e) {}
    paint(); officeHeader(); load(true);
    $('seg').onclick = (e) => { const b = e.target.closest('button[data-m]'); if (!b || b.dataset.m === S.mode) return; S.mode = b.dataset.m; S.deal = S.type = S.lang = S.nat = ''; S.sort = 'featured';
      history.replaceState(null, '', S.mode === 'offices' ? '?tab=offices' : location.pathname); paint(); load(true); };
    $('sf').onsubmit = (e) => { e.preventDefault(); S.q = $('q').value.trim(); load(true); $('q').blur(); };
    $('sort').onchange = () => { S.sort = $('sort').value; load(true); };
    $('ver').onchange = () => { S.ver = $('ver').checked; load(true); };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
