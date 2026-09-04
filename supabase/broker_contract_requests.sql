-- ============================================================================
-- طلبات التعاقد: يرسلها زائر الموقع من صفحة وسيط فرد غير مفعل (زر "طلب التعاقد
-- مع هذا الوسيط" في individual-broker-profile.html) لإعلام الإدارة برغبته في
-- التواصل مع وسيط مسجّل لدى DLD لكنه لم يُفعَّل بعد على AqarX. الزائر قد لا
-- يكون مسجّلاً دخوله، لذا الإدخال متاح للعامة (بخلاف account_deletion_requests
-- التي تتطلب auth.uid()). لا سياسة قراءة للعامة - فقط service_role أو مستخدم
-- مسجّل دخوله (نفس صلاحية تفعيل الوسطاء) يستطيع مراجعة الطلبات.
-- ============================================================================

create table if not exists public.broker_contract_requests (
  id                uuid primary key default gen_random_uuid(),
  broker_id         bigint not null references public.individual_brokers(id) on delete cascade,
  broker_name       text,
  requester_name    text not null,
  requester_phone   text not null,
  note              text,
  status            text not null default 'pending',
  created_at        timestamptz not null default now()
);

alter table public.broker_contract_requests enable row level security;

drop policy if exists "Anyone can submit a contract request" on public.broker_contract_requests;
create policy "Anyone can submit a contract request"
  on public.broker_contract_requests
  for insert
  to public
  with check (true);

drop policy if exists "Authenticated users can view contract requests" on public.broker_contract_requests;
create policy "Authenticated users can view contract requests"
  on public.broker_contract_requests
  for select
  using (auth.uid() is not null);

drop policy if exists "Authenticated users can update contract requests" on public.broker_contract_requests;
create policy "Authenticated users can update contract requests"
  on public.broker_contract_requests
  for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
