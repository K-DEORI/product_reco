#!/usr/bin/env python3
"""SmartReco image helper.

  python tools/prepare_images.py --checklist
      Write tools/image_checklist.csv: one row per product with the exact filename and an image prompt.

  python tools/prepare_images.py <folder> [--dry-run]
      Take the pictures you generated in <folder>, crop them to a centred square, resize to 1000x1000, compress
      each JPG to under 250 KB, and save them into frontend/public/products/ under the right product filename.

How files are matched: a file in <folder> is used when its name (ignoring extension, capitals and spaces/underscores)
equals a product's image_file, e.g. "Vertex Rapid Charger 65W.png" -> vertex-rapid-charger-65w.jpg.
Files that don't match are listed with the closest product names; nothing is guessed.
Requires Pillow:  pip install pillow
"""
from __future__ import annotations

import argparse
import csv
import difflib
import io
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "backend" / "data"
SEED = ROOT / "backend" / "seed.py"
OUT_DIR = ROOT / "frontend" / "public" / "products"
CHECKLIST = Path(__file__).resolve().parent / "image_checklist.csv"
EXTS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_BYTES = 250 * 1024
SIZE = 1000

STYLE = ("centred with plenty of margin on a soft warm beige background (#F3ECE2), gentle natural window light, "
         "soft shadow, square composition, no text, no logo, no watermark, no people or hands")

# The original 10 products are real brands; these prompts are deliberately unbranded.
ORIGINAL_PROMPTS = {
    "airpods-pro.jpg": "white wireless earbuds with a small white charging case",
    "zara-linen-dress.jpg": "beige linen-blend sleeveless midi dress hanging on a wooden hanger",
    "dell-inspiron-15.jpg": "silver 15-inch laptop, open, screen showing a calm mountain landscape",
    "ikea-table-lamp.jpg": "small table lamp with a warm cream fabric shade and a light wood base, softly lit",
    "atomic-habits.jpg": "stack of three plain cream hardcover books with blank spines and covers",
    "noise-colorfit-pro-5.jpg": "black rectangular smartwatch with a bright dial and a black silicone strap",
    "skybags-backpack.jpg": "olive green everyday backpack with front zip pocket",
    "nike-air-force-1.jpg": "clean white leather low-top sneaker, plain with no logos",
    "sony-wh-ch720n.jpg": "black over-ear wireless headphones",
    "fossil-gen-6.jpg": "blush pink smartwatch with a rose gold case and a pink silicone strap",
}


def load_catalog() -> dict:
    """filename -> {title, category, prompt}, from seed.py (original 10) and backend/data/*.json."""
    items: dict = {}
    if SEED.exists():
        text = SEED.read_text(encoding="utf-8")
        for m in re.finditer(r'title="([^"]+)".*?category="([^"]+)".*?image_url="/products/([^"]+)"', text, re.S):
            title, cat, fname = m.groups()
            subject = ORIGINAL_PROMPTS.get(fname, title)
            items[fname] = dict(title=title, category=cat, prompt=f"Studio product photo of {subject}, {STYLE}")
    for path in sorted(DATA_DIR.glob("*.json")):
        try:
            rows = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        for r in rows if isinstance(rows, list) else []:
            if isinstance(r, dict) and r.get("image_file"):
                prompt = r.get("image_prompt") or f"Studio product photo of {r.get('title', '')}, {STYLE}"
                items[r["image_file"]] = dict(title=r.get("title", ""), category=r.get("category", ""), prompt=prompt)
    return items


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def match_key(filename: str) -> str:
    """Name used for matching. Drops image extensions, even doubled ones like 'name.jpg.png'
    (Windows hides real extensions, so renaming a PNG to 'name.jpg' often produces exactly that)."""
    stem = Path(filename).stem
    while Path(stem).suffix.lower() in EXTS:
        stem = Path(stem).stem
    return slug(stem)


def write_checklist(items: dict) -> None:
    with CHECKLIST.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["#", "category", "save as (filename)", "product", "image prompt"])
        for i, (fname, d) in enumerate(items.items(), 1):
            w.writerow([i, d["category"], fname, d["title"], d["prompt"]])
    print(f"Wrote {CHECKLIST} ({len(items)} products)")


def prepare(src: Path, dest: Path, dry_run: bool) -> str:
    from PIL import Image, ImageOps  # imported here so --checklist works without Pillow

    im = ImageOps.exif_transpose(Image.open(src))
    w, h = im.size
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, (243, 236, 226))
        bg.paste(im, mask=im.split()[-1])
        im = bg
    else:
        im = im.convert("RGB")
    im = ImageOps.fit(im, (SIZE, SIZE), method=Image.LANCZOS, centering=(0.5, 0.5))

    data, quality = b"", 90
    for quality in (90, 85, 80, 75, 70, 65, 60):
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
        data = buf.getvalue()
        if len(data) <= MAX_BYTES:
            break
    note = f"{w}x{h} -> {SIZE}x{SIZE}, {len(data) // 1024} KB (q{quality})"
    if abs(w - h) / max(w, h) > 0.1:
        note += "  [not square: edges were cropped, check the product is still fully visible]"
    if not dry_run:
        dest.write_bytes(data)
    return note


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder", nargs="?", type=Path, help="folder with your generated images")
    ap.add_argument("--checklist", action="store_true", help="write tools/image_checklist.csv")
    ap.add_argument("--dry-run", action="store_true", help="show what would happen, write nothing")
    args = ap.parse_args()

    items = load_catalog()
    if not items:
        print("No products found. Run this from the smartreco project (needs backend/seed.py and backend/data/).")
        return 1
    if args.checklist:
        write_checklist(items)
        if not args.folder:
            return 0
    if not args.folder:
        ap.print_help()
        return 0
    if not args.folder.is_dir():
        print(f"Folder not found: {args.folder}")
        return 1
    try:
        import PIL  # noqa: F401
    except ImportError:
        print("Pillow is required:  pip install pillow")
        return 1

    by_slug = {slug(Path(f).stem): f for f in items}
    done, unmatched, seen = [], [], set()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for src in sorted(args.folder.iterdir()):
        if src.suffix.lower() not in EXTS:
            continue
        target = by_slug.get(match_key(src.name))
        if not target:
            unmatched.append(src.name)
            continue
        if target in seen:
            print(f"  skipped {src.name}: another file already used for {target}")
            continue
        seen.add(target)
        try:
            note = prepare(src, OUT_DIR / target, args.dry_run)
        except Exception as exc:  # unreadable or corrupt image
            print(f"  FAILED  {src.name}: {exc}")
            continue
        done.append(target)
        print(f"  {'would save' if args.dry_run else 'saved'} {target}  <- {src.name}: {note}")

    print(f"\n{len(done)} of {len(items)} products {'would get' if args.dry_run else 'now have'} a picture from this folder.")
    if unmatched:
        print(f"\n{len(unmatched)} files did not match any product (rename them to the 'save as' name):")
        for name in unmatched:
            near = difflib.get_close_matches(match_key(name), list(by_slug), n=2, cutoff=0.5)
            hint = f"  -> closest: {', '.join(by_slug[n] for n in near)}" if near else ""
            print(f"  - {name}{hint}")
    missing = [f for f in items if f not in seen]
    if missing:
        print(f"\nStill without a picture from this folder: {len(missing)} (they keep their current image/placeholder).")
    return 0


if __name__ == "__main__":
    sys.exit(main())