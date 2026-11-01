-- ============================================================================
-- 1) دليل الأراضي: ملخص لكل منطقة من سجل الأراضي المفتوح لدائرة الأراضي (ملف Land)
--    عدد القطع، والمساحة، ونسبة التملّك الحر، والجاهز وعلى الخارطة، وتوزيع الاستخدام.
--    لا نخزن القطع نفسها، بل ملخص كل منطقة.
-- 2) دليل الوسطاء: مزامنته مع سجل الوسطاء الرسمي (dld_brokers):
--    تحديث الرخص والمكاتب، وإضافة الوسطاء الناقصين، وحجب بيانات التواصل عن الزوار كما هي.
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor (آمن لو أُعيد تشغيله). يعتمد على dld_registry.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) ملخص الأراضي لكل منطقة
-- ---------------------------------------------------------------------------
create table if not exists public.land_area_stats (
  area_en        text primary key,
  zone_en        text,
  plots          integer not null default 0,
  area_m2        numeric,
  freehold       integer not null default 0,   -- قطع التملّك الحر
  offplan        integer not null default 0,   -- قطع على الخارطة
  projects       integer not null default 0,   -- عدد المشاريع المسجلة على أراضي المنطقة
  land_types     jsonb not null default '{}'::jsonb,  -- {"Residential": 120, "Commercial": 40, …}
  sub_types      jsonb not null default '{}'::jsonb,
  source         text not null default 'DLD',
  updated_at     timestamptz not null default now()
);
-- التملّك الحر محسوبًا على الأراضي القابلة للتملّك فقط (سكني وتجاري وضيافة)، دون الطرق والمرافق والجهات الحكومية
alter table public.land_area_stats add column if not exists private_plots integer not null default 0;
alter table public.land_area_stats add column if not exists private_freehold integer not null default 0;
alter table public.land_area_stats enable row level security;
drop policy if exists "land stats public read" on public.land_area_stats;
create policy "land stats public read" on public.land_area_stats for select using (true);
drop policy if exists "land stats admin write" on public.land_area_stats;
create policy "land stats admin write" on public.land_area_stats for all using (public.is_app_admin()) with check (public.is_app_admin());
grant select on public.land_area_stats to anon, authenticated;
grant insert, update, delete on public.land_area_stats to authenticated;

-- ---------------------------------------------------------------------------
-- 2) مزامنة دليل الوسطاء مع سجل الدائرة
-- ---------------------------------------------------------------------------
alter table public.individual_brokers add column if not exists name_en text;
alter table public.individual_brokers add column if not exists license_issue_date date;
alter table public.individual_brokers add column if not exists license_expiry_date date;
alter table public.individual_brokers add column if not exists office_name_en text;
alter table public.individual_brokers add column if not exists office_number text;

-- البحث يشمل الآن الاسم الإنجليزي ورقم الوسيط ورقم المكتب (الوسطاء الجدد من السجل أسماؤهم بالإنجليزية)
alter table public.individual_brokers drop column if exists search_vector;
alter table public.individual_brokers add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(name_ar, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(name_en, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(dld_broker_number, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(office_name, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(office_name_en, '')), 'B')
  ) stored;
create index if not exists individual_brokers_search_idx on public.individual_brokers using gin (search_vector);
create index if not exists individual_brokers_expiry_idx on public.individual_brokers (license_expiry_date desc nulls last);

-- إعادة حجب بيانات التواصل (الهاتف والبريد والجوال) عن الزوار، وإتاحة باقي الأعمدة بما فيها الجديدة
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'individual_brokers'
     and column_name not in ('phone', 'email', 'mobile');
  execute 'revoke select on public.individual_brokers from anon, authenticated';
  execute format('grant select (%s) on public.individual_brokers to anon, authenticated', cols);
end $$;

create or replace function public.aq_sync_directory_from_dld()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_upd integer; v_ins integer;
begin
  if not public.is_app_admin() then raise exception 'not allowed'; end if;
  -- تحديث الموجودين: تواريخ الرخصة، والمكتب، والاسم الإنجليزي
  update public.individual_brokers ib set
      name_en             = coalesce(nullif(ib.name_en, ''), d.name_en),
      license_issue_date  = coalesce(d.license_start, ib.license_issue_date),
      license_expiry_date = coalesce(d.license_end, ib.license_expiry_date),
      office_number       = coalesce(d.office_number, ib.office_number),
      office_name_en      = coalesce(d.office_name, ib.office_name_en),
      office_name         = coalesce(nullif(ib.office_name, ''), d.office_name)
    from public.dld_brokers d
   where ib.dld_broker_number = d.broker_number;
  get diagnostics v_upd = row_count;
  -- إضافة الوسطاء غير الموجودين في الدليل (غير مفعّلين حتى يفعّل الوسيط ملفه أو تفعّله الإدارة)
  insert into public.individual_brokers (dld_broker_number, name_en, office_name, office_name_en, office_number,
                                         license_issue_date, license_expiry_date, country, source, is_active)
  select d.broker_number, d.name_en, d.office_name, d.office_name, d.office_number,
         d.license_start, d.license_end, 'uae', 'dld_open_data', false
    from public.dld_brokers d
   where not exists (select 1 from public.individual_brokers ib where ib.dld_broker_number = d.broker_number);
  get diagnostics v_ins = row_count;
  return jsonb_build_object('updated', v_upd, 'inserted', v_ins,
    'total', (select count(*) from public.individual_brokers where country = 'uae'));
end;
$$;
grant execute on function public.aq_sync_directory_from_dld() to authenticated;
