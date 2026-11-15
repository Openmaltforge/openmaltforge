#!/usr/bin/env python3
"""Levures : jeu de données Beer Maverick (via brewsignal/backend/seed/yeast_strains.json, MIT) -> yeasts_new.csv + CAT.yeasts dans js/catalog.js.
Retenue seulement si : atténuation min/max, floculation (catégorie), température min/max et descriptif publiés.
Floculation catégorielle convertie en % (convention de la bibliothèque). NOTES 0-5 = ESTIMATIONS déduites du descriptif (1re famille citée = 5, puis 4, 3, 2)."""
import re, os, json, unicodedata
D=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.join(D,'..','..')
YA='fruits_tropicaux banane pomme_verte clou_girofle acide poivre alcoolise neutre pomme_rouge'.split()
KW=[ # (famille, expression régulière) ; l'ordre d'apparition dans le texte donne le rang
 ('pomme_verte',r'green apple|acetaldehyde|granny'),
 ('banane',r'banana|isoamyl|bubblegum|bubble gum'),
 ('fruits_tropicaux',r'tropical|pineapple|mango|passion|guava|citrus|orange|lemon|lime|grapefruit|stone fruit|peach|apricot|melon|juicy|papaya|lychee'),
 ('clou_girofle',r'clove|phenol|smok'),
 ('poivre',r'pepper|spic(y|e)'),
 ('acide',r'tart|sour|acid(?!ic? tolerance)|lactic|funk|brett|tangy'),
 ('alcoolise',r'solvent|boozy|alcohol(?! tolera)|hot '),
 ('neutre',r'clean|neutral|crisp|low[- ]ester|minimal ester|subtle|mild|clear'),
 ('pomme_rouge',r'apple|pear|cherry|berry|berries|plum|raisin|fig\b|dark fruit|red fruit|fruity|fruit forward|ester|rose|floral|honey'),
]
FL={'very_low':(10,30),'low':(20,40),'medium_low':(30,50),'medium':(30,50),'medium_high':(60,80),'high':(70,90),'very_high':(80,95)}
def norm(n): n=unicodedata.normalize('NFD',n.lower()); return re.sub(r'[^a-z0-9]','',''.join(c for c in n if not unicodedata.combining(c)))
def scores(t):
    t=t.lower(); hits=[]
    for c,rx in KW:
        m=re.search(rx,t)
        if m: hits.append((m.start(),c))
    hits.sort(); sc=dict.fromkeys(YA,0)
    for i,(_,c) in enumerate(hits): sc[c]=5 if i==0 else 4 if i==1 else 3 if i==2 else 2
    return sc,len(hits)
SH={'Omega Yeast':'Omega','Wyeast':'Wyeast','White Labs':'White Labs','Escarpment Labs':'Escarpment','The Yeast Bay':'Yeast Bay','GigaYeast':'GigaYeast','Imperial Yeast':'Imperial','Bootleg Biology':'Bootleg','East Coast Yeast':'East Coast','Mangrove Jack':"Mangrove Jack's",'Fermentis':'Fermentis','Lallemand':'Lallemand'}
old=open(os.path.join(ROOT,'js','data.js'),encoding='utf-8').read(); ys=old[old.index('yeasts:`')+8:]; ys=ys[:ys.index('`')]
ex=[l.split('|') for l in ys.split('\n') if l]; exist={norm(a[0]) for a in ex}
exist_ids={norm(re.sub(r'^(SafAle|SafLager|LalBrew|SafBrew)\s*','',a[0])) for a in ex}
src=json.load(open(os.path.join(D,'yeast_strains_src.json'),encoding='utf-8'))['strains']
rows=[];skip=[]
for s in src:
    nm=s['name'].strip()
    if re.search('[ÃÂâ]',nm):
        try: nm=nm.encode('cp1252').decode('utf-8')
        except Exception: nm=nm.encode('latin1','ignore').decode('utf-8','ignore')
    nm=nm.replace('Â ','').replace('Â','')

    if nm.isupper() or nm.islower(): nm=nm.title()
    nm=nm.replace('â€™',"'").replace('’',"'")
    pid=(s.get('product_id') or '').strip(); prod=SH.get(s['producer'],s['producer'])
    full=' '.join(x for x in [prod,pid if pid and norm(pid) not in norm(nm) else '',nm] if x)
    if s['producer']=='Mangrove Jack' or re.search(r'BE-(134|256)',nm): skip.append((full,'déjà présent'));continue
    if s['type']=='bacteria': skip.append((full,'bactérie (pas une levure)'));continue
    fl=(s.get('flocculation') or '').lower().replace('-','_')
    if fl not in FL: skip.append((full,'floculation non publiée'));continue
    a0,a1,t0,t1=(s.get(k) for k in('attenuation_low','attenuation_high','temp_low','temp_high'))
    if not(a0 and a1 and t0 and t1) or a0>a1 or t0>t1: skip.append((full,'atténuation ou température incomplète'));continue
    sc,n=scores(s.get('description') or '')
    if n<1: skip.append((full,'descriptif sans arôme exploitable'));continue
    if norm(full) in exist or norm(nm) in exist or norm(nm) in exist_ids or (pid and norm(pid) in exist_ids): skip.append((full,'déjà présent'));continue
    exist.add(norm(full))
    f0,f1=FL[fl]; g=lambda x:('%g'%x)
    rows.append((full,s['producer'],g(a0),g(a1),f0,f1,g(t0),g(t1),sc))
rows.sort(key=lambda r:(r[1],r[0]))
csv=['name;labo;att_min;att_max;floc_min;floc_max;t_min;t_max;'+';'.join(YA)+';prix_sachet;source']
seed=[]
for n,lab,a0,a1,f0,f1,t0,t1,sc in rows:
    v=[str(sc[k]) for k in YA]
    csv.append(';'.join([n,lab,a0,a1,str(f0),str(f1),t0,t1]+v+['','beermaverick.com']))
    seed.append('|'.join([n,lab,a0,a1,str(f0),str(f1),t0,t1,','.join(v)+',']))
open(os.path.join(D,'yeasts_new.csv'),'w',encoding='utf-8-sig',newline='').write('\r\n'.join(csv)+'\r\n')
p=os.path.join(ROOT,'js','catalog.js'); cat=open(p,encoding='utf-8').read()
cat=re.sub(r',yeasts:`.*?`','',cat,flags=re.S)
cat=cat.replace('`};','`,yeasts:`'+'\n'.join(seed)+'`};')
cat=cat.replace('Castle Malting + Weyermann, EBC/extrait publiés)','Castle Malting + Weyermann, EBC/extrait publiés ; levures : Beer Maverick)')
open(p,'w',encoding='utf-8').write(cat)
print(len(rows),'retenues;',len(skip),'écartées'); 
import collections; print(collections.Counter(r for _,r in skip)); print(collections.Counter(r[1] for r in rows))
for s in skip:
    if s[1]=='déjà présent' or 'descriptif' in s[1]: print(' -',*s)
