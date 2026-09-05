/* ====================================================================
   تبويب "الدليل الكامل" داخل قسم "الوسطاء الأفراد" في brokers-directory.html:
   يعرض جدول individual_brokers من Supabase (وسطاء أفراد مسجّلون لدى دائرة
   الأراضي والأملاك بدبي، مستوردون عبر scripts/import-individual-brokers.py)
   بصفحات (50 صف في كل طلب)، مع بحث نصي كامل عبر عمود search_vector.
   بيانات التواصل (هاتف/بريد) تظهر دائماً بغض النظر عن حالة التفعيل - "غير
   مفعل" هنا مجرد مؤشر حالة على منصة AqarX، وليس حجباً لبيانات عامة أصلاً
   منشورة رسمياً من دائرة الأراضي والأملاك.
   يعتمد على supabaseClient العام المُهيَّأ مسبقاً في supabase-client.js.
==================================================================== */
(function () {
  const PAGE_SIZE = 50;
  const COUNTRY = new URLSearchParams(window.location.search).get('country')
    || localStorage.getItem('aqarx_selected_country')
    || 'uae';

  let searchTerm = '';
  let offset = 0;
  let totalCount = 0;
  let loadedBrokers = [];
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
    let query = supabaseClient.from('individual_brokers').select('*', { count: 'exact' }).eq('country', COUNTRY);

    const q = searchTerm.trim();
    if (q) {
      const tsQuery = buildPrefixTsQuery(q);
      if (tsQuery) query = query.textSearch('search_vector', tsQuery, { config: 'simple' });
    }

    query = query.order('id', { ascending: true }).range(off, off + PAGE_SIZE - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error('تعذر جلب الوسطاء الأفراد من Supabase:', error);
      return { data: [], count: 0 };
    }
    return { data: data || [], count: count || 0 };
  }

  function brokerCardHTML(b) {
    const isActive = !!b.is_active;
    const photo = b.photo_url || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=200';

    return `
      <div class="broker-card" onclick="location.href='individual-broker-profile.html?id=${b.id}'">
        <div class="broker-card-top">
          <img class="broker-logo" style="border-radius:50%;" src="${photo}" alt="${b.name_ar || ''}" loading="lazy">
          <div class="broker-names">
            <div class="broker-name-ar">${b.name_ar || '-'}</div>
            <div class="broker-name-en">${b.office_name || ''}</div>
          </div>
        </div>

        <div class="active-badge" style="background:#dcfce7; color:#15803d;"><i class="fas fa-circle-check"></i> مسجل في DLD</div>
        ${!isActive ? `<div class="inactive-badge"><i class="fas fa-triangle-exclamation"></i> غير مفعل</div>` : ''}

        <div class="broker-license">رقم الوسيط: <strong>${b.dld_broker_number}</strong></div>
        ${b.email ? `<div class="broker-contact-line"><i class="fas fa-envelope"></i> <a href="mailto:${b.email}" onclick="event.stopPropagation()">${b.email}</a></div>` : ''}

        <div class="broker-actions">
          ${b.phone ? `<a href="tel:${b.phone}" class="act-call" onclick="event.stopPropagation()"><i class="fas fa-phone-alt"></i> اتصال</a>` : ''}
          ${b.phone ? `<a href="https://wa.me/${waNumber(b.phone)}" target="_blank" rel="noopener noreferrer" class="act-whatsapp" onclick="event.stopPropagation()"><i class="fab fa-whatsapp"></i> واتساب</a>` : ''}
        </div>
      </div>
    `;
  }

  function render() {
    const grid = document.getElementById('individualBrokersGrid');
    const meta = document.getElementById('individualResultsCountText');
    const loadMoreBtn = document.getElementById('individualLoadMoreBtn');
    if (!grid) return;

    meta.innerText = `عرض ${loadedBrokers.length} من ${totalCount.toLocaleString('en-US')} وسيط`;

    if (loadedBrokers.length === 0) {
      grid.innerHTML = `<div class="no-results"><i class="fas fa-search" style="font-size:28px; display:block; margin-bottom:10px;"></i> لا توجد نتائج مطابقة لبحثك.</div>`;
      loadMoreBtn.hidden = true;
      return;
    }

    grid.innerHTML = loadedBrokers.map(brokerCardHTML).join('');
    loadMoreBtn.hidden = loadedBrokers.length >= totalCount;
  }

  async function loadFirstPage() {
    offset = 0;
    document.getElementById('individualBrokersGrid').innerHTML = `<div class="no-results"><i class="fas fa-spinner fa-spin" style="font-size:24px; display:block; margin-bottom:10px;"></i> جاري التحميل...</div>`;
    const { data, count } = await fetchPage(0);
    loadedBrokers = data;
    totalCount = count;
    offset = data.length;
    render();
  }

  async function loadMore() {
    const { data } = await fetchPage(offset);
    loadedBrokers = loadedBrokers.concat(data);
    offset += data.length;
    render();
  }

  async function loadStats() {
    const bar = document.getElementById('individualStatsBar');
    if (!bar) return;

    const [{ count: activeCount }, { count: inactiveCount }, { count: total }] = await Promise.all([
      supabaseClient.from('individual_brokers').select('id', { count: 'exact', head: true }).eq('country', COUNTRY).eq('is_active', true),
      supabaseClient.from('individual_brokers').select('id', { count: 'exact', head: true }).eq('country', COUNTRY).eq('is_active', false),
      supabaseClient.from('individual_brokers').select('id', { count: 'exact', head: true }).eq('country', COUNTRY),
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
    document.getElementById('individualSearchInput').addEventListener('input', (e) => {
      searchTerm = e.target.value;
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(loadFirstPage, 350);
    });

    document.getElementById('individualLoadMoreBtn').addEventListener('click', loadMore);
  }

  // تُحمَّل بيانات هذا التبويب فقط عند فتحه أول مرة (بما في ذلك أول فتح
  // تلقائي عند دخول قسم "الوسطاء الأفراد" من بوابة الوسطاء).
  document.getElementById('tabBtnIndividualFull').addEventListener('click', () => {
    if (!tabLoaded) {
      tabLoaded = true;
      bindEvents();
      loadStats();
      loadFirstPage();
    }
  });
})();
