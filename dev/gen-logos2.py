#!/usr/bin/env python3
"""Propositions de NOMS + logos pour la pico-brasserie (SVG, textes en tracés). Sortie : /tmp/claude-0/x/noms/*.svg + aperçu.
Usage : python3 dev/gen-logos2.py"""
import os,math
HERE=os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE,'gen-logos.py'),encoding='utf8').read().split('L=[]')[0])
OUT='/tmp/claude-0/x/noms';os.makedirs(OUT,exist_ok=True)
N=[]
# 1 — Écume & Fureur : crête de mousse + éclair
b=foam([(60,150,34),(115,120,44),(180,105,50),(245,122,44),(300,150,36),(340,175,26),(150,160,30),(220,160,30)],11)
b+=f'<path d="M222 150 L176 222 H206 L190 268 L256 190 H226 L248 150Z" fill="{INK}" stroke="#fff" stroke-width="6"/>'
b+=text('Anton-Regular.ttf','ÉCUME',104,200,350,340,.03)+text('Bangers-Regular.ttf','& FUREUR',54,200,404,300,.06)
N.append(('ecume-fureur','Écume & Fureur',svg(b,420)))
# 2 — Mousse Machine : engrenage + pinte
pts=[]
for i in range(480):
    t=i/480*2*math.pi;r=170+(16 if math.cos(12*t)>0 else 0);pts.append(f'{200+r*math.cos(t):.1f},{200+r*math.sin(t):.1f}')
b=f'<polygon points="{" ".join(pts)}" fill="{INK}"/><circle cx="200" cy="200" r="140" fill="#fff"/><circle cx="200" cy="200" r="150" fill="none" stroke="#fff" stroke-width="5"/>'
b+=f'<path d="M158 205 H242 L232 282 H168Z" fill="{INK}"/>'+foam([(174,194,15),(200,184,20),(228,194,16)],7)
b+=text('BlackOpsOne-Regular.ttf','MOUSSE',48,200,150,175,.02)+text('BlackOpsOne-Regular.ttf','MACHINE',40,200,326,165,.02)
N.append(('mousse-machine','Mousse Machine',svg(b)))
# 3 — Houblon Rock Club : houblon à lunettes noires
rows=[(112,[0],26),(112,[-1,1],26),(146,[-1.5,-.5,.5,1.5],26),(180,[-2,-1,0,1,2],26),(214,[-1.5,-.5,.5,1.5],26),(248,[-1,0,1],26),(278,[-.5,.5],24),(304,[0],22)]
cone=''
for y,xs,w in reversed(rows):
    for k in xs:
        x=200+k*w*1.75;cone+=f'<path d="M{x-w:.1f} {y} Q{x-w:.1f} {y+34} {x:.1f} {y+40} Q{x+w:.1f} {y+34} {x+w:.1f} {y} Q{x:.1f} {y-12} {x-w:.1f} {y}Z" fill="#fff" stroke="{INK}" stroke-width="6"/>'
b=f'<path d="M200 100 q-6 -30 14 -48" fill="none" stroke="{INK}" stroke-width="9"/><path d="M214 56 q38 -14 56 14 q-34 12 -56 -14Z" fill="{INK}"/>'+cone
b+=f'<rect x="140" y="176" width="52" height="34" rx="14" fill="{INK}"/><rect x="208" y="176" width="52" height="34" rx="14" fill="{INK}"/><rect x="186" y="184" width="28" height="7" fill="{INK}"/><path d="M150 184 l14 0 M218 184 l14 0" stroke="#fff" stroke-width="4"/>'
b+=f'<path d="M168 238 Q200 262 234 236" fill="none" stroke="{INK}" stroke-width="7"/>'
b+=text('NewRocker-Regular.ttf','HOUBLON',62,200,376,330,.03,outline='#fff',ow=12)+text('Anton-Regular.ttf','ROCK CLUB',34,200,432,260,.18)
N.append(('houblon-rock-club','Houblon Rock Club',svg(b,445)))
# 4 — Mala Espuma : pinte diabolique
b=f'<path d="M130 160 q-40 -30 -28 -78 q26 24 62 38Z M270 160 q40 -30 28 -78 q-26 24 -62 38Z" fill="{INK}"/>'
b+=f'<path d="M120 170 H280 L258 330 Q256 344 242 344 H158 Q144 344 142 330Z" fill="{INK}" stroke="{INK}" stroke-width="8"/>'+foam([(150,166,28),(200,150,36),(250,166,30)],10)
b+=f'<path d="M156 218 l44 14 l-44 8z M244 218 l-44 14 l44 8z" fill="#fff"/><path d="M162 292 Q200 262 238 292 Q200 280 162 292Z" fill="#fff"/><path d="M172 288 l6 10 l6 -9z M216 288 l6 9 l6 -10z" fill="{INK}"/>'
b+=f'<path d="M258 330 q60 10 50 -40 q-6 -16 14 -22" fill="none" stroke="{INK}" stroke-width="9"/><path d="M322 268 l22 -6 l-12 18z" fill="{INK}"/>'
b+=text('MetalMania-Regular.ttf','MALA ESPUMA',68,200,392,360,.02,outline='#fff',ow=14)
N.append(('mala-espuma','Mala Espuma',svg(b,410)))
# 5 — Pico Loco : sommet à calotte de mousse
b=f'<path d="M30 330 L200 70 L370 330Z" fill="{INK}" stroke="{INK}" stroke-width="10"/><path d="M110 330 L150 268 L180 300 L200 262 L230 300 L262 268 L300 330Z" fill="#fff" opacity=".18"/>'
b+=foam([(200,110,30),(160,132,26),(240,132,26),(122,160,22),(278,160,22),(180,150,24),(222,150,24)],10)
b+=eye(172,222,20,166,228)+eye(232,222,20,240,214)+f'<path d="M168 284 Q202 316 238 280 Q202 296 168 284Z" fill="#fff"/>'
b+=text('Rye-Regular.ttf','PICO LOCO',86,200,396,350,.02,outline='#fff',ow=14)
N.append(('pico-loco','Pico Loco',svg(b,415)))
# 6 — Chaos Mousseux : explosion
pts=[]
for i in range(32):
    r=190 if i%2==0 else 118;a=i/32*2*math.pi;pts.append(f'{200+r*math.cos(a):.1f},{200+r*math.sin(a):.1f}')
b=f'<polygon points="{" ".join(pts)}" fill="{INK}" stroke="{INK}" stroke-width="8"/><circle cx="200" cy="200" r="112" fill="#fff"/>'
b+=foam([(160,120,24),(200,108,30),(242,120,24)],8)
b+=text('Anton-Regular.ttf','CHAOS',92,200,222,200,.03)+text('Bangers-Regular.ttf','MOUSSEUX',44,200,276,200,.04)
N.append(('chaos-mousseux','Chaos Mousseux',svg(b)))
for i,n,s in N:open(f'{OUT}/{i}.svg','w',encoding='utf8').write(s.replace('<svg ','<svg width="800" ',1).replace('viewBox','height="800" viewBox',1) if False else s)
open('/tmp/claude-0/x/noms_prev.html','w',encoding='utf8').write('<body style="margin:0;background:#ddd;font:bold 18px sans-serif;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:10px">'+''.join(f'<div style="background:#fff;padding:8px"><div>{s}</div><div style="text-align:center;padding-top:4px">{n}</div></div>' for i,n,s in N)+'</body>')
