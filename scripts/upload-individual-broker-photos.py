# -*- coding: utf-8 -*-
"""
يرفع صور الوسطاء الأفراد وشعارات مكاتبهم (من dld-brokers-scraper/
dld_brokers_output/images و office_logos) إلى Supabase Storage (buckets:
broker-images و broker-office-logos)، ثم يحدّث photo_url و office_logo_url
في جدول individual_brokers. يُشغَّل بعد scripts/import-individual-brokers.py.

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
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DLD_SCRAPER_ROOT = os.path.join(os.path.dirname(ROOT_DIR), "dld-brokers-scraper")
DEFAULT_SOURCE_DIR = os.path.join(DLD_SCRAPER_ROOT, "dld_brokers_output", "excel_files")
SOURCE_DIR = os.environ.get("DLD_EXCEL_DIR", DEFAULT_SOURCE_DIR)
PHOTO_BUCKET = "broker-images"
LOGO_BUCKET = "broker-office-logos"
MAX_WORKERS = 12

EXPECTED_HEADER = (
    "id", "رقم_الوسيط_DLD", "الاسم_العربي", "الاسم_الانجليزي", "اسم_المكتب",
    "اسم_المكتب_انجليزي", "رقم_المكتب", "تصنيف_المكتب", "تقييم_الوسيط",
    "رقم_الهاتف", "رقم_الجوال", "البريد_الالكتروني", "تاريخ_اصدار_الترخيص",
    "تاريخ_انتهاء_الترخيص", "الحالة", "رابط_صورة_الوسيط", "رابط_شعار_المكتب",
    "مسار_الصورة_المحلية", "مسار_شعار_المكتب_المحلي", "المصدر", "ملاحظات",
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


def ensure_bucket(session, url, bucket):
    resp = session.post(f"{url}/storage/v1/bucket", json={"id": bucket, "name": bucket, "public": True})
    if resp.status_code in (200, 201):
        print(f"تم إنشاء bucket '{bucket}'.")
    elif resp.status_code == 400 and "already exists" in resp.text.lower():
        print(f"bucket '{bucket}' موجود بالفعل.")
    else:
        print(f"ملاحظة عند إنشاء bucket '{bucket}': {resp.status_code} {resp.text[:200]}")


def resolve_local_path(raw_path):
    """المسار المحفوظ بالـ Excel نسبي لمجلد dld-brokers-scraper وبفواصل \\ ويندوز."""
    if not raw_path:
        return None
    normalized = raw_path.replace("\\", os.sep).replace("/", os.sep)
    if os.path.isabs(normalized) and os.path.exists(normalized):
        return normalized
    return os.path.join(DLD_SCRAPER_ROOT, normalized)


def collect_jobs():
    files = sorted(glob.glob(os.path.join(SOURCE_DIR, "وسطاء_دبي_*.xlsx")))
    if not files:
        raise SystemExit(f"لا توجد ملفات مطابقة في {SOURCE_DIR}")

    photo_jobs = []
    logo_jobs = {}  # office_number -> local_path (توحيد نفس المكتب عبر كل الوسطاء)
    broker_office = []  # (dld_number, office_number) للربط لاحقاً

    for path in files:
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        ws = wb.active
        rows = ws.iter_rows(values_only=True)
        header = next(rows)
        if header != EXPECTED_HEADER:
            wb.close()
            raise ValueError(f"{path}: unexpected header {header}")
        idx = {name: i for i, name in enumerate(header)}

        for row in rows:
            if row is None or all(v is None for v in row):
                continue
            dld_number = row[idx["رقم_الوسيط_DLD"]]
            if not dld_number:
                continue
            dld_number = str(dld_number).strip()

            photo_path_raw = row[idx["مسار_الصورة_المحلية"]]
            if photo_path_raw:
                local_path = resolve_local_path(str(photo_path_raw))
                if local_path:
                    photo_jobs.append((dld_number, local_path))

            office_number = row[idx["رقم_المكتب"]]
            logo_path_raw = row[idx["مسار_شعار_المكتب_المحلي"]]
            if office_number and logo_path_raw:
                office_number = str(office_number).strip()
                if office_number not in logo_jobs:
                    local_path = resolve_local_path(str(logo_path_raw))
                    if local_path:
                        logo_jobs[office_number] = local_path
                broker_office.append((dld_number, office_number))
        wb.close()
    return photo_jobs, logo_jobs, broker_office


def upload_file(session, url, bucket, storage_filename, filepath):
    ext = os.path.splitext(filepath)[1].lstrip(".").lower() or "jpg"
    content_type = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
    with open(filepath, "rb") as f:
        data = f.read()
    resp = session.post(
        f"{url}/storage/v1/object/{bucket}/{storage_filename}",
        data=data,
        headers={"Content-Type": content_type, "x-upsert": "true"},
        timeout=30,
    )
    if resp.status_code >= 300:
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:200]}")
    return f"{url}/storage/v1/object/public/{bucket}/{storage_filename}"


def process_photo_job(session, supabase_url, dld_number, filepath):
    if not os.path.exists(filepath):
        return "missing_file", dld_number
    try:
        ext = os.path.splitext(filepath)[1].lstrip(".").lower() or "jpg"
        photo_url = upload_file(session, supabase_url, PHOTO_BUCKET, f"{dld_number}.{ext}", filepath)
    except Exception as e:
        return "upload_error", f"{dld_number}: {e}"

    try:
        resp = session.patch(
            f"{supabase_url}/rest/v1/individual_brokers?dld_broker_number=eq.{dld_number}",
            json={"photo_url": photo_url},
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
    except Exception as e:
        return "update_error", f"{dld_number}: {e}"
    if resp.status_code >= 300:
        return "update_error", f"{dld_number}: {resp.status_code}"
    return "matched", None


def process_logo_job(session, supabase_url, office_number, filepath):
    if not os.path.exists(filepath):
        return "missing_file", office_number
    try:
        ext = os.path.splitext(filepath)[1].lstrip(".").lower() or "png"
        logo_url = upload_file(session, supabase_url, LOGO_BUCKET, f"{office_number}.{ext}", filepath)
    except Exception as e:
        return "upload_error", f"{office_number}: {e}"

    try:
        resp = session.patch(
            f"{supabase_url}/rest/v1/individual_brokers?office_number=eq.{office_number}",
            json={"office_logo_url": logo_url},
            headers={"Content-Type": "application/json", "Prefer": "return=representation"},
            timeout=30,
        )
    except Exception as e:
        return "update_error", f"{office_number}: {e}"
    if resp.status_code >= 300:
        return "update_error", f"{office_number}: {resp.status_code}"
    rows = resp.json()
    return ("matched" if rows else "not_found"), None


def run_batch(session, supabase_url, jobs, process_fn, label):
    counters = {}
    done = [0]

    def run(job):
        return process_fn(session, supabase_url, *job)

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        for status, detail in executor.map(run, jobs):
            with print_lock:
                counters[status] = counters.get(status, 0) + 1
                done[0] += 1
                if detail and status not in ("matched",):
                    print(f"  [{label}:{status}] {detail}")
                if done[0] % 500 == 0:
                    print(f"تقدّم {label}: {done[0]} / {len(jobs)}")

    print(f"--- {label} ---")
    for k, v in counters.items():
        print(f"{k}: {v}")
    return counters


def main():
    supabase_url, service_key = get_config()

    session = requests.Session()
    session.headers.update({"apikey": service_key, "Authorization": f"Bearer {service_key}"})
    # إعادة محاولة تلقائية على انقطاعات الشبكة العابرة (مثل فشل DNS مؤقت) بدل
    # ما يوقف دفعة كاملة من 30 ألف طلب بسبب طلب واحد فاشل عرضياً.
    retry = Retry(total=3, backoff_factor=1, status_forcelist=[502, 503, 504])
    adapter = HTTPAdapter(max_retries=retry, pool_maxsize=MAX_WORKERS * 2)
    session.mount("https://", adapter)
    session.mount("http://", adapter)

    ensure_bucket(session, supabase_url, PHOTO_BUCKET)
    ensure_bucket(session, supabase_url, LOGO_BUCKET)

    photo_jobs, logo_jobs_dict, _broker_office = collect_jobs()
    logo_jobs = list(logo_jobs_dict.items())
    print(f"عدد صور الوسطاء المرشحة: {len(photo_jobs)}")
    print(f"عدد شعارات المكاتب الفريدة المرشحة: {len(logo_jobs)}")

    run_batch(session, supabase_url, photo_jobs, process_photo_job, "صور الوسطاء")
    run_batch(session, supabase_url, logo_jobs, process_logo_job, "شعارات المكاتب")


if __name__ == "__main__":
    main()
    # خيوط شبكة عالقة نادرة قد تُبقي المفسّر منتظراً عند الخروج - كل التحديثات
    # المهمة على Supabase تمت بالفعل قبل هذه النقطة.
    os._exit(0)
