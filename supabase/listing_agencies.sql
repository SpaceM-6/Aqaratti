-- ============================================================================
-- صفحات المكاتب للإعلانات المستوردة (26 نوفمبر 2026)
--   listing_agencies   مكتب الوساطة صاحب الإعلان: اسمه وإماراته ظاهران للجميع، وأرقامه محجوبة
--   properties.agency_id  يربط الإعلان بمكتبه، فيظهر المكتب صاحبًا للإعلان لا حساب الإدارة
--   listing_imports    مصدر كل إعلان مستورد (للإدارة فقط، لا يظهر للزوار)
--   agency_claims      طلبات «هذا مكتبي» من الوسطاء، تراجعها الإدارة
--   get_agency_contact رقم المكتب للعضو المسجّل بضغطة واحدة (نفس حدود إظهار الأرقام)
-- آمن لو أُعيد تشغيله، ولا يحذف أي بيانات.
-- ============================================================================

create table if not exists public.listing_agencies (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name       text not null check (char_length(name) between 2 and 160),
  emirates   text[] not null default '{}',
  agents     text[] not null default '{}',
  phones     text[] not null default '{}',
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  source     text not null default 'import',
  created_at timestamptz not null default now()
);
alter table public.listing_agencies enable row level security;
drop policy if exists "Anyone reads agencies" on public.listing_agencies;
create policy "Anyone reads agencies" on public.listing_agencies for select to anon, authenticated using (true);
drop policy if exists "Admins manage agencies" on public.listing_agencies;
create policy "Admins manage agencies" on public.listing_agencies for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());
-- الأرقام وأسماء الوسطاء لا تُقرأ مباشرة؛ الرقم يُجلب بدالة get_agency_contact فقط
revoke select on public.listing_agencies from anon, authenticated;
grant select (id, slug, name, emirates, claimed_at, created_at) on public.listing_agencies to anon, authenticated;
grant insert, update, delete on public.listing_agencies to authenticated;

alter table public.properties add column if not exists agency_id uuid references public.listing_agencies(id) on delete set null;
create index if not exists properties_agency_id_idx on public.properties (agency_id) where agency_id is not null;

create table if not exists public.listing_imports (
  property_id uuid primary key references public.properties(id) on delete cascade,
  source      text not null,
  source_id   text not null,
  source_url  text,
  agent_name  text,
  agent_phone text,
  imported_at timestamptz not null default now(),
  unique (source, source_id)
);
alter table public.listing_imports enable row level security;
drop policy if exists "Admins read imports" on public.listing_imports;
create policy "Admins read imports" on public.listing_imports for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());
revoke all on public.listing_imports from anon;
grant select, insert, update, delete on public.listing_imports to authenticated;

create table if not exists public.agency_claims (
  id         bigint generated always as identity primary key,
  agency_id  uuid not null references public.listing_agencies(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  note       text check (note is null or char_length(note) <= 500),
  status     text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (agency_id, user_id)
);
alter table public.agency_claims enable row level security;
drop policy if exists "Members request claim" on public.agency_claims;
create policy "Members request claim" on public.agency_claims for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');
drop policy if exists "Own or admin read claims" on public.agency_claims;
create policy "Own or admin read claims" on public.agency_claims for select to authenticated
  using (user_id = auth.uid() or public.is_app_admin());
drop policy if exists "Admins decide claims" on public.agency_claims;
create policy "Admins decide claims" on public.agency_claims for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());
revoke all on public.agency_claims from anon;
grant select, insert, update on public.agency_claims to authenticated;

-- رقم المعلن: للعضو المسجّل فقط، جهة واحدة في كل طلب، وبحدود supabase/reveal_contacts.sql.
-- مع رقم إعلان تابع للمكتب يُعاد رقم الوسيط صاحب ذلك الإعلان، وإلا الرقم الرئيسي للمكتب.
create or replace function public.get_agency_contact(p_agency uuid, p_property uuid default null)
returns table (phone text, agent text)
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  if not public.is_app_admin() then
    perform public.aq_contact_reveal_guard('agency', p_agency::text || coalesce(':' || p_property::text, ''));
  end if;
  return query
    select coalesce(li.agent_phone, a.phones[1]), li.agent_name
    from public.listing_agencies a
    left join public.properties pr on pr.id = p_property and pr.agency_id = a.id and pr.status = 'approved'
    left join public.listing_imports li on li.property_id = pr.id
    where a.id = p_agency;
end $$;
drop function if exists public.get_agency_contact(uuid);
revoke all on function public.get_agency_contact(uuid, uuid) from public, anon;
grant execute on function public.get_agency_contact(uuid, uuid) to authenticated;
