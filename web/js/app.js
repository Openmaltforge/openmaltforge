const $ = s => document.querySelector(s),
  main = $('#main');
const MA =
  'cereale biscuit malte caramel chocolat sucre fruits_secs cafe toaste raisin vanille miel acide amer fume'.split(' ');
const HA = 'citrus tropical_fruit stone_fruit berry floral grassy herbal spice resin_pin'.split(' ');
const YA = 'fruits_tropicaux banane pomme_verte clou_girofle acide poivre alcoolise neutre pomme_rouge'.split(' ');
const COLS = {
  malts: ['name', 'maltier', 'ebc', 'potentiel', 'ppg', 'b46', ...MA, 'prix_kg', 'stock'],
  hops: ['name', 'alpha_min', 'alpha_max', ...HA, 'prix_g', 'stock'],
  yeasts: ['name', 'labo', 'att_min', 'att_max', 'floc_min', 'floc_max', 't_min', 't_max', ...YA, 'prix_sachet', 'stock'],
  styles: [
    'name',
    'overall_impression',
    'appearance',
    'aroma',
    'flavor',
    'mouthfeel',
    'comments',
    'history',
    'characteristic_ingredients',
    'style_comparison',
    'ibu_min',
    'ibu_max',
    'srm_min',
    'srm_max',
    'og_min',
    'og_max',
    'fg_min',
    'fg_max',
    'abv_min',
    'abv_max',
    'commercial_examples',
    'ca_min',
    'ca_max',
    'mg_min',
    'mg_max',
    'na_min',
    'na_max',
    'cl_min',
    'cl_max',
    'so4_min',
    'so4_max',
    'hco3_min',
    'hco3_max',
    'so4cl_min',
    'so4cl_max'
  ],
  eaux: ['name', 'type', 'cl', 'so4', 'ca', 'mg', 'na', 'hco3', 'prix_l', 'stock'],
  ings: ['name', 'type', 'dose_g_L', 'usage', 'prix_g', 'stock'],
  conso: ['name', 'unite', 'prix', 'stock']
};
/* colonnes de base (sans « stock », absent des fichiers de référence et des CSV d'exemple) */
const CB = t => COLS[t].filter(c => c !== 'stock');
/* unité du stock (le stock d'une recette est déduit dans cette unité) */
const STU = { malts: '(kg)', hops: '(g)', yeasts: '(sachets)', ings: '(g)', conso: '(unités)', eaux: '(L)' };
const TITLES = {
    malts: 'Malts',
    hops: 'Houblons',
    yeasts: 'Levures',
    styles: 'Styles BJCP 2021',
    ings: 'Ingrédients',
    conso: 'Consommables',
    eaux: 'Eaux'
  },
  TXT = [
    'name',
    'unite',
    'maltier',
    'labo',
    'ppg',
    'b46',
    'type',
    'usage',
    'overall_impression',
    'appearance',
    'aroma',
    'flavor',
    'mouthfeel',
    'comments',
    'history',
    'characteristic_ingredients',
    'style_comparison',
    'commercial_examples'
  ];
const HFR = {
  citrus: 'agrumes',
  tropical_fruit: 'fruits tropicaux',
  stone_fruit: 'fruits à noyau',
  berry: 'fruits rouges',
  floral: 'floral',
  grassy: 'herbacé frais',
  herbal: 'herbal',
  spice: 'épicé',
  resin_pin: 'résine / pin',
  alpha_min: 'alpha mini',
  alpha_max: 'alpha maxi',
  /* 6.6.0 : arômes des malts et des levures, accentués à l'affichage (radars, en-têtes) ; les clés en base ne changent pas */
  cereale: 'céréale',
  malte: 'malté',
  cafe: 'café',
  toaste: 'toasté',
  fume: 'fumé',
  alcoolise: 'alcoolisé'
};
const EIL = { cl: 'Cl', so4: 'SO4', ca: 'Ca', mg: 'Mg', na: 'Na', hco3: 'HCO3', so4cl: 'Ratio SO4/Cl' },
  IONS = ['cl', 'so4', 'ca', 'mg', 'na', 'hco3'],
  IONR = [...IONS, 'so4cl'];
const USES = ['First Wort', 'Ébullition', 'Whirlpool', 'Hopstand', 'Dry hop'];
let S = {};
const esc = s => String(s ?? '').replace(/"/g, '&quot;');
const labM = x => (x.maltier ? `${x.name} (${x.maltier})` : x.name),
  lab = (t, x) => (t === 'malts' ? labM(x) : x.name);
const find = (t, n) => {
  const q = String(n).trim().toLowerCase();
  return S[t].find(x => lab(t, x).toLowerCase() === q) || S[t].find(x => String(x.name).toLowerCase() === q);
};
const num = v => (v !== '' && !isNaN(v) ? +v : v);
const pseed = t => parse(SEED[t], t === 'styles' ? COLS.styles.slice(0, 21) : CB(t));
function parse(txt, cols) {
  return txt
    .trim()
    .split('\n')
    .map(l => {
      let a = l.split('|');
      if (a.length < cols.length) a = a.concat(a.pop().split(','));
      const o = {};
      cols.forEach((c, i) => (o[c] = num(a[i])));
      return o;
    });
}
const TABLES = [...Object.keys(COLS), 'eau', 'elec', 'consl', 'proc', 'biblio', 'html'];
const AR = [...MA, ...HA, ...YA];
let MIG = false;
const EAUTO = [
  ['init', 'Chauffe initiale', 1],
  ['pal', 'Paliers d’empâtage', 0],
  ['ramp', 'Montée en température entre-paliers', 1],
  ['mo', 'Mashout', 0],
  ['boil', 'Ébullition', 1],
  ['rinse', 'Chauffe eau de rinçage', 1]
];
/* Paramètres › Unités : choix de l'utilisateur (Métrique / Imperial / US). Chaque ligne = [clé, libellé, icône, choix (segmenté si ≤ 2)] */
const UROWS = [
  ['dens', 'Affichage de la densité', 'droplet', ['SG (1.XXX)', 'Plato (°P)', 'Brix (°Bx)']],
  ['densin', 'Saisie de la densité', 'login', ['SG (1.XXX)', 'Plato (°P)', 'Brix (°Bx)']],
  ['col', 'Couleur par défaut', 'beer', ['EBC', 'SRM']],
  ['grain', 'Couleur du grain', 'wheat', ['Valeur par défaut', 'EBC', 'SRM', '°Lovibond']],
  ['temp', 'Température', 'thermometer', ['°F', '°C']],
  ['vol', 'Volume', 'beaker', ['Litre', 'Gallon US', 'Gallon impérial']],
  ['poids', 'Poids', 'weight', ['KG', 'Livre (lb)']],
  ['hop', 'Houblon', 'scale', ['Gramme', 'Once (oz)']],
  ['carbo', 'Carbonatation', 'beer', ['CO2-vol', 'g/L']],
  ['pres', 'Pression', 'gauge', ['Bar', 'PSI', 'kPa']],
  ['alt', 'Altitude', 'mountain', ['Mètres', 'Pieds']],
  ['dia', 'Pouvoir diastatique', 'wheat', ['°Lintner', '°WK']]
];
const UPRE = {
  metric: { dens: 'SG (1.XXX)', densin: 'SG (1.XXX)', col: 'EBC', grain: 'Valeur par défaut', temp: '°C', vol: 'Litre', poids: 'KG', hop: 'Gramme', carbo: 'CO2-vol', pres: 'Bar', alt: 'Mètres', dia: '°Lintner' },
  imperial: { dens: 'SG (1.XXX)', densin: 'SG (1.XXX)', col: 'SRM', grain: 'Valeur par défaut', temp: '°F', vol: 'Gallon impérial', poids: 'Livre (lb)', hop: 'Once (oz)', carbo: 'CO2-vol', pres: 'PSI', alt: 'Pieds', dia: '°Lintner' },
  us: { dens: 'SG (1.XXX)', densin: 'SG (1.XXX)', col: 'SRM', grain: 'Valeur par défaut', temp: '°F', vol: 'Gallon US', poids: 'Livre (lb)', hop: 'Once (oz)', carbo: 'CO2-vol', pres: 'PSI', alt: 'Pieds', dia: '°Lintner' }
};
const UNAMES = [
  ['metric', 'Métrique'],
  ['imperial', 'Imperial'],
  ['us', 'US']
];
const uSys = () => {
  const u = S.kv.equip.units || {};
  return (UNAMES.find(([k]) => UROWS.every(([r]) => u[r] === UPRE[k][r])) || [''])[0];
};
/* section Unités : désactivée (grisée, champs non modifiables) en attendant son développement */
let UNITS_LOCKED = true;
const unitsPanel = () => {
  const u = S.kv.equip.units || UPRE.metric,
    sys = uSys(),
    lk = UNITS_LOCKED ? ' disabled' : '';
  return `<div class="panel${UNITS_LOCKED ? ' lock' : ''}" id="unitsp"${UNITS_LOCKED ? ' inert aria-disabled="true" title="Section en cours de développement"' : ''}><h3>Unités<span class="useg">${UNAMES.map(([k, n]) => `<button${lk} data-usys="${k}"${k === sys ? ' class="on"' : ''}>${n}</button>`).join('')}</span></h3>${UROWS.map(([k, l, i, o]) => `<div class="urow"><span class="uic">${ic(i)}</span><span class="ul">${l}</span>${o.length <= 2 ? `<span class="useg">${o.map(v => `<button${lk} data-ukb="${k}" data-uv="${esc(v)}"${u[k] === v ? ' class="on"' : ''}>${v}</button>`).join('')}</span>` : `<select${lk} data-uk="${k}">${o.map(v => `<option${u[k] === v ? ' selected' : ''}>${v}</option>`).join('')}</select>`}</div>`).join('')}<small class="un-n">Préférences d’unités enregistrées dans la base.</small></div>`;
};
const unitsRefresh = () => {
  const p = document.getElementById('unitsp');
  if (p) p.outerHTML = unitsPanel();
};
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-usys],[data-ukb]');
  if (!b || !S.kv || UNITS_LOCKED) return;
  const E = S.kv.equip;
  if (b.dataset.usys) E.units = { ...UPRE[b.dataset.usys] };
  else E.units = { ...E.units, [b.dataset.ukb]: b.dataset.uv };
  unitsRefresh();
  save();
});
document.addEventListener('change', e => {
  const t = e.target;
  if (!t || !t.dataset || !t.dataset.uk || !S.kv || UNITS_LOCKED) return;
  S.kv.equip.units = { ...S.kv.equip.units, [t.dataset.uk]: t.value };
  unitsRefresh();
  save();
});
/* lignes « système » de la table consommables : prix du kWh et du m³ d'eau (modifiables, non supprimables) */
const SYSC = { kwh: { name: 'Électricité', unite: 'kWh', old: 'prix_kwh', def: 0.2 }, m3: { name: 'Eau', unite: 'm³', old: 'prix_m3', def: 4 } };
const sysPrix = k => {
  const o = (S.conso || []).find(x => x.sys === k);
  return o ? +o.prix || 0 : SYSC[k].def;
};
function ensureSysConso() {
  const E = S.kv.equip;
  let n = 0;
  Object.entries(SYSC).forEach(([k, c]) => {
    if ((S.conso || []).some(x => x.sys === k)) return;
    const o = { name: c.name, unite: c.unite, prix: +E[c.old] || c.def, stock: 0, sys: k },
      j = S.conso.findIndex(x => String(x.name).toLowerCase() === c.name.toLowerCase());
    j >= 0 ? (S.conso[j] = { ...S.conso[j], sys: k, unite: S.conso[j].unite || c.unite }) : S.conso.unshift(o);
    n++;
  });
  return n;
}
const defaults = () => ({
  equip: {
    vol: 30,
    volD: 30,
    boilD: 60,
    eff: 75,
    evap: 3,
    ratio: 3,
    ratioD: 3,
    units: { ...UPRE.metric },
    t0: 12,
    chauffe: 1.5,
    refroid: 2,
    abs: 1,
    prix_kwh: 0.2,
    prix_m3: 4,
    autoOn: true,
    autoMin: 5,
    ogT: 1.06,
    ibuT: 40,
    name: 'BrewMonk B50',
    coef: { 'First Wort': 1.1, Ébullition: 1, Whirlpool: 0.4, Hopstand: 0.3, 'Dry hop': 0 }
  },
  recipe: {
    brasseur: 'Moi',
    water: [{ n: 'Épernay', p: 100 }],
    minadd: {},
    sucre: 7,
    tcarbo: 20,
    name: 'Nouvelle recette',
    style: '21A American IPA',
    ogT: 1.06,
    ibuT: 40,
    date: new Date().toISOString().slice(0, 10),
    malts: [{ n: 'Pilsen', g: 6000 }],
    hops: [{ n: 'Magnum', g: 30, use: 'Ébullition', t: 60 }],
    yeasts: [{ n: 'SafAle US-05', g: 2 }],
    ings: []
  }
});
function fill(t) {
  S[t].forEach(o => {
    if (t === 'malts' && o.prix_g !== undefined) {
      if (!o.prix_kg) o.prix_kg = +((+o.prix_g || 0) * 1000).toFixed(4);
      delete o.prix_g;
    }
    (COLS[t] || []).forEach(c => {
      if (o[c] === undefined) o[c] = TXT.includes(c) ? '' : 0;
      if (/^prix/.test(c) && (o[c] === '' || o[c] === null || o[c] !== o[c])) o[c] = 0;
    });
    if (t === 'ings' && o.prix_kg !== undefined) {
      if (!o.prix_g) o.prix_g = +(o.prix_kg / 1000) || 0;
      delete o.prix_kg;
    }
  });
}
function migrate() {
  const D = defaults(),
    oldLoss = +((S.kv && S.kv.equip) || {}).loss;
  S.kv = S.kv || {};
  S.kv.equip = { ...D.equip, ...S.kv.equip };
  S.kv.equip.coef = { ...D.equip.coef, ...(S.kv.equip.coef || {}) };
  S.kv.equip.units = { ...UPRE.metric, ...(S.kv.equip.units || {}) };
  S.kv.recipe = { ...D.recipe, ...S.kv.recipe };
  if (!S.kv.equip.vb1) {
    /* volume à embouteiller / durée d'ébullition par défaut : reprennent les valeurs actuelles */
    S.kv.equip.volD = +S.kv.equip.vol || D.equip.volD;
    S.kv.equip.boilD = +S.kv.equip.boil || D.equip.boilD;
    delete S.kv.equip.boil;
    S.kv.equip.vb1 = 1;
  }
  if (!S.kv.equip.tgt1) {
    /* DI / IBU par défaut : reprend la cible de la recette en cours */
    S.kv.equip.ogT = +S.kv.recipe.ogT || D.equip.ogT;
    S.kv.equip.ibuT = +S.kv.recipe.ibuT || D.equip.ibuT;
    S.kv.equip.tgt1 = 1;
  }
  if (!S.kv.equip.rat1) {
    /* ratio d'empâtage par défaut : reprend le ratio actuel */
    S.kv.equip.ratioD = +S.kv.equip.ratio || D.equip.ratioD;
    S.kv.equip.rat1 = 1;
  }
  if (!S.kv.equip.clean1) {
    /* nettoyage : paramètres d'équipement qui n'étaient plus lus nulle part */
    delete S.kv.equip.mashT;
    delete S.kv.equip.mashMin;
    delete S.kv.equip.consum;
    S.kv.equip.clean1 = 1;
  }
  if (!S.kv.equip.auto5) {
    /* sauvegarde automatique : 5 minutes par défaut ; équipement par défaut : BrewMonk B50 (si le nom est vide) */
    S.kv.equip.autoMin = 5;
    if (!String(S.kv.equip.name || '').trim()) S.kv.equip.name = 'BrewMonk B50';
    S.kv.equip.auto5 = 1;
  }
  const AK = { malts: MA, hops: HA, yeasts: YA },
    half = t =>
      S[t].forEach(o =>
        AK[t].forEach(k => {
          if (o[k] !== undefined && o[k] !== '') o[k] = +((+o[k] || 0) / 2).toFixed(1);
        })
      ),
    fresh = [];
  for (const t in COLS) {
    if (!S[t] || (!S[t].length && ['malts', 'hops', 'yeasts', 'styles'].includes(t))) {
      S[t] = pseed(t);
      fresh.push(t);
    }
    fill(t);
  }
  if (!S.kv.equip.scale5) {
    for (const t in AK) if (!fresh.includes(t)) half(t);
    S.kv.equip.scale5 = 1;
    MIG = true;
  }
  fresh.forEach(t => {
    if (AK[t]) half(t);
  });
  /* Base existante (ancienne) : on ajoute UNE fois les ingrédients de référence (brewpark / autobrasseur) qu'elle ne contient pas, sans rien modifier ni supprimer */
  if (!S.kv.equip.seed3) {
    for (const t in AK)
      if (!fresh.includes(t)) {
        const add = parse(SEED[t], CB(t)).filter(o => !find(t, lab(t, o)));
        add.forEach(o =>
          AK[t].forEach(k => {
            o[k] = +((+o[k] || 0) / 2).toFixed(1);
          })
        );
        S[t].push(...add);
        fill(t);
      }
    S.kv.equip.seed3 = 1;
    MIG = true;
  }
  if (typeof CAT !== 'undefined') {
    const E = S.kv.equip,
      dn = E.catd || (E.catd = E.cat1 ? { hops: 1 } : {});
    for (const t in CAT)
      if (!dn[t]) {
        const add = parse(CAT[t], CB(t)).filter(o => !find(t, lab(t, o)));
        S[t].push(...add);
        fill(t);
        dn[t] = 1;
        MIG = true;
      }
  }
  /* Styles : nouvelle base BJCP 2021 complète (remplace l'ancienne liste de départ, une seule fois) */
  if (!S.kv.equip.bjcp21) {
    if (!fresh.includes('styles')) {
      S.styles = pseed('styles');
      fill('styles');
    }
    S.kv.equip.bjcp21 = 1;
    MIG = true;
  }
  /* Eaux : profils d'eau par style (mini / maxi, mg/L) et minéraux dans les consommables, une seule fois */
  if (!S.kv.equip.eper1) {
    if (!S.eaux.some(x => x.name === 'Épernay'))
      S.eaux.push(parse('Épernay|ville|16.6|21.7|95|4.5|6.1|266', COLS.eaux)[0]);
    if (!(S.kv.recipe.water || []).length) S.kv.recipe.water = [{ n: 'Épernay', p: 100 }];
    S.kv.equip.eper1 = 1;
    MIG = true;
  }
  if (!S.kv.equip.ratio1) {
    S.styles.forEach(o => {
      const nm = String(o.name),
        r =
          (nm.includes(':') && WRATN[nm.split(':').pop().trim().toLowerCase()]) ?? WRAT[nm.split(' ')[0].toUpperCase()];
      if (r !== undefined) {
        o.so4cl_min = r;
        o.so4cl_max = r;
      } else {
        if (o.so4cl_min === undefined) o.so4cl_min = '';
        if (o.so4cl_max === undefined) o.so4cl_max = '';
      }
    });
    S.kv.equip.ratio1 = 1;
    MIG = true;
  }
  if (!S.kv.equip.water1) {
    S.styles.forEach(o => {
      const nm = String(o.name),
        w =
          (nm.includes(':') && WSTYN[nm.split(':').pop().trim().toLowerCase()]) || WSTY[nm.split(' ')[0].toUpperCase()];
      if (w)
        ['ca', 'mg', 'na', 'cl', 'so4', 'hco3'].forEach((k, i) => {
          o[k + '_min'] = w[2 * i];
          o[k + '_max'] = w[2 * i + 1];
        });
    });
    S.kv.equip.water1 = 1;
    MIG = true;
  }
  /* minéraux : retirés des consommables et placés dans les ingrédients (le prix saisi est conservé) */
  if (!S.kv.equip.minI1) {
    WMINS.forEach(l => {
      const o = parse(l, COLS.ings)[0],
        k = S.conso.findIndex(x => x.name === o.name);
      if (k >= 0) {
        o.prix_g = S.conso[k].prix === '' || S.conso[k].prix == null ? o.prix_g : S.conso[k].prix;
        S.conso.splice(k, 1);
      }
      if (!S.ings.some(x => x.name === o.name)) S.ings.push(o);
    });
    S.kv.equip.minI1 = 1;
    MIG = true;
  }
  S.biblio = S.biblio || [];
  S.biblio.forEach(b => {
    if (!b.imp && b.brasseur === undefined) {
      b.brasseur = 'Moi';
      if (b.recipe) b.recipe.brasseur = 'Moi';
    }
  });
  S.consl = S.consl || [];
  S.eau = S.eau || [{ name: 'Eau de brassage', l: 40 }];
  S.elec = S.elec || [{ name: 'Chauffe cuve', kw: 3, h: 2 }];
  S.proc = S.proc || [
    { name: 'Fond de cuve / trub', ph: 'Après ébullition', type: 'Perte', l: oldLoss >= 0 ? oldLoss : 1.5 },
    { name: 'Espace mort (cuve d’empâtage)', ph: 'Empâtage / Rinçage', type: 'Perte', l: 0 }
  ];
  S.html = S.html || [];
  if (!S.licence || !S.licence.texte) {
    S.licence = { ...LICENCE_SEED };
    MIG = true;
  }
  if (ensureSysConso()) MIG = true;
  ensureMash();
  if (!S.kv.equip.elec2) {
    const old = S.elec.filter(l => !l.auto),
      def = old.length === 1 && old[0].name === 'Chauffe cuve' && +old[0].kw === 3 && +old[0].h === 2,
      kw = +(old[0] || {}).kw || 3;
    S.elec = [
      ...EAUTO.map(([a, n, h]) => ({ name: n, kw: h ? kw : 0, min: 0, auto: a })),
      ...(def ? [] : old.map(l => ({ name: l.name, kw: l.kw, min: Math.round((+l.h || 0) * 600) / 10 })))
    ];
    S.kv.equip.elec2 = 1;
    MIG = true;
  }
  if (!S.kv.equip.elec3) {
    S.elec.forEach(l => {
      if (l.w === undefined) {
        l.w = Math.round((+l.kw || 0) * 1000);
        delete l.kw;
      }
    });
    S.kv.equip.elec3 = 1;
    MIG = true;
  }
  if (!S.kv.equip.elec6) {
    const m = {},
      dn = [
        'Palier Saccharification',
        'Palier I',
        'Palier II',
        'Palier III',
        'Rinçage / Recirculation',
        'Mashout',
        'Ébullition'
      ];
    S.elec
      .filter(l => l.auto)
      .forEach(l => {
        const a = l.auto,
          w = +l.w || 0;
        if (a === 'init' || a === 'rinse') m[a] = w;
        else if (a === 'pal') dn.slice(0, 4).forEach(n => (m['p:' + n] = w));
        else if (a === 'ramp') dn.slice(1).forEach(n => (m['r:' + n] = w));
        else if (a === 'mo') m['p:Mashout'] = w;
        else if (a === 'boil') m['p:Ébullition'] = w;
        else if (/^p\d$/.test(a)) m['p:' + dn[+a[1]]] = w;
        else if (/^r\d$/.test(a)) m['r:' + dn[+a[1]]] = w;
      });
    S.elec = [...Object.entries(m).map(([a, w]) => ({ name: a, w, min: 0, auto: a })), ...S.elec.filter(l => !l.auto)];
    S.kv.equip.elec6 = 1;
    MIG = true;
  }
  if (!S.kv.equip.sch351) {
    S.kv.equip.sch351 = 1;
    MIG = true;
  }
}
function seed() {
  S = {};
  migrate();
  i18nMerge();
}
/* Persistance : la base SQLite est gérée par le serveur Go d’OpenMaltForge (API /api/etat) ; l'état complet
   de l'application est échangé en JSON (mêmes données que l'ancien couple fromDb / buildDb de sql.js) */
function dbState() {
  i18nMerge();
  const o = {};
  TABLES.forEach(t => S[t] && (o[t] = S[t]));
  o.kv = S.kv;
  o.i18n = S.i18n;
  o.licence = S.licence || LICENCE_SEED;
  return JSON.stringify(o);
}
let DB = null /* base ouverte, d'après le serveur : { name, path } */,
  PST = 'none',
  WHY = '',
  PEND = false,
  tm,
  tmA = 0,
  READY = false;
const WHYT = {
  noserv: 'le serveur OpenMaltForge ne répond pas (application fermée ?)',
  none: 'aucune base chargée',
  need: 'écriture refusée par le serveur'
};
const why = () => (WHYT[PST] || '') + (WHY ? ' [' + WHY + ']' : ''),
  dbName = () => (DB && DB.name) || 'la base',
  escH = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
/* appel de l'API du serveur ; erreur = message renvoyé par le serveur */
async function api(u, o) {
  const r = await fetch(u, { cache: 'no-store', ...(o || {}) });
  if (!r.ok) throw new Error((await r.text()).trim() || 'erreur ' + r.status);
  return r;
}
const dbHdr = r =>
  (DB = {
    name: r.headers.get('X-OpenMaltForge-Db') || 'openmaltforge.sqlite',
    path: decodeURIComponent(r.headers.get('X-OpenMaltForge-Path') || '')
  });
/* notifications persistantes (orange) : ajoutées dans la zone de notification à la suite des autres, retirées quand le défaut est réglé */
function warnSet(k, txt) {
  const bar = $('#hbar');
  if (!bar) return;
  let el = bar.querySelector('.hw[data-k="' + k + '"]');
  if (!txt) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('span');
    el.className = 'hw';
    el.dataset.k = k;
    bar.appendChild(el);
  }
  if (el.textContent !== txt) el.textContent = txt;
  el.title = noIc(txt);
}
/* notification temporaire (10 s) dans sa propre case de la zone de notification : elle s'affiche avec celle de sauvegarde et les avertissements au lieu de la remplacer */
function notify(k, txt, cls, ttl) {
  const bar = $('#hbar');
  if (!bar) return;
  let el = bar.querySelector('.hn[data-k="' + k + '"]');
  if (!el) {
    el = document.createElement('span');
    el.dataset.k = k;
    bar.insertBefore(el, bar.querySelector('.hw'));
  }
  el.className = 'hn ' + (cls || 'ok');
  el.textContent = txt;
  el.title = noIc(txt);
  clearTimeout(el._t);
  el._t = setTimeout(() => el.remove(), ttl || 10000);
}
function badge() {
  const b = $('#dbst');
  if (!b) return;
  warnSet('db', READY && PST !== 'ok' ? '⚠ Base non synchronisée — ' + why() + ' (cliquer pour réessayer)' : '');
  b.textContent = PST === 'ok' ? '● Base : ' + dbName() : '⚠ Base non synchronisée (cliquer)';
  b.className = 'dbst ' + (PST === 'ok' ? 'ok' : 'warn');
  b.title = PST === 'ok' ? 'Données écrites dans ' + dbName() : why();
}
async function persist() {
  clearTimeout(tm);
  clearTimeout(tmA);
  tmA = 0;
  PEND = false;
  WHY = '';
  if (!READY || !DB) {
    PST = 'none';
    badge();
    return PST;
  }
  try {
    dbHdr(
      await api('api/etat', {
        method: 'PUT',
        headers: { 'X-OpenMaltForge': '1', 'Content-Type': 'application/json' },
        body: dbState()
      })
    );
    PST = 'ok';
  } catch (e) {
    PST = e instanceof TypeError ? 'noserv' : 'need';
    WHY = e.message;
  }
  badge();
  return PST;
}
/* sauvegarde automatique (Paramètres › Réglages) : activée, elle écrit la base au plus tard N minutes après la première modification (0 = après chaque modification) ; désactivée, seul « Enregistrer » écrit */
const autoMin = () => (S.kv.equip.autoOn === false ? -1 : Math.max(0, Math.floor(+S.kv.equip.autoMin) || 0));
const save = () => {
  if (!READY) return;
  ratioWarn();
  PEND = true;
  clearTimeout(tm);
  const m = autoMin();
  if (m === 0) tm = setTimeout(autoPersist, 400);
  else if (m > 0 && !tmA)
    tmA = setTimeout(() => {
      tmA = 0;
      autoPersist();
    }, m * 60000);
};
window.addEventListener('beforeunload', e => {
  if (READY && PEND && autoMin() !== 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});
/* écriture immédiate (migration, polices intégrées) sans attendre le délai de la sauvegarde automatique, sauf si elle est désactivée */
const saveNow = async () => {
  if (autoMin() === -1) return save();
  PEND = true;
  return persist();
};
/* Chargement : tant que la base n'est pas indiquée, un popup bloquant empêche d'utiliser l'application */
function gate(msg, btns) {
  let d = document.querySelector('#gate');
  if (!d) {
    d = document.createElement('div');
    d.id = 'gate';
    document.body.appendChild(d);
  }
  d.innerHTML =
    '<div class="box"><h2>🍺 OpenMaltForge</h2><p>' +
    msg +
    '</p><div class="gb">' +
    btns.map((b, i) => '<button class="' + (i ? '' : 'go') + '" data-g="' + i + '">' + b.l + '</button>').join('') +
    '</div><div id="gerr"></div></div>';
  d.querySelectorAll('button').forEach(
    x =>
      (x.onclick = async () => {
        const e = d.querySelector('#gerr');
        e.textContent = '';
        try {
          await btns[+x.dataset.g].f();
        } catch (err) {
          e.textContent =
            err && err.name === 'AbortError'
              ? 'Sélection annulée : la base de données est obligatoire pour utiliser OpenMaltForge.'
              : '⚠ ' + ((err && err.message) || err);
        }
      })
  );
}
/* charge l'état de la base ouverte par le serveur (au démarrage, ou après un changement de base) */
async function useState() {
  const r = await api('api/etat'),
    o = await r.json();
  if (!o || typeof o !== 'object' || !o.kv) throw new Error('réponse du serveur invalide');
  dbHdr(r);
  S = o;
  migrate();
  i18nMerge();
  lblRegFonts();
  if (htmlRefreshAll()) MIG = true;
  {
    const l = S.kv.equip.lang || 'fr';
    if (l !== LANG) setLang(l);
    else {
      i18nCompile();
      i18nApply();
    }
  }
  READY = true;
  PST = 'ok';
  WHY = '';
  badge();
  if (MIG) {
    MIG = false;
    /* migration d'une ancienne base : écrite tout de suite (sauf sauvegarde automatique désactivée), sans attendre le délai */
    await saveNow();
  }
  fontsSeed();
}
/* Paramètres › Base de données : fichier réellement ouvert par le navigateur et tables qu'il contient (relues sur le disque) */
/* Paramètres › Contactez-moi : adresse de contact du développeur (lien mailto + copie dans le presse-papiers) */
const CONTACT = 'openmaltforge@pm.me';
function contactPanel() {
  return `<div class="panel" id="contactp"><h3>Contactez-moi</h3><p class="ctxt">Une question, une idée, un problème ? Écrivez-moi :</p><p class="cmail"><span class="cic">${ic('mail')}</span><a href="mailto:${CONTACT}" data-nt>${CONTACT}</a><button data-ccopy="1" title="Copier l’adresse">Copier</button></p></div>`;
}
document.addEventListener('click', async e => {
  if (!e.target.closest || !e.target.closest('[data-ccopy]')) return;
  try {
    await navigator.clipboard.writeText(CONTACT);
    notify('contact', '✔ Adresse copiée dans le presse-papiers.', 'ok');
  } catch (_) {
    notify('contact', '⚠ Copie impossible : sélectionnez l’adresse à la main.', 'err');
  }
});
/* Paramètres › Réglages : sauvegarde automatique, langue, base de données */
const reglagesPanel = () => {
  setTimeout(dbInfo, 0);
  const E = S.kv.equip,
    on = E.autoOn !== false;
  return `<div class="panel" id="regp"><h3>Réglages</h3>
<div class="rgrow"><label class="sw" title="Activer / désactiver la sauvegarde automatique"><input type="checkbox" id="autoon"${on ? ' checked' : ''}><span class="sl"></span></label><span class="ul">Sauvegarde automatique</span><span class="rgin"><input type="number" min="0" step="1" id="automin" value="${Math.max(0, Math.floor(+E.autoMin) || 0)}"${on ? '' : ' readonly'}> min</span></div>
<div class="rgrow"><span class="ul">Langue</span><select id="langsel">${LANGS.map(([c, n]) => `<option value="${c}"${c === LANG ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
<div class="rgrow rgdb"><span class="ul"><b>Base de données :</b> <span id="dbinfo">Lecture du fichier…</span></span><span class="rgbtns"><button id="dbexp" title="Télécharger une copie de la base SQLite (état actuel, modifications non enregistrées comprises)">⬇ Exporter la base…</button><button id="dbchg" title="Remplacer la base par le contenu d’un autre fichier .sqlite (une copie de la base actuelle est conservée)">📂 Changer de base…</button></span></div></div>`;
};
document.addEventListener('change', e => {
  const t = e.target;
  if (!t || !S.kv || (t.id !== 'autoon' && t.id !== 'automin')) return;
  const E = S.kv.equip;
  if (t.id === 'autoon') {
    E.autoOn = t.checked;
    const m = document.getElementById('automin');
    if (m) m.readOnly = !t.checked;
  } else if (E.autoOn === false) {
    t.value = E.autoMin;
    return;
  } else E.autoMin = Math.max(0, Math.floor(+t.value) || 0);
  t.id === 'automin' && (t.value = E.autoMin);
  clearTimeout(tmA);
  tmA = 0;
  save();
  persist();
});
const dbPath = () => (DB && DB.path) || dbName();
async function dbInfo() {
  const box = document.getElementById('dbinfo');
  if (!box) return;
  try {
    if (PEND) await persist();
    const i = await (await api('api/info')).json();
    box.textContent = i.nom;
    box.title = i.chemin;
  } catch (e) {
    box.textContent = '⚠ ' + ((e && e.message) || e);
  }
}
/* export de la base : copie SQLite de l'état actuel, nommée AAAAMMJJ_openmaltforge.sqlite */
const exportName = d => {
  d = d || new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_openmaltforge.sqlite';
};
/* l'export contient l'état affiché, modifications non encore enregistrées comprises, sans écrire dans la base */
async function exportDb() {
  try {
    const b = await (
        await api('api/export', {
          method: 'POST',
          headers: { 'X-OpenMaltForge': '1', 'Content-Type': 'application/json' },
          body: dbState()
        })
      ).blob(),
      a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = exportName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    notify('export', '✔ Base exportée : ' + a.download, 'ok');
  } catch (e) {
    notify('export', '⚠ Export impossible : ' + ((e && e.message) || e), 'err');
  }
}
document.addEventListener('click', e => {
  if (e.target.closest && e.target.closest('#dbexp')) exportDb();
});
/* changer de base : le fichier choisi remplace la base ouverte (le serveur le vérifie, le met à niveau et garde une copie de l'ancienne base) */
document.addEventListener('click', async e => {
  if (!e.target.closest || !e.target.closest('#dbchg')) return;
  try {
    if (PEND) await persist();
    let fi = '';
    try {
      const i = await (await api('api/info')).json();
      fi = `<tr><td>Taille</td><td>${Math.round(i.taille / 1024).toLocaleString('fr-FR')} Ko</td></tr><tr><td>Dernière modification</td><td>${esc(new Date(i.modifie).toLocaleString('fr-FR'))}</td></tr>`;
    } catch (_) {}
    const cnt = [
      ['Recettes', S.biblio.length],
      ['Malts', S.malts.length],
      ['Houblons', S.hops.length],
      ['Levures', S.yeasts.length],
      ['Styles', S.styles.length]
    ]
      .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
      .join('');
    const go = await bcForm(
      'Vous allez remplacer la base de données utilisée par OpenMaltForge par le contenu d’un autre fichier .sqlite. Les modifications en cours sont d’abord enregistrées et une copie de la base actuelle est conservée dans le dossier des sauvegardes. Le sélecteur de fichiers de votre système s’ouvrira ensuite.',
      {
        title: 'Changer de base de données',
        ok: 'Choisir un fichier…',
        cancel: 'Annuler',
        wide: 1,
        body: `<div class="bcmap bcdb"><table><tr><td>Base actuelle</td><td><b>${esc(dbName())}</b></td></tr><tr><td>Emplacement</td><td>${esc(dbPath())}</td></tr>${fi}${cnt}</table></div>`,
        collect: () => true
      }
    );
    if (!go) return;
    const f = await new Promise((res, rej) => {
      const i = document.createElement('input');
      i.type = 'file';
      i.accept = '.sqlite,.db';
      i.onchange = () => (i.files[0] ? res(i.files[0]) : rej({ name: 'AbortError' }));
      i.click();
    });
    await api('api/import', { method: 'POST', headers: { 'X-OpenMaltForge': '1' }, body: f });
    await useState();
    show('params');
    notify('import', '✔ Base remplacée par ' + f.name + ' (copie de l’ancienne dans les sauvegardes)', 'ok');
  } catch (err) {
    if (!err || err.name !== 'AbortError') bcAlert('⚠ ' + ((err && err.message) || err));
  }
});
async function load() {
  try {
    await useState();
  } catch (e) {
    PST = 'noserv';
    gate(
      '⚠ Impossible de charger la base de données : ' +
        escH((e && e.message) || e) +
        '<br><br>OpenMaltForge doit être ouvert par son application (menu, raccourci ou exécutable OpenMaltForge) : c’est elle qui gère la base de données.',
      [{ l: '↻ Réessayer', f: async () => location.reload() }]
    );
    return new Promise(() => {});
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && PEND) persist();
  });
  /* battement : le serveur s'arrête quand la fenêtre n'en envoie plus */
  const beat = () => fetch('api/ping', { cache: 'no-store' }).catch(() => {});
  beat();
  setInterval(beat, 3000);
  addEventListener('pagehide', () => navigator.sendBeacon && navigator.sendBeacon('api/bye'));
}
/* Calculs : Tinseth x coefficient d'usage */
function compute() {
  const R = S.kv.recipe,
    E = S.kv.equip,
    V = +E.vol || 30,
    e = E.eff / 100;
  let pts = 0,
    mcu = 0;
  R.malts.forEach(m => {
    const d = find('malts', m.n);
    if (d) {
      pts += ((m.g / 1000) * d.potentiel * e) / V;
      mcu += ((m.g / 1000) * 2.2046 * (d.ebc / 1.97)) / (V * 0.2642);
    }
  });
  const og = 1 + pts / 1000,
    bg = 1.65 * Math.pow(0.000125, og - 1);
  let ibu = 0;
  const ibus = R.hops.map(h => {
    const d = find('hops', h.n);
    if (!d) return 0;
    const k = E.coef[h.use] ?? 1;
    const x = ((((((h.g * (d.alpha_min + d.alpha_max)) / 2) * 10) / V) * bg * (1 - Math.exp(-0.04 * h.t))) / 4.15) * k;
    ibu += x;
    return x;
  });
  const ys = R.yeasts.map(h => find('yeasts', h.n)).filter(Boolean),
    mn = f => (ys.length ? ys.reduce((a, y) => a + (+y[f] || 0), 0) / ys.length : null),
    att = ys.length ? (mn('att_min') + mn('att_max')) / 2 : 75,
    fg = 1 + (og - 1) * (1 - att / 100),
    floc = ys.length ? (mn('floc_min') + mn('floc_max')) / 2 : null;
  return {
    att,
    attMin: mn('att_min'),
    attMax: mn('att_max'),
    floc,
    flocMin: mn('floc_min'),
    flocMax: mn('floc_max'),
    og,
    fg,
    ibu,
    ibus,
    pts,
    ebc: mcu > 0 ? 1.4922 * Math.pow(mcu, 0.6859) * 1.97 : 0,
    abv: (og - fg) * 131.25
  };
}
async function adjust() {
  const R = S.kv.recipe,
    og = parseFloat(R.ogT),
    ib = parseFloat(R.ibuT);
  const err = t => notify('calc', '⚠ ' + t, 'err');
  const bad = ['malts', 'hops']
    .map(k => [k, pcv(k).reduce((a, b) => a + b, 0)])
    .filter(([k, t]) => t > 0 && Math.abs(t - 100) > 0.05);
  if (bad.length) {
    const lb = { malts: 'malts', hops: 'houblons' };
    if (
      !(await bcAsk(
        'Les pourcentages des ' +
          bad.map(([k, t]) => lb[k] + ' (' + nf(t, 1) + ' %)').join(' et des ') +
          ' ne totalisent pas 100 %.\n\nRedimensionner à 100 % (règle de trois) ?',
        { title: 'Pourcentages incomplets', ok: 'Redimensionner', cancel: 'Annuler' }
      ))
    )
      return err(
        'Calcul non effectué : les pourcentages des ' +
          bad.map(([k]) => lb[k]).join(' et des ') +
          ' ne totalisent pas 100 %.'
      );
    bad.forEach(([k, t]) => {
      const a = R[k],
        T = (R.pm && R.pm[k]) || a.reduce((x, y) => x + (+y.g || 0), 0),
        P = pcv(k);
      a.forEach((x, i) => {
        x.p = (P[i] * 100) / t;
        x.g = k === 'malts' ? Math.round((T * x.p) / 100) : Math.round(((T * x.p) / 100) * 10) / 10;
      });
      document.querySelectorAll(`.rin[data-k="${k}"][data-f="g"]`).forEach(el => {
        el.value = k === 'malts' ? a[+el.dataset.i].g / 1000 : a[+el.dataset.i].g;
      });
    });
    refresh();
  }
  if (!R.ogT || !R.ibuT || isNaN(og) || isNaN(ib))
    return err('Les cibles sont vides : saisissez une DI cible (ex. 1.060) et des IBU cibles.');
  if (!(og > 1.01 && og < 1.2) || !(ib > 0)) return err('Valeurs invalides : DI entre 1.010 et 1.200, IBU > 0.');
  let c = compute();
  if (c.pts <= 0) return err('Aucun malt reconnu (ou poids nul) : impossible d’ajuster la DI.');
  pclr('malts');
  pclr('hops');
  setRO('malts');
  setRO('hops');
  const f = ((og - 1) * 1000) / c.pts;
  R.malts.forEach(x => (x.g = Math.round(x.g * f)));
  c = compute();
  if (c.ibu <= 0)
    return err(
      'Aucun houblon contributif (nom reconnu, poids, temps, usage ≠ Dry hop) : impossible d’ajuster les IBU.'
    );
  const g = ib / c.ibu;
  R.hops.forEach(h => {
    if ((S.kv.equip.coef[h.use] ?? 1) > 0) h.g = Math.round(h.g * g * 10) / 10;
  });
  document.querySelectorAll('.rin[data-f="g"]').forEach(el => {
    el.value = R[el.dataset.k][el.dataset.i].g / (el.dataset.k === 'malts' ? 1000 : 1);
  });
  refresh();
  notify('calc', '✔ Recalculé : DI ' + og.toFixed(3) + ' / ' + ib + ' IBU', 'ok');
  save();
}
function ratios(c) {
  const dg = (c.og - 1) * 1000,
    r = dg > 0 ? c.ibu / dg : 0,
    aa = c.og > 1 ? (c.og - c.fg) / (c.og - 1) : 0;
  return { ibudi: r, rbr: r * (1 + aa - 0.77) };
}
/* Tableau d’électricité généré depuis le tableau « Paliers d’empâtage » de la Conception :
   montée initiale, puis (montée + palier) pour chaque ligne, puis chauffe de l’eau de rinçage. Clés : init, p:<palier>, r:<palier> (montée qui précède), rinse. */
function mkeys(M) {
  const c = {};
  return M.map(r => {
    const n = String(r.k || '');
    c[n] = (c[n] || 0) + 1;
    return c[n] > 1 ? n + '#' + c[n] : n;
  });
}
function mrow(role) {
  ensureMash();
  return S.kv.recipe.mash.find(r => r.role === role);
}
function elecPlan() {
  const R = S.kv.recipe,
    E = S.kv.equip;
  ensureMash();
  const ch = +E.chauffe > 0 ? +E.chauffe : 1.5,
    t0 = E.t0 === '' || E.t0 == null || isNaN(+E.t0) ? 12 : +E.t0,
    M = R.mash,
    K = mkeys(M),
    hasT = r => r.t !== '' && r.t != null && !isNaN(+r.t),
    dm = r => (+r.m > 0 ? +r.m : r.role === 'boil' ? 60 : 0),
    eff = r => hasT(r) && dm(r) > 0,
    L = [];
  /* une ligne d’électricité par ligne du tableau des paliers (même ordre), avec une montée en température avant chaque palier */
  L.push({ key: 'init', kind: 'init', label: 'Montée en température initiale', min: 0, def: 3000 });
  let prev = null;
  M.forEach((r, i) => {
    const e = eff(r);
    let rl = null;
    if (e && prev === null) {
      L[0].min = Math.max(0, (+r.t - t0) / ch);
      L[0].label = 'Montée en température initiale (' + t0 + ' → ' + +r.t + ' °C)';
    }
    if (i > 0)
      rl = {
        key: 'r:' + K[i],
        kind: 'ramp',
        label: 'Montée en température' + (e && prev !== null ? ' (' + prev + ' → ' + +r.t + ' °C)' : ''),
        min: e && prev !== null ? Math.max(0, (+r.t - prev) / ch) : 0,
        def: 3000
      };
    if (rl) L.push(rl);
    if (e) prev = +r.t;
    L.push({
      key: 'p:' + K[i],
      kind: 'pal',
      label: String(r.k || '') + (hasT(r) ? ' (' + +r.t + ' °C)' : ''),
      min: dm(r),
      def: r.role === 'boil' ? 3000 : 0
    });
  });
  let rf = 1;
  try {
    const w = wcalc();
    rf = w.v0 > 0 ? Math.max(0, w.rinc) / w.v0 : 1;
  } catch (x) {}
  const rr = mrow('rinse');
  L.push({
    key: 'rinse',
    kind: 'rinse',
    label: 'Chauffe eau de rinçage' + (rr && hasT(rr) ? ' (' + t0 + ' → ' + +rr.t + ' °C)' : ''),
    min: rr && hasT(rr) ? Math.max(0, (+rr.t - t0) / ch) * rf : 0,
    def: 3000
  });
  return L;
}
function elecSync() {
  const L = elecPlan();
  return L.map(line => {
    let i = S.elec.findIndex(l => l.auto === line.key);
    if (i < 0) {
      S.elec.push({ name: line.label, w: line.def, min: 0, auto: line.key });
      i = S.elec.length - 1;
    }
    S.elec[i].name = line.label;
    return { i, line };
  });
}
function elecKwh() {
  const a = elecSync().map(({ i, line }) => (((+S.elec[i].w || 0) / 1000) * line.min) / 60);
  S.elec.forEach(l => {
    if (!l.auto) a.push((((+l.w || 0) / 1000) * (+l.min || 0)) / 60);
  });
  return a;
}
function costs() {
  const R = S.kv.recipe,
    E = S.kv.equip;
  R.conso = R.conso || [];
  const sum = a => a.reduce((x, y) => x + y, 0),
    ln = (k, f) =>
      R[k].map(x => {
        const d = find(k, x.n);
        return d ? (+x.g || 0) * (+d[f] || 0) : 0;
      });
  const mal = R.malts.map(x => {
      const d = find('malts', x.n);
      return d ? ((+x.g || 0) / 1000) * (+d.prix_kg || 0) : 0;
    }),
    hop = ln('hops', 'prix_g'),
    yea = ln('yeasts', 'prix_sachet'),
    ing = ln('ings', 'prix_g'),
    rco = ln('conso', 'prix');
  const cmin = minCost().tot;
  return {
    mal,
    hop,
    yea,
    ing,
    rco,
    tco: sum(rco),
    cmin,
    tm: sum(mal),
    th: sum(hop),
    ty: sum(yea),
    ti: sum(ing),
    eau: (() => {
      let ml = 0,
        mc = 0;
      (R.water || []).forEach(x => {
        const d = find('eaux', x.n);
        if (d && eauMin(d) && +d.prix_l > 0) {
          ml += +x.l || 0;
          mc += (+x.l || 0) * +d.prix_l;
        }
      });
      return (Math.max(0, (wcalc().tot || 0) - ml) / 1000) * (+sysPrix('m3') || 0) + mc;
    })(),
    el: sum(elecKwh()) * (+sysPrix('kwh') || 0),
    cons: sum(rco) + cmin
  };
}
/* écran Eaux : seules les eaux minérales s'achètent */
const eauMin = o => /min[ée]ral/i.test((o && o.type) || '');
/* stock (6.7.0) : à la saisie de la date de brassage, les composants de la recette sont déduits du stock (malts en kg, le reste dans l'unité de la table) ; la date effacée les remet en stock */
function stockUse(R) {
  const out = [],
    add = (t, n, q) => {
      const d = find(t, n) || (t === 'ings' && typeof bxIngBase === 'function' ? find(t, bxIngBase(n)) : null);
      if (d && q > 0) out.push([t, d.name, q]);
    };
  (R.malts || []).forEach(x => add('malts', x.n, (+x.g || 0) / 1000));
  (R.hops || []).forEach(x => add('hops', x.n, +x.g || 0));
  (R.yeasts || []).forEach(x => add('yeasts', x.n, +x.g || 0));
  (R.ings || []).forEach(x => add('ings', x.n, +x.g || 0));
  (R.conso || []).forEach(x => add('conso', x.n, +x.g || 0));
  minCost().r.forEach(m => add('ings', MCO[m.k], m.g));
  /* eaux minérales (achetées) : litres de chaque eau du mélange ; les eaux de ville ne comptent pas */
  (R.water || []).forEach(x => {
    const d = find('eaux', x.n);
    if (d && eauMin(d)) add('eaux', x.n, stkR(+x.l || 0));
  });
  return out;
}
const stkR = v => Math.round(v * 1000) / 1000;
function stockOut(R) {
  const log = [];
  stockUse(R).forEach(([t, n, q]) => {
    const d = (S[t] || []).find(x => x.name === n),
      had = +d.stock || 0,
      take = Math.min(had, q);
    if (take <= 0) return;
    d.stock = stkR(had - take);
    log.push([t, n, stkR(take)]);
  });
  R.stk = log;
  return log.length;
}
function stockBack(R) {
  (R.stk || []).forEach(([t, n, q]) => {
    const d = (S[t] || []).find(x => x.name === n);
    if (d) d.stock = stkR((+d.stock || 0) + q);
  });
  delete R.stk;
}
/* ---------- courses : caddie (stock insuffisant pour la recette) → liste de courses imprimable ---------- */
const CUN = { malts: 'kg', hops: 'g', yeasts: 'sachet(s)', ings: 'g', conso: 'unité(s)', eaux: 'L' },
  CNM = { malts: 'Malts', hops: 'Houblons', yeasts: 'Levures', ings: 'Ingrédients', conso: 'Consommables', eaux: 'Eaux minérales' },
  CPR = { malts: 'prix_kg', hops: 'prix_g', yeasts: 'prix_sachet', ings: 'prix_g', conso: 'prix', eaux: 'prix_l' },
  cfr = (v, d = 3) => (+v || 0).toLocaleString('fr-FR', { maximumFractionDigits: d });
const courList = () => S.kv.equip.courses || (S.kv.equip.courses = []);
const recKey = () => S.kv.recipe.id || S.kv.recipe.name || 'recette';
const R0 = () => S.kv.recipe;
/* quantité d'un composant utilisée par la recette en cours (unité du stock) */
const recNeed = (t, n) => stockUse(S.kv.recipe).reduce((a, u) => (u[0] === t && u[1] === n ? a + u[2] : a), 0);
/* manque d'un composant pour la recette en cours : besoin total − stock (dans l'unité du stock) */
function stockShort(t, name, need) {
  const d = find(t, name);
  if (!d) return 0;
  /* need : cache {t|nom → besoin} calculé une fois par mise à jour (updCart) */
  if (!need) {
    need = {};
    stockUse(S.kv.recipe).forEach(u => (need[u[0] + '|' + u[1]] = (need[u[0] + '|' + u[1]] || 0) + u[2]));
  }
  return Math.max(0, stkR((need[t + '|' + d.name] || 0) - (+d.stock || 0)));
}

/* liste de courses automatique (recette en cours) : un composant que la recette épuise (besoin ≥ stock) y est ajouté
   — quantité = ce qui manque, ou la quantité utilisée quand le stock tombe tout juste à zéro — et retiré dès que le stock
   suffit de nouveau. Raison « auto » dans c.r ; les ajouts manuels (caddie, quantité saisie) ne sont jamais retirés.
   Une fois dans la liste, la quantité d'un article ne change plus d'elle-même (Calculer, modification d'une ligne…) :
   si elle devient insuffisante, un triangle orange et une notification le signalent (courWarn).
   Un article retiré à la main (croix) n'est pas remis tant que le stock reste épuisé (R.courNo). */
function courSync() {
  const R = S.kv.recipe;
  if (!R) return false;
  const need = {},
    back = {},
    want = {},
    L = courList();
  stockUse(R).forEach(([t, n, q]) => (need[t + '|' + n] = (need[t + '|' + n] || 0) + q));
  /* recette déjà réalisée : son stock a été déduit, on le compte comme encore disponible */
  (R.stk || []).forEach(([t, n, q]) => (back[t + '|' + n] = (back[t + '|' + n] || 0) + (+q || 0)));
  for (const k in need) {
    const i = k.indexOf('|'),
      t = k.slice(0, i),
      d = (S[t] || []).find(x => x.name === k.slice(i + 1));
    if (!d) continue;
    const st = stkR((+d.stock || 0) + (back[k] || 0)),
      q = stkR(need[k]);
    if (q > 0 && q >= st) want[k] = stkR(q > st ? q - st : q);
  }
  let ch = false;
  const no = (R.courNo || []).filter(k => want[k] !== undefined);
  if (no.length !== (R.courNo || []).length) {
    if (no.length) R.courNo = no;
    else delete R.courNo;
    ch = true;
  }
  const rk = recKey();
  for (const k in want) {
    if (no.includes(k)) continue;
    const i = k.indexOf('|'),
      t = k.slice(0, i),
      n = k.slice(i + 1);
    if (L.some(x => x.t === t && x.n === n)) continue; /* déjà dans la liste : quantité figée */
    L.push({ t, n, q: want[k], r: { auto: want[k] } });
    ch = true;
  }
  for (let j = L.length - 1; j >= 0; j--) {
    const c = L[j],
      k = c.t + '|' + c.n;
    if (!c.r || c.r.auto === undefined || (want[k] !== undefined && !no.includes(k) && !(c.r[rk] !== undefined))) continue;
    delete c.r.auto;
    ch = true;
    if (!Object.keys(c.r).length) L.splice(j, 1);
  }
  /* 6.6.0 : composant sorti de la recette en cours → son ajout au caddie pour cette recette est retiré aussi
     (les ajouts manuels des écrans de base, « manuel », restent) */
  for (let j = L.length - 1; j >= 0; j--) {
    const c = L[j];
    if (!c.r || c.r[rk] === undefined || need[c.t + '|' + c.n] !== undefined) continue;
    delete c.r[rk];
    ch = true;
    if (!Object.keys(c.r).length) L.splice(j, 1);
  }
  return ch;
}
/* manque actuel de chaque composant de la recette en cours (unité du stock), recette réalisée recomptée */
function courMissing() {
  const R = S.kv.recipe,
    need = {},
    back = {},
    out = {};
  if (!R) return out;
  stockUse(R).forEach(([t, n, q]) => (need[t + '|' + n] = (need[t + '|' + n] || 0) + q));
  (R.stk || []).forEach(([t, n, q]) => (back[t + '|' + n] = (back[t + '|' + n] || 0) + (+q || 0)));
  for (const k in need) {
    const i = k.indexOf('|'),
      d = (S[k.slice(0, i)] || []).find(x => x.name === k.slice(i + 1));
    if (d) out[k] = Math.max(0, stkR(need[k] - (+d.stock || 0) - (back[k] || 0)));
  }
  return out;
}
/* quantités de la liste inférieures au manque : triangle orange à côté de la quantité + notification d'avertissement */
function courWarn() {
  const M = courMissing(),
    bad = [];
  courList().forEach((c, i) => {
    const m = M[c.t + '|' + c.n] || 0,
      low = (+c.q || 0) < m - 1e-9,
      w = document.querySelector('#courses .cwarn[data-ci="' + i + '"]');
    if (low) bad.push(c.n);
    if (w) {
      w.hidden = !low;
      w.title = low ? `Quantité insuffisante : il manque ${cfr(m)} ${CUN[c.t]} pour la recette` : '';
    }
  });
  warnSet('courses', bad.length ? '⚠ Liste de courses : quantité insuffisante pour ' + bad.join(', ') : '');
}
function updCart() {
  if (courSync()) {
    const el = $('#courses');
    if (el) el.innerHTML = coursesBox();
    save();
  }
  courWarn();
  const R = S.kv.recipe,
    need = {};
  stockUse(R).forEach(u => (need[u[0] + '|' + u[1]] = (need[u[0] + '|' + u[1]] || 0) + u[2]));
  const set = (b, k, name) => {
      const m = name ? stockShort(k, name, need) : 0,
        dn = (find(k, name) || {}).name || name,
        on = courList().some(c => c.t === k && c.n === dn);
      b.hidden = !(name && find(k, name)); /* caddie sur chaque ligne dont le composant est dans la base */
      b.classList.toggle('on', on);
      b.classList.toggle('short', m > 0);
      b.title = on
        ? 'Déjà dans la liste de courses'
        : m > 0
          ? `Stock insuffisant : il manque ${cfr(m)} ${CUN[k]} — ajouter à la liste de courses`
          : 'Ajouter à la liste de courses';
    };
  document.querySelectorAll('button[data-cart]').forEach(b => {
    const r = (R[b.dataset.cart] || [])[+b.dataset.i];
    set(b, b.dataset.cart, r && r.n);
  });
  document.querySelectorAll('button[data-cartd]').forEach(b => {
    const k = b.dataset.cartd,
      o = (S[k] || [])[+b.dataset.i];
    set(b, k, o && o.name);
    b.hidden = !o || (k === 'eaux' && !eauMin(o)); /* écrans de base : le caddie est toujours là (Eaux : minérales seulement) */
    if (o && stockShort(k, o.name, need) <= 0)
      b.title = b.classList.contains('on') ? 'Déjà dans la liste de courses' : 'Ajouter à la liste de courses';
  });
}
function courPrice(c) {
  const d = find(c.t, c.n);
  return d ? (+c.q || 0) * (+d[CPR[c.t]] || 0) * 1 : 0;
}
const courTot = () => courList().reduce((a, c) => a + courPrice(c), 0);
/* section « Courses » de la Conception : résumé + ouverture de la liste (popup) */
function courRefresh() {
  const el = $('#courses');
  if (el) el.innerHTML = coursesBox();
  updCart();
}
const CDEF = { malts: 1, hops: 100, yeasts: 1, ings: 100, conso: 1, eaux: 10 }; /* quantité proposée depuis un écran de base quand rien ne manque pour la recette */
function courAddItem(k, name, manual, rec) {
  const d = find(k, name),
    m = d ? stockShort(k, d.name) : 0;
  if (!d || (m <= 0 && !manual && !rec)) return;
  let c = courList().find(x => x.t === k && x.n === d.name);
  const msg = $('#hmsg');
  if (rec && c && m <= 0) {
    /* ligne de la recette déjà dans la liste : rien à ajouter */
    if (msg) {
      msg.textContent = '✔ « ' + d.name + ' » est déjà dans la liste de courses';
      msg.className = 'ok';
    }
    return;
  }
  if (rec && R0().courNo) R0().courNo = R0().courNo.filter(x => x !== k + '|' + d.name);
  if (!c) courList().push((c = { t: k, n: d.name, q: 0, r: {} }));
  c.r = c.r || {};
  delete c.r.auto; /* ajout manuel : l'article n'est plus géré automatiquement */
  if (m > 0) c.r[recKey()] = m;
  else if (rec) c.r[recKey()] = stkR(recNeed(k, d.name)) || CDEF[k]; /* stock suffisant : quantité utilisée par la recette */
  else if (!c.q) c.r.manuel = CDEF[k];
  c.q = stkR(Object.values(c.r).reduce((a, v) => a + (+v || 0), 0));
  save();
  courRefresh();
  if (msg) {
    msg.textContent = '✔ « ' + d.name + ' » : ' + cfr(c.q) + ' ' + CUN[k] + ' dans la liste de courses (' + courList().length + ' article(s))';
    msg.className = 'ok';
  }
}
/* section « Courses » (Conception) : même présentation que la fiche recette ; n'apparaît que s'il y a au moins un article à acheter */
function coursesBox() {
  const L = courList();
  if (!L.length) return '';
  const rows = Object.keys(CNM)
    .filter(t => L.some(c => c.t === t))
    .map(
      t =>
        `<tr class="cg"><th colspan="5">${CNM[t]}</th></tr>` +
        L.map((c, i) => [c, i])
          .filter(([c]) => c.t === t)
          .map(
            ([c, i]) =>
              `<tr><td>${esc(c.n)}</td><td class="cqc"><button class="cinfo" data-cinfo="${i}" aria-label="État du stock">${ic('info')}</button><input class="rin" type="number" min="0" step="any" data-cq="${i}" value="${c.q}"><span class="cwarn" data-ci="${i}" hidden>⚠</span></td><td class="un">${CUN[t]}</td><td class="pc" id="cpx${i}">${nf(courPrice(c), 2)}</td><td class="xc"><button class="cart" tabindex="-1" aria-hidden="true" hidden>🛒</button><button class="x" data-cdel="${i}" title="Retirer de la liste">✕</button></td></tr>`
          )
          .join('')
    )
    .join('');
  return `<div class="panel"><h3>🛒 Courses<button id="cpp" title="Imprimer la liste de courses">🖨</button></h3><table class="rvt cour"><tr><th>Article</th><th>À acheter</th><th>Unité</th><th>Estimation (€)</th><th></th></tr>${rows}</table><div class="ctot">Total estimé : <b id="ctot">${nf(courTot(), 2)}</b> €</div></div>`;
}
/* 6.6.0 : bouton info d'un article des courses — après 1 s de survol (ou au clic), état du stock du composant :
   stock actuel, besoin de la recette en cours, stock après achat, puis après brassage */
function courInfo(i) {
  const c = courList()[i];
  if (!c) return '';
  const R = S.kv.recipe,
    d = find(c.t, c.n),
    u = tx(CUN[c.t]),
    v = x => cfr(x) + ' ' + u,
    need = stockUse(R)
      .filter(([t, n]) => t === c.t && n === (d || {}).name)
      .reduce((a, x) => a + x[2], 0),
    st = d ? +d.stock || 0 : 0,
    after = stkR(st + (+c.q || 0)),
    row = (l, x, cl) => `<tr${cl ? ` class="${cl}"` : ''}><td>${esc(tx(l))}</td><td>${x}</td></tr>`;
  let h = `<b>${esc(c.n)}</b><table>`;
  if (!d) return h + row('Composant absent de la base : stock inconnu.', '') + '</table>';
  h += row('Stock actuel', v(st));
  if (R.stk && R.stk.length) h += row('Recette déjà réalisée : sa consommation est déjà déduite du stock.', '');
  else if (need > 0) h += row('Besoin de la recette en cours', v(stkR(need)));
  h += row('Après achat', v(after), 'ok');
  if (!(R.stk && R.stk.length) && need > 0) {
    const rest = stkR(after - need);
    h += row('Après brassage', v(rest), rest < 0 ? 'bad' : '');
  }
  return h + '</table>';
}
let cinfoT = null;
const cinfoHide = () => {
  clearTimeout(cinfoT);
  cinfoT = null;
  document.getElementById('cinfo')?.remove();
};
function cinfoShow(b) {
  cinfoHide();
  const t = document.createElement('div');
  t.id = 'cinfo';
  t.innerHTML = courInfo(+b.dataset.cinfo);
  document.body.appendChild(t);
  const r = b.getBoundingClientRect(),
    w = t.offsetWidth;
  t.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
  t.style.top = r.bottom + 6 + 'px';
}
document.addEventListener('mouseover', e => {
  const b = e.target.closest && e.target.closest('[data-cinfo]');
  if (!b || (e.relatedTarget && b.contains(e.relatedTarget))) return;
  cinfoHide();
  cinfoT = setTimeout(() => cinfoShow(b), 1000);
});
document.addEventListener('mouseout', e => {
  const b = e.target.closest && e.target.closest('[data-cinfo]');
  if (b && !(e.relatedTarget && b.contains(e.relatedTarget))) cinfoHide();
});
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-cinfo]');
  if (b) cinfoShow(b);
  else cinfoHide();
});
window.addEventListener('scroll', cinfoHide, true);
/* feuille imprimable : même esprit que la fiche recette (verre, pastilles, tuiles chiffrées, cartes par rubrique), A4 */
function coursesHtml() {
  const L = courList(),
    dt = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    kinds = Object.keys(CNM).filter(t => L.some(c => c.t === t)),
    tile = (l, v, u) => `<div class="k"><b>${v}</b>${u ? `<small>${u}</small>` : ''}<span>${l}</span></div>`,
    card = t => {
      const rows = L.filter(c => c.t === t)
        .sort((a, b) => a.n.localeCompare(b.n, 'fr'))
        .map(
          c =>
            `<tr><td class="bx"><i></i></td><td>${esc(c.n)}</td><td class="r">${cfr(c.q)} <small>${CUN[t]}</small></td><td class="r">${courPrice(c) ? cfr(courPrice(c), 2) + ' €' : '–'}</td></tr>`
        )
        .join('');
      return `<section><h3><i><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[{ malts: 'wheat', hops: 'leaf', yeasts: 'flask', ings: 'mortar', conso: 'box', eaux: 'droplet' }[t]] || ''}</svg></i>${CNM[t]}<em>${L.filter(c => c.t === t).length}</em></h3><table><tr><th></th><th>Article</th><th class="r">Quantité</th><th class="r">Estim.</th></tr>${rows}</table></section>`;
    };
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Liste de courses</title><style>
@page{size:A4;margin:14mm}
*{box-sizing:border-box}
body{margin:0;font:13px/1.45 'Inter',sans-serif;color:#1d2733;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.box{border:1px solid #c4ccd8;border-top:4px solid #b4570a;border-radius:14px;overflow:hidden}
header{display:flex;align-items:center;gap:16px;padding:16px 22px;border-bottom:1px solid #c4ccd8;background:linear-gradient(180deg,#eef1f5,#fff)}
header svg.g{flex:none}
header h1{margin:0 0 6px;font-size:26px;line-height:1.15}
.m{display:flex;flex-wrap:wrap;gap:6px 8px;font-size:12px;color:#5b6878}
.m span{background:#eef1f5;border-radius:20px;padding:2px 10px}
.m span:first-letter{text-transform:uppercase}
.bd{padding:18px 22px 10px}
.ks{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:10px;margin-bottom:18px}
.k{background:#eef1f5;border:1px solid #c4ccd8;border-radius:10px;padding:10px 8px;text-align:center}
.k b{font-size:21px;color:#b4570a}
.k small{font-size:11px;color:#5b6878;margin-left:3px}
.k span{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#5b6878;margin-top:3px}
.gr{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}
section{border:1px solid #c4ccd8;border-radius:10px;padding:12px 14px 6px;background:#fafbfc;break-inside:avoid}
h3{margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#5b6878;display:flex;align-items:center;gap:8px}
h3 i{font-style:normal;font-size:15px}
h3 em{margin-left:auto;font-style:normal;background:#f3e2cf;color:#b4570a;border-radius:10px;padding:0 8px;font-size:11px;letter-spacing:0}
table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:6px}
th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#5b6878;font-weight:600;padding:4px 6px;border-bottom:1px solid #c4ccd8}
td{padding:6px;border-bottom:1px solid #e3e7ee}
tr:last-child td{border-bottom:0}
.r{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
td.r small{color:#5b6878}
td.bx{width:22px}
td.bx i{display:block;width:13px;height:13px;border:1.5px solid #5b6878;border-radius:3px;background:#fff}
.tot{display:flex;justify-content:flex-end;align-items:baseline;gap:12px;margin:14px 0 8px;padding:10px 14px;border:1px solid #c4ccd8;border-radius:10px;background:#eef1f5;font-weight:600}
.tot b{font-size:20px;color:#b4570a}
.vide{padding:36px;text-align:center;color:#5b6878}
footer{padding:8px 22px 12px;text-align:center;font-size:10.5px;color:#8a95a5}
</style></head><body><div class="box"><header><svg class="g" viewBox="0 0 46 56" width="40" height="48">${bxGlass('#d9962a').replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg><div><h1>Liste de courses</h1><div class="m"><span>${dt}</span><span>${L.length} article${L.length > 1 ? 's' : ''}</span></div></div></header><div class="bd">${
    L.length
      ? `<div class="ks">${kinds.map(t => tile(CNM[t], L.filter(c => c.t === t).length)).join('')}${tile('Estimation', cfr(courTot(), 2), '€')}</div><div class="gr">${kinds.map(card).join('')}</div><div class="tot">Total estimé <b>${cfr(courTot(), 2)} €</b></div>`
      : '<div class="vide">La liste de courses est vide.</div>'
  }</div><footer>OpenMaltForge — estimation d’après les prix de la base</footer></div></body></html>`;
}
/* mise à l'échelle : toute la liste tient sur une seule feuille A4 (marges 14 mm → 269 mm utiles) */
function coursesFit(w) {
  const bx = w.document.querySelector('.box');
  if (!bx) return 1;
  const avail = (269 * 96) / 25.4 - 4,
    h = bx.getBoundingClientRect().height;
  const z = h > avail ? Math.max(0.35, avail / h) : 1;
  bx.style.zoom = z;
  return z;
}
function coursesPrint() {
  const f = document.createElement('iframe');
  /* largeur utile d'un A4 (210 − 2×14 mm) pour que la mise en page mesurée soit celle de l'impression */
  f.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + Math.round((182 * 96) / 25.4) + 'px;height:1200px;border:0';
  document.body.appendChild(f);
  const w = f.contentWindow;
  w.document.open();
  w.document.write(coursesHtml());
  w.document.close();
  /* document à part : traduit ici (le traducteur de la page ne le voit pas) */
  if (LANG !== 'fr') {
    w.document.documentElement.lang = LANG;
    trTree(w.document.head.querySelector('title'));
    trTree(w.document.body);
  }
  const go = () => {
    f.dataset.zoom = coursesFit(w);
    if (!window.__bcNoPrint) {
      w.focus();
      w.print();
    }
    setTimeout(() => f.remove(), 60000);
  };
  setTimeout(go, 150);
}
function fillCosts() {
  const C = costs(),
    e = x => x.toFixed(2).replace('.', ',');
  [
    ['malts', C.mal],
    ['hops', C.hop],
    ['yeasts', C.yea],
    ['ings', C.ing],
    ['conso', C.rco]
  ].forEach(([k, a]) => {
    a.forEach((v, i) => {
      const el = $(`#cs-${k}-${i}`);
      if (el) el.textContent = e(v);
    });
    const t = $('#cost-' + k);
    if (t) t.textContent = e(a.reduce((x, y) => x + y, 0) + (k === 'conso' ? C.cmin : 0));
  });
  const tm = $('#cost-ings');
  if (tm) tm.textContent = e(C.ti + C.cons);
  const rows = [
      ['Malts', C.tm],
      ['Houblons', C.th],
      ['Levures', C.ty],
      ['Ingrédients', C.ti],
      ['Électricité', C.el],
      ['Eau', C.eau],
      ['Consommables', C.cons]
    ],
    tot = rows.reduce((x, r) => x + r[1], 0),
    V = +S.kv.equip.vol || 1;
  $('#costs').innerHTML =
    rows.map(([l, v]) => `<tr><td>${l}</td><td class="pc">${e(v)} €</td></tr>`).join('') +
    `<tr class="sum"><td>Total</td><td class="pc">${e(tot)} €</td></tr><tr><td><small>Coût au litre</small></td><td class="pc"><small>${e(tot / V)} €/L</small></td></tr>`;
}
/* Graphiques */
/* valeur d'un point de radar (virgule décimale, 2 décimales au plus) */
const rvFmt = v => String(+(+v).toFixed(2)).replace('.', ',');
/* infobulle des points de radar : après 1 s de survol, la valeur numérique du point s'affiche */
(function () {
  if (typeof document === 'undefined') return;
  let t = 0;
  const hide = () => {
    clearTimeout(t);
    t = 0;
    const x = document.getElementById('rtip');
    if (x) x.remove();
  };
  document.addEventListener('mouseover', e => {
    const c = e.target.closest && e.target.closest('circle.rpt');
    if (!c) return;
    hide();
    const px = e.clientX,
      py = e.clientY;
    t = setTimeout(() => {
      t = 0;
      if (!c.isConnected) return;
      const d = c.dataset,
        el = document.createElement('div');
      el.id = 'rtip';
      if (d.t) {
        const sm = document.createElement('small');
        sm.textContent = d.t;
        el.appendChild(sm);
        el.appendChild(document.createElement('br'));
      }
      el.appendChild(document.createTextNode(d.a + ' : '));
      const b = document.createElement('b');
      b.textContent = d.v;
      el.appendChild(b);
      el.style.left = Math.min(px + 12, innerWidth - 220) + 'px';
      el.style.top = py + 16 + 'px';
      document.body.appendChild(el);
      const r = el.getBoundingClientRect();
      if (r.bottom > innerHeight - 6) el.style.top = Math.max(6, py - r.height - 12) + 'px';
    }, 1000);
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest && e.target.closest('circle.rpt')) hide();
  });
  document.addEventListener('click', hide, true);
})();
function radar(title, keys, vals, W, H, col) {
  const n = keys.length,
    R = Math.min(W / 2 - 128, H / 2 - 28),
    cx = W / 2,
    cy = H / 2 + 6,
    id = 'rg' + title.replace(/\W/g, ''),
    pt = (i, r) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    },
    ring = k => keys.map((_, i) => pt(i, (R * k) / 5).join()).join(' ');
  let s = `<div class="panel"><h4>${title}</h4><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><radialGradient id="${id}"><stop offset="0" stop-color="${col}" stop-opacity=".12"/><stop offset="1" stop-color="${col}" stop-opacity=".55"/></radialGradient></defs>`;
  for (let k = 5; k >= 1; k--)
    s += `<polygon class="rg${k === 5 ? ' out' : ''}" style="fill:${k === 5 ? 'rgba(255,255,255,.07)' : 'none'}" points="${ring(k)}"/>`;
  keys.forEach((k, i) => {
    const [x, y] = pt(i, R),
      [a, b] = pt(i, R + 9),
      an = a < cx - 6 ? 'end' : a > cx + 6 ? 'start' : 'middle',
      v = Math.min(5, +vals[i] || 0);
    s += `<line class="g" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/><text class="rl" x="${a}" y="${b + 3}" text-anchor="${an}">${HFR[k] || k.replace(/_/g, ' ')} <tspan fill="${col}" font-weight="700">${v > 0 ? v.toFixed(1) : ''}</tspan></text>`;
  });
  const P = vals.map((v, i) => pt(i, (R * Math.min(5, +v || 0)) / 5)),
    has = vals.some(v => +v > 0);
  if (has)
    s += `<polygon class="vv" points="${P.map(q => q.join()).join(' ')}" fill="url(#${id})" stroke="${col}" style="filter:drop-shadow(0 0 5px ${col})"/>`;
  P.forEach((q, i) => {
    if (has && (+vals[i] || 0) > 0)
      s += `<circle cx="${q[0]}" cy="${q[1]}" r="3.2" fill="${col}" stroke="#1b2028" stroke-width="1.5"/><circle class="rpt" cx="${q[0]}" cy="${q[1]}" r="9" fill="transparent" data-t="${esc(hh(title))}" data-a="${esc(hh(HFR[keys[i]] || keys[i].replace(/_/g, ' ')))}" data-v="${rvFmt(Math.min(5, +vals[i] || 0))}"/>`;
  });
  for (let k = 1; k <= 5; k++) s += `<text class="rn" x="${cx + 4}" y="${cy - (R * k) / 5 + 11}">${k}</text>`;
  return s + `</svg></div>`;
}
const RCOL = ['#8fd14f', '#F5D63D', '#4fc3f7', '#ff8a65', '#ce93d8'],
  RK = { malts: MA, hops: HA, yeasts: YA };
function radarMulti(keys, series, W, H) {
  const n = keys.length,
    R = Math.min(W / 2 - 128, H / 2 - 28),
    cx = W / 2,
    cy = H / 2 + 6,
    pt = (i, r) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    },
    ring = k => keys.map((_, i) => pt(i, (R * k) / 5).join()).join(' ');
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  for (let k = 5; k >= 1; k--)
    s += `<polygon class="rg${k === 5 ? ' out' : ''}" style="fill:${k === 5 ? 'rgba(255,255,255,.07)' : 'none'}" points="${ring(k)}"/>`;
  keys.forEach((k, i) => {
    const [x, y] = pt(i, R),
      [a, b] = pt(i, R + 9),
      an = a < cx - 6 ? 'end' : a > cx + 6 ? 'start' : 'middle';
    s += `<line class="g" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/><text class="rl" x="${a}" y="${b + 3}" text-anchor="${an}">${HFR[k] || k.replace(/_/g, ' ')}</text>`;
  });
  series
    .filter(o => o.vals.some(v => +v > 0))
    .forEach(o => {
      const P = o.vals.map((v, i) => pt(i, (R * Math.min(5, +v || 0)) / 5));
      s += `<polygon points="${P.map(q => q.join()).join(' ')}" fill="${o.col}" fill-opacity=".14" stroke="${o.col}" stroke-width="2"/>`;
      P.forEach(
        (q, i) =>
          (s += `<circle cx="${q[0]}" cy="${q[1]}" r="3" fill="${o.col}" stroke="#1b2028" stroke-width="1.2"/><circle class="rpt" cx="${q[0]}" cy="${q[1]}" r="9" fill="transparent" data-t="${esc(hh(o.name || ''))}" data-a="${esc(hh(HFR[keys[i]] || keys[i].replace(/_/g, ' ')))}" data-v="${rvFmt(Math.min(5, +o.vals[i] || 0))}"/>`)
      );
    });
  for (let k = 1; k <= 5; k++) s += `<text class="rn" x="${cx + 4}" y="${cy - (R * k) / 5 + 11}">${k}</text>`;
  return s + '</svg>';
}
const ERASER =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16.2 3.8l4 4a1.6 1.6 0 010 2.3L11 19.3H6.4L3.8 16.7a1.6 1.6 0 010-2.3l9.6-9.6a1.6 1.6 0 012.3-.1z"/><path d="M9.3 8.9l5.8 5.8"/><path d="M11 19.3h9"/></svg>';
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('button.er');
  if (!b) return;
  e.preventDefault();
  if (b.dataset.erase === 'rs') {
    const t = b.dataset.t,
      E = S.kv.equip;
    E.rsel = E.rsel || {};
    const a = rvSel(t);
    a[+b.dataset.i] = '';
    E.rsel[t] = a;
    const inp = document.querySelector(`[data-rs="${t}"][data-rx="${b.dataset.i}"]`);
    if (inp) {
      inp.value = '';
      inp.focus();
    }
    drawRv(t);
    save();
  } else if (b.dataset.erase === 'ft') {
    const f = document.getElementById('ftf');
    if (f) {
      f.value = '';
      f.focus();
      f.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
});
function drawRv(t) {
  const el = $('#rview');
  if (!el) return;
  const keys = RK[t],
    sel = rvSel(t)
      .filter(Boolean)
      .map(n => find(t, n))
      .filter(Boolean);
  const W = 480,
    H = 336;
  el.innerHTML =
    radarMulti(
      keys,
      sel.map((o, i) => ({ vals: keys.map(k => +o[k] || 0), col: RCOL[i % 5], name: lab(t, o) })),
      W,
      H
    ) +
    `<div class="rleg">${sel.map((o, i) => `<span><i style="background:${RCOL[i % 5]}"></i>${hh(lab(t, o))}</span>`).join('')}</div>`;
  pngBtns(el);
  if (t === 'yeasts') {
    const m = document.createElement('div');
    m.className = 'rvmain';
    while (el.firstChild) m.appendChild(el.firstChild);
    el.appendChild(m);
    const c = document.createElement('div');
    c.className = 'yfl';
    c.innerHTML = yeastFlow(sel);
    el.appendChild(c);
    el.classList.add('rv2');
  } else el.classList.remove('rv2');
}
/* diagramme : plages d'atténuation et de floculation de chaque levure sélectionnée */
function yeastFlow(sel) {
  const W = 360,
    L = 14,
    R = 14,
    pw = W - L - R,
    rowH = 15,
    gap = 14,
    top = 44,
    H = top + Math.max(1, sel.length) * (2 * rowH + gap + 16) + 26,
    X = v => L + (pw * Math.max(0, Math.min(100, v))) / 100;
  let g = `<svg class="yf" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Floculation et atténuation des levures">`;
  g += `<text class="yt" x="${L}" y="16">Atténuation et floculation (%)</text>`;
  g += `<rect x="${L}" y="24" width="10" height="8" rx="2" fill="#fff"/><text class="yl" x="${L + 15}" y="32">atténuation</text><rect x="${L + 95}" y="24" width="10" height="8" rx="2" fill="none" stroke="#fff" stroke-dasharray="2 1.5"/><text class="yl" x="${L + 110}" y="32">floculation</text>`;
  const ax = top - 6,
    bot = H - 22;
  for (let k = 0; k <= 100; k += 20)
    g += `<line class="yg" x1="${X(k)}" y1="${ax}" x2="${X(k)}" y2="${bot}"/><text class="yl" x="${X(k)}" y="${H - 8}" text-anchor="middle">${k}</text>`;
  if (!sel.length)
    g += `<text class="yl" x="${W / 2}" y="${H / 2}" text-anchor="middle">Sélectionnez des levures</text>`;
  sel.forEach((o, i) => {
    const col = RCOL[i % 5],
      y0 = top + i * (2 * rowH + gap + 16),
      nm = hh(lab('yeasts', o)),
      r = (a, b, yy, hatch, t) => {
        a = +a || 0;
        b = +b || 0;
        if (b < a) [a, b] = [b, a];
        const w = Math.max(X(b) - X(a), 3);
        return `<rect x="${X(a)}" y="${yy}" width="${w}" height="${rowH - 3}" rx="3" fill="${col}" fill-opacity="${hatch ? 0.18 : 0.9}" stroke="${col}" stroke-width="1.4"${hatch ? ' stroke-dasharray="3 2"' : ''}><title>${t} ${a}–${b} %</title></rect><text class="yv" x="${b > 78 ? X(a) - 5 : X(b) + 5}" y="${yy + rowH - 5}"${b > 78 ? ' text-anchor="end"' : ''}>${a}–${b}</text>`;
      };
    g +=
      `<text class="yn" x="${L}" y="${y0 + 10}" style="fill:${col}">${nm}</text>` +
      r(o.att_min, o.att_max, y0 + 16, 0, 'Atténuation') +
      r(o.floc_min, o.floc_max, y0 + 16 + rowH + 2, 1, 'Floculation');
  });
  return g + '</svg>';
}

function aroma(kind, keys) {
  const R = S.kv.recipe;
  let tot = 0,
    v = keys.map(() => 0);
  R[kind].forEach(x => {
    const d = find(kind, x.n);
    if (d && x.g > 0) {
      tot += x.g;
      keys.forEach((k, i) => (v[i] += x.g * (+d[k] || 0)));
    }
  });
  return tot ? v.map(x => x / tot) : v;
}
function bar(v, a, b, drag) {
  if (a == null || isNaN(a)) return '<div class="bar" style="background:#1b2028"></div>';
  const w = Math.max(b - a, ((a + b) / 2) * 0.02),
    lo = a - w,
    hi = b + w,
    g1 = ((a - lo) / (hi - lo)) * 100,
    g2 = ((b - lo) / (hi - lo)) * 100,
    p = Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
  /* 6.7.0 : DI et IBU — curseur déplaçable (poignée ronde au-dessus) qui règle la cible */
  const dg = drag
    ? ` drag" data-drag="${drag}" data-lo="${lo}" data-hi="${hi}" data-v="${v}" title="${esc(noIc(tx(drag === 'og' ? 'Glisser la poignée : règle la DI cible, puis recalcule la recette' : 'Glisser la poignée : règle l’IBU cible, puis recalcule la recette')))}`
    : '';
  return `<div class="bar${dg}" style="background:linear-gradient(90deg,#d33 0%,#f90 ${g1 / 2}%,#4b4 ${g1}%,#4b4 ${g2}%,#f90 ${(g2 + 100) / 2}%,#d33 100%)"><s style="left:${p}%">${drag ? '<i class="knob"></i>' : ''}</s></div>`;
}
/* glisser la poignée d'un curseur DI / IBU : la cible varie comme la valeur affichée (cible + déplacement), le champ
   « DI cible » / « IBU cible » suit en direct ; au relâchement, la recette est recalculée (bouton Calculer) */
/* place le curseur DI / IBU du bilan sur la valeur v (saisie de la cible) */
function tgtCursor(k, v) {
  const b = document.querySelector(`#bilan .bar.drag[data-drag="${k}"]`);
  if (!b) return;
  const lo = +b.dataset.lo,
    hi = +b.dataset.hi,
    x = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  b.querySelector('s').style.left = x * 100 + '%';
  const lb = b.parentElement && b.parentElement.querySelector('.bl b');
  if (lb) lb.textContent = (+v).toFixed(k === 'og' ? 3 : 1);
}
document.addEventListener('change', e => {
  const t = e.target;
  if (!t || !t.matches || !t.matches('input[data-r="ogT"], input[data-r="ibuT"]')) return;
  if (!isNaN(parseFloat(t.value))) adjust();
});
let BDRAG = null;
document.addEventListener('pointerdown', e => {
  const k = e.target.closest && e.target.closest('.bar.drag .knob, .bar.drag s');
  if (!k) return;
  const b = k.closest('.bar.drag'),
    R = S.kv.recipe,
    f = b.dataset.drag === 'og' ? 'ogT' : 'ibuT';
  e.preventDefault();
  BDRAG = { b, f, s: b.querySelector('s'), lo: +b.dataset.lo, hi: +b.dataset.hi, v0: +b.dataset.v, t0: parseFloat(R[f]) || +b.dataset.v };
  b.classList.add('on');
  try {
    k.setPointerCapture(e.pointerId);
  } catch (_) {}
});
document.addEventListener('pointermove', e => {
  if (!BDRAG) return;
  const D = BDRAG,
    r = D.b.getBoundingClientRect(),
    x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
    v = D.lo + x * (D.hi - D.lo),
    og = D.f === 'ogT';
  let t = D.t0 + (v - D.v0);
  t = og ? Math.max(1.01, Math.min(1.2, Math.round(t * 1000) / 1000)) : Math.max(0.1, Math.round(t * 10) / 10);
  D.s.style.left = x * 100 + '%';
  D.t = t;
  S.kv.recipe[D.f] = t;
  const inp = document.querySelector(`input[data-r="${D.f}"]`);
  if (inp) inp.value = t;
  const lb = D.b.parentElement && D.b.parentElement.querySelector('.bl b');
  if (lb) lb.textContent = v.toFixed(og ? 3 : 1);
});
const bdragEnd = () => {
  if (!BDRAG) return;
  const D = BDRAG;
  BDRAG = null;
  D.b.classList.remove('on');
  if (D.t !== undefined) adjust();
};
document.addEventListener('pointerup', bdragEnd);
document.addEventListener('pointercancel', bdragEnd);
/* Écran conception */
const HD = {
    malts: ['Malt', 'Poids (kg)', '%', 'Coût (€)'],
    hops: ['Houblon', 'Poids (g)', '%', 'α %', 'Usage', 'Min', 'IBU', 'Coût (€)'],
    yeasts: ['Levure', 'Sachets', 'Atténuation', 'Floculation', 'Coût (€)'],
    ings: ['Ingrédient', 'Poids (g)', 'Coût (€)'],
    conso: ['Consommable', 'Quantité', 'Coût (€)']
  },
  XTRA = { malts: 1, hops: 5, yeasts: 2, ings: 0, conso: 0 };
const tbl = (k, title) => {
  const R = S.kv.recipe,
    hd = HD[k];
  R[k] = R[k] || [];
  let h = `<div class="panel"><h3>${title}<button data-add="${k}">＋</button></h3><table><tr>${hd.map(x => `<th>${x}</th>`).join('')}<th></th></tr>`;
  R[k].forEach((r, i) => {
    const a = `data-k="${k}" data-i="${i}"`;
    h += `<tr><td><input class="nm rin" list="dl-${k}" ${a} data-f="n" value="${esc(r.n)}" placeholder="3 lettres min…"></td><td><input class="rin" type="number" min="0" step="${k === 'malts' ? 0.001 : k === 'hops' || k === 'ings' ? 0.1 : 1}" ${a} data-f="g" value="${k === 'malts' ? r.g / 1000 : r.g}"${PMODE[k] === 'p' ? ' readonly' : ''}></td>`;
    if (k === 'malts' || k === 'hops')
      h += `<td><input class="rin pcin" type="number" min="0" step="0.1" ${a} data-f="p" value=""${PMODE[k] !== 'p' ? ' readonly' : ''}></td>`;
    if (k === 'hops')
      h += `<td class="pc" id="al${i}"></td><td><select class="rin" ${a} data-f="use">${USES.map(u => `<option${u === r.use ? ' selected' : ''}>${u}</option>`).join('')}</select></td><td><input class="rin" type="number" min="0" step="1" ${a} data-f="t" value="${r.t}"></td><td class="pc" id="ib${i}"></td>`;
    if (k === 'yeasts') h += `<td class="pc" id="ya${i}"></td><td class="pc" id="yf${i}"></td>`;
    h += `<td class="pc" id="cs-${k}-${i}"></td>`;
    h += `<td class="xc"><button class="cart" data-cart="${k}" data-i="${i}" hidden>🛒</button><button class="x" data-del="${k}" data-i="${i}" title="Supprimer">✕</button></td></tr>`;
  });
  return (
    h +
    (k === 'conso' ? `<tbody id="minrows">${minRows()}</tbody>` : '') +
    `<tr class="sum"><td>Total</td><td id="sum-${k}"></td>${k === 'malts' || k === 'hops' ? `<td class="pc" id="psum-${k}"></td>` + (k === 'hops' ? '<td></td>'.repeat(XTRA[k] - 2) + '<td class="pc" id="ibu-t" title="Total des IBU (Tinseth)"></td>' : '<td></td>'.repeat(XTRA[k] - 1)) : k === 'yeasts' ? '<td class="pc" id="ya-t" title="Moyenne des levures"></td><td class="pc" id="yf-t" title="Moyenne des levures"></td>' : '<td></td>'.repeat(XTRA[k])}<td id="cost-${k}"></td></tr></table><datalist id="dl-${k}"></datalist></div>`
  );
};

/* section unique « Ingrédients & consommables » : les lignes se rangent dans R.ings (grammes) ou R.conso (unités) selon la table de la base où le nom est trouvé */
const tblMix = () => {
  const R = S.kv.recipe;
  R.ings = R.ings || [];
  R.conso = R.conso || [];
  /* un nom qui n'existe que dans la table Consommables est rangé avec les consommables (ex. après une correspondance à l'import) */
  for (let i = R.ings.length - 1; i >= 0; i--) {
    const n = R.ings[i].n;
    if (n && !find('ings', n) && find('conso', n)) R.conso.push(R.ings.splice(i, 1)[0]);
  }
  const row = (k, r, i) => {
    const a = `data-k="${k}" data-i="${i}"`;
    return `<tr><td><input class="nm rin" list="dl-ings" ${a} data-f="n" value="${esc(r.n)}" placeholder="3 lettres min…"></td><td><input class="rin" type="number" min="0" step="${k === 'ings' ? 0.1 : 1}" ${a} data-f="g" value="${r.g}"></td><td class="un">${k === 'ings' ? 'g' : esc((find('conso', r.n) || {}).unite || 'unité')}</td><td class="pc" id="cs-${k}-${i}"></td><td class="xc"><button class="cart" data-cart="${k}" data-i="${i}" hidden>🛒</button><button class="x" data-del="${k}" data-i="${i}" title="Supprimer">✕</button></td></tr>`;
  };
  return `<div class="panel"><h3>🧂 Ingrédients &amp; consommables<button data-add="ings">＋</button></h3><table><tr><th>Ingrédient / consommable</th><th>Quantité</th><th>Unité</th><th>Coût (€)</th><th></th></tr>${R.ings.map((r, i) => row('ings', r, i)).join('')}${R.conso.map((r, i) => row('conso', r, i)).join('')}<tbody id="minrows">${minRows()}</tbody><tr class="sum"><td>Total</td><td id="sum-ings"></td><td></td><td id="cost-ings"></td><td></td></tr></table><datalist id="dl-ings"></datalist></div>`;
};

const CO2T = [
  1.2, 1.16, 1.12, 1.08, 1.04, 1.01, 0.98, 0.94, 0.92, 0.89, 0.86, 0.84, 0.81, 0.79, 0.77, 0.76, 0.74, 0.73, 0.72, 0.71,
  0.7
];
const co2res = t => {
  t = Math.min(30, Math.max(10, +t || 0));
  const i = Math.floor(t),
    f = t - i;
  return CO2T[i - 10] + (i < 30 ? (CO2T[i - 9] - CO2T[i - 10]) * f : 0);
};
/* ratio d'empâtage : avertissement dès que « Volume d’eau + malt (L) » (Process) ≥ « Volume maxi empâtage + malt dans la cuve (L) » (Paramètres de brassage) ;
   affiché aussi comme notification orange dans la zone de notification, jusqu'à correction */
function ratioWarn(o) {
  let over = false;
  try {
    o = o || wcalc();
    const cm = wIn('cmax');
    over = cm > 0 && o.vgr >= cm - 1e-9;
    warnSet(
      'ratio',
      over
        ? `⚠ Ratio d’empâtage : Volume d’eau + malt (${nf(o.vgr, 1)} L) ≥ volume maxi empâtage + malt dans la cuve (${nf(cm, 1)} L) — réduire le ratio d’empâtage.`
        : ''
    );
  } catch (e) {}
  return over;
}
function fillWater() {
  const t = $('#wtab');
  if (!t) return;
  const R = S.kv.recipe,
    o = wcalc(),
    kg = wIn('kg'),
    f = (v, d) => nf(v, d),
    set = (id, v) => {
      const e = $('#' + id);
      if (e) e.textContent = v;
    },
    ratio = $('#ratioro');
  if (ratio && document.activeElement !== ratio) ratio.value = S.kv.equip.ratio;
  const over = ratioWarn(o),
    tip = `Volume d’eau + malt (${f(o.vgr, 1)} L) ≥ volume maxi empâtage + malt dans la cuve (${f(wIn('cmax'), 1)} L)`;
  set('w-v0', f(o.v0, 2));
  set('w-rinc', f(o.rinc, 2));
  set('w-nog', f(o.v0 + o.rinc, 2));
  set('w-tot', f(o.v0 + o.rinc, 2)); /* 6.10.1 : eau d’empâtage + eau de rinçage */
  set('w-tf', f(o.tf, 1) + ' °C');
  set('w-vm', f(o.v0 + kg, 2));
  [
    ['w-al', over],
    ['ratio-al', over]
  ].forEach(([id, on]) => {
    const e = $('#' + id);
    if (e) {
      e.style.display = on ? 'inline' : 'none';
      e.title = tip;
    }
  });
  set('w-warn', o.rinc < 0 ? '⚠ Eau de rinçage négative (voir Paramètres).' : '');
  const sg = +R.sucre || 0,
    T = R.tcarbo === undefined || R.tcarbo === '' || R.tcarbo === null || isNaN(R.tcarbo) ? 20 : +R.tcarbo,
    res = co2res(T),
    vol = res + sg / 4,
    Vb = o.vbot;
  set('r-res', f(res, 2));
  set('r-vol', f(vol, 2));
  set('r-vb', f(Vb, 1));
  set('r-tot', f(sg * Vb, 0) + ' g');
}
function conception0() {
  const R = S.kv.recipe;
  R.water = R.water || [];
  R.minadd = R.minadd || {};
  R.malts.forEach(m => {
    const d = find('malts', m.n);
    if (d) m.n = labM(d);
  });
  main.innerHTML = `<div class="top"><label>Recette<input data-r="name" value="${esc(R.name)}" style="width:220px"></label>
<label>Style<span class="fselr"><select data-r="style" class="ssel" hidden>${S.styles.some(s => s.name === R.style) ? '' : `<option selected>${hh(R.style)}</option>`}${S.styles.map(s => `<option${s.name === R.style ? ' selected' : ''}>${hh(s.name)}</option>`).join('')}</select><input class="sin" type="text" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" value="${esc(R.style || '')}" placeholder="Choisir ou saisir un style…" title="Liste déroulante ou saisie avec autocomplétion (3 lettres min.)"></span></label>
<label>Volume à embouteiller (L)<input type="number" min="1" step="1" data-e="vol" value="${S.kv.equip.vol}"></label>
<label>Ratio d’empâtage (L/kg)<span class="rin2"><input type="number" min="0" step="0.1" data-e="ratio" id="ratioro" value="${S.kv.equip.ratio}"><span class="al" id="ratio-al" style="display:none">⚠</span></span></label>
<label>Date de brassage<input type="date" data-r="date" value="${R.date || ''}"></label><label>Date d’embouteillage<input type="date" data-r="embou" min="${R.date || ''}" value="${R.embou || ''}"></label>
<div class="tgt"><label>DI cible<input type="number" step="0.001" data-r="ogT" value="${R.ogT ?? ''}"></label><label>IBU cible<input type="number" step="1" data-r="ibuT" value="${R.ibuT ?? ''}"></label><button class="go" id="calc">Calculer</button></div><span class="rt"><button id="newrec">＋ Nouvelle recette</button></span></div>
<div class="radars" id="radars"></div>
<div class="grid"><div class="col">${tbl('malts', '🌾 Malts')}${tbl('hops', '🌿 Houblons')}${tbl('yeasts', '🧫 Levures')}${mineralPanel()}${tblMix()}<div id="courses">${coursesBox()}</div>${orgPanel()}</div>
<div class="col"><div class="panel"><h3>Bilan de la recette</h3><div id="bilan"></div></div>${mashPanel()}<div class="panel"><h3>Quantités d’eau</h3><table id="wtab" class="kv"><tr><td>Eau d’empâtage <span class="al" id="w-al" style="display:none">⚠</span></td><td class="pc" id="w-v0"></td></tr>
<tr><td>Eau de rinçage</td><td class="pc" id="w-rinc"></td></tr>
<tr class="sum"><td>Empâtage + rinçage</td><td class="pc" id="w-tot"></td></tr>
<tr><td colspan="2" id="w-warn" style="color:#ffb4b4"></td></tr></table></div><div class="panel"><h3>Resucrage & CO₂</h3><table id="rtab" class="kv"><tr><td>Sucre de resucrage (g/L)</td><td><input type="number" min="0" step="0.1" data-r="sucre" value="${R.sucre ?? ''}"></td></tr>
<tr><td>Température de la bière (°C)</td><td><input type="number" min="10" max="30" step="0.5" data-r="tcarbo" value="${R.tcarbo ?? ''}" placeholder="20"></td></tr>
<tr><td>CO₂ résiduel à cette température (vol)</td><td class="pc" id="r-res"></td></tr>
<tr class="sum"><td>CO₂ après refermentation (vol)</td><td class="pc" id="r-vol"></td></tr>
<tr><td>Volume resucré / embouteillé (L)</td><td class="pc" id="r-vb"></td></tr>
<tr class="sum"><td>Quantité totale de sucre pour l’embouteillage</td><td class="pc" id="r-tot"></td></tr></table></div><div class="panel"><h3>Récapitulatif des coûts</h3><table id="costs" class="kv"></table></div></div></div>`;
  refresh();
  updOrg();
}
/* Analyse organoleptique du brassin (visible dès que la date d’embouteillage est renseignée) — grille BJCP : arôme /12, aspect /3, saveur /20, bouche /5, impression /10 */
const ORG = [
  ['aro', 'Arôme', 12, 'Malt, houblon, esters, phénols, défauts…'],
  ['app', 'Aspect', 3, 'Robe, limpidité, mousse (tenue, finesse)'],
  ['fla', 'Saveur', 20, 'Malt, houblon, amertume, équilibre, finale, arrière-goût'],
  ['bou', 'Sensation en bouche', 5, 'Corps, carbonatation, chaleur alcoolique, astringence'],
  ['imp', 'Impression générale', 10, 'Plaisir de boire, conformité au style, pistes d’amélioration']
];
const ORGS = {
    rob: ['Paille', 'Or', 'Ambre', 'Cuivre', 'Brun', 'Noir'],
    lim: ['Brillante', 'Légèrement voilée', 'Trouble'],
    mou: ['Aucune', 'Fine et persistante', 'Dense', 'Éphémère'],
    car: ['Plate', 'Faible', 'Moyenne', 'Forte', 'Très forte']
  },
  ORGL = { rob: 'Robe', lim: 'Limpidité', mou: 'Mousse', car: 'Carbonatation' };
function orgPanel() {
  const R = S.kv.recipe,
    O = R.org || {},
    sel = k =>
      `<label>${ORGL[k]}<select data-o="${k}"><option value=""></option>${ORGS[k].map(x => `<option${O[k] === x ? ' selected' : ''}>${x}</option>`).join('')}</select></label>`;
  return `<div class="panel" id="orga"${R.embou ? '' : ' hidden'}><h3>🍺 Analyse organoleptique du brassin<span id="o-tot" class="otot"></span></h3>
<div class="eq orgq"><label>Date de dégustation<input type="date" data-o="ddeg" value="${esc(O.ddeg || '')}"></label><label>DI mesurée<input type="number" step="0.001" min="1" data-o="di" value="${esc(O.di ?? '')}" placeholder="1.050"></label><label>DF mesurée<input type="number" step="0.001" min="0.99" data-o="df" value="${esc(O.df ?? '')}" placeholder="1.010"></label><label>ABV réel (%)<span class="pc" id="o-abv" style="padding:4px 0">–</span></label>${['rob', 'lim', 'mou', 'car'].map(sel).join('')}</div>
<div class="ogrid">${ORG.map(([k, l, m, h]) => `<div class="ob"><div class="oh"><b>${l}</b><span><input type="number" min="0" max="${m}" step="0.5" data-o="s_${k}" value="${esc(O['s_' + k] ?? '')}"> / ${m}</span></div><textarea data-o="t_${k}" rows="4" placeholder="${esc(h)}">${hh(O['t_' + k] || '')}</textarea></div>`).join('')}</div></div>`;
}
function updOrg() {
  const R = S.kv.recipe,
    O = R.org || {},
    t = $('#o-tot'),
    a = $('#o-abv');
  if (!t) return;
  let s = 0,
    any = false;
  ORG.forEach(([k]) => {
    if (O['s_' + k] !== undefined && O['s_' + k] !== '') {
      s += +O['s_' + k] || 0;
      any = true;
    }
  });
  t.textContent = any ? 'Note : ' + nf(s, 1).replace(',0', '') + ' / 50' : '';
  const di = parseFloat(O.di),
    df = parseFloat(O.df);
  a.textContent = di > 1 && df > 0 && di >= df ? nf((di - df) * 131.25, 1) + ' %' : '–';
}
/* Eau & minéraux */
const MCO = {
  ca: 'Minéral Ca (g)',
  mg: 'Minéral Mg (g)',
  na: 'Minéral Na (g)',
  cl: 'Minéral Cl (g)',
  so4: 'Minéral SO4 (g)',
  hco3: 'Minéral HCO3 (g)'
};
let WMODE = 'p';
const wTot = () => {
  try {
    const o = wcalc();
    return Math.max(0, o.v0 + o.rinc);
  } catch (e) {
    return 0;
  }
};
function wnorm() {
  const W = S.kv.recipe.water || [];
  if (WMODE !== 'g') return;
  const sl = W.reduce((s, y) => s + (+y.l || 0), 0);
  W.forEach(y => (y.p = sl > 0 ? ((+y.l || 0) / sl) * 100 : 0));
}
function minSub() {
  const R = S.kv.recipe,
    W = R.water || [],
    ps = W.reduce((s, x) => s + (+x.p || 0), 0),
    o = {};
  IONS.forEach(k => {
    let v = 0;
    W.forEach(x => {
      const d = find('eaux', x.n);
      if (d && ps > 0) v += ((+d[k] || 0) * (+x.p || 0)) / ps;
    });
    o[k] = v;
  });
  return o;
}
function minTot() {
  const R = S.kv.recipe,
    o = minSub();
  IONS.forEach(k => (o[k] += +(R.minadd || {})[k] || 0));
  return o;
}
function minCost() {
  const R = S.kv.recipe,
    V =
      (() => {
        try {
          return wcalc().tot;
        } catch (e) {
          return 0;
        }
      })() || 0,
    r = [];
  let tot = 0;
  IONS.forEach(k => {
    const a = +(R.minadd || {})[k] || 0;
    if (a > 0) {
      const g = (a * V) / 1000,
        pr = +(find('ings', MCO[k]) || {}).prix_g || 0;
      r.push({ k, g, c: g * pr });
      tot += g * pr;
    }
  });
  return { r, tot };
}
const minRows = () =>
  minCost()
    .r.map(
      x =>
        `<tr class="mr"><td><input class="nm rin" readonly tabindex="-1" value="${esc(MCO[x.k])} — auto"></td><td><input class="rin" type="number" readonly tabindex="-1" value="${x.g.toFixed(2)}"></td><td class="un">g</td><td class="pc">${nf(x.c, 2)}</td><td></td></tr>`
    )
    .join('');
function mineralPanel() {
  const R = S.kv.recipe,
    W = R.water;
  let h = `<div class="panel" id="wmin"><h3>💧 Eau & minéraux<button data-wadd="1">＋</button></h3><div class="scr"><table class="wm"><tr><th>Eau</th><th>Litres</th><th>%</th>${IONS.map(k => `<th>${EIL[k]}</th>`).join('')}<th></th></tr>`;
  W.forEach((x, i) => {
    h += `<tr><td><input class="nm rin" list="dl-eaux" data-wi="${i}" data-wf="n" value="${esc(x.n)}" placeholder="3 lettres min…"></td><td><input class="rin" type="number" min="0" step="0.1" data-wi="${i}" data-wf="l" value=""${WMODE === 'p' ? ' readonly' : ''}></td><td><input class="rin" type="number" min="0" step="0.1" data-wi="${i}" data-wf="p" value="${esc(x.p ?? 0)}"${WMODE === 'g' ? ' readonly' : ''}></td>${IONS.map(k => `<td class="pc" id="wv-${i}-${k}"></td>`).join('')}<td class="xc"><button class="cart" tabindex="-1" aria-hidden="true" hidden>🛒</button><button class="x" data-wdel="${i}" title="Supprimer">✕</button></td></tr>`;
  });
  h += `<tr class="sum"><td>Sous-total (mg/L)</td><td id="wsl"></td><td id="wsp"></td>${IONS.map(k => `<td id="ws-${k}"></td>`).join('')}<td></td></tr>`;
  h += `<tr class="addr"><td colspan="3">Ajout de minéraux (mg/L)</td>${IONS.map(k => `<td><input class="rin" type="number" min="0" step="1" data-ma="${k}" value="${esc((R.minadd || {})[k] || '')}" placeholder="0"></td>`).join('')}<td></td></tr>`;
  h += `<tr class="sum"><td colspan="3">Total (mg/L) = sous-total + ajout</td>${IONS.map(k => `<td class="pc" id="wt-${k}"></td>`).join('')}<td></td></tr>`;
  h += `<tr class="exp"><td colspan="3"><small>attendu</small></td>${IONS.map(k => `<td class="pc" id="we-${k}"></td>`).join('')}<td></td></tr>`;
  h += `<tr class="rat"><td colspan="3">Ratio SO₄/Cl</td><td class="pc" id="wrat" colspan="2"></td><td colspan="5"></td></tr><tr class="exp"><td colspan="3"><small>attendu</small></td><td class="pc" id="wrat-e" colspan="2"></td><td colspan="5"></td></tr>`;
  return h + `</table></div><div class="wchk" id="wlchk"></div><datalist id="dl-eaux"></datalist></div>`;
}
function fillMin() {
  if (!$('#wmin')) return;
  const R = S.kv.recipe,
    W = R.water || [];
  if (WMODE === 'p') {
    const ps = W.reduce((s, x) => s + (+x.p || 0), 0),
      Tn = wTot();
    W.forEach(x => (x.l = ps > 0 ? (Tn * (+x.p || 0)) / ps : 0));
  }
  document.querySelectorAll('#wmin .rin[data-wf="l"],#wmin .rin[data-wf="p"]').forEach(el => {
    const x = W[+el.dataset.wi];
    if (!x) return;
    const l = el.dataset.wf === 'l';
    el.readOnly = l ? WMODE === 'p' : WMODE === 'g';
    if (document.activeElement !== el) el.value = +(+(l ? x.l : x.p) || 0).toFixed(l ? 2 : 1);
  });
  const T = minTot(),
    st = find('styles', R.style) || {};
  const ps = W.reduce((s, x) => s + (+x.p || 0), 0),
    Tn = wTot(),
    SB = minSub();
  W.forEach((x, i) => {
    const d = find('eaux', x.n);
    IONS.forEach(k => {
      const c = $(`#wv-${i}-${k}`);
      if (c) {
        const sh = ps > 0 ? (+x.p || 0) / ps : 0;
        /* part nulle (0 %) : on affiche quand même la valeur de l'eau, estompée (elle n'entre pas dans le mélange) */
        c.textContent = d ? nf((+d[k] || 0) * (sh > 0 ? sh : 1), 2) : '';
        c.classList.toggle('dim', !!d && !(sh > 0));
        c.title = d && !(sh > 0) ? 'Valeur de cette eau (0 % : n’entre pas dans le mélange)' : '';
        const n = c.querySelector('input');
        if (n)
          n.dataset.tip = d
            ? `Apport = ${nf(+d[k] || 0, 2)} mg/L (valeur de « ${x.n} ») × ${nf(+x.l || 0, 2)} L ÷ ${nf(
                W.reduce((a, y) => a + (+y.l || 0), 0),
                2
              )} L (part de cette eau dans le total des litres).`
            : '';
      }
    });
  });
  const sl = W.reduce((a, y) => a + (+y.l || 0), 0),
    sp = $('#wsp'),
    sll = $('#wsl');
  if (sll) sll.textContent = nf(sl, 2);
  if (sp) sp.textContent = nf(ps, 1) + ' %';
  IONS.forEach(k => {
    const c = $('#ws-' + k);
    if (c) c.textContent = nf(SB[k], 2);
  });
  const ck = $('#wlchk');
  if (ck) {
    const ok = W.length && Math.abs(sl - Tn) <= 0.05;
    ck.className = 'wchk ' + (ok ? 'okc' : 'bad');
    ck.textContent =
      !W.length || ok ? '' : `⚠ Total des litres (${nf(sl, 2)} L) ≠ quantité totale d’eau nécessaire (${nf(Tn, 2)} L).`;
  }
  IONS.forEach(k => {
    const t = $('#wt-' + k),
      e = $('#we-' + k),
      mn = st[k + '_min'],
      mx = st[k + '_max'],
      has = mx !== undefined && mx !== '' && !(mn === 0 && mx === 0);
    if (t) t.textContent = nf(T[k], 2);
    if (e) {
      e.innerHTML = '<small>' + (has ? +(+mn).toFixed(3) + '–' + +(+mx).toFixed(3) : '-') + '</small>';
      e.className = 'pc' + (has ? (T[k] >= mn - 0.005 && T[k] <= mx + 0.005 ? ' okc' : ' bad') : '');
    }
  });
  const wr = $('#wrat'),
    we = $('#wrat-e');
  if (wr) wr.textContent = T.cl > 0 ? nf(T.so4 / T.cl, 2) : '–';
  if (we) {
    const a = st.so4cl_min,
      b = st.so4cl_max,
      ok = a !== '' && a !== undefined && !isNaN(a) && b !== '' && b !== undefined && !isNaN(b);
    we.innerHTML =
      '<small>' + (ok ? (+a === +b ? +(+a).toFixed(2) : +(+a).toFixed(2) + '–' + +(+b).toFixed(2)) : '-') + '</small>';
  }
  const mr = $('#minrows');
  if (mr) mr.innerHTML = minRows();
  const ct = $('#cost-conso');
  if (ct) {
    const C = costs();
    ct.textContent = (C.tco + C.cmin).toFixed(2).replace('.', ',');
  }
}
let PFORCE = false;
const pcv = k => {
  const a = S.kv.recipe[k] || [],
    t = a.reduce((s, x) => s + (+x.g || 0), 0);
  return a.map(x => (x.p !== undefined && x.p !== null && x.p !== '' ? +x.p : t ? (x.g / t) * 100 : 0));
};
const PMODE = { malts: 'g', hops: 'g' },
  PFRESH = {};
const setRO = k => {
  document.querySelectorAll(`.rin[data-k="${k}"][data-f="g"]`).forEach(el => (el.readOnly = PMODE[k] === 'p'));
  document.querySelectorAll(`.rin[data-k="${k}"][data-f="p"]`).forEach(el => (el.readOnly = PMODE[k] !== 'p'));
};
const pclr = k => {
  (S.kv.recipe[k] || []).forEach(x => delete x.p);
  if (S.kv.recipe.pm) delete S.kv.recipe.pm[k];
  if (PMODE[k]) PMODE[k] = 'g';
};
function refresh() {
  if (!$('#sum-malts')) return;
  const R = S.kv.recipe,
    c = compute();
  fillMin();
  ['malts', 'hops', 'yeasts', 'ings', 'conso'].forEach(k => {
    const t = (R[k] || []).reduce((s, x) => s + (+x.g || 0), 0);
    const se = $('#sum-' + k);
    if (se)
      se.textContent =
      k === 'conso'
        ? ''
        : k === 'malts'
          ? (t / 1000).toFixed(3) + ' kg'
          : t.toFixed(k === 'hops' || k === 'ings' ? 1 : 0) +
            (k === 'yeasts' ? ' sachet(s)' : k === 'conso' ? '' : ' g');
  });
  ['malts', 'hops'].forEach(k => {
    const P = pcv(k);
    P.forEach((v, i) => {
      const el = document.querySelector(`.rin[data-k="${k}"][data-i="${i}"][data-f="p"]`);
      if (el && (document.activeElement !== el || PFORCE)) el.value = v ? +v.toFixed(1) : '';
    });
    const ps = $('#psum-' + k);
    if (ps)
      ps.textContent = P.length
        ? nf(
            P.reduce((a, b) => a + b, 0),
            1
          ) + ' %'
        : '';
  });
  R.yeasts.forEach((h, i) => {
    const d = find('yeasts', h.n),
      a = $('#ya' + i),
      f = $('#yf' + i);
    if (a) a.textContent = d ? nf((d.att_min + d.att_max) / 2, 0) + ' %' : '-';
    if (f) f.textContent = d ? nf((d.floc_min + d.floc_max) / 2, 0) + ' %' : '-';
  });
  const ta = $('#ya-t'),
    tf = $('#yf-t');
  if (ta) {
    const m = R.yeasts.length > 1;
    ta.textContent = c.floc === null ? '-' : (m ? 'moy. ' : '') + nf(c.att, 0) + ' %';
    tf.textContent = c.floc === null ? '-' : (m ? 'moy. ' : '') + nf(c.floc, 0) + ' %';
  }
  const it = $('#ibu-t');
  if (it) it.textContent = c.ibus.reduce((a, b) => a + b, 0).toFixed(1);
  R.hops.forEach((h, i) => {
    const d = find('hops', h.n);
    $('#al' + i).textContent = d ? ((d.alpha_min + d.alpha_max) / 2).toFixed(1) : '?';
    $('#ib' + i).textContent = c.ibus[i].toFixed(1);
  });
  const st = find('styles', R.style) || {};
  const rt = ratios(c),
    gm = st.og_min ? ((st.og_min + st.og_max) / 2 - 1) * 1000 : 0,
    ra = gm ? st.ibu_min / gm : undefined,
    rb = gm ? st.ibu_max / gm : undefined;
  $('#bilan').innerHTML =
    [
      ['Densité initiale (DI)', c.og, st.og_min, st.og_max, 3, 'og'],
      ['IBU (Tinseth)', c.ibu, st.ibu_min, st.ibu_max, 1, 'ibu'] /* 6.7.1 : sous la DI (les deux curseurs déplaçables) */,
      ['Densité finale obtenue', c.fg, st.fg_min, st.fg_max, 3],
      ['Atténuation levure' + (R.yeasts.length > 1 ? ' (moy.)' : '') + ' %', c.att, c.attMin, c.attMax, 0],
      [
        'Floculation' + (R.yeasts.length > 1 ? ' (moy.)' : '') + ' %',
        c.floc === null ? 0 : c.floc,
        c.flocMin,
        c.flocMax,
        0
      ],
      ['Couleur (EBC)', c.ebc, st.srm_min * 1.97, st.srm_max * 1.97, 0],
      ['Alcool (% vol.)', c.abv, st.abv_min, st.abv_max, 1],
      ['IBU / DI', rt.ibudi, ra, rb, 2],
      ['RBR', rt.rbr, ra, rb, 2]
    ]
      .map(
        ([l, v, a, b, d, k]) =>
          `<div class="bi"><div class="bl"><span>${l}</span><b>${v.toFixed(d)}</b></div>${bar(v, a, b, k)}<small>attendu : ${a == null || isNaN(a) ? '-' : +(+a).toFixed(3) + '–' + +(+b).toFixed(3)}</small></div>`
      )
      .join('') + colorBar(c.ebc);
  fillCosts();
  updCart();
  fillWater();
  const rcw = $('#radars').clientWidth,
    rn = rcw > 900 ? 3 : rcw > 600 ? 2 : 1,
    rw = Math.floor((rcw - 16 - 8 * (rn - 1)) / rn) - 2 || 400,
    rh = 336;
  $('#radars').innerHTML =
    radar('Houblons', HA, aroma('hops', HA), rw, rh, '#8fd14f') +
    radar('Malts', MA, aroma('malts', MA), rw, rh, '#F5D63D') +
    radar('Levure', YA, aroma('yeasts', YA), rw, rh, '#D0872E');
  pngBtns($('#radars'));
}
/* Bases de données */
function dl(name, data, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  a.click();
}
const csvEsc = v => {
  v = String(v ?? '');
  return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
};
const toCsv = t =>
  '\ufeff' + [COLS[t], ...S[t].map(o => COLS[t].map(c => o[c]))].map(r => r.map(csvEsc).join(';')).join('\r\n');
function parseCsv(txt) {
  txt = txt.replace(/^\ufeff/, '');
  const l0 = txt.split('\n')[0],
    sep = [';', ',', '\t'].map(x => [x, l0.split(x).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let r = [],
    f = '',
    q = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) {
      if (ch === '"') {
        if (txt[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) {
      r.push(f);
      f = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && txt[i + 1] === '\n') i++;
      r.push(f);
      f = '';
      if (r.some(x => x !== '')) rows.push(r);
      r = [];
    } else f += ch;
  }
  r.push(f);
  if (r.some(x => x !== '')) rows.push(r);
  return rows;
}
function recalcMalts() {
  S.malts.forEach(m => {
    const p = +m.potentiel || 0;
    m.ppg = +(p / 8.345).toFixed(1);
    m.b46 = +(p / 383.6).toFixed(3);
  });
}
const SL = [
    ['overall_impression', 'Overall Impression'],
    ['appearance', 'Appearance'],
    ['aroma', 'Aroma'],
    ['flavor', 'Flavor'],
    ['mouthfeel', 'Mouthfeel'],
    ['comments', 'Comments'],
    ['history', 'History'],
    ['characteristic_ingredients', 'Characteristic Ingredients'],
    ['style_comparison', 'Style Comparison']
  ],
  SV = [
    ['ibu', 'IBU', 0],
    ['srm', 'SRM', 1],
    ['og', 'OG', 3],
    ['fg', 'FG', 3],
    ['abv', 'ABV %', 1]
  ],
  nv = (v, d) => (v === '' || v == null || isNaN(v) ? '-' : +(+v).toFixed(d)),
  rg = (o, k, d) =>
    o[k + '_min'] === '' || o[k + '_min'] == null || isNaN(o[k + '_min'])
      ? '-'
      : +(+o[k + '_min']).toFixed(d) + ' – ' + +(+o[k + '_max']).toFixed(d);
const SRMC = [
  [0, '#FFE699'],
  [2, '#FFD878'],
  [3, '#FFCA5A'],
  [4, '#FFBF42'],
  [6, '#FBB123'],
  [8, '#F8A600'],
  [10, '#F39C00'],
  [13, '#EA8F00'],
  [17, '#CF6900'],
  [20, '#BB5100'],
  [24, '#9C3600'],
  [29, '#7A2300'],
  [35, '#4E1500'],
  [40, '#1E0A00']
];
function colorBar(ebc) {
  const mx = 40,
    srm = Math.max(0, Math.min(mx, (+ebc || 0) / 1.97)),
    gr = SRMC.map(([v, c]) => c + ' ' + ((v / mx) * 100).toFixed(1) + '%').join(',');
  return `<div class="bi cbar"><div class="bl"><span>Couleur de la bière</span><b>${(+ebc || 0).toFixed(0)} EBC · ${srm.toFixed(1)} SRM</b></div><div class="cb" style="background:linear-gradient(90deg,${gr})"><i style="left:${((srm / mx) * 100).toFixed(1)}%"></i></div><div class="cs"><span>0</span><span>20</span><span>40</span><span>60</span><span>80 EBC</span></div></div>`;
}
let SSEL = 0;
function stylesScreen() {
  if (!SORT.styles) sortBy('styles', 'name', S.styles);
  const cut = v => {
      v = String(v == null ? '' : v);
      return hh(v.length > 45 ? v.slice(0, 45) + '…' : v);
    },
    row = (o, i) =>
      `<tr data-ss="${i}"${i === SSEL ? ' class="sel"' : ''}><td title="${esc(o.name)}">${hh(o.name)}</td>${SL.map(([k]) => `<td title="${esc(o[k])}">${cut(o[k])}</td>`).join('')}${SV.map(([k, l, d]) => ['min', 'max'].map(m => `<td>${nv(o[k + '_' + m], d)}</td>`).join('')).join('')}<td title="${esc(o.commercial_examples)}">${cut(o.commercial_examples)}</td>${IONR.map(k => ['min', 'max'].map(m => `<td>${nv(o[k + '_' + m], k === 'so4cl' ? 2 : 0)}</td>`).join('')).join('')}<td class="act"><button class="x" data-sdel="${i}" title="Supprimer ce style">✕</button></td></tr>`;
  main.innerHTML = `<div class="panel" style="margin:10px 12px"><h3>Styles BJCP 2021 (${S.styles.length}) <button id="sadd">＋ Style</button><button id="sexp">Exporter CSV</button></h3>
<div class="sty"><div class="scr stl"><table class="db">${fltRow('styles', ['name', ...SL.map(x => x[0]), ...SV.flatMap(x => [x[0] + '_min', x[0] + '_max']), 'commercial_examples', ...IONR.flatMap(k => [k + '_min', k + '_max'])], ['name', 'commercial_examples'])}<tr class="hd"><th class="srt" data-sort="name">Style${arrow('styles', 'name')}</th>${SL.map(([k, l]) => `<th class="srt" data-sort="${k}">${l}${arrow('styles', k)}</th>`).join('')}${SV.map(([k, l]) => ['min', 'max'].map(m => `<th class="srt" data-sort="${k}_${m}">${l.replace(' %', '')} ${m === 'min' ? 'mini' : 'maxi'}${arrow('styles', k + '_' + m)}</th>`).join('')).join('')}<th class="srt" data-sort="commercial_examples">Commercial Examples${arrow('styles', 'commercial_examples')}</th>${IONR.map(k => ['min', 'max'].map(m => `<th class="srt" data-sort="${k}_${m}">${EIL[k]} ${m === 'min' ? 'mini' : 'maxi'}${arrow('styles', k + '_' + m)}</th>`).join('')).join('')}<th></th></tr>${S.styles.map(row).join('')}</table></div></div></div>`;
  fltApply('styles');
  main.onclick = async e => {
    const b = e.target.closest('[data-sdel]'),
      r = e.target.closest('tr[data-ss]');
    if (b) {
      const i = +b.dataset.sdel;
      if (
        await bcAsk('Supprimer définitivement le style « ' + S.styles[i].name + ' » ?', {
          title: 'Supprimer le style',
          ok: 'Supprimer',
          danger: 1
        })
      ) {
        S.styles.splice(i, 1);
        SSEL = Math.max(0, Math.min(SSEL, S.styles.length - 1));
        save();
        stylesScreen();
      }
    } else if (r) {
      SSEL = +r.dataset.ss;
      main.querySelectorAll('tr.sel').forEach(x => x.classList.remove('sel'));
      r.classList.add('sel');
    }
  };
  $('#sadd').onclick = () => {
    const o = {};
    COLS.styles.forEach(c => (o[c] = TXT.includes(c) ? '' : 0));
    o.name = 'Nouveau style';
    S.styles.unshift(o);
    SSEL = 0;
    save();
    stylesScreen();
  };
  $('#sexp').onclick = () => dl('styles.csv', toCsv('styles'), 'text/csv;charset=utf-8');
  main.querySelectorAll('th[data-sort]').forEach(
    h =>
      (h.onclick = () => {
        const k = h.dataset.sort;
        sortBy('styles', k, S.styles);
        save();
        stylesScreen();
      })
  );
}
const SORT = {},
  FLT = {};
const nrm = v =>
  String(v == null ? '' : v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
function fltRow(t, keys, tx) {
  const num = c => (S[t] || []).some(x => isNum(x[c]));
  return `<tr class="flt">${keys.map(c => `<th><input class="fi" data-ft="${t}" data-fc="${c}" ${tx.includes(c) ? `list="fl-${t}-${c}"` : ''} value="${esc((FLT[t] || {})[c] || '')}" placeholder="filtrer…"${num(c) ? ` title="${esc('Filtre numérique : 3 ou =3, <3, >4, <=3, >=4, !=3, [2;4] (bornes incluses), ]2;4[ (exclues), ]2;4], [2;4[, 2;4 (égal à 2 ou 4)')}"` : ''} autocomplete="off">${tx.includes(c) ? `<datalist id="fl-${t}-${c}"></datalist>` : ''}</th>`).join('')}<th><button class="fx" onclick="fltClear('${t}')" title="Effacer tous les filtres et revenir au tri par nom croissant"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M16.2 3.8l4 4a1.6 1.6 0 010 2.3L11 19.3H6.6L3.8 16.5a1.6 1.6 0 010-2.3l10.1-10.4a1.6 1.6 0 012.3 0z"/><path d="M8.5 9.3l6.2 6.2M10.5 19.3H21"/></svg></button></th></tr>`;
}
function fltClear(t) {
  FLT[t] = {};
  PG[t] = 0;
  SORT[t] = undefined;
  sortBy(t, 'name', S[t]);
  save();
  t === 'styles' ? stylesScreen() : dbScreen(t);
}
/* pagination : au-delà de PGSZ lignes, les listes sont découpées en pages (PG[t] = page courante, à partir de 0) */
const PGSZ = 15,
  PG = {};
/* barre de pagination : « ‹ 1 2 3 … 8 9 10 › » ; boutons : début, précédent, numéros (page directe), suivant, fin */
function pgBar(t, n) {
  const pages = Math.ceil(n / PGSZ),
    p = PG[t] || 0,
    num = k =>
      `<button class="pgb pgn${k === p ? ' cur' : ''}" data-pg="${t}" data-p="${k}" title="Page ${k + 1} sur ${pages}">${k + 1}</button>`,
    gap = '<span class="pgb pgx"></span>',
    nav = (go, icon, title, off) =>
      `<button class="pgb" data-pg="${t}" data-p="${go}" title="${title}"${off ? ' disabled' : ''}>${ic(icon)}</button>`;
  /* 7 emplacements fixes : 3 premières pages, « … » (ou la page courante si elle est au milieu), 3 dernières pages */
  let slots;
  if (pages <= 6) slots = Array.from({ length: 7 }, (_, k) => (k < pages ? num(k) : gap));
  else
    slots = [
      num(0),
      num(1),
      num(2),
      p > 2 && p < pages - 3 ? num(p) : '<span class="pgb pgd">…</span>',
      num(pages - 3),
      num(pages - 2),
      num(pages - 1)
    ];
  return (
    nav(0, 'pfirst', 'Première page', p <= 0) +
    nav(p - 1, 'pprev', 'Page précédente', p <= 0) +
    slots.join('') +
    nav(p + 1, 'pnext', 'Page suivante', p >= pages - 1) +
    nav(pages - 1, 'plast', 'Dernière page', p >= pages - 1)
  );
}
/* lignes vides sous la dernière page : la hauteur du tableau, donc la place de la barre de pagination, ne change pas */
function pgFill(table, shown) {
  table.querySelectorAll('tr.pgfill').forEach(r => r.remove());
  if (!table || shown >= PGSZ) return;
  const r = [...table.rows].find(x => !x.classList.contains('flt') && !x.classList.contains('hd') && x.style.display !== 'none');
  const h = r ? r.getBoundingClientRect().height : 34;
  table.insertAdjacentHTML(
    'beforeend',
    `<tr class="pgfill" style="height:${h}px"><td colspan="${table.rows[0].cells.length}"></td></tr>`.repeat(PGSZ - shown)
  );
}
/* 6.10.0 : filtres numériques des écrans de base (malts, houblons, levures, eaux, styles) — sur les colonnes à valeurs
   numériques : <3, >4, <=3, >=4, =3, !=3 ou <>3, intervalles [2;4] (bornes incluses), ]2;4[ (exclues), ]2;4], [2;4[,
   liste 2;4 (égal à l’une des valeurs). Virgule ou point décimal. Renvoie null si l’expression n’est pas numérique
   (filtre texte habituel). */
const FNUM = '(-?\\d+(?:[.,]\\d+)?)',
  fnum = x => parseFloat(String(x).replace(',', '.'));
function numFilter(expr) {
  const v = String(expr).trim(),
    eq = (a, b) => Math.abs(a - b) < 1e-9;
  let m = new RegExp('^(<=|>=|<>|!=|<|>|=)\\s*' + FNUM + '$').exec(v);
  if (m) {
    const n = fnum(m[2]);
    return {
      '<': x => x < n,
      '>': x => x > n,
      '<=': x => x <= n + 1e-9,
      '>=': x => x >= n - 1e-9,
      '=': x => eq(x, n),
      '!=': x => !eq(x, n),
      '<>': x => !eq(x, n)
    }[m[1]];
  }
  m = new RegExp('^([\\[\\]])\\s*' + FNUM + '\\s*;\\s*' + FNUM + '\\s*([\\[\\]])$').exec(v);
  if (m) {
    const a = fnum(m[2]),
      b = fnum(m[3]),
      li = m[1] === '[',
      ri = m[4] === ']';
    return x => (li ? x >= a - 1e-9 : x > a) && (ri ? x <= b + 1e-9 : x < b);
  }
  if (new RegExp('^' + FNUM + '(\\s*;\\s*' + FNUM + ')+$').test(v)) {
    const L = v.split(';').map(fnum);
    return x => L.some(n => eq(x, n));
  }
  /* 6.10.0 : un nombre seul = égalité (réécrit « =3 » en quittant le champ, fltNumEq) */
  if (new RegExp('^' + FNUM + '$').test(v)) {
    const n = fnum(v);
    return x => eq(x, n);
  }
  return null;
}
/* 6.10.0 : filtre d’une colonne numérique — un nombre seul saisi devient « =nombre » (sauf stock 0 / 1 : en stock ou non) */
function fltNumEq(el) {
  const t = el.dataset.ft,
    c = el.dataset.fc,
    v = el.value.trim();
  if (c === 'stock' && /^[01]$/.test(v)) return;
  if (!new RegExp('^' + FNUM + '$').test(v) || !(S[t] || []).some(x => isNum(x[c]))) return;
  el.value = '=' + v;
  fltInput(el);
}
document.addEventListener('change', e => {
  if (e.target.classList && e.target.classList.contains('fi')) fltNumEq(e.target);
});
const isNum = x => x !== '' && x !== null && x !== undefined && !isNaN(fnum(x));
function fltApply(t) {
  const act = Object.entries(FLT[t] || {}).filter(([, v]) => v !== ''),
    arr = S[t],
    vis = [];
  document.querySelectorAll(t === 'styles' ? 'tr[data-ss]' : 'tr[data-ri]').forEach(tr => {
    const o = arr[+(tr.dataset.ss !== undefined ? tr.dataset.ss : tr.dataset.ri)],
      ok =
        !o ||
        act.every(([c, v]) => {
          if (c === 'stock' && /^[01]$/.test(v.trim())) return (+o.stock > 0) === (v.trim() === '1');
          const f = numFilter(v);
          /* filtre numérique : seulement sur une colonne numérique (sinon texte) ; cellule vide = écartée */
          if (f && arr.some(x => isNum(x[c]))) return isNum(o[c]) && f(fnum(o[c]));
          return nrm(o[c]).includes(nrm(v));
        });
    tr.style.display = ok ? '' : 'none';
    if (ok) vis.push(tr);
  });
  const bar = document.getElementById('pager'),
    tbl = main.querySelector('.scr table.db');
  if (tbl) tbl.querySelectorAll('tr.pgfill').forEach(r => r.remove());
  if (!bar || t === 'styles') return;
  const n = vis.length;
  if (n <= PGSZ) {
    PG[t] = 0;
    bar.innerHTML = '';
    return;
  }
  PG[t] = Math.max(0, Math.min(PG[t] || 0, Math.ceil(n / PGSZ) - 1));
  vis.forEach((tr, k) => {
    if (k < PG[t] * PGSZ || k >= (PG[t] + 1) * PGSZ) tr.style.display = 'none';
  });
  bar.innerHTML = pgBar(t, n);
  if (tbl) pgFill(tbl, Math.min(PGSZ, n - PG[t] * PGSZ));
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-pg]');
  if (!b || b.disabled) return;
  const t = b.dataset.pg;
  PG[t] = Math.max(0, +b.dataset.p);
  if (t === 'biblio') biblio();
  else if (t === 'fonts') fontsRefresh();
  else {
    fltApply(t);
    const sc = main.querySelector('.scr');
    if (sc) sc.scrollTop = 0;
  }
});
function fltInput(el) {
  const t = el.dataset.ft,
    c = el.dataset.fc;
  FLT[t] = FLT[t] || {};
  FLT[t][c] = el.value;
  PG[t] = 0;
  const dl = document.getElementById('fl-' + t + '-' + c);
  if (dl) {
    const v = nrm(el.value);
    dl.innerHTML =
      v.length >= 3
        ? [
            ...new Set(
              S[t].map(o => String(o[c] == null ? '' : o[c])).filter(x => x && x.length <= 80 && nrm(x).includes(v))
            )
          ]
            .slice(0, 15)
            .map(x => `<option value="${esc(x)}">`)
            .join('')
        : '';
  }
  fltApply(t);
}
function sortBy(t, c, arr) {
  const d = SORT[t] && SORT[t].c === c && SORT[t].d === 1 ? -1 : 1;
  SORT[t] = { c, d };
  const nm = arr.every(o => o[c] === '' || o[c] == null || !isNaN(+o[c]));
  arr.sort((a, b) => {
    const x = a[c],
      y = b[c];
    return (
      d *
      (nm
        ? (+x || 0) - (+y || 0)
        : String(x == null ? '' : x).localeCompare(String(y == null ? '' : y), 'fr', {
            numeric: true,
            sensitivity: 'base'
          }))
    );
  });
}
const arrow = (t, c) =>
  SORT[t] && SORT[t].c === c
    ? `<span class="sar ${SORT[t].d === 1 ? 'up' : 'dn'}" title="${SORT[t].d === 1 ? 'Tri croissant' : 'Tri décroissant'}"></span>`
    : '';
function rvSel(t) {
  const a = (S.kv.equip.rsel || {})[t] || [];
  return [0, 1, 2, 3, 4].map(i => a[i] || '');
}
function rvInner(t) {
  const sel = rvSel(t);
  return `<div class="rlist"><table class="db rt"><tr><th>Nom <small>(5 max)</small></th><th></th></tr>${sel.map((n, i) => `<tr><td><input class="nm rin" list="dl-rs" data-rs="${t}" data-rx="${i}" value="${esc(n)}" placeholder="3 lettres min…" autocomplete="off"></td><td class="ers"><button class="er" data-erase="rs" data-t="${t}" data-i="${i}" title="Effacer">${ERASER}</button></td></tr>`).join('')}</table><datalist id="dl-rs"></datalist></div><div class="rview" id="rview"></div>`;
}
function rvBlock(t) {
  return `<div class="rwrap" id="rblock">${rvInner(t)}</div>`;
}
/* valeur affichée d'une cellule : en lecture seule, les textes (hors nom) sont traduits (type d'eau, usage, unité…) ;
   la ligne en cours de modification garde la valeur brute, seule enregistrée */
const dbShow = (o, c, ro) => (ro && c !== 'name' && typeof o[c] === 'string' ? tx(o[c]) : o[c]);
function dbRows(t, ed) {
  const cols = COLS[t],
    ro = true,
    calc = c => t === 'malts' && (c === 'ppg' || c === 'b46');
  return S[t]
    .map(
      (o, i) =>
        `<tr data-ri="${i}">${cols.map(c => `<td><input${calc(c) ? ' class="calc"' : ''} data-t="${t}" data-i="${i}" data-c="${c}" value="${esc(dbShow(o, c, i !== ed))}"${calc(c) || (ro && i !== ed) ? ' readonly' : ''}></td>`).join('')}<td class="act">${ro ? `<button data-ed="${i}" class="${i === ed ? '' : 'pen'}" title="Modifier">${i === ed ? 'OK' : '✎'}</button>` : ''}<button class="dup" data-dup="${i}" title="Dupliquer">⧉</button><button class="cart" data-cartd="${t}" data-i="${i}" hidden>🛒</button>${o.sys ? '' : `<button class="x" data-dr="${i}" title="Supprimer">✕</button>`}</td></tr>`
    )
    .join('');
}
/* ajout / copie / suppression d'une ligne : seules les lignes du tableau sont remplacées (pas de reconstruction de l'écran → pas de clignotement) */
function dbPatch(t, ed = -1, top) {
  const hd = main.querySelector('.scr table.db tr.hd'),
    sc = main.querySelector('.scr');
  if (!hd || !sc) return dbScreen(t, ed);
  const y = sc.scrollTop,
    tb = hd.parentNode;
  tb.querySelectorAll('tr[data-ri]').forEach(r => r.remove());
  tb.insertAdjacentHTML('beforeend', dbRows(t, ed));
  const h3 = main.querySelector('.panel h3');
  if (h3 && h3.firstChild && h3.firstChild.nodeType === 3)
    h3.firstChild.nodeValue = TITLES[t] + ' (' + S[t].length + ') ';
  dbBind(t);
  updCart();
  if (top) PG[t] = 0;
  fltApply(t);
  sc.scrollTop = top ? 0 : y;
}
function dbBind(t) {
  main.querySelectorAll('[data-ed]').forEach(
    b =>
      (b.onclick = () => {
        const tr = b.closest('tr'),
          on = b.textContent !== 'OK';
        tr.querySelectorAll('input:not(.calc)').forEach(x =>
          on ? x.removeAttribute('readonly') : x.setAttribute('readonly', '')
        );
        b.textContent = on ? 'OK' : '✎';
        b.classList.toggle('pen', !on);
      })
  );
  main.querySelectorAll('[data-dup]').forEach(
    b =>
      (b.onclick = () => {
        const i = +b.dataset.dup,
          o = { ...S[t][i] };
        o.name = String(o.name) + ' (copie)';
        S[t].splice(i + 1, 0, o);
        if (t === 'malts') recalcMalts();
        save();
        dbPatch(t);
      })
  );
  main.querySelectorAll('[data-dr]').forEach(
    b =>
      (b.onclick = () => {
        S[t].splice(+b.dataset.dr, 1);
        save();
        dbPatch(t);
      })
  );
}
function dbScreen(t, ed = -1) {
  if (!SORT[t]) sortBy(t, 'name', S[t]);
  const cols = COLS[t],
    ro = true,
    csv = true,
    calc = c => t === 'malts' && (c === 'ppg' || c === 'b46'),
    fmt = csv ? 'CSV' : 'JSON';
  main.innerHTML = `<div class="panel" style="margin:10px 12px">${RK[t] ? rvBlock(t) : ''}<h3>${TITLES[t]} (${S[t].length}) ${['malts', 'hops', 'yeasts'].includes(t) ? '<small>notes aromatiques : échelle 0 à 5</small>' : ''}<button id="exj">Exporter ${fmt}</button><button id="csvp" title="Coller des données au format CSV dans une zone de texte">📋 Coller CSV</button><button id="clr" class="dng">Tout effacer</button></h3>
<div class="scr"><table class="db">${fltRow(t, cols, TXT)}<tr class="hd">${cols.map(c => `<th class="srt" data-sort="${c}">${{ prix_g: 'prix/g', prix_kg: 'prix/kg', prix_sachet: 'prix/sachet', prix_l: 'prix/L', unite: 'unité', prix: 'prix (€)', stock: 'stock ' + STU[t] }[c] || (c === 'name' ? 'nom' : HFR[c] || (t === 'eaux' && EIL[c])) || c.replace(/_/g, ' ')}${arrow(t, c)}</th>`).join('')}<th class="addc"><button id="add" title="Ajouter une ligne">＋</button></th></tr>${dbRows(t, ed)}</table></div><div class="pager noprint" id="pager"></div></div>`;
  fltApply(t);
  updCart();
  drawRv(t);
  drawRv(t);
  main.querySelectorAll('th[data-sort]').forEach(
    h =>
      (h.onclick = () => {
        sortBy(t, h.dataset.sort, S[t]);
        PG[t] = 0;
        save();
        dbScreen(t);
      })
  );
  $('#add').onclick = () => {
    const o = {};
    cols.forEach(c => (o[c] = TXT.includes(c) ? '' : 0));
    o.name = 'Nouveau';
    S[t].unshift(o);
    if (t === 'malts') recalcMalts();
    save();
    dbPatch(t, ro ? 0 : -1, 1);
  };
  $('#clr').onclick = async () => {
    if (
      await bcAsk('Effacer TOUTES les lignes de « ' + TITLES[t] + ' » ?', {
        title: 'Vider la table',
        ok: 'Tout effacer',
        danger: 1
      })
    ) {
      S[t] = S[t].filter(x => x.sys);
      save();
      dbScreen(t);
    }
  };
  $('#exj').onclick = () =>
    csv
      ? dl(t + '.csv', toCsv(t), 'text/csv;charset=utf-8')
      : dl(t + '.json', JSON.stringify(S[t], null, 1), 'application/json');
  const ingest = a => {
    a.forEach(o => {
      if (!o || !o.name) return;
      const i = S[t].findIndex(x => String(x.name).toLowerCase() === String(o.name).toLowerCase());
      i >= 0 ? (S[t][i] = { ...S[t][i], ...o }) : S[t].push(o);
    });
    fill(t); /* prix vide → 0 */
    if (t === 'malts') recalcMalts();
    save();
    dbScreen(t);
  };
  const csvRows = txt => {
    const rw = parseCsv(txt),
      h = rw.shift().map(x => x.trim().replace(/^\ufeff/, ''));
    return {
      h,
      a: rw
        .filter(l => l.some(z => String(z).trim()))
        .map(l => {
          const o = {};
          h.forEach((k, j) => {
            if (!cols.includes(k)) return;
            let v = (l[j] ?? '').trim();
            if (/^-?\d+,\d+$/.test(v)) v = v.replace(',', '.');
            o[k] = num(v);
          });
          return o;
        })
    };
  };
  $('#csvp').onclick = async () => {
    const ok = await bcForm(
      'Collez ci-dessous des données au format CSV (séparateur « ; », « , » ou tabulation). La première ligne doit contenir les noms de colonnes (' +
        cols.join(' ; ') +
        '). Une ligne dont le nom existe déjà met à jour l’ingrédient, sinon elle est ajoutée.',
      {
        title: 'Coller des données CSV — ' + TITLES[t],
        ok: 'Importer',
        cancel: 'Annuler',
        wide: 1,
        body:
          '<textarea class="bccsv" spellcheck="false" placeholder="' +
          cols.join(';') +
          '"></textarea><div class="bcmsg" hidden></div>',
        collect: d => {
          const ta = d.querySelector('.bccsv'),
            m = d.querySelector('.bcmsg');
          let r;
          try {
            r = csvRows(ta.value);
          } catch (x) {
            r = null;
          }
          const bad = !ta.value.trim()
            ? 'Collez d’abord du texte CSV.'
            : !r || !r.h.includes('name')
              ? 'Colonne « name » introuvable dans la première ligne.'
              : !r.a.some(o => o.name)
                ? 'Aucune ligne exploitable.'
                : '';
          if (bad) {
            m.hidden = false;
            m.textContent = bad;
            return undefined;
          }
          return r.a;
        }
      }
    );
    if (ok && ok.length) ingest(ok);
  };
  dbBind(t);
}
/* Paramètres */
/* Équipement & process : caractéristiques de l'équipement, puis sous-section « Valeurs par défaut »
   (le ratio eau/grain n'est plus ici : c'est le « Ratio d’empâtage (L/kg) » saisi dans la Conception) */
const EQ = [
  /* 6.9.0 : « Volume à embouteiller » retiré (référence : écran Conception) ; « Volume maxi empâtage », « Volume mort sous
     le panier » et le taux d'évaporation viennent des Paramètres de brassage (valeurs gardées dans E.w / E.evap) */
  ['cmax', 'Volume maxi empâtage (L)', 'w'],
  ['eff', 'Rendement d’empâtage (%)'],
  ['mort', 'Volume mort sous le panier (L)', 'w'],
  ['evap', 'Taux d’évaporation horaire (L/h)']
];
const EQD = [
  ['chauffe', 'Chauffe (°C/min)'],
  ['refroid', 'Refroidissement (°C/min)'],
  ['ogT', 'DI cible par défaut'],
  ['ibuT', 'IBU cible par défaut'],
  ['ratioD', 'Ratio d’empâtage par défaut (L/kg)']
];
function updParams() {
  if (!$('#te-k')) return;
  const E = S.kv.equip,
    e = x => x.toFixed(2).replace('.', ','),
    f = v => +v || 0;
  let ta = 0,
    tl = 0,
    tk = 0,
    tc = 0,
    tn = 0;
  elecSync().forEach(({ i, line }) => {
    const m = line.min,
      k = ((f(S.elec[i].w) / 1000) * m) / 60,
      c = k * f(sysPrix('kwh')),
      em = $('#em' + i);
    if (em) {
      em.value = m.toFixed(1);
      /* 6.10.1 : libellé recalculé (ex. « Chauffe eau de rinçage (12 → 78 °C) » suit la T° initiale de l’eau) */
      const nm = em.closest('tr').querySelector('input.nm');
      if (nm && nm.value !== S.elec[i].name) nm.value = S.elec[i].name;
    }
    tk += k;
    tc += c;
    const a = $('#pk' + i),
      b = $('#ec' + i);
    if (a) a.textContent = e(k);
    if (b) b.textContent = e(c);
  });
  S.elec.forEach((l, i) => {
    if (l.auto) return;
    const k = ((f(l.w) / 1000) * f(l.min)) / 60,
      c = k * f(sysPrix('kwh'));
    tk += k;
    tc += c;
    $('#pk' + i).textContent = e(k);
    $('#ec' + i).textContent = e(c);
  });
  $('#te-k').textContent = e(tk) + ' kWh';
  $('#tot-elec').textContent = e(tc) + ' €';
  updProc();
  updWater();
}
function params() {
  params0();
  const E = S.kv.equip,
    L = (k, i, f, v, t) =>
      `<td><input ${t ? `class="nm"${k === 'consl' ? ' list="dl-consl"' : ''}` : 'type="number" min="0" step="any"'} data-ln="${k}" data-i="${i}" data-lf="${f}" value="${esc(v)}"></td>`,
    X = (k, i) => `<td><button class="x" data-dl="${k}" data-i="${i}" title="Supprimer">✕</button></td>`;
  main.innerHTML =
    `<div class="pg">` +
    main.innerHTML +
    `<div class="col2">${procPanel()}${coefPanel()}${reglagesPanel()}${unitsPanel()}${logoPanel()}</div><div class="col2">${waterPanel()}<div class="panel"><h3>Besoins en électricité<button data-al="elec">＋</button></h3><table><tr><th>Désignation</th><th>Puissance (W)</th><th>Durée (min)</th><th>kWh</th><th>Coût (€)</th><th></th></tr>${elecSync()
      .map(({ i, line }) => {
        const l = S.elec[i];
        return `<tr class="ea" data-ek="${line.kind}"><td><input class="nm" readonly tabindex="-1" value="${esc(l.name)}"></td>${L('elec', i, 'w', l.w)}<td><input type="number" readonly tabindex="-1" id="em${i}"></td><td class="pc" id="pk${i}"></td><td class="pc" id="ec${i}"></td><td></td></tr>`;
      })
      .join(
        ''
      )}${S.elec.map((l, i) => (l.auto ? '' : `<tr>${L('elec', i, 'name', l.name, 1)}${L('elec', i, 'w', l.w)}${L('elec', i, 'min', l.min)}<td class="pc" id="pk${i}"></td><td class="pc" id="ec${i}"></td>${X('elec', i)}</tr>`)).join('')}<tr class="sum"><td>Total</td><td></td><td></td><td id="te-k"></td><td id="tot-elec"></td><td></td></tr></table></div>${fontsPanel()}${calcPanel()}${contactPanel()}</div>${arPanel()}</div>`;
  updParams();
  logoBind();
}

/* Calculs d’eau (d’après la feuille Excel « calculs ») */
const WD = {
  mort: 8,
  occ: 0.7,
  ret: 0.825,
  trub: 2,
  contr: 4,
  pferm: 2,
  resuc: 2,
  tmout: 95,
  tglace: -16,
  glace: 6,
  fmax: 30,
  cmax: 45,
  bout: 30
};
/* ---------- thème : picker + harmonies ---------- */
const TH0 = {
  bg: '#2b3340',
  p: '#222933',
  b: '#3d4756',
  y: '#ffe600',
  c: '#20d6c7',
  bl: '#3a8fe8',
  t: '#d9dee6',
  m: '#8d98a8',
  hd: '#232a34',
  in: '#1b2028',
  pn: 'rgba(34,41,51,.9)',
  bd: '#4b525d',
  bk: '#3d4756',
  pn2: 'rgba(34,41,51,.9)',
  hf: "'Inter',sans-serif"
};
const hsl2hex = (h, s, l) => {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const a = s * Math.min(l, 1 - l),
    f = n => {
      const k = (n + h / 30) % 12;
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
  return (
    '#' +
    [f(0), f(8), f(4)]
      .map(x =>
        Math.round(x * 255)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
};
const hex2hsl = x => {
  x = x.replace('#', '');
  const r = parseInt(x.slice(0, 2), 16) / 255,
    g = parseInt(x.slice(2, 4), 16) / 255,
    b = parseInt(x.slice(4, 6), 16) / 255,
    M = Math.max(r, g, b),
    m = Math.min(r, g, b),
    d = M - m,
    l = (M + m) / 2;
  let h = 0,
    s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [(h + 360) % 360, s * 100, l * 100];
};
const HARM = [
  ['an', 'Analogues', [-30, 0, 30]],
  ['co', 'Complémentaires', [0, 180]],
  ['sp', 'Complémentaires divisées', [0, 150, 210]],
  ['tr', 'Triadiques', [0, 120, 240]],
  ['te', 'Tétradiques', [0, 60, 180, 240]],
  ['ca', 'Carré', [0, 90, 180, 270]]
];
const okHex = x => /^#[0-9a-f]{6}$/i.test(x);
function harmonies(hex) {
  const [h, s, l] = hex2hsl(hex);
  return HARM.map(([id, n, a]) => ({
    id,
    n,
    cols: a.map(o => (o === 0 ? hex.toLowerCase() : hsl2hex(h + o, s, l))),
    base: a.indexOf(0)
  }));
}
function themeVars(cols, harm) {
  const L = (x, min) => {
      const [h, s, l] = hex2hsl(x);
      return hsl2hex(h, Math.max(s, 35), Math.min(Math.max(l, min), 75));
    },
    [h0, s0] = hex2hsl(cols[0]),
    sat = Math.min(s0, 40) * 0.5 + 8,
    H = (l, s) => hsl2hex(h0, s === undefined ? sat : s, l);
  const c3 = cols[2] || hsl2hex(hex2hsl(cols[0])[0] + 30, hex2hsl(cols[0])[1], hex2hsl(cols[0])[2]);
  const [h1, s1] = hex2hsl(cols[1] || cols[0]),
    sat2 = Math.min(38, s0 * 0.6 + 12),
    G = (a, b) => `linear-gradient(180deg,${a},${b})`;
  return {
    bg: H(20),
    p: H(15),
    b: H(30),
    y: L(cols[0], 58),
    c: L(cols[1] || cols[0], 55),
    bl: L(c3, 55),
    t: H(88, 12),
    m: H(65, 10),
    hd: H(12),
    in: H(10),
    pn: G(hsl2hex(h0, sat2, 19), hsl2hex(h0, sat2, 14)),
    pn2: G(hsl2hex(h1, sat2, 19), hsl2hex(h1, sat2, 13)),
    bk: hsl2hex(h1, Math.max(s1, 40), 52)
  };
}
function applyTheme() {
  const T = S.kv && S.kv.equip && S.kv.equip.theme,
    lt = !!(T && T.light),
    v = !lt && T && T.cols && T.cols.length ? themeVars(T.cols, T.harm) : null,
    r = document.documentElement.style;
  document.documentElement.classList.toggle('light', lt);
  Object.keys(TH0).forEach(k => (v && v[k] !== undefined ? r.setProperty('--' + k, v[k]) : r.removeProperty('--' + k)));
  const sw = document.getElementById('thsw');
  if (sw) {
    sw.setAttribute('aria-checked', lt ? 'false' : 'true'); /* coché = thème sombre */
    sw.title = lt ? 'Passer au thème sombre' : 'Passer au thème clair';
    sw.classList.toggle('dark', !lt);
  }
}
/* sélecteur de thème (angle haut droit) : clair ⇄ sombre */
document.addEventListener('click', e => {
  if (!e.target.closest || !e.target.closest('#thsw') || !S.kv) return;
  const lt = !!(S.kv.equip.theme && S.kv.equip.theme.light);
  if (lt) delete S.kv.equip.theme;
  else S.kv.equip.theme = { light: 1 };
  applyTheme();
  save();
});
/* licence : texte stocké dans la table « licence » de la base */
document.addEventListener('click', e => {
  if (!e.target.closest || !e.target.closest('#lic')) return;
  e.preventDefault();
  const L = S.licence || LICENCE_SEED,
    h = String(L.texte).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  bcDlg('OpenMaltForge est un logiciel libre distribué sous ' + L.nom + '.', {
    alert: 1,
    wide: 1,
    title: 'Licence ' + L.nom,
    body: '<pre class="lictxt">' + h + '</pre>'
  });
});
const WIN = [
  /* 6.9.0 : une seule liste, sans sous-sections ; la contraction se règle dans le Process */
  [
    '',
    [
      ['fmax', 'Volume maxi du fermenteur inox (L)', 'w', 1],
      ['pferm', 'Perte fond de fermenteur (L)', 'w', 2],
      ['occ', 'Occupation du malt sec concassé (L/kg)', 'w', 2],
      ['ret', 'Rétention d’eau par les grains (L/kg)', 'w', 3],
      ['pot', 'Potentiel du grain (L°/kg)', 'a', 1],
      ['abs', 'Absorption des drêches (L/kg)', 'e', 2] /* 6.10.0 : venu des valeurs par défaut */
    ]
  ]
];
function wIn(k) {
  const E = S.kv.equip,
    W = E.w || {},
    R = S.kv.recipe;
  if (['ratio', 'vol', 'eff', 'evap', 'abs'].includes(k)) return +E[k] || 0;
  if (k === 'bout') return +E.vol || 0; /* volume à embouteiller = champ de l'écran Conception (source unique) */
  if (k === 'vmoût') return (+E.vol || 0) + wIn('pferm') - wIn('resuc');
  if (k === 'glace') {
    /* 6.8.0 : glace = « Ajouts » saisis des étapes du Process dont le nom contient « glace » (ou de rôle glace) ;
       à défaut, ancienne valeur de la recette, sinon la valeur par défaut */
    const G = ensureProc()
      .flatMap(p => p.rows)
      .filter(r => (/glace/i.test(r.n || '') || r.k === 'glace') && r.a !== undefined && r.a !== '');
    if (G.length) return G.reduce((t, r) => t + (+r.a || 0), 0);
    return R.glace === undefined || R.glace === '' || R.glace === null || isNaN(R.glace) ? WD.glace : +R.glace;
  }
  if (k === 'duree') {
    const b = mrow('boil');
    return (+(b && b.m) || 60) / 60;
  }
  if (k !== 'kg' && W[k] !== undefined) return +W[k];
  if (k === 'kg') return R.malts.reduce((a, x) => a + (+x.g || 0), 0) / 1000;
  if (k === 'pot') {
    let g = 0,
      p = 0;
    R.malts.forEach(m => {
      const d = find('malts', m.n);
      if (d) {
        g += +m.g || 0;
        p += (+m.g || 0) * (+d.potentiel || 0);
      }
    });
    return g ? p / g : 0;
  }
  return WD[k];
}
function wcalc() {
  const g = wIn,
    kg = g('kg'),
    ratio = g('ratio'),
    mort = g('mort'),
    MG = g('vmoût'),
    pot = g('pot'),
    eff = g('eff'),
    occ = g('occ') || 1,
    ret = g('ret'),
    evap = g('evap'),
    dur = g('duree'),
    trub = g('trub'),
    ct = g('contr') / 100,
    pf = g('pferm'),
    rs = g('resuc'),
    ice = g('glace'),
    tm = g('tmout'),
    ti = g('tglace'),
    o = {};
  o.v0 = kg * ratio + mort;
  o.vgr = o.v0 + kg / occ;
  o.vpre = o.v0 - kg * ret;
  o.vcold = MG - ice;
  o.vferm = o.vcold * (1 + ct);
  o.vpost = o.vferm + trub;
  o.vpreb = o.vpost + evap * dur;
  o.rinc = o.vpreb - o.vpre;
  o.vtr = MG - pf;
  o.vres = o.vtr + rs;
  o.vbot = o.vres;
  o.ret = kg * ret;
  o.vpreT = MG / (1 - ct) + evap * dur + trub;
  o.rincN = o.vpreT - o.vpre - ice;
  o.rincN = o.rinc;
  o.tot = o.rinc + o.v0 + ice;
  o.pts = (kg * pot * eff) / 100;
  o.hot = o.vpost;
  o.cold = o.vpost;
  o.d1 = 1 + o.pts / o.vpre / 1000;
  o.d2 = 1 + o.pts / o.vpreb / 1000;
  o.d3 = 1 + o.pts / o.vpost / 1000;
  o.d4 = 1 + o.pts / MG / 1000;
  o.tf = MG ? ((MG - ice) * tm - ice * (80 + 0.5 * Math.abs(ti))) / MG : 0;
  o.vreq = g('bout') + pf - rs;
  o.mg = MG;
  /* tableau Process (phases 1 et 2) : les lignes personnalisées l'emportent sur le calcul analytique */
  const pr = procSolve(),
    by = k => {
      const r = pr.rows.filter(x => x.r.k === k);
      return r.length ? r[r.length - 1] : null;
    },
    vp = by('ret'),
    vr = by('rinc'),
    ve = by('evap'),
    vt = by('trub'),
    vc = by('contr'),
    vg = by('glace'),
    vf = by('pferm'),
    vs = by('resuc');
  const pre0 = pr.rows.filter(x => x.pre);
  if (pre0.length && vp) o.v0 = pre0[pre0.length - 1].v;
  o.vgr = o.v0 + kg / occ;
  o.glace = ice;
  if (vp) o.vpre = vp.v;
  if (vr) {
    o.rinc = pr.R;
    o.rincN = pr.R;
    o.vpreb = vr.v;
  }
  if (ve) o.vpost = ve.v;
  if (vt) o.vferm = vt.v;
  if (vc) o.vcold = vc.v;
  if (vg) o.mg = vg.v;
  if (vf) o.vtr = vf.v;
  if (vs) o.vres = vs.v;
  o.vbot = pr.end;
  o.ret = kg * ret;
  /* 6.9.0 : eau totale = tous les « Ajouts » du Process (empâtage, volume mort, rinçage, glace, resucrage, ajouts
     personnalisés) ; sans Process, empâtage + rinçage + glace */
  o.tot = pr.rows.length ? pr.rows.reduce((a, x) => a + (+x.a || 0), 0) : o.rinc + o.v0 + ice;
  o.hot = o.vpost;
  o.cold = o.vpost;
  /* 6.10.0 : densités ramenées au volume froid (la contraction au refroidissement ne change pas la densité) */
  const hk = procHotK(pr),
    kv = r => (r && pr.rows.indexOf(r) < hk.i ? hk.k : 1),
    dens = () => {
      o.d1 = 1 + o.pts / (o.vpre * kv(vp)) / 1000;
      o.d2 = 1 + o.pts / (o.vpreb * kv(vr)) / 1000;
      o.d3 = 1 + o.pts / (o.vpost * kv(ve)) / 1000;
      o.d4 = 1 + o.pts / o.mg / 1000;
    };
  dens();
  /* 6.8.0 : glace = « Ajouts » des étapes du Process dont le nom contient « glace » (ou de rôle glace) */
  const gl = pr.rows.filter(x => /glace/i.test(x.r.n || '') || x.r.k === 'glace');
  const iceT = gl.length ? gl.reduce((a, x) => a + (+x.a || 0), 0) : ice;
  o.tf = o.mg ? ((o.mg - iceT) * tm - iceT * (80 + 0.5 * Math.abs(ti))) / o.mg : 0;
  /* DI (OG) = cible de l'écran Conception : fixe les points extraits pour que la densité après la glace soit égale à la cible */
  const ot = parseFloat(S.kv.recipe.ogT);
  if (ot > 1 && o.mg > 0) {
    o.pts = (ot - 1) * 1000 * o.mg;
    dens();
  }
  return o;
}
/* ===== Tableau Process : phases (ajoutables, renommables, déplaçables) et étapes (pertes / ajouts d’eau) =====
   S.kv.equip.proc3 = [{ n: nom de la phase, rows: [{ k: rôle, n: nom, l: pertes, a: ajouts }] }] ;
   l / a absents = valeur automatique tirée des Paramètres (selon le rôle k) ; volumes et densités cumulés */
const PDEF = [
  {
    n: 'Phase 1 — Empâtage → pré-rinçage',
    rows: [
      { k: 'emp', n: 'Eau d’empâtage (grains × ratio)' },
      { k: 'mort', n: 'Volume mort sous le panier' },
      { k: 'ret', n: 'Rétention d’eau par les grains' }
    ]
  },
  {
    n: 'Phase 2 — Rinçage → glace dans le fermenteur',
    rows: [
      { k: 'rinc', n: 'Eau de rinçage (équilibre le volume visé)' },
      { k: 'evap', n: 'Évaporation à l’ébullition' },
      { k: 'trub', n: 'Pertes de fond de cuve / trub' },
      { k: 'contr', n: 'Contraction du moût au refroidissement' },
      { k: 'glace', n: 'Glace dans le fermenteur' }
    ]
  },
  {
    n: 'Phase 3 — Embouteillage (perte au fond du fermenteur → mise en bouteille)',
    rows: [
      { k: 'ferm', n: 'Fermentation' },
      { k: 'pferm', n: 'Perte au fond du fermenteur' },
      { k: 'resuc', n: 'Resucrage' }
    ]
  }
];
const clone = o => JSON.parse(JSON.stringify(o));
function ensureProc() {
  const E = S.kv.equip;
  if (!Array.isArray(E.proc3)) {
    /* bases ≤ 5.0.1 : trois phases fixes { p1, p2, p3 } (proc2) → liste de phases nommées */
    const P = E.proc2 && E.proc2.p1 && E.proc2.p2 ? E.proc2 : null;
    if (P) {
      if (!P.p3) {
        const i = P.p2.findIndex(r => r.k === 'pferm');
        P.p3 = i >= 0 ? P.p2.splice(i) : clone(PDEF[2].rows);
      }
      if (!P.p3.some(r => r.k === 'ferm')) P.p3.unshift(clone(PDEF[2].rows[0]));
      E.proc3 = ['p1', 'p2', 'p3'].map((k, i) => ({ n: PDEF[i].n, rows: P[k] }));
    } else E.proc3 = clone(PDEF);
    delete E.proc2;
  }
  for (const ph of E.proc3) {
    if (!Array.isArray(ph.rows)) ph.rows = [];
    for (const r of ph.rows) if (r.k === 'ferm' && /atténuation de la levure/.test(r.n)) r.n = 'Fermentation';
  }
  return E.proc3;
}
function procAuto() {
  const g = wIn,
    kg = g('kg');
  return {
    emp: { a: kg * g('ratio') },
    mort: { a: g('mort') },
    ret: { l: kg * g('ret') },
    evap: { l: g('evap') * g('duree') },
    trub: { l: g('trub') },
    glace: { a: g('glace') },
    pferm: { l: g('pferm') },
    resuc: { a: g('resuc') }
  };
}
/* étapes à plat, dans l’ordre des phases : [indice de phase, indice dans la phase, étape] */
const procFlat = P => P.flatMap((ph, p) => ph.rows.map((r, i) => [p, i, r]));
function procRun(R0) {
  const P = ensureProc(),
    A = procAuto(),
    ct = wIn('contr') / 100,
    F = procFlat(P),
    ir = F.findIndex(([, , r]) => r.k === 'ret'),
    rows = [];
  let V = 0;
  F.forEach(([p, i, r], j) => {
    const au = A[r.k] || {};
    let l = r.l !== undefined ? +r.l : au.l || 0,
      a = r.a !== undefined ? +r.a : au.a || 0;
    if (r.k === 'contr' && r.l === undefined) l = (V * ct) / (1 + ct);
    if (r.k === 'rinc' && r.a === undefined && R0 !== undefined) a = R0;
    V = V - l + a;
    rows.push({
      ph: p,
      i,
      r,
      l,
      a,
      v: V,
      /* étapes avant la rétention par les grains : leur volume final = eau d’empâtage initiale */
      pre: ir > 0 && j < ir,
      al: r.l === undefined && (au.l !== undefined || r.k === 'contr'),
      aa: r.a === undefined && (au.a !== undefined || r.k === 'rinc')
    });
  });
  return { rows, end: V };
}
function procSolve() {
  const P = ensureProc(),
    T = +S.kv.equip.vol || 0,
    f = procFlat(P).find(([, , r]) => r.k === 'rinc'),
    ri = f && f[2];
  let R = 0;
  if (ri && ri.a === undefined) {
    const f0 = procRun(0).end,
      f1 = procRun(1).end;
    R = Math.abs(f1 - f0) > 1e-9 ? (T - f0) / (f1 - f0) : 0;
  } else if (ri) R = +ri.a || 0;
  const run = procRun(R);
  return { rows: run.rows, end: run.end, R, T };
}
/* phase qui se termine par la DI (densité initiale) : celle de la glace dans le fermenteur, sinon celle qui précède
   la fermentation, sinon la dernière */
function procDiPhase(P) {
  let p = P.findIndex(ph => ph.rows.some(r => r.k === 'glace'));
  if (p < 0) p = P.findIndex(ph => ph.rows.some(r => r.k === 'ferm')) - 1;
  return p < 0 ? P.length - 1 : p;
}
/* densité de chaque étape du Process. Jusqu’à la DI : points extraits / volume (l’eau d’empâtage porte déjà les
   points extraits). Ensuite (ou dès la fermentation) : les points suivent le liquide perdu, un ajout d’eau dilue,
   la fermentation retire l’atténuation de la levure, le resucrage ajoute le sucre (saccharose 0,384 L° par g/L ×
   volume embouteillé) */
/* 6.10.0 : volumes chauds — avant l'étape « Contraction du moût au refroidissement », les volumes sont mesurés à chaud ;
   la densité (mesurée sur un échantillon refroidi) se calcule sur le volume froid équivalent : volume × k,
   k = volume après contraction ÷ volume avant. La contraction ne change donc pas la densité. i = indice de l'étape. */
function procHotK(pr) {
  const i = pr.rows.findIndex(x => x.r.k === 'contr'),
    c = i >= 0 ? pr.rows[i] : null,
    vb = c ? c.v + (+c.l || 0) - (+c.a || 0) : 0;
  return { i, k: c && vb > 0 && c.v > 0 ? c.v / vb : 1 };
}
function procDens(pr, pts) {
  const sg = +S.kv.recipe.sucre || 0,
    att = compute().att / 100,
    dp = procDiPhase(ensureProc()),
    out = [];
  let pt = pts,
    sp = 0,
    prop = false;
  const hk = procHotK(pr);
  out.att = att;
  out.dp = dp;
  pr.rows.forEach((x, j) => {
    if (x.ph > dp || x.r.k === 'ferm') prop = true;
    if (prop) {
      const vp = x.v - x.a + x.l;
      if (x.l && vp > 0) pt -= (pt * Math.min(x.l, vp)) / vp;
      if (x.r.k === 'ferm') pt *= 1 - att;
      if (x.r.k === 'resuc') {
        sp = 0.384 * sg * pr.end;
        pt += sp;
      }
      out.push(x.v > 0 ? 1 + pt / x.v / 1000 : null);
    } else out.push(x.v > 0 ? 1 + pts / (x.v * (j < hk.i ? hk.k : 1)) / 1000 : null);
  });
  out.pt = pt;
  out.sp = sp;
  /* DF : le sucre de resucrage est refermenté en bouteille (atténuation de la levure) */ out.df =
    pr.end > 0 ? 1 + (pt - sp * att) / pr.end / 1000 : null;
  return out;
}
/* nom affiché d’une étape : la fermentation indique l’atténuation, le resucrage la quantité de sucre ;
   t = traduction (tx à l’écran, aucune dans le HTML de la recette, qui reste en français) */
function procLabel(r, att, gs, t = s => s) {
  const n = t(r.n || '');
  if (r.k === 'ferm') return n + ' ' + t('(atténuation ' + nf(att * 100, 0) + ' %)');
  if (r.k === 'resuc') return n + ' (' + nf(gs, 0) + ' g)';
  return n;
}
function procPanel() {
  const P = ensureProc(),
    dp = procDiPhase(P),
    n = P.length,
    ro = id => `<td><input readonly class="pi ro" id="${id}"></td>`,
    row = (p, r, i) =>
      `<tr data-prow="${p}:${i}"><td><input readonly class="nm" data-pn="${p}" data-i="${i}" placeholder="Nom de l’étape" value="${esc(tx(r.n || ''))}"></td><td><input readonly type="number" min="0" step="any" class="pi" data-pr="${p}" data-i="${i}" data-pf="l"></td><td><input readonly type="number" min="0" step="any" class="pi" data-pr="${p}" data-i="${i}" data-pf="a"></td>${ro('pv-' + p + '-' + i)}${ro('pd-' + p + '-' + i)}<td class="pact"><button class="x" data-pm="${p}:${i}:-1" title="Monter">▲</button><button class="x" data-pm="${p}:${i}:1" title="Descendre">▼</button><button class="x" data-ped="1" title="Modifier">✎</button><button class="x" data-pdel="${p}:${i}" title="Supprimer">✕</button></td></tr>`,
    sum = (id, t, s) =>
      `<tr class="sum"><td><b>${t}</b> <small>${s}</small></td><td></td><td></td>${ro('pv-' + id)}${ro('pd-' + id)}<td></td></tr>`,
    tab = (ph, p) =>
      `<table class="ptab" data-phase="${p}"><colgroup><col><col class="cn"><col class="cn"><col class="cn"><col class="cn"><col class="ca"></colgroup><tr class="phr"><th colspan="5" class="ph"><input readonly class="phn" data-phn="${p}" placeholder="Nom de la phase" value="${esc(tx(ph.n || ''))}"></th><td class="pact"><button class="x" data-phm="${p}:-1" title="Monter la phase"${p ? '' : ' disabled'}>▲</button><button class="x" data-phm="${p}:1" title="Descendre la phase"${p < n - 1 ? '' : ' disabled'}>▼</button><button class="x" data-ped="1" title="Renommer la phase">✎</button><button class="x" data-pdel="${p}" title="Supprimer la phase">✕</button></td></tr><tr><th>Étape</th><th>Pertes (L)</th><th>Ajouts (L)</th><th>Volume (L)</th><th>Densité</th><th class="pact"><button class="x padd" data-padd="${p}" title="Ajouter une étape à cette phase">＋</button></th></tr>${ph.rows.map((r, i) => row(p, r, i)).join('')}${p === dp ? sum('di', 'DI', '(densité initiale visée — écran Conception)') : ''}${p === n - 1 ? sum('df', 'DF', '(densité finale : après refermentation en bouteilles)') : ''}</table>`;
  const vt = (([h, r]) =>
    `<table class="wt"><tr><th colspan="2">${h}</th></tr>${r.map(([k, l, d], i) => `<tr><td>${l}</td><td><input readonly class="wr ro" id="wo-${h[0]}${i}"></td></tr>`).join('')}<tr><td>Température initiale de l’eau (°C)</td><td><input type="number" step="any" class="wr t0in" data-e="t0" value="${esc(S.kv.equip.t0 ?? 12)}"></td></tr></table>`)(
    WOUT[0]
  ); /* 6.10.0 : température initiale de l’eau, venue des valeurs par défaut, en dernière ligne des volumes */
  return `<div class="panel" id="procp"><h3>Process<button data-phadd="1" title="Ajouter une phase à la fin du tableau">＋ Phase</button><button data-pzero="1" title="Rétablir les lignes par défaut">↺ défaut</button></h3><small style="color:var(--m)">Case vide = valeur automatique des Paramètres (italique). Saisir une valeur la remplace pour la ligne ; la vider rétablit l’automatique. La densité tient compte des points de sucre extraits.</small>${vt}${P.map(tab).join('')}<div id="pwarn"></div></div>`;
}
/* ✎ en bout de ligne : passe la ligne (étape ou nom de phase) en modification ; le nom brut remplace le nom affiché */
function procEdit(tr, on) {
  const b = tr.querySelector('[data-ped]');
  tr.querySelectorAll('input:not(.ro)').forEach(x => (on ? x.removeAttribute('readonly') : x.setAttribute('readonly', '')));
  if (b) {
    b.textContent = on ? 'OK' : '✎';
    b.title = noIc(tx(on ? 'Valider' : b.closest('.phr') ? 'Renommer la phase' : 'Modifier'));
  }
  tr.classList.toggle('ped', on);
  const P = ensureProc(),
    nm = tr.querySelector('input.nm, input.phn');
  if (on && nm) {
    const d = nm.dataset,
      o = d.phn !== undefined ? P[+d.phn] : (P[+d.pn] || { rows: [] }).rows[+d.i];
    if (o) nm.value = o.n || '';
    nm.focus();
    nm.select();
  }
  if (!on) updProc();
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-ped]');
  if (!b) return;
  const tr = b.closest('tr');
  procEdit(tr, !tr.classList.contains('ped'));
});
document.addEventListener('keydown', e => {
  const t = e.target;
  if (e.key !== 'Enter' || !t.closest || !t.closest('.ptab tr.ped')) return;
  e.preventDefault();
  t.dispatchEvent(new Event('change', { bubbles: true }));
  procEdit(t.closest('tr'), false);
});
/* après un ajout : la nouvelle ligne s’ouvre en modification */
function procOpen(sel) {
  const tr = document.querySelector(sel);
  if (tr) procEdit(tr, true);
}
function updProc() {
  if (!$('#pwarn')) return;
  const o = wcalc(),
    pr = procSolve(),
    pts = o.pts,
    f = (x, d) => nf(x, d === undefined ? 2 : d),
    P = ensureProc(),
    W = [],
    dn = procDens(pr, pts),
    sv = (id, t) => {
      const el = $(id);
      if (el) el.value = t;
    };
  pr.rows.forEach((x, ri) => {
    const k = x.ph + '-' + x.i,
      set = (f2, v, au) => {
        const el = document.querySelector(`input[data-pr="${x.ph}"][data-i="${x.i}"][data-pf="${f2}"]`);
        if (!el || document.activeElement === el) return;
        const ov = x.r[f2] !== undefined;
        el.value = ov || v ? +(+v).toFixed(3) : '';
        el.classList.toggle('auto', au && !ov);
      };
    set('l', x.l, x.al);
    set('a', x.a, x.aa);
    sv('#pv-' + k, f(x.v));
    sv('#pd-' + k, dn[ri] == null ? '-' : nf(dn[ri], 3));
  });
  const di = pr.rows.filter(x => x.ph === dn.dp).pop(),
    ot = parseFloat(S.kv.recipe.ogT);
  sv('#pv-di', di ? f(di.v) : '-');
  sv('#pd-di', ot > 1 ? nf(ot, 3) : '-');
  sv('#pv-df', f(pr.end));
  sv('#pd-df', dn.df ? nf(dn.df, 3) : '-');
  /* noms affichés (hors ligne en modification) : traduits, avec l’atténuation / le sucre de resucrage */
  const gs = (+S.kv.recipe.sucre || 0) * pr.end;
  P.forEach((ph, p) => {
    const h = document.querySelector(`input.phn[data-phn="${p}"]`);
    if (h && h.readOnly) h.value = tx(ph.n || '');
    ph.rows.forEach((r, i) => {
      const el = document.querySelector(`input.nm[data-pn="${p}"][data-i="${i}"]`);
      if (el && el.readOnly) el.value = procLabel(r, dn.att, gs, tx);
    });
  });
  const ok = Math.abs(pr.end - pr.T) < 0.005;
  if (!ok)
    W.push(
      `⚠ Le tableau aboutit à ${f(pr.end)} L en bouteilles pour ${f(pr.T)} L visés (rinçage saisi à la main ou ligne ajoutée).`
    );
  if (pr.R < 0)
    W.push('⚠ Eau de rinçage négative : réduire le ratio d’empâtage / le volume mort, ou ajouter une perte.');
  const cm = wIn('cmax');
  if (cm > 0 && o.vgr >= cm - 1e-9)
    W.push(
      `⚠ Volume d’eau + malt = ${f(o.vgr, 1)} L : atteint ou dépasse le maximum de la cuve (${f(cm, 1)} L, paramètre « Volume maxi empâtage + malt dans la cuve »). Réduire le ratio d’empâtage ou le volume mort.`
    );
  $('#pwarn').innerHTML = W.map(x => `<p class="wmsg">${x}</p>`).join('');
}
const WOUT = [
  [
    'VOLUMES D’EAU',
    [
      ['v0', 'Volume d’eau d’empâtage initial (L)', 2],
      ['ret', 'Volume de moût retenu par le grain (L)', 2],
      ['vpre', 'Volume pré-rinçage disponible (L)', 2],
      ['vpreT', 'Volume de moût pré-ébullition cible (L)', 2],
      ['rincN', 'Volume d’eau de rinçage nécessaire (L)', 2],
      ['vgr', 'Volume d’eau + malt (L)', 2],
      ['tot', 'Volume d’eau total (L)', 2]
    ]
  ],
  [
    'DENSITÉS',
    [
      ['pts', 'Points de sucre totaux extraits (L°)', 1],
      ['hot', 'Volume de moût post-ébullition à chaud (L)', 2],
      ['cold', 'Volume final de moût froid en fermenteur (L)', 2],
      ['d1', 'Densité pré-rinçage', 3],
      ['d2', 'Densité pré-ébullition', 3],
      ['d3', 'Densité post-ébullition', 3],
      ['d4', 'Densité initiale (DI) après fusion de la glace', 3]
    ]
  ],
];
function waterPanel() {
  const inp = ([k, l, t, d]) =>
    `<tr><td>${l}</td><td><input type="number" step="any" class="wi" ${t === 'e' ? `data-e="${k}"` : `data-w="${k}"`} data-d="${d}" data-t="${t}"${k === 'kg' || k === 'glace' || k === 'ratio' || k === 'duree' ? ` readonly title="Issu de l’écran Conception${k === 'duree' ? ' (paliers d’empâtage › Ébullition)' : ''}"` : k === 'pot' ? ' readonly title="Calculé d’après les malts de la recette (écran Conception)"' : ''}></td></tr>`;
  return `<div class="panel"><h3>Paramètres de brassage <small>— vide = valeur automatique (recette / équipement)</small></h3><div class="wgrid2">${WIN.map(([h, r]) => `<table class="wt">${h ? `<tr><th colspan="2">${h}</th></tr>` : ''}${r.map(inp).join('')}</table>`).join('')}${WOUT.slice(
    2
  )
    .map(
      ([h, r]) =>
        `<table class="wt"><tr><th colspan="2">${h}</th></tr>${r.map(([k, l, d], i) => `<tr><td>${l}</td><td><input readonly class="wr ro" id="wo-${h[0]}${i}"></td></tr>`).join('')}</table>`
    )
    .join('')}<div id="wwarn"></div></div></div>`;
}
/* 6.9.0 : section « Calculs » des Paramètres — température d'un mélange de liquide froid et de liquide chaud, comme
   l'ancienne « Température du moût dans le fermenteur en fin de transfert » : par défaut, liquide froid = glace du
   Process (« Ajouts » des étapes « glace ») à −16 °C, liquide chaud = moût transféré (moût en fermenteur − glace) à 95 °C.
   Liquide froid à 0 °C ou moins = glace : il faut la fondre (80 kcal/kg) et la réchauffer (0,5 kcal/kg/°C).
   Valeurs saisies dans S.kv.equip.calc ; case vide = valeur par défaut (italique). */
const CALC = [
  ['c', 'Volume de liquide froid'],
  ['h', 'Volume de liquide chaud']
];
function calcDef() {
  const o = wcalc(),
    g = wIn('glace');
  return { cv: g, ct: wIn('tglace'), hv: Math.max(0, (o.mg || 0) - g), ht: wIn('tmout') };
}
function calcVal() {
  const D = calcDef(),
    C = S.kv.equip.calc || {},
    v = k => (C[k] !== undefined && C[k] !== '' && !isNaN(+C[k]) ? +C[k] : D[k]);
  const cv = v('cv'),
    ct = v('ct'),
    hv = v('hv'),
    ht = v('ht'),
    V = cv + hv;
  return { cv, ct, hv, ht, t: V > 0 ? (ct <= 0 ? (hv * ht - cv * (80 + 0.5 * Math.abs(ct))) / V : (hv * ht + cv * ct) / V) : 0 };
}
function calcPanel() {
  const cell = k => `<td><input type="number" step="any" class="wi wc" data-calc="${k}"></td>`;
  return `<div class="panel" id="calcp"><h3>Calculs</h3><table class="wt"><tr><th colspan="3">TEMPÉRATURE</th></tr><tr><td></td><td class="ch">Volume (L)</td><td class="ch">Température (°C)</td></tr>${CALC.map(([p, l]) => `<tr><td>${l}</td>${cell(p + 'v')}${cell(p + 't')}</tr>`).join('')}<tr class="sum"><td>Température résultante (°C)</td><td></td><td class="pc" id="calc-t"></td></tr></table></div>`;
}
function updCalc() {
  if (!$('#calcp')) return;
  const D = calcDef(),
    C = S.kv.equip.calc || {},
    r = calcVal();
  document.querySelectorAll('[data-calc]').forEach(el => {
    if (document.activeElement === el) return;
    const k = el.dataset.calc,
      own = C[k] !== undefined && C[k] !== '';
    el.value = +(+(own ? C[k] : D[k])).toFixed(2);
    el.classList.toggle('auto', !own);
  });
  $('#calc-t').textContent = nf(r.t, 1) + ' °C';
}
function updWater() {
  updCalc();
  if (!$('#wwarn')) return;
  const o = wcalc(),
    E = S.kv.equip,
    W = E.w || {};
  o.mg = wIn('vmoût');
  document.querySelectorAll('.wi:not(.wc)').forEach(el => {
    if (document.activeElement === el) return;
    const k = el.dataset.w || el.dataset.e,
      d = +el.dataset.d,
      own =
        k === 'kg' || k === 'glace' || k === 'ratio' || k === 'duree' || k === 'pot'
          ? false
          : el.dataset.t === 'w' || el.dataset.t === 'a'
            ? W[k] !== undefined
            : true;
    el.value = +(+wIn(k) * (k === 'duree' ? 60 : 1)).toFixed(d);
    el.classList.toggle('auto', !own);
  });
  document.querySelectorAll('[data-e]').forEach(el => {
    if (
      !el.classList.contains('wi') &&
      document.activeElement !== el &&
      E[el.dataset.e] !== undefined &&
      el.type === 'number'
    )
      el.value = E[el.dataset.e];
  });
  WOUT.forEach(([h, r]) =>
    r.forEach(([k, l, d], i) => {
      const el = $('#wo-' + h[0] + i);
      if (el) {
        const t = nf(o[k], d);
        if (el.tagName === 'INPUT') el.value = t;
        else el.textContent = t;
        if (k === 'vgr') {
          const over = wIn('cmax') > 0 && o.vgr >= wIn('cmax') - 1e-9;
          el.classList.toggle('bad', over);
          el.title = 'Maximum autorisé : ' + nf(wIn('cmax'), 1) + ' L (Volume maxi empâtage + malt dans la cuve)';
        }
      }
    })
  );
  const w = [],
    fm = wIn('fmax'),
    vf = wIn('vmoût');
  if (vf > fm + 1e-9)
    w.push(`⚠ Le volume cible en fermenteur (${nf(vf, 1)} L) dépasse le maximum du fermenteur (${nf(fm, 1)} L).`);
  if (Math.abs(o.vbot - wIn('bout')) > 0.05)
    w.push(
      `ℹ Pour obtenir ${nf(wIn('bout'), 1)} L en bouteilles, il faut ${nf(o.vreq, 1)} L en fermenteur (actuellement ${nf(o.vbot, 1)} L en bouteilles).`
    );
  if (o.rincN < 0) w.push('⚠ Eau de rinçage négative : réduire le ratio d’empâtage ou le volume mort.');
  $('#wwarn').innerHTML = w.map(x => `<p class="wmsg">${x}</p>`).join('');
}
function params0() {
  const E = S.kv.equip;
  const fld = ([k, l, t]) =>
    t === 'w'
      ? `<label>${l}<input type="number" step="any" data-w="${k}" value="${+(+wIn(k)).toFixed(2)}"></label>`
      : `<label>${l}<input type="number" step="any" data-e="${k}" value="${E[k]}"></label>`;
  main.innerHTML = `<div class="panel full"><h3>Équipement & process</h3><div class="eq"><label>Nom de l’équipement<input data-e="name" value="${esc(E.name || '')}"></label>${EQ.map(fld).join('')}</div><h4 class="eqsub">Valeurs par défaut</h4><div class="eq" id="eqdef">${EQD.map(fld).join('')}</div></div>`;
}
const coefPanel = () => {
  const E = S.kv.equip;
  return `<div class="panel"><h3>Coefficients d’utilisation des houblons <small>— appliqués aux IBU Tinseth</small></h3><div class="eq">${USES.map(u => `<label>${u}<input type="number" step="0.05" min="0" data-cf="${u}" value="${E.coef[u]}"></label>`).join('')}</div></div>`;
};
/* Écrans à compléter */
const stub = (t, m, pr) => () => {
  main.innerHTML = `<div class="panel" style="margin:10px 12px"><h3>${t}${pr ? '<button onclick="window.print()">🖨 Imprimer / PDF</button>' : ''}</h3><div class="stub">${m}</div></div>`;
};
/* Navigation & événements */
const SCR = {
  conception: ['Conception', conception],
  biblio: ['Bibliothèque', biblio],
  malts: ['Malts', () => dbScreen('malts')],
  hops: ['Houblons', () => dbScreen('hops')],
  yeasts: ['Levures', () => dbScreen('yeasts')],
  eaux: ['Eaux', () => dbScreen('eaux')],
  styles: ['Styles', stylesScreen],
  ings: ['Ingrédients', () => dbScreen('ings')],
  conso: ['Consommables', () => dbScreen('conso')],
  html: ['HTML', stub('HTML', 'Contenu à définir : génération HTML de la recette et du brassage.')],
  labels: ['Étiquettes', () => labelsScreen()],
  sheet: [
    'Feuille de brassage',
    stub('Feuille de brassage', 'Contenu à définir : feuille imprimable, format A4 portrait.', 1)
  ],
  params: ['Paramètres', params],
  doc: ['Documentation', docScreen]
};
/* don : bouton Ko-fi (image ko-fi.com copiée dans lib/kofi6.png : affichage hors ligne), dans l'en-tête et dans la fenêtre
   « Offrir un café » ; un clic ouvre la page Ko-fi dans le navigateur habituel (le serveur n'ouvre que config.DonURL) */
const KOFI_URL = 'https://ko-fi.com/G7U82APSVO';
const KOFI_BTN = id =>
  `<a${id ? ` id="${id}"` : ''} class="kofi" href="${KOFI_URL}" target="_blank" data-donopen="1" title="Offrir un café au développeur (Ko-fi)"><img height="36" style="border:0px;height:36px;" src="lib/kofi6.png" border="0" alt="Buy Me a Coffee at ko-fi.com" /></a>`;
async function donOpen() {
  try {
    await api('api/don', { method: 'POST', headers: { 'X-OpenMaltForge': '1' } });
    notify('don', '✔ Merci ! La page de don s’ouvre dans votre navigateur.', 'ok');
  } catch (err) {
    notify('don', /pas encore renseignée/.test(err.message) ? 'La page de don n’est pas encore disponible.' : '⚠ ' + err.message, 'err');
  }
}
/* fenêtre « Offrir un café » : seulement au lancement ; le bouton Ko-fi ouvre la page de don et ferme la fenêtre */
async function donDialog() {
  if (document.querySelector('.bcdlg.dondlg')) return;
  let info = {};
  try {
    info = await (await api('api/info')).json();
  } catch (_) {}
  const on = !!info.don,
    p = t => `<p>${esc(tx(t))}</p>`;
  await bcAsk('OpenMaltForge est gratuit et libre (licence GNU GPL v3), sans publicité ni abonnement.', {
    title: 'Offrir un café',
    ico: ic('coffee'),
    cls: 'dondlg',
    body:
      p('Il est développé sur le temps libre d’un brasseur, pour les brasseurs.') +
      p('Un café offert aide à financer le temps de développement, les nouvelles fonctions et les traductions.') +
      (on
        ? p('Le paiement se fait sur Ko-fi, dans votre navigateur ; aucune donnée de l’application n’est transmise.') +
          `<p class="donbtn">${KOFI_BTN()}</p>`
        : `<p class="donoff">${esc(tx('La page de don n’est pas encore disponible : revenez dans une prochaine version.'))}</p>`) +
      `<p class="donmerci">${esc(tx('Merci pour votre soutien !'))} ${ic('heart')}</p>`,
    alert: 1,
    ok: on ? 'Plus tard' : 'Fermer'
  });
}
document.addEventListener('click', e => {
  const l = e.target.closest && e.target.closest('[data-donopen]');
  if (!l) return;
  e.preventDefault();
  const d = l.closest('.bcdlg');
  if (d) d.querySelector('button.ok')?.click();
  donOpen();
});
/* Documentation (web/doc/index.html), affichée dans l'application ; même thème que l'interface */
function docScreen() {
  const light = document.documentElement.classList.contains('light') || document.body.classList.contains('light');
  /* documentation dans la langue de l'interface (index.html = français, index.<langue>.html sinon) */
  const f = LANG === 'fr' ? 'index.html' : 'index.' + LANG + '.html';
  main.innerHTML = `<iframe id="docf" class="docf" title="Documentation d’OpenMaltForge" src="doc/${f}?v=${VER}${light ? '&theme=light' : ''}"></iframe>`;
}
/* Paliers, volumes, densités */
const VER = '6.10.4',
  MASH = [
    'Palier Saccharification',
    'Palier I',
    'Palier II',
    'Palier III',
    'Rinçage / Recirculation',
    'Mashout',
    'Ébullition'
  ],
  SHORT = ['Sacch.', 'Palier I', 'Palier II', 'Palier III', 'Rinçage', 'Mashout', 'Ébullition'];
function ensureMash() {
  const R = S.kv.recipe;
  if (!R.mash)
    R.mash = MASH.map((k, i) => ({ k, t: ['', 66, '', '', 78, '', 100][i], m: ['', 60, '', '', 30, '', +S.kv.equip.boilD || 60][i] }));
  /* rôles des lignes : « rinse » = palier dont la T° sert à chauffer l’eau de rinçage, « boil » = ébullition (durée du process) */
  R.mash.forEach(r => {
    if (r.role === undefined) r.role = r.k === MASH[4] ? 'rinse' : r.k === MASH[6] ? 'boil' : '';
  });
}
const mshort = r => {
  const i = MASH.indexOf(r.k);
  return i >= 0 ? SHORT[i] : String(r.k || '');
};
const mashPanel = () => {
  ensureMash();
  return `<div class="panel"><h3>Paliers d’empâtage<button data-madd="1" title="Ajouter une ligne">＋</button></h3><table class="mtab"><tr><th>Étape</th><th>°C</th><th>Min</th><th></th></tr>${S.kv.recipe.mash.map((r, i) => `<tr><td><input class="nm" data-mi="${i}" data-mf="k" value="${esc(tx(r.k))}"></td>${['t', 'm'].map(f => `<td><input type="number" min="0" step="1" data-mi="${i}" data-mf="${f}" value="${r[f]}"></td>`).join('')}<td class="pact"><button class="x" data-mm="${i}:-1" title="Monter">▲</button><button class="x" data-mm="${i}:1" title="Descendre">▼</button><button class="x" data-mdel="${i}" title="Supprimer">✕</button></td></tr>`).join('')}</table></div>`;
};
const fd = d => (d ? d.split('-').reverse().join('/') : ''),
  hh = s =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;'),
  nf = (v, d) => (+v).toFixed(d).replace('.', ',');
function brew() {
  const R = S.kv.recipe,
    E = S.kv.equip,
    c = compute(),
    V = +E.vol || 30,
    kg = wIn('kg'),
    o = wcalc();
  return {
    c,
    V,
    kg,
    o,
    boil: wIn('duree') * 60,
    mashW: o.v0,
    sp: Math.max(0, o.rinc),
    vPre: o.vpreb,
    vEnd: o.vpost,
    total: o.tot,
    gFirst: o.d1,
    gPre: o.d2,
    gEnd: o.d3
  };
}
function curvePts() {
  const R = S.kv.recipe,
    E = S.kv.equip,
    ch = +E.chauffe > 0 ? +E.chauffe : 1.5,
    rf = +E.refroid > 0 ? +E.refroid : ch,
    t0 = E.t0 === '' || E.t0 == null || isNaN(+E.t0) ? 12 : +E.t0;
  const M = R.mash.map(r => ({ ...r, s: mshort(r) })).filter(x => x.t !== '' && x.m !== '' && +x.m > 0);
  let T = 0,
    prev = t0;
  const P = [[0, t0]],
    K = [[0, t0, 'Eau']];
  M.forEach(x => {
    const t = +x.t,
      m = +x.m;
    if (t !== prev) {
      T += t > prev ? (t - prev) / ch : (prev - t) / rf;
      P.push([T, t]);
    }
    K.push([T, t, x.s]);
    T += m;
    P.push([T, t]);
    prev = t;
  });
  return { M, P, K, T };
}
function curveSvg() {
  const { M, P, K, T } = curvePts();
  if (!M.length) return '<p>Aucun palier renseigné.</p>';
  const ts = P.map(q => q[1]),
    y0 = Math.max(0, Math.floor(Math.min(...ts) / 10) * 10 - 10),
    y1 = Math.ceil(Math.max(...ts) / 10) * 10 + 10,
    W = 640,
    H = 230,
    l = 38,
    r = 10,
    tp = 18,
    bt = 30,
    X = v => l + (v / T) * (W - l - r),
    Y = v => H - bt - ((v - y0) / (y1 - y0)) * (H - tp - bt);
  let o = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;font:10px sans-serif;fill:#000;background:#fff"><rect width="${W}" height="${H}" fill="#fff"/><rect x="${l}" y="${tp}" width="${W - l - r}" height="${H - tp - bt}" fill="none" stroke="#000" stroke-width=".8"/>`;
  for (let v = y0; v <= y1; v += 10)
    o += `<line x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#000" stroke-width=".3"/><text x="${l - 4}" y="${Y(v) + 3}" text-anchor="end">${v}</text>`;
  const st = T > 240 ? 60 : T > 120 ? 30 : 15;
  for (let v = 0; v <= T; v += st)
    o += `<line x1="${X(v)}" x2="${X(v)}" y1="${tp}" y2="${H - bt}" stroke="#000" stroke-width=".3"/><text x="${X(v)}" y="${H - bt + 12}" text-anchor="middle">${Math.round(v)}</text>`;
  o += `<text x="${W / 2}" y="${H - 4}" text-anchor="middle">Temps (min)</text><text x="4" y="10">°C</text><polyline fill="none" stroke="#000" stroke-width="2" points="${P.map(q => X(q[0]).toFixed(1) + ',' + Y(q[1]).toFixed(1)).join(' ')}"/>`;
  P.forEach(
    q =>
      (o += `<circle cx="${X(q[0]).toFixed(1)}" cy="${Y(q[1]).toFixed(1)}" r="3.2" fill="#000" stroke="#fff" stroke-width="1.5"/>`)
  );
  K.forEach(k => (o += `<text x="${X(k[0]) + 4}" y="${Y(k[1]) - 7}" fill="#000">${k[2]} ${k[1]}°</text>`));
  return o + '</svg>';
}
function styleStats(st) {
  return st && st.name
    ? `<div class="stst">${SV.map(([k, l, d]) => l + ' : ' + rg(st, k, d)).join('  |  ')}</div>`
    : '';
}
function htmlCode() {
  const R = S.kv.recipe,
    E = S.kv.equip,
    b = brew(),
    c = b.c,
    V = b.V,
    tm = R.malts.reduce((a, x) => a + (+x.g || 0), 0),
    y = R.yeasts.map(h => find('yeasts', h.n)),
    td = (...a) => a.map(x => `<td>${x}</td>`).join(''),
    th = (...a) => a.map(x => `<th>${x}</th>`).join(''),
    tr = (x, cl) => `    <tr${cl ? ` class='${cl}'` : ''}>${x}</tr>`,
    tb = (cl, rows) => [`  <table class="${cl}">`, ...rows, '  </table>'],
    PAL = [
      'Palier de saccharification',
      'Empâtage Palier 1',
      'Empâtage Palier 2',
      'Empâtage Palier 3',
      'Rinçage',
      'Mashout',
      'Ebulition'
    ],
    pr = procSolve(),
    wo = wcalc(),
    mt = minTot(),
    sg = +R.sucre || 0,
    co2T = R.tcarbo === undefined || R.tcarbo === '' || R.tcarbo === null || isNaN(R.tcarbo) ? 20 : +R.tcarbo,
    dash = v => (v === '' ? '-' : v),
    rv = k => (R.real && R.real[k] ? hh(R.real[k]) : '-'),
    dg = (+c.og - 1) * 1000,
    aa = dg > 0 ? (c.og - c.fg) / (c.og - 1) : 0;
  return [
    '<div id="article">',
    ...tb('tabla-larga', [
      tr(th('#', 'MALTS', '%', 'Poid (kg)')),
      ...R.malts.map((m, i) => tr(td('#' + (i + 1), hh(m.n), tm ? nf((m.g / tm) * 100, 0) : '-', nf(m.g / 1000, 3))))
    ]),
    ...tb('tabla-larga', [
      tr(th('#', 'HOUBLONS', 'Poid (g)', 'IBU', '%AA', 'Insertion', 'Temps (Mn)')),
      ...R.hops.map((h, i) => {
        const d = find('hops', h.n);
        return tr(
          td(
            '#' + (i + 1),
            hh(h.n),
            nf(h.g, 1),
            nf(c.ibus[i], 1),
            d ? nf((d.alpha_min + d.alpha_max) / 2, 1) : '-',
            h.use,
            h.t
          )
        );
      })
    ]),
    '  <hr id="system-readmore">',
    ...tb('tabla-larga', [
      tr('<th colspan="2">PARAMETRES</th>'),
      tr(td('Date de brassage', fd(R.date))),
      tr(td('Style:', hh(R.style || '-'))),
      tr(td('Brassin réalisé (embouteillage):', R.embou ? fd(R.embou) : '-')),
      tr(td('Ratio d’empâtage (L/kg):', nf(+E.ratio || 0, 2))),
      tr(td('Durée d’ébullition (min):', (m => (m > 0 ? nf(m, 0) : '-'))(+(R.mash || []).find(r => r.role === 'boil')?.m || 0))),
      tr(td('DI cible:', R.ogT ? nf(+R.ogT, 3) : '-')),
      tr(td('IBU cible:', R.ibuT ? nf(+R.ibuT, 0) : '-')),
      tr(td('Volume à embouteiller:', V + 'L')),
      tr(td('ABV:', nf(c.abv, 1))),
      tr(td('IBU (tinseth):', nf(c.ibu, 1))),
      tr(td('IBU/DI:', dg > 0 ? nf(c.ibu / dg, 2) : '-')),
      tr(td('RBR:', dg > 0 ? nf((c.ibu / dg) * (1 + aa - 0.77), 2) : '-')),
      tr(td('Couleur (SRM):', nf(c.ebc / 1.97, 1)))
    ]),
    ...tb('tabla-larga', [
      tr(th('EAU', 'Volume (L) prévu', 'Volume (L) réalisé')),
      /* 6.10.0 : mêmes lignes que « Quantités d’eau » (Conception) ; total = tous les ajouts du Process */
      tr(td('Eau d’empâtage:', nf(wo.v0, 1), rv('v_emp'))),
      tr(td('Eau de rinçage:', nf(wo.rinc, 1), rv('v_rinc'))),
      tr(td('Empâtage + rinçage:', nf(wo.v0 + wo.rinc, 1), '-'), 'total'),
      tr(td('Volume début d’ébullition:', nf(b.vPre, 1), rv('v_debeb'))),
      tr(td('Volume fin d’ébullition:', nf(b.vEnd, 1), rv('v_fineb'))),
      tr(td('Moût dans le fermenteur (glace fondue):', nf(b.o.mg, 1), '-'))
    ]),
    ...tb('tabla-larga', [
      tr(th('PROCESS', 'Pertes (L)', 'Ajouts (L)', 'Volume (L)', 'Densité')),
      ...(() => {
        /* phases et étapes du tableau Process (Paramètres), densité de chaque étape, DI et DF */
        const dn = procDens(pr, b.o.pts),
          gs = sg * pr.end,
          ot = parseFloat(R.ogT),
          out = [];
        ensureProc().forEach((ph, p) => {
          out.push(tr(`<td colspan="5"><b>${hh(ph.n || '-')}</b></td>`, 'sub'));
          pr.rows.forEach((x, j) => {
            if (x.ph !== p) return;
            out.push(
              tr(
                td(
                  hh(procLabel(x.r, dn.att, gs) || '-'),
                  x.l ? nf(x.l, 2) : '-',
                  x.a ? nf(x.a, 2) : '-',
                  nf(x.v, 2),
                  dn[j] == null ? '-' : nf(dn[j], 3)
                )
              )
            );
          });
          const last = pr.rows.filter(x => x.ph === p).pop();
          if (p === dn.dp && last)
            out.push(tr(td('DI (densité initiale visée)', '', '', nf(last.v, 2), ot > 1 ? nf(ot, 3) : '-'), 'total'));
        });
        out.push(
          tr(
            td('DF (densité finale après refermentation en bouteilles)', '', '', nf(pr.end, 2), dn.df ? nf(dn.df, 3) : '-'),
            'total'
          )
        );
        return out;
      })()
    ]),
    ...tb('tabla-larga', [
      tr(th('PROFIL DE L’EAU', 'CL', 'SO4', 'CA', 'MG', 'NA', 'HCO3', '%', 'Litres')),
      ...(R.water || [])
        .filter(x => x.n)
        .map(x => {
          const d = find('eaux', x.n) || {},
            ps = (R.water || []).reduce((q, y) => q + (+y.p || 0), 0);
          return tr(
            td(
              hh(x.n),
              ...IONS.map(k => (d[k] === undefined ? '-' : nf(+d[k] || 0, 1))),
              ps > 0 ? nf(((+x.p || 0) / ps) * 100, 0) : '-',
              x.l ? nf(+x.l, 1) : '-'
            )
          );
        }),
      tr(td('Ajouts de minéraux', ...IONS.map(k => (+(R.minadd || {})[k] || 0 ? nf(+R.minadd[k], 1) : '-')), '-', '-')),
      tr(td('TOTAL', ...IONS.map(k => nf(mt[k], 1)), '100', '-'), 'total'),
      tr(td('RATIO SO/CL', mt.cl > 0 ? nf(mt.so4 / mt.cl, 2) : '-'), 'total')
    ]),
    ...tb('tabla-larga', [
      tr(th('DENSITES', 'Prévu', 'Réalisé')),
      tr(td('Densité avant rinçage', nf(b.gFirst, 3), rv('d_pre'))),
      tr(td('Densité pre-ébullition (et après rinçage):', nf(b.gPre, 3), rv('d_debeb'))),
      tr(td('Densité post-ébullition:', nf(b.gEnd, 3), rv('d_post'))),
      tr(td('DI', nf(c.og, 3), rv('d_ferm'))),
      tr(td('DF', nf(c.fg, 3), rv('d_df')))
    ]),
    ...tb('tabla-larga', [
      tr(th('PALIERS', 'Température (°C)', 'Temps (Mn)')),
      ...R.mash.map(r => tr(td(hh(r.k), dash(r.t), dash(r.m))))
    ]),
    ...tb('tabla-larga', [
      tr(th('#', 'LEVURE', 'Sachets', 'Aténuation', 'Floculation', 'Tps fermention (j)')),
      ...R.yeasts.map((h, i) =>
        tr(
          td(
            '#' + (i + 1),
            hh(h.n),
            nf(+h.g || 0, 0),
            y[i] ? nf((y[i].att_min + y[i].att_max) / 2, 0) + ' %' : '-',
            y[i] ? nf((y[i].floc_min + y[i].floc_max) / 2, 0) + ' %' : '-',
            '-'
          )
        )
      )
    ]),
    ...tb('tabla-larga', [
      tr('<th colspan="2">Embouteillage</th>'),
      tr(td('Volume embouteillé (L)', nf(b.o.vbot, 1))),
      tr(td('CO2-vol', nf(co2res(co2T) + sg / 4, 2))),
      tr(td('Résiduel à ' + co2T + ' °C (vol)', nf(co2res(co2T), 2))),
      tr(td('Resucrage (g/L)', nf(sg, 1))),
      tr(td('Sucre total (g)', nf(sg * b.o.vbot, 0))),
      ...(() => {
        const dn = procDens(pr, b.o.pts),
          j = pr.rows.map(x => x.r.k).lastIndexOf('resuc');
        return [
          tr(td('Densité avec le sucre ajouté (resucrage)', j >= 0 && dn[j] != null ? nf(dn[j], 3) : '-')),
          tr(td('Densité finale après refermentation en bouteilles (DF)', dn.df ? nf(dn.df, 3) : '-'))
        ];
      })()
    ]),
    ...(R.embou
      ? (() => {
          const O = R.org || {},
            di = parseFloat(O.di),
            df = parseFloat(O.df),
            sc = ORG.filter(([k]) => O['s_' + k] !== undefined && O['s_' + k] !== ''),
            tot = sc.reduce((a, [k]) => a + (+O['s_' + k] || 0), 0);
          return tb('tabla-larga', [
            tr('<th colspan="2">ANALYSE ORGANOLEPTIQUE</th>'),
            tr(td('Date de dégustation', O.ddeg ? fd(O.ddeg) : '-')),
            tr(td('DI mesurée', di > 1 ? nf(di, 3) : '-')),
            tr(td('DF mesurée', df > 0 ? nf(df, 3) : '-')),
            tr(td('ABV réel (%)', di > 1 && df > 0 && di >= df ? nf((di - df) * 131.25, 1) : '-')),
            ...['rob', 'lim', 'mou', 'car'].map(k => tr(td(ORGL[k], hh(O[k] || '-')))),
            ...ORG.map(([k, l, m]) =>
              tr(
                td(
                  l + ' (/' + m + ')',
                  (O['s_' + k] !== undefined && O['s_' + k] !== '' ? nf(+O['s_' + k], 1) : '-') +
                    (O['t_' + k] ? ' — ' + hh(O['t_' + k]).replace(/\r?\n/g, ' ') : '')
                )
              )
            ),
            tr(td('NOTE TOTALE (/50)', sc.length ? nf(tot, 1) : '-'), 'total')
          ]);
        })()
      : []),
    "  <table class='invisible'>",
    tr(th('#', 'INGREDIENTS', 'Poid(g)')),
    ...(R.ings || []).filter(x => x.n).map((x, i) => tr(td('#' + (i + 1), hh(x.n), nf(x.g, 1)))),
    ...(R.conso || [])
      .filter(x => x.n)
      .map((x, i) => tr(td('#' + ((R.ings || []).filter(z => z.n).length + i + 1), hh(x.n), nf(x.g, 1)))),
    ...minCost().r.map(x => tr(td('#min', hh(MCO[x.k]), nf(x.g, 2)))),
    '  </table>',
    ...(() => {
      const C = costs(),
        rows = [
          ['Malts', C.tm],
          ['Houblons', C.th],
          ['Levures', C.ty],
          ['Ingrédients', C.ti],
          ['Électricité', C.el],
          ['Eau', C.eau],
          ['Consommables', C.cons]
        ],
        tot = rows.reduce((x, r) => x + r[1], 0),
        bt = +(S.kv.equip.w || {}).bout || V || 1;
      return tb('tabla-larga', [
        tr(th('COUTS', '€')),
        ...rows.map(r => tr(td(r[0], nf(r[1], 2)))),
        tr(td('TOTAL', nf(tot, 2)), 'total'),
        tr(td('Coût par litre', nf(tot / (V || 1), 2)))
      ]);
    })(),
    ...tb('tabla-larga', [
      tr('<th>PROFIL AROMATIQUE</th>'),
      tr(
        `<td><img class="aromatique" src="images/images/brassins/brassin_${hh(R.name)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '')}_${(R.date || '').slice(0, 4)}.png" loading="lazy"/></td>`
      )
    ]),
    ...(R.notes && R.notes.trim()
      ? tb('tabla-larga', [
          tr('<th>NOTES</th>'),
          ...R.notes
            .split(/\r?\n/)
            .filter(l => l.trim())
            .map(l => tr('<td>' + hh(l) + '</td>'))
        ])
      : []),
    "  <div class='version'>",
    '    ' + VER,
    '  </div>',
    '</div>'
  ].join('\n');
}
/* le code HTML stocké pour chaque recette de la bibliothèque est recalculé quand le gabarit change (HTMLV) — jamais de liste de courses dedans */
const HTMLV = 7;
function htmlRefreshAll() {
  const E = S.kv.equip;
  if (E.htmlv === HTMLV) return false;
  S.html = S.html || [];
  (S.biblio || []).forEach(b => {
    try {
      const h = { id: b.id, name: b.name, date: b.date, code: withRec(b, () => htmlCode()) },
        j = S.html.findIndex(x => x.id === b.id);
      j >= 0 ? (S.html[j] = h) : S.html.push(h);
    } catch (e) {}
  });
  E.htmlv = HTMLV;
  return true;
}
function htmlScreen() {
  main.innerHTML = `<div class="panel" style="margin:10px 12px"><h3>Rendu HTML de la recette<button id="cp">📋 Copier</button></h3><textarea id="code" readonly spellcheck="false">${hh(htmlCode())}</textarea></div>`;
  $('#cp').onclick = () => {
    const ta = $('#code'),
      b = $('#cp'),
      ok = () => {
        b.textContent = '✔ Copié';
        setTimeout(() => (b.textContent = '📋 Copier'), 1500);
      };
    if (navigator.clipboard)
      navigator.clipboard.writeText(ta.value).then(ok, () => {
        ta.select();
        document.execCommand('copy');
        ok();
      });
    else {
      ta.select();
      document.execCommand('copy');
      ok();
    }
  };
}
function withRec(rec, fn) {
  const R0 = S.kv.recipe,
    v0 = S.kv.equip.vol;
  S.kv.recipe = rec.recipe;
  S.kv.equip.vol = rec.vol;
  try {
    return fn();
  } finally {
    S.kv.recipe = R0;
    S.kv.equip.vol = v0;
  }
}
/* numéro du brassin de l'année : « année#rang », l'année étant celle de la date de brassage et le rang la position de la recette parmi celles de la
   bibliothèque brassées la même année, classées par date de brassage croissante (à date égale : ordre d'enregistrement). Les recettes importées ne comptent pas. Sans date : aujourd'hui. */
function brewNo(R) {
  R = R || S.kv.recipe;
  const today = new Date().toISOString().slice(0, 10),
    dt = r => (r && r.date) || today,
    id = R.id || '__cur',
    list = (S.biblio || [])
      .filter(b => b.id === R.id || !(b.imp || (b.recipe && b.recipe.imp))) /* recettes importées : exclues du comptage */
      .map(b => ({ id: b.id, d: dt(b.id === R.id ? R : b.recipe && b.recipe.date ? b.recipe : b) }));
  if (!list.some(x => x.id === id)) list.push({ id, d: dt(R) });
  const y = dt(R).slice(0, 4),
    same = list
      .map((x, i) => ({ ...x, i }))
      .filter(x => x.d.slice(0, 4) === y)
      .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.i - b.i)),
    n = same.findIndex(x => x.id === id) + 1;
  return { y, n, code: y + '#' + n };
}
/* les rangs changent quand une date de brassage change : le HTML stocké des recettes des années concernées est recalculé */
function htmlRegenYears(ys, except) {
  S.html = S.html || [];
  (S.biblio || []).forEach(b => {
    if (b.id === except || !ys.includes(String((b.recipe && b.recipe.date) || b.date || '').slice(0, 4))) return;
    try {
      const h = { id: b.id, name: b.name, date: b.date, code: withRec(b, () => htmlCode()) },
        j = S.html.findIndex(x => x.id === b.id);
      j >= 0 ? (S.html[j] = h) : S.html.push(h);
    } catch (e) {}
  });
}
function upsertRecipe() {
  const R = S.kv.recipe;
  if (!(R.name || (R.malts || []).length || (R.hops || []).length)) return null;
  R.id = R.id || 'r' + Date.now().toString(36);
  const rec = {
      id: R.id,
      name: R.name || 'Sans nom',
      style: R.style,
      date: R.date,
      vol: S.kv.equip.vol,
      brasseur: R.brasseur === undefined ? 'Moi' : R.brasseur,
      ...(R.imp ? { imp: 1, est: R.impd && R.impd.est } : {}),
      recipe: JSON.parse(JSON.stringify(R))
    },
    i = S.biblio.findIndex(x => x.id === R.id),
    oy = i >= 0 ? String((S.biblio[i].recipe && S.biblio[i].recipe.date) || S.biblio[i].date || '').slice(0, 4) : '';
  i >= 0 ? (S.biblio[i] = rec) : S.biblio.push(rec);
  try {
    const h = { id: R.id, name: rec.name, date: R.date, code: htmlCode() },
      j = S.html.findIndex(x => x.id === R.id);
    j >= 0 ? (S.html[j] = h) : S.html.push(h);
  } catch (e) {}
  htmlRegenYears([...new Set([String(R.date || '').slice(0, 4), oy].filter(Boolean))], R.id);
  return rec;
}
/* notifications : visibles 10 secondes, quelle que soit leur origine */
{
  const hm = document.getElementById && document.getElementById('hmsg');
  if (hm && window.MutationObserver) {
    let nt;
    new MutationObserver(() => {
      clearTimeout(nt);
      if (hm.textContent)
        nt = setTimeout(() => {
          hm.textContent = '';
          hm.className = '';
        }, 10000);
    }).observe(hm, { childList: true, characterData: true, subtree: true });
  }
}
let HT;
/* notification en haut de l'écran (#hmsg) : même message pour le bouton « Sauvegarder » et la sauvegarde automatique */
function saveNote(r) {
  const m = $('#hmsg');
  if (!m) return;
  const t = new Date().toLocaleTimeString(LOCS[LANG]);
  m.className = r === 'ok' ? 'ok' : 'err';
  m.textContent =
    r === 'ok'
      ? '✔ Tout est enregistré dans ' + dbName() + ' — ' + t
      : '⚠ Non enregistré dans la base : ' + why();
  clearTimeout(HT);
  if (r === 'ok')
    HT = setTimeout(() => {
      if (!/^✔ Tout est enregistré/.test(m.textContent)) return;
      m.textContent = '';
      m.className = '';
    }, 10000);
}
function saveAll() {
  const rec = upsertRecipe(),
    m = $('#hmsg');
  if (m) {
    m.className = '';
    m.textContent = '…';
  }
  return persist().then(saveNote);
}
/* sauvegarde automatique : écrit la base puis affiche la notification comme après un clic sur « Sauvegarder » (une erreur n'est annoncée que si la base était jusque-là synchronisée) */
async function autoPersist() {
  const prev = PST,
    r = await persist(),
    cur = ($('#hmsg') || {}).textContent || '';
  /* ne remplace pas un autre message affiché (récapitulatif d'import, etc.) */
  if ((r === 'ok' || prev === 'ok') && (!cur || /^(✔ Tout est enregistré|⚠ Non enregistré dans la base|…)/.test(cur))) saveNote(r);
  return r;
}
function biblio() {
  const names = (k, arr) =>
    [
      ...new Set(
        arr
          .map(x => {
            const d = find(k, x.n);
            return d ? d.name : x.n;
          })
          .filter(Boolean)
      )
    ].join(', ');
  let L = S.biblio.map((r, i) => {
    let c = { og: 0, fg: 0, ibu: 0, ebc: 0, abv: 0 };
    try {
      withRec(r, () => {
        c = compute();
      });
    } catch (e) {}
    if (r.est) c = { ...c, ...Object.fromEntries(Object.entries(r.est).filter(([k, v]) => v != null)) };
    return {
      i,
      r,
      c,
      name: r.name || '',
      brasseur: r.brasseur || '',
      embou: r.recipe.date ? 1 : 0,
      style: r.style || '',
      og: c.og,
      fg: c.fg,
      ibu: c.ibu,
      ebc: c.ebc,
      abv: c.abv,
      malts: names('malts', r.recipe.malts || []),
      hops: names('hops', r.recipe.hops || []),
      yeasts: names('yeasts', r.recipe.yeasts || [])
    };
  });
  if (!SORT.biblio) SORT.biblio = { c: 'name', d: 1 };
  const so = SORT.biblio;
  {
    const num = ['embou', 'og', 'fg', 'ibu', 'ebc', 'abv'].includes(so.c);
    L.sort(
      (a, b) =>
        so.d *
        (num
          ? (+a[so.c] || 0) - (+b[so.c] || 0)
          : String(a[so.c]).localeCompare(String(b[so.c]), 'fr', { numeric: true, sensitivity: 'base' }))
    );
  }
  const BFC = ['name', 'brasseur', 'embou', 'style', 'og', 'fg', 'ibu', 'ebc', 'abv', 'malts', 'hops', 'yeasts'],
    bfs = x => ({
      name: x.name,
      brasseur: x.brasseur,
      embou: x.embou ? 'oui' : 'non',
      style: x.style,
      og: nf(x.og, 3),
      fg: nf(x.fg, 3),
      ibu: nf(x.ibu, 1),
      ebc: nf(x.ebc, 0),
      abv: nf(x.abv, 1),
      malts: x.malts,
      hops: x.hops,
      yeasts: x.yeasts
    }),
    tot = L.length,
    fa = Object.entries(FLT.biblio || {}).filter(([, v]) => v !== '');
  const bfYes = ['1', 'o', 'ou', 'oui', 'y', 'yes', 'true', 'vrai', 'x', '✔', '✓'],
    bfNo = ['0', 'n', 'no', 'non', 'false', 'faux', '-'];
  if (fa.length)
    L = L.filter(x => {
      const o = bfs(x);
      return fa.every(([c, v]) => {
        if (c === 'embou') {
          const q = nrm(v).trim();
          return bfYes.includes(q) ? !!x.embou : bfNo.includes(q) ? !x.embou : true;
        }
        return nrm(o[c]).includes(nrm(v));
      });
    });
  {
    const sig = JSON.stringify([FLT.biblio, SORT.biblio]);
    if (PG.bsig !== sig) {
      PG.bsig = sig;
      PG.biblio = 0;
    }
  }
  const cv = S.kv.equip.bview === 'cards',
    paged = !cv && L.length > PGSZ;
  if (paged) PG.biblio = Math.max(0, Math.min(PG.biblio || 0, Math.ceil(L.length / PGSZ) - 1));
  const LV = paged ? L.slice(PG.biblio * PGSZ, (PG.biblio + 1) * PGSZ) : L;
  const cut = t => `<td class="cut">${t ? `<div class="cutv" title="${esc(t)}">${hh(t)}</div>` : ''}</td>`;
  const rows = LV.map(
    ({ i, r, c }) =>
      `<tr tabindex="-1"><td class="nm">${hh(r.name)}</td><td><input class="bxb" data-bbr="${i}" value="${esc(r.brasseur || (r.imp ? '-' : ''))}"${r.imp ? ' readonly tabindex="-1"' : ''} placeholder="–" title="${r.imp ? 'Recette importée : non modifiable' : 'Nom du brasseur'}"></td><td class="ckc">${r.recipe.date ? '<span class="okc" title="Brassé le ' + fd(r.recipe.date) + '">✔</span>' : ''}</td><td>${hh(r.style)}</td><td>${nf(c.og, 3)}</td><td>${nf(c.fg, 3)}</td><td>${nf(c.ibu, 1)}</td><td>${nf(c.ebc, 0)}</td><td>${nf(c.abv, 1)}</td>${cut(names('malts', r.recipe.malts || []))}${cut(names('hops', r.recipe.hops || []))}${cut(names('yeasts', r.recipe.yeasts || []))}<td class="act"><span class="acts"><span class="as"><button class="pen" data-bview="${i}" title="Consulter la recette (lecture seule)">👁</button></span><span class="as">${r.imp ? '' : `<button class="pen" data-bedit="${i}" title="Modifier : ouvrir dans la conception">✎</button>`}</span><span class="as">${bxUnres(r.recipe).length ? bxRelBtn(i) : ''}</span><span class="as"><button class="pen" data-bcopy="${i}" title="Copier la recette (pour la modifier)">📄</button></span><span class="as"><button class="x" data-bdel="${i}" title="Supprimer">✕</button></span></span></td></tr>`
  ).join('');
  const BFL = {
      name: 'Nom',
      brasseur: 'Brasseur',
      embou: 'Réalisé',
      style: 'Style',
      og: 'DI',
      fg: 'DF',
      ibu: 'IBU',
      ebc: 'EBC',
      abv: 'ABV %',
      malts: 'Malts',
      hops: 'Houblons',
      yeasts: 'Levures'
    },
    bfi = c =>
      `<input class="fi" data-bf="${c}" value="${esc((FLT.biblio || {})[c] || '')}" placeholder="${cv ? BFL[c] : 'filtrer…'}" title="Filtrer : ${BFL[c]}${c === 'embou' ? ' (1 ou oui = coche verte ; 0 ou non = sans coche)' : ''}" autocomplete="off">`,
    bfx = `<button class="fx" id="bfclr" title="Effacer tous les filtres et revenir au tri par nom croissant"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M16.2 3.8l4 4a1.6 1.6 0 010 2.3L11 19.3H6.6L3.8 16.5a1.6 1.6 0 010-2.3l10.1-10.4a1.6 1.6 0 012.3 0z"/><path d="M8.5 9.3l6.2 6.2M10.5 19.3H21"/></svg></button>`,
    bfRow = `<tr class="flt"><th>${bfi('name')}</th><th>${bfi('brasseur')}</th><th class="ckc">${bfi('embou')}</th><th>${bfi('style')}</th><th>${bfi('og')}</th><th>${bfi('fg')}</th><th>${bfi('ibu')}</th><th>${bfi('ebc')}</th><th>${bfi('abv')}</th><th>${bfi('malts')}</th><th>${bfi('hops')}</th><th>${bfi('yeasts')}</th><th>${bfx}</th></tr>`,
    bfBar = `<div class="bflt noprint">${BFC.map(bfi).join('')}${bfx}</div>`;
  const th = (c, l, x) =>
    `<th class="srt${x || ''}" data-sort="${c}"${c === 'embou' ? ' title="Coche verte = date de brassage renseignée"' : ''}>${l}${arrow('biblio', c)}</th>`;
  main.innerHTML = `<div class="panel" style="margin:10px 12px"><h3>Bibliothèque de recettes (${fa.length ? L.length + ' / ' : ''}${S.biblio.length})<button id="bview" title="Basculer entre la vue liste et la vue cartes">${cv ? '☰ Vue liste' : '▦ Vue cartes'}</button><label class="btn">Import beer.xml<input type="file" id="bximp" accept=".xml,.beerxml,text/xml" multiple hidden></label><label class="btn" title="Importer une recette depuis un PDF (Brewfather, BeerSmith)">Import PDF<input type="file" id="pdfimp" accept=".pdf,application/pdf" multiple hidden></label></h3>${cv ? bxCards(L, bfBar) : ''}<div class="scr"${cv ? ' style="display:none"' : ''}><table class="db lib"><colgroup><col class="c-nm"><col class="c-br"><col class="c-ok"><col class="c-st"><col class="c-n"><col class="c-n"><col class="c-n"><col class="c-n"><col class="c-n"><col class="c-l"><col class="c-l"><col class="c-l"><col></colgroup>${cv ? '' : bfRow}<tr class="hd">${th('name', 'Nom')}${th('brasseur', 'Brasseur')}${th('embou', 'Réalisé', ' ckc')}${th('style', 'Style')}${th('og', 'DI')}${th('fg', 'DF')}${th('ibu', 'IBU')}${th('ebc', 'EBC')}${th('abv', 'ABV %')}${th('malts', 'Malts')}${th('hops', 'Houblons')}${th('yeasts', 'Levures')}<th></th></tr>${rows || '<tr><td colspan="13" style="padding:18px;color:var(--m)">' + (fa.length ? 'Aucune recette ne correspond aux filtres.' : 'Aucune recette enregistrée. Utilisez « Sauvegarder » (en haut à droite) : la recette en cours de conception est ajoutée à la bibliothèque.') + '</td></tr>'}</table></div>${paged ? `<div class="pager noprint">${pgBar('biblio', L.length)}</div>` : ''}</div>`;
  bxScrollInit();
  if (paged) pgFill(main.querySelector('table.lib'), LV.length);
  {
    const bv = $('#bview');
    if (bv)
      bv.onclick = () => {
        S.kv.equip.bview = cv ? 'list' : 'cards';
        save();
        biblio();
      };
    const imf = (id, fn) => {
      const im = $(id);
      if (im)
        im.onchange = async e => {
          const fl = [...e.target.files];
          e.target.value = '';
          if (!fl.length) return;
          const r = await fn(fl),
            m = $('#hmsg'),
            ad = Object.values(r.added).reduce((a, b) => a + b, 0);
          const msg =
            (r.ok.length
              ? '✔ ' +
                r.ok.length +
                ' recette(s) importée(s) (lecture seule)' +
                (ad ? ' — ' + ad + ' ingrédient(s) inconnu(s) ajouté(s) aux bibliothèques' : '') +
                (r.relinked ? ' — ' + r.relinked + ' ingrédient(s) relié(s)' : '') +
                (r.unk && r.unk.length && r.relinked === undefined
                  ? ' — ' +
                    r.unk.length +
                    ' ingrédient(s) inconnu(s) conservé(s) en texte (non ajoutés aux bibliothèques) : ' +
                    r.unk.join(', ')
                  : '') +
                ((r.idx || []).some(i => S.biblio[i] && bxUnres(S.biblio[i].recipe).length)
                  ? ' — ingrédients encore absents : icône ↻ pour refaire la correspondance'
                  : '')
              : '') + (r.errs.length ? (r.ok.length ? ' · ' : '') + '⚠ ' + r.errs.join(' ; ') : '');
          biblio();
          const m2 = $('#hmsg');
          if (m2) {
            m2.className = r.errs.length && !r.ok.length ? 'err' : 'ok';
            m2.textContent = msg;
          }
        };
    };
    imf('#bximp', bxImport);
    imf('#pdfimp', pdImport);
  }
  main.querySelectorAll('th[data-sort]').forEach(
    h =>
      (h.onclick = () => {
        const c = h.dataset.sort;
        SORT.biblio = { c, d: SORT.biblio && SORT.biblio.c === c && SORT.biblio.d === 1 ? -1 : 1 };
        biblio();
      })
  );
}
SCR.html[1] = htmlScreen;
SCR.sheet[1] = sheetScreen;
/* 6.7.0 (revu en 6.7.1) : écran Conception — double-clic sur le titre d'une section (h3) = la replier ou la déplier, elle
   seule ; double-clic sur le titre d'un radar (h4 de #radars) = toute la ligne des radars. Une section repliée ne garde que
   son titre (suivi d'un chevron) et son trait jaune, sur la même largeur. Clés mémorisées dans S.kv.equip.folds :
   « h3:<titre français d'origine> » ou « radars » ; réappliquées après chaque rendu (observateur sur #main). */
const foldKey = h => {
  if (h.closest('#radars')) return 'radars';
  let t = '';
  for (const n of h.childNodes) if (n.nodeType === 3) t += n.__o !== undefined ? n.__o : n.data;
  return 'h3:' + (t.replace(/\s+/g, ' ').trim() || (h.textContent || '').trim());
};
const foldTitles = () => (CURSCR === 'conception' ? [...document.querySelectorAll('#main .panel > h3, #main .panel > h4')] : []);
function foldApply() {
  const F = (S.kv && S.kv.equip && S.kv.equip.folds) || [];
  foldTitles().forEach(h => {
    const on = F.includes(foldKey(h)),
      p = h.parentElement;
    if (p.classList.contains('fold') !== on) p.classList.toggle('fold', on);
    let c = h.querySelector(':scope > .foldc');
    if (on && !c) {
      c = document.createElement('span');
      c.className = 'foldc';
      c.innerHTML = ic('down');
      /* 6.10.1 : juste après le titre (et son <small>), avant les boutons ou éléments alignés à droite */
      const b = [...h.children].find(x => x.tagName === 'BUTTON' || (x.tagName === 'SPAN' && !x.classList.contains('ic')));
      h.insertBefore(c, b || null);
    } else if (!on && c) c.remove();
    if (!h.title) h.title = noIc(tx(h.closest('#radars') ? 'Double-clic : replier / déplier la ligne des radars' : 'Double-clic : replier / déplier la section'));
  });
}
document.addEventListener('dblclick', e => {
  const h = e.target.closest && e.target.closest('#main .panel > h3, #main .panel > h4');
  if (!h || CURSCR !== 'conception' || e.target.closest('button, input, select, label, a')) return;
  const E = S.kv.equip,
    k = foldKey(h);
  E.folds = (E.folds || []).filter(x => x === 'radars' || x.startsWith('h3:')) /* clés 6.7.0 sans préfixe : abandonnées */;
  if (E.folds.includes(k)) E.folds = E.folds.filter(x => x !== k);
  else E.folds.push(k);
  getSelection && getSelection().removeAllRanges();
  foldApply();
  save();
});
let foldQ = false;
new MutationObserver(() => {
  if (foldQ) return;
  foldQ = true;
  queueMicrotask(() => {
    foldQ = false;
    foldApply();
  });
}).observe(document.getElementById('main'), { childList: true, subtree: true });
/* 6.9.0 : styles sans fourchette (styles « spéciaux » BJCP : 21B, 27, 28…34) — la valeur basse manquante
   prend la plus basse de tous les styles, la valeur haute manquante la plus haute ; écrit une fois dans la base (styfix2) */
function styleFix() {
  const E = S.kv && S.kv.equip;
  if (!E || E.styfix2 || !Array.isArray(S.styles) || !S.styles.length) return false;
  const has = v => v !== null && v !== undefined && v !== '' && !isNaN(+v);
  let n = 0;
  for (const [lo, hi] of [
    ['og_min', 'og_max'],
    ['ibu_min', 'ibu_max'],
    ['srm_min', 'srm_max'],
    ['fg_min', 'fg_max'],
    ['abv_min', 'abv_max']
  ]) {
    const L = S.styles.filter(x => has(x[lo])).map(x => +x[lo]),
      H = S.styles.filter(x => has(x[hi])).map(x => +x[hi]);
    if (!L.length || !H.length) continue;
    const mn = Math.min(...L),
      mx = Math.max(...H);
    S.styles.forEach(x => {
      if (!has(x[lo])) (x[lo] = mn), n++;
      if (!has(x[hi])) (x[hi] = mx), n++;
    });
  }
  E.styfix1 = E.styfix2 = 1;
  return true;
}
/* 6.9.0 : ＋ Nouvelle recette — malts, houblons et levure tirés au hasard dans les bases : un malt de base (EBC ≤ 10)
   et deux autres malts, deux houblons (amérisant 60 min, aromatique 10 min), une levure ; les quantités sont ensuite
   ajustées aux cibles par le calcul. Seuls les composants utilisables (potentiel, alpha connus) sont tirés. */
function newRandom(R) {
  const pick = (a, n) => {
      const c = a.slice(),
        out = [];
      while (c.length && out.length < n) out.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]);
      return out;
    },
    ok = (o, k) => o && o.name && +o[k] > 0,
    M = (S.malts || []).filter(m => ok(m, 'potentiel')),
    base = pick(M.filter(m => +m.ebc > 0 && +m.ebc <= 10), 1),
    others = pick(
      M.filter(m => !base.includes(m)),
      2
    ),
    H = pick(
      (S.hops || []).filter(h => ok(h, 'alpha_min') || ok(h, 'alpha_max')),
      2
    ),
    Y = pick(
      (S.yeasts || []).filter(y => y && y.name),
      1
    );
  if (base.length || others.length)
    R.malts = [...base, ...others].map((m, i) => ({ n: m.name, g: [5000, 400, 200][i] || 200 }));
  if (H.length) R.hops = H.map((h, i) => ({ n: h.name, g: i ? 20 : 25, use: 'Ébullition', t: i ? 10 : 60 }));
  if (Y.length) R.yeasts = [{ n: Y[0].name, g: 2 }];
}
/* écran affiché (réaffiché au changement de langue : les valeurs traduites par tx() dans les champs ne le sont pas par le DOM) */
let CURSCR = 'conception';
function show(s) {
  CURSCR = s;
  bxUnlock();
  $('#nav').innerHTML = Object.entries(SCR)
    .map(([k, [l]]) =>
      k === 'doc'
        ? `<button data-s="doc" class="navdoc${k === s ? ' on' : ''}" title="Documentation" aria-label="Documentation">${ic('bookopen')}</button>`
        : `<button data-s="${k}"${k === s ? ' class="on"' : ''}>${l}</button>`
    )
    .join('');
  applyTheme();
  const pg = document.getElementById('pgstyle');
  if (pg && s !== 'labels' && s !== 'sheet') pg.remove();
  SCR[s][1]();
  if (READY) ratioWarn();
}
document.addEventListener('click', async e => {
  const d = e.target.dataset,
    R = S.kv && S.kv.recipe;
  if (d.s) show(d.s);
  else if (e.target.id === 'calc') adjust();
  else if (e.target.id === 'dbsave' || e.target.id === 'dbst' || (e.target.closest && e.target.closest('.hw'))) saveAll();
  else if (e.target.id === 'newrec') {
    const D = defaults().recipe;
    delete D.id;
    D.date = '' /* 6.7.0 : date de brassage à saisir (sa saisie déduit le stock) */;
    D.ogT = S.kv.equip.ogT || D.ogT;
    D.ibuT = S.kv.equip.ibuT || D.ibuT;
    S.kv.equip.ratio = +S.kv.equip.ratioD || 3 /* ratio d’empâtage par défaut (Paramètres) */;
    S.kv.recipe = D;
    S.kv.equip.courses = [] /* nouvelle recette : liste de courses réinitialisée */;
    newRandom(D);
    ensureMash();
    conception();
    /* puis ajustement aux cibles (DI, IBU), comme le bouton Calculer */
    if (D.malts.length && D.hops.length) adjust();
    else save();
  } else if (d.bview !== undefined) {
    rvOpen(+d.bview);
  } else if (d.bedit !== undefined) {
    bxOpen(S.biblio[+d.bedit]);
  } else if (d.bcopy !== undefined) {
    bxCopy(S.biblio[+d.bcopy]);
  } else if (d.bcopycur !== undefined) {
    const b = S.biblio.find(x => x.id === R.id);
    if (b) bxCopy(b);
  } else if (d.bdel !== undefined) {
    const b = S.biblio[+d.bdel];
    if (
      await bcAsk('Supprimer définitivement la recette « ' + b.name + ' » ?', {
        title: 'Supprimer la recette',
        ok: 'Supprimer',
        danger: 1
      })
    ) {
      S.biblio.splice(+d.bdel, 1);
      S.html = S.html.filter(x => x.id !== b.id);
      save();
      biblio();
    }
  } else if (d.al) {
    S[d.al].push(
      {
        eau: { name: '', l: 0 },
        elec: { name: '', w: 0, min: 0 },
        consl: { name: '', q: 1 },
        proc: { name: '', ph: 'Après ébullition', type: 'Perte', l: 0 }
      }[d.al]
    );
    params();
    save();
  } else if (d.dl) {
    S[d.dl].splice(+d.i, 1);
    params();
    save();
  } else if (d.madd) {
    ensureMash();
    S.kv.recipe.mash.push({ k: 'Palier', t: '', m: '', role: '' });
    conception();
    save();
  } else if (d.mdel !== undefined) {
    ensureMash();
    S.kv.recipe.mash.splice(+d.mdel, 1);
    conception();
    save();
  } else if (d.mm) {
    ensureMash();
    const [i, m] = d.mm.split(':'),
      L = S.kv.recipe.mash,
      j = +i + +m;
    if (j >= 0 && j < L.length) {
      [L[+i], L[j]] = [L[j], L[+i]];
      conception();
      save();
    }
  } else if (d.padd !== undefined) {
    const L = ensureProc()[+d.padd].rows;
    L.push({ k: 'x' + Date.now(), n: '' });
    params();
    save();
    procOpen(`tr[data-prow="${d.padd}:${L.length - 1}"]`);
  } else if (d.phadd) {
    const P = ensureProc();
    P.push({ n: 'Phase ' + (P.length + 1), rows: [] });
    params();
    save();
    procOpen(`table[data-phase="${P.length - 1}"] tr.phr`);
  } else if (d.pdel !== undefined) {
    const [a, i] = d.pdel.split(':'),
      P = ensureProc();
    if (i !== undefined) P[+a].rows.splice(+i, 1);
    else {
      /* phase entière : confirmation si elle contient des étapes */
      if (
        P[+a].rows.length &&
        !(await bcAsk('Supprimer cette phase et toutes ses étapes ?', { title: 'Supprimer la phase', ok: 'Supprimer' }))
      )
        return;
      P.splice(+a, 1);
    }
    params();
    save();
  } else if (d.pm) {
    /* ▲ / ▼ : en tête ou en fin de phase, l’étape passe dans la phase voisine */
    const [a, i, m] = d.pm.split(':').map(Number),
      P = ensureProc(),
      L = P[a].rows,
      j = i + m;
    if (j >= 0 && j < L.length) [L[i], L[j]] = [L[j], L[i]];
    else if (P[a + m]) {
      const r = L.splice(i, 1)[0];
      if (m < 0) P[a + m].rows.push(r);
      else P[a + m].rows.unshift(r);
    } else return;
    params();
    save();
  } else if (d.phm) {
    const [a, m] = d.phm.split(':').map(Number),
      P = ensureProc();
    if (!P[a + m]) return;
    [P[a], P[a + m]] = [P[a + m], P[a]];
    params();
    save();
  } else if (d.pzero) {
    if (
      await bcAsk('Rétablir les lignes par défaut du tableau Process ?', {
        title: 'Rétablir le tableau',
        ok: 'Rétablir'
      })
    ) {
      S.kv.equip.proc3 = clone(PDEF);
      params();
      save();
    }
  } else if (d.wadd) {
    R.water = R.water || [];
    R.water.push({ n: '', p: R.water.length ? 0 : 100, l: 0 });
    wnorm();
    conception();
    save();
  } else if (d.wdel !== undefined) {
    R.water.splice(+d.wdel, 1);
    wnorm();
    conception();
    save();
  } else if (d.add) {
    pclr(d.add);
    R[d.add].push(d.add === 'hops' ? { n: '', g: 0, use: 'Ébullition', t: 60 } : { n: '', g: 0 });
    conception();
    save();
  } else if (d.cart) {
    const r0 = (R[d.cart] || [])[+d.i];
    if (r0) courAddItem(d.cart, r0.n, false, true);
  } else if (d.cartd) {
    const o0 = S[d.cartd][+d.i];
    if (o0) courAddItem(d.cartd, o0.name, true);
  } else if (d.cdel !== undefined) {
    const c0 = courList()[+d.cdel];
    /* article retiré à la main : pas remis automatiquement tant que la recette épuise encore son stock */
    if (c0 && R) R.courNo = [...new Set([...(R.courNo || []), c0.t + '|' + c0.n])];
    courList().splice(+d.cdel, 1);
    save();
    courRefresh();
  } else if (e.target.id === 'cpp') {
    coursesPrint();
  } else if (d.del) {
    pclr(d.del);
    R[d.del].splice(+d.i, 1);
    conception();
    save();
  }
});
document.addEventListener('focusout', e => {
  if (e.target.dataset && e.target.dataset.pr !== undefined) setTimeout(updParams, 0);
});
document.addEventListener('input', e => {
  const t = e.target,
    d = t.dataset,
    R = S.kv.recipe;
  if (d.fc !== undefined) {
    fltInput(t);
    return;
  }
  if (d.rs !== undefined) {
    const E = S.kv.equip;
    E.rsel = E.rsel || {};
    const v = t.value.trim(),
      q = v.toLowerCase(),
      L = o => String(lab(d.rs, o));
    $('#dl-rs').innerHTML =
      q.length >= 3
        ? S[d.rs]
            .filter(o => L(o).toLowerCase().includes(q))
            .slice(0, 15)
            .map(o => `<option value="${esc(L(o))}">`)
            .join('')
        : '';
    const hit = v ? S[d.rs].find(o => L(o).toLowerCase() === q) : null;
    if (v && !hit) return;
    const a = rvSel(d.rs);
    a[+d.rx] = hit ? L(hit) : '';
    E.rsel[d.rs] = a;
    drawRv(d.rs);
    save();
    return;
  }
  if (d.wf !== undefined) {
    const x = R.water[+d.wi];
    if (d.wf === 'n') {
      x.n = t.value;
      const v = t.value.toLowerCase();
      $('#dl-eaux').innerHTML =
        v.length >= 3
          ? S.eaux
              .filter(y => String(y.name).toLowerCase().includes(v))
              .slice(0, 15)
              .map(y => `<option value="${esc(y.name)}">`)
              .join('')
          : '';
    } else if (d.wf === 'l') {
      x.l = Math.max(0, parseFloat(t.value) || 0);
      wnorm();
    } else x.p = Math.max(0, parseFloat(t.value) || 0);
    fillMin();
    refresh();
    save();
    return;
  }
  if (d.ma !== undefined) {
    R.minadd = R.minadd || {};
    R.minadd[d.ma] = Math.max(0, parseFloat(t.value) || 0);
    fillMin();
    refresh();
    save();
    return;
  }
  if (d.r) {
    if (d.r === 'sacc') {
      R.sacc = t.value;
      save();
      return;
    }
    if (d.r === 'notes') {
      R.notes = t.value;
      const m = $('#notesp');
      if (m) m.textContent = t.value;
      save();
      return;
    }
    /* 6.5.0 : la date d’embouteillage ne peut pas précéder la date de brassage (saisie refusée, valeur rétablie) */
    if (d.r === 'embou' || d.r === 'date') {
      const em = d.r === 'embou' ? t.value : R.embou,
        br = d.r === 'date' ? t.value : R.date;
      if (em && br && em < br) {
        t.value = R[d.r] || '';
        notify(
          'embou',
          d.r === 'embou'
            ? '⚠ La date d’embouteillage ne peut pas être antérieure à la date de brassage.'
            : '⚠ La date de brassage ne peut pas être postérieure à la date d’embouteillage.',
          'err'
        );
        return;
      }
      const ie = document.querySelector('input[data-r="embou"]');
      if (ie) ie.min = br || '';
    }
    /* 6.9.0 : DI cible / IBU cible saisies — le curseur du bilan suit la cible (sans recalcul) ; la recette est
       recalculée au relâchement (événement change : flèches relâchées, Entrée, sortie du champ) */
    if (d.r === 'ogT' || d.r === 'ibuT') {
      const v = parseFloat(t.value);
      if (!isNaN(v)) {
        R[d.r] = v;
        tgtCursor(d.r === 'ogT' ? 'og' : 'ibu', v);
      }
      save();
      return;
    }
    R[d.r] = ['ogT', 'ibuT'].includes(d.r)
      ? parseFloat(t.value)
      : ['sucre', 'tcarbo', 'glace'].includes(d.r)
        ? t.value === ''
          ? ''
          : parseFloat(t.value)
        : t.value;
    /* 6.7.0 : la date de brassage renseignée déduit les composants du stock (une fois) ; effacée, elle les remet */
    if (d.r === 'date') {
      let sm = '';
      if (R.date && !R.stk) sm = stockOut(R) + ' composant(s) déduit(s) du stock';
      else if (!R.date && R.stk) {
        sm = R.stk.length + ' composant(s) remis en stock';
        stockBack(R);
      }
      if (sm) notify('stock', '✔ Brassage : ' + sm, 'ok');
      /* 6.9.0 : la recette est enregistrée (bibliothèque + base) dès que la date de brassage change */
      refresh();
      saveAll();
      return;
    }
    /* la date d’embouteillage fait toujours apparaître l’analyse organoleptique du brassin */
    if (d.r === 'embou') {
      const o = $('#orga');
      if (o) o.hidden = !R.embou;
    }
    refresh();
    save();
  } else if (d.o) {
    R.org = R.org || {};
    let v = t.value;
    if (d.o.startsWith('s_') && v !== '') {
      const m = (ORG.find(x => 's_' + x[0] === d.o) || [0, 0, 99])[2];
      v = Math.max(0, Math.min(m, parseFloat(v) || 0));
    }
    R.org[d.o] = v;
    updOrg();
    save();
  } else if (d.e) {
    S.kv.equip[d.e] = d.e === 'name' ? t.value : parseFloat(t.value) || 0;
    refresh();
    updParams();
    save();
  } else if (d.w) {
    const E = S.kv.equip;
    E.w = E.w || {};
    if (t.value.trim() === '') delete E.w[d.w];
    else E.w[d.w] = parseFloat(t.value) || 0;
    updWater();
    save();
  } else if (d.calc) {
    const E = S.kv.equip;
    E.calc = E.calc || {};
    if (t.value.trim() === '') delete E.calc[d.calc];
    else E.calc[d.calc] = parseFloat(t.value) || 0;
    updCalc();
    save();
  } else if (d.cf) {
    S.kv.equip.coef[d.cf] = Math.max(0, parseFloat(t.value) || 0);
    save();
  } else if (d.pr !== undefined) {
    const row = ensureProc()[+d.pr].rows[+d.i];
    if (t.value.trim() === '') delete row[d.pf];
    else row[d.pf] = Math.max(0, parseFloat(t.value) || 0);
    updParams();
    save();
  } else if (d.pn !== undefined) {
    ensureProc()[+d.pn].rows[+d.i].n = t.value.trim();
    save();
  } else if (d.phn !== undefined) {
    ensureProc()[+d.phn].n = t.value.trim();
    save();
  } else if (d.ls) {
    S.proc[d.i][d.ls] = t.value;
    updParams();
    save();
  } else if (d.ln) {
    S[d.ln][d.i][d.lf] = d.lf === 'name' ? t.value : Math.max(0, parseFloat(t.value) || 0);
    updParams();
    save();
  } else if (d.mi !== undefined) {
    R.mash[d.mi][d.mf] = d.mf === 'k' ? t.value : t.value === '' ? '' : Math.max(0, parseFloat(t.value) || 0);
    save();
  } else if (d.t) {
    let nv = num(t.value);
    if (AR.includes(d.c) && typeof nv === 'number') nv = Math.min(5, Math.max(0, nv));
    if (/^prix/.test(d.c) && (nv === '' || nv == null || nv !== nv)) {
      nv = 0; /* prix vide → 0 */
      t.value = '0';
    }
    S[d.t][d.i][d.c] = nv;
    if (d.c === 'stock' || (d.t === 'eaux' && d.c === 'type')) updCart();
    if (d.t === 'malts' && d.c === 'potentiel') {
      recalcMalts();
      ['ppg', 'b46'].forEach(c => {
        const el = document.querySelector(`input[data-t="malts"][data-i="${d.i}"][data-c="${c}"]`);
        if (el) el.value = S.malts[d.i][c];
      });
    }
    save();
  } else if (d.f === 'p') {
    const a = R[d.k];
    R.pm = R.pm || {};
    if (PFRESH[d.k] || R.pm[d.k] == null) {
      const T0 = a.reduce((s, x) => s + (+x.g || 0), 0);
      R.pm[d.k] = T0 || (d.k === 'malts' ? Math.round(wIn('kg') * 1000) : 0);
      a.forEach(x => (x.p = 0));
      PFRESH[d.k] = false;
    }
    const T = R.pm[d.k];
    a[+d.i].p = Math.max(0, parseFloat(t.value) || 0);
    a.forEach(x => {
      x.g = d.k === 'malts' ? Math.round((T * x.p) / 100) : Math.round(((T * x.p) / 100) * 10) / 10;
    });
    document.querySelectorAll(`.rin[data-k="${d.k}"][data-f="g"]`).forEach(el => {
      const i = +el.dataset.i;
      el.value = d.k === 'malts' ? a[i].g / 1000 : a[i].g;
    });
    refresh();
    save();
  } else if (d.f) {
    const r = R[d.k][d.i];
    let v = t.value;
    if (d.f === 'n') {
      const mix = d.k === 'ings' || d.k === 'conso',
        dl = $('#dl-' + (mix ? 'ings' : d.k));
      if (dl)
        dl.innerHTML =
          v.length >= 3
            ? (mix ? ['ings', 'conso'] : [d.k])
                .flatMap(kk => S[kk].filter(x => !x.sys && lab(kk, x).toLowerCase().includes(v.toLowerCase())).map(x => lab(kk, x)))
                .slice(0, 15)
                .map(n => `<option value="${esc(n)}">`)
                .join('')
            : '';
    } else if (d.f !== 'use') {
      v = Math.max(0, parseFloat(v) || 0);
      if (d.k === 'malts' && d.f === 'g') v = Math.round(v * 1000);
      else if (d.k === 'yeasts' || d.f === 't') v = Math.floor(v);
    }
    r[d.f] = v;
    if (d.f === 'g') pclr(d.k);
    refresh();
    save();
  }
});
/* 6.10.4 : style de la Conception — liste déroulante (tous les styles au focus) ou saisie avec autocomplétion
   (à partir de 3 lettres, 15 propositions au plus), même liste que les polices des étiquettes (fddOpen, labels.js) ;
   le <select data-r="style"> caché reste la source de la valeur. Saisie inconnue : style précédent rétabli. */
const stySel = i => i.parentNode.querySelector('select.ssel');
const styText = s => (s.options[s.selectedIndex] || {}).textContent || '';
function styApply(i) {
  const s = stySel(i),
    v = nrm(i.value.trim());
  let o = null;
  if (v) {
    const op = [...s.options];
    o = op.find(x => nrm(x.textContent) === v) || null;
    if (!o && v.length >= 3) {
      const st = op.filter(x => nrm(x.textContent).startsWith(v)),
        inc = op.filter(x => nrm(x.textContent).includes(v));
      o = st.length === 1 ? st[0] : inc.length === 1 ? inc[0] : null;
    }
  }
  if (o && s.value !== o.value) {
    s.value = o.value;
    s.dispatchEvent(new Event('input', { bubbles: true }));
  }
  i.value = styText(s);
}
document.addEventListener('focusin', e => {
  const i = e.target;
  if (!i.classList || !i.classList.contains('sin')) return;
  /* champ vidé au focus : la liste propose tous les styles (la valeur actuelle reste en filigrane) */
  i.placeholder = i.value || tx('Choisir ou saisir un style…');
  i.value = '';
  fddOpen(i);
});
document.addEventListener('input', e => {
  const i = e.target;
  if (i.classList && i.classList.contains('sin')) fddOpen(i);
});
document.addEventListener('focusout', e => {
  const i = e.target;
  if (!i.classList || !i.classList.contains('sin')) return;
  if (FDD && FDD.i === i) fddClose();
  styApply(i);
  i.placeholder = tx('Choisir ou saisir un style…');
});
document.addEventListener('keydown', e => {
  const i = e.target;
  if (!i.classList || !i.classList.contains('sin')) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!FDD) fddOpen(i);
    fddMove(e.key === 'ArrowDown' ? 1 : -1);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (FDD && FDD.opts.length && (FDD.moved || FDD.opts.length === 1)) fddPick(FDD.moved ? FDD.k : 0);
    else i.blur();
  } else if (e.key === 'Escape') {
    fddClose();
    i.value = '';
    i.blur();
  }
});
document.addEventListener('focusin', e => {
  const d = e.target.dataset;
  if (d && d.wf === 'l' && WMODE === 'p') {
    WMODE = 'g';
    fillMin();
  } else if (d && d.wf === 'p' && WMODE === 'g') {
    WMODE = 'p';
    fillMin();
  }
  if (!d || !PMODE[d.k]) return;
  const k = d.k;
  if (d.f === 'p' && PMODE[k] !== 'p') {
    PMODE[k] = 'p';
    PFRESH[k] = true;
    setRO(k);
  } else if (d.f === 'g' && PMODE[k] === 'p') {
    pclr(k);
    setRO(k);
    refresh();
  }
});
document.addEventListener('change', e => {
  const d = e.target.dataset;
  if (d.cq !== undefined) {
    const c = courList()[+d.cq];
    if (c) {
      c.q = Math.max(0, +e.target.value || 0);
      c.r = { manuel: c.q };
      save();
      const x = $('#cpx' + d.cq),
        t = $('#ctot');
      if (x) x.textContent = nf(courPrice(c), 2);
      if (t) t.textContent = nf(courTot(), 2);
      courWarn();
    }
    return;
  }
  if (d.f === 'p') {
    PFORCE = true;
    refresh();
    PFORCE = false;
    return;
  }
  if (d.f === 'n' && (d.k === 'ings' || d.k === 'conso')) {
    const R = S.kv.recipe,
      r = R[d.k][+d.i],
      inI = !!find('ings', r.n),
      inC = !!find('conso', r.n),
      to = inI && !inC ? 'ings' : inC && !inI ? 'conso' : d.k;
    if (to !== d.k) {
      R[d.k].splice(+d.i, 1);
      R[to].push(r);
      conception();
      save();
    }
    return;
  }
  if (d.f && d.f !== 'n' && d.f !== 'use') {
    const x = S.kv.recipe[d.k][d.i][d.f];
    e.target.value = d.k === 'malts' && d.f === 'g' ? x / 1000 : x;
  }
});
window.onerror = (m, u, l) => {
  main.innerHTML = '<div class="panel" style="margin:12px"><h3>Erreur</h3>' + m + ' (ligne ' + l + ')</div>';
};
load()
  .catch(e => {
    console.error(e);
    seed();
  })
  .then(() => {
    ensureMash();
    recalcMalts();
    if (styleFix()) save();
    show('conception') /* au lancement : toujours l'écran de conception */;
    /* au lancement : fenêtre « Offrir un café » (pas dans les navigateurs pilotés : tests, captures) */
    if (!navigator.webdriver) setTimeout(donDialog, 700);
  });

window.addEventListener &&
  window.addEventListener('resize', () => {
    refresh();
    const r = $('#rview');
    if (r) {
      const t = Object.keys(RK).find(k => document.querySelector(`[data-rs="${k}"]`));
      if (t) drawRv(t);
    }
  });

window.addEventListener('resize', () => {
  clearTimeout(window._rz);
  window._rz = setTimeout(() => {
    if (document.getElementById('radars') && typeof refresh === 'function')
      try {
        refresh();
      } catch (e) {}
  }, 200);
});
/* radar plein écran (clic) */
(function () {
  if (typeof document === 'undefined') return;
  const close = () => {
    const o = document.getElementById('rzoom');
    if (o) o.remove();
  };
  const open = sv => {
    close();
    const c = sv.cloneNode(true);
    if (!c.getAttribute('viewBox'))
      c.setAttribute('viewBox', `0 0 ${sv.getAttribute('width')} ${sv.getAttribute('height')}`);
    c.removeAttribute('width');
    c.removeAttribute('height');
    const o = document.createElement('div');
    o.id = 'rzoom';
    o.appendChild(c);
    const pe = (sv.closest('.rbox') || sv).parentElement,
      lg = pe && pe.querySelector('.rleg');
    if (lg) o.appendChild(lg.cloneNode(true));
    const x = document.createElement('button');
    x.textContent = '✕';
    o.appendChild(x);
    o.onclick = close;
    document.body.appendChild(o);
    /* polices proportionnées à l'écran : taille finale ≈ 1,1 % de la largeur de la fenêtre (11 à 16 px), quel que soit le zoom du SVG */
    const fit = () => {
      if (!o.isConnected) {
        window.removeEventListener('resize', fit);
        return;
      }
      const vb = (c.getAttribute('viewBox') || '').split(/[ ,]+/).map(Number),
        k = (c.getBoundingClientRect().width || 1) / (vb[2] || 1),
        px = Math.max(11, Math.min(16, innerWidth * 0.011));
      c.querySelectorAll('text').forEach(t => (t.style.fontSize = (px / k).toFixed(2) + 'px'));
    };
    fit();
    window.addEventListener('resize', fit);
  };
  document.addEventListener('click', e => {
    const sv = e.target.closest && e.target.closest('svg');
    if (!sv || !(sv.querySelector('polygon.rg') || sv.classList.contains('yf')) || sv.closest('#rzoom')) return;
    open(sv);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
  });
})();
/* v3.23 — export PNG des radars */
function pngBtns(root) {
  if (!root) return;
  root.querySelectorAll('svg').forEach(sv => {
    if (!sv.querySelector('polygon.rg') || sv.closest('.rbox') || sv.closest('#rzoom')) return;
    const b = document.createElement('div');
    b.className = 'rbox';
    sv.parentNode.insertBefore(b, sv);
    b.appendChild(sv);
    const w = document.createElement('div');
    w.className = 'rbtns';
    w.innerHTML =
      '<button class="rpng" data-bg="dark" title="Exporter ce radar en PNG (fond sombre)">PNG</button><button class="rpng lt" data-bg="light" title="Exporter ce radar en PNG (fond clair)">PNG</button>';
    b.appendChild(w);
  });
}
function radarPng(box, light) {
  const sv = box.querySelector('svg');
  if (!sv) return;
  const vb = (sv.getAttribute('viewBox') || '').split(/[ ,]+/).map(Number),
    W = vb[2] || +sv.getAttribute('width'),
    H = vb[3] || +sv.getAttribute('height');
  const c = sv.cloneNode(true),
    src = [sv, ...sv.querySelectorAll('*')],
    dst = [c, ...c.querySelectorAll('*')],
    P = [
      'fill',
      'fill-opacity',
      'stroke',
      'stroke-width',
      'stroke-opacity',
      'font-size',
      'font-family',
      'font-weight',
      'text-anchor',
      'opacity'
    ];
  src.forEach((e, i) => {
    const cs = getComputedStyle(e);
    P.forEach(q => {
      const v = cs.getPropertyValue(q);
      if (v) dst[i].style.setProperty(q, v);
    });
    dst[i].style.removeProperty('filter');
  });
  if (light)
    dst.forEach(d => {
      const k = d.getAttribute('class') || '';
      if (k === 'rl' || k === 'rn') d.style.setProperty('fill', '#222');
      else if (k === 'g') d.style.setProperty('stroke', '#c5c9d0');
      else if (/\brg\b/.test(k)) {
        d.style.setProperty('stroke', '#c5c9d0');
        d.style.setProperty('fill', /\bout\b/.test(k) ? 'rgba(0,0,0,.04)' : 'none');
      } else if (d.tagName === 'circle') d.style.setProperty('stroke', '#fff');
      if (d.tagName === 'tspan' && k === '') d.style.setProperty('fill', d.getAttribute('fill') || '#222');
    });
  c.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  c.setAttribute('width', W);
  c.setAttribute('height', H);
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', W);
  bg.setAttribute('height', H);
  bg.setAttribute('fill', light ? '#ffffff' : '#161a20');
  c.insertBefore(bg, c.firstChild);
  const pe = box.parentElement,
    leg = [...(pe.querySelector('.rleg') || { querySelectorAll: () => [] }).querySelectorAll('span')].map(x => ({
      t: x.textContent.trim(),
      c: x.querySelector('i').style.background
    })),
    ttl = (pe.querySelector('h4') || {}).textContent || '';
  const img = new Image();
  img.onload = () => {
    const sc = 2,
      LH = leg.length ? 30 : 0,
      T = ttl ? 30 : 0,
      cv = document.createElement('canvas');
    cv.width = W * sc;
    cv.height = (H + LH + T) * sc;
    const g = cv.getContext('2d');
    g.scale(sc, sc);
    g.fillStyle = light ? '#ffffff' : '#161a20';
    g.fillRect(0, 0, W, H + LH + T);
    if (ttl) {
      g.fillStyle = light ? '#222' : '#e8eaed';
      g.font = '600 16px sans-serif';
      g.textAlign = 'center';
      g.fillText(ttl, W / 2, 21);
    }
    g.drawImage(img, 0, T, W, H);
    if (leg.length) {
      g.font = '13px sans-serif';
      g.textAlign = 'left';
      const ws = leg.map(l => g.measureText(l.t).width + 26);
      let x = Math.max(8, (W - ws.reduce((a, b) => a + b, 0)) / 2);
      leg.forEach((l, i) => {
        g.fillStyle = l.c;
        g.beginPath();
        g.arc(x + 5, T + H + 14, 5, 0, 7);
        g.fill();
        g.fillStyle = light ? '#222' : '#e8eaed';
        g.fillText(l.t, x + 15, T + H + 19);
        x += ws[i];
      });
    }
    cv.toBlob(b => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download =
        'radar_' +
        (light ? 'clair_' : '') +
        (ttl || leg.map(l => l.t).join('_') || 'selection').replace(/[^\w\-]+/g, '_').slice(0, 60) +
        '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c));
}
if (typeof document !== 'undefined')
  document.addEventListener(
    'click',
    e => {
      const b = e.target.closest && e.target.closest('button.rpng');
      if (b) {
        e.stopPropagation();
        radarPng(b.closest('.rbox'), b.dataset.bg === 'light');
      }
    },
    true
  );

/* v3.28 — valeurs calculées (ex-cyan) affichées dans des inputs en lecture seule */
(function () {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  const conv = root =>
    root.querySelectorAll('.pc:not(.cvd)').forEach(el => {
      if (el.closest('tr.sum,tr.exp,.shpage,.lblmain,#article,#rzoom,svg')) return;
      const v = el.textContent,
        i = document.createElement('input');
      i.readOnly = true;
      i.tabIndex = -1;
      i.className = 'cv';
      i.value = v;
      el.classList.add('cvd');
      el.textContent = '';
      el.appendChild(i);
      Object.defineProperty(el, 'textContent', {
        configurable: true,
        get() {
          return i.value;
        },
        set(x) {
          i.value = x == null ? '' : x;
        }
      });
    });
  const m = document.getElementById('main');
  if (!m) return;
  new MutationObserver(() => conv(m)).observe(m, { childList: true, subtree: true });
  conv(m);
})();

/* v3.29 — infobulles des champs en lecture seule (apparition après 0,5 s) */
(function () {
  if (typeof document === 'undefined') return;
  const WT = {
    v0: 'Volume d’empâtage = poids des grains × ratio eau/grain + volume mort sous le panier.',
    ret: 'Eau retenue par les grains = poids des grains × rétention d’eau (L/kg).',
    vpre: 'Volume pré-rinçage = eau d’empâtage − eau retenue par les grains.',
    vpreT:
      'Volume pré-ébullition cible = volume de moût ÷ (1 − contraction) + évaporation × durée d’ébullition + pertes de fond de cuve.',
    rincN: 'Eau de rinçage = volume pré-ébullition − volume pré-rinçage disponible.',
    tot: 'Eau totale = somme des « Ajouts » du Process (empâtage, volume mort, rinçage, glace, resucrage, ajouts personnalisés).',
    pts: 'Points de sucre = poids des grains × potentiel (L°/kg) × efficacité ÷ 100.',
    hot: 'Volume à chaud = volume dans le fermenteur + pertes de fond de cuve (trub).',
    cold: 'Volume de moût froid final = volume post-ébullition (champ repris du calcul).',
    d1: 'Densité = 1 + (points de sucre ÷ volume pré-rinçage) ÷ 1000.',
    d2: 'Densité = 1 + (points de sucre ÷ volume pré-ébullition) ÷ 1000.',
    d3: 'Densité = 1 + (points de sucre ÷ volume post-ébullition) ÷ 1000.',
    d4: 'DI = 1 + (points de sucre ÷ volume de moût cible, glace fondue) ÷ 1000.',
    vgr: 'Eau d’empâtage + volume occupé par les grains (poids ÷ occupation L/kg). Ne doit pas dépasser « Volume maxi empâtage + malt dans la cuve » (Contraintes & températures) : sinon le champ passe en rouge.',
    glace: 'Volume de glace dans le fermenteur = « Ajouts » des étapes du Process dont le nom contient « glace ».',
    rinc: 'Eau de rinçage = volume pré-ébullition − volume pré-rinçage.',
    vpreb: 'Volume pré-ébullition = volume post-ébullition + évaporation × durée d’ébullition.',
    vpost: 'Volume post-ébullition = volume dans le fermenteur + pertes de fond de cuve.',
    vferm: 'Volume dans le fermenteur = volume de moût froid × (1 + contraction).',
    vcold: 'Volume de moût froid = volume cible − glace.',
    mg: 'Volume de moût en fermenteur = volume à embouteiller (Conception) + perte au fond du fermenteur − resucrage.',
    vtr: 'Transfert = volume de moût cible − perte au fond du fermenteur.',
    vres: 'Volume resucré = volume transféré + resucrage.',
    vbot: 'Volume en bouteille = volume de la cuve de resucrage.',
    tf: 'Moyenne pondérée du moût transféré et de la glace : ((V − glace) × T° moût − glace × (80 + 0,5 × |T° glace|)) ÷ V.'
  };
  const SEC = ['V', 'D', 'T'],
    au = k =>
      k === 'init'
        ? '(température du premier palier − température initiale) ÷ chauffe (°C/min).'
        : k === 'rinse'
          ? '(température du palier Rinçage / Recirculation − température initiale) ÷ chauffe × (volume d’eau de rinçage ÷ volume d’eau d’empâtage).'
          : /^r:/.test(k || '')
            ? '(température du palier − température de la ligne précédente) ÷ chauffe (°C/min).'
            : 'Durée de la ligne correspondante du tableau « Paliers d’empâtage » de la Conception.';
  const CS = {
    malts: 'poids (kg) × prix/kg de la bibliothèque',
    hops: 'poids (g) × prix/g de la bibliothèque',
    yeasts: 'nombre de sachets × prix/sachet de la bibliothèque',
    ings: 'poids (g) × prix/g de la bibliothèque',
    conso: 'quantité × prix de la bibliothèque'
  };
  const ID = [
    [
      /^ya/,
      'Atténuation apparente de la levure (moyenne min–max de la bibliothèque) ; avec plusieurs levures, moyenne des levures.'
    ],
    [
      /^yf/,
      'Floculation de la levure (moyenne min–max de la bibliothèque) ; avec plusieurs levures, moyenne des levures.'
    ],
    [/^pv-/, 'Volume cumulé = volume de la ligne précédente − pertes + ajouts de la ligne.'],
    [
      /^pd-/,
      'Densité = 1 + (points de sucre extraits ÷ volume cumulé de la ligne) ÷ 1000 ; « - » avant l’ajout des grains.'
    ],
    [/^pk\d+$/, 'kWh = puissance (W) ÷ 1000 × durée (min) ÷ 60.'],
    [/^ec\d+$/, 'Coût = kWh × prix du kWh.'],
    [/^pe\d+$/, 'Coût = volume (L) ÷ 1000 × prix du m³.'],
    [/^cc\d+$/, 'Coût = quantité × prix du consommable (bibliothèque).'],
    [/^ib\d+$/, 'IBU (Tinseth) apportés par ce houblon : poids, α %, usage, durée et coefficient d’utilisation.'],
    [/^al\d+$/, 'α moyen = (α min + α max) ÷ 2 du houblon (bibliothèque).'],
    [/^pab$/, 'Absorption des drêches = poids des malts × absorption (L/kg).'],
    [/^pev$/, 'Évaporation = taux (L/h) × durée d’ébullition (h).'],
    [/^o-abv$/, 'ABV réel = (DI mesurée − DF mesurée) × 131,25.'],
    [/^calc-t$/, 'Température du mélange : (V chaud × T chaud + V froid × T froid) ÷ (V chaud + V froid) ; liquide froid à 0 °C ou moins = glace : (V chaud × T chaud − V glace × (80 + 0,5 × |T glace|)) ÷ volume total.'],
    [/^w-v0$/, 'Eau d’empâtage = poids des malts × ratio d’empâtage (L/kg) + volume mort.'],
    [/^w-vm$/, 'Eau d’empâtage + poids des malts (1 kg de malt ≈ 1 L).'],
    [/^w-nog$/, 'Eau d’empâtage + eau de rinçage (la glace n’est pas comptée).'],
    [/^w-rinc$/, 'Eau de rinçage nécessaire (calcul des volumes d’eau, écran Paramètres).'],
    [/^w-tf$/, 'Température du moût en fin de transfert, tenant compte de la glace ajoutée.'],
    [/^r-res$/, 'CO₂ déjà dissous dans la bière à la température saisie.'],
    [/^r-vb$/, 'Volume embouteillé = volume du moût − pertes + resucrage.'],
    [/^wrat$/, 'Ratio = sulfates (SO₄) ÷ chlorures (Cl) du total de l’eau (mg/L).'],
    [/^wv-/, 'Apport = valeur (mg/L) de l’eau choisie × part de cette eau dans le total des litres.']
  ];
  function tip(el) {
    const pid = (el.closest('[id]') || {}).id || '',
      id = el.id || pid;
    if (el.dataset.tip) return el.dataset.tip;
    let m = /^cs-(\w+)-\d+$/.exec(id);
    if (m) return 'Coût = ' + (CS[m[1]] || 'quantité × prix unitaire') + '.';
    m = /^wo-(.)(\d+)$/.exec(id);
    if (m && typeof WOUT !== 'undefined') {
      const r = WOUT[SEC.indexOf(m[1])];
      const k = r && r[1][+m[2]] && r[1][+m[2]][0];
      if (k && WT[k]) return WT[k];
    }
    m = /^em(\d+)$/.exec(id);
    if (m && S.elec[+m[1]]) return 'Durée calculée : ' + au(S.elec[+m[1]].auto);
    for (const [r, t] of ID) if (r.test(id)) return t;
    if (el.closest('#costs')) return 'Total des coûts de cette catégorie pour la recette en cours.';
    if (/^cpx\d+$/.test(id)) return 'Estimation (€) = quantité à acheter × prix unitaire de la base.';
    if (el.closest('.mr')) {
      return el.classList.contains('nm')
        ? 'Minéral ajouté automatiquement d’après la ligne « Ajout de minéraux » de l’eau.'
        : 'Quantité (g) = ajout (mg/L) × volume d’eau de brassage (L) ÷ 1000.';
    }
    if (el.closest('tr.ea'))
      return el.classList.contains('nm')
        ? 'Désignation fixe : ligne automatique.'
        : 'Durée calculée : ' + au((S.elec[+(el.id || 'em0').replace('em', '')] || {}).auto);
    if (el.dataset.wf === 'l')
      return 'Litres = quantité totale d’eau nécessaire (hors glace) × % de cette eau ÷ total des %.';
    if (el.dataset.wf === 'p') return '% = litres de cette eau ÷ total des litres saisis.';
    if (el.dataset.k && el.dataset.f === 'g')
      return 'Poids calculé d’après les pourcentages saisis (ressaisir un poids pour repasser en mode poids).';
    if (el.dataset.k && el.dataset.f === 'p')
      return 'Pourcentage calculé d’après les poids saisis (ressaisir un % pour repasser en mode %).';
    const w = el.dataset.w,
      e = el.dataset.e;
    if (w === 'kg') return 'Poids total des malts de la recette (écran Conception).';
    if (w === 'glace') return 'Glace = « Ajouts » des étapes du Process dont le nom contient « glace ».';
    if (w === 'duree') return 'Durée d’ébullition des paliers d’empâtage (Conception), en minutes.';
    if (e === 'ratio' || w === 'ratio') return 'Ratio eau/grain saisi dans l’écran Conception.';
    if (el.dataset.t && el.dataset.c === 'ppg') return 'PPG = potentiel (L°/kg) ÷ 8,345 (calculé).';
    if (el.dataset.t && el.dataset.c === 'b46') return 'B46 = potentiel (L°/kg) ÷ 383,6 (calculé).';
    if (el.dataset.t || el.closest('.ptab')) return 'Lecture seule : cliquez sur ✎ en fin de ligne pour modifier.';
    return el.dataset.tip0 || 'Champ en lecture seule.';
  }
  window.roTip = tip;
  let tm = null,
    box = null,
    cur = null;
  const hide = () => {
    clearTimeout(tm);
    tm = null;
    cur = null;
    if (box) box.style.display = 'none';
  };
  document.addEventListener('mouseover', e => {
    const el = e.target.closest && e.target.closest('input[readonly]');
    if (!el || el === cur) return;
    hide();
    cur = el;
    if (el.title) {
      el.dataset.tip0 = el.title;
      el.removeAttribute('title');
    }
    tm = setTimeout(() => {
      if (!cur) return;
      let t;
      try {
        t = tip(cur);
      } catch (x) {
        t = 'Champ en lecture seule.';
      }
      if (!box) {
        box = document.createElement('div');
        box.id = 'rotip';
        document.body.appendChild(box);
      }
      box.textContent = t;
      box.style.display = 'block';
      const r = cur.getBoundingClientRect(),
        bw = box.offsetWidth,
        bh = box.offsetHeight;
      let x = Math.min(Math.max(6, r.left), innerWidth - bw - 6),
        y = r.bottom + 6;
      if (y + bh > innerHeight - 6) y = Math.max(6, r.top - bh - 6);
      box.style.left = x + 'px';
      box.style.top = y + 'px';
    }, 500);
  });
  document.addEventListener('mouseout', e => {
    if (cur && !(e.relatedTarget && cur.contains && cur.contains(e.relatedTarget))) hide();
  });
  ['scroll', 'mousedown', 'keydown'].forEach(n => document.addEventListener(n, hide, true));
})();

/* v3.33 — focus dans un champ modifiable : valeur précédente sélectionnée (la 1re frappe la remplace) */
(function () {
  if (typeof document === 'undefined') return;
  let fresh = null,
    dirty = false;
  const ok = el =>
    el &&
    el.tagName === 'INPUT' &&
    !(el.dataset && el.dataset.bf) &&
    !el.readOnly &&
    !el.disabled &&
    ![
      'checkbox',
      'radio',
      'file',
      'range',
      'color',
      'button',
      'submit',
      'reset',
      'date',
      'datetime-local',
      'time',
      'month',
      'week',
      'hidden'
    ].includes(el.type);
  const sel = el =>
    setTimeout(() => {
      if (!dirty && document.activeElement === el) {
        try {
          el.select();
        } catch (x) {}
      }
    }, 0);
  document.addEventListener('focusin', e => {
    const el = e.target;
    if (!ok(el)) return;
    fresh = el;
    dirty = false;
    try {
      el.select();
    } catch (x) {}
    sel(el);
  });
  document.addEventListener(
    'input',
    e => {
      if (e.target === fresh) dirty = true;
    },
    true
  );
  document.addEventListener(
    'keydown',
    e => {
      if (e.target === fresh && typeof e.key === 'string' && e.key.length === 1) dirty = true;
    },
    true
  );
  /* clic dans un champ DÉJÀ actif : le curseur se place où l'on clique (plus de re-sélection de tout le texte) ; seul le clic qui donne le focus sélectionne tout */
  let already = false;
  document.addEventListener(
    'mousedown',
    e => {
      already = !!(fresh && e.target === fresh && document.activeElement === fresh);
      if (already) dirty = true;
    },
    true
  );
  document.addEventListener(
    'mouseup',
    e => {
      if (already) {
        already = false;
        return;
      }
      if (fresh && e.target === fresh && !dirty) {
        e.preventDefault();
        try {
          fresh.select();
        } catch (x) {}
        sel(fresh);
      }
    },
    true
  );
})();

/* ===== Formules : dans n'importe quel champ, un texte commençant par « = » est calculé (ex. =3*(2+1,5)/4) =====
   champs numériques : la touche « = » (ou un collage « =… ») bascule le champ en texte le temps de la saisie ; le résultat est écrit à la validation (Entrée / sortie du champ)
   et propagé comme une saisie normale. Pas d'eval : petit analyseur (+ − × ÷ ^ ( ) % ; sqrt, abs, round ; virgule ou point décimal). */
(function () {
  function calc(src) {
    const t = String(src).replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '.');
    let i = 0;
    const err = () => {
      throw 0;
    };
    const num = () => {
      const m = /^\d*\.?\d+(?:e[+-]?\d+)?|^\d+\.?/i.exec(t.slice(i));
      if (!m) err();
      i += m[0].length;
      return parseFloat(m[0]);
    };
    const prim = () => {
      let v;
      if (t[i] === '(') {
        i++;
        v = ex();
        if (t[i] !== ')') err();
        i++;
      } else {
        const m = /^(sqrt|abs|round)\(/i.exec(t.slice(i));
        if (m) {
          i += m[0].length;
          const a = ex();
          if (t[i] !== ')') err();
          i++;
          v = { sqrt: Math.sqrt, abs: Math.abs, round: Math.round }[m[1].toLowerCase()](a);
        } else v = num();
      }
      while (t[i] === '%') {
        i++;
        v /= 100;
      }
      return v;
    };
    const un = () => {
      if (t[i] === '-') {
        i++;
        return -un();
      }
      if (t[i] === '+') {
        i++;
        return un();
      }
      return prim();
    };
    const pw = () => {
      const b = un();
      if (t[i] === '^') {
        i++;
        return Math.pow(b, pw());
      }
      return b;
    };
    const tm = () => {
      let v = pw();
      while (t[i] === '*' || t[i] === '/') {
        const o = t[i++],
          r = pw();
        v = o === '*' ? v * r : v / r;
      }
      return v;
    };
    const ex = () => {
      let v = tm();
      while (t[i] === '+' || t[i] === '-') {
        const o = t[i++],
          r = tm();
        v = o === '+' ? v + r : v - r;
      }
      return v;
    };
    try {
      const v = ex();
      if (i !== t.length || !isFinite(v)) return null;
      return parseFloat(v.toPrecision(12));
    } catch (e) {
      return null;
    }
  }
  window.fxCalc = calc;
  const isF = el =>
    el && el.tagName === 'INPUT' && (el.type === 'number' || el.type === 'text' || (el.dataset && el.dataset.fxT));
  function start(el, txt) {
    if (el.type === 'number') {
      el.dataset.fxT = 'number';
      el.dataset.fxPrev = el.value;
      el.type = 'text';
    }
    el.dataset.fx = '1';
    el.value = txt;
    try {
      el.setSelectionRange(txt.length, txt.length);
    } catch (x) {}
  }
  function done(el) {
    if (!el.dataset.fx) return;
    const num = el.dataset.fxT === 'number',
      v = el.value.trim();
    let r = null;
    if (v[0] === '=') r = calc(v.slice(1));
    delete el.dataset.fx;
    if (num) {
      el.type = 'number';
      delete el.dataset.fxT;
    }
    if (r === null) {
      el.value = num ? el.dataset.fxPrev || '' : v;
      el.classList.add('fxbad');
      setTimeout(() => el.classList.remove('fxbad'), 1200);
      el.title = 'Formule invalide : ' + v;
      if (!num && v[0] !== '=') return;
    } else el.value = String(r);
    delete el.dataset.fxPrev;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  document.addEventListener(
    'keydown',
    e => {
      const el = e.target;
      if (!isF(el) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (
        e.key === '=' &&
        !el.dataset.fx &&
        (el.type === 'number' || (el.type === 'text' && el.value === '')) &&
        !el.readOnly
      ) {
        e.preventDefault();
        start(el, '=');
        return;
      }
      if (el.dataset.fx && e.key === 'Enter') {
        done(el);
      }
    },
    true
  );
  document.addEventListener(
    'paste',
    e => {
      const el = e.target,
        t = ((e.clipboardData && e.clipboardData.getData('text')) || '').trim();
      if (el && el.tagName === 'INPUT' && el.type === 'number' && !el.readOnly && t[0] === '=') {
        e.preventDefault();
        start(el, t);
      }
    },
    true
  );
  /* texte déjà saisi sous la forme « =… » dans un champ texte (collage) : même traitement à la sortie */
  document.addEventListener(
    'input',
    e => {
      const el = e.target;
      if (!el || el.tagName !== 'INPUT') return;
      if (el.dataset.fx) {
        e.stopImmediatePropagation();
        return;
      }
      if (el.type === 'text' && el.value[0] === '=' && !el.readOnly && !el.list) {
        el.dataset.fx = '1';
        e.stopImmediatePropagation();
      }
    },
    true
  );
  document.addEventListener(
    'change',
    e => {
      if (e.target.dataset && e.target.dataset.fx) {
        e.stopImmediatePropagation();
        done(e.target);
      }
    },
    true
  );
  document.addEventListener(
    'focusout',
    e => {
      if (e.target.dataset && e.target.dataset.fx) done(e.target);
    },
    true
  );
})();
