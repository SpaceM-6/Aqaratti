-- ============================================================================
-- «أفضل الوسطاء»: ترتيب الوسطاء والمكاتب المسجلين في أنا عقار بأدائهم الفعلي على المنصة،
-- لا بالإعلان المدفوع. المعايير (من 100):
--   35  إعلانات موثّقة المستندات (سند الملكية + نموذج A مقبولان من الإدارة) من إعلاناته النشطة
--   25  نسبة الرد على العملاء خلال 90 يومًا
--   20  نسبة الإعلانات التي أكّد توافرها خلال 30 يومًا
--   10  رخصة سارية في سجل دائرة الأراضي والأملاك
--   10  حجم المخزون النشط (حتى 20 إعلانًا)
--   ناقص 10 عن كل بلاغ مؤكد على إعلاناته
-- يظهر فقط من له إعلان نشط واحد على الأقل. لا يُعاد أي هاتف أو بريد.
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor. يعتمد على trust_market.sql وdld_registry.sql.
-- ============================================================================
create or replace function public.top_brokers(p_limit integer default 50)
returns table (id uuid, full_name text, company_name text, logo_url text, account_type text, license_active boolean,
               active integer, verified_listings integer, responded_pct integer, avg_response_hrs numeric,
               fresh_pct integer, closed integer, score integer)
language sql
stable
security definer
set search_path = public
as $$
  with b as (
    select pr.id, pr.full_name, pr.company_name, pr.logo_url, pr.account_type, pr.license_no
      from public.profiles pr
     where pr.account_type in ('broker', 'office')
       and exists (select 1 from public.properties p where p.broker_id = pr.id and p.status = 'approved')
  ), m as (
    select b.*,
      public.aq_license_active(b.license_no) as lic,
      (select count(*) from public.properties p where p.broker_id = b.id and p.status = 'approved')::int as act,
      (select count(*) from public.properties p where p.broker_id = b.id and p.status = 'approved'
          and p.check_ownership_at is not null and p.check_mandate_at is not null)::int as ver,
      (select count(*) from public.properties p where p.broker_id = b.id and p.status = 'approved'
          and p.available_at > now() - interval '30 days')::int as fresh,
      (select count(*) from public.properties p where p.broker_id = b.id and p.status in ('sold', 'rented'))::int as cl,
      (select count(*) from public.leads l where l.broker_id = b.id and l.created_at > now() - interval '90 days')::int as ld,
      (select count(*) from public.leads l where l.broker_id = b.id and l.created_at > now() - interval '90 days' and l.first_response_at is not null)::int as resp,
      (select round((avg(extract(epoch from (l.first_response_at - l.created_at))) / 3600)::numeric, 1) from public.leads l
          where l.broker_id = b.id and l.created_at > now() - interval '90 days' and l.first_response_at is not null) as hrs,
      (select count(*) from public.reports r join public.properties p on p.broker_id = b.id
          where r.status = 'done' and r.target_url like '%id=sb-' || p.id::text || '%')::int as rep
    from b
  )
  select id, full_name, company_name, logo_url, account_type, lic, act, ver,
         case when ld = 0 then null else round(100.0 * resp / ld)::int end,
         hrs,
         round(100.0 * fresh / act)::int,
         cl,
         greatest(0, round(
             35.0 * ver / act
           + case when ld = 0 then 12.5 else 25.0 * resp / ld end   -- من لم يصله عملاء بعد يأخذ نصف الدرجة
           + 20.0 * fresh / act
           + case when lic then 10 else 0 end
           + 10.0 * least(act, 20) / 20
           - 10 * rep))::int as score
    from m
   order by score desc, act desc
   limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;
grant execute on function public.top_brokers(integer) to anon, authenticated;
