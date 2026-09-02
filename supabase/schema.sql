-- ============================================================================
-- جدول brokers: يستضيف بيانات 10,062 مكتب عقاري في دبي (منقولة من ملفات Excel
-- عبر scripts/import-to-supabase.py). القراءة عامة للجميع؛ الإدخال محصور على
-- service_role فقط (يتجاوز RLS)؛ تفعيل/إلغاء تفعيل الوسيط متاح لأي مستخدم مسجّل
-- دخوله عبر صفحة www/admin/brokers.html (التحكم بمن يملك هذه الصلاحية يتم لاحقاً
-- من Supabase Dashboard، وليس عبر RLS إضافية الآن).
-- ============================================================================

create table if not exists public.brokers (
  id             bigint generated always as identity primary key,
  name_ar        text,
  name_en        text,
  license        text unique,
  classification text not null default 'GENERAL'
                   check (classification in ('GOLD', 'SILVER', 'BRONZE', 'GENERAL')),
  phone          text,
  email          text,
  website        text,
  manager        text,
  activities     text[] not null default '{}',
  -- بيانات هذا الوسيط مأخوذة من السجل العام لدى دائرة الأراضي والأملاك (RERA)، لكنها
  -- تبقى مخفية عن أزرار التواصل في الدليل حتى تُفعَّل يدوياً (بعد موافقة الوسيط).
  is_active      boolean not null default false,
  activated_at   timestamptz default null,
  created_at     timestamptz not null default now()
);

-- عمود بحث نصي كامل (Full Text Search) يجمع اسم المكتب (عربي/إنجليزي) واسم المسؤول
alter table public.brokers add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(name_ar, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(name_en, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(manager, '')), 'B')
  ) stored;

create index if not exists brokers_search_idx on public.brokers using gin (search_vector);
create index if not exists brokers_classification_idx on public.brokers (classification);
create index if not exists brokers_is_active_idx on public.brokers (is_active);

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.brokers enable row level security;

-- القراءة: عامة بالكامل للجميع (بيانات RERA علنية أصلاً)
drop policy if exists "Public brokers are viewable by everyone" on public.brokers;
create policy "Public brokers are viewable by everyone"
  on public.brokers
  for select
  using (true);

-- التعديل (تفعيل/إلغاء تفعيل): لأي مستخدم مسجّل دخوله فقط (auth.uid() ليس NULL).
-- تقييد ذلك لأدمن فعلي فقط قرار يُضبط لاحقاً من Supabase Dashboard (مثال:
-- تقييد السياسة بشرط إضافي على دور المستخدم في profiles) - ليس ضمن هذا الملف الآن.
drop policy if exists "Authenticated users can update brokers" on public.brokers;
create policy "Authenticated users can update brokers"
  on public.brokers
  for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- لا توجد سياسة insert أو delete عمداً: فقط service_role (يتجاوز RLS تلقائياً)
-- يستطيع إدخال أو حذف صفوف - يُستخدم حصرياً من scripts/import-to-supabase.py،
-- ولا يجب أبداً استخدامه في كود يعمل داخل المتصفح.
