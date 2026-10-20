-- ============================================================================
-- دليل مزوّدي الخدمات (صفحة services-directory.html):
--   الاستشارات القانونية، الإقامة وتأسيس الشركات، الاستشارات الهندسية، المقاولات، تصميم الديكور.
--
-- • الجميع يرى الشركات المفعّلة فقط (is_active = true).
-- • أي شركة تستطيع إرسال طلب إدراج من الصفحة نفسها، فيُحفظ غير مفعّل حتى تراجعه الإدارة.
-- • الإدارة (app_admins) تضيف وتعدّل وتفعّل وتحذف من admin/service-providers.html.
-- • حاوية صور «service-logos» لرفع شعارات الشركات من صفحة الإدارة.
--
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor (آمن لو أُعيد تشغيله). لا يحذف أي بيانات.
-- ============================================================================

-- (مكرر حتى يعمل الملف وحده)
create table if not exists public.app_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.app_admins where user_id = auth.uid()); $$;
grant execute on function public.is_app_admin() to anon, authenticated;

create table if not exists public.service_providers (
  id             bigint generated always as identity primary key,
  category       text not null,          -- legal | residency | engineering | contracting | interior
  name_ar        text not null,
  name_en        text,
  logo_url       text,
  emirate        text,
  area           text,
  description    text,
  phone          text,
  whatsapp       text,
  email          text,
  website        text,
  license_number text,
  is_active      boolean not null default false,
  is_verified    boolean not null default false,
  is_featured    boolean not null default false,
  sort_order     int not null default 0,
  submitted_by_public boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists service_providers_cat_idx on public.service_providers (category, is_active, is_featured desc, sort_order, name_ar);

alter table public.service_providers drop constraint if exists service_providers_category_check;
alter table public.service_providers add constraint service_providers_category_check
  check (category in ('legal', 'residency', 'engineering', 'contracting', 'interior', 'property_services'));

alter table public.service_providers enable row level security;

drop policy if exists "Public reads active providers" on public.service_providers;
create policy "Public reads active providers"
  on public.service_providers for select
  using (is_active or public.is_app_admin());

drop policy if exists "Companies submit listing requests" on public.service_providers;
create policy "Companies submit listing requests"
  on public.service_providers for insert
  to anon, authenticated
  with check (
    public.is_app_admin()
    or (
      is_active = false and is_verified = false and is_featured = false and sort_order = 0
      and submitted_by_public = true
      and logo_url is null
      and char_length(name_ar) between 2 and 120
      and char_length(coalesce(name_en, '')) <= 120
      and char_length(coalesce(phone, '')) between 6 and 30
      and char_length(coalesce(whatsapp, '')) <= 30
      and char_length(coalesce(email, '')) <= 150
      and char_length(coalesce(website, '')) <= 200
      and char_length(coalesce(emirate, '')) <= 40
      and char_length(coalesce(area, '')) <= 100
      and char_length(coalesce(description, '')) <= 600
      and char_length(coalesce(license_number, '')) <= 60
    )
  );

drop policy if exists "Admins update providers" on public.service_providers;
create policy "Admins update providers"
  on public.service_providers for update
  using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "Admins delete providers" on public.service_providers;
create policy "Admins delete providers"
  on public.service_providers for delete
  using (public.is_app_admin());

-- حاوية شعارات الشركات (عامة للقراءة، والرفع للإدارة فقط)
insert into storage.buckets (id, name, public)
values ('service-logos', 'service-logos', true)
on conflict (id) do nothing;

drop policy if exists "Public reads service logos" on storage.objects;
create policy "Public reads service logos"
  on storage.objects for select
  using (bucket_id = 'service-logos');

drop policy if exists "Admins upload service logos" on storage.objects;
create policy "Admins upload service logos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'service-logos' and public.is_app_admin());

drop policy if exists "Admins change service logos" on storage.objects;
create policy "Admins change service logos"
  on storage.objects for update to authenticated
  using (bucket_id = 'service-logos' and public.is_app_admin());

drop policy if exists "Admins delete service logos" on storage.objects;
create policy "Admins delete service logos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'service-logos' and public.is_app_admin());

-- حماية نموذج طلب الإدراج من الإغراق + تنبيه الإدارة بالبريد (إن كانت الملفات السابقة مشغّلة)
do $$
begin
  if exists (select 1 from pg_proc where proname = 'aq_enforce_rate_limit') then
    execute 'drop trigger if exists aq_rate_limit_service_providers on public.service_providers';
    execute 'create trigger aq_rate_limit_service_providers before insert on public.service_providers
             for each row execute function public.aq_enforce_rate_limit()';
  end if;
  if exists (select 1 from pg_proc where proname = 'notify_admin_on_insert') then
    execute 'drop trigger if exists notify_admin_service_providers on public.service_providers';
    execute 'create trigger notify_admin_service_providers after insert on public.service_providers
             for each row when (new.submitted_by_public) execute function public.notify_admin_on_insert()';
  end if;
end $$;

-- للتأكد
select count(*) as providers from public.service_providers;
