-- ============================================================================
-- حقول الإعلان الإضافية (صفحة add-property.html) التي تعتمد عليها أقسام الصفحة الرئيسية:
--   permit_number      رقم تصريح الإعلان من دائرة الأراضي (إلزامي لعقارات دبي)
--   completion_status  جاهز / تحت الإنشاء / مشروع جديد على الخارطة
--   no_commission      بدون عمولة على المشتري أو المستأجر
--   has_offer/offer_text  عرض أو خصم خاص
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor (آمن لو أُعيد تشغيله، ويغني عن property_permit.sql).
-- ============================================================================
alter table public.properties add column if not exists permit_number text;
alter table public.properties add column if not exists completion_status text;
alter table public.properties add column if not exists no_commission boolean not null default false;
alter table public.properties add column if not exists has_offer boolean not null default false;
alter table public.properties add column if not exists offer_text text;

alter table public.properties drop constraint if exists properties_completion_status_check;
alter table public.properties add constraint properties_completion_status_check
  check (completion_status is null or completion_status in ('ready', 'under_construction', 'off_plan'));
