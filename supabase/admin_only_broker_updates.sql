-- ============================================================================
-- إغلاق ثغرة: كانت سياستا UPDATE على brokers و individual_brokers تسمحان لأي
-- مستخدم مسجّل دخوله (أي شخص ينشئ حساباً بالموقع) بتعديل أي وسيط. هنا نحصر
-- التعديل في حسابات الإدارة المسجلة في جدول app_admins فقط.
-- تفعيل الوسيط لملفه بنفسه يبقى يعمل، لأنه يمر عبر claim_individual_broker
-- (security definer) التي تتحقق من تطابق البريد ولا تعتمد على هذه السياسة.
--
-- يُنفَّذ مرة واحدة من Supabase Dashboard → SQL Editor.
-- ============================================================================

create table if not exists public.app_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
-- لا سياسات على app_admins عمداً: لا يُقرأ ولا يُعدَّل من المتصفح، فقط من SQL Editor.

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

-- حساب الإدارة: غيّري البريد إن كنتِ تدخلين صفحات admin ببريد آخر.
insert into public.app_admins (user_id)
select id from auth.users where lower(email) = lower('maymonanada@gmail.com')
on conflict do nothing;

-- brokers (المكاتب)
drop policy if exists "Authenticated users can update brokers" on public.brokers;
drop policy if exists "Admins can update brokers" on public.brokers;
create policy "Admins can update brokers"
  on public.brokers for update
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- individual_brokers (الوسطاء الأفراد)
drop policy if exists "Authenticated users can update individual brokers" on public.individual_brokers;
drop policy if exists "Admins can update individual brokers" on public.individual_brokers;
create policy "Admins can update individual brokers"
  on public.individual_brokers for update
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- للتأكد بعد التنفيذ: يجب أن يظهر صف واحد على الأقل
select a.user_id, u.email from public.app_admins a join auth.users u on u.id = a.user_id;
