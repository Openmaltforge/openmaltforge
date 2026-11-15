import struct, io, sys
import os; os.chdir(os.path.dirname(os.path.abspath(__file__)))
VER=sys.argv[1] if len(sys.argv)>1 else '0.0.0'
from PIL import Image
base=Image.open('icon512.png')
sizes=[16,32,48,64,128,256]
pngs={}
for s in sizes:
    b=io.BytesIO(); base.resize((s,s),Image.LANCZOS).save(b,'PNG',optimize=True); pngs[s]=b.getvalue()
    open(f'icon{s}.png','wb').write(pngs[s])
# .ico
hdr=struct.pack('<HHH',0,1,len(sizes)); off=6+16*len(sizes); ent=b''; data=b''
for s in sizes:
    d=pngs[s]; ent+=struct.pack('<BBBBHHII',s%256,s%256,0,0,1,32,len(d),off+len(data)); data+=d
open('openmaltforge.ico','wb').write(hdr+ent+data)
# .icns (macOS) : entrées PNG ic07 (128), ic08 (256), ic09 (512)
ic=b''
for typ,sz in ((b'ic07',128),(b'ic08',256),(b'ic09',512)):
    d=pngs[sz] if sz in pngs else open('icon512.png','rb').read()
    ic+=typ+struct.pack('>I',len(d)+8)+d
open('openmaltforge.icns','wb').write(b'icns'+struct.pack('>I',len(ic)+8)+ic)
# .syso (ressources Windows : RT_ICON + RT_GROUP_ICON) — COFF amd64
def u16(x):return struct.pack('<H',x)
def u32(x):return struct.pack('<I',x)
icons=[(i+1,pngs[s]) for i,s in enumerate(sizes)]
grp=struct.pack('<HHH',0,1,len(sizes))+b''.join(struct.pack('<BBBBHHIH',s%256,s%256,0,0,1,32,len(pngs[s]),i+1) for i,s in enumerate(sizes))
# arbre : racine -> {3:icônes, 14:groupe} -> id -> langue 0x409 -> donnée
def ver_res():
    def pad(b): return b+b'\0'*((-len(b))%4)
    def u(sz): return (sz+'\0').encode('utf-16-le')
    def node(key,val,typ,children=b''):
        vl=len(val)//2 if typ==1 else len(val)
        raw=pad(b'\0\0'+struct.pack('<HH',vl,typ)+u(key))+val
        raw=pad(raw)+children
        return struct.pack('<H',len(raw))+raw[2:]
    p=[int(x) for x in (VER.split('.')+['0','0','0'])[:4]]
    ffi=struct.pack('<IIIIIIIIIIIII',0xFEEF04BD,0x10000,(p[0]<<16)|p[1],(p[2]<<16)|p[3],(p[0]<<16)|p[1],(p[2]<<16)|p[3],0x3F,0,0x4,1,0,0,0)
    strs=[('CompanyName','OpenMaltForge'),('FileDescription','OpenMaltForge - feuille de calcul de brassage'),('FileVersion',VER),('InternalName','OpenMaltForge'),('OriginalFilename','OpenMaltForge_%s.exe'%VER),('ProductName','OpenMaltForge'),('ProductVersion',VER)]
    sc=b''
    for k,v in strs:
        vv=u(v); sc+=pad(node(k,vv,1))
    sfi=node('StringFileInfo',b'',1,node('040904b0',b'',1,sc))
    vfi=node('VarFileInfo',b'',1,node('Translation',struct.pack('<HH',0x409,0x4b0),0))
    return node('VS_VERSION_INFO',ffi,0,pad(sfi)+vfi)
leaves=[(3,i,d) for i,d in icons]+[(14,1,grp),(16,1,ver_res())]
types=[3,14,16]
def dirb(n_id,entries): # entries: list (id, offset|0x80000000)
    return struct.pack('<IIHHHH',0,0,0,0,0,n_id)+b''.join(u32(i)+u32(o) for i,o in entries)
# calcul des offsets
root_sz=16+8*len(types)
t_dirs={}  # type -> ids
for t,i,d in leaves: t_dirs.setdefault(t,[]).append(i)
pos=root_sz
type_off={}
for t in types:
    type_off[t]=pos; pos+=16+8*len(t_dirs[t])
id_off={}
for t,i,d in leaves:
    id_off[(t,i)]=pos; pos+=16+8
entry_off={}
for t,i,d in leaves:
    entry_off[(t,i)]=pos; pos+=16
data_pos=pos
data_off={}
blob=b''
for t,i,d in leaves:
    data_off[(t,i)]=data_pos+len(blob); blob+=d+b'\0'*((-len(d))%8)
sec=dirb(len(types),[(t,type_off[t]|0x80000000) for t in types])
for t in types: sec+=dirb(len(t_dirs[t]),[(i,id_off[(t,i)]|0x80000000) for i in t_dirs[t]])
for t,i,d in leaves: sec+=dirb(1,[(0x409,entry_off[(t,i)])])
relocs=[]
for t,i,d in leaves:
    relocs.append(len(sec))
    sec+=u32(data_off[(t,i)])+u32(len(d))+u32(0)+u32(0)
sec+=blob
n=len(relocs)
ptr_raw=20+40
ptr_rel=ptr_raw+len(sec)
ptr_sym=ptr_rel+10*n
coff=struct.pack('<HHIIIHH',0x8664,1,0,ptr_sym,1,0,0)
sh=b'.rsrc\0\0\0'+struct.pack('<IIIIIIHHI',0,0,len(sec),ptr_raw,ptr_rel,0,n,0,0xC0000040)
rel=b''.join(struct.pack('<IIH',o,0,3) for o in relocs)  # ADDR32NB vers symbole 0
sym=b'.rsrc\0\0\0'+struct.pack('<IhHBB',0,1,0,3,0)
open('../../cmd/openmaltforge/rsrc_windows_amd64.syso','wb').write(coff+sh+sec+rel+sym+u32(4))
