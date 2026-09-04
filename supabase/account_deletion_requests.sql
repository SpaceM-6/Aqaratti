-- ============================================================================
-- طلبات حذف الحساب - مطلوبة من سياسة Google Play لأي تطبيق يسمح بإنشاء حسابات.
-- المستخدم المسجّل دخوله يقدر يُدخل طلب حذف خاص بحسابه فقط (RLS)، والحذف الفعلي
-- (من auth.users و profiles) يتم يدوياً عبر Supabase Admin API خلال 30 يوماً،
-- وليس تلقائياً فور الطلب - يتوافق هذا مع سياسة Google التي تسمح بمعالجة الطلب
-- خلال فترة معقولة بدلاً من الحذف الفوري.
-- ============================================================================

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.account_deletion_requests enable row level security;

drop policy if exists "Users can request their own account deletion" on public.account_deletion_requests;
create policy "Users can request their own account deletion"
  on public.account_deletion_requests
  for insert
  to public
  with check (auth.uid() = user_id);

drop policy if exists "Users can view their own deletion requests" on public.account_deletion_requests;
create policy "Users can view their own deletion requests"
  on public.account_deletion_requests
  for select
  to public
  using (auth.uid() = user_id);

-- لا توجد سياسة update/delete للمستخدمين العاديين عمداً - فقط service_role
-- (يتجاوز RLS) يقدر يُعلّم الطلب كمُعالَج (status='done', processed_at) بعد
-- حذف بيانات المستخدم فعلياً.
