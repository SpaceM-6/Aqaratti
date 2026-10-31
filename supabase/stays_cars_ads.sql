-- ============================================================================
-- «أنا عقار»: شريط الإعلانات + الإيجار اليومي والإقامات القصيرة (نظام الحجز) + قسم السيارات
--
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor بعد portal.sql و filters.sql.
-- آمن لو أُعيد تشغيله، ولا يحذف أي بيانات.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) المتطلبات: نوع رقم العقار + دالة الإدارة
-- ---------------------------------------------------------------------------
do $$
declare pt text;
begin
  if not exists (select 1 from pg_type where typname = 'aq_prop_id' and typnamespace = 'public'::regnamespace) then
    select format_type(a.atttypid, a.atttypmod) into pt from pg_attribute a
     where a.attrelid = 'public.properties'::regclass and a.attname = 'id';
    execute format('create domain public.aq_prop_id as %s', pt);
  end if;
end $$;
grant usage on type public.aq_prop_id to anon, authenticated;

create table if not exists public.app_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.app_admins where user_id = auth.uid()); $$;
grant execute on function public.is_app_admin() to anon, authenticated;

-- إشعار داخل الموقع لمستخدم (يتجاهل بهدوء إن لم يكن جدول الإشعارات مُفعّلًا)
create or replace function public.aq_notify_user(p_user uuid, p_title text, p_body text, p_url text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if p_user is null or to_regclass('public.user_notifications') is null then return; end if;
  execute 'insert into public.user_notifications (user_id, kind, title, body, url) values ($1, $2, $3, $4, $5)'
    using p_user, 'booking', left(p_title, 120), left(p_body, 400), p_url;
exception when others then null;
end;
$$;
revoke all on function public.aq_notify_user(uuid, text, text, text) from public, anon, authenticated;

-- ============================================================================
-- 1) شريط الإعلانات
-- ============================================================================
create table if not exists public.ads (
  id          bigint generated always as identity primary key,
  title       text not null check (char_length(title) between 2 and 80),
  subtitle    text check (char_length(coalesce(subtitle, '')) <= 140),
  badge       text check (char_length(coalesce(badge, '')) <= 24),
  image_url   text,
  link_url    text,
  placement   text not null default 'all',      -- all | home | listings | stays | cars | details | services
  style       text not null default 'card' check (style in ('card', 'banner', 'logo')),
  sort        int  not null default 100,
  active      boolean not null default true,
  starts_at   date,
  ends_at     date,
  advertiser  text,
  clicks      bigint not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists ads_active_idx on public.ads (active, placement, sort);
alter table public.ads enable row level security;
drop policy if exists "ads public read" on public.ads;
create policy "ads public read" on public.ads for select
  using (active and (starts_at is null or starts_at <= current_date) and (ends_at is null or ends_at >= current_date));
drop policy if exists "ads admin all" on public.ads;
create policy "ads admin all" on public.ads for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());
grant select on public.ads to anon, authenticated;
grant insert, update, delete on public.ads to authenticated;

create or replace function public.ad_click(p_id bigint)
returns void language sql security definer set search_path = public
as $$ update public.ads set clicks = clicks + 1 where id = p_id and active; $$;
grant execute on function public.ad_click(bigint) to anon, authenticated;

insert into storage.buckets (id, name, public) values ('ad-images', 'ad-images', true) on conflict (id) do nothing;
drop policy if exists "ad images public read" on storage.objects;
create policy "ad images public read" on storage.objects for select using (bucket_id = 'ad-images');
drop policy if exists "ad images admin write" on storage.objects;
create policy "ad images admin write" on storage.objects for insert to authenticated with check (bucket_id = 'ad-images' and public.is_app_admin());
drop policy if exists "ad images admin delete" on storage.objects;
create policy "ad images admin delete" on storage.objects for delete to authenticated using (bucket_id = 'ad-images' and public.is_app_admin());

-- ============================================================================
-- 2) الإيجار اليومي والإقامات القصيرة
-- ============================================================================
alter table public.properties add column if not exists rent_period         text;     -- yearly | monthly | weekly | daily
alter table public.properties add column if not exists stay_category       text;     -- apartment | villa | hotel_apt | room | chalet | studio
alter table public.properties add column if not exists nightly_price       numeric;
alter table public.properties add column if not exists cleaning_fee        numeric not null default 0;
alter table public.properties add column if not exists tourism_fee         numeric not null default 0;   -- رسم درهم السياحة لكل ليلة
alter table public.properties add column if not exists vat_pct             numeric not null default 0;
alter table public.properties add column if not exists min_nights          int not null default 1;
alter table public.properties add column if not exists max_guests          int;
alter table public.properties add column if not exists beds                int;
alter table public.properties add column if not exists weekly_discount     numeric not null default 0;
alter table public.properties add column if not exists monthly_discount    numeric not null default 0;
alter table public.properties add column if not exists instant_book        boolean not null default false;
alter table public.properties add column if not exists cancellation_policy text not null default 'moderate';
alter table public.properties add column if not exists house_rules         text;
alter table public.properties add column if not exists check_in_time       text not null default '15:00';
alter table public.properties add column if not exists check_out_time      text not null default '11:00';
alter table public.properties add column if not exists accessibility       text[] not null default '{}';
alter table public.properties add column if not exists holiday_permit      text;

alter table public.properties drop constraint if exists properties_rent_period_chk;
alter table public.properties add constraint properties_rent_period_chk
  check (rent_period is null or rent_period in ('yearly', 'monthly', 'weekly', 'daily'));
alter table public.properties drop constraint if exists properties_cancel_policy_chk;
alter table public.properties add constraint properties_cancel_policy_chk
  check (cancellation_policy in ('flexible', 'moderate', 'strict', 'non_refundable'));
alter table public.properties drop constraint if exists properties_stay_numbers_chk;
alter table public.properties add constraint properties_stay_numbers_chk
  check (coalesce(nightly_price, 0) >= 0 and cleaning_fee >= 0 and tourism_fee >= 0 and vat_pct between 0 and 20
         and min_nights between 1 and 365 and weekly_discount between 0 and 90 and monthly_discount between 0 and 90);
create index if not exists properties_rent_period_idx on public.properties (status, rent_period);

-- الحجوزات
create table if not exists public.bookings (
  id             uuid primary key default gen_random_uuid(),
  ref            text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  property_id    public.aq_prop_id not null references public.properties(id) on delete cascade,
  host_id        uuid,
  guest_id       uuid references auth.users(id) on delete set null,
  guest_name     text not null,
  guest_email    text,
  guest_phone    text not null,
  check_in       date not null,
  check_out      date not null,
  adults         int not null default 1,
  children       int not null default 0,
  nights         int not null,
  nightly_price  numeric not null,
  discount       numeric not null default 0,
  cleaning_fee   numeric not null default 0,
  tourism_fee    numeric not null default 0,
  service_fee    numeric not null default 0,
  vat            numeric not null default 0,
  total          numeric not null,
  special_request text,
  status         text not null default 'pending' check (status in ('pending', 'confirmed', 'declined', 'cancelled', 'completed')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded')),
  host_note      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (check_out > check_in)
);
create index if not exists bookings_property_idx on public.bookings (property_id, check_in);
create index if not exists bookings_host_idx on public.bookings (host_id, created_at desc);
create index if not exists bookings_guest_idx on public.bookings (guest_id);
alter table public.bookings enable row level security;
drop policy if exists "bookings guest read" on public.bookings;
create policy "bookings guest read" on public.bookings for select to authenticated using (guest_id = auth.uid());
drop policy if exists "bookings host read" on public.bookings;
create policy "bookings host read" on public.bookings for select to authenticated using (host_id = auth.uid() or public.is_app_admin());
drop policy if exists "bookings admin write" on public.bookings;
create policy "bookings admin write" on public.bookings for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
grant select, update on public.bookings to authenticated;

-- أيام يغلقها المضيف (صيانة، حجز من خارج الموقع...)
create table if not exists public.stay_blocks (
  id          bigint generated always as identity primary key,
  property_id public.aq_prop_id not null references public.properties(id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  note        text,
  created_at  timestamptz not null default now(),
  check (end_date > start_date)
);
create index if not exists stay_blocks_property_idx on public.stay_blocks (property_id, start_date);
alter table public.stay_blocks enable row level security;
drop policy if exists "stay blocks host" on public.stay_blocks;
create policy "stay blocks host" on public.stay_blocks for all to authenticated
  using (public.is_app_admin() or exists (select 1 from public.properties p where p.id = property_id and p.broker_id::text = auth.uid()::text))
  with check (public.is_app_admin() or exists (select 1 from public.properties p where p.id = property_id and p.broker_id::text = auth.uid()::text));
grant select, insert, update, delete on public.stay_blocks to authenticated;

-- حساب السعر (نفس المعادلة المعروضة في الموقع)
create or replace function public.aq_stay_quote(p_id public.aq_prop_id, p_in date, p_out date)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v record; n int; base numeric; disc numeric := 0; sub numeric; vat numeric; tour numeric;
begin
  select * into v from public.properties where id = p_id;
  if v.id is null or coalesce(v.nightly_price, 0) <= 0 then return jsonb_build_object('error', 'not_bookable'); end if;
  n := p_out - p_in;
  base := v.nightly_price * n;
  if n >= 28 and v.monthly_discount > 0 then disc := round(base * v.monthly_discount / 100, 2);
  elsif n >= 7 and v.weekly_discount > 0 then disc := round(base * v.weekly_discount / 100, 2); end if;
  sub  := base - disc + v.cleaning_fee;
  vat  := round(sub * v.vat_pct / 100, 2);
  tour := v.tourism_fee * n;
  return jsonb_build_object('nights', n, 'nightly', v.nightly_price, 'base', base, 'discount', disc,
    'cleaning', v.cleaning_fee, 'tourism', tour, 'service', 0, 'vat', vat, 'total', round(sub + vat + tour, 2));
end;
$$;
grant execute on function public.aq_stay_quote(public.aq_prop_id, date, date) to anon, authenticated;

-- الأيام غير المتاحة (بدون أي بيانات شخصية)
create or replace function public.stay_unavailable(p_id public.aq_prop_id)
returns table (start_date date, end_date date)
language sql stable security definer set search_path = public
as $$
  select b.check_in, b.check_out from public.bookings b
   where b.property_id = p_id and b.status in ('pending', 'confirmed') and b.check_out >= current_date
  union all
  select s.start_date, s.end_date from public.stay_blocks s
   where s.property_id = p_id and s.end_date >= current_date;
$$;
grant execute on function public.stay_unavailable(public.aq_prop_id) to anon, authenticated;

-- إنشاء حجز (الضيف لا يحتاج حسابًا، والسعر يُحسب هنا لا في المتصفح)
create or replace function public.create_booking(
  p_id public.aq_prop_id, p_check_in date, p_check_out date, p_adults int, p_children int,
  p_name text, p_email text, p_phone text, p_request text)
returns table (id uuid, ref text, status text, total numeric)
language plpgsql security definer set search_path = public
as $$
declare v record; q jsonb; n int; st text; b record; ph text;
begin
  select * into v from public.properties p where p.id = p_id;
  if v.id is null or v.status <> 'approved' or coalesce(v.rent_period, '') <> 'daily' or coalesce(v.nightly_price, 0) <= 0 then
    raise exception 'not_bookable'; end if;
  n := p_check_out - p_check_in;
  if p_check_in < current_date or n < 1 or n > 365 then raise exception 'bad_dates'; end if;
  if n < v.min_nights then raise exception 'min_nights:%', v.min_nights; end if;
  if coalesce(p_adults, 0) < 1 or coalesce(p_children, 0) < 0 or p_adults + coalesce(p_children, 0) > coalesce(v.max_guests, 99) then
    raise exception 'too_many_guests:%', coalesce(v.max_guests, 99); end if;
  ph := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  if char_length(btrim(coalesce(p_name, ''))) < 2 or char_length(ph) < 7 then raise exception 'bad_contact'; end if;
  if (select count(*) from public.bookings x where x.guest_phone = ph and x.created_at > now() - interval '1 day') >= 5 then
    raise exception 'rate_limited'; end if;

  perform pg_advisory_xact_lock(hashtext('stay:' || p_id::text));
  if exists (select 1 from public.stay_unavailable(p_id) u where u.start_date < p_check_out and u.end_date > p_check_in) then
    raise exception 'dates_taken'; end if;

  q  := public.aq_stay_quote(p_id, p_check_in, p_check_out);
  st := case when v.instant_book then 'confirmed' else 'pending' end;
  insert into public.bookings (property_id, host_id, guest_id, guest_name, guest_email, guest_phone, check_in, check_out,
         adults, children, nights, nightly_price, discount, cleaning_fee, tourism_fee, service_fee, vat, total, special_request, status)
  values (p_id, case when v.broker_id::text ~ '^[0-9a-f-]{36}$' then v.broker_id::text::uuid end, auth.uid(),
         left(btrim(p_name), 100), nullif(left(btrim(coalesce(p_email, '')), 150), ''), ph, p_check_in, p_check_out,
         p_adults, coalesce(p_children, 0), n, (q->>'nightly')::numeric, (q->>'discount')::numeric, (q->>'cleaning')::numeric,
         (q->>'tourism')::numeric, 0, (q->>'vat')::numeric, (q->>'total')::numeric, nullif(left(btrim(coalesce(p_request, '')), 1000), ''), st)
  returning bookings.id, bookings.ref, bookings.status, bookings.total into b;

  perform public.aq_notify_user(case when v.broker_id::text ~ '^[0-9a-f-]{36}$' then v.broker_id::text::uuid end,
    case when st = 'confirmed' then 'حجز مؤكد جديد' else 'طلب حجز جديد' end,
    v.title || ' — ' || to_char(p_check_in, 'YYYY-MM-DD') || ' إلى ' || to_char(p_check_out, 'YYYY-MM-DD') || ' (' || n || ' ليلة)',
    'pro.html#bookings');
  return query select b.id, b.ref, b.status, b.total;
end;
$$;
grant execute on function public.create_booking(public.aq_prop_id, date, date, int, int, text, text, text, text) to anon, authenticated;

-- حجوزاتي: بأرقام الحجوزات المحفوظة على الجهاز، أو بحساب الضيف
create or replace function public.booking_lookup(p_ids uuid[])
returns table (id uuid, ref text, property_id text, title text, image text, city text, check_in date, check_out date,
               nights int, adults int, children int, total numeric, status text, cancellation_policy text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select b.id, b.ref, b.property_id::text, p.title, (p.image_urls)[1], p.city, b.check_in, b.check_out,
         b.nights, b.adults, b.children, b.total, b.status, p.cancellation_policy, b.created_at
    from public.bookings b join public.properties p on p.id = b.property_id
   where b.id = any(coalesce(p_ids, '{}')) or (auth.uid() is not null and b.guest_id = auth.uid())
   order by b.created_at desc limit 50;
$$;
grant execute on function public.booking_lookup(uuid[]) to anon, authenticated;

create or replace function public.guest_cancel_booking(p_id uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare b record;
begin
  select * into b from public.bookings where id = p_id;
  if b.id is null then raise exception 'not_found'; end if;
  if b.status not in ('pending', 'confirmed') or b.check_in <= current_date then raise exception 'cannot_cancel'; end if;
  update public.bookings set status = 'cancelled', updated_at = now() where id = p_id;
  perform public.aq_notify_user(b.host_id, 'أُلغي حجز', 'ألغى الضيف الحجز رقم ' || b.ref, 'pro.html#bookings');
  return 'cancelled';
end;
$$;
grant execute on function public.guest_cancel_booking(uuid) to anon, authenticated;

-- المضيف: حجوزات عقاراته
create or replace function public.host_bookings()
returns table (id uuid, ref text, property_id text, title text, guest_name text, guest_email text, guest_phone text,
               check_in date, check_out date, nights int, adults int, children int, total numeric, special_request text,
               status text, payment_status text, host_note text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select b.id, b.ref, b.property_id::text, p.title, b.guest_name, b.guest_email, b.guest_phone, b.check_in, b.check_out,
         b.nights, b.adults, b.children, b.total, b.special_request, b.status, b.payment_status, b.host_note, b.created_at
    from public.bookings b join public.properties p on p.id = b.property_id
   where p.broker_id::text = auth.uid()::text or public.is_app_admin()
   order by b.created_at desc limit 500;
$$;
grant execute on function public.host_bookings() to authenticated;

create or replace function public.host_set_booking(p_id uuid, p_status text, p_paid boolean default null, p_note text default null)
returns text language plpgsql security definer set search_path = public
as $$
declare b record; ok boolean;
begin
  select b2.*, p.broker_id, p.title into b from public.bookings b2 join public.properties p on p.id = b2.property_id where b2.id = p_id;
  if b.id is null or (b.broker_id::text <> auth.uid()::text and not public.is_app_admin()) then raise exception 'forbidden'; end if;
  ok := p_status is null or p_status = b.status
     or (b.status = 'pending'   and p_status in ('confirmed', 'declined'))
     or (b.status = 'confirmed' and p_status in ('cancelled', 'completed'));
  if not ok then raise exception 'invalid_transition'; end if;
  update public.bookings set
    status = coalesce(p_status, status),
    payment_status = case when p_paid is null then payment_status when p_paid then 'paid' else 'unpaid' end,
    host_note = coalesce(nullif(left(p_note, 500), ''), host_note),
    updated_at = now()
  where id = p_id;
  if p_status is not null and p_status <> b.status then
    perform public.aq_notify_user(b.guest_id,
      case p_status when 'confirmed' then 'تم تأكيد حجزك ✅' when 'declined' then 'تعذّر قبول طلب الحجز' when 'cancelled' then 'أُلغي حجزك' else 'شكرًا لإقامتك' end,
      b.title || ' — رقم الحجز ' || b.ref, 'stays.html#mine');
  end if;
  return coalesce(p_status, b.status);
end;
$$;
grant execute on function public.host_set_booking(uuid, text, boolean, text) to authenticated;

-- المضيف: تعديل بيانات الإقامة القصيرة (الأسعار والقواعد لا تُعيد الإعلان للمراجعة)
create or replace function public.broker_update_stay(p_id public.aq_prop_id, p jsonb)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v record;
begin
  select * into v from public.properties where id = p_id;
  if v.id is null or (v.broker_id::text <> auth.uid()::text and not public.is_app_admin()) then raise exception 'forbidden'; end if;
  update public.properties set
    nightly_price       = coalesce(nullif(p->>'nightly_price', '')::numeric, nightly_price),
    cleaning_fee        = coalesce(nullif(p->>'cleaning_fee', '')::numeric, cleaning_fee),
    tourism_fee         = coalesce(nullif(p->>'tourism_fee', '')::numeric, tourism_fee),
    vat_pct             = coalesce(nullif(p->>'vat_pct', '')::numeric, vat_pct),
    min_nights          = coalesce(nullif(p->>'min_nights', '')::int, min_nights),
    max_guests          = coalesce(nullif(p->>'max_guests', '')::int, max_guests),
    beds                = coalesce(nullif(p->>'beds', '')::int, beds),
    weekly_discount     = coalesce(nullif(p->>'weekly_discount', '')::numeric, weekly_discount),
    monthly_discount    = coalesce(nullif(p->>'monthly_discount', '')::numeric, monthly_discount),
    instant_book        = coalesce((p->>'instant_book')::boolean, instant_book),
    cancellation_policy = coalesce(nullif(p->>'cancellation_policy', ''), cancellation_policy),
    house_rules         = case when p ? 'house_rules' then nullif(left(p->>'house_rules', 3000), '') else house_rules end,
    check_in_time       = coalesce(nullif(left(p->>'check_in_time', 5), ''), check_in_time),
    check_out_time      = coalesce(nullif(left(p->>'check_out_time', 5), ''), check_out_time),
    price_aed           = coalesce(nullif(p->>'nightly_price', '')::numeric, price_aed)
  where id = p_id;
  return true;
end;
$$;
grant execute on function public.broker_update_stay(public.aq_prop_id, jsonb) to authenticated;

-- ============================================================================
-- 3) قسم السيارات: بيع وإيجار
-- ============================================================================
create table if not exists public.cars (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deal               text not null check (deal in ('sale', 'rent')),
  rent_period        text check (rent_period is null or rent_period in ('daily', 'weekly', 'monthly')),
  make               text not null check (char_length(make) between 1 and 40),
  model              text not null check (char_length(model) between 1 and 60),
  year               int check (year between 1950 and 2100),
  price              numeric not null check (price > 0),
  mileage_km         int check (mileage_km is null or mileage_km >= 0),
  body_type          text,
  fuel               text,
  transmission       text,
  color              text,
  seats              int,
  regional_specs     text,
  condition          text check (condition is null or condition in ('new', 'used')),
  city               text,
  country            text not null default 'الإمارات العربية المتحدة',
  title              text check (char_length(coalesce(title, '')) <= 140),
  description        text check (char_length(coalesce(description, '')) <= 4000),
  images             text[] not null default '{}',
  features           text[] not null default '{}',
  seller_type        text check (seller_type is null or seller_type in ('owner', 'dealer', 'rental_company')),
  seller_name        text,
  phone              text,
  whatsapp           text,
  deposit            numeric,
  km_limit           int,
  insurance_included boolean not null default false,
  delivery           boolean not null default false,
  min_driver_age     int,
  status             text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'sold', 'paused')),
  rejection_reason   text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists cars_list_idx on public.cars (status, deal, created_at desc);
create index if not exists cars_owner_idx on public.cars (owner_id);
alter table public.cars enable row level security;
drop policy if exists "cars public read" on public.cars;
create policy "cars public read" on public.cars for select using (status = 'approved' or owner_id = auth.uid() or public.is_app_admin());
drop policy if exists "cars owner insert" on public.cars;
create policy "cars owner insert" on public.cars for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "cars owner update" on public.cars;
create policy "cars owner update" on public.cars for update to authenticated
  using (owner_id = auth.uid() or public.is_app_admin()) with check (owner_id = auth.uid() or public.is_app_admin());
drop policy if exists "cars owner delete" on public.cars;
create policy "cars owner delete" on public.cars for delete to authenticated using (owner_id = auth.uid() or public.is_app_admin());
grant select on public.cars to anon, authenticated;
grant insert, update, delete on public.cars to authenticated;

-- حماية: المالك لا يعتمد إعلانه بنفسه، وأي تعديل يعيده للمراجعة، و10 إعلانات يوميًا كحد أقصى
create or replace function public.cars_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if public.is_app_admin() then new.updated_at := now(); return new; end if;
  if tg_op = 'INSERT' then
    if (select count(*) from public.cars c where c.owner_id = auth.uid() and c.created_at > now() - interval '1 day') >= 10 then
      raise exception 'rate_limited'; end if;
    new.status := 'pending'; new.rejection_reason := null;
  else
    new.owner_id := old.owner_id;
    if new.status in ('sold', 'paused') and old.status in ('approved', 'sold', 'paused') then
      null;                                   -- بيع / إيقاف مؤقت
    elsif new.status = 'approved' and old.status in ('sold', 'paused') then
      null;                                   -- إعادة تفعيل إعلان معتمد سابقًا
    else
      new.status := 'pending'; new.rejection_reason := null;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists cars_guard_trg on public.cars;
create trigger cars_guard_trg before insert or update on public.cars for each row execute function public.cars_guard();

-- طلبات الاستفسار / الإيجار على السيارة
create table if not exists public.car_inquiries (
  id         bigint generated always as identity primary key,
  car_id     uuid not null references public.cars(id) on delete cascade,
  name       text not null,
  phone      text not null,
  message    text,
  date_from  date,
  date_to    date,
  created_at timestamptz not null default now()
);
create index if not exists car_inquiries_car_idx on public.car_inquiries (car_id, created_at desc);
alter table public.car_inquiries enable row level security;
drop policy if exists "car inquiries owner read" on public.car_inquiries;
create policy "car inquiries owner read" on public.car_inquiries for select to authenticated
  using (public.is_app_admin() or exists (select 1 from public.cars c where c.id = car_id and c.owner_id = auth.uid()));
grant select on public.car_inquiries to authenticated;

create or replace function public.car_inquiry(p_car uuid, p_name text, p_phone text, p_message text, p_from date, p_to date)
returns boolean language plpgsql security definer set search_path = public
as $$
declare c record; ph text;
begin
  select * into c from public.cars where id = p_car and status = 'approved';
  if c.id is null then raise exception 'not_found'; end if;
  ph := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  if char_length(btrim(coalesce(p_name, ''))) < 2 or char_length(ph) < 7 then raise exception 'bad_contact'; end if;
  if (select count(*) from public.car_inquiries i where i.phone = ph and i.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited'; end if;
  insert into public.car_inquiries (car_id, name, phone, message, date_from, date_to)
  values (p_car, left(btrim(p_name), 100), ph, nullif(left(btrim(coalesce(p_message, '')), 1000), ''), p_from, p_to);
  perform public.aq_notify_user(c.owner_id, case when c.deal = 'rent' then 'طلب إيجار لسيارتك' else 'استفسار عن سيارتك' end,
    c.make || ' ' || c.model || ' — ' || left(btrim(p_name), 60) || ' ' || ph, 'add-car.html#mine');
  return true;
end;
$$;
grant execute on function public.car_inquiry(uuid, text, text, text, date, date) to anon, authenticated;

-- صور السيارات: كل مستخدم يرفع داخل مجلده فقط
insert into storage.buckets (id, name, public) values ('car-images', 'car-images', true) on conflict (id) do nothing;
drop policy if exists "car images public read" on storage.objects;
create policy "car images public read" on storage.objects for select using (bucket_id = 'car-images');
drop policy if exists "car images owner write" on storage.objects;
create policy "car images owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'car-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "car images owner delete" on storage.objects;
create policy "car images owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'car-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_app_admin()));

-- ============================================================================
-- 4) توسيع قسم المركبات: السيارات + الدراجات النارية + اليخوت والقوارب،
--    ولكل قسم: بيع، إيجار، قطع غيار، صيانة وخدمات
-- ============================================================================
alter table public.cars add column if not exists kind             text not null default 'car';
alter table public.cars add column if not exists part_category    text;
alter table public.cars add column if not exists service_type     text;
alter table public.cars add column if not exists fits             text;      -- القطعة تناسب أي موديلات
alter table public.cars add column if not exists engine_cc        int;
alter table public.cars add column if not exists engine_hours     int;
alter table public.cars add column if not exists length_ft        numeric;
alter table public.cars add column if not exists cabins           int;
alter table public.cars add column if not exists captain_included boolean not null default false;

alter table public.cars alter column make  drop not null;
alter table public.cars alter column model drop not null;
alter table public.cars alter column price drop not null;

alter table public.cars drop constraint if exists cars_kind_chk;
alter table public.cars add constraint cars_kind_chk check (kind in ('car', 'moto', 'yacht'));
alter table public.cars drop constraint if exists cars_deal_check;
alter table public.cars add constraint cars_deal_check check (deal in ('sale', 'rent', 'parts', 'service'));
alter table public.cars drop constraint if exists cars_rent_period_check;
alter table public.cars add constraint cars_rent_period_check check (rent_period is null or rent_period in ('hourly', 'daily', 'weekly', 'monthly'));
alter table public.cars drop constraint if exists cars_price_check;
alter table public.cars add constraint cars_price_check check (price is null or price > 0);
alter table public.cars drop constraint if exists cars_price_req_chk;
alter table public.cars add constraint cars_price_req_chk check (deal = 'service' or price is not null);
alter table public.cars drop constraint if exists cars_identity_chk;
alter table public.cars add constraint cars_identity_chk check (deal in ('parts', 'service') or (make is not null and model is not null));
alter table public.cars drop constraint if exists cars_named_chk;
alter table public.cars add constraint cars_named_chk check (coalesce(nullif(btrim(title), ''), make) is not null);
alter table public.cars drop constraint if exists cars_seller_type_check;
alter table public.cars add constraint cars_seller_type_check check (seller_type is null or seller_type in ('owner', 'dealer', 'rental_company', 'workshop', 'parts_shop'));
create index if not exists cars_kind_idx on public.cars (status, kind, deal, created_at desc);

create or replace function public.car_inquiry(p_car uuid, p_name text, p_phone text, p_message text, p_from date, p_to date)
returns boolean language plpgsql security definer set search_path = public
as $$
declare c record; ph text;
begin
  select * into c from public.cars where id = p_car and status = 'approved';
  if c.id is null then raise exception 'not_found'; end if;
  ph := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  if char_length(btrim(coalesce(p_name, ''))) < 2 or char_length(ph) < 7 then raise exception 'bad_contact'; end if;
  if (select count(*) from public.car_inquiries i where i.phone = ph and i.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited'; end if;
  insert into public.car_inquiries (car_id, name, phone, message, date_from, date_to)
  values (p_car, left(btrim(p_name), 100), ph, nullif(left(btrim(coalesce(p_message, '')), 1000), ''), p_from, p_to);
  perform public.aq_notify_user(c.owner_id,
    case c.deal when 'rent' then 'طلب إيجار على إعلانك' when 'service' then 'طلب خدمة جديد' else 'استفسار عن إعلانك' end,
    coalesce(nullif(c.title, ''), concat_ws(' ', c.make, c.model)) || ' — ' || left(btrim(p_name), 60) || ' ' || ph, 'add-car.html#mine');
  return true;
end;
$$;
grant execute on function public.car_inquiry(uuid, text, text, text, date, date) to anon, authenticated;
