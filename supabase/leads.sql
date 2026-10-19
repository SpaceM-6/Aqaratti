-- ============================================================================
-- استفسارات العقارات وطلبات المعاينة (property-details.html و broker-profile.html):
-- يُحفظ الاستفسار هنا → يراه الوسيط صاحب العقار في dashboard.html، ويرى المديرون الكل
-- في admin/service-requests.html (تبويب «استفسارات العقارات»).
-- آمن لو أُعيد تشغيله، ولا يغيّر جدولاً موجوداً إلا بإضافة الأعمدة الناقصة.
-- ============================================================================
create table if not exists public.leads (
  id             bigint generated always as identity primary key,
  property_id    text,
  property_title text,
  broker_id      uuid references auth.users(id) on delete set null,
  buyer_name     text not null,
  buyer_email    text,
  buyer_phone    text,
  message        text,
  status         text not null default 'new',
  created_at     timestamptz not null default now()
);
alter table public.leads add column if not exists property_title text;
alter table public.leads add column if not exists buyer_email text;
alter table public.leads add column if not exists status text not null default 'new';
create index if not exists leads_created_idx on public.leads (created_at desc);

alter table public.leads enable row level security;

drop policy if exists "Anyone can send a property inquiry" on public.leads;
create policy "Anyone can send a property inquiry"
  on public.leads for insert to anon, authenticated
  with check (
    char_length(coalesce(buyer_name, '')) between 2 and 100
    and char_length(coalesce(buyer_phone, '')) <= 30
    and char_length(coalesce(buyer_email, '')) <= 150
    and char_length(coalesce(message, '')) <= 2000
    and status in ('new', 'viewing')
  );

drop policy if exists "Brokers read their own leads" on public.leads;
create policy "Brokers read their own leads"
  on public.leads for select using (broker_id = auth.uid() or public.is_app_admin());

drop policy if exists "Brokers update their own leads" on public.leads;
create policy "Brokers update their own leads"
  on public.leads for update using (broker_id = auth.uid() or public.is_app_admin())
  with check (broker_id = auth.uid() or public.is_app_admin());
