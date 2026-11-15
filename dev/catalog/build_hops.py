#!/usr/bin/env python3
"""hops_raw.txt (fiches Beer Maverick lues une à une) -> hops_new.csv + js/catalog.js (houblons).
Règle : un houblon n'est retenu que si fourchette alpha publiée ET au moins 2 familles d'arômes déductibles des descripteurs publiés.
NOTES 0-5 = ESTIMATIONS : la source ne donne que des descripteurs (pas d'intensité). 1er descripteur cité = 5, 2e = 4, 3e = 3, suivants = 2."""
import re, os, unicodedata
D = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(D, '..', '..')
CATS = ['citrus','tropical_fruit','stone_fruit','berry','floral','grassy','herbal','spice','resin_pin']
KW = {
 'citrus': 'citrus grapefruit orange lemon lime tangerine mandarin zest marmalade pomelo tangy',
 'tropical_fruit': 'tropical mango papaya pineapple passion lychee guava melon coconut banana watermelon honeydew',
 'stone_fruit': 'peach apricot stone plum cherry nectarine pear apple fig fruity candied',
 'berry': 'berry currant raspberry strawberry blackberry blueberry loganberry gooseberry redberry cranberry grapes wine sauvignon redcurrant',
 'floral': 'floral blossom lavender rose jasmine geranium hibiscus magnolia chamomile lilac elderflower cornflower',
 'grassy': 'grassy grass green hay fresh alfalfa cucumber tea',
 'herbal': 'herbal mint sage thyme oregano dill eucalyptus tobacco earthy woody cedar leather menthol spearmint musty hoppy bohemian lemongrass',
 'spice': 'spicy pepper anise licorice cinnamon nutmeg clove ginger curry incense vanilla gingerbread',
 'resin_pin': 'pine resin dank cannabis juniper oak balsamic',
}
def norm(n):
    n = unicodedata.normalize('NFD', n.lower()); n = ''.join(c for c in n if not unicodedata.combining(c))
    n = re.sub(r'\(.*?\)', '', n); n = re.sub(r'[^a-z0-9]', '', n)
    return n[:-1] if n.endswith('s') else n
old = open(os.path.join(ROOT, 'js', 'data.js'), encoding='utf-8').read()
hs = old[old.index('hops:`') + 6:]; hs = hs[:hs.index('`')]
exist = {norm(l.split('|')[0]) for l in hs.split('\n') if l}
rows = []; skipped = []
for l in open(os.path.join(D, 'hops_raw.txt'), encoding='utf-8'):
    p = l.rstrip('\n').split('|')
    if len(p) < 5: continue
    name, amin, amax, prof, src = p
    if norm(name) in exist: skipped.append((name, 'déjà présent')); continue
    toks = [t.strip() for t in re.split(r',|&', prof) if t.strip()]
    sc = dict.fromkeys(CATS, 0)
    for i, t in enumerate(toks):
        v = 5 if i == 0 else 4 if i == 1 else 3 if i == 2 else 2
        for w in re.findall(r'[a-z]+', t.lower()):
            for c in CATS:
                if w in KW[c].split(): sc[c] = max(sc[c], v)
    if sum(1 for c in CATS if sc[c]) < 2: skipped.append((name, 'arômes insuffisants')); continue
    rows.append((name, float(amin), float(amax), [sc[c] for c in CATS], src))
fm = lambda x: ('%g' % x)
csv = ['name;alpha_min;alpha_max;' + ';'.join(CATS) + ';prix_g;source']
seed = []
for n, a, b, s, src in rows:
    csv.append(';'.join([n, fm(a), fm(b)] + [str(x) for x in s] + ['', src]))
    seed.append('|'.join([n, fm(a), fm(b), ','.join(str(x) for x in s) + ',']))
open(os.path.join(D, 'hops_new.csv'), 'w', encoding='utf-8-sig', newline='').write('\r\n'.join(csv) + '\r\n')
cat = '// Catalogue complémentaire (ajouté une seule fois à la base existante, sans écraser). Généré par dev/catalog/build_*.py\n'
cat += '// SOURCES : fiches Beer Maverick (fourchette alpha + descripteurs d\'arômes). NOTES AROMATIQUES 0-5 = ESTIMATIONS déduites des descripteurs. Prix non renseignés.\n'
cat += 'const CAT={hops:`' + '\n'.join(seed) + '`};\n'
open(os.path.join(ROOT, 'js', 'catalog.js'), 'w', encoding='utf-8').write(cat)
print(len(rows), 'retenus;', len(skipped), 'écartés'); [print(' -', *s) for s in skipped]
