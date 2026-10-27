-- ============================================================================
-- مزايا التفاعل في أنا عقار + لوحة التحكم:
--   1) شريط الجديد (site_news)
--   2) العروض (site_offers)
--   3) نصائح اليوم (daily_tips)
--   4) البلاغات والشكاوى (reports)
--   5) الدردشة المباشرة مع خدمة العملاء (chat_threads + chat_messages)
--   6) البحوث المحفوظة وإشعارات المستخدمين (saved_searches + user_notifications)
--
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor بعد الملفات السابقة (آمن لو أُعيد تشغيله، لا يحذف بيانات).
-- يعتمد على: is_app_admin() و aq_enforce_rate_limit() و notify_admin_on_insert() الموجودة مسبقًا.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) شريط الجديد
-- ---------------------------------------------------------------------------
create table if not exists public.site_news (
  id         bigint generated always as identity primary key,
  body       text not null check (char_length(body) between 2 and 200),
  url        text,
  is_active  boolean not null default true,
  sort       int not null default 0,
  ends_on    date,
  created_at timestamptz not null default now()
);
alter table public.site_news enable row level security;
drop policy if exists "news public read" on public.site_news;
create policy "news public read" on public.site_news for select
  using ((is_active and (ends_on is null or ends_on >= current_date)) or public.is_app_admin());
drop policy if exists "news admin write" on public.site_news;
create policy "news admin write" on public.site_news for all
  using (public.is_app_admin()) with check (public.is_app_admin());
grant select on public.site_news to anon, authenticated;
grant insert, update, delete on public.site_news to authenticated;

-- ---------------------------------------------------------------------------
-- 2) العروض
-- ---------------------------------------------------------------------------
create table if not exists public.site_offers (
  id           bigint generated always as identity primary key,
  title        text not null check (char_length(title) between 2 and 120),
  body         text check (char_length(coalesce(body, '')) <= 1000),
  badge        text check (char_length(coalesce(badge, '')) <= 30),
  image_url    text,
  url          text,
  property_ids text[] not null default '{}',
  is_active    boolean not null default true,
  sort         int not null default 0,
  ends_on      date,
  created_at   timestamptz not null default now()
);
alter table public.site_offers enable row level security;
drop policy if exists "offers public read" on public.site_offers;
create policy "offers public read" on public.site_offers for select
  using ((is_active and (ends_on is null or ends_on >= current_date)) or public.is_app_admin());
drop policy if exists "offers admin write" on public.site_offers;
create policy "offers admin write" on public.site_offers for all
  using (public.is_app_admin()) with check (public.is_app_admin());
grant select on public.site_offers to anon, authenticated;
grant insert, update, delete on public.site_offers to authenticated;

-- ---------------------------------------------------------------------------
-- 3) نصائح اليوم
-- ---------------------------------------------------------------------------
create table if not exists public.daily_tips (
  id         bigint generated always as identity primary key,
  body       text not null check (char_length(body) between 5 and 400),
  is_active  boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.daily_tips enable row level security;
drop policy if exists "tips public read" on public.daily_tips;
create policy "tips public read" on public.daily_tips for select using (is_active or public.is_app_admin());
drop policy if exists "tips admin write" on public.daily_tips;
create policy "tips admin write" on public.daily_tips for all
  using (public.is_app_admin()) with check (public.is_app_admin());
grant select on public.daily_tips to anon, authenticated;
grant insert, update, delete on public.daily_tips to authenticated;

-- نصائح أولية (تُضاف مرة واحدة فقط إن كان الجدول فارغًا، ويمكن تعديلها أو حذفها من لوحة التحكم)
insert into public.daily_tips (body, sort)
select b, n from (values
  ('تأكد دائمًا من رقم تصريح الإعلان (Permit) قبل التواصل بشأن أي عقار في دبي.', 1),
  ('اطلب من الوسيط رقم ترخيصه من دائرة الأراضي والأملاك، فالوسيط المرخّص يحميك من الاحتيال.', 2),
  ('لا تدفع أي مبلغ قبل توقيع عقد رسمي مسجّل، ولا تحوّل دفعات إلى حسابات شخصية.', 3),
  ('قارن سعر المتر في المنطقة نفسها قبل القرار، ولا تعتمد على سعر إعلان واحد.', 4),
  ('في العقارات على الخارطة، راجع سجل المطوّر ومواعيد تسليم مشاريعه السابقة.', 5),
  ('احسب التكاليف الإضافية: رسوم التسجيل، وعمولة الوسيط، ورسوم الخدمات السنوية.', 6),
  ('زُر العقار في أوقات مختلفة من اليوم لتعرف حركة المرور والضوضاء والإضاءة الطبيعية.', 7),
  ('العائد الإيجاري يختلف من منطقة لأخرى، فاسأل عن نسبة الإشغال قبل الشراء للاستثمار.', 8)
) v(b, n)
where not exists (select 1 from public.daily_tips);

-- ---------------------------------------------------------------------------
-- 4) البلاغات والشكاوى
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id         bigint generated always as identity primary key,
  kind       text not null default 'listing' check (kind in ('listing', 'broker', 'company', 'site', 'other')),
  target     text check (char_length(coalesce(target, '')) <= 200),
  target_url text check (char_length(coalesce(target_url, '')) <= 400),
  details    text not null check (char_length(details) between 5 and 2000),
  name       text check (char_length(coalesce(name, '')) <= 80),
  phone      text check (char_length(coalesce(phone, '')) <= 30),
  email      text check (char_length(coalesce(email, '')) <= 120),
  status     text not null default 'new' check (status in ('new', 'reviewing', 'done')),
  admin_note text,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
drop policy if exists "reports public insert" on public.reports;
create policy "reports public insert" on public.reports for insert to anon, authenticated
  with check (status = 'new' and admin_note is null);
drop policy if exists "reports admin read" on public.reports;
create policy "reports admin read" on public.reports for select using (public.is_app_admin());
drop policy if exists "reports admin update" on public.reports;
create policy "reports admin update" on public.reports for update
  using (public.is_app_admin()) with check (public.is_app_admin());
drop policy if exists "reports admin delete" on public.reports;
create policy "reports admin delete" on public.reports for delete using (public.is_app_admin());
grant insert on public.reports to anon, authenticated;
grant select, update, delete on public.reports to authenticated;

drop trigger if exists aq_rate_limit_reports on public.reports;
create trigger aq_rate_limit_reports before insert on public.reports
  for each row execute function public.aq_enforce_rate_limit();
drop trigger if exists notify_admin_reports on public.reports;
create trigger notify_admin_reports after insert on public.reports
  for each row execute function public.notify_admin_on_insert();

-- ---------------------------------------------------------------------------
-- 5) الدردشة المباشرة
--    الزائر لا يقرأ الجداول مباشرة: يتعامل عبر دوال تتحقق من «رمز المحادثة» السري
--    المحفوظ في جهازه فقط. الإدارة تقرأ وتكتب مباشرة.
-- ---------------------------------------------------------------------------
create table if not exists public.chat_threads (
  id            uuid primary key default gen_random_uuid(),
  token         uuid not null default gen_random_uuid(),
  user_id       uuid,
  name          text not null check (char_length(name) between 2 and 80),
  phone         text check (char_length(coalesce(phone, '')) <= 30),
  email         text check (char_length(coalesce(email, '')) <= 120),
  page          text check (char_length(coalesce(page, '')) <= 300),
  status        text not null default 'open' check (status in ('open', 'closed')),
  last_at       timestamptz not null default now(),
  last_preview  text,
  last_sender   text,
  unread_admin  int not null default 0,
  unread_user   int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists chat_threads_last_idx on public.chat_threads (last_at desc);

create table if not exists public.chat_messages (
  id         bigint generated always as identity primary key,
  thread_id  uuid not null references public.chat_threads(id) on delete cascade,
  sender     text not null check (sender in ('user', 'admin')),
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_thread_idx on public.chat_messages (thread_id, id);

alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
drop policy if exists "chat threads admin" on public.chat_threads;
create policy "chat threads admin" on public.chat_threads for all
  using (public.is_app_admin()) with check (public.is_app_admin());
drop policy if exists "chat messages admin" on public.chat_messages;
create policy "chat messages admin" on public.chat_messages for all
  using (public.is_app_admin()) with check (public.is_app_admin() and sender = 'admin');
revoke all on public.chat_threads, public.chat_messages from anon;
grant select, insert, update, delete on public.chat_threads, public.chat_messages to authenticated;

-- بعد كل رسالة: تحديث ملخص المحادثة، وتنبيه الإدارة بالبريد عند بداية حديث جديد من الزائر
create or replace function public.chat_after_message()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_thread  public.chat_threads;
  v_prev    public.chat_messages;
  v_secret  text;
begin
  select * into v_prev from public.chat_messages
   where thread_id = new.thread_id and id < new.id order by id desc limit 1;

  update public.chat_threads set
    last_at      = now(),
    last_preview = left(new.body, 140),
    last_sender  = new.sender,
    unread_admin = case when new.sender = 'user' then unread_admin + 1 else 0 end,
    unread_user  = case when new.sender = 'admin' then unread_user + 1 else unread_user end,
    status       = case when new.sender = 'user' then 'open' else status end
  where id = new.thread_id
  returning * into v_thread;

  -- تنبيه بالبريد: أول رسالة، أو بعد رد الإدارة، أو بعد 15 دقيقة صمت
  if new.sender = 'user' and (v_prev.id is null or v_prev.sender = 'admin' or v_prev.created_at < now() - interval '15 minutes') then
    begin
      select value into v_secret from public.app_private_settings where key = 'notify_secret';
      if v_secret is not null then
        perform net.http_post(
          url     := 'https://mejkpckkdbmczzypzkkr.supabase.co/functions/v1/notify-admin',
          body    := jsonb_build_object('table', 'chat_messages', 'record', jsonb_build_object(
                       'name', v_thread.name, 'phone', v_thread.phone, 'email', v_thread.email,
                       'page', v_thread.page, 'body', new.body)),
          headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret)
        );
      end if;
    exception when others then null;   -- فشل التنبيه لا يمنع حفظ الرسالة
    end;
  end if;
  return new;
end;
$$;
drop trigger if exists chat_after_message on public.chat_messages;
create trigger chat_after_message after insert on public.chat_messages
  for each row execute function public.chat_after_message();

-- بدء محادثة جديدة (للزائر)
create or replace function public.chat_start(p_name text, p_phone text, p_email text default null, p_page text default null)
returns table (thread_id uuid, token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text := btrim(coalesce(p_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_n     int;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 80 then raise exception 'invalid_name'; end if;
  if length(regexp_replace(v_phone, '\D', '', 'g')) < 7 then raise exception 'invalid_phone'; end if;
  select count(*) into v_n from public.chat_threads where created_at > now() - interval '1 minute';
  if v_n >= 20 then raise exception 'rate_limited'; end if;
  select count(*) into v_n from public.chat_threads
   where regexp_replace(coalesce(phone, ''), '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g')
     and created_at > now() - interval '1 hour';
  if v_n >= 5 then raise exception 'rate_limited'; end if;

  return query
  insert into public.chat_threads (name, phone, email, page, user_id)
  values (v_name, left(v_phone, 30), nullif(left(btrim(coalesce(p_email, '')), 120), ''), left(coalesce(p_page, ''), 300), auth.uid())
  returning chat_threads.id, chat_threads.token;
end;
$$;

-- إرسال رسالة من الزائر
create or replace function public.chat_send(p_thread uuid, p_token uuid, p_body text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_n    int;
  v_id   bigint;
begin
  if not exists (select 1 from public.chat_threads where id = p_thread and token = p_token) then
    raise exception 'not_found';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then raise exception 'invalid_body'; end if;
  select count(*) into v_n from public.chat_messages
   where thread_id = p_thread and sender = 'user' and created_at > now() - interval '10 minutes';
  if v_n >= 30 then raise exception 'rate_limited'; end if;
  insert into public.chat_messages (thread_id, sender, body) values (p_thread, 'user', v_body) returning id into v_id;
  return v_id;
end;
$$;

-- قراءة رسائل المحادثة (للزائر)، وتصفير عدّاد غير المقروء عنده
create or replace function public.chat_fetch(p_thread uuid, p_token uuid, p_after bigint default 0)
returns table (id bigint, sender text, body text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.chat_threads t where t.id = p_thread and t.token = p_token) then
    raise exception 'not_found';
  end if;
  update public.chat_threads set unread_user = 0 where chat_threads.id = p_thread and unread_user > 0;
  return query
    select m.id, m.sender, m.body, m.created_at from public.chat_messages m
     where m.thread_id = p_thread and m.id > coalesce(p_after, 0)
     order by m.id limit 300;
end;
$$;

-- عدد ردود الإدارة غير المقروءة (لإظهار تنبيه صغير على زر الدردشة)
create or replace function public.chat_unread(p_thread uuid, p_token uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select unread_user from public.chat_threads where id = p_thread and token = p_token), -1);
$$;

grant execute on function public.chat_start(text, text, text, text) to anon, authenticated;
grant execute on function public.chat_send(uuid, uuid, text) to anon, authenticated;
grant execute on function public.chat_fetch(uuid, uuid, bigint) to anon, authenticated;
grant execute on function public.chat_unread(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6) البحوث المحفوظة وإشعارات المستخدمين
-- ---------------------------------------------------------------------------
create table if not exists public.saved_searches (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 120),
  criteria         jsonb not null default '{}'::jsonb,
  notify           boolean not null default true,
  last_notified_at timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists saved_searches_user_idx on public.saved_searches (user_id);
alter table public.saved_searches enable row level security;
drop policy if exists "saved searches own" on public.saved_searches;
create policy "saved searches own" on public.saved_searches for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "saved searches admin read" on public.saved_searches;
create policy "saved searches admin read" on public.saved_searches for select using (public.is_app_admin());
grant select, insert, update, delete on public.saved_searches to authenticated;

create table if not exists public.user_notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null default 'info',
  title      text not null,
  body       text,
  url        text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists user_notifications_user_idx on public.user_notifications (user_id, id desc);
alter table public.user_notifications enable row level security;
drop policy if exists "notifications own read" on public.user_notifications;
create policy "notifications own read" on public.user_notifications for select using (user_id = auth.uid());
drop policy if exists "notifications own update" on public.user_notifications;
create policy "notifications own update" on public.user_notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notifications own delete" on public.user_notifications;
create policy "notifications own delete" on public.user_notifications for delete using (user_id = auth.uid());
grant select, update, delete on public.user_notifications to authenticated;

-- عند اعتماد عقار: إشعار كل من حفظ بحثًا يطابقه
create or replace function public.notify_saved_search_matches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v   jsonb := to_jsonb(new);
  s   record;
  c   jsonb;
  v_price numeric;
begin
  if coalesce(v->>'status', '') <> 'approved' then return new; end if;
  if tg_op = 'UPDATE' and coalesce(to_jsonb(old)->>'status', '') = 'approved' then return new; end if;
  begin v_price := nullif(v->>'price_aed', '')::numeric; exception when others then v_price := null; end;

  for s in select * from public.saved_searches where notify loop
    c := s.criteria;
    continue when coalesce(c->>'deal', '') in ('sale', 'rent') and coalesce(v->>'deal_type', 'sale') <> c->>'deal';
    continue when coalesce(c->>'city', '') not in ('', 'all') and position(c->>'city' in coalesce(v->>'city', '')) = 0;
    continue when nullif(c->>'max_price', '') is not null and v_price is not null and v_price > (c->>'max_price')::numeric;
    continue when coalesce(c->>'keyword', '') <> '' and position(lower(c->>'keyword') in lower(coalesce(v->>'title', '') || ' ' || coalesce(v->>'description', ''))) = 0;

    insert into public.user_notifications (user_id, kind, title, body, url)
    values (s.user_id, 'match', 'عقار جديد يطابق بحثك «' || left(s.name, 60) || '»',
            left(coalesce(v->>'title', ''), 160), 'property-details.html?id=sb-' || (v->>'id'));
    update public.saved_searches set last_notified_at = now() where id = s.id;
  end loop;
  return new;
exception when others then
  return new;   -- لا يمنع اعتماد العقار أبدًا
end;
$$;
drop trigger if exists notify_saved_search_matches on public.properties;
create trigger notify_saved_search_matches after insert or update of status on public.properties
  for each row execute function public.notify_saved_search_matches();

-- إشعار عام من لوحة التحكم لكل المستخدمين المسجّلين
create or replace function public.admin_broadcast(p_title text, p_body text default null, p_url text default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  if not public.is_app_admin() then raise exception 'forbidden'; end if;
  if char_length(btrim(coalesce(p_title, ''))) < 2 then raise exception 'invalid_title'; end if;
  insert into public.user_notifications (user_id, kind, title, body, url)
  select u.id, 'broadcast', left(btrim(p_title), 160), left(p_body, 600), left(p_url, 300) from auth.users u;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public.admin_broadcast(text, text, text) from public, anon;
grant execute on function public.admin_broadcast(text, text, text) to authenticated;

-- إحصاءات سريعة للوحة التحكم (للإدارة فقط)
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare r jsonb := '{}'::jsonb; n bigint;
begin
  if not public.is_app_admin() then raise exception 'forbidden'; end if;
  select count(*) into n from auth.users; r := r || jsonb_build_object('users', n);
  begin execute 'select count(*) from public.properties where status = ''pending''' into n; r := r || jsonb_build_object('pending_properties', n); exception when others then null; end;
  begin execute 'select count(*) from public.properties where status = ''approved''' into n; r := r || jsonb_build_object('approved_properties', n); exception when others then null; end;
  begin execute 'select count(*) from public.service_requests where status = ''new''' into n; r := r || jsonb_build_object('new_requests', n); exception when others then null; end;
  begin execute 'select count(*) from public.leads where status in (''new'', ''viewing'')' into n; r := r || jsonb_build_object('new_leads', n); exception when others then null; end;
  begin execute 'select count(*) from public.service_providers where not is_active' into n; r := r || jsonb_build_object('pending_providers', n); exception when others then null; end;
  begin execute 'select count(*) from public.service_providers where is_active' into n; r := r || jsonb_build_object('active_providers', n); exception when others then null; end;
  select coalesce(sum(unread_admin), 0) into n from public.chat_threads; r := r || jsonb_build_object('unread_chat', n);
  select count(*) into n from public.reports where status = 'new'; r := r || jsonb_build_object('new_reports', n);
  select count(*) into n from public.saved_searches; r := r || jsonb_build_object('saved_searches', n);
  select count(*) into n from public.site_offers where is_active and (ends_on is null or ends_on >= current_date); r := r || jsonb_build_object('active_offers', n);
  select count(*) into n from public.site_news where is_active and (ends_on is null or ends_on >= current_date); r := r || jsonb_build_object('active_news', n);
  return r;
end;
$$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- للتأكد: يجب أن تظهر 8 جداول
select table_name from information_schema.tables
 where table_schema = 'public'
   and table_name in ('site_news', 'site_offers', 'daily_tips', 'reports', 'chat_threads', 'chat_messages', 'saved_searches', 'user_notifications')
 order by 1;
