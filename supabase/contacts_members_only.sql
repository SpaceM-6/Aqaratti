-- ============================================================================
-- أرقام الوسطاء والمعلنين للأعضاء المسجّلين فقط
--   • الزائر غير المسجّل لا يرى هاتف أو واتساب أو بريد أي وسيط أو مكتب أو معلن، حتى بعد تفعيل الوسيط لملفه.
--   • بعد تسجيل الدخول تظهر الأرقام كما كانت (للوسطاء المفعّلين/الموافقين فقط كما هو مقرر).
--   • نموذج الاستفسار يبقى متاحًا للجميع، فيصل الاستفسار للوسيط دون أن يرى الزائر رقمه.
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor (آمن لو أُعيد تشغيله). لا يحذف أي بيانات.
-- ============================================================================

-- 1) دليل الوسطاء والمكاتب: دوال بيانات التواصل للمسجّلين فقط
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
      or (auth.uid() is not null and b.is_active and (b.claimed_by is null or b.public_contact_consent))
    )
  limit 500;
$$;

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
    and (public.is_app_admin() or (auth.uid() is not null and b.is_active))
  limit 500;
$$;
revoke execute on function public.get_individual_broker_contacts(bigint[]) from public, anon;
revoke execute on function public.get_office_broker_contacts(bigint[]) from public, anon;
grant execute on function public.get_individual_broker_contacts(bigint[]) to authenticated;
grant execute on function public.get_office_broker_contacts(bigint[]) to authenticated;

-- 2) الملفات الشخصية للمعلنين: الهاتف والواتساب لا يُقرآن إلا للمسجّلين
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles'
     and column_name not in ('phone', 'whatsapp', 'email_opt_out');
  execute 'revoke select on public.profiles from anon';
  execute format('grant select (%s) on public.profiles to anon', cols);
  execute 'grant select on public.profiles to authenticated';
end $$;

-- 3) سجل الوسطاء الفردي والمكاتب: التأكد من أن أعمدة التواصل محجوبة عن الزوار
do $$
declare cols text;
begin
  if to_regclass('public.individual_brokers') is not null then
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
      from information_schema.columns
     where table_schema = 'public' and table_name = 'individual_brokers' and column_name not in ('phone', 'email', 'mobile');
    execute 'revoke select on public.individual_brokers from anon';
    execute format('grant select (%s) on public.individual_brokers to anon', cols);
  end if;
  if to_regclass('public.brokers') is not null then
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
      from information_schema.columns
     where table_schema = 'public' and table_name = 'brokers' and column_name not in ('phone', 'email');
    execute 'revoke select on public.brokers from anon';
    execute format('grant select (%s) on public.brokers to anon', cols);
  end if;
end $$;
