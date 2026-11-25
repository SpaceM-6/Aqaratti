-- ============================================================================
-- أرقام شركات الخدمات والدليل متعدد الدول: للأعضاء المسجّلين فقط، وبضغطة لكل جهة
--   • الزائر غير المسجّل لا يرى أي هاتف أو واتساب أو بريد، ويظهر له زر «سجّل الدخول لإظهار الرقم».
--   • العضو المسجّل يضغط «إظهار الرقم» فيُجلب رقم هذه الجهة وحدها من قاعدة البيانات.
--   • لا يمكن سحب الأرقام جملةً: أعمدة التواصل محجوبة عن القراءة المباشرة للجميع، والدالة
--     تعطي جهة واحدة في كل طلب، وبحدّ 60 إظهارًا في الساعة و300 في اليوم لكل عضو.
--   • المديرون (app_admins) يرون كل البيانات في لوحة الإدارة بلا حدود.
-- يُنفَّذ على مرحلتين من Supabase → SQL Editor. آمن لو أُعيد تشغيله، ولا يحذف أي بيانات.
-- ============================================================================

-- ======================= المرحلة الأولى (إضافات فقط، لا تكسر شيئًا) =======================

-- 1) عمود يبيّن هل للجهة وسيلة تواصل، حتى يظهر زر «إظهار الرقم» عند وجود رقم فقط
alter table public.service_providers add column if not exists has_contact boolean
  generated always as (coalesce(nullif(btrim(phone), ''), nullif(btrim(whatsapp), ''), nullif(btrim(email), '')) is not null) stored;
alter table public.directory_brokers add column if not exists has_contact boolean
  generated always as (coalesce(nullif(btrim(phone), ''), nullif(btrim(email), '')) is not null) stored;

-- 2) سجل الإظهار (لحدّ الاستخدام فقط، يُنظَّف بعد 30 يومًا)
create table if not exists public.aq_contact_reveals (
  id      bigint generated always as identity primary key,
  user_id uuid not null,
  kind    text not null,
  item    text not null,
  at      timestamptz not null default now()
);
create index if not exists aq_contact_reveals_user_at on public.aq_contact_reveals (user_id, at desc);
alter table public.aq_contact_reveals enable row level security;
revoke all on public.aq_contact_reveals from anon, authenticated;

create or replace function public.aq_contact_reveal_guard(p_kind text, p_item text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'sign_in_required'; end if;
  if (select count(*) from public.aq_contact_reveals where user_id = v_uid and at > now() - interval '1 hour') >= 60
     or (select count(*) from public.aq_contact_reveals where user_id = v_uid and at > now() - interval '1 day') >= 300 then
    raise exception 'rate_limited';
  end if;
  -- إعادة إظهار الجهة نفسها لا تُحسب مرة ثانية خلال اليوم
  if not exists (select 1 from public.aq_contact_reveals
                  where user_id = v_uid and kind = p_kind and item = p_item and at > now() - interval '1 day') then
    insert into public.aq_contact_reveals (user_id, kind, item) values (v_uid, p_kind, p_item);
  end if;
end $$;
revoke all on function public.aq_contact_reveal_guard(text, text) from public, anon, authenticated;

-- 3) تواصل شركات الخدمات
create or replace function public.get_service_provider_contacts(p_ids bigint[])
returns table (id bigint, phone text, whatsapp text, email text)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_admin boolean := public.is_app_admin();
begin
  if auth.uid() is null then return; end if;
  if not v_admin then
    if coalesce(array_length(p_ids, 1), 0) <> 1 then raise exception 'one_at_a_time'; end if;
    perform public.aq_contact_reveal_guard('service', p_ids[1]::text);
  end if;
  return query
    select s.id, s.phone, s.whatsapp, s.email
    from public.service_providers s
    where s.id = any(p_ids) and (v_admin or s.is_active)
    limit 1000;
end $$;
revoke all on function public.get_service_provider_contacts(bigint[]) from public, anon;
grant execute on function public.get_service_provider_contacts(bigint[]) to authenticated;

-- 4) تواصل الدليل متعدد الدول
create or replace function public.get_directory_broker_contacts(p_ids uuid[])
returns table (id uuid, phone text, email text)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_admin boolean := public.is_app_admin();
begin
  if auth.uid() is null then return; end if;
  if not v_admin then
    if coalesce(array_length(p_ids, 1), 0) <> 1 then raise exception 'one_at_a_time'; end if;
    perform public.aq_contact_reveal_guard('directory', p_ids[1]::text);
  end if;
  return query
    select d.id, d.phone, d.email
    from public.directory_brokers d
    where d.id = any(p_ids) and (v_admin or d.is_active)
    limit 1000;
end $$;
revoke all on function public.get_directory_broker_contacts(uuid[]) from public, anon;
grant execute on function public.get_directory_broker_contacts(uuid[]) to authenticated;

-- 5) بحث المدير في الدليل برقم الهاتف أو البريد
create or replace function public.admin_directory_broker_ids_by_contact(p_q text)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select case when public.is_app_admin() and length(btrim(coalesce(p_q, ''))) >= 3 then
    array(select d.id from public.directory_brokers d
           where d.phone ilike '%' || btrim(p_q) || '%' or d.email ilike '%' || btrim(p_q) || '%'
           limit 500)
  else '{}'::uuid[] end;
$$;
revoke all on function public.admin_directory_broker_ids_by_contact(text) from public, anon;
grant execute on function public.admin_directory_broker_ids_by_contact(text) to authenticated;

-- 6) تنظيف سجل الإظهار يوميًا
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'aq-contact-reveals-cleanup';
  perform cron.schedule('aq-contact-reveals-cleanup', '50 3 * * *',
    $c$delete from public.aq_contact_reveals where at < now() - interval '30 days'$c$);
exception when others then raise notice 'pg_cron غير متاح: %', sqlerrm; end $$;

-- ======================= المرحلة الثانية (بعد نشر تحديث الموقع) =======================
-- 7) حجب أعمدة التواصل عن القراءة المباشرة للزوار والأعضاء (يُحسب من أعمدة الجدول الفعلية)
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'service_providers'
     and column_name not in ('phone', 'whatsapp', 'email');
  execute 'revoke select on public.service_providers from anon, authenticated';
  execute format('grant select (%s) on public.service_providers to anon, authenticated', cols);

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'directory_brokers'
     and column_name not in ('phone', 'email');
  execute 'revoke select on public.directory_brokers from anon, authenticated';
  execute format('grant select (%s) on public.directory_brokers to anon, authenticated', cols);
end $$;

-- للتأكد: يجب أن تفشل هذه القراءة برسالة permission denied
-- set role anon; select phone from public.service_providers limit 1; reset role;
