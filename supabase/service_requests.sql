-- ============================================================================
-- طلبات الخدمات من الصفحة الرئيسية (قسم «خدمات أنا عقار» والزر العائم):
-- الزائر يرسل طلباً (اسم/هاتف/تفاصيل) → يُحفظ هنا → يظهر في admin/service-requests.html.
-- الإدخال مسموح للجميع بشروط تحقق؛ القراءة والتعديل والحذف للمديرين فقط (app_admins).
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor (آمن لو أُعيد تشغيله).
-- ============================================================================

-- (مكرر من admin_only_broker_updates.sql حتى يعمل هذا الملف وحده أيضاً)
create table if not exists public.app_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;
grant execute on function public.is_app_admin() to anon, authenticated;

create table if not exists public.service_requests (
  id          bigint generated always as identity primary key,
  service     text not null,
  name        text not null,
  phone       text not null,
  email       text,
  city        text,
  details     text,
  page        text,
  status      text not null default 'new',   -- new | contacted | done
  admin_notes text,
  created_at  timestamptz not null default now()
);
create index if not exists service_requests_created_idx on public.service_requests (created_at desc);

alter table public.service_requests enable row level security;

drop policy if exists "Anyone can submit a service request" on public.service_requests;
create policy "Anyone can submit a service request"
  on public.service_requests for insert
  to anon, authenticated
  with check (
    service in ('general','brokerage','residency','legal','property_services','engineering','contracting','interior','citizenship')
    and char_length(name) between 2 and 100
    and char_length(phone) between 6 and 30
    and char_length(coalesce(email, '')) <= 150
    and char_length(coalesce(city, '')) <= 100
    and char_length(coalesce(details, '')) <= 2000
    and status = 'new'
    and admin_notes is null
  );

drop policy if exists "Admins read service requests" on public.service_requests;
create policy "Admins read service requests"
  on public.service_requests for select
  using (public.is_app_admin());

drop policy if exists "Admins update service requests" on public.service_requests;
create policy "Admins update service requests"
  on public.service_requests for update
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists "Admins delete service requests" on public.service_requests;
create policy "Admins delete service requests"
  on public.service_requests for delete
  using (public.is_app_admin());
