// منطق الصفحة الرئيسية (نُقل من index.html ليُحفظ في متصفح الزائر ولا يُعاد تحميله في كل زيارة)
    let visitedProperties = JSON.parse(localStorage.getItem('anaaqar_visited') || '[]');
    let favoriteProperties = JSON.parse(localStorage.getItem('anaaqar_favorites') || '[]');
    let compareProperties = JSON.parse(localStorage.getItem('anaaqar_compare') || '[]');
    let activePropertyForAffiliate = '';
    let loadedScrapedList = [];
    let currentTabType = 'sale';
    let propertyCardImageIndices = {};
    let activeCallPhone = "";

    // 🌙 الوضع الليلي: يُطبَّق فوراً قبل أي شي لتفادي وميض الوضع الفاتح، ويُحفظ اختيار المستخدم
    (function initDarkMode() {
      const saved = localStorage.getItem('anaaqar_theme');
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = saved || (prefersDark ? 'dark' : 'light');
      if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    })();

    function toggleAnaaqarDarkMode() {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('anaaqar_theme', 'light');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('anaaqar_theme', 'dark');
      }
      const icon = document.getElementById('darkModeIcon');
      if (icon) icon.className = document.documentElement.getAttribute('data-theme') === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    document.addEventListener('DOMContentLoaded', () => {
      const icon = document.getElementById('darkModeIcon');
      if (icon && document.documentElement.getAttribute('data-theme') === 'dark') icon.className = 'fas fa-sun';
    });

    /* 📌 مطابقة مصفوفة بيانات العقارات والوسيط مع صفحة تفاصيل العقار */
    const rawPropertiesData = [
      {
        id: "101",
        title: "برج لوكسوريا السكني، الضاحية 4، مثلث قرية جميرا (JVT)، دبي",
        priceAED: 645000,
        dealType: "sale",
        isGolden: true,
        roiPercent: "8.5%",
        bedrooms: 1,
        bathrooms: 1,
        area_m2: 336,
        isVerified: false,
        has3DTour: false,
        propertyType: "شقة سكنية / استوديو",
        image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=800",
        images: [
          "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=1200",
          "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=600",
          "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=600"
        ],
        commission: "1.5%",
        broker: { brokerId: "b1", name: "إبراهيم عبد العاطي إبراهيم", agency: "أنا عقار", phone: null, email: null, avatar: "/icons/avatar.svg" }
      },
      {
        id: "102",
        title: "فيلا شاطئية مستقلة مع واجهة مائية في نخلة جميرا",
        priceAED: 18500000,
        dealType: "sale",
        isGolden: true,
        roiPercent: "9.2%",
        bedrooms: 6,
        bathrooms: 7,
        area_m2: 650,
        isVerified: false,
        has3DTour: false,
        propertyType: "فيلا مستقلة",
        image: "https://images.unsplash.com/photo-1613977257363-707ba9348227?q=80&w=800",
        images: [
          "https://images.unsplash.com/photo-1613977257363-707ba9348227?q=80&w=1200",
          "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=600",
          "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?q=80&w=600"
        ],
        commission: "2.0%",
        broker: { brokerId: "b2", name: "سارة الفلاسي", agency: "أنا عقار", phone: null, email: null, avatar: "/icons/avatar.svg" }
      },
      {
        id: "103",
        title: "شقة مودرن مفروشة بالكامل للإيجار السنوي - دبي مارينا",
        priceAED: 120000,
        dealType: "rent",
        isGolden: false,
        roiPercent: "6.0%",
        bedrooms: 2,
        bathrooms: 2,
        area_m2: 130,
        isVerified: false,
        has3DTour: false,
        propertyType: "شقة سكنية",
        image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=800",
        images: [
          "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1200",
          "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=600"
        ],
        commission: "5%",
        broker: { brokerId: "b3", name: "مازن الخالدي", agency: "أنا عقار", phone: null, email: null, avatar: "/icons/avatar.svg" }
      }
    ];

    function toggleCustomCountryMenu(e) {
      if (e) e.stopPropagation();
      const menu = document.getElementById('customCountryList');
      menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }

    function selectCustomCountry(key, name, flagUrl) {
      document.getElementById('selectedCountryLabel').innerHTML = `<img src="${flagUrl}" class="flag-img" alt="${name}"> ${name}`;
      document.getElementById('customCountryList').style.display = 'none';
      updateCitiesAndBackground(key);
      // تُقرأ من brokers-directory.html و broker-registration.html ليعرضا دولة الزائر
      // المختارة تلقائياً دون الحاجة لمبدّل دولة منفصل داخل تلك الصفحات
      localStorage.setItem('anaaqar_selected_country', key);
    }

    function switchAuthTab(type) {
      const loginForm = document.getElementById('loginAuthForm');
      const registerForm = document.getElementById('registerAuthForm');
      const btnLogin = document.getElementById('tabLogin');
      const btnRegister = document.getElementById('tabRegister');

      if (type === 'login') {
        loginForm.style.display = 'block'; registerForm.style.display = 'none';
        btnLogin.classList.add('active'); btnRegister.classList.remove('active');
      } else {
        loginForm.style.display = 'none'; registerForm.style.display = 'block';
        btnRegister.classList.add('active'); btnLogin.classList.remove('active');
      }
    }

    function showAuthError(message) {
      const el = document.getElementById('authErrorMsg');
      el.innerHTML = '';
      el.innerText = message;
      el.style.display = 'block';
    }

    // نفس بنر الخطأ، لكن مع رابط "إعادة إرسال رابط التأكيد" - لحالة البريد غير المؤكَّد تحديداً
    function showAuthErrorWithResend(message, email) {
      const el = document.getElementById('authErrorMsg');
      el.innerHTML = `${message} <button type="button" class="auth-resend-link" style="margin-top:4px; display:block; font-size:12px;" onclick="resendConfirmationEmail('${email.replace(/'/g, "\\'")}')">إعادة إرسال رابط التأكيد</button>`;
      el.style.display = 'block';
    }

    function hideAuthError() {
      const el = document.getElementById('authErrorMsg');
      el.style.display = 'none';
      el.innerHTML = '';
    }

    // 🔔 إشعار عصري أعلى الصفحة يحل محل alert() الافتراضي للمتصفح
    function showAnaAqarToast(message, type = 'success', duration = 4000) {
      const container = document.getElementById('anaaqarToastContainer');
      if (!container) { return; }
      const icons = { success: 'fa-circle-check', info: 'fa-circle-info', error: 'fa-triangle-exclamation' };
      const toast = document.createElement('div');
      toast.className = `anaaqar-toast anaaqar-toast-${type}`;
      toast.innerHTML = `<i class="fas ${icons[type] || icons.success}"></i><span>${message}</span>`;
      container.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add('show'));
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }

    let pendingConfirmEmail = '';

    // يُظهر لوحة "تحقق من بريدك" بدل نموذج التسجيل (بدل alert() قديم)
    function showAuthConfirmPanel(email, title) {
      pendingConfirmEmail = email;
      document.getElementById('authConfirmEmailText').innerText = email;
      document.getElementById('authConfirmTitle').innerText = title || 'تم إنشاء حسابك بنجاح 🎉';
      document.getElementById('authOtpInput').value = '';
      document.getElementById('authOtpError').style.display = 'none';
      hideAuthError();
      document.getElementById('registerAuthForm').style.display = 'none';
      document.getElementById('loginAuthForm').style.display = 'none';
      document.querySelector('.auth-tabs').style.display = 'none';
      document.getElementById('authCancelBtn').style.display = 'none';
      document.getElementById('authConfirmPanel').style.display = 'block';
      setTimeout(() => document.getElementById('authOtpInput').focus(), 50);
    }

    // ✅ تأكيد الحساب برمز البريد (بدل الرابط) ثم الدخول مباشرة
    async function confirmSignupOtp() {
      const token = (document.getElementById('authOtpInput').value || '').replace(/\D/g, '');
      const errEl = document.getElementById('authOtpError');
      errEl.style.display = 'none';
      if (token.length < 6) { errEl.innerText = 'اكتب الرمز كاملًا كما وصلك في البريد.'; errEl.style.display = 'block'; return; }
      const btn = document.getElementById('authOtpSubmitBtn');
      btn.disabled = true; btn.innerText = 'جاري التأكيد...';
      let { error } = await supabaseClient.auth.verifyOtp({ email: pendingConfirmEmail, token, type: 'signup' });
      if (error) ({ error } = await supabaseClient.auth.verifyOtp({ email: pendingConfirmEmail, token, type: 'email' }));
      btn.disabled = false; btn.innerText = 'تأكيد الحساب والدخول';
      if (error) {
        errEl.innerText = 'الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزًا جديدًا ثم حاول مرة أخرى.';
        errEl.style.display = 'block';
        return;
      }
      document.getElementById('authConfirmPanel').style.display = 'none';
      document.querySelector('.auth-tabs').style.display = 'flex';
      document.getElementById('authCancelBtn').style.display = 'block';
      switchAuthTab('login');
      closeRoyalModal('loginModal');
      await refreshAnaAqarAuthUI();
      showAnaAqarToast('🎉 تم تأكيد حسابك وتسجيل دخولك بنجاح!', 'success');
    }

    function closeAuthConfirmPanel() {
      document.getElementById('authConfirmPanel').style.display = 'none';
      document.querySelector('.auth-tabs').style.display = 'flex';
      document.getElementById('authCancelBtn').style.display = 'block';
      closeRoyalModal('loginModal');
      switchAuthTab('login');
    }

    async function resendConfirmationEmail(email) {
      const targetEmail = email || pendingConfirmEmail || document.getElementById('loginEmailInput').value.trim();
      if (!targetEmail) return;
      const { error } = await supabaseClient.auth.resend({ type: 'signup', email: targetEmail });
      if (error) {
        showAnaAqarToast('انتظر دقيقة ثم أعد المحاولة لإرسال رمز جديد.', 'error');
        return;
      }
      showAnaAqarToast('أرسلنا رمز تأكيد جديدًا إلى بريدك.', 'info');
    }

    async function handleAnaAqarLogin() {
      const email = document.getElementById('loginEmailInput').value.trim();
      const password = document.getElementById('loginPasswordInput').value;
      if (!email || !password) { showAuthError('يرجى تعبئة البريد الإلكتروني وكلمة المرور.'); return; }

      const btn = document.getElementById('loginSubmitBtn');
      btn.disabled = true; btn.innerText = 'جاري تسجيل الدخول...';
      hideAuthError();

      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

      btn.disabled = false; btn.innerText = 'تسجيل الدخول';

      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (error.code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
          // بريد غير مؤكد: نفتح خانة الرمز مباشرة. الرمز السابق (إن وصل) يبقى صالحًا لفترة،
          // ويمكن طلب رمز جديد من زر "إعادة الإرسال".
          showAuthConfirmPanel(email, 'أكّد بريدك الإلكتروني أولًا ✉️');
        } else {
          showAuthError('فشل تسجيل الدخول: تأكد من البريد وكلمة المرور.');
        }
        return;
      }

      closeRoyalModal('loginModal');
      await refreshAnaAqarAuthUI();
      showAnaAqarToast('تم تسجيل الدخول بنجاح، أهلاً بعودتك!', 'success');
      aqReturnAfterLogin();
    }

    document.addEventListener('DOMContentLoaded', () => { const w = document.getElementById('registerConsentWrap'); if (w && window.aqConsentBox) w.innerHTML = aqConsentBox('regTerms'); });
    // بعد الدخول: الرجوع للصفحة التي طلب منها الزائر إظهار رقم المعلن، وإظهار الأرقام في الصفحة الحالية
    function aqReturnAfterLogin() {
      let back = null; try { back = sessionStorage.getItem('aq_after_login'); sessionStorage.removeItem('aq_after_login'); } catch (e) {}
      if (back && back.split('#')[0] !== location.href.split('#')[0]) { location.href = back; return; }
      setTimeout(() => location.reload(), 900);
    }
    // رابط /index.html#join يفتح نافذة إنشاء الحساب مباشرة
    window.addEventListener('load', () => { if (location.hash === '#join' || location.hash === '#login') { setTimeout(() => { try { openLoginModal(); switchAuthTab(location.hash === '#join' ? 'register' : 'login'); } catch (e) {} }, 400); } });
    async function handleAnaAqarRegister() {
      const fullName = document.getElementById('registerNameInput').value.trim();
      const email = document.getElementById('registerEmailInput').value.trim();
      const phone = document.getElementById('registerPhoneInput').value.trim();
      const password = document.getElementById('registerPasswordInput').value;

      if (!fullName || !email || !phone || !password) { showAuthError('يرجى تعبئة كل الحقول.'); return; }
      if (password.length < 6) { showAuthError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.'); return; }
      if (window.aqConsentOk && !aqConsentOk('regTerms')) { showAuthError('يرجى الموافقة على الشروط وسياسة الخصوصية لإنشاء الحساب.'); return; }
      const consent = window.aqConsentAccepted ? aqConsentAccepted() : {};

      const btn = document.getElementById('registerSubmitBtn');
      btn.disabled = true; btn.innerText = 'جاري إنشاء الحساب...';
      hideAuthError();

      // الاسم/الهاتف يُرسلان كـ user_metadata فيقرأهما trigger قاعدة البيانات وينشئ صف
      // profiles تلقائياً (حتى قبل تأكيد البريد، حيث لا توجد جلسة بعد لإدخاله من المتصفح مباشرة)
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, phone, ...consent } }
      });

      btn.disabled = false; btn.innerText = 'إنشاء الحساب الآن';

      if (error) {
        showAuthError('تعذر إنشاء الحساب: ' + (error.message.includes('already') ? 'هذا البريد مسجّل مسبقاً.' : error.message));
        return;
      }

      if (data.session) {
        // تأكيد البريد معطّل في إعدادات المشروع: المستخدم مسجّل دخوله فوراً
        closeRoyalModal('loginModal');
        await refreshAnaAqarAuthUI();
        showAnaAqarToast('🎉 تم إنشاء حسابك وتسجيل الدخول بنجاح!', 'success');
        aqReturnAfterLogin();
      } else {
        // تأكيد البريد مفعّل: لا توجد جلسة بعد - نوضح للمستخدم الخطوة التالية بدل الإيحاء بنجاح فوري
        showAuthConfirmPanel(email);
      }
    }

    async function refreshAnaAqarAuthUI() {
      const profile = await getCurrentAnaAqarProfile();
      document.querySelectorAll('.anaaqar-auth-link').forEach(el => {
        if (profile) {
          el.innerHTML = `<i class="fas fa-user-check"></i> مرحباً، ${aqEscHtml((profile.full_name || '').split(' ')[0])} (خروج)`;
          el.onclick = () => anaaqarSignOut();
        } else {
          el.innerHTML = `<i class="fas fa-user-lock"></i> تسجيل الدخول أو إنشاء حساب`;
          el.onclick = () => openLoginModal();
        }
      });
    }

    function switchRoyalTab(el) {
      document.querySelectorAll('.royal-tab').forEach(tab => tab.classList.remove('active'));
      el.classList.add('active');
      currentTabType = el.getAttribute('data-type');
      updateSearchFieldsForTab(currentTabType);
    }

    // 🔄 تبديل حقول البحث حسب التبويب المختار: كل نية بحث (شراء/إيجار/استثمار) لها الحقول الأنسب لها
    function updateSearchFieldsForTab(type) {
      document.querySelectorAll('.dynamic-field').forEach(field => {
        const spec = field.getAttribute('data-tabs');
        const show = spec.charAt(0) === '!' ? !spec.slice(1).split(',').includes(type) : spec.split(',').includes(type);
        field.style.display = show ? '' : 'none';
      });
      const btn = document.getElementById('mainSearchBtn');
      if (btn) btn.innerHTML = type === 'services' ? '<i class="fas fa-search"></i> ابحث عن الخدمة' : '<i class="fas fa-search"></i> ابحث عن العقارات الآن';
      if (type === 'services') aqFillServiceCats();
    }

    document.addEventListener('DOMContentLoaded', () => {
      ['searchInput', 'minPriceInput', 'maxPriceInput', 'svcQ'].forEach((id) => { const el = document.getElementById(id); if (el) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); executeSearch(); } }); });
      const ci = document.getElementById('citySelector'); if (ci) ci.addEventListener('change', () => setTimeout(aqPruneLandmarks, 0));
    });
    function scrollRoyalTabs(direction) {
      const el = document.getElementById('royalTabsBar');
      if (el) el.scrollBy({ left: direction * 140, behavior: 'smooth' });
    }

    function triggerGoldenPassportFilter() {
      const goldenTab = document.querySelector('.royal-tab[data-type="golden"]');
      if (goldenTab) switchRoyalTab(goldenTab);
    }

    function markPropertyAsVisited(propId) {
      if (!visitedProperties.includes(propId.toString())) {
        visitedProperties.push(propId.toString());
        localStorage.setItem('anaaqar_visited', JSON.stringify(visitedProperties));
      }
      window.location.href = `property-details.html?id=${propId}`;
    }

    async function toggleFavorite(propId, event) {
      if (event) event.stopPropagation();
      const idStr = propId.toString();
      const index = favoriteProperties.indexOf(idStr);
      const willBeFav = index === -1;
      if (willBeFav) {
        favoriteProperties.push(idStr);
      } else {
        favoriteProperties.splice(index, 1);
      }
      localStorage.setItem('anaaqar_favorites', JSON.stringify(favoriteProperties));
      updateFavBadgeCount();
      document.querySelectorAll(`.btn-card-fav[onclick*="'${idStr}'"]`).forEach(btn => {
        btn.classList.toggle('active', favoriteProperties.includes(idStr));
      });
      if (document.getElementById('favoritesModal').style.display === 'flex') {
        renderFavoritesModalList();
      }
      // 🔄 مزامنة مع الحساب إن كان المستخدم مسجّل دخوله (صامتة، لا توقف الواجهة)
      try {
        if (willBeFav) await addSupabaseFavorite(idStr);
        else await removeSupabaseFavorite(idStr);
      } catch (e) {}
    }

    // 🔄 عند فتح الصفحة: لو المستخدم مسجّل دخوله، نجلب مفضلته من حسابه (تعمل على أي جهاز)
    // وندمجها مع أي مفضلة محلية سابقة (وندفعها للحساب كترحيل لمرة واحدة)
    async function syncFavoritesWithAccount() {
      const remoteIds = await fetchSupabaseFavoriteIds();
      if (remoteIds === null) return; // غير مسجل دخول: يبقى يعمل محلياً فقط
      const localOnly = favoriteProperties.filter(id => !remoteIds.includes(id));
      for (const id of localOnly) { try { await addSupabaseFavorite(id); } catch (e) {} }
      favoriteProperties = Array.from(new Set([...remoteIds, ...favoriteProperties]));
      localStorage.setItem('anaaqar_favorites', JSON.stringify(favoriteProperties));
      updateFavBadgeCount();
      document.querySelectorAll('.btn-card-fav[onclick*="toggleFavorite"]').forEach(btn => {
        const match = btn.getAttribute('onclick').match(/toggleFavorite\('([^']+)'/);
        if (match) btn.classList.toggle('active', favoriteProperties.includes(match[1]));
      });
    }

    function updateFavBadgeCount() {
      document.getElementById('favBadge').innerText = favoriteProperties.length;
    }

    function renderFavoritesModalList() {
      const container = document.getElementById('favoritesListContainer');
      const allProps = getAllProperties();
      const favProps = favoriteProperties
        .map(id => allProps.find(p => p.id.toString() === id))
        .filter(Boolean);

      if (favProps.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#94a3b8; padding: 20px 0;">لم تُضِف أي عقار إلى المفضلة بعد. اضغط على أيقونة القلب ❤️ في أي عقار لإضافته هنا.</p>`;
        return;
      }

      container.innerHTML = favProps.map(prop => `
        <div style="display:flex; align-items:center; gap:10px; padding:10px; border-bottom:1px solid #f1f5f9;">
          <img src="${prop.image || (prop.imagesList && prop.imagesList[0]) || ''}" style="width:60px; height:60px; object-fit:cover; border-radius:8px; flex-shrink:0;" alt="${prop.title}">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:bold; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${prop.title}</div>
            <div style="font-size:12px; color:var(--primary-turquoise); font-weight:bold;">${formatPriceAED(prop.priceAED || prop.price || 0)}</div>
          </div>
          <button onclick="closeRoyalModal('favoritesModal'); goToPropertyDetails('${prop.id}')" style="background:var(--primary-turquoise); color:white; border:none; border-radius:6px; padding:6px 10px; font-size:11px; cursor:pointer; white-space:nowrap;">التفاصيل</button>
          <button onclick="toggleFavorite('${prop.id}')" style="background:#fee2e2; color:#dc2626; border:none; border-radius:6px; padding:6px 8px; font-size:11px; cursor:pointer;"><i class="fas fa-trash"></i></button>
        </div>
      `).join('');
    }

    function openFavoritesModal() {
      renderFavoritesModalList();
      document.getElementById('favoritesModal').style.display = 'flex';
    }

    // 🆚 مقارنة العقارات: حتى 4 عقارات جنب بعض (سعر، غرف، حمامات، مساحة، نوع، مدينة)
    const MAX_COMPARE = 4;
    function toggleCompare(propId, event) {
      if (event) event.stopPropagation();
      const idStr = propId.toString();
      const index = compareProperties.indexOf(idStr);
      if (index === -1) {
        if (compareProperties.length >= MAX_COMPARE) {
          showAnaAqarToast(`يمكنك مقارنة ${MAX_COMPARE} عقارات كحد أقصى في المرة الواحدة`, 'info');
          return;
        }
        compareProperties.push(idStr);
      } else {
        compareProperties.splice(index, 1);
      }
      localStorage.setItem('anaaqar_compare', JSON.stringify(compareProperties));
      updateCompareBadge();
      document.querySelectorAll(`.btn-card-fav[onclick*="toggleCompare('${idStr}'"]`).forEach(btn => {
        btn.classList.toggle('active', compareProperties.includes(idStr));
      });
      if (document.getElementById('compareModal').style.display === 'flex') renderCompareTable();
    }

    function updateCompareBadge() {
      const bar = document.getElementById('compareFloatingBar');
      document.getElementById('compareCount').innerText = compareProperties.length;
      bar.style.display = compareProperties.length > 0 ? 'flex' : 'none';
    }

    function clearCompareList() {
      compareProperties = [];
      localStorage.setItem('anaaqar_compare', JSON.stringify(compareProperties));
      updateCompareBadge();
      document.querySelectorAll('.btn-card-fav[onclick*="toggleCompare"]').forEach(btn => btn.classList.remove('active'));
    }

    function renderCompareTable() {
      const container = document.getElementById('compareTableContainer');
      const allProps = getAllProperties();
      const props = compareProperties.map(id => allProps.find(p => p.id.toString() === id)).filter(Boolean);

      if (props.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#94a3b8; padding:20px 0;">لم تضف أي عقار للمقارنة بعد. اضغط أيقونة <i class="fas fa-code-compare"></i> على أي عقار لإضافته.</p>`;
        return;
      }

      const rows = [
        { label: 'الصورة', render: p => `<img src="${p.image || (p.imagesList && p.imagesList[0]) || ''}" style="width:100%; height:90px; object-fit:cover; border-radius:8px;" alt="${p.title}">` },
        { label: 'العنوان', render: p => `<span style="font-weight:800; font-size:12px;">${p.title || '-'}</span>` },
        { label: 'السعر', render: p => `<span style="color:var(--primary-turquoise); font-weight:900;">${formatPriceAED(p.priceAED || p.price || 0)}</span>` },
        { label: 'المدينة', render: p => p.city || '-' },
        { label: 'النوع', render: p => p.propertyType || '-' },
        { label: 'غرف النوم', render: p => (p.bedrooms === 0) ? 'استوديو' : (p.bedrooms ?? '-') },
        { label: 'الحمامات', render: p => p.bathrooms ?? '-' },
        { label: 'المساحة', render: p => p.area_m2 ? `${p.area_m2} م²` : '-' },
        { label: 'العمولة', render: p => p.commission || '-' },
        { label: '', render: p => `<button onclick="closeRoyalModal('compareModal'); goToPropertyDetails('${p.id}')" style="background:var(--primary-turquoise); color:white; border:none; border-radius:6px; padding:6px 10px; font-size:11px; cursor:pointer; width:100%;">التفاصيل</button>` }
      ];

      container.innerHTML = `
        <table style="width:100%; border-collapse:collapse; min-width:${props.length * 160}px;">
          ${rows.map(row => `
            <tr style="border-bottom:1px solid var(--dubizzle-border);">
              <td style="padding:8px; font-weight:800; font-size:12px; color:var(--text-muted); white-space:nowrap;">${row.label}</td>
              ${props.map(p => `<td style="padding:8px; text-align:center; vertical-align:middle;">${row.render(p)}</td>`).join('')}
            </tr>
          `).join('')}
        </table>
      `;
    }

    function openCompareModal() {
      renderCompareTable();
      document.getElementById('compareModal').style.display = 'flex';
    }

    // مشاركة العقار مباشرة (واتساب أو تطبيقات المشاركة في الجوال)
    function openAffiliateModal(propId) {
      const p = getAllProperties().find(x => String(x.id) === String(propId));
      const url = 'https://anaaqar.com/property-details.html?id=' + encodeURIComponent(propId);
      const title = p ? `${p.title} — ${formatPriceAED(p.priceAED)} | أنا عقار` : 'عقار على أنا عقار';
      if (window.AQAds && AQAds.share) return AQAds.share({ url, title });
      if (navigator.share) navigator.share({ title, url }).catch(() => {});
    }


    function openBrokerCallModal(brokerName, phoneNum) {
      activeCallPhone = phoneNum || "";
      document.getElementById('modalBrokerTitle').innerText = `التواصل مع ${brokerName || 'الوسيط'}`;
      document.getElementById('modalBrokerPhoneNum').innerText = activeCallPhone;
      document.getElementById('modalDirectCallLink').href = `tel:${activeCallPhone}`;
      document.getElementById('phoneCallModal').style.display = 'flex';
    }

    function copyPhoneNumToClipboard() {
      navigator.clipboard.writeText(activeCallPhone);
      alert('🎉 تم نسخ رقم الهاتف بنجاح!');
    }

    function showServiceModal(type) {
      const modal = document.getElementById('serviceModal');
      const title = document.getElementById('serviceModalTitle');
      const content = document.getElementById('serviceModalContent');

      if (type === 'market') {
        title.innerText = "تقرير مؤشرات السوق";
        content.innerText = "تحليل حقيقي لأسعار المتر وعائد الاستثمار (ROI).";
      } else if (type === 'guides') {
        title.innerText = "المرشدون العقاريون";
        content.innerText = "تواصل مع نخبة الخبراء المعتمدين للاستشارات العقارية.";
      } else if (type === 'plans') {
        title.innerText = "مخططات الطوابق 3D";
        content.innerText = "جولة افتراضية ثلاثية الأبعاد تفاعلية لمساحات العقار.";
      }

      modal.style.display = 'flex';
    }

    function updateBrandNameForLanguage(langCode) {
      const brandEl = document.getElementById('brandNameText');
      if (brandEl) brandEl.innerText = (langCode === 'ar') ? 'أنا عقار' : 'AnaAqar';
    }

    function applyAILanguage(langCode, langName, dir) {
      localStorage.setItem('anaaqar_lang_code', langCode);
      localStorage.setItem('anaaqar_lang_name', langName);
      localStorage.setItem('anaaqar_lang_dir', dir);

      const btnLabel = document.getElementById('currentLang');
      if (btnLabel) btnLabel.innerText = langName;
      document.documentElement.setAttribute('dir', dir);
      updateBrandNameForLanguage(langCode);

      document.cookie = "googtrans=/ar/" + langCode + "; path=/; SameSite=Lax";
      document.cookie = "googtrans=/ar/" + langCode + "; path=/; domain=" + window.location.hostname + "; SameSite=Lax";

      const translateCombo = document.querySelector('.goog-te-combo');
      if (translateCombo) {
        translateCombo.value = langCode;
        translateCombo.dispatchEvent(new Event('change'));
      } else {
        window.location.hash = '#googtrans(ar|' + langCode + ')';
        window.location.reload();
      }
    }

    function restoreSavedLanguageLabel() {
      const savedCode = localStorage.getItem('anaaqar_lang_code');
      const savedName = localStorage.getItem('anaaqar_lang_name');
      const savedDir = localStorage.getItem('anaaqar_lang_dir');
      if (savedName) {
        const btnLabel = document.getElementById('currentLang');
        if (btnLabel) btnLabel.innerText = savedName;
      }
      if (savedDir) {
        document.documentElement.setAttribute('dir', savedDir);
      }
      updateBrandNameForLanguage(savedCode || 'ar');
    }

    const countryData = {
      'uae': { bg: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fm=webp&q=60&w=1200', cities: ['دبي', 'أبوظبي', 'الشارقة', 'عجمان'] },
      'saudi': { bg: 'https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?auto=format&fm=webp&q=60&w=1200', cities: ['مكة المكرمة', 'المدينة المنورة', 'الرياض', 'جدة', 'الخبر'] },
      'egypt': { bg: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fm=webp&q=60&w=1200', cities: ['القاهرة الجديدة', 'العاصمة الإدارية', 'الشيخ زايد'] },
      'turkey': { bg: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fm=webp&q=60&w=1200', cities: ['إسطنبول', 'أنطاليا', 'بورصة'] },
      'qatar': { bg: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fm=webp&q=60&w=1200', cities: ['الدوحة', 'اللؤلؤة', 'لوسيل'] },
      'oman': { bg: 'https://images.unsplash.com/photo-1590077428593-a55bb07c4665?auto=format&fm=webp&q=60&w=1200', cities: ['مسقط', 'صلالة'] },
      'uk': { bg: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fm=webp&q=60&w=1200', cities: ['لندن', 'مانشستر'] },
      'usa': { bg: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fm=webp&q=60&w=1200', cities: ['نيويورك', 'ميامي'] },
      'france': { bg: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fm=webp&q=60&w=1200', cities: ['باريس', 'كان'] },
      'spain': { bg: 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?auto=format&fm=webp&q=60&w=1200', cities: ['مدريد', 'برشلونة'] },
      'cyprus': { bg: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fm=webp&q=60&w=1200', cities: ['ليماسول', 'لارنكا'] },
      'greece': { bg: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fm=webp&q=60&w=1200', cities: ['أثينا', 'سانتوريني'] }
    };

    function updateCitiesAndBackground(countryKey) {
      const citySelect = document.getElementById('citySelector');
      const hero = document.getElementById('heroSection');
      const data = countryData[countryKey] || { bg: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fm=webp&q=60&w=1200', cities: ['المدينة الرئيسية'] };

      citySelect.innerHTML = '<option value="all">كل المدن</option>';
      let cities = data.cities.slice();
      window.aqCountryKey = countryKey;
      if (countryKey === 'uae' && getAllProperties().length) { try { const seen = {}; getAllProperties().forEach((p) => { const c = (p.city || '').trim(); if (c) seen[c] = (seen[c] || 0) + 1; }); ['دبي', 'أبوظبي', 'الشارقة', 'عجمان', 'رأس الخيمة', 'الفجيرة', 'أم القيوين', 'العين'].forEach((c) => { if (seen[c] && !cities.includes(c)) cities.push(c); }); cities = cities.filter((c) => seen[c]); } catch (e) {} }
      cities.forEach(city => {
        citySelect.innerHTML += `<option value="${city}">${city}</option>`;
      });
      const bgImg = document.getElementById('heroBg');
      const base = String(data.bg).replace(/\?.*$/, '') + '?auto=format&fm=webp';
      if (bgImg && bgImg.dataset.base !== base && !(countryKey === 'uae' && !bgImg.dataset.base)) {
        bgImg.dataset.base = base;
        bgImg.srcset = base + '&q=60&w=900 900w, ' + base + '&q=65&w=1600 1600w';
        bgImg.src = base + '&q=60&w=900';
      } else if (bgImg && !bgImg.dataset.base) bgImg.dataset.base = base;
      updateLandmarksByCity(citySelect.value);
    }

    function updateLandmarksByCity(selectedCity) {
      const landmarkSelect = document.getElementById('landmarkSelector');
      let optionsHTML = `<option value="">اختر المعلم القريب...</option>`;

      if (selectedCity === 'مكة المكرمة') {
        optionsHTML += `<option value="makkah_haram" selected>🕋 قريب من الحرم المكي الشريف</option>`;
      } else if (selectedCity === 'المدينة المنورة') {
        optionsHTML += `<option value="madinah_haram" selected>🕌 قريب من الحرم النبوي الشريف</option>`;
      }

      optionsHTML += `
        <option value="mosque">🕌 قريب من مسجد</option>
        <option value="church">⛪ قريب من كنيسة</option>
        <option value="school">🏫 قريب من مدرسة</option>
        <option value="hospital">🏥 قريب من مستشفى</option>
        <option value="mall">🛒 قريب من مول تجاري</option>
        <option value="supermarket">🥦 قريب من سوبرماركت</option>
        <option value="gym">🏋️ قريب من نادي رياضي</option>
        <option value="park">🌳 قريب من حديقة عائلية</option>
        <option value="pharmacy">💊 قريب من صيدلية</option>
        <option value="clinic">🩺 قريب من مستوصف طبي</option>
        <option value="beach">🏖️ قريب من شاطئ البحر</option>
        <option value="airport">✈️ قريب من المطار</option>
        <option value="metro">🚇 قريب من محطة مترو</option>
      `;
      landmarkSelect.innerHTML = optionsHTML;
      aqPruneLandmarks();
    }
    // لا نعرض في «قريب من» إلا المعالم التي لها عقارات فعلًا (مع العدد)، حتى لا يختار الزائر خيارًا بلا نتائج
    function aqPruneLandmarks() {
      const sel = document.getElementById('landmarkSelector'); if (!sel || !window.AQFilters) return;
      let all = []; try { all = getAllProperties(); } catch (e) {}
      if (!all.length) return;
      const city = (document.getElementById('citySelector') || {}).value;
      const inCity = all.filter((p) => !city || city === 'all' || (p.city || '').includes(city));
      const keep = sel.value;
      [...sel.options].forEach((o) => {
        if (!o.value) return;
        const n = inCity.filter((p) => { try { return AQFilters.nearMatch(p, o.value); } catch (e) { return false; } }).length;
        if (!n) { o.remove(); return; }
        o.textContent = o.textContent.replace(/\s*\(\d+\)$/, '') + ` (${n})`;
      });
      if (keep && [...sel.options].some((o) => o.value === keep)) sel.value = keep;
    }
    window.aqPruneLandmarks = aqPruneLandmarks;
    // أنواع الخدمات من دليل الخدمات نفسه
    function aqFillServiceCats() {
      const sel = document.getElementById('svcCat'); if (!sel || sel.options.length) return;
      const C = window.AQ_SERVICE_CATS || {};
      sel.innerHTML = Object.entries(C).map(([k, c]) => `<option value="${k}">${c.t}</option>`).join('');
      // عدد الشركات الفعلي في كل قسم وكل إمارة: نُخفي ما ليس فيه شركات
      const em = document.getElementById('svcEmirate');
      const fill = (rows) => {
        const by = {}; rows.forEach((r) => { (by[r.category] = by[r.category] || {})[r.emirate || ''] = ((by[r.category] || {})[r.emirate || ''] || 0) + 1; });
        [...sel.options].forEach((o) => { const n = Object.values(by[o.value] || {}).reduce((a, b) => a + b, 0); if (!n) o.remove(); else o.textContent = C[o.value].t + ` (${n})`; });
        const upd = () => {
          const m = by[sel.value] || {}, keep = em.value, tot = Object.values(m).reduce((a, b) => a + b, 0);
          em.innerHTML = `<option value="">كل الإمارات (${tot})</option>` + Object.entries(m).filter(([k]) => k).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<option value="${k}">${k} (${n})</option>`).join('');
          if ([...em.options].some((o) => o.value === keep)) em.value = keep;
        };
        sel.onchange = upd; upd();
      };
      try { if (typeof supabaseClient !== 'undefined') supabaseClient.from('service_providers').select('category,emirate').eq('is_active', true).limit(10000).then((r) => { if (r && r.data && r.data.length) fill(r.data); }); } catch (e) {}
    }
    // قائمة اقتراحات المناطق والمدن وأنواع العقار تحت خانة البحث
    function aqFillAreaList() {
      const dl = document.getElementById('aqAreaList'); if (!dl || dl.options.length) return;
      const names = new Set(['شقة', 'فيلا', 'استوديو', 'تاون هاوس', 'بنتهاوس', 'مكتب', 'محل تجاري', 'أرض', 'دبي', 'أبوظبي', 'الشارقة', 'عجمان', 'رأس الخيمة']);
      if (window.AQAreas) AQAreas.AREAS.forEach((a) => names.add(a.ar));
      dl.innerHTML = [...names].map((n) => `<option value="${n}"></option>`).join('');
    }

    function applyCurrency(code, symbol, rate) {
      setSelectedCurrency(code);
      document.getElementById('currentCurrency').innerText = `${code} (${symbol})`;
      document.getElementById('fastCurrencyList').style.display = 'none';
      fetchProperties();
    }

    function restoreSavedCurrencyLabel() {
      const { code, symbol } = getSelectedCurrency();
      const btnLabel = document.getElementById('currentCurrency');
      if (btnLabel) btnLabel.innerText = `${code} (${symbol})`;
    }

    // 🖼️ ينقل بطاقة العقار للصورة التالية/السابقة بسحب ناعم (السحب اليدوي بالإصبع يعمل تلقائياً عبر scroll-snap بدون أي كود إضافي)
    function navigateCardImage(propId, direction, event) {
      if (event) event.stopPropagation();
      const track = document.getElementById(`card-track-${propId}`);
      if (!track) return;
      const slides = track.querySelectorAll('.card-swipe-slide');
      if (slides.length <= 1) return;

      if (!(propId in propertyCardImageIndices)) propertyCardImageIndices[propId] = 0;
      let idx = propertyCardImageIndices[propId];
      idx = direction === 'next' ? (idx + 1) % slides.length : (idx - 1 + slides.length) % slides.length;
      propertyCardImageIndices[propId] = idx;
      { const r = slides[idx].getBoundingClientRect(), t = track.getBoundingClientRect(); track.scrollBy({ left: (r.left + r.width / 2) - (t.left + t.width / 2), behavior: 'smooth' }); }
    }

    /* 📌 دالة حفظ وتمرير بيانات العقار والوسيط بصفحة التفاصيل */
function goToPropertyDetails(propId) {
  const allProps = getAllProperties();
  const selectedProp = allProps.find(p => p.id.toString() === propId.toString()) || allProps[0];

  // حفظ بيانات العقار والوسيط بالذاكرة لصفحة التفاصيل
  localStorage.setItem('anaaqar_selected_property', JSON.stringify(selectedProp));
  window.location.href = `property-details.html?id=${propId}`;
}
function aqEscHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// تحديث عدّاد الصور (1/5) عند السحب داخل البطاقة
document.addEventListener('scroll', (ev) => {
  const t = ev.target;
  if (!t || !t.classList || !t.classList.contains('card-swipe-track')) return;
  const slides = t.children; if (!slides.length) return;
  const w = slides[0].getBoundingClientRect().width || 1;
  const idx = Math.min(slides.length - 1, Math.round(Math.abs(t.scrollLeft) / w));
  const el = document.getElementById('card-idx-' + t.dataset.pid);
  if (el) el.textContent = idx + 1;
  if (typeof propertyCardImageIndices !== 'undefined') propertyCardImageIndices[t.dataset.pid] = idx;
}, true);
// ترقيم الصفحات: 24 عقارًا في الصفحة (مثل Bayut)
let aqHomeList = [], aqHomePage = 1;
function renderPropertiesList(list) {
  aqHomeList = list || []; aqHomePage = 1;
  aqRenderHomePage();
}
function aqRenderHomePage() {
  const container = document.getElementById('properties-container');
  let pg = document.getElementById('aqHomePager');
  if (!pg) { pg = document.createElement('div'); pg.id = 'aqHomePager'; container.insertAdjacentElement('afterend', pg); }
  if (window.AQPager) AQPager.render(pg, aqHomeList.length, aqHomePage, (n) => { aqHomePage = n; aqRenderHomePage(); window.scrollTo({ top: container.getBoundingClientRect().top + scrollY - 110, behavior: 'smooth' }); });
  renderPropertiesPage(window.AQPager ? AQPager.slice(aqHomeList, aqHomePage) : aqHomeList.slice(0, 24));
}
function renderPropertiesPage(list) {
  const container = document.getElementById('properties-container');
  container.innerHTML = '';
  if (list && list.length > 0) {
    list.forEach((prop, index) => {
      const isVisited = visitedProperties.includes(prop.id.toString());
      const isFav = favoriteProperties.includes(prop.id.toString());
      const isCompared = compareProperties.includes(prop.id.toString());
      const displayPrice = formatPriceAED(prop.priceAED || prop.price || 0);

      const propertyImages = (prop.imagesList && prop.imagesList.length > 0) ? prop.imagesList
        : (prop.images && prop.images.length > 0) ? prop.images
        : [prop.image];
      localStorage.setItem(`anaaqar_prop_imgs_${prop.id}`, JSON.stringify(propertyImages));

      /* 📌 جلب ومطابقة بيانات الوسيط الخاصة بهذا العقار تحديداً */
      const brokerInfo = prop.broker || { 
        brokerId: "b1", 
        name: "معلن على أنا عقار", 
        agency: "أنا عقار", 
        phone: null, 
        email: null,
        avatar: "/icons/avatar.svg" 
      };

      // إعلانات المكاتب تفتح صفحة المكتب، ولا رابط لملف وسيط غير موجود
      const brokerProfileUrl = brokerInfo.agencySlug ? `agency.html?a=${encodeURIComponent(brokerInfo.agencySlug)}` : !brokerInfo.brokerId ? 'listings.html' : `broker-profile.html?id=${brokerInfo.brokerId}&name=${encodeURIComponent(brokerInfo.name)}&agency=${encodeURIComponent(brokerInfo.agency)}&phone=${brokerInfo.phone || ''}&avatar=${encodeURIComponent(brokerInfo.avatar)}`;

      const E = aqEscHtml;
      const pid = E(prop.id);
      const dealLabel = prop.dealType === 'rent' ? 'للإيجار' : 'للبيع';
      const placeLabel = prop.city || '';
      const specs = [
        prop.bedrooms !== undefined && prop.bedrooms !== null ? `<span class="aq-spec"><i class="fas fa-bed"></i> ${Number(prop.bedrooms) === 0 ? 'استوديو' : E(prop.bedrooms) + ' غرف'}</span>` : '',
        `<span class="aq-spec"><i class="fas fa-bath"></i> ${E(prop.bathrooms || 1)} حمام</span>`,
        prop.area_m2 ? `<span class="aq-spec"><i class="fas fa-ruler-combined"></i> ${E(prop.area_m2)} م²</span>` : ''
      ].join('');
      const cardHTML = `
        <div class="bayut-property-card aq-pcard ${isVisited ? 'visited-card' : ''}" id="card-${pid}">
          <div class="card-media-box">
            <div class="card-swipe-track" id="card-track-${pid}" data-pid="${pid}">
              ${propertyImages.map((imgUrl, i) => `
                <div class="card-swipe-slide" onclick="goToPropertyDetails('${pid}')">
                  <img src="${E(/^https:\/\/images\.unsplash\.com\//.test(imgUrl) ? imgUrl.replace(/\?.*$/, '') + '?auto=format&fm=webp&q=60&w=640' : imgUrl)}" alt="${E(prop.title)}" decoding="async" loading="lazy">
                </div>
              `).join('')}
            </div>
            <div class="aq-pc-tags">
              ${typeof aqIsNew === 'function' && aqIsNew(prop) ? '<span class="aq-pc-new">جديد</span>' : ''}<span class="aq-pc-deal ${prop.dealType === 'rent' ? 'rent' : ''}">${dealLabel}</span>
              ${prop.isVerified ? `<span class="aq-pc-ok" title="رخصة الوسيط موثّقة"><i class="fas fa-circle-check"></i> موثّق</span>` : ''}
              ${prop.noCommission ? `<span class="aq-pc-ok">بدون عمولة</span>` : ''}
            </div>
            ${propertyImages.length > 1 ? `
            <button class="card-img-arrow prev" aria-label="الصورة السابقة" onclick="navigateCardImage('${pid}', 'prev', event)"><i class="fas fa-chevron-right"></i></button>
            <button class="card-img-arrow next" aria-label="الصورة التالية" onclick="navigateCardImage('${pid}', 'next', event)"><i class="fas fa-chevron-left"></i></button>
            <span class="aq-pc-count"><i class="fas fa-camera"></i> <b id="card-idx-${pid}">1</b>/${propertyImages.length}</span>
            ` : ''}
            <button class="btn-card-fav ${isFav ? 'active' : ''}" aria-label="أضف للمفضلة" onclick="toggleFavorite('${pid}', event)"><i class="fas fa-heart"></i></button>
            <button class="btn-card-fav aq-pc-compare ${isCompared ? 'active' : ''}" title="أضف للمقارنة" aria-label="أضف للمقارنة" onclick="toggleCompare('${pid}', event)"><i class="fas fa-code-compare"></i></button>
          </div>

          <div class="card-info-content">
            <div class="card-top-details">
              <div class="aq-pc-pricerow">
                <div class="property-price-tag">${displayPrice}${prop.dealType === 'rent' ? '<small> / سنويًا</small>' : ''}</div>
                <span class="property-type-pill">${E(prop.propertyType || 'شقة سكنية')}</span>
              </div>
              <h3 class="property-title-heading" onclick="goToPropertyDetails('${pid}')">${E(prop.title)}</h3>
              ${placeLabel ? `<div class="aq-pc-loc"><i class="fas fa-location-dot"></i> ${E(placeLabel)}</div>` : ''}
              <div class="aq-pc-specs">${specs}</div>
              ${prop.hasOffer && prop.offerText ? `<div class="aq-pc-offer"><i class="fas fa-tag"></i> ${E(prop.offerText)}</div>` : ''}
            </div>

            <div class="card-broker-footer">
              <a href="${E(brokerProfileUrl)}" class="broker-mini-profile">
                <img src="${E(brokerInfo.avatar)}" class="broker-mini-avatar" alt="" onerror="this.style.visibility='hidden'">
                <div style="min-width:0">
                  <div class="broker-mini-name">${E(brokerInfo.name)}</div>
                  <div class="broker-mini-agency">${E(brokerInfo.agency)}</div>
                </div>
              </a>

              <div class="card-action-buttons aq-pc-actions">
                <button class="btn-card-cta btn-cta-share aq-icon-only" aria-label="مشاركة" title="مشاركة" onclick="openAffiliateModal('${pid}')"><i class="fas fa-share-nodes"></i></button>
                ${brokerInfo.phone ? `<button class="btn-card-cta btn-cta-call" onclick="openBrokerCallModal('${E(String(brokerInfo.name).replace(/'/g, ''))}', '${E(String(brokerInfo.phone).replace(/[^\d+]/g, ''))}')"><i class="fas fa-phone-alt"></i> اتصال</button>
                <a href="https://api.whatsapp.com/send?phone=${String(brokerInfo.phone).replace(/\D/g, '').replace(/^0/, '971')}" target="_blank" rel="noopener noreferrer" class="btn-card-cta btn-cta-whatsapp" aria-label="واتساب"><i class="fab fa-whatsapp"></i> واتساب</a>` : (brokerInfo.locked ? `<button class="btn-card-cta btn-cta-call" onclick="try{sessionStorage.setItem('aq_after_login', location.href)}catch(e){};openLoginModal();switchAuthTab('register')"><i class="fas fa-lock"></i> إظهار الرقم</button>` : '')}
                <a href="#" onclick="event.preventDefault();goToPropertyDetails('${pid}')" class="btn-card-cta btn-cta-view aq-pc-view">التفاصيل <i class="fas fa-arrow-left"></i></a>
              </div>
            </div>
          </div>
        </div>
      `;
      container.innerHTML += cardHTML;

      /* إدراج إعلان كل 5 عقارات */
      if ((index + 1) % 5 === 0) {
        container.innerHTML += `
          <div style="background: linear-gradient(135deg, #0f172a, #192038); color: white; padding: 18px; border-radius: 12px; border: 2px solid var(--accent-gold); text-align: center; margin: 10px 0;">
            <h3 style="font-size: 16px; color: var(--accent-gold); font-weight: 900;"><i class="fas fa-bullhorn"></i> لديك عقار للبيع أو الإيجار؟</h3>
            <p style="font-size: 12px; color: #e2e8f0; margin: 6px 0;">أضف إعلانك على أنا عقار ووصّله لآلاف الزوار.</p>
            <a href="add-property.html" style="display:inline-block; background: var(--accent-gold); color: #192038; font-weight: 900; border: none; padding: 8px 18px; border-radius: 6px; cursor: pointer; font-size: 12px; text-decoration:none;">أضف عقارك الآن ❯</a>
          </div>
        `;
      }
    });
  } else {
    container.innerHTML = `<div style="text-align: center; padding: 40px; font-weight: 800; color: #64748b;">لا توجد عقارات في هذا القسم حاليًا.<br><span style="font-weight:600; font-size:13px;">هل لديك عقار مناسب؟ <a href="add-property.html" style="color:var(--primary-turquoise);">أضفه الآن</a></span></div>`;
  }
}

    // 📦 مصدر واحد لكل العقارات: loadedScrapedList عند نجاح التحميل، وإلا rawPropertiesData كنسخة احتياطية (بدون تكرار)
    let demoListingsVisible = true;
    function getAllProperties() {
      if (!demoListingsVisible) return loadedScrapedList;
      return loadedScrapedList.length > 0 ? loadedScrapedList : rawPropertiesData;
    }

    // ملاحظة: mapSupabasePropertyToAnaAqar و fetchApprovedSupabaseProperties معرّفتان في supabase-client.js (مشتركتان مع باقي الصفحات)

    async function fetchProperties() {
      let jsonProperties = [];
      const supabaseProperties = await fetchApprovedSupabaseProperties();
      // العقارات التجريبية تُعرض فقط إلى أن يصل عدد العقارات الحقيقية المعتمدة إلى 50
      demoListingsVisible = supabaseProperties.length < AQ_DEMO_HIDE_AT;
      if (demoListingsVisible) {
        try {
          const response = await fetch('./properties.json?v=' + Date.now());
          jsonProperties = await response.json();
        } catch (err) {
          jsonProperties = [];
        }
      }
      loadedScrapedList = [...jsonProperties, ...supabaseProperties];
      // بعد وصول البيانات: المدن والمعالم والاقتراحات تُبنى من العقارات الموجودة فعلًا
      try { const cs = document.getElementById('citySelector'), keepCity = cs && cs.value; if (window.aqCountryKey === undefined || window.aqCountryKey === 'uae') updateCitiesAndBackground('uae'); if (cs && keepCity && [...cs.options].some((o) => o.value === keepCity)) cs.value = keepCity; aqFillAreaList(); aqPruneLandmarks(); } catch (e) {}

      if (!demoListingsVisible) {
        // عقارات حقيقية فقط: الأحدث أولاً
        renderPropertiesList(supabaseProperties);
      } else if (loadedScrapedList.length > 0) {
        // 🏠 واجهة الموقع الافتراضية تعرض فقط العقارات المميزة (featured)؛ باقي القائمة الكبيرة
        // (بما فيها عقارات الوسطاء الحقيقيين) تظهر فقط كنتائج بحث/فلترة عبر executeSearch().
        const featuredOnly = loadedScrapedList.filter(p => p.featured);
        renderPropertiesList(featuredOnly.length > 0 ? featuredOnly : rawPropertiesData);
      } else {
        renderPropertiesList(rawPropertiesData);
      }
    }

    function openAISearchModal() { document.getElementById('aiSearchModal').style.display = 'flex'; }

    function startVoiceRecognition() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("متصفحك لا يدعم خاصية التحدث الصوتي المباشر، يمكنك كتابة طلبك بالكلمات.");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA';
      const statusText = document.getElementById('voiceStatusText');
      const micIcon = document.getElementById('micIcon');

      statusText.innerText = "جاري الاستماع إليك... تحدث الآن";
      micIcon.style.color = "#e11d48";

      recognition.start();

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('aiPromptInput').value = transcript;
        statusText.innerText = "تم التقاط صوتك بنجاح! ✨";
        micIcon.style.color = "var(--primary-turquoise)";
      };

      recognition.onerror = () => {
        statusText.innerText = "تعذر التقط الصوت، أعد المحاولة.";
        micIcon.style.color = "var(--primary-turquoise)";
      };
    }

    /* 🤖 2. تفعيل دالة البحث بالذكاء الاصطناعي للتصفية المباشرة فوراً */
    // 🤖 البحث الذكي: يسأل المساعد العقاري (دالة ai-assistant)، وإن لم تتوفر يعود للبحث بالكلمات
    let aiHistory = [];
    try { aiHistory = JSON.parse(sessionStorage.getItem('aq_ai_hist') || '[]'); } catch (e) {}
    function showAIReply(text, projectIds, extra) {
      extra = extra || {};
      let box = document.getElementById('aiReplyBanner');
      const title = document.getElementById('resultsSectionTitle');
      if (!box && title) { box = document.createElement('div'); box.id = 'aiReplyBanner'; title.parentNode.insertBefore(box, title); }
      if (!box) return;
      const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      box.style.cssText = 'background:linear-gradient(135deg,#1e1b4b,#0b5e63);color:#fff;border-radius:16px;padding:14px 16px;margin:0 0 14px;display:flex;gap:12px;align-items:flex-start;line-height:1.8';
      box.innerHTML = `<i class="fas fa-robot" style="color:#c084fc;font-size:22px;margin-top:4px"></i><div style="flex:1;min-width:0"><b>مساعد أنا عقار</b><div style="white-space:pre-wrap">${esc(text)}</div>
        ${(extra.reasons || []).length ? `<div style="margin-top:8px;background:rgba(255,255,255,.08);border-radius:12px;padding:8px 10px"><b style="font-size:13px;color:#c4b5fd">لماذا اقترحت هذه العقارات؟</b>${extra.reasons.map((r) => `<a href="${r.url}" style="display:block;color:#fff;text-decoration:none;font-size:13.5px;margin-top:4px"><b>${esc(r.title)}</b> — <span style="opacity:.85">${esc(r.why)}</span></a>`).join('')}</div>` : ''}
        ${extra.ask ? `<div style="margin-top:10px;background:#fff;color:#1e1b4b;border-radius:12px;padding:10px"><b style="font-size:14px"><i class="fas fa-circle-question" style="color:#7c3aed"></i> ${esc(extra.ask)}</b><form id="aiAskForm" style="display:flex;gap:6px;margin-top:6px"><input id="aiAskInput" placeholder="اكتب إجابتك…" style="flex:1;min-width:0;border:1.5px solid #ddd6fe;border-radius:10px;padding:8px 10px;font-family:inherit;font-size:15px"><button style="background:#7c3aed;color:#fff;border:0;border-radius:10px;padding:8px 14px;font-weight:900;font-family:inherit;cursor:pointer">إرسال</button></form></div>` : ''}
        ${projectIds && projectIds.length ? `<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">${projectIds.map((id) => `<a href="project.html?id=${encodeURIComponent(id)}" style="background:#d4af37;color:#192038;border-radius:999px;padding:4px 12px;font-weight:900;text-decoration:none;font-size:13px"><i class="fas fa-city"></i> مشروع مقترح</a>`).join('')}</div>` : ''}
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button type="button" onclick="openAISearchModal()" style="background:#fff;color:#1e1b4b;border:0;border-radius:10px;padding:6px 12px;font-weight:900;cursor:pointer;font-family:inherit">اسأل سؤالًا آخر</button><button type="button" onclick="window.AQAI && AQAI.requestFromChat(aiHistory, currentTabType)" style="background:#d4af37;color:#192038;border:0;border-radius:10px;padding:6px 12px;font-weight:900;cursor:pointer;font-family:inherit"><i class="fas fa-paper-plane"></i> أرسل طلبي للوسطاء</button></div></div>
        <button type="button" aria-label="إغلاق" onclick="this.parentNode.remove()" style="background:none;border:0;color:#fff;font-size:18px;cursor:pointer">×</button>`;
      const af = document.getElementById('aiAskForm');
      if (af) af.onsubmit = (e) => { e.preventDefault(); const v = document.getElementById('aiAskInput').value.trim(); if (!v) return; const inp = document.getElementById('aiPromptInput'); if (inp) inp.value = v; executeAISearch(); };
    }
    async function executeAISearch() {
      const raw = (document.getElementById('aiPromptInput').value || '').trim();
      if (!raw) { showAnaAqarToast('اكتب أو قل مواصفات العقار الذي تبحث عنه أولًا', 'info'); return; }
      const status = document.getElementById('aiSearchStatus');
      if (status) status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> المساعد يبحث لك...';
      let ai = null;
      try {
        if (typeof supabaseClient !== 'undefined' && supabaseClient.functions) {
          const call = supabaseClient.functions.invoke('ai-assistant', { body: { message: raw, history: aiHistory.slice(-6) } });
          const timeout = new Promise((res) => setTimeout(() => res({ error: 'timeout' }), 20000));
          const r = await Promise.race([call, timeout]);
          if (!r.error && r.data && (r.data.reply || (r.data.ids || []).length)) ai = r.data;
        }
      } catch (e) {}
      if (status) status.textContent = '';
      if (!ai) return keywordAISearch(raw);
      aiHistory.push({ role: 'user', content: raw }, { role: 'assistant', content: (ai.reply || '') + (ai.ask ? '\n' + ai.ask : '') });
      aiHistory = aiHistory.slice(-8);
      try { sessionStorage.setItem('aq_ai_hist', JSON.stringify(aiHistory)); } catch (e) {}
      closeRoyalModal('aiSearchModal');
      const all = getAllProperties();
      const ids = ai.ids || [];
      const props = ids.filter((id) => !String(id).startsWith('project-')).map((id) => all.find((p) => String(p.id) === String(id))).filter(Boolean);
      const projects = ids.filter((id) => String(id).startsWith('project-')).map((id) => String(id).slice(8));
      if (props.length) {
        renderPropertiesList(props);
        document.getElementById('resultsSectionTitle').innerText = `🤖 اقتراحات المساعد الذكي (${props.length})`;
      }
      const why = ai.why || {};
      const reasons = props.filter((p) => why[p.id]).slice(0, 6).map((p) => ({ title: p.title, why: why[p.id], url: 'property-details.html?id=' + encodeURIComponent(p.id) }));
      showAIReply(ai.reply || 'هذه أقرب النتائج لطلبك.', projects, { reasons, ask: ai.ask || '' });
      const propSection = document.querySelector('.properties-section');
      if (propSection) propSection.scrollIntoView({ behavior: 'smooth' });
    }
    function keywordAISearch(raw) {
      const query = raw.toLowerCase();
      const allProps = getAllProperties();
      const filtered = allProps.filter(p => {
        const fullText = `${p.title} ${p.description || ''} ${p.propertyType || ''} ${p.dealType || ''}`.toLowerCase();
        const words = query.split(' ');
        return words.some(w => w.length > 2 && fullText.includes(w));
      });
      closeRoyalModal('aiSearchModal');
      if (filtered.length > 0) {
        renderPropertiesList(filtered);
        document.getElementById('resultsSectionTitle').innerText = `🔎 نتائج البحث الذكي عن: "${raw}" (${filtered.length} نتيجة)`;
      } else {
        renderPropertiesList(allProps);
        showAnaAqarToast('لم نجد تطابقًا دقيقًا، فعرضنا لك أحدث العقارات. يمكنك ترك طلبك في «اطلب عقارك».', 'info');
      }
      const propSection = document.querySelector('.properties-section');
      if (propSection) propSection.scrollIntoView({ behavior: 'smooth' });
    }

    // 📍 عقارات قريبة مني: يطلب موقع الجهاز، ويجلب العقارات الحقيقية (اللي عندها إحداثيات) ضمن 15 كم
    function searchPropertiesNearMe() {
      const btn = document.getElementById('nearMeBtn');
      if (!navigator.geolocation) {
        showAnaAqarToast('جهازك لا يدعم تحديد الموقع', 'error');
        return;
      }
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارِ تحديد موقعك...';
      btn.disabled = true;

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const results = await fetchNearbyProperties(pos.coords.latitude, pos.coords.longitude, 15);
          btn.innerHTML = originalHTML;
          btn.disabled = false;
          if (results.length === 0) {
            showAnaAqarToast('ما لقينا عقارات قريبة منك حالياً (ضمن 15 كم) — جرب توسيع نطاق البحث لاحقاً', 'info');
            return;
          }
          renderPropertiesList(results);
          showAnaAqarToast(`لقينا ${results.length} عقار قريب منك 📍`, 'success');
          const propSection = document.querySelector('.properties-section');
          if (propSection) propSection.scrollIntoView({ behavior: 'smooth' });
        },
        () => {
          btn.innerHTML = originalHTML;
          btn.disabled = false;
          showAnaAqarToast('تعذّر الوصول لموقعك — تأكد من منح إذن الموقع للمتصفح', 'error');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }

    // شرط البحث كاملًا من خانات البحث والفلاتر (يستعمله زر «الفلاتر» أيضًا ليعرض عدد النتائج قبل التطبيق)
    function aqBuildSearchPredicate() {
      const keyword = (document.getElementById('searchInput').value || '').trim().toLowerCase();
      const maxPrice = parseFloat(document.getElementById('maxPriceInput').value) || Infinity;
      const minPrice = parseFloat((document.getElementById('minPriceInput') || {}).value) || 0;
      const selectedCity = document.getElementById('citySelector').value;
      const minRoi = parseFloat(document.getElementById('minRoiInput').value) || 7.0;

      const landmark = (document.getElementById('landmarkSelector') || {}).value || '';
      return (p) => {
        let matchesTab = true;
        if (currentTabType === 'sale') matchesTab = (p.dealType === 'sale' || !p.dealType);
        else if (currentTabType === 'rent') matchesTab = (p.dealType === 'rent');
        else if (currentTabType === 'golden') matchesTab = (p.isGolden === true);
        else if (currentTabType === 'roi') matchesTab = (parseFloat(p.roiPercent || '0') >= minRoi);
        else if (currentTabType === 'residential') matchesTab = !isCommercialProperty(p);
        else if (currentTabType === 'commercial') matchesTab = isCommercialProperty(p);
        else if (['off_plan', 'under_construction', 'ready'].includes(currentTabType)) matchesTab = (p.completionStatus === currentTabType);
        else if (currentTabType === 'offers') matchesTab = (p.hasOffer === true);
        else if (currentTabType === 'no_commission') matchesTab = isNoCommissionProperty(p);

        const matchesKeyword = !keyword || aqKeywordMatch(p, keyword);
        const matchesPrice = (p.priceAED || p.price || 0) <= maxPrice && (p.priceAED || p.price || 0) >= minPrice;
        const matchesCity = !selectedCity || selectedCity === 'all' || (p.city && p.city.includes(selectedCity));
        const matchesFilters = !window.AQFilters || (window.AQFilters.match(p) && window.AQFilters.nearMatch(p, landmark));
        return matchesTab && matchesKeyword && matchesPrice && matchesCity && matchesFilters;
      };
    }
    window.aqBuildSearchPredicate = aqBuildSearchPredicate;
    const aqNorm = (t) => String(t || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[\u064B-\u0652\u0640]/g, '');
    let aqKwCache = { k: null };
    function aqKeywordMatch(p, keyword) {
      if (aqKwCache.k !== keyword) {
        const k = aqNorm(keyword).trim();
        // إن كانت الكلمة اسم منطقة (بأي صيغة) نبحث بكل أسمائها
        let groups = null;
        if (window.AQAreas) { const a = AQAreas.AREAS.find((x) => [x.ar, x.en].concat(x.words || []).some((w) => { const n = aqNorm(w); return n === k || (k.length > 3 && (n.includes(k) || k.includes(n))); })); if (a) groups = [[a.ar, a.en].concat(a.words || [], a.dld || []).map(aqNorm)]; }
        if (!groups) groups = k.split(/[\s،,]+/).filter((w) => w.length > 1 && !['في', 'من', 'على', 'او', 'مع'].includes(w)).map((w) => [w, w.replace(/^ال/, '')]);
        aqKwCache = { k: keyword, groups };
      }
      const t = aqNorm([p.title, p.description, p.city, p.area, p.location, p.propertyType].join(' '));
      return aqKwCache.groups.every((g) => g.some((w) => w && t.includes(w)));
    }
    function executeSearch(noScroll) {
      if (currentTabType === 'services') {
        const cat = (document.getElementById('svcCat') || {}).value || '';
        const e = (document.getElementById('svcEmirate') || {}).value || '', q = ((document.getElementById('svcQ') || {}).value || '').trim();
        location.href = 'services-directory.html?cat=' + encodeURIComponent(cat) + (e ? '&e=' + encodeURIComponent(e) : '') + (q ? '&q=' + encodeURIComponent(q) : '');
        return;
      }
      const mn = document.getElementById('minPriceInput'), mx = document.getElementById('maxPriceInput');
      if (mn && mx && +mn.value && +mx.value && +mn.value > +mx.value) { const t = mn.value; mn.value = mx.value; mx.value = t; }
      const allProps = getAllProperties();
      window.aqSearchPredicate = aqBuildSearchPredicate();
      let filtered = allProps.filter(window.aqSearchPredicate);
      // ترتيب النتائج (الأنسب لك، الأحدث، السعر، سعر المتر، المساحة) قبل اقتطاع أول 60
      if (window.AQAI && window.AQAI.sortList) { try { filtered = window.AQAI.sortList(filtered); } catch (e) {} }

      renderPropertiesList(filtered);
      if (!filtered.length) {
        const kw = (document.getElementById('searchInput').value || '').trim();
        const c = document.getElementById('properties-container');
        if (c) c.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px 16px;background:#fff;border:1px solid #e5e7eb;border-radius:18px">
          <div style="font-size:34px">🔎</div><h3 style="margin:8px 0;font-weight:900">لا توجد عقارات تطابق كل الشروط الآن</h3>
          <p style="color:#64748b;font-weight:700;margin:0 0 14px">جرّب تخفيف أحد الشروط، أو اترك طلبك ونرسله للوسطاء ليبحثوا لك.</p>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
            <button class="btn-royal-search" style="width:auto;padding:10px 18px" onclick="aqResetSearch()">مسح الشروط وعرض الكل</button>
            <a class="btn-royal-search" style="width:auto;padding:10px 18px;background:#192038;text-decoration:none" href="request.html">اطلب عقارك</a>
            ${kw ? `<a class="btn-royal-search" style="width:auto;padding:10px 18px;background:#0f766e;text-decoration:none" href="find.html?q=${encodeURIComponent(kw)}">ابحث عن «${kw.replace(/[<>&"]/g, '')}» في كل الموقع</a>` : ''}
          </div></div>`;
      }

      const titleEl = document.getElementById('resultsSectionTitle');
      if (currentTabType === 'all') titleEl.innerText = 'كل العقارات: للشراء والإيجار 🏙️';
      else if (currentTabType === 'sale') titleEl.innerText = 'عقارات مخصصة للشراء 🔑';
      else if (currentTabType === 'rent') titleEl.innerText = 'عقارات مخصصة للإيجار 🏢';
      else if (currentTabType === 'golden') titleEl.innerText = 'عقارات بقيمة تؤهّل للتقدّم للإقامة الذهبية (وفق شروط الجهات الرسمية) 🏆';
      else if (currentTabType === 'roi') titleEl.innerText = 'أعلى فرص الاستثمار العقاري عائداً (ROI) 📈';
      else if (CATEGORY_TITLES[currentTabType]) titleEl.innerText = CATEGORY_TITLES[currentTabType];

      titleEl.innerText += ` (${filtered.length.toLocaleString('en-US')} نتيجة)`;

      const propSection = document.querySelector('.properties-section');
      if (propSection && noScroll !== true) {
        propSection.scrollIntoView({ behavior: 'smooth' });
      }
    }

    function aqResetSearch() {
      ['searchInput', 'minPriceInput', 'maxPriceInput'].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
      const c = document.getElementById('citySelector'); if (c) c.value = 'all';
      const l = document.getElementById('landmarkSelector'); if (l) l.value = '';
      if (window.AQFilters && AQFilters.state) { try { const st = AQFilters.state(); Object.keys(st).forEach((k) => { if (Array.isArray(st[k])) st[k].length = 0; else if (st[k] && typeof st[k] === 'object') Object.keys(st[k]).forEach((x) => delete st[k][x]); }); } catch (e) {} }
      const all = document.querySelector('.royal-tab[data-type="all"]'); if (all) switchRoyalTab(all);
      executeSearch();
    }

    function openInstantDropdown(menuId, event) {
      if (event) event.stopPropagation();
      const targetMenu = document.getElementById(menuId);
      const isVisible = targetMenu.style.display === 'block';
      document.querySelectorAll('.instant-menu, .custom-country-menu').forEach(m => m.style.display = 'none');
      if (!isVisible) targetMenu.style.display = 'block';
    }

    function openLoginModal() { document.getElementById('loginModal').style.display = 'flex'; }
    // 👁️ إضافة زر «عين» لكل خانة كلمة مرور لإظهارها أو إخفائها قبل الدخول/التسجيل
    function enhancePasswordFields(root) {
      (root || document).querySelectorAll('input[type="password"]:not([data-pw-enhanced])').forEach((input) => {
        input.setAttribute('data-pw-enhanced', '1');
        const wrap = document.createElement('div');
        wrap.className = 'pw-wrap';
        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pw-toggle';
        btn.setAttribute('aria-label', 'إظهار كلمة المرور');
        btn.title = 'إظهار كلمة المرور';
        btn.innerHTML = '<i class="fas fa-eye"></i>';
        btn.addEventListener('click', () => {
          const show = input.type === 'password';
          input.type = show ? 'text' : 'password';
          btn.innerHTML = show ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
          const label = show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور';
          btn.setAttribute('aria-label', label); btn.title = label;
          input.focus();
        });
        wrap.appendChild(btn);
      });
    }
    document.addEventListener('DOMContentLoaded', () => enhancePasswordFields());

    function closeRoyalModal(id) { document.getElementById(id).style.display = 'none'; }

    // ==================== 🧭 الفئات والخدمات ====================
    const COMMERCIAL_TYPE_WORDS = ['تجاري', 'مكتب', 'محل', 'مستودع', 'ورشة', 'معرض', 'مصنع'];
    function isCommercialProperty(p) {
      return COMMERCIAL_TYPE_WORDS.some(w => (p.propertyType || '').includes(w));
    }
    function isNoCommissionProperty(p) {
      if (p.noCommission === true) return true;
      if ((p.brokerRole || '') === 'مالك مباشر') return true;
      return /^\s*0+(\.0+)?\s*%?\s*$/.test(String(p.commission ?? 'x'));
    }
    const CATEGORY_TITLES = {
      residential: 'عقارات سكنية 🏡',
      commercial: 'عقارات تجارية 🏬',
      off_plan: 'مشاريع جديدة على الخارطة 🚀',
      under_construction: 'مشاريع تحت الإنشاء 🏗️',
      ready: 'عقارات جاهزة للاستلام 🔑',
      offers: 'عروض وخصومات خاصة 🏷️',
      no_commission: 'عقارات بدون عمولة على المشتري 🤝'
    };
    function openPropertyCategory(type) {
      document.querySelectorAll('.royal-tab').forEach(tab => tab.classList.remove('active'));
      const tab = document.querySelector(`.royal-tab[data-type="${type}"]`);
      if (tab) tab.classList.add('active');
      currentTabType = type;
      updateSearchFieldsForTab(type);
      executeSearch();
    }

    const SERVICE_INFO = {
      general: ['تواصل مع فريق أنا عقار', 'اكتب سؤالك أو ما تحتاجه، وسيرد عليك فريقنا في أقرب وقت.'],
      brokerage: ['خدمات الوساطة العقارية', 'تريد بيع عقارك أو تأجيره أو شراء عقار؟ اترك بياناتك ونربطك بوسيط مرخّص مناسب.'],
      residency: ['الإقامة وتأسيس الشركات', 'إقامة المستثمر أو العمل، وتأسيس الشركات واستخراج الرخص التجارية. اترك طلبك ونوجّهك للجهة المختصة.'],
      legal: ['الاستشارات القانونية العقارية', 'مراجعة العقود، ونزاعات الإيجار والبيع، وتوثيق الملكية. اترك طلبك ونربطك بمستشار قانوني.'],
      property_services: ['خدمات عقارية', 'إدارة الأملاك، وتقييم العقارات، والصيانة والتنظيف. صف ما تحتاجه.'],
      engineering: ['الاستشارات الهندسية', 'التصميم المعماري، والإشراف، وفحص العقار قبل الشراء أو الاستلام.'],
      contracting: ['المقاولات', 'البناء، والتشطيب، والترميم. صف المشروع ومساحته وموقعه.'],
      interior: ['تصميم الديكور', 'التصميم الداخلي والتأثيث لشقتك أو فيلتك أو مكتبك.'],
      citizenship: ['الجنسية والإقامة عبر الاستثمار العقاري', 'تختلف الشروط والمبالغ من دولة لأخرى وتتغيّر من وقت لآخر. اترك طلبك لنرشدك إلى الخيارات المتاحة حاليًا.']
    };
    function openServiceRequest(key) {
      const info = SERVICE_INFO[key] || SERVICE_INFO.general;
      document.getElementById('srService').value = SERVICE_INFO[key] ? key : 'general';
      document.getElementById('serviceRequestTitle').innerText = info[0];
      document.getElementById('serviceRequestIntro').innerText = info[1];
      document.getElementById('serviceRequestForm').style.display = '';
      document.getElementById('serviceRequestDone').style.display = 'none';
      document.getElementById('serviceRequestModal').style.display = 'flex';
    }
    async function submitServiceRequest(e) {
      e.preventDefault();
      const btn = document.getElementById('srSubmit');
      const row = {
        service: document.getElementById('srService').value,
        name: document.getElementById('srName').value.trim(),
        phone: document.getElementById('srPhone').value.trim(),
        email: document.getElementById('srEmail').value.trim() || null,
        city: document.getElementById('srCity').value.trim() || null,
        details: document.getElementById('srDetails').value.trim() || null,
        page: location.pathname
      };
      btn.disabled = true;
      try {
        const { error } = await supabaseClient.from('service_requests').insert(row);
        if (error) throw error;
        document.getElementById('serviceRequestForm').reset();
        document.getElementById('serviceRequestForm').style.display = 'none';
        document.getElementById('serviceRequestDone').style.display = '';
        if (window.gtag) window.gtag('event', 'generate_lead', { service: row.service });
      } catch (err) {
        console.error('service request failed', err);
        showAnaAqarToast(aqIsRateLimited(err) ? AQ_RATE_LIMIT_MSG : 'تعذّر إرسال الطلب الآن، حاول مرة أخرى بعد قليل', 'error');
      } finally {
        btn.disabled = false;
      }
    }
    function toggleAqFab(force) {
      const w = document.getElementById('aqFabWrap'), m = document.getElementById('aqFabMenu');
      if (!w || !m) return;
      const open = typeof force === 'boolean' ? force : !w.classList.contains('open');
      w.classList.toggle('open', open); m.classList.toggle('open', open);
      const b = document.getElementById('aqFabBtn'); if (b) b.setAttribute('aria-expanded', open);
      const ic = b && b.querySelector('i'); if (ic) ic.className = open ? 'fas fa-xmark' : 'fas fa-comments';
    }
    // ☰ القائمة الجانبية
    function aqDrawer(open) {
      const d = document.getElementById('aqDrawer'), o = document.getElementById('aqDrawerOverlay');
      if (!d) return;
      d.classList.toggle('open', open); o.classList.toggle('open', open);
      d.setAttribute('aria-hidden', !open);
      document.documentElement.classList.toggle('aq-noscroll', open);
      document.querySelectorAll('.hamburger-menu-btn').forEach(b => b.setAttribute('aria-expanded', open));
      if (open) { toggleAqFab(false); setTimeout(() => d.querySelector('.aq-dr-x')?.focus(), 50); }
    }
    // 👆 فتح القائمة الجانبية وإغلاقها بسحب الإصبع: اسحب من الحافة اليسرى للشاشة نحو الداخل لفتحها، واسحبها لليسار لإغلاقها
    (function () {
      const EDGE = 28;
      let sx = 0, sy = 0, mode = '', dx = 0, w = 0, t0 = 0;
      const d = () => document.getElementById('aqDrawer'), o = () => document.getElementById('aqDrawerOverlay');
      const isOpen = () => d() && d().classList.contains('open');
      document.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1 || !d()) return;
        const x = e.touches[0].clientX, y = e.touches[0].clientY;
        mode = '';
        if (!isOpen() && x <= EDGE && !document.querySelector('.royal-modal-overlay[style*="flex"], .aqf-ov, .aqe-ov')) mode = 'open';
        else if (isOpen() && (d().contains(e.target) || o().contains(e.target))) mode = 'close';
        if (!mode) return;
        sx = x; sy = y; dx = 0; w = d().offsetWidth; t0 = Date.now();
      }, { passive: true });
      document.addEventListener('touchmove', (e) => {
        if (!mode) return;
        const x = e.touches[0].clientX, y = e.touches[0].clientY;
        if (!dx && Math.abs(y - sy) > Math.abs(x - sx) + 4) { mode = ''; return; } // تمرير عمودي، لا سحب
        dx = x - sx;
        const off = mode === 'open' ? Math.min(0, -w + Math.max(0, dx)) : Math.min(0, dx);
        d().classList.add('aq-dragging'); d().style.transition = 'none'; d().style.transform = `translateX(${off}px)`;
        o().classList.add('open'); o().style.transition = 'none'; o().style.opacity = String(1 + off / w);
      }, { passive: true });
      document.addEventListener('touchend', () => {
        if (!mode) return;
        const v = dx / Math.max(1, Date.now() - t0); // سرعة السحب
        const openIt = mode === 'open' ? (dx > w * 0.35 || v > 0.5) : !(dx < -w * 0.3 || v < -0.5);
        d().classList.remove('aq-dragging'); d().style.transition = ''; d().style.transform = ''; o().style.transition = ''; o().style.opacity = '';
        if (Math.abs(dx) > 6 || mode === 'close') aqDrawer(openIt); else if (mode === 'open') o().classList.remove('open');
        mode = '';
      });
    })();
    function aqDrawerGo(id) { aqDrawer(false); setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 220); }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { aqDrawer(false); toggleAqFab(false); } });
    document.addEventListener('click', (ev) => {
      const wrap = document.getElementById('aqFabWrap');
      if (wrap && !wrap.contains(ev.target)) toggleAqFab(false);
    });

    document.addEventListener('DOMContentLoaded', () => {
      restoreSavedLanguageLabel();
      restoreSavedCurrencyLabel();
      // استعادة الدولة التي اختارها الزائر سابقًا (بدل الرجوع إلى الإمارات في كل زيارة)
      (function () {
        let key = 'uae';
        try { key = localStorage.getItem('anaaqar_selected_country') || 'uae'; } catch (e) {}
        const item = document.querySelector(`.custom-country-item[onclick*="'${key}'"]`);
        if (key !== 'uae' && countryData[key] && item) item.click(); else updateCitiesAndBackground('uae');
      })();
      updateFavBadgeCount();
      updateCompareBadge();
      fetchProperties();
      refreshAnaAqarAuthUI();
      syncFavoritesWithAccount();

      // إشعار عصري بعد تسجيل الخروج (بدل alert() قديم) - العلامة توضع في anaaqarSignOut() بـ supabase-client.js
      if (sessionStorage.getItem('anaaqar_just_signed_out')) {
        sessionStorage.removeItem('anaaqar_just_signed_out');
        showAnaAqarToast('تم تسجيل خروجك، نترقب عودتك مرة أخرى 👋', 'info');
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.instant-dropdown') && !e.target.closest('.royal-input-box')) {
        document.querySelectorAll('.instant-menu, .custom-country-menu').forEach(m => m.style.display = 'none');
      }
    });

    // ==================== 📲 تطبيق الويب التقدمي (PWA): بنر التثبيت ====================
    // تسجيل Service Worker ومنطق التحديث التلقائي انتقلا إلى supabase-client.js
    // (يُحمَّل بكل صفحة، خلافاً لهذا الملف) - راجع التعليق هناك لسبب النقل.
    const PWA_DISMISS_KEY = 'anaaqar_pwa_banner_dismissed_at';
    const PWA_DISMISS_DAYS = 7;
    let deferredInstallPrompt = null;

    function isInstallBannerSnoozed() {
      const dismissedAt = localStorage.getItem(PWA_DISMISS_KEY);
      if (!dismissedAt) return false;
      const daysPassed = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      return daysPassed < PWA_DISMISS_DAYS;
    }

    function isRunningAsInstalledApp() {
      // داخل تطبيق أندرويد/آيفون (Capacitor) لا معنى لدعوة التثبيت
      if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return true;
      return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    }

    function showInstallBanner() {
      const banner = document.getElementById('pwaInstallBanner');
      if (!banner || isRunningAsInstalledApp()) return;
      banner.classList.remove('pwa-banner-hidden');
      banner.style.display = 'flex';
    }

    function hideInstallBanner() {
      const banner = document.getElementById('pwaInstallBanner');
      if (banner) banner.classList.add('pwa-banner-hidden');
    }

    // 🖥️ سطح المكتب: إظهار البنر تلقائياً فقط عند دعم المتصفح لحدث التثبيت الأصلي (وما لم يُغلق مؤخراً)
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      if (!isInstallBannerSnoozed()) showInstallBanner();
    });

    // 📱 الجوال والشاشات الصغيرة: البنر يظهر إجبارياً عبر CSS بغض النظر عن حدث المتصفح،
    // هنا فقط نتأكد من عدم إظهاره داخل تطبيق مثبَّت بالفعل
    document.addEventListener('DOMContentLoaded', () => {
      if (isRunningAsInstalledApp()) hideInstallBanner();
    });

    async function installAnaAqarApp() {
      if (!deferredInstallPrompt) {
        const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
        if (isIOS) {
          alert('لتثبيت التطبيق على آيفون/آيباد: اضغط زر المشاركة ⬆️ بالمتصفح، ثم اختر "إضافة إلى الشاشة الرئيسية".');
        } else {
          alert('التثبيت غير متاح الآن من هذا المتصفح. جرّب من قائمة المتصفح (⋮) خيار "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية".');
        }
        return;
      }

      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;

      if (outcome === 'accepted') {
        hideInstallBanner();
      }
    }

    function dismissInstallBanner() {
      hideInstallBanner();
      localStorage.setItem(PWA_DISMISS_KEY, Date.now().toString());
    }

    window.addEventListener('appinstalled', () => {
      hideInstallBanner();
      console.log('✅ تم تثبيت تطبيق AnaAqar على الجهاز بنجاح');
    });

