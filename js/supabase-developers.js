/* ====================================================================
   تبويب "الدليل الكامل" داخل قسم "المطورين العقاريين" في brokers-directory.html:
   يعرض جدول developers من Supabase (مطورون معتمدون لدى دائرة الأراضي
   والأملاك بدبي، مستوردون عبر scripts/import-developers.py) بصفحات (50 صف).
   بيانات التواصل تظهر دائماً - "غير مفعل" مجرد مؤشر حالة على منصة AqarX.
==================================================================== */
(function () {
  const PAGE_SIZE = 50;
  const COUNTRY = new URLSearchParams(window.location.search).get('country')
    || localStorage.getItem('aqarx_selected_country')
    || 'uae';

  let searchTerm = '';
  let offset = 0;
  let totalCount = 0;
  let loadedDevelopers = [];
  let tabLoaded = false;

  function waNumber(phone) { return (phone || '').replace(/\D/g, ''); }

  function buildPrefixTsQuery(term) {
    return term
      .trim()
      .split(/\s+/)
      .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
      .filter(Boolean)
      .map((w) => `${w}:*`)
      .join(' & ');
  }

  async function fetchPage(off) {
    let query = supabaseClient.from('developers').select('*', { count: 'exact' }).eq('country', COUNTRY);

    const q = searchTerm.trim();
    if (q) {
      const tsQuery = buildPrefixTsQuery(q);
      if (tsQuery) query = query.textSearch('search_vector', tsQuery, { config: 'simple' });
    }

    query = query.order('id', { ascending: true }).range(off, off + PAGE_SIZE - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error('تعذر جلب المطورين من Supabase:', error);
      return { data: [], count: 0 };
    }
    return { data: data || [], count: count || 0 };
  }

  function developerCardHTML(d) {
    const isActive = !!d.is_active;
    const phone = d.phone || d.mobile;
    const logo = d.logo_url || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=200';

    return `
      <div class="broker-card">
        <div class="broker-card-top">
          <img class="broker-logo" src="${logo}" alt="${d.name_ar || ''}" loading="lazy">
          <div class="broker-names">
            <div class="broker-name-ar">${d.name_ar || '-'}</div>
            <div class="broker-name-en">${d.name_en || ''}</div>
          </div>
        </div>

        <div class="active-badge" style="background:#dcfce7; color:#15803d;"><i class="fas fa-circle-check"></i> مسجل في DLD</div>
        ${!isActive ? `<div class="inactive-badge"><i class="fas fa-triangle-exclamation"></i> غير مفعل</div>` : ''}

        ${d.rating ? `<div class="broker-license">التقييم: <strong>${d.rating} <i class="fas fa-star" style="color:#d4af37;"></i></strong></div>` : ''}
        ${d.email ? `<div class="broker-contact-line"><i class="fas fa-envelope"></i> <a href="mailto:${d.email}">${d.email}</a></div>` : ''}

        <div class="broker-actions">
          ${phone ? `<a href="tel:${phone}" class="act-call"><i class="fas fa-phone-alt"></i> اتصال</a>` : ''}
          ${phone ? `<a href="https://wa.me/${waNumber(phone)}" target="_blank" rel="noopener noreferrer" class="act-whatsapp"><i class="fab fa-whatsapp"></i> واتساب</a>` : ''}
        </div>
      </div>
    `;
  }

  function render() {
    const grid = document.getElementById('developersGrid');
    const meta = document.getElementById('developersResultsCountText');
    const loadMoreBtn = document.getElementById('developersLoadMoreBtn');
    if (!grid) return;

    meta.innerText = `عرض ${loadedDevelopers.length} من ${totalCount.toLocaleString('en-US')} مطوّر`;

    if (loadedDevelopers.length === 0) {
      grid.innerHTML = `<div class="no-results"><i class="fas fa-search" style="font-size:28px; display:block; margin-bottom:10px;"></i> لا توجد نتائج مطابقة لبحثك.</div>`;
      loadMoreBtn.hidden = true;
      return;
    }

    grid.innerHTML = loadedDevelopers.map(developerCardHTML).join('');
    loadMoreBtn.hidden = loadedDevelopers.length >= totalCount;
  }

  async function loadFirstPage() {
    offset = 0;
    document.getElementById('developersGrid').innerHTML = `<div class="no-results"><i class="fas fa-spinner fa-spin" style="font-size:24px; display:block; margin-bottom:10px;"></i> جاري التحميل...</div>`;
    const { data, count } = await fetchPage(0);
    loadedDevelopers = data;
    totalCount = count;
    offset = data.length;
    render();
  }

  async function loadMore() {
    const { data } = await fetchPage(offset);
    loadedDevelopers = loadedDevelopers.concat(data);
    offset += data.length;
    render();
  }

  async function loadStats() {
    const bar = document.getElementById('developersStatsBar');
    if (!bar) return;

    const [{ count: activeCount }, { count: inactiveCount }, { count: total }] = await Promise.all([
      supabaseClient.from('developers').select('id', { count: 'exact', head: true }).eq('country', COUNTRY).eq('is_active', true),
      supabaseClient.from('developers').select('id', { count: 'exact', head: true }).eq('country', COUNTRY).eq('is_active', false),
      supabaseClient.from('developers').select('id', { count: 'exact', head: true }).eq('country', COUNTRY),
    ]);

    bar.innerHTML = `
      <span class="stat-item">مفعل: <span class="stat-count">${(activeCount || 0).toLocaleString('en-US')}</span></span>
      <span class="stat-divider"></span>
      <span class="stat-item">غير مفعل: <span class="stat-count">${(inactiveCount || 0).toLocaleString('en-US')}</span></span>
      <span class="stat-divider"></span>
      <span class="stat-item stat-total">الإجمالي: <span class="stat-count">${(total || 0).toLocaleString('en-US')}</span></span>
    `;
  }

  function bindEvents() {
    let searchDebounce;
    document.getElementById('developersSearchInput').addEventListener('input', (e) => {
      searchTerm = e.target.value;
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(loadFirstPage, 350);
    });

    document.getElementById('developersLoadMoreBtn').addEventListener('click', loadMore);
  }

  document.getElementById('cardDevelopers').addEventListener('click', () => {
    if (!tabLoaded) {
      tabLoaded = true;
      bindEvents();
      loadStats();
      loadFirstPage();
    }
  });
})();
