-- ============================================================================
-- تنبيه فوري بالبريد عند: طلب خدمة جديد، استفسار/معاينة على عقار، عقار جديد بانتظار المراجعة.
-- قاعدة البيانات تستدعي الدالة السحابية notify-admin (supabase/functions/notify-admin) عبر pg_net.
-- الكلمة السرية لا تُكتب هنا (المستودع عام): تُحفظ في جدول خاص لا يُقرأ من المتصفح.
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor (آمن لو أُعيد تشغيله).
-- ============================================================================
create extension if not exists pg_net with schema extensions;

create table if not exists public.app_private_settings (
  key   text primary key,
  value text not null
);
alter table public.app_private_settings enable row level security;
-- لا سياسات عمداً: لا يُقرأ ولا يُعدَّل إلا من SQL Editor أو الدوال الداخلية.
revoke all on public.app_private_settings from anon, authenticated;

create or replace function public.notify_admin_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  v_record jsonb := to_jsonb(new);
begin
  select value into v_secret from public.app_private_settings where key = 'notify_secret';
  if v_secret is null then return new; end if;            -- لم يُضبط التنبيه بعد
  -- العقارات: نُرسل فقط ما ينتظر المراجعة
  if tg_table_name = 'properties' and coalesce(v_record->>'status', '') = 'approved' then return new; end if;
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

drop trigger if exists notify_admin_service_requests on public.service_requests;
create trigger notify_admin_service_requests after insert on public.service_requests
  for each row execute function public.notify_admin_on_insert();

drop trigger if exists notify_admin_leads on public.leads;
create trigger notify_admin_leads after insert on public.leads
  for each row execute function public.notify_admin_on_insert();

drop trigger if exists notify_admin_properties on public.properties;
create trigger notify_admin_properties after insert on public.properties
  for each row execute function public.notify_admin_on_insert();

-- ⬇️ بعد تشغيل ما سبق، شغّلي هذا السطر وحده مع كلمة سرية من اختيارك (نفس القيمة في NOTIFY_SECRET):
-- insert into public.app_private_settings (key, value) values ('notify_secret', 'ضعي-كلمة-سرية-طويلة-هنا')
--   on conflict (key) do update set value = excluded.value;
