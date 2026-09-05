/* ====================================================================
   عارض صور بملء الشاشة (Lightbox) مشترك بكل الصفحة: أي صورة شعار/صورة
   شخصية بالموقع (وسيط، مكتب، مطوّر) تُفتح بحجم كبير عند الضغط عليها، بدل
   الانتقال المباشر لصفحة الملف الشخصي عند الضغط على الصورة تحديداً (بقية
   البطاقة تبقى تفتح الملف الشخصي كالمعتاد).
   يُستهدف عبر أصناف CSS الموجودة أصلاً بكل الصفحات: broker-logo,
   profile-photo, profile-logo - بدون الحاجة لتعديل كل قالب بطاقة يدوياً.
==================================================================== */
(function () {
  const TARGET_SELECTOR = '.broker-logo, .profile-photo, .profile-logo, .lightbox-img';
  const PLACEHOLDER_HOSTS = ['images.unsplash.com'];

  function isPlaceholder(src) {
    try {
      const url = new URL(src, window.location.href);
      return PLACEHOLDER_HOSTS.includes(url.hostname);
    } catch (e) {
      return false;
    }
  }

  let overlay, imgEl;
  function ensureLightbox() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'imgLightboxOverlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'background:rgba(10,14,25,0.9)',
      'display:none', 'align-items:center', 'justify-content:center',
      'z-index:99999', 'padding:24px', 'cursor:zoom-out',
    ].join(';');

    imgEl = document.createElement('img');
    imgEl.style.cssText = 'max-width:92vw; max-height:92vh; border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,0.5); cursor:default;';
    overlay.appendChild(imgEl);

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<i class="fas fa-xmark"></i>';
    closeBtn.setAttribute('aria-label', 'إغلاق');
    closeBtn.style.cssText = [
      'position:fixed', 'top:16px', 'left:16px', 'width:40px', 'height:40px',
      'border-radius:50%', 'border:none', 'background:rgba(255,255,255,0.15)',
      'color:white', 'font-size:18px', 'cursor:pointer', 'z-index:100000',
    ].join(';');
    closeBtn.addEventListener('click', close);
    overlay.appendChild(closeBtn);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  function open(src) {
    ensureLightbox();
    imgEl.src = src;
    overlay.style.display = 'flex';
  }

  function close() {
    if (overlay) overlay.style.display = 'none';
  }

  // مرحلة الالتقاط (capture) عشان نسبق onclick الخاص بالبطاقة (الذي ينقل
  // لصفحة الملف الشخصي) ونمنعه من التنفيذ عند الضغط على الصورة تحديداً.
  document.addEventListener('click', (e) => {
    const img = e.target.closest(TARGET_SELECTOR);
    if (!img || !img.src || isPlaceholder(img.src)) return;
    e.stopPropagation();
    e.preventDefault();
    open(img.src);
  }, true);
})();
