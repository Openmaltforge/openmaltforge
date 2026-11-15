import re,json
m=open('weyermann_raw.md').read()
parts=re.split(r'\n# ([^\n]+)',m)
rows={}
fl=lambda s:float(s.replace(',','.'))
for k in range(1,len(parts),2):
    h=re.sub(r'<[^>]+>','',parts[k]).replace('®','').strip(); body=parts[k+1]
    if 'AROMA WHEEL' in h.upper() or not re.search(r'(?i)weyermann|barke|pilsner|malt',h): continue
    name=re.sub(r'(?i)^weyermann\s*','',h).strip()
    name=re.sub(r'(?i)extra pale premium pilsner malt\s+(?=\S)','',name) if len(name)>40 else name
    sens=re.search(r'\*\*Sensory:\*\*\s*(.+?)(?:\n\n|\*\*Special|\*\*Recomm)',body,re.S)
    col=re.search(r'Color:\*\*\s*([\d.,]+)\s*[–-]\s*([\d.,]+)\s*EBC',body) or re.search(r'Color \(EBC\)\s*\|\s*([\d.,]+)\s*\|\s*([\d.,]+)',body)
    ext=re.search(r'Extract \(dry substance\)\s*\|\s*([\d.,]*)\s*\|\s*([\d.,]*)',body)
    if not(sens and col and ext and (ext.group(1) or ext.group(2))): continue
    e=ext.group(1) or ext.group(2)
    key=re.sub(r'[^a-z0-9]','',name.lower())
    rows.setdefault(key,dict(name=name.title().replace('Ebc','EBC'),ebc=(fl(col.group(1))+fl(col.group(2)))/2,ebc_rng=col.groups(),extract=fl(e),sens=re.sub(r'\s+',' ',sens.group(1)).strip()))
json.dump(list(rows.values()),open('weyermann_list.json','w'),ensure_ascii=False,indent=0)
print(len(rows))
for r in rows.values(): print(r['name'][:45],'|',r['ebc_rng'],'|',r['extract'],'|',r['sens'][:70])
