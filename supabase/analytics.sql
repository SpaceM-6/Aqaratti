-- ================================================================
-- إحصاء الزيارات لمنصة «أنا عقار» (قسم «الزيارات والإحصاءات» في لوحة التحكم)
-- شغّليه مرة واحدة في Supabase → SQL Editor → Run. آمن لإعادة التشغيل.
-- يعتمد على الدالة public.is_app_admin() الموجودة مسبقًا.
-- لا يُسجَّل عنوان IP ولا الموقع الجغرافي؛ الدولة تُستنتج من المنطقة الزمنية للجهاز.
-- ================================================================

-- ---------- الجداول ----------
create table if not exists public.aq_visits (
  sid text primary key,
  vid text not null,
  country text,
  started_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  secs int not null default 0,
  views int not null default 0,
  plat text not null default 'web',          -- web | pwa | android | ios | app
  mobile boolean,
  src text,                                  -- مصدر الزيارة: نطاق الموقع المحيل أو utm_source
  lang text,
  first_path text,
  user_id uuid                               -- إن كان الزائر مسجّل الدخول
);
create index if not exists aq_visits_started on public.aq_visits (started_at desc);
create index if not exists aq_visits_vid on public.aq_visits (vid);

create table if not exists public.aq_visit_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  sid text not null,
  kind text not null,                        -- view | item | contact
  label text,
  ref text
);
create index if not exists aq_visit_events_at on public.aq_visit_events (at desc);
create index if not exists aq_visit_events_sid on public.aq_visit_events (sid);

create table if not exists public.aq_app_devices (
  vid text primary key,
  plat text not null,
  country text,
  user_id uuid,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  opens int not null default 1
);

alter table public.aq_visits enable row level security;
alter table public.aq_visit_events enable row level security;
alter table public.aq_app_devices enable row level security;
-- لا سياسات: لا يُقرأ ولا يُكتب إلا عبر الدالتين أدناه

-- ---------- تسجيل حدث من المتصفح ----------
create or replace function public.aq_track(p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_sid text := p->>'sid'; v_vid text := p->>'vid'; v_kind text := p->>'kind';
  v_label text := left(nullif(trim(p->>'label'), ''), 120);
  v_ref text := left(nullif(trim(p->>'ref'), ''), 80);
  v_country text := upper(left(nullif(p->>'country', ''), 2));
  v_plat text := coalesce(nullif(p->>'plat', ''), 'web');
  v_uid uuid := auth.uid();
  s public.aq_visits; n int;
begin
  if coalesce(v_sid, '') !~ '^[a-z0-9]{8,40}$' or coalesce(v_vid, '') !~ '^[a-z0-9]{8,40}$'
     or coalesce(v_kind, '') not in ('start', 'view', 'beat', 'item', 'contact') then return 'bad'; end if;
  if coalesce(v_country, '') !~ '^[A-Z]{2}$' then v_country := null; end if;
  if v_plat not in ('web', 'pwa', 'android', 'ios', 'app') then v_plat := 'web'; end if;

  if v_kind = 'start' then
    insert into public.aq_visits (sid, vid, country, plat, mobile, src, lang, first_path, user_id)
    values (v_sid, v_vid, v_country, v_plat, (p->>'mobile')::boolean, lower(left(nullif(p->>'src', ''), 60)),
            lower(left(nullif(p->>'lang', ''), 2)), left(p->>'path', 200), v_uid)
    on conflict (sid) do nothing;
    if not found then return 'ok'; end if;
    if v_plat in ('android', 'ios', 'app', 'pwa') then
      insert into public.aq_app_devices (vid, plat, country, user_id) values (v_vid, v_plat, v_country, v_uid)
      on conflict (vid) do update set last_at = now(), opens = public.aq_app_devices.opens + 1,
        plat = excluded.plat, country = coalesce(excluded.country, public.aq_app_devices.country),
        user_id = coalesce(excluded.user_id, public.aq_app_devices.user_id);
    end if;
    return 'ok';
  end if;

  select * into s from public.aq_visits where sid = v_sid;
  if s is null or s.started_at < now() - interval '12 hours' then return 'nosession'; end if;
  if v_uid is not null and s.user_id is null then update public.aq_visits set user_id = v_uid where sid = v_sid; end if;

  if v_kind = 'beat' then
    update public.aq_visits
      set last_at = now(), secs = least(greatest(secs, extract(epoch from now() - started_at)::int), 14400)
      where sid = v_sid;
    return 'ok';
  end if;

  -- حدّ أعلى للأحداث في الزيارة الواحدة (حماية من الإغراق)
  select count(*) into n from public.aq_visit_events where sid = v_sid;
  if n >= 300 then return 'limit'; end if;

  if v_kind = 'view' then
    insert into public.aq_visit_events (sid, kind, label) values (v_sid, 'view', coalesce(v_label, '/'));
    update public.aq_visits set views = views + 1, last_at = now(),
      secs = least(greatest(secs, extract(epoch from now() - started_at)::int), 14400) where sid = v_sid;
  elsif v_kind in ('item', 'contact') then
    if not exists (select 1 from public.aq_visit_events where sid = v_sid and kind = v_kind
                   and label is not distinct from v_label and ref is not distinct from v_ref) then
      insert into public.aq_visit_events (sid, kind, label, ref) values (v_sid, v_kind, v_label, v_ref);
    end if;
  end if;
  return 'ok';
end $$;
revoke all on function public.aq_track(jsonb) from public;
grant execute on function public.aq_track(jsonb) to anon, authenticated;

-- ---------- تقرير لوحة التحكم ----------
create or replace function public.aq_analytics_report(p_days int default 7) returns jsonb
language plpgsql security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 365))); r jsonb;
begin
  if not coalesce(public.is_app_admin(), false) then raise exception 'not_admin'; end if;
  with ss as (select * from public.aq_visits where started_at >= since),
       ev as (select e.* from public.aq_visit_events e join ss on ss.sid = e.sid),
       firsts as (select vid, min(started_at) f from public.aq_visits where vid in (select vid from ss) group by vid)
  select jsonb_build_object(
    'visitors', (select count(distinct vid) from ss),
    'new_visitors', (select count(*) from firsts where f >= since),
    'sessions', (select count(*) from ss),
    'views', (select coalesce(sum(views), 0) from ss),
    'avg_secs', (select coalesce(round(avg(secs)), 0) from ss where secs > 0),
    'bounce', (select count(*) from ss where views <= 1 and secs < 30),
    'signed_in', (select count(distinct user_id) from ss where user_id is not null),
    'mobile', (select count(*) from ss where mobile),
    'app_sessions', (select count(*) from ss where plat in ('android', 'ios', 'app')),
    'pwa_sessions', (select count(*) from ss where plat = 'pwa'),
    'platforms', (select coalesce(jsonb_object_agg(plat, n), '{}') from (select plat, count(*) n from ss group by plat) x),
    'app_devices', (select count(*) from public.aq_app_devices where plat in ('android', 'ios', 'app')),
    'app_new', (select count(*) from public.aq_app_devices where plat in ('android', 'ios', 'app') and first_at >= since),
    'countries', (select coalesce(jsonb_agg(jsonb_build_array(country, n, v, a) order by n desc), '[]') from
        (select coalesce(country, '??') country, count(*) n, count(distinct vid) v, coalesce(round(avg(nullif(secs, 0))), 0) a
         from ss group by 1 order by 2 desc limit 30) x),
    'sources', (select coalesce(jsonb_agg(jsonb_build_array(s, n) order by n desc), '[]') from
        (select coalesce(src, '') s, count(*) n from ss group by 1 order by 2 desc limit 15) x),
    'pages', (select coalesce(jsonb_agg(jsonb_build_array(label, n) order by n desc), '[]') from
        (select label, count(*) n from ev where kind = 'view' group by 1 order by 2 desc limit 25) x),
    'items', (select coalesce(jsonb_agg(jsonb_build_array(label, n, c) order by n desc), '[]') from
        (select i.label, count(*) n,
                (select count(*) from ev c where c.kind = 'contact' and c.label = i.label) c
         from ev i where i.kind = 'item' group by 1 order by 2 desc limit 25) x),
    'items_total', (select count(*) from ev where kind = 'item'),
    'contacts', (select jsonb_build_object(
        'call', count(*) filter (where ref like 'call%'),
        'whatsapp', count(*) filter (where ref like 'whatsapp%'),
        'email', count(*) filter (where ref like 'email%')) from ev where kind = 'contact'),
    'durations', (select jsonb_build_array(
        count(*) filter (where secs < 30), count(*) filter (where secs between 30 and 179),
        count(*) filter (where secs between 180 and 599), count(*) filter (where secs >= 600)) from ss),
    'hours', (select coalesce(jsonb_agg(jsonb_build_array(h, n) order by h), '[]') from
        (select extract(hour from started_at at time zone 'Asia/Dubai')::int h, count(*) n from ss group by 1) x),
    'daily', (select coalesce(jsonb_agg(jsonb_build_array(d, n, v) order by d), '[]') from
        (select (started_at at time zone 'Asia/Dubai')::date d, count(*) n, count(distinct vid) v from ss group by 1) x)
  ) into r;
  return r;
end $$;
revoke all on function public.aq_analytics_report(int) from public, anon;
grant execute on function public.aq_analytics_report(int) to authenticated;

-- ---------- تنظيف تلقائي: حذف ما هو أقدم من ٤٠٠ يوم ----------
do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'aq-analytics-cleanup';
  perform cron.schedule('aq-analytics-cleanup', '40 3 * * *',
    $c$delete from public.aq_visit_events where at < now() - interval '400 days'; delete from public.aq_visits where started_at < now() - interval '400 days';$c$);
exception when others then raise notice 'pg_cron غير متاح: %', sqlerrm; end $$;
