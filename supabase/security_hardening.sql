-- ============================================================================
-- تقوية أمان «أنا عقار» (فحص 2 نوفمبر 2026)
--   1) بيانات المستخدمين العاديين (الهاتف والواتساب) لم تعد مقروءة للزوار:
--      يُقرأ الملف الشخصي فقط لصاحبه، أو للإدارة، أو للمكتب وفريقه، أو إن كان معلنًا (وسيط/مكتب/مطوّر، أو له إعلان منشور).
--   2) تنظيف النصوص قبل حفظها: تُحوَّل الرموز < > " ' ` إلى رموز آمنة الشكل، فلا يمكن حقن كود في عنوان أو وصف أو اسم.
--      وروابط الصور يجب أن تبدأ بـ https:// .
--   3) حماية من الإغراق لجداول إضافية: البلاغات، واستفسارات السيارات، وطلبات «اطلب عقارك»، والحجوزات، والمحادثات، وإعلانات المركبات.
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor (آمن لو أُعيد تشغيله). لا يحذف أي بيانات.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) قراءة الملفات الشخصية
-- ---------------------------------------------------------------------------
create or replace function public.aq_profile_is_public(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = p_id and account_type in ('broker', 'office', 'developer'))
      or exists (select 1 from public.properties where broker_id = p_id and status = 'approved');
$$;
create or replace function public.aq_my_office()
returns uuid
language sql
stable
security definer
set search_path = public
as $$ select office_id from public.profiles where id = auth.uid(); $$;
grant execute on function public.aq_profile_is_public(uuid) to anon, authenticated;
grant execute on function public.aq_my_office() to authenticated;

-- حذف سياسات القراءة المفتوحة للجميع على الملفات الشخصية
do $$
declare r record;
begin
  for r in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'profiles' and cmd = 'SELECT' and coalesce(qual, '') in ('true', '(true)')
  loop
    execute format('drop policy %I on public.profiles', r.policyname);
  end loop;
end $$;
drop policy if exists "profiles visible" on public.profiles;
create policy "profiles visible" on public.profiles for select using (
  id = auth.uid()
  or public.is_app_admin()
  or office_id = auth.uid()                       -- المكتب يرى فريقه
  or id = public.aq_my_office()                   -- الوسيط يرى مكتبه
  or public.aq_profile_is_public(id)              -- المعلنون فقط يظهرون للزوار
);

-- ---------------------------------------------------------------------------
-- 2) تنظيف النصوص المدخلة (ضد حقن الكود XSS)
-- ---------------------------------------------------------------------------
create or replace function public.aq_sanitize_row()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_in  jsonb := to_jsonb(new);
  v_out jsonb := '{}'::jsonb;
  k text; v jsonb; s text;
begin
  for k, v in select * from jsonb_each(v_in) loop
    if jsonb_typeof(v) = 'string' then
      s := v #>> '{}';
      if s ~ '[<>"''`]' then
        if k ~ '(url|website|link|path)$' then
          -- الروابط: تُرفض إن كانت تحتوي رموزًا خطرة أو لا تبدأ بـ http(s)
          if s ~ '[<>"''`\s]' or s !~* '^(https?://|/)' then v_out := v_out || jsonb_build_object(k, null); end if;
        else
          s := translate(s, '<>"''`', '‹›”’‵');
          v_out := v_out || jsonb_build_object(k, s);
        end if;
      elsif k ~ '(url|website|link)$' and s <> '' and s ~* '^\s*(javascript|data|vbscript):' then
        v_out := v_out || jsonb_build_object(k, null);
      end if;
    elsif jsonb_typeof(v) = 'array' and k in ('image_urls', 'images', 'portfolio', 'photos') then
      -- مصفوفات روابط الصور: تبقى فقط الروابط الآمنة التي تبدأ بـ https://
      v_out := v_out || jsonb_build_object(k, coalesce((select jsonb_agg(e) from jsonb_array_elements(v) e
                 where jsonb_typeof(e) = 'string' and (e #>> '{}') ~* '^https://' and (e #>> '{}') !~ '[<>"''`\s]'), '[]'::jsonb));
    end if;
  end loop;
  if v_out <> '{}'::jsonb then new := jsonb_populate_record(new, v_out); end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['properties', 'profiles', 'cars', 'service_providers', 'projects', 'leads', 'reports', 'service_requests',
                           'buyer_requests', 'car_inquiries', 'bookings', 'chat_messages', 'chat_threads', 'property_reviews',
                           'broker_reviews', 'lead_activities', 'tasks', 'property_docs', 'office_invites', 'individual_brokers', 'brokers'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists aq_sanitize on public.%I', t);
      execute format('create trigger aq_sanitize before insert or update on public.%I for each row execute function public.aq_sanitize_row()', t);
    end if;
  end loop;
end $$;

-- تنظيف ما حُفظ سابقًا في الجداول العامة الصغيرة (يمرّ كل صف عبر المنظّف)
do $$
declare t text;
begin
  foreach t in array array['properties', 'cars', 'service_providers', 'projects', 'profiles'] loop
    if to_regclass('public.' || t) is not null then
      begin
        execute format('alter table public.%I disable trigger user', t);
        execute format('alter table public.%I enable trigger aq_sanitize', t);
        execute format('update public.%I set id = id', t);
        execute format('alter table public.%I enable trigger user', t);
      exception when others then
        execute format('alter table public.%I enable trigger user', t);
      end;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3) حماية من الإغراق لجداول إضافية (نفس دالة rate_limits.sql)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  if to_regprocedure('public.aq_enforce_rate_limit()') is null then return; end if;
  foreach t in array array['reports', 'car_inquiries', 'buyer_requests', 'bookings', 'chat_threads'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists aq_rate_limit_%s on public.%I', t, t);
      execute format('create trigger aq_rate_limit_%s before insert on public.%I for each row execute function public.aq_enforce_rate_limit()', t, t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4) فحص: أي جدول في public بلا حماية صفوف (يجب أن تكون النتيجة فارغة)
-- ---------------------------------------------------------------------------
select c.relname as table_without_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
