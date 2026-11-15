/* Feuille de brassage — HTML éditable, 5 présentations A4 au choix (comme les étiquettes), impression / PDF.
   Chargé avant app.js : utilise ses globales (S, brew, wcalc, wIn, find, hh, nf, fd, esc, curveSvg, styleStats, co2res, VER, main, save, $) à l'appel. */
const SDESIGNS = [
  { id: 'classique', n: 'Classique', d: 'Bandeau noir, cartes, 2 colonnes', arr: 'A' },
  { id: 'cbsb', n: 'Fiche à remplir', d: 'Formulaire en 3 pages : ingrédients, process, notes', arr: 'C' },
  { id: 'rock', n: 'Affiche rock', d: 'Bandeau latéral noir, chiffres géants', arr: 'E' },
  { id: 'pas', n: 'Pas à pas', d: 'Frise verticale numérotée du brassage à la bouteille', arr: 'D' },
  { id: 'journal', n: 'Journal de bord', d: 'Papier réglé, serif, tout en lignes', arr: 'B' }
];
const SW_ROWS = [
  ['emp', 'Eau d’empâtage', 0],
  ['empm', 'Eau d’empâtage + malt', 0],
  ['pre', 'Moût avant rinçage (pré-rinçage)', 1],
  ['rinc', 'Eau de rinçage', 0],
  ['glace', 'Glace dans le fermenteur', 0],
  ['tot', 'Eau totale (empâtage + rinçage + glace)', 0],
  ['debeb', 'Début d’ébullition', 1],
  ['fineb', 'Fin d’ébullition', 1],
  ['froid', 'Moût froid dans le fermenteur', 0],
  ['ferm', 'Fermenteur avec glace (DI)', 1],
  ['tr', 'Transfert vers la cuve de resucrage', 0],
  ['bout', 'En bouteilles', 0],
  ['df', 'DF', 1]
];
function sheetData() {
  const R = S.kv.recipe,
    E = S.kv.equip,
    b = brew(),
    c = b.c,
    w = wcalc(),
    kgw = wIn('kg'),
    tm = R.malts.reduce((a, x) => a + (+x.g || 0), 0),
    co2T = R.tcarbo === undefined || R.tcarbo === '' || R.tcarbo === null || isNaN(R.tcarbo) ? 20 : +R.tcarbo;
  const V = {
      emp: w.v0,
      empm: w.v0 + kgw,
      pre: w.vpre,
      rinc: w.rinc,
      glace: wIn('glace'),
      tot: w.tot,
      debeb: w.vpreb,
      fineb: w.vpost,
      froid: w.vferm,
      ferm: wIn('vol'),
      tr: w.vtr,
      bout: w.vbot,
      df: null
    },
    D = { pre: w.d1, debeb: w.d2, fineb: w.d3, ferm: w.d4, df: c.fg };
  return { R, E, b, c, w, kgw, tm, co2T, V, D, y: R.yeasts[0] && find('yeasts', R.yeasts[0].n) };
}
/* champ à remplir directement dans la feuille (enregistré dans la recette : R.real) */
const shIn = (k, v, cl) =>
  `<input class="re ${cl || ''}" data-re="${k}" value="${esc((S.kv.recipe.real || {})[k] || '')}" inputmode="decimal" autocomplete="off">`;
const shT = (h, rows, cl) =>
  `<table class="${cl || ''}"><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</table>`;
const shCard = (cl, t, body, ex) =>
  `<section class="card ${cl || ''}"><h4><b>${t}</b>${ex ? `<span>${ex}</span>` : ''}</h4>${body}</section>`;
const shPb = v => `<span class="pb"><i style="width:${Math.max(0, Math.min(100, v)).toFixed(0)}%"></i></span>`;
const shTx = (k, cl) =>
  `<input class="re tx ${cl || ''}" data-re="${k}" value="${esc((S.kv.recipe.real || {})[k] || '')}" autocomplete="off">`;
const shLn = (k, n) => Array.from({ length: n }, (_, i) => `<div class="ln">${shTx(k + i)}</div>`).join('');
const SM = {
  head(X, d) {
    const { R, E, b } = X;
    return `<header class="shhead">${E.logo ? `<img src="${E.logo}" class="shlogo" alt="">` : ''}<div class="shtit"><small>Feuille de brassage${E.name ? ' · ' + hh(E.name) : ''}</small><h2>${hh(R.name || 'Sans nom')}</h2><div class="shsub">${hh(R.style || '—')} &nbsp;|&nbsp; ${b.V} L &nbsp;|&nbsp; brassé le ${fd(R.date)}${R.embou ? ' &nbsp;|&nbsp; embouteillé le ' + fd(R.embou) : ''}</div></div></header>`;
  },
  run(X, d, n, N) {
    const { R } = X;
    return `<div class="shrun"><b>${hh(R.name || 'Brassin')}</b><span>${hh(R.style || '')} — ${fd(R.date)}</span><i>${n}/${N}</i></div>`;
  },
  kpi(X) {
    const { c } = X,
      dg = (c.og - 1) * 1000,
      k = (l, v, u) => `<div class="kpi"><b>${v}</b><small>${l}${u ? ' · ' + u : ''}</small></div>`;
    return `<div class="kpis">${k('Densité init.', nf(c.og, 3))}${k('Densité finale', nf(c.fg, 3))}${k('Alcool', nf(c.abv, 1), '% vol.')}${k('Amertume', nf(c.ibu, 0), 'IBU')}${k('Couleur', nf(c.ebc, 0), 'EBC')}${k('IBU / DI', dg > 0 ? nf(c.ibu / dg, 2) : '-')}</div>${styleStats(find('styles', X.R.style))}`;
  },
  water(X) {
    const { V, D, E } = X;
    const rows = SW_ROWS.map(([k, l, hasD]) => [
      l + (k === 'emp' ? ' (' + E.ratio + ' L/kg)' : ''),
      V[k] == null ? '-' : nf(V[k], 2),
      hasD ? nf(D[k], 3) : '-',
      V[k] == null ? '' : shIn('v_' + k),
      hasD ? shIn('d_' + k) : ''
    ]);
    return shCard(
      'water',
      'Volumes d’eau & densités',
      shT(['Étape', 'Volume (L)', 'Densité prévue', 'Volume réalisé', 'Densité réalisée'], rows, 'eau'),
      'à remplir pendant le brassage'
    );
  },
  malts(X) {
    const { R, tm } = X;
    return shCard(
      '',
      'Malts',
      shT(
        ['Malt', '%', 'kg'],
        R.malts.map(m => [
          hh(m.n),
          (tm ? nf((m.g / tm) * 100, 1) : '-') + (tm ? shPb((m.g / tm) * 100) : ''),
          nf(m.g / 1000, 3)
        ]),
        'num2'
      ),
      nf(tm / 1000, 3) + ' kg'
    );
  },
  hops(X) {
    const { R, c } = X,
      mx = Math.max(1, ...c.ibus.map(x => +x || 0));
    return shCard(
      '',
      'Houblons',
      shT(
        ['Houblon', 'g', 'Usage', 'Min', 'IBU'],
        R.hops.map((h, i) => [
          hh(h.n),
          nf(h.g, 1),
          h.use,
          h.t,
          nf(c.ibus[i], 1) + shPb(((+c.ibus[i] || 0) / mx) * 100)
        ]),
        'num3'
      ),
      R.hops.reduce((a, h) => a + (+h.g || 0), 0) + ' g'
    );
  },
  yeast(X) {
    const { R, y } = X;
    return shCard(
      '',
      'Levure',
      shT(
        ['Levure', 'Sachets', 'Atténuation'],
        R.yeasts.map(h => [hh(h.n), h.g, y ? nf((y.att_min + y.att_max) / 2, 0) + ' %' : '-'])
      )
    );
  },
  resu(X) {
    const { R, w, co2T } = X;
    return shCard(
      '',
      'Resucrage & CO₂',
      shT(
        ['', ''],
        [
          ['Sucre de resucrage', (+R.sucre || 0) + ' g/L'],
          ['Température de la bière', nf(co2T, 1) + ' °C'],
          ['CO₂ résiduel', nf(co2res(co2T), 2) + ' vol'],
          ['CO₂ après refermentation', nf(co2res(co2T) + (+R.sucre || 0) / 4, 2) + ' vol'],
          ['Volume embouteillé', nf(w.vbot, 1) + ' L'],
          ['Quantité totale de sucre', nf((+R.sucre || 0) * w.vbot, 0) + ' g']
        ],
        'kvs'
      )
    );
  },
  mash(X) {
    const { R } = X;
    return shCard(
      '',
      'Paliers d’empâtage',
      shT(
        ['Palier', '°C prévu', 'Min prévu', '°C réel', 'Min réel'],
        R.mash.map((r, i) => [r.k, r.t === '' ? '-' : r.t, r.m === '' ? '-' : r.m, shIn('pt' + i), shIn('pm' + i)]),
        'num2 mash'
      )
    );
  },
  curve(X) {
    return shCard('wide', 'Courbe de température', `<div class="curve">${curveSvg()}</div>`);
  },
  temps(X) {
    const { w } = X;
    return shCard(
      '',
      'Températures',
      shT(
        ['Fin de transfert', 'Moût transféré', 'Glace'],
        [[nf(w.tf, 1) + ' °C', nf(wIn('tmout'), 0) + ' °C', nf(wIn('tglace'), 0) + ' °C']]
      )
    );
  },
  band(X) {
    const { c, b } = X,
      i = (l, e, k) =>
        `<div class="bi"><small>${l}</small><div class="est"><em>estimé</em><b>${e}</b></div><div class="mes"><em>mesuré</em>${shIn('m_' + k)}</div></div>`;
    return `<div class="band">${i('Volume', b.V + ' L', 'vol')}${i('Alcool', nf(c.abv, 1) + ' %', 'abv')}${i('Densités', nf(c.og, 3) + ' / ' + nf(c.fg, 3), 'den')}${i('Amertume', nf(c.ibu, 0) + ' IBU', 'ibu')}${i('Couleur', nf(c.ebc, 0) + ' EBC', 'ebc')}</div>`;
  },
  addit(X) {
    return shCard(
      '',
      'Additifs',
      shT(
        ['Additif', 'Fournisseur', 'Qté'],
        [0, 1, 2, 3].map(i => [shTx('ad' + i + 'n'), shTx('ad' + i + 'f'), shTx('ad' + i + 'q')]),
        'frm'
      )
    );
  },
  hopline(X) {
    const { R } = X,
      D = Math.max(10, Math.round((+wIn('duree') || 1) * 60)),
      x0 = 8,
      x1 = 282,
      px = m => x0 + ((x1 - x0) * m) / D,
      st = D > 60 ? 20 : 10;
    let s = `<polygon points="${x0},30 ${x1},30 ${x1 + 12},42 ${x1},54 ${x0},54" fill="#111"/><text x="${(x0 + x1) / 2}" y="46" class="w" text-anchor="middle" font-size="11" letter-spacing="2">ÉBULLITION · ${D} MIN</text>`;
    for (let m = 0; m <= D; m += st)
      s += `<line x1="${px(m)}" x2="${px(m)}" y1="58" y2="63" stroke="#111"/><text x="${px(m)}" y="73" text-anchor="middle" font-size="8" fill="#111">${m}</text>`;
    R.hops.forEach(h => {
      if (!/bull/i.test(h.use)) return;
      const m = Math.max(0, Math.min(D, D - (+h.t || 0)));
      s += `<line x1="${px(m)}" x2="${px(m)}" y1="14" y2="30" stroke="#111"/><circle cx="${px(m)}" cy="10" r="4.5" fill="#fff" stroke="#111" stroke-width="1.4"/><text x="${px(m)}" y="5" text-anchor="middle" font-size="7.5" fill="#111">${nf(h.g, 0)} g</text>`;
    });
    return shCard(
      '',
      'Houblonnage',
      `<div class="hl"><svg viewBox="0 -8 300 86">${s}</svg></div>`,
      'cru / whirlpool : voir tableau'
    );
  },
  ferm(X) {
    return shCard(
      '',
      'Ensemencement & fermentation',
      `<div class="frm2"><label>Réhydratation ${shTx('f_reh')}</label><label>Taux d’ensemencement ${shTx('f_tx')}</label><label>Température ${shTx('f_t')}</label><label>Durée (j) ${shTx('f_d')}</label></div>${shLn('f_l', 4)}`
    );
  },
  didf(X) {
    const { c } = X,
      r = (l, e, k) => `<tr><td>${l}</td><td>${e}</td><td>${shIn(k)}</td></tr>`;
    return shCard(
      '',
      'Densités à 20 °C',
      `<table class="num2"><tr><th></th><th>Estimée</th><th>Mesurée</th></tr>${r('DI', nf(c.og, 3), 'm_di')}${r('DF', nf(c.fg, 3), 'm_df')}${r('Alcool (%)', nf(c.abv, 1), 'm_abv2')}</table>`,
      'alcool ≈ (DI−DF)/7,6 + 0,5 (en points)'
    );
  },
  bott(X) {
    const { w } = X;
    return shCard(
      '',
      'Sucrage, embouteillage & maturation',
      `<div class="bt"><div><div class="frm2"><label>Volume à embouteiller (L) ${shTx('b_v')}</label><label>Sucre ajouté (g) ${shTx('b_s')}</label><label>Durée de maturation ${shTx('b_d')}</label></div><table class="num3 bc"><tr><th>33 cl</th><th>50 cl</th><th>75 cl</th></tr><tr><td>${shIn('b33')}</td><td>${shIn('b50')}</td><td>${shIn('b75')}</td></tr></table></div><div>${shLn('b_l', 5)}</div></div>`,
      'prévu : ' + nf(w.vbot, 1) + ' L'
    );
  },
  notes(X) {
    const n = X.R.notes || '';
    return `<section class="card notes"><h4><b>Notes de brassage</b><span>fermentation · dégustation · à améliorer</span></h4><textarea id="notes" data-r="notes" spellcheck="true" placeholder="Saisissez vos notes ici… (enregistrées avec la recette, reprises dans le rendu HTML)">${hh(n)}</textarea><div class="notesp" id="notesp">${hh(n)}</div></section>`;
  }
};
const stp = (n, h) => `<div class="stp"><i>${n}</i><div>${h}</div></div>`;
function rkSide(X) {
  const { R, E, b, c } = X,
    k = (l, v, u) => `<div class="rk1"><b>${v}</b><small>${l}${u ? ' · ' + u : ''}</small></div>`;
  return `<aside class="rkside">${E.logo ? `<img src="${E.logo}" class="shlogo" alt="">` : ''}<small>Feuille de brassage${E.name ? ' · ' + hh(E.name) : ''}</small><h2>${hh(R.name || 'Sans nom')}</h2><div class="shsub">${hh(R.style || '—')}<br>${b.V} L · ${fd(R.date)}${R.embou ? '<br>embouteillé le ' + fd(R.embou) : ''}</div><div class="rks">${k('Densité init.', nf(c.og, 3))}${k('Densité finale', nf(c.fg, 3))}${k('Alcool', nf(c.abv, 1), '% vol.')}${k('Amertume', nf(c.ibu, 0), 'IBU')}${k('Couleur', nf(c.ebc, 0), 'EBC')}</div></aside>`;
}
const SCOLS = (a, b) => `<div class="cols"><div>${a.join('')}</div><div>${b.join('')}</div></div>`;
function sheetPages(X, id) {
  const dsg = SDESIGNS.find(d => d.id === id) || SDESIGNS[0],
    m = SM;
  let p;
  if (dsg.arr === 'A')
    p = [
      [m.head(X), m.water(X), m.kpi(X), SCOLS([m.malts(X), m.hops(X), m.yeast(X)], [m.mash(X), m.resu(X)])],
      [m.run(X, 0, 2, 2), m.curve(X), m.temps(X), m.notes(X)]
    ];
  else if (dsg.arr === 'B')
    p = [
      [m.head(X), m.kpi(X), m.water(X), SCOLS([m.malts(X), m.hops(X), m.yeast(X), m.resu(X)], [m.mash(X), m.temps(X)])],
      [m.run(X, 0, 2, 2), m.curve(X), m.notes(X)]
    ];
  else if (dsg.arr === 'C')
    p = [
      [m.head(X), m.band(X), m.water(X), SCOLS([m.malts(X)], [m.yeast(X), m.addit(X)]), m.hops(X)],
      [m.run(X, 0, 2, 3), m.curve(X), SCOLS([m.mash(X), m.hopline(X)], [m.ferm(X), m.didf(X)]), m.bott(X)],
      [m.run(X, 0, 3, 3), m.notes(X)]
    ];
  else if (dsg.arr === 'D')
    p = [
      [
        m.head(X),
        m.kpi(X),
        stp(1, m.water(X)),
        stp(2, SCOLS([m.malts(X)], [m.yeast(X)]) + m.hops(X)),
        stp(3, m.mash(X))
      ],
      [m.run(X, 0, 2, 2), stp(4, m.curve(X)), stp(5, SCOLS([m.resu(X)], [m.temps(X)])), m.notes(X)]
    ];
  else
    p = [
      [
        '<div class="rk">' +
          rkSide(X) +
          '<div class="rkm">' +
          m.water(X) +
          m.malts(X) +
          m.hops(X) +
          m.yeast(X) +
          m.mash(X) +
          '</div></div>'
      ],
      [m.run(X, 0, 2, 2), m.curve(X), SCOLS([m.resu(X)], [m.temps(X)]), m.notes(X)]
    ];
  const N = p.length;
  return p
    .map(
      (pg, i) =>
        `<div class="shpage sd-${dsg.id}">${pg.join('')}<footer class="shfoot"><span class="shtag">${ic('star')}  LOUD · HOPPY · HANDMADE  ${ic('star')}   </span>OpenMaltForge ${VER} · ${i + 1}/${N}</footer></div>`
    )
    .join('');
}
function sdThumb(id, sel) {
  const f = sel ? '#ffd60a' : '#8a93a3',
    k = (x, y, w, h, fl) =>
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fl || 'none'}" stroke="${f}" stroke-width="1"/>`,
    ln = y => `<line x1="8" x2="42" y1="${y}" y2="${y}" stroke="${f}" stroke-width=".8"/>`;
  let s = '';
  if (id === 'classique')
    s = k(5, 5, 40, 12, f) + k(5, 20, 40, 8) + k(5, 31, 19, 20) + k(26, 31, 19, 20) + k(5, 54, 40, 16);
  else if (id === 'cbsb')
    s =
      k(5, 5, 28, 9) +
      k(35, 5, 10, 9) +
      k(5, 17, 40, 8, f + '55') +
      k(5, 28, 40, 16) +
      k(5, 47, 19, 10) +
      k(26, 47, 19, 10) +
      k(5, 60, 40, 10);
  else if (id === 'rock')
    s = k(4, 4, 14, 67, f) + k(21, 4, 25, 18) + k(21, 25, 25, 14) + k(21, 42, 25, 14) + k(21, 59, 25, 12);
  else if (id === 'pas')
    s =
      `<line x1="9" x2="9" y1="8" y2="68" stroke="${f}" stroke-width="1" stroke-dasharray="2 2"/>` +
      [8, 26, 44, 60].map(y => `<circle cx="9" cy="${y}" r="3.5" fill="${f}"/>`).join('') +
      k(16, 5, 29, 14) +
      k(16, 23, 29, 16) +
      k(16, 43, 29, 10) +
      k(16, 57, 29, 12);
  else
    s =
      `<rect x="4" y="4" width="42" height="66" fill="none" stroke="${f}" stroke-width="1"/><line x1="12" x2="12" y1="4" y2="70" stroke="${f}" stroke-width=".8"/>` +
      ln(14) +
      ln(22) +
      ln(30) +
      ln(38) +
      ln(46) +
      ln(54) +
      ln(62);
  return `<svg viewBox="0 0 50 75" width="50" height="75">${s}</svg>`;
}
function shFit() {
  const w = document.querySelector('.shwrap'),
    m = document.querySelector('.lblmain');
  if (!w || !m) return;
  const cw = Math.min(m.clientWidth || 9999, (document.querySelector('main') || document.body).clientWidth) - 6;
  w.style.zoom = Math.max(0.2, Math.min(1, cw / (210 * 3.7795))).toFixed(3);
}
const SHDEF = { fnt: '', bgc: '#ffffff', acc: '#111111' };
function shApply() {
  const R = S.kv.recipe,
    w = document.getElementById('shwrap');
  if (!w) return;
  const bg = /^#[0-9a-f]{6}$/i.test(R.shbg || '') ? R.shbg : SHDEF.bgc,
    ac = /^#[0-9a-f]{6}$/i.test(R.sacc || '') ? R.sacc : SHDEF.acc,
    dark = lblDark(bg),
    inv = c => {
      const [h, s, l] = hex2hsl(c);
      return hsl2hex(h, s, 100 - l);
    };
  w.style.setProperty('--ac', dark ? inv(ac) : ac);
  let st = document.getElementById('shdyn');
  if (!st) st = document.head.appendChild(Object.assign(document.createElement('style'), { id: 'shdyn' }));
  const f = R.shfnt ? fontAll().find(x => x.id === R.shfnt) : null;
  st.textContent =
    `#shwrap .shpage{background:${dark ? inv(bg) : bg}!important}` +
    (dark
      ? '#shwrap .shpage{filter:invert(1) hue-rotate(180deg)}#shwrap .shpage img{filter:invert(1) hue-rotate(180deg)}'
      : '') +
    (f ? `#shwrap .shpage,#shwrap .shpage *{font-family:${f.f}!important}` : '') +
    (/^#[0-9a-f]{6}$/i.test(R.sink || '')
      ? `#shwrap .shpage,#shwrap .shpage *{color:${dark ? inv(R.sink) : R.sink}!important}`
      : '');
}
function sheetScreen() {
  const R = S.kv.recipe,
    id = SDESIGNS.some(d => d.id === R.sdesign) ? R.sdesign : 'classique';
  R.sdesign = id;
  R.sacc = R.sacc || SHDEF.acc;
  R.shbg = R.shbg || SHDEF.bgc;
  R.shfnt = R.shfnt || '';
  R.sink = R.sink || '';
  const pg =
    document.getElementById('pgstyle') ||
    document.head.appendChild(Object.assign(document.createElement('style'), { id: 'pgstyle' }));
  pg.textContent = '@page{size:A4 portrait;margin:0}';
  main.innerHTML = `<div class="noprint" style="padding:8px 12px"><button onclick="window.print()">🖨 Imprimer / PDF</button></div><div class="panel noprint lblform shform"><h3>Feuille de brassage</h3><div class="eq"><label>Cadre / accent<input type="color" data-r="sacc" id="sacc" value="${esc(R.sacc)}" style="width:44px;padding:0"></label><label>Fond<input type="color" id="sbg" value="${esc(R.shbg)}" style="width:44px;padding:0"></label><label>Police<select id="sfnt" class="fsel" data-auto="" data-alab="Police du modèle">${fontOpts(R.shfnt, '', 'Police du modèle')}</select></label><label>Couleur police<input type="color" id="sink" value="${esc(R.sink || '#111111')}" style="width:44px;padding:0"></label></div><div class="lblinfo">Cliquez dans la feuille pour saisir : volumes, densités, paliers réels et notes sont enregistrés avec la recette</div></div>
 <div class="lblwrap" style="margin-top:0"><div class="lblmain"><div class="shwrap" id="shwrap" style="--ac:${esc(R.sacc)}">${sheetPages(sheetData(), id)}</div></div>
 <div class="lblside noprint" id="sdside"><h3>Présentations</h3>${SDESIGNS.map(d => `<button class="fmt${d.id === id ? ' sel' : ''}" data-sd="${d.id}"><span class="th">${sdThumb(d.id, d.id === id)}</span><span class="ft"><b>${d.n}</b><small>${d.d}</small></span></button>`).join('')}</div></div>`;
  shApply();
  shFit();
  window.onresize = () => {
    if (document.getElementById('shwrap')) shFit();
  };
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-sd]');
  if (b && document.getElementById('sdside')) {
    const R = S.kv.recipe;
    R.sdesign = b.dataset.sd;
    R.sacc = SHDEF.acc;
    R.shbg = SHDEF.bgc;
    R.shfnt = SHDEF.fnt;
    R.sink = '';
    [
      ['sink', '#111111'],
      ['sacc', R.sacc],
      ['sbg', R.shbg],
      ['sfnt', R.shfnt]
    ].forEach(([i, v]) => {
      const el = document.getElementById(i);
      if (el) el.value = v;
    });
    save();
    document.querySelectorAll('#sdside .fmt').forEach(x => {
      const on = x === b;
      x.classList.toggle('sel', on);
      x.querySelector('.th').innerHTML = sdThumb(x.dataset.sd, on);
    });
    document.getElementById('shwrap').innerHTML = sheetPages(sheetData(), R.sdesign);
    shApply();
    shFit();
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t && t.dataset && t.dataset.re !== undefined) {
    const R = S.kv.recipe;
    R.real = R.real || {};
    R.real[t.dataset.re] = t.value;
    save();
  } else if (t && (t.id === 'sacc' || t.id === 'sbg' || t.id === 'sfnt' || t.id === 'sink')) {
    const R = S.kv.recipe;
    if (t.id === 'sink') R.sink = t.value;
    else if (t.id === 'sbg') R.shbg = t.value;
    else if (t.id === 'sfnt') R.shfnt = t.value;
    else R.sacc = t.value;
    shApply();
    if (t.id === 'sfnt' && !fontReady(t.value))
      fontPre(t.value).then(() => {
        if (R.shfnt === t.value) {
          shApply();
          shFit();
        }
      });
    save();
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t && t.id === 'sfnt') {
    const R = S.kv.recipe;
    R.shfnt = t.value;
    shApply();
    if (!fontReady(t.value))
      fontPre(t.value).then(() => {
        if (R.shfnt === t.value) {
          shApply();
          shFit();
        }
      });
    save();
  }
});
