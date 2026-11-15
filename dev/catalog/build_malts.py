#!/usr/bin/env python3
"""Castle Malting (EBC + caractéristiques : malts_in_a_few_words ; extrait : fiches spécification) + Weyermann (catalogue brasserie PDF)
-> malts_new.csv + ajoute 'malts' à js/catalog.js. N'est retenu qu'un malt dont EBC, extrait et descriptif sensoriel sont publiés.
potentiel (L°/kg) = extrait sec % x 3.8. NOTES 0-5 = ESTIMATIONS déduites du texte (1re famille citée = 5, 2e = 4, 3e = 3, suivantes = 2)."""
import re, os, json, unicodedata
D = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(D, '..', '..')
MA = ['cereale','biscuit','malte','caramel','chocolat','sucre','fruits_secs','cafe','toaste','raisin','vanille','miel','acide','amer','fume']
KW = {
 'cereale': 'grain grainy cereal husk barley wheat rye oat spelt',
 'biscuit': 'biscuit bread pastry pastries cracker baked crust bakery',
 'malte': 'malty malt',
 'caramel': 'caramel candy toffee butterscotch syrup molasses',
 'chocolat': 'chocolate chocolat cocoa cacao',
 'sucre': 'sweet sweetness sugar nougat',
 'fruits_secs': 'nut nuts nutty almond hazelnut walnut fig date dates prune',
 'cafe': 'coffee cafe espresso mocha',
 'toaste': 'toast toasted roasted roast roasty burnt',
 'raisin': 'raisin raisins grape currant plum',
 'vanille': 'vanilla',
 'miel': 'honey',
 'acide': 'acid acidic sour lactic tart',
 'amer': 'bitter astringent',
 'fume': 'smoke smoky smoked peat peated phenol phenolic',
}
def norm(n):
    n = unicodedata.normalize('NFD', n.lower()); n = ''.join(c for c in n if not unicodedata.combining(c))
    n = re.sub(r'[^a-z0-9]', '', n.replace('château', '').replace('chateau', ''))
    return n
def scores(text):
    text = re.sub(r'(?i)\bnot as (high|dark)[^.]*', '', text)
    order = []
    for w in re.findall(r'[a-zé]+', text.lower()):
        for c in MA:
            if w in KW[c].split() and c not in order: order.append(c)
    sc = dict.fromkeys(MA, 0)
    for i, c in enumerate(order): sc[c] = 5 if i == 0 else 4 if i == 1 else 3 if i == 2 else 2
    return sc, len(order)
fl = lambda s: float(str(s).replace(',', '.'))
fm = lambda x: ('%g' % x)
old = open(os.path.join(ROOT, 'js', 'data.js'), encoding='utf-8').read()
ms = old[old.index('malts:`') + 7:]; ms = ms[:ms.index('`')]
exist = {norm(l.split('|')[0]) for l in ms.split('\n') if l}
rows = []; skipped = []
EXCL = re.compile(r'(?i)flake|raw |distilling|whisky|buckwheat|chit')
# ---- Castle
ext = {}
for l in open(os.path.join(D, 'castle_ext.txt')):
    s, _, v = l.strip().partition('|'); ext[s] = fl(v) if v else None
for o in json.load(open(os.path.join(D, 'castle_list.json'), encoding='utf-8')):
    name = re.sub(r'\\?\*|®|\(ORGANIC MALT\)|\(Organic Malt\)', '', o['name']).strip()
    name = re.sub(r'\s+', ' ', name).title().replace('Château', 'Château').replace('Nature', 'Nature')
    name = name.replace('Ebc', 'EBC')
    e = ext.get(o['sid'])
    if EXCL.search(name + ' '): skipped.append((name, 'adjuvant / non brassage')); continue
    if not e: skipped.append((name, 'extrait non publié')); continue
    m = re.findall(r'[\d.]+', o['ebc'].replace(',', '.'))
    if not m: skipped.append((name, 'EBC absent')); continue
    ebc = (fl(m[0]) + fl(m[-1])) / 2
    sc, n = scores(o['char'] + ' ' + o['feat'])
    if n < 2: skipped.append((name, 'descriptif insuffisant')); continue
    if norm(name) in exist: skipped.append((name, 'déjà présent')); continue
    exist.add(norm(name))
    rows.append((name, 'Castle Malting', ebc, round(e * 3.8, 1), sc, 'https://www.castlemalting.com/CastleMaltingMaltsInAFewWords'))
# ---- Weyermann
for o in json.load(open(os.path.join(D, 'weyermann_list.json'), encoding='utf-8')):
    name = 'Weyermann ' + o['name']
    sc, n = scores(o['sens'])
    if n < 2: skipped.append((name, 'descriptif insuffisant')); continue
    if norm(name) in exist: skipped.append((name, 'déjà présent')); continue
    exist.add(norm(name))
    rows.append((name, 'Weyermann', o['ebc'], round(o['extract'] * 3.8, 1), sc, 'https://www.weyermann.de/wp-content/uploads/2023/05/WEYERMANN-PRODUCTS-Brewery-EN.pdf'))
csv = ['name;maltier;ebc;potentiel;ppg;b46;' + ';'.join(MA) + ';prix_kg;source']
seed = []
for n, mk, ebc, pot, sc, src in rows:
    csv.append(';'.join([n, mk, fm(ebc), fm(pot), '', ''] + [str(sc[c]) for c in MA] + ['', src]))
    seed.append('|'.join([n, mk, fm(ebc), fm(pot), '-', '-', ','.join(str(sc[c]) for c in MA) + ',']))
open(os.path.join(D, 'malts_new.csv'), 'w', encoding='utf-8-sig', newline='').write('\r\n'.join(csv) + '\r\n')
p = os.path.join(ROOT, 'js', 'catalog.js'); cat = open(p, encoding='utf-8').read()
cat = re.sub(r',malts:`.*?`', '', cat, flags=re.S)
cat = cat.replace('`};', '`,malts:`' + '\n'.join(seed) + '`};')
cat = cat.replace("fourchette alpha + descripteurs d'arômes)", "fourchette alpha + descripteurs d'arômes ; malts : Castle Malting + Weyermann, EBC/extrait publiés)")
open(p, 'w', encoding='utf-8').write(cat)
print(len(rows), 'retenus;', len(skipped), 'écartés')
for s in skipped: print(' -', *s)
