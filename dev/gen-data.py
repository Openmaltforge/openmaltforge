#!/usr/bin/env python3
"""Génère web/js/data.js (données de départ : malts, houblons, levures), chargées par le navigateur dans une base vide
SOURCES : malts = fiches brewpark.com (EBC publié) ; levures sachets 11 g et houblons pellets = autobrasseur.fr (noms, prix TTC).
Les valeurs techniques absentes des sites (potentiel, alpha-acides, atténuation, floculation, températures) et TOUTES les notes
aromatiques sont des ESTIMATIONS de brasseur, modifiables dans l'application."""
import re, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
P = os.path.join(ROOT, 'web', 'js', 'data.js')
old = open(P, encoding='utf-8').read()
keep = old[old.index('ings:`'):]               # ingrédients, consommables inchangés

# ---------- MALTS  (cereale biscuit malte caramel chocolat sucre fruits_secs cafe toaste raisin vanille miel acide amer fume)
MT = dict(
 pils='7,1,3,0,0,2,0,0,0,0,0,1,0,0,0', pale='6,3,5,1,0,2,0,0,2,0,0,1,0,0,0', mo='5,6,5,1,0,2,1,0,2,0,0,1,0,0,0',
 munich='4,5,8,2,0,3,1,0,4,1,0,3,0,0,0', wheat='5,2,3,0,0,2,0,0,0,0,0,1,1,0,0', rye='4,2,4,0,0,1,0,0,1,0,0,0,0,1,0',
 cl='2,3,3,5,0,5,1,0,1,1,0,3,0,0,0', cm='0,2,1,7,0,6,4,0,2,5,0,3,0,1,0', cd='0,0,1,7,2,5,8,1,3,9,0,2,0,2,0',
 mel='1,5,6,3,0,3,2,0,4,2,0,3,0,0,0', choc='0,0,0,1,8,0,2,6,6,0,0,0,0,5,0', blk='0,0,0,0,9,0,0,8,7,0,0,0,0,7,0',
 smk='4,2,4,0,0,2,0,0,1,0,0,1,0,0,9', red='3,4,6,2,0,2,1,0,3,1,0,2,0,0,0')
PO = dict(pils=305, pale=305, mo=300, munich=298, wheat=305, rye=295, cl=280, cm=275, cd=268, mel=290, choc=250, blk=245, smk=300, red=300)
M = [  # nom | maltier | EBC (milieu de la fourchette publiée) | famille
 ('BEST Pilsen','Bestmalz',4,'pils'),('BEST Pale Ale','Bestmalz',6,'pale'),('BEST Wheat Malt','Bestmalz',4.8,'wheat'),
 ('BEST Organic Spelt Malt','Bestmalz',4.8,'wheat'),('BEST Caramel Pils','Bestmalz',5,'cl'),('BEST Caramel Hell','Bestmalz',30,'cl'),
 ('BEST Caramel Amber','Bestmalz',71,'cm'),('BEST Caramel Munich I','Bestmalz',90,'cm'),('BEST Caramel Munich II','Bestmalz',120,'cm'),
 ('BEST Caramel Munich III','Bestmalz',165,'cd'),('BEST Melanoidin','Bestmalz',71,'mel'),('BEST Red X','Bestmalz',30,'red'),
 ('BEST Special X','Bestmalz',350,'cd'),('BEST Black Malt','Bestmalz',1150,'blk'),('BEST Black Malt Extra','Bestmalz',1400,'blk'),
 ('BEST Beechwood Smoked','Bestmalz',5.5,'smk'),('BEST Peated Light','Bestmalz',5.5,'smk'),('BEST Cherry Ember Smoked','Bestmalz',5.5,'smk'),
 ('Pilsen','Dingemans',3.5,'pils'),('Pale Ale MD','Dingemans',9,'pale'),('Munich MD','Dingemans',15,'munich'),
 ('Amber-Aromatic MD','Dingemans',50,'mel'),('Cara 120 MD','Dingemans',120,'cm'),('Special B MD','Dingemans',325,'cd'),
 ('Mroost 1400 MD (Black débittéré)','Dingemans',1400,'blk'),('Wheat Malt MD','Dingemans',3,'wheat'),('Rye Malt MD','Dingemans',7,'rye'),
 ('Pilsen Grand-Est','Malteurop',4.5,'pils'),('Organic Pilsen','Malteurop',3.5,'pils'),('Pale Ale','Malteurop',7,'pale'),
 ('Wheat Malt','Malteurop',3.8,'wheat'),
 ('Extra Pale','Crisp',3.4,'pils'),('Clear Choice Pale','Crisp',4.4,'pils'),('Finest Maris Otter','Crisp',6.4,'mo'),
 ('Floor Malted Maris Otter','Crisp',5.8,'mo'),('Best Ale','Crisp',6.4,'mo'),('Chevallier','Crisp',8,'mo'),('Amber','Crisp',71,'mel'),
 ('Brown','Crisp',135,'choc'),('Crystal 240','Crisp',269,'cd'),('Low Colour Chocolate','Crisp',550,'choc'),('Black','Crisp',1290,'blk'),
]
malts = '\n'.join('%s|%s|%s|%d|-|-|%s' % (n, m, e, PO[f], MT[f]) for n, m, e, f in M)

# ---------- HOUBLONS  (citrus tropical_fruit stone_fruit berry floral grassy herbal spice resin_pin)
HT = dict(
 cas='7,3,1,1,5,1,1,2,3', noble='0,0,0,0,5,2,6,6,0', trop='9,9,5,2,1,0,0,0,3', mos='5,8,6,6,1,0,1,1,5', resin='4,1,1,0,0,1,2,3,9',
 bit='1,0,0,0,1,1,3,2,3', ekg='1,0,0,0,4,2,5,5,0', fug='0,0,0,0,3,3,7,3,1', nz='5,8,4,2,1,0,1,1,3', nzs='3,6,6,2,1,1,1,1,3',
 gal='6,9,8,2,0,0,0,0,2', fde='8,5,3,1,2,0,0,0,1', flo='1,0,1,0,7,1,3,3,0', ama='7,5,5,1,5,0,0,1,2', sim='5,5,3,3,0,1,1,1,9',
 sor='6,2,0,0,2,2,5,2,2', hb='6,4,6,1,3,0,0,0,0', bg='1,0,1,5,1,1,2,3,3', nb='1,0,0,0,2,1,4,3,6', br='4,5,6,8,1,0,0,1,1',
 ara='7,4,2,0,2,2,3,3,2', aur='2,0,1,0,4,1,3,4,1', bc='1,1,2,6,2,1,3,4,0', com='6,2,0,0,1,6,1,1,4', eku='7,7,5,1,0,0,2,0,4',
 eld='5,9,8,2,0,0,0,0,1', lim='6,4,6,1,2,0,0,0,0', wak='5,3,2,0,5,0,1,0,0', rak='4,7,7,1,0,0,0,0,3', pcf='5,2,1,0,4,1,2,2,0',
 mot='7,6,3,0,1,0,1,1,1', koh='5,7,5,0,1,0,2,0,1', gb='2,2,1,0,0,2,3,1,7', ari='5,4,3,2,3,0,1,2,1', per='1,0,0,0,3,1,4,6,1',
 sum='3,1,0,0,0,1,4,1,8', jar='5,5,5,3,1,0,1,3,2', lem='9,2,1,0,2,0,0,0,0', aq='3,7,6,6,0,0,0,1,3', sab='5,8,4,0,0,0,1,0,3',
 vic='5,8,5,1,0,3,1,1,5', eur='6,3,2,0,1,0,2,1,6', sx='6,3,2,0,2,0,1,1,3', wai='6,4,2,0,0,0,2,2,7', mou='4,7,4,2,0,0,2,3,3',
 tri='6,3,2,0,3,1,0,2,2', cash='6,4,2,0,2,0,0,2,2', top='3,5,2,0,0,0,3,1,6', ella='4,3,2,0,5,0,2,5,2', nec='6,9,6,1,0,0,0,0,1',
 hmel='3,4,5,3,1,1,0,1,0', eni='4,6,6,5,0,0,0,0,4', sap='3,0,0,0,5,0,2,3,0', pgem='3,1,1,0,0,1,2,3,8', ecl='5,5,6,1,0,0,1,1,3')
# nom | alpha min | alpha max | famille | prix TTC € | conditionnement g   (prix et conditionnement : autobrasseur.fr, pellets)
H = [
 ('Crystal',3,5.5,'flo',3.99,50),('Sorachi Ace',11,16,'sor',4.35,50),('Flyer',9,12,'bit',11.24,250),('Pilgrim',9,13,'ekg',3.91,50),
 ('Polaris',18,23,'resin',7.85,100),('Hallertau Blanc',9,12,'hb',3.99,50),('Pacific Jade',11.5,14,'cas',4.49,50),('Golding (FR)',4,6,'ekg',3.99,50),
 ('Cascade (FR)',5,7,'cas',3.99,50),('Brewers Gold',6,9,'bg',3.99,50),('Strisselspalt',1.5,3,'noble',3.99,50),('Challenger',6.5,8.5,'ekg',3.99,50),
 ('Magnum',12,14,'bit',3.99,50),('Northern Brewer',6,10,'nb',3.99,50),('Fuggle',3.5,5.5,'fug',5.99,100),('Target',9,12,'bit',3.99,50),
 ('Nugget',11,14,'resin',3.99,50),('Barbe Rouge',7,9,'br',3.99,50),('Aramis',7.5,9,'ara',3.99,50),('Aurora (Super Styrian)',7,9,'aur',3.65,50),
 ('Bramling Cross',5,7,'bc',3.99,50),('East Kent Golding',4,6,'ekg',3.85,50),('Comet',9,12,'com',4.25,50),('Ekuanot',13,15.5,'eku',4.25,50),
 ('Azacca',14,16,'trop',4.45,50),('CTZ (Columbus)',14,17.5,'resin',4.25,50),('El Dorado',14,16,'eld',4.85,50),('Wai-iti',2.5,3.5,'lim',4.49,50),
 ('Willamette',4,6,'fug',3.99,50),('Warrior',15,17,'bit',3.99,50),('Wakatu',6,8.5,'wak',4.49,50),('Rakau',10,11.5,'rak',4.49,50),
 ('Pacifica',5,6.5,'pcf',4.49,50),('Motueka',6.5,7.5,'mot',4.49,50),('Kohatu',6,7.5,'koh',4.49,50),('Green Bullet',11,14,'gb',4.49,50),
 ('Dr Rudi',10,12,'nz',4.49,50),('Centennial',9.5,11.5,'cas',4.25,50),('Mosaic',10.5,13.5,'mos',4.45,50),('Cascade (US)',4.5,7,'cas',3.99,50),
 ('Amarillo',8,11,'ama',4.25,50),('Chinook',11,14,'resin',3.99,50),('Simcoe',12,14,'sim',4.45,50),('Citra',11,14,'trop',4.35,50),
 ('Ariana',9,12,'ari',4.25,50),('Mandarina Bavaria',7,10,'fde',3.95,50),('Hallertau Mittelfrüh',3,5.5,'noble',3.99,50),('Tettnang',3.5,5.5,'noble',3.95,50),
 ('Saaz (CZ)',2.5,4.5,'noble',5.89,100),('Sladek',4.5,6.5,'noble',3.45,50),('Archer',4.5,6,'ekg',3.99,50),('Perle',6,9,'per',3.99,50),
 ('Herkules',12,17,'bit',3.95,50),('Summit',16,19,'sum',3.98,100),('Jarrylo',14,16,'jar',4.95,50),('Lubelski',3,4.5,'noble',3.85,50),
 ('First Gold',6.5,8.5,'ekg',7.55,100),('Lemondrop',5,7,'lem',4.35,50),('African Queen',12,14,'aq',4.73,100),('Sabro',12,16,'sab',7.99,100),
 ('Vic Secret',14,17,'vic',5.25,50),('Eureka',17,20,'eur',4.95,50),('Idaho 7',12,14,'trop',4.25,50),('Southern Cross',11,14,'sx',7.49,100),
 ('Sticklebrack',6,9,'nz',4.49,50),('Taiheke',6,8,'nz',4.49,50),('Waimea',15,19,'wai',4.49,50),('Moutere',16,19,'mou',4.49,50),
 ('Triskel',7.5,9,'tri',3.99,50),('Galaxy',13,15,'gal',4.75,50),('Cashmere',7,9.1,'cash',4.25,50),('Topaz',14,18,'top',4.49,50),
 ('Tradition',5,7,'noble',3.96,100),('Pacific Gem',13,15,'pgem',4.49,50),('Superdelic',9,11,'nz',4.49,50),('Eclipse',13,15,'ecl',5.25,50),
 ('Ella',13.5,16,'ella',5.25,50),('Nectaron',9,12.5,'nec',4.85,50),('Huell Melon',5,7.5,'hmel',3.95,50),('Enigma',13,17.5,'eni',4.49,50),
 ('Savinjski Golding',4,6,'ekg',3.99,50),('Ahtanum',5,6.5,'cas',4.95,50),('Hallertau Hersbrucker',2,5,'noble',3.99,50),
 ('Nelson Sauvin',12,13,'nzs',5.25,50),('Saphir',2,4.5,'sap',6.99,100),
]
hops = '\n'.join('%s|%s|%s|%s,%.4f' % (n, a, b, HT[f], p / g) for n, a, b, f, p, g in H)

# ---------- LEVURES  (fruits_tropicaux banane pomme_verte clou_girofle acide poivre alcoolise neutre pomme_rouge)  — sachets 11 / 11,5 g
YT = dict(neu='1,0,0,0,0,0,1,9,1', eng='1,0,0,0,0,0,0,6,3', wheat='0,8,0,6,0,2,0,1,0', wit='1,4,0,5,0,6,1,1,0', sai='1,3,0,6,0,8,1,1,0',
 abb='1,5,0,3,0,3,3,1,1', lag='0,0,1,0,0,0,0,9,1', kv='3,1,0,0,0,0,0,7,2', hz='8,1,0,0,0,0,0,2,1', sour='0,0,0,0,9,0,0,1,0',
 fr='0,3,0,0,0,0,1,3,5', tp='7,1,0,0,0,0,0,2,0', t58='0,1,0,3,0,5,1,2,0')
# nom | labo | atténuation min/max | floculation min/max | T° min/max | famille | prix sachet € (autobrasseur.fr)
Y = [
 ('SafAle S-04','Fermentis',72,78,70,90,15,20,'eng',3.05),('SafAle US-05','Fermentis',78,82,30,50,15,22,'neu',3.15),
 ('SafAle S-33','Fermentis',70,75,70,90,15,24,'eng',2.45),('SafAle T-58','Fermentis',70,75,30,50,15,24,'t58',1.99),
 ('SafAle WB-06','Fermentis',73,80,30,50,18,24,'wheat',3.49),('SafAle K-97','Fermentis',77,83,70,90,15,23,'neu',3.05),
 ('SafAle BE-256 (Abbaye)','Fermentis',82,86,60,80,18,25,'abb',4.15),('SafAle BE-134 (Saison)','Fermentis',90,95,30,50,20,30,'sai',3.79),
 ('SafAle W-68','Fermentis',75,82,20,40,18,24,'wheat',2.57),('SafAle BW-20','Fermentis',75,82,30,50,18,24,'wit',2.79),
 ('SafLager S-23','Fermentis',80,84,60,80,9,15,'lag',4.49),('SafLager S-189','Fermentis',78,84,60,80,9,15,'lag',5.25),
 ('SafLager W-34/70','Fermentis',80,84,60,80,9,15,'lag',5.15),('SafLager E-30','Fermentis',80,84,60,80,9,15,'lag',5.35),
 ('LalBrew Abbaye','Lallemand',78,82,60,80,17,25,'abb',3.95),('LalBrew BRY-97','Lallemand',78,82,50,70,18,22,'neu',3.95),
 ('LalBrew Windsor','Lallemand',65,72,20,40,15,22,'fr',3.95),('LalBrew Wit','Lallemand',75,82,30,50,18,24,'wit',3.99),
 ('LalBrew CBC-1','Lallemand',85,95,60,80,15,25,'neu',3.99),('LalBrew Nottingham','Lallemand',78,84,70,90,14,21,'neu',3.95),
 ('LalBrew New England','Lallemand',72,78,30,50,18,23,'hz',3.95),('LalBrew Munich Classic','Lallemand',70,76,30,50,17,22,'wheat',3.95),
 ('LalBrew Verdant IPA','Lallemand',72,78,60,80,18,23,'hz',3.95),('LalBrew Voss Kveik','Lallemand',75,82,60,80,25,40,'kv',3.95),
 ('LalBrew Diamond Lager','Lallemand',80,84,60,80,10,15,'lag',3.99),('LalBrew Farmhouse','Lallemand',75,85,30,50,20,30,'sai',4.15),
 ('WildBrew Philly Sour','Lallemand',70,80,30,50,20,35,'sour',3.99),
 ('Mangrove Jack\'s M44 US West Coast','Mangrove Jack\'s',77,83,60,80,18,22,'neu',3.99),('Mangrove Jack\'s M21 Belgian Wit','Mangrove Jack\'s',72,78,30,50,18,25,'wit',3.95),
 ('Mangrove Jack\'s M47 Belgian Abbey','Mangrove Jack\'s',78,85,60,80,18,25,'abb',3.95),('Mangrove Jack\'s M29 French Saison','Mangrove Jack\'s',80,90,30,50,20,35,'sai',5.25),
 ('Mangrove Jack\'s M36 Liberty Bell','Mangrove Jack\'s',72,78,50,70,18,22,'eng',3.99),('Mangrove Jack\'s M42 New World Strong Ale','Mangrove Jack\'s',78,85,60,80,18,25,'neu',3.99),
 ('Mangrove Jack\'s M54 Californian Lager','Mangrove Jack\'s',73,79,60,80,14,20,'lag',3.95),('Mangrove Jack\'s M76 Bavarian Lager','Mangrove Jack\'s',75,82,60,80,10,15,'lag',5.49),
 ('Mangrove Jack\'s M66 Hophead Ale','Mangrove Jack\'s',77,83,50,70,18,24,'hz',5.15),('Mangrove Jack\'s M20 Bavarian Wheat','Mangrove Jack\'s',72,78,20,40,18,24,'wheat',3.99),
 ('Mangrove Jack\'s M84 Bohemian Lager','Mangrove Jack\'s',72,78,60,80,10,15,'lag',4.75),('Mangrove Jack\'s M12 Kveik CS','Mangrove Jack\'s',75,82,60,80,25,38,'kv',6.25),
 ('Mangrove Jack\'s M24 Versa Lager','Mangrove Jack\'s',75,82,60,80,12,24,'lag',4.25),
 ('WHC Pineapple Passion','WHC Labs',75,82,40,60,18,26,'tp',4.25),('WHC Haze Heaven','WHC Labs',72,78,30,50,18,24,'hz',4.25),
 ('WHC Mango Madness','WHC Labs',75,82,40,60,20,32,'tp',4.85),('WHC High Voltage','WHC Labs',78,84,60,80,20,38,'kv',4.60),
 ('WHC NEIPA Saturated','WHC Labs',72,78,30,50,18,24,'hz',3.95),('WHC Hornindal Kveik','WHC Labs',75,82,60,80,25,38,'kv',4.65),
 ('WHC Old English','WHC Labs',70,76,60,80,18,22,'eng',3.85),('WHC Einstein (German Lager)','WHC Labs',78,84,60,80,10,16,'lag',3.95),
 ('WHC British Pub Ale','WHC Labs',70,76,60,80,18,22,'eng',1.75),('WHC Banana Split (Blé)','WHC Labs',72,78,20,40,18,24,'wheat',3.90),
 ('WHC Après-Ski','WHC Labs',78,84,60,80,10,18,'lag',3.95),
 ('Pinnacle Heritage Pilsner','Pinnacle',78,84,60,80,10,15,'lag',3.50),('Pinnacle Heritage English Ale','Pinnacle',70,76,60,80,18,22,'eng',2.99),
 ('Pinnacle Heritage American Ale','Pinnacle',77,83,50,70,18,22,'neu',2.99),('Pinnacle Crisp Sour','Pinnacle',70,80,30,50,20,35,'sour',3.50),
]
yeasts = '\n'.join('%s|%s|%d|%d|%d|%d|%d|%d|%s,%.2f' % (n, l, a, b, c, d, e, f, YT[t], p) for n, l, a, b, c, d, e, f, t, p in Y)

# ---------- STYLES BJCP 2021 : dev/bjcp/NN.txt (texte intégral relevé sur bjcp.org/style/2021/)
import glob
FIELDS = ['IMP','APP','ARO','FLA','MOU','COM','HIS','ING','CMP']
def rng(v):
    a = re.findall(r'-?\d+(?:\.\d+)?', v)
    return (a[0], a[1]) if len(a) >= 2 else (a[0], a[0]) if a else ('', '')
lines = []
for f in sorted(glob.glob(os.path.join(ROOT, 'dev', 'bjcp', '*.txt'))):
    for blk in open(f, encoding='utf-8').read().split('=== ')[1:]:
        L = blk.strip().split('\n'); code, name = [x.strip() for x in L[0].split('|', 1)]
        d = {}
        for l in L[1:]:
            k, _, v = l.partition(': '); d[k] = v.strip()
        clean = lambda x: x.replace('|', '/').replace('`', "'").replace('\\', '/').replace('${', '$ {')
        row = [code + ' ' + name] + [clean(d.get(k, '')) for k in FIELDS]
        for k in ['IBU', 'SRM', 'OG', 'FG', 'ABV']:
            row += list(rng(d.get(k, '')))
        row.append(clean(d.get('EX', '')))
        lines.append('|'.join(row))
styles = '\n'.join(lines)
head = old[:old.index('const SEED')]
head = re.sub(r'^//.*\n', '', head) if head.startswith('//') else head
out = ('// Données de départ. SOURCES : malts = brewpark.com (EBC publié) ; houblons pellets et levures sachets 11 g = autobrasseur.fr (noms, prix TTC).\n'
       '// Potentiel, alpha-acides, atténuation, floculation, températures et NOTES AROMATIQUES = ESTIMATIONS de brasseur (modifiables dans l\'application).\n'
       '// Fichier généré par dev/gen-data.py\n'
       'const SEED={\nmalts:`' + malts + '`,\nhops:`' + hops + '`,\nyeasts:`' + yeasts + '`,\nstyles:`' + styles + '`,\n' + keep)
open(P, 'w', encoding='utf-8').write(out)
print(len(M), 'malts', len(H), 'houblons', len(Y), 'levures', len(lines), 'styles')
