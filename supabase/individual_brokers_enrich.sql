-- ============================================================================
-- يوسّع individual_brokers بالحقول الغنية المتوفرة فعلياً عبر API الوسطاء
-- الرسمي لـ DLD (gateway.dubailand.gov.ae/brokers) والتي لم تكن متاحة أصلاً
-- بالاستخراج القديم من DOM الصفحة (اسم إنجليزي حقيقي، تواريخ ترخيص، تقييم،
-- شعار المكتب...). عمود واحد جديد فقط قد يحتاج تعديل بيانات قديمة: أي صف من
-- الدفعة الأولى (557 وسيط) يبقى بدون قيمة بهذي الأعمدة الجديدة (NULL)، وهذا
-- مقبول - نفس السجلات موجودة أيضاً بالدفعة الجديدة الكاملة برقم وسيط مطابق
-- فتتجاهلها resolution=ignore-duplicates عند الاستيراد، فتبقى بياناتها القديمة
-- الأقل تفصيلاً. يمكن حذف تلك الـ557 صف يدوياً لاحقاً لو رغبت باستبدالها.
-- ============================================================================

alter table public.individual_brokers add column if not exists name_en text;
alter table public.individual_brokers add column if not exists mobile text;
alter table public.individual_brokers add column if not exists license_issue_date date;
alter table public.individual_brokers add column if not exists license_expiry_date date;
alter table public.individual_brokers add column if not exists office_name_en text;
alter table public.individual_brokers add column if not exists office_number text;
alter table public.individual_brokers add column if not exists office_rank text;
alter table public.individual_brokers add column if not exists card_rating text;
alter table public.individual_brokers add column if not exists office_logo_url text;
