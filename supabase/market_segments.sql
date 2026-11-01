-- ============================================================================
-- بيانات السوق: الفصل بين البيع الجاهز والبيع على الخارطة في ملخصات المناطق.
-- يضيف عمود segment (all / ready / offplan) ويجعله جزءًا من المفتاح.
-- الصفوف المحفوظة سابقًا تصبح segment = 'all' ولا يضيع شيء.
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor (آمن لو أُعيد تشغيله)، ثم أعيدي رفع ملف صفقات البيع.
-- ============================================================================
alter table public.area_market_stats add column if not exists segment text not null default 'all';
do $$ begin
  alter table public.area_market_stats add constraint area_market_stats_segment_chk check (segment in ('all', 'ready', 'offplan'));
exception when duplicate_object then null; end $$;
alter table public.area_market_stats drop constraint if exists area_market_stats_pkey;
alter table public.area_market_stats add primary key (area_en, month, kind, usage, segment);
