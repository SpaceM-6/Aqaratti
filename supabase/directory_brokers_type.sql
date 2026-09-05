-- ============================================================================
-- يضيف broker_type لجدول directory_brokers (مكتب أو وسيط فرد) عشان تبويب
-- "الوسطاء الموثقون" الجديد بصفحة الوسطاء الأفراد يقدر يعرض المسجّلين ذاتياً
-- كأفراد بشكل منفصل عن "المكاتب الموثقة"، بنفس الجدول والحقول والـ RLS
-- الموجودة أصلاً - فرق نوع فقط، بدون الحاجة لجدول جديد كامل.
-- ============================================================================

alter table public.directory_brokers add column if not exists broker_type text not null default 'office'
  check (broker_type in ('office', 'individual'));

create index if not exists directory_brokers_type_idx on public.directory_brokers (broker_type);
