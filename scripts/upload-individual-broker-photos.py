# -*- coding: utf-8 -*-
"""
يرفع صور الوسطاء الأفراد (من dld-brokers-scraper/dld_brokers_output/images/)
إلى Supabase Storage (bucket: broker-images)، ثم يحدّث عمود photo_url في جدول
individual_brokers بمطابقة رقم الوسيط (dld_broker_number). يُشغَّل بعد
scripts/import-individual-brokers.py الذي يُدخل الصفوف بدون صور أولاً.

إذا تعذر رفع صورة وسيط (ملف غير موجود محلياً أو فشل الرفع)، يبقى photo_url
NULL بدلاً من رابط مكسور - الواجهة (brokers-directory.html) تعرض صورة بديلة
افتراضية تلقائياً في هذه الحالة (نفس أسلوب logo_url في جدول brokers).

قبل التشغيل: .env يجب أن يحتوي SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY.

التشغيل:
  python scripts/upload-individual-broker-photos.py
"""
import concurrent.futures
import glob
import os
import sys
import threading

import openpyxl
import requests

sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DLD_SCRAPER_ROOT = os.path.join(os.path.dirname(ROOT_DIR), "dld-brokers-scraper")
DEFAULT_SOURCE_DIR = os.path.join(DLD_SCRAPER_ROOT, "dld_brokers_output", "excel_files")
SOURCE_DIR = os.environ.get("DLD_EXCEL_DIR", DEFAULT_SOURCE_DIR)
BUCKET = "broker-images"
MAX_WORKERS = 8

EXPECTED_HEADER = (
    "id", "رقم_الوسيط_DLD", "الاسم_العربي", "اسم_المكتب", "رقم_الهاتف",
    "البريد_الالكتروني", "الحالة", "رابط_الصورة", "مسار_الصورة_المحلية",
    "المصدر", "ملاحظات",
)

print_lock = threading.Lock()


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
    supabase_url = (os.environ.get("SUPABASE_URL") or env.get("SUPABASE_URL", "")).rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key:
        raise SystemExit("يجب ضبط SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في ملف .env بجذر المشروع.")
    return supabase_url, service_key


def ensure_bucket(session, url):
    resp = session.post(f"{url}/storage/v1/bucket", json={"id": BUCKET, "name": BUCKET, "public": True})
    if resp.status_code in (200, 201):
        print(f"تم إنشاء bucket '{BUCKET}'.")
    elif resp.status_code == 400 and "already exists" in resp.text.lower():
        print(f"bucket '{BUCKET}' موجود بالفعل.")
    else:
        print(f"ملاحظة عند إنشاء bucket: {resp.status_code} {resp.text[:200]}")


def resolve_local_path(raw_path):
    """المسار المحفوظ بالـ Excel نسبي لمجلد dld-brokers-scraper وبفواصل \\ ويندوز."""
    if not raw_path:
        return None
    normalized = raw_path.replace("\\", os.sep).replace("/", os.sep)
    if os.path.isabs(normalized) and os.path.exists(normalized):
        return normalized
    candidate = os.path.join(DLD_SCRAPER_ROOT, normalized)
    return candidate


def collect_jobs():
    files = sorted(glob.glob(os.path.join(SOURCE_DIR, "وسطاء_دبي_*.xlsx")))
    if not files:
        raise SystemExit(f"لا توجد ملفات مطابقة في {SOURCE_DIR}")

    jobs = []
    for path in files:
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        ws = wb.active
        rows = ws.iter_rows(values_only=True)
        header = next(rows)
        if header != EXPECTED_HEADER:
            wb.close()
            raise ValueError(f"{path}: unexpected header {header}")
        for row in rows:
            if row is None or all(v is None for v in row):
                continue
            dld_number = row[1]
            local_path_raw = row[8]
            if not dld_number or not local_path_raw:
                continue
            local_path = resolve_local_path(str(local_path_raw))
            if local_path:
                jobs.append((str(dld_number).strip(), local_path))
        wb.close()
    return jobs


def upload_photo(session, url, dld_number, filepath):
    ext = os.path.splitext(filepath)[1].lstrip(".").lower() or "jpg"
    content_type = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
    storage_filename = f"{dld_number}.{ext}"
    with open(filepath, "rb") as f:
        data = f.read()
    resp = session.post(
        f"{url}/storage/v1/object/{BUCKET}/{storage_filename}",
        data=data,
        headers={"Content-Type": content_type, "x-upsert": "true"},
        timeout=30,
    )
    if resp.status_code >= 300:
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:200]}")
    return f"{url}/storage/v1/object/public/{BUCKET}/{storage_filename}"


def update_broker_photo(session, url, dld_number, photo_url):
    resp = session.patch(
        f"{url}/rest/v1/individual_brokers?dld_broker_number=eq.{dld_number}",
        json={"photo_url": photo_url},
        headers={"Content-Type": "application/json", "Prefer": "return=representation"},
        timeout=30,
    )
    if resp.status_code >= 300:
        return "error", resp.text[:200]
    rows = resp.json()
    return ("matched" if rows else "not_found"), None


def process_job(session, supabase_url, dld_number, filepath):
    if not os.path.exists(filepath):
        return "missing_file", dld_number

    try:
        photo_url = upload_photo(session, supabase_url, dld_number, filepath)
    except Exception as e:
        return "upload_error", f"{dld_number}: {e}"

    status, detail = update_broker_photo(session, supabase_url, dld_number, photo_url)
    if status == "not_found":
        return "not_found", dld_number
    if status == "error":
        return "update_error", f"{dld_number}: {detail}"
    return "matched", None


def main():
    supabase_url, service_key = get_config()

    session = requests.Session()
    session.headers.update({"apikey": service_key, "Authorization": f"Bearer {service_key}"})

    ensure_bucket(session, supabase_url)

    jobs = collect_jobs()
    print(f"عدد الصور المرشحة للرفع: {len(jobs)}")

    counters = {"matched": 0, "not_found": 0, "missing_file": 0, "upload_error": 0, "update_error": 0}
    done = 0

    def run(job):
        dld_number, filepath = job
        return process_job(session, supabase_url, dld_number, filepath)

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        for status, detail in executor.map(run, jobs):
            with print_lock:
                counters[status] = counters.get(status, 0) + 1
                done += 1
                if detail and status not in ("matched",):
                    print(f"  [{status}] {detail}")
                if done % 200 == 0:
                    print(f"تقدّم: {done} / {len(jobs)}")

    print("---")
    print(f"تم الرفع والتحديث: {counters.get('matched', 0)}")
    print(f"رقم وسيط غير موجود في جدول individual_brokers: {counters.get('not_found', 0)}")
    print(f"ملف الصورة غير موجود محلياً: {counters.get('missing_file', 0)}")
    print(f"أخطاء رفع: {counters.get('upload_error', 0)}")
    print(f"أخطاء تحديث: {counters.get('update_error', 0)}")


if __name__ == "__main__":
    main()
