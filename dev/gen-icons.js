// Génère les icônes Lucide d'OpenMaltForge à partir du paquet officiel lucide-static (licence ISC) :
//   - web/js/icons.js : objet ICONS (bloc entre « lucide:debut » et « lucide:fin ») ;
//   - web/css/openmaltforge.css : variables --o-<nom> (masques SVG pour les ornements dessinés en CSS) ;
//   - web/index.html : soleil / lune de l'interrupteur de thème ;
//   - web/lib/LUCIDE-LICENSE.txt : licence ISC de Lucide (à joindre aux icônes).
//
// Usage : node dev/gen-icons.js <dossier lucide-static>      (ex. /tmp/lucide/package)
//   curl -sL https://registry.npmjs.org/lucide-static/-/lucide-static-1.73.0.tgz | tar xz -C /tmp/lucide
//
// Pour ajouter une icône : l'ajouter à NAMES (clé interne → nom Lucide), relancer, puis l'utiliser par ic('clé')
// ou, pour un caractère affiché dans l'interface, l'ajouter à FAMAP (web/js/icons.js).
const fs = require('fs'),
  path = require('path');
const ROOT = path.join(__dirname, '..'),
  PKG = process.argv[2];
if (!PKG) {
  console.error('usage : node dev/gen-icons.js <dossier lucide-static>');
  process.exit(1);
}
const VERSION = JSON.parse(fs.readFileSync(path.join(PKG, 'package.json'), 'utf8')).version;

/* clé interne (ic('clé'), FAMAP) → nom de l'icône Lucide */
const NAMES = {
  lock: 'lock',
  thermometer: 'thermometer',
  login: 'log-in',
  beaker: 'beaker',
  weight: 'weight',
  scale: 'scale',
  gauge: 'gauge',
  mountain: 'mountain',
  plus: 'plus',
  pfirst: 'chevrons-left',
  pprev: 'chevron-left',
  pnext: 'chevron-right',
  plast: 'chevrons-right',
  eye: 'eye',
  pen: 'pencil',
  copy: 'copy',
  xmark: 'x',
  check: 'check',
  rotate: 'rotate-cw',
  warn: 'triangle-alert',
  clipboard: 'clipboard',
  folder: 'folder-open',
  save: 'save',
  cart: 'shopping-cart',
  print: 'printer',
  beer: 'beer',
  wheat: 'wheat',
  leaf: 'leaf',
  mortar: 'cooking-pot',
  droplet: 'droplet',
  search: 'search',
  box: 'package',
  sun: 'sun',
  moon: 'moon',
  dice: 'dices',
  list: 'list',
  cards: 'layout-grid',
  user: 'user',
  calendar: 'calendar-days',
  bottle: 'wine',
  thermo: 'thermometer',
  note: 'sticky-note',
  trash: 'trash-2',
  up: 'chevron-up',
  down: 'chevron-down',
  flask: 'flask-conical',
  database: 'database',
  download: 'download',
  upload: 'upload',
  bookopen: 'book-open-text',
  coffee: 'coffee',
  /* ornements des étiquettes et de la feuille de brassage */
  heart: 'heart',
  flower: 'flower',
  flower2: 'flower-2',
  sprout: 'sprout',
  music: 'music',
  music2: 'music-2',
  star: 'star',
  sparkle: 'sparkle',
  asterisk: 'asterisk',
  recycle: 'recycle',
  play: 'play',
  square: 'square'
};
/* ornements dessinés en CSS (pseudo-éléments) : variables --o-<clé> utilisées comme masque */
const CSS_ORN = ['star', 'play', 'square', 'music2'];

const inner = name => {
  const f = path.join(PKG, 'icons', name + '.svg');
  if (!fs.existsSync(f)) throw new Error('icône Lucide absente : ' + name);
  const t = fs.readFileSync(f, 'utf8');
  return t
    .slice(t.indexOf('>', t.indexOf('<svg')) + 1, t.lastIndexOf('</svg>'))
    .replace(/<!--.*?-->/gs, '')
    .replace(/\s*\n\s*/g, '')
    .replace(/\s+\/>/g, '/>')
    .trim();
};
const between = (file, a, b, content) => {
  const p = path.join(ROOT, file),
    t = fs.readFileSync(p, 'utf8'),
    i = t.indexOf(a),
    j = t.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error(file + ' : repères ' + a + ' / ' + b + ' introuvables');
  fs.writeFileSync(p, t.slice(0, i + a.length) + content + t.slice(j));
};

// 1. web/js/icons.js
const entries = Object.entries(NAMES).map(([k, n]) => `  ${/^[a-z]\w*$/.test(k) ? k : `'${k}'`}: '${inner(n)}'`);
between(
  'web/js/icons.js',
  '/* lucide:debut */',
  '/* lucide:fin */',
  `\n/* Icônes Lucide v${VERSION} (https://lucide.dev, licence ISC) — générées par dev/gen-icons.js, ne pas modifier à la main.\n` +
    `   Contenu = éléments SVG du viewBox 24×24 (traits 2 px arrondis, couleur = currentColor). */\nconst ICONS = {\n` +
    entries.join(',\n') +
    '\n};\n'
);

// 2. web/css/openmaltforge.css : masques des ornements CSS
const dataUrl = n =>
  "url(\"data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner(NAMES[n])}</svg>`
  ).replace(/'/g, '%27') +
  '")';
between(
  'web/css/openmaltforge.css',
  '/* lucide:debut */',
  '/* lucide:fin */',
  `\n/* Ornements Lucide v${VERSION} (licence ISC) pour les pseudo-éléments — générés par dev/gen-icons.js */\n:root {\n` +
    CSS_ORN.map(n => `  --o-${n}: ${dataUrl(n)};`).join('\n') +
    '\n}\n'
);

// 3. web/index.html : interrupteur de thème
const svg = (cls, n) =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner(NAMES[n])}</svg>`;
between('web/index.html', '<!-- lucide:theme -->', '<!-- /lucide:theme -->', svg('thmo', 'moon') + svg('thsu', 'sun'));
// 4. licence
fs.writeFileSync(
  path.join(ROOT, 'web/lib/LUCIDE-LICENSE.txt'),
  `Icônes : Lucide v${VERSION} — https://lucide.dev\n\n` + fs.readFileSync(path.join(PKG, 'LICENSE'), 'utf8')
);
console.log('Lucide ' + VERSION + ' : ' + Object.keys(NAMES).length + ' icônes, ' + CSS_ORN.length + ' ornements CSS');
