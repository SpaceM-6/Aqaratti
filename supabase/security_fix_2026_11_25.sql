-- ================================================================
-- إصلاحات فحص الأمان (25 نوفمبر 2026) — طُبّقت على قاعدة البيانات.
-- ================================================================
-- 1) حذف سياسة قديمة كانت تسمح بإدخال أي «طلب تواصل» بلا قيود (وتبقى السياسة المقيدة بالطول والحالة)
drop policy if exists "Anyone can submit a lead" on public.leads;
-- 2) تقييمات الوسطاء: لا يُقبل تقييم إلا بنجوم 1-5 واسم معقول وتعليق لا يتجاوز 1000 حرف
drop policy if exists "Anyone can submit a review" on public.broker_reviews;
create policy "Anyone can submit a review" on public.broker_reviews for insert to anon, authenticated
  with check (broker_id is not null and rating between 1 and 5
    and char_length(coalesce(reviewer_name, '')) between 2 and 80
    and char_length(coalesce(comment, '')) <= 1000);
-- 3) مخازن الصور: صور فقط، وبحد أقصى للحجم (لا ملفات تنفيذية ولا ملفات ضخمة)
update storage.buckets set file_size_limit = 15728640,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
  where id in ('ad-images','broker-images','car-images','property-images');
update storage.buckets set file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']
  where id in ('broker-logos','broker-office-logos','developer-logos','service-logos');
