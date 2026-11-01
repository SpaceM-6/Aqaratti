-- ============================================================================
-- مستندات الإعلان: يرفع الوسيط سند الملكية ونموذج تفويض التسويق (Form A) لكل عقار،
-- فتراجعها الإدارة وتعتمدها، فيظهر للزوار «فُحصت الملكية» و«فُحص التفويض» بتاريخهما.
-- الملفات نفسها خاصة تمامًا: لا يراها إلا الوسيط صاحبها والإدارة (روابط مؤقتة لدقائق).
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor (آمن لو أُعيد تشغيله). يعتمد على trust_market.sql.
-- ============================================================================

-- 1) مخزن ملفات خاص (ليس عامًا)، حتى 10 ميجابايت للملف، صور وPDF فقط
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-docs', 'property-docs', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- المسار: <معرّف الوسيط>/<رقم العقار>/<النوع>-<الوقت>.<الامتداد>
drop policy if exists "property docs owner upload" on storage.objects;
create policy "property docs owner upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'property-docs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "property docs owner or admin read" on storage.objects;
create policy "property docs owner or admin read" on storage.objects for select to authenticated
  using (bucket_id = 'property-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_app_admin()));
drop policy if exists "property docs owner or admin delete" on storage.objects;
create policy "property docs owner or admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'property-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_app_admin()));

-- 2) سجل المستندات
create table if not exists public.property_docs (
  id           uuid primary key default gen_random_uuid(),
  property_id  public.aq_prop_id not null references public.properties(id) on delete cascade,
  broker_id    uuid not null default auth.uid(),
  kind         text not null check (kind in ('title_deed', 'form_a', 'other')),
  path         text not null,
  file_name    text,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  review_note  text,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists property_docs_property_idx on public.property_docs (property_id);
create index if not exists property_docs_pending_idx on public.property_docs (created_at) where status = 'pending';
alter table public.property_docs enable row level security;

drop policy if exists "docs owner read" on public.property_docs;
create policy "docs owner read" on public.property_docs for select to authenticated
  using (broker_id = auth.uid() or public.is_app_admin());
drop policy if exists "docs owner insert" on public.property_docs;
create policy "docs owner insert" on public.property_docs for insert to authenticated
  with check (broker_id = auth.uid() and status = 'pending'
              and exists (select 1 from public.properties p where p.id = property_id and p.broker_id = auth.uid())
              and split_part(path, '/', 1) = auth.uid()::text);
drop policy if exists "docs owner delete pending" on public.property_docs;
create policy "docs owner delete pending" on public.property_docs for delete to authenticated
  using ((broker_id = auth.uid() and status <> 'accepted') or public.is_app_admin());
revoke all on public.property_docs from anon;
grant select, insert, delete on public.property_docs to authenticated;

-- 3) مراجعة الإدارة: القبول يفعّل الفحص المقابل على الإعلان، والرفض يلغيه إن لم يبق مستند مقبول
create or replace function public.admin_review_property_doc(p_doc uuid, p_ok boolean, p_note text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare d public.property_docs;
begin
  if not public.is_app_admin() then raise exception 'not allowed'; end if;
  update public.property_docs set status = case when p_ok then 'accepted' else 'rejected' end,
         review_note = nullif(trim(coalesce(p_note, '')), ''), reviewed_at = now()
   where id = p_doc returning * into d;
  if d.id is null then raise exception 'not found'; end if;
  if d.kind = 'title_deed' then
    update public.properties set check_ownership_at = case when p_ok then now()
      when exists (select 1 from public.property_docs x where x.property_id = d.property_id and x.kind = 'title_deed' and x.status = 'accepted') then check_ownership_at end
     where id = d.property_id;
  elsif d.kind = 'form_a' then
    update public.properties set check_mandate_at = case when p_ok then now()
      when exists (select 1 from public.property_docs x where x.property_id = d.property_id and x.kind = 'form_a' and x.status = 'accepted') then check_mandate_at end
     where id = d.property_id;
  end if;
  return d.status;
end;
$$;
revoke all on function public.admin_review_property_doc(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_property_doc(uuid, boolean, text) to authenticated;
