-- ============================================================================
-- دليل الخدمات: قسما «إطفاء الحرائق» و«كاميرات المراقبة» بدل «الأمن والسلامة»
-- (يبقى قسم «الحراسة الأمنية» لشركات الحراسة)، ونقل الشركات الموجودة كلٌّ إلى قسمها.
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor (آمن لو أُعيد تشغيله). لا يحذف أي بيانات.
-- ============================================================================

alter table public.service_providers drop constraint if exists service_providers_category_check;
alter table public.service_providers add constraint service_providers_category_check
  check (category in ('legal', 'residency', 'engineering', 'contracting', 'interior', 'property_services', 'property_mgmt', 'maintenance', 'cleaning', 'pest', 'garden', 'pools', 'lighting', 'smart_home', 'security', 'fire_safety', 'cctv', 'movers', 'domestic', 'care', 'pets', 'car_rental', 'immigration', 'recruitment'));

drop policy if exists "Anyone can submit a service request" on public.service_requests;
create policy "Anyone can submit a service request"
  on public.service_requests for insert
  to anon, authenticated
  with check (
    service in ('general', 'brokerage', 'residency', 'legal', 'property_services', 'engineering', 'contracting', 'interior', 'citizenship', 'property_mgmt', 'maintenance', 'cleaning', 'pest', 'garden', 'pools', 'lighting', 'smart_home', 'security', 'fire_safety', 'cctv', 'movers', 'domestic', 'care', 'pets', 'car_rental', 'immigration', 'recruitment')
    and char_length(name) between 2 and 100
    and char_length(phone) between 6 and 30
    and char_length(coalesce(email, '')) <= 150
    and char_length(coalesce(city, '')) <= 100
    and char_length(coalesce(details, '')) <= 2000
    and status = 'new'
    and admin_notes is null
  );

-- شركات أنظمة الحريق
update public.service_providers set category = 'fire_safety'
 where category = 'security' and coalesce(name_en, name_ar) in ('NAFFCO', 'Al Manarah Safety Equipment LLC', 'Emirates Captain Safety & Security Devices LLC', 'SFFECO Global', 'Ray Force Fire Protection & Safety Services (RAFFCO)', 'DM Safety Services', 'DM Safety Services – Sharjah', 'Global Alarms', 'Amples Fire & Safety LLC', 'Emirates Fire Fighting Equipment Factory LLC (FIREX)', 'Gulf Fire Vision LLC');
-- شركات كاميرات المراقبة وأنظمة الأمن الإلكترونية
update public.service_providers set category = 'cctv'
 where category = 'security' and coalesce(name_en, name_ar) in ('Al Khoory Solutions LLC', 'Almoosa Security Systems (AMSS)');

select category, count(*) from public.service_providers where category in ('security', 'fire_safety', 'cctv') group by category;
