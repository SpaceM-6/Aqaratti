-- ============================================================================
-- الإشعارات الفورية لتطبيق «أنا عقار» على الآيفون.
--   push_tokens: رمز كل جهاز ومالكه (يُسجَّل من التطبيق بعد موافقة المستخدم على الإشعارات)
--   عند إضافة أي تنبيه في user_notifications (حجز جديد، استفسار، رد…) تُرسله قاعدة البيانات
--   إلى الدالة السحابية push-send فتصل الرسالة إلى جوال صاحب الحساب.
-- يعتمد على notify_triggers.sql (جدول app_private_settings والكلمة السرية notify_secret).
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor (آمن لو أُعيد تشغيله).
-- ============================================================================
create extension if not exists pg_net with schema extensions;

create table if not exists public.push_tokens (
  token      text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  platform   text not null default 'ios' check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
drop policy if exists "push tokens own read" on public.push_tokens;
create policy "push tokens own read" on public.push_tokens for select to authenticated using (user_id = auth.uid());
drop policy if exists "push tokens own delete" on public.push_tokens;
create policy "push tokens own delete" on public.push_tokens for delete to authenticated using (user_id = auth.uid());

-- تسجيل رمز الجهاز للمستخدم الحالي (لو سجّل شخص آخر الدخول من نفس الجهاز ينتقل الرمز إليه)
create or replace function public.register_push_token(p_token text, p_platform text default 'ios')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or coalesce(length(p_token), 0) not between 20 and 400 then return; end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), case when p_platform = 'android' then 'android' else 'ios' end, now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;
revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- كل تنبيه جديد للمستخدم يُرسل إشعارًا إلى أجهزته (إن وُجدت)
create or replace function public.push_on_user_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
begin
  if not exists (select 1 from public.push_tokens where user_id = new.user_id) then return new; end if;
  select value into v_secret from public.app_private_settings where key = 'notify_secret';
  if v_secret is null then return new; end if;
  perform net.http_post(
    url     := 'https://mejkpckkdbmczzypzkkr.supabase.co/functions/v1/push-send',
    body    := jsonb_build_object('user_id', new.user_id, 'title', new.title, 'body', new.body, 'url', new.url),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret)
  );
  return new;
exception when others then
  return new;                       -- فشل الإشعار لا يمنع حفظ التنبيه أبداً
end;
$$;

drop trigger if exists push_user_notifications on public.user_notifications;
create trigger push_user_notifications after insert on public.user_notifications
  for each row execute function public.push_on_user_notification();
