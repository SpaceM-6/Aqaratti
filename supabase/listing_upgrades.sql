-- ============================================================================
-- تحسينات الإعلان (25 نوفمبر 2026):
--   area             المنطقة / المشروع / الحي (كان يُكتب في النموذج ولا يُحفظ)
--   developer_name   المطوّر العقاري للمشروع (لفلتر «المطوّر» في البحث)
--   tour_url         رابط جولة افتراضية حقيقية يضعه الوسيط (https فقط)
--   floor_plan_urls  صور المخططات الطابقية التي يرفعها الوسيط (حتى 10)
-- ويضمن وجود حقول property_listing_fields.sql (حالة الإنجاز والعرض وبدون عمولة)،
-- إذ لم تكن موجودة في قاعدة البيانات فكانت تُحذف من الإعلان عند الحفظ.
-- آمن لو أُعيد تشغيله، ولا يحذف أي بيانات.
-- ============================================================================
alter table public.properties add column if not exists completion_status text;
alter table public.properties add column if not exists no_commission boolean not null default false;
alter table public.properties add column if not exists has_offer boolean not null default false;
alter table public.properties add column if not exists offer_text text;
alter table public.properties add column if not exists area text;
alter table public.properties add column if not exists developer_name text;
alter table public.properties add column if not exists tour_url text;
alter table public.properties add column if not exists floor_plan_urls text[] not null default '{}';

alter table public.properties drop constraint if exists properties_completion_status_check;
alter table public.properties add constraint properties_completion_status_check
  check (completion_status is null or completion_status in ('ready', 'under_construction', 'off_plan'));
alter table public.properties drop constraint if exists properties_offer_text_len;
alter table public.properties add constraint properties_offer_text_len check (offer_text is null or char_length(offer_text) <= 300);
alter table public.properties drop constraint if exists properties_area_len;
alter table public.properties add constraint properties_area_len check (area is null or char_length(area) <= 120);
alter table public.properties drop constraint if exists properties_developer_name_len;
alter table public.properties add constraint properties_developer_name_len check (developer_name is null or char_length(developer_name) <= 120);
alter table public.properties drop constraint if exists properties_tour_url_check;
alter table public.properties add constraint properties_tour_url_check
  check (tour_url is null or (tour_url ~ '^https://[^\s<>"]+$' and char_length(tour_url) <= 500));
-- المخططات: حتى 10 صور، وكلها من مخزن صور المنصة نفسه (لا روابط خارجية)
create or replace function public.aq_valid_plan_urls(p text[])
returns boolean language sql immutable set search_path = pg_catalog as $$
  select coalesce(cardinality(p), 0) <= 10 and not exists (
    select 1 from unnest(coalesce(p, '{}')) u
    where u !~ '^https://mejkpckkdbmczzypzkkr\.supabase\.co/storage/v1/object/public/property-images/[A-Za-z0-9._/%-]+$');
$$;
alter table public.properties drop constraint if exists properties_floor_plans_check;
alter table public.properties add constraint properties_floor_plans_check check (public.aq_valid_plan_urls(floor_plan_urls));

create index if not exists properties_developer_name_idx on public.properties (lower(developer_name)) where developer_name is not null;
