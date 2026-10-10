-- ============================================================================
-- تفعيل الوسيط لملفه بنفسه (صفحة claim-profile.html)
--
-- الفكرة: الوسيط يبحث عن ملفه برقم DLD، ثم يثبت أنه صاحب البريد المسجّل في
-- الملف عبر رمز تحقق من Supabase Auth (signInWithOtp / verifyOtp)، ثم يستدعي
-- الدالة claim_individual_broker التي تتحقق داخل قاعدة البيانات (لا في المتصفح)
-- من أن بريد الجلسة يطابق بريد الملف قبل التفعيل. لذلك لا يمكن لأحد تفعيل ملف
-- غيره حتى لو عدّل كود الصفحة.
--
-- يُنفَّذ مرة واحدة من Supabase Dashboard → SQL Editor.
-- ============================================================================

-- أعمدة الملكية والموافقات (دليل قانوني على موافقة الوسيط مع التاريخ والوقت)
alter table public.individual_brokers add column if not exists claimed_by uuid references auth.users(id) on delete set null;
alter table public.individual_brokers add column if not exists claimed_at timestamptz;
alter table public.individual_brokers add column if not exists terms_accepted_at timestamptz;
alter table public.individual_brokers add column if not exists public_contact_consent boolean not null default false;
alter table public.individual_brokers add column if not exists public_contact_consent_at timestamptz;
alter table public.individual_brokers add column if not exists marketing_consent boolean not null default false;
alter table public.individual_brokers add column if not exists marketing_consent_at timestamptz;

create unique index if not exists individual_brokers_claimed_by_idx
  on public.individual_brokers (claimed_by) where claimed_by is not null;

-- ----------------------------------------------------------------------------
-- 1) التحقق من أن البريد المُدخل يطابق بريد الملف، قبل إرسال رمز التحقق.
--    ترجع true/false فقط، ولا ترجع البريد الصحيح أبداً.
-- ----------------------------------------------------------------------------
create or replace function public.broker_email_matches(p_dld_number text, p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.individual_brokers
    where dld_broker_number = trim(p_dld_number)
      and email is not null
      and lower(trim(email)) = lower(trim(p_email))
      and is_active = false
      and claimed_by is null
  );
$$;

revoke all on function public.broker_email_matches(text, text) from public;
grant execute on function public.broker_email_matches(text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2) تفعيل الملف بعد التحقق. تعمل فقط لمستخدم مسجّل دخوله ببريد يطابق بريد الملف.
-- ----------------------------------------------------------------------------
create or replace function public.claim_individual_broker(
  p_dld_number text,
  p_terms boolean,
  p_public_contact boolean,
  p_marketing boolean
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_id    bigint;
begin
  if v_uid is null or v_email = '' then
    raise exception 'not_authenticated';
  end if;
  if not coalesce(p_terms, false) then
    raise exception 'terms_required';
  end if;
  if exists (select 1 from public.individual_brokers where claimed_by = v_uid) then
    raise exception 'already_claimed_another';
  end if;

  update public.individual_brokers
     set is_active                 = true,
         activated_at              = now(),
         claimed_by                = v_uid,
         claimed_at                = now(),
         terms_accepted_at         = now(),
         public_contact_consent    = coalesce(p_public_contact, false),
         public_contact_consent_at = case when p_public_contact then now() end,
         marketing_consent         = coalesce(p_marketing, false),
         marketing_consent_at      = case when p_marketing then now() end
   where dld_broker_number = trim(p_dld_number)
     and lower(trim(email)) = v_email
     and claimed_by is null
  returning id into v_id;

  if v_id is null then
    raise exception 'no_matching_profile';
  end if;
  return v_id;
end;
$$;

revoke all on function public.claim_individual_broker(text, boolean, boolean, boolean) from public;
grant execute on function public.claim_individual_broker(text, boolean, boolean, boolean) to authenticated;
