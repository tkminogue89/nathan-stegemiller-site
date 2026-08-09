#!/usr/bin/env python3
"""
Regenerates the hero, gallery, and Studio Sale sections of index.html from
data.json. Run:  python3 build.py

data.json is a list of pieces, each:
  {
    "img":     "images/catalog/03.jpg",   # path to the image in this repo
    "section": "Hero" | "Gallery" | "Sale",
    "order":   1,                          # sort order within the section
    "dims":    "36\"x24\"",
    "regular": 175,
    "sale":    150,
    "on_sale": true,
    "status":  "Available" | "Sold",
    "notes":   "Special offer — damaged frame",
    "ref":     3                           # optional, for the inquiry tag
  }
Only "img" and "section" are required. Sale pieces should have prices.
"""
import json, re, sys, os

ROOT = os.path.dirname(os.path.abspath(__file__))
HTML = os.path.join(ROOT, "index.html")
DATA = os.path.join(ROOT, "data.json")

def price(n):
    try:
        return f"${int(float(str(n).replace('$','').replace(',','').strip())):,}"
    except (ValueError, TypeError):
        return ""

def dims_fmt(d):
    return (d or "").replace("x", " × ")

def esc(s):
    return (s or "").replace("&", "&amp;").replace('"', "&quot;")

def replace_region(html, name, new_inner):
    start, end = f"<!-- {name}:START -->", f"<!-- {name}:END -->"
    pat = re.compile(re.escape(start) + r".*?" + re.escape(end), re.DOTALL)
    if not pat.search(html):
        sys.exit(f"ERROR: markers {name} not found in index.html")
    return pat.sub(f"{start}\n{new_inner}\n        {end}", html)

def main():
    data = json.load(open(DATA))
    for p in data:
        p.setdefault("order", 9999)
        p["order"] = float(p["order"]) if str(p.get("order", "")).strip() != "" else 9999

    hero = [p for p in data if p.get("section", "").lower() == "hero"]
    hero_ids = {id(p) for p in hero}
    # Route by STATUS (per owner note): Sold -> Past Work gallery, Available -> Studio Sale.
    gallery = sorted([p for p in data if id(p) not in hero_ids and p.get("status", "").lower() == "sold"],
                     key=lambda p: p["order"])
    sale = sorted([p for p in data if id(p) not in hero_ids and p.get("status", "").lower() == "available"],
                  key=lambda p: p["order"])

    ALT = 'Relief painting by Nate Stegemiller'

    # HERO
    if hero:
        h = hero[0]
        hero_html = f'        <img src="{h["img"]}" alt="Textured relief painting by Nate Stegemiller in a styled room" />'
    else:
        hero_html = '        <img src="images/art-36.jpg" alt="Textured relief painting by Nate Stegemiller" />'

    # GALLERY
    g = [f'        <figure><img src="{p["img"]}" loading="lazy" alt="{ALT}" /></figure>' for p in gallery]
    gallery_html = "\n".join(g)

    # SALE
    cards = []
    for p in sale:
        reg, sal = p.get("regular"), p.get("sale")
        on_sale = bool(p.get("on_sale")) and sal not in (None, "", 0)
        if on_sale:
            price_html = f'<span class="was">{price(reg)}</span> <span class="now">{price(sal)}</span>'
            eff = price(sal)
        else:
            price_html = f'<span class="now">{price(reg)}</span>'
            eff = price(reg)
        meta = f'\n            <p class="sale-meta">{dims_fmt(p.get("dims",""))}</p>' if p.get("dims") else ""
        note = f'\n            <p class="sale-note-item">{esc(p.get("notes",""))}</p>' if p.get("notes") else ""
        tag = f'Studio Sale · piece #{p.get("ref","")} ({eff})'
        action = f'<button type="button" class="btn btn-sm js-buy" data-piece="{esc(tag)}">Inquire to buy</button>'
        cards.append(f'''        <article class="sale-item">
          <figure class="artframe square">
            <img src="{p["img"]}" loading="lazy" alt="{ALT}" />
          </figure>
          <div class="sale-info">{meta}
            <p class="sale-price">{price_html}</p>{note}
            {action}
          </div>
        </article>''')
    sale_html = "\n".join(cards)

    html = open(HTML).read()
    html = replace_region(html, "HERO", hero_html)
    html = replace_region(html, "GALLERY", gallery_html)
    html = replace_region(html, "SALE", sale_html)
    open(HTML, "w").write(html)

    print(f"Built: hero={len(hero)}, gallery={len(gallery)}, sale={len(sale)} "
          f"({sum(1 for p in sale if p.get('status','Available').lower()!='available')} sold)")

if __name__ == "__main__":
    main()
