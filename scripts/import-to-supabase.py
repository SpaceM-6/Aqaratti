"""
ينقل بيانات الوسطاء (10,062 سجل) من ملفات dubai_offices_part_01..10.xlsx في
dubai_brokers_output/ إلى جدول brokers في Supabase، عبر REST API (PostgREST)
دفعات دفعات (batches).

قبل التشغيل:
  1. شغّل supabase/schema.sql على مشروع Supabase الخاص بك (SQL Editor) لإنشاء الجدول.
  2. انسخ .env.example إلى .env بجذر المشروع واملأ SUPABASE_URL و
     SUPABASE_SERVICE_ROLE_KEY (وليس anon key - لأن RLS يمنع anon من الكتابة).

التشغيل:
  python scripts/import-to-supabase.py
"""
import glob
import json
import os
import sys

import openpyxl
import requests

sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DIR = os.path.join(ROOT_DIR, "dubai_brokers_output")
BATCH_SIZE = 500

EXPECTED_HEADER = (
    "#", "اللوجو", "اسم المكتب (عربي)", "اسم المكتب (إنجليزي)", "الترخيص",
    "التصنيف", "الهاتف", "البريد الإلكتروني", "الموقع الإلكتروني",
    "اسم المسؤول", "الأنشطة",
)


def load_env_file(path):
    """قارئ .env بسيط (KEY=VALUE) بدون الحاجة لمكتبة خارجية."""
    env = {}
    if not os.path.exists(path):
        return env
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def get_config():
    env = load_env_file(os.path.join(ROOT_DIR, ".env"))
    supabase_url = os.environ.get("SUPABASE_URL") or env.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_key:
        raise SystemExit(
            "يجب ضبط SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في ملف .env بجذر المشروع "
            "(انسخ .env.example إلى .env واملأه). لاحظ أن هذا السكربت يحتاج مفتاح "
            "service_role تحديداً لأنه يكتب في الجدول، بينما anon key مقيّد بالقراءة فقط عبر RLS."
        )
    return supabase_url.rstrip("/"), service_key


def clean(value):
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def load_file(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = next(rows)
    if header != EXPECTED_HEADER:
        raise ValueError(f"{path}: unexpected header {header}")

    brokers = []
    for row in rows:
        if row is None or all(v is None for v in row):
            continue
        (_, _logo, name_ar, name_en, license_no, classification, phone, email,
         website, manager, activities) = row[:11]

        activities_text = clean(activities) or ""
        activities_list = [a.strip() for a in activities_text.split(",") if a.strip()]

        brokers.append({
            "name_ar": clean(name_ar),
            "name_en": clean(name_en),
            "license": clean(license_no),
            "classification": (clean(classification) or "GENERAL").upper(),
            "phone": clean(phone),
            "email": clean(email),
            "website": clean(website),
            "manager": clean(manager),
            "activities": activities_list,
            # الوسطاء المستوردون من RERA يبقون غير مفعلين حتى تُفعَّل بياناتهم يدوياً
            # (بعد موافقتهم) من www/admin/brokers.html.
            "is_active": False,
        })
    wb.close()
    return brokers


def insert_batch(session, url, batch):
    # on_conflict=license + resolution=ignore-duplicates يجعل إعادة تشغيل السكربت
    # آمنة (لا يُدخل نفس رقم الترخيص مرتين)، دون الحاجة لتحديث السجلات الموجودة.
    resp = session.post(
        f"{url}/rest/v1/brokers?on_conflict=license",
        data=json.dumps(batch, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Prefer": "resolution=ignore-duplicates,return=minimal",
        },
        timeout=60,
    )
    if resp.status_code >= 300:
        raise RuntimeError(f"فشل إدخال دفعة ({resp.status_code}): {resp.text[:500]}")


def count_rows(session, url, is_active):
    resp = session.head(
        f"{url}/rest/v1/brokers?select=id&is_active=eq.{'true' if is_active else 'false'}",
        headers={"Prefer": "count=exact"},
        timeout=30,
    )
    content_range = resp.headers.get("Content-Range", "")
    if "/" in content_range:
        return int(content_range.split("/")[-1])
    return 0


def main():
    supabase_url, service_key = get_config()

    files = sorted(glob.glob(os.path.join(SOURCE_DIR, "dubai_offices_part_*.xlsx")))
    if not files:
        raise SystemExit(f"لا توجد ملفات مطابقة في {SOURCE_DIR}")

    all_brokers = []
    for path in files:
        brokers = load_file(path)
        print(f"{os.path.basename(path)}: {len(brokers)} سجل")
        all_brokers.extend(brokers)

    total = len(all_brokers)
    print(f"الإجمالي المقروء من Excel: {total} سجل")

    session = requests.Session()
    session.headers.update({
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
    })

    for i in range(0, total, BATCH_SIZE):
        batch = all_brokers[i:i + BATCH_SIZE]
        insert_batch(session, supabase_url, batch)
        print(f"تم رفع {min(i + BATCH_SIZE, total)} / {total}")

    active_count = count_rows(session, supabase_url, True)
    inactive_count = count_rows(session, supabase_url, False)
    print(f"مفعل: {active_count} | غير مفعل: {inactive_count}")

    print("اكتمل نقل بيانات الوسطاء إلى Supabase بنجاح.")


if __name__ == "__main__":
    main()
