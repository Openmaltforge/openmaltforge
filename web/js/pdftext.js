/* Extraction de texte d'un PDF (sans bibliothèque externe, fonctionne hors ligne).
   pdfExtract(ArrayBuffer) → Promise<[{lines:[{y,items:[{x,x1,s,size}],text}]}]> : une entrée par page, lignes de haut en bas, éléments de gauche à droite.
   Gère : flux FlateDecode, flux d'objets (ObjStm), polices Type0/Identity-H (ToUnicode) et polices simples, positionnement (cm, Tm, Td, TJ…).
   Ne lit ni les PDF chiffrés ni les images numérisées (pas d'OCR). */
const pdfLatin = u8 => {
  let s = '';
  for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
  return s;
};
async function pdfInflate(u8) {
  const ds = new DecompressionStream('deflate'),
    w = ds.writable.getWriter();
  w.write(u8);
  w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}
/* ---- analyseur d'objets PDF : nombres, noms ('/Nom'), chaînes ({s}), références ({r}), tableaux, dictionnaires ---- */
function pdfParse(s, i) {
  const ws = /[\s\0]/;
  while (i < s.length) {
    const c = s[i];
    if (ws.test(c)) i++;
    else if (c === '%') {
      while (i < s.length && s[i] !== '\n' && s[i] !== '\r') i++;
    } else break;
  }
  const c = s[i];
  if (c === '<' && s[i + 1] === '<') {
    i += 2;
    const d = {};
    while (i < s.length) {
      while (i < s.length && ws.test(s[i])) i++;
      if (s[i] === '>' && s[i + 1] === '>') {
        i += 2;
        break;
      }
      const k = pdfParse(s, i);
      i = k[1];
      if (typeof k[0] !== 'string' || k[0][0] !== '/') continue;
      const v = pdfParse(s, i);
      i = v[1];
      d[k[0].slice(1)] = v[0];
    }
    return [d, i];
  }
  if (c === '[') {
    i++;
    const a = [];
    while (i < s.length) {
      while (i < s.length && ws.test(s[i])) i++;
      if (s[i] === ']') {
        i++;
        break;
      }
      const v = pdfParse(s, i);
      if (v[1] === i) break;
      a.push(v[0]);
      i = v[1];
    }
    return [a, i];
  }
  if (c === '/') {
    let j = i + 1;
    while (j < s.length && !/[\s\0()<>[\]{}\/%]/.test(s[j])) j++;
    return ['/' + s.slice(i + 1, j).replace(/#([0-9a-fA-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16))), j];
  }
  if (c === '(') {
    let d = 1,
      j = i + 1,
      o = '';
    while (j < s.length && d > 0) {
      const x = s[j];
      if (x === '\\') {
        const n = s[j + 1];
        if (/[0-7]/.test(n)) {
          let k = j + 1,
            v = '';
          while (k < j + 4 && /[0-7]/.test(s[k])) v += s[k++];
          o += String.fromCharCode(parseInt(v, 8) & 255);
          j = k;
          continue;
        }
        o += { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' }[n] ?? (n === '\n' || n === '\r' ? '' : n);
        j += 2;
        continue;
      }
      if (x === '(') d++;
      else if (x === ')') {
        d--;
        if (!d) {
          j++;
          break;
        }
      }
      o += x;
      j++;
    }
    return [{ s: o }, j];
  }
  if (c === '<') {
    const j = s.indexOf('>', i);
    let h = s.slice(i + 1, j).replace(/\s/g, '');
    if (h.length % 2) h += '0';
    let o = '';
    for (let k = 0; k < h.length; k += 2) o += String.fromCharCode(parseInt(h.substr(k, 2), 16));
    return [{ s: o }, j + 1];
  }
  const m = /^[+-]?(\d+\.?\d*|\.\d+)/.exec(s.slice(i, i + 40));
  if (m) {
    const r = /^(\d+)\s+(\d+)\s+R(?![A-Za-z])/.exec(s.slice(i, i + 40));
    if (r) return [{ r: +r[1] }, i + r[0].length];
    return [parseFloat(m[0]), i + m[0].length];
  }
  const w = /^[A-Za-z]+/.exec(s.slice(i, i + 10));
  if (w) {
    const t = w[0];
    return [t === 'true' ? true : t === 'false' ? false : t === 'null' ? null : t, i + t.length];
  }
  return [null, i + 1];
}
/* ---- lecture de la structure : objets, flux, pages ---- */
async function pdfDoc(buf) {
  const u8 = new Uint8Array(buf),
    s = pdfLatin(u8);
  if (s.slice(0, 5) !== '%PDF-') throw new Error('ce fichier n’est pas un PDF');
  if (/\/Encrypt\b/.test(s.slice(-2048))) throw new Error('PDF chiffré : lecture impossible');
  const objs = new Map(),
    re = /(?:^|[\s>])(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(s))) {
    const num = +m[1],
      st = m.index + m[0].length,
      eo = s.indexOf('endobj', st),
      si = s.indexOf('stream', st);
    let o = {};
    if (si >= 0 && (eo < 0 || si < eo)) {
      const dv = pdfParse(s, st)[0];
      let ds = si + 6;
      if (s[ds] === '\r') ds++;
      if (s[ds] === '\n') ds++;
      const ee = s.indexOf('endstream', ds);
      let de = ee < 0 ? s.length : ee;
      if (s[de - 1] === '\n') de--;
      if (s[de - 1] === '\r') de--;
      o = { v: dv, raw: u8.subarray(ds, de) };
      re.lastIndex = ee < 0 ? s.length : ee + 9;
    } else {
      o = { v: pdfParse(s, st)[0] };
      re.lastIndex = eo < 0 ? s.length : eo + 6;
    }
    objs.set(num, o);
  }
  const get = x => {
    let g = 0;
    while (x && typeof x === 'object' && 'r' in x && g++ < 20) {
      const o = objs.get(x.r);
      x = o ? o.v : null;
    }
    return x;
  };
  const data = async x => {
    const o = x && x.r !== undefined ? objs.get(x.r) : null;
    if (!o || !o.raw) return '';
    const d = get(o.v) || {};
    let f = get(d.Filter);
    if (Array.isArray(f)) f = get(f[0]);
    let b = o.raw;
    if (f === '/FlateDecode' || f === '/Fl') {
      try {
        b = await pdfInflate(b);
      } catch (e) {
        return '';
      }
    } else if (f && f !== '/ASCIIHexDecode') {
      return '';
    }
    return pdfLatin(b);
  };
  for (const [n, o] of [...objs]) {
    const d = o.v;
    if (d && d.Type === '/ObjStm' && o.raw) {
      const t = await data({ r: n }),
        N = get(d.N),
        F = get(d.First),
        h = t.slice(0, F).trim().split(/\s+/).map(Number);
      for (let k = 0; k < N; k++) {
        const on = h[2 * k],
          off = h[2 * k + 1];
        if (!objs.has(on)) objs.set(on, { v: pdfParse(t, F + off)[0] });
      }
    }
  }
  return { objs, get, data, s };
}
function pdfPagesList(D) {
  const { objs, get, s } = D;
  let root = null;
  const mr = /\/Root\s+(\d+)\s+\d+\s+R/.exec(s);
  if (mr) root = get({ r: +mr[1] });
  if (!root)
    for (const o of objs.values())
      if (o.v && o.v.Type === '/Catalog') {
        root = o.v;
        break;
      }
  const pages = [],
    walk = (n, inh) => {
      n = get(n);
      if (!n || typeof n !== 'object') return;
      const res = n.Resources !== undefined ? n.Resources : inh;
      if (Array.isArray(n.Kids)) {
        n.Kids.forEach(k => walk(k, res));
      } else pages.push({ p: n, res });
    };
  if (root && root.Pages) walk(root.Pages, null);
  if (!pages.length)
    for (const o of objs.values()) if (o.v && o.v.Type === '/Page') pages.push({ p: o.v, res: o.v.Resources });
  return pages;
}
/* ---- polices : code → texte, largeur ---- */
async function pdfFont(D, fref) {
  const { get, data } = D,
    f = get(fref) || {},
    o = { two: false, map: null, w: {}, dw: 1000, first: 0, ws: null };
  const sub = get(f.Subtype);
  if (sub === '/Type0') {
    o.two = true;
    const df = get((get(f.DescendantFonts) || [])[0]) || {};
    o.dw = get(df.DW) ?? 1000;
    const W = get(df.W) || [];
    for (let i = 0; i < W.length; ) {
      const a = get(W[i]),
        b = get(W[i + 1]);
      if (Array.isArray(b)) {
        b.forEach((x, k) => (o.w[a + k] = get(x)));
        i += 2;
      } else {
        const c = get(W[i + 2]);
        for (let k = a; k <= b; k++) o.w[k] = c;
        i += 3;
      }
    }
  } else {
    o.first = get(f.FirstChar) || 0;
    o.ws = (get(f.Widths) || []).map(get);
    o.dw = (get(f.FontDescriptor) && get(get(f.FontDescriptor).MissingWidth)) || 500;
  }
  if (f.ToUnicode) {
    const t = await data(f.ToUnicode);
    o.map = new Map();
    const u = h => {
      let r = '';
      for (let i = 0; i < h.length; i += 4) r += String.fromCharCode(parseInt(h.substr(i, 4), 16));
      return r;
    };
    for (const b of t.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))
      for (const x of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) o.map.set(parseInt(x[1], 16), u(x[2]));
    for (const b of t.matchAll(/beginbfrange([\s\S]*?)endbfrange/g))
      for (const x of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(\[[^\]]*\]|<[0-9a-fA-F]+>)/g)) {
        const lo = parseInt(x[1], 16),
          hi = parseInt(x[2], 16);
        if (x[3][0] === '[') {
          [...x[3].matchAll(/<([0-9a-fA-F]+)>/g)].forEach((y, k) => o.map.set(lo + k, u(y[1])));
        } else {
          const d = x[3].slice(1, -1);
          for (let k = lo; k <= hi; k++) {
            const base = parseInt(d.slice(-4), 16) + (k - lo);
            o.map.set(k, u(d.slice(0, -4) + base.toString(16).padStart(4, '0')));
          }
        }
      }
  }
  return o;
}
/* ---- interprète le flux de contenu d'une page ---- */
function pdfContent(txt, fonts) {
  const items = [],
    ws = /[\s\0]/;
  let i = 0,
    ops = [],
    ctm = [1, 0, 0, 1, 0, 0],
    stack = [],
    tm = [1, 0, 0, 1, 0, 0],
    tlm = tm,
    font = null,
    fs = 1,
    tc = 0,
    tw = 0,
    tz = 1,
    tl = 0;
  const mul = (a, b) => [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5]
  ];
  const show = str => {
    if (!font) return;
    const m = mul(tm, ctm);
    let out = '',
      adv = 0;
    const x0 = m[4],
      y0 = m[5];
    const n = font.two ? 2 : 1;
    for (let k = 0; k + n <= str.length; k += n) {
      const code = font.two ? (str.charCodeAt(k) << 8) | str.charCodeAt(k + 1) : str.charCodeAt(k);
      let ch = font.map && font.map.get(code);
      if (ch === undefined) ch = font.map ? '' : code >= 32 ? String.fromCharCode(code) : '';
      const w = font.two ? (font.w[code] ?? font.dw) : ((font.ws && font.ws[code - font.first]) ?? font.dw);
      out += ch;
      adv += ((w / 1000) * fs + tc + (!font.two && code === 32 ? tw : 0)) * tz;
    }
    const mm = mul([1, 0, 0, 1, adv, 0], mul(tm, ctm));
    if (out.trim()) items.push({ x: x0, x1: mm[4], y: y0, s: out, size: Math.abs(fs * Math.hypot(m[2], m[3])) || fs });
    tm = mul([1, 0, 0, 1, adv, 0], tm);
  };
  const num = k => (ops.length >= k ? ops.slice(-k).map(Number) : null);
  while (i < txt.length) {
    while (i < txt.length && ws.test(txt[i])) i++;
    if (i >= txt.length) break;
    const c = txt[i];
    if (c === '%') {
      while (i < txt.length && txt[i] !== '\n' && txt[i] !== '\r') i++;
      continue;
    }
    if (c === '/' || c === '(' || c === '[' || c === '<' || /[0-9+\-.]/.test(c)) {
      if (c === '<' && txt[i + 1] === '<') {
        let d = 0;
        while (i < txt.length) {
          if (txt[i] === '<' && txt[i + 1] === '<') {
            d++;
            i += 2;
          } else if (txt[i] === '>' && txt[i + 1] === '>') {
            d--;
            i += 2;
            if (!d) break;
          } else i++;
        }
        ops.push(null);
        continue;
      }
      const v = pdfParse(txt, i);
      ops.push(v[0]);
      i = v[1];
      if (ops.length > 64) ops.shift();
      continue;
    }
    let j = i;
    while (j < txt.length && !/[\s\0()<>[\]{}\/%]/.test(txt[j])) j++;
    if (j === i) j = i + 1;
    const op = txt.slice(i, j);
    i = j;
    switch (op) {
      case 'q':
        stack.push(ctm.slice());
        break;
      case 'Q':
        ctm = stack.pop() || ctm;
        break;
      case 'cm': {
        const a = num(6);
        if (a) ctm = mul(a, ctm);
        break;
      }
      case 'BT':
        tm = [1, 0, 0, 1, 0, 0];
        tlm = tm;
        break;
      case 'Tf': {
        const nm = ops[ops.length - 2];
        font = fonts[typeof nm === 'string' ? nm.slice(1) : ''] || null;
        fs = Number(ops[ops.length - 1]) || 1;
        break;
      }
      case 'Tc':
        tc = Number(ops[ops.length - 1]) || 0;
        break;
      case 'Tw':
        tw = Number(ops[ops.length - 1]) || 0;
        break;
      case 'Tz':
        tz = (Number(ops[ops.length - 1]) || 100) / 100;
        break;
      case 'TL':
        tl = Number(ops[ops.length - 1]) || 0;
        break;
      case 'Td': {
        const a = num(2);
        if (a) {
          tlm = mul([1, 0, 0, 1, a[0], a[1]], tlm);
          tm = tlm;
        }
        break;
      }
      case 'TD': {
        const a = num(2);
        if (a) {
          tl = -a[1];
          tlm = mul([1, 0, 0, 1, a[0], a[1]], tlm);
          tm = tlm;
        }
        break;
      }
      case 'Tm': {
        const a = num(6);
        if (a) {
          tm = a;
          tlm = a;
        }
        break;
      }
      case 'T*':
        tlm = mul([1, 0, 0, 1, 0, -tl], tlm);
        tm = tlm;
        break;
      case 'Tj': {
        const a = ops[ops.length - 1];
        if (a && a.s !== undefined) show(a.s);
        break;
      }
      case "'": {
        tlm = mul([1, 0, 0, 1, 0, -tl], tlm);
        tm = tlm;
        const a = ops[ops.length - 1];
        if (a && a.s !== undefined) show(a.s);
        break;
      }
      case '"': {
        tlm = mul([1, 0, 0, 1, 0, -tl], tlm);
        tm = tlm;
        const a = ops[ops.length - 1];
        if (a && a.s !== undefined) show(a.s);
        break;
      }
      case 'TJ': {
        const a = ops[ops.length - 1];
        if (Array.isArray(a))
          a.forEach(e => {
            if (e && e.s !== undefined) show(e.s);
            else if (typeof e === 'number') tm = mul([1, 0, 0, 1, (-e / 1000) * fs * tz, 0], tm);
          });
        break;
      }
      case 'BI': {
        const k = txt.indexOf('EI', i);
        i = k < 0 ? txt.length : k + 2;
        break;
      }
    }
    ops = [];
  }
  return items;
}
/* ---- lignes : regroupe par ordonnée, trie par abscisse, insère les espaces selon les écarts ---- */
function pdfLines(items) {
  const L = [];
  const its = items.map(t => ({ ...t, yd: -t.y })).sort((a, b) => a.yd - b.yd || a.x - b.x);
  for (const t of its) {
    const ln = L.find(l => Math.abs(l.y - t.yd) <= Math.max(1.5, 0.45 * Math.min(l.size, t.size)));
    if (ln) {
      ln.items.push(t);
      ln.y = (ln.y * ln.items.length + t.yd) / (ln.items.length + 1);
    } else L.push({ y: t.yd, size: t.size, items: [t] });
  }
  L.sort((a, b) => a.y - b.y);
  L.forEach(l => {
    l.items.sort((a, b) => a.x - b.x);
    let s = '',
      p = null;
    for (const t of l.items) {
      if (p) {
        const gap = t.x - p.x1;
        if (gap > 0.18 * Math.min(t.size, p.size) && !/\s$/.test(s) && !/^\s/.test(t.s)) s += ' ';
      }
      s += t.s;
      p = t;
    }
    l.text = s.replace(/\s+/g, ' ').trim();
    l.items = l.items.map(t => ({ x: t.x, x1: t.x1, s: t.s, size: t.size }));
  });
  return L.filter(l => l.text);
}
async function pdfExtract(buf) {
  const D = await pdfDoc(buf),
    pg = pdfPagesList(D),
    out = [];
  if (!pg.length) throw new Error('aucune page lisible dans ce PDF');
  const cache = new Map();
  for (const { p, res } of pg) {
    const r = D.get(res) || {},
      fd = D.get(r.Font) || {},
      fonts = {};
    for (const [k, v] of Object.entries(fd)) {
      const id = v && v.r !== undefined ? v.r : k;
      if (!cache.has(id)) cache.set(id, await pdfFont(D, v));
      fonts[k] = cache.get(id);
    }
    let cs = D.get(p.Contents);
    const parts = Array.isArray(cs) ? cs : [p.Contents];
    let txt = '';
    for (const c of parts) txt += (await D.data(c)) + '\n';
    out.push({ lines: pdfLines(pdfContent(txt, fonts)) });
  }
  return out;
}
