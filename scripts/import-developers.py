# -*- coding: utf-8 -*-
"""
ينقل بيانات المطورين العقاريين المعتمدين من dld-brokers-scraper/dld_developers_output
إلى جدول developers في Supabase، ثم يرفع شعاراتهم إلى Storage (bucket:
developer-logos) ويحدّث logo_url - كل ذلك بخطوة واحدة (على عكس الوسطاء
الأفراد، العدد هنا صغير بما يكفي - 2,379 - لعمله دفعة واحدة بدون تقسيم لسكربتين).

قبل التشغيل: شغّل supabase/developers.sql، وتأكد من .env (SUPABASE_URL,
SUPABASE_SERVICE_ROLE_KEY).

التشغيل:
  python scripts/import-developers.py
"""
import concurrent.futures
import json
import os
import sys
import threading

import openpyxl
import requests

sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_FILE = os.path.join(os.path.dirname(ROOT_DIR), "dld-brokers-scraper", "dld_developers_output", "المطورين_العقاريين.xlsx")
BUCKET = "developer-logos"
MAX_WORKERS = 12

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


def clean(v):
    if v is None:
        return None
    v = str(v).strip()
    return v or None


def load_developers():
    wb = openpyxl.load_workbook(SOURCE_FILE, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = next(rows)
    idx = {name: i for i, name in enumerate(header)}

    developers = []
    for row in rows:
        if row is None or all(v is None for v in row):
            continue
        num = clean(row[idx["رقم_المطور_DLD"]])
        if not num:
            continue
        developers.append({
            "dld_developer_number": num,
            "name_ar": clean(row[idx["الاسم_العربي"]]),
            "name_en": clean(row[idx["الاسم_الانجليزي"]]),
            "phone": clean(row[idx["رقم_الهاتف"]]),
            "mobile": clean(row[idx["رقم_الجوال"]]),
            "email": clean(row[idx["البريد_الالكتروني"]]),
            "rating": clean(row[idx["التقييم"]]),
            "is_active": False,
            "_local_logo_path": clean(row[idx["مسار_الشعار_المحلي"]]),
        })
    wb.close()
    return developers


def insert_batch(session, url, batch):
    payload = [{k: v for k, v in d.items() if not k.startswith("_")} for d in batch]
    resp = session.post(
        f"{url}/rest/v1/developers?on_conflict=dld_developer_number",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "Prefer": "resolution=ignore-duplicates,return=representation"},
        timeout=60,
    )
    if resp.status_code >= 300:
        raise RuntimeError(f"فشل إدخال دفعة ({resp.status_code}): {resp.text[:500]}")
    return resp.json()


def ensure_bucket(session, url):
    resp = session.post(f"{url}/storage/v1/bucket", json={"id": BUCKET, "name": BUCKET, "public": True})
    if resp.status_code in (200, 201):
        print(f"تم إنشاء bucket '{BUCKET}'.")
    elif resp.status_code == 400 and "already exists" in resp.text.lower():
        print(f"bucket '{BUCKET}' موجود بالفعل.")
    else:
        print(f"ملاحظة عند إنشاء bucket: {resp.status_code} {resp.text[:200]}")


def upload_logo_and_update(session, url, dev):
    num = dev["dld_developer_number"]
    local_path = dev["_local_logo_path"]
    if not local_path or not os.path.exists(local_path):
        return "no_logo"

    ext = os.path.splitext(local_path)[1].lstrip(".").lower() or "png"
    content_type = f"image/{'jpeg' if ext == 'jpg' else ext}"
    storage_filename = f"{num}.{ext}"
    try:
        with open(local_path, "rb") as f:
            data = f.read()
        resp = session.post(
            f"{url}/storage/v1/object/{BUCKET}/{storage_filename}",
            data=data,
            headers={"Content-Type": content_type, "x-upsert": "true"},
            timeout=30,
        )
        if resp.status_code >= 300:
            return f"upload_error: {resp.status_code}"
        logo_url = f"{url}/storage/v1/object/public/{BUCKET}/{storage_filename}"
    except Exception as e:
        return f"upload_error: {e}"

    patch_resp = session.patch(
        f"{url}/rest/v1/developers?dld_developer_number=eq.{num}",
        json={"logo_url": logo_url},
        headers={"Content-Type": "application/json"},
        timeout=30,
    )
    if patch_resp.status_code >= 300:
        return f"update_error: {patch_resp.status_code}"
    return "ok"


def main():
    supabase_url, service_key = get_config()
    developers = load_developers()
    print(f"عدد المطورين المقروء من Excel: {len(developers)}")

    session = requests.Session()
    session.headers.update({"apikey": service_key, "Authorization": f"Bearer {service_key}"})

    BATCH_SIZE = 500
    new_count = 0
    for i in range(0, len(developers), BATCH_SIZE):
        batch = developers[i:i + BATCH_SIZE]
        inserted = insert_batch(session, supabase_url, batch)
        new_count += len(inserted)
        print(f"تم إدخال {min(i + BATCH_SIZE, len(developers))} / {len(developers)}")

    print(f"✅ مطورون جدد: {new_count} | متخطون (مكررون): {len(developers) - new_count}")

    ensure_bucket(session, supabase_url)
    print("رفع الشعارات وربطها...")

    counters = {}
    done = [0]

    def run(dev):
        return upload_logo_and_update(session, supabase_url, dev)

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        for status in executor.map(run, developers):
            key = status.split(":")[0]
            counters[key] = counters.get(key, 0) + 1
            done[0] += 1
            if done[0] % 500 == 0:
                print(f"  تقدّم الشعارات: {done[0]} / {len(developers)}")

    print("---")
    for k, v in counters.items():
        print(f"{k}: {v}")


if __name__ == "__main__":
    main()
