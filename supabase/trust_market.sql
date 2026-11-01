-- ============================================================================
-- الثقة وجودة الإعلانات وبيانات السوق في «أنا عقار»:
--   1) مستويات التحقق من الإعلان: الرخصة، الملكية، تفويض التسويق، تأكيد التوافر (مع تاريخ كل فحص)
--   2) تأكيد التوافر من الوسيط بضغطة، وعمر الإعلان
--   3) زمن أول رد على العميل، وبطاقة أداء الوسيط المعلنة (نسبة الرد، متوسط زمن الرد…)
--   4) بيانات السوق الرسمية: ملخصات شهرية لكل منطقة من ملفات دائرة الأراضي والأملاك المفتوحة
--   5) لوحة جودة المخزون للإدارة (المكرر، القديم، غير المؤكد، النشط في كل منطقة)
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor (آمن لو أُعيد تشغيله).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) مستويات التحقق من الإعلان + تأكيد التوافر
-- ---------------------------------------------------------------------------
alter table public.properties add column if not exists check_license_at   timestamptz;  -- فحص رخصة الوسيط/المكتب
alter table public.properties add column if not exists check_ownership_at timestamptz;  -- فحص سند الملكية
alter table public.properties add column if not exists check_mandate_at   timestamptz;  -- فحص تفويض التسويق (نموذج A / العقد)
alter table public.properties add column if not exists available_at       timestamptz;  -- آخر تأكيد أن العقار ما زال متاحًا
update public.properties set available_at = coalesce(reviewed_at, created_at) where available_at is null and status = 'approved';

-- الإدارة: تفعيل أو إلغاء فحص معيّن
create or replace function public.admin_set_property_check(p_id public.aq_prop_id, p_kind text, p_on boolean)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare v timestamptz := case when p_on then now() end;
begin
  if not public.is_app_admin() then raise exception 'not allowed'; end if;
  if p_kind = 'license' then update public.properties set check_license_at = v where id = p_id;
  elsif p_kind = 'ownership' then update public.properties set check_ownership_at = v where id = p_id;
  elsif p_kind = 'mandate' then update public.properties set check_mandate_at = v where id = p_id;
  elsif p_kind = 'available' then update public.properties set available_at = v where id = p_id;
  else raise exception 'unknown check'; end if;
  return v;
end;
$$;
revoke all on function public.admin_set_property_check(public.aq_prop_id, text, boolean) from public, anon;
grant execute on function public.admin_set_property_check(public.aq_prop_id, text, boolean) to authenticated;

-- الوسيط: «ما زال متاحًا» لإعلانه (أو لإعلانات فريق مكتبه)
create or replace function public.confirm_property_available(p_id public.aq_prop_id)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare v_owner uuid;
begin
  select broker_id into v_owner from public.properties where id = p_id;
  if v_owner is null then raise exception 'not found'; end if;
  if not (v_owner = auth.uid() or public.is_app_admin()) then raise exception 'not allowed'; end if;
  update public.properties set available_at = now() where id = p_id;
  return now();
end;
$$;
revoke all on function public.confirm_property_available(public.aq_prop_id) from public, anon;
grant execute on function public.confirm_property_available(public.aq_prop_id) to authenticated;

-- اعتماد الإعلان يُعدّ تأكيدًا للتوافر
create or replace function public.aq_property_available_on_approve()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    new.available_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists aq_property_available_on_approve on public.properties;
create trigger aq_property_available_on_approve before insert or update of status on public.properties
  for each row execute function public.aq_property_available_on_approve();

-- ---------------------------------------------------------------------------
-- 2) زمن أول رد على العميل
-- ---------------------------------------------------------------------------
alter table public.leads add column if not exists first_response_at timestamptz;

create or replace function public.aq_lead_first_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'lead_activities' then
    -- سجل «تغيير المرحلة» يُكتب أثناء تحديث العميل نفسه، ويتولاه مشغّل جدول العملاء
    if new.kind = 'stage' then return new; end if;
    update public.leads set first_response_at = coalesce(first_response_at, now())
     where id = new.lead_id and first_response_at is null;
  elsif new.first_response_at is null and coalesce(new.stage, 'new') <> 'new' then
    new.first_response_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists aq_lead_first_response on public.leads;
create trigger aq_lead_first_response before update of stage on public.leads
  for each row execute function public.aq_lead_first_response();
drop trigger if exists aq_lead_activity_first_response on public.lead_activities;
create trigger aq_lead_activity_first_response after insert on public.lead_activities
  for each row execute function public.aq_lead_first_response();

-- ---------------------------------------------------------------------------
-- 3) بطاقة أداء الوسيط (أرقام مجمّعة فقط، بلا أي بيانات عملاء)
-- ---------------------------------------------------------------------------
create or replace function public.broker_scorecard(p_broker uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with l as (
    select created_at, first_response_at from public.leads
     where broker_id = p_broker and created_at > now() - interval '90 days'
  ), p as (
    select id, status, available_at, check_ownership_at, check_mandate_at from public.properties where broker_id = p_broker
  )
  select jsonb_build_object(
    'leads_90d',        (select count(*) from l),
    'responded_pct',    (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where first_response_at is not null) / count(*)) end from l),
    'avg_response_hrs', (select round((avg(extract(epoch from (first_response_at - created_at))) / 3600)::numeric, 1) from l where first_response_at is not null),
    'active',           (select count(*) from p where status = 'approved'),
    'fresh_pct',        (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where available_at > now() - interval '30 days') / count(*)) end from p where status = 'approved'),
    'verified_listings',(select count(*) from p where status = 'approved' and check_ownership_at is not null and check_mandate_at is not null),
    'closed',           (select count(*) from p where status in ('sold', 'rented')),
    'confirmed_reports',(select count(*) from public.reports r
                          where r.status = 'done' and exists (select 1 from p where r.target_url like '%id=sb-' || p.id::text || '%'))
  );
$$;
grant execute on function public.broker_scorecard(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) بيانات السوق الرسمية (ملخصات شهرية لكل منطقة)
--    تُرفع من لوحة التحكم ← «بيانات السوق» من ملفات CSV المفتوحة لدائرة الأراضي والأملاك.
--    لا نخزن الصفقات نفسها، بل ملخص كل منطقة في كل شهر.
-- ---------------------------------------------------------------------------
create table if not exists public.area_market_stats (
  area_en      text not null,
  area_ar      text,
  month        date not null,                       -- أول يوم في الشهر
  kind         text not null check (kind in ('sale', 'rent')),
  usage        text not null default 'residential' check (usage in ('residential', 'commercial', 'all')),
  deals        integer not null default 0,
  median_ppm2  numeric,                             -- الوسيط: درهم لكل متر مربع (البيع) أو إيجار سنوي لكل متر (الإيجار)
  median_price numeric,                             -- الوسيط: قيمة الصفقة أو الإيجار السنوي
  total_value  numeric,
  source       text not null default 'DLD',
  updated_at   timestamptz not null default now(),
  primary key (area_en, month, kind, usage)
);
create index if not exists area_market_stats_ar_idx on public.area_market_stats (area_ar);
alter table public.area_market_stats enable row level security;
drop policy if exists "market stats public read" on public.area_market_stats;
create policy "market stats public read" on public.area_market_stats for select using (true);
drop policy if exists "market stats admin write" on public.area_market_stats;
create policy "market stats admin write" on public.area_market_stats for all
  using (public.is_app_admin()) with check (public.is_app_admin());
grant select on public.area_market_stats to anon, authenticated;
grant insert, update, delete on public.area_market_stats to authenticated;

-- ---------------------------------------------------------------------------
-- 5) لوحة جودة المخزون للإدارة
-- ---------------------------------------------------------------------------
create or replace function public.admin_inventory_quality()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare r jsonb;
begin
  if not public.is_app_admin() then raise exception 'not allowed'; end if;
  with a as (select * from public.properties where status = 'approved')
  select jsonb_build_object(
    'active',          (select count(*) from a),
    'stale_30',        (select count(*) from a where coalesce(available_at, created_at) < now() - interval '30 days'),
    'stale_60',        (select count(*) from a where coalesce(available_at, created_at) < now() - interval '60 days'),
    'age_median_days', (select round(percentile_cont(0.5) within group (order by extract(epoch from now() - created_at) / 86400)::numeric) from a),
    'no_permit',       (select count(*) from a where coalesce(permit_number, '') = ''),
    'fully_checked',   (select count(*) from a where check_license_at is not null and check_ownership_at is not null and check_mandate_at is not null),
    'duplicates',      (select count(distinct x.id) from a x join a y on x.id <> y.id and x.image_hashes && y.image_hashes
                         where cardinality(x.image_hashes) > 0),
    'by_city',         (select coalesce(jsonb_agg(jsonb_build_object('city', c, 'n', n) order by n desc), '[]'::jsonb)
                          from (select coalesce(nullif(city, ''), 'غير محدد') c, count(*) n from a group by 1) t)
  ) into r;
  return r;
end;
$$;
grant execute on function public.admin_inventory_quality() to authenticated;
