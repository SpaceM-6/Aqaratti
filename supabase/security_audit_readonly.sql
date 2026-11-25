-- ================================================================
-- فحص أمان شامل لقاعدة بيانات «أنا عقار» — للقراءة فقط، لا يغيّر شيئًا.
-- شغّليه في Supabase → SQL Editor، ثم Export → CSV وأرسلي الملف.
-- ================================================================
with
pol as (
  select p.schemaname, p.tablename, p.policyname, p.cmd, p.roles::text roles,
         coalesce(p.qual, '') qual, coalesce(p.with_check, '') wc
  from pg_policies p where p.schemaname in ('public', 'storage')
),
sens as (
  select distinct table_name from information_schema.columns
  where table_schema = 'public'
    and column_name ~* '(phone|whatsapp|email|mobile|passport|emirates_id|national_id|id_number|iban|address|birth|password|token)'
)
-- 1) جداول بلا حماية RLS
select 'حرج' as severity, 'جدول بلا RLS' as issue, c.relname::text as object, '' as detail
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
union all
-- 2) سياسات كتابة مفتوحة تمامًا
select 'حرج', 'سياسة كتابة مفتوحة', tablename || ' / ' || policyname, cmd || ' to ' || roles || ' using ' || qual || ' check ' || wc
from pol
where cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  and ((cmd in ('UPDATE', 'DELETE', 'ALL') and qual in ('true', '(true)', '(auth.uid() IS NOT NULL)', '(auth.role() = ''authenticated''::text)'))
    or (cmd = 'INSERT' and wc in ('true', '(true)')))
union all
-- 3) جداول فيها بيانات شخصية ويقرؤها الجميع
select 'مرتفع', 'بيانات شخصية مقروءة للجميع', pol.tablename || ' / ' || policyname, roles || ' using ' || qual
from pol join sens on sens.table_name = pol.tablename
where pol.schemaname = 'public' and cmd in ('SELECT', 'ALL') and qual in ('true', '(true)')
union all
-- 4) دوال security definer بلا search_path ثابت
select 'متوسط', 'دالة security definer بلا search_path', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ''
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) x where x like 'search_path=%')
union all
-- 5) دوال security definer يستدعيها الزائر غير المسجّل (للمراجعة)
select 'للمراجعة', 'دالة security definer متاحة للزوار', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ''
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
  and p.proname not like 'postgis%' and p.proname not like 'st\_%' and p.proname not like '\_%'
union all
-- 6) عروض (views) تتجاوز RLS
select 'مرتفع', 'view تتجاوز RLS (ليست security_invoker)', c.relname::text, ''
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v'
  and not coalesce(c.reloptions::text like '%security_invoker=true%', false)
  and c.relname not in ('geography_columns', 'geometry_columns')
union all
-- 7) صلاحيات كتابة مباشرة للزوار على جداول
select 'للمراجعة', 'صلاحية كتابة للزوار (anon)', table_name::text, string_agg(privilege_type, ', ')
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public' and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
group by table_name
union all
-- 8) مخازن ملفات عامة
select 'للمراجعة', 'مخزن ملفات عام (bucket)', b.id::text, 'public=' || b.public || ' limit=' || coalesce(b.file_size_limit::text, 'بلا حد') || ' types=' || coalesce(array_to_string(b.allowed_mime_types, ','), 'أي نوع')
from storage.buckets b
union all
-- 9) سياسات مخازن الملفات
select 'للمراجعة', 'سياسة ملفات', tablename || ' / ' || policyname, cmd || ' to ' || roles || ' using ' || qual || ' check ' || wc
from pol where schemaname = 'storage'
union all
-- 10) امتدادات منصّبة في المخطط العام
select 'منخفض', 'امتداد داخل public', e.extname::text, ''
from pg_extension e join pg_namespace n on n.oid = e.extnamespace where n.nspname = 'public'
order by 1, 2, 3;
