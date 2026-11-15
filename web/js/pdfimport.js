/* Import de recettes depuis un PDF : « Brewfather » (impression de la page de recette depuis le navigateur) et « BeerSmith » (export PDF).
   Le texte est extrait par pdftext.js, analysé selon le format, converti en BeerXML puis inséré par l'importeur Beer.xml (bxImportTexts) :
   recettes en lecture seule (copie avant modification). Brasseur absent → « Brasseur Inconnu ». Ingrédient absent des bibliothèques → conservé comme
   simple texte dans la recette, sans être ajouté aux bibliothèques. Chargé AVANT app.js. */
const pdN = s => {
  const v = parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
  return isFinite(v) ? v : 0;
};
const pdKg = (v, u) => ({ kg: 1, g: 0.001, lb: 0.45359, lbs: 0.45359, oz: 0.0283495 })[String(u).toLowerCase()] * v;
const pdL = (v, u) =>
  ({ l: 1, ml: 0.001, gal: 3.78541, qt: 0.946353, 'fl oz': 0.0295735 })[String(u).toLowerCase()] * v;
const pdC = (v, u) => (/f/i.test(u) ? (v - 32) / 1.8 : v);
const pdX = s =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
const PD_UNKNOWN = 'Brasseur Inconnu';
const pdEmpty = () => ({
  name: '',
  ver: '',
  author: '',
  style: '',
  abv: 0,
  desc: [],
  type: 'All Grain',
  equip: '',
  eff: 0,
  batch: 0,
  boil: 0,
  boilVol: 0,
  og: 0,
  fg: 0,
  ibu: 0,
  ebc: 0,
  mash: [],
  malts: [],
  hops: [],
  miscs: [],
  yeasts: [],
  yeastNotes: [],
  ferm: [],
  carb: 0,
  water: '',
  notes: [],
  extra: []
});
/* ---------- lignes d'un hop / malt / divers / levure au format Brewfather (« qté — nom — type — … ») ---------- */
function pdBfMalt(s) {
  const p = s.split(/\s+—\s+/).map(x => x.trim()),
    m = /^([\d.,]+)\s*(kg|g|lbs?|oz)\b/i.exec(p[0] || '');
  if (!m || p.length < 3) return null;
  const ty = p[2] || '',
    c = /^([\d.,]+)\s*(EBC|SRM|°?L)/i.exec(p[3] || '');
  if (!/grain|sugar|sucre|extract|extrait|dry|adjunct|fruit|honey|miel/i.test(ty)) return null;
  return {
    kg: pdKg(pdN(m[1]), m[2]),
    n: p[1],
    ty: /sugar|sucre|honey|miel/i.test(ty) ? 'Sugar' : /extract|extrait|dry/i.test(ty) ? 'Extract' : 'Grain',
    ebc: c ? (/EBC/i.test(c[2]) ? pdN(c[1]) : pdN(c[1]) * 1.97) : 0
  };
}
function pdBfHop(s) {
  const p = s.split(/\s+—\s+/).map(x => x.trim()),
    m = /^([\d.,]+)\s*(g|oz|kg)\b/i.exec(p[0] || '');
  if (!m || p.length < 3) return null;
  const a = /^(.*?)\s+([\d.,]+)\s*%$/.exec(p[1]),
    t = p[3] || '';
  let tm = 0,
    mm;
  if ((mm = /^([\d.,]+)\s*(min|minutes?|h|hours?|heures?)/i.exec(t))) tm = pdN(mm[1]) * (/^h/i.test(mm[2]) ? 60 : 1);
  else if ((mm = /^(?:jours?|days?|day|d)\s*([\d.,]+)/i.exec(t))) tm = pdN(mm[1]) * 1440;
  else if ((mm = /^([\d.,]+)\s*(days?|jours?|d)\b/i.exec(t))) tm = pdN(mm[1]) * 1440;
  return { kg: pdKg(pdN(m[1]), m[2]), n: a ? a[1] : p[1], alpha: a ? pdN(a[2]) : 0, use: p[2], t: tm };
}
function pdBfMisc(s) {
  const p = s.split(/\s+—\s+/).map(x => x.trim()),
    m = /^([\d.,]+)\s*(kg|g|oz|ml|l|tsp|tbsp|items?|pcs|pkg|units?|articles?)\b/i.exec(p[0] || '');
  if (!m || p.length < 2) return null;
  const tm = /^([\d.,]+)\s*(min|days?|jours?)/i.exec(p[3] || '');
  return {
    v: pdN(m[1]),
    u: m[2].toLowerCase(),
    n: p[1],
    use: p[2] || '',
    t: tm ? pdN(tm[1]) * (/^d|^j/i.test(tm[2]) ? 1440 : 1) : 0
  };
}
function pdBfYeast(s) {
  const p = s.split(/\s+—\s+/).map(x => x.trim()),
    m = /^([\d.,]+)\s*(pkg|pkgs|paquets?|sachets?|g|packs?)\b/i.exec(p[0] || '');
  if (!m || p.length < 2) return null;
  const at = /\s+([\d.,]+)\s*%$/.exec(p[1]);
  return {
    v: pdN(m[1]),
    u: m[2].toLowerCase(),
    n: p[1].replace(/\s+[\d.,]+\s*%$/, '').replace(/([0-9])([A-Z][a-z])/g, '$1 $2'),
    att: at ? pdN(at[1]) : 0
  };
}
/* lignes d'un paragraphe repliées par la mise en page du PDF : une ligne presque pleine se poursuit sur la suivante */
function pdPara(ls) {
  const mx = Math.max(0, ...ls.map(s => s.length)),
    o = [];
  let cur = '';
  ls.forEach(s => {
    cur += (cur ? ' ' : '') + s;
    if (s.length < 0.85 * mx || /^https?:/.test(s)) {
      o.push(cur);
      cur = '';
    }
  });
  if (cur) o.push(cur);
  return o;
}
/* ---------- PDF Brewfather ---------- */
const PDH = {
  eq: /^(Equipment\s*(&|and|et)\s*Process|Équipement\s*(&|et)\s*process(us)?)$/i,
  vit: /^(Vitals|Valeurs clés)$/i,
  mash: /^(Mash|Empâtage)$/i,
  malts: /^(Malts|Fermentables|Grains?|Céréales)\s*(\(.*\))?$/i,
  other: /^(Other|Autres?)\s*(\(.*\))?$/i,
  hops: /^(Hops|Houblons)\s*(\(.*\))?$/i,
  miscs: /^(Miscs?|Divers)$/i,
  yeast: /^(Yeasts?|Levures?)$/i,
  ferm: /^Fermentation$/i,
  water: /^(Water Profile|Profil d.eau)$/i,
  notes: /^Notes?$/i
};
function pdParseBrewfather(lines) {
  const L = lines.filter(
    s => !/^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\b.*Brewfather\s*$/.test(s) && !/^about:blank\b/.test(s)
  );
  const end = L.findIndex(s => /^(Printed from Brewfather|Imprimé depuis Brewfather)/i.test(s)),
    T = end >= 0 ? L.slice(0, end) : L,
    d = pdEmpty();
  const heads = [];
  T.forEach((s, i) => {
    for (const [k, re] of Object.entries(PDH))
      if (re.test(s)) {
        if (k === 'eq' && heads.some(h => h[0] === 'eq')) continue;
        heads.push([k, i]);
        break;
      }
  });
  const sec = k => {
    const i = heads.findIndex(x => x[0] === k);
    if (i < 0) return [];
    return T.slice(heads[i][1] + 1, i + 1 < heads.length ? heads[i + 1][1] : T.length);
  };
  const first = heads.length ? heads[0][1] : T.length,
    head = T.slice(0, first);
  d.name = head[0] || '';
  const ai = head.findIndex(s => /^[\d.,]+\s*%\s*(ABV|alc)/i.test(s));
  if (ai >= 0) {
    d.abv = pdN(head[ai]);
    d.style = ai >= 2 ? head[ai - 1] : '';
  } else d.style = head[1] || '';
  const bi = head.findIndex((s, i) => i > 0 && /^(by|par|de)\s+\S/i.test(s));
  if (bi >= 0) d.author = head[bi].replace(/^(by|par|de)\s+/i, '').trim();
  d.desc = pdPara(head.slice((bi >= 0 ? bi : ai >= 0 ? ai : 1) + 1));
  sec('eq').forEach((s, i) => {
    let m;
    if ((m = /^(Efficiency|Efficacité)\s*:\s*([\d.,]+)/i.exec(s))) d.eff = pdN(m[2]);
    else if ((m = /^(Batch Volume|Volume du brassin)\s*:\s*([\d.,]+)\s*(L|gal)/i.exec(s)))
      d.batch = pdL(pdN(m[2]), m[3]);
    else if ((m = /^(Boil Time|Temps d.ébullition)\s*:\s*([\d.,]+)/i.exec(s))) d.boil = pdN(m[2]);
    else if ((m = /^(Boil Volume|Volume d.ébullition)\s*:\s*([\d.,]+)\s*(L|gal)/i.exec(s)))
      d.boilVol = pdL(pdN(m[2]), m[3]);
    else if (i === 0 && !/:/.test(s)) d.equip = s;
  });
  const vt = sec('vit').join(' ');
  let m;
  if ((m = /(Original Gravity|Densité initiale)\s*:\s*([\d.,]+)/i.exec(vt))) d.og = pdN(m[2]);
  if ((m = /(Final Gravity|Densité finale)\s*:\s*([\d.,]+)/i.exec(vt))) d.fg = pdN(m[2]);
  if ((m = /\bIBU\s*:\s*([\d.,]+)/i.exec(vt))) d.ibu = pdN(m[1]);
  if ((m = /(Color|Couleur)\s*:\s*([\d.,]+)\s*(EBC|SRM)?/i.exec(vt)))
    d.ebc = /SRM/i.test(m[3] || '') ? pdN(m[2]) * 1.97 : pdN(m[2]);
  sec('mash').forEach(s => {
    const x = /^(.+?)\s+—\s+([\d.,]+)\s*°\s*([CF])\s+—\s+([\d.,]+)\s*min/i.exec(s);
    if (x)
      d.mash.push({
        n: /^(temperature|température|temperatur)$/i.test(x[1]) ? 'Saccharification' : x[1],
        t: Math.round(pdC(pdN(x[2]), x[3]) * 10) / 10,
        m: pdN(x[4])
      });
  });
  [...sec('malts'), ...sec('other')].forEach(s => {
    const x = pdBfMalt(s);
    if (x) d.malts.push(x);
    else {
      const y = pdBfMisc(s);
      if (y) d.miscs.push(y);
    }
  });
  sec('hops').forEach(s => {
    const x = pdBfHop(s);
    if (x) d.hops.push(x);
  });
  sec('miscs').forEach(s => {
    const x = pdBfMisc(s);
    if (x) d.miscs.push(x);
  });
  sec('yeast').forEach(s => {
    const x = pdBfYeast(s);
    if (x) d.yeasts.push(x);
    else d.yeastNotes.push(s);
  });
  sec('ferm').forEach(s => {
    let x;
    if ((x = /^(Carbonation|Carbonatation)\s*:\s*([\d.,]+)/i.exec(s))) d.carb = pdN(x[2]);
    else if ((x = /^(.+?)\s+—\s+([\d.,]+)\s*°\s*([CF])\s+—\s+([\d.,]+)\s*(days?|jours?|weeks?|semaines?)/i.exec(s)))
      d.ferm.push({
        k: x[1],
        t: Math.round(pdC(pdN(x[2]), x[3]) * 10) / 10,
        d: pdN(x[4]) * (/^w|^s/i.test(x[5]) ? 7 : 1)
      });
  });
  const wt = sec('water').join(' '),
    wm =
      /Ca\s*2\+\s*([\d.,]+)\s*Mg\s*2\+\s*([\d.,]+)\s*Na\s*\+\s*([\d.,]+)\s*Cl\s*-?\s*([\d.,]+)\s*SO\s*4\s*2-?\s*([\d.,]+)\s*HCO\s*3\s*-?\s*([\d.,]+)/i.exec(
        wt
      );
  if (wm)
    d.water =
      'Ca ' + wm[1] + ' · Mg ' + wm[2] + ' · Na ' + wm[3] + ' · Cl ' + wm[4] + ' · SO4 ' + wm[5] + ' · HCO3 ' + wm[6];
  d.notes = pdPara(sec('notes'));
  if (!d.name || !d.malts.length) throw new Error('recette Brewfather non reconnue (aucun malt trouvé)');
  return d;
}
/* ---------- PDF BeerSmith ---------- */
function pdCols(hl, names) {
  const xs = [],
    its = hl.items;
  let from = 0;
  for (const n of names) {
    const want = n.replace(/\s+/g, '');
    let found = -1;
    for (let j = from; j < its.length && found < 0; j++) {
      let acc = '';
      for (let k = j; k < its.length; k++) {
        acc += its[k].s.replace(/\s+/g, '');
        if (acc === want) {
          found = j;
          from = k + 1;
          break;
        }
        if (!want.startsWith(acc)) break;
      }
    }
    if (found < 0) return null;
    xs.push(its[found].x);
  }
  return xs;
}
function pdCells(l, xs) {
  const c = xs.map(() => ({ s: '', p: null }));
  for (const t of l.items) {
    let k = 0;
    xs.forEach((x, i) => {
      if (t.x >= x - 2) k = i;
    });
    const o = c[k];
    if (o.p && t.x - o.p.x1 > 0.18 * Math.min(t.size, o.p.size) && !/\s$/.test(o.s) && !/^\s/.test(t.s)) o.s += ' ';
    o.s += t.s;
    o.p = t;
  }
  return c.map(o => o.s.replace(/\s+/g, ' ').trim());
}
function pdParseBeerSmith(lines) {
  const L = lines.filter(l => !/^Created with BeerSmith/i.test(l.text)),
    d = pdEmpty();
  if (!L.length) throw new Error('PDF vide');
  d.name = L[0].text;
  const sm = /^(.+?)\s*\((\d+\s*[A-Za-z]?)\)\s*$/.exec((L[1] && L[1].text) || '');
  d.style = sm ? sm[1] : (L[1] && L[1].text) || '';
  const idx = re => L.findIndex(l => re.test(l.text)),
    iIng = idx(/^Ingredients$/),
    iGr = idx(/^Gravity, Alcohol Content and Color$/),
    iMash = idx(/^Mash Profile$/),
    iSteep = idx(/^Grain Steeping and Boil Profile$/),
    iCarb = idx(/^Carbonation and Storage$/),
    iNotes = L.findIndex((l, i) => i > iCarb && /^Notes$/.test(l.text));
  const kv = {},
    kvs = (a, b) =>
      L.slice(a, b < 0 ? undefined : b).forEach(l => {
        const m = /^([A-Za-z][A-Za-z ./#%]*?):\s*(.*)$/.exec(l.text);
        if (m) {
          kv[m[1].trim()] = m[2].trim();
        }
      });
  kvs(2, iIng < 0 ? L.length : iIng);
  const hdrEnd = [iIng, iGr, iMash, iSteep, iCarb].filter(i => i >= 0).sort((a, b) => a - b);
  /* champs « clé : valeur » de toutes les sections sauf le tableau des ingrédients */
  const kv2 = {};
  L.forEach((l, i) => {
    if (iIng >= 0 && iGr >= 0 && i > iIng && i < iGr) return;
    if (iMash >= 0 && iNotes >= 0 && i > iNotes) return;
    const re = /([A-Za-z][A-Za-z0-9 ./]*?):\s*([^:]*?)(?=\s+[A-Z][A-Za-z0-9 ./]*:|$)/g;
    let m;
    while ((m = re.exec(l.text))) kv2[m[1].trim()] = m[2].trim();
  });
  const val = (k, o) => {
      const s = (o || kv2)[k];
      return s == null ? '' : s;
    },
    vol = k => {
      const m = /([\d.,]+)\s*(L|gal|qt)/i.exec(val(k));
      return m ? pdL(pdN(m[1]), m[2]) : 0;
    };
  d.type = val('Type') || 'All Grain';
  d.batch = vol('Batch Size');
  d.boilVol = vol('Boil Size');
  d.boil = pdN(val('Boil Time'));
  d.author = val('Brewer');
  d.equip = val('Equipment');
  d.eff = pdN(val('Efficiency'));
  d.og = pdN(val('Est Original Gravity'));
  d.fg = pdN(val('Est Final Gravity'));
  d.abv = pdN(val('Estimated Alcohol by Vol'));
  d.ibu = pdN(val('Bitterness'));
  d.ebc = (() => {
    const m = /([\d.,]+)\s*(EBC|SRM)?/i.exec(val('Est Color'));
    return m ? (/SRM/i.test(m[2] || '') ? pdN(m[1]) * 1.97 : pdN(m[1])) : 0;
  })();
  d.carb = pdN(val('Volumes of CO2'));
  const meas = [
    ['Measured Original Gravity', 'DI mesurée'],
    ['Measured Final Gravity', 'DF mesurée'],
    ['Actual Alcohol by Vol', 'alcool mesuré']
  ]
    .map(([k, l]) => (val(k) ? l + ' ' + val(k) : ''))
    .filter(Boolean);
  if (meas.length) d.extra.push('Valeurs mesurées : ' + meas.join(' · '));
  if (val('Fermentation')) d.extra.push('Fermentation : ' + val('Fermentation'));
  if (val('Taste Notes')) d.extra.push('Notes de dégustation : ' + val('Taste Notes'));
  const cs = [
    val('Age for') && 'Garde : ' + val('Age for'),
    val('Storage Temperature') && 'Température de garde : ' + val('Storage Temperature'),
    val('Carbonation Type') &&
      'Carbonatation : ' +
        val('Carbonation Type') +
        (val('Keg/Bottling Temperature') ? ' à ' + val('Keg/Bottling Temperature') : '')
  ].filter(Boolean);
  if (cs.length) d.extra.push(cs.join(' · '));
  /* tableau des ingrédients */
  let xs = null;
  const rows = [];
  for (let i = Math.max(iIng, 0) + 1; i < (iGr < 0 ? L.length : iGr); i++) {
    const l = L[i];
    if (/^Amt\s+Name\s+Type/.test(l.text)) {
      xs = pdCols(l, ['Amt', 'Name', 'Type', '#', '%/IBU', 'Volume']) || xs;
      continue;
    }
    if (!xs) continue;
    const c = pdCells(l, xs);
    if (/^[\d.,]+\s*(kg|g|oz|lbs?|ml|l|pkg|tsp|tbsp|items?|each|gal|qt)\b/i.test(c[0]))
      rows.push({ amt: c[0], name: c[1], type: c[2], cells: c });
    else if (rows.length && c[1]) {
      const r = rows[rows.length - 1];
      r.name += (/[A-Za-z]-$/.test(r.name) ? '' : ' ') + c[1];
    }
  }
  for (const r of rows) {
    const a = /^([\d.,]+)\s*(\S+)/.exec(r.amt),
      q = pdN(a[1]),
      u = a[2].toLowerCase();
    let nm = r.name,
      ebc = 0,
      mm;
    if ((mm = /\(([\d.,]+)\s*(EBC|SRM)\)/i.exec(nm))) {
      ebc = /SRM/i.test(mm[2]) ? pdN(mm[1]) * 1.97 : pdN(mm[1]);
      nm = nm.replace(mm[0], ' ');
    }
    const tag = (/\[(Steep|Boil|Mash|Sparge|Primary|Secondary)\]/i.exec(nm) || [])[1] || '';
    nm = nm.replace(/\[(Steep|Boil|Mash|Sparge|Primary|Secondary)\]/gi, ' ');
    const ty = r.type;
    if (/^hop$/i.test(ty)) {
      const am = /\[([\d.,]+)\s*%\]/.exec(nm),
        nameOnly = nm.split('[')[0].trim(),
        rest = nm
          .slice(nm.indexOf(']') + 1)
          .replace(/^\s*-\s*/, '')
          .trim();
      let use = 'Boil',
        t = 0,
        x;
      if (/dry\s*hop|before bottling|days? before|jours/i.test(rest)) {
        use = 'Dry Hop';
        x = /for\s+([\d.,]+)\s*days?/i.exec(rest) || /([\d.,]+)\s*days?/i.exec(rest);
        t = x ? pdN(x[1]) * 1440 : 0;
      } else if (/first wort/i.test(rest)) use = 'First Wort';
      else if (/^mash/i.test(rest)) use = 'Mash';
      else if (/^aroma|whirl|steep/i.test(rest)) {
        use = 'Aroma';
        x = /([\d.,]+)\s*min/i.exec(rest);
        t = x ? pdN(x[1]) : 0;
      } else {
        x = /([\d.,]+)\s*min/i.exec(rest);
        t = x ? pdN(x[1]) : 0;
      }
      d.hops.push({ kg: pdKg(q, u), n: nameOnly, alpha: am ? pdN(am[1]) : 0, use, t });
    } else if (/^yeast$/i.test(ty)) {
      const st = /\[([\d.,]+\s*ml)\]/i.exec(nm);
      if (st) {
        d.yeastNotes.push('Levure : starter ' + st[1]);
        nm = nm.replace(st[0], ' ');
      }
      d.yeasts.push({ v: q, u: u, n: nm.replace(/\s+/g, ' ').trim(), att: 0 });
    } else if (/^(grain|extract|sugar|dry extract|adjunct)$/i.test(ty)) {
      d.malts.push({
        kg: pdKg(q, u),
        n: nm.replace(/\s+/g, ' ').trim(),
        ty: /sugar/i.test(ty) ? 'Sugar' : /extract/i.test(ty) ? 'Extract' : 'Grain',
        ebc
      });
    } else
      d.miscs.push({
        v: q,
        u,
        n: nm.replace(/\s+/g, ' ').trim(),
        use: tag || (/boil/i.test(r.name) ? 'Boil' : ''),
        t: 0
      });
  }
  /* empâtage */
  if (iMash >= 0) {
    let ms = null,
      mn = 0;
    for (let i = iMash + 1; i < L.length; i++) {
      const l = L[i];
      if (/^Name\s+Description\s+Step Temperature\s+Step Time/.test(l.text)) {
        ms = pdCols(l, ['Name', 'Description', 'Step Temperature', 'Step Time']);
        continue;
      }
      if (/^(Sparge|Mash Notes)\s*:/i.test(l.text)) {
        d.extra.push(l.text);
        mn = 1;
        continue;
      }
      if (
        mn &&
        !/^(Name\s+Description|Carbonation and Storage|Notes$)/.test(l.text) &&
        !/^[A-Z][A-Za-z ./]*:/.test(l.text)
      ) {
        d.extra[d.extra.length - 1] += ' ' + l.text;
        continue;
      }
      mn = 0;
      if (!ms) continue;
      const c = pdCells(l, ms),
        tm = /([\d.,]+)\s*([CF])\b/.exec(c[2]),
        ti = /([\d.,]+)\s*min/i.exec(c[3]);
      if (c[0] && tm && ti) d.mash.push({ n: c[0], t: Math.round(pdC(pdN(tm[1]), tm[2]) * 10) / 10, m: pdN(ti[1]) });
    }
  }
  if (!d.mash.length && val('Steep Temp')) {
    d.mash.push({
      n: 'Trempage des grains',
      t: Math.round(pdC(pdN(val('Steep Temp')), 'C') * 10) / 10,
      m: pdN(val('Steep Time'))
    });
  }
  if (iNotes >= 0) d.notes = pdPara(L.slice(iNotes + 1).map(l => l.text));
  if (!d.malts.length) throw new Error('recette BeerSmith non reconnue (aucun malt / extrait trouvé)');
  return d;
}
/* ---------- détection du format ---------- */
function pdParse(pages) {
  const lines = pages.flatMap(p => p.lines),
    txt = lines.map(l => l.text).join('\n');
  if (/Created with BeerSmith/i.test(txt)) return { fmt: 'BeerSmith', d: pdParseBeerSmith(lines) };
  if (
    /Brewfather/i.test(txt) &&
    /(Equipment\s*(&|and)\s*Process|Printed from Brewfather|Imprimé depuis Brewfather)/i.test(txt)
  )
    return { fmt: 'Brewfather', d: pdParseBrewfather(lines.map(l => l.text)) };
  throw new Error('format de PDF non reconnu (formats pris en charge : Brewfather, BeerSmith)');
}
/* ---------- objet recette → BeerXML 1.0 ---------- */
function pdToXml(d, file) {
  const f = (n, v) =>
      v === '' || v == null || (typeof v === 'number' && !isFinite(v)) ? '' : `<${n}>${pdX(v)}</${n}>`,
    dh = d.hops.filter(h => /dry|sec|cold/i.test(h.use) && h.t >= 0);
  const dryNote =
    dh.length && dh.some(h => h.t === 0 || h.t >= 1440)
      ? 'Dry hop : ' +
        dh
          .map(h => h.n + ' ' + Math.round(h.kg * 10000) / 10 + ' g (jour ' + Math.round(h.t / 1440) + ')')
          .join(' ; ') +
        '.'
      : '';
  const nt = [
    d.desc.join('\n'),
    d.equip
      ? 'Équipement d’origine : ' +
        d.equip +
        (d.boilVol ? ' ; volume d’ébullition ' + Math.round(d.boilVol * 100) / 100 + ' L' : '')
      : '',
    d.water ? 'Profil d’eau cible (mg/L) : ' + d.water + '.' : '',
    dryNote,
    d.yeastNotes.join(' — '),
    d.extra.join('\n'),
    d.notes.join('\n')
  ]
    .filter(Boolean)
    .join('\n');
  const mm = d.mash
    .map(
      m =>
        `<MASH_STEP>${f('NAME', m.n)}<TYPE>Temperature</TYPE>${f('STEP_TIME', m.m)}${f('STEP_TEMP', m.t)}</MASH_STEP>`
    )
    .join('');
  const TG = ['PRIMARY', 'SECONDARY', 'TERTIARY'],
    fe = d.ferm
      .slice(0, 3)
      .map((x, i) => `<${TG[i]}_AGE>${x.d}</${TG[i]}_AGE><${TG[i]}_TEMP>${x.t}</${TG[i]}_TEMP>`)
      .join('');
  const hu = h => {
    const u = h.use.toLowerCase();
    return /dry|sec|cold/.test(u)
      ? ['Dry Hop', '']
      : /first|premier/.test(u)
        ? ['First Wort', '']
        : /mash|empât/.test(u)
          ? ['Mash', '']
          : /whirl|tourbillon/.test(u)
            ? ['Aroma', 'Whirlpool']
            : /hop ?stand/.test(u)
              ? ['Aroma', 'Hopstand']
              : /aroma|flame/.test(u)
                ? ['Aroma', 'Whirlpool']
                : h.t === 0
                  ? ['Aroma', 'Whirlpool']
                  : ['Boil', ''];
  };
  const wt = u => /^(kg|g|oz|lbs?)$/.test(u),
    W = m => (m.ty === 'Sugar' ? 100 : m.ty === 'Extract' ? 95 : m.ebc >= 50 ? 75 : 80);
  return `<?xml version="1.0" encoding="UTF-8"?><RECIPES><RECIPE>${f('NAME', d.name + (d.ver ? ' v' + d.ver : ''))}<TYPE>${pdX(/extract|extrait/i.test(d.type) ? 'Extract' : /partial|partiel/i.test(d.type) ? 'Partial Mash' : 'All Grain')}</TYPE>${f('BREWER', (d.author || '').trim() || PD_UNKNOWN)}<STYLE>${f('NAME', d.style)}</STYLE><VERSION>${d.ver || 1}</VERSION>${f('BATCH_SIZE', d.batch || '')}${f('BOIL_SIZE', d.boilVol || '')}${f('BOIL_TIME', d.boil || '')}${f('EFFICIENCY', d.eff || '')}${f('EST_OG', d.og || '')}${f('EST_FG', d.fg || '')}${f('EST_COLOR', d.ebc ? Math.round(d.ebc * 10) / 10 : '')}${f('IBU', d.ibu || '')}${f('EST_ABV', d.abv || '')}${f('NOTES', nt)}${fe}${f('CARBONATION', d.carb || '')}
<FERMENTABLES>${d.malts.map(m => `<FERMENTABLE>${f('NAME', m.n)}<TYPE>${m.ty}</TYPE>${f('AMOUNT', Math.round(m.kg * 10000) / 10000)}${f('COLOR', Math.round(m.ebc * 10) / 10)}<YIELD>${W(m)}</YIELD></FERMENTABLE>`).join('')}</FERMENTABLES>
<HOPS>${d.hops
    .map(h => {
      const [u, n] = hu(h);
      return `<HOP>${n ? f('NOTES', n) : ''}${f('NAME', h.n)}${f('AMOUNT', Math.round(h.kg * 100000) / 100000)}${f('ALPHA', h.alpha)}<USE>${u}</USE>${f('TIME', Math.round(h.t))}<FORM>Pellet</FORM></HOP>`;
    })
    .join('')}</HOPS>
<MISCS>${d.miscs
    .map(m => {
      const w = wt(m.u),
        vol = /^(ml|l)$/.test(m.u),
        a = w ? Math.round(pdKg(m.v, m.u) * 100000) / 100000 : vol ? pdL(m.v, m.u) : 0,
        nm = w
          ? m.n
          : vol
            ? m.n + ' (' + m.v + ' ' + m.u + ')'
            : m.n + ' (' + String(m.v).replace('.', ',') + ' ' + m.u + ')';
      return `<MISC>${f('NAME', nm)}<TYPE>Other</TYPE>${f('USE', m.use || 'Boil')}${f('AMOUNT', a)}<AMOUNT_IS_WEIGHT>${w || !vol ? 'TRUE' : 'FALSE'}</AMOUNT_IS_WEIGHT>${f('TIME', Math.round(m.t))}</MISC>`;
    })
    .join('')}</MISCS>
<YEASTS>${d.yeasts
    .map(y => {
      const w = y.u === 'g';
      return `<YEAST>${f('NAME', y.n)}${f('ATTENUATION', y.att || '')}<AMOUNT>${w ? y.v / 1000 : 0.011 * y.v}</AMOUNT><AMOUNT_IS_WEIGHT>${w ? 'TRUE' : 'FALSE'}</AMOUNT_IS_WEIGHT></YEAST>`;
    })
    .join('')}</YEASTS>
<MASH><MASH_STEPS>${mm}</MASH_STEPS></MASH></RECIPE></RECIPES>`;
}
/* ---------- correspondance des ingrédients inconnus (boîte de dialogue) ---------- */
const PDT = { malts: 'Malt', hops: 'Houblon', yeasts: 'Levure', ings: 'Ingrédient', styles: 'Style' };
const pdNotMalt = (n, ty) =>
  /lact|sucre|sugar|dextros|glucos|fructos|honey|miel\b|syrup|sirop|candi|maltodext|molass|m[ée]lasse|treacle|agave|maple|[ée]rable|salt|\bsel\b|rice hull|balle de riz/i.test(
    n
  ) ||
  /sugar|adjunct/i.test(ty || '') ||
  !!(bxMatch('ings', n) || find('ings', n));
function pdUnknown(list) {
  const m = new Map(),
    add = (t, n, rec) => {
      if (!n) return;
      const k = t + '|' + bxNorm(n);
      if (!m.has(k)) m.set(k, { t, n, rec: [], sug: (bxFind(t, n) || {}).name || '' });
      const o = m.get(k);
      if (rec && !o.rec.includes(rec)) o.rec.push(rec);
    };
  for (const d of list) {
    d.malts.forEach(x => {
      if (!bxMatch('malts', x.n) && !find('malts', x.n)) {
        add('malts', x.n, d.name);
        const u = m.get('malts|' + bxNorm(x.n));
        if (u && u.ing === undefined) {
          u.ing = pdNotMalt(x.n, x.ty);
          if (u.ing) u.sug = (bxFind('ings', x.n) || {}).name || '';
        }
      }
    });
    d.hops.forEach(x => {
      if (!bxMatch('hops', x.n) && !find('hops', x.n)) add('hops', x.n, d.name);
    });
    d.yeasts.forEach(x => {
      if (!bxMatch('yeasts', x.n) && !find('yeasts', x.n)) add('yeasts', x.n, d.name);
    });
    d.miscs.forEach(x => {
      if (!bxMatch('ings', x.n) && !find('ings', x.n)) add('ings', x.n, d.name);
    });
    if (d.style && !find('styles', bxStyle(d.style))) add('styles', d.style, d.name);
  }
  return [...m.values()];
}
async function pdMapDlg(unk, o) {
  o = o || {};
  const e = pdX,
    ids = ['malts', 'hops', 'yeasts', 'ings', 'styles'],
    CT = { malts: 'Malt', hops: 'Houblon', yeasts: 'Levure', ings: 'Ingrédient', conso: 'Consommable' },
    pool = t => (t === 'all' ? ['malts', 'hops', 'yeasts', 'ings', 'conso'].flatMap(k => S[k] || []).filter(x => !x.sys) : (S[t] || []).filter(x => !x.sys)),
    allOpts = ['malts', 'hops', 'yeasts', 'ings', 'conso']
      .flatMap(k => (S[k] || []).filter(x => !x.sys).map(x => [k, x]))
      .map(([k, x]) => `<option value="${e(x.name)}" label="${CT[k]}${x.maltier || x.labo ? ' · ' + e(x.maltier || x.labo) : ''}"></option>`)
      .join(''),
    dl =
      `<datalist id="bcdl-all">${allOpts}</datalist>` +
      `<datalist id="bcdl-styles">${(S.styles || []).map(x => `<option value="${e(x.name)}"></option>`).join('')}</datalist>`;
  const rows = unk
    .map(
      (u, i) =>
        `<tr><td><span class="ty">${PDT[u.t]}</span><span class="un">${e(u.n)}</span><div class="rc">${e(u.rec.join(' ; '))}</div></td><td><input data-i="${i}" list="bcdl-${u.t === 'styles' ? 'styles' : 'all'}" value="${e(u.sug)}" placeholder="vide = absent de la base" autocomplete="off"></td></tr>`
    )
    .join('');
  const res = await bcForm(
    o.msg ||
      unk.length +
        ' ingrédient' +
        (unk.length > 1 ? 's' : '') +
        ' de l’import n’' +
        (unk.length > 1 ? 'existent' : 'existe') +
        ' pas dans la base sous ce nom.\nPour chacun, choisissez l’ingrédient correspondant dans la liste de la base (saisissez quelques lettres pour filtrer). Laissez le champ vide si l’ingrédient n’existe pas : il restera en texte et sera ajouté à la liste « À rechercher » (Paramètres). Pour un style inconnu, choisissez le style de la base ; vide = le style reste en texte. Vous pouvez choisir n’importe quel composant de la base (malt, houblon, levure, ingrédient, consommable) : l’élément sera rangé dans la catégorie du composant choisi. Une suggestion est pré-remplie quand un nom proche existe.',
    {
      title: o.title || 'Correspondance des ingrédients',
      ok: o.ok || 'Valider',
      cancel: o.cancel || 'Tout laisser vide',
      wide: 1,
      body: `<div class="bcmap"><table>${rows}</table>${dl}</div>`,
      collect: d => {
        const out = {};
        let bad = 0;
        d.querySelectorAll('.bcmap input').forEach(inp => {
          const u = unk[+inp.dataset.i],
            v = inp.value.trim();
          inp.classList.remove('bad');
          if (!v) {
            if (u.t === 'malts' && u.ing) out['@mv|malts|' + u.n] = 'ings|' + u.n; /* sucre, lactose… sans choix : rangé comme ingrédient */
            return;
          }
          const st = u.t === 'styles',
            kinds = st ? ['styles'] : ['malts', 'hops', 'yeasts', 'ings', 'conso'],
            ord = st ? kinds : [u.t, ...kinds.filter(k => k !== u.t)];
          let hit = null;
          for (const k of ord) {
            const o =
              (S[k] || []).find(x => String(x.name).toLowerCase() === v.toLowerCase()) ||
              (S[k] || []).find(x => lab(k, x).toLowerCase() === v.toLowerCase());
            if (o) {
              hit = [k, o];
              break;
            }
          }
          if (!hit) {
            inp.classList.add('bad');
            bad++;
            return;
          }
          const [k, o] = hit;
          if (k === u.t || (u.t === 'ings' && k === 'conso')) out[u.t + '|' + u.n] = o.name;
          else out['@mv|' + u.t + '|' + u.n] = k + '|' + o.name;
        });
        let m = d.querySelector('.bcmsg');
        if (bad) {
          if (!m) {
            m = document.createElement('div');
            m.className = 'bcmsg';
            d.querySelector('.bcmap').after(m);
          }
          m.textContent =
            bad + ' valeur(s) ne figure(nt) pas dans la base : choisissez dans la liste ou videz le champ.';
          return undefined;
        }
        if (m) m.remove();
        return out;
      }
    }
  );
  return o.cancelNull ? res : res || {};
}
function pdApplyMap(d, map) {
  /* composant d'une autre catégorie : l'élément change de liste (poids en g → ingrédient / malt / houblon ; levure et consommable : 1 unité) */
  const mv = (t, a, g) => {
    for (let i = a.length - 1; i >= 0; i--) {
      const v = map['@mv|' + t + '|' + a[i].n];
      if (!v) continue;
      const kind = v.slice(0, v.indexOf('|')),
        name = v.slice(v.indexOf('|') + 1),
        x = a[i],
        gr = g(x);
      a.splice(i, 1);
      if (kind === 'malts') d.malts.push({ ...x, kg: gr / 1000, n: name });
      else if (kind === 'hops') d.hops.push({ kg: gr / 1000, n: name, alpha: x.alpha || 0, use: x.use || 'Boil', t: x.t != null ? x.t : 60 });
      else if (kind === 'yeasts') d.yeasts.push({ v: 1, u: 'pkg', n: name, att: 0 });
      else d.miscs.push({ n: name, u: 'g', v: kind === 'conso' ? 1 : Math.round(gr * 10) / 10, use: 'Boil', t: 0 });
    }
  };
  mv('malts', d.malts, x => (x.kg || 0) * 1000);
  mv('hops', d.hops, x => (x.kg || 0) * 1000);
  mv('yeasts', d.yeasts, () => 1);
  mv('ings', d.miscs, x => +x.v || 0);
  const f = (t, a) =>
    a.forEach(x => {
      const n = map[t + '|' + x.n];
      if (n) x.n = n;
    });
  f('malts', d.malts);
  f('hops', d.hops);
  f('yeasts', d.yeasts);
  f('ings', d.miscs);
  if (d.style && map['styles|' + d.style]) d.style = map['styles|' + d.style];
}
/* ---------- import de fichiers PDF ---------- */
async function pdImport(files) {
  const parsed = [],
    errs0 = [];
  for (const f of files) {
    try {
      const pages = await pdfExtract(await f.arrayBuffer());
      parsed.push({ f, r: pdParse(pages) });
    } catch (e) {
      errs0.push(f.name + ' : ' + ((e && e.message) || e));
    }
  }
  const unk = pdUnknown(parsed.map(x => x.r.d)),
    map = unk.length ? (await pdMapDlg(unk)) || {} : {},
    items = [];
  for (const { f, r } of parsed) {
    try {
      pdApplyMap(r.d, map);
      items.push({ name: f.name, text: pdToXml(r.d, f.name), src: 'PDF ' + r.fmt, noCreate: 1 });
    } catch (e) {
      errs0.push(f.name + ' : ' + ((e && e.message) || e));
    }
  }
  const r = bxImportTexts(items);
  r.errs.push(...errs0);
  return r;
}
