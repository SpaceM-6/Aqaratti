-- ============================================================================
-- المفضلة: مزامنة حقيقية عبر الحساب بدل التخزين المحلي (localStorage) فقط.
-- property_id نص حر (مو مفتاح أجنبي صارم) لأن العقارات مصدرها مختلط: بعضها
-- من جدول properties الحقيقي (بادئة "sb-")، وبعضها بيانات تجريبية ثابتة من
-- properties.json وليست موجودة أصلاً بقاعدة البيانات - لازم نسمح بتفضيل أي منهم.
-- ============================================================================

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, property_id)
);

alter table public.favorites enable row level security;

drop policy if exists "Users can view their own favorites" on public.favorites;
create policy "Users can view their own favorites"
  on public.favorites
  for select
  to public
  using (auth.uid() = user_id);

drop policy if exists "Users can add their own favorites" on public.favorites;
create policy "Users can add their own favorites"
  on public.favorites
  for insert
  to public
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own favorites" on public.favorites;
create policy "Users can remove their own favorites"
  on public.favorites
  for delete
  to public
  using (auth.uid() = user_id);
