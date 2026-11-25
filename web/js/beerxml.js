/* Import Beer.xml (BeerXML 1.0) → recettes de la bibliothèque. Les recettes importées sont en LECTURE SEULE : il faut les copier pour les modifier.
   Chargé AVANT app.js : ne dépend des globales de app.js (S, COLS, TXT, find, fill, defaults, labM, MASH, withRec, htmlCode, upsertRecipe, ensureMash,
   save, show, biblio, main, hh, fd) qu'à l'appel. */
const bxKids = (el, tag) => (el ? [...el.children].filter(c => c.tagName === tag) : []),
  bxOne = (el, tag) => bxKids(el, tag)[0],
  bxTx = (el, tag) => {
    const n = bxOne(el, tag);
    return n ? n.textContent.trim() : '';
  },
  bxNum = (el, tag) => {
    const v = parseFloat(bxTx(el, tag).replace(',', '.'));
    return isFinite(v) ? v : null;
  };
const bxNorm = s =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bbestmalz\b/g, 'best')
    .replace(/\b(malt|malts|de|du|des|the)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
/* ingrédient de la bibliothèque : nom identique, sinon tous les mots du nom de la bibliothèque figurent dans celui du fichier (le plus précis gagne) ;
   pour les houblons, l'inverse est accepté aussi (« Saaz » ↔ « Saaz (CZ) »). Jamais de correspondance partielle de mot (« Spalt » ≠ « Strisslespalt »). */
function bxMatch(t, name) {
  const q = bxNorm(name);
  if (!q) return null;
  const qt = q.split(' ');
  let best = null,
    bl = 0;
  for (const x of S[t]) {
    const n = bxNorm(x.name);
    if (!n) continue;
    if (n === q) return x;
    const nt = n.split(' '),
      sub = (a, b) => a.every(w => b.includes(w));
    if ((sub(nt, qt) || (t === 'hops' && sub(qt, nt))) && n.length > bl && Math.min(n.length, q.length) >= 4) {
      best = x;
      bl = n.length;
    }
  }
  return best;
}
/* ingrédient absent de la bibliothèque : ajouté avec les données du fichier (pour que la recette se calcule) */
/* options de l'import en cours : noCreate = ingrédient inconnu conservé en texte (import PDF), src = libellé de la source, unk = noms inconnus */
let BXO = { noCreate: false, src: '', unk: [], rec: [], cur: '' };
const bxInfo = (t, m) =>
  t === 'malts'
    ? [
        m.ebc ? 'couleur ' + m.ebc + ' EBC' : '',
        m.potentiel ? 'rendement ≈ ' + Math.round(m.potentiel / 3.846) + ' %' : '',
        m.maltier || ''
      ]
        .filter(Boolean)
        .join(', ')
    : t === 'hops'
      ? m.alpha_min
        ? 'alpha ' + m.alpha_min + ' %'
        : ''
      : t === 'yeasts'
        ? [m.labo || '', m.att_min ? 'atténuation ' + m.att_min + ' %' : ''].filter(Boolean).join(', ')
        : '';
/* ingrédients inconnus (import PDF) mémorisés dans Paramètres › « À rechercher » */
function bxToFind(recs) {
  const E = S.kv.equip;
  E.arech = E.arech || [];
  for (const r of recs) {
    const q = bxNorm(r.n),
      x = E.arech.find(y => y.t === r.t && bxNorm(y.n) === q);
    if (x) {
      if (r.r && !x.r.includes(r.r)) x.r.push(r.r);
      if (!x.i && r.i) x.i = r.i;
    } else E.arech.push({ t: r.t, n: r.n, i: r.i || '', r: r.r ? [r.r] : [] });
  }
  E.arech = E.arech.filter(y => !bxMatch(y.t, y.n) && !find(y.t, y.n));
}
function bxIng(t, name, mk, added) {
  let d = bxMatch(t, name);
  if (!d && BXO.noCreate) {
    if (!BXO.unk.includes(name)) BXO.unk.push(name);
    BXO.rec.push({ t, n: name, i: bxInfo(t, mk), r: BXO.cur });
    return null;
  }
  if (!d) {
    d = { name, ...mk };
    S[t].push(d);
    fill(t);
    added[t] = (added[t] || 0) + 1;
  }
  return d;
}
function bxStyle(n) {
  if (!n) return '';
  const al = s =>
      bxNorm(s)
        .replace(/\b(amerikansk|americaine|americain|americana|amerikanisch)\b/g, 'american')
        .replace(/\b(belge|belga|belgisch)\b/g, 'belgian'),
    q = al(n),
    qt = q.split(' ');
  const nm = s => al(String(s.name).replace(/^\d+[A-Za-z]?\s+/, ''));
  return (
    (
      S.styles.find(s => nm(s) === q) ||
      S.styles.find(s => {
        const x = nm(s);
        return x && (x.includes(q) || q.includes(x));
      }) ||
      S.styles
        .filter(s => {
          const x = nm(s).split(' ');
          return x.length >= 2 && x.every(w => qt.includes(w));
        })
        .sort((a, b) => nm(b).length - nm(a).length)[0] ||
      {}
    ).name || n
  );
}
function bxRecipe(r, file, added) {
  BXO.cur = bxTx(r, 'NAME') || 'Recette importée';
  const name = BXO.cur,
    st = bxOne(r, 'STYLE'),
    est = {
      og: bxNum(r, 'EST_OG'),
      fg: bxNum(r, 'EST_FG'),
      ibu: bxNum(r, 'IBU'),
      ebc: bxNum(r, 'EST_COLOR'),
      abv: bxNum(r, 'EST_ABV')
    };
  const malts = bxKids(bxOne(r, 'FERMENTABLES'), 'FERMENTABLE')
    .map(f => {
      const nm = bxTx(f, 'NAME'),
        y = bxNum(f, 'YIELD') || 0,
        d = bxIng(
          'malts',
          nm,
          { maltier: bxTx(f, 'SUPPLIER'), ebc: bxNum(f, 'COLOR') || 0, potentiel: Math.round(y * 3.846) },
          added
        );
      return { n: d ? labM(d) : nm, g: Math.round((bxNum(f, 'AMOUNT') || 0) * 1000) };
    })
    .filter(x => x.g > 0);
  const hops = bxKids(bxOne(r, 'HOPS'), 'HOP')
    .map(h => {
      const nm = bxTx(h, 'NAME'),
        a = bxNum(h, 'ALPHA') || 0,
        U = bxTx(h, 'USE').toLowerCase(),
        nt = bxTx(h, 'NOTES').toLowerCase(),
        use = /dry/.test(U)
          ? 'Dry hop'
          : /first|mash/.test(U)
            ? 'First Wort'
            : /hop ?stand/.test(nt)
              ? 'Hopstand'
              : /aroma|whirl/.test(U) || /whirl/.test(nt)
                ? 'Whirlpool'
                : 'Ébullition',
        d = bxIng('hops', nm, { alpha_min: a, alpha_max: a }, added);
      return {
        n: d ? d.name : nm,
        g: Math.round((bxNum(h, 'AMOUNT') || 0) * 10000) / 10,
        use,
        t:
          use === 'Dry hop' && (bxNum(h, 'TIME') || 0) >= 1440
            ? Math.round((bxNum(h, 'TIME') || 0) / 1440)
            : Math.round(bxNum(h, 'TIME') || 0)
      };
    })
    .filter(x => x.g > 0);
  const yeasts = bxKids(bxOne(r, 'YEASTS'), 'YEAST').map(y => {
    const nm = bxTx(y, 'NAME'),
      at = bxNum(y, 'ATTENUATION') || 75,
      d = bxIng('yeasts', nm, { labo: bxTx(y, 'LABORATORY'), att_min: at, att_max: at }, added);
    const w = /true/i.test(bxTx(y, 'AMOUNT_IS_WEIGHT')),
      gr = (bxNum(y, 'AMOUNT') || 0) * 1000;
    return { n: d ? d.name : nm, g: w ? Math.max(1, Math.round(gr / 11)) : 1 };
  });
  const ings = bxKids(bxOne(r, 'MISCS'), 'MISC')
    .map(m => {
      const g = bxNum(m, 'AMOUNT') || 0,
        w = /true/i.test(bxTx(m, 'AMOUNT_IS_WEIGHT'));
      return { n: bxTx(m, 'NAME'), g: w ? Math.round(g * 10000) / 10 : Math.round(g * 10000) / 10 };
    })
    .filter(x => x.n);
  if (BXO.noCreate)
    ings.forEach(m => {
      const b = m.n.replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (b && !bxMatch('ings', b) && !find('ings', b)) {
        if (!BXO.unk.includes(b)) BXO.unk.push(b);
        BXO.rec.push({ t: 'ings', n: b, i: '', r: BXO.cur });
      }
    });
  const ms = bxOne(r, 'MASH'),
    steps = bxKids(bxOne(ms, 'MASH_STEPS'), 'MASH_STEP'),
    boil = bxNum(r, 'BOIL_TIME');
  const mash = [
    ...steps.map(s => ({
      k: bxTx(s, 'NAME') || 'Palier',
      t: bxNum(s, 'STEP_TEMP') ?? '',
      m: bxNum(s, 'STEP_TIME') ?? '',
      role: ''
    })),
    { k: MASH[4], t: bxNum(ms, 'SPARGE_TEMP') ?? '', m: '', role: 'rinse' },
    { k: MASH[6], t: 100, m: boil ?? 60, role: 'boil' }
  ];
  const ferm = [
      ['PRIMARY', 'Fermentation primaire'],
      ['SECONDARY', 'Fermentation secondaire'],
      ['TERTIARY', 'Fermentation tertiaire']
    ]
      .map(([k, l]) => {
        const a = bxNum(r, k + '_AGE'),
          t = bxNum(r, k + '_TEMP');
        return a ? l + ' : ' + a + ' j' + (t != null ? ' à ' + t + ' °C' : '') : '';
      })
      .filter(Boolean),
    carb = bxNum(r, 'CARBONATION'),
    notes = [
      bxTx(r, 'NOTES'),
      ms ? bxTx(ms, 'NOTES') : '',
      ferm.join('\n') + (carb ? (ferm.length ? '\n' : '') + 'Carbonatation : ' + carb + ' vol. CO₂' : '')
    ]
      .filter(Boolean)
      .join('\n\n');
  const D = defaults().recipe,
    id = 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    vol = bxNum(r, 'BATCH_SIZE') || 20;
  const R = {
    ...D,
    id,
    name,
    style: bxStyle(st ? bxTx(st, 'NAME') : ''),
    brasseur: bxTx(r, 'BREWER') || bxTx(r, 'ASST_BREWER') || '-',
    date: '',
    ogT: est.og || D.ogT,
    ibuT: est.ibu ? Math.round(est.ibu) : D.ibuT,
    malts,
    hops,
    yeasts,
    ings,
    mash,
    notes,
    imp: 1,
    impd: {
      src: BXO.src || (/^https?:/.test(file) ? 'Brewfather' : 'Beer.xml'),
      file,
      est,
      eff: bxNum(r, 'EFFICIENCY'),
      batch: vol,
      boil: bxNum(r, 'BOIL_SIZE'),
      type: bxTx(r, 'TYPE')
    }
  };
  if (bxNum(r, 'CARBONATION_TEMP') != null) R.tcarbo = bxNum(r, 'CARBONATION_TEMP');
  return { id, name, style: R.style, date: R.date, vol, brasseur: R.brasseur, imp: 1, est, recipe: R };
}
/* décodage selon le prologue XML (ISO-8859-1 pour la plupart des exports) */
async function bxRead(f) {
  const buf = await f.arrayBuffer(),
    head = new TextDecoder('latin1').decode(buf.slice(0, 200)),
    m = /encoding=["']([\w-]+)["']/i.exec(head);
  let enc = ((m && m[1]) || 'utf-8').toLowerCase();
  let s;
  try {
    s = new TextDecoder(enc).decode(buf);
  } catch (e) {
    s = new TextDecoder('utf-8').decode(buf);
  }
  return s.replace(/^﻿/, '');
}
function bxImportTexts(items) {
  const added = {},
    ok = [],
    errs = [],
    unk = [],
    rec = [],
    idx = [];
  for (const it of items) {
    BXO = { noCreate: !!it.noCreate, src: it.src || '', unk: [], rec: [], cur: '' };
    try {
      const doc = new DOMParser().parseFromString(it.text, 'text/xml');
      if (doc.querySelector('parsererror')) throw new Error('XML invalide');
      const rs = [...doc.getElementsByTagName('RECIPE')];
      if (!rs.length) throw new Error('aucune recette (<RECIPE>) trouvée');
      rs.forEach(r => {
        const e = bxRecipe(r, it.name, added),
          i = S.biblio.findIndex(
            x => x.imp && x.name === e.name && (x.brasseur || '') === (e.brasseur || '') && bxSig(x) === bxSig(e)
          );
        if (i >= 0) {
          e.id = S.biblio[i].id;
          e.recipe.id = e.id;
          e.recipe.brasseur = S.biblio[i].brasseur || e.recipe.brasseur;
          e.brasseur = e.recipe.brasseur;
          S.biblio[i] = e;
          idx.push(i);
        } else {
          S.biblio.push(e);
          idx.push(S.biblio.length - 1);
        }
        try {
          const h = { id: e.id, name: e.name, date: e.date, code: withRec(e, () => htmlCode()) },
            j = S.html.findIndex(x => x.id === e.id);
          j >= 0 ? (S.html[j] = h) : S.html.push(h);
        } catch (x) {}
        ok.push(e.name);
      });
    } catch (e) {
      errs.push(it.name + ' : ' + e.message);
    }
    unk.push(...BXO.unk);
    rec.push(...BXO.rec);
  }
  BXO = { noCreate: false, src: '', unk: [], rec: [], cur: '' };
  if (rec.length) bxToFind(rec);
  if (ok.length || rec.length) save();
  return { ok, errs, added, unk: [...new Set(unk)], idx };
}
/* brasseur absent du fichier : une boîte de dialogue le demande (vide / Annuler = laissé vide) et l'insère dans la recette */
/* signature chiffrée d'une recette (volume + toutes les quantités) : une ré-importation identique REMPLACE la recette, une recette différente de même nom est AJOUTÉE (plusieurs recettes peuvent porter le même nom) */
const bxSig = b => {
  const R = b.recipe || {},
    a = [...(R.malts || []), ...(R.ings || []), ...(R.hops || []), ...(R.yeasts || [])]
      .map(x => Math.round((+x.g || 0) * 10) / 10)
      .sort((p, q) => p - q);
  return JSON.stringify([Math.round((+b.vol || 0) * 10) / 10, a]);
};
/* noms de brasseurs déjà présents dans la bibliothèque (+ saisis pendant cet import) pour l'autocomplétion */
const bxBrewerNames = extra => {
  const m = new Map();
  [...S.biblio.map(b => b.brasseur), ...(extra || [])].forEach(n => {
    n = String(n || '').trim();
    if (n && !m.has(n.toLowerCase())) m.set(n.toLowerCase(), n);
  });
  return [...m.values()].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
};
async function bxAskBrewers(items) {
  const known = [];
  for (const it of items) {
    try {
      const doc = new DOMParser().parseFromString(it.text, 'text/xml');
      if (doc.querySelector('parsererror')) continue;
      let ch = 0;
      for (const r of [...doc.getElementsByTagName('RECIPE')]) {
        const kid = n => [...r.children].find(e => e.tagName === n),
          b = kid('BREWER'),
          ab = kid('ASST_BREWER');
        if (((b && b.textContent) || (ab && ab.textContent) || '').trim()) continue;
        const nm = ((kid('NAME') && kid('NAME').textContent) || '').trim() || it.name,
          v = await bcPrompt(
            'Le nom du brasseur n’est pas indiqué dans le fichier pour la recette « ' +
              nm +
              ' ».\nQui l’a brassée ? (laisser vide si inconnu : « - »)',
            {
              title: 'Nom du brasseur',
              ok: 'Valider',
              cancel: 'Passer',
              placeholder: 'Nom du brasseur',
              list: bxBrewerNames(known)
            }
          );
        const nv = (v && v.trim()) || '-';
        {
          let e = b;
          if (!e) {
            e = doc.createElement('BREWER');
            r.insertBefore(e, r.firstChild);
          }
          e.textContent = nv;
          if (nv !== '-') known.push(nv);
          ch = 1;
        }
      }
      if (ch) it.text = new XMLSerializer().serializeToString(doc);
    } catch (e) {}
  }
  return items;
}
/* style absent de la base : boîte de correspondance (choix dans la liste des styles ; vide = style conservé en texte) */
async function bxAskStyles(items) {
  const unk = [],
    seen = new Map(),
    docs = [];
  for (const it of items) {
    try {
      const doc = new DOMParser().parseFromString(it.text, 'text/xml');
      if (doc.querySelector('parsererror')) continue;
      docs.push([it, doc]);
      for (const r of [...doc.getElementsByTagName('RECIPE')]) {
        const st = [...r.children].find(e => e.tagName === 'STYLE'),
          ne = st && [...st.children].find(e => e.tagName === 'NAME'),
          n = ((ne && ne.textContent) || '').trim();
        if (!n || find('styles', bxStyle(n))) continue;
        const rn = ([...r.children].find(e => e.tagName === 'NAME') || {}).textContent || it.name;
        let u = seen.get(bxNorm(n));
        if (!u) {
          u = { t: 'styles', n, rec: [], sug: (bxFind('styles', n) || {}).name || '' };
          seen.set(bxNorm(n), u);
          unk.push(u);
        }
        if (!u.rec.includes(rn)) u.rec.push(rn);
      }
    } catch (e) {}
  }
  if (!unk.length) return items;
  const map =
    (await pdMapDlg(unk, {
      title: 'Style de la recette',
      ok: 'Valider',
      cancel: 'Garder en texte',
      msg:
        unk.length +
        ' style' +
        (unk.length > 1 ? 's' : '') +
        ' de l’import n’existe' +
        (unk.length > 1 ? 'nt' : '') +
        ' pas dans la base.\nChoisissez le style correspondant dans la liste de la base (saisissez quelques lettres pour filtrer). Laissez le champ vide pour conserver le style en texte.'
    })) || {};
  for (const [it, doc] of docs) {
    let ch = 0;
    for (const r of [...doc.getElementsByTagName('RECIPE')]) {
      const st = [...r.children].find(e => e.tagName === 'STYLE'),
        ne = st && [...st.children].find(e => e.tagName === 'NAME'),
        n = ((ne && ne.textContent) || '').trim(),
        v = map['styles|' + n];
      if (v) {
        ne.textContent = v;
        ch = 1;
      }
    }
    if (ch) it.text = new XMLSerializer().serializeToString(doc);
  }
  return items;
}
async function bxImport(files) {
  const items = [],
    errs0 = [];
  for (const f of files) {
    try {
      items.push({ name: f.name, text: await bxRead(f), noCreate: true });
    } catch (e) {
      errs0.push(f.name + ' : ' + e.message);
    }
  }
  await bxAskBrewers(items);
  await bxAskStyles(items);
  const r = bxImportTexts(items);
  r.errs.push(...errs0);
  r.relinked = await bxRelinkAsk(r.idx, 'Import terminé');
  return r;
}
function bxCopy(b) {
  const R = JSON.parse(JSON.stringify(b.recipe));
  R.id = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  R.name = (b.name || 'Sans nom') + ' (copie)';
  delete R.imp;
  delete R.stk;
  R.origine = b.imp
    ? ((R.impd && R.impd.src) || 'Beer.xml') +
      (R.impd && R.impd.file ? ' — ' + R.impd.file : '') +
      (R.brasseur ? ' (' + R.brasseur + ')' : '')
    : 'copie';
  if (b.imp) R.brasseur = 'Moi';
  const had = courList().length;
  S.kv.recipe = R;
  S.kv.equip.vol = b.vol;
  ensureMash();
  upsertRecipe();
  save();
  show('conception');
  courAskReset(had);
}
/* ---------- lecture seule dans l'écran Conception ---------- */
let BXOBS = null;
function bxUnlock() {
  if (BXOBS) {
    BXOBS.disconnect();
    BXOBS = null;
  }
}
function bxLock() {
  bxUnlock();
  const R = S.kv && S.kv.recipe;
  if (!R || !R.imp || typeof main === 'undefined') return;
  const apply = () => {
    if (!main.querySelector('.bxban'))
      main.insertAdjacentHTML(
        'afterbegin',
        `<div class="bxban noprint">🔒 Recette importée de ${(R.impd && R.impd.src) || 'Beer.xml'}${R.brasseur ? ' (' + hh(R.brasseur) + ')' : ''} : <b>lecture seule</b>. Pour la modifier, copiez-la d’abord. <button data-bcopycur="1">📄 Copier pour modifier</button></div>`
      );
    main.querySelectorAll('input,select,textarea,button').forEach(e => {
      if (!e.closest('.bxban') && e.id !== 'newrec') e.disabled = true;
    });
  };
  apply();
  BXOBS = new MutationObserver(apply);
  BXOBS.observe(main, { childList: true, subtree: true });
}
function conception() {
  conception0();
  bxLock();
}
/* ---------- vue « cartes » de la bibliothèque ---------- */
const BXSRM = [
  'FFE699',
  'FFD878',
  'FFCA5A',
  'FFBF42',
  'FBB123',
  'F8A600',
  'F39C00',
  'EA8F00',
  'E58500',
  'DE7C00',
  'D77200',
  'CF6900',
  'CB6200',
  'C35900',
  'BB5100',
  'B54C00',
  'B04500',
  'A63E00',
  'A13700',
  '9B3200',
  '952D00',
  '8E2900',
  '882300',
  '821E00',
  '7B1A00',
  '771900',
  '701400',
  '6A0E00',
  '660D00',
  '5E0B00',
  '5A0A02',
  '600903',
  '520907',
  '4C0505',
  '470606',
  '440607',
  '3F0708',
  '3B0607',
  '3A070B',
  '36080A'
];
const bxColor = ebc => '#' + BXSRM[Math.max(0, Math.min(39, Math.round((+ebc || 0) / 1.97) - 1))];
const bxGlass = c =>
  `<svg viewBox="0 0 46 56" width="46" height="56" aria-hidden="true"><path d="M3 2h40l-4.5 48a4 4 0 0 1-4 3.6H11.5a4 4 0 0 1-4-3.6z" fill="${c}"/><path d="M5.2 8h35.6l-.7 7.5H5.9z" fill="#fff" opacity=".92"/><path d="M12 19l2.4 26" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".55"/><rect x="25" y="6" width="9" height="8" rx="1" fill="${c}" opacity=".0"/></svg>`;
const bxType = s =>
  ({ 'all grain': 'Tout grain', extract: 'Extrait', 'partial mash': 'Brassage partiel' })[
    String(s || '').toLowerCase()
  ] || 'Tout grain';
/* infobulle : liste des malts (kg, %) ou des houblons (g, usage, temps) de la recette */
function bxTip(R, k) {
  const a = (R[k] || []).filter(x => x.n);
  if (!a.length) return k === 'malts' ? 'Aucun malt' : 'Aucun houblon';
  const tot = a.reduce((s, x) => s + (+x.g || 0), 0);
  const l =
    k === 'malts'
      ? a.map(
          x =>
            x.n +
            ' — ' +
            nf((+x.g || 0) / 1000, 3) +
            ' kg' +
            (tot ? ' (' + nf(((+x.g || 0) / tot) * 100, 0) + ' %)' : '')
        )
      : a.map(x => x.n + ' — ' + nf(+x.g || 0, 1) + ' g · ' + tx(x.use || '') + (x.t ? ' ' + x.t + ' min' : ''));
  /* infobulle sur plusieurs lignes : traduite ici, morceau par morceau (le traducteur de la page compare le texte entier) */
  return hh(
    tx(k === 'malts' ? 'Malts (' + nf(tot / 1000, 3) + ' kg)' : 'Houblons (' + nf(tot, 1) + ' g)') + '\n' + l.join('\n')
  ).replace(/\n/g, '&#10;');
}
function bxCards(L, flt) {
  const so = SORT.biblio || { c: 'name', d: 1 },
    opt = [
      ['name', 'Nom'],
      ['brasseur', 'Brasseur'],
      ['embou', 'Réalisé'],
      ['style', 'Style'],
      ['og', 'DI'],
      ['fg', 'DF'],
      ['ibu', 'IBU'],
      ['ebc', 'EBC'],
      ['abv', 'ABV %'],
      ['malts', 'Malts'],
      ['hops', 'Houblons']
    ];
  const bar = `<div class="bsort noprint">Trier par <select id="bsortsel">${opt.map(([k, l]) => `<option value="${k}"${so.c === k ? ' selected' : ''}>${l}</option>`).join('')}</select><button id="bsortdir" title="Inverser l’ordre">${so.d === -1 ? '↓' : '↑'}</button></div>`;
  const card = ({ i, r, c }) => {
    const R = r.recipe || {},
      nm = (R.malts || []).length,
      nh = (R.hops || []).length;
    return `<div class="bcard${r.imp ? ' imp' : ''}" data-bi="${i}" title="${r.imp ? 'Consulter (lecture seule)' : 'Ouvrir dans la conception'}"><div class="bact"><button data-bview="${i}" title="Consulter la recette (lecture seule)">👁</button>${bxNeedRel(r) ? bxRelBtn(i) : ''}${bxOutBtns(i)}<button data-bcopy="${i}" title="Copier la recette (pour la modifier)">📄</button><button class="x" data-bdel="${i}" title="Supprimer">✕</button></div>
 <div class="bglass">${bxGlass(bxColor(c.ebc))}</div><h4>${hh(r.name)}</h4><div class="bs">${hh((r.style || '').replace(/^\d+[A-Za-z]?\s+/, '')) || '&nbsp;'}</div><div class="bs">${bxType(R.impd && R.impd.type)}</div>
 <div class="bs bbr"><input class="bxb" data-bbr="${i}" size="${Math.max(8, String(r.brasseur || '-').length + 1)}" value="${esc(r.brasseur || (r.imp ? '-' : ''))}"${r.imp ? ' readonly tabindex="-1"' : ''} placeholder="+ brasseur" title="${r.imp ? 'Recette importée : non modifiable' : 'Nom du brasseur'}">${R.date ? '<span class="okc" title="Brassé le ' + fd(R.date) + '">✔</span>' : ''}</div>
 <div class="bmeta"><span title="${bxTip(R, 'malts')}">🌾 ${nm}</span><span title="${bxTip(R, 'hops')}">🌿 ${nh}</span><span title="Volume">💧 ${nf(r.vol, 1)} L</span></div>
 <div class="bnum"><div><b>${nf(c.og, 3)}</b><span>DI</span></div><div><b>${nf(c.fg, 3)}</b><span>DF</span></div><div><b>${nf(c.ibu, 0)}</b><span>IBU</span></div><div><b>${nf(c.abv, 1)} %</b><span>Alcool</span></div></div></div>`;
  };
  BXC = { L, n: Math.min(L.length, BXN), card };
  const cards = L.slice(0, BXC.n).map(card).join('');
  return `<div class="bcards">${bar}${flt || ''}<div class="bgrid">${cards || '<div style="padding:18px;color:var(--m)">' + (Object.values(FLT.biblio || {}).some(v => v !== '') ? 'Aucune recette ne correspond aux filtres.' : 'Aucune recette enregistrée.') + '</div>'}</div>${L.length > BXC.n ? '<div id="bsent" class="bsent"></div>' : ''}</div>`;
}
/* vue cartes : les cartes sont ajoutées par lots de BXN au fil du défilement vers le bas */
const BXN = 30;
let BXC = null,
  BXIO = null;
function bxScrollInit() {
  if (BXIO) {
    BXIO.disconnect();
    BXIO = null;
  }
  const s = document.getElementById('bsent');
  if (!s || !BXC || typeof IntersectionObserver === 'undefined') return;
  BXIO = new IntersectionObserver(es => es.some(e => e.isIntersecting) && bxMore(), { rootMargin: '600px' });
  BXIO.observe(s);
}
function bxMore() {
  const g = document.querySelector('.bgrid'),
    s = document.getElementById('bsent');
  if (!g || !s || !BXC) return;
  const e = Math.min(BXC.L.length, BXC.n + BXN);
  g.insertAdjacentHTML('beforeend', BXC.L.slice(BXC.n, e).map(BXC.card).join(''));
  BXC.n = e;
  if (e >= BXC.L.length) {
    s.remove();
    if (BXIO) BXIO.disconnect();
  } else if (BXIO) {
    BXIO.unobserve(s);
    BXIO.observe(s);
  }
}
function bxOpen(b) {
  const had = courList().length /* avant le chargement (la Conception resynchronise la liste) */;
  S.kv.recipe = JSON.parse(JSON.stringify(b.recipe));
  S.kv.recipe.id = b.id;
  S.kv.equip.vol = b.vol;
  ensureMash();
  save();
  show('conception');
  courAskReset(had) /* 6.12.0 : vider et recalculer la liste de courses ? */;
}
document.addEventListener('click', e => {
  const c = e.target.closest && e.target.closest('.bcard');
  if (!c || e.target.closest('input,button,select')) return;
  const b = S.biblio[+c.dataset.bi];
  if (b) bxOpen(b);
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t && t.id === 'bsortsel') {
    SORT.biblio = { c: t.value, d: (SORT.biblio && SORT.biblio.d) || 1 };
    biblio();
  }
});
document.addEventListener('click', e => {
  if (e.target && e.target.id === 'bsortdir') {
    const s = SORT.biblio || { c: 'name', d: 1 };
    SORT.biblio = { c: s.c, d: -s.d };
    biblio();
  }
});
document.addEventListener('change', e => {
  const t = e.target,
    d = t && t.dataset;
  if (d && d.bbr !== undefined && S.biblio) {
    const b = S.biblio[+d.bbr];
    if (!b) return;
    b.brasseur = t.value.trim();
    if (b.recipe) b.recipe.brasseur = b.brasseur;
    if (S.kv.recipe && S.kv.recipe.id === b.id) S.kv.recipe.brasseur = b.brasseur;
    save();
  }
});

/* v3.79.0 – filtre de la bibliothèque (vue liste et vue cartes, même état) */
document.addEventListener('input', e => {
  const el = e.target,
    c = el && el.dataset && el.dataset.bf;
  if (!c) return;
  FLT.biblio = FLT.biblio || {};
  FLT.biblio[c] = el.value;
  const p = el.selectionStart;
  biblio();
  const n = document.querySelector('[data-bf="' + c + '"]');
  if (n) {
    n.focus();
    try {
      n.setSelectionRange(p, p);
    } catch (_) {}
  }
});
document.addEventListener('click', e => {
  if (e.target.closest && e.target.closest('#bfclr')) {
    FLT.biblio = {};
    SORT.biblio = { c: 'name', d: 1 };
    biblio();
  }
});

/* v3.85.0 – relier à la base les ingrédients restés en texte (après import d'un CSV d'ingrédients) */
const bxIngBase = n =>
  String(n)
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
function bxUnres(R) {
  const o = [];
  [
    ['malts', R.malts],
    ['hops', R.hops],
    ['yeasts', R.yeasts]
  ].forEach(([t, a]) =>
    (a || []).forEach(x => {
      if (x.n && !find(t, x.n)) o.push({ t, n: x.n });
    })
  );
  (R.ings || []).forEach(x => {
    const b = bxIngBase(x.n);
    if (b && !bxMatch('ings', b) && !find('ings', b) && !find('conso', b)) o.push({ t: 'ings', n: b });
  });
  return o;
}
/* 6.11.0 : recette importée sans nom de brasseur (vide ou « - ») : le bouton ↻ demande aussi le brasseur */
const bxNoBrewer = b => !!(b && b.imp && !String(b.brasseur || '').replace(/^\s*-\s*$/, '').trim()),
  bxNeedRel = b => !!b && (bxNoBrewer(b) || bxUnres(b.recipe).length > 0);
const bxRelBtn = i => {
  const b = S.biblio[i],
    u = b && bxUnres(b.recipe).length,
    t = bxNoBrewer(b)
      ? u
        ? 'Saisir le nom du brasseur, puis faire la correspondance des ingrédients absents de la base'
        : 'Nom du brasseur absent : le saisir'
      : 'Des ingrédients de cette recette ne sont pas dans la base : faire la correspondance avec les ingrédients de la base';
  return `<button class="pen brel" data-brel="${i}" title="${t}">${ic('rotate')}</button>`;
};
/* demande le nom du brasseur d'une recette importée (même boîte qu'à l'import) ; true si un nom a été saisi */
async function bxAskBrewer(i) {
  const b = S.biblio[i];
  const v = await bcPrompt(
    'Le nom du brasseur n’est pas indiqué pour la recette « ' + b.name + ' ».\nQui l’a brassée ? (laisser vide si inconnu : « - »)',
    { title: 'Nom du brasseur', ok: 'Valider', cancel: 'Passer', placeholder: 'Nom du brasseur', list: bxBrewerNames() }
  );
  const nv = (v && v.trim()) || '';
  if (!nv || nv === '-') return false;
  b.brasseur = nv;
  if (b.recipe) b.recipe.brasseur = nv;
  if (S.kv.recipe && S.kv.recipe.id === b.id) S.kv.recipe.brasseur = nv;
  try {
    const h = { id: b.id, name: b.name, date: b.date, code: withRec(b, () => htmlCode()) },
      j = S.html.findIndex(z => z.id === b.id);
    j >= 0 ? (S.html[j] = h) : S.html.push(h);
  } catch (e) {}
  save();
  return true;
}
/* rapprochement tolérant (noms légèrement différents : ordre des mots, accents, « Malt », « Labs », codes S-04 / S04, Hallertauer / Hallertau…) : un jeu de mots contenu dans l'autre, meilleur score unique */
const BXAL = {
  hallertauer: 'hallertau',
  hallertaur: 'hallertau',
  tettnanger: 'tettnang',
  spalter: 'spalt',
  saazer: 'saaz',
  goldings: 'golding',
  cascades: 'cascade',
  fuggles: 'fuggle',
  flaked: 'flake',
  oats: 'oat'
};
const bxToks = s => {
  let q = String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/(ae|oe|ue)/g, m => m[0])
    .replace(
      /\b(malt|malts|malz|labs?|laboratories|yeast|hops?|pellets?|the|de|du|des|la|le|of|and|et|dried|dry)\b/g,
      ' '
    )
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/([a-z])\s+(\d)/g, '$1$2')
    .trim();
  return [
    ...new Set(
      q
        .split(' ')
        .filter(Boolean)
        .map(w => BXAL[w] || w)
    )
  ];
};
function bxFuzzy(t, name) {
  const A = bxToks(name);
  if (!A.length) return null;
  let best = null,
    bs = 0,
    tie = false;
  for (const x of S[t] || []) {
    const B = bxToks(x.name);
    if (!B.length) continue;
    const it = A.filter(w => B.includes(w)).length;
    if (!it || !(it === A.length || it === B.length)) continue;
    const sc = it / (A.length + B.length - it);
    if (sc < 0.33) continue;
    if (sc > bs) {
      best = x;
      bs = sc;
      tie = false;
    } else if (sc === bs) tie = true;
  }
  return tie ? null : best;
}
const bxFind = (t, n) => bxMatch(t, n) || bxFuzzy(t, n);
/* le nom appartient à la table Consommables (et pas à la table Ingrédients) */
const bxIsCons = v => !find('ings', v) && !!find('conso', v);
function bxRelink(i, map) {
  const b = S.biblio[i];
  if (!b) return 0;
  const R = b.recipe;
  let n = 0;
  const gone = [];
  /* composant choisi dans une autre catégorie : la ligne change de liste (malt, houblon, levure, ingrédient, consommable) */
  if (map) {
    const put = (kind, d, x) => {
      if (kind === 'malts') (R.malts = R.malts || []).push({ n: labM(d), g: x.g });
      else if (kind === 'hops')
        (R.hops = R.hops || []).push({ n: d.name, g: x.g, use: x.use || 'Ébullition', t: x.t != null ? x.t : 60 });
      else if (kind === 'yeasts') (R.yeasts = R.yeasts || []).push({ n: d.name, g: 1 });
      else if (kind === 'conso') (R.conso = R.conso || []).push({ n: d.name, g: 1 });
      else (R.ings = R.ings || []).push({ n: d.name, g: x.g });
    };
    ['malts', 'hops', 'yeasts', 'ings'].forEach(t => {
      const a = R[t] || [];
      for (let k = a.length - 1; k >= 0; k--) {
        const x = a[k],
          nm = t === 'ings' ? bxIngBase(x.n) : x.n,
          v = map['@mv|' + t + '|' + nm];
        if (!v) continue;
        const [kind, name] = [v.slice(0, v.indexOf('|')), v.slice(v.indexOf('|') + 1)],
          d = (S[kind] || []).find(z => z.name === name) || (kind === 'ings' ? { name } : null);
        if (!d) continue;
        a.splice(k, 1);
        put(kind, d, x);
        gone.push([t, nm]);
        if (kind === 'ings' || kind === 'conso') gone.push(['ings', name]);
        else gone.push([kind, name]);
        n++;
      }
    });
  }
  const pick = (t, nm) => {
    if (map) {
      const v = map[t + '|' + nm];
      return v ? (S[t] || []).find(x => x.name === v) || (t === 'ings' && (S.conso || []).find(x => x.name === v)) || null : null;
    }
    return bxFind(t, nm);
  };
  [
    ['malts', d => labM(d)],
    ['hops', d => d.name],
    ['yeasts', d => d.name]
  ].forEach(([t, f]) =>
    (R[t] || []).forEach(x => {
      if (x.n && !find(t, x.n)) {
        const d = pick(t, x.n);
        if (d) {
          gone.push([t, x.n]);
          x.n = f(d);
          n++;
        }
      }
    })
  );
  /* ingrédient relié : à la table Ingrédients (g) ou à la table Consommables (la ligne passe alors dans les consommables, quantité 1) */
  for (let k = (R.ings || []).length - 1; k >= 0; k--) {
    const x = R.ings[k],
      bs = bxIngBase(x.n);
    if (bs && !find('ings', bs) && !find('conso', bs)) {
      const d = pick('ings', bs);
      if (d) {
        gone.push(['ings', bs]);
        x.n = d.name + x.n.slice(bs.length);
        if (bxIsCons(d.name)) {
          R.ings.splice(k, 1);
          (R.conso = R.conso || []).push({ n: x.n, g: 1 });
        }
        n++;
      }
    }
  }
  if (map) {
    const rest = bxUnres(R).map(u => ({ t: u.t, n: u.n, i: '', r: b.name }));
    if (rest.length) bxToFind(rest);
  }
  if (n) {
    try {
      const h = { id: b.id, name: b.name, date: b.date, code: withRec(b, () => htmlCode()) },
        j = S.html.findIndex(z => z.id === b.id);
      j >= 0 ? (S.html[j] = h) : S.html.push(h);
    } catch (e) {}
    if (S.kv.recipe && S.kv.recipe.id === b.id) S.kv.recipe = JSON.parse(JSON.stringify(R));
    const E = S.kv.equip;
    if (E.arech) E.arech = E.arech.filter(y => !gone.some(g => g[0] === y.t && bxNorm(g[1]) === bxNorm(y.n)));
    save();
  } else if (map) save();
  return n;
}
/* boîte de correspondance des ingrédients absents de la base pour une ou plusieurs recettes (indices de S.biblio) ; renvoie le nombre d'ingrédients reliés, ou null si annulé */
async function bxRelinkAsk(idxs, title) {
  const L = [...new Set(idxs || [])].filter(i => S.biblio[i]),
    seen = new Map(),
    unk = [];
  L.forEach(i => {
    const b = S.biblio[i];
    bxUnres(b.recipe).forEach(u => {
      const k = u.t + '|' + u.n;
      let row = seen.get(k);
      if (!row) {
        row = { t: u.t, n: u.n, rec: [], sug: (bxFind(u.t, u.n) || {}).name || '' };
        if (u.t === 'malts') {
          row.ing = pdNotMalt(u.n);
          if (row.ing) row.sug = (bxFind('ings', u.n) || {}).name || '';
        }
        seen.set(k, row);
        unk.push(row);
      }
      if (!row.rec.includes(b.name)) row.rec.push(b.name);
    });
  });
  if (!unk.length) return 0;
  const one = L.length === 1 ? '« ' + S.biblio[L[0]].name + ' »' : L.length + ' recettes';
  const map = await pdMapDlg(unk, {
    title: title === 'Import terminé' ? 'Correspondance des ingrédients' : 'Recharger la recette',
    ok: 'Valider',
    cancel: 'Plus tard',
    cancelNull: 1,
    msg:
      unk.length +
      ' ingrédient' +
      (unk.length > 1 ? 's' : '') +
      ' de ' +
      one +
      ' ne figure' +
      (unk.length > 1 ? 'nt' : '') +
      ' pas dans la base sous ce nom.\nPour chacun, choisissez l’ingrédient correspondant dans la liste (saisissez quelques lettres pour filtrer), ou n’importe quel autre composant de la base (malt, houblon, levure, ingrédient, consommable). Laissez le champ vide si l’ingrédient n’existe pas : il restera en texte et sera ajouté à la liste « À rechercher » (Paramètres) ; l’icône ↻ de la recette permettra de refaire la correspondance plus tard.'
  });
  if (!map) return null;
  let n = 0;
  L.forEach(i => {
    n += bxRelink(i, map);
  });
  return n;
}
document.addEventListener(
  'click',
  async e => {
    const t = e.target.closest && e.target.closest('[data-brel]');
    if (!t) return;
    e.stopPropagation();
    const i = +t.dataset.brel,
      b = S.biblio[i];
    if (!b) return;
    const br = bxNoBrewer(b) ? await bxAskBrewer(i) : false;
    if (!bxUnres(b.recipe).length) {
      biblio();
      if (br) notify('bbr', '✔ Brasseur de « ' + b.name + ' » : ' + b.brasseur, 'ok');
      return;
    }
    const n = await bxRelinkAsk([i]);
    if (n === null) {
      if (br) {
        biblio() /* brasseur saisi, correspondance remise à plus tard : la ligne affiche le nouveau nom */;
        notify('bbr', '✔ Brasseur de « ' + b.name + ' » : ' + b.brasseur, 'ok');
      }
      return;
    }
    const rest = bxUnres(b.recipe);
    biblio();
    const m = document.getElementById('hmsg');
    if (m) {
      m.className = n ? 'ok' : 'err';
      m.textContent = n
        ? '✔ « ' +
          b.name +
          ' » rechargée : ' +
          n +
          ' ingrédient(s) relié(s) à la base' +
          (rest.length ? ' — encore absent(s) : ' + [...new Set(rest.map(x => x.n))].join(', ') : '')
        : 'Aucune correspondance saisie : ' +
          [...new Set(rest.map(x => x.n))].join(', ') +
          ' reste(nt) à rechercher (Paramètres › À rechercher).';
    }
  },
  true
);
/* 6.12.0 : boutons PDF et export beer.xml d'une recette (liste et cartes) */
const bxOutBtns = i =>
  `<button class="pen" data-bpdf="${i}" title="Créer le PDF de la recette">${ic('pdf')}</button><button class="pen" data-bxml="${i}" title="Exporter la recette au format beer.xml">${ic('fexport')}</button>`;
/* 6.12.0 : export d'une recette de la bibliothèque au format BeerXML 1.0 (fichier <nom>.xml, relisible par l'import) */
function bxXml(b) {
  const R = b.recipe || {},
    E = S.kv.equip,
    x = v =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;'),
    n = (v, d) => {
      const f = +v;
      return isFinite(f) ? +f.toFixed(d ?? 4) : 0;
    },
    tag = (k, v) => `<${k}>${x(v)}</${k}>`,
    c = (() => {
      let r = { og: 1, fg: 1, ibu: 0, ebc: 0, abv: 0 };
      try {
        withRec(b, () => (r = compute()));
      } catch (e) {}
      return r;
    })(),
    mash = R.mash || [],
    boil = mash.find(m => m.role === 'boil'),
    rinse = mash.find(m => m.role === 'rinse'),
    srm = e => n((+e || 0) / 1.97, 1),
    HU = { 'Dry hop': 'Dry Hop', 'First Wort': 'First Wort', Whirlpool: 'Aroma', Hopstand: 'Aroma' };
  const ferm = (R.malts || [])
    .map(m => {
      const d = find('malts', m.n) || {};
      return `<FERMENTABLE>${tag('NAME', d.name || m.n)}<VERSION>1</VERSION><TYPE>Grain</TYPE>${tag('AMOUNT', n((+m.g || 0) / 1000))}${tag('YIELD', n((+d.potentiel || 0) / 3.846, 1))}${tag('COLOR', srm(d.ebc))}${d.maltier ? tag('SUPPLIER', d.maltier) : ''}</FERMENTABLE>`;
    })
    .join('');
  const hops = (R.hops || [])
    .map(h => {
      const d = find('hops', h.n) || {},
        a = d.alpha_min != null ? ((+d.alpha_min || 0) + (+d.alpha_max || 0)) / 2 : 0,
        use = HU[h.use] || 'Boil',
        t = use === 'Dry Hop' ? (+h.t || 0) * 1440 : +h.t || 0;
      return `<HOP>${tag('NAME', d.name || h.n)}<VERSION>1</VERSION>${tag('ALPHA', n(a, 2))}${tag('AMOUNT', n((+h.g || 0) / 1000, 5))}${tag('USE', use)}${tag('TIME', n(t, 1))}${h.use === 'Hopstand' ? tag('NOTES', 'Hop stand') : h.use === 'Whirlpool' ? tag('NOTES', 'Whirlpool') : ''}</HOP>`;
    })
    .join('');
  const yeasts = (R.yeasts || [])
    .map(y => {
      const d = find('yeasts', y.n) || {},
        at = d.att_min != null ? ((+d.att_min || 0) + (+d.att_max || 0)) / 2 : '';
      return `<YEAST>${tag('NAME', d.name || y.n)}<VERSION>1</VERSION><TYPE>Ale</TYPE><FORM>Dry</FORM>${tag('AMOUNT', n((+y.g || 1) * 0.011, 3))}<AMOUNT_IS_WEIGHT>TRUE</AMOUNT_IS_WEIGHT>${d.labo ? tag('LABORATORY', d.labo) : ''}${at !== '' ? tag('ATTENUATION', n(at, 1)) : ''}</YEAST>`;
    })
    .join('');
  const miscs = (R.ings || [])
    .map(
      m =>
        `<MISC>${tag('NAME', m.n)}<VERSION>1</VERSION><TYPE>Other</TYPE><USE>Boil</USE><TIME>0</TIME>${tag('AMOUNT', n((+m.g || 0) / 1000, 5))}<AMOUNT_IS_WEIGHT>TRUE</AMOUNT_IS_WEIGHT></MISC>`
    )
    .join('');
  const steps = mash
    .filter(m => !m.role && (m.t !== '' || m.m !== ''))
    .map(
      m =>
        `<MASH_STEP>${tag('NAME', m.k || 'Palier')}<VERSION>1</VERSION><TYPE>Infusion</TYPE>${tag('STEP_TEMP', n(m.t, 1))}${tag('STEP_TIME', n(m.m, 0))}</MASH_STEP>`
    )
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<RECIPES><RECIPE>' +
    tag('NAME', b.name || R.name || 'Recette') +
    '<VERSION>1</VERSION><TYPE>All Grain</TYPE>' +
    tag('BREWER', b.brasseur || R.brasseur || '-') +
    `<STYLE>${tag('NAME', b.style || R.style || '')}<VERSION>1</VERSION><STYLE_GUIDE>BJCP 2021</STYLE_GUIDE><TYPE>Ale</TYPE></STYLE>` +
    tag('BATCH_SIZE', n(b.vol || E.vol, 2)) +
    tag('BOIL_TIME', n(boil ? boil.m : 60, 0)) +
    tag('EFFICIENCY', n(E.eff, 1)) +
    `<HOPS>${hops}</HOPS><FERMENTABLES>${ferm}</FERMENTABLES><MISCS>${miscs}</MISCS><YEASTS>${yeasts}</YEASTS><WATERS></WATERS>` +
    `<MASH><NAME>Empâtage</NAME><VERSION>1</VERSION><GRAIN_TEMP>20</GRAIN_TEMP>${rinse && rinse.t !== '' ? tag('SPARGE_TEMP', n(rinse.t, 1)) : ''}<MASH_STEPS>${steps}</MASH_STEPS></MASH>` +
    tag('EST_OG', n(c.og, 3)) +
    tag('EST_FG', n(c.fg, 3)) +
    tag('EST_COLOR', srm(c.ebc)) +
    tag('IBU', n(c.ibu, 1)) +
    tag('EST_ABV', n(c.abv, 1)) +
    tag('DISPLAY_COLOR', n(c.ebc, 0) + ' EBC') +
    (R.notes ? tag('NOTES', R.notes) : '') +
    '</RECIPE></RECIPES>\n'
  );
}
/* nom de fichier sûr pour une recette (sans / \ : * ? " < > |) */
const bxFileName = (b, ext) =>
  (String(b.name || 'recette').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim() || 'recette') + ext;
function bxDownload(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function bxExportOne(i) {
  const b = S.biblio[i];
  if (!b) return;
  const f = bxFileName(b, '.xml');
  bxDownload(new Blob([bxXml(b)], { type: 'application/xml' }), f);
  notify('bxexp', '✔ Recette exportée : ' + f, 'ok');
}
/* 6.12.0 : recette en PDF = feuille de brassage au visuel « Classique » (couleurs par défaut), page autonome :
   feuille de style de l'application, polices de la feuille (Inter, Anton, Oswald, Bangers) intégrées depuis la base, icônes
   déjà dessinées ; PDF produit par le serveur avec le moteur du navigateur */
const BX_PDF_FAMS = ['Inter', 'LF Anton', 'LF Oswald', 'LF Bangers'];
function bxPdfFonts() {
  const E = S.kv.equip,
    seen = new Set(),
    out = [];
  (E.fonts || []).forEach(u =>
    lblFontFams(u.n).forEach(fam => {
      if (!BX_PDF_FAMS.includes(fam) || seen.has(fam) || !u.d) return;
      seen.add(fam);
      out.push(`@font-face{font-family:'${fam}';src:url(${u.d});font-weight:100 900;font-style:normal}`);
    })
  );
  return out.join('\n');
}
function bxPdfDoc(b) {
  const h = s =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;'),
    box = document.createElement('div');
  box.innerHTML = withRec(b, () => sheetPages(sheetData(), 'classique'));
  if (typeof icoTree === 'function') icoTree(box) /* caractères ✔ 🍺… → icônes, comme à l'écran */;
  box.querySelectorAll('input, textarea').forEach(x => {
    if (x.tagName === 'TEXTAREA') x.textContent = x.value;
    else x.setAttribute('value', x.value);
  });
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${h(b.name)}</title><link rel="stylesheet" href="/css/openmaltforge.css"><style>
${bxPdfFonts()}
@page{size:A4 portrait;margin:0}
html,body{margin:0;padding:0;background:#fff!important}
.shwrap{display:block!important;padding:0!important;zoom:1!important}
.shpage{box-shadow:none!important;margin:0}
</style></head><body><div class="shwrap" style="--ac:${SHDEF.acc}">${box.innerHTML}</div></body></html>`;
}
async function bxPdfOne(i, btn) {
  const b = S.biblio[i];
  if (!b) return;
  if (btn) btn.disabled = true;
  try {
    const r = await api('api/pdf', {
      method: 'POST',
      headers: { 'X-OpenMaltForge': '1', 'Content-Type': 'text/html; charset=utf-8' },
      body: bxPdfDoc(b)
    });
    const f = bxFileName(b, '.pdf');
    bxDownload(await r.blob(), f);
    notify('bxpdf', '✔ PDF créé : ' + f, 'ok');
  } catch (e) {
    notify('bxpdf', '⚠ PDF impossible : ' + ((e && e.message) || e), 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}
document.addEventListener(
  'click',
  e => {
    const t = e.target.closest && e.target.closest('[data-bpdf],[data-bxml]');
    if (!t) return;
    e.stopPropagation();
    if (t.dataset.bpdf !== undefined) bxPdfOne(+t.dataset.bpdf, t);
    else bxExportOne(+t.dataset.bxml);
  },
  true
);
