/* خصائص التطبيق الأصلية (آيفون وأندرويد عبر Capacitor). لا يعمل شيء هنا في المتصفح العادي.
   - المشاركة من قائمة الجهاز، ومنها «الإعلان المصغّر» بالصور
   - الإشعارات الفورية (آيفون): حجز جديد، استفسار، رد على إعلان…
   - اهتزاز خفيف عند الإضافة للمفضلة والمشاركة
   - لون شريط الحالة */
(function () {
  'use strict';
  var Cap = window.Capacitor;
  if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform() || window.AQNative) return;
  var P = Cap.Plugins || {}, platform = Cap.getPlatform ? Cap.getPlatform() : '';
  var LS = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  // ---------- المشاركة ----------
  function blobToB64(b) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1]); }; r.onerror = rej; r.readAsDataURL(b); });
  }
  // files: مصفوفة File (صور) — تُحفظ مؤقتًا في ذاكرة التطبيق ثم تُشارك من قائمة الجهاز
  function shareFiles(files, text, title) {
    if (!P.Share || !P.Filesystem) return Promise.reject(new Error('unsupported'));
    var stamp = Date.now();
    return Promise.all(files.map(function (f, i) {
      return blobToB64(f).then(function (data) {
        return P.Filesystem.writeFile({ path: 'share/' + stamp + '-' + (i + 1) + '-' + (f.name || 'image.jpg'), data: data, directory: 'CACHE', recursive: true });
      }).then(function (r) { return r.uri; });
    })).then(function (uris) {
      return P.Share.share({ title: title || '', text: text || '', files: uris, dialogTitle: 'أرسل الإعلان' });
    });
  }
  function shareLink(o) {
    if (!P.Share) return Promise.reject(new Error('unsupported'));
    return P.Share.share({ title: o.title || '', text: o.text || '', url: o.url || '', dialogTitle: 'مشاركة' });
  }

  // ---------- اهتزاز خفيف ----------
  function tap() { try { P.Haptics && P.Haptics.impact({ style: 'LIGHT' }); } catch (e) {} }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-aqfav], .gallery-fav-btn, .aqsh-btn, .aqg-b, .sx-fav, .aqsh-album, .aqbn a, .aqbn button');
    if (t) tap();
  }, true);

  // ---------- شريط الحالة ----------
  try {
    if (P.StatusBar) {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      P.StatusBar.setStyle({ style: dark ? 'LIGHT' : 'DARK' }); // DARK = نص داكن على خلفية فاتحة
    }
  } catch (e) {}

  // ---------- الإشعارات الفورية (آيفون) ----------
  // نطلب الإذن بعد تسجيل الدخول فقط، مرة واحدة، ونحفظ رمز الجهاز في جدول push_tokens
  function saveToken(token) {
    if (!token || typeof supabaseClient === 'undefined') return;
    supabaseClient.auth.getSession().then(function (r) {
      var u = r && r.data && r.data.session && r.data.session.user;
      if (!u) return;
      if (LS.get('aq_push_token') === token + ':' + u.id) return;
      supabaseClient.rpc('register_push_token', { p_token: token, p_platform: platform })
        .then(function (x) { if (!x.error) LS.set('aq_push_token', token + ':' + u.id); });
    });
  }
  function initPush() {
    var PN = P.PushNotifications;
    if (!PN || platform !== 'ios' || typeof supabaseClient === 'undefined') return;
    PN.addListener('registration', function (t) { saveToken(t && t.value); });
    PN.addListener('pushNotificationActionPerformed', function (a) {
      var d = (a && a.notification && a.notification.data) || {}, url = d.url || d.link;
      if (url) location.href = /^https?:/.test(url) ? url : 'https://anaaqar.com/' + String(url).replace(/^\//, '');
    });
    supabaseClient.auth.getSession().then(function (r) {
      if (!(r && r.data && r.data.session)) return;
      PN.checkPermissions().then(function (s) {
        if (s.receive === 'granted') return PN.register();
        if (s.receive === 'denied' || LS.get('aq_push_asked')) return;
        LS.set('aq_push_asked', '1');
        return PN.requestPermissions().then(function (s2) { if (s2.receive === 'granted') PN.register(); });
      }).catch(function () {});
    });
  }

  window.AQNative = {
    platform: platform,
    canShareFiles: !!(P.Share && P.Filesystem),
    shareFiles: shareFiles,
    shareLink: shareLink,
    tap: tap
  };
  if (document.readyState === 'complete') setTimeout(initPush, 1500);
  else window.addEventListener('load', function () { setTimeout(initPush, 1500); });
})();
