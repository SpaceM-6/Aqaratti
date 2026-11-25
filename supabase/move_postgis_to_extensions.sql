-- ================================================================
-- نقل امتداد PostGIS من المخطط العام إلى extensions (لم يُطبَّق بعد — ينتظر الموافقة)
-- يُزيل جدول spatial_ref_sys من الواجهة العامة فيختفي تنبيه Supabase الحرج.
-- كتلة واحدة: إن فشلت أي خطوة تراجع كل شيء تلقائيًا. عمود geo_point مشتق من lat/lng فيُعاد حسابه.
-- ================================================================
do $do$
declare vdef text;
begin
  vdef := pg_get_viewdef('public.aq_listing_counts'::regclass);
  drop view public.aq_listing_counts;
  drop function public.nearby_properties(double precision, double precision, double precision);
  alter table public.properties drop column geo_point;
  drop extension postgis;
  create extension postgis schema extensions;
  execute 'alter table public.properties add column geo_point extensions.geography(Point, 4326) generated always as (case when lat is not null and lng is not null then extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography else null end) stored';
  execute 'create index properties_geo_point_idx on public.properties using gist (geo_point)';
  execute 'create view public.aq_listing_counts with (security_invoker = true) as ' || vdef;
  grant select on public.aq_listing_counts to anon, authenticated, service_role;
  execute $f$
    create function public.nearby_properties(search_lat double precision, search_lng double precision, radius_km double precision default 10)
    returns setof public.properties language sql stable set search_path = public, extensions as $b$
      select * from public.properties
      where status = 'approved' and geo_point is not null
        and ST_DWithin(geo_point, ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography, radius_km * 1000)
      order by geo_point <-> ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography;
    $b$ $f$;
  grant execute on function public.nearby_properties(double precision, double precision, double precision) to anon, authenticated, service_role;
end $do$;
