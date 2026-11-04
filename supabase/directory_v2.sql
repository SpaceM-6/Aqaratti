-- ============================================================================
-- «ابحث عن وسيط» — طريقة عرض جديدة للوسطاء والمكاتب (صفحة agents.html)
--   • بيانات إضافية يملؤها الوسيط في ملفه: المسمى الوظيفي، الجنسية، اللغات، الصورة.
--   • دوال بحث سريعة على الخادم: الوسطاء مع عدد إعلاناتهم للبيع والإيجار، والمكاتب مع عدد وسطائها وإعلاناتها،
--     وقيم الفلاتر الموجودة فعلًا (لا يظهر فلتر بلا نتائج).
-- لا تُعاد أي بيانات تواصل. يُنفَّذ مرة واحدة من Supabase → SQL Editor (آمن لو أُعيد تشغيله).
-- ============================================================================
alter table public.individual_brokers add column if not exists title text;
alter table public.individual_brokers add column if not exists nationality text;
alter table public.individual_brokers add column if not exists languages text[] not null default '{}';
-- الأعمدة الجديدة عامة للقراءة (ليست بيانات تواصل)
grant select (title, nationality, languages) on public.individual_brokers to anon, authenticated;

-- الوسيط يعدّل بياناته العامة لملفه الذي فعّله بنفسه
create or replace function public.update_my_broker_card(p_title text, p_nationality text, p_languages text[], p_photo_url text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not allowed'; end if;
  update public.individual_brokers
     set title = nullif(left(trim(coalesce(p_title, '')), 60), ''),
         nationality = nullif(left(trim(coalesce(p_nationality, '')), 40), ''),
         languages = coalesce((select array_agg(distinct left(trim(x), 30)) from unnest(coalesce(p_languages, '{}')) x where trim(x) <> ''), '{}'),
         photo_url = case when p_photo_url ~* '^https://' then p_photo_url else photo_url end
   where claimed_by = auth.uid();
  return found;
end;
$$;
grant execute on function public.update_my_broker_card(text, text, text[], text) to authenticated;

-- عدد الإعلانات المنشورة لكل حساب معلن (للبيع / للإيجار)، مع نوع العقار
create or replace view public.aq_listing_counts as
  select p.broker_id,
         count(*) filter (where p.deal_type = 'sale') as sale,
         count(*) filter (where p.deal_type = 'rent') as rent,
         array_agg(distinct coalesce(to_jsonb(p)->>'property_type', '')) as types
    from public.properties p
   where p.status = 'approved'
   group by p.broker_id;
revoke all on public.aq_listing_counts from anon, authenticated;

-- الوسطاء
create or replace function public.directory_agents(
  p_q text default null, p_office text default null, p_language text default null, p_nationality text default null,
  p_deal text default null, p_type text default null, p_verified boolean default false, p_sort text default 'featured',
  p_limit integer default 24, p_offset integer default 0)
returns table (id bigint, name_ar text, name_en text, title text, office_name text, office_number text, office_logo_url text,
               photo_url text, nationality text, languages text[], license_active boolean, is_active boolean, verified boolean,
               dld_broker_number text, sale bigint, rent bigint, total_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with b as (
    select ib.*, coalesce(c.sale, 0) as c_sale, coalesce(c.rent, 0) as c_rent, coalesce(c.types, '{}') as c_types,
           coalesce(ib.license_expiry_date >= current_date, false) as lic,
           coalesce(pr.verified, false) as ver
      from public.individual_brokers ib
      left join public.aq_listing_counts c on c.broker_id = ib.claimed_by
      left join public.profiles pr on pr.id = ib.claimed_by
     where coalesce(ib.country, 'uae') = 'uae'
       and (p_q is null or p_q = '' or ib.name_ar ilike '%' || p_q || '%' or ib.name_en ilike '%' || p_q || '%'
            or ib.office_name ilike '%' || p_q || '%' or ib.office_name_en ilike '%' || p_q || '%' or ib.dld_broker_number = trim(p_q))
       and (p_office is null or p_office = '' or ib.office_number = p_office)
       and (p_language is null or p_language = '' or p_language = any(ib.languages))
       and (p_nationality is null or p_nationality = '' or ib.nationality = p_nationality)
  ), f as (
    select * from b
     where (p_deal is null or p_deal = '' or (p_deal = 'sale' and c_sale > 0) or (p_deal = 'rent' and c_rent > 0))
       and (p_type is null or p_type = '' or p_type = any(c_types))
       and (not coalesce(p_verified, false) or (lic and (ver or is_active)))
  )
  select id, name_ar, name_en, title, office_name, office_number, office_logo_url, photo_url, nationality, languages,
         lic, is_active, ver, dld_broker_number, c_sale, c_rent, count(*) over ()
    from f
   order by
     case when p_sort = 'sale' then c_sale when p_sort = 'rent' then c_rent else 0 end desc,
     (case when p_sort = 'featured' then (c_sale + c_rent) * 10 + (case when is_active then 5 else 0 end) + (case when photo_url is not null then 2 else 0 end) + (case when lic then 1 else 0 end) else 0 end) desc,
     license_expiry_date desc nulls last, id
   limit least(greatest(coalesce(p_limit, 24), 1), 60) offset greatest(coalesce(p_offset, 0), 0);
$$;
grant execute on function public.directory_agents(text, text, text, text, text, text, boolean, text, integer, integer) to anon, authenticated;

-- المكاتب (من سجل الوسطاء: كل مكتب بعدد وسطائه وإعلاناتهم)
create or replace function public.directory_offices(p_q text default null, p_deal text default null, p_sort text default 'featured',
  p_limit integer default 24, p_offset integer default 0)
returns table (office_number text, office_name text, office_name_en text, logo_url text, agents bigint, licensed bigint,
               active_agents bigint, sale bigint, rent bigint, total_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with o as (
    select ib.office_number,
           max(coalesce(nullif(ib.office_name, ''), ib.office_name_en)) as office_name,
           max(ib.office_name_en) as office_name_en,
           max(ib.office_logo_url) as logo_url,
           count(*) as agents,
           count(*) filter (where ib.license_expiry_date >= current_date) as licensed,
           count(*) filter (where ib.is_active) as active_agents,
           coalesce(sum(c.sale), 0)::bigint as sale, coalesce(sum(c.rent), 0)::bigint as rent
      from public.individual_brokers ib
      left join public.aq_listing_counts c on c.broker_id = ib.claimed_by
     where coalesce(ib.country, 'uae') = 'uae' and coalesce(ib.office_number, '') <> ''
       and (p_q is null or p_q = '' or ib.office_name ilike '%' || p_q || '%' or ib.office_name_en ilike '%' || p_q || '%' or ib.office_number = trim(p_q))
     group by ib.office_number
  )
  select office_number, office_name, office_name_en, logo_url, agents, licensed, active_agents, sale, rent, count(*) over ()
    from o
   where (p_deal is null or p_deal = '' or (p_deal = 'sale' and sale > 0) or (p_deal = 'rent' and rent > 0))
   order by case when p_sort = 'sale' then sale when p_sort = 'rent' then rent else 0 end desc,
            (sale + rent) desc, licensed desc, agents desc, office_number
   limit least(greatest(coalesce(p_limit, 24), 1), 60) offset greatest(coalesce(p_offset, 0), 0);
$$;
grant execute on function public.directory_offices(text, text, text, integer, integer) to anon, authenticated;

-- قيم الفلاتر الموجودة فعلًا
create or replace function public.directory_facets()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'languages', coalesce((select jsonb_agg(l order by n desc) from (select l, count(*) n from public.individual_brokers, unnest(languages) l group by l) x), '[]'),
    'nationalities', coalesce((select jsonb_agg(nationality order by n desc) from (select nationality, count(*) n from public.individual_brokers where coalesce(nationality, '') <> '' group by nationality) x), '[]'),
    'types', coalesce((select jsonb_agg(t) from (select distinct unnest(types) t from public.aq_listing_counts) x where t <> ''), '[]'),
    'sale', coalesce((select sum(sale) from public.aq_listing_counts), 0),
    'rent', coalesce((select sum(rent) from public.aq_listing_counts), 0)
  );
$$;
grant execute on function public.directory_facets() to anon, authenticated;

create index if not exists individual_brokers_office_no_idx on public.individual_brokers (office_number);
create index if not exists individual_brokers_claimed_idx on public.individual_brokers (claimed_by);
