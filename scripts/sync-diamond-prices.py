#!/usr/bin/env python3
"""Sync Diamond PC build prices from diamondpcs.ca into the site's hardcoded arrays.

Auritech mirrors Diamond PCs' prices 1:1. Diamond changes prices without notice,
so this script pulls his live Shopify catalogue and rewrites ONLY the price fields
in the two files that hardcode them:

  src/pages/preconfigured.astro  -> price, sale (compare-at), savings %, and the
                                    "starting at $X" meta description
  src/pages/index.astro          -> price, sale for the 3 featured builds

It never touches specs, names, photos, or tags. Sold-out builds and changed
product titles are reported on stdout (as FLAG lines) but NOT applied, because
those are business decisions, not facts to mirror. Last-seen titles are kept in
scripts/diamond-titles.json so title changes can be detected between runs.

Usage:
  python scripts/sync-diamond-prices.py            # apply changes to files
  python scripts/sync-diamond-prices.py --dry-run  # report only, write nothing

Exit code 0 always (a no-op run is success). Stdlib only, no pip deps.
"""
import json
import math
import re
import sys
import urllib.request
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRECONF = ROOT / "src" / "pages" / "preconfigured.astro"
INDEX = ROOT / "src" / "pages" / "index.astro"
TITLES_STATE = ROOT / "scripts" / "diamond-titles.json"
PRODUCTS_URL = "https://diamondpcs.ca/products.json?limit=250"

# preconfigured.astro:  { id:"diamond-core", name:"Diamond Core", price:1369, sale:1499, savings:9,
# Every capture is a NAMED group. Never reference groups by number here: a nested
# named group shifts the numbering and silently corrupts the rewrite.
PRECONF_RE = re.compile(
    r'(?P<pre>\{ id:"(?P<id>[^"]+)", name:"(?P<name>[^"]+)", price:)(?P<price>[\d.]+)'
    r'(?P<sep_sale>, sale:)(?P<sale>[\d.]+)(?P<sep_sav>, savings:)(?P<sav>\d+)'
)
# index.astro:  { name: "Diamond Core", tier: "Entry", price: 1369, sale: 1499, color: ...
INDEX_RE = re.compile(
    r'(?P<pre>\{ name: "(?P<name>[^"]+)", tier: "[^"]+", price: )(?P<price>[\d.]+)'
    r'(?P<sep_sale>, sale: )(?P<sale>[\d.]+)'
)
META_RE = re.compile(r'(?P<pre>starting at \$)(?P<p>[\d,]+(?:\.\d+)?)(?P<post> CAD)')


def fmt_price(s: str) -> str:
    """Shopify gives '1369.00' or '4999.99'. Keep cents only when non-zero."""
    d = Decimal(s)
    return str(int(d)) if d == d.to_integral_value() else str(d.normalize())


def fmt_money(s: str) -> str:
    """'1369' -> '1,369'; '4999.99' -> '4,999.99' (matches JS toLocaleString)."""
    d = Decimal(s)
    whole, _, frac = str(d).partition(".")
    return f"{int(whole):,}" + (f".{frac}" if frac else "")


def savings_pct(price: str, sale: str) -> int:
    p, s = Decimal(price), Decimal(sale)
    if s <= 0:
        return 0
    return int(math.floor((s - p) / s * 100 + Decimal("0.5")))  # round half up, like JS


def fetch_products() -> list:
    req = urllib.request.Request(PRODUCTS_URL, headers={"User-Agent": "Mozilla/5.0 (auritech-price-sync)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["products"]


def build_product_map(names: list, products: list) -> dict:
    """Map each of OUR build names to its Shopify product using longest-prefix match.

    Titles look like 'Diamond Edge Max – Ryzen 7 ...'. Several of our names are
    prefixes of each other ('Diamond Edge' / 'Diamond Edge Max'), so for every
    product we pick the LONGEST of our names that prefixes its title. That way
    'Diamond Edge Max – ...' maps to Edge Max, never to plain Edge.
    """
    by_name = {}
    for p in products:
        t = p["title"]
        best = None
        for n in names:
            if t.startswith(n) and (len(t) == len(n) or not t[len(n)].isalnum()):
                if best is None or len(n) > len(best):
                    best = n
        if best and best not in by_name:
            by_name[best] = p
    return by_name


def main() -> int:
    dry = "--dry-run" in sys.argv
    products = fetch_products()
    # newline="" preserves the files' exact line endings (LF) on every OS, so a
    # run on Windows doesn't silently rewrite every line as CRLF.
    with open(PRECONF, encoding="utf-8", newline="") as f:
        preconf_src = f.read()
    with open(INDEX, encoding="utf-8", newline="") as f:
        index_src = f.read()

    changes, flags = [], {"sold_out": [], "title_changed": [], "unmatched": []}
    live = {}  # our name -> {"price","sale","title","available"}

    # ---- resolve every build in preconfigured.astro against Shopify ----
    our_names = [m.group("name") for m in PRECONF_RE.finditer(preconf_src)]
    product_map = build_product_map(our_names, products)
    for name in our_names:
        p = product_map.get(name)
        if not p:
            flags["unmatched"].append(name)
            continue
        v = p["variants"][0]
        price = fmt_price(v["price"])
        sale = fmt_price(v.get("compare_at_price") or v["price"])
        live[name] = {"price": price, "sale": sale, "title": p["title"],
                      "available": any(x.get("available") for x in p["variants"])}
        if not live[name]["available"]:
            flags["sold_out"].append(name)

    # ---- title drift (spec changes) vs last run ----
    old_titles = {}
    if TITLES_STATE.exists():
        with open(TITLES_STATE, encoding="utf-8") as f:
            old_titles = json.load(f)
    for name, d in live.items():
        if name in old_titles and old_titles[name] != d["title"]:
            flags["title_changed"].append({"build": name, "was": old_titles[name], "now": d["title"]})

    # ---- rewrite preconfigured.astro ----
    def sub_preconf(m):
        name = m.group("name")
        if name not in live:
            return m.group(0)
        price, sale = live[name]["price"], live[name]["sale"]
        sav = savings_pct(price, sale)
        if (m.group("price"), m.group("sale"), int(m.group("sav"))) != (price, sale, sav):
            changes.append(f"{name}: {m.group('price')}/{m.group('sale')} ({m.group('sav')}%) -> {price}/{sale} ({sav}%)")
        return f"{m.group('pre')}{price}{m.group('sep_sale')}{sale}{m.group('sep_sav')}{sav}"

    new_preconf = PRECONF_RE.sub(sub_preconf, preconf_src)

    if live:
        lowest = min((Decimal(d["price"]) for d in live.values()))
        lowest_s = fmt_money(fmt_price(str(lowest)))
        def sub_meta(m):
            if m.group("p") != lowest_s:
                changes.append(f"meta 'starting at': ${m.group('p')} -> ${lowest_s}")
            return f"{m.group('pre')}{lowest_s}{m.group('post')}"
        new_preconf = META_RE.sub(sub_meta, new_preconf)

    # ---- rewrite index.astro featured builds ----
    def sub_index(m):
        name = m.group("name")
        if name not in live:
            return m.group(0)
        price, sale = live[name]["price"], live[name]["sale"]
        if (m.group("price"), m.group("sale")) != (price, sale):
            changes.append(f"[home] {name}: {m.group('price')}/{m.group('sale')} -> {price}/{sale}")
        return f"{m.group('pre')}{price}{m.group('sep_sale')}{sale}"

    new_index = INDEX_RE.sub(sub_index, index_src)

    # ---- fail-safe: rewritten files must round-trip against Shopify ----
    # If the regexes ever drift from the file format, refuse to write anything.
    # This script pushes to a customer-facing site unattended; it must never be
    # able to emit a half-rewritten line.
    problems = []
    for m in PRECONF_RE.finditer(new_preconf):
        n = m.group("name")
        if n in live and (m.group("price"), m.group("sale")) != (live[n]["price"], live[n]["sale"]):
            problems.append(f"preconfigured.astro {n}: wrote {m.group('price')}/{m.group('sale')}, "
                            f"expected {live[n]['price']}/{live[n]['sale']}")
    for m in INDEX_RE.finditer(new_index):
        n = m.group("name")
        if n in live and (m.group("price"), m.group("sale")) != (live[n]["price"], live[n]["sale"]):
            problems.append(f"index.astro {n}: wrote {m.group('price')}/{m.group('sale')}, "
                            f"expected {live[n]['price']}/{live[n]['sale']}")
    if len(list(PRECONF_RE.finditer(new_preconf))) != len(our_names):
        problems.append("preconfigured.astro: build count changed after rewrite")
    if len(list(INDEX_RE.finditer(new_index))) != len(list(INDEX_RE.finditer(index_src))):
        problems.append("index.astro: featured build count changed after rewrite")
    if not changes and (new_preconf != preconf_src or new_index != index_src):
        problems.append("file content changed but no price change was logged (regex drift?)")
    if problems:
        print("ABORT: rewritten output failed validation. Nothing written.")
        for p in problems:
            print("  !", p)
        return 1

    # ---- report ----
    print(f"Matched {len(live)}/{len(list(PRECONF_RE.finditer(preconf_src)))} builds against diamondpcs.ca")
    if changes:
        print(f"{len(changes)} price change(s):")
        for c in changes:
            print("  -", c)
    else:
        print("Prices already in sync. No changes.")
    for k, v in flags.items():
        if v:
            print(f"FLAG {k}: {json.dumps(v)}")

    if dry:
        print("(dry run: nothing written)")
        return 0

    if new_preconf != preconf_src:
        with open(PRECONF, "w", encoding="utf-8", newline="") as f:
            f.write(new_preconf)
    if new_index != index_src:
        with open(INDEX, "w", encoding="utf-8", newline="") as f:
            f.write(new_index)
    titles = {n: d["title"] for n, d in live.items()}
    if titles != old_titles:
        with open(TITLES_STATE, "w", encoding="utf-8", newline="") as f:
            f.write(json.dumps(titles, indent=2, ensure_ascii=False) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
