-- ============================================================================
-- دليل الخدمات — دفعة 10: شركات مقاولات وعزل وهندسة وديكور ومكافحة حشرات ونظافة وحدائق
-- المصدر: دليل Gludo للأعمال في الإمارات (رابط صفحة كل شركة في source_url)، والمواقع الرسمية للشركات.
-- تُدرج مفعّلة وغير «موثّقة الرخصة». آمن لو أُعيد تشغيله (لا يكرّر شركة بنفس القسم والإمارة والاسم).
-- ============================================================================
do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'aq_rate_limit_service_providers') then
    alter table public.service_providers disable trigger aq_rate_limit_service_providers;
  end if;
end $$;

insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'contracting', 'الريان للعزل', 'Al Rayan Insulation', 'عجمان', null, '+971557437038', 'https://alrayaninsulation.com', null, 'العزل المائي والحراري، وطلاء البوليوريا، وتبطين GRP، وحقن الشقوق، وطلاء الأرضيات الصناعية.', 'https://gludo.org/business-directory/5057-al-rayan-insulation', true
where not exists (select 1 from public.service_providers where category = 'contracting' and emirate = 'عجمان' and lower(coalesce(name_en, name_ar)) = lower('Al Rayan Insulation'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'contracting', 'ماتريكس للعزل المائي وإصلاح المباني', 'Matrix Building Waterproofing & Fixing LLC', 'دبي', 'هور العنز شرق', '+97143349144', 'https://matrixbldg.com', 2015, 'عزل مائي وحراري للأسطح والجدران، وطلاء الواجهات، وترميم الأسطح، وأنظمة طلاء الأرضيات.', 'https://gludo.org/business-directory/5056-matrix-bldg-waterproofing-fixing-llc', true
where not exists (select 1 from public.service_providers where category = 'contracting' and emirate = 'دبي' and lower(coalesce(name_en, name_ar)) = lower('Matrix Building Waterproofing & Fixing LLC'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'contracting', 'شركة المجد لمواد العازلة', 'Al Majd Insulation Materials Co. LLC', 'أبوظبي', 'آل نهيان', null, 'https://amim.ae', 1998, 'أنظمة العزل المائي للأساسات والمناطق الرطبة والأسطح، والعزل الحراري.', 'https://gludo.org/business-directory/5055-al-majd-insulation-materials-co-llc', true
where not exists (select 1 from public.service_providers where category = 'contracting' and emirate = 'أبوظبي' and lower(coalesce(name_en, name_ar)) = lower('Al Majd Insulation Materials Co. LLC'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'contracting', 'ديزرت روفينج وفلورينج (درفكو القابضة)', 'Desert Roofing & Flooring LLC', 'دبي', 'رأس الخور الصناعية', '+97143331003', 'https://drfcoholding.com', 1978, 'العزل المائي والحراري والتسقيف والأرضيات وإدارة المرافق والتجهيزات الداخلية.', 'https://gludo.org/business-directory/5053-desert-roofing-flooring-llc-drfco-holding', true
where not exists (select 1 from public.service_providers where category = 'contracting' and emirate = 'دبي' and lower(coalesce(name_en, name_ar)) = lower('Desert Roofing & Flooring LLC'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'contracting', 'ووتر سيل', 'Water Seal', 'الشارقة', 'الصجعة الصناعية', '+97165614181', 'https://watersealuae.com', null, 'العزل المائي والحراري للأسطح، والترميم والصيانة، والتقوية الإنشائية، والأرضيات والتشطيبات.', 'https://gludo.org/business-directory/5048-water-seal', true
where not exists (select 1 from public.service_providers where category = 'contracting' and emirate = 'الشارقة' and lower(coalesce(name_en, name_ar)) = lower('Water Seal'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'contracting', 'ريجنز للعزل المائي والمقاولات', 'Regions Waterproofing & Contracting LLC', 'أبوظبي', 'شارع الفلاح', '+97125520717', 'https://regionsae.com', null, 'عزل الأساسات والأسطح والمناطق الرطبة، وأرضيات الإيبوكسي، وإصلاح الشقوق وحقن التسريبات.', 'https://gludo.org/business-directory/5047-regions-waterproofing-contracting-llc', true
where not exists (select 1 from public.service_providers where category = 'contracting' and emirate = 'أبوظبي' and lower(coalesce(name_en, name_ar)) = lower('Regions Waterproofing & Contracting LLC'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'pest', 'اكيوريت لخدمات مكافحة الحشرات', 'Accurate Pest Control Services LLC', 'دبي', 'القصيص الصناعية 4', '+971524496173', 'https://accuratepestcontrol.ae', null, 'مكافحة حشرات معتمدة من بلدية دبي للمنازل والمطاعم والعيادات والمستودعات، مع تفتيش وتقارير.', 'https://gludo.org/business-directory/3423-accurate-pest-control-services-llc', true
where not exists (select 1 from public.service_providers where category = 'pest' and emirate = 'دبي' and lower(coalesce(name_en, name_ar)) = lower('Accurate Pest Control Services LLC'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'pest', 'شركة تدوين لمكافحة الآفات والصحة العامة', 'Tadween Pest Control & Public Health', 'الشارقة', 'مويلح الصناعية', '+97165328977', 'https://tadweenp.ae', null, 'مكافحة الآفات والحشرات للمنازل والمزارع وأماكن العمل والجهات الحكومية.', 'https://gludo.org/business-directory/3422-tadween-company-for-public-health-pest-control', true
where not exists (select 1 from public.service_providers where category = 'pest' and emirate = 'الشارقة' and lower(coalesce(name_en, name_ar)) = lower('Tadween Pest Control & Public Health'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'pest', 'نجمة الهدى لتنظيف المباني ومكافحة الحشرات', 'Najmat Al Huda Building Cleaning & Pest Control', 'الشارقة', 'النباعة', '+97167488560', 'https://www.hudapestcontrol.com', null, 'مكافحة الحشرات وتنظيف المباني للقطاع السكني والتجاري والصناعي، مع معاينة مجانية.', 'https://gludo.org/business-directory/3419-najmat-al-huda-building-cleaning-pest-control', true
where not exists (select 1 from public.service_providers where category = 'pest' and emirate = 'الشارقة' and lower(coalesce(name_en, name_ar)) = lower('Najmat Al Huda Building Cleaning & Pest Control'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'cleaning', 'نجمة الهدى لتنظيف المباني ومكافحة الحشرات', 'Najmat Al Huda Building Cleaning & Pest Control', 'الشارقة', 'النباعة', '+97167488560', 'https://www.hudapestcontrol.com', null, 'تنظيف المباني والمنازل ومكافحة الحشرات، مع معاينة مجانية.', 'https://gludo.org/business-directory/3419-najmat-al-huda-building-cleaning-pest-control', true
where not exists (select 1 from public.service_providers where category = 'cleaning' and emirate = 'الشارقة' and lower(coalesce(name_en, name_ar)) = lower('Najmat Al Huda Building Cleaning & Pest Control'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'pest', 'إيكو جارديانز لمكافحة الحشرات والتطهير والتنظيف', 'Eco Guardians', 'دبي', 'ديرة، بني ياس', '+97142944555', 'https://ecoguardians.ae', null, 'مكافحة الحشرات والتطهير والتنظيف العميق وتنظيف الأثاث.', 'https://gludo.org/business-directory/3418-eco-guardians-pest-control-disinfection-and-cleaning-services', true
where not exists (select 1 from public.service_providers where category = 'pest' and emirate = 'دبي' and lower(coalesce(name_en, name_ar)) = lower('Eco Guardians'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'cleaning', 'إيكو جارديانز لمكافحة الحشرات والتطهير والتنظيف', 'Eco Guardians', 'دبي', 'ديرة، بني ياس', '+97142944555', 'https://ecoguardians.ae', null, 'التنظيف العميق وتنظيف الأثاث والتطهير ومكافحة الحشرات.', 'https://gludo.org/business-directory/3418-eco-guardians-pest-control-disinfection-and-cleaning-services', true
where not exists (select 1 from public.service_providers where category = 'cleaning' and emirate = 'دبي' and lower(coalesce(name_en, name_ar)) = lower('Eco Guardians'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'cleaning', 'إيديال سيرفيسز', 'Ideal Services LLC', 'دبي', 'السطوة', '+971507791314', 'https://idealserviceuae.com', null, 'التطهير والتنظيف العميق والتعقيم، وكشف التسربات والعزل.', 'https://gludo.org/business-directory/3421-ideal-services-llc', true
where not exists (select 1 from public.service_providers where category = 'cleaning' and emirate = 'دبي' and lower(coalesce(name_en, name_ar)) = lower('Ideal Services LLC'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'engineering', 'شكل للهندسة المعمارية', 'Shape Architecture', 'الشارقة', null, '+97165442555', 'https://www.shape.ae', null, 'التصميم المعماري والهندسي والتصميم الداخلي ونمذجة معلومات البناء BIM.', 'https://gludo.org/business-directory/5652-shape-architecture', true
where not exists (select 1 from public.service_providers where category = 'engineering' and emirate = 'الشارقة' and lower(coalesce(name_en, name_ar)) = lower('Shape Architecture'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'contracting', 'ويد آدمز للمقاولات', 'Wade Adams Contracting LLC', 'دبي', 'الخليج التجاري', '+97126819777', 'https://wadeadams.com', null, 'إنشاءات عامة وتطوير مشاريع: طرق وأنفاق وبنية تحتية وأعمال كهروميكانيكية وبحرية.', 'https://gludo.org/business-directory/5646-wade-adams-contracting-llc', true
where not exists (select 1 from public.service_providers where category = 'contracting' and emirate = 'دبي' and lower(coalesce(name_en, name_ar)) = lower('Wade Adams Contracting LLC'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'contracting', 'أجيليتي للهندسة والمقاولات', 'Agility ECC', 'أبوظبي', 'شارع حمدان بن محمد', '+97126262866', 'https://www.agilityecc.com', 2013, 'مقاولات وهندسة لمشاريع البنية التحتية والطرق والجسور والمباني الكبرى.', 'https://gludo.org/business-directory/5644-agility-ecc', true
where not exists (select 1 from public.service_providers where category = 'contracting' and emirate = 'أبوظبي' and lower(coalesce(name_en, name_ar)) = lower('Agility ECC'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'contracting', 'دوتكو للإنشاءات', 'Dutco Construction LLC', 'دبي', 'جبل علي الصناعية الأولى', '+97148801010', 'https://www.dutcoconstruction.com', null, 'الطرق والبنية التحتية والأعمال البحرية والمدنية والمباني والأساسات.', 'https://gludo.org/business-directory/5640-dutco-construction', true
where not exists (select 1 from public.service_providers where category = 'contracting' and emirate = 'دبي' and lower(coalesce(name_en, name_ar)) = lower('Dutco Construction LLC'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'engineering', 'إمارك للاستشارات الهندسية', 'Emarc Engineering Consultant LLC', 'دبي', 'القصيص الصناعية 2', '+971501729743', 'https://emarc.co', 2018, 'التصميم المعماري والإنشائي والكهروميكانيكي، واستخراج الموافقات الرسمية وموافقات الدفاع المدني، والتصور ثلاثي الأبعاد.', 'https://gludo.org/business-directory/5639-emarc-engineering-consultant-llc', true
where not exists (select 1 from public.service_providers where category = 'engineering' and emirate = 'دبي' and lower(coalesce(name_en, name_ar)) = lower('Emarc Engineering Consultant LLC'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'contracting', 'جازال للهندسة والمقاولات', 'Jazal Engineering & Contracting LLC', 'أبوظبي', 'شارع الوحدة', '+97126312800', 'https://jazalec.com', null, 'مقاولات عامة وبنية تحتية وأعمال كهروميكانيكية للمشاريع التجارية والسكنية والصناعية.', 'https://gludo.org/business-directory/5554-jazal-engineering-contracting-llc', true
where not exists (select 1 from public.service_providers where category = 'contracting' and emirate = 'أبوظبي' and lower(coalesce(name_en, name_ar)) = lower('Jazal Engineering & Contracting LLC'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'contracting', 'أرض الأحلام للمقاولات والصيانة العامة', 'Ard Al Ahlam Contracting & General Maintenance', 'أبوظبي', 'مصفح', '+97122367554', 'https://aradelahlam.com', null, 'مقاولات وصيانة المباني والهدم والتشطيبات والأعمال الكهربائية والخرسانية.', 'https://gludo.org/business-directory/5553-arad-elahlam-contracting-general-maintenance-company', true
where not exists (select 1 from public.service_providers where category = 'contracting' and emirate = 'أبوظبي' and lower(coalesce(name_en, name_ar)) = lower('Ard Al Ahlam Contracting & General Maintenance'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'contracting', 'جيومتري لمقاولات البناء', 'Geometry Building Contracting', 'دبي', 'ديرة', '+971544445262', 'https://geometrycontracting.ae', null, 'بناء الفلل والملاحق والمجالس، والصيانة والتشطيبات والديكور الداخلي وتركيب البورسلين.', 'https://gludo.org/business-directory/5552-geometry-building-contracting', true
where not exists (select 1 from public.service_providers where category = 'contracting' and emirate = 'دبي' and lower(coalesce(name_en, name_ar)) = lower('Geometry Building Contracting'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'contracting', 'مهراج للمقاولات', 'Mahraj Constructions', 'دبي', 'الخليج التجاري', '+971545424920', 'https://mahrajconstructions.com', 1995, 'البناء السكني والتجاري والصناعي، والتجديد والتشطيبات الداخلية، والتصميم، والكهروميكانيك.', 'https://gludo.org/business-directory/5551-mahraj-constructions', true
where not exists (select 1 from public.service_providers where category = 'contracting' and emirate = 'دبي' and lower(coalesce(name_en, name_ar)) = lower('Mahraj Constructions'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'interior', 'سبيس ويل للتصميم الداخلي', 'Spacewell Interiors LLC', 'دبي', 'الخليج التجاري', '+97144477301', 'https://www.spacewellinteriors.com', null, 'تصميم داخلي وإدارة مشاريع وتأثيث جاهز للمكاتب والضيافة والمحلات.', 'https://gludo.org/business-directory/5479-spacewell-interiors-llc', true
where not exists (select 1 from public.service_providers where category = 'interior' and emirate = 'دبي' and lower(coalesce(name_en, name_ar)) = lower('Spacewell Interiors LLC'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'garden', 'كاهوت لاندسكيب جاردنينج', 'Kahoot Landscape Gardening LLC', 'دبي', 'دبي ورلد سنترال', '+971502535350', 'https://www.klg.ae', null, 'تنسيق الحدائق وتنفيذ المسابح ومناطق الشواء والبرجولات للمساحات الخارجية.', 'https://gludo.org/business-directory/5344-kahoot-landscape-gardening-llc', true
where not exists (select 1 from public.service_providers where category = 'garden' and emirate = 'دبي' and lower(coalesce(name_en, name_ar)) = lower('Kahoot Landscape Gardening LLC'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'pools', 'كاهوت لاندسكيب جاردنينج', 'Kahoot Landscape Gardening LLC', 'دبي', 'دبي ورلد سنترال', '+971502535350', 'https://www.klg.ae', null, 'تنفيذ حمامات السباحة وتنسيق الحدائق الخارجية.', 'https://gludo.org/business-directory/5344-kahoot-landscape-gardening-llc', true
where not exists (select 1 from public.service_providers where category = 'pools' and emirate = 'دبي' and lower(coalesce(name_en, name_ar)) = lower('Kahoot Landscape Gardening LLC'));
insert into public.service_providers (category, name_ar, name_en, emirate, area, phone, website, founded_year, description, source_url, is_active)
select 'contracting', 'باب القصر للمنازل الجاهزة', 'Bab Al Qasar Prefab Houses', 'الشارقة', 'السجع الصناعية', '+971524755394', 'https://babalqasarprefab.com', 2004, 'كبائن ومبانٍ جاهزة ومكاتب حاويات ومظلات سيارات وخزانات مياه، مع التوصيل والتركيب في كل الإمارات.', 'https://gludo.org/business-directory/5663-bab-al-qasar-prefab-house', true
where not exists (select 1 from public.service_providers where category = 'contracting' and emirate = 'الشارقة' and lower(coalesce(name_en, name_ar)) = lower('Bab Al Qasar Prefab Houses'));
do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'aq_rate_limit_service_providers') then
    alter table public.service_providers enable trigger aq_rate_limit_service_providers;
  end if;
end $$;
select category, count(*) from public.service_providers where is_active group by 1 order by 2 desc;
