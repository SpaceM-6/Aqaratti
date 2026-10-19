-- ============================================================================
-- مراجعة العقارات واعتمادها (صفحة admin/properties.html)
--
-- 1) أعمدة المراجعة: سبب الرفض ووقت المراجعة.
-- 2) سياسات أمان جدول العقارات من جديد، حتى لا يستطيع أي وسيط اعتماد عقاره بنفسه:
--    • القراءة: العقارات المعتمدة للجميع، والوسيط يرى عقاراته، والإدارة ترى الكل.
--    • الإضافة: لمستخدم مسجّل، باسمه هو فقط، وبحالة «قيد المراجعة» فقط.
--    • التعديل (ومنه الاعتماد والرفض): للإدارة فقط (app_admins).
--    • الحذف: صاحب العقار أو الإدارة.
--
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor (آمن لو أُعيد تشغيله).
-- لا يحذف أي عقار ولا أي بيانات.
-- ============================================================================

-- (مكرر حتى يعمل الملف وحده)
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

-- 1) أعمدة المراجعة
alter table public.properties add column if not exists rejection_reason text;
alter table public.properties add column if not exists reviewed_at timestamptz;
alter table public.properties alter column status set default 'pending';

-- 2) حذف كل السياسات القديمة على جدول العقارات (أُنشئت سابقاً من لوحة Supabase)
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'properties' loop
    execute format('drop policy if exists %I on public.properties', p.policyname);
  end loop;
end $$;

alter table public.properties enable row level security;

create policy "Read approved, own, or all for admins"
  on public.properties for select
  using (status = 'approved' or broker_id::text = auth.uid()::text or public.is_app_admin());

create policy "Brokers add their own pending properties"
  on public.properties for insert
  to authenticated
  with check (
    (broker_id::text = auth.uid()::text and coalesce(status, 'pending') = 'pending')
    or public.is_app_admin()
  );

create policy "Admins update properties"
  on public.properties for update
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy "Owner or admin deletes property"
  on public.properties for delete
  using (broker_id::text = auth.uid()::text or public.is_app_admin());

-- للتأكد: يجب أن تظهر 4 سياسات
select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'properties';
