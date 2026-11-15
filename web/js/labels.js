/* Étiquettes de bouteilles — planche A4, formats multiples, QR Code (lib/qrcode.js), logo (Paramètres).
   Chargé AVANT app.js : ne dépend des globales de app.js (S, compute, find, hh, nf, fd, $, main, save) qu'à l'appel. */
const LBL_PAGE = { W: 210, H: 297, M: 6, G: 1.5 };
/* ---------- formes (mm) ---------- */
function lblShape(kind, x, y, w, h, a) {
  const r = n => +n.toFixed(2);
  if (kind === 'rect') return `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="2" ${a}/>`;
  if (kind === 'round' || kind === 'oval')
    return `<ellipse cx="${r(x + w / 2)}" cy="${r(y + h / 2)}" rx="${r(w / 2)}" ry="${r(h / 2)}" ${a}/>`;
  if (kind === 'para') {
    const k = Math.min(6, w * 0.07);
    return `<polygon points="${[
      [x + k, y],
      [x + w, y],
      [x + w - k, y + h],
      [x, y + h]
    ]
      .map(p => r(p[0]) + ',' + r(p[1]))
      .join(' ')}" ${a}/>`;
  }
  if (kind === 'para2') {
    const k = h * 0.266;
    return `<polygon points="${[
      [x + k, y],
      [x + w, y],
      [x + w - k, y + h],
      [x, y + h]
    ]
      .map(p => r(p[0]) + ',' + r(p[1]))
      .join(' ')}" ${a}/>`;
  }
  if (kind === 'hex') {
    const q = w * 0.25;
    return `<polygon points="${[
      [x + q, y],
      [x + w - q, y],
      [x + w, y + h / 2],
      [x + w - q, y + h],
      [x + q, y + h],
      [x, y + h / 2]
    ]
      .map(p => r(p[0]) + ',' + r(p[1]))
      .join(' ')}" ${a}/>`;
  }
  if (kind === 'shield') {
    return `<path d="M${r(x)} ${r(y)}H${r(x + w)}V${r(y + h * 0.55)}Q${r(x + w)} ${r(y + h * 0.88)} ${r(x + w / 2)} ${r(y + h)}Q${r(x)} ${r(y + h * 0.88)} ${r(x)} ${r(y + h * 0.55)}Z" ${a}/>`;
  }
  if (kind === 'ribbon') {
    const n = Math.min(7, h * 0.07);
    return `<polygon points="${[
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x + w / 2, y + h - n],
      [x, y + h]
    ]
      .map(p => r(p[0]) + ',' + r(p[1]))
      .join(' ')}" ${a}/>`;
  }
  if (kind === 'rrect')
    return `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="${r(Math.min(w, h) * 0.2)}" ${a}/>`;
  if (kind === 'diamond')
    return `<polygon points="${[
      [x + w / 2, y],
      [x + w, y + h / 2],
      [x + w / 2, y + h],
      [x, y + h / 2]
    ]
      .map(p => r(p[0]) + ',' + r(p[1]))
      .join(' ')}" ${a}/>`;
  if (kind === 'octagon') {
    const c = Math.min(w, h) * 0.29;
    return `<polygon points="${[
      [x + c, y],
      [x + w - c, y],
      [x + w, y + c],
      [x + w, y + h - c],
      [x + w - c, y + h],
      [x + c, y + h],
      [x, y + h - c],
      [x, y + c]
    ]
      .map(p => r(p[0]) + ',' + r(p[1]))
      .join(' ')}" ${a}/>`;
  }
  if (kind === 'chamfer') {
    const c = 4;
    return `<polygon points="${[
      [x + c, y],
      [x + w - c, y],
      [x + w, y + c],
      [x + w, y + h - c],
      [x + w - c, y + h],
      [x + c, y + h],
      [x, y + h - c],
      [x, y + c]
    ]
      .map(p => r(p[0]) + ',' + r(p[1]))
      .join(' ')}" ${a}/>`;
  }
  if (kind === 'ticket') {
    const n = 3.2,
      m = y + h / 2;
    return `<path d="M${r(x)} ${r(y)}H${r(x + w)}V${r(m - n)}A${n} ${n} 0 0 0 ${r(x + w)} ${r(m + n)}V${r(y + h)}H${r(x)}V${r(m + n)}A${n} ${n} 0 0 0 ${r(x)} ${r(m - n)}Z" ${a}/>`;
  }
  if (kind === 'arch')
    return `<path d="M${r(x)} ${r(y + h)}V${r(y + w / 2)}A${r(w / 2)} ${r(w / 2)} 0 0 1 ${r(x + w)} ${r(y + w / 2)}V${r(y + h)}Z" ${a}/>`;
  if (kind === 'drop') {
    const q = w / 2,
      cy = y + h * 0.68;
    return `<path d="M${r(x + q)} ${r(y)}C${r(x + q + w * 0.1)} ${r(y + h * 0.25)} ${r(x + w)} ${r(y + h * 0.45)} ${r(x + w)} ${r(cy)}A${r(q)} ${r(q)} 0 0 1 ${r(x)} ${r(cy)}C${r(x)} ${r(y + h * 0.45)} ${r(x + q - w * 0.1)} ${r(y + h * 0.25)} ${r(x + q)} ${r(y)}Z" ${a}/>`;
  }
  if (kind === 'collar')
    return `<path d="M${r(x)} ${r(y)}H${r(x + w)}V${r(y + h * 0.5)}A${r(w / 2)} ${r(h * 0.5)} 0 0 1 ${r(x)} ${r(y + h * 0.5)}Z" ${a}/>`;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${a}/>`;
}
/* ---------- polices (embarquées dans /fonts, licence SIL OFL) ---------- */
const LFONTS = [
  { id: 'rocker', n: 'New Rocker — hard rock', f: "'LF New Rocker'", up: 'uppercase', ls: '.03em', w: 400 },
  { id: 'metal', n: 'Metal Mania — heavy metal', f: "'LF Metal Mania'", up: 'none', ls: '.02em', w: 400 },
  { id: 'bangers', n: 'Bangers — punk / comics', f: "'LF Bangers'", up: 'uppercase', ls: '.05em', w: 400 },
  { id: 'anton', n: 'Anton — affiche rock', f: "'LF Anton'", up: 'uppercase', ls: '.04em', w: 400 },
  { id: 'blackops', n: 'Black Ops One — stencil', f: "'LF BlackOps'", up: 'uppercase', ls: '.02em', w: 400 },
  { id: 'rye', n: 'Rye — saloon western', f: "'LF Rye'", up: 'uppercase', ls: '.02em', w: 400 },
  { id: 'sancreek', n: 'Sancreek — country rock', f: "'LF Sancreek'", up: 'uppercase', ls: '.02em', w: 400 },
  { id: 'pirata', n: 'Pirata One — gothique', f: "'LF Pirata'", up: 'none', ls: '.01em', w: 400 },
  {
    id: 'scratchy',
    n: 'Rock Salt — gribouillé',
    f: "'Rock Salt','LF Bangers'",
    up: 'none',
    ls: '.01em',
    w: 400
  },
  {
    id: 'impact',
    n: 'Bebas Neue / Anton — affiche brute',
    f: "'Bebas Neue','LF Anton',sans-serif",
    up: 'uppercase',
    ls: '.03em',
    w: 400
  },
  {
    id: 'chiller',
    n: 'Creepster — horreur',
    f: "'Creepster','LF Metal Mania'",
    up: 'none',
    ls: '.02em',
    w: 400
  },
  {
    id: 'jokerman',
    n: 'Henny Penny — cirque déjanté',
    f: "'Henny Penny','LF Sancreek'",
    up: 'none',
    ls: '.01em',
    w: 400
  },
  {
    id: 'stencil',
    n: 'Stardos Stencil — caisse militaire',
    f: "'Stardos Stencil','LF BlackOps'",
    up: 'uppercase',
    ls: '.04em',
    w: 400
  },
  {
    id: 'oldeng',
    n: 'UnifrakturCook — gothique blackletter',
    f: "'UnifrakturCook','LF Pirata'",
    up: 'none',
    ls: '.01em',
    w: 400
  },
  {
    id: 'ink',
    n: 'Kalam — écriture au feutre',
    f: "'Kalam','LF Bangers'",
    up: 'none',
    ls: '.01em',
    w: 700
  },
  {
    id: 'bauhaus',
    n: 'Bungee — pop 70s',
    f: "'Bungee','LF Anton'",
    up: 'uppercase',
    ls: '.02em',
    w: 400
  },
  {
    id: 'marker',
    n: 'Permanent Marker — feutre punk / funky',
    f: "'Permanent Marker','LF Bangers'",
    up: 'none',
    ls: '.01em',
    w: 700
  },
  {
    id: 'script',
    n: 'Kaushan Script — romantique',
    f: "'Kaushan Script','LF Pirata',cursive",
    up: 'none',
    ls: '.01em',
    w: 400
  },
  {
    id: 'showcard',
    n: 'Bowlby One — reggae / cirque',
    f: "'Bowlby One','LF Bangers'",
    up: 'uppercase',
    ls: '.02em',
    w: 400
  },
  {
    id: 'cooper',
    n: 'Caprasimo — soul 70s',
    f: "'Caprasimo','LF Rye'",
    up: 'none',
    ls: '.01em',
    w: 400
  },
  {
    id: 'condgras',
    n: 'Oswald Bold — condensé gras',
    f: "'LF Oswald','LF Anton',sans-serif",
    up: 'uppercase',
    ls: '.03em',
    w: 700
  },
  {
    id: 'vintage',
    n: 'Playfair Display — vintage à empattements',
    f: "'Playfair Display',serif",
    up: 'uppercase',
    ls: '.04em',
    w: 700
  },
  {
    id: 'typew',
    n: 'Machine à écrire — Courier Prime',
    f: "'Courier Prime',monospace",
    up: 'uppercase',
    ls: '.04em',
    w: 700
  },
  {
    id: 'std',
    n: 'Classique — Inter',
    f: "'Inter',sans-serif",
    up: 'uppercase',
    ls: '.02em',
    w: 800
  }
];
/* polices importées par l'utilisateur (stockées dans la base : S.kv.equip.fonts = [{n,d}]) */
function lblUserFonts() {
  const a = (typeof S !== 'undefined' && S.kv && S.kv.equip && S.kv.equip.fonts) || [];
  return a.map((u, i) => ({
    id: 'u' + i,
    b: u.b,
    n: '★ ' + u.n + ' (importée)',
    f: `'LU ${u.n.replace(/'/g, '')}','LF Bangers'`,
    up: 'none',
    ls: '.01em',
    w: 400,
    u: 1
  }));
}
/* familles CSS sous lesquelles une police stockée en base est enregistrée : alias interne des polices de départ, « LU nom »,
   et toute famille citée par un modèle d'étiquette qui correspond au nom du fichier (Bebas Neue, Creepster, Stardos Stencil, Playfair Display…) */
const lblNrmF = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function lblFontFams(n) {
  const al = (typeof FONTS_SEED !== 'undefined' && (FONTS_SEED.find(x => x.n === n) || {}).f) || '',
    k = lblNrmF(n),
    out = ['LU ' + n, al, /^Inter(?![A-Za-z])/.test(n) ? 'Inter' : '', /^Roboto[ _-]?Mono/i.test(n) ? 'Roboto Mono' : ''];
  LFONTS.forEach(f =>
    (f.f.match(/'[^']+'|"[^"]+"|[A-Za-z][A-Za-z0-9 ]*(?=,|$)/g) || []).forEach(q => {
      const fam = q.replace(/^['"]|['"]$/g, '').trim(),
        m = lblNrmF(fam);
      if (fam && !/^LF |^LU |^(Inter|serif|sans-serif|monospace|cursive|fantasy)$/.test(fam) && m.length >= 5 && k.includes(m)) out.push(fam);
    })
  );
  return [...new Set(out.filter(Boolean))];
}
function lblRegFont(fam, d, own, via) {
  const key = fam + '|' + d.length;
  if (lblRegFonts.faces[key]) return;
  try {
    const ff = new FontFace(
      fam,
      'url(' + d + ')',
      Object.assign(
        /Oswald/.test(fam)
          ? { weight: '200 700' }
          : /wght|variable/i.test(own || '')
            ? { weight: '100 900' }
            : /bold/i.test(own || '')
              ? { weight: '700' }
              : /light/i.test(own || '')
                ? { weight: '300' }
                : {},
        /italic|oblique/i.test(own || '') ? { style: 'italic' } : {}
      )
    );
    ff._bcn = own;
    ff._bcv = via || '';
    lblRegFonts.faces[key] = ff;
    ff.load()
      .then(x => {
        if (lblRegFonts.faces[key] !== ff) return;
        document.fonts.add(x);
        if (document.getElementById('lpage')) lblRefresh();
      })
      .catch(() => {});
  } catch (e) {}
}
function lblRegFonts() {
  if (typeof FontFace === 'undefined' || !document.fonts || typeof S === 'undefined' || !S.kv || !S.kv.equip) return;
  const E = S.kv.equip,
    fonts = E.fonts || [];
  fonts.forEach(u =>
    lblFontFams(u.n).forEach(fam => lblRegFont(fam, u.d, u.n, ''))
  );
  /* polices remplacées lors d'une suppression : la police de remplacement prend le relais sous les anciennes familles */
  Object.entries(E.fontmap || {}).forEach(([dn, tn]) => {
    let t = fonts.find(x => x.n === tn),
      g = 0;
    while (!t && E.fontmap[tn] && g++ < 8) {
      tn = E.fontmap[tn];
      t = fonts.find(x => x.n === tn);
    }
    if (t && !fonts.some(x => x.n === dn)) lblFontFams(dn).forEach(fam => lblRegFont(fam, t.d, t.n, dn));
  });
}
lblRegFonts.faces = {};
/* retire de l'écran les faces d'une police supprimée (ou celles qu'elle remplaçait) */
function lblUnregFont(n, viaToo) {
  Object.keys(lblRegFonts.faces).forEach(k => {
    const ff = lblRegFonts.faces[k];
    if (ff._bcn === n || (viaToo && ff._bcv === n)) {
      try {
        document.fonts.delete(ff);
      } catch (e) {}
      delete lblRegFonts.faces[k];
    }
  });
}
const lblFont = id => LFONTS.concat(lblUserFonts()).find(f => f.id === id) || LFONTS[0];
/* ---------- petits blocs (tailles en mm, texte ≥ 3 mm) ---------- */
const lblClamp = n => `display:-webkit-box;-webkit-line-clamp:${n};-webkit-box-orient:vertical;overflow:hidden`;
const lblLogo = (d, s, gray) =>
  d.logo
    ? `<img src="${d.logo}" style="width:${s}mm;height:${s}mm;object-fit:contain;flex:none;display:block${d.dk ? ';background:#fff;border-radius:12%;padding:.8mm' : gray ? ';filter:grayscale(1);opacity:.75' : ''}">`
    : `<div class="nologo" style="width:${s}mm;height:${s}mm">LOGO</div>`;
const lblQr = (d, s) =>
  d.qr
    ? `<div class="qrb" style="width:${s}mm;height:${s}mm;flex:none">${d.qr}</div>`
    : `<div class="noqr" style="width:${s}mm;height:${s}mm">QR</div>`;
/* nom : ajusté automatiquement (lblFitAll) pour tenir sur n lignes */
const lblName = (d, fs, n, extra) =>
  `<div class="lbn" data-l="${n || 1}" data-fs="${fs}" style="font-size:${fs}mm;max-height:${((n || 1) * 1.15).toFixed(2)}em;flex:none;${extra || ''}">${d.nameH}</div>`;
const lblCode = (d, fs, extra) =>
  `<div class="lbb" style="font-weight:700;font-size:${fs}mm;color:${d.acc};line-height:1.2;white-space:nowrap;${extra || ''}">${d.codeH}</div>`;
const lblSmall = (t, fs, n, extra) =>
  t
    ? `<div class="lbb lbg" style="font-size:${fs}mm;font-weight:500;line-height:1.2;${lblClamp(n || 2)};${extra || ''}">${t}</div>`
    : '';
const lblStats = (d, fs, extra) =>
  `<div class="lbb" style="font-size:${fs}mm;font-weight:700;line-height:1.2;white-space:nowrap;${extra || ''}">${d.abvH} % · ${d.clH} cl</div>`;
const lblSty = (d, fs, extra) =>
  `<div class="lbb lbg" style="font-size:${fs}mm;font-weight:500;font-style:italic;line-height:1.15;${lblClamp(1)};max-width:100%;${extra || ''}">${d.styleH}</div>`;
const lblRule = (d, w) => `<div style="width:${w || 60}%;border-top:.4mm solid ${d.acc};flex:none"></div>`;
/* texte vertical (lu de bas en haut, comme textRotation=90 d'Excel) */
const lblVert = (t, fs, extra) =>
  t ? `<div class="lbb lbv2" style="font-size:${fs}mm;font-weight:700;line-height:1.1;${extra || ''}">${t}</div>` : '';
const lblVCol = (inner, w, align) =>
  `<div style="flex:none;align-self:stretch;width:${w}mm;display:flex;flex-direction:column;align-items:center;justify-content:${align || 'space-between'};gap:1mm;overflow:hidden">${inner}</div>`;
/* colonnes verticales du modèle Excel : % alcool + volume à gauche, « année#brassin … IBU » à droite */
const lblSideL = (d, fs, w) =>
  lblVCol(lblVert('Alc : ' + d.abvH + ' %', fs) + lblVert(d.clH + ' cl', fs), w || fs * 1.5);
const lblSideR = (d, fs, w) => lblVCol(lblVert(d.codeH, fs, 'white-space:pre'), w || fs * 1.5, 'center');
/* ---------- gabarits ---------- */
function lblBand(d, w, h, px, o) {
  o = { nm: Math.min(9, h * 0.17), dets: 2, ...o };
  const s = Math.min(h - 16, o.logo || 26),
    q = o.qr || s;
  return `<div style="display:flex;align-items:center;gap:3mm;height:100%;padding:0 ${px}mm">${lblLogo(d, s)}<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:.5mm">${lblName(d, o.nm, 2)}${lblSty(d, 3.4)}<div style="display:flex;gap:2.5mm;align-items:baseline;flex-wrap:wrap">${lblStats(d, 3.6)}${lblCode(d, 3.4)}</div>${o.dets > 0 ? lblSmall(d.lMalt, 3, 1) : ''}${o.dets > 1 ? lblSmall(d.lHop, 3, 1) : ''}${o.dets > 2 ? lblSmall(d.lDate, 3, 1) : ''}</div>${lblQr(d, q)}</div>`;
}
function lblStack(d, o) {
  o = {
    logo: 16,
    nm: 6,
    nl: 2,
    sty: true,
    stats: true,
    qr: 16,
    code: true,
    det: 0,
    pad: '0 8mm',
    gap: 1,
    ss: 3.2,
    fs: 3.6,
    cs: 3.2,
    ...o
  };
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;height:100%;padding:${o.pad};gap:${o.gap}mm">${o.logo ? lblLogo(d, o.logo) : ''}${lblName(d, o.nm, o.nl, 'text-align:center')}${o.sty ? lblSty(d, o.ss) : ''}${o.rule ? lblRule(d) : ''}${o.stats ? lblStats(d, o.fs) : ''}${o.qr ? lblQr(d, o.qr) : ''}${o.code ? lblCode(d, o.cs) : ''}${o.det ? lblSmall(d.lMalt, o.det, 2, 'width:100%') + lblSmall(d.lHop, o.det, 2, 'width:100%') + lblSmall(d.lDate, o.det, 2, 'width:100%') : ''}</div>`;
}
const LF = [
  {
    id: 'bandeauxl',
    font: 'scratchy',
    body: 'cond',
    n: 'Bandeau oblique',
    w: 188,
    h: 34,
    shape: 'para2',
    pack: 'grid',
    r: (d, w, h) => {
      const k = h * 0.266;
      return `<div style="display:flex;align-items:center;gap:2.5mm;height:100%;padding:3mm ${(k + 2).toFixed(1)}mm 3mm ${(k + 1.5).toFixed(1)}mm">${lblSideL(d, 3.3)}${lblLogo(d, 26, 1)}<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:.5mm;justify-content:center">${lblName(d, 11, 1, 'text-align:center;align-self:stretch')}${lblSmall(d.lMalt, 3, 1, 'text-align:center')}${lblSmall(d.lHop, 3, 1, 'text-align:center')}${lblSmall(d.lDS, 3, 1, 'text-align:center')}</div>${d.qr ? lblQr(d, 22) : ''}${lblSideR(d, 3.3)}</div>`;
    }
  },
  {
    id: 'xlcompact',
    font: 'scratchy',
    body: 'cond',
    n: 'Étiquette Excel compacte',
    w: 98,
    h: 62,
    shape: 'rect',
    pack: 'grid',
    r: (d, w, h) =>
      `<div style="display:flex;align-items:stretch;gap:2mm;height:100%;padding:4.5mm 4mm">${lblSideL(d, 3.2)}<div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.7mm;text-align:center">${lblLogo(d, 15)}${lblName(d, 9, 2, 'text-align:center')}${lblSmall(d.lMalt, 2.9, 1)}${lblSmall(d.lHop, 2.9, 1)}${lblSmall(d.lDate, 2.9, 1)}${d.qr ? lblQr(d, 13) : ''}</div>${lblSideR(d, 3.2)}</div>`
  },
  {
    id: 'punk',
    font: 'bangers',
    body: 'cond',
    n: 'Punk — texte penché',
    w: 98,
    h: 62,
    shape: 'chamfer',
    pack: 'grid',
    r: (d, w, h) =>
      `<div style="display:flex;align-items:stretch;gap:2mm;height:100%;padding:4.5mm 4mm">${lblSideL(d, 3.4)}<div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:1.2mm"><div style="transform:rotate(-4deg);transform-origin:left center;display:flex;gap:3mm;align-items:center">${lblLogo(d, 17)}<div style="flex:1;min-width:0;border-bottom:1mm solid ${d.acc}">${lblName(d, 10.5, 2)}</div></div>${lblSty(d, 3.6, 'font-weight:700')}${lblSmall(d.lMalt, 3, 1)}${lblSmall(d.lHop, 3, 1)}${lblSmall(d.lDate, 3, 1)}</div><div style="display:flex;flex-direction:column;justify-content:space-between;align-items:center;flex:none">${lblQr(d, 17)}</div>${lblSideR(d, 3.4)}</div>`
  },
  {
    id: 'caisse',
    font: 'stencil',
    body: 'cond',
    n: 'Caisse stencil (rayures)',
    w: 98,
    h: 62,
    shape: 'rect',
    pack: 'grid',
    r: (d, w, h) =>
      `<div style="display:flex;flex-direction:column;height:100%;padding:4mm 5mm 4mm;gap:1.4mm"><div style="height:3mm;flex:none;background:repeating-linear-gradient(135deg,${d.acc} 0 2.2mm,${d.dk ? '#15110e' : '#fff'} 2.2mm 4.4mm)"></div><div style="display:flex;gap:2.5mm;flex:1;min-height:0;align-items:stretch">${lblSideL(d, 3.2)}<div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:1mm"><div style="display:flex;gap:3mm;align-items:center">${lblLogo(d, 16)}<div style="flex:1;min-width:0">${lblName(d, 9, 2)}</div></div>${lblSty(d, 3.4)}${lblSmall(d.lMalt, 3, 1)}${lblSmall(d.lHop, 3, 1)}</div>${lblQr(d, 20)}${lblSideR(d, 3.2)}</div><div style="height:3mm;flex:none;background:repeating-linear-gradient(135deg,${d.acc} 0 2.2mm,${d.dk ? '#15110e' : '#fff'} 2.2mm 4.4mm)"></div></div>`
  },
  {
    id: 'affiche',
    font: 'anton',
    body: 'cond',
    n: 'Affiche de concert',
    w: 75,
    h: 105,
    shape: 'rect',
    pack: 'grid',
    r: (d, w, h) =>
      `<div style="display:flex;gap:2mm;height:100%;padding:5mm 4mm"><div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;gap:1.5mm">${lblLogo(d, 15)}${lblName(d, 13, 3, 'text-align:center')}<div style="width:100%;border-top:.8mm solid ${d.acc};border-bottom:.8mm solid ${d.acc};padding:1mm 0">${lblSty(d, 3.8, 'text-align:center')}</div>${lblStats(d, 5)}${lblQr(d, 17)}${lblSmall(d.lHop, 3, 2, 'text-align:center')}</div>${lblSideR(d, 4, 6)}</div>`
  },
  {
    id: 'saloon',
    font: 'rye',
    n: 'Avis de recherche (saloon)',
    w: 85,
    h: 110,
    shape: 'rect',
    pack: 'grid',
    r: (d, w, h) =>
      `<div style="height:100%;padding:3.5mm"><div style="height:100%;border:.6mm double ${d.acc};outline:.3mm solid ${d.acc};outline-offset:-2.2mm;display:flex;flex-direction:column;align-items:center;text-align:center;padding:4mm 4mm;gap:1.4mm"><div class="lbn" data-fs="6" data-l="1" style="font-size:6mm;max-height:1.15em;flex:none">${ic('star')} Recherché ${ic('star')}</div>${lblLogo(d, 17)}${lblName(d, 10, 2, 'text-align:center')}${lblRule(d, 70)}${lblSty(d, 3.6)}<div style="display:flex;gap:5mm;align-items:baseline">${lblStats(d, 4.6)}<span class="lbb" style="font-size:4.2mm;font-weight:700">${d.ibuH} IBU</span></div>${lblQr(d, 17)}${lblCode(d, 3.2)}<div style="margin-top:auto;width:100%">${lblSmall(d.lMalt, 2.9, 2, 'text-align:center')}${lblSmall(d.lHop, 2.9, 2, 'text-align:center')}</div></div></div>`
  },
  {
    id: 'goth',
    font: 'oldeng',
    n: 'Gothique — vitrail',
    w: 66,
    h: 100,
    shape: 'arch',
    pack: 'grid',
    r: (d, w, h) =>
      `<div style="display:flex;flex-direction:column;align-items:center;text-align:center;height:100%;padding:14mm 5mm 6mm;gap:1.4mm">${lblLogo(d, 17)}${lblName(d, 10, 3, 'text-align:center')}${lblRule(d, 50)}${lblSty(d, 3.6)}${lblStats(d, 4)}<div style="flex:1"></div>${lblQr(d, 19)}${lblCode(d, 3.2)}</div>`
  },
  {
    id: 'disque',
    font: 'bauhaus',
    n: 'Disque vinyle',
    w: 80,
    h: 80,
    shape: 'round',
    pack: 'honey',
    r: (d, w, h) =>
      `<div style="position:relative;height:100%"><div style="position:absolute;inset:4mm;border-radius:50%;background:repeating-radial-gradient(circle,transparent 0 1.1mm,${d.acc}22 1.1mm 1.2mm)"></div><div style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;height:100%;padding:0 12mm;gap:1mm">${lblLogo(d, 13)}${lblName(d, 8, 2, 'text-align:center')}${lblSty(d, 3.2)}${lblStats(d, 3.8)}${lblQr(d, 15)}${lblCode(d, 3)}</div></div>`
  },
  {
    id: 'tag',
    font: 'ink',
    n: 'Tag graffiti (rotation)',
    w: 70,
    h: 98,
    shape: 'rect',
    pack: 'grid',
    r: (d, w, h) =>
      `<div style="display:flex;gap:2mm;height:100%;padding:4mm 3mm">${lblSideL(d, 3.4)}<div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;gap:1.5mm">${lblLogo(d, 17)}<div style="transform:rotate(-8deg);width:100%">${lblName(d, 13, 3, 'text-align:center')}</div>${lblSty(d, 3.6)}${lblQr(d, 19)}${lblSmall(d.lHop, 2.9, 2, 'text-align:center')}</div>${lblSideR(d, 3.4)}</div>`
  },
  {
    id: 'bandeau',
    n: 'Bandeau',
    font: 'anton',
    w: 98,
    h: 55,
    shape: 'rect',
    pack: 'grid',
    r: (d, w, h) => lblBand(d, w, h, 4, { logo: 20, qr: 23, nm: 9.5 })
  },
  {
    id: 'bandeaul',
    n: 'Bandeau large',
    font: 'rocker',
    w: 190,
    h: 62,
    shape: 'rect',
    pack: 'grid',
    r: (d, w, h) => lblBand(d, w, h, 8, { nm: 15, logo: 40, dets: 3, qr: 40 })
  },
  {
    id: 'parallelo',
    n: 'Bandeau incliné',
    font: 'bangers',
    w: 98,
    h: 55,
    shape: 'para',
    pack: 'grid',
    r: (d, w, h) => lblBand(d, w, h, 9, { logo: 22, nm: 7.6 })
  },
  {
    id: 'ticket',
    n: 'Ticket à encoches',
    font: 'blackops',
    w: 98,
    h: 50,
    shape: 'ticket',
    pack: 'grid',
    r: (d, w, h) => lblBand(d, w, h, 9, { logo: 22, nm: 7.4, dets: 1 })
  },
  {
    id: 'classique',
    n: 'Classique vertical',
    font: 'rocker',
    w: 75,
    h: 105,
    shape: 'rect',
    pack: 'grid',
    r: (d, w, h) =>
      lblStack(d, { logo: 25, nm: 9, nl: 2, qr: 23, rule: 1, pad: '5mm 6mm', gap: 1.5, ss: 3.8, fs: 4.4, cs: 3.6 })
  },
  {
    id: 'carre',
    n: 'Carré',
    font: 'sancreek',
    w: 75,
    h: 75,
    shape: 'rect',
    pack: 'grid',
    r: (d, w, h) =>
      `<div style="display:flex;flex-direction:column;height:100%;padding:5mm;gap:1.5mm"><div style="display:flex;gap:3mm;align-items:center">${lblLogo(d, 20)}<div style="min-width:0;flex:1">${lblName(d, 8, 2)}${lblSty(d, 3.4)}</div></div>${lblStats(d, 4, 'border-top:.4mm solid ' + d.acc + ';padding-top:1.2mm')}<div style="display:flex;gap:3mm;align-items:flex-end;flex:1">${lblQr(d, 26)}<div style="flex:1;min-width:0">${lblCode(d, 3.6)}${lblSmall(d.lHop, 3, 3)}</div></div></div>`
  },
  {
    id: 'rond',
    n: 'Rond',
    font: 'metal',
    w: 72,
    h: 72,
    shape: 'round',
    pack: 'honey',
    r: (d, w, h) => lblStack(d, { logo: 15, nm: 7, nl: 2, qr: 17, pad: '0 11mm', gap: 0.9, ss: 3.2, fs: 3.6, cs: 3.2 })
  },
  {
    id: 'capsule',
    n: 'Capsule / bouchon',
    font: 'bangers',
    w: 38,
    h: 38,
    shape: 'round',
    pack: 'honey',
    r: (d, w, h) =>
      lblStack(d, { logo: 17, nm: 5.2, nl: 2, sty: false, stats: false, qr: 0, pad: '0 4mm', gap: 0.8, cs: 3 })
  },
  {
    id: 'ovale',
    n: 'Ovale',
    font: 'rye',
    w: 84,
    h: 58,
    shape: 'oval',
    pack: 'grid',
    r: (d, w, h) =>
      `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:0 11mm;gap:1.6mm"><div style="display:flex;align-items:center;gap:3mm;max-width:100%">${lblLogo(d, 15)}<div style="min-width:0;text-align:left">${lblName(d, 7, 2)}${lblSty(d, 3.2)}</div></div><div style="display:flex;align-items:center;gap:3.5mm">${lblQr(d, 18)}<div>${lblStats(d, 3.8)}${lblCode(d, 3.2)}</div></div></div>`
  },
  {
    id: 'contre',
    n: 'Contre-étiquette',
    font: 'anton',
    w: 98,
    h: 72,
    shape: 'rect',
    pack: 'grid',
    r: (d, w, h) =>
      `<div style="display:flex;gap:4mm;height:100%;padding:5mm"><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1.4mm">${lblName(d, 7.6, 2)}<div style="display:flex;gap:3mm;align-items:baseline;border-bottom:.4mm solid ${d.acc};padding-bottom:1.2mm">${lblStats(d, 3.8)}<span class="lbb" style="font-size:3.8mm;font-weight:700">${d.ibuH} IBU</span></div>${lblSmall(d.lMalt, 3.2, 3)}${lblSmall(d.lHop, 3.2, 3)}${lblSmall(d.lBrass, 3.2, 1)}${lblSmall(d.lEmb, 3.2, 1)}</div><div style="display:flex;flex-direction:column;align-items:center;justify-content:space-between">${lblLogo(d, 18)}${lblQr(d, 28)}${lblCode(d, 3)}</div></div>`
  },
  {
    id: 'hexagone',
    n: 'Hexagone',
    font: 'blackops',
    w: 76,
    h: 66,
    shape: 'hex',
    pack: 'hexcol',
    r: (d, w, h) =>
      lblStack(d, { logo: 13, nm: 6.4, nl: 2, sty: false, qr: 16, pad: '0 14mm', gap: 0.9, fs: 3.4, cs: 3 })
  },
  {
    id: 'ecusson',
    n: 'Écusson',
    font: 'pirata',
    w: 66,
    h: 86,
    shape: 'shield',
    pack: 'grid',
    r: (d, w, h) =>
      lblStack(d, { logo: 19, nm: 8, nl: 2, qr: 19, pad: '6mm 5mm 13mm', gap: 1.1, ss: 3.2, fs: 3.6, cs: 3.2 })
  },
  {
    id: 'ruban',
    n: 'Ruban vertical',
    font: 'metal',
    w: 46,
    h: 130,
    shape: 'ribbon',
    pack: 'grid',
    r: (d, w, h) =>
      `<div style="display:flex;flex-direction:column;align-items:center;text-align:center;height:100%;padding:5mm 3mm 12mm;gap:2mm">${lblLogo(d, 22)}<div style="flex:1;min-height:0;width:100%;display:flex;align-items:center;justify-content:center"><div class="lbn lbv" data-fs="9.5" style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:9.5mm;white-space:nowrap;max-width:none;max-height:100%">${d.nameH}</div></div>${lblStats(d, 3.6)}${lblQr(d, 22)}${lblCode(d, 3)}</div>`
  },
  {
    id: 'recth',
    n: 'Rectangle horizontal',
    font: 'rocker',
    w: 98,
    h: 62,
    shape: 'rect',
    pack: 'grid',
    r: (d, w, h) =>
      `<div style="display:flex;flex-direction:column;height:100%;padding:5mm;gap:1.8mm"><div style="display:flex;gap:3.5mm;align-items:center">${lblLogo(d, 23)}<div style="flex:1;min-width:0">${lblName(d, 8.4, 2)}${lblSty(d, 3.4)}<div style="display:flex;gap:3mm;align-items:baseline;border-top:.4mm solid ${d.acc};margin-top:1mm;padding-top:1mm">${lblStats(d, 3.8)}${lblCode(d, 3.4)}</div></div></div><div style="display:flex;gap:3mm;align-items:flex-end;flex:1;min-height:0"><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:.8mm">${lblSmall(d.lMalt, 3, 2)}${lblSmall(d.lHop, 3, 2)}</div>${lblQr(d, 21)}</div></div>`
  },
  {
    id: 'cartouche',
    n: 'Cartouche coins coupés',
    font: 'rye',
    w: 85,
    h: 58,
    shape: 'chamfer',
    pack: 'grid',
    r: (d, w, h) =>
      `<div style="display:flex;flex-direction:column;height:100%;padding:6.5mm 8mm 6mm;gap:1.8mm"><div style="display:flex;gap:3mm;align-items:center">${lblLogo(d, 16)}<div style="flex:1;min-width:0">${lblName(d, 7.2, 2)}${lblSty(d, 3.2)}${lblStats(d, 3.6)}</div>${lblQr(d, 17)}</div><div style="border-top:.4mm solid ${d.acc};border-bottom:.4mm solid ${d.acc};padding:1.3mm 0;display:flex;flex-direction:column;gap:.7mm;flex:1;min-height:0;justify-content:center">${lblSmall(d.lMalt, 2.9, 1)}${lblSmall(d.lHop, 2.9, 1)}${lblSmall(d.lDate, 2.9, 1)}</div><div style="text-align:center">${lblCode(d, 3.2)}</div></div>`
  },
  {
    id: 'collerette',
    n: 'Collerette de goulot',
    font: 'sancreek',
    w: 96,
    h: 46,
    shape: 'collar',
    pack: 'grid',
    r: (d, w, h) =>
      `<div style="display:flex;align-items:flex-start;justify-content:center;gap:4mm;height:100%;padding:5mm 10mm 0">${lblLogo(d, 18)}<div style="text-align:center;min-width:0;flex:1;padding-top:1mm">${lblName(d, 8, 2, 'text-align:center')}${lblStats(d, 3.6)}${lblCode(d, 3.2)}</div>${lblQr(d, 18)}</div>`
  },
  {
    id: 'mini',
    n: 'Mini carré arrondi',
    font: 'bangers',
    w: 45,
    h: 45,
    shape: 'rrect',
    pack: 'grid',
    r: (d, w, h) =>
      lblStack(d, { logo: 17, nm: 5.6, nl: 2, sty: false, stats: false, qr: 0, cs: 3, pad: '0 4mm', gap: 1 })
  },
  {
    id: 'medaillon',
    n: 'Médaillon',
    font: 'pirata',
    w: 58,
    h: 58,
    shape: 'round',
    pack: 'honey',
    r: (d, w, h) => lblStack(d, { logo: 19, nm: 6.4, nl: 2, sty: false, fs: 3.6, qr: 0, cs: 3.2, pad: '0 9mm', gap: 1 })
  },
  {
    id: 'ronddet',
    n: 'Rond détaillé',
    font: 'rocker',
    w: 92,
    h: 92,
    shape: 'round',
    pack: 'honey',
    r: (d, w, h) =>
      `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;height:100%;padding:8mm 19mm 15mm;gap:.9mm">${lblLogo(d, 10)}${lblName(d, 8.4, 2, 'text-align:center')}${lblSty(d, 3.3)}${lblStats(d, 3.8)}${lblQr(d, 14)}${lblCode(d, 3.3)}${lblSmall(d.lMalt, 2.8, 1, 'width:100%')}${lblSmall(d.lHop, 2.8, 1, 'width:100%')}</div>`
  },
  {
    id: 'losange',
    n: 'Losange',
    font: 'metal',
    w: 78,
    h: 78,
    shape: 'diamond',
    pack: 'diamond',
    r: (d, w, h) => lblStack(d, { logo: 13, nm: 6, nl: 2, sty: false, fs: 3.4, qr: 15, cs: 3, pad: '0 17mm', gap: 0.8 })
  },
  {
    id: 'octogone',
    n: 'Octogone',
    font: 'blackops',
    w: 66,
    h: 66,
    shape: 'octagon',
    pack: 'grid',
    r: (d, w, h) => lblStack(d, { logo: 16, nm: 7, nl: 2, sty: false, qr: 18, pad: '0 8mm', gap: 1, fs: 3.8, cs: 3.4 })
  },
  {
    id: 'goutte',
    n: 'Goutte',
    font: 'bangers',
    w: 58,
    h: 90,
    shape: 'drop',
    pack: 'grid',
    r: (d, w, h) =>
      lblStack(d, { logo: 14, nm: 6, nl: 2, sty: false, fs: 3.6, qr: 18, cs: 3.2, pad: '34mm 6mm 7mm', gap: 1.1 })
  },
  {
    id: 'arche',
    n: 'Arche',
    font: 'pirata',
    w: 62,
    h: 92,
    shape: 'arch',
    pack: 'grid',
    r: (d, w, h) => lblStack(d, { logo: 20, nm: 7.6, nl: 2, qr: 19, pad: '11mm 5mm 5mm', gap: 1.2 })
  },
  {
    id: 'grande',
    n: 'Grande étiquette',
    font: 'rocker',
    w: 98,
    h: 140,
    shape: 'rect',
    pack: 'grid',
    r: (d, w, h) =>
      `<div style="display:flex;flex-direction:column;align-items:center;text-align:center;height:100%;padding:8mm 7mm 6mm;gap:2.6mm">${lblLogo(d, 32)}${lblName(d, 15, 2, 'text-align:center')}${lblSty(d, 4.6)}${lblRule(d, 60)}<div style="display:flex;gap:6mm;align-items:baseline">${lblStats(d, 5.4)}<span class="lbb" style="font-size:5.2mm;font-weight:700">${d.ibuH} IBU</span></div>${lblQr(d, 36)}${lblCode(d, 4.2)}<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:1mm;width:100%">${lblSmall(d.lMalt, 3.6, 2)}${lblSmall(d.lHop, 3.6, 2)}${lblSmall(d.lDate, 3.6, 2)}</div></div>`
  }
];
/* ---------- styles « musique » : reggae, romantique, funky, soul, salsa, punk (palette propre à chaque modèle : f.pal) ---------- */
const lblRansom = (d, fs) => {
  const st = [
      ['#fff', '#111', "'Playfair Display',serif", '400'],
      ['#111', '#fff', "'Bebas Neue','LF Anton',sans-serif", '400'],
      ['#ffe600', '#111', "'Courier Prime',monospace", '700'],
      ['#ff1493', '#fff', "'LF Bangers','LF Anton',sans-serif", '400'],
      ['#e8e8e8', '#111', "'Playfair Display',serif", '700']
    ],
    rot = [-3, 2, -1, 3, -2, 1];
  let i = 0;
  const w = d.nameH
    .split(' ')
    .map(
      t =>
        '<span style="white-space:nowrap;display:inline-block;margin:0 .35em">' +
        (t.match(/&[a-z#0-9]+;|./gi) || [])
          .map(ch => {
            const s = st[i % 5],
              r = rot[i % 6];
            i++;
            return `<span style="display:inline-block;background:${s[0]};color:${s[1]};font-family:${s[2]};font-weight:${s[3]};text-transform:none;letter-spacing:0;padding:.05em .14em;margin:.03em .02em;transform:rotate(${r}deg);box-shadow:.2mm .2mm 0 #0005;line-height:1.05">${i % 3 ? ch.toUpperCase() : ch}</span>`;
          })
          .join('') +
        '</span>'
    )
    .join('');
  return `<div class="lbn" data-l="3" data-fs="${fs}" style="font-size:${fs}mm;max-height:3.9em;flex:none;text-align:center;line-height:1.3;color:#111">${w}</div>`;
};
const LGEN = {
  reggae: {
    n: 'Reggae',
    font: 'showcard',
    pal: { bg: '#17140a', ink: '#fff3c4', gr: '#e8d79a', ac: '#f2c200', dk: 1 },
    h: '<div style="position:absolute;left:0;right:0;bottom:0;height:5.5mm;background:linear-gradient(#d62828 0 33.4%,#f2c200 33.4% 66.7%,#1f8f3a 66.7%)"></div><div style="position:absolute;right:3mm;top:2.5mm;color:#f2c200;font-size:5mm">'+ic('star')+'</div>',
    p: '<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 100%,#f2c20030 0 34mm,transparent 34.5mm)"></div><div style="position:absolute;left:0;right:0;top:0;height:7mm;background:linear-gradient(90deg,#d62828 0 33.4%,#f2c200 33.4% 66.7%,#1f8f3a 66.7%)"></div><div style="position:absolute;left:0;right:0;bottom:0;height:7mm;background:linear-gradient(90deg,#1f8f3a 0 33.4%,#f2c200 33.4% 66.7%,#d62828 66.7%)"></div>',
    ph: '3.5mm 4mm 9mm',
    pp: '12mm 5mm 12mm'
  },
  romantique: {
    n: 'Romantique',
    font: 'script',
    pal: { bg: '#fff1f2', ink: '#6b1a35', gr: '#8a4a5e', ac: '#c2185b' },
    h: '<div style="position:absolute;inset:3.3mm;border:.3mm dashed #c2185b;border-radius:2.5mm"></div><div style="position:absolute;left:50%;top:1.2mm;transform:translateX(-50%);color:#c2185b;font-size:3.6mm;background:#fff1f2;padding:0 2mm;line-height:1">'+ic('heart')+' '+ic('flower')+' '+ic('heart')+'</div><div style="position:absolute;left:50%;bottom:1.2mm;transform:translateX(-50%);color:#c2185b;font-size:3.6mm;background:#fff1f2;padding:0 2mm;line-height:1">'+ic('heart')+' '+ic('flower')+' '+ic('heart')+'</div>',
    p: '<div style="position:absolute;inset:3.3mm;border:.3mm dashed #c2185b;border-radius:3mm"></div><div style="position:absolute;left:50%;top:1.2mm;transform:translateX(-50%);color:#c2185b;font-size:4mm;background:#fff1f2;padding:0 2mm;line-height:1">'+ic('heart')+' '+ic('flower')+' '+ic('heart')+'</div><div style="position:absolute;left:50%;bottom:1.2mm;transform:translateX(-50%);color:#c2185b;font-size:4mm;background:#fff1f2;padding:0 2mm;line-height:1">'+ic('heart')+' '+ic('flower')+' '+ic('heart')+'</div><div style="position:absolute;right:6mm;top:9mm;color:#c2185b55;font-size:10mm">'+ic('heart')+'</div><div style="position:absolute;left:6mm;bottom:12mm;color:#c2185b55;font-size:8mm">'+ic('heart')+'</div>',
    ph: '7mm 5mm',
    pp: '10mm 7mm'
  },
  funky: {
    n: 'Funky',
    font: 'bauhaus',
    pal: { bg: '#2a0a4a', ink: '#ffe94d', gr: '#f1c9ff', ac: '#ff2fa3', dk: 1 },
    h: '<div style="position:absolute;right:-17mm;bottom:-17mm;width:34mm;height:34mm;border-radius:50%;background:radial-gradient(circle,#2a0a4a 0 3mm,#2ec4b6 3mm 7mm,#ff9f1c 7mm 11mm,#ff2fa3 11mm 14mm,transparent 14mm 17mm)"></div><div style="position:absolute;left:-14mm;top:-14mm;width:28mm;height:28mm;border-radius:50%;background:radial-gradient(circle,#2a0a4a 0 2mm,#ff2fa3 2mm 5mm,#ff9f1c 5mm 8mm,#2ec4b6 8mm 11mm,transparent 11mm)"></div>',
    p: '<div style="position:absolute;right:-24mm;bottom:-24mm;width:48mm;height:48mm;border-radius:50%;background:radial-gradient(circle,#2a0a4a 0 4mm,#2ec4b6 4mm 9mm,#ff9f1c 9mm 14mm,#ff2fa3 14mm 19mm,transparent 19mm)"></div><div style="position:absolute;left:-20mm;top:-20mm;width:40mm;height:40mm;border-radius:50%;background:radial-gradient(circle,#2a0a4a 0 3mm,#ff2fa3 3mm 7mm,#ff9f1c 7mm 11mm,#2ec4b6 11mm 15mm,transparent 15mm)"></div>',
    ph: '4.5mm 6mm',
    pp: '12mm 6mm'
  },
  soul: {
    n: 'Soul',
    font: 'cooper',
    pal: { bg: '#2a1a10', ink: '#f6e3b4', gr: '#d4b98a', ac: '#e0a526', dk: 1 },
    h: '<div style="position:absolute;right:-13mm;top:-13mm;width:36mm;height:36mm;border-radius:50%;background:radial-gradient(circle,#c0392b 0 1mm,#e0a526 1mm 4.5mm,transparent 4.6mm),repeating-radial-gradient(circle,#0e0e0e 0 .5mm,#2b2b2b .5mm 1mm)"></div><div style="position:absolute;left:5mm;right:5mm;bottom:2.2mm;border-top:.5mm solid #e0a526;text-align:center;color:#e0a526;font-size:3mm;line-height:1.3">'+ic('music2')+' '+ic('music')+' '+ic('music2')+'</div>',
    p: '<div style="position:absolute;right:-16mm;top:-16mm;width:46mm;height:46mm;border-radius:50%;background:radial-gradient(circle,#c0392b 0 1.2mm,#e0a526 1.2mm 6mm,transparent 6.1mm),repeating-radial-gradient(circle,#0e0e0e 0 .5mm,#2b2b2b .5mm 1mm)"></div><div style="position:absolute;left:6mm;right:6mm;bottom:4mm;border-top:.6mm solid #e0a526;text-align:center;color:#e0a526;font-size:4mm;line-height:1.4">'+ic('music2')+' '+ic('music')+' '+ic('music2')+' '+ic('music')+' '+ic('music2')+'</div>',
    ph: '4.5mm 6mm 8mm',
    pp: '12mm 6mm 14mm'
  },
  salsa: {
    n: 'Salsa',
    font: 'jokerman',
    pal: { bg: '#fff4d9', ink: '#1d1d1d', gr: '#4a4036', ac: '#e8281e' },
    h: '<div style="position:absolute;left:0;right:0;top:0;height:4mm;background:linear-gradient(135deg,#e8281e 25%,transparent 25%) -2mm 0/4mm 4mm,linear-gradient(225deg,#e8281e 25%,transparent 25%) -2mm 0/4mm 4mm,#f2a900"></div><div style="position:absolute;left:0;right:0;bottom:0;height:4mm;background:linear-gradient(315deg,#1b9aaa 25%,transparent 25%) -2mm 0/4mm 4mm,linear-gradient(45deg,#1b9aaa 25%,transparent 25%) -2mm 0/4mm 4mm,#f2a900"></div>',
    p: '<div style="position:absolute;left:0;right:0;top:0;height:6mm;background:linear-gradient(135deg,#e8281e 25%,transparent 25%) -3mm 0/6mm 6mm,linear-gradient(225deg,#e8281e 25%,transparent 25%) -3mm 0/6mm 6mm,#f2a900"></div><div style="position:absolute;left:0;right:0;bottom:0;height:6mm;background:linear-gradient(315deg,#1b9aaa 25%,transparent 25%) -3mm 0/6mm 6mm,linear-gradient(45deg,#1b9aaa 25%,transparent 25%) -3mm 0/6mm 6mm,#f2a900"></div><div style="position:absolute;left:0;right:0;top:6mm;height:1.2mm;background:#1d1d1d"></div><div style="position:absolute;left:0;right:0;bottom:6mm;height:1.2mm;background:#1d1d1d"></div>',
    ph: '7mm 4mm',
    pp: '12mm 6mm'
  },
  punk: {
    n: 'Punk (ransom note)',
    font: 'marker',
    pal: { bg: '#efefe8', ink: '#111', gr: '#333', ac: '#ff1493' },
    ransom: 1,
    h: '<div style="position:absolute;left:-5mm;right:-5mm;top:3mm;height:4mm;transform:rotate(-2.5deg);background:repeating-linear-gradient(45deg,#111 0 3mm,#ffe600 3mm 6mm)"></div><div style="position:absolute;left:-5mm;right:-5mm;bottom:2.5mm;height:4mm;transform:rotate(1.8deg);background:repeating-linear-gradient(45deg,#111 0 3mm,#ffe600 3mm 6mm)"></div>',
    p: '<div style="position:absolute;left:-6mm;right:-6mm;top:5mm;height:5mm;transform:rotate(-3deg);background:repeating-linear-gradient(45deg,#111 0 3mm,#ffe600 3mm 6mm)"></div><div style="position:absolute;left:-6mm;right:-6mm;bottom:5mm;height:5mm;transform:rotate(2.5deg);background:repeating-linear-gradient(45deg,#111 0 3mm,#ffe600 3mm 6mm)"></div><div style="position:absolute;right:5mm;top:14mm;color:#ff1493;font-size:9mm;transform:rotate(12deg)">'+ic('asterisk')+'</div>',
    ph: '9mm 4mm',
    pp: '16mm 5mm'
  }
};
const lgName = (g, d, fs, n) => (g.ransom ? lblRansom(d, fs * 0.8) : lblName(d, fs, n, 'text-align:center'));
const lgH = g => (d, w, h) =>
  `<div style="position:relative;height:100%">${g.h}<div style="position:relative;display:flex;align-items:stretch;gap:2mm;height:100%;padding:${g.ph}">${lblSideL(d, 3.1)}<div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.7mm;text-align:center"><div style="display:flex;gap:3mm;align-items:center">${lblLogo(d, 10)}${d.qr ? lblQr(d, 10) : ''}</div>${lgName(g, d, 8, 2)}${lblSty(d, 3.1)}${lblSmall(d.lMalt, 2.7, 1)}${lblSmall(d.lHop, 2.7, 1)}${lblSmall(d.lDate, 2.7, 1)}</div>${lblSideR(d, 3.1)}</div></div>`;
const lgP = g => (d, w, h) =>
  `<div style="position:relative;height:100%">${g.p}<div style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;height:100%;padding:${g.pp};gap:1.2mm">${lblLogo(d, 12)}${lgName(g, d, 10, 3)}${lblSty(d, 3.4)}${lblRule(d, 50)}${lblStats(d, 4)}${lblSmall(d.lMalt, 2.9, 2)}${lblSmall(d.lHop, 2.9, 2)}${lblSmall(d.lDate, 2.9, 2)}${d.qr ? lblQr(d, 14) : ''}${lblCode(d, 3)}</div></div>`;
Object.keys(LGEN).forEach(k => {
  const g = LGEN[k];
  LF.push(
    {
      id: 'g_' + k + '_h',
      font: g.font,
      pal: g.pal,
      n: g.n + ' — étiquette',
      w: 98,
      h: 62,
      shape: 'rect',
      pack: 'grid',
      r: lgH(g)
    },
    {
      id: 'g_' + k + '_p',
      font: g.font,
      pal: g.pal,
      n: g.n + ' — affiche',
      w: 75,
      h: 105,
      shape: 'rect',
      pack: 'grid',
      r: lgP(g)
    }
  );
});
/* ---------- calepinage A4 optimisé ---------- */
function lblPack(f, n) {
  const P = LBL_PAGE,
    aw = P.W - 2 * P.M,
    ah = P.H - 2 * P.M,
    g = P.G,
    pts = [];
  const grid = () => {
    const c = Math.floor((aw + g) / (f.w + g)),
      r = Math.floor((ah + g) / (f.h + g)),
      o = [];
    for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) o.push({ x: j * (f.w + g), y: i * (f.h + g) });
    return o;
  };
  const honey = () => {
    const px = f.w + g,
      py = f.h * 0.866 + g,
      o = [],
      rows = Math.floor((ah - f.h) / py) + 1;
    for (let i = 0; i < rows; i++) {
      const off = i % 2 ? px / 2 : 0,
        c = Math.floor((aw - off + g) / px);
      for (let j = 0; j < c; j++) o.push({ x: off + j * px, y: i * py });
    }
    return o;
  };
  const hexcol = () => {
    const px = f.w * 0.75 + g * 0.87,
      py = f.h + g,
      o = [],
      cols = Math.floor((aw - f.w) / px) + 1;
    for (let j = 0; j < cols; j++) {
      const off = j % 2 ? py / 2 : 0,
        r = Math.floor((ah - off + g) / py);
      for (let i = 0; i < r; i++) o.push({ x: j * px, y: off + i * py });
    }
    return o;
  };
  const diamond = () => {
    const px = f.w * 0.5 + g * 0.7,
      py = f.h + g,
      o = [],
      cols = Math.floor((aw - f.w) / px) + 1;
    for (let j = 0; j < cols; j++) {
      const off = j % 2 ? py / 2 : 0,
        r = Math.floor((ah - off + g) / py);
      for (let i = 0; i < r; i++) o.push({ x: j * px, y: off + i * py });
    }
    return o;
  };
  let best = grid();
  if (f.pack === 'diamond') {
    const h = diamond();
    if (h.length > best.length) best = h;
  } else if (f.pack === 'honey') {
    const h = honey();
    if (h.length > best.length) best = h;
  } else if (f.pack === 'hexcol') {
    const h = hexcol();
    if (h.length > best.length) best = h;
  }
  if (!best.length) return [];
  best = best.slice(0, n > 0 ? Math.min(n, best.length) : best.length);
  const x0 = Math.min(...best.map(p => p.x)),
    x1 = Math.max(...best.map(p => p.x + f.w)),
    y0 = Math.min(...best.map(p => p.y)),
    y1 = Math.max(...best.map(p => p.y + f.h));
  const ox = (P.W - (x1 - x0)) / 2 - x0,
    oy = (P.H - (y1 - y0)) / 2 - y0;
  return best.map(p => ({ x: +(p.x + ox).toFixed(2), y: +(p.y + oy).toFixed(2) }));
}
const lblMax = f => lblPack(f, 0).length;
/* ---------- QR (SVG) ---------- */
function lblQrSvg(url) {
  url = String(url || '').trim();
  if (!url || typeof qrcode === 'undefined') return '';
  try {
    const q = qrcode(0, 'M');
    q.addData(url);
    q.make();
    const n = q.getModuleCount(),
      m = 1;
    let p = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) p += `M${c + m} ${r + m}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 2 * m} ${n + 2 * m}" width="100%" height="100%" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${p}" fill="#000"/></svg>`;
  } catch (e) {
    return '';
  }
}
/* ---------- données ---------- */
function lblData() {
  const R = S.kv.recipe,
    E = S.kv.equip,
    Q = R.etq || {},
    c = compute(),
    H = hh,
    base = n => String(n || '').replace(/\s*\(.*$/, ''),
    y = (R.date || '').slice(0, 4) || String(new Date().getFullYear()),
    tot = R.malts.reduce((a, m) => a + (+m.g || 0), 0),
    malts = R.malts
      .filter(m => (+m.g || 0) > 0)
      .map(m => base(m.n) + (tot ? ' ' + Math.round((m.g / tot) * 100) + '%' : ''))
      .join(', '),
    hops = [...new Set(R.hops.filter(h => (+h.g || 0) > 0).map(h => base(h.n)))].join(', '),
    yeast = [...new Set(R.yeasts.filter(h => h.n).map(h => base(h.n)))].join(', '),
    emb = R.embou || Q.embou || '',
    ibu = Math.round(c.ibu || 0),
    code = brewNo(R).code + '   ' + ibu + ' IBU',
    acc = Q.accent || '#d9480f',
    cl = Q.cl || 50;
  const d = {
    yr: y,
    name: R.name || '',
    nameH: H(R.name || ''),
    styleH: H(R.style || ''),
    abvH: nf(c.abv || 0, 1),
    ibuH: ibu,
    clH: H(String(cl)),
    codeH: H(code),
    acc,
    bgu: !!Q.bgu,
    accu: !!Q.accu,
    inku: !!Q.inku,
    ink: Q.ink || '#111111',
    bgc: lblBgc(Q),
    dk: lblDark(lblBgc(Q)),
    logo: E.logo || '',
    qr: lblQrSvg(Q.url),
    lMalt: malts ? 'Malt : ' + H(malts) : '',
    lHop: hops || yeast ? 'Houblon : ' + H(hops || '-') + ' – Levure : ' + H(yeast || '-') : '',
    lBrass: 'Brassage : ' + (R.date ? fd(R.date) : '-'),
    lEmb: 'Embouteillage : ' + (emb ? fd(emb) : '-'),
    lStyle: 'Style : ' + H(R.style || '-')
  };
  d.lDate = 'Brassage : ' + (R.date ? fd(R.date) : '-') + ' – Embouteillage : ' + (emb ? fd(emb) : '-');
  d.lDS = d.lDate + ' – Style : ' + H(R.style || '-');
  return d;
}
/* ---------- rendu ---------- */
const lblDefaults = f => ({
  fnt: f.font || 'rocker',
  bgc: f.pal ? f.pal.bg : '#ffffff',
  accent: f.pal ? f.pal.ac : '#d9480f',
  ink: f.pal ? f.pal.ink : '#111111'
});
function lblOne(f, d, x, y) {
  let P = f.pal;
  if (P) {
    const own = !d.bgu || String(d.bgc).toLowerCase() === P.bg.toLowerCase(),
      dk = own ? !!P.dk : lblDark(d.bgc);
    P = { ...P, bg: d.bgu ? d.bgc : P.bg, ac: d.accu ? d.acc : P.ac, dk };
    if (!own) Object.assign(P, dk ? { ink: '#f6f1e4', gr: '#ddd6c4' } : { ink: '#1c1c1c', gr: '#444' });
    d = { ...d, acc: P.ac, dk };
  }
  const a = d.acc,
    w = f.w,
    h = f.h,
    bg = P ? P.bg : d.bgc || (d.dk ? '#15110e' : '#ffffff');
  return `<div class="lb" style="left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm${P ? `;--lft:${P.ink};--lfg:${P.gr}` : ''}${d.inku && /^#[0-9a-f]{6}$/i.test(d.ink) ? `;--lft:${d.ink};--lfg:${d.ink}` : ''}"><svg class="lbs" viewBox="0 0 ${w} ${h}" width="${w}mm" height="${h}mm">${lblShape(f.shape, 0.1, 0.1, w - 0.2, h - 0.2, `fill="${bg}" stroke="#c4c4c4" stroke-width=".2"`)}${lblShape(f.shape, 1.3, 1.3, w - 2.6, h - 2.6, `fill="none" stroke="${a}" stroke-width=".5"`)}</svg><div class="lbc">${f.r(d, w, h)}</div></div>`;
}
function lblSheet(f, d, n) {
  return lblPack(f, n)
    .map(p => lblOne(f, d, p.x, p.y))
    .join('');
}
function lblThumb(f, sel) {
  const k = Math.min(64 / f.w, 48 / f.h),
    w = f.w * k,
    h = f.h * k;
  return `<svg viewBox="0 0 ${f.w} ${f.h}" width="${w.toFixed(1)}" height="${h.toFixed(1)}">${lblShape(f.shape, 0.5, 0.5, f.w - 1, f.h - 1, `fill="${sel ? '#ffd60a22' : '#ffffff10'}" stroke="${sel ? '#ffd60a' : '#8a93a3'}" stroke-width="${(1.6 / k).toFixed(2)}"`)}</svg>`;
}
/* applique police / fond sur la planche */
const lblBgc = Q => (/^#[0-9a-f]{6}$/i.test(Q.bgc || '') ? Q.bgc : Q.bg === 'dark' ? '#15110e' : '#ffffff'),
  lblDark = h => {
    const n = parseInt(h.slice(1), 16),
      r = n >> 16,
      g = (n >> 8) & 255,
      b = n & 255;
    return 0.299 * r + 0.587 * g + 0.114 * b < 140;
  };
function lblTheme(pg, Q, f) {
  const dk = lblDark(lblBgc(Q)),
    st = pg.style,
    F = lblFont(!Q.fnt || Q.fnt === 'auto' ? (f && f.font) || 'rocker' : Q.fnt);
  st.setProperty('--lfn', F.f);
  st.setProperty('--lfu', F.up);
  st.setProperty('--lfls', F.ls);
  st.setProperty('--lfw', F.w);
  st.setProperty(
    '--lfb',
    F.id === 'std'
      ? "'Inter',sans-serif"
      : f && f.body === 'cond'
        ? "'LF Oswald',sans-serif"
        : "'LF Oswald',sans-serif"
  );
  st.setProperty('--lft', dk ? '#f5f0e8' : '#111');
  st.setProperty('--lfg', dk ? '#c9c0b4' : '#3a3a3a');
}
/* taille de la police de l'étiquette : coefficient (boutons A↑ / A↓), 100 % = taille du modèle */
const lblFsz = () => Math.max(0.4, Math.min(2.5, (+((S.kv.recipe.etq || {}).fsz) || 100) / 100));
/* réduit les noms trop longs jusqu'à ce qu'ils tiennent (sans débordement) */
function lblFitAll(pg) {
  pg.querySelectorAll('.lbn').forEach(el => {
    let fs = (parseFloat(el.dataset.fs) || 5) * lblFsz(),
      min = fs * 0.4,
      n = 0;
    el.style.fontSize = fs + 'mm';
    const bad = () =>
      el.classList.contains('lbv')
        ? el.scrollHeight > el.parentNode.clientHeight + 1
        : el.scrollHeight > el.clientHeight + 0.3 * fs * 3.7795 || el.scrollWidth > el.clientWidth + 1;
    while (bad() && fs > min && n++ < 40) {
      fs *= 0.95;
      el.style.fontSize = fs.toFixed(2) + 'mm';
    }
  });
}
function labelsScreen() {
  const R = S.kv.recipe;
  R.etq = R.etq || {};
  const Q = R.etq,
    fid = Q.fmt && LF.some(f => f.id === Q.fmt) ? Q.fmt : 'bandeauxl';
  Q.fmt = fid;
  Q.fnt = Q.fnt || 'auto';
  Q.bgc = lblBgc(Q);
  const pg =
    document.getElementById('pgstyle') ||
    document.head.appendChild(Object.assign(document.createElement('style'), { id: 'pgstyle' }));
  pg.textContent = '@page{size:A4 portrait;margin:0}';
  main.innerHTML = `<div class="noprint" style="padding:8px 12px"><button onclick="window.print()">🖨 Imprimer / PDF</button></div><div class="panel noprint lblform"><h3>Étiquettes</h3><div class="eq">
 <label class="lurl">Texte du QR Code<input type="text" id="lurl" placeholder="https://… ou texte libre" data-q="url" value="${esc(Q.url || '')}"></label>
 <label>Volume (cl)<input type="number" min="1" step="1" data-q="cl" value="${esc(Q.cl ?? 50)}"></label>
 <label>Nombre<input type="number" min="0" step="1" data-q="n" placeholder="max" value="${Q.n || ''}"></label>
 <label>Cadre<input type="color" data-q="accent" value="${esc(Q.accent || '#d9480f')}" style="width:44px;padding:0"></label>
 <label>Police<span class="fselr"><select data-q="fnt" class="fsel" data-auto="auto" data-alab="Auto (selon le modèle)" hidden>${fontOpts(Q.fnt, 'auto', 'Auto (selon le modèle)')}</select><input class="fin" type="text" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" placeholder="Choisir ou saisir une police…" title="Liste déroulante (chaque police affichée dans son style) ou saisie avec autocomplétion"><span class="fszw noprint"><button type="button" class="fszb" data-fsz="1" title="Augmenter la taille de la police (${Math.round((+Q.fsz || 100))} %)" aria-label="Augmenter la taille de la police"><svg viewBox="0 0 28 22" width="28" height="22"><text x="2" y="19" font-size="19" font-weight="600" fill="currentColor" font-family="sans-serif">A</text><path d="M20 15V4M16 8l4-5 4 5" fill="none" stroke="#3b9cff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button type="button" class="fszb" data-fsz="-1" title="Réduire la taille de la police (${Math.round((+Q.fsz || 100))} %)" aria-label="Réduire la taille de la police"><svg viewBox="0 0 28 22" width="28" height="22"><text x="4" y="19" font-size="15" font-weight="600" fill="currentColor" font-family="sans-serif">A</text><path d="M20 5v11M16 12l4 5 4-5" fill="none" stroke="#3b9cff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></span></span></label>
 <label>Couleur police<input type="color" data-q="ink" value="${esc(Q.ink || lblDefaults(LF.find(z => z.id === fid) || LF[0]).ink)}" style="width:44px;padding:0"></label>
 <label>Fond<input type="color" data-q="bgc" value="${esc(lblBgc(Q))}" style="width:44px;padding:0"></label></div>
 <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:8px"><div id="linfo" class="lblinfo" style="margin:0"></div></div></div><div class="lblwrap" style="margin-top:0"><div class="lblmain"><div class="lblpre" id="lpre"><div class="lbpage" id="lpage"></div></div></div>
 <div class="lblside noprint" id="lside"><h3>Formats</h3>${LF.map(f => `<button class="fmt${f.id === fid ? ' sel' : ''}" data-fmt="${f.id}" title="${f.n} — ${f.w} × ${f.h} mm"><span class="th">${lblThumb(f, f.id === fid)}</span><span class="ft"><b>${f.n}</b><small>${f.w} × ${f.h} mm</small><small class="cnt">${lblMax(f)} / feuille A4</small></span></button>`).join('')}</div></div>`;
  lblRegFonts();
  lblRefresh();
  window.onresize = () => {
    if (document.getElementById('lpage')) lblScale();
  };
}
function lblScale() {
  const pre = document.getElementById('lpre'),
    pg = document.getElementById('lpage');
  if (!pre || !pg) return;
  const px = 210 * 3.7795,
    s = Math.min(1, (pre.clientWidth - 2) / px);
  pg.style.transform = `scale(${s})`;
  pre.style.height = 297 * 3.7795 * s + 2 + 'px';
}
function lblRefresh() {
  fntSync();
  const R = S.kv.recipe,
    Q = R.etq,
    f = LF.find(x => x.id === Q.fmt) || LF[0],
    d = lblData(),
    pg = document.getElementById('lpage');
  if (!pg) return;
  lblTheme(pg, Q, f);
  pg.innerHTML = lblSheet(f, d, +Q.n || 0);
  lblFitAll(pg);
  /* pas de clignotement : on masque la planche le temps que la police se charge, puis on ajuste une seule fois */
  if (document.fonts && document.fonts.ready) {
    const t = ++lblRefresh.t,
      wait = document.fonts.status === 'loading';
    if (wait) pg.style.visibility = 'hidden';
    document.fonts.ready.then(() => {
      if (t === lblRefresh.t && document.getElementById('lpage') === pg) {
        lblFitAll(pg);
        pg.style.visibility = '';
      }
    });
  }
  const cnt = pg.querySelectorAll('.lb').length;
  const msg = [`<b>${cnt}</b> étiquette(s) ${f.n.toLowerCase()} (${f.w} × ${f.h} mm) sur la feuille A4`];
  if (!S.kv.equip.logo) msg.push('⚠ aucun logo : ajoutez-le dans <b>Paramètres › Logo des étiquettes</b>');
  if (!d.qr) msg.push('ℹ saisissez une URL pour générer le QR Code');
  document.getElementById('linfo').innerHTML = msg.join(' · ');
  lblScale();
}
lblRefresh.t = 0;
/* précharge la police AVANT de redessiner : plus de planche masquée puis réaffichée (clignotement) */
function fontReady(id) {
  try {
    const f = fontAll().find(z => z.id === id);
    if (!f || !f.f || !document.fonts) return true;
    return f.f
      .split(',')
      .map(x => x.trim())
      .filter(x => /^'/.test(x))
      .every(x => document.fonts.check('16px ' + x));
  } catch (e) {
    return true;
  }
}
function fontPre(id) {
  try {
    const f = fontAll().find(z => z.id === id);
    if (f && f.f && document.fonts)
      return Promise.all(
        f.f
          .split(',')
          .map(x => x.trim())
          .filter(x => /^'/.test(x))
          .map(x => document.fonts.load('16px ' + x).catch(() => 0))
      ).then(() => 0);
  } catch (e) {}
  return Promise.resolve();
}
/* événements (délégués) */
document.addEventListener('input', e => {
  const t = e.target;
  if (t && t.dataset && t.dataset.q !== undefined && document.getElementById('lpage')) {
    const Q = (S.kv.recipe.etq = S.kv.recipe.etq || {});
    Q[t.dataset.q] = t.dataset.q === 'n' ? parseInt(t.value) || 0 : t.value;
    if (t.dataset.q === 'bgc') Q.bgu = 1;
    if (t.dataset.q === 'accent') Q.accu = 1;
    if (t.dataset.q === 'ink') Q.inku = 1;
    if (t.dataset.q === 'fnt' && !fontReady(Q.fnt))
      fontPre(Q.fnt).then(() => {
        if (Q.fnt === t.value) lblRefresh();
      });
    else lblRefresh();
    save();
  }
});
/* clic sur un format : mise à jour sur place (la liste de droite garde sa position de défilement) */
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-fmt]');
  if (b && document.getElementById('lside')) {
    const Q = (S.kv.recipe.etq = S.kv.recipe.etq || {});
    Q.fmt = b.dataset.fmt;
    const nf0 = LF.find(z => z.id === Q.fmt) || LF[0],
      D = lblDefaults(nf0);
    Q.fnt = D.fnt;
    Q.bgc = D.bgc;
    Q.accent = D.accent;
    Q.ink = D.ink;
    Q.inku = 0;
    Q.bgu = 1;
    Q.accu = 1;
    Q.bg = lblDark(D.bgc) ? 'dark' : 'light';
    [
      ['bgc', D.bgc],
      ['accent', D.accent],
      ['ink', D.ink],
      ['fnt', D.fnt]
    ].forEach(([k, v]) => {
      const el = document.querySelector('[data-q="' + k + '"]');
      if (el) el.value = v;
    });
    save();
    document.querySelectorAll('#lside .fmt').forEach(x => {
      const on = x === b,
        f = LF.find(z => z.id === x.dataset.fmt);
      x.classList.toggle('sel', on);
      x.querySelector('.th').innerHTML = lblThumb(f, on);
    });
    lblRefresh();
  }
});
/* boutons A↑ / A↓ : taille de la police de l'étiquette (pas de 10 %, de 40 % à 250 %) */
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-fsz]');
  if (!b || !document.getElementById('lpage')) return;
  const Q = S.kv.recipe.etq || (S.kv.recipe.etq = {}),
    v = Math.max(40, Math.min(250, Math.round(((+Q.fsz || 100) + 10 * +b.dataset.fsz) / 10) * 10));
  Q.fsz = v;
  document.querySelectorAll('[data-fsz]').forEach(x => {
    x.title = (+x.dataset.fsz > 0 ? 'Augmenter' : 'Réduire') + ' la taille de la police (' + v + ' %)';
  });
  save();
  lblRefresh();
});

document.addEventListener('change', async e => {
  const t = e.target;
  if (t && t.id === 'fontfile' && t.files[0]) {
    /* import de plusieurs polices à la fois : chaque fichier est lu, puis une seule sauvegarde */
    const files = [...t.files],
      rd = f =>
        new Promise(res => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.onerror = () => res(null);
          fr.readAsDataURL(f);
        });
    t.value = '';
    const E = S.kv.equip;
    E.fonts = E.fonts || [];
    let n0 = 0;
    for (const file of files) {
      const d = await rd(file);
      if (!d) continue;
      const n =
        file.name
          .replace(/\.[^.]+$/, '')
          .replace(/[^\w \-]/g, '')
          .trim() || 'Police';
      if (E.fontmap && E.fontmap[n]) {
        /* la police réimportée reprend sa place : le remplacement automatique n'a plus lieu d'être */
        lblUnregFont(n, 1);
        delete E.fontmap[n];
      }
      lblUnregFont(n);
      const k = E.fonts.findIndex(x => x.n === n) /* remplacée sur place : les références u<n> restent valables */;
      if (k >= 0) E.fonts[k] = { n, d };
      else E.fonts.push({ n, d });
      n0++;
    }
    if (!n0) return;
    save();
    lblRegFonts();
    fontsRefresh();
    if (typeof notify === 'function') notify('fonts', '✔ ' + n0 + ' police' + (n0 > 1 ? 's' : '') + ' importée' + (n0 > 1 ? 's' : ''), 'ok');
  }
});
/* champs date : un clic n'importe où ouvre le calendrier */
document.addEventListener('click', e => {
  const t = e.target;
  if (t && t.tagName === 'INPUT' && t.type === 'date' && t.showPicker) {
    try {
      t.showPicker();
    } catch (_) {}
  }
});
/* logo (Paramètres) */
function logoPanel() {
  const L = S.kv.equip.logo;
  return `<div class="panel"><h3>Logo des étiquettes</h3><div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div class="logoprev">${L ? `<img src="${L}" alt="logo">` : '<small>Aucun logo</small>'}</div><div style="display:flex;flex-direction:column;gap:8px"><label class="btn">Choisir une image<input type="file" id="logofile" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden></label>${L ? '<button id="logorm" class="dng">Supprimer le logo</button>' : ''}<small>PNG, JPG ou SVG — redimensionné à 500 px maximum et enregistré dans la base. Repris sur toutes les étiquettes.</small></div></div></div>`;
}
function logoSvgToData(l, cb) {
  const m = l.svg.match(/viewBox="0 0 (\d+) (\d+)"/),
    W = 500,
    H = Math.round((W * +m[2]) / +m[1]),
    s = l.svg.replace('<svg ', `<svg width="${W}" height="${H}" `),
    im = new Image();
  im.onload = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    c.getContext('2d').drawImage(im, 0, 0, W, H);
    cb(c.toDataURL('image/webp', 0.92));
  };
  im.onerror = () => bcAlert('Logo illisible');
  im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
}
function logoBind() {
  document.querySelectorAll('[data-logo]').forEach(
    b =>
      (b.onclick = () => {
        const l = LOGOS.find(x => x.id === b.dataset.logo);
        if (l)
          logoSvgToData(l, u => {
            S.kv.equip.logo = u;
            S.kv.equip.logon = l.n;
            save();
            params();
          });
      })
  );
  const f = document.getElementById('logofile'),
    rm = document.getElementById('logorm');
  if (f)
    f.onchange = ev => {
      const file = ev.target.files[0];
      if (!file) return;
      const fr = new FileReader();
      fr.onload = () => {
        const im = new Image();
        im.onload = () => {
          const k = Math.min(1, 500 / Math.max(im.width, im.height)),
            c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(im.width * k));
          c.height = Math.max(1, Math.round(im.height * k));
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          S.kv.equip.logo = c.toDataURL('image/webp', 0.92);
          S.kv.equip.logon = file.name.replace(/\.[^.]+$/, '') || 'Logo';
          save();
          params();
        };
        im.onerror = () => bcAlert('Image illisible');
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    };
  if (rm)
    rm.onclick = () => {
      delete S.kv.equip.logo;
      delete S.kv.equip.logon;
      save();
      params();
    };
}
/* ---------- modèles « inspirés » de vraies étiquettes (flûte noir & or, taches pastel, éventail, tour de bouteille, phare, ovales vintage, kraft, blasons) ---------- */
const lblIcons = (d, s, col) => {
  const c = col || 'currentColor',
    b = `display:inline-flex;align-items:center;justify-content:center;width:${s}mm;height:${s}mm;border:.35mm solid ${c};border-radius:50%;font:700 ${s * 0.4}mm/1 var(--lfb);color:${c}`;
  return `<div style="display:flex;gap:1.2mm;align-items:center;color:${c}"><span style="${b}">18+</span><span style="${b};font-size:${s * 0.62}mm">${ic('recycle')}</span><span style="${b};font-size:${s * 0.55}mm">⚠</span></div>`;
};
const lblTx = (d, t, fs, x) => `<div class="lbb" style="font-size:${fs}mm;line-height:1.25;${x || ''}">${t}</div>`;
const LIN = [
  {
    id: 'in_flute',
    font: 'condgras',
    n: 'Noir & or — cartouche (La Flûte)',
    w: 190,
    h: 100,
    pal: { bg: '#15130f', ink: '#e6c27a', gr: '#cdb27a', ac: '#e6c27a', dk: 1 },
    r: (d, w, h) =>
      `<div style="position:relative;height:100%;padding:6mm 8mm"><div style="position:absolute;inset:3.2mm;border:.4mm solid ${d.acc}"></div><div style="position:relative;display:flex;gap:6mm;height:100%;align-items:stretch"><div style="width:44mm;flex:none;display:flex;flex-direction:column;justify-content:space-between;padding:2mm 0">${lblSty(d, 3.4, 'text-transform:uppercase;letter-spacing:.12em;font-style:normal')}<div>${lblSmall(d.lMalt, 2.8, 4)}${lblSmall(d.lHop, 2.8, 4)}</div>${lblSmall(d.lBrass, 2.8, 1, 'font-weight:700')}</div><div style="flex:1;min-width:0;display:flex;align-items:center;justify-content:center"><div style="width:100%;height:100%;max-height:70mm;background:linear-gradient(${d.acc},${d.acc}) 0 0/100% .5mm no-repeat,linear-gradient(${d.acc},${d.acc}) 0 100%/100% .5mm no-repeat;clip-path:none;border-left:.5mm solid ${d.acc};border-right:.5mm solid ${d.acc};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2mm 4mm;gap:1mm;text-align:center">${lblLogo(d, 10)}${lblName(d, 17, 2, 'text-align:center')}${lblStats(d, 4, 'letter-spacing:.15em')}</div></div><div style="width:44mm;flex:none;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end;text-align:right;padding:2mm 0">${lblSmall(d.lEmb, 2.8, 2)}${d.qr ? lblQr(d, 18) : ''}${lblCode(d, 3.2)}</div></div></div>`
  },
  {
    id: 'in_alsa',
    font: 'condgras',
    n: 'Taches pastel (L’Alsacienne)',
    w: 190,
    h: 100,
    pal: { bg: '#ffffff', ink: '#1d4e89', gr: '#2c4a6e', ac: '#f4a79d' },
    r: (d, w, h) =>
      `<div style="position:relative;height:100%"><div style="position:absolute;left:-10mm;top:12mm;width:58mm;height:54mm;background:#f9cfb2;border-radius:48% 52% 60% 40%/55% 45% 55% 45%"></div><div style="position:absolute;left:-16mm;top:-18mm;width:56mm;height:44mm;background:#1d4e89;border-radius:60% 40% 50% 50%/50% 60% 40% 50%"></div><div style="position:absolute;right:24mm;top:6mm;width:78mm;height:62mm;background:#f6a99a;border-radius:50% 50% 45% 55%/60% 40% 60% 40%;opacity:.95"></div><div style="position:absolute;left:12mm;bottom:-14mm;width:60mm;height:34mm;background:#1d4e89;border-radius:50%"></div><div style="position:absolute;right:-8mm;bottom:-8mm;width:36mm;height:30mm;background:#f6a99a;border-radius:50%"></div><div style="position:relative;display:flex;gap:3mm;height:100%;padding:6mm 6mm"><div style="width:7mm;flex:none">${lblVert(d.styleH, 3.2, 'color:#1d4e89')}</div><div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center"><div style="display:flex;gap:3mm;align-items:center">${lblLogo(d, 10)}</div>${lblName(d, 17, 2, 'text-align:center;color:#1d4e89')}<div style="font:500 3.6mm/1.2 var(--lfb);letter-spacing:.12em;text-transform:uppercase">${d.lStats || d.abvH + ' % alc./vol · ' + d.clH + ' cl'}</div></div><div style="width:42mm;flex:none;display:flex;flex-direction:column;justify-content:space-between;text-align:right;align-items:flex-end">${lblTx(d, d.styleH, 5, 'font-weight:700;color:#1d4e89;font-family:var(--lfn)')}<div style="background:#fff9;padding:1mm">${lblSmall(d.lMalt, 2.6, 3)}${lblSmall(d.lHop, 2.6, 3)}</div>${d.qr ? lblQr(d, 14) : ''}${lblCode(d, 3)}</div></div></div>`
  },
  {
    id: 'in_eventail',
    font: 'condgras',
    n: 'Éventail doré (titre penché)',
    w: 190,
    h: 100,
    pal: { bg: '#ffffff', ink: '#111111', gr: '#333333', ac: '#f4c95d' },
    r: (d, w, h) =>
      `<div style="position:relative;height:100%"><div style="position:absolute;left:50%;top:50%;width:150mm;height:150mm;margin:-75mm 0 0 -75mm;background:repeating-conic-gradient(#f4c95d 0 3.2deg,transparent 3.2deg 9deg);-webkit-mask-image:radial-gradient(circle,transparent 0 28%,#000 29% 50%,transparent 52%);mask-image:radial-gradient(circle,transparent 0 28%,#000 29% 50%,transparent 52%)"></div><div style="position:absolute;left:8mm;top:7mm;width:48mm">${lblSmall(d.lMalt, 2.7, 4)}</div><div style="position:absolute;right:8mm;top:7mm;text-align:right">${lblTx(d, 'MISE EN BOUTEILLE', 2.6, 'letter-spacing:.15em')}${lblTx(d, d.lEmb.replace('Embouteillage : ', ''), 4.2, 'font-family:var(--lfn)')}</div><div style="position:absolute;left:0;right:0;top:50%;transform:translateY(-50%) rotate(-8deg);text-align:center;padding:0 12mm;display:flex;flex-direction:column;align-items:center;gap:1mm">${lblTx(d, d.clH + ' cl · ' + d.abvH + ' % alc.', 3.4, 'letter-spacing:.15em')}${lblName(d, 22, 1, 'text-align:center;align-self:stretch')}${lblSty(d, 4.4, 'text-transform:uppercase;letter-spacing:.1em;font-style:normal')}</div><div style="position:absolute;left:8mm;bottom:7mm;width:42mm">${lblSmall(d.lBrass, 2.7, 1)}${lblSmall(d.lHop, 2.7, 3)}</div><div style="position:absolute;right:8mm;bottom:6mm;display:flex;gap:3mm;align-items:flex-end">${d.qr ? lblQr(d, 14) : ''}${lblLogo(d, 12)}</div></div>`
  },
  {
    id: 'in_silly',
    font: 'vintage',
    n: 'Tour de bouteille — cartouche (Silly)',
    w: 190,
    h: 80,
    pal: { bg: '#d9772b', ink: '#fbe7b5', gr: '#fbe7b5', ac: '#fbe7b5', dk: 1 },
    r: (d, w, h) =>
      `<div style="display:flex;gap:4mm;height:100%;padding:5mm 7mm;align-items:stretch"><div style="width:48mm;flex:none;display:flex;flex-direction:column;justify-content:space-between;text-align:left">${lblSmall(d.lStyle, 2.8, 2, 'font-weight:700')}<div>${lblSmall(d.lMalt, 2.6, 4)}${lblSmall(d.lHop, 2.6, 4)}</div>${lblStats(d, 3.2)}${lblIcons(d, 5)}</div><div style="flex:1;min-width:0;display:flex;align-items:center;justify-content:center"><div style="width:100%;height:100%;background:#fbe7b5;border-radius:6mm 6mm 12mm 12mm/6mm 6mm 14mm 14mm;border:.8mm solid #fbe7b5;outline:.5mm solid #d9772b;outline-offset:-2.2mm;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1mm;padding:3mm 4mm;text-align:center;color:#a3341a;--lft:#a3341a">${lblLogo(d, 10)}${lblName(d, 15, 2, 'text-align:center;color:#a3341a')}<div class="lbb" style="font-size:3.6mm;font-style:italic;color:#a3341a">${d.styleH}</div></div></div><div style="width:48mm;flex:none;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end;text-align:right">${lblLogo(d, 12)}${lblSmall(d.lBrass, 2.6, 1)}${lblSmall(d.lEmb, 2.6, 1)}${d.qr ? lblQr(d, 14) : ''}${lblCode(d, 3)}</div></div>`
  },
  {
    id: 'in_armen',
    font: 'anton',
    n: 'Phare & vagues (Ar-Men)',
    w: 190,
    h: 80,
    pal: { bg: '#0e2a47', ink: '#ffffff', gr: '#cfe8f2', ac: '#2bb3a3', dk: 1 },
    r: (d, w, h) =>
      `<div style="position:relative;height:100%"><div style="position:absolute;left:0;right:0;bottom:0;height:50%;background:radial-gradient(circle at 50% 100%,#2bb3a3 0 7mm,transparent 7.4mm) 0 100%/14mm 10mm repeat-x,radial-gradient(circle at 50% 100%,#1c8c85 0 7mm,transparent 7.4mm) 7mm 100%/14mm 18mm repeat-x,linear-gradient(transparent,#0b6f73)"></div><div style="position:absolute;left:50%;top:-4mm;transform:translateX(-50%);width:0;height:0;border-left:30mm solid transparent;border-right:30mm solid transparent;border-bottom:60mm solid #ffffff14"></div><div style="position:relative;display:flex;gap:5mm;height:100%;padding:5mm 7mm"><div style="width:44mm;flex:none;display:flex;flex-direction:column;justify-content:space-between">${lblLogo(d, 13)}${lblSmall(d.lMalt, 2.7, 4)}${lblSmall(d.lHop, 2.7, 4)}${lblIcons(d, 5)}</div><div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:1mm"><div class="lbb" style="font-size:3mm;letter-spacing:.25em;text-transform:uppercase">${d.lBrass}</div>${lblName(d, 24, 1, 'text-align:center;align-self:stretch')}${lblSty(d, 5, 'font-style:normal;letter-spacing:.2em;text-transform:uppercase')}${lblStats(d, 4.4)}</div><div style="width:44mm;flex:none;display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-end;gap:1.5mm;background:#0e2a47cc;padding:2mm;border:.3mm solid #2bb3a3;text-align:right">${lblStats(d, 4)}${lblSmall(d.lBrass, 2.6, 1)}${d.qr ? lblQr(d, 14) : ''}${lblCode(d, 3)}</div></div></div>`
  }
];
const lblOval = (id, n, pal, font, orn) => ({
  id,
  font,
  n,
  w: 80,
  h: 110,
  shape: 'oval',
  pal,
  r: (d, w, h) =>
    `<div style="position:relative;height:100%"><div style="position:absolute;inset:2.5mm;border:3.2mm solid ${pal.ink};border-radius:50%"></div><div style="position:absolute;inset:7.5mm;border:.4mm solid ${pal.ac};border-radius:50%"></div>${orn}<div style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;height:100%;padding:16mm 12mm;gap:1.2mm">${lblTx(d, d.styleH, 4.2, 'font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:' + pal.ink)}${lblLogo(d, 11)}${lblName(d, 13, 3, 'text-align:center')}${lblRule(d, 40)}${lblStats(d, 4)}${lblSmall(d.lMalt, 2.6, 2)}${d.qr ? lblQr(d, 13) : ''}${lblCode(d, 3)}</div></div>`
});
LIN.push(
  lblOval(
    'in_semeuse',
    'Ovale vintage bleu (La Semeuse)',
    { bg: '#f1dcc3', ink: '#24305e', gr: '#3a456f', ac: '#24305e' },
    'vintage',
    '<div style="position:absolute;left:3mm;top:50%;color:#24305e;font-size:9mm;transform:translateY(-50%)">'+ic('sprout')+'</div><div style="position:absolute;right:3mm;top:50%;color:#24305e;font-size:9mm;transform:translateY(-50%) scaleX(-1)">'+ic('sprout')+'</div>'
  )
);
const lblBlason = (id, n, pal, font, deco, ink2) => ({
  id,
  font,
  n,
  w: 75,
  h: 105,
  shape: 'rect',
  pal,
  r: (d, w, h) =>
    `<div style="position:relative;height:100%">${deco}<div style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;height:100%;padding:12mm 7mm;gap:1.3mm">${lblTx(d, d.styleH, 3.8, 'letter-spacing:.2em;text-transform:uppercase;font-weight:700')}${lblLogo(d, 12)}${lblName(d, 15, 2, 'text-align:center')}${lblRule(d, 50)}${lblStats(d, 4.2)}${lblSmall(d.lMalt, 2.7, 2)}${lblSmall(d.lHop, 2.7, 2)}${lblSmall(d.lDate, 2.6, 2)}${d.qr ? lblQr(d, 13) : ''}${lblCode({ ...d, acc: pal.cc || d.acc }, 3)}</div></div>`
});
LIN.push(
  lblBlason(
    'in_pils',
    'Pilsner — vert & blanc (Family Brewery)',
    { bg: '#ffffff', ink: '#1f6b3a', gr: '#2a5a3c', ac: '#1f6b3a' },
    'condgras',
    '<div style="position:absolute;left:0;right:0;top:0;height:9mm;background:#1f6b3a"></div><div style="position:absolute;left:0;right:0;bottom:0;height:9mm;background:#1f6b3a"></div><div style="position:absolute;left:5mm;right:5mm;top:12mm;bottom:12mm;border:.4mm solid #1f6b3a"></div>'
  ),
  lblBlason(
    'in_porter',
    'Porter — brun & diagonale (Family Brewery)',
    { bg: '#3a1f14', ink: '#2a140c', gr: '#f3e6d4', ac: '#f3e6d4', dk: 1 },
    'condgras',
    '<div style="position:absolute;inset:0;background:linear-gradient(135deg,transparent 0 8%,#f3e6d4 8% 92%,transparent 92%)"></div><div style="position:absolute;inset:4mm;border:.4mm solid #f3e6d4"></div>'
  ),
  lblBlason(
    'in_red',
    'Blason rouge & or (Red Beer)',
    { bg: '#b3141c', ink: '#f4d58d', gr: '#f4d58d', ac: '#f4d58d', dk: 1 },
    'vintage',
    '<div style="position:absolute;inset:3.5mm;border:.5mm solid #f4d58d;border-radius:8mm"></div><div style="position:absolute;inset:5.5mm;border:.8mm dotted #f4d58d;border-radius:6.5mm"></div><div style="position:absolute;left:0;right:0;top:9mm;text-align:center;color:#f4d58d;font-size:6mm">'+ic('flower')+'</div><div style="position:absolute;left:0;right:0;bottom:8mm;text-align:center;color:#f4d58d;font-size:5mm">'+ic('flower2')+' '+ic('flower')+' '+ic('flower2')+'</div>'
  )
);
LIN.push(
  {
    id: 'in_tag',
    font: 'condgras',
    n: 'Tag kraft vertical (Admiral)',
    w: 55,
    h: 110,
    shape: 'chamfer',
    pal: { bg: '#c9a572', ink: '#2b2118', gr: '#3b2f22', ac: '#2b2118' },
    r: (d, w, h) =>
      `<div style="position:relative;height:100%"><div style="position:absolute;inset:0;background:repeating-radial-gradient(circle at 30% 20%,#0000000a 0 .4mm,transparent .4mm .9mm)"></div><div style="position:absolute;left:50%;top:5mm;width:7mm;height:7mm;margin-left:-3.5mm;border-radius:50%;background:#e9dcc3;border:.5mm solid #2b2118"></div><div style="position:relative;display:flex;gap:2mm;height:100%;padding:16mm 4mm 6mm"><div style="flex:1;min-width:0;display:flex;align-items:stretch;justify-content:center;gap:2mm">${lblVCol(lblVert(d.nameH, 11, 'text-transform:var(--lfu);font-family:var(--lfn);font-weight:400'), 15, 'center')}${lblVCol(lblVert(d.styleH + ' · ' + d.abvH + ' % · ' + d.clH + ' cl', 3.4) + lblVert(d.codeH, 3, 'white-space:pre'), 7, 'space-between')}</div></div></div>`
  },
  {
    id: 'in_kraftf',
    font: 'vintage',
    n: 'Kraft — fiche à remplir (La brasserie de Sam)',
    w: 190,
    h: 100,
    pal: { bg: '#b98d56', ink: '#ffffff', gr: '#fff5e0', ac: '#ffffff', dk: 1 },
    r: (d, w, h) => {
      const row = (l, v) =>
        `<div style="border-top:.9mm solid #fff;padding-top:1mm;margin-bottom:5mm"><div class="lbb" style="font-size:2.8mm;letter-spacing:.2em;text-transform:uppercase">${l}</div><div class="lbb" style="font-size:3.4mm;font-weight:700;min-height:4mm">${v || ''}</div></div>`;
      return `<div style="position:relative;height:100%"><div style="position:absolute;inset:0;background:repeating-radial-gradient(circle at 20% 30%,#00000010 0 .3mm,transparent .3mm .8mm),repeating-radial-gradient(circle at 80% 70%,#ffffff12 0 .3mm,transparent .3mm .7mm)"></div><div style="position:relative;display:flex;gap:6mm;height:100%;padding:8mm 8mm"><div style="width:46mm;flex:none">${row('Style', d.styleH)}${row('Recette', d.name ? d.nameH : '')}${row('Alc/vol', d.abvH + ' % · ' + d.clH + ' cl')}${row('Mise en bouteille', d.lEmb.replace('Embouteillage : ', '').replace(/^-$/, ''))}${row('À consommer avant', '')}</div><div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:2mm">${lblTx(d, 'ARTISANALE', 4.4, 'letter-spacing:.3em')}${lblName(d, 17, 2, 'text-align:center')}${lblTx(d, 'brassée avec fierté', 3, 'letter-spacing:.3em;text-transform:uppercase')}</div><div style="width:46mm;flex:none;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end;text-align:right">${lblLogo(d, 12)}<div>${lblSmall(d.lMalt, 2.6, 4)}${lblSmall(d.lHop, 2.6, 4)}</div>${d.qr ? lblQr(d, 14) : ''}${lblCode(d, 3)}</div></div></div>`;
    }
  },
  {
    id: 'in_bio',
    font: 'condgras',
    n: 'Kraft bio — filets rouges (La Bière d’en-haut)',
    w: 75,
    h: 105,
    shape: 'rect',
    pal: { bg: '#d2ad7c', ink: '#2b2118', gr: '#3b2f22', ac: '#d63a2f' },
    r: (d, w, h) =>
      `<div style="position:relative;height:100%"><div style="position:absolute;inset:0;background:repeating-radial-gradient(circle at 30% 20%,#0000000a 0 .4mm,transparent .4mm .9mm)"></div><div style="position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;height:100%;padding:9mm 7mm 7mm;gap:1.5mm">${lblLogo(d, 13)}${lblName(d, 13, 2, 'text-align:center')}<div style="width:100%;border-top:.5mm solid #d63a2f;border-bottom:.5mm solid #d63a2f;padding:1.5mm 0;margin:2mm 0"><div class="lbb" style="font-size:3.8mm;letter-spacing:.08em;text-transform:uppercase;color:#2b2118">${d.styleH}</div></div><div style="display:flex;width:100%;border-top:.5mm solid #d63a2f;border-bottom:.5mm solid #d63a2f;align-items:center"><div style="flex:1;padding:1.5mm 0;font:500 3.4mm/1.2 var(--lfb);text-align:center">${d.abvH} % vol.</div><div style="border-left:.5mm solid #d63a2f;padding:1.5mm 3mm;font:700 4mm/1 var(--lfb)">${d.clH} cl</div></div>${lblSmall(d.lMalt, 2.7, 2)}${lblSmall(d.lHop, 2.7, 2)}<div style="flex:1"></div><div style="display:flex;gap:3mm;align-items:center;justify-content:center">${d.qr ? lblQr(d, 13) : ''}${lblIcons(d, 5)}</div>${lblCode(d, 3)}</div></div>`
  }
);
LIN.forEach(f => {
  f.pack = 'grid';
  if (!f.shape) f.shape = 'rect';
});
LF.push(...LIN);
/* ---------- modèles inspirés d'images : écusson, badges vintage, houblon, kraft, art déco, ruban… (v3.73.0) ---------- */
let lbiN = 0;
const lbiHop = (c, s, c2) =>
  `<svg viewBox="0 0 40 60" width="${s}mm" height="${(s * 1.5).toFixed(2)}mm" style="display:block;flex:none"><path d="M20 1v8" stroke="${c}" stroke-width="2" fill="none"/><path d="M21 8c8-5 15-2 17 4-8 2-14 0-17-4z" fill="${c}"/><path d="M20 11c-10 0-15 11-13 23 3 14 10 25 13 26 3-1 10-12 13-26 2-12-3-23-13-23z" fill="${c}"/><path d="M8 24q12 8 24 0M9 34q11 8 22 0M12 44q8 7 16 0M20 13v10M14 17q6 6 12 0" stroke="${c2}" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`;
const lbiMug = (c, s, c2) =>
  `<svg viewBox="0 0 50 50" width="${s}mm" height="${s}mm" style="display:block;flex:none"><path d="M10 18h26v24q0 4-4 4H14q-4 0-4-4z" fill="${c}"/><path d="M36 22h4q5 0 5 6v6q0 6-5 6h-4" fill="none" stroke="${c}" stroke-width="4"/><circle cx="14" cy="16" r="6" fill="${c}"/><circle cx="23" cy="13" r="7" fill="${c}"/><circle cx="32" cy="16" r="6" fill="${c}"/><path d="M17 26v14M24 26v14M31 26v14" stroke="${c2}" stroke-width="2"/></svg>`;
const lbiWheat = (c, h, flip) =>
  `<svg viewBox="0 0 20 60" width="${(h / 3).toFixed(2)}mm" height="${h}mm" style="display:block;flex:none${flip ? ';transform:scaleX(-1)' : ''}"><path d="M10 59V8" stroke="${c}" stroke-width="1.4"/>${[8, 17, 26, 35, 44].map(y => `<ellipse cx="5" cy="${y + 4}" rx="2.4" ry="5" transform="rotate(-35 5 ${y + 4})" fill="${c}"/><ellipse cx="15" cy="${y + 4}" rx="2.4" ry="5" transform="rotate(35 15 ${y + 4})" fill="${c}"/>`).join('')}<ellipse cx="10" cy="5" rx="2.4" ry="5" fill="${c}"/></svg>`;
const lbiStar = (c, s) =>
  `<svg viewBox="0 0 24 24" width="${s}mm" height="${s}mm" style="display:block;flex:none"><path d="M12 1.5l3 7.3 7.9.6-6 5.2 1.9 7.7L12 18.3l-6.8 4 1.9-7.7-6-5.2 7.9-.6z" fill="${c}"/></svg>`;
const lbiSaw = (n, a) => {
  const p = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? a : 50,
      t = (Math.PI * i) / n;
    p.push((50 + r * Math.sin(t)).toFixed(1) + '% ' + (50 - r * Math.cos(t)).toFixed(1) + '%');
  }
  return 'polygon(' + p.join(',') + ')';
};
/* texte courbe (demi-cercle) : down=false → arc du haut (lettres vers l'extérieur) ; true → arc du bas (lisible) */
const lbiArc = (t, w, r, c, fs, down, ls) => {
  if (!t) return '';
  const id = 'lbia' + lbiN++,
    y0 = down ? 0 : r + fs * 1.2,
    H = +(down ? r + fs * 0.6 : r + fs * 1.8).toFixed(2),
    cx = w / 2,
    p = down ? `M${cx - r} 0A${r} ${r} 0 0 0 ${cx + r} 0` : `M${cx - r} ${y0}A${r} ${r} 0 0 1 ${cx + r} ${y0}`;
  return `<svg viewBox="0 0 ${w} ${H}" width="${w}mm" height="${H}mm" style="display:block;flex:none;overflow:visible"><path id="${id}" d="${p}" fill="none"/><text style="fill:${c};font:700 ${fs}px var(--lfb);letter-spacing:${ls || 0.18}em;text-transform:uppercase"><textPath href="#${id}" startOffset="50%" text-anchor="middle">${t}</textPath></text></svg>`;
};
const lbiAbs = (css, inner) => `<div style="position:absolute;${css}">${inner || ''}</div>`;
const lbiFoot = (d, c, qr, fs) =>
  `<div style="display:flex;gap:2mm;align-items:center;justify-content:center">${d.qr ? lblQr(d, qr || 11) : ''}${lblTx(d, d.codeH, fs || 2.8, 'font-weight:700;white-space:pre;color:' + c)}</div>`;
const lbiRays = (c, at, a, b) =>
  `repeating-conic-gradient(from 0deg at ${at || '50% 50%'},${c} 0 ${a || 2}deg,transparent ${a || 2}deg ${b || 9}deg)`;
const LBI = [];
/* 1. Écusson jaune « BEER » (bandeau noir, rayons, étiquette verticale) */
LBI.push({
  id: 'im_ecu',
  font: 'vintage',
  n: 'Écusson jaune — bandeau noir (Beer Light)',
  w: 66,
  h: 92,
  shape: 'shield',
  pal: { bg: '#ffcc00', ink: '#111111', gr: '#222222', ac: '#111111' },
  r: (d, w, h) =>
    `<div style="position:relative;height:100%">${lbiAbs(
      'left:3.2mm;right:3.2mm;top:3.2mm;bottom:3.2mm;border:1.1mm solid #111;border-radius:0 0 31mm 31mm/0 0 27mm 27mm;overflow:hidden',
      `<div style="height:9mm;display:flex;align-items:center;justify-content:center;gap:3mm">${lbiStar('#111', 3)}${lblTx(d, 'SINCE ' + d.yr, 3, 'font-weight:600;letter-spacing:.14em')}${lbiStar('#111', 3)}</div>
 <div style="background:#111;padding:.8mm 1mm 1.4mm;display:flex;justify-content:center">${lblName(d, 11, 2, 'color:#fff;text-align:center;width:100%')}</div>
 <div style="position:absolute;left:5mm;right:5mm;top:33mm;bottom:5mm;border-radius:0 0 22mm 22mm/0 0 20mm 20mm;background:${lbiRays('#fff36b', '50% 35%', 1.6, 7)};border-top:0"></div>
 ${lbiAbs('left:0;right:0;top:34mm;text-align:center', lblTx(d, d.abvH + ' % vol · ' + d.clH + ' cl', 3.1, 'font-weight:600;letter-spacing:.08em'))}
 ${lbiAbs('left:0;right:0;top:41mm;display:flex;justify-content:center', lbiMug('#fff', 13, '#ffcc00'))}
 ${lbiAbs('left:1.6mm;top:32mm;bottom:11mm;width:4mm;display:flex;justify-content:center;align-items:center', lblVert(d.styleH, 2.9, 'letter-spacing:.3em;text-transform:uppercase;font-weight:500'))}
 ${lbiAbs('right:1.6mm;top:32mm;bottom:11mm;width:4mm;display:flex;justify-content:center;align-items:center', lblVert(d.codeH, 2.7, 'letter-spacing:.2em;white-space:pre'))}
 ${lbiAbs('left:12mm;right:12mm;bottom:3.5mm;background:#111;padding:.8mm 1mm;text-align:center;border-radius:1mm', lblTx(d, d.styleH, 3, 'color:#fff;letter-spacing:.25em;text-transform:uppercase;font-weight:500;' + lblClamp(1)))}`
    )}</div>`
});
/* 2. Brewery — fond brun, cadre filet et cartouche (Dark & Light) */
LBI.push({
  id: 'im_dark',
  font: 'vintage',
  n: 'Brewery brun — cadre filet (Dark & Light)',
  w: 72,
  h: 100,
  shape: 'rect',
  pal: { bg: '#2e0f0c', ink: '#f0c9a0', gr: '#e2b98f', ac: '#f0c9a0', dk: 1 },
  r: (
    d,
    w,
    h
  ) => `<div style="position:relative;height:100%">${lbiAbs('inset:3mm;border:.5mm solid #f0c9a0')}${lbiAbs('inset:5mm;border:.25mm solid #f0c9a0')}${lbiAbs('left:7mm;top:7mm;color:#f0c9a0;font-size:3mm;line-height:1', ic('sparkle'))}${lbiAbs('right:7mm;top:7mm;color:#f0c9a0;font-size:3mm;line-height:1', ic('sparkle'))}${lbiAbs('left:7mm;bottom:7mm;color:#f0c9a0;font-size:3mm;line-height:1', ic('sparkle'))}${lbiAbs('right:7mm;bottom:7mm;color:#f0c9a0;font-size:3mm;line-height:1', ic('sparkle'))}
 ${lbiAbs('left:0;right:0;top:9mm;display:flex;justify-content:center', lbiArc(d.styleH, 50, 22, '#f0c9a0', 3.4))}
 ${lbiAbs('left:0;right:0;top:19mm;display:flex;justify-content:center', lbiMug('#f0c9a0', 12, '#2e0f0c'))}
 ${lbiAbs('left:7mm;right:7mm;top:34mm;border-top:.5mm solid #f0c9a0;border-bottom:.5mm solid #f0c9a0;padding:2mm 1mm;display:flex;flex-direction:column;align-items:center;gap:1mm', lblName(d, 10, 2, 'text-align:center;width:100%') + lblTx(d, '— ' + d.clH + ' cl · ' + d.abvH + ' % —', 3.2, 'font-style:italic;letter-spacing:.1em'))}
 ${lbiAbs('left:8mm;right:8mm;top:66mm;text-align:center;display:flex;flex-direction:column;gap:.6mm', lblSmall(d.lMalt, 2.7, 1) + lblSmall(d.lHop, 2.7, 1))}
 ${lbiAbs('left:0;right:0;bottom:8mm', lbiFoot(d, '#f0c9a0', 12))}</div>`
});
/* 3. Houblon vertical (3 coloris : crème / bleu / nuit) */
const lbiHopV = (id, n, pal, hopc, hopbg) => ({
  id,
  font: 'condgras',
  n,
  w: 56,
  h: 112,
  shape: 'rect',
  pal,
  r: (
    d,
    w,
    h
  ) => `<div style="position:relative;height:100%">${lbiAbs('left:0;right:0;top:6mm;display:flex;justify-content:center', lbiArc('Premium ' + 'quality', 44, 19, pal.ac, 3, false))}
 ${lbiAbs('left:0;right:0;top:20mm;display:flex;justify-content:center', lbiHop(hopc, 15, hopbg))}
 ${lbiAbs('left:0;right:0;top:46mm;height:28mm;padding:0 3mm;display:flex;align-items:center;justify-content:center', lblName(d, 11, 2, 'text-align:center;width:100%;letter-spacing:.06em'))}
 ${lbiAbs('left:0;right:0;top:78mm;text-align:center;padding:0 3mm', lblTx(d, d.styleH, 4, 'letter-spacing:.14em;text-transform:uppercase;font-weight:600;color:' + pal.ac) + lblTx(d, d.abvH + ' % alc./vol · ' + d.clH + ' cl', 3, 'letter-spacing:.06em;margin-top:.8mm'))}
 ${lbiAbs('left:0;right:0;bottom:6mm', lbiFoot(d, pal.ink, 12, 2.7))}</div>`
});
LBI.push(
  lbiHopV(
    'im_hop1',
    'Houblon vertical — crème & bleu',
    { bg: '#ecebe7', ink: '#3f5f86', gr: '#3f5f86', ac: '#5a7ca6' },
    '#5a7ca6',
    '#ecebe7'
  )
);
/* 4. Kraft artisanal à bande de couleur (4 coloris) */
const lbiKraft = (id, n, col) => ({
  id,
  font: 'condgras',
  n,
  w: 62,
  h: 84,
  shape: 'chamfer',
  pal: { bg: '#c9a577', ink: '#17120d', gr: '#2a2017', ac: '#17120d' },
  r: (
    d,
    w,
    h
  ) => `<div style="position:relative;height:100%">${lbiAbs('inset:0;background:repeating-radial-gradient(circle at 30% 20%,#0000000c 0 .4mm,transparent .4mm .9mm)')}${lbiAbs('inset:3mm;border:.4mm solid #17120d')}
 ${lbiAbs('left:-6mm;right:-6mm;top:24mm;height:22mm;transform:rotate(-24deg);background:' + col + ';opacity:.9;mix-blend-mode:multiply')}
 ${lbiAbs('left:0;right:0;top:6.5mm;text-align:center', lblTx(d, 'La brasserie artisanale', 2.8, 'letter-spacing:.14em;text-transform:uppercase;font-weight:600') + lblTx(d, '— ' + d.yr + ' —', 2.7, 'letter-spacing:.2em;margin-top:.5mm'))}
 ${lbiAbs('left:5mm;right:5mm;top:17mm;height:34mm;display:flex;align-items:center;justify-content:center', lblName(d, 17, 2, 'text-align:center;width:100%'))}
 ${lbiAbs('left:0;right:0;top:55mm;text-align:center', lblTx(d, d.styleH, 3.2, 'letter-spacing:.14em;text-transform:uppercase;font-weight:600'))}
 ${lbiAbs('left:6mm;bottom:6mm;width:12mm;height:12mm;border-radius:50%;background:#17120d;color:#f1e3c8;display:flex;align-items:center;justify-content:center;font:700 4mm/1 var(--lfb)', d.abvH)}
 ${lbiAbs('right:6mm;bottom:6mm;display:flex;align-items:center;gap:2mm', d.qr ? lblQr(d, 12) : lblTx(d, d.clH + ' cl', 3.2, 'font-weight:700'))}</div>`
});
LBI.push(
  lbiKraft('im_kraft2', 'Kraft artisanal — bande jaune', '#f2d11c')
);
/* 5. Sceau vintage denté (beige / brun) */
const lbiSeal = (id, n, P) => ({
  id,
  font: 'vintage',
  n,
  w: 80,
  h: 80,
  shape: 'round',
  pack: 'honey',
  pal: P.pal,
  r: (
    d,
    w,
    h
  ) => `<div style="position:relative;height:100%">${lbiAbs('inset:1.6mm;background:' + P.saw + ';clip-path:' + lbiSaw(44, 92))}${lbiAbs('inset:5.2mm;border-radius:50%;background:' + P.in)}${lbiAbs('inset:6.8mm;border-radius:50%;border:.5mm solid ' + P.ring)}
 ${lbiAbs('left:0;right:0;top:9mm;display:flex;justify-content:center', lbiStar(P.ring, 3.2))}
 ${lbiAbs('left:10mm;top:22mm', lbiWheat(P.ring, 24, 0))}${lbiAbs('right:10mm;top:22mm', lbiWheat(P.ring, 24, 1))}
 ${lbiAbs('left:0;right:0;top:15mm;display:flex;justify-content:center', lbiMug(P.ink, 13, P.in))}
 ${lbiAbs('left:6mm;right:6mm;top:33mm;background:' + P.band + ';padding:1.2mm 3mm;display:flex;justify-content:center', lblName(d, 9, 1, 'text-align:center;width:100%;color:' + P.bandt))}
 ${lbiAbs('left:0;right:0;top:46mm;text-align:center', lblTx(d, d.styleH, 3.4, 'font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:' + P.ink) + lblTx(d, d.abvH + ' % · ' + d.clH + ' cl', 3.1, 'margin-top:.6mm;font-weight:600'))}
 ${lbiAbs('left:0;right:0;bottom:10.5mm', lbiFoot(d, P.ink, 9, 2.7))}</div>`
});
LBI.push(
  lbiSeal('im_seal1', 'Sceau vintage — beige & brun', {
    pal: { bg: '#ffffff', ink: '#3a2417', gr: '#3a2417', ac: '#8a6a4a' },
    saw: '#c9aa7e',
    in: '#efe3cb',
    ring: '#8a6a4a',
    band: '#6b4a32',
    bandt: '#f6ead2'
  })
);
/* 6. Badge Craft Beer noir & blanc (couronne de points, script) */
LBI.push({
  id: 'im_bw',
  font: 'script',
  n: 'Badge noir & blanc — Craft Beer (script)',
  w: 80,
  h: 80,
  shape: 'round',
  pack: 'honey',
  pal: { bg: '#ffffff', ink: '#111111', gr: '#222222', ac: '#111111' },
  r: (
    d,
    w,
    h
  ) => `<div style="position:relative;height:100%">${lbiAbs('inset:2.4mm;border-radius:50%;border:3.6mm solid #111')}${lbiAbs('inset:4.2mm;border-radius:50%;border:.6mm dotted #fff')}
 ${lbiAbs('left:0;right:0;top:11.5mm;display:flex;justify-content:center', lbiArc(d.styleH, 50, 21, '#111', 3.2, false, 0.12))}
 ${lbiAbs('left:12mm;right:12mm;top:25mm;height:22mm;display:flex;align-items:center;justify-content:center', lblName(d, 14, 2, 'text-align:center;width:100%;text-transform:none;line-height:1'))}
 ${lbiAbs('left:0;right:0;top:49mm;display:flex;justify-content:center;gap:2mm;align-items:center', lbiStar('#111', 3) + lblTx(d, d.abvH + ' % · ' + d.clH + ' cl', 3.4, 'font-weight:700;letter-spacing:.1em') + lbiStar('#111', 3))}
 ${lbiAbs('left:0;right:0;top:55mm;display:flex;justify-content:center', lbiHop('#111', 4.4, '#fff'))}
 ${lbiAbs('left:0;right:0;top:64mm;text-align:center', lblTx(d, 'SINCE ' + d.yr, 3, 'letter-spacing:.22em;font-weight:700'))}</div>`
});
/* 7. Badge premium bleu nuit & or (art déco) */
LBI.push({
  id: 'im_deco',
  font: 'condgras',
  n: 'Badge premium — bleu nuit & or',
  w: 76,
  h: 80,
  shape: 'octagon',
  pal: { bg: '#1c2447', ink: '#ffffff', gr: '#e9d9a6', ac: '#d9a557', dk: 1 },
  r: (
    d,
    w,
    h
  ) => `<div style="position:relative;height:100%">${`<svg viewBox="0 0 ${w} ${h}" width="${w}mm" height="${h}mm" style="position:absolute;left:0;top:0"><path d="${[
    [3 + 19, 3],
    [w - 3 - 19, 3],
    [w - 3, 3 + 19],
    [w - 3, h - 3 - 19],
    [w - 3 - 19, h - 3],
    [3 + 19, h - 3],
    [3, h - 3 - 19],
    [3, 3 + 19]
  ]
    .map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1])
    .join('')}Z" fill="none" stroke="#d9a557" stroke-width=".5"/></svg>`}
 ${lbiAbs('left:0;right:0;top:6mm;display:flex;justify-content:center', lbiArc(d.styleH || 'Premium quality', 46, 19, '#fff', 3.2, false))}
 ${lbiAbs('left:0;right:0;top:19mm;display:flex;justify-content:center', lbiStar('#d9a557', 9))}
 ${lbiAbs('left:9mm;right:9mm;top:30mm;border-top:.5mm dotted #d9a557;border-bottom:.5mm dotted #d9a557;padding:1.2mm 0;display:flex;justify-content:center', lblName(d, 14, 1, 'text-align:center;width:100%;letter-spacing:.12em'))}
 ${lbiAbs('left:0;right:0;top:46mm;display:flex;justify-content:center', lbiHop('#d9a557', 9, '#1c2447'))}
 ${lbiAbs('left:0;right:0;top:59mm;text-align:center', lblTx(d, d.abvH + ' % alc. · ' + d.clH + ' cl', 3.2, 'letter-spacing:.14em;text-transform:uppercase;color:#e9d9a6;font-weight:600'))}
 ${lbiAbs('left:0;right:0;bottom:6.5mm', lbiFoot(d, '#e9d9a6', 9, 2.6))}</div>`
});
/* 8. Ruban crème sur rayons (Craft Beer) */
LBI.push({
  id: 'im_ribbon',
  font: 'condgras',
  n: 'Ruban crème & rayons — Craft Beer',
  w: 98,
  h: 62,
  shape: 'rect',
  pal: { bg: '#bdd9d5', ink: '#2b2f36', gr: '#2b2f36', ac: '#2b2f36' },
  r: (
    d,
    w,
    h
  ) => `<div style="position:relative;height:100%">${lbiAbs('left:50%;top:50%;width:90mm;height:90mm;margin:-45mm 0 0 -45mm;background:' + lbiRays('#2b2f36', '50% 50%', 0.9, 6) + ';-webkit-mask-image:radial-gradient(circle,transparent 0 40%,#000 41% 100%);mask-image:radial-gradient(circle,transparent 0 40%,#000 41% 100%);opacity:.5')}
 ${lbiAbs('left:5mm;right:5mm;top:15mm;height:30mm;background:#2b2f36;clip-path:polygon(0 0,100% 0,95% 50%,100% 100%,0 100%,5% 50%)')}
 ${lbiAbs('left:5.5mm;right:5.5mm;top:16mm;height:28mm;background:#f6f1e1;clip-path:polygon(0 0,100% 0,95.2% 50%,100% 100%,0 100%,4.8% 50%);display:flex;align-items:center;justify-content:center;padding:0 10mm', lblName(d, 17, 1, 'text-align:center;width:100%;color:#2b2f36'))}
 ${lbiAbs('left:0;right:0;top:4.5mm;display:flex;justify-content:center', lblTx(d, d.styleH, 3.4, 'letter-spacing:.22em;text-transform:uppercase;font-weight:700;background:#bdd9d5;padding:.4mm 3mm;border-radius:1mm'))}
 ${lbiAbs('left:0;right:0;top:48mm;display:flex;justify-content:center', lblTx(d, d.abvH + ' % alc./vol · ' + d.clH + ' cl', 3.4, 'letter-spacing:.14em;font-weight:700;background:#bdd9d5;padding:.4mm 3mm;border-radius:1mm'))}
 ${lbiAbs('left:6mm;right:6mm;bottom:2.5mm;display:flex;justify-content:space-between;align-items:flex-end', lblTx(d, d.codeH, 2.7, 'white-space:pre;font-weight:700;background:#bdd9d5;padding:.3mm 2mm;border-radius:1mm') + (d.qr ? lblQr(d, 9) : ''))}</div>`
});
/* 9. Houblon & ruban — anneau vert (American Brewhouse) */
LBI.push({
  id: 'im_hopring',
  font: 'condgras',
  n: 'Anneau vert — houblon & ruban',
  w: 74,
  h: 74,
  shape: 'round',
  pack: 'honey',
  pal: { bg: '#ffffff', ink: '#1f4d2b', gr: '#1f4d2b', ac: '#2e7d3e' },
  r: (
    d,
    w,
    h
  ) => `<div style="position:relative;height:100%">${lbiAbs('inset:2mm;border-radius:50%;border:3mm solid #2e7d3e')}${lbiAbs('inset:6.5mm;border-radius:50%;border:.4mm solid #2e7d3e')}${lbiAbs('inset:8mm;border-radius:50%;border:.3mm dotted #2e7d3e')}
 ${lbiAbs('left:0;right:0;top:9mm;display:flex;justify-content:center', lbiArc('Premium quality', 46, 19, '#1f4d2b', 3, false))}
 ${lbiAbs('left:0;right:0;top:20mm;display:flex;justify-content:center', lbiHop('#2e7d3e', 12, '#ffffff'))}
 ${lbiAbs('left:4.5mm;right:4.5mm;top:38mm;height:13mm;background:#14351e;clip-path:polygon(0 8%,100% 8%,100% 100%,0 100%);opacity:.55')}${lbiAbs('left:6mm;right:6mm;top:35mm;height:13mm;background:#1f4d2b;clip-path:polygon(0 0,100% 0,96% 50%,100% 100%,0 100%,4% 50%);display:flex;align-items:center;justify-content:center;padding:0 7mm', lblName(d, 8.5, 1, 'text-align:center;width:100%;color:#fff'))}
 ${lbiAbs('left:0;right:0;top:50mm;text-align:center', lblTx(d, d.styleH, 3.2, 'font-weight:700;letter-spacing:.12em;text-transform:uppercase') + lblTx(d, d.abvH + ' % · ' + d.clH + ' cl', 3, 'margin-top:.4mm'))}
 ${lbiAbs('left:0;right:0;bottom:9.5mm;text-align:center', lblTx(d, d.codeH, 2.7, 'font-weight:700;white-space:pre'))}</div>`
});
/* 10. Blason à couronne, épis et ruban rouge (marine & orange) */
LBI.push({
  id: 'im_crest',
  font: 'vintage',
  n: 'Blason couronne — marine, épis & ruban rouge',
  w: 66,
  h: 88,
  shape: 'shield',
  pal: { bg: '#1f3a63', ink: '#ffffff', gr: '#f1d9a4', ac: '#e8a33d', dk: 1 },
  r: (
    d,
    w,
    h
  ) => `<div style="position:relative;height:100%">${lbiAbs('left:4mm;right:4mm;top:4mm;bottom:4mm;border:.6mm solid #e8a33d;border-radius:1.5mm 1.5mm 28mm 28mm/1.5mm 1.5mm 30mm 30mm')}
 ${lbiAbs('left:0;right:0;top:7mm;text-align:center;color:#e8a33d;font-size:8mm;line-height:1', lbiStar('#e8a33d', 6).replace('display:block', 'display:inline-block'))}
 ${lbiAbs('left:7mm;top:26mm', lbiWheat('#e8a33d', 26, 0))}${lbiAbs('right:7mm;top:26mm', lbiWheat('#e8a33d', 26, 1))}
 ${lbiAbs('left:14mm;right:14mm;top:19mm;display:flex;justify-content:center', lblName(d, 12, 2, 'text-align:center;width:100%'))}
 ${lbiAbs('left:12mm;right:12mm;top:42mm;text-align:center', lblTx(d, d.abvH + ' % · ' + d.clH + ' cl', 3.4, 'letter-spacing:.1em;font-weight:700;color:#f1d9a4'))}
 ${lbiAbs('left:3mm;right:3mm;top:50mm;height:11mm;background:#c8312a;clip-path:polygon(0 0,100% 0,95% 50%,100% 100%,0 100%,5% 50%);display:flex;align-items:center;justify-content:center;padding:0 5mm', lblTx(d, d.styleH, 3.4, 'color:#fff;letter-spacing:.16em;text-transform:uppercase;font-weight:700;' + lblClamp(1)))}
 ${lbiAbs('left:0;right:0;bottom:13mm', lbiFoot(d, '#f1d9a4', 9, 2.6))}</div>`
});
LBI.forEach(f => {
  if (!f.pack) f.pack = 'grid';
});
LF.push(...LBI);
/* ---------- liste des polices (intégrées + importées, stockées dans la base) ---------- */
const fontAll = () => LFONTS.concat(lblUserFonts());
function fontOpts(sel, auto, autoLabel) {
  return (
    `<option value="${auto}"${sel === auto ? ' selected' : ''}>${autoLabel}</option>` +
    fontAll()
      .filter(f => !f.b)
      .map(f => `<option value="${f.id}"${f.id === sel ? ' selected' : ''} style="font-family:${f.f}">${f.n}</option>`)
      .join('')
  );
}
function fontListRefresh() {
  document.querySelectorAll('select.fsel').forEach(s => {
    const v = s.value;
    s.innerHTML = fontOpts(v, s.dataset.auto, s.dataset.alab);
    s.value = v;
  });
  fntSync();
}
/* saisie du nom de la police (écran Étiquettes) : liste déroulante ou autocomplétion ; le <select> caché reste la source de valeur */
/* libellé traduit tout de suite (le traducteur de la page passe sur les <option> après coup) */
const fntLabel = s => tx((s.options[s.selectedIndex] || {}).textContent || '');
function fntSync() {
  document.querySelectorAll('select.fsel').forEach(s => {
    const w = s.parentNode,
      i = w && w.querySelector('input.fin');
    if (!i) return;
    if (document.activeElement !== i) i.value = fntLabel(s);
  });
}
const fntFind = (s, txt, strict) => {
  const v = nrm(txt || ''),
    o = [...s.options];
  if (!v) return strict ? null : o.find(x => x.value === s.dataset.auto);
  const ex = o.find(x => nrm(x.textContent) === v);
  if (ex || strict) return ex || null;
  const st = o.filter(x => nrm(x.textContent).startsWith(v)),
    inc = o.filter(x => nrm(x.textContent).includes(v));
  return st.length === 1 ? st[0] : inc.length === 1 ? inc[0] : st[0] || null;
};
function fntApply(i, strict) {
  const s = i.parentNode.querySelector('select.fsel'),
    o = fntFind(s, i.value, strict);
  if (!o) return false;
  if (s.value !== o.value) {
    s.value = o.value;
    s.dispatchEvent(new Event('input', { bubbles: true }));
  }
  return true;
}
/* liste déroulante des polices (écran Étiquettes) : chaque nom est affiché dans sa police, comme dans la liste de la
   feuille de brassage (un <datalist> ne le permet pas) ; filtrée par la saisie, flèches + Entrée, Échap pour fermer */
let FDD = null;
function fddClose() {
  if (!FDD) return;
  FDD.box.remove();
  FDD.i.setAttribute('aria-expanded', 'false');
  FDD = null;
}
function fddOpen(i) {
  const s = i.parentNode.querySelector('select.fsel');
  if (!s) return;
  if (!FDD || FDD.i !== i) {
    fddClose();
    const box = document.createElement('div');
    box.className = 'fdd';
    box.setAttribute('role', 'listbox');
    box.addEventListener('mousedown', e => {
      e.preventDefault(); /* le champ garde le focus */
      const o = e.target.closest('.fdo');
      if (o && FDD) fddPick(+o.dataset.k);
    });
    document.body.appendChild(box);
    FDD = { i, s, box, k: -1, opts: [] };
    i.setAttribute('aria-expanded', 'true');
  }
  const v = nrm(i.value || '');
  FDD.opts = [...s.options].filter(o => !v || nrm(o.textContent).includes(v));
  FDD.k = FDD.opts.findIndex(o => o.value === s.value);
  FDD.box.textContent = '';
  FDD.opts.forEach((o, k) => {
    const d = document.createElement('div');
    d.className = 'fdo' + (k === FDD.k ? ' on' : '');
    d.setAttribute('role', 'option');
    d.dataset.k = k;
    d.textContent = o.textContent;
    d.title = o.textContent;
    if (o.style.fontFamily) d.style.fontFamily = o.style.fontFamily;
    FDD.box.appendChild(d);
  });
  if (!FDD.opts.length) FDD.box.innerHTML = '<div class="fdv">Aucune police</div>';
  const r = i.getBoundingClientRect();
  Object.assign(FDD.box.style, {
    left: r.left + window.scrollX + 'px',
    top: r.bottom + window.scrollY + 2 + 'px',
    minWidth: Math.max(r.width, 220) + 'px'
  });
  const on = FDD.box.querySelector('.fdo.on');
  if (on) on.scrollIntoView({ block: 'nearest' });
}
function fddMove(d) {
  if (!FDD || !FDD.opts.length) return;
  FDD.moved = true;
  FDD.k = (FDD.k + d + FDD.opts.length) % FDD.opts.length;
  FDD.box.querySelectorAll('.fdo').forEach((x, k) => x.classList.toggle('on', k === FDD.k));
  const on = FDD.box.querySelector('.fdo.on');
  if (on) on.scrollIntoView({ block: 'nearest' });
}
function fddPick(k) {
  const o = FDD && FDD.opts[k];
  if (!o) return;
  const { i, s } = FDD;
  i.value = o.textContent;
  if (s.value !== o.value) {
    s.value = o.value;
    s.dispatchEvent(new Event('input', { bubbles: true }));
  }
  fddClose();
  i.blur();
}
window.addEventListener('resize', fddClose);
document.addEventListener('scroll', e => FDD && !FDD.box.contains(e.target) && fddClose(), true);
document.addEventListener('focusin', e => {
  const i = e.target;
  if (!i || !i.classList || !i.classList.contains('fin')) return;
  /* champ vidé au focus pour que la liste déroulante propose toutes les polices (la valeur actuelle reste en filigrane) */
  i.dataset.prev = i.value;
  i.placeholder = i.value;
  i.value = '';
  fddOpen(i);
});
document.addEventListener('input', e => {
  const i = e.target;
  if (i && i.classList && i.classList.contains('fin')) {
    fntApply(i, true);
    fddOpen(i);
  }
});
document.addEventListener('focusout', e => {
  const i = e.target;
  if (!i || !i.classList || !i.classList.contains('fin')) return;
  fddClose();
  if (i.value.trim()) fntApply(i, false);
  fntSync();
});
document.addEventListener('keydown', e => {
  const i = e.target;
  if (!i || !i.classList || !i.classList.contains('fin')) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!FDD) fddOpen(i);
    fddMove(e.key === 'ArrowDown' ? 1 : -1);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    /* élément surligné de la liste filtrée (si la saisie en a changé la sélection), sinon autocomplétion */
    if (FDD && FDD.k >= 0 && (FDD.moved || !i.value.trim())) fddPick(FDD.k);
    else {
      fntApply(i, false);
      fddClose();
      i.blur();
    }
  } else if (e.key === 'Escape') {
    fddClose();
    i.blur();
  }
});

/* ---------- encart « Polices de caractères » (Paramètres) ---------- */
/* polices de l'interface (liste v2 de fonts_seed.js) : modifiables par remplacement du fichier, jamais supprimables */
/* polices de l'interface (non supprimables) : les 9 du lot v2 + les polices Google Fonts utilisées par le CSS et les modèles d'étiquette */
const UIFONT_RE = /^(Inter(?![A-Za-z])|Roboto[ _-]?Mono|Playfair[ _-]?Display|Courier[ _-]?Prime|Bowlby[ _-]?One|Caprasimo|Rock[ _-]?Salt)/i;
const fontLocked = n => (typeof FONTS_SEED !== 'undefined' && FONTS_SEED.some(f => f.v >= 2 && f.n === n)) || UIFONT_RE.test(String(n || ''));
let FSORT = 0; /* tri de la colonne « Nom » : 0 = ordre de la base, 1 = croissant, -1 = décroissant */
const fontsHead = () => `Nom${FSORT ? `<span class="sar ${FSORT === 1 ? 'up' : 'dn'}" title="${FSORT === 1 ? 'Tri croissant' : 'Tri décroissant'}"></span>` : ''}`;
const fontsRows = () => {
  const E = S.kv.equip,
    v = nrm((document.getElementById('ftf') || {}).value || ''),
    all = (E.fonts || []).map((u, i) => ({ u, i })).filter(o => !v || nrm(o.u.n).includes(v)),
    srt = FSORT ? all.sort((a, b) => FSORT * a.u.n.localeCompare(b.u.n, 'fr', { sensitivity: 'base', numeric: true })) : all,
    pages = Math.max(1, Math.ceil(all.length / PGSZ));
  /* pagination : à partir de 15 polices (PGSZ), comme les autres listes */
  PG.fonts = all.length > PGSZ ? Math.max(0, Math.min(PG.fonts || 0, pages - 1)) : 0;
  fontsRows.n = all.length;
  return (
    (srt.length > PGSZ ? srt.slice(PG.fonts * PGSZ, (PG.fonts + 1) * PGSZ) : srt)
      .map(({ u, i }) =>
        fontLocked(u.n)
          ? `<tr><td class="fnm" data-fi="${i}">${esc(u.n)}</td><td class="act"><span class="flock" title="Police de l’interface : non supprimable">${ic('lock')}</span></td></tr>`
          : `<tr><td class="fnm" data-fi="${i}">${esc(u.n)}</td><td class="act"><button class="x" data-fdel="${i}" title="Supprimer cette police">✕</button></td></tr>`
      )
      .join('') || '<tr><td colspan="2" style="color:var(--m)">Aucune police</td></tr>'
  );
};
const fontsPanel = () => {
  const E = S.kv.equip;
  return `<div class="panel"><h3>Polices de caractères (<span id="ftn">${(E.fonts || []).length}</span>) <small>— stockées dans la base</small><label class="btn" title="Importer un ou plusieurs fichiers de police (.ttf, .otf, .woff, .woff2)">⬆ Importer<input type="file" id="fontfile" accept=".ttf,.otf,.woff,.woff2" multiple hidden></label></h3><div class="scr" id="ftw"><table class="db" style="width:100%"><tr class="flt"><th><input class="fi" id="ftf" list="dl-ftf" placeholder="rechercher une police…" autocomplete="off" style="width:100%"><datalist id="dl-ftf">${(E.fonts || []).map(u => `<option value="${esc(u.n)}">`).join('')}</datalist></th><th class="act"><button class="er" data-erase="ft" title="Effacer">${ERASER}</button></th></tr><tr class="hd"><th class="srt" id="ftsort" data-fsort="1">${fontsHead()}</th><th></th></tr><tbody id="ftb">${fontsRows()}</tbody></table></div><div class="pager" id="ftpager">${fontsRows.n > PGSZ ? pgBar('fonts', fontsRows.n) : ''}</div></div>`;
};
function fontsRefresh() {
  const t = document.getElementById('ftb');
  if (t) t.innerHTML = fontsRows();
  const hs = document.getElementById('ftsort');
  if (hs) hs.innerHTML = fontsHead();
  const pb = document.getElementById('ftpager');
  if (pb) pb.innerHTML = fontsRows.n > PGSZ ? pgBar('fonts', fontsRows.n) : '';
  const c = document.getElementById('ftn');
  if (c) c.textContent = (S.kv.equip.fonts || []).length;
  const d = document.getElementById('dl-ftf');
  if (d) d.innerHTML = (S.kv.equip.fonts || []).map(u => `<option value="${esc(u.n)}">`).join('');
  fontListRefresh();
}
document.addEventListener('input', e => {
  if (e.target && e.target.id === 'ftf') {
    PG.fonts = 0;
    fontsRefresh();
  }
});
/* recettes portant une référence de police (recette en cours + bibliothèque) */
const fontRecipes = () => [S.kv.recipe, ...(S.biblio || []).map(b => b.recipe)].filter(Boolean);
/* usages d'une police stockée : étiquettes / feuilles de brassage des recettes et modèles d'étiquettes qui l'utilisent */
function fontUsage(i) {
  const E = S.kv.equip,
    u = E.fonts[i],
    id = 'u' + i,
    recs = fontRecipes().filter(r => ((r.etq || {}).fnt === id) || r.shfnt === id),
    fams = lblFontFams(u.n).filter(f => !/^LU /.test(f)),
    tpl = LFONTS.filter(f => fams.some(q => f.f.includes(q))).length,
    cur = recs.includes(S.kv.recipe);
  return { recs, tpl, cur, n: recs.length + tpl };
}
/* supprime la police i ; rep = nom de la police de remplacement (ou '' : aucune) */
function fontDelete(i, rep) {
  if (fontLocked((S.kv.equip.fonts[i] || {}).n)) return;
  const E = S.kv.equip,
    u = E.fonts[i],
    j = rep ? E.fonts.findIndex(x => x.n === rep) : -1,
    nj = j > i ? j - 1 : j;
  E.fontmap = E.fontmap || {};
  /* les anciens remplacements qui visaient cette police visent désormais son remplaçante */
  Object.keys(E.fontmap).forEach(k => {
    if (E.fontmap[k] === u.n) {
      if (rep) E.fontmap[k] = rep;
      else delete E.fontmap[k];
    }
  });
  if (rep) E.fontmap[u.n] = rep;
  lblUnregFont(u.n, 1);
  E.fonts.splice(i, 1);
  fontRecipes().forEach(r => {
    r.etq = r.etq || {};
    [
      [r.etq, 'fnt', 'auto'],
      [r, 'shfnt', '']
    ].forEach(([o, k, def]) => {
      const m = /^u(\d+)$/.exec(o[k] || '');
      if (m) {
        const n = +m[1];
        o[k] = n === i ? (nj >= 0 ? 'u' + nj : def) : n > i ? 'u' + (n - 1) : o[k];
      }
    });
  });
  save();
  lblRegFonts();
  fontsRefresh();
  if (document.getElementById('lpage')) lblRefresh();
}
document.addEventListener('click', e => {
  const h = e.target.closest && e.target.closest('[data-fsort]');
  if (!h) return;
  FSORT = FSORT === 1 ? -1 : 1;
  PG.fonts = 0;
  fontsRefresh();
});
document.addEventListener('click', async e => {
  const b = e.target.closest && e.target.closest('[data-fdel]');
  if (!b) return;
  const E = S.kv.equip,
    i = +b.dataset.fdel,
    u = E.fonts[i];
  if (!u || fontLocked(u.n)) return;
  const use = fontUsage(i),
    others = E.fonts.filter((_, k) => k !== i).map(x => x.n),
    /* police de remplacement par défaut : Inter (droite) */
    def = (others.find(x => /^Inter(?![A-Za-z])/.test(x) && !/italic/i.test(x)) || others[0] || '');
  const det = [
    use.recs.length ? use.recs.length + ' recette(s) (étiquettes / feuille de brassage)' : '',
    use.tpl ? use.tpl + ' modèle(s) d’étiquette' : ''
  ]
    .filter(Boolean)
    .join(' et ');
  const rep = await bcDlg(
    (det ? 'La police « ' + u.n + ' » est utilisée par ' + det + '.\n' : 'Supprimer la police « ' + u.n + ' » ?\n') +
      'Choisissez la police qui la remplacera (liste des polices de la base). Sans choix, « ' + def.replace(/-.*$/, '') + ' » sera utilisée.',
    {
      title: 'Supprimer la police',
      ok: 'Remplacer et supprimer',
      danger: 1,
      input: 1,
      list: others,
      placeholder: def ? def + ' (par défaut)' : 'Rechercher une police…',
      collect: d => {
        const v = (d.querySelector('.bcin').value || '').trim(),
          ok = !v && def ? def : others.find(x => x.toLowerCase() === v.toLowerCase());
        d.querySelector('.bcin').classList.toggle('bad', !ok);
        if (!ok) {
          d.querySelector('.bcin').focus();
          return undefined;
        }
        d.querySelector('.bcin').value = ok;
        return ok;
      }
    }
  );
  if (!rep) return;
  fontDelete(i, rep);
});

/* infobulle d'aperçu : au survol du nom d'une police (1 s), une citation d'exemple s'affiche dans cette police */
const FTIP_TXT = '« La bière est la preuve indéniable que Dieu nous aime et veut nous voir heureux. » — Benjamin Franklin';
let ftipT = 0;
const ftipHide = () => {
  clearTimeout(ftipT);
  ftipT = 0;
  const t = document.getElementById('ftip');
  if (t) t.remove();
};
document.addEventListener('mouseover', e => {
  const c = e.target.closest && e.target.closest('td.fnm');
  if (!c || (e.relatedTarget && c.contains(e.relatedTarget))) return;
  ftipHide();
  ftipT = setTimeout(() => {
    ftipT = 0;
    const u = ((S.kv.equip || {}).fonts || [])[+c.dataset.fi];
    if (!u || !document.body.contains(c)) return;
    const t = document.createElement('div'),
      r = c.getBoundingClientRect();
    t.id = 'ftip';
    t.textContent = FTIP_TXT;
    t.style.fontFamily = `'LU ${u.n.replace(/'/g, '')}', sans-serif`;
    t.style.fontStyle = /italic/i.test(u.n) ? 'italic' : 'normal';
    t.style.fontWeight = /bold/i.test(u.n) ? '700' : '400';
    t.style.left = Math.max(8, Math.min(r.left, innerWidth - 560)) + 'px';
    t.style.top = r.bottom + 6 + 'px';
    document.body.appendChild(t);
    const b = t.getBoundingClientRect();
    if (b.bottom > innerHeight - 8) t.style.top = Math.max(8, r.top - b.height - 6) + 'px';
  }, 1000);
});
document.addEventListener('mouseout', e => {
  const c = e.target.closest && e.target.closest('td.fnm');
  if (c && !(e.relatedTarget && c.contains(e.relatedTarget))) ftipHide();
});
document.addEventListener('click', ftipHide, true);
window.addEventListener('scroll', () => { const t = document.getElementById('ftip'); if (t) t.remove(); }, true);

/* polices de départ (js/fonts_seed.js) : copiées dans la table « polices » de la base au premier lancement */
function fontsSeed() {
  const E = S.kv.equip;
  if ((E.fontsdir1 && E.fontsdir2 && E.fontsdir3 && E.fontsdir4) || typeof FONTS_SEED === 'undefined') return;
  E.fonts = E.fonts || [];
  let n = 0;
  /* v1 : polices de départ (une seule fois) ; v2 : polices de l'interface, ajoutées une fois aux bases existantes */
  FONTS_SEED.forEach(f => {
    if ((f.v === 4 ? E.fontsdir4 : f.v === 3 ? E.fontsdir3 : f.v === 2 ? E.fontsdir2 : E.fontsdir1) || E.fonts.some(x => x.n === f.n)) return;
    E.fonts.push({ n: f.n, d: f.d, b: 1 });
    n++;
  });
  E.fontsdir1 = 1;
  E.fontsdir2 = 1;
  E.fontsdir3 = 1;
  E.fontsdir4 = 1;
  if (n) saveNow();
  lblRegFonts();
  fontsRefresh();
}
