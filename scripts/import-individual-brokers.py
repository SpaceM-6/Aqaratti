# -*- coding: utf-8 -*-
"""
ينقل بيانات الوسطاء العقاريين الأفراد (وليس المكاتب) من ملفات
وسطاء_دبي_01..20.xlsx في dld-brokers-scraper/dld_brokers_output/excel_files
إلى جدول individual_brokers في Supabase عبر REST API (PostgREST)، دفعات دفعات.

قبل التشغيل:
  1. شغّل supabase/individual_brokers.sql على مشروع Supabase الخاص بك (SQL
     Editor) لإنشاء الجدول.
  2. تأكد أن .env بجذر هذا المشروع يحتوي SUPABASE_URL و
     SUPABASE_SERVICE_ROLE_KEY (وليس anon key - لأن RLS يمنع anon من الكتابة).
  3. صور الوسطاء تُرفع لاحقاً عبر scripts/upload-individual-broker-photos.py
     (سكربت منفصل) - هذا السكربت يُدخل الصفوف بدون photo_url أولاً.

التشغيل:
  python scripts/import-individual-brokers.py
"""
import glob
import json
import os
import sys

import openpyxl
import requests

sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# dld-brokers-scraper هو مجلد شقيق منفصل عن مستودع aqarx، وليس جزءاً منه.
DEFAULT_SOURCE_DIR = os.path.join(os.path.dirname(ROOT_DIR), "dld-brokers-scraper", "dld_brokers_output", "excel_files")
SOURCE_DIR = os.environ.get("DLD_EXCEL_DIR", DEFAULT_SOURCE_DIR)
BATCH_SIZE = 500

EXPECTED_HEADER = (
    "id", "رقم_الوسيط_DLD", "الاسم_العربي", "اسم_المكتب", "رقم_الهاتف",
    "البريد_الالكتروني", "الحالة", "رابط_الصورة", "مسار_الصورة_المحلية",
    "المصدر", "ملاحظات",
)

# الوسطاء الموقوفون/منتهيو الترخيص لا يُرفعون - راجع ملاحظة في main() فالحقل
# "الحالة" في هذه النسخة من السكربت لا يعكس فعلياً حالة الترخيص من DLD (الموقع
# لا يعرضها في القائمة)، لكن نُبقي هذا الفلتر لأي بيانات مستقبلية قد تتضمنه.
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


def load_file(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = next(rows)
    if header != EXPECTED_HEADER:
        raise ValueError(f"{path}: unexpected header {header}")

    brokers = []
    skipped_suspended = 0
    skipped_no_number = 0
    for row in rows:
        if row is None or all(v is None for v in row):
            continue
        (_, dld_number, name_ar, office_name, phone, email, status,
         photo_url, local_image_path, source, notes) = row[:11]

        dld_number = clean(dld_number)
        if not dld_number:
            skipped_no_number += 1
            continue

        if clean(status) in SUSPENDED_STATUSES:
            skipped_suspended += 1
            continue

        brokers.append({
            "dld_broker_number": dld_number,
            "name_ar": clean(name_ar),
            "office_name": clean(office_name),
            "phone": clean(phone),
            "email": clean(email),
            "source": clean(source) or "dld_government_registry",
            "notes": clean(notes),
            "is_active": False,
            "_local_image_path": clean(local_image_path),  # لا يُرسل لـ Supabase، يُستخدم فقط لسكربت الصور
        })
    wb.close()
    return brokers, skipped_suspended, skipped_no_number


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
    total_suspended = 0
    total_no_number = 0
    for path in files:
        brokers, skipped_suspended, skipped_no_number = load_file(path)
        total_suspended += skipped_suspended
        total_no_number += skipped_no_number
        print(f"{os.path.basename(path)}: {len(brokers)} سجل صالح")
        all_brokers.extend(brokers)

    total = len(all_brokers)
    print(f"الإجمالي المقروء من Excel: {total} سجل صالح (متخطى موقوف: {total_suspended}, بلا رقم وسيط: {total_no_number})")

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
    print(f"🚫 متخطون (موقوف/منتهي الترخيص): {total_suspended}")
    print(f"🚫 متخطون (بلا رقم وسيط): {total_no_number}")
    if error_count:
        print(f"تفاصيل الأخطاء في: {error_log_path}")
    print("=" * 50)


if __name__ == "__main__":
    main()
