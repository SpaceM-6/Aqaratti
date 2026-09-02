-- ============================================================================
-- يضمن إنشاء صف profiles تلقائياً لكل مستخدم جديد في auth.users، بغض النظر
-- عن حالة تأكيد البريد الإلكتروني (SECURITY DEFINER يتجاوز RLS). هذا يحل مشكلة
-- فشل إدخال profiles من كود المتصفح عندما لا توجد جلسة نشطة بعد (auth.uid() فارغ
-- قبل تأكيد البريد)، وهو النمط الموصى به رسمياً من Supabase لهذه الحالة بالضبط.
-- الاسم/الهاتف يُقرآن من user_metadata التي يرسلها signUp({ options: { data } }).
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, whatsapp)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
