-- ============================================================================
-- إغلاق بيانات تواصل الوسطاء على مستوى قاعدة البيانات
--
-- قبل: جدولا individual_brokers و brokers قابلان للقراءة بالكامل بالمفتاح العام، فكان
-- يمكن تحميل هواتف وإيميلات كل الوسطاء برمجياً حتى لو أخفتها الواجهة.
-- بعد: أعمدة التواصل (phone / email / mobile) محجوبة عن القراءة المباشرة، ولا تُسلَّم إلا عبر
-- دالتين تتحققان داخل قاعدة البيانات:
--   • للعموم: الوسيط المفعّل فقط (وإن فعّل ملفه بنفسه: بشرط موافقته على عرض بياناته)
--   • للمديرين (app_admins): الكل
-- باقي الأعمدة تبقى مقروءة كما هي، فالدليل والبحث والإحصاءات تعمل دون تغيير.
--
-- ⚠️ نفّذيه بعد نشر تحديث الموقع الذي يستخدم هذه الدوال (وهو منشور).
-- آمن لو أُعيد تشغيله. يُنفَّذ من Supabase → SQL Editor.
-- ============================================================================

-- 0) ضمان وجود الأعمدة التي تعتمد عليها الدوال (لا يغيّر شيئاً إن كانت موجودة)
alter table public.individual_brokers add column if not exists mobile text;
alter table public.individual_brokers add column if not exists claimed_by uuid;
alter table public.individual_brokers add column if not exists public_contact_consent boolean not null default false;

-- 1) حجب أعمدة التواصل عن القراءة المباشرة (يُحسب تلقائياً من أعمدة الجدول الفعلية)
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'individual_brokers'
    and column_name not in ('phone', 'email', 'mobile');
  execute 'revoke select on public.individual_brokers from anon, authenticated';
  execute format('grant select (%s) on public.individual_brokers to anon, authenticated', cols);

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'brokers'
    and column_name not in ('phone', 'email', 'mobile');
  execute 'revoke select on public.brokers from anon, authenticated';
  execute format('grant select (%s) on public.brokers to anon, authenticated', cols);
end $$;

-- 2) بيانات تواصل الوسطاء الأفراد
create or replace function public.get_individual_broker_contacts(p_ids bigint[])
returns table (id bigint, phone text, email text, mobile text)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.phone, b.email, b.mobile
  from public.individual_brokers b
  where b.id = any(p_ids)
    and (
      public.is_app_admin()
      or (b.is_active and (b.claimed_by is null or b.public_contact_consent))
    )
  limit 500;
$$;
revoke all on function public.get_individual_broker_contacts(bigint[]) from public;
grant execute on function public.get_individual_broker_contacts(bigint[]) to anon, authenticated;

-- 3) بيانات تواصل المكاتب
create or replace function public.get_office_broker_contacts(p_ids bigint[])
returns table (id bigint, phone text, email text)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.phone, b.email
  from public.brokers b
  where b.id = any(p_ids)
    and (public.is_app_admin() or b.is_active)
  limit 500;
$$;
revoke all on function public.get_office_broker_contacts(bigint[]) from public;
grant execute on function public.get_office_broker_contacts(bigint[]) to anon, authenticated;

-- للتأكد: يجب أن تفشل هذه القراءة المباشرة برسالة permission denied
-- set role anon; select phone from public.individual_brokers limit 1; reset role;
