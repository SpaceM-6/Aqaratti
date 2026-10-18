-- ============================================================================
-- الفترة المجانية للاشتراك: أول 3 أشهر مجاناً، ثم تُحتسب الباقة المختارة.
-- add-property.html يحفظ الباقة التي اختارها المعلن وتاريخ انتهاء الفترة المجانية مع كل إعلان.
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor (آمن لو أُعيد تشغيله).
-- ============================================================================
alter table public.properties add column if not exists subscription_plan text;
alter table public.properties add column if not exists trial_ends_at timestamptz;

alter table public.properties drop constraint if exists properties_subscription_plan_check;
alter table public.properties add constraint properties_subscription_plan_check
  check (subscription_plan is null or subscription_plan in ('single', 'monthly', 'semi', 'yearly'));
