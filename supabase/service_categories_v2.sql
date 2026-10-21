-- ============================================================================
-- أقسام دليل الخدمات الجديدة (الخدم والسائقون، الرعاية والتمريض، الحيوانات الأليفة، النظافة،
-- مكافحة الحشرات، الحدائق، المسابح، الإضاءة، نقل الأثاث، الصيانة، الأمن والسلامة، تأجير السيارات،
-- المنازل الذكية، إدارة العقارات، الهجرة والجنسية، التوظيف).
-- يسمح بإدراج شركات هذه الأقسام، وبطلب خدماتها من الموقع.
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor (آمن لو أُعيد تشغيله). لا يحذف أي بيانات.
-- ============================================================================

alter table public.service_providers drop constraint if exists service_providers_category_check;
alter table public.service_providers add constraint service_providers_category_check
  check (category in ('legal', 'residency', 'engineering', 'contracting', 'interior', 'property_services', 'property_mgmt', 'maintenance', 'cleaning', 'pest', 'garden', 'pools', 'lighting', 'smart_home', 'security', 'movers', 'domestic', 'care', 'pets', 'car_rental', 'immigration', 'recruitment'));

drop policy if exists "Anyone can submit a service request" on public.service_requests;
create policy "Anyone can submit a service request"
  on public.service_requests for insert
  to anon, authenticated
  with check (
    service in ('general', 'brokerage', 'residency', 'legal', 'property_services', 'engineering', 'contracting', 'interior', 'citizenship', 'property_mgmt', 'maintenance', 'cleaning', 'pest', 'garden', 'pools', 'lighting', 'smart_home', 'security', 'movers', 'domestic', 'care', 'pets', 'car_rental', 'immigration', 'recruitment')
    and char_length(name) between 2 and 100
    and char_length(phone) between 6 and 30
    and char_length(coalesce(email, '')) <= 150
    and char_length(coalesce(city, '')) <= 100
    and char_length(coalesce(details, '')) <= 2000
    and status = 'new'
    and admin_notes is null
  );

select 'ok' as status;
