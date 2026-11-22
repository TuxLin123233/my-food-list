#!/usr/bin/env python3
"""Build js/data.js from data/snacks.csv."""
import csv
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "snacks.csv"
OUT_PATH = ROOT / "js" / "data.js"

CATEGORY_ORDER = ["膨化", "饼干", "巧克力", "糖果", "咸味", "坚果"]
FAVORITE = {"常备", "会回购"}


def main():
    if not CSV_PATH.exists():
        raise SystemExit(f"missing {CSV_PATH}")

    snacks = []
    with CSV_PATH.open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            snack = {key: (value or "").strip() for key, value in row.items()}
            snack["rating"] = int(snack.get("rating") or 0)
            snack["tags"] = [tag for tag in (snack.get("tags") or "").split("|") if tag]
            snacks.append(snack)

    categories = []
    for name in CATEGORY_ORDER:
        count = sum(1 for snack in snacks if snack["category"] == name)
        if count:
            categories.append({"name": name, "count": count})
    extra = sorted({snack["category"] for snack in snacks} - set(CATEGORY_ORDER))
    for name in extra:
        categories.append({"name": name, "count": sum(1 for snack in snacks if snack["category"] == name)})

    brands = {snack["brand"] for snack in snacks if snack["brand"]}
    favorites = sum(1 for snack in snacks if snack["repurchase"] in FAVORITE)
    data = {
        "title": "LinSifan 的零食柜",
        "subtitle": "有包装的、会反复买的",
        "updated": date.today().isoformat(),
        "categories": categories,
        "stats": {
            "snacks": len(snacks),
            "brands": len(brands),
            "categories": len(categories),
            "favorites": favorites,
        },
        "snacks": snacks,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        "window.SNACK_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(f"built {OUT_PATH} · {len(snacks)} snacks")


if __name__ == "__main__":
    main()
