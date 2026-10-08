-- ============================================================================
-- تقييمات العقارات (مختلفة عن broker_reviews الموجود، واللي خاص بتقييم الوسيط
-- نفسه). هذا الجدول لتقييم العقار كإعلان بحد ذاته - تجربة الزائر معه.
-- property_id نص حر لنفس سبب جدول favorites (بيانات مختلطة حقيقية/تجريبية).
-- ============================================================================

create table if not exists public.property_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id text not null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (user_id, property_id)
);

alter table public.property_reviews enable row level security;

-- التقييمات عامة يشوفها الجميع (زي أي منصة مراجعات)
drop policy if exists "Anyone can read property reviews" on public.property_reviews;
create policy "Anyone can read property reviews"
  on public.property_reviews
  for select
  to public
  using (true);

drop policy if exists "Logged-in users can add their own review" on public.property_reviews;
create policy "Logged-in users can add their own review"
  on public.property_reviews
  for insert
  to public
  with check (auth.uid() = user_id);

drop policy if exists "Users can edit their own review" on public.property_reviews;
create policy "Users can edit their own review"
  on public.property_reviews
  for update
  to public
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own review" on public.property_reviews;
create policy "Users can delete their own review"
  on public.property_reviews
  for delete
  to public
  using (auth.uid() = user_id);
