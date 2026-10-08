-- ============================================================================
-- بحث جغرافي (PostGIS): يضيف إحداثيات اختيارية لجدول properties الحقيقي، ودالة
-- بحث "أقرب العقارات مني" بالمسافة. العقارات القديمة بدون إحداثيات ببساطة لن
-- تظهر بهذا النوع من البحث (يبقى بحث الفلاتر العادي يعمل عليها كالمعتاد) -
-- الميزة تعمل تدريجياً مع كل عقار جديد يُضاف برّاه إحداثيات.
-- ============================================================================

create extension if not exists postgis;

alter table public.properties add column if not exists lat double precision;
alter table public.properties add column if not exists lng double precision;

-- عمود مُشتق تلقائياً (geography) من lat/lng لحساب المسافات بدقة
alter table public.properties drop column if exists geo_point;
alter table public.properties add column geo_point geography(Point, 4326)
  generated always as (
    case when lat is not null and lng is not null
      then ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
      else null
    end
  ) stored;

create index if not exists properties_geo_point_idx on public.properties using gist (geo_point);

-- دالة: إرجاع العقارات المعتمدة ضمن نطاق كذا كيلومتر من نقطة معينة، مرتبة من الأقرب
create or replace function public.nearby_properties(
  search_lat double precision,
  search_lng double precision,
  radius_km double precision default 10
)
returns setof public.properties
language sql
stable
as $$
  select *
  from public.properties
  where status = 'approved'
    and geo_point is not null
    and ST_DWithin(
      geo_point,
      ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography,
      radius_km * 1000
    )
  order by geo_point <-> ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography;
$$;
