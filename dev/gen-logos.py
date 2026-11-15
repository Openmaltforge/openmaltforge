#!/usr/bin/env python3
"""Génère web/js/logos.js : propositions de logos « Espumaloca » (SVG vectoriels, textes convertis en tracés
à partir des polices SIL OFL du dossier fonts/ → aucun besoin de police à l'affichage).
Usage : python3 dev/gen-logos.py"""
import math, os, json
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
INK='#111'
_F={}
def font(n):
    if n not in _F:
        f=TTFont(os.path.join(ROOT,'fonts',n));_F[n]=(f,f.getGlyphSet(),f.getBestCmap(),f['head'].unitsPerEm,f['hmtx'])
    return _F[n]
def glyph(fn,ch,size):
    f,gs,cm,upm,hm=font(fn);g=cm.get(ord(ch));
    if g is None:return '',size*.4
    s=size/upm;p=SVGPathPen(gs,ntos=lambda v:('%.1f'%v).rstrip('0').rstrip('.'));gs[g].draw(TransformPen(p,(s,0,0,-s,0,0)));return p.getCommands(),hm[g][0]*s
def width(fn,text,size,ls=0):return sum(glyph(fn,c,size)[1]+ls for c in text)-ls
def text(fn,t,size,cx,y,maxw=None,ls=0,fill=INK,outline=None,ow=10):
    if maxw:
        w=width(fn,t,size,ls)
        if w>maxw:size*=maxw/w;ls*=maxw/w
    w=width(fn,t,size,ls);x=cx-w/2;d=''
    for c in t:
        p,a=glyph(fn,c,size)
        if p:d+=f'<path d="{p}" transform="translate({x:.2f} {y:.2f})"/>'
        x+=a+ls
    g=f'<g fill="{fill}">{d}</g>'
    if outline:g=f'<g fill="{outline}" stroke="{outline}" stroke-width="{ow}" stroke-linejoin="round">{d.replace("<path","<path")}</g>'.replace('<g ','<g transform="translate(0 0)" ',1)+g
    return g
def arc(fn,t,size,cx,cy,R,top=True,fill='#fff',ls=0):
    w=width(fn,t,size,ls);pos=-w/2;out=''
    for c in t:
        p,a=glyph(fn,c,size);mid=pos+a/2
        if p:
            ang=math.degrees(mid/R)*(1 if top else -1)
            base=-R if top else R+ (size*.72)
            out+=f'<path d="{p}" transform="translate({cx} {cy}) rotate({ang:.3f}) translate({-a/2:.2f} {base:.2f})"/>'
        pos+=a+ls
    return f'<g fill="{fill}">{out}</g>'
def foam(circles,sw=12):
    a=''.join(f'<circle cx="{x}" cy="{y}" r="{r}"/>' for x,y,r in circles)
    return f'<g fill="#fff" stroke="{INK}" stroke-width="{sw}">{a}</g><g fill="#fff">{a}</g>'
def svg(body,h=400):return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 {h}" stroke-linecap="round" stroke-linejoin="round">{body}</svg>'
def eye(x,y,r,px,py):return f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff" stroke="{INK}" stroke-width="5"/><circle cx="{px}" cy="{py}" r="{r*.42:.1f}" fill="{INK}"/>'
L=[]
# A — Mousse folle (pinte + mousse aux yeux fous)
b=f'<path d="M118 196 L282 196 L258 335 Q256 348 243 348 L157 348 Q144 348 142 335 Z" fill="{INK}" stroke="{INK}" stroke-width="8"/>'
b+='<path d="M140 215 L150 330" stroke="#fff" stroke-width="5" opacity=".5" fill="none"/>'+''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff"/>' for x,y,r in [(185,300,6),(215,275,4),(235,310,7),(200,250,3),(175,262,4)])
b+=''.join(f'<rect x="{x}" y="185" width="24" height="{h}" rx="12" fill="#fff" stroke="{INK}" stroke-width="6"/>' for x,h in [(126,52),(198,38),(250,60)])
b+=foam([(150,150,38),(205,125,48),(262,152,40),(185,172,36),(235,174,36),(120,188,28),(285,190,28)])
b+=eye(188,140,17,184,146)+eye(240,136,17,246,130)
b+=f'<path d="M180 176 Q215 214 252 172 Q215 190 180 176Z" fill="{INK}" stroke="{INK}" stroke-width="4"/><path d="M198 184 l6 10 l8 -8 z M222 186 l8 8 l5 -12z" fill="#fff"/>'
b+=text('Bangers-Regular.ttf','ESPUMALOCA',74,200,396,360,.02,outline='#fff',ow=14)
L.append(('mousse','Mousse folle',svg(b,420)))
# B — Crâne couronné de mousse, baguettes croisées
b=f'<g stroke="{INK}" stroke-width="18" fill="none"><path d="M60 330 L340 100"/><path d="M340 330 L60 100"/></g><g stroke="#fff" stroke-width="8" fill="none"><path d="M60 330 L340 100"/><path d="M340 330 L60 100"/></g>'
b+=f'<path d="M128 220 C112 112 288 112 272 220 C270 248 252 260 252 282 L148 282 C148 260 130 248 128 220Z" fill="#fff" stroke="{INK}" stroke-width="8"/>'
b+=f'<ellipse cx="168" cy="214" rx="24" ry="28" fill="{INK}"/><ellipse cx="232" cy="214" rx="24" ry="28" fill="{INK}"/><circle cx="172" cy="210" r="6" fill="#fff"/><circle cx="236" cy="210" r="6" fill="#fff"/><path d="M200 236 l-12 26 h24z" fill="{INK}"/>'
b+=f'<rect x="150" y="282" width="100" height="36" rx="8" fill="#fff" stroke="{INK}" stroke-width="7"/>'+''.join(f'<path d="M{x} 284 V316" stroke="{INK}" stroke-width="5"/>' for x in (166,183,200,217,234))
b+=foam([(150,126,32),(190,106,38),(236,112,36),(268,138,28),(128,146,24),(212,138,26),(170,140,26)],11)
b+=''.join(f'<rect x="{x}" y="140" width="20" height="{h}" rx="10" fill="#fff" stroke="{INK}" stroke-width="6"/>' for x,h in [(114,48),(270,56)])
b+=text('MetalMania-Regular.ttf','ESPUMALOCA',72,200,388,360,.02,outline='#fff',ow=14)
L.append(('crane','Crâne en mousse',svg(b,410)))
# C — Badge rond, chope éclair
b=f'<circle cx="200" cy="200" r="190" fill="{INK}"/><circle cx="200" cy="200" r="148" fill="#fff"/><circle cx="200" cy="200" r="140" fill="none" stroke="{INK}" stroke-width="3"/>'
b+=arc('Anton-Regular.ttf','ESPUMALOCA',40,200,200,152,True,'#fff',3)+arc('Anton-Regular.ttf','BIÈRE ARTISANALE',26,200,200,152,False,'#fff',3)
b+=f'<g fill="{INK}"><circle cx="46" cy="200" r="6"/><circle cx="354" cy="200" r="6"/></g>'
b+=f'<path d="M262 215 h28 q22 0 22 28 q0 28 -22 28 h-28" fill="none" stroke="{INK}" stroke-width="14"/><rect x="152" y="190" width="116" height="130" rx="12" fill="{INK}"/>'
b+=foam([(172,184,22),(206,170,28),(244,182,24)],9)
b+='<path d="M214 200 L178 262 H204 L190 310 L240 238 H212 L226 200Z" fill="#fff" stroke="#fff" stroke-width="3"/>'
L.append(('badge','Badge chope-éclair',svg(b)))
# D — Typographique empilé, mousse et gouttes
b=foam([(60,92,30),(110,70,40),(170,80,36),(230,66,44),(290,82,36),(340,96,30),(90,110,24),(200,102,28),(270,108,24)],11)
b+=text('Anton-Regular.ttf','ESPUMA',150,200,255,360,.01,outline='#fff',ow=0)
b+=text('NewRocker-Regular.ttf','LOCA',140,200,372,360,.02)
b+=''.join(f'<rect x="{x}" y="118" width="20" height="{h}" rx="10" fill="#fff" stroke="{INK}" stroke-width="6"/>' for x,h in [(52,22),(150,40),(258,28)])
L.append(('typo','Mot-image Rock',svg(b,420)))
# E — Houblon diabolique
rows=[(112,[0],26),(112,[-1,1],26),(146,[-1.5,-.5,.5,1.5],26),(180,[-2,-1,0,1,2],26),(214,[-1.5,-.5,.5,1.5],26),(248,[-1,0,1],26),(278,[-.5,.5],24),(304,[0],22)]
cone=''
for y,xs,w in reversed(rows):
    for k in xs:
        x=200+k*w*1.75;cone+=f'<path d="M{x-w:.1f} {y} Q{x-w:.1f} {y+34} {x:.1f} {y+40} Q{x+w:.1f} {y+34} {x+w:.1f} {y} Q{x:.1f} {y-12} {x-w:.1f} {y}Z" fill="#fff" stroke="{INK}" stroke-width="6"/>'
b=f'<path d="M200 100 q-6 -30 14 -48" fill="none" stroke="{INK}" stroke-width="9"/><path d="M214 56 q38 -14 56 14 q-34 12 -56 -14Z" fill="{INK}"/>'
b+=f'<path d="M150 120 q-22 -26 -4 -52 q4 30 28 46Z M250 120 q22 -26 4 -52 q-4 30 -28 46Z" fill="{INK}"/>'+cone
b+=eye(172,196,18,167,202)+eye(228,196,18,236,190)+f'<path d="M168 238 Q200 268 234 234 Q200 248 168 238Z" fill="{INK}" stroke="{INK}" stroke-width="4"/><path d="M186 244 l5 9 l7 -7z M208 246 l7 7 l5 -11z" fill="#fff"/>'
b+=text('Rye-Regular.ttf','ESPUMALOCA',64,200,386,360,.02,outline='#fff',ow=14)
L.append(('houblon','Houblon diabolique',svg(b,410)))
# F — Capsule couronne
pts=[]
for i in range(720):
    t=i/720*2*math.pi;r=186+9*math.cos(24*t);pts.append(f'{200+r*math.cos(t):.1f},{200+r*math.sin(t):.1f}')
b=f'<polygon points="{" ".join(pts)}" fill="{INK}"/><circle cx="200" cy="200" r="158" fill="#fff"/><circle cx="200" cy="200" r="148" fill="none" stroke="{INK}" stroke-width="4"/>'
b+=text('Bangers-Regular.ttf','ESPUMA',92,200,215,270,.02,outline='#fff',ow=16)+text('Bangers-Regular.ttf','LOCA',92,200,305,270,.02,outline='#fff',ow=16)
b+=foam([(150,92,22),(188,78,28),(230,86,24),(262,100,18)],8)
L.append(('capsule','Capsule couronne',svg(b)))
out='/* Généré par dev/gen-logos.py — propositions de logos « Espumaloca » (SVG, textes en tracés). */\nconst LOGOS='+json.dumps([{'id':i,'n':n,'svg':s} for i,n,s in L],ensure_ascii=False)+';\n'
open(os.path.join(ROOT,'web','js','logos.js'),'w',encoding='utf8').write(out)
open('/tmp/claude-0/x/logos_prev.html','w',encoding='utf8').write('<body style="margin:0;background:#ccc;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px">'+''.join(f'<div style="background:#fff;padding:6px"><div style="width:100%">{s}</div><b>{n}</b></div>' for i,n,s in L)+'</body>')
print(len(out),'octets')
