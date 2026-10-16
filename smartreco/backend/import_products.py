"""Import product batches (JSON) into the SmartReco database.

    python import_products.py                  # every backend/data/*.json, adds products whose title is new
    python import_products.py --update         # also update products that already exist (matched by title)
    python import_products.py --dry-run        # validate and report, write nothing
    python import_products.py --raw            # skip the automatic clean-ups listed below
    python import_products.py data/my_batch.json [more.json]

The API also runs this (insert-only) on startup, so dropping a new JSON file into backend/data/ and
restarting is enough. Users and existing products are never deleted.

Rows that break the rules are rejected (and reported). Unless --raw is given, these clean-ups are applied
and every one is printed:
  * tags that are just a category name ("accessories", "books"...) are removed
  * a "waterproof" tag is changed to "water resistant" when the description says water-resistant
  * at most 3 ratings above 4.7 per file (the most-reviewed keep theirs, the rest become 4.7)
  * at most 1 "recommended" product per category per file (the best rated keeps the badge)
  * two author names that match real people/brands are replaced (see RENAMES)

Image files are NOT imported: each product's image_url becomes /products/<image_file>, served from
frontend/public/products/. Missing images show a placeholder in the app.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional

BACKEND_DIR = Path(__file__).parent
DATA_DIR = BACKEND_DIR / "data"
IMAGES_DIR = BACKEND_DIR.parent / "frontend" / "public" / "products"

PRICE_RANGES = {
    "Electronics": (799, 90000),
    "Fashion": (499, 12000),
    "Home & Living": (299, 9000),
    "Accessories": (399, 20000),
    "Books": (149, 1500),
}
REQUIRED = {"title", "brand", "category", "price", "rating", "reviews_count",
            "description", "tags", "is_recommended", "image_file"}
CATEGORY_NAME_TAGS = {"electronics", "fashion", "accessories", "books", "home", "home & living"}
RENAMES = {"David Cross": "Daniel Croft", "Sarah Flint": "Sonia Fenwick"}
MAX_HIGH_RATINGS = 3  # ratings above 4.7 allowed per file
_IMAGE_RE = re.compile(r"^[a-z0-9][a-z0-9\-]*\.(jpg|jpeg|png|webp)$")


# --------------------------------------------------------------------------- #
# Validation (rows that fail are rejected, not imported)
# --------------------------------------------------------------------------- #
def validate(row: Any) -> List[str]:
    if not isinstance(row, dict):
        return ["row is not an object"]
    missing = REQUIRED - set(row)
    if missing:
        return [f"missing keys: {sorted(missing)}"]

    errs: List[str] = []
    title = row["title"]
    if not isinstance(title, str) or not 3 <= len(title.strip()) <= 60:
        errs.append("title must be 3-60 characters")
    for key in ("brand", "description", "image_file"):
        if not isinstance(row[key], str) or not row[key].strip():
            errs.append(f"{key} must be a non-empty string")

    cat = row["category"]
    if cat not in PRICE_RANGES:
        errs.append(f"unknown category {cat!r}")

    price = row["price"]
    if isinstance(price, bool) or not isinstance(price, (int, float)) or price <= 0:
        errs.append("price must be a positive number")
    elif cat in PRICE_RANGES and not PRICE_RANGES[cat][0] <= price <= PRICE_RANGES[cat][1]:
        lo, hi = PRICE_RANGES[cat]
        errs.append(f"price {price} outside {lo}-{hi} for {cat}")

    rating = row["rating"]
    if isinstance(rating, bool) or not isinstance(rating, (int, float)) or not 0 <= rating <= 5:
        errs.append("rating must be a number from 0 to 5")

    reviews = row["reviews_count"]
    if isinstance(reviews, bool) or not isinstance(reviews, int) or reviews < 0:
        errs.append("reviews_count must be a whole number")

    tags = row["tags"]
    if not isinstance(tags, list) or not tags or not all(isinstance(t, str) and t.strip() for t in tags):
        errs.append("tags must be a non-empty list of strings")

    if not isinstance(row["is_recommended"], bool):
        errs.append("is_recommended must be true or false")

    img = row["image_file"]
    if isinstance(img, str) and not _IMAGE_RE.match(img):
        errs.append(f"image_file {img!r} must be lowercase-hyphenated and end in .jpg/.png/.webp")
    return errs


# --------------------------------------------------------------------------- #
# Clean-ups (all reported)
# --------------------------------------------------------------------------- #
def clean(rows: List[Dict[str, Any]], apply_fixes: bool = True):
    """Return (cleaned rows, list of human-readable changes). Input rows must be valid."""
    rows = [dict(r) for r in rows]
    changes: List[str] = []

    for r in rows:  # silent normalisation: whitespace, lowercase tags, no duplicate tags
        r["title"] = " ".join(r["title"].split())
        seen, tags = set(), []
        for t in r["tags"]:
            t = " ".join(str(t).lower().split())
            if t and t not in seen:
                seen.add(t)
                tags.append(t)
        r["tags"] = tags

    if not apply_fixes:
        return rows, changes

    for r in rows:
        before = len(r["tags"])
        r["tags"] = [t for t in r["tags"] if t not in CATEGORY_NAME_TAGS]
        if len(r["tags"]) != before:
            changes.append(f'{r["title"]}: removed category-name tag')

        desc = r["description"].lower()
        if "waterproof" in r["tags"] and re.search(r"water[- ]resistant", desc) and "waterproof" not in desc:
            r["tags"] = ["water resistant" if t == "waterproof" else t for t in r["tags"]]
            r["tags"] = list(dict.fromkeys(r["tags"]))
            changes.append(f'{r["title"]}: tag "waterproof" -> "water resistant" (description says water-resistant)')

        if r["brand"] in RENAMES:
            changes.append(f'{r["title"]}: brand/author "{r["brand"]}" -> "{RENAMES[r["brand"]]}"')
            r["brand"] = RENAMES[r["brand"]]

    high = [r for r in rows if r["rating"] > 4.7]
    if len(high) > MAX_HIGH_RATINGS:
        keep = {id(r) for r in sorted(high, key=lambda r: -r["reviews_count"])[:MAX_HIGH_RATINGS]}
        for r in high:
            if id(r) not in keep:
                changes.append(f'{r["title"]}: rating {r["rating"]} -> 4.7')
                r["rating"] = 4.7

    flagged = defaultdict(list)
    for r in rows:
        if r["is_recommended"]:
            flagged[r["category"]].append(r)
    for items in flagged.values():
        items.sort(key=lambda r: (-r["rating"], -r["reviews_count"]))
        for r in items[1:]:
            r["is_recommended"] = False
            changes.append(f'{r["title"]}: removed "Recommended" badge (kept 1 per category)')

    return rows, changes


# --------------------------------------------------------------------------- #
# Database
# --------------------------------------------------------------------------- #
def _fields(row: Dict[str, Any]) -> Dict[str, Any]:
    return dict(
        title=row["title"],
        brand=row["brand"].strip(),
        category=row["category"],
        price=float(row["price"]),
        rating=float(row["rating"]),
        reviews_count=int(row["reviews_count"]),
        image_url=f'/products/{row["image_file"]}',
        description=row["description"].strip(),
        is_recommended=bool(row["is_recommended"]),
        tags=list(row["tags"]),
    )


def upsert(db, rows: List[Dict[str, Any]], update: bool = False, dry_run: bool = False) -> Dict[str, int]:
    from models import Product  # imported lazily so validate()/clean() work without the DB stack

    known = {p.title.lower(): p for p in db.query(Product).all()}
    added = updated = skipped = 0
    for row in rows:
        key = row["title"].lower()
        fields = _fields(row)
        if key not in known:
            if not dry_run:
                known[key] = Product(**fields)
                db.add(known[key])
            else:
                known[key] = None
            added += 1
        elif update and known[key] is not None:
            if not dry_run:
                for k, v in fields.items():
                    setattr(known[key], k, v)
            updated += 1
        else:
            skipped += 1
    if not dry_run:
        db.commit()
    return {"added": added, "updated": updated, "skipped": skipped}


def run(db, paths: Optional[List[Path]] = None, update: bool = False,
        dry_run: bool = False, raw: bool = False) -> Dict[str, Any]:
    files = [Path(p) for p in paths] if paths else sorted(DATA_DIR.glob("*.json"))
    summary: Dict[str, Any] = {"files": [], "added": 0, "updated": 0, "skipped": 0,
                               "errors": [], "changes": [], "missing_images": []}
    for path in files:
        try:
            raw_rows = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(raw_rows, list):
                raise ValueError("top level must be a JSON array")
        except (OSError, ValueError) as exc:
            summary["errors"].append(f"{path.name}: cannot read ({exc})")
            continue

        valid, seen_titles = [], set()
        for i, row in enumerate(raw_rows, 1):
            label = row.get("title", "?") if isinstance(row, dict) else "?"
            errs = validate(row)
            if not errs and row["title"].strip().lower() in seen_titles:
                errs = ["duplicate title within this file"]
            if errs:
                summary["errors"].append(f"{path.name} #{i} ({label}): " + "; ".join(errs))
                continue
            seen_titles.add(row["title"].strip().lower())
            valid.append(row)

        cleaned, changes = clean(valid, apply_fixes=not raw)
        summary["changes"] += [f"{path.name}: {c}" for c in changes]
        summary["missing_images"] += [r["image_file"] for r in cleaned if not (IMAGES_DIR / r["image_file"]).exists()]
        counts = upsert(db, cleaned, update=update, dry_run=dry_run)
        for k in ("added", "updated", "skipped"):
            summary[k] += counts[k]
        summary["files"].append(f"{path.name} ({len(valid)}/{len(raw_rows)} rows valid)")
    return summary


def import_all(db) -> None:
    """Called on API startup: insert new products from backend/data/*.json. Never blocks startup."""
    try:
        s = run(db)
    except Exception as exc:  # a bad data file must not stop the API
        db.rollback()
        print(f"[import] product import skipped: {exc}")
        return
    if s["added"]:
        print(f"[import] added {s['added']} products from backend/data/")
    if s["errors"]:
        print(f"[import] {len(s['errors'])} rows rejected; run `python import_products.py --dry-run` for details")


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="*", type=Path, help="JSON files (default: backend/data/*.json)")
    ap.add_argument("--update", action="store_true", help="update existing products (matched by title)")
    ap.add_argument("--dry-run", action="store_true", help="validate and report only")
    ap.add_argument("--raw", action="store_true", help="skip automatic clean-ups")
    args = ap.parse_args()

    from models import Base, SessionLocal, engine
    from seed import seed_database

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        if not args.dry_run:
            seed_database(db)  # original 10 products and demo user if the DB is empty
        s = run(db, args.files or None, update=args.update, dry_run=args.dry_run, raw=args.raw)

    print("Files: " + (", ".join(s["files"]) or "none found"))
    print(f"{'Would add' if args.dry_run else 'Added'} {s['added']}, "
          f"{'would update' if args.dry_run else 'updated'} {s['updated']}, skipped {s['skipped']} (already present)")
    if s["changes"]:
        print(f"\nClean-ups applied ({len(s['changes'])}):")
        for c in s["changes"]:
            print("  -", c)
    if s["missing_images"]:
        print(f"\n{len(s['missing_images'])} image files not found in frontend/public/products/ "
              f"(the app shows a placeholder). First few: {', '.join(s['missing_images'][:5])}")
    if s["errors"]:
        print(f"\nRejected rows ({len(s['errors'])}):")
        for e in s["errors"]:
            print("  -", e)
    return 1 if s["errors"] else 0


if __name__ == "__main__":
    sys.exit(main())
