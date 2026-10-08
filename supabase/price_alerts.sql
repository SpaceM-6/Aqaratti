-- ============================================================================
-- تنبيهات الأسعار: المستخدم يحفظ السعر المستهدف لعقار، ونخزن سعره الحالي وقت
-- الحفظ للمقارنة لاحقاً. مُقتصر عملياً على عقارات جدول properties الحقيقية
-- (بادئة "sb-") لأن المقارنة الدورية تحتاج سعر حي من القاعدة - العقارات
-- التجريبية الثابتة من properties.json سعرها لا يتغير فلا فائدة من تنبيه عليها.
--
-- ⚠️ هذا الجدول يخزّن الطلب فقط. الإشعار الفعلي التلقائي (مقارنة الأسعار دورياً
-- وإرسال بريد) يحتاج مهمة مجدولة (pg_cron + Supabase Edge Function) تُضاف
-- كخطوة منفصلة لاحقاً إذا رغبت - الجدول والواجهة جاهزان لذلك فوراً.
-- ============================================================================

create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id text not null,
  target_price numeric not null check (target_price > 0),
  price_at_creation numeric,
  notified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, property_id)
);

alter table public.price_alerts enable row level security;

drop policy if exists "Users can view their own price alerts" on public.price_alerts;
create policy "Users can view their own price alerts"
  on public.price_alerts
  for select
  to public
  using (auth.uid() = user_id);

drop policy if exists "Users can add their own price alerts" on public.price_alerts;
create policy "Users can add their own price alerts"
  on public.price_alerts
  for insert
  to public
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own price alerts" on public.price_alerts;
create policy "Users can delete their own price alerts"
  on public.price_alerts
  for delete
  to public
  using (auth.uid() = user_id);
