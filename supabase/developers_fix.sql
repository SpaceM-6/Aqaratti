-- ============================================================================
-- دليل المطوّرين: إصلاحان
--   1) ثغرة: كان أي مستخدم مسجّل يستطيع تعديل بيانات أي مطوّر. صار التعديل للإدارة فقط.
--   2) هاتف المطوّر وجواله وبريده للأعضاء المسجّلين فقط (مثل أرقام الوسطاء).
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor (آمن لو أُعيد تشغيله). لا يحذف أي بيانات.
-- ============================================================================
drop policy if exists "Authenticated users can update developers" on public.developers;
drop policy if exists "developers admin update" on public.developers;
create policy "developers admin update" on public.developers for update
  using (public.is_app_admin()) with check (public.is_app_admin());

do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'developers'
     and column_name not in ('phone', 'mobile', 'email');
  execute 'revoke select on public.developers from anon';
  execute format('grant select (%s) on public.developers to anon', cols);
  execute 'grant select on public.developers to authenticated';
end $$;
