/* إحصاء الزيارات لمنصة «أنا عقار» — بلا ملفات تعريف ارتباط ولا أطراف ثالثة.
   يسجّل: بداية الزيارة ومصدرها، والصفحات المتصفحة، والإعلانات المفتوحة، ونقرات التواصل
   (اتصال/واتساب/بريد)، ومدة البقاء، وفتح التطبيق. الدولة تُستنتج من المنطقة الزمنية للجهاز
   (لا يُرسل عنوان IP ولا موقع). يُحمَّل تلقائيًا من supabase-client.js. */
(function () {
  'use strict';
  if (window.__aqTrack) return; window.__aqTrack = 1;
  var SB = 'https://mejkpckkdbmczzypzkkr.supabase.co';
  var ANON = (typeof SUPABASE_ANON_KEY !== 'undefined') ? SUPABASE_ANON_KEY : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lamtwY2trZGJtY3p6eXB6a2tyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3ODMxNzUsImV4cCI6MjEwMzM1OTE3NX0.e9DqA9JRjhH-scSYwNue6XqowK0u1bMHEOcrcJjZwjo';   // مفتاح anon العام (المستخدم في supabase-client.js)
  var ua = navigator.userAgent || '', path = location.pathname, host = location.hostname;
  if (!ANON || navigator.webdriver || /bot|crawl|spider|slurp|lighthouse|headless|preview|facebookexternalhit|whatsapp\//i.test(ua)) return;
  if (host !== 'anaaqar.com' && host !== 'www.anaaqar.com' && !/[?&]aqtrack=1/.test(location.search)) return;   // لا تُحتسب النسخ المحلية والتجارب
  if (/^\/admin\b|google[0-9a-f]+\.html|offline\.html/i.test(path)) { try { localStorage.setItem('aq_notrack', '1'); } catch (e) {} return; }   // أجهزة الإدارة لا تُحتسب
  try { if (localStorage.getItem('aq_notrack') === '1') return; } catch (e) {}
  var TZ = {"Europe":{"Andorra":"AD","Tirane":"AL","Vienna":"AT","Mariehamn":"AX","Sarajevo":"BA","Brussels":"BE","Sofia":"BG","Minsk":"BY","Zurich":"CH","Prague":"CZ","Berlin":"DE","Busingen":"DE","Copenhagen":"DK","Tallinn":"EE","Madrid":"ES","Helsinki":"FI","Paris":"FR","London":"GB","Guernsey":"GG","Gibraltar":"GI","Athens":"GR","Zagreb":"HR","Budapest":"HU","Dublin":"IE","Isle_of_Man":"IM","Rome":"IT","Jersey":"JE","Vaduz":"LI","Vilnius":"LT","Luxembourg":"LU","Riga":"LV","Monaco":"MC","Chisinau":"MD","Podgorica":"ME","Skopje":"MK","Malta":"MT","Amsterdam":"NL","Oslo":"NO","Warsaw":"PL","Lisbon":"PT","Bucharest":"RO","Belgrade":"RS","Kaliningrad":"RU","Moscow":"RU","Simferopol":"UA","Kirov":"RU","Volgograd":"RU","Astrakhan":"RU","Saratov":"RU","Ulyanovsk":"RU","Samara":"RU","Stockholm":"SE","Ljubljana":"SI","Bratislava":"SK","San_Marino":"SM","Istanbul":"TR","Kyiv":"UA","Vatican":"VA","Belfast":"GB","Tiraspol":"MD","Uzhgorod":"UA","Zaporozhye":"UA","Kiev":"UA","Nicosia":"CY"},"Asia":{"Dubai":"AE","Kabul":"AF","Yerevan":"AM","Baku":"AZ","Dhaka":"BD","Bahrain":"BH","Brunei":"BN","Thimphu":"BT","Shanghai":"CN","Urumqi":"CN","Nicosia":"CY","Famagusta":"CY","Tbilisi":"GE","Hong_Kong":"HK","Jakarta":"ID","Pontianak":"ID","Makassar":"ID","Jayapura":"ID","Jerusalem":"IL","Kolkata":"IN","Baghdad":"IQ","Tehran":"IR","Amman":"JO","Tokyo":"JP","Bishkek":"KG","Phnom_Penh":"KH","Pyongyang":"KP","Seoul":"KR","Kuwait":"KW","Almaty":"KZ","Qyzylorda":"KZ","Qostanay":"KZ","Aqtobe":"KZ","Aqtau":"KZ","Atyrau":"KZ","Oral":"KZ","Vientiane":"LA","Beirut":"LB","Colombo":"LK","Yangon":"MM","Ulaanbaatar":"MN","Hovd":"MN","Macau":"MO","Kuala_Lumpur":"MY","Kuching":"MY","Kathmandu":"NP","Muscat":"OM","Manila":"PH","Karachi":"PK","Gaza":"PS","Hebron":"PS","Qatar":"QA","Yekaterinburg":"RU","Omsk":"RU","Novosibirsk":"RU","Barnaul":"RU","Tomsk":"RU","Novokuznetsk":"RU","Krasnoyarsk":"RU","Irkutsk":"RU","Chita":"RU","Yakutsk":"RU","Khandyga":"RU","Vladivostok":"RU","Ust-Nera":"RU","Magadan":"RU","Sakhalin":"RU","Srednekolymsk":"RU","Kamchatka":"RU","Anadyr":"RU","Riyadh":"SA","Singapore":"SG","Damascus":"SY","Bangkok":"TH","Dushanbe":"TJ","Dili":"TL","Ashgabat":"TM","Taipei":"TW","Samarkand":"UZ","Tashkent":"UZ","Ho_Chi_Minh":"VN","Aden":"YE","Choibalsan":"MN","Chongqing":"CN","Harbin":"CN","Kashgar":"CN","Tel_Aviv":"IL","Ashkhabad":"TM","Calcutta":"IN","Chungking":"CN","Dacca":"BD","Istanbul":"TR","Katmandu":"NP","Macao":"MO","Rangoon":"MM","Saigon":"VN","Thimbu":"BT","Ujung_Pandang":"ID","Ulan_Bator":"MN"},"America":{"Antigua":"AG","Anguilla":"AI","Argentina/Buenos_Aires":"AR","Argentina/Cordoba":"AR","Argentina/Salta":"AR","Argentina/Jujuy":"AR","Argentina/Tucuman":"AR","Argentina/Catamarca":"AR","Argentina/La_Rioja":"AR","Argentina/San_Juan":"AR","Argentina/Mendoza":"AR","Argentina/San_Luis":"AR","Argentina/Rio_Gallegos":"AR","Argentina/Ushuaia":"AR","Aruba":"AW","Barbados":"BB","St_Barthelemy":"BL","La_Paz":"BO","Kralendijk":"BQ","Noronha":"BR","Belem":"BR","Fortaleza":"BR","Recife":"BR","Araguaina":"BR","Maceio":"BR","Bahia":"BR","Sao_Paulo":"BR","Campo_Grande":"BR","Cuiaba":"BR","Santarem":"BR","Porto_Velho":"BR","Boa_Vista":"BR","Manaus":"BR","Eirunepe":"BR","Rio_Branco":"BR","Nassau":"BS","Belize":"BZ","St_Johns":"CA","Halifax":"CA","Glace_Bay":"CA","Moncton":"CA","Goose_Bay":"CA","Blanc-Sablon":"CA","Toronto":"CA","Iqaluit":"CA","Atikokan":"CA","Winnipeg":"CA","Resolute":"CA","Rankin_Inlet":"CA","Regina":"CA","Swift_Current":"CA","Edmonton":"CA","Cambridge_Bay":"CA","Inuvik":"CA","Vancouver":"CA","Creston":"CA","Dawson_Creek":"CA","Fort_Nelson":"CA","Whitehorse":"CA","Dawson":"CA","Santiago":"CL","Coyhaique":"CL","Punta_Arenas":"CL","Bogota":"CO","Costa_Rica":"CR","Havana":"CU","Curacao":"CW","Dominica":"DM","Santo_Domingo":"DO","Guayaquil":"EC","Grenada":"GD","Cayenne":"GF","Nuuk":"GL","Danmarkshavn":"GL","Scoresbysund":"GL","Thule":"GL","Guadeloupe":"GP","Guatemala":"GT","Guyana":"GY","Tegucigalpa":"HN","Port-au-Prince":"HT","Jamaica":"JM","St_Kitts":"KN","Cayman":"KY","St_Lucia":"LC","Marigot":"MF","Martinique":"MQ","Montserrat":"MS","Mexico_City":"MX","Cancun":"MX","Merida":"MX","Monterrey":"MX","Matamoros":"MX","Chihuahua":"MX","Ciudad_Juarez":"MX","Ojinaga":"MX","Mazatlan":"MX","Bahia_Banderas":"MX","Hermosillo":"MX","Tijuana":"MX","Managua":"NI","Panama":"PA","Lima":"PE","Miquelon":"PM","Puerto_Rico":"PR","Asuncion":"PY","Paramaribo":"SR","El_Salvador":"SV","Lower_Princes":"SX","Grand_Turk":"TC","Port_of_Spain":"TT","New_York":"US","Detroit":"US","Kentucky/Louisville":"US","Kentucky/Monticello":"US","Indiana/Indianapolis":"US","Indiana/Vincennes":"US","Indiana/Winamac":"US","Indiana/Marengo":"US","Indiana/Petersburg":"US","Indiana/Vevay":"US","Chicago":"US","Indiana/Tell_City":"US","Indiana/Knox":"US","Menominee":"US","North_Dakota/Center":"US","North_Dakota/New_Salem":"US","North_Dakota/Beulah":"US","Denver":"US","Boise":"US","Phoenix":"US","Los_Angeles":"US","Anchorage":"US","Juneau":"US","Sitka":"US","Metlakatla":"US","Yakutat":"US","Nome":"US","Adak":"US","Montevideo":"UY","St_Vincent":"VC","Caracas":"VE","Tortola":"VG","St_Thomas":"VI","Buenos_Aires":"AR","Catamarca":"AR","Cordoba":"AR","Indianapolis":"US","Jujuy":"AR","Knox_IN":"US","Louisville":"US","Mendoza":"AR","Argentina/ComodRivadavia":"AR","Atka":"US","Ensenada":"MX","Fort_Wayne":"US","Montreal":"CA","Nipigon":"CA","Pangnirtung":"CA","Porto_Acre":"BR","Rainy_River":"CA","Rosario":"AR","Santa_Isabel":"MX","Shiprock":"US","Thunder_Bay":"CA","Yellowknife":"CA","Godthab":"GL","Coral_Harbour":"CA","Virgin":"VI"},"Africa":{"Luanda":"AO","Ouagadougou":"BF","Bujumbura":"BI","Porto-Novo":"BJ","Gaborone":"BW","Kinshasa":"CD","Lubumbashi":"CD","Bangui":"CF","Brazzaville":"CG","Abidjan":"CI","Douala":"CM","Djibouti":"DJ","Algiers":"DZ","Cairo":"EG","El_Aaiun":"EH","Asmara":"ER","Ceuta":"ES","Addis_Ababa":"ET","Libreville":"GA","Accra":"GH","Banjul":"GM","Conakry":"GN","Malabo":"GQ","Bissau":"GW","Nairobi":"KE","Monrovia":"LR","Maseru":"LS","Tripoli":"LY","Casablanca":"MA","Bamako":"ML","Nouakchott":"MR","Blantyre":"MW","Maputo":"MZ","Windhoek":"NA","Niamey":"NE","Lagos":"NG","Kigali":"RW","Khartoum":"SD","Freetown":"SL","Dakar":"SN","Mogadishu":"SO","Juba":"SS","Sao_Tome":"ST","Mbabane":"SZ","Ndjamena":"TD","Lome":"TG","Tunis":"TN","Dar_es_Salaam":"TZ","Kampala":"UG","Johannesburg":"ZA","Lusaka":"ZM","Harare":"ZW","Asmera":"ER","Timbuktu":"ML"},"Antarctica":{"McMurdo":"AQ","Casey":"AQ","Davis":"AQ","DumontDUrville":"AQ","Mawson":"AQ","Palmer":"AQ","Rothera":"AQ","Syowa":"AQ","Troll":"AQ","Vostok":"AQ","Macquarie":"AU","South_Pole":"AQ"},"Pacific":{"Pago_Pago":"AS","Rarotonga":"CK","Easter":"CL","Galapagos":"EC","Fiji":"FJ","Chuuk":"FM","Pohnpei":"FM","Kosrae":"FM","Guam":"GU","Tarawa":"KI","Kanton":"KI","Kiritimati":"KI","Majuro":"MH","Kwajalein":"MH","Saipan":"MP","Noumea":"NC","Norfolk":"NF","Nauru":"NR","Niue":"NU","Auckland":"NZ","Chatham":"NZ","Tahiti":"PF","Marquesas":"PF","Gambier":"PF","Port_Moresby":"PG","Bougainville":"PG","Pitcairn":"PN","Palau":"PW","Guadalcanal":"SB","Fakaofo":"TK","Tongatapu":"TO","Funafuti":"TV","Midway":"UM","Wake":"UM","Honolulu":"US","Efate":"VU","Wallis":"WF","Apia":"WS","Samoa":"AS","Enderbury":"KI","Johnston":"US","Truk":"FM","Yap":"FM","Ponape":"FM"},"Australia":{"Lord_Howe":"AU","Hobart":"AU","Melbourne":"AU","Sydney":"AU","Broken_Hill":"AU","Brisbane":"AU","Lindeman":"AU","Adelaide":"AU","Darwin":"AU","Perth":"AU","Eucla":"AU","ACT":"AU","LHI":"AU","NSW":"AU","North":"AU","Queensland":"AU","South":"AU","Tasmania":"AU","Victoria":"AU","West":"AU","Yancowinna":"AU","Canberra":"AU","Currie":"AU"},"Atlantic":{"Bermuda":"BM","Cape_Verde":"CV","Canary":"ES","Stanley":"FK","Faroe":"FO","South_Georgia":"GS","Reykjavik":"IS","Madeira":"PT","Azores":"PT","St_Helena":"SH","Faeroe":"FO","Jan_Mayen":"NO"},"Indian":{"Cocos":"CC","Christmas":"CX","Chagos":"IO","Comoro":"KM","Antananarivo":"MG","Mauritius":"MU","Maldives":"MV","Reunion":"RE","Mahe":"SC","Kerguelen":"TF","Mayotte":"YT"},"Arctic":{"Longyearbyen":"SJ"},"Brazil":{"Acre":"BR","DeNoronha":"BR","East":"BR","West":"BR"},"Canada":{"Atlantic":"CA","Central":"CA","Eastern":"CA","Mountain":"CA","Newfoundland":"CA","Pacific":"CA","Saskatchewan":"CA","Yukon":"CA"},"Chile":{"Continental":"CL","EasterIsland":"CL"},"Mexico":{"BajaNorte":"MX","BajaSur":"MX","General":"MX"},"US":{"Alaska":"US","Aleutian":"US","Arizona":"US","Central":"US","East-Indiana":"US","Eastern":"US","Hawaii":"US","Indiana-Starke":"US","Michigan":"US","Mountain":"US","Pacific":"US","Samoa":"AS"}};
  function country() { try { var z = Intl.DateTimeFormat().resolvedOptions().timeZone || '', i = z.indexOf('/'); return i > 0 && TZ[z.slice(0, i)] ? (TZ[z.slice(0, i)][z.slice(i + 1)] || '') : ''; } catch (e) { return ''; } }
  function rid() { return (Date.now().toString(36) + Math.random().toString(36).slice(2, 12)).replace(/[^a-z0-9]/g, '').slice(0, 24); }
  function store(s, k) { try { var v = s.getItem(k); if (!v) { v = rid(); s.setItem(k, v); } return v; } catch (e) { return rid(); } }
  var vid = store(localStorage, 'aq_vid'), sid = store(sessionStorage, 'aq_sid');
  var plat = 'web';
  try {
    if (window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) plat = Capacitor.getPlatform ? Capacitor.getPlatform() : 'app';
    else if (matchMedia('(display-mode: standalone)').matches || navigator.standalone === true) plat = 'pwa';
  } catch (e) {}
  if (plat !== 'web' && plat !== 'pwa' && plat !== 'android' && plat !== 'ios') plat = 'app';
  function token() { try { var j = JSON.parse(localStorage.getItem('sb-mejkpckkdbmczzypzkkr-auth-token') || 'null'); return j && j.access_token && (j.expires_at || 0) * 1000 > Date.now() ? j.access_token : ''; } catch (e) { return ''; } }
  function send(kind, extra) {
    var b = { sid: sid, vid: vid, kind: kind }; for (var k in extra) b[k] = extra[k];
    var t = token();
    try { fetch(SB + '/rest/v1/rpc/aq_track', { method: 'POST', keepalive: true, headers: { apikey: ANON, Authorization: 'Bearer ' + (t || ANON), 'Content-Type': 'application/json' }, body: JSON.stringify({ p: b }) }).catch(function () {}); } catch (e) {}
  }
  // ===== مصدر الزيارة =====
  function source() {
    var q = location.search, m = /[?&]utm_source=([^&#]+)/i.exec(q);
    if (m) { try { return decodeURIComponent(m[1]).toLowerCase().slice(0, 60); } catch (e) { return m[1].slice(0, 60); } }
    var r = document.referrer || ''; if (!r) return '';
    try { var h = new URL(r).hostname.replace(/^www\.|^m\.|^l\.|^lm\./, ''); return /anaaqar\.com$/.test(h) ? '' : h.slice(0, 60); } catch (e) { return ''; }
  }
  var started = false, T0 = Date.now();
  try { started = sessionStorage.getItem('aq_st') === sid; } catch (e) {}
  if (!started) {
    send('start', { country: country(), plat: plat, mobile: /Mobi|Android|iPhone|iPad/i.test(ua), path: (path + location.search).slice(0, 200), src: source(), lang: (navigator.language || '').slice(0, 2) });
    try { sessionStorage.setItem('aq_st', sid); } catch (e) {}
  }
  var later = function (fn) { setTimeout(fn, started ? 0 : Math.max(0, 1200 - (Date.now() - T0))); };
  // ===== الصفحة المتصفَّحة =====
  var PAGES = { 'index': 'الرئيسية', 'listings': 'العقارات', 'property-details': 'تفاصيل عقار', 'search': 'البحث', 'find': 'البحث', 'map': 'الخريطة', 'projects': 'مشاريع على الخارطة', 'project': 'تفاصيل مشروع', 'stays': 'الإقامات القصيرة', 'stay': 'تفاصيل إقامة', 'cars': 'موتورات', 'car': 'تفاصيل مركبة', 'lands': 'الأراضي', 'offers': 'العروض', 'brokers-directory': 'دليل الوسطاء', 'top-brokers': 'أفضل الوسطاء', 'agents': 'الوسطاء', 'services-directory': 'دليل الخدمات', 'pros': 'المهنيون', 'pro': 'بوابة المهنيين', 'join': 'انضم إلينا', 'broker-registration': 'تسجيل وسيط', 'add-property': 'إضافة عقار', 'add-car': 'إضافة مركبة', 'sell-or-rent': 'بيع أو تأجير عقارك', 'request': 'اطلب عقارك', 'valuation': 'تقييم عقار', 'calculator': 'حاسبة التمويل', 'compare': 'المقارنة', 'areas': 'دليل المناطق', 'schools': 'المدارس', 'transport': 'المواصلات', 'my': 'قوائمي', 'dashboard': 'لوحة المستخدم', 'about': 'من نحن', 'brochure': 'البروشور', 'report': 'بلاغ', 'claim-profile': 'المطالبة بملف', 'broker-profile': 'ملف وسيط', 'individual-broker-profile': 'ملف وسيط', 'broker-directory-profile': 'ملف مكتب', 'developer-profile': 'ملف مطوّر', 'privacy-policy': 'سياسة الخصوصية', 'terms-of-service': 'الشروط', 'ad-rules': 'قواعد الإعلان', 'account-deletion': 'حذف الحساب' };
  var file = (path.split('/').pop() || 'index').replace(/\.html$/, '') || 'index';
  function pageName() {
    if (/^\/area\//.test(path)) { var h = document.querySelector('h1'); return 'منطقة: ' + ((h && h.textContent.trim()) || file).slice(0, 60); }
    if (/^\/property\//.test(path)) return 'تفاصيل عقار';
    if (PAGES[file]) return PAGES[file];
    var t = (document.title || '').split(/[|\-–—]/)[0].trim(); return t || file;
  }
  var lastView = '';
  function view(label) {
    label = String(label || '').replace(/\s+/g, ' ').trim().slice(0, 100); if (!label || label === lastView) return; lastView = label;
    later(function () { send('view', { label: label }); });
  }
  window.addEventListener('load', function () { setTimeout(function () { view(pageName()); }, 300); });
  // ===== الإعلان المفتوح (عقار، مشروع، إقامة، مركبة، ملف مهني) =====
  var ITEM = { 'property-details': 'عقار', 'project': 'مشروع', 'stay': 'إقامة', 'car': 'مركبة', 'broker-profile': 'وسيط', 'individual-broker-profile': 'وسيط', 'broker-directory-profile': 'مكتب', 'developer-profile': 'مطوّر' };
  var itemId = (/[?&]id=([^&#]+)/.exec(location.search) || [])[1] || (/^\/property\/([^\/.]+)/.exec(path) || [])[1] || '';
  var itemType = ITEM[file] || (/^\/property\//.test(path) ? 'عقار' : '');
  function itemTitle() {
    var el = document.getElementById('propTitle') || document.querySelector('h1');
    var t = el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    return t && !/جاري|تحميل|loading/i.test(t) ? t.slice(0, 90) : '';
  }
  var itemLbl = '';
  function sendItem() {   // يُرسل مرة واحدة، ويُستعمل الاسم نفسه في نقرات التواصل ليرتبطا في التقرير
    if (itemLbl) return itemLbl;
    itemLbl = (itemType + ': ' + (itemTitle() || itemId)).slice(0, 100);
    var l = itemLbl; later(function () { send('item', { label: l, ref: String(itemId).slice(0, 60) }); });
    return itemLbl;
  }
  if (itemType && itemId) {
    var tries = 0;
    (function waitTitle() { if (itemLbl) return; if (itemTitle() || tries++ > 20) { sendItem(); return; } setTimeout(waitTitle, 500); })();
  }
  // ===== نقرات التواصل =====
  var contacted = {};
  function contact(url) {
    url = String(url || '');
    var k = /^tel:/i.test(url) ? 'call' : /wa\.me|whatsapp\.com|^whatsapp:/i.test(url) ? 'whatsapp' : /^mailto:/i.test(url) ? 'email' : '';
    if (!k) return;
    if (/wa\.me\/?\?|whatsapp\.com\/send\?text=/i.test(url)) return;   // مشاركة عبر واتساب، ليست تواصلًا مع معلن
    var lb = (itemType && itemId) ? sendItem() : pageName().slice(0, 100);
    if (contacted[k + lb]) return; contacted[k + lb] = 1;
    later(function () { send('contact', { label: lb, ref: k + (itemId ? ':' + String(itemId).slice(0, 50) : '') }); });
  }
  document.addEventListener('click', function (e) { var a = e.target && e.target.closest && e.target.closest('a[href]'); if (a) contact(a.getAttribute('href')); }, true);
  try { var wo = window.open; window.open = function (u) { try { contact(u); } catch (e) {} return wo.apply(this, arguments); }; } catch (e) {}
  // ===== مدة البقاء =====
  setInterval(function () { if (document.visibilityState === 'visible') send('beat', {}); }, 20000);
  addEventListener('pagehide', function () { send('beat', {}); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') send('beat', {}); });
})();
