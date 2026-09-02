/* ====================================================================
   تبويب "الدليل الكامل" في brokers-directory.html: يعرض جدول brokers من
   Supabase (10,062 مكتب مستوردة من Excel عبر scripts/import-to-supabase.py)
   بصفحات (50 صف في كل طلب) بدل تحميل كل البيانات دفعة واحدة، مع فلترة حسب
   التصنيف وبحث نصي كامل (Full Text Search) عبر عمود search_vector في Postgres.
   يعتمد على supabaseClient العام المُهيَّأ مسبقاً في supabase-client.js.
==================================================================== */
(function () {
  const PAGE_SIZE = 50;
  const RANK_LABELS = { GOLD: 'ذهبي', SILVER: 'فضي', BRONZE: 'برونزي', GENERAL: 'عام' };

  let activeClass = 'ALL';
  let searchTerm = '';
  let offset = 0;
  let totalCount = 0;
  let loadedBrokers = [];

  function waNumber(phone) { return (phone || '').replace(/\D/g, ''); }

  // يحوّل نص البحث إلى تعبير tsquery مع مطابقة البادئة (prefix) لكل كلمة،
  // مع تنظيف أي رموز قد تكسر صياغة tsquery في Postgres.
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
    let query = supabaseClient.from('brokers').select('*', { count: 'exact' });

    if (activeClass !== 'ALL') query = query.eq('classification', activeClass);

    const q = searchTerm.trim();
    if (q) {
      const tsQuery = buildPrefixTsQuery(q);
      if (tsQuery) query = query.textSearch('search_vector', tsQuery, { config: 'simple' });
    }

    query = query.order('id', { ascending: true }).range(off, off + PAGE_SIZE - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error('تعذر جلب الوسطاء من Supabase:', error);
      return { data: [], count: 0 };
    }
    return { data: data || [], count: count || 0 };
  }

  function brokerCardHTML(b) {
    const isActive = !!b.is_active;

    if (!isActive) {
      // غير مفعل: نعرض فقط الاسم/الترخيص/التصنيف - بدون أي وسيلة تواصل مباشرة،
      // مع زر "عرض التفاصيل" الذي يبقى يعمل (شفافية أن الوسيط مسجل لدى RERA).
      return `
        <div class="broker-card broker-card-inactive" onclick="location.href='broker-directory-profile.html?id=${b.id}'">
          <div class="broker-card-top">
            <img class="broker-logo" src="${b.logo_url || 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?q=80&w=200'}" alt="${b.name_ar || ''}" loading="lazy">
            <div class="broker-names">
              <div class="broker-name-ar">${b.name_ar || '-'}</div>
              <div class="broker-name-en">${b.name_en || ''}</div>
            </div>
          </div>

          <span class="rank-badge ${b.classification}"><i class="fas fa-star"></i> ${RANK_LABELS[b.classification] || b.classification || 'عام'}</span>

          <div class="inactive-badge"><i class="fas fa-triangle-exclamation"></i> غير مفعل — لم يتم التواصل مع الوسيط بعد</div>

          ${b.license ? `<div class="broker-license">رقم الترخيص: <strong>${b.license}</strong></div>` : ''}

          <div class="broker-actions">
            <a href="broker-directory-profile.html?id=${b.id}" class="act-details" onclick="event.stopPropagation()"><i class="fas fa-circle-info"></i> عرض التفاصيل</a>
          </div>
        </div>
      `;
    }

    const activities = Array.isArray(b.activities) ? b.activities : [];
    return `
      <div class="broker-card" onclick="location.href='broker-directory-profile.html?id=${b.id}'">
        <div class="broker-card-top">
          <img class="broker-logo" src="${b.logo_url || 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?q=80&w=200'}" alt="${b.name_ar || ''}" loading="lazy">
          <div class="broker-names">
            <div class="broker-name-ar">${b.name_ar || '-'}</div>
            <div class="broker-name-en">${b.name_en || ''}</div>
          </div>
        </div>

        <span class="rank-badge ${b.classification}"><i class="fas fa-star"></i> ${RANK_LABELS[b.classification] || b.classification || 'عام'}</span>

        ${b.license ? `<div class="broker-license">رقم الترخيص: <strong>${b.license}</strong></div>` : ''}
        ${b.manager ? `<div class="broker-manager">المسؤول: <strong>${b.manager}</strong></div>` : ''}
        ${b.email ? `<div class="broker-contact-line"><i class="fas fa-envelope"></i> <a href="mailto:${b.email}" onclick="event.stopPropagation()">${b.email}</a></div>` : ''}

        ${activities.length ? `
        <div class="broker-activities">
          ${activities.map((a) => `<span class="activity-chip">${a}</span>`).join('')}
        </div>` : ''}

        <div class="broker-actions">
          ${b.phone ? `<a href="tel:${b.phone}" class="act-call" onclick="event.stopPropagation()"><i class="fas fa-phone-alt"></i> اتصال</a>` : ''}
          ${b.phone ? `<a href="https://wa.me/${waNumber(b.phone)}" target="_blank" rel="noopener noreferrer" class="act-whatsapp" onclick="event.stopPropagation()"><i class="fab fa-whatsapp"></i> واتساب</a>` : ''}
          ${b.website ? `<a href="https://${b.website.replace(/^https?:\/\//, '')}" target="_blank" rel="noopener noreferrer" class="act-site" onclick="event.stopPropagation()"><i class="fas fa-globe"></i> الموقع</a>` : ''}
        </div>
      </div>
    `;
  }

  function render() {
    const grid = document.getElementById('fullBrokersGrid');
    const meta = document.getElementById('fullResultsCountText');
    const loadMoreBtn = document.getElementById('fullLoadMoreBtn');

    meta.innerText = `عرض ${loadedBrokers.length} من ${totalCount.toLocaleString('en-US')} مكتب`;

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
    document.getElementById('fullBrokersGrid').innerHTML = `<div class="no-results"><i class="fas fa-spinner fa-spin" style="font-size:24px; display:block; margin-bottom:10px;"></i> جاري التحميل...</div>`;
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
    const bar = document.getElementById('fullStatsBar');
    if (!bar) return;

    const classes = ['GOLD', 'SILVER', 'BRONZE', 'GENERAL'];
    const counts = {};
    await Promise.all(classes.map(async (c) => {
      const { count } = await supabaseClient
        .from('brokers')
        .select('id', { count: 'exact', head: true })
        .eq('classification', c);
      counts[c] = count || 0;
    }));

    const { count: total } = await supabaseClient
      .from('brokers')
      .select('id', { count: 'exact', head: true });

    bar.innerHTML = `
      <span class="stat-item">🥇 ذهبي: <span class="stat-count">${counts.GOLD.toLocaleString('en-US')}</span></span>
      <span class="stat-divider"></span>
      <span class="stat-item">🥈 فضي: <span class="stat-count">${counts.SILVER.toLocaleString('en-US')}</span></span>
      <span class="stat-divider"></span>
      <span class="stat-item">🥉 برونزي: <span class="stat-count">${counts.BRONZE.toLocaleString('en-US')}</span></span>
      <span class="stat-divider"></span>
      <span class="stat-item">📋 عام: <span class="stat-count">${counts.GENERAL.toLocaleString('en-US')}</span></span>
      <span class="stat-divider"></span>
      <span class="stat-item stat-total">الإجمالي: <span class="stat-count">${(total || 0).toLocaleString('en-US')}</span></span>
    `;
  }

  let searchDebounce;
  document.getElementById('fullSearchInput').addEventListener('input', (e) => {
    searchTerm = e.target.value;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(loadFirstPage, 350);
  });

  document.querySelectorAll('#fullRankFilters .filter-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#fullRankFilters .filter-pill').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeClass = btn.dataset.rank;
      loadFirstPage();
    });
  });

  document.getElementById('fullLoadMoreBtn').addEventListener('click', loadMore);

  loadStats();
  loadFirstPage();
})();
