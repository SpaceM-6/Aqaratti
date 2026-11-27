-- التحقق من مكاتب الوساطة المستوردة في سجل دائرة الأراضي والأملاك (دبي) — نسخة dld_brokers
-- القاعدة محافظة: يُعدّ المكتب مرخّصًا فقط إذا:
--   1) طابق اسمه (بعد حذف L.L.C وما شابه والمسافات) اسم مكتب واحد فقط في السجل، أو
--   2) طابق عدة مكاتب بالاسم وكان أحد وسطاء إعلاناته مسجّلًا في أحدها تحديدًا.
-- ما عدا ذلك لا يُوسَم بشيء (لا يعني أنه غير مرخّص). مكاتب الإمارات الأخرى خارج هذا السجل.

alter table public.listing_agencies add column if not exists dld_orn text;
alter table public.listing_agencies add column if not exists dld_office_name text;
alter table public.listing_agencies add column if not exists dld_checked_at timestamptz;
grant select (dld_orn, dld_office_name, dld_checked_at) on public.listing_agencies to anon, authenticated;

create or replace function public.aq_office_key(p text)
returns text language sql immutable as $$
  select regexp_replace(
           regexp_replace(lower(coalesce(p, '')),
             '\m(l\.?\s?l\.?\s?c|s\.?\s?o\.?\s?c|sp|real\s*estates?|brokers?|brokerage|properties|property|realty|ajm|sole\s*proprietorship|fz[ec]?|branch|br|local\s*division|division|\d+)\M', ' ', 'g'),
           '[^a-z]+', '', 'g');
$$;

create or replace function public.aq_verify_agencies_dld()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_verified int;
begin
  if not public.is_app_admin() and coalesce(auth.role(), '') <> 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'forbidden';
  end if;
  with offices as (
    select office_number, max(office_name) office_name, public.aq_office_key(max(office_name)) k
    from public.dld_brokers where office_number is not null and office_name is not null group by office_number),
  cand as (
    select a.id agency_id, o.office_number, o.office_name
    from public.listing_agencies a join offices o on o.k = public.aq_office_key(a.name)
    where length(public.aq_office_key(a.name)) >= 3),
  agents as (
    select distinct p.agency_id, b.office_number
    from public.listing_imports li join public.properties p on p.id = li.property_id
    join public.dld_brokers b on lower(regexp_replace(trim(b.name_en), '\s+', ' ', 'g')) = lower(regexp_replace(trim(li.agent_name), '\s+', ' ', 'g'))
    where p.agency_id is not null and coalesce(li.agent_name, '') <> ''),
  pick as (
    select c.agency_id,
      case when count(*) = 1 then min(c.office_number)
           else (select min(c2.office_number) from cand c2 join agents g on g.agency_id = c2.agency_id and g.office_number = c2.office_number where c2.agency_id = c.agency_id)
      end orn
    from cand c group by c.agency_id)
  update public.listing_agencies a
     set dld_orn = p.orn,
         dld_office_name = (select office_name from offices o where o.office_number = p.orn),
         dld_checked_at = now()
    from pick p where p.agency_id = a.id and p.orn is not null;
  get diagnostics v_verified = row_count;
  update public.listing_agencies set dld_checked_at = now() where dld_checked_at is null;
  return jsonb_build_object('verified', v_verified, 'total', (select count(*) from public.listing_agencies));
end;
$$;
revoke all on function public.aq_verify_agencies_dld() from public, anon;
grant execute on function public.aq_verify_agencies_dld() to authenticated;
