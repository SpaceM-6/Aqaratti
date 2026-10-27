-- ============================================================================
-- بوابة المهنيين في أنا عقار (المراحل الثلاث):
--   • أنواع الحسابات: وسيط فرد / مكتب / مطوّر، مع التوثيق من الإدارة
--   • فريق المكتب (دعوة الوسطاء بالبريد وقبولها)
--   • إدارة العملاء: مراحل الصفقة، الملاحظات، سجل الاتصالات، المهام والتذكيرات
--   • إدارة العقارات: تعديل (يعود للمراجعة)، إيقاف مؤقت، بيع/تأجير، عدد المشاهدات
--   • مشاريع المطورين على الخارطة (خطة السداد وأنواع الوحدات)
--   • طلبات المشترين والمطابقة التلقائية مع العقارات
--   • الحملات البريدية والمساعد الذكي (سجلات واستعمال)
--
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor بعد engagement.sql (آمن لو أُعيد تشغيله، لا يحذف بيانات).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) الحسابات المهنية
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists account_type text not null default 'user';
alter table public.profiles add column if not exists company_name text;
alter table public.profiles add column if not exists license_no text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists logo_url text;
alter table public.profiles add column if not exists website text;
alter table public.profiles add column if not exists office_id uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists verified boolean not null default false;
alter table public.profiles add column if not exists verified_at timestamptz;
alter table public.profiles add column if not exists email_opt_out boolean not null default false;
do $$ begin
  alter table public.profiles add constraint profiles_account_type_chk check (account_type in ('user', 'broker', 'office', 'developer'));
exception when duplicate_object then null; end $$;

-- سياسات القراءة والتعديل للملف الشخصي (تُضاف فقط إن لم تكن موجودة)
alter table public.profiles enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and cmd in ('SELECT', 'ALL')) then
    create policy "profiles public read" on public.profiles for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and cmd in ('UPDATE', 'ALL')) then
    create policy "profiles self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
  end if;
end $$;

-- حماية: التوثيق للإدارة فقط، والانضمام لمكتب عبر قبول الدعوة فقط
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- الإدارة، أو التعديل المباشر من SQL Editor (بلا جلسة مستخدم)
  if public.is_app_admin() or auth.uid() is null then return new; end if;
  new.verified := old.verified;
  new.verified_at := old.verified_at;
  if new.office_id is distinct from old.office_id and new.office_id is not null
     and coalesce(current_setting('aq.allow_office', true), '') <> '1' then
    new.office_id := old.office_id;
  end if;
  -- تغيير نوع الحساب المهني يُسقط التوثيق ليُراجَع من جديد
  if new.account_type is distinct from old.account_type then
    new.verified := false; new.verified_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- نوع الحساب يُقرأ من بيانات التسجيل عند إنشاء الحساب
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare v_type text := coalesce(new.raw_user_meta_data->>'account_type', 'user');
begin
  if v_type not in ('user', 'broker', 'office', 'developer') then v_type := 'user'; end if;
  insert into public.profiles (id, full_name, phone, whatsapp, account_type, company_name, license_no)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    v_type,
    nullif(new.raw_user_meta_data->>'company_name', ''),
    nullif(new.raw_user_meta_data->>'license_no', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.my_office_member(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = p_user and office_id = auth.uid());
$$;
grant execute on function public.my_office_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) فريق المكتب
-- ---------------------------------------------------------------------------
create table if not exists public.office_invites (
  id         uuid primary key default gen_random_uuid(),
  office_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  email      text not null check (char_length(email) between 5 and 150),
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (office_id, email)
);
alter table public.office_invites enable row level security;
drop policy if exists "invites office manage" on public.office_invites;
create policy "invites office manage" on public.office_invites for all
  using (office_id = auth.uid() or public.is_app_admin())
  with check (office_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and account_type = 'office'));
drop policy if exists "invites invitee read" on public.office_invites;
create policy "invites invitee read" on public.office_invites for select
  using (lower(email) = lower(coalesce(auth.jwt()->>'email', '')));
grant select, insert, update, delete on public.office_invites to authenticated;

create or replace function public.respond_office_invite(p_invite uuid, p_accept boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v public.office_invites;
begin
  select * into v from public.office_invites
   where id = p_invite and status = 'pending' and lower(email) = lower(coalesce(auth.jwt()->>'email', ''));
  if v.id is null then raise exception 'not_found'; end if;
  update public.office_invites set status = case when p_accept then 'accepted' else 'declined' end where id = p_invite;
  if p_accept then
    perform set_config('aq.allow_office', '1', true);
    update public.profiles set office_id = v.office_id where id = auth.uid();
  end if;
  return true;
end;
$$;
grant execute on function public.respond_office_invite(uuid, boolean) to authenticated;

-- المكتب يُخرج وسيطًا من فريقه
create or replace function public.remove_team_member(p_member uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set office_id = null where id = p_member and office_id = auth.uid();
  return found;
end;
$$;
grant execute on function public.remove_team_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) إدارة العملاء (CRM)
-- ---------------------------------------------------------------------------
alter table public.leads add column if not exists stage text not null default 'new';
alter table public.leads add column if not exists budget numeric;
alter table public.leads add column if not exists requirements text;
alter table public.leads add column if not exists source text not null default 'website';
alter table public.leads add column if not exists next_action_at timestamptz;
alter table public.leads add column if not exists assigned_to uuid references auth.users(id) on delete set null;
alter table public.leads add column if not exists updated_at timestamptz not null default now();
do $$ begin
  alter table public.leads add constraint leads_stage_chk check (stage in ('new', 'contacted', 'viewing', 'negotiating', 'won', 'lost'));
exception when duplicate_object then null; end $$;

create or replace function public.can_access_lead(p_lead bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.leads l
     where l.id = p_lead
       and (l.broker_id = auth.uid() or l.assigned_to = auth.uid() or public.my_office_member(l.broker_id) or public.is_app_admin())
  );
$$;
grant execute on function public.can_access_lead(bigint) to authenticated;

drop policy if exists "Office reads team leads" on public.leads;
create policy "Office reads team leads" on public.leads for select
  using (public.my_office_member(broker_id) or assigned_to = auth.uid());
drop policy if exists "Office updates team leads" on public.leads;
create policy "Office updates team leads" on public.leads for update
  using (public.my_office_member(broker_id) or assigned_to = auth.uid())
  with check (public.my_office_member(broker_id) or assigned_to = auth.uid() or broker_id = auth.uid());
drop policy if exists "Owner deletes own leads" on public.leads;
create policy "Owner deletes own leads" on public.leads for delete using (broker_id = auth.uid() or public.is_app_admin());
grant delete on public.leads to authenticated;

create table if not exists public.lead_activities (
  id         bigint generated always as identity primary key,
  lead_id    bigint not null references public.leads(id) on delete cascade,
  actor_id   uuid default auth.uid(),
  kind       text not null default 'note' check (kind in ('note', 'call', 'whatsapp', 'email', 'meeting', 'stage')),
  body       text check (char_length(coalesce(body, '')) <= 3000),
  outcome    text check (char_length(coalesce(outcome, '')) <= 100),
  created_at timestamptz not null default now()
);
create index if not exists lead_activities_lead_idx on public.lead_activities (lead_id, id desc);
alter table public.lead_activities enable row level security;
drop policy if exists "activities access" on public.lead_activities;
create policy "activities access" on public.lead_activities for select using (public.can_access_lead(lead_id));
drop policy if exists "activities insert" on public.lead_activities;
create policy "activities insert" on public.lead_activities for insert to authenticated
  with check (public.can_access_lead(lead_id) and actor_id = auth.uid());
drop policy if exists "activities delete own" on public.lead_activities;
create policy "activities delete own" on public.lead_activities for delete using (actor_id = auth.uid());
grant select, insert, delete on public.lead_activities to authenticated;

-- تحديث وقت آخر تعديل، وتسجيل تغيّر المرحلة تلقائيًا في سجل العميل
create or replace function public.leads_touch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.stage is distinct from old.stage then
    insert into public.lead_activities (lead_id, actor_id, kind, body) values (new.id, auth.uid(), 'stage', new.stage);
  end if;
  return new;
end;
$$;
drop trigger if exists leads_touch on public.leads;
create trigger leads_touch before update on public.leads for each row execute function public.leads_touch();

create table if not exists public.tasks (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  assignee_id uuid references auth.users(id) on delete set null,
  lead_id     bigint references public.leads(id) on delete cascade,
  title       text not null check (char_length(title) between 2 and 200),
  notes       text check (char_length(coalesce(notes, '')) <= 2000),
  due_at      timestamptz,
  priority    text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  done        boolean not null default false,
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists tasks_owner_idx on public.tasks (owner_id, done, due_at);
create index if not exists tasks_assignee_idx on public.tasks (assignee_id, done, due_at);
alter table public.tasks enable row level security;
drop policy if exists "tasks read" on public.tasks;
create policy "tasks read" on public.tasks for select
  using (owner_id = auth.uid() or assignee_id = auth.uid() or public.my_office_member(assignee_id) or public.is_app_admin());
drop policy if exists "tasks insert" on public.tasks;
create policy "tasks insert" on public.tasks for insert to authenticated
  with check (owner_id = auth.uid() and (assignee_id is null or assignee_id = auth.uid() or public.my_office_member(assignee_id))
              and (lead_id is null or public.can_access_lead(lead_id)));
drop policy if exists "tasks update" on public.tasks;
create policy "tasks update" on public.tasks for update
  using (owner_id = auth.uid() or assignee_id = auth.uid())
  with check (owner_id = auth.uid() or assignee_id = auth.uid());
drop policy if exists "tasks delete" on public.tasks;
create policy "tasks delete" on public.tasks for delete using (owner_id = auth.uid());
grant select, insert, update, delete on public.tasks to authenticated;

-- ---------------------------------------------------------------------------
-- 4) إدارة العقارات من بوابة الوسيط
-- ---------------------------------------------------------------------------
create table if not exists public.property_views (
  property_id text not null,
  day         date not null default current_date,
  n           int not null default 0,
  primary key (property_id, day)
);
alter table public.property_views enable row level security;
drop policy if exists "views admin read" on public.property_views;
create policy "views admin read" on public.property_views for select using (public.is_app_admin());
grant select on public.property_views to authenticated;

create or replace function public.track_view(p_id text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.property_views (property_id, day, n) values (left(p_id, 40), current_date, 1)
  on conflict (property_id, day) do update set n = property_views.n + 1;
$$;
grant execute on function public.track_view(text) to anon, authenticated;

-- إحصاءات عقارات المستخدم (ومكتبه): مشاهدات 30 يومًا وعدد الاستفسارات
create or replace function public.my_property_stats()
returns table (property_id bigint, views_30d bigint, views_total bigint, leads bigint)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         coalesce((select sum(v.n) from public.property_views v where v.property_id = 'sb-' || p.id and v.day > current_date - 30), 0),
         coalesce((select sum(v.n) from public.property_views v where v.property_id = 'sb-' || p.id), 0),
         (select count(*) from public.leads l where l.property_id in ('sb-' || p.id, p.id::text))
    from public.properties p
   where p.broker_id::text = auth.uid()::text or public.my_office_member(p.broker_id::uuid);
$$;
grant execute on function public.my_property_stats() to authenticated;

-- حالة الإعلان: إيقاف مؤقت / بيع / تأجير / إعادة تفعيل
create or replace function public.broker_property_set_state(p_id bigint, p_state text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v record; v_new text;
begin
  select * into v from public.properties where id = p_id;
  if v.id is null or (v.broker_id::text <> auth.uid()::text and not public.is_app_admin()) then raise exception 'forbidden'; end if;
  if p_state not in ('paused', 'sold', 'rented', 'active') then raise exception 'invalid_state'; end if;
  if p_state = 'active' then
    v_new := case when v.reviewed_at is not null and coalesce(v.rejection_reason, '') = '' and v.status in ('paused', 'sold', 'rented', 'approved') then 'approved' else 'pending' end;
  else
    v_new := p_state;
  end if;
  update public.properties set status = v_new where id = p_id;
  return v_new;
end;
$$;
grant execute on function public.broker_property_set_state(bigint, text) to authenticated;

-- تعديل بيانات الإعلان: يعود إلى «قيد المراجعة» حتى تعتمده الإدارة من جديد
create or replace function public.broker_update_property(p_id bigint, p jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v record;
begin
  select * into v from public.properties where id = p_id;
  if v.id is null or v.broker_id::text <> auth.uid()::text then raise exception 'forbidden'; end if;
  update public.properties set
    title          = coalesce(nullif(left(p->>'title', 200), ''), title),
    description    = coalesce(left(p->>'description', 5000), description),
    price_aed      = coalesce(nullif(p->>'price_aed', '')::numeric, price_aed),
    bedrooms       = coalesce(nullif(p->>'bedrooms', '')::int, bedrooms),
    bathrooms      = coalesce(nullif(p->>'bathrooms', '')::int, bathrooms),
    area_m2        = coalesce(nullif(p->>'area_m2', '')::numeric, area_m2),
    city           = coalesce(nullif(left(p->>'city', 100), ''), city),
    permit_number  = coalesce(nullif(left(p->>'permit_number', 60), ''), permit_number),
    has_offer      = coalesce((p->>'has_offer')::boolean, has_offer),
    offer_text     = case when p ? 'offer_text' then nullif(left(p->>'offer_text', 300), '') else offer_text end,
    no_commission  = coalesce((p->>'no_commission')::boolean, no_commission),
    status         = 'pending',
    rejection_reason = null
  where id = p_id;
  return true;
end;
$$;
grant execute on function public.broker_update_property(bigint, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) مشاريع المطورين على الخارطة
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id            bigint generated always as identity primary key,
  developer_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name          text not null check (char_length(name) between 2 and 150),
  city          text,
  area          text,
  description   text check (char_length(coalesce(description, '')) <= 6000),
  handover      text,
  sale_status   text not null default 'on_sale' check (sale_status in ('announced', 'on_sale', 'sold_out')),
  price_from    numeric,
  images        text[] not null default '{}',
  brochure_url  text,
  payment_plan  jsonb not null default '[]'::jsonb,
  unit_types    jsonb not null default '[]'::jsonb,
  amenities     text[] not null default '{}',
  lat           double precision,
  lng           double precision,
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  review_note   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists projects_review_idx on public.projects (review_status, created_at desc);
alter table public.projects enable row level security;
drop policy if exists "projects public read" on public.projects;
create policy "projects public read" on public.projects for select
  using (review_status = 'approved' or developer_id = auth.uid() or public.is_app_admin());
drop policy if exists "projects developer insert" on public.projects;
create policy "projects developer insert" on public.projects for insert to authenticated
  with check (developer_id = auth.uid() and review_status = 'pending'
              and exists (select 1 from public.profiles where id = auth.uid() and account_type = 'developer'));
drop policy if exists "projects owner update" on public.projects;
create policy "projects owner update" on public.projects for update
  using (developer_id = auth.uid() or public.is_app_admin())
  with check (developer_id = auth.uid() or public.is_app_admin());
drop policy if exists "projects owner delete" on public.projects;
create policy "projects owner delete" on public.projects for delete using (developer_id = auth.uid() or public.is_app_admin());
grant select on public.projects to anon, authenticated;
grant insert, update, delete on public.projects to authenticated;

-- تعديل المطوّر يعيد المشروع للمراجعة
create or replace function public.projects_touch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if not public.is_app_admin() then
    new.review_status := 'pending';
    new.review_note := null;
  end if;
  return new;
end;
$$;
drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects for each row execute function public.projects_touch();
drop trigger if exists notify_admin_projects on public.projects;
create trigger notify_admin_projects after insert on public.projects
  for each row execute function public.notify_admin_on_insert();

-- ---------------------------------------------------------------------------
-- 6) طلبات المشترين والمطابقة
-- ---------------------------------------------------------------------------
create table if not exists public.buyer_requests (
  id              bigint generated always as identity primary key,
  user_id         uuid default auth.uid(),
  name            text not null check (char_length(name) between 2 and 80),
  phone           text not null check (char_length(phone) between 7 and 30),
  email           text check (char_length(coalesce(email, '')) <= 150),
  deal            text not null default 'sale' check (deal in ('sale', 'rent')),
  city            text check (char_length(coalesce(city, '')) <= 80),
  property_type   text check (char_length(coalesce(property_type, '')) <= 60),
  min_bedrooms    int,
  max_budget      numeric,
  notes           text check (char_length(coalesce(notes, '')) <= 1500),
  contact_consent boolean not null default false,
  status          text not null default 'open' check (status in ('open', 'closed')),
  created_at      timestamptz not null default now()
);
create index if not exists buyer_requests_open_idx on public.buyer_requests (status, created_at desc);
alter table public.buyer_requests enable row level security;
drop policy if exists "requests public insert" on public.buyer_requests;
create policy "requests public insert" on public.buyer_requests for insert to anon, authenticated
  with check (status = 'open' and (user_id is null or user_id = auth.uid()));
drop policy if exists "requests owner read" on public.buyer_requests;
create policy "requests owner read" on public.buyer_requests for select using (user_id = auth.uid() or public.is_app_admin());
drop policy if exists "requests owner update" on public.buyer_requests;
create policy "requests owner update" on public.buyer_requests for update
  using (user_id = auth.uid() or public.is_app_admin()) with check (user_id = auth.uid() or public.is_app_admin());
grant insert on public.buyer_requests to anon, authenticated;
grant select, update on public.buyer_requests to authenticated;

drop trigger if exists aq_rate_limit_buyer_requests on public.buyer_requests;
create trigger aq_rate_limit_buyer_requests before insert on public.buyer_requests
  for each row execute function public.aq_enforce_rate_limit();
drop trigger if exists notify_admin_buyer_requests on public.buyer_requests;
create trigger notify_admin_buyer_requests after insert on public.buyer_requests
  for each row execute function public.notify_admin_on_insert();

-- هل يطابق عقارٌ طلبًا؟
create or replace function public.request_matches_property(r public.buyer_requests, p jsonb)
returns boolean
language sql
immutable
as $$
  select coalesce(p->>'deal_type', 'sale') = r.deal
     and (coalesce(r.city, '') = '' or position(r.city in coalesce(p->>'city', '')) > 0)
     and (r.max_budget is null or nullif(p->>'price_aed', '') is null or (p->>'price_aed')::numeric <= r.max_budget * 1.1)
     and (r.min_bedrooms is null or coalesce(nullif(p->>'bedrooms', '')::int, 0) >= r.min_bedrooms);
$$;

-- عند وصول طلب: إشعار الوسطاء الذين لديهم عقار مطابق، وإشعار صاحب الطلب بعدد العقارات المطابقة
create or replace function public.buyer_request_matchmaker()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare b record; v_n int := 0;
begin
  for b in
    select p.broker_id::uuid as broker_id, count(*) as n
      from public.properties p
     where p.status = 'approved' and p.broker_id is not null and public.request_matches_property(new, to_jsonb(p))
     group by p.broker_id
  loop
    v_n := v_n + b.n;
    insert into public.user_notifications (user_id, kind, title, body, url)
    values (b.broker_id, 'buyer_match', 'طلب مشترٍ جديد يطابق ' || b.n || ' من عقاراتك',
            (case when new.deal = 'rent' then 'إيجار' else 'شراء' end) || coalesce(' في ' || nullif(new.city, ''), '') ||
            coalesce(' بميزانية حتى ' || to_char(new.max_budget, 'FM999,999,999') || ' درهم', ''), 'pro.html#requests');
  end loop;
  if new.user_id is not null then
    insert into public.user_notifications (user_id, kind, title, body, url)
    values (new.user_id, 'match', 'استلمنا طلبك', case when v_n > 0 then 'وجدنا ' || v_n || ' عقارًا قد يناسبك، وأبلغنا الوسطاء المرخّصين أصحابها.' else 'سنبلغك فور نزول عقار يناسب طلبك.' end,
            'index.html?tab=' || new.deal || coalesce('&city=' || nullif(new.city, ''), '') || coalesce('&max=' || new.max_budget::bigint, '') || '#search');
  end if;
  return new;
exception when others then return new;
end;
$$;
drop trigger if exists buyer_request_matchmaker on public.buyer_requests;
create trigger buyer_request_matchmaker after insert on public.buyer_requests
  for each row execute function public.buyer_request_matchmaker();

-- طلبات المشترين المطابقة لعقارات الوسيط (بيانات التواصل للوسيط الموثّق وبموافقة المشتري فقط)
create or replace function public.matching_requests()
returns table (id bigint, created_at timestamptz, deal text, city text, property_type text, min_bedrooms int,
               max_budget numeric, notes text, matches bigint, name text, phone text, email text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_verified boolean;
begin
  select coalesce(pr.verified, false) into v_verified from public.profiles pr where pr.id = auth.uid();
  return query
  select r.id, r.created_at, r.deal, r.city, r.property_type, r.min_bedrooms, r.max_budget, r.notes,
         (select count(*) from public.properties p where p.status = 'approved'
            and (p.broker_id::text = auth.uid()::text or public.my_office_member(p.broker_id::uuid))
            and public.request_matches_property(r, to_jsonb(p))) as matches,
         case when v_verified and r.contact_consent then r.name else split_part(r.name, ' ', 1) end,
         case when v_verified and r.contact_consent then r.phone else null end,
         case when v_verified and r.contact_consent then r.email else null end
    from public.buyer_requests r
   where r.status = 'open' and r.created_at > now() - interval '60 days'
     and exists (select 1 from public.properties p where p.status = 'approved'
                   and (p.broker_id::text = auth.uid()::text or public.my_office_member(p.broker_id::uuid))
                   and public.request_matches_property(r, to_jsonb(p)))
   order by r.created_at desc
   limit 200;
end;
$$;
grant execute on function public.matching_requests() to authenticated;

-- ---------------------------------------------------------------------------
-- 7) الحملات البريدية والمساعد الذكي (سجلات)
-- ---------------------------------------------------------------------------
create table if not exists public.email_campaigns (
  id         bigint generated always as identity primary key,
  subject    text not null,
  body       text not null,
  audience   text not null,
  status     text not null default 'draft',
  sent_count int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.email_campaigns enable row level security;
drop policy if exists "campaigns admin" on public.email_campaigns;
create policy "campaigns admin" on public.email_campaigns for all using (public.is_app_admin()) with check (public.is_app_admin());
grant select, insert, update, delete on public.email_campaigns to authenticated;

create table if not exists public.ai_usage (
  key        text not null,
  hour       timestamptz not null,
  n          int not null default 0,
  primary key (key, hour)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;
drop policy if exists "ai usage admin read" on public.ai_usage;
create policy "ai usage admin read" on public.ai_usage for select using (public.is_app_admin());

-- ---------------------------------------------------------------------------
-- 8) أدوات الإدارة
-- ---------------------------------------------------------------------------
create or replace function public.admin_accounts(p_type text default null)
returns table (id uuid, email text, full_name text, phone text, account_type text, company_name text,
               license_no text, verified boolean, office_id uuid, created_at timestamptz, listings bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then raise exception 'forbidden'; end if;
  return query
  select p.id, u.email::text, p.full_name, p.phone, p.account_type, p.company_name, p.license_no, p.verified, p.office_id, u.created_at,
         (select count(*) from public.properties x where x.broker_id::text = p.id::text)
    from public.profiles p join auth.users u on u.id = p.id
   where (p_type is null and p.account_type <> 'user') or p.account_type = p_type
   order by p.verified, u.created_at desc
   limit 500;
end;
$$;
revoke all on function public.admin_accounts(text) from public, anon;
grant execute on function public.admin_accounts(text) to authenticated;

-- مستلمو الحملات البريدية (تستدعيها دالة الإرسال الخلفية فقط، لا المتصفح)
create or replace function public.campaign_recipients(p_audience text)
returns table (id uuid, email text, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, u.email::text, p.full_name
    from public.profiles p join auth.users u on u.id = p.id
   where not p.email_opt_out and u.email is not null
     and (p_audience = 'all'
          or (p_audience = 'pros' and p.account_type in ('broker', 'office', 'developer'))
          or p.account_type = p_audience)
   order by u.created_at;
$$;
revoke all on function public.campaign_recipients(text) from public, anon, authenticated;
grant execute on function public.campaign_recipients(text) to service_role;

-- إحصاءات لوحة التحكم (نسخة موسّعة تشمل البوابة المهنية)
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
  begin execute 'select count(*) from public.projects where review_status = ''pending''' into n; r := r || jsonb_build_object('pending_projects', n); exception when others then null; end;
  begin execute 'select count(*) from public.profiles where account_type <> ''user'' and not verified' into n; r := r || jsonb_build_object('unverified_accounts', n); exception when others then null; end;
  begin execute 'select count(*) from public.profiles where account_type <> ''user''' into n; r := r || jsonb_build_object('pro_accounts', n); exception when others then null; end;
  begin execute 'select count(*) from public.buyer_requests where status = ''open'' and created_at > now() - interval ''7 days''' into n; r := r || jsonb_build_object('new_buyer_requests', n); exception when others then null; end;
  return r;
end;
$$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- للتأكد: يجب أن تظهر 7 جداول
select table_name from information_schema.tables
 where table_schema = 'public'
   and table_name in ('office_invites', 'lead_activities', 'tasks', 'property_views', 'projects', 'buyer_requests', 'email_campaigns')
 order by 1;

-- الإدارة ترسل إشعارًا لحساب محدد (عند التوثيق أو مراجعة المشاريع)
grant insert on public.user_notifications to authenticated;
drop policy if exists "notifications admin insert" on public.user_notifications;
create policy "notifications admin insert" on public.user_notifications for insert to authenticated with check (public.is_app_admin());
