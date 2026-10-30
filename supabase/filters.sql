-- ============================================================================
-- فلاتر البحث المتقدمة في «أنا عقار»
-- يضيف لكل عقار: نوع الوحدة، الفرش، تصنيف فاخر، العلاقة بالبحر، المزايا، والمعالم القريبة.
-- يُشغَّل بعد portal.sql (يعيد تعريف دالة تعديل الإعلان لتشمل الحقول الجديدة). آمن للتشغيل أكثر من مرة.
-- ============================================================================

alter table public.properties add column if not exists unit_type  text;
alter table public.properties add column if not exists furnishing text;
alter table public.properties add column if not exists is_luxury  boolean not null default false;
alter table public.properties add column if not exists sea_access text;
alter table public.properties add column if not exists amenities  text[] not null default '{}';
alter table public.properties add column if not exists nearby     text[] not null default '{}';

alter table public.properties drop constraint if exists properties_furnishing_chk;
alter table public.properties add constraint properties_furnishing_chk
  check (furnishing is null or furnishing in ('furnished', 'unfurnished', 'partly'));
alter table public.properties drop constraint if exists properties_sea_access_chk;
alter table public.properties add constraint properties_sea_access_chk
  check (sea_access is null or sea_access in ('beachfront', 'sea_view', 'near_sea'));
alter table public.properties drop constraint if exists properties_unit_type_chk;
alter table public.properties add constraint properties_unit_type_chk
  check (char_length(coalesce(unit_type, '')) <= 40);

create index if not exists properties_filters_idx on public.properties (status, deal_type, is_luxury, furnishing, sea_access);

create or replace function public.broker_update_property(p_id bigint, p jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v record;
begin
  select * into v from public.properties where id = p_id;
  if v.id is null or v.broker_id::text <> auth.uid()::text then raise exception 'forbidden'; end if;
  update public.properties set
    title          = coalesce(nullif(left(p->>'title', 200), ''), title),
    description    = coalesce(left(p->>'description', 5000), description),
    price_aed      = coalesce(nullif(p->>'price_aed', '')::numeric, price_aed),
    bedrooms       = coalesce(nullif(p->>'bedrooms', '')::int, bedrooms),
    bathrooms      = coalesce(nullif(p->>'bathrooms', '')::int, bathrooms),
    area_m2        = coalesce(nullif(p->>'area_m2', '')::numeric, area_m2),
    city           = coalesce(nullif(left(p->>'city', 100), ''), city),
    permit_number  = coalesce(nullif(left(p->>'permit_number', 60), ''), permit_number),
    has_offer      = coalesce((p->>'has_offer')::boolean, has_offer),
    offer_text     = case when p ? 'offer_text' then nullif(left(p->>'offer_text', 300), '') else offer_text end,
    no_commission  = coalesce((p->>'no_commission')::boolean, no_commission),
    unit_type      = case when p ? 'unit_type' then nullif(left(p->>'unit_type', 40), '') else unit_type end,
    furnishing     = case when p ? 'furnishing' then nullif(p->>'furnishing', '') else furnishing end,
    is_luxury      = coalesce((p->>'is_luxury')::boolean, is_luxury),
    sea_access     = case when p ? 'sea_access' then nullif(p->>'sea_access', '') else sea_access end,
    amenities      = case when p ? 'amenities' then array(select left(x, 40) from jsonb_array_elements_text(p->'amenities') x limit 30) else amenities end,
    nearby         = case when p ? 'nearby' then array(select left(x, 40) from jsonb_array_elements_text(p->'nearby') x limit 30) else nearby end,
    status         = 'pending',
    rejection_reason = null
  where id = p_id;
  return true;
end;
$$;
grant execute on function public.broker_update_property(bigint, jsonb) to authenticated;
