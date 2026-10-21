-- ============================================================================
-- حماية النماذج العامة من الإغراق (Rate limiting) داخل قاعدة البيانات نفسها،
-- فلا يمكن تجاوزها حتى لو استُدعيت قاعدة البيانات مباشرة دون المرور بالموقع.
--
-- الحدود:
--   طلبات الخدمات + الاستفسارات + طلبات المعاينة (مجموعة واحدة):
--     • 5 طلبات في الساعة من رقم الهاتف نفسه
--     • 8 طلبات في الساعة من الجهاز/الشبكة نفسها (عنوان IP، يُحفظ مُشفّراً لا كما هو)
--     • 30 طلباً في الدقيقة للموقع كله (حماية من الهجمات الموزّعة)
--   إضافة العقارات:
--     • 15 عقاراً في اليوم للحساب الواحد، و20 في اليوم من الشبكة نفسها
--   حسابات الإدارة مستثناة من كل الحدود.
--
-- وأيضاً: بريد التنبيه يتوقف مؤقتاً إذا تجاوزت الطلبات 15 في 10 دقائق لنفس النوع،
-- حتى لا يُغرق بريد info@anaaqar.com (الطلبات نفسها تُحفظ كلها وتظهر في صفحات الإدارة).
--
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor (آمن لو أُعيد تشغيله). لا يحذف أي بيانات.
-- ============================================================================

create table if not exists public.rate_limit_hits (
  id         bigint generated always as identity primary key,
  bucket     text not null,
  key        text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limit_hits_lookup_idx on public.rate_limit_hits (bucket, key, created_at desc);
alter table public.rate_limit_hits enable row level security;
-- لا سياسات عمداً: لا يُقرأ ولا يُكتب من المتصفح، فقط من الدالة أدناه.
revoke all on public.rate_limit_hits from anon, authenticated;

create or replace function public.aq_enforce_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_headers json;
  v_ip      text;
  v_phone   text;
  v_bucket  text;
  v_window  interval;
  v_ip_max  int;
  v_n       int;
  v_rec     jsonb := to_jsonb(new);
begin
  if public.is_app_admin() then return new; end if;
  -- الإدخال المباشر من SQL Editor (بلا طلب API) لا يخضع للحدود
  if coalesce(current_setting('request.jwt.claims', true), '') = '' then return new; end if;

  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then v_headers := null;
  end;
  v_ip := trim(split_part(coalesce(v_headers->>'cf-connecting-ip', v_headers->>'x-real-ip', v_headers->>'x-forwarded-for', ''), ',', 1));

  if tg_table_name = 'properties' then
    v_bucket := 'property'; v_window := interval '1 day'; v_ip_max := 20;
    if auth.uid() is not null then
      select count(*) into v_n from public.rate_limit_hits
       where bucket = v_bucket and key = 'user:' || auth.uid()::text and created_at > now() - v_window;
      if v_n >= 15 then raise exception 'rate_limited' using hint = 'properties_per_day'; end if;
    end if;
  else
    v_bucket := 'form'; v_window := interval '1 hour'; v_ip_max := 8;

    -- حد الموقع كله: 30 في الدقيقة لكل جدول
    execute format('select count(*) from public.%I where created_at > now() - interval ''1 minute''', tg_table_name) into v_n;
    if v_n >= 30 then raise exception 'rate_limited' using hint = 'global_per_minute'; end if;

    v_phone := regexp_replace(coalesce(v_rec->>'phone', v_rec->>'buyer_phone', ''), '\D', '', 'g');
    if length(v_phone) >= 6 then
      select count(*) into v_n from public.rate_limit_hits
       where bucket = v_bucket and key = 'phone:' || md5(v_phone) and created_at > now() - v_window;
      if v_n >= 5 then raise exception 'rate_limited' using hint = 'phone_per_hour'; end if;
    end if;
  end if;

  if v_ip <> '' then
    select count(*) into v_n from public.rate_limit_hits
     where bucket = v_bucket and key = 'ip:' || md5(v_ip) and created_at > now() - v_window;
    if v_n >= v_ip_max then raise exception 'rate_limited' using hint = 'ip_limit'; end if;
    insert into public.rate_limit_hits (bucket, key) values (v_bucket, 'ip:' || md5(v_ip));
  end if;
  if v_bucket = 'form' and length(coalesce(v_phone, '')) >= 6 then
    insert into public.rate_limit_hits (bucket, key) values (v_bucket, 'phone:' || md5(v_phone));
  end if;
  if v_bucket = 'property' and auth.uid() is not null then
    insert into public.rate_limit_hits (bucket, key) values (v_bucket, 'user:' || auth.uid()::text);
  end if;

  -- تنظيف دوري خفيف للسجلات القديمة
  if random() < 0.05 then
    delete from public.rate_limit_hits where created_at < now() - interval '2 days';
  end if;

  return new;
end;
$$;

drop trigger if exists aq_rate_limit_service_requests on public.service_requests;
create trigger aq_rate_limit_service_requests before insert on public.service_requests
  for each row execute function public.aq_enforce_rate_limit();

drop trigger if exists aq_rate_limit_leads on public.leads;
create trigger aq_rate_limit_leads before insert on public.leads
  for each row execute function public.aq_enforce_rate_limit();

drop trigger if exists aq_rate_limit_properties on public.properties;
create trigger aq_rate_limit_properties before insert on public.properties
  for each row execute function public.aq_enforce_rate_limit();

-- ----------------------------------------------------------------------------
-- سقف بريد التنبيه: نسخة محدّثة من دالة notify_triggers.sql مع حد 15 رسالة/10 دقائق لكل نوع
-- ----------------------------------------------------------------------------
create or replace function public.notify_admin_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  v_record jsonb := to_jsonb(new);
  v_recent int;
begin
  select value into v_secret from public.app_private_settings where key = 'notify_secret';
  if v_secret is null then return new; end if;            -- لم يُضبط التنبيه بعد
  -- العقارات: نُرسل فقط ما ينتظر المراجعة
  if tg_table_name = 'properties' and coalesce(v_record->>'status', '') = 'approved' then return new; end if;
  -- سقف الرسائل: إن وصل أكثر من 15 من نفس النوع خلال 10 دقائق، نكتفي بحفظها دون بريد
  execute format('select count(*) from public.%I where created_at > now() - interval ''10 minutes''', tg_table_name) into v_recent;
  if v_recent > 15 then return new; end if;
  perform net.http_post(
    url     := 'https://mejkpckkdbmczzypzkkr.supabase.co/functions/v1/notify-admin',
    body    := jsonb_build_object('table', tg_table_name, 'record', v_record),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret)
  );
  return new;
exception when others then
  return new;                                             -- فشل التنبيه لا يمنع حفظ الطلب أبداً
end;
$$;

-- للتأكد: يجب أن تظهر 3 أسطر (aq_rate_limit_...)
select tgname, tgrelid::regclass as table_name
from pg_trigger where tgname like 'aq_rate_limit_%';
