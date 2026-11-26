-- ملفات التغذية (XML feeds): يربط المكتب نظامه (PropSpace وغيره) فتصل إعلاناته تلقائيًا
-- التدفق: الوسيط يضيف رابط ملفه ← الإدارة تعتمد الملف ← الدالة feed-import تقرؤه وتستورد الإعلانات
-- وتحدّثها كل يوم، وتوقف ما اختفى من الملف. لا يُستورد شيء قبل اعتماد الإدارة.

-- 1) ملفات التغذية
create table if not exists public.listing_feeds (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  url              text not null check (url ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]{2,5})?(/[^\s<>"'']*)?$' and char_length(url) <= 600),
  label            text check (label is null or char_length(label) <= 80),
  status           text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paused')),
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) <= 300),
  reviewed_at      timestamptz,
  format           text,
  last_fetch_at    timestamptz,
  next_fetch_at    timestamptz not null default now(),
  manual_sync_at   timestamptz,
  last_error       text,
  items_total      int not null default 0,
  items_live       int not null default 0,
  created_at       timestamptz not null default now(),
  unique (owner_id, url)
);
create index if not exists listing_feeds_due_idx on public.listing_feeds (status, next_fetch_at);

alter table public.listing_feeds enable row level security;
drop policy if exists "Owner reads own feeds" on public.listing_feeds;
create policy "Owner reads own feeds" on public.listing_feeds for select to authenticated
  using (owner_id = auth.uid() or public.is_app_admin());
drop policy if exists "Owner adds feeds" on public.listing_feeds;
create policy "Owner adds feeds" on public.listing_feeds for insert to authenticated
  with check (owner_id = auth.uid());
drop policy if exists "Owner edits own feeds" on public.listing_feeds;
create policy "Owner edits own feeds" on public.listing_feeds for update to authenticated
  using (owner_id = auth.uid() or public.is_app_admin()) with check (owner_id = auth.uid() or public.is_app_admin());
drop policy if exists "Owner removes own feeds" on public.listing_feeds;
create policy "Owner removes own feeds" on public.listing_feeds for delete to authenticated
  using (owner_id = auth.uid() or public.is_app_admin());
revoke all on public.listing_feeds from anon;
grant select, insert, update, delete on public.listing_feeds to authenticated;

-- حماية الحقول: الوسيط يغيّر الرابط والاسم ويوقف/يستأنف فقط؛ الاعتماد للإدارة
create or replace function public.listing_feeds_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_app_admin() or coalesce(auth.role(), '') = 'service_role' then
    if tg_op = 'UPDATE' and new.status = 'approved' and old.status is distinct from 'approved' then
      new.reviewed_at := now(); new.rejection_reason := null; new.next_fetch_at := now();
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    if (select count(*) from public.listing_feeds where owner_id = auth.uid()) >= 3 then
      raise exception 'feed_limit' using hint = 'max_3_feeds';
    end if;
    new.owner_id := auth.uid(); new.status := 'pending'; new.reviewed_at := null; new.rejection_reason := null;
    new.format := null; new.last_fetch_at := null; new.next_fetch_at := now(); new.manual_sync_at := null;
    new.last_error := null; new.items_total := 0; new.items_live := 0; new.created_at := now();
    return new;
  end if;
  -- UPDATE من الوسيط
  new.owner_id := old.owner_id; new.reviewed_at := old.reviewed_at; new.rejection_reason := old.rejection_reason;
  new.format := old.format; new.last_fetch_at := old.last_fetch_at; new.last_error := old.last_error;
  new.items_total := old.items_total; new.items_live := old.items_live; new.created_at := old.created_at;
  if coalesce(current_setting('aq.feed_sync', true), '') <> '1' then
    new.next_fetch_at := old.next_fetch_at; new.manual_sync_at := old.manual_sync_at;
  end if;
  if new.url is distinct from old.url then
    new.status := 'pending';                                   -- رابط جديد يحتاج اعتمادًا جديدًا
  elsif new.status is distinct from old.status then
    if old.status = 'approved' and new.status = 'paused' then null;
    elsif old.status = 'paused' and new.status = 'approved' and old.reviewed_at is not null then new.next_fetch_at := now();
    else new.status := old.status; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists listing_feeds_guard on public.listing_feeds;
create trigger listing_feeds_guard before insert or update on public.listing_feeds
  for each row execute function public.listing_feeds_guard();

-- 2) عناصر كل ملف (طابور الاستيراد)
create table if not exists public.listing_feed_items (
  feed_id     uuid not null references public.listing_feeds(id) on delete cascade,
  ref         text not null check (char_length(ref) <= 120),
  hash        text not null,
  data        jsonb not null,
  state       text not null default 'pending' check (state in ('pending', 'done', 'error', 'removed', 'skipped')),
  property_id uuid references public.properties(id) on delete set null,
  attempts    int not null default 0,
  last_error  text,
  seen_at     timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (feed_id, ref)
);
create index if not exists listing_feed_items_state_idx on public.listing_feed_items (state, updated_at);
alter table public.listing_feed_items enable row level security;
drop policy if exists "Owner reads own feed items" on public.listing_feed_items;
create policy "Owner reads own feed items" on public.listing_feed_items for select to authenticated
  using (public.is_app_admin() or exists (select 1 from public.listing_feeds f where f.id = feed_id and f.owner_id = auth.uid()));
revoke all on public.listing_feed_items from anon, authenticated;
grant select (feed_id, ref, state, property_id, last_error, updated_at) on public.listing_feed_items to authenticated;

-- 3) ربط الإعلان بملفه
alter table public.properties add column if not exists feed_id uuid references public.listing_feeds(id) on delete set null;
create index if not exists properties_feed_idx on public.properties (feed_id) where feed_id is not null;

-- حذف الملف أو إيقافه يوقف إعلاناته (لا تُحذف)
create or replace function public.listing_feeds_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    update public.properties set status = 'paused' where feed_id = old.id and status = 'approved';
    return old;
  end if;
  if new.status in ('paused', 'rejected') and old.status = 'approved' then
    update public.properties set status = 'paused' where feed_id = new.id and status = 'approved';
  elsif new.status = 'approved' and old.status = 'paused' then
    update public.listing_feed_items set state = 'pending', attempts = 0, updated_at = now()
      where feed_id = new.id and state = 'done';                 -- تُعاد مزامنتها فتعود الإعلانات الموجودة في الملف
  end if;
  return new;
end;
$$;
drop trigger if exists listing_feeds_after_change on public.listing_feeds;
create trigger listing_feeds_after_change after update or delete on public.listing_feeds
  for each row execute function public.listing_feeds_after_change();

-- 4) الاستيراد يعمل بمفتاح الخدمة: لا يخضع لحدّ الإعلانات اليومي المخصص للإدخال اليدوي
do $$
declare v text;
begin
  select pg_get_functiondef('public.aq_enforce_rate_limit()'::regprocedure) into v;
  if position('service_role' in v) = 0 then
    v := replace(v, 'if public.is_app_admin() then return new; end if;',
                    'if public.is_app_admin() or coalesce(auth.role(), '''') = ''service_role'' then return new; end if;');
    if position('service_role' in v) = 0 then raise exception 'rate_limit_patch_failed'; end if;
    execute v;
  end if;
end $$;

-- 5) «زامن الآن» للوسيط (مرة كل 15 دقيقة)
create or replace function public.request_feed_sync(p_feed uuid)
returns text language plpgsql security definer set search_path = public as $$
declare f record;
begin
  select * into f from public.listing_feeds where id = p_feed;
  if f.id is null or (f.owner_id <> auth.uid() and not public.is_app_admin()) then raise exception 'forbidden'; end if;
  if f.status <> 'approved' then return 'not_approved'; end if;
  if f.manual_sync_at is not null and f.manual_sync_at > now() - interval '15 minutes' then return 'too_soon'; end if;
  perform set_config('aq.feed_sync', '1', true);
  update public.listing_feeds set next_fetch_at = now(), manual_sync_at = now() where id = p_feed;
  perform set_config('aq.feed_sync', '', true);
  return 'queued';
end;
$$;
revoke all on function public.request_feed_sync(uuid) from public, anon;
grant execute on function public.request_feed_sync(uuid) to authenticated;

-- 6) التشغيل الدوري: كل 10 دقائق تُستدعى الدالة، وهي تقرّر ما المستحق
create extension if not exists pg_net;
select cron.unschedule('feed-import') where exists (select 1 from cron.job where jobname = 'feed-import');
select cron.schedule('feed-import', '*/10 * * * *', $cron$
  select net.http_post(
    url := 'https://mejkpckkdbmczzypzkkr.supabase.co/functions/v1/feed-import',
    body := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
$cron$);

-- 7) دوال يستعملها المستورد فقط (مفتاح الخدمة)
alter table public.listing_feed_items add column if not exists img_key text;
alter table public.listing_feed_items add column if not exists img_urls text[];

-- يحجز ملفًا مستحقًا واحدًا (لا يتعارض تشغيلان متزامنان)
create or replace function public.feed_claim_due()
returns setof public.listing_feeds language sql security definer set search_path = public as $$
  update public.listing_feeds set next_fetch_at = now() + interval '30 minutes'
  where id = (select id from public.listing_feeds where status = 'approved' and next_fetch_at <= now()
              order by next_fetch_at limit 1 for update skip locked)
  returning *;
$$;

-- يحفظ محتوى الملف: الجديد والمتغيّر إلى الطابور، وما اختفى يوقَف، والباقي يبقى حيًّا
create or replace function public.feed_sync_items(p_feed uuid, p_items jsonb, p_format text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_start timestamptz := clock_timestamp(); v_total int; v_changed int; v_removed int;
begin
  insert into public.listing_feed_items as i (feed_id, ref, hash, data, state, seen_at, updated_at)
  select p_feed, left(x->>'ref', 120), x->>'hash', x->'data', 'pending', v_start, v_start
  from jsonb_array_elements(p_items) x where coalesce(x->>'ref', '') <> ''
  on conflict (feed_id, ref) do update set
    seen_at    = v_start,
    state      = case when i.hash is distinct from excluded.hash or i.state in ('removed', 'error') then 'pending' else i.state end,
    attempts   = case when i.hash is distinct from excluded.hash or i.state in ('removed', 'error') then 0 else i.attempts end,
    updated_at = case when i.hash is distinct from excluded.hash or i.state in ('removed', 'error') then v_start else i.updated_at end,
    data = excluded.data, hash = excluded.hash;
  get diagnostics v_changed = row_count;

  with gone as (
    update public.listing_feed_items set state = 'removed', updated_at = v_start
    where feed_id = p_feed and seen_at < v_start and state <> 'removed' returning property_id)
  update public.properties set status = 'paused'
  where id in (select property_id from gone where property_id is not null) and status in ('approved', 'expired');
  get diagnostics v_removed = row_count;

  -- الإعلانات الباقية في الملف تُعدّ مؤكدة التوفر (لا تنتهي بعد 60 يومًا)
  update public.properties p set available_at = now(), stale_warned_at = null, expired_at = null,
    status = case when p.status = 'expired' then 'approved' else p.status end
  from public.listing_feed_items i
  where i.feed_id = p_feed and i.state = 'done' and i.property_id = p.id;

  select count(*) into v_total from public.listing_feed_items where feed_id = p_feed and state <> 'removed';
  update public.listing_feeds set format = left(p_format, 30), last_fetch_at = now(),
    next_fetch_at = now() + interval '24 hours', last_error = null, items_total = v_total
  where id = p_feed;
  return jsonb_build_object('total', v_total, 'upserted', v_changed, 'paused', v_removed);
end;
$$;

-- يحجز دفعة من الإعلانات المنتظرة للمعالجة
create or replace function public.feed_claim_items(p_limit int)
returns setof public.listing_feed_items language sql security definer set search_path = public as $$
  update public.listing_feed_items t set attempts = t.attempts + 1, updated_at = now()
  where (t.feed_id, t.ref) in (
    select i.feed_id, i.ref from public.listing_feed_items i join public.listing_feeds f on f.id = i.feed_id
    where i.state = 'pending' and f.status = 'approved' and i.attempts < 3
      and (i.attempts = 0 or i.updated_at < now() - interval '15 minutes')
    order by i.updated_at limit least(greatest(p_limit, 1), 10)
    for update of i skip locked)
  returning t.*;
$$;

-- عدد الإعلانات الظاهرة لكل ملف
create or replace function public.feed_refresh_counts(p_feeds uuid[])
returns void language sql security definer set search_path = public as $$
  update public.listing_feeds f set items_live = (select count(*) from public.properties p where p.feed_id = f.id and p.status = 'approved')
  where f.id = any(p_feeds);
$$;

do $$ declare fn text; begin
  foreach fn in array array['feed_claim_due()', 'feed_sync_items(uuid, jsonb, text)', 'feed_claim_items(int)', 'feed_refresh_counts(uuid[])'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end $$;
