#!/usr/bin/env python3
"""Merge content/needs/morrisons-lookups.json into the catalogue.

For each looked-up item this adds an ingredient to content/ingredients.json (a bought product, or a cupboard staple with a
price), its pack label to content/nutrition-labels.json, and a mapping entry to content/cofid-map.json. Items already in the
catalogue are skipped. Then run `npm run nutrition:apply` and `npm run content:verify`.
Usage: python3 scripts/add-looked-up-ingredients.py [--dry]
"""
import json, sys, datetime, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(root)
dry = '--dry' in sys.argv
look = json.load(open('content/needs/morrisons-lookups.json'))
ings = json.load(open('content/ingredients.json'))
have = {i['slug'] for i in ings}
labels = json.load(open('content/nutrition-labels.json'))
cmap = json.load(open('content/cofid-map.json'))
now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
over = json.load(open('content/needs/lookup-overrides.json')) if os.path.exists('content/needs/lookup-overrides.json') else {}
added, skipped = [], []
for it in look:
    s = it.get('slug')
    ov = over.get(s, {})
    if ov.get('pack_size'): it['pack_size'] = ov['pack_size']
    if 'allergens' in ov: it['allergens'] = ov['allergens']
    if not s or s in have:
        skipped.append((s, 'already in catalogue' if s in have else 'no slug')); continue
    if not it.get('price_pence') or not it.get('pack_size'):
        skipped.append((s, 'no price or pack size: ' + str(it.get('notes', '')))); continue
    kind = it.get('kind', 'product')
    p = it.get('per100')
    d = {"slug": s, "name": it['name'], "display": it.get('display') or it['name'], "unit": it.get('unit', 'g'),
         "cupboard": kind == 'cupboard', "allergens": it.get('allergens', []), "per100": p}
    if it.get('gramsPerUnit'): d["gramsPerUnit"] = it['gramsPerUnit']
    if it.get('negligible'): d["negligible"] = True
    if kind == 'cupboard':
        d["note"] = f"{it['name']} · £{it['price_pence']/100:.2f}"
        d["product"] = None
        d["cupboardPrice"] = {"pence": it['price_pence'], "grams": it['pack_size']}
    else:
        d["product"] = {"retailer": "morrisons", "name": it['name'], "price_pence": it['price_pence'], "pack_size": it['pack_size'], "slug": it['product_slug']}
        d["category"] = it.get('category', 'Other')
    if ov.get('cofid'):
        # Use the CoFID food (raw, as bought) rather than a pack label that is as-cooked or estimated.
        d["per100"] = None
        cmap[s] = {"code": ov['cofid'], "prefer": "cofid", **({"approx": ov['approx']} if ov.get('approx') else {})}
    elif p:
        d["cofid"] = {"name": "Pack label (no CoFID cross-check)", "verified": True, "basis": "label"}
        labels[s] = {**p, "basis": "Typical Values per 100g", "allergens": it.get('allergens', []), "product": it.get('product_slug', ''), "fetched_at": now}
        cmap.setdefault(s, {})
        if ov.get('approx'): cmap[s]['approx'] = ov['approx']
    cmap.setdefault(s, {})
    if it.get('gramsPerUnit'): cmap[s]['gpu'] = it['gramsPerUnit']
    if it.get('negligible'): cmap[s]['negligible'] = True
    ings.append(d); added.append(s)
print('added', len(added), added); print('skipped', skipped)
if not dry:
    for f, v in (('content/ingredients.json', ings), ('content/nutrition-labels.json', labels), ('content/cofid-map.json', cmap)):
        json.dump(v, open(f, 'w'), indent=None if 'labels' in f else 1, ensure_ascii=False); open(f, 'a').write('\n')
