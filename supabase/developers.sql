-- ============================================================================
-- جدول developers: يستضيف بيانات المطورين العقاريين المعتمدين لدى دائرة
-- الأراضي والأملاك بدبي (DLD)، منقولة من dld-brokers-scraper/dld_brokers_output
-- عبر scripts/import-developers.py. كيان مستقل عن brokers (مكاتب) و
-- individual_brokers (أفراد) - له قسمه الخاص "المطورين العقاريين" في بوابة
-- الوسطاء. القراءة عامة؛ الإدخال محصور على service_role؛ التفعيل عبر
-- www/admin/developers.html بنفس فلسفة الجداول الأخرى.
-- ============================================================================

create table if not exists public.developers (
  id                  bigint generated always as identity primary key,
  dld_developer_number text unique not null,
  name_ar             text,
  name_en             text,
  phone               text,
  mobile              text,
  email               text,
  logo_url            text default null,
  rating              text,
  is_active           boolean not null default false,
  activated_at        timestamptz default null,
  country             text not null default 'uae',
  source              text not null default 'dld_government_registry',
  created_at          timestamptz not null default now()
);

alter table public.developers add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(name_ar, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(name_en, '')), 'A')
  ) stored;

create index if not exists developers_search_idx on public.developers using gin (search_vector);
create index if not exists developers_is_active_idx on public.developers (is_active);
create index if not exists developers_country_idx on public.developers (country);

alter table public.developers enable row level security;

drop policy if exists "Public developers are viewable by everyone" on public.developers;
create policy "Public developers are viewable by everyone"
  on public.developers
  for select
  using (true);

drop policy if exists "Authenticated users can update developers" on public.developers;
create policy "Authenticated users can update developers"
  on public.developers
  for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- لا توجد سياسة insert أو delete عمداً - فقط service_role عبر scripts/import-developers.py
