-- ============================================================================
-- جدول individual_brokers: يستضيف بيانات الوسطاء العقاريين الأفراد (أشخاص، وليس
-- مكاتب) المسجّلين لدى دائرة الأراضي والأملاك بدبي (DLD)، منقولة من ملفات Excel
-- في dld-brokers-scraper/dld_brokers_output/excel_files عبر
-- scripts/import-individual-brokers.py. هذا جدول منفصل عن brokers (المكاتب
-- العقارية) لأن الكيانين مختلفان: هنا اسم الوسيط الفرد + المكتب الذي يعمل به،
-- بلا تصنيف GOLD/SILVER/BRONZE ولا نشاطات (هذه البيانات غير متوفرة من DLD
-- لكل وسيط فرد). القراءة عامة للجميع؛ الإدخال محصور على service_role فقط
-- (يتجاوز RLS)؛ تفعيل/إلغاء تفعيل الوسيط متاح لأي مستخدم مسجّل دخوله عبر صفحة
-- www/admin/individual-brokers.html (نفس فلسفة برخيص المكاتب في schema.sql).
-- ============================================================================

create table if not exists public.individual_brokers (
  id                 bigint generated always as identity primary key,
  -- رقم الوسيط الرسمي لدى DLD (id الفعلي المستخدم في getCardDetails(id) على
  -- موقع dubailand.gov.ae) - معرّف فريد وموثوق، بخلاف محاولة أولى سابقة كانت
  -- تستخرج أي رقم يظهر بالبطاقة عبر regex (قد يكون رقم هاتف بالخطأ).
  dld_broker_number  text unique not null,
  name_ar            text,
  office_name        text,
  phone              text,
  email              text,
  photo_url          text default null,
  -- الوسطاء المستوردون من DLD يبقون غير مفعلين حتى تُفعَّل بياناتهم يدوياً
  -- (بعد التعاقد) من www/admin/individual-brokers.html.
  is_active          boolean not null default false,
  activated_at       timestamptz default null,
  country             text not null default 'uae',
  source             text not null default 'dld_government_registry',
  notes              text,
  created_at         timestamptz not null default now()
);

alter table public.individual_brokers add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(name_ar, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(office_name, '')), 'B')
  ) stored;

create index if not exists individual_brokers_search_idx on public.individual_brokers using gin (search_vector);
create index if not exists individual_brokers_is_active_idx on public.individual_brokers (is_active);
create index if not exists individual_brokers_country_idx on public.individual_brokers (country);

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.individual_brokers enable row level security;

drop policy if exists "Public individual brokers are viewable by everyone" on public.individual_brokers;
create policy "Public individual brokers are viewable by everyone"
  on public.individual_brokers
  for select
  using (true);

drop policy if exists "Authenticated users can update individual brokers" on public.individual_brokers;
create policy "Authenticated users can update individual brokers"
  on public.individual_brokers
  for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- لا توجد سياسة insert أو delete عمداً: فقط service_role يستطيع إدخال/حذف صفوف،
-- يُستخدم حصرياً من scripts/import-individual-brokers.py.
