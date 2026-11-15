/* Internationalisation : le texte source est le français ; les traductions (en, es, it, pt) sont stockées dans la table « traductions » de la base.
   Un traducteur DOM remplace les textes (et title / placeholder / alt / aria-label) selon la langue choisie dans Paramètres. */
const LANGS = [
    ['fr', 'Français'],
    ['en', 'English'],
    ['es', 'Español'],
    ['it', 'Italiano'],
    ['pt', 'Português']
  ],
  LOCS = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', it: 'it-IT', pt: 'pt-PT' };
let LANG = 'fr';
try {
  LANG = localStorage.getItem('bc_lang') || 'fr';
} catch (e) {}
if (!LANGS.some(l => l[0] === LANG)) LANG = 'fr';
const NUMRE = /\d+(?:[.,]\d+)*/g,
  TXC = {};
let TXD = null;
const i18nDict = () => Object.assign({}, I18N_SEED, (typeof S !== 'undefined' && S && S.i18n) || {});
/* traductions corrigées après coup : remplacées aussi dans les bases existantes (5.0.1 : maltier ≠ « malty ») */
const I18N_FIX = ['maltier'];
/* fusionne les traductions livrées avec l'application dans la base (sans écraser les valeurs déjà présentes) */
function i18nMerge() {
  S.i18n = S.i18n || {};
  let n = 0;
  for (const k in I18N_SEED) {
    if (!S.i18n[k] || (I18N_FIX.includes(k) && S.i18n[k].join('|') !== I18N_SEED[k].join('|'))) {
      S.i18n[k] = I18N_SEED[k].slice();
      n++;
    }
  }
  return n;
}
function i18nCompile() {
  const li = LANGS.findIndex(l => l[0] === LANG) - 1,
    d = i18nDict(),
    ex = new Map(),
    ci = new Map(),
    pats = [];
  for (const k in d) {
    const v = d[k][li];
    if (!v) continue;
    if (k.includes('{*}')) {
      const re = new RegExp(
        '^' +
          k
            .split(/(\{\*\}|\{\})/)
            .map(x =>
              x === '{*}'
                ? '([\\s\\S]+?)'
                : x === '{}'
                  ? '(\\d+(?:[.,]\\d+)*)'
                  : x.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&')
            )
            .join('') +
          '$'
      );
      pats.push([re, v, k.length]);
    } else {
      ex.set(k, v);
      ci.set(k.toLowerCase(), v);
    }
  }
  pats.sort((a, b) => b[2] - a[2]);
  TXD = { ex, ci, pats, li };
  for (const k in TXC) delete TXC[k];
}
const fillT = (v, caps) => {
  let i = 0;
  return v.replace(/\{\*\}|\{\}/g, () => caps[i++] ?? '');
};
const isUp = s => s.length > 2 && s === s.toUpperCase() && s !== s.toLowerCase();
function i18nT(s) {
  /* texte déjà « nettoyé » → traduction ou null */
  if (!s || !TXD) return null;
  if (s in TXC) return TXC[s];
  const r = T1(s);
  TXC[s] = r;
  return r;
}
function T1(s) {
  const D = TXD;
  let nums = s.match(NUMRE) || [],
    key = s.replace(NUMRE, '{}'),
    v = D.ex.get(key);
  if (v !== undefined) return fillT(v, nums);
  const lk = key.toLowerCase();
  v = D.ci.get(lk);
  if (v !== undefined) {
    let o = fillT(v, nums);
    if (isUp(s)) o = o.toUpperCase();
    else if (/^\p{Ll}/u.test(s) && /^\p{Lu}/u.test(o) && !/^\p{Lu}{2}/u.test(o)) o = o[0].toLowerCase() + o.slice(1);
    else if (/^\p{Lu}/u.test(s)) o = o[0].toUpperCase() + o.slice(1);
    return o;
  }
  for (const [re, val] of D.pats) {
    const m = re.exec(s);
    if (m)
      return fillT(
        val,
        m.slice(1).map(x => (/^\d/.test(x) && /^\d+(?:[.,]\d+)*$/.test(x) ? x : i18nW(x)))
      );
  }
  /* symboles / ponctuation en tête ou en fin */
  let m = /^([^\p{L}\d{(«"“]+)([\s\S]+)$/u.exec(s);
  if (m) {
    const r = i18nT(m[2]);
    if (r !== null) return m[1] + r;
  }
  m = /^([\s\S]*[\p{L}\d)»”])([\s:.…▲▼✎✕*]+)$/u.exec(s);
  if (m) {
    const r = i18nT(m[1]);
    /* espace insécable française avant « : » supprimée dans les autres langues */
    if (r !== null) return r + m[2].replace(/^\s+:/, ':');
  }
  /* segments : séparateurs essayés du plus fort au plus faible */
  for (const sep of [' — ', ' · ', ' | ', ' – ', ' / ', ', ']) {
    const parts = s.split(sep);
    if (parts.length > 1) {
      let ch = false;
      const o = parts.map(p => {
        const r = i18nT(p.trim());
        if (r !== null) {
          ch = true;
          return r;
        }
        return p;
      });
      if (ch) return o.join(sep);
    }
  }
  return null;
}
const i18nW = x => {
  const r = i18nT(x.trim());
  if (r !== null) return r;
  for (const sep of [' et des ', ' et ']) {
    const p = x.split(sep);
    if (p.length > 1 && p.some(q => i18nT(q.trim()) !== null))
      return p.map(q => i18nT(q.trim()) ?? q).join(TXD.ex.get(sep) || sep);
  }
  return x;
};
/* pour alert / confirm / prompt et les messages construits en JS */
const tx = s => {
  if (LANG === 'fr' || s == null) return s;
  s = String(s);
  const r = i18nT(s.trim());
  return r === null ? s : r;
};
/* ---- DOM ---- */
const TATTR = ['title', 'placeholder', 'alt', 'aria-label'],
  NOTR = /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/;
const skipEl = (e, at) => {
  for (; e; e = e.parentElement) {
    if ((at ? /^(SCRIPT|STYLE)$/ : NOTR).test(e.tagName) || (e.hasAttribute && e.hasAttribute('data-nt'))) return true;
  }
  return false;
};
function trText(n) {
  const cur = n.data;
  let o;
  if (n.__t !== undefined && cur === n.__t) o = n.__o;
  else {
    o = cur;
    n.__o = cur;
    n.__t = undefined;
  }
  let out = o;
  if (LANG !== 'fr') {
    const core = o.trim();
    if (core) {
      const r = i18nT(core.replace(/\s+/g, ' '));
      if (r !== null) out = o.slice(0, o.length - o.trimStart().length) + r + o.slice(o.trimEnd().length);
    }
  }
  if (out !== cur) {
    n.__t = out === o ? undefined : out;
    n.data = out;
  }
}
function trAttrs(e) {
  if (!e.getAttribute || skipEl(e, 1)) return;
  for (const a of TATTR) {
    const cur = e.getAttribute(a);
    if (cur === null) continue;
    const st = e.__a || (e.__a = {});
    let s = st[a];
    let o;
    if (s && cur === s.t) o = s.o;
    else {
      o = cur;
      st[a] = { o, t: undefined };
    }
    let out = o;
    if (LANG !== 'fr' && o.trim()) {
      const r = i18nT(o.trim().replace(/\s+/g, ' '));
      if (r !== null) out = r;
    }
    if (out !== cur) {
      st[a] = { o, t: out === o ? undefined : out };
      e.setAttribute(a, out);
    }
  }
}
function trTree(root) {
  if (!root) return;
  if (root.nodeType === 3) {
    if (!skipEl(root.parentElement)) trText(root);
    return;
  }
  if (root.nodeType !== 1) return;
  if (skipEl(root)) return;
  trAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    if (n.nodeType === 3) {
      if (!skipEl(n.parentElement)) trText(n);
    } else trAttrs(n);
  }
}
function i18nApply() {
  if (!TXD) i18nCompile();
  document.documentElement.lang = LANG;
  trTree(document.body);
}
function setLang(l) {
  if (!LANGS.some(x => x[0] === l)) return;
  document.__tr = 1;
  LANG = l;
  try {
    localStorage.setItem('bc_lang', l);
  } catch (e) {}
  i18nCompile();
  i18nApply();
}
let i18nMO = null;
function i18nStart() {
  if (i18nMO || !document.body) return;
  i18nCompile();
  i18nMO = new MutationObserver(ms => {
    if (LANG === 'fr' && !document.__tr) return;
    for (const m of ms) {
      if (m.type === 'characterData') trTree(m.target);
      else if (m.type === 'attributes') trAttrs(m.target);
      else m.addedNodes.forEach(n => trTree(n));
    }
  });
  i18nMO.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: TATTR
  });
  i18nApply();
}
/* boîtes de dialogue natives */
{
  const a = window.alert.bind(window),
    c = window.confirm.bind(window),
    p = window.prompt.bind(window);
  window.alert = m => a(tx(m));
  window.confirm = m => c(tx(m));
  window.prompt = (m, d) => p(tx(m), d);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', i18nStart);
else i18nStart();
/* ---- Paramètres : choix de la langue ---- */
document.addEventListener('change', e => {
  const t = e.target;
  if (t && t.id === 'langsel') {
    setLang(t.value);
    if (typeof S !== 'undefined' && S.kv) {
      S.kv.equip.lang = t.value;
      save();
    }
  }
});
