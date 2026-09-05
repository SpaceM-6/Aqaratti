# -*- coding: utf-8 -*-
"""
ينقل بيانات الوسطاء العقاريين الأفراد من ملفات وسطاء_دبي_01..20.xlsx في
dld-brokers-scraper/dld_brokers_output/excel_files (مصدرها fetch_dld_api.py -
سحب مباشر من API الوسطاء الرسمي لـ DLD، وليس استخراج DOM) إلى جدول
individual_brokers في Supabase عبر REST API (PostgREST)، دفعات دفعات.

قبل التشغيل:
  1. شغّل supabase/individual_brokers.sql ثم supabase/individual_brokers_enrich.sql
     على مشروع Supabase الخاص بك (SQL Editor) لإنشاء/توسعة الجدول.
  2. تأكد أن .env بجذر هذا المشروع يحتوي SUPABASE_URL و
     SUPABASE_SERVICE_ROLE_KEY (وليس anon key - لأن RLS يمنع anon من الكتابة).
  3. صور الوسطاء وشعارات المكاتب تُرفع لاحقاً عبر
     scripts/upload-individual-broker-photos.py (سكربت منفصل).

التشغيل:
  python scripts/import-individual-brokers.py
"""
import glob
import json
import os
import sys
from datetime import datetime

import openpyxl
import requests

sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SOURCE_DIR = os.path.join(os.path.dirname(ROOT_DIR), "dld-brokers-scraper", "dld_brokers_output", "excel_files")
SOURCE_DIR = os.environ.get("DLD_EXCEL_DIR", DEFAULT_SOURCE_DIR)
BATCH_SIZE = 500

EXPECTED_HEADER = (
    "id", "رقم_الوسيط_DLD", "الاسم_العربي", "الاسم_الانجليزي", "اسم_المكتب",
    "اسم_المكتب_انجليزي", "رقم_المكتب", "تصنيف_المكتب", "تقييم_الوسيط",
    "رقم_الهاتف", "رقم_الجوال", "البريد_الالكتروني", "تاريخ_اصدار_الترخيص",
    "تاريخ_انتهاء_الترخيص", "الحالة", "رابط_صورة_الوسيط", "رابط_شعار_المكتب",
    "مسار_الصورة_المحلية", "مسار_شعار_المكتب_المحلي", "المصدر", "ملاحظات",
)

SUSPENDED_STATUSES = {"منتهي", "موقوف"}


def load_env_file(path):
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
            "يجب ضبط SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في ملف .env بجذر المشروع."
        )
    return supabase_url.rstrip("/"), service_key


def clean(value):
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def clean_date(value):
    """التواريخ القادمة من API الوسطاء بصيغة ISO datetime (2011-02-06T00:00:00)."""
    value = clean(value)
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "")).date().isoformat()
    except Exception:
        return None


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
        d = dict(zip(header, row))

        dld_number = clean(d.get("رقم_الوسيط_DLD"))
        if not dld_number:
            continue

        if clean(d.get("الحالة")) in SUSPENDED_STATUSES:
            continue

        brokers.append({
            "dld_broker_number": dld_number,
            "name_ar": clean(d.get("الاسم_العربي")),
            "name_en": clean(d.get("الاسم_الانجليزي")),
            "office_name": clean(d.get("اسم_المكتب")),
            "office_name_en": clean(d.get("اسم_المكتب_انجليزي")),
            "office_number": clean(d.get("رقم_المكتب")),
            "office_rank": clean(d.get("تصنيف_المكتب")),
            "card_rating": clean(d.get("تقييم_الوسيط")),
            "phone": clean(d.get("رقم_الهاتف")),
            "mobile": clean(d.get("رقم_الجوال")),
            "email": clean(d.get("البريد_الالكتروني")),
            "license_issue_date": clean_date(d.get("تاريخ_اصدار_الترخيص")),
            "license_expiry_date": clean_date(d.get("تاريخ_انتهاء_الترخيص")),
            "source": clean(d.get("المصدر")) or "dld_government_registry",
            "notes": clean(d.get("ملاحظات")),
            "is_active": False,
            "_local_image_path": clean(d.get("مسار_الصورة_المحلية")),
            "_local_office_logo_path": clean(d.get("مسار_شعار_المكتب_المحلي")),
        })
    wb.close()
    return brokers


def insert_batch(session, url, batch):
    payload = [{k: v for k, v in b.items() if not k.startswith("_")} for b in batch]
    resp = session.post(
        f"{url}/rest/v1/individual_brokers?on_conflict=dld_broker_number",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            # return=representation مع resolution=ignore-duplicates يرجع فقط
            # الصفوف المُدخلة فعلياً (وليس تلك التي تعارضت مع صف موجود) - يسمح
            # لنا بحساب "جديد" مقابل "متخطى" بدقة بدل تخمينها.
            "Prefer": "resolution=ignore-duplicates,return=representation",
        },
        timeout=60,
    )
    if resp.status_code >= 300:
        raise RuntimeError(f"فشل إدخال دفعة ({resp.status_code}): {resp.text[:500]}")
    return resp.json()


def main():
    supabase_url, service_key = get_config()

    if not os.path.isdir(SOURCE_DIR):
        raise SystemExit(f"مجلد المصدر غير موجود: {SOURCE_DIR}\nحدد DLD_EXCEL_DIR إن كان في مكان مختلف.")

    files = sorted(glob.glob(os.path.join(SOURCE_DIR, "وسطاء_دبي_*.xlsx")))
    if not files:
        raise SystemExit(f"لا توجد ملفات مطابقة في {SOURCE_DIR}")

    all_brokers = []
    for path in files:
        brokers = load_file(path)
        print(f"{os.path.basename(path)}: {len(brokers)} سجل صالح")
        all_brokers.extend(brokers)

    total = len(all_brokers)
    print(f"الإجمالي المقروء من Excel: {total} سجل صالح")

    session = requests.Session()
    session.headers.update({
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
    })

    new_count = 0
    error_count = 0
    error_log_path = os.path.join(ROOT_DIR, "individual_brokers_import_errors.log")
    with open(error_log_path, "w", encoding="utf-8") as err_log:
        for i in range(0, total, BATCH_SIZE):
            batch = all_brokers[i:i + BATCH_SIZE]
            try:
                inserted_rows = insert_batch(session, supabase_url, batch)
                new_count += len(inserted_rows)
            except Exception as e:
                error_count += len(batch)
                err_log.write(f"دفعة {i}-{i + len(batch)}: {e}\n")
                print(f"⚠️ فشلت دفعة {i}-{i + len(batch)}: {e}")
            print(f"تمت معالجة {min(i + BATCH_SIZE, total)} / {total}")

    skipped_duplicate = total - new_count - error_count

    print("\n" + "=" * 50)
    print(f"✅ وسطاء جدد تم إدخالهم: {new_count}")
    print(f"⏭️ متخطون (موجودون مسبقاً برقم وسيط مطابق): {skipped_duplicate}")
    print(f"❌ أخطاء إدخال: {error_count}")
    if error_count:
        print(f"تفاصيل الأخطاء في: {error_log_path}")
    print("=" * 50)


if __name__ == "__main__":
    main()
