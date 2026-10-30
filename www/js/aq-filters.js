/* فلاتر البحث المتقدمة في الصفحة الرئيسية لأنا عقار
   السعر والمساحة (من/إلى)، الغرف والحمامات، نوع العقار، الفرش، الفاخر، البحر، القرب من المعالم، المزايا، حالة الإنجاز.
   العقار الذي أدخل صاحبه هذه البيانات يُفلتر بها مباشرة، وغيره يُستنتج من عنوانه ووصفه ومنطقته. */
(function () {
  'use strict';
  const SQFT = 10.7639;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- القوائم ----------
  const UNITS = {
    residential: [['apartment', 'شقة'], ['studio', 'استوديو'], ['villa', 'فيلا'], ['townhouse', 'تاون هاوس'], ['penthouse', 'بنتهاوس'], ['duplex', 'دوبلكس'], ['chalet', 'شاليه'], ['hotel_apt', 'شقق فندقية']],
    commercial: [['office', 'مكتب'], ['shop', 'محل تجاري'], ['warehouse', 'مستودع'], ['showroom', 'معرض'], ['land', 'أرض'], ['building', 'مبنى كامل']]
  };
  const UNIT_WORDS = { apartment: /شقة|شقق(?! فندقية)/, studio: /استوديو|ستوديو/, villa: /فيلا|فلة|فيلّا/, townhouse: /تاون ?هاوس/, penthouse: /بنتهاوس|بنت هاوس/, duplex: /دوبلكس|دوبليكس/, chalet: /شاليه/, hotel_apt: /شقق فندقية|شقة فندقية/,
    office: /مكتب/, shop: /محل/, warehouse: /مستودع|مخزن/, showroom: /معرض/, land: /أرض/, building: /مبنى كامل|بناية كاملة|عمارة/ };
  const NEAR = [['beach', '🏖️ البحر والشاطئ'], ['metro', '🚇 مترو'], ['mall', '🛒 مول'], ['school', '🏫 مدارس'], ['university', '🎓 جامعة'], ['hospital', '🏥 مستشفى'], ['mosque', '🕌 مسجد'], ['park', '🌳 حديقة'], ['supermarket', '🥦 سوبرماركت'], ['airport', '✈️ المطار']];
  const AMEN = [['pool', 'مسبح'], ['gym', 'نادي رياضي'], ['parking', 'موقف سيارات'], ['balcony', 'شرفة'], ['maid', 'غرفة خادمة'], ['central_ac', 'تكييف مركزي'], ['security', 'حراسة وأمن'], ['garden', 'حديقة خاصة'], ['pets', 'يُسمح بالحيوانات الأليفة'], ['kids', 'منطقة ألعاب أطفال']];
  const AMEN_WORDS = { pool: /مسبح|حمام سباحة|pool/i, gym: /نادي رياضي|جيم|صالة رياضية|gym/i, parking: /موقف|مواقف|باركنج|جراج|كراج|parking/i, balcony: /شرفة|بلكون|تراس/, maid: /غرفة (خادمة|خادمه|عاملة)/, central_ac: /تكييف مركزي/, security: /حراسة|أمن على مدار|أمن 24/, garden: /حديقة خاصة|حديقة/, pets: /حيوانات أليفة/, kids: /ألعاب أطفال|منطقة أطفال/ };

  // مناطق معروفة (الاستنتاج للعقارات التي لم يحدد صاحبها هذه البيانات)
  const AREA = {
    beachfront: ['نخلة جميرا', 'النخلة', 'جميرا بيتش', 'JBR', 'جزيرة المرجان', 'جزر دبي', 'بلوواترز', 'بيتشفرونت', 'Beachfront', 'السعديات', 'جزيرة الحديريات'],
    near_sea: ['دبي مارينا', 'مارينا', 'Marina', 'جميرا 1', 'جميرا 2', 'جميرا 3', 'أم سقيم', 'الصفوح', 'لؤلؤة جميرا', 'ميناء راشد', 'دبي هاربر', 'مدينة دبي الملاحية', 'الممزر', 'جزيرة الريم', 'الراحة', 'كورنيش'],
    metro: ['دبي مارينا', 'مارينا', 'أبراج بحيرات جميرا', 'JLT', 'وسط مدينة دبي', 'داون تاون', 'Downtown', 'الخليج التجاري', 'Business Bay', 'ديرة', 'بر دبي', 'الكرامة', 'البرشاء', 'ديسكفري جاردنز', 'الفرجان', 'الجداف', 'القصيص', 'الرقة', 'المركز المالي', 'DIFC', 'مدينة دبي للإنترنت', 'الصفوح', 'جبل علي'],
    mall: ['وسط مدينة دبي', 'داون تاون', 'Downtown', 'دبي مارينا', 'مارينا', 'البرشاء', 'ديرة', 'جميرا بيتش', 'JBR', 'دبي هيلز', 'مردف', 'ديسكفري جاردنز', 'الكرامة', 'جزيرة ياس', 'جزيرة الريم'],
    airport: ['ديرة', 'القصيص', 'مردف', 'الكرامة', 'الجداف', 'دبي الجنوب', 'الغرهود', 'الطوار'],
    school: ['البرشاء', 'المرابع العربية', 'دبي هيلز', 'الينابيع', 'تلال الإمارات', 'مردف', 'القرهود', 'الورقاء', 'واحة دبي للسيليكون', 'قرية جميرا الدائرية', 'JVC'],
    park: ['دبي هيلز', 'المرابع العربية', 'الخليج التجاري', 'مردف', 'قرية جميرا الدائرية', 'JVC', 'الصفوح']
  };
  const NEAR_WORDS = { beach: /بحر|شاطئ|بيتش/, metro: /مترو/, mall: /مول|مركز تسوق/, school: /مدرس/, university: /جامع(ة|ات)|كلية/, hospital: /مستشفى|مستشفيات/, mosque: /مسجد|جامع /, park: /حديقة|منتزه|بارك/, supermarket: /سوبر ?ماركت|هايبر/, airport: /مطار/ };
  const inArea = (t, k) => AREA[k].some((a) => t.toLowerCase().includes(a.toLowerCase()));

  // ---------- استنتاج صفات العقار ----------
  const cache = new WeakMap();
  function attrs(p) {
    if (cache.has(p)) return cache.get(p);
    const t = `${p.title || ''} ${p.description || ''} ${p.propertyType || ''} ${p.city || ''}`;
    const tl = t.toLowerCase();
    const commercial = /تجاري|مكتب|محل|مستودع|ورشة|معرض|مصنع/.test(p.propertyType || '') || /^(office|shop|warehouse|showroom|land|building)$/.test(p.unitType || '');
    let unit = p.unitType || '';
    if (!unit) {
      const src = (p.propertyType || '') + ' ' + (p.title || '');
      for (const k of ['penthouse', 'townhouse', 'villa', 'duplex', 'chalet', 'hotel_apt', 'studio', 'office', 'shop', 'warehouse', 'showroom', 'land', 'building', 'apartment']) { if (UNIT_WORDS[k].test(src)) { unit = k; break; } }
      if (unit === 'apartment' && p.bedrooms === 0) unit = 'studio';
      if (!unit) unit = commercial ? 'office' : 'apartment';
    }
    let furn = p.furnishing || null;
    if (!furn) furn = /غير مفروش|بدون فرش|unfurnished/i.test(t) ? 'unfurnished' : /مفروش(ة)? جزئي|نصف مفروش|شبه مفروش/.test(t) ? 'partly' : /مفروش|مؤثث|furnished/i.test(t) ? 'furnished' : null;
    const price = Number(p.priceAED || p.price || 0);
    const luxury = p.isLuxury === true || /فاخر|فخم|لوكس|راقٍ|راقي|luxury/i.test(t) || unit === 'penthouse' || (p.dealType === 'rent' ? price >= 400000 : price >= 5000000);
    let sea = p.seaAccess || null;
    if (!sea) {
      if (/على البحر مباشرة|واجهة (بحرية|مائية)|شاطئية|شاطئ خاص|beachfront/i.test(t) || inArea(t, 'beachfront')) sea = 'beachfront';
      else if (/إطلالة (بحرية|على البحر|على المارينا)|اطلالة بحرية|sea view/i.test(t)) sea = 'sea_view';
      else if (/بحر|شاطئ/.test(t) || inArea(t, 'near_sea')) sea = 'near_sea';
    }
    const amen = new Set(p.amenities || []);
    Object.keys(AMEN_WORDS).forEach((k) => { if (AMEN_WORDS[k].test(t)) amen.add(k); });
    const near = new Set(p.nearby || []);
    Object.keys(NEAR_WORDS).forEach((k) => { if (NEAR_WORDS[k].test(t)) near.add(k); });
    ['metro', 'mall', 'airport', 'school', 'park'].forEach((k) => { if (inArea(t, k)) near.add(k); });
    if (sea) near.add('beach');
    const a = { commercial, unit, furn, luxury, sea, amen, near, area: Number(p.area_m2 || 0), price, beds: p.bedrooms, baths: p.bathrooms };
    cache.set(p, a);
    void tl;
    return a;
  }

  // ---------- حالة الفلاتر ----------
  const blank = () => ({ pmin: '', pmax: '', amin: '', amax: '', aunit: 'm2', cat: '', units: [], beds: [], baths: [], furn: '', luxury: false, sea: '', near: [], amen: [], status: '', noComm: false, verified: false, tour: false, offer: false });
  let S = blank();
  const save = () => { try { sessionStorage.setItem('aq_filters', JSON.stringify(S)); } catch (e) {} };

  function match(p) {
    const a = attrs(p);
    if (S.pmin !== '' && a.price < +S.pmin) return false;
    // الحد الأقصى للسعر تطبّقه خانة «السعر الأقصى» في البحث الرئيسي (تُزامَن معها هذه الخانة)
    const k = S.aunit === 'sqft' ? 1 / SQFT : 1;
    if (S.amin !== '' && (!a.area || a.area < +S.amin * k)) return false;
    if (S.amax !== '' && (!a.area || a.area > +S.amax * k)) return false;
    if (S.cat === 'residential' && a.commercial) return false;
    if (S.cat === 'commercial' && !a.commercial) return false;
    if (S.units.length && !S.units.includes(a.unit)) return false;
    if (S.beds.length) { const b = a.beds == null ? -1 : +a.beds; if (!S.beds.some((x) => x === '6+' ? b >= 6 : +x === b)) return false; }
    if (S.baths.length) { const b = a.baths == null ? -1 : +a.baths; if (!S.baths.some((x) => x === '5+' ? b >= 5 : +x === b)) return false; }
    if (S.furn && a.furn !== S.furn) return false;
    if (S.luxury && !a.luxury) return false;
    if (S.sea === 'beachfront' && a.sea !== 'beachfront') return false;
    if (S.sea === 'sea_view' && !['beachfront', 'sea_view'].includes(a.sea)) return false;
    if (S.sea === 'near_sea' && !a.sea) return false;
    if (S.near.length && !S.near.every((x) => a.near.has(x))) return false;
    if (S.amen.length && !S.amen.every((x) => a.amen.has(x))) return false;
    if (S.status && (p.completionStatus || 'ready') !== S.status) return false;
    if (S.noComm && !(p.noCommission === true || /^\s*0+(\.0+)?\s*%?\s*$/.test(String(p.commission ?? 'x')))) return false;
    if (S.verified && !p.isVerified) return false;
    if (S.tour && !p.has3DTour) return false;
    if (S.offer && !p.hasOffer) return false;
    return true;
  }
  function activeCount() {
    let n = 0;
    if (S.pmin !== '' || S.pmax !== '') n++; if (S.amin !== '' || S.amax !== '') n++;
    ['cat', 'furn', 'sea', 'status'].forEach((k) => { if (S[k]) n++; });
    ['units', 'beds', 'baths', 'near', 'amen'].forEach((k) => { if (S[k].length) n++; });
    ['luxury', 'noComm', 'verified', 'tour', 'offer'].forEach((k) => { if (S[k]) n++; });
    return n;
  }
  // مطابقة «قريب من» في القائمة المنسدلة الموجودة أعلى البحث
  function nearMatch(p, key) {
    if (!key) return true;
    const m = { beach: 'beach', metro: 'metro', mall: 'mall', school: 'school', hospital: 'hospital', mosque: 'mosque', park: 'park', supermarket: 'supermarket', airport: 'airport', clinic: 'hospital', pharmacy: 'supermarket', gym: 'gym', church: 'church' }[key] || key;
    const a = attrs(p);
    if (m === 'gym') return a.amen.has('gym') || /نادي|جيم/.test(p.title + ' ' + (p.description || ''));
    if (m === 'church') return /كنيسة/.test(p.title + ' ' + (p.description || ''));
    return a.near.has(m);
  }

  // ---------- الواجهة ----------
  const css = `
  .aqf-btn{position:relative;display:inline-flex;align-items:center;gap:8px;border:1.5px solid rgba(0,168,150,.5);background:#fff;color:#0f172a;border-radius:12px;padding:10px 16px;font:800 14.5px Tajawal,sans-serif;cursor:pointer;min-height:46px}
  [data-theme="dark"] .aqf-btn{background:#162039;color:#e2e8f0}
  .aqf-btn .n{background:#e11d48;color:#fff;border-radius:999px;font-size:12px;min-width:22px;height:22px;display:inline-grid;place-items:center;padding:0 6px}
  .aqf-btn .n:empty{display:none}
  .aqf-ov{position:fixed;inset:0;z-index:2147483000;background:rgba(2,8,23,.55);display:flex;align-items:flex-end;justify-content:center;font-family:Tajawal,sans-serif;direction:rtl}
  .aqf-sheet{--c:#ffffff;--i:#0f172a;--m:#64748b;--l:#e2e8f0;--t:#00a896;--ts:#e6f7f5;background:var(--c);color:var(--i);width:min(720px,100%);max-height:92vh;border-radius:22px 22px 0 0;display:flex;flex-direction:column;animation:aqfUp .25s ease-out}
  [data-theme="dark"] .aqf-sheet{--c:#0f172a;--i:#e2e8f0;--m:#94a3b8;--l:#2b3654;--ts:#0f2e33}
  @media(min-width:760px){.aqf-ov{align-items:center}.aqf-sheet{border-radius:22px;max-height:88vh}}
  @keyframes aqfUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
  .aqf-h{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--l)}
  .aqf-h b{font-size:19px;font-weight:900}.aqf-h button{border:0;background:none;color:var(--i);font-size:22px;cursor:pointer;width:40px;height:40px}
  .aqf-b{overflow-y:auto;padding:6px 18px 18px;flex:1}
  .aqf-s{padding:14px 0;border-bottom:1px solid var(--l)}.aqf-s:last-child{border:0}
  .aqf-s>h4{margin:0 0 10px;font-size:15.5px;font-weight:900;display:flex;justify-content:space-between;align-items:center;gap:8px}
  .aqf-s>h4 small{color:var(--m);font-weight:700;font-size:12.5px}
  .aqf-rg{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center}
  .aqf-rg input{width:100%;min-width:0;border:1.5px solid var(--l);background:var(--c);color:var(--i);border-radius:12px;padding:11px 12px;font:inherit;font-size:15px;outline:none}
  .aqf-rg input:focus{border-color:var(--t)}.aqf-rg span{color:var(--m);font-weight:800}
  .aqf-ch{display:flex;flex-wrap:wrap;gap:8px}
  .aqf-ch button{border:1.5px solid var(--l);background:var(--c);color:var(--i);border-radius:999px;padding:8px 14px;font:inherit;font-weight:800;font-size:14px;cursor:pointer;min-height:40px}
  .aqf-ch button.on{background:var(--t);border-color:var(--t);color:#fff}
  .aqf-sw{display:flex;align-items:center;justify-content:space-between;gap:12px;font-weight:800;padding:6px 0;cursor:pointer}
  .aqf-sw input{width:46px;height:26px;appearance:none;-webkit-appearance:none;background:var(--l);border-radius:999px;position:relative;cursor:pointer;flex:0 0 auto;transition:.2s}
  .aqf-sw input::after{content:'';position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.3)}
  .aqf-sw input:checked{background:var(--t)}.aqf-sw input:checked::after{right:23px}
  .aqf-sw small{display:block;color:var(--m);font-weight:600;font-size:12.5px}
  .aqf-u{display:inline-flex;border:1.5px solid var(--l);border-radius:10px;overflow:hidden}.aqf-u button{border:0;background:var(--c);color:var(--i);padding:5px 10px;font:inherit;font-weight:800;font-size:12.5px;cursor:pointer}.aqf-u button.on{background:var(--t);color:#fff}
  .aqf-f{display:flex;gap:10px;padding:12px 18px calc(12px + env(safe-area-inset-bottom));border-top:1px solid var(--l)}
  .aqf-f button{border:0;border-radius:14px;padding:13px 16px;font:inherit;font-weight:900;font-size:15.5px;cursor:pointer}
  .aqf-clear{background:transparent;color:var(--i);text-decoration:underline}.aqf-go{flex:1;background:var(--t);color:#fff}
  .aqf-tags{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 0}.aqf-tags button{border:0;background:#e6f7f5;color:#028090;border-radius:999px;padding:5px 12px;font:800 13px Tajawal,sans-serif;cursor:pointer}
  .aqf-hint{color:var(--m);font-size:12.5px;margin:8px 0 0}`;

  function chips(key, list, multi) {
    return `<div class="aqf-ch" data-k="${key}" data-multi="${multi ? 1 : 0}">${list.map(([v, t]) => `<button type="button" data-v="${esc(v)}" class="${(multi ? S[key].includes(v) : S[key] === v) ? 'on' : ''}">${esc(t)}</button>`).join('')}</div>`;
  }
  function sw(key, title, sub) { return `<label class="aqf-sw"><span>${title}${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" data-sw="${key}" ${S[key] ? 'checked' : ''}></label>`; }

  let ov = null;
  function open() {
    if (!document.getElementById('aqfCss')) { const st = document.createElement('style'); st.id = 'aqfCss'; st.textContent = css; document.head.appendChild(st); }
    // السعر الأقصى المكتوب في خانة البحث الرئيسية يظهر هنا
    const mp = document.getElementById('maxPriceInput'); if (mp) S.pmax = mp.value.trim();
    ov = document.createElement('div'); ov.className = 'aqf-ov';
    const unitList = S.cat === 'commercial' ? UNITS.commercial : S.cat === 'residential' ? UNITS.residential : UNITS.residential.concat(UNITS.commercial);
    ov.innerHTML = `<div class="aqf-sheet" role="dialog" aria-modal="true" aria-label="الفلاتر">
      <div class="aqf-h"><b>الفلاتر</b><button type="button" data-x aria-label="إغلاق">×</button></div>
      <div class="aqf-b">
        <div class="aqf-s"><h4>السعر <small>بالدرهم</small></h4><div class="aqf-rg"><input data-in="pmin" type="number" inputmode="numeric" placeholder="من" value="${esc(S.pmin)}"><span>إلى</span><input data-in="pmax" type="number" inputmode="numeric" placeholder="إلى" value="${esc(S.pmax)}"></div></div>
        <div class="aqf-s"><h4>نوع العقار</h4>${chips('cat', [['', 'الكل'], ['residential', 'سكني'], ['commercial', 'تجاري']], false)}<div style="height:10px"></div>${chips('units', unitList, true)}</div>
        <div class="aqf-s"><h4>غرف النوم</h4>${chips('beds', [['0', 'استوديو'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6+', '6 وأكثر']], true)}</div>
        <div class="aqf-s"><h4>الحمامات</h4>${chips('baths', [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5+', '5 وأكثر']], true)}</div>
        <div class="aqf-s"><h4>المساحة <span class="aqf-u" data-unit><button type="button" data-u="m2" class="${S.aunit === 'm2' ? 'on' : ''}">متر²</button><button type="button" data-u="sqft" class="${S.aunit === 'sqft' ? 'on' : ''}">قدم²</button></span></h4>
          <div class="aqf-rg"><input data-in="amin" type="number" inputmode="numeric" placeholder="من" value="${esc(S.amin)}"><span>إلى</span><input data-in="amax" type="number" inputmode="numeric" placeholder="إلى" value="${esc(S.amax)}"></div></div>
        <div class="aqf-s"><h4>الفرش</h4>${chips('furn', [['', 'الكل'], ['furnished', 'مفروش'], ['unfurnished', 'غير مفروش'], ['partly', 'مفروش جزئيًا']], false)}</div>
        <div class="aqf-s"><h4>البحر والإطلالة</h4>${chips('sea', [['', 'الكل'], ['beachfront', 'على البحر مباشرة'], ['sea_view', 'إطلالة بحرية (Sea View)'], ['near_sea', 'قريب من البحر']], false)}</div>
        <div class="aqf-s">${sw('luxury', '✨ عقارات فاخرة (Luxury)', 'عقارات راقية بتشطيبات ومواقع مميزة')}</div>
        <div class="aqf-s"><h4>قريب من</h4>${chips('near', NEAR, true)}</div>
        <div class="aqf-s"><h4>المزايا</h4>${chips('amen', AMEN, true)}</div>
        <div class="aqf-s"><h4>حالة العقار</h4>${chips('status', [['', 'الكل'], ['ready', 'جاهز'], ['off_plan', 'على الخارطة'], ['under_construction', 'تحت الإنشاء']], false)}</div>
        <div class="aqf-s">${sw('noComm', 'بدون عمولة')}${sw('verified', 'إعلانات موثّقة')}${sw('tour', 'فيها جولة افتراضية 3D')}${sw('offer', 'عليها عرض أو خصم')}
          <p class="aqf-hint">بعض الصفات تُستنتج من وصف الإعلان ومنطقته إذا لم يحددها المعلن.</p></div>
      </div>
      <div class="aqf-f"><button type="button" class="aqf-clear" data-clear>مسح الكل</button><button type="button" class="aqf-go" data-go>عرض النتائج</button></div></div>`;
    document.body.appendChild(ov);
    document.documentElement.style.overflow = 'hidden';
    const close = () => { if (!ov) return; ov.remove(); ov = null; document.documentElement.style.overflow = ''; };
    ov.addEventListener('click', (e) => {
      if (e.target === ov || e.target.closest('[data-x]')) return close();
      const u = e.target.closest('[data-u]');
      if (u) { const old = S.aunit, nw = u.dataset.u; if (old !== nw) { const f = nw === 'sqft' ? SQFT : 1 / SQFT; ['amin', 'amax'].forEach((k) => { if (S[k] !== '') S[k] = String(Math.round(+S[k] * f)); ov.querySelector(`[data-in="${k}"]`).value = S[k]; }); S.aunit = nw; } ov.querySelectorAll('[data-u]').forEach((b) => b.classList.toggle('on', b === u)); return refresh(); }
      const b = e.target.closest('.aqf-ch button');
      if (b) {
        const box = b.parentNode, k = box.dataset.k, v = b.dataset.v;
        if (box.dataset.multi === '1') { const i = S[k].indexOf(v); if (i === -1) S[k].push(v); else S[k].splice(i, 1); b.classList.toggle('on'); }
        else { S[k] = v; box.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); }
        if (k === 'cat') { S.units = []; close(); open(); return; }
        return refresh();
      }
      if (e.target.closest('[data-clear]')) { S = blank(); const mp2 = document.getElementById('maxPriceInput'); if (mp2) mp2.value = ''; close(); open(); return; }
      if (e.target.closest('[data-go]')) { close(); apply(); }
    });
    ov.querySelectorAll('[data-in]').forEach((i) => i.addEventListener('input', () => { S[i.dataset.in] = i.value.trim(); if (i.dataset.in === 'pmax') { const m = document.getElementById('maxPriceInput'); if (m) m.value = S.pmax; } refresh(); }));
    ov.querySelectorAll('[data-sw]').forEach((i) => i.addEventListener('change', () => { S[i.dataset.sw] = i.checked; refresh(); }));
    refresh();
  }
  let rt;
  function refresh() {
    save(); badge();
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (!ov) return;
      let n = null;
      try { if (typeof window.aqBuildSearchPredicate === 'function' && typeof getAllProperties === 'function') { const pr = window.aqBuildSearchPredicate(); n = getAllProperties().filter(pr).length; } } catch (e) {}
      const go = ov.querySelector('[data-go]');
      go.textContent = n == null ? 'عرض النتائج' : n ? `عرض ${n.toLocaleString('en-US')} عقار` : 'لا نتائج — خفّف الفلاتر';
    }, 120);
  }
  function apply() {
    const mp = document.getElementById('maxPriceInput'); if (mp) mp.value = S.pmax;
    save(); badge(); tags();
    if (typeof window.executeSearch === 'function') window.executeSearch();
  }
  function badge() { document.querySelectorAll('[data-aqf-count]').forEach((el) => { el.textContent = activeCount() || ''; }); }
  const LABEL = (k, v) => {
    const f = (list) => (list.find((x) => x[0] === v) || [, v])[1];
    return { units: () => f(UNITS.residential.concat(UNITS.commercial)), beds: () => v === '0' ? 'استوديو' : v === '6+' ? '6 غرف وأكثر' : v + ' غرف', baths: () => v === '5+' ? '5 حمامات وأكثر' : v + ' حمام', near: () => 'قريب من ' + f(NEAR).replace(/^\S+\s/, ''), amen: () => f(AMEN) }[k]();
  };
  function tags() {
    const box = document.getElementById('aqfTags'); if (!box) return;
    const t = [];
    const mp = document.getElementById('maxPriceInput'); S.pmax = mp ? mp.value.trim() : S.pmax;
    if (S.pmin !== '' || S.pmax !== '') t.push(['price', 'السعر ' + (S.pmin !== '' ? 'من ' + Number(S.pmin).toLocaleString('en-US') + ' ' : '') + (S.pmax !== '' ? 'حتى ' + Number(S.pmax).toLocaleString('en-US') : '') + ' درهم']);
    if (S.amin !== '' || S.amax !== '') t.push(['area', 'المساحة ' + (S.amin !== '' ? 'من ' + S.amin + ' ' : '') + (S.amax !== '' ? 'حتى ' + S.amax : '') + (S.aunit === 'sqft' ? ' قدم²' : ' م²')]);
    if (S.cat) t.push(['cat', S.cat === 'commercial' ? 'تجاري' : 'سكني']);
    ['units', 'beds', 'baths', 'near', 'amen'].forEach((k) => S[k].forEach((v) => t.push([k + ':' + v, LABEL(k, v)])));
    if (S.furn) t.push(['furn', { furnished: 'مفروش', unfurnished: 'غير مفروش', partly: 'مفروش جزئيًا' }[S.furn]]);
    if (S.sea) t.push(['sea', { beachfront: 'على البحر مباشرة', sea_view: 'إطلالة بحرية', near_sea: 'قريب من البحر' }[S.sea]]);
    if (S.status) t.push(['status', { ready: 'جاهز', off_plan: 'على الخارطة', under_construction: 'تحت الإنشاء' }[S.status]]);
    [['luxury', 'فاخر'], ['noComm', 'بدون عمولة'], ['verified', 'موثّق'], ['tour', 'جولة 3D'], ['offer', 'عليه عرض']].forEach(([k, l]) => { if (S[k]) t.push([k, l]); });
    box.innerHTML = t.map(([k, l]) => `<button type="button" data-rm="${esc(k)}" aria-label="إزالة ${esc(l)}">${esc(l)} ×</button>`).join('');
    box.hidden = !t.length;
  }
  function removeTag(k) {
    if (k === 'price') { S.pmin = ''; S.pmax = ''; const m = document.getElementById('maxPriceInput'); if (m) m.value = ''; } else if (k === 'area') { S.amin = ''; S.amax = ''; }
    else if (k.includes(':')) { const [a, v] = k.split(':'); S[a] = S[a].filter((x) => x !== v); }
    else if (typeof S[k] === 'boolean') S[k] = false; else S[k] = '';
    apply();
  }

  function mount() {
    const bar = document.querySelector('.pearl-action-bar .hero-center-badges');
    if (!bar || document.getElementById('aqfOpen')) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'aqfOpen'; btn.className = 'hero-badge-btn aqf-btn';
    btn.innerHTML = '<i class="fas fa-sliders"></i> الفلاتر <span class="n" data-aqf-count></span>';
    btn.onclick = open;
    bar.insertBefore(btn, bar.firstChild);
    const tg = document.createElement('div'); tg.id = 'aqfTags'; tg.className = 'aqf-tags'; tg.hidden = true;
    const card = document.querySelector('.pearl-search-card'); if (card) card.appendChild(tg);
    tg.addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) removeTag(b.dataset.rm); });
    if (!document.getElementById('aqfCss')) { const st = document.createElement('style'); st.id = 'aqfCss'; st.textContent = css; document.head.appendChild(st); }
    badge(); tags();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();

  window.AQFilters = { open, match, attrs, nearMatch, state: () => S, activeCount, apply };
})();
