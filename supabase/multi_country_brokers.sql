-- ============================================================================
-- يوسّع كلا جدولي الوسطاء (brokers و directory_brokers) لدعم عدة دول بدل
-- الإمارات فقط، ويفتح تسجيلاً ذاتياً آمناً في directory_brokers (بوابة
-- الوسطاء) - كان قبل هذا التعديل محصوراً على الأدمن فقط بالكامل (0 صف بالفعل).
-- ============================================================================

-- عمود الدولة على جدول brokers (10,053 وسيط RERA الحاليون كلهم إماراتيون)
alter table public.brokers add column if not exists country text not null default 'uae';
update public.brokers set country = 'uae' where country is null;
create index if not exists brokers_country_idx on public.brokers (country);

-- عمود الدولة على جدول directory_brokers (السجلات القديمة إن وُجدت تُعتبر إماراتية)
alter table public.directory_brokers add column if not exists country text not null default 'uae';
update public.directory_brokers set country = 'uae' where country is null;
create index if not exists directory_brokers_country_idx on public.directory_brokers (country);

-- منع تكرار نفس رقم الترخيص داخل نفس الدولة (يسمح بتكراره بين دول مختلفة،
-- فأرقام التراخيص لها هيئات مختلفة لكل دولة)
create unique index if not exists directory_brokers_country_license_idx
  on public.directory_brokers (country, license)
  where license is not null;

-- ============================================================================
-- بوابة تسجيل ذاتي للوسطاء: أي مستخدم مسجّل دخوله يقدر يرسل طلب انضمام (يبقى
-- is_active = false إجبارياً حتى يراجعه الأدمن يدوياً ويُفعّله - نفس فلسفة
-- الموافقة اليدوية الأصلية، فقط الإدخال نفسه أصبح ذاتياً بدل الأدمن فقط)
-- ============================================================================

drop policy if exists "Authenticated users can submit a pending broker application" on public.directory_brokers;
create policy "Authenticated users can submit a pending broker application"
  on public.directory_brokers
  for insert
  to public
  with check (auth.uid() is not null and is_active = false);
