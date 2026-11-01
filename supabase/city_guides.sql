-- ============================================================================
-- أدلة المدينة: المدارس (هيئة المعرفة KHDA)، ومحطات المواصلات (RTA)، والمباني (دائرة الأراضي)
-- تُرفع الملفات المفتوحة من لوحة التحكم ← «بيانات السوق» ويتعرّف النظام على نوع كل ملف تلقائيًا.
-- كلها للقراءة العامة، والكتابة للإدارة فقط. لا نخزن جوال مدير المدرسة الشخصي.
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor (آمن لو أُعيد تشغيله).
-- ============================================================================
create table if not exists public.schools (
  id               text primary key,          -- education_center_id
  name_en          text,
  name_ar          text,
  lat              double precision,
  lng              double precision,
  rating_en        text,                      -- Outstanding / Very good / Good / Acceptable / Weak
  rating_ar        text,
  inspection_year  text,
  curriculum_en    text,
  curriculum_ar    text,
  area_en          text,
  area_ar          text,
  students         integer,
  established      date,
  telephone        text,
  website          text,
  address          text,
  address_ar       text,
  image_url        text,
  report_url       text,
  source           text not null default 'KHDA',
  updated_at       timestamptz not null default now()
);
create index if not exists schools_area_idx on public.schools (lower(area_en));

create table if not exists public.transit_stations (
  id        text primary key,
  kind      text not null default 'metro',    -- metro / tram / bus / marine
  name_en   text,
  name_ar   text,
  line      text,
  lat       double precision,
  lng       double precision,
  source    text not null default 'RTA',
  updated_at timestamptz not null default now()
);

create table if not exists public.building_area_stats (
  area_en        text primary key,
  buildings      integer not null default 0,
  floors_avg     numeric,
  floors_max     integer,
  units          integer,
  newest_year    integer,
  median_year    integer,
  top_projects   jsonb not null default '{}'::jsonb,
  source         text not null default 'DLD',
  updated_at     timestamptz not null default now()
);

-- تفعيل حماية الصفوف (RLS) صراحةً لكل جدول
alter table public.schools enable row level security;
alter table public.transit_stations enable row level security;
alter table public.building_area_stats enable row level security;

do $$
declare t text;
begin
  foreach t in array array['schools', 'transit_stations', 'building_area_stats'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s public read" on public.%I', t, t);
    execute format('create policy "%s public read" on public.%I for select using (true)', t, t);
    execute format('drop policy if exists "%s admin write" on public.%I', t, t);
    execute format('create policy "%s admin write" on public.%I for all using (public.is_app_admin()) with check (public.is_app_admin())', t, t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
