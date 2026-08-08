#!/usr/bin/env python3
"""
Connector-free daily pipeline:
  1. Download the published-to-web CSV of the inventory spreadsheet
  2. Build data.json (resolving each piece's image)
  3. Run build.py to regenerate index.html

Image resolution per row:
  - if 'image_url' is given -> download once into images/library/<key>.jpg
  - elif 'ref' given and images/catalog/<NN>.jpg exists -> use that
  - else -> row skipped (logged)

Config: put the published CSV URL in config.json  ->  {"csv_url": "https://..."}
Run:    python3 sync_build.py
"""
import csv, io, json, os, re, sys, hashlib, subprocess, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(ROOT, "images", "library")
os.makedirs(LIB, exist_ok=True)

def load_csv_url():
    cfg = os.path.join(ROOT, "config.json")
    if os.path.exists(cfg):
        u = json.load(open(cfg)).get("csv_url", "").strip()
        if u:
            return u
    u = os.environ.get("CSV_URL", "").strip()
    if u:
        return u
    sys.exit("No CSV URL. Add config.json {\"csv_url\": \"...\"} or set CSV_URL.")

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()

def norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())

def drive_direct(url):
    """Turn a Google Drive share link into a direct-download URL."""
    m = re.search(r"/d/([A-Za-z0-9_-]+)", url) or re.search(r"[?&]id=([A-Za-z0-9_-]+)", url)
    if m and "drive.google" in url:
        return f"https://drive.google.com/uc?export=download&id={m.group(1)}"
    return url

def optimize(path):
    """Downscale/re-encode to <=1600px jpg if sips (macOS) or PIL is available."""
    try:
        subprocess.run(["sips", "-Z", "1600", "-s", "formatOptions", "80", path, "--out", path],
                       check=True, capture_output=True)
        return
    except Exception:
        pass
    try:
        from PIL import Image
        im = Image.open(path).convert("RGB")
        im.thumbnail((1600, 1600))
        im.save(path, "JPEG", quality=80)
    except Exception as e:
        print(f"  (note: could not optimize {os.path.basename(path)}: {e})")

def ensure_image(row):
    ref = (row.get("ref") or "").strip()
    url = (row.get("image_url") or "").strip()
    if url:
        key = ref if ref else hashlib.md5(url.encode()).hexdigest()[:10]
        dest_rel = f"images/library/{key}.jpg"
        dest = os.path.join(ROOT, dest_rel)
        if not os.path.exists(dest):
            try:
                data = fetch(drive_direct(url))
                open(dest, "wb").write(data)
                optimize(dest)
                print(f"  downloaded image for ref/{key}")
            except Exception as e:
                print(f"  ! failed to download {url}: {e}")
                return None
        return dest_rel
    if ref:
        try:
            nn = f"{int(ref):02d}"
            if os.path.exists(os.path.join(ROOT, "images", "catalog", f"{nn}.jpg")):
                return f"images/catalog/{nn}.jpg"
        except ValueError:
            pass
    return None

def truthy(v):
    return str(v).strip().lower() in ("true", "yes", "1", "y", "x")

def main():
    raw = fetch(load_csv_url()).decode("utf-8", "replace")
    rows = list(csv.reader(io.StringIO(raw)))
    # find header row (contains 'section' and ('ref' or 'image'))
    hdr_i = next((i for i, r in enumerate(rows)
                  if any(norm(c) == "section" for c in r)
                  and any(norm(c) in ("ref", "image", "imageurl") for c in r)), None)
    if hdr_i is None:
        sys.exit("Could not find header row (need 'section' + 'ref'/'image' columns).")
    header = [norm(c) for c in rows[hdr_i]]

    def col(row, *names):
        for n in names:
            if n in header:
                idx = header.index(n)
                if idx < len(row):
                    return row[idx].strip()
        return ""

    data, skipped = [], []
    for r in rows[hdr_i + 1:]:
        if not any(c.strip() for c in r):
            continue
        section = col(r, "section")
        if section.lower() not in ("hero", "gallery", "sale"):
            continue
        row = {
            "ref": col(r, "ref"),
            "image_url": col(r, "imageurl", "image"),
        }
        img = ensure_image(row)
        if not img:
            skipped.append(col(r, "ref") or col(r, "imageurl") or "?")
            continue
        data.append({
            "ref": col(r, "ref"),
            "img": img,
            "section": section,
            "order": col(r, "order") or 9999,
            "dims": col(r, "dimensions", "dims"),
            "regular": col(r, "regularprice", "regular", "price"),
            "sale": col(r, "saleprice", "sale"),
            "on_sale": truthy(col(r, "onsale")),
            "status": col(r, "status") or "Available",
            "notes": col(r, "notes"),
        })

    json.dump(data, open(os.path.join(ROOT, "data.json"), "w"), indent=2, ensure_ascii=False)
    print(f"Wrote data.json: {len(data)} pieces. Skipped (no image): {skipped or 'none'}")
    subprocess.run([sys.executable, os.path.join(ROOT, "build.py")], check=True)

if __name__ == "__main__":
    main()
