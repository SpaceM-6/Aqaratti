// ==================== COMPLETE FAST JAVASCRIPT CODE ====================
  // 1. فتح وإغلاق القوائم المنسدلة بسرعة البرق (0 مللي ثانية تأخير)
  function toggleDropdown(id) {
    const target = document.getElementById(id);
    if (!target) return;
    
    const isOpen = target.style.display === 'block';
    
    // إغلاق أي قائمة منسدلة أخرى مفتوحة فوراً
    document.querySelectorAll('.dropdown-content').forEach(dd => {
      dd.style.display = 'none';
    });

    // فتح أو إغلاق القائمة المطلوبة لحظياً
    target.style.display = isOpen ? 'none' : 'block';
  }

  // 2. محول وحدات المساحة اللحظي (م² / قدم² / ياردة²)
  let activeUnit = 'm2';
  const conversionFactors = {
    'm2': 1,
    'sqft': 10.7639,
    'yd2': 1.19599
  };

  function setAreaUnit(unit) {
    activeUnit = unit;
    
    // تحديث شكل الأزرار النشطة
    document.querySelectorAll('.unit-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`unit-${unit}`);
    if (activeBtn) activeBtn.classList.add('active');
    
    // تحويل الأرقام المعروضة في الصفحة تلقائياً
    document.querySelectorAll('[data-area-m2]').forEach(elem => {
      const baseM2 = parseFloat(elem.getAttribute('data-area-m2'));
      if (!isNaN(baseM2)) {
        const converted = Math.round(baseM2 * conversionFactors[unit]);
        const unitLabel = unit === 'm2' ? 'م²' : (unit === 'sqft' ? 'قدم²' : 'ياردة²');
        elem.innerText = `${converted.toLocaleString()} ${unitLabel}`;
      }
    });
  }

  // 3. اختيار العملة وتحديث الشاشة فوراً
  function selectCurrency(code, symbol) {
    const currLabel = document.getElementById('currentCurrency');
    if (currLabel) currLabel.innerText = `${code} (${symbol})`;
    
    // إغلاق القائمة فوراً بعد الاختيار
    const currencyList = document.getElementById('currencyList');
    if (currencyList) currencyList.style.display = 'none';
    
    console.log(`تم تغيير العملة إلى: ${code}`);
  }

  // 4. اختيار اللغة وتوجيه إتجاه الموقع (RTL / LTR) فوراً
  function selectLanguage(name, code, direction) {
    const langLabel = document.getElementById('currentLang');
    if (langLabel) langLabel.innerText = name;
    
    // ضبط اتجاه الصفحة (يمين لليسار أو العكس)
    document.documentElement.setAttribute('dir', direction);
    document.documentElement.setAttribute('lang', code);
    
    // إغلاق القائمة فوراً
    const langList = document.getElementById('langList');
    if (langList) langList.style.display = 'none';
    
    console.log(`تم تغيير اللغة إلى: ${name} (${direction})`);
  }

  // 5. فلترة وسرعة البحث داخل قائمة اللغات أثناء الكتابة
  function filterLanguages() {
    const input = document.getElementById('langSearchInput');
    if (!input) return;
    
    const filterText = input.value.toLowerCase();
    const options = document.getElementById('langOptions').getElementsByTagName('a');
    
    for (let i = 0; i < options.length; i++) {
      const text = options[i].innerText || options[i].textContent;
      options[i].style.display = text.toLowerCase().indexOf(filterText) > -1 ? "" : "none";
    }
  }

  // 6. التبديل بين تبويبات الـ Hero (للشراء، للإيجار، الجنسية...)
  function switchRoyalTab(btn, mode) {
    document.querySelectorAll('.royal-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
  }

  // 7. إغلاق القوائم المنسدلة تلقائياً عند النقر في أي مكان خارجها
  window.addEventListener('click', function(event) {
    if (!event.target.closest('.custom-dropdown')) {
      document.querySelectorAll('.dropdown-content').forEach(dd => {
        dd.style.display = 'none';
      });
    }
  });