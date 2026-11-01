-- ============================================================================
-- سجلات دائرة الأراضي والأملاك الرسمية (تُرفع من لوحة التحكم ← «بيانات السوق»):
--   dld_projects    المشاريع: الحالة، نسبة الإنجاز، المطوّر، موعد التسليم، عدد الوحدات
--   dld_brokers     الوسطاء المرخّصون: رقم الوسيط BRN، الاسم، المكتب، تاريخ انتهاء الرخصة
--   dld_developers  المطوّرون المسجّلون ورخصهم
-- ومنها: فحص «رخصة المعلن» تلقائيًا لكل إعلان إن كان رقم الوسيط ساريًا في سجل الدائرة.
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor (آمن لو أُعيد تشغيله).
-- ============================================================================

create table if not exists public.dld_projects (
  project_number   text primary key,
  name_en          text not null,
  developer_number text,
  developer_en     text,
  status           text,            -- ACTIVE / PENDING / FINISHED / CANCELLED …
  percent_completed numeric,
  start_date       date,
  end_date         date,            -- موعد التسليم المتوقع
  completion_date  date,
  inspection_date  date,            -- آخر زيارة تفتيش
  area_en          text,
  zone_en          text,
  master_project_en text,
  cnt_building     integer,
  cnt_villa        integer,
  cnt_unit         integer,
  project_value    numeric,
  description_en   text,
  updated_at       timestamptz not null default now()
);
create index if not exists dld_projects_area_idx on public.dld_projects (lower(area_en));

create table if not exists public.dld_brokers (
  broker_number  text primary key,  -- BRN
  name_en        text not null,
  license_start  date,
  license_end    date,
  office_number  text,              -- ORN
  office_name    text,
  updated_at     timestamptz not null default now()
);
create index if not exists dld_brokers_office_idx on public.dld_brokers (office_number);

create table if not exists public.dld_developers (
  developer_number  text primary key,
  name_en           text not null,
  license_number    text,
  license_source    text,
  license_issue     date,
  license_expiry    date,
  registration_date date,
  updated_at        timestamptz not null default now()
);

alter table public.dld_projects enable row level security;
alter table public.dld_brokers enable row level security;
alter table public.dld_developers enable row level security;

drop policy if exists "dld projects public read" on public.dld_projects;
create policy "dld projects public read" on public.dld_projects for select using (true);
drop policy if exists "dld developers public read" on public.dld_developers;
create policy "dld developers public read" on public.dld_developers for select using (true);
-- سجل الوسطاء: لا يُقرأ كاملًا من المتصفح (حتى لا يُنسخ)، بل عبر الدالة dld_broker_status
drop policy if exists "dld brokers admin read" on public.dld_brokers;
create policy "dld brokers admin read" on public.dld_brokers for select using (public.is_app_admin());

do $$ declare t text; begin
  foreach t in array array['dld_projects', 'dld_brokers', 'dld_developers'] loop
    execute format('drop policy if exists "%s admin write" on public.%I', t, t);
    execute format('create policy "%s admin write" on public.%I for all using (public.is_app_admin()) with check (public.is_app_admin())', t, t);
  end loop;
end $$;
grant select on public.dld_projects, public.dld_developers to anon, authenticated;
grant select, insert, update, delete on public.dld_projects, public.dld_brokers, public.dld_developers to authenticated;

-- حالة رقم وسيط واحد (لصفحة الوسيط ومركز الوسطاء): الاسم والمكتب وصلاحية الرخصة
create or replace function public.dld_broker_status(p_number text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_build_object('found', true, 'name', name_en, 'office', office_name, 'office_number', office_number,
                              'license_end', license_end, 'active', coalesce(license_end >= current_date, false))
      from public.dld_brokers
     where broker_number = nullif(regexp_replace(coalesce(p_number, ''), '\D', '', 'g'), '')
  ), jsonb_build_object('found', false));
$$;
grant execute on function public.dld_broker_status(text) to anon, authenticated;

-- هل رقم ترخيص المعلن ساري في سجل الدائرة؟
create or replace function public.aq_license_active(p_license text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.dld_brokers
     where broker_number = nullif(regexp_replace(coalesce(p_license, ''), '\D', '', 'g'), '')
       and license_end >= current_date
  );
$$;

-- فحص «رخصة المعلن» تلقائيًا لكل الإعلانات التي رخصة معلنها سارية (تُستدعى بعد رفع سجل الوسطاء)
create or replace function public.aq_sync_license_checks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if not public.is_app_admin() then raise exception 'not allowed'; end if;
  update public.properties p set check_license_at = now()
    from public.profiles pr
   where pr.id = p.broker_id and p.check_license_at is null
     and p.status in ('pending', 'approved') and public.aq_license_active(pr.license_no);
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function public.aq_sync_license_checks() to authenticated;

-- وكل إعلان جديد يُفحص تلقائيًا عند إضافته
create or replace function public.aq_property_auto_license()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.check_license_at is null and exists (select 1 from public.profiles pr where pr.id = new.broker_id and public.aq_license_active(pr.license_no)) then
    new.check_license_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists aq_property_auto_license on public.properties;
create trigger aq_property_auto_license before insert on public.properties
  for each row execute function public.aq_property_auto_license();
