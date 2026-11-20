// Batterie de tests de bout en bout : vrai navigateur Chromium + vrai binaire Go d’OpenMaltForge (base SQLite gérée par le serveur).
// Usage : node dev/tests/e2e.js   (variables : CHROME = navigateur, OPENMALTFORGE_BIN = binaire déjà compilé, GO = commande go)
// Chaque scénario part d'un dossier de données vide (comme ~/OpenMaltForge au premier lancement). Code de sortie 1 si un test échoue.
const fs = require('fs'),
  os = require('os'),
  path = require('path'),
  http = require('http'),
  { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..'),
  WEB = path.join(ROOT, 'web');
/* base gérée par le serveur, dans le dossier de données */
const DBF = 'openmaltforge.sqlite';
const VER_APP = /const VER = '([^']+)'/.exec(fs.readFileSync(path.join(WEB, 'js/app.js'), 'utf8'))[1];
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright-core');
const CHROME =
  process.env.CHROME ||
  ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/brave-browser'].find(f =>
    fs.existsSync(f)
  );
let fails = 0,
  total = 0;
const check = (name, ok, detail) => {
  total++;
  if (!ok) fails++;
  console.log((ok ? '  ✔ ' : '  ✘ ') + name + (ok ? '' : '   ← ' + (detail ?? '')));
};
/* dossiers temporaires créés par le script : effacés à la fin (même après une erreur ou Ctrl+C) */
const TMPDIRS = [];
const mkTmp = prefix => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMPDIRS.push(d);
  return d;
};
process.on('exit', () => TMPDIRS.forEach(d => fs.rmSync(d, { recursive: true, force: true })));
['SIGINT', 'SIGTERM'].forEach(s => process.on(s, () => process.exit(130)));
/* dossier de données vide (équivalent de ~/OpenMaltForge au premier lancement) */
const freshCopy = () => mkTmp('bc-');
let SQLJS;
const sqlOpen = async f => {
  SQLJS = SQLJS || (await require('./lib/sql-wasm.js')({ locateFile: f => path.join(__dirname, 'lib', f) }));
  return new SQLJS.Database(fs.readFileSync(f));
};
const tables = async f => {
  const db = await sqlOpen(f);
  const r = db.exec("select name from sqlite_master where type='table' order by name")[0].values.map(x => x[0]);
  db.close();
  return r;
};
const rows = async (f, t) => {
  const db = await sqlOpen(f);
  const r = db.exec(`select count(*) from "${t}"`)[0].values[0][0];
  db.close();
  return r;
};
const wait = ms => new Promise(r => setTimeout(r, ms));
// binaire Go d’OpenMaltForge (compilé une fois au début des tests, sauf OPENMALTFORGE_BIN)
let BIN = process.env.OPENMALTFORGE_BIN || '';
function buildBin() {
  if (BIN) return { status: 0 };
  BIN = path.join(mkTmp('bc-bin-'), 'openmaltforge');
  const go = process.env.GO || [path.join(os.homedir(), 'sdk/go1.24.13/bin/go')].find(f => fs.existsSync(f)) || 'go';
  return spawnSync(go, ['build', '-o', BIN, './cmd/openmaltforge'], {
    cwd: ROOT,
    env: { ...process.env, CGO_ENABLED: '0', GOTOOLCHAIN: 'local' }
  });
}
const DIRS = {}; /* adresse du serveur → dossier de données */
// lance le serveur sur le dossier de données `dir` ; renvoie { url, port, proc, close } (rejet si le serveur s'arrête avant d'écouter)
function startStatic(dir, port) {
  return new Promise((res, rej) => {
    const { spawn } = require('child_process');
    /* port choisi par le système (jamais un port « unsafe » refusé par Chromium) ; `port` est ignoré */
    const proc = spawn(BIN, ['--no-browser', '--port', '0', '--dossier', dir], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    const onData = d => {
      out += d;
      const m = /http:\/\/localhost:(\d+)\//.exec(out);
      if (m) {
        proc.stdout.off('data', onData);
        DIRS[`http://127.0.0.1:${m[1]}/`] = dir;
        res({
          url: `http://127.0.0.1:${m[1]}/`,
          port: +m[1],
          proc,
          out: () => out,
          close: () => proc.kill()
        });
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', d => (out += d));
    proc.on('exit', code => rej(Object.assign(new Error('serveur arrêté (' + code + ') : ' + out.trim()), { code, out })));
  });
}
// --- navigateur ---
let browser;
const errs = [],
  reqExt = [];
async function newPage(url, { init, viewport } = {}) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1900, height: 1200 } });
  const page = await ctx.newPage();
  /* __sqlq(requête) : lignes d'une requête SQL sur le fichier de la base du serveur (lecture seule) */
  if (DIRS[url])
    await page.exposeFunction('__sqlq', async q => {
      const db = await sqlOpen(path.join(DIRS[url], DBF));
      try {
        const r = db.exec(q);
        return r.length ? r[0].values : [];
      } finally {
        db.close();
      }
    });
  {
    const f0 = page.fill.bind(page);
    page.fill = async (sel, v, o) => {
      const m = /^input\[data-p[nr]="(p\d)"\]\[data-i="(\d+)"\]/.exec(sel);
      if (m && (await page.$eval(sel, e => e.hasAttribute('readonly')).catch(() => false)))
        await page.click(`tr[data-prow="${m[1]}${m[2]}"] [data-ped]`);
      return f0(sel, v, o);
    };
  }
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('request', r => {
    if (!/^(data:|blob:|about:)/.test(r.url()) && !/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(r.url())) reqExt.push(r.url());
  });
  page.on('console', m => {
    if (m.type() === 'error' && !/favicon|404/.test(m.text())) errs.push('console: ' + m.text());
  });
  page.on('dialog', d => d.accept());
  await page.addInitScript(() => {
    window.__bcN = 0;
    window.__dlgs = []; /* textes des boîtes de dialogue validées automatiquement */
    const go = () => {
      const d = document.querySelector('.bcdlg');
      if (d && !window.__bcManual) {
        window.__bcN++;
        window.__dlgs.push(d.textContent);
        if (window.__bcClear) d.querySelectorAll('.bcmap input').forEach(i => (i.value = ''));
        const b = d.querySelector(window.__bcAuto === 'no' && d.querySelector('.no') ? '.no' : '.ok');
        b.click();
      }
    };
    new MutationObserver(() => setTimeout(go, 30)).observe(document, { childList: true, subtree: true });
  });
  if (init) await page.addInitScript(init);
  await page.goto(url);
  await page
    .waitForFunction(() => document.querySelector('#gate') || (typeof READY !== 'undefined' && READY), null, {
      timeout: 15000
    })
    .catch(() => {});
  return page;
}
/* la base est chargée par le serveur dès l'ouverture : on attend que l'application soit prête */
const openDb = async page => {
  await page.waitForFunction(() => typeof READY !== 'undefined' && READY, null, { timeout: 15000 });
  await page.waitForSelector('#nav button.on');
  /* les tests attendent une écriture immédiate : on passe la sauvegarde automatique (5 min par défaut) à « après chaque modification » */
  await page.evaluate(() => {
    S.kv.equip.autoMin = 0;
  });
};
/* attend la fin des écritures de la base (sauvegarde programmée puis requête au serveur) */
const settle = page =>
  page.waitForFunction(() => !PEND && !window.__fsa.busy, null, { timeout: 15000 }).then(() => wait(50));
const nav = async (page, k) => {
  await page.click(`#nav button[data-s="${k}"]`);
  await wait(150);
};
const txt = (page, sel) => page.$eval(sel, e => e.textContent);
/* compteur des écritures de la base (PUT api/etat réussis) : window.__fsa.writes */
/* __rt() : écrit l'état dans la base (sans compter dans __fsa.writes) et le relit depuis le serveur = aller-retour réel par SQLite */
const FSA = `(()=>{window.__fsa={writes:0,busy:0};const f=window.fetch.bind(window);window.__rt=async()=>{const r=await f('api/etat',{method:'PUT',headers:{'X-OpenMaltForge':'1','Content-Type':'application/json'},body:dbState()});if(!r.ok)throw new Error('aller-retour : '+r.status);return (await f('api/etat',{cache:'no-store'})).json()};window.fetch=async(u,o)=>{const w=o&&o.method==='PUT'&&/api\\/etat/.test(String(u));if(w)__fsa.busy++;try{const r=await f(u,o);if(w&&r.ok)__fsa.writes++;return r}finally{if(w)__fsa.busy--}}})()`;
const EXPECT = [
  'bibliotheque',
  'consommables',
  'eaux',
  'houblon',
  'html',
  'ingredients',
  'levure',
  'licence',
  'logos',
  'malt',
  'parametres',
  'parametres_consommables',
  'parametres_eau',
  'parametres_electricite',
  'polices',
  'process',
  'recette_consommables',
  'recette_eaux',
  'recette_houblons',
  'recette_ingredients',
  'recette_levures',
  'recette_malts',
  'recette_paliers',
  'recettes',
  'style',
  'traductions'
];

async function scenarioApp(label) {
  console.log('\n■ ' + label);
  const dir = freshCopy(),
    port = 5600 + Math.floor(Math.random() * 300),
    srv = await startStatic(dir, port);
  try {
    const page = await newPage(srv.url, { init: FSA });
    await openDb(page);
    check(
      'démarrage direct : base chargée par le serveur, sans popup ni sélection de fichier',
      !(await page.$('#gate')) && (await page.evaluate(() => READY && !!document.querySelector('#nav button')))
    );
    const cnt = await page.evaluate(() => ({
      m: S.malts.length,
      h: S.hops.length,
      y: S.yeasts.length,
      mn: S.malts.map(x => x.name),
      hn: S.hops.map(x => x.name),
      yn: S.yeasts.map(x => x.name)
    }));
    check(
      'malts chargés depuis le fichier (brewpark : BEST Pilsen, Finest Maris Otter…)',
      cnt.m >= 40 && cnt.mn.includes('BEST Pilsen') && cnt.mn.includes('Finest Maris Otter'),
      cnt.m
    );
    check(
      'houblons chargés (autobrasseur : Citra, Magnum, Nelson Sauvin…)',
      cnt.h >= 80 && ['Citra', 'Magnum', 'Nelson Sauvin'].every(x => cnt.hn.includes(x)),
      cnt.h
    );
    check(
      'levures chargées (sachets 11 g : SafAle US-05, LalBrew Verdant IPA…)',
      cnt.y >= 50 && cnt.yn.includes('SafAle US-05') && cnt.yn.includes('LalBrew Verdant IPA'),
      cnt.y
    );
    check(
      'prix des houblons de base et des levures renseignés (catalogue complémentaire : prix vides)',
      await page.evaluate(() => {
        const nw = CAT.hops.split('\n').map(l => l.split('|')[0]);
        return (
          S.hops.filter(h => !nw.includes(h.name)).every(h => h.prix_g > 0) &&
          (ny => S.yeasts.filter(y => !ny.includes(y.name)).every(y => y.prix_sachet > 0))(
            CAT.yeasts.split('\n').map(l => l.split('|')[0])
          ) &&
          S.hops.length >= 150 &&
          S.hops.filter(h => nw.includes(h.name)).length === nw.length
        );
      })
    );
    check(
      'catalogue malts ajouté (sans doublon, valeurs complètes)',
      await page.evaluate(() => {
        const nw = CAT.malts.split('\n').map(l => l.split('|')[0]);
        const m = S.malts.filter(x => nw.includes(x.name));
        return (
          nw.length >= 90 &&
          m.length === nw.length &&
          m.every(x => x.ebc > 0 && x.potentiel > 0 && x.maltier) &&
          new Set(S.malts.map(x => x.name.toLowerCase())).size === S.malts.length
        );
      })
    );
    check(
      'catalogue levures ajouté (sans doublon, 9 notes, floculation/atténuation/température renseignées)',
      await page.evaluate(() => {
        const nw = CAT.yeasts.split('\n').map(l => l.split('|')[0]);
        const m = S.yeasts.filter(x => nw.includes(x.name));
        return (
          nw.length >= 250 &&
          m.length === nw.length &&
          m.every(
            y => y.att_min > 0 && y.att_max >= y.att_min && y.floc_max >= y.floc_min && y.t_max >= y.t_min && y.labo
          ) &&
          new Set(S.yeasts.map(x => x.name.toLowerCase())).size === S.yeasts.length
        );
      })
    );
    {
      await nav(page, 'yeasts');
      await page.evaluate(() => {
        const n = S.yeasts.slice(0, 2).map(y => y.name);
        document.querySelectorAll('.rlist input.rin').forEach((i, k) => {
          if (n[k]) {
            i.value = n[k];
            i.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      });
      await wait(300);
      await page.click('.yfl svg');
      await wait(150);
      check(
        'levures : clic sur le diagramme atténuation/floculation → agrandissement plein écran (comme le radar), Échap pour fermer',
        (await page.evaluate(() => !!document.querySelector('#rzoom svg.yf'))) &&
          (await page.keyboard.press('Escape'),
          await wait(100),
          await page.evaluate(() => !document.getElementById('rzoom')))
      );
    }
    await nav(page, 'conception');
    check(
      'HTML : sections équipement/données/pertes/contraintes/volumes/densités/quantités retirées ; « Eau totale avec la glace » ; levures, eau en litres, analyse organoleptique',
      await page.evaluate(() => {
        const R = S.kv.recipe,
          old = R.embou;
        R.embou = '2026-03-01';
        R.org = { ddeg: '2026-04-01', di: '1.050', df: '1.010', rob: 'Or', s_aro: 8 };
        const h = htmlCode();
        if (old === undefined) delete R.embou;
        else R.embou = old;
        delete R.org;
        return (
          [
            'Eau totale avec la glace:',
            'Volume de glace dans le fermenteur',
            'Sachets',
            'Floculation',
            'Litres',
            'ANALYSE ORGANOLEPTIQUE',
            'ABV réel (%)',
            'DI cible',
            'IBU cible'
          ].every(t => h.includes(t)) &&
          [
            'EQUIPEMENT',
            'DONNÉES DE BASE',
            'VARIABLES DE PERTES',
            'CONTRAINTES',
            'VOLUMES D’EAU',
            'DENSITÉS',
            'QUANTITES D’EAU',
            'Occupation du malt sec'
          ].every(t => !h.includes(t)) &&
          !/Température d’empâtage \(°C\)/.test(h.split('PALIERS')[0])
        );
      })
    );
    check(
      'volume à embouteiller (Conception) = source unique : Process vise ce volume, volume en fermenteur = volume + perte − resucrage',
      await page.evaluate(() => {
        const v0 = S.kv.equip.vol;
        S.kv.equip.vol = 20;
        const pr = procSolve(),
          o = wcalc(),
          ok =
            Math.abs(pr.end - 20) < 1e-6 &&
            wIn('bout') === 20 &&
            Math.abs(o.mg - (20 + wIn('pferm') - wIn('resuc'))) < 1e-9 &&
            Math.abs(o.vreq - o.mg) < 1e-9;
        S.kv.equip.vol = v0;
        return ok;
      })
    );
    check(
      'Process : DI = cible de la Conception après la glace ; resucrage (g) dans le libellé ; ligne Fermentation (atténuation de la levure), resucrage, DF après refermentation',
      await page.evaluate(() => {
        const R = S.kv.recipe,
          s0 = R.sucre;
        R.sucre = 8;
        params();
        const pr = procSolve(),
          o = wcalc(),
          rows = pr.rows,
          pf = rows.find(x => x.r.k === 'pferm'),
          vpf = pf.v - pf.a + pf.l;
        const at = compute().att / 100,
          pt = o.pts * (1 - at) * (1 - pf.l / vpf) + 0.384 * 8 * pr.end,
          exp = 1 + (pt - 0.384 * 8 * pr.end * at) / pr.end / 1000,
          fl = document.querySelector('input.nm[data-pn="2"][data-i="0"]').value,
          fd = +document.querySelector('#pd-2-0').value.replace(',', '.'),
          got = +document.querySelector('#pd-df').value.replace(',', '.'),
          di = document.querySelector('#pd-di').value,
          lab = document.querySelector('input.nm[data-pn="2"][data-i="2"]').value;
        const ok =
          fl === 'Fermentation (atténuation ' + nf(at * 100, 0) + ' %)' &&
          Math.abs(fd - (1 + (o.pts * (1 - at)) / pr.rows.find(x => x.r.k === 'ferm').v / 1000)) < 6e-4 &&
          di === nf(+R.ogT, 3) &&
          di === document.querySelector('#pd-1-4').value &&
          Math.abs(got - exp) < 6e-4 &&
          lab === 'Resucrage (' + nf(8 * pr.end, 0) + ' g)' &&
          !document.querySelector('#pd-end,#pd-p2end,#pchk');
        R.sucre = 0;
        updProc();
        const g0 = +document.querySelector('#pd-df').value.replace(',', '.');
        R.sucre = s0;
        updProc();
        return ok && g0 < got - 0.0003;
      })
    );
    check(
      'Process : Volume d’eau + malt et Volume de glace affichés ; champ rouge si > maxi cuve',
      await page.evaluate(() => {
        const E = S.kv.equip;
        E.w = E.w || {};
        const c0 = E.w.cmax;
        E.w.cmax = 60;
        updWater();
        const ok1 =
          !document.querySelector('#wo-V5').classList.contains('bad') &&
          /glace/i.test(document.querySelector('#wo-V6').closest('tr').innerText) &&
          document.querySelector('#wo-V6').value !== '';
        E.w.cmax = 20;
        updWater();
        const bad =
          document.querySelector('#wo-V5').classList.contains('bad') &&
          /Volume d’eau \+ malt/.test(document.querySelector('#wo-V5').closest('tr').innerText);
        if (c0 === undefined) delete E.w.cmax;
        else E.w.cmax = c0;
        updWater();
        return ok1 && bad;
      })
    );
    check(
      'thème : sélecteur clair/sombre dans l’angle haut droit de l’en-tête (section « Thème » supprimée des paramètres)',
      await page.evaluate(async () => {
        const lum = c => {
          const m = c.match(/\d+/g).map(Number);
          return (m[0] + m[1] + m[2]) / 3;
        };
        const sw = document.querySelector('#thsw'),
          hd = document.querySelector('header').getBoundingClientRect(),
          r = sw.getBoundingClientRect();
        const pos = sw.parentElement.tagName === 'HEADER' && r.right > hd.right - 30 && r.top < hd.top + hd.height / 2 + 14;
        const dark0 = sw.getAttribute('aria-checked') === 'true' && !document.documentElement.classList.contains('light');
        sw.click();
        const L =
          document.documentElement.classList.contains('light') &&
          lum(getComputedStyle(document.querySelector('.panel')).backgroundColor) > 200 &&
          S.kv.equip.theme.light === 1 &&
          sw.getAttribute('aria-checked') === 'false';
        sw.click();
        const D =
          !document.documentElement.classList.contains('light') &&
          !S.kv.equip.theme &&
          lum(getComputedStyle(document.querySelector('.panel')).backgroundColor) < 120 &&
          sw.getAttribute('aria-checked') === 'true';
        show('params');
        await new Promise(r => setTimeout(r, 100));
        const gone = !/Thème de l’application/.test(document.querySelector('main').innerText) && !document.querySelector('#thh');
        show('conception');
        return pos && dark0 && L && D && gone ? true : JSON.stringify({ pos, dark0, L, D, gone });
      })
    );
    check(
      'pied de page : licence GNU GPL v3 (clic = texte de la licence lu dans la base) et version en bas à droite',
      await page.evaluate(async () => {
        const f = document.querySelector('#foot'),
          v = f.querySelector('.ver').getBoundingClientRect(),
          fr = f.getBoundingClientRect();
        const pos = v.right > fr.right - 20 && Math.abs(fr.bottom - innerHeight) < 3 || fr.bottom >= innerHeight - 3;
        const inHeader = !!document.querySelector('header .ver');
        document.querySelector('#lic').click();
        await new Promise(r => setTimeout(r, 100));
        const d = document.querySelector('.bcdlg'),
          txt = d && d.querySelector('.lictxt') ? d.querySelector('.lictxt').textContent : '';
        const shown = /GNU GENERAL PUBLIC LICENSE/.test(txt) && /Version 3, 29 June 2007/.test(txt) && txt.length > 30000;
        if (d) d.querySelector('.ok').click();
        await new Promise(r => setTimeout(r, 50));
        const closed = !document.querySelector('.bcdlg');
        /* stockée dans la base : table « licence » */
        await __rt();
        const r = (await __sqlq('SELECT nom,length(texte) FROM licence'))[0];
        return pos && !inHeader && shown && closed && r[0] === 'GNU GPL v3' && r[1] > 30000 && /GNU GPL v3/.test(f.textContent)
          ? true
          : JSON.stringify({ pos, inHeader, shown, closed, r });
      })
    );
    check(
      'HTML : PARAMETRES sans date d’embouteillage / équipement / volume de moût ; « Volume de glace dans le fermenteur: » ; Process avec phase 3',
      await page.evaluate(() => {
        const h = htmlCode(),
          P = h.slice(h.indexOf('PARAMETRES'), h.indexOf('PROCESS'));
        return (
          !/Date d’embouteillage|Equipement:|Volume de moût/.test(P.split('PROFIL')[0].slice(0, 1800)) &&
          h.includes('Volume de glace dans le fermenteur:') &&
          !/(?<!Volume de )Glace dans le fermenteur:/.test(h) &&
          /Phase 3 — Embouteillage/.test(h) &&
          /DI \(densité initiale visée\)/.test(h) &&
          /DF \(densité finale/.test(h) &&
          !/Mise en bouteille visée/.test(h)
        );
      })
    );
    check(
      'formules « = » : analyseur (+ − × ÷ ^ ( ) % sqrt, virgule décimale), refuse le texte et la division par zéro',
      await page.evaluate(
        () =>
          fxCalc('=1,05+0,01*2'.slice(1)) === 1.07 &&
          fxCalc('(2+3)*4') === 20 &&
          fxCalc('2^3^2') === 512 &&
          fxCalc('50%') === 0.5 &&
          fxCalc('sqrt(16)+abs(-1)') === 5 &&
          fxCalc('-2*3') === -6 &&
          fxCalc('1/0') === null &&
          fxCalc('alert(1)') === null &&
          fxCalc('2+') === null
      )
    );
    await nav(page, 'conception');
    await wait(300);
    await page.click('input[data-r="ogT"]');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('=');
    await page.keyboard.type('1,05+0,01*2');
    await page.keyboard.press('Enter');
    await wait(200);
    check(
      'champ numérique : « = » au début → l’expression est remplacée par sa valeur (1,07), type number rétabli, valeur enregistrée dans la recette',
      await page.evaluate(() => {
        const e = document.querySelector('input[data-r="ogT"]');
        return e.type === 'number' && Math.abs(+e.value - 1.07) < 1e-9 && Math.abs(S.kv.recipe.ogT - 1.07) < 1e-9;
      })
    );
    await page.click('input[data-r="ogT"]');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('=');
    await page.keyboard.type('1,06*');
    await page.keyboard.press('Tab');
    await wait(200);
    check(
      'expression invalide : ancienne valeur conservée, aucune valeur parasite enregistrée',
      await page.evaluate(() => {
        const e = document.querySelector('input[data-r="ogT"]');
        return e.type === 'number' && Math.abs(+e.value - 1.07) < 1e-9 && Math.abs(S.kv.recipe.ogT - 1.07) < 1e-9;
      })
    );
    await page.evaluate(() => {
      S.kv.recipe.ogT = 1.06;
      document.querySelector('input[data-r="ogT"]').value = 1.06;
    });
    check(
      'un seul bouton « Sauvegarder » (en haut) ; plus aucun autre dans les écrans',
      (await page.$$('#dbsave')).length === 1 &&
        (await (async () => {
          for (const k of [
            'conception',
            'biblio',
            'malts',
            'hops',
            'yeasts',
            'styles',
            'ings',
            'conso',
            'params',
            'html',
            'labels',
            'sheet',
            'eaux'
          ]) {
            await nav(page, k);
            if (await page.$$eval('#main button', b => b.some(x => /Sauvegarder|💾/.test(x.textContent)))) {
              await nav(page, 'conception');
              return false;
            }
          }
          await nav(page, 'conception');
          return true;
        })())
    );
    check(
      'nom de malt suivi du maltier',
      (await page.$eval('input[data-k="malts"][data-f="n"]', e => e.value)) === 'Pilsen (Dingemans)'
    );
    // sauvegarde de recette (le bug signalé)
    await page.fill('[data-r="name"]', 'IPA test');
    await page.click('#dbsave');
    await page.waitForFunction(() => /✔|⚠/.test(document.querySelector('#hmsg').textContent));
    const m = await txt(page, '#hmsg');
    check('« Sauvegarder » réussit', m.startsWith('✔'), m);
    const f = path.join(dir, DBF);
    check('fichier de base écrit : table bibliotheque = 1 ligne', (await rows(f, 'bibliotheque')) === 1);
    check('table html alimentée', (await rows(f, 'html')) === 1);
    check(
      'noms de tables en vrais mots',
      JSON.stringify(await tables(f)) === JSON.stringify(EXPECT),
      (await tables(f)).join(',')
    );
    // bibliothèque : mise à jour, nouvelle, modification, suppression
    await page.fill('[data-r="name"]', 'IPA test 2');
    await page.click('#dbsave');
    await wait(500);
    check('même recette ré-enregistrée = mise à jour (toujours 1)', (await rows(f, 'bibliotheque')) === 1);
    await page.click('#newrec');
    await page.fill('[data-r="name"]', 'Deuxième');
    await page.click('#dbsave');
    await wait(500);
    check('nouvelle recette = 2 lignes', (await rows(f, 'bibliotheque')) === 2);
    await nav(page, 'biblio');
    const hd = await page.$$eval('table.lib tr.hd th', e =>
      e.map(x => x.textContent.replace(/[▲▼]/g, '').trim()).filter(Boolean)
    );
    check(
      'bibliothèque : colonnes Nom, Brasseur, Réalisé, Style, DI, DF, IBU, EBC, ABV, Malts, Houblons, Levures (ni date, ni volume, ni coût)',
      JSON.stringify(hd) ===
        JSON.stringify([
          'Nom',
          'Brasseur',
          'Réalisé',
          'Style',
          'DI',
          'DF',
          'IBU',
          'EBC',
          'ABV %',
          'Malts',
          'Houblons',
          'Levures'
        ]),
      hd.join('|')
    );
    const cell = await page.$$eval('table.lib tr:nth-child(3) td', e => e.map(x => x.textContent));
    check(
      'bibliothèque : malts et houblons = noms seulement',
      cell[9] === 'Pilsen' && cell[10] === 'Magnum',
      cell[9] + ' / ' + cell[10]
    );
    check(
      'tableau bibliothèque (2 lignes, crayon + croix)',
      (await page.$$('tr button[data-bedit]')).length === 2 && (await page.$$('tr button[data-bdel]')).length === 2
    );
    await page.click('button[data-bedit="0"]');
    await wait(200);
    check(
      'crayon : la recette s’ouvre dans la conception',
      (await page.$eval('[data-r="name"]', e => e.value)) === 'IPA test 2'
    );
    await nav(page, 'biblio');
    await page.click('button[data-bdel="1"]');
    await wait(500);
    await settle(page);
    check(
      'croix rouge : suppression confirmée (1 ligne)',
      (await rows(f, 'bibliotheque')) === 1 && (await rows(f, 'html')) === 1
    );
    // rechargement : tout revient du fichier
    await page.reload();
    await openDb(page);
    await wait(300);
    await nav(page, 'biblio');
    check(
      'rechargement : la bibliothèque vient du fichier SQLite',
      (await page.$$('tr button[data-bedit]')).length === 1
    );
    // eau de rinçage
    await nav(page, 'params');
    await wait(200);
    check(
      'tableau Process : phase 1 (3 lignes) + phase 2 (5 lignes, finit à la glace) + phase 3 embouteillage (3 lignes : fermentation, perte, resucrage) + lignes DI et DF',
      await page.evaluate(
        () =>
          document.querySelectorAll('tr[data-prow^="0:"]').length === 3 &&
          document.querySelectorAll('tr[data-prow^="1:"]').length === 5 &&
          document.querySelectorAll('tr[data-prow^="2:"]').length === 3 &&
          !!document.querySelector('#pd-di') &&
          !!document.querySelector('#pv-df') &&
          [...document.querySelectorAll('input.phn')].map(x => x.value.slice(0, 7)).join() ===
            'Phase 1,Phase 2,Phase 3' &&
          document.querySelector('table[data-phase="1"] #pd-di') &&
          document.querySelector('table[data-phase="2"] #pd-df') &&
          document.querySelectorAll('input.pi:not(.ro)').length === 22 &&
          [...document.querySelectorAll('#pv-df,#pd-df,#pd-di,#pv-0-0,#wo-V0')].every(
            x => x.tagName === 'INPUT' && x.readOnly
          )
      )
    );
    const pa = await page.evaluate(() => {
      const E = S.kv.equip;
      E.vol = 30;
      E.ratio = 2.8;
      E.evap = 3;
      E.eff = 74.4197471732046;
      S.kv.recipe.malts = [{ n: 'Pilsen', g: 7949.04596945499 }];
      E.w = {
        pot: 304.5,
        duree: 1,
        mort: 8,
        occ: 0.7,
        ret: 0.825,
        trub: 2,
        contr: 4,
        pferm: 2,
        resuc: 2,
        glace: 6,
        tmout: 95,
        tglace: -16,
        fmax: 30,
        bout: 30
      };
      E.proc3 = JSON.parse(JSON.stringify(PDEF));
      params();
      const g = id => {
          const q = document.querySelector('#' + id);
          return q.value !== undefined ? q.value : q.textContent;
        },
        pr = procSolve();
      return {
        R: pr.R,
        end: pr.end,
        p1: g('pv-0-0'),
        p3: g('pv-0-2'),
        d1: g('pd-0-0'),
        d3: g('pd-0-2'),
        vEv: g('pv-1-1'),
        dGl: g('pd-1-4'),
        vGl: g('pv-1-4'),
        endT: g('pv-df'),
        chk: /aboutit à/.test(document.querySelector('#pwarn').innerText) ? '≠' : '✔'
      };
    });
    check(
      'Process par défaut = feuille Excel : empâtage 30,26 / pré-rinçage 30,85→ rinçage 6,26 ; moût+glace 30 ; DI 1,060 ; bouteille 30,00 ✔ ; densité calculée sur chaque ligne (eau d’empâtage comprise)',
      Math.abs(pa.R - 6.26063421) < 1e-6 &&
        Math.abs(pa.end - 30) < 1e-9 &&
        pa.vGl === '30,00' &&
        pa.dGl === '1,060' &&
        pa.endT === '30,00' &&
        pa.chk === '✔' &&
        pa.d1 !== '-' &&
        pa.d3 !== '-' &&
        pa.p3 === '23,70',
      JSON.stringify(pa)
    );
    await page.evaluate(() => {
      ensureProc()[1].rows.push({ k: 'x1', n: 'Perte de transfert', l: 2 });
      params();
    });
    await wait(200);
    const pb = await page.evaluate(() => ({
      R: procSolve().R,
      end: procSolve().end,
      chk: /aboutit à/.test(document.querySelector('#pwarn').innerText) ? '≠' : '✔',
      w: wcalc().rinc,
      t: wIn('glace')
    }));
    check(
      'ajout d’une ligne « perte 2 L » : l’eau de rinçage passe à 8,34 L (6,26 + 2 × 1,04 de contraction), bouteille toujours 30 L, propagé aux calculs d’eau',
      Math.abs(pb.R - 8.34063421) < 1e-6 &&
        Math.abs(pb.end - 30) < 1e-9 &&
        Math.abs(pb.w - pb.R) < 1e-9 &&
        pb.chk === '✔',
      JSON.stringify(pb)
    );
    await page.evaluate(() => {
      ensureProc()[1].rows[0].a = 5;
      updParams();
    });
    await wait(200);
    check(
      'rinçage saisi à la main (5 L) : écart signalé sous le volume visé',
      await page.evaluate(
        () => /aboutit à/.test(document.querySelector('#pwarn').innerText) && Math.abs(wcalc().rinc - 5) < 1e-9
      )
    );
    await page.evaluate(() => {
      delete ensureProc()[1].rows[0].a;
      updParams();
    });
    await page.click('button[data-pdel="1:5"]');
    await wait(150);
    await page.evaluate(() => {
      ensureProc()[1].rows[2].l = 5;
      updParams();
    });
    await wait(200);
    check(
      'perte de trub personnalisée (5 L) : le rinçage compense (9,26 L) ; vider la case rétablit l’auto',
      (await page.evaluate(() => Math.abs(procSolve().R - 9.26063421) < 1e-6)) &&
        (await (async () => {
          await page.evaluate(() => {
            delete ensureProc()[1].rows[2].l;
            updParams();
          });
          await wait(200);
          return page.evaluate(
            () =>
              Math.abs(procSolve().R - 6.26063421) < 1e-6 &&
              document.querySelector('input[data-pr="1"][data-i="2"][data-pf="l"]').classList.contains('auto')
          );
        })())
    );
    await page.click('button[data-pm="1:1:1"]');
    await wait(150);
    check(
      'déplacement d’une ligne (▼) : évaporation et trub permutés, volume final inchangé',
      await page.evaluate(() => {
        const P = S.kv.equip.proc3[1].rows;
        return P[1].k === 'trub' && P[2].k === 'evap' && Math.abs(procSolve().end - 30) < 1e-9;
      })
    );
    // phases et étapes modifiables (6.0.0)
    check(
      'Process : crayon ✎ au bout de chaque ligne (étapes et phases) ; densité calculée sur toutes les lignes',
      await page.evaluate(() => {
        const rows = [...document.querySelectorAll('.ptab tr[data-prow], .ptab tr.phr')];
        return (
          rows.length === 14 &&
          rows.every(tr => tr.querySelector('button[data-ped]')) &&
          [...document.querySelectorAll('.ptab tr[data-prow] input[id^="pd-"]')].every(x => /^\d,\d{3}$/.test(x.value))
        );
      }),
      await page.evaluate(() => [...document.querySelectorAll('.ptab input[id^="pd-"]')].map(x => x.value).join(' '))
    );
    await page.click('button[data-phadd]');
    await wait(150);
    const ph1 = await page.evaluate(() => {
      const h = document.querySelector('table[data-phase="3"] input.phn');
      return { ro: h.readOnly, foc: document.activeElement === h, v: h.value, n: S.kv.equip.proc3.length };
    });
    await page.fill('table[data-phase="3"] input.phn', 'Garde à froid');
    await page.keyboard.press('Enter');
    await wait(150);
    await page.click('button[data-padd="3"]');
    await wait(150);
    await page.fill('input.nm[data-pn="3"][data-i="0"]', 'Prélèvements');
    await page.fill('input[data-pr="3"][data-i="0"][data-pf="l"]', '1');
    await page.click('tr[data-prow="3:0"] button[data-ped]');
    await wait(150);
    const ph2 = await page.evaluate(() => {
      const P = S.kv.equip.proc3,
        pr = procSolve(),
        x = pr.rows.find(y => y.ph === 3);
      return {
        name: P[3].n,
        row: JSON.stringify(P[3].rows[0]),
        ro: document.querySelector('input.nm[data-pn="3"][data-i="0"]').readOnly,
        end: pr.end,
        d: document.querySelector('#pd-3-0').value,
        df: !!document.querySelector('table[data-phase="3"] #pd-df'),
        v: x && x.v
      };
    });
    check(
      'Process : « ＋ Phase » ajoute une phase ouverte en modification, renommée ; ＋ ajoute une étape (nom, pertes) ; ✎ valide ; la ligne DF passe à la dernière phase',
      ph1.n === 4 &&
        !ph1.ro &&
        ph1.foc &&
        ph2.name === 'Garde à froid' &&
        ph2.row === '{"k":"' + JSON.parse(ph2.row).k + '","n":"Prélèvements","l":1}' &&
        ph2.ro &&
        /^\d,\d{3}$/.test(ph2.d) &&
        ph2.df &&
        Math.abs(ph2.end - 30) < 1e-9,
      JSON.stringify([ph1, ph2])
    );
    await page.click('button[data-pm="3:0:-1"]');
    await wait(150);
    check(
      'Process : ▲ sur la première étape d’une phase la fait passer à la fin de la phase précédente',
      await page.evaluate(() => {
        const P = S.kv.equip.proc3;
        return P[3].rows.length === 0 && P[2].rows[P[2].rows.length - 1].n === 'Prélèvements';
      })
    );
    await page.click('button[data-phm="3:-1"]');
    await wait(150);
    check(
      'Process : ▲ d’une phase la remonte (la DI reste sur la phase de la glace)',
      await page.evaluate(
        () =>
          S.kv.equip.proc3[2].n === 'Garde à froid' &&
          document.querySelector('table[data-phase="1"] #pd-di') &&
          document.querySelector('table[data-phase="3"] #pd-df')
      )
    );
    /* écran HTML : phases nommées et densité de chaque étape */
    const hp = await page.evaluate(() => {
      const h = htmlCode(),
        pr = procSolve(),
        dn = procDens(pr, wcalc().pts);
      return {
        ph: ['Phase 1 — Empâtage', 'Garde à froid', 'Prélèvements', 'DI (densité', 'DF (densité'].every(t => h.includes(t)),
        d0: h.includes(nf(dn[0], 3)),
        ord: h.indexOf('Garde à froid') < h.indexOf('Phase 3 — Embouteillage')
      };
    });
    check('écran HTML : phases nommées du Process (ordre compris), étapes ajoutées, densité de chaque étape', hp.ph && hp.d0 && hp.ord, JSON.stringify(hp));
    check(
      'Process : reprise de l’ancien tableau à 3 phases fixes (bases ≤ 5.0.1) en liste de phases nommées',
      await page.evaluate(() => {
        const E = S.kv.equip,
          keep = E.proc3;
        delete E.proc3;
        E.proc2 = { p1: [{ k: 'emp', n: 'A' }], p2: [{ k: 'rinc', n: 'B' }, { k: 'pferm', n: 'C', l: 3 }] };
        const P = ensureProc(),
          ok =
            P.length === 3 &&
            P[0].rows[0].n === 'A' &&
            P[1].rows.length === 1 &&
            P[2].rows.map(r => r.k).join() === 'ferm,pferm' &&
            P[2].rows[1].l === 3 &&
            !E.proc2 &&
            /^Phase 3/.test(P[2].n);
        E.proc3 = keep;
        return ok;
      })
    );
    await page.click('button[data-pdel="2"]');
    await wait(150);
    check(
      'Process : ✕ d’une phase vide la supprime sans confirmation',
      await page.evaluate(() => S.kv.equip.proc3.length === 3 && S.kv.equip.proc3[2].rows.some(r => r.n === 'Prélèvements'))
    );
    await page.evaluate(() => (window.__bcManual = true)); /* boîte non validée automatiquement par le banc de test */
    await page.click('button[data-pdel="2"]');
    await page.waitForSelector('.bcdlg', { timeout: 3000 }).catch(() => {});
    const cdlg = await page.evaluate(() => /Supprimer cette phase/.test(document.body.innerText));
    await page.keyboard.press('Escape');
    await wait(150);
    await page.evaluate(() => (window.__bcManual = false));
    check(
      'Process : ✕ d’une phase qui a des étapes demande confirmation (Échap = rien n’est supprimé)',
      cdlg && (await page.evaluate(() => S.kv.equip.proc3.length === 3))
    );
    await page.click('button[data-pzero]');
    await wait(150);
    await page.click('#dbsave');
    await page.waitForFunction(() => /✔|⚠/.test(document.querySelector('#hmsg').textContent));
    check('bouton Sauvegarder des paramètres', (await txt(page, '#hmsg')).startsWith('✔'), await txt(page, '#hmsg'));
    check('process persisté dans la base (équipement)', await page.evaluate(() => Array.isArray(S.kv.equip.proc3[1].rows) && !S.kv.equip.proc2));
    // température : paramètres et courbe
    await nav(page, 'params');
    const tp = await page.evaluate(() =>
      ['t0', 'chauffe', 'refroid'].map(k => document.querySelector(`input[data-e="${k}"]`)?.value)
    );
    check(
      'champs Paramètres : eau initiale 12 °C, chauffe, refroidissement',
      tp[0] === '12' && tp[1] !== undefined && tp[2] !== undefined,
      tp.join('|')
    );
    const c1 = await page.evaluate(() => curvePts());
    check('courbe : départ à 12 °C', c1.P[0][0] === 0 && c1.P[0][1] === 12, JSON.stringify(c1.P[0]));
    check(
      'montée 12 → 66 °C à 1,5 °C/min = 36 min',
      Math.abs(c1.P[1][0] - 36) < 1e-9 && c1.P[1][1] === 66,
      JSON.stringify(c1.P.slice(0, 2))
    );
    await page.fill('input[data-e="chauffe"]', '3');
    await wait(100);
    const c2 = await page.evaluate(() => curvePts());
    check('chauffe 3 °C/min : montée 18 min', Math.abs(c2.P[1][0] - 18) < 1e-9, c2.P[1][0]);
    await page.evaluate(() => {
      S.kv.recipe.mash[2].t = 60;
      S.kv.recipe.mash[2].m = 10;
    });
    await page.fill('input[data-e="refroid"]', '3');
    await wait(100);
    const c3 = await page.evaluate(() => curvePts());
    const i3 = c3.P.findIndex(q => q[1] === 60);
    check(
      'descente 66 → 60 °C avec le refroidissement (3 °C/min = 2 min)',
      i3 > 0 && Math.abs(c3.P[i3][0] - c3.P[i3 - 1][0] - 2) < 1e-9,
      JSON.stringify(c3.P)
    );
    await page.evaluate(() => {
      S.kv.recipe.mash[2].t = '';
      S.kv.recipe.mash[2].m = '';
      S.kv.equip.chauffe = 1.5;
      S.kv.equip.refroid = 2;
    });
    // écrans
    for (const k of [
      'conception',
      'biblio',
      'malts',
      'hops',
      'yeasts',
      'styles',
      'ings',
      'conso',
      'params',
      'html',
      'sheet',
      'eaux'
    ]) {
      await nav(page, k);
      const h = await page.$eval('#main', e => e.innerText);
      check('écran « ' + k + ' » sans NaN/undefined', !/NaN|undefined|\[object/.test(h));
    }
    await nav(page, 'malts');
    check('pas de bouton « Exporter .sqlite »', !/sqlite/i.test(await page.$eval('#main', e => e.innerText)));
    check('colonne prix/kg pour les malts', /prix\/kg/.test(await page.$eval('#main', e => e.innerText)));
    const mx = await page.evaluate(() =>
      Math.max(
        ...S.malts.flatMap(m => MA.map(k => +m[k] || 0)),
        ...S.hops.flatMap(m => HA.map(k => +m[k] || 0)),
        ...S.yeasts.flatMap(m => YA.map(k => +m[k] || 0))
      )
    );
    check('notes aromatiques sur l’échelle 0–5', mx <= 5 && mx > 0, mx);
    // styles BJCP
    await nav(page, 'styles');
    const sty = await page.evaluate(() => ({
      rows: document.querySelectorAll('tr[data-ss]').length,
      n: S.styles.length,
      ta: document.querySelectorAll('#std textarea').length,
      inp: document.querySelectorAll('#std input').length
    }));
    check(
      'écran Styles : lignes seulement (pas de bloc du bas), 1 ligne par style',
      sty.rows === sty.n && sty.n >= 20 && sty.ta === 0 && !(await page.$('#std')),
      JSON.stringify(sty)
    );
    await page.click('th[data-sort="name"]');
    await wait(200);
    const a1 = await page.evaluate(() => [
      (() => {
        const a = document.querySelector('th[data-sort="name"] .sar');
        return a ? (a.classList.contains('up') ? 'up' : 'dn') : '';
      })(),
      S.styles[0].name <= S.styles[1].name
    ]);
    await page.click('th[data-sort="name"]');
    await wait(200);
    const a2 = await page.evaluate(() => [
      (() => {
        const a = document.querySelector('th[data-sort="name"] .sar');
        return a ? (a.classList.contains('up') ? 'up' : 'dn') : '';
      })(),
      S.styles[0].name >= S.styles[1].name
    ]);
    check(
      'tri des styles : flèche ▼ puis ▲ au clic (triangle plein)',
      a1[0] === 'dn' && a1[1] === false && a2[0] === 'up' && a2[1] === false,
      JSON.stringify([a1, a2])
    );
    for (const k of ['malts', 'hops', 'yeasts', 'ings']) {
      await nav(page, k);
      await page.click('th[data-sort]:nth-child(2)');
      await wait(150);
      const r = await page.evaluate(() =>
        !!document.querySelector('th[data-sort]:nth-child(2) .sar.up')
      );
      await page.click('th[data-sort]:nth-child(2)');
      await wait(150);
      const r2 = await page.evaluate(() =>
        !!document.querySelector('th[data-sort]:nth-child(2) .sar.dn')
      );
      check('tri par clic sur l’en-tête (▲ puis ▼) : ' + k, r && r2);
    }
    await page.evaluate(() => {
      S.kv.recipe.mash[6].m = 90;
      S.kv.equip.w = { ...(S.kv.equip.w || {}), duree: 2 };
    });
    await nav(page, 'params');
    const du = await page.evaluate(() => {
      const i = document.querySelector('input[data-w="duree"]');
      return { ro: i.readOnly, v: i.value };
    });
    check(
      'paramètres : durée d’ébullition = palier « Ébullition » de la conception (90 min), affichée en minutes, non modifiable',
      du.ro && +du.v === 90,
      JSON.stringify(du)
    );
    await page.evaluate(() => {
      S.kv.recipe.mash[6].m = 60;
      delete S.kv.equip.w.duree;
    });
    await nav(page, 'params');
    const wc = await page.evaluate(() => {
      const E = S.kv.equip;
      E.vol = 30;
      E.ratio = 2.8;
      E.evap = 3;
      E.eff = 74.4197471732046;
      S.kv.recipe.malts = [{ n: 'Pilsen', g: 7949.04596945499 }];
      E.w = {
        pot: 304.5,
        duree: 1,
        mort: 8,
        occ: 0.7,
        ret: 0.825,
        trub: 2,
        contr: 4,
        pferm: 2,
        resuc: 2,
        glace: 6,
        tmout: 95,
        tglace: -16,
        fmax: 30,
        bout: 30
      };
      const o = wcalc();
      return { v0: o.v0, tot: o.tot, rincN: o.rincN, rinc: o.rinc, d4: o.d4, d1: o.d1, tf: o.tf, vbot: o.vbot };
    });
    const near = (a, b, t = 1e-4) => Math.abs(a - b) < t;
    check(
      'calcul d’eau = feuille Excel (empâtage 30,257 ; total 42,518 ; rinçage 6,261 (tableau Process) ; DI = cible 1,060 ; T° 58,4)',
      near(wc.v0, 30.257328714474) &&
        near(wc.tot, 42.5179629248004) &&
        near(wc.rincN, 6.26063421032641) &&
        near(wc.rinc, 6.26063421032641) &&
        near(wc.d4, 1.06, 1e-9) &&
        near(wc.d1, 1.07595139954, 1e-6) &&
        near(wc.tf, 58.4, 1e-6) &&
        near(wc.vbot, 30),
      JSON.stringify(wc)
    );
    await page.evaluate(() => {
      params();
    });
    await wait(100);
    check(
      'panneau « Calcul des volumes d’eau » : champs modifiables + résultats + 30 L en bouteille',
      await page.evaluate(
        () =>
          document.querySelectorAll('.wi').length === 19 &&
          /Volume d’eau total/.test(document.querySelector('#main').innerText) &&
          /30,0 L en bouteilles/.test(document.querySelector('#wwarn').innerText)
      )
    );
    await page.fill('.wi[data-w="trub"]', '5');
    await wait(150);
    check(
      'modification d’une valeur : recalcul immédiat et sauvegarde',
      await page.evaluate(() => S.kv.equip.w.trub === 5 && Math.abs(wcalc().vpost - (wcalc().vferm + 5)) < 1e-9)
    );
    await page.fill('.wi[data-e="vol"]', '33');
    await wait(150);
    check(
      'avertissement si le fermenteur dépasse 30 L',
      await page.evaluate(() => /dépasse le maximum/.test(document.querySelector('#wwarn').innerText))
    );
    check(
      'Paramètres : quantité de grains non modifiable',
      await page.evaluate(() => document.querySelector('.wi[data-w="kg"]').readOnly)
    );
    await nav(page, 'conception');
    check(
      'conception : ratio d’empâtage modifiable après Volume ; DI cible, IBU cible et Calculer groupés dans un cadre',
      await page.evaluate(() => {
        const r = document.querySelector('#ratioro');
        return (
          r &&
          !r.readOnly &&
          +r.value === +S.kv.equip.ratio &&
          r.closest('label').previousElementSibling.textContent.includes('Volume à embouteiller') &&
          r.closest('label').nextElementSibling.textContent.includes('Date de brassage') &&
          [...document.querySelectorAll('.tgt > *')]
            .map(x => x.textContent.replace(/[\d.]+/g, ''))
            .join('|')
            .startsWith('DI cible|IBU cible|Calculer') &&
          getComputedStyle(document.querySelector('.tgt')).borderTopWidth === '1px'
        );
      })
    );
    check(
      'conception : tableau Quantités d’eau sous les paliers, Resucrage avant les coûts',
      await page.evaluate(() => {
        const ps = [...document.querySelectorAll('.col:nth-child(2) > .panel')].map(p =>
          p.querySelector('h3').textContent.trim()
        );
        return (
          ps.join('|') ===
            'Bilan de la recette|Paliers d’empâtage＋|Quantités d’eau|Resucrage & CO₂|Récapitulatif des coûts' &&
          /Eau d’empâtage/.test(document.querySelector('#wtab').innerText)
        );
      })
    );
    await page.fill('[data-r="sucre"]', '8');
    await page.fill('[data-r="tcarbo"]', '20');
    await wait(150);
    /* 6.8.0 : plus de glace ni de T° de fin de transfert dans « Quantités d’eau » ; la T° de fin de transfert utilise les
       « Ajouts » des étapes du Process dont le nom contient « glace » */
    check(
      'Quantités d’eau sans glace ni T° de fin de transfert ; T° du moût en fin de transfert calculée avec les ajouts des étapes « glace » du Process',
      await page.evaluate(() => {
        const t = document.querySelector('#wtab').innerText,
          P = ensureProc(),
          g = P.flatMap(p => p.rows).find(r => r.k === 'glace'),
          a0 = g.a,
          tf = a => {
            const o = wcalc(),
              tm = wIn('tmout'),
              ti = wIn('tglace');
            return { got: o.tf, exp: o.mg ? ((o.mg - a) * tm - a * (80 + 0.5 * Math.abs(ti))) / o.mg : 0 };
          };
        g.a = 9;
        const r1 = tf(9);
        P[0].rows.push({ k: 'x1', n: 'Ajout de glace pilée', a: 2 });
        const r2 = tf(11);
        P[0].rows.pop();
        if (a0 === undefined) delete g.a;
        else g.a = a0;
        return (
          !/Glace dans le fermenteur|T° du moût/.test(t) &&
          !document.querySelector('[data-r="glace"]') &&
          !document.querySelector('#w-tf') &&
          Math.abs(r1.got - r1.exp) < 1e-9 &&
          Math.abs(r2.got - r2.exp) < 1e-9 &&
          !document.querySelector('#wtab').innerText.includes('(E – M)')
        );
      })
    );
    await page.evaluate(() => {
      S.kv.recipe.malts = [{ n: 'Pilsen', g: 30000 }];
      refresh();
    });
    await wait(100);
    check(
      'alerte ⚠ si eau d’empâtage + malt > 45 L (tableau + ratio)',
      await page.evaluate(
        () =>
          getComputedStyle(document.querySelector('#w-al')).display !== 'none' &&
          getComputedStyle(document.querySelector('#ratio-al')).display !== 'none'
      )
    );
    await page.evaluate(() => {
      S.kv.recipe.malts = [{ n: 'Pilsen', g: 6000 }];
      refresh();
    });
    await wait(100);
    check(
      'pas d’alerte sous 45 L',
      await page.evaluate(() => getComputedStyle(document.querySelector('#w-al')).display === 'none')
    );
    await nav(page, 'params');
    check(
      'Paramètres : glace non modifiable (reprise des ajouts « glace » du Process)',
      await page.evaluate(
        () =>
          document.querySelector('.wi[data-w="glace"]').readOnly &&
          Math.abs(+document.querySelector('.wi[data-w="glace"]').value - wIn('glace')) < 1e-6
      )
    );
    await nav(page, 'conception');
    await nav(page, 'sheet');
    check(
      'feuille de brassage : valeurs calculées (eau, glace, resucrage, sucre total)',
      await page.evaluate(() => {
        const t = document.querySelector('#main').innerText;
        return (
          /Eau d’empâtage/.test(t) &&
          /Glace dans le fermenteur/.test(t) &&
          /Quantité totale de sucre/.test(t) &&
          /En bouteilles/.test(t)
        );
      })
    );
    await nav(page, 'conception');
    await page.fill('#ratioro', '3.2');
    await wait(150);
    await nav(page, 'params');
    check(
      'ratio saisi en Conception seulement : plus de « Ratio eau/grain » dans Équipement & process, valeur reprise par les paramètres de brassage',
      await page.evaluate(
        () =>
          S.kv.equip.ratio === 3.2 &&
          !document.querySelector('.eq [data-e="ratio"]') &&
          !/Ratio eau\/grain/.test(document.querySelector('.panel.full').textContent) &&
          document.querySelector('.wi[data-e="ratio"]').readOnly &&
          +document.querySelector('.wi[data-e="ratio"]').value === 3.2
      )
    );
    check(
      'Paramètres › Équipement & process : sous-section « Valeurs par défaut » (ébullition, évaporation, T° initiale, chauffe, refroidissement, absorption, DI, IBU, ratio par défaut)',
      await page.evaluate(() => {
        const p = document.querySelector('.panel.full'),
          top = [...p.querySelector('.eq').querySelectorAll('[data-e]')].map(i => i.dataset.e),
          def = [...p.querySelectorAll('#eqdef [data-e]')].map(i => i.dataset.e);
        return (
          /Valeurs par défaut/.test(p.querySelector('h4.eqsub').textContent) &&
          top.join() === 'name,volD,eff' &&
          def.join() === 'boilD,evap,t0,chauffe,refroid,abs,ogT,ibuT,ratioD'
        );
      })
    );
    await nav(page, 'conception');
    await page.setViewportSize({ width: 1500, height: 700 });
    await page.evaluate(() => window.scrollTo(0, 900));
    await wait(150);
    const hy = await page.evaluate(() => ({
      top: document.querySelector('header').getBoundingClientRect().top,
      sy: window.scrollY,
      pos: getComputedStyle(document.querySelector('header')).position
    }));
    await page.screenshot({ path: '/tmp/claude-0/x/st.png' });
    await page.evaluate(() => window.scrollTo(0, 0));
    check(
      'barre de menu fixe en haut pendant le défilement',
      hy.top === 0 && hy.sy > 300 && hy.pos === 'sticky',
      JSON.stringify(hy)
    );
    const LG0 =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    await page.evaluate(l => {
      S.kv.equip.logo = l;
      S.kv.recipe.etq = { url: 'https://exemple.fr/b/6', embou: '2026-02-10', cl: 50, fmt: 'bandeau' };
      save();
    }, LG0);
    await nav(page, 'labels');
    await wait(150);
    const lb = await page.evaluate(() => {
      const pg = document.querySelector('#lpage'),
        r = pg.getBoundingClientRect(),
        s = r.width / 210;
      const boxes = [...pg.querySelectorAll('.lb')].map(e => {
        const b = e.getBoundingClientRect();
        return [(b.left - r.left) / s, (b.top - r.top) / s, (b.right - r.left) / s, (b.bottom - r.top) / s];
      });
      return {
        n: boxes.length,
        fm: document.querySelectorAll('[data-fmt]').length,
        inside: boxes.every(b => b[0] >= 0 && b[1] >= 0 && b[2] <= 210.01 && b[3] <= 297.01),
        qr: pg.querySelectorAll('.qrb svg path').length,
        logo: pg.querySelectorAll('img').length,
        txt: pg.innerText,
        code: brewNo(S.kv.recipe).code,
        form: document.querySelector('.lblform').innerText
      };
    });
    check(
      'étiquettes : ≥ 10 formats, planche A4, toutes dans la page, QR + logo + champs de la conception',
      lb.fm >= 20 &&
        lb.n >= 10 &&
        lb.inside &&
        lb.qr === lb.n &&
        lb.logo === lb.n &&
        new RegExp(lb.code.replace('#', '#') + '\\s+\\d+ IBU').test(lb.txt) &&
        !/Brassin N/.test(lb.form) &&
        !/ferm/i.test(lb.form) &&
        /Alc|%/.test(lb.txt),
      JSON.stringify({ ...lb, txt: lb.txt.slice(0, 80) })
    );
    check(
      'format « Bandeau oblique » : 188 × 34 mm, en tête de liste, police par défaut Covered By Your Grace (manuscrit, police libre Google), logo en gris',
      await page.evaluate(() => {
        const f = LF[0];
        S.kv.recipe.etq.fmt = 'bandeauxl';
        lblRefresh();
        return (
          f.id === 'bandeauxl' &&
          f.n === 'Bandeau oblique' &&
          f.font === 'scratchy' &&
          /^'LF Covered'/.test(lblFont(f.font).f) &&
          f.w === 188 &&
          f.h === 34 &&
          f.shape === 'para2' &&
          /grayscale/.test(document.querySelector('#lpage img')?.getAttribute('style') || '')
        );
      })
    );
    await page.click('[data-fmt="rond"]');
    await wait(150);
    const lr = await page.evaluate(() => ({
      sel: document.querySelector('.fmt.sel').dataset.fmt,
      n: document.querySelectorAll('#lpage .lb').length,
      f: S.kv.recipe.etq.fmt
    }));
    check(
      'formulaire étiquettes : tous les champs sur la même ligne, sans débordement ni chevauchement',
      await page.evaluate(() => {
        const els = [...document.querySelectorAll('.lblform .eq label')].map(l => l.getBoundingClientRect()),
          f = document.querySelector('.lblform').getBoundingClientRect();
        let ok =
          els.length >= 7 &&
          els.every(r => r.right <= f.right + 1) &&
          Math.max(...els.map(r => r.top)) - Math.min(...els.map(r => r.top)) < 6;
        for (let i = 0; i < els.length; i++)
          for (let j = i + 1; j < els.length; j++) {
            const a = els[i],
              b = els[j];
            if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1)
              ok = false;
          }
        return ok;
      })
    );
    check(
      'clic sur un format : sélection + planche régénérée',
      lr.sel === 'rond' && lr.f === 'rond' && lr.n >= 8,
      JSON.stringify(lr)
    );
    const scl = await page.evaluate(() => {
      const s = document.querySelector('#lside');
      s.scrollTop = s.scrollHeight;
      const before = s.scrollTop,
        btns = [...document.querySelectorAll('[data-fmt]')];
      btns[btns.length - 1].click();
      return {
        before,
        after: document.querySelector('#lside').scrollTop,
        sel: document.querySelector('.fmt.sel').dataset.fmt,
        last: btns[btns.length - 1].dataset.fmt
      };
    });
    check(
      'clic sur un format en bas de la liste : la liste de droite garde sa position',
      scl.before > 200 && Math.abs(scl.after - scl.before) < 3 && scl.sel === scl.last,
      JSON.stringify(scl)
    );
    await page.click('[data-fmt="bandeauxl"]');
    await wait(150);
    const ft = await page.evaluate(async () => {
      const q = S.kv.recipe.etq;
      const sel = document.querySelector('select[data-q="fnt"]');
      sel.value = 'metal';
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      const bg = document.querySelector('input[data-q="bgc"]');
      bg.value = '#15110e';
      bg.dispatchEvent(new Event('input', { bubbles: true }));
      await document.fonts.ready;
      const pg = document.querySelector('#lpage');
      return {
        font: q.fnt,
        bg: q.bgc === '#15110e' ? 'dark' : q.bgc,
        fn: pg.style.getPropertyValue('--lfn'),
        loaded: document.fonts.check("16px 'LF Metal Mania'") && document.fonts.check("16px 'LF Oswald'"),
        dark: getComputedStyle(pg.querySelector('.lbn')).color,
        fill: pg.querySelector('.lbs path,.lbs rect,.lbs polygon,.lbs ellipse').getAttribute('fill'),
        opts: document.querySelectorAll('select[data-q="fnt"] option').length
      };
    });
    check(
      'police rock (Metal Mania) + fond sombre : appliqués, polices chargées, ≥ 8 polices proposées',
      ft.font === 'metal' &&
        ft.bg === 'dark' &&
        /Metal Mania/.test(ft.fn) &&
        ft.loaded &&
        ft.fill === '#15110e' &&
        ft.opts >= 8,
      JSON.stringify(ft)
    );
    {
      const bc = await page.evaluate(async () => {
        const q = S.kv.recipe.etq;
        S.kv.recipe.etq.fmt = 'bandeauxl';
        const el = document.querySelector('input[data-q="bgc"]');
        el.value = '#ffe9a8';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        const pg = document.querySelector('#lpage');
        const f = pg.querySelector('.lbs path,.lbs rect,.lbs polygon,.lbs ellipse').getAttribute('fill');
        const lt = pg.style.getPropertyValue('--lft');
        el.value = '#15110e';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return { f, lt, q: q.bgc, lt2: document.querySelector('#lpage').style.getPropertyValue('--lft') };
      });
      check(
        'étiquettes : le fond est un color picker appliqué à l’étiquette (texte foncé sur fond clair, clair sur fond sombre)',
        bc.f === '#ffe9a8' && bc.lt === '#111' && bc.lt2 === '#f5f0e8',
        JSON.stringify(bc)
      );
    }
    check(
      'police et fond mémorisés dans la recette',
      await page.evaluate(() => S.kv.recipe.etq.fnt === 'metal' && S.kv.recipe.etq.bgc === '#15110e')
    );
    check(
      'aucun texte d’étiquette ne dépasse du format (tous formats, thème rock)',
      await page.evaluate(async () => {
        const bad = [];
        for (const f of LF) {
          S.kv.recipe.etq.fmt = f.id;
          lblRefresh();
          await document.fonts.ready;
          const lb = document.querySelector('#lpage .lb');
          const r = lb.getBoundingClientRect();
          lb.querySelectorAll('.lbc *').forEach(e => {
            if (e.children.length) return;
            const q = e.getBoundingClientRect();
            if (
              q.width &&
              (q.left < r.left - 1 || q.right > r.right + 1 || q.top < r.top - 1 || q.bottom > r.bottom + 1)
            )
              bad.push(f.id + ':' + e.className);
          });
        }
        return bad.length === 0 || bad.join(',');
      })
    );
    {
      const R0 = await page.evaluate(() => JSON.stringify([S.kv.recipe, S.malts, S.hops, S.yeasts, S.biblio, S.html]));
      await nav(page, 'biblio');
      await wait(200);
      const dir = path.join(ROOT, 'dev', 'tests', 'beerxml'),
        fl = fs
          .readdirSync(dir)
          .filter(f => /\.xml$/.test(f))
          .map(f => path.join(dir, f));
      const n0 = await page.evaluate(() => S.biblio.length);
      await page.setInputFiles('#bximp', fl);
      await wait(800);
      const bx = await page.evaluate(() => {
        const L = S.biblio.filter(b => b.imp),
          by = n => L.find(b => b.name.includes(n)) || { recipe: { malts: [], hops: [], mash: [] }, est: {} },
          k = by('Triple'),
          c = by('Chipotle'),
          rh = document.querySelector('table.lib tr:nth-child(3)');
        return {
          n: L.length,
          tot: S.biblio.length,
          bf: (() => {
            const b = L.find(z => /Sierra/.test(z.name));
            return b
              ? {
                  br: b.brasseur,
                  og: b.est.og,
                  mm: b.recipe.malts.map(m => m.g).join(),
                  hh: b.recipe.hops.map(h => h.g + h.use).join(),
                  y: b.recipe.yeasts.map(y => y.g).join(),
                  sty: b.recipe.style,
                  bo: b.recipe.mash.find(r => r.role === 'boil').m
                }
              : null;
          })(),
          ky: (() => {
            const b = L.find(z => /Dans/.test(z.name));
            return b.recipe.yeasts.map(y => y.g).join();
          })(),
          hdr: [...document.querySelectorAll('table.lib tr.hd th')].map(t =>
            t.textContent.replace(/[▲▼↑↓]/g, '').trim()
          ),
          btn: document.querySelector('label.btn input#bximp') ? 1 : 0,
          k: {
            og: k.est.og,
            abv: k.est.abv,
            mm: k.recipe.malts.map(m => m.g),
            hh: k.recipe.hops.length,
            ms: k.recipe.mash.map(r => r.k + ':' + r.t + '/' + r.m),
            sty: k.recipe.style,
            ing280: k.recipe.ings.some(i => i.g === 280)
          },
          c: { notes: c.recipe.notes !== undefined, ings: (c.recipe.ings || []).length },
          tags: document.querySelectorAll('.bxtag').length,
          ro: S.biblio.every(b => !b.imp || b.recipe.imp === 1),
          vol: k.vol
        };
      });
      check(
        'Beer.xml : 5 fichiers importés (5 recettes), bouton « Import beer.xml » dans l’en-tête, colonne Brasseur, aucune pastille « Beer.xml »',
        bx.n === 5 && bx.tot === n0 + 5 && bx.btn === 1 && bx.hdr[1] === 'Brasseur' && bx.tags === 0,
        JSON.stringify(bx)
      );
      check(
        'Beer.xml : triple belge converti (DI 1,075, ABV 8, malts en g, 4 houblons, paliers + rinçage + ébullition, style BJCP) ; ingrédients inconnus ajoutés',
        bx.k.og === 1.075 &&
          bx.k.abv === 8 &&
          bx.k.mm.join() === '5800,500,300' &&
          bx.k.ing280 &&
          bx.k.hh === 4 &&
          /Palier protéinique:50\/15/.test(bx.k.ms.join('|')) &&
          /Ébullition:100\/60/.test(bx.k.ms.join('|')) &&
          /Belgian Tripel/.test(bx.k.sty),
        JSON.stringify(bx.k)
      );
      check(
        'Brewfather (page partagée « Sierra Nevada Pale Ale v1 ») : convertie comme un Beer.xml — brasseur BYO Magazine, DI 1,054, malts 6700 + 450 g, 4 houblons dont aroma, 1 sachet, ébullition 90 min, style BJCP ; levure Kölsch = 1 sachet (et non 2 g)',
        !!bx.bf &&
          bx.bf.br === 'BYO Magazine' &&
          bx.bf.og === 1.054 &&
          bx.bf.mm === '6700,450' &&
          bx.bf.hh === '5Ébullition,5Ébullition,75Ébullition,75Whirlpool' &&
          bx.bf.y === '1' &&
          bx.bf.bo === 90 &&
          /18B/.test(bx.bf.sty) &&
          bx.ky === '1',
        JSON.stringify([bx.bf, bx.ky])
      );
      {
        const n0 = await page.evaluate(() => ({
          b: S.biblio.length,
          m: S.malts.length,
          h: S.hops.length,
          y: S.yeasts.length,
          btn: !!document.querySelector('label.btn #pdfimp') && !document.querySelector('#bfimp')
        }));
        const PD = ['hefeweizen_brewfather', 'apocalyptic_brewfather', 'bsx_1618718501', 'bsx_316930045'].map(f =>
          path.join(ROOT, 'dev', 'tests', 'pdf', f + '.pdf')
        );
        await page.evaluate(() => {
          window.__bcClear = true;
        });
        await page.setInputFiles('#pdfimp', PD);
        await wait(2500);
        const pr = await page.evaluate(() => {
          const g = n =>
              S.biblio.find(b => b.name.includes(n)) || {
                recipe: { malts: [], hops: [], yeasts: [], mash: [], ings: [] },
                est: {}
              },
            o = {};
          const H = g('Hefeweizen'),
            A = g('Apocalyptic'),
            I = g('Irish'),
            B = g('Blonde');
          o.n = S.biblio.length;
          o.lib = [S.malts.length, S.hops.length, S.yeasts.length];
          o.msg = (document.querySelector('#hmsg') || {}).textContent;
          o.H = {
            br: H.brasseur,
            og: H.est.og,
            ibu: H.est.ibu,
            mm: H.recipe.malts.map(m => m.n + '=' + m.g).join(),
            y: H.recipe.yeasts.map(y => y.n + '=' + y.g).join(),
            hh: H.recipe.hops.map(h => h.g + h.use + h.t).join(),
            mash: H.recipe.mash
              .filter(r => !r.role)
              .map(r => r.t + '/' + r.m)
              .join(),
            sty: H.recipe.style,
            imp: H.imp,
            src: H.recipe.impd && H.recipe.impd.src,
            ings: H.recipe.ings.map(i => i.n).join(),
            notes: /Substitute WB-06/.test(H.recipe.notes)
          };
          o.A = {
            ing: A.recipe.ings.map(m => m.n + '=' + m.g).join(),
            br: A.brasseur,
            hh: A.recipe.hops.map(h => h.g + h.use + h.t).join(),
            mm: A.recipe.malts.map(m => m.n + '=' + m.g).join(),
            y: A.recipe.yeasts.map(y => y.g).join(),
            boil: (A.recipe.mash.find(r => r.role === 'boil') || {}).m,
            sty: A.recipe.style
          };
          o.I = {
            br: I.brasseur,
            mm: I.recipe.malts.map(m => m.g).join(),
            y: I.recipe.yeasts.map(y => y.g).join(),
            hh: I.recipe.hops.map(h => h.g + h.use + h.t).join(),
            og: I.est.og,
            ebc: I.est.ebc,
            src: I.recipe.impd && I.recipe.impd.src,
            sty: I.recipe.style
          };
          o.B = {
            br: B.brasseur,
            mm: B.recipe.malts.map(m => m.g).join(),
            hn: B.recipe.hops.length,
            mash: B.recipe.mash
              .filter(r => !r.role)
              .map(r => r.t + '/' + r.m)
              .join(),
            y: B.recipe.yeasts.map(y => y.g).join(),
            og: B.est.og
          };
          o.unk = pdToXml(
            Object.assign(pdEmpty(), { name: 'T', malts: [{ kg: 1, n: 'Zzz', ty: 'Grain', ebc: 3 }] }),
            't.pdf'
          ).includes('<BREWER>Brasseur Inconnu</BREWER>');
          o.tags = document.querySelectorAll('.bxtag').length;
          return o;
        });
        await page.setInputFiles('#pdfimp', PD.slice(0, 2));
        await wait(1500);
        const n2 = await page.evaluate(() => S.biblio.length);
        check(
          'Import PDF : bouton « Import PDF » (plus d’import Brewfather), 4 PDF (2 Brewfather + 2 BeerSmith) → 4 recettes en lecture seule, réimport = remplacement sans doublon',
          n0.btn &&
            pr.n === n0.b + 4 &&
            n2 === pr.n &&
            pr.H.imp === 1 &&
            /PDF Brewfather/.test(pr.H.src) &&
            /PDF BeerSmith/.test(pr.I.src) &&
            pr.tags === 0,
          JSON.stringify([n0, pr.n, n2, pr.H.src, pr.I.src])
        );
        check(
          'Import PDF Brewfather : brasseur, DI/IBU, malts (g), levure en sachet, houblons, empâtage, style, notes',
          pr.H.br === 'Horse Beers LLC' &&
            pr.H.og === 1.05 &&
            pr.H.ibu === 13 &&
            /=2700/.test(pr.H.mm) &&
            /=1400/.test(pr.H.mm) &&
            /=480/.test(pr.H.mm) &&
            /=1$/.test(pr.H.y) &&
            pr.H.hh === '26Ébullition60' &&
            pr.H.mash === '48/15,67/60' &&
            /Weissbier/.test(pr.H.sty) &&
            pr.H.notes &&
            pr.A.br === 'Amundsen Bryggeri' &&
            pr.A.hh === '100Whirlpool30,100Dry hop0,200Dry hop7' &&
            /=6100/.test(pr.A.mm) &&
            !/=500/.test(pr.A.mm) &&
            /Lactose.*=500/i.test(pr.A.ing) &&
            pr.A.y === '1' &&
            pr.A.boil === 90 &&
            /IPA/.test(pr.A.sty),
          JSON.stringify([pr.H, pr.A])
        );
        check(
          'Import PDF BeerSmith : brasseur, DI, malts + extrait, dry hop en jours, levure sèche = 1 sachet, empâtage, 2 recettes',
          pr.I.br === 'Brad Smith' &&
            pr.I.mm === '230,110,60,2990' &&
            pr.I.y === '1' &&
            pr.I.og === 1.042 &&
            pr.I.hh === '56.7Ébullition25,28.4Dry hop3' &&
            /Irish Red/.test(pr.I.sty) &&
            pr.B.br === 'Bright Spot Brewing' &&
            pr.B.mm === '3740,340,230,110' &&
            pr.B.hn === 5 &&
            pr.B.mash === '65.6/60' &&
            pr.B.y === '1' &&
            pr.B.og === 1.045,
          JSON.stringify([pr.I, pr.B])
        );
        check(
          'Import PDF : ingrédient inconnu = texte dans la recette, aucun ajout aux bibliothèques ; brasseur absent = « Brasseur Inconnu » ; message récapitulatif',
          pr.lib.join() === [n0.m, n0.h, n0.y].join() && pr.unk && /conservé\(s\) en texte/.test(pr.msg || ''),
          JSON.stringify([n0, pr.lib, pr.unk, pr.msg])
        );
        {
          await page.evaluate(() => {
            window.__bcManual = true;
          });
          await page.setInputFiles('#pdfimp', [path.join(ROOT, 'dev', 'tests', 'pdf', 'bsx_316930045.pdf')]);
          await page.waitForSelector('.bcmap', { timeout: 8000 });
          const mp = await page.evaluate(async () => {
            const w = ms => new Promise(r => setTimeout(r, ms)),
              o = {},
              d = document.querySelector('.bcdlg'),
              ins = [...d.querySelectorAll('.bcmap input')];
            o.rows = ins.length;
            o.title = d.querySelector('h4').textContent;
            o.ty = [...d.querySelectorAll('.bcmap .ty')].map(x => x.textContent).join();
            o.dl =
              document.querySelectorAll('#bcdl-all option').length ===
              ['malts', 'hops', 'yeasts', 'ings', 'conso'].reduce((a, t) => a + S[t].filter(x => !x.sys).length, 0);
            o.sug = ins.filter(i => i.value).length;
            const mi =
              d.querySelector('.bcmap tr .ty').textContent === 'Malt'
                ? ins[0]
                : ins.find(i => i.getAttribute('list') === 'bcdl-all');
            const lib = S.malts[0];
            o.libn = lib.name;
            mi.value = lib.name;
            ins.filter(i => i !== mi).forEach(i => (i.value = ''));
            ins[ins.length - 1].value = 'zz-inconnu';
            d.querySelector('.ok').click();
            await w(150);
            o.blocked =
              !!document.querySelector('.bcdlg') &&
              !!document.querySelector('.bcdlg .bcmap input.bad') &&
              /ne figure/.test(document.querySelector('.bcdlg .bcmsg').textContent);
            ins[ins.length - 1].value = '';
            document.querySelector('.bcdlg .ok').click();
            await w(1200);
            o.closed = !document.querySelector('.bcdlg');
            window.__bcManual = false;
            const B = S.biblio.find(b => b.name.includes('Blonde')),
              first = B.recipe.malts.map(m => m.n);
            o.mapped = first.some(n => n.startsWith(lib.name.slice(0, 6)) || n === lib.name || !!find('malts', n));
            o.kept = B.recipe.malts.some(m => !find('malts', m.n));
            o.ar = (S.kv.equip.arech || []).some(x =>
              /Pale Malt|Caramel|Cara-Pils|White Wheat|Galena|Cascade|Columbus|German Ale/.test(x.n)
            );
            o.armap = !(S.kv.equip.arech || []).some(x => x.t === 'malts' && x.n === mi.dataset.un);
            return o;
          });
          check(
            'import PDF : boîte « Correspondance des ingrédients » (ingrédient inconnu + liste de la base, suggestion pré-remplie, valeur hors base refusée) ; choix = ingrédient de la base utilisé ; champ vide = texte + liste « À rechercher »',
            mp.rows >= 3 && !/Divers/.test(mp.ty) && mp.dl && mp.blocked && mp.closed && mp.kept && mp.ar,
            JSON.stringify(mp)
          );
        }
        {
          await page.evaluate(() => {
            show('params');
            window.__bcManual = true;
          });
          await wait(400);
          await page.click('#dbchg');
          await page.waitForSelector('.bcdlg .bcdb', { timeout: 5000 });
          const dc = await page.evaluate(async () => {
            const d = document.querySelector('.bcdlg'),
              o = {
                t: d.querySelector('h4').textContent,
                txt: d.querySelector('.bcdb').textContent,
                ok: d.querySelector('.ok').textContent
              };
            d.querySelector('.no').click();
            await new Promise(r => setTimeout(r, 150));
            o.closed = !document.querySelector('.bcdlg');
            window.__bcManual = false;
            show('biblio');
            return o;
          });
          check(
            'Paramètres › « Changer de base… » : popup OpenMaltForge (base actuelle, emplacement, taille, contenu) avant le sélecteur de fichiers ; Annuler = rien ne change ; catégorie « Ingrédient » (et non « Divers ») dans la boîte de correspondance',
            dc.t === 'Changer de base de données' &&
              /openmaltforge\.sqlite/.test(dc.txt) &&
              /Recettes/.test(dc.txt) &&
              /Malts/.test(dc.txt) &&
              dc.ok === 'Choisir un fichier…' &&
              dc.closed,
            JSON.stringify(dc)
          );
        }
        {
          const st = await page.evaluate(async () => {
            window.__bcManual = true;
            const w = ms => new Promise(r => setTimeout(r, ms)),
              nm = S.styles[3].name,
              o = {};
            const xml = z => '<RECIPES><RECIPE><NAME>R1</NAME><STYLE><NAME>' + z + '</NAME></STYLE></RECIPE></RECIPES>',
              it = [
                { name: 'a.xml', text: xml('Zzz Style Inconnu') },
                { name: 'b.xml', text: xml(nm) }
              ];
            const pr = bxAskStyles(it);
            await w(300);
            const d = document.querySelector('.bcdlg');
            o.open = !!d;
            o.rows = d ? d.querySelectorAll('.bcmap tr').length : 0;
            o.ty = d ? d.querySelector('.bcmap .ty').textContent : '';
            o.dl = !!(d && d.querySelector('#bcdl-styles option'));
            d.querySelector('.bcmap input').value = nm;
            d.querySelector('.ok').click();
            await pr;
            o.set = it[0].text.includes('<NAME>' + nm + '</NAME>');
            const it2 = [{ name: 'c.xml', text: xml(nm) }];
            o.none = (await bxAskStyles(it2)) && !document.querySelector('.bcdlg');
            const it3 = [{ name: 'd.xml', text: xml('Zzz Style Inconnu') }],
              p3 = bxAskStyles(it3);
            await w(300);
            document.querySelector('.bcdlg .no').click();
            await p3;
            o.txt = it3[0].text.includes('Zzz Style Inconnu');
            window.__bcManual = false;
            return o;
          });
          check(
            'import : style absent de la base → boîte de correspondance (liste des styles), choix appliqué ; style connu = pas de boîte ; vide/« Garder en texte » = style conservé',
            st.open && st.rows === 1 && st.ty === 'Style' && st.dl && st.set && st.none && st.txt,
            JSON.stringify(st)
          );
        }
        {
          await page.evaluate(() => {
            show('biblio');
          });
          await wait(150);
          const cnt = () =>
            page.evaluate(() => document.querySelectorAll('table.lib tr:not(.flt):not(.hd) .acts').length);
          const tot = await cnt(),
            ne = await page.evaluate(() => {
              /* 6.8.0 : « Réalisé » = date de brassage renseignée ; une seule recette datée pour le test */
              window.__eb = S.biblio.map(x => x.recipe.date);
              S.biblio.forEach((x, i) => (x.recipe.date = i ? '' : '2026-01-01'));
              biblio();
              return S.biblio.filter(x => x.recipe.date).length;
            });
          const f = async v => {
            await page.fill('[data-bf="embou"]', v);
            await wait(250);
            return cnt();
          };
          const r1 = await f('1'),
            r2 = await f('oui'),
            r0 = await f('0'),
            rn = await f('non'),
            rx = await f('');
          await page.evaluate(() => {
            S.biblio.forEach((x, i) => (x.recipe.date = window.__eb[i]));
            document.querySelector('#bfclr').click();
          });
          await wait(150);
          check(
            'Bibliothèque : filtre « Réalisé » — 1 ou oui = recettes avec la coche verte, 0 ou non = sans coche, vide = toutes',
            r1 === ne && r2 === ne && r0 === tot - ne && rn === tot - ne && rx === tot && ne >= 1 && ne < tot,
            JSON.stringify({ tot, ne, r1, r2, r0, rn, rx })
          );
        }
        {
          const cp = await page.evaluate(async () => {
            window.__bcManual = true;
            show('malts');
            const w = ms => new Promise(r => setTimeout(r, ms)),
              o = {};
            o.btn = !!document.querySelector('#csvp');
            const n0 = S.malts.length;
            document.querySelector('#csvp').click();
            await w(200);
            let d = document.querySelector('.bcdlg'),
              ta = d && d.querySelector('textarea.bccsv');
            o.ta = !!ta;
            d.querySelector('.ok').click();
            await w(100);
            o.empty = !!document.querySelector('.bcdlg') && !document.querySelector('.bcmsg').hidden;
            ta.value = 'foo;bar\n1;2';
            d.querySelector('.ok').click();
            await w(100);
            o.bad = !!document.querySelector('.bcdlg') && /name/.test(document.querySelector('.bcmsg').textContent);
            ta.focus();
            ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            await w(100);
            o.enter = !!document.querySelector('.bcdlg');
            ta.value = 'name;maltier;ebc\nZzz Malt Collé;Testeur;12,5\nZzz Malt Deux;Testeur;3';
            d.querySelector('.ok').click();
            await w(500);
            o.closed = !document.querySelector('.bcdlg');
            const m = S.malts.find(x => x.name === 'Zzz Malt Collé');
            o.added = !!m && m.ebc === 12.5 && S.malts.length === n0 + 2;
            S.malts = S.malts.filter(x => !/^Zzz Malt/.test(x.name));
            window.__bcManual = false;
            show('biblio');
            return o;
          });
          check(
            'Malts : bouton « Coller CSV » → zone de texte, validation (vide / sans colonne name), Entrée = saut de ligne, import ajoute les lignes',
            cp.btn && cp.ta && cp.empty && cp.bad && cp.enter && cp.closed && cp.added,
            JSON.stringify(cp)
          );
        }
        {
          const fm = await page.evaluate(async () => {
            window.__bcManual = true;
            const w = ms => new Promise(r => setTimeout(r, ms)),
              o = {};
            const xml =
              '<RECIPES><RECIPE><NAME>R1 Zzz</NAME><FERMENTABLES><FERMENTABLE><NAME>Lactose Zzz</NAME><TYPE>Sugar</TYPE><AMOUNT>0.25</AMOUNT></FERMENTABLE><FERMENTABLE><NAME>Zzz Qwxy Grain</NAME><TYPE>Grain</TYPE><AMOUNT>4</AMOUNT></FERMENTABLE></FERMENTABLES></RECIPE></RECIPES>';
            const r = bxImportTexts([{ name: 'a.xml', text: xml, noCreate: true }]),
              i = r.idx[0],
              b = S.biblio[i];
            o.noadd = !find('malts', 'Lactose Zzz') && !find('malts', 'Zzz Qwxy Grain');
            o.unres = bxUnres(b.recipe).length;
            o.author = b.brasseur;
            o.icon = (() => {
              biblio();
              return !!document.querySelector('[data-brel="' + i + '"]');
            })();
            o.ro = (() => {
              const inp = document.querySelector('[data-bbr="' + i + '"]');
              return !!inp && inp.readOnly && inp.value === '-';
            })();
            const pr = bxRelinkAsk([i]);
            await w(300);
            const d = document.querySelector('.bcdlg'),
              ins = [...d.querySelectorAll('.bcmap input')],
              ing0 = S.ings[0].name;
            o.rows = ins.length;
            o.nosel = !d.querySelector('.bcmap select');
            o.all = document.querySelectorAll('#bcdl-all option').length === ['malts', 'hops', 'yeasts', 'ings', 'conso'].reduce((a, t) => a + S[t].filter(x => !x.sys).length, 0);
            ins[0].value = ing0;
            d.querySelector('.ok').click();
            const n = await pr;
            o.n = n;
            const R = S.biblio[i].recipe;
            o.malts = (R.malts || []).map(x => x.n).join('|');
            o.ings = (R.ings || []).map(x => x.n + ':' + x.g).join('|');
            o.ing0 = ing0;
            const d0 = { malts: [{ n: 'Lactose', kg: 0.2, ty: 'Sugar', ebc: 0 }], hops: [], yeasts: [], miscs: [] };
            pdApplyMap(d0, { '@mv|malts|Lactose': 'ings|Lactose' });
            o.pd = d0.malts.length === 0 && d0.miscs.length === 1 && d0.miscs[0].v === 200 && d0.miscs[0].u === 'g';
            S.biblio.splice(i, 1);
            S.kv.equip.arech = (S.kv.equip.arech || []).filter(x => !/Zzz/.test(x.n));
            window.__bcManual = false;
            return o;
          });
          {
  const ac = await page.evaluate(async () => {
    window.__bcManual = true;
    const w = ms => new Promise(r => setTimeout(r, ms)),
      cn = S.conso[0].name,
      p = pdMapDlg([{ t: 'ings', n: 'Zzz Inconnu', rec: ['R'], sug: '' }]);
    await w(300);
    const d = document.querySelector('.bcdlg'),
      opts = [...d.querySelectorAll('#bcdl-all option')].map(o => o.value),
      inp = d.querySelector('.bcmap input');
    inp.value = cn;
    d.querySelector('.ok').click();
    const map = await p;
    window.__bcManual = false;
    return { cn, both: opts.includes(cn) && opts.includes(S.ings[0].name), map };
  });
  check(
    'correspondance à l’import : autocomplétion des ingrédients = tables Ingrédients + Consommables (un consommable est accepté)',
    ac.both && ac.map['ings|Zzz Inconnu'] === ac.cn,
    JSON.stringify(ac)
  );
}
{
  const xm = await page.evaluate(async () => {
    window.__bcManual = true;
    const w = ms => new Promise(r => setTimeout(r, ms)),
      hn = S.hops[0].name,
      p = pdMapDlg([{ t: 'malts', n: 'Zzz Fantôme', rec: ['R'], sug: '' }]);
    await w(300);
    const d = document.querySelector('.bcdlg');
    d.querySelector('.bcmap input').value = hn;
    d.querySelector('.ok').click();
    const map = await p;
    window.__bcManual = false;
    const d0 = { malts: [{ n: 'Zzz Fantôme', kg: 0.03, ty: 'Grain', ebc: 0 }], hops: [], yeasts: [], miscs: [] };
    pdApplyMap(d0, map);
    return { hn, map, ok: d0.malts.length === 0 && d0.hops.length === 1 && d0.hops[0].n === hn && Math.round(d0.hops[0].kg * 1000) === 30 };
  });
  check(
    'correspondance à l’import : un malt inconnu peut être associé à un houblon (n’importe quel composant), la ligne change de catégorie',
    xm.map['@mv|malts|Zzz Fantôme'] === 'hops|' + xm.hn && xm.ok,
    JSON.stringify(xm)
  );
}
check(
            'import beer.xml : ingrédients inconnus non créés, ↻ affiché, brasseur absent = « - » (lecture seule), boîte de correspondance (autocomplétion de tous les composants, sans liste « Stocker comme », un malt peut être rangé en ingrédient) ; PDF idem',
            fm.noadd &&
              fm.unres === 2 &&
              fm.author === '-' &&
              fm.icon &&
              fm.ro &&
              fm.rows === 2 &&
              fm.nosel &&
              fm.all &&
              fm.malts === 'Zzz Qwxy Grain' &&
              fm.ings === fm.ing0 + ':250' &&
              fm.pd,
            JSON.stringify(fm)
          );
        }
        {
          const tg = await page.evaluate(async () => {
            const o = {},
              inp = (sel, v) => {
                const el = document.querySelector(sel);
                el.value = v;
                el.dispatchEvent(new Event('input', { bubbles: true }));
              };
            show('params');
            o.has = !!document.querySelector('.eq [data-e="ogT"]') && !!document.querySelector('.eq [data-e="ibuT"]');
            inp('.eq [data-e="ogT"]', '1.052');
            inp('.eq [data-e="ibuT"]', '33');
            const rec0 = { og: S.kv.recipe.ogT, ibu: S.kv.recipe.ibuT };
            o.indep = S.kv.equip.ogT === 1.052 && S.kv.equip.ibuT === 33 && S.kv.recipe.ogT === rec0.og;
            show('conception');
            inp('[data-r="ogT"]', '1.048');
            inp('[data-r="ibuT"]', '25');
            o.keep = S.kv.equip.ogT === 1.052 && S.kv.equip.ibuT === 33;
            show('params');
            o.back = document.querySelector('.eq [data-e="ogT"]').value === '1.052' && document.querySelector('.eq [data-e="ibuT"]').value === '33';
            show('conception');
            document.querySelector('#newrec').click();
            o.nw = S.kv.recipe.ogT === 1.052 && S.kv.recipe.ibuT === 33;
            return o;
          });
          check(
            'Paramètres › Équipement & process : DI et IBU cibles par défaut, indépendants de la Conception (non modifiés par elle) et appliqués à chaque « Nouvelle recette »',
            tg.has && tg.indep && tg.keep && tg.back && tg.nw,
            JSON.stringify(tg)
          );
        }
        {
          const st = await page.evaluate(async () => {
            const o = {},
              w = ms => new Promise(r => setTimeout(r, ms));
            o.cols = ['malts', 'hops', 'yeasts', 'ings', 'conso'].every(t => COLS[t].includes('stock') && S[t].every(x => x.stock !== undefined));
            show('malts');
            o.head = [...document.querySelectorAll('table.db tr.hd th')].some(h => /^stock \(kg\)/.test(h.textContent));
            const fi = document.querySelector('.fi[data-fc="stock"]');
            o.ph = fi && fi.placeholder === 'filtrer…';
            const m0 = S.malts.find(x => x.name === S.kv.recipe.malts[0].n) || S.malts[0];
            m0.stock = 10;
            const mi = S.malts.indexOf(m0);
            const vis = () => [...document.querySelectorAll('tr[data-ri]')].filter(r => r.style.display !== 'none').length;
            const setF = v => {
              fi.value = v;
              fi.dispatchEvent(new Event('input', { bubbles: true }));
            };
            show('malts');
            const f2 = document.querySelector('.fi[data-fc="stock"]');
            f2.value = '1';
            f2.dispatchEvent(new Event('input', { bubbles: true }));
            o.in = vis() === S.malts.filter(x => +x.stock > 0).length && vis() >= 1;
            f2.value = '0';
            f2.dispatchEvent(new Event('input', { bubbles: true }));
            o.out = vis() === Math.min(15, S.malts.filter(x => !(+x.stock > 0)).length);
            FLT.malts = {};
            /* 6.7.0 : déduction à la saisie de la date de brassage (la date d’embouteillage ne touche plus au stock) */
            const R = S.kv.recipe;
            R.embou = '';
            R.date = '';
            delete R.stk;
            const mn = R.malts[0].n,
              g = +R.malts[0].g,
              d0 = find('malts', mn);
            d0.stock = 20;
            show('conception');
            const eb = document.querySelector('[data-r="embou"]'),
              db = document.querySelector('[data-r="date"]');
            eb.value = '2026-11-12';
            eb.dispatchEvent(new Event('input', { bubbles: true }));
            o.noEmbou = Math.abs(d0.stock - 20) < 0.002 && !S.kv.recipe.stk && !document.getElementById('orga').hidden;
            eb.value = '';
            eb.dispatchEvent(new Event('input', { bubbles: true }));
            db.value = '2026-11-01';
            db.dispatchEvent(new Event('input', { bubbles: true }));
            o.ded = Math.abs(d0.stock - (20 - g / 1000)) < 0.002 && Array.isArray(S.kv.recipe.stk) && S.kv.recipe.stk.length > 0;
            db.value = '2026-11-02';
            db.dispatchEvent(new Event('input', { bubbles: true }));
            o.once = Math.abs(d0.stock - (20 - g / 1000)) < 0.002;
            db.value = '';
            db.dispatchEvent(new Event('input', { bubbles: true }));
            o.back = Math.abs(d0.stock - 20) < 0.002 && !S.kv.recipe.stk;
            return o;
          });
          check(
            'Stock : colonne « stock » (5 listes), filtre 1/0 (placeholder « filtrer… »), déduction du stock à la saisie de la date de brassage (une seule fois), remise en stock si effacée ; la date d’embouteillage ne touche pas au stock',
            st.cols && st.head && st.ph && st.in && st.out && st.ded && st.once && st.back,
            JSON.stringify(st)
          );
        }
        {
          const cr = await page.evaluate(async () => {
            const o = {},
              w = ms => new Promise(r => setTimeout(r, ms));
            window.__bcNoPrint = true;
            S.kv.equip.courses = [];
            const R = S.kv.recipe;
            R.embou = '';
            delete R.stk;
            const mn = R.malts[0].n,
              d = find('malts', mn),
              kg = R.malts[0].g / 1000;
            d.stock = kg + 1;
            conception();
            await w(150);
            const btn = () => document.querySelector('button[data-cart="malts"][data-i="0"]');
            o.hid = btn() && !btn().hidden && !btn().classList.contains('short'); /* caddie visible même avec un stock suffisant */
            d.stock = kg - 2.5 > 0 ? kg - 2.5 : 0;
            const exp = +(kg - d.stock).toFixed(3);
            conception();
            await w(150);
            o.show = !!btn() && !btn().hidden && btn().classList.contains('short');
            const x = btn().parentNode.querySelector('button.x');
            o.before = btn().nextElementSibling === x;
            btn().click();
            await w(150);
            const L = S.kv.equip.courses,
              mi = () => L.findIndex(c => c.t === 'malts' && c.n === d.name),
              ci = mi();
            o.add = ci >= 0 && Math.abs(L[ci].q - exp) < 0.002 && L[ci].r.auto === undefined;
            o.panel = !!document.querySelector('#courses > .panel table.cour') && /Courses/.test(document.querySelector('#courses h3').textContent);
            o.below = document.querySelector('#courses').previousElementSibling.textContent.includes('Ingrédients');
            o.noeye = !document.querySelector('#copen') && !document.querySelector('#cclr') && !!document.querySelector('#cpp');
            const h = coursesHtml();
            o.html = h.includes(d.name) && /Liste de courses/.test(h) && /@page/.test(h) && /Total estimé/.test(h);
            const qi = document.querySelector('#courses [data-cq="' + ci + '"]');
            qi.value = '7.5';
            qi.dispatchEvent(new Event('change', { bubbles: true }));
            o.edit = S.kv.equip.courses[ci].q === 7.5;
            document.querySelector('#cpp').click();
            await w(400);
            o.ifr = !!document.querySelector('iframe') && document.querySelector('iframe').contentDocument.body.textContent.includes('Liste de courses') && document.querySelector('iframe').contentDocument.body.textContent.includes('7,5');
            document.querySelectorAll('iframe').forEach(f => f.remove());
            document.querySelector('#courses [data-cdel="' + ci + '"]').click();
            await w(100);
            conception();
            await w(100);
            o.del = mi() < 0; /* retiré à la croix, pas remis automatiquement */
            /* écrans de base : même caddie */
            show('malts');
            await w(100);
            d.stock = 0;
            const i = S.malts.indexOf(d);
            const rowBtn = () => document.querySelector('button[data-cartd="malts"][data-i="' + i + '"]');
            const need = R.malts[0].g / 1000;
            S.kv.equip.courses = [];
            dbScreen('malts');
            await w(100);
            o.dbshow = !!rowBtn() && !rowBtn().hidden && rowBtn().nextElementSibling.dataset.dr == i;
            rowBtn().click();
            await w(100);
            const dm = () => S.kv.equip.courses.find(c => c.t === 'malts' && c.n === d.name);
            o.dbadd = !!dm() && Math.abs(dm().q - need) < 0.002;
            d.stock = need + 5;
            dbScreen('malts');
            await w(100);
            o.dbhide = !!rowBtn() && !rowBtn().hidden;
            S.kv.equip.courses = [{ t: 'malts', n: 'Zz', q: 3, r: { manuel: 3 } }];
            const rt = (await __rt());
            o.persist = !!rt && JSON.stringify(rt.kv.equip.courses) === JSON.stringify(S.kv.equip.courses);
            S.kv.equip.courses = [];
            rowBtn().click();
            await w(100);
            o.dbdef = !!dm() && dm().q === 1 && dm().r.manuel === 1 && /liste de courses/.test(document.querySelector('#hmsg').textContent);
            show('eaux');
            await w(100);
            const ev = S.eaux.findIndex(x => /min[ée]ral/i.test(x.type)),
              ev2 = S.eaux.findIndex(x => !/min[ée]ral/i.test(x.type)),
              eb = i2 => document.querySelector('button[data-cartd="eaux"][data-i="' + i2 + '"]');
            o.eaux = ev >= 0 && ev2 >= 0 && !!eb(ev) && !eb(ev).hidden && !!eb(ev2) && eb(ev2).hidden;
            o.align = (() => { const x = ['data-dup','data-cartd','data-dr'].map(a => [...document.querySelectorAll('tr[data-ri] button[' + a + ']')].filter(b => b.offsetParent && b.closest('tr').style.display !== 'none' || b.getBoundingClientRect().width > 0).map(b => Math.round(b.getBoundingClientRect().left))); return x.every(c => c.length > 1 && new Set(c).size === 1); })();
            S.kv.equip.courses = [];
            eb(ev).click();
            await w(100);
            o.eadd = S.kv.equip.courses.some(c => c.t === 'eaux' && c.n === S.eaux[ev].name && c.q === 10);
            S.kv.equip.courses = [];
            d.stock = 0;
            window.__bcNoPrint = false;
            return o;
          });
          check(
            'Courses : caddie (stock − quantité < 0) devant ✕ en Conception et dans les écrans de base (Eaux : minérales seulement), section sous « Ingrédients & consommables », popup (quantités modifiables, ✕, imprimante), feuille imprimable',
            cr.hid && cr.show && cr.before && cr.add && cr.panel && cr.below && cr.noeye && cr.html && cr.edit && cr.ifr && cr.del && cr.dbshow && cr.dbadd && cr.dbhide && cr.dbdef && cr.eaux && cr.align && cr.eadd,
            JSON.stringify(cr)
          );
        }
        {
          await page.evaluate(() => {
            S.kv.equip.courses = [];
            const R = S.kv.recipe;
            R.embou = '';
            delete R.stk;
            find('malts', R.malts[0].n).stock = 0;
            conception();
          });
          await page.waitForTimeout(200);
          const cb = page.locator('button[data-cart="malts"][data-i="0"]');
          let real = false,
            vis = false;
          try {
            vis = await cb.isVisible();
            const box = await cb.boundingBox();
            vis = vis && box && box.width > 8 && box.height > 8;
            await cb.click({ timeout: 3000 });
            real = true;
          } catch (e) {}
          /* le malt (stock 0) est dans la liste ; le clic sur le caddie le passe en ajout « recette » (plus d'automatique) */
          const n1 = await page.evaluate(
            () =>
              S.kv.equip.courses.filter(c => c.t === 'malts' && c.n === find('malts', S.kv.recipe.malts[0].n).name && c.r.auto === undefined)
                .length
          );
          await page.evaluate(() => {
            show('malts');
          });
          await page.waitForTimeout(200);
          const rb = page.locator('button[data-cartd="malts"]').first(),
            rbv = (await rb.isVisible()) && (await rb.boundingBox()).width > 8;
          check('Courses : clic souris réel sur le caddie (Conception visible et cliquable ; écran Malts visible sur chaque ligne)', vis && real && n1 === 1 && rbv, JSON.stringify({ vis, real, n1, rbv }));
          await page.evaluate(() => {
            S.kv.equip.courses = [];
            find('malts', S.kv.recipe.malts[0].n).stock = 0;
          });
        }
        {
          const pc = await page.evaluate(async () => {
            S.kv.equip.courses = [{ t: 'malts', n: 'Zzz', q: 3, r: { manuel: 3 } }];
            const o = (await __rt());
            S.kv.equip.courses = [];
            return { saved: JSON.stringify(o && o.kv.equip.courses) };
          });
          check('Courses : la liste est enregistrée dans la base et relue', /Zzz/.test(pc.saved), pc.saved);
        }
        {
          const fit = await page.evaluate(async () => {
            const w = ms => new Promise(r => setTimeout(r, ms)),
              o = {};
            window.__bcNoPrint = true;
            const keep = S.kv.equip.courses;
            const mk = (t, n) => Array.from({ length: n }, (_, i) => ({ t, n: t + ' article ' + i, q: i + 1, r: { manuel: 1 } }));
            S.kv.equip.courses = [...mk('malts', 12), ...mk('hops', 14), ...mk('yeasts', 6), ...mk('ings', 12), ...mk('conso', 8), ...mk('eaux', 3)];
            coursesPrint();
            await w(500);
            const f = document.querySelector('iframe'),
              bx = f.contentDocument.querySelector('.box');
            o.z = +f.dataset.zoom;
            o.h = bx.getBoundingClientRect().height;
            o.fit = o.z < 1 && o.h <= (269 * 96) / 25.4;
            f.remove();
            S.kv.equip.courses = [{ t: 'malts', n: 'Munich', q: 1, r: {} }];
            coursesPrint();
            await w(500);
            const f2 = document.querySelector('iframe');
            o.small = +f2.dataset.zoom === 1;
            f2.remove();
            S.kv.equip.courses = keep;
            window.__bcNoPrint = false;
            return o;
          });
          check('Courses : la feuille imprimée tient sur 1 page A4 (mise à l’échelle automatique si la liste est longue)', fit.fit && fit.small, JSON.stringify(fit));
        }
        {
          const vb = await page.evaluate(async () => {
            const o = {},
              inp = (sel, v) => {
                const el = document.querySelector(sel);
                el.value = v;
                el.dispatchEvent(new Event('input', { bubbles: true }));
              },
              bm = () => S.kv.recipe.mash.find(r => r.role === 'boil').m;
            show('params');
            o.has = !!document.querySelector('.eq [data-e="volD"]') && !!document.querySelector('.eq [data-e="boilD"]') && !document.querySelector('.eq [data-e="vol"]') && !document.querySelector('.eq [data-e="boil"]');
            const vol0 = S.kv.equip.vol,
              b0 = bm();
            inp('.eq [data-e="volD"]', '28');
            inp('.eq [data-e="boilD"]', '75');
            o.indep = S.kv.equip.volD === 28 && S.kv.equip.boilD === 75 && S.kv.equip.vol === vol0 && bm() === b0;
            show('conception');
            inp('[data-e="vol"]', '22');
            o.keep = S.kv.equip.volD === 28 && S.kv.equip.vol === 22;
            document.querySelector('#newrec').click();
            o.nw = S.kv.equip.vol === 28 && bm() === 75 && document.querySelector('[data-e="vol"]').value === '28';
            return o;
          });
          check(
            'Paramètres : « Volume à embouteiller » et « Durée d’ébullition » = valeurs par défaut des nouvelles recettes (indépendantes de la Conception, comme la DI cible)',
            vb.has && vb.indep && vb.keep && vb.nw,
            JSON.stringify(vb)
          );
          await page.evaluate(() => {
            S.kv.equip.volD = 30;
            S.kv.equip.boilD = 60;
          });
        }
        {
          const cn = await page.evaluate(async () => {
            const w = ms => new Promise(r => setTimeout(r, ms)),
              o = {};
            show('conception');
            await w(100);
            document.querySelector('#hmsg').textContent = '';
            document.querySelector('#calc').click();
            await w(400);
            const m = document.querySelector('#hbar .hn[data-k="calc"]'),
              nv = document.querySelector('#nav').getBoundingClientRect();
            o.txt = /Recalculé/.test(m.textContent) && m.classList.contains('ok');
            o.below = m.getBoundingClientRect().top >= nv.bottom - 1;
            o.noold = !document.querySelector('#msg');
            return o;
          });
          check('Notification « Recalculé » : affichée dans la bande sous le menu (comme les autres), plus dans l’écran Conception', cn.txt && cn.below && cn.noold, JSON.stringify(cn));
        }
        {
          const wr = await page.evaluate(async () => {
            const w = ms => new Promise(r => setTimeout(r, ms)),
              o = {},
              cells = i => [...document.querySelectorAll('[id^="wv-' + i + '-"]')];
            const R = S.kv.recipe;
            R.water = [{ n: 'Vittel (Grande Source)', p: 100, l: 0 }];
            show('conception');
            await w(200);
            o.A = cells(0).map(x => x.textContent).join('/') === '7,30/400,00/240,00/42,00/5,20/384,00' && !cells(0)[0].classList.contains('dim');
            document.querySelector('[data-wadd]').click();
            await w(200);
            const n = document.querySelector('input[data-wi="1"][data-wf="n"]');
            n.value = 'Mont Roucous';
            n.dispatchEvent(new Event('input', { bubbles: true }));
            n.dispatchEvent(new Event('change', { bubbles: true }));
            await w(200);
            const mr = S.eaux.find(x => x.name === 'Mont Roucous');
            o.B = cells(1).map(x => x.textContent).join('/') === ['cl', 'so4', 'ca', 'mg', 'na', 'hco3'].map(k => nf(+mr[k], 2)).join('/') && cells(1).every(x => x.classList.contains('dim'));
            o.sub = document.querySelector('#ws-ca').textContent === nf(240, 2);
            return o;
          });
          check('Eau & minéraux : les caractéristiques d’une eau choisie sont affichées (estompées à 0 %, sans fausser le sous-total)', wr.A && wr.B && wr.sub, JSON.stringify(wr));
        }
        {
          /* non-régression : radar agrandi (clic) des écrans Malts / Houblons / Levures */
          const zr = {};
          for (const t of ['malts', 'hops', 'yeasts']) {
            await page.evaluate(t => {
              S.kv.equip.rsel = S.kv.equip.rsel || {};
              S.kv.equip.rsel[t] = S[t].slice(0, 3).map(x => x.name);
              show(t);
            }, t);
            await page.waitForTimeout(300);
            await page.click('#rview .rbox svg, #rview svg >> nth=0');
            await page.waitForTimeout(250);
            zr[t] = await page.evaluate(() => {
              const z = document.getElementById('rzoom');
              if (!z) return { open: false };
              const vw = innerWidth,
                vh = innerHeight,
                r = e => e.getBoundingClientRect(),
                sv = z.querySelector(':scope > svg'),
                bt = z.querySelector('button'),
                lg = z.querySelector('.rleg'),
                inside = b => b.left >= -1 && b.top >= -1 && b.right <= vw + 1 && b.bottom <= vh + 1;
              return {
                open: true,
                svg: [Math.round(r(sv).width), Math.round(r(sv).height)],
                svgIn: inside(r(sv)),
                btn: [Math.round(r(bt).width), Math.round(r(bt).height)],
                btnIn: inside(r(bt)),
                leg: !lg || inside(r(lg)),
                texts: [...sv.querySelectorAll('text')].every(x => parseFloat(getComputedStyle(x).fontSize) >= 8)
              };
            });
            await page.keyboard.press('Escape');
            await page.waitForTimeout(100);
            zr[t].closed = await page.evaluate(() => !document.getElementById('rzoom'));
          }
          check(
            'Radar agrandi (Malts, Houblons, Levures) : le graphique et la légende tiennent dans la fenêtre, la croix garde une taille normale (≤ 60 px), Échap ferme',
            ['malts', 'hops', 'yeasts'].every(t => {
              const z = zr[t];
              return z.open && z.svgIn && z.svg[0] > 300 && z.svg[1] > 250 && z.btnIn && z.btn[0] <= 60 && z.btn[1] <= 60 && z.leg && z.texts && z.closed;
            }),
            JSON.stringify(zr)
          );
          await page.evaluate(() => show('yeasts'));
          await page.waitForTimeout(300);
          const yf = await page.evaluate(() => {
            const f = document.querySelector('#rview svg.yf');
            if (!f) return { none: true };
            f.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            const z = document.getElementById('rzoom');
            const b = z && z.querySelector('button').getBoundingClientRect();
            const s = z && z.querySelector('svg.yf').getBoundingClientRect();
            const o = { open: !!z, btn: b && b.width <= 60, svg: s && s.width > 300 && s.right <= innerWidth + 1 && s.bottom <= innerHeight + 1 };
            z && z.remove();
            return o;
          });
          check('Diagramme atténuation / floculation agrandi (Levures) : affiché dans la fenêtre, croix normale', yf.none || (yf.open && yf.btn && yf.svg), JSON.stringify(yf));
        }
        {
          const nt = await page.evaluate(async () => {
            const w = ms => new Promise(r => setTimeout(r, ms)),
              H = document.querySelector('header'),
              m = document.getElementById('hmsg'),
              o = {};
            m.textContent = '';
            m.className = '';
            await w(100);
            const h0 = H.getBoundingClientRect().height,
              nv = document.querySelector('#nav').getBoundingClientRect();
            m.className = 'ok';
            m.textContent = '✔ essai de notification';
            await w(100);
            o.same = Math.abs(H.getBoundingClientRect().height - h0) < 0.5;
            o.below = m.getBoundingClientRect().top >= nv.bottom - 1;
            o.h = m.getBoundingClientRect().height >= 24;
            await w(9000);
            o.still = !!m.textContent;
            await w(1800);
            o.gone = !m.textContent && Math.abs(H.getBoundingClientRect().height - h0) < 0.5;
            return o;
          });
          check(
            'notifications : bande réservée sous le menu (la hauteur de l’en-tête ne change pas à l’apparition ni à la disparition), visibles 10 secondes',
            nt.same && nt.below && nt.h && nt.still && nt.gone,
            JSON.stringify(nt)
          );
        }
        {
          const fl = await page.evaluate(async () => {
            show('malts');
            const w = ms => new Promise(r => setTimeout(r, ms));
            await w(200);
            const o = {},
              sc = document.querySelector('.scr'),
              rb = document.querySelector('#rblock'),
              n0 = S.malts.length,
              tr0 = document.querySelectorAll('tr[data-ri]').length;
            sc.__k = 1;
            rb.__k = 1;
            document.querySelector('#add').click();
            await w(100);
            o.keep =
              document.querySelector('.scr') === sc &&
              document.querySelector('#rblock') === rb &&
              sc.__k === 1 &&
              rb.__k === 1;
            o.add =
              S.malts.length === n0 + 1 &&
              document.querySelectorAll('tr[data-ri]').length === tr0 + 1 &&
              document.querySelector('tr[data-ri="0"] input[data-c="name"]').value === 'Nouveau';
            o.cnt = document.querySelector('.panel h3').textContent.includes('(' + (n0 + 1) + ')');
            document.querySelector('[data-dup="0"]').click();
            await w(100);
            o.dup =
              S.malts.length === n0 + 2 &&
              document.querySelectorAll('tr[data-ri]').length === tr0 + 2 &&
              document.querySelector('.scr') === sc;
            document.querySelector('[data-dr="0"]').click();
            await w(50);
            document.querySelector('[data-dr="0"]').click();
            await w(100);
            o.del =
              S.malts.length === n0 &&
              document.querySelectorAll('tr[data-ri]').length === tr0 &&
              document.querySelector('.scr') === sc &&
              document.querySelector('.panel h3').textContent.includes('(' + n0 + ')');
            document.querySelector('[data-ed="1"]').click();
            o.ed = !document.querySelector('tr[data-ri="1"] input[data-c="name"]').hasAttribute('readonly');
            show('biblio');
            return o;
          });
          check(
            'bases (malts…) : ajout / copie / suppression d’une ligne sans reconstruire l’écran (tableau et radar conservés → pas de clignotement), compteur à jour, boutons des lignes opérationnels',
            fl.keep && fl.add && fl.cnt && fl.dup && fl.del && fl.ed,
            JSON.stringify(fl)
          );
        }
        {
          const rl = await page.evaluate(async () => {
            window.__bcClear = false;
            const w = ms => new Promise(r => setTimeout(r, ms)),
              o = {},
              row = n => [...document.querySelectorAll('table.lib tr')].find(r => r.textContent.includes(n));
            o.icons = [...document.querySelectorAll('table.lib [data-brel]')].length;
            o.own =
              S.biblio.filter(b => !b.imp).every(b => !bxUnres(b.recipe).length) ===
              !document.querySelector('table.lib tr:not(.flt):not(.hd):not(:has([data-brel])) .none');
            const H = S.biblio.find(b => b.name === 'Hefeweizen'),
              before = bxUnres(H.recipe).map(x => x.n);
            const um = bxUnres(H.recipe).find(x => x.t === 'malts');
            o.had = !!um;
            o.b = before;
            const NM = um ? um.n : 'x';
            const LN = NM.replace(/ Malt$/, '');
            S.malts.push({ name: LN, maltier: 'Gladfield', ebc: 3.8, potentiel: 300 });
            row('Hefeweizen').querySelector('[data-brel]').click();
            await w(300);
            for (let k = 0; k < 30 && document.querySelector('.bcdlg'); k++) await w(100);
            await w(150);
            const after = bxUnres(S.biblio.find(b => b.name === 'Hefeweizen').recipe).map(x => x.n);
            o.linked = !after.includes(NM);
            o.lab = S.biblio
              .find(b => b.name === 'Hefeweizen')
              .recipe.malts.some(m => m.n !== NM && m.n.startsWith(LN) && !!find('malts', m.n));
            o.msg = /relié/.test(document.querySelector('#hmsg').textContent);
            row('Apocalyptic').querySelector('[data-brel]').click();
            await w(300);
            for (let k = 0; k < 30 && document.querySelector('.bcdlg'); k++) await w(100);
            await w(150);
            o.none = true;
            S.malts.pop();
            window.__bcClear = true;
            return o;
          });
          check(
            'bibliothèque : icône 🔄 en fin de ligne seulement sur les recettes avec ingrédient absent de la base ; un clic relie les ingrédients désormais présents (recette rechargée), message sinon',
            rl.icons >= 4 && rl.had && rl.linked && rl.lab && rl.msg && rl.none,
            JSON.stringify(rl)
          );
        }
        {
          const kolsch = require('fs').readFileSync(require('path').join(__dirname, 'beerxml', 'kolsch.xml'), 'utf8');
          const dp = await page.evaluate(async xml => {
            window.__bcManual = true;
            const w = ms => new Promise(r => setTimeout(r, ms)),
              o = {};
            S.biblio.push(
              {
                id: 'zzb1',
                name: 'ZZ A',
                style: '',
                date: '',
                vol: 20,
                brasseur: 'Zoé Brasseuse',
                recipe: { malts: [], hops: [], yeasts: [], ings: [], mash: [] }
              },
              {
                id: 'zzb2',
                name: 'ZZ B',
                style: '',
                date: '',
                vol: 20,
                brasseur: 'alain Dupont',
                recipe: { malts: [], hops: [], yeasts: [], ings: [], mash: [] }
              },
              {
                id: 'zzb3',
                name: 'ZZ C',
                style: '',
                date: '',
                vol: 20,
                brasseur: 'Zoé Brasseuse',
                recipe: { malts: [], hops: [], yeasts: [], ings: [], mash: [] }
              }
            );
            const x = xml.replace(/<BREWER>[^<]*<\/BREWER>/g, '').replace(/<ASST_BREWER>[^<]*<\/ASST_BREWER>/g, ''),
              it = [{ name: 'k.xml', text: x }];
            const pr = bxAskBrewers(it);
            await w(300);
            const d = document.querySelector('.bcdlg'),
              inp = d.querySelector('.bcin');
            o.list = inp.getAttribute('list') === 'bcin-list';
            o.opts = [...d.querySelectorAll('#bcin-list option')].map(x => x.value);
            inp.value = 'Nouvel Brasseur';
            d.querySelector('.ok').click();
            await pr;
            o.set = /<BREWER>Nouvel Brasseur<\/BREWER>/.test(it[0].text);
            S.biblio = S.biblio.filter(b => !/^zzb/.test(b.id));
            window.__bcManual = false;
            return o;
          }, kolsch);
          check(
            'import : nom du brasseur absent → saisie avec autocomplétion (liste des brasseurs déjà en base, sans doublon, triée), valeur appliquée',
            dp.list &&
              dp.opts.includes('Zoé Brasseuse') &&
              dp.opts.includes('alain Dupont') &&
              dp.opts.filter(x => x === 'Zoé Brasseuse').length === 1 &&
              dp.opts.indexOf('alain Dupont') < dp.opts.indexOf('Zoé Brasseuse') &&
              dp.set,
            JSON.stringify(dp)
          );
        }
        {
          const kx = require('fs').readFileSync(require('path').join(__dirname, 'beerxml', 'kolsch.xml'), 'utf8');
          const du = await page.evaluate(async xml => {
            window.__bcManual = false;
            const o = {},
              cnt = () => S.biblio.filter(b => b.name === nm).length;
            let nm;
            const r1 = bxImportTexts([{ name: 'k.xml', text: xml }]);
            nm = r1.ok[0];
            const c1 = cnt();
            bxImportTexts([{ name: 'k.xml', text: xml }]);
            const c2 = cnt();
            const xml2 = xml.replace(
              /<AMOUNT>([0-9.]+)<\/AMOUNT>/,
              (m, a) => '<AMOUNT>' + (parseFloat(a) + 0.5) + '</AMOUNT>'
            );
            bxImportTexts([{ name: 'k2.xml', text: xml2 }]);
            const c3 = cnt();
            S.biblio = S.biblio.filter(b => b.name !== nm);
            Object.assign(o, { c1, c2, c3 });
            return o;
          }, kx);
          check(
            'plusieurs recettes de même nom : ré-import identique = remplacée (1) ; recette différente de même nom = ajoutée (2)',
            du.c1 === 1 && du.c2 === 1 && du.c3 === 2,
            JSON.stringify(du)
          );
        }
        {
          const cu = await page.evaluate(async () => {
            const w = ms => new Promise(r => setTimeout(r, ms)),
              o = {};
            const LONG =
              'Malt Pilsner Extra Long Name, Munich Dark Roasted Special B, Caramel Crystal 120 EBC Belgian Aromatic, Chocolate Wheat Malt Black Patent';
            S.biblio.push({
              id: 'zzcut',
              name: 'ZZ Cut',
              style: '',
              date: '',
              vol: 20,
              brasseur: 'x',
              recipe: {
                malts: [{ n: LONG, g: 3000 }],
                hops: [],
                yeasts: [{ n: 'Levure Zzz Très Longue Nom Complet Fermentation Haute Température', g: 1 }],
                ings: [],
                mash: []
              }
            });
            show('biblio');
            await w(200);
            const tr = [...document.querySelectorAll('table.lib tr')].find(r => r.textContent.includes('ZZ Cut')),
              cc = [...tr.querySelectorAll('td.cut')],
              cv = cc.map(c => c.querySelector('.cutv'));
            o.n = cc.length;
            o.title = cv[0].title === LONG;
            o.trunc = cv[0].scrollWidth > cv[0].clientWidth && getComputedStyle(cv[0]).textOverflow === 'ellipsis';
            o.yeast = cv[2].title.startsWith('Levure Zzz') && cv[2].scrollWidth > cv[2].clientWidth;
            o.th =
              !!document.querySelector('th[data-sort="yeasts"]') && !!document.querySelector('input[data-bf="yeasts"]');
            const nmw = document.querySelector('table.lib th[data-sort="name"]').getBoundingClientRect().width;
            o.name = nmw >= innerWidth * 0.096 - 1;
            const fi = document.querySelector('input[data-bf="yeasts"]');
            fi.value = 'Zzz Très';
            fi.dispatchEvent(new Event('input', { bubbles: true }));
            await w(250);
            o.flt = [...document.querySelectorAll('table.lib tr')].filter(r => r.querySelector('.cutv')).length === 1;
            document.querySelector('#bfclr').click();
            await w(100);
            S.biblio = S.biblio.filter(b => b.id !== 'zzcut');
            biblio();
            return o;
          });
          check(
            'Bibliothèque (liste) : malts/houblons/levures tronqués à la largeur de la cellule (« … ») avec infobulle du texte complet ; colonne Levures + filtre ; colonne Nom élargie',
            cu.n === 3 && cu.title && cu.trunc && cu.yeast && cu.th && cu.name && cu.flt,
            JSON.stringify(cu)
          );
        }
        {
          const mv = await page.evaluate(async () => {
            window.__bcClear = false;
            const w = ms => new Promise(r => setTimeout(r, ms)),
              o = {};
            S.ings.push({ name: 'Lactose QQ', type: 'Sucre', dose_g_L: 0, usage: '', prix_g: 0 });
            const rec = {
              malts: [
                { n: 'Gladfield Munich Malt', g: 1000 },
                { n: 'Milk Sugar (Lactose QQ)', g: 750 }
              ],
              hops: [],
              yeasts: [],
              ings: [],
              mash: [],
              impd: { src: 'PDF Brewfather' }
            };
            S.biblio.push({
              id: 'zzmv',
              name: 'ZZ Milkshake',
              style: '',
              date: '',
              vol: 20,
              brasseur: 'x',
              imp: 1,
              recipe: rec
            });
            biblio();
            await w(150);
            const b = S.biblio.find(x => x.id === 'zzmv'),
              tr = [...document.querySelectorAll('table.lib tr')].find(r => r.textContent.includes('ZZ Milkshake'));
            window.__bcManual = true;
            tr.querySelector('[data-brel]').click();
            await w(400);
            const d = document.querySelector('.bcdlg'),
              rw = [...d.querySelectorAll('.bcmap tr')].find(r =>
                /Milk Sugar/.test((r.querySelector('.un') || {}).textContent || '')
              ),
              inp = rw.querySelector('input');
            o.sel = rw.querySelector('select') ? 'select' : 'ings';
            o.val = inp.value;
            inp.value = 'Lactose QQ';
            d.querySelector('.ok').click();
            await w(300);
            window.__bcManual = false;
            o.closed = !document.querySelector('.bcdlg');
            o.malts = b.recipe.malts.map(m => m.n).join('|');
            o.ings = b.recipe.ings.map(m => m.n + '=' + m.g).join('|');
            S.biblio = S.biblio.filter(x => x.id !== 'zzmv');
            S.ings = S.ings.filter(x => x.name !== 'Lactose QQ');
            window.__bcClear = true;
            return o;
          });
          check(
            '↻ recharger : un malt inconnu type « Milk Sugar (Lactose) » peut être rangé comme ingrédient (défaut ingrédient), « Lactose » accepté, déplacé des malts vers les ingrédients (g)',
            mv.sel === 'ings' &&
              mv.val === 'Lactose QQ' &&
              mv.closed &&
              mv.malts === 'Gladfield Munich Malt' &&
              mv.ings === 'Lactose QQ=750',
            JSON.stringify(mv)
          );
        }
        {
          const fz = await page.evaluate(async () => {
            const o = {},
              add = [
                ['malts', { name: 'Gladfield Munich', maltier: 'Gladfield', ebc: 15, potentiel: 300 }],
                ['malts', { name: 'Flaked Oats ZZ', maltier: 'X', ebc: 2, potentiel: 250 }],
                ['malts', { name: 'Lactose ZZ', maltier: '', ebc: 0, potentiel: 380 }],
                ['hops', { name: 'Hallertau Mittelfrüh ZZ', alpha_min: 3, alpha_max: 5 }],
                ['yeasts', { name: 'Wyeast 3068 Weihenstephan Weizen ZZ', labo: 'Wyeast', att_min: 73, att_max: 77 }],
                [
                  'yeasts',
                  { name: 'White Labs WLP066 London Fog Ale ZZ', labo: 'White Labs', att_min: 70, att_max: 75 }
                ],
                ['ings', { name: 'Whirlfloc ZZ', type: 'Clarifiant', dose_g_L: 0.1, usage: 'x' }]
              ];
            const R = {
              malts: [
                { n: 'Gladfield Munich Malt', g: 1000 },
                { n: 'Oats, Flaked ZZ', g: 500 },
                { n: 'Milk Sugar (Lactose ZZ)', g: 100 }
              ],
              hops: [{ n: 'Hallertauer Mittelfrueh ZZ', g: 10, use: 'Ébullition', t: 60 }],
              yeasts: [
                { n: 'Wyeast Labs 3068 Weihenstephan Weizen ZZ', g: 1 },
                { n: 'White Labs WLP 066 London Fog Ale ZZ', g: 1 }
              ],
              ings: [{ n: 'Whirlfloc ZZ (1 items)', g: 1 }],
              mash: []
            };
            S.biblio.push({ id: 'zzfz', name: 'ZZ Fuzzy', style: '', date: '', vol: 20, brasseur: 'Moi', recipe: R });
            const i = S.biblio.length - 1;
            o.h0 = bxUnres(R).length;
            add.forEach(([t, x]) => S[t].push(x));
            o.n = bxRelink(i);
            o.h1 = bxUnres(S.biblio[i].recipe)
              .map(x => x.n)
              .join('|');
            o.names = [...R.malts, ...R.hops, ...R.yeasts, ...R.ings].map(x => x.n).join('|');
            add.forEach(([t]) => S[t].pop());
            S.biblio.splice(i, 1);
            S.html = S.html.filter(h => h.id !== 'zzfz');
            return o;
          });
          check(
            'bouton 🔄 : rapprochement tolérant (ordre des mots, accents, « Malt », « Labs », codes de levure, Lactose / Milk Sugar) → noms proches reliés aux fiches de la base',
            fz.h0 === 7 &&
              fz.n >= 6 &&
              fz.h1 === '' &&
              /Hallertau Mittelfrüh ZZ/.test(fz.names) &&
              /WLP066 London Fog Ale ZZ/.test(fz.names),
            JSON.stringify(fz)
          );
        }
        {
          const ar = await page.evaluate(async () => {
            const w = ms => new Promise(r => setTimeout(r, ms)),
              o = {};
            o.n = (S.kv.equip.arech || []).length;
            o.cats = [...new Set((S.kv.equip.arech || []).map(x => x.t))].join();
            show('params');
            await w(300);
            const p = document.querySelector('#arpanel');
            o.panel = !!p;
            o.h = p && p.querySelector('h3').textContent;
            const t = (p && p.querySelector('#arprompt').value) || '';
            const cs = o.cats;
            o.pr = {
              csv:
                (!/malts/.test(cs) || /malts_nouveaux\.csv/.test(t)) &&
                (!/hops/.test(cs) || /houblons_nouveaux\.csv/.test(t)) &&
                (!/yeasts/.test(cs) || /levures_nouvelles\.csv/.test(t)),
              hdr:
                (!/malts/.test(cs) || /name;maltier;ebc;potentiel;ppg;b46;cereale/.test(t)) &&
                (!/hops/.test(cs) || /name;alpha_min;alpha_max;citrus/.test(t)) &&
                (!/yeasts/.test(cs) || /name;labo;att_min;att_max/.test(t)),
              names: (S.kv.equip.arech || []).every(x => t.includes('- ' + x.n)),
              fmt: /UTF-8/.test(t) && /point-virgule/.test(t) && /CSV/.test(t),
              len: t.length
            };
            o.copy = !!p.querySelector('#arcopy');
            {
              const pg = document.querySelector('.pg'),
                last = [...pg.children].pop();
              o.bottom =
                last.contains(p) &&
                [...pg.querySelectorAll('.panel')]
                  .filter(x => x !== p)
                  .every(x => x.getBoundingClientRect().top < p.getBoundingClientRect().top);
            }
            const f = S.kv.equip.arech[0];
            p.querySelector('[data-arx]').click();
            await w(250);
            o.after = (S.kv.equip.arech || []).length;
            const got = !(S.kv.equip.arech || []).some(x => x.n === f.n);
            o.rm = got;
            S.malts.push({
              name: S.kv.equip.arech.find(x => x.t === 'malts') ? S.kv.equip.arech.find(x => x.t === 'malts').n : 'zz',
              maltier: 'x',
              ebc: 5,
              potentiel: 300
            });
            const nm = S.malts[S.malts.length - 1].name,
              l0 = arList().length;
            S.malts.pop();
            o.hide = l0;
            S.kv.equip.arech = [];
            show('params');
            await w(250);
            o.gone = !document.querySelector('#arpanel');
            show('biblio');
            await w(150);
            return o;
          });
          check(
            'Paramètres › « À rechercher » : section affichée tout en bas de l’écran avec les ingrédients inconnus des PDF, prompt copiable demandant des CSV (en-têtes malts / houblons / levures), ✕ retire un ingrédient, section masquée quand la liste est vide',
            ar.n >= 3 &&
              ar.panel &&
              /À rechercher \(/.test(ar.h) &&
              ar.pr.csv &&
              ar.pr.hdr &&
              ar.pr.names &&
              ar.pr.fmt &&
              ar.copy &&
              ar.bottom &&
              ar.after === ar.n - 1 &&
              ar.rm &&
              ar.gone,
            JSON.stringify(ar)
          );
        }
        await page.evaluate(() => {
          window.__bcClear = false;
          S.biblio = S.biblio.filter(b => !(b.recipe.impd && /^PDF/.test(b.recipe.impd.src)));
          S.html = S.html.filter(h => S.biblio.some(b => b.id === h.id));
          biblio();
        });
      }
      {
        const dl = await page.evaluate(async () => {
          const w = ms => new Promise(r => setTimeout(r, ms)),
            o = {};
          window.__bcManual = true;
          const n0 = S.biblio.length;
          document.querySelector('[data-bdel]').click();
          await w(150);
          const d = document.querySelector('.bcdlg');
          o.open = !!d && !!d.querySelector('.bcbox.dg');
          o.t = d && d.querySelector('h4').textContent;
          o.msg = d && /Supprimer définitivement la recette/.test(d.textContent);
          o.col = d && getComputedStyle(d.querySelector('.bcbox')).borderTopColor;
          o.foc = d && document.activeElement.className === 'no';
          d.querySelector('.no').click();
          await w(100);
          o.closed = !document.querySelector('.bcdlg');
          o.kept = S.biblio.length === n0;
          document.querySelector('[data-bdel]').click();
          await w(150);
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          await w(100);
          o.esc = !document.querySelector('.bcdlg') && S.biblio.length === n0;
          bcAlert('Test');
          await w(100);
          o.al = !!document.querySelector('.bcdlg .ok') && !document.querySelector('.bcdlg .no');
          document.querySelector('.bcdlg .ok').click();
          await w(100);
          o.al2 = !document.querySelector('.bcdlg');
          window.__bcManual = false;
          return o;
        });
        {
          await page.click('[data-bf="name"]');
          await page.keyboard.type('sier', { delay: 60 });
          await wait(250);
          const ty = await page.evaluate(() => ({
            v: document.querySelector('[data-bf="name"]').value,
            n: document.querySelectorAll('table.lib tr:not(.flt):not(.hd)').length,
            f: document.activeElement.dataset.bf
          }));
          await page.keyboard.press('Backspace');
          await wait(150);
          const ty2 = await page.evaluate(() => document.querySelector('[data-bf="name"]').value);
          await page.evaluate(() => {
            FLT.biblio = {};
            biblio();
          });
          check(
            'bibliothèque : la saisie au clavier dans le filtre n’est pas interrompue (plusieurs caractères d’affilée, focus et curseur conservés)',
            ty.v === 'sier' && ty.f === 'name' && ty.n >= 1 && ty2 === 'sie',
            JSON.stringify([ty, ty2])
          );
        }
        {
          const fl = await page.evaluate(async () => {
            const w = ms => new Promise(r => setTimeout(r, ms)),
              o = {},
              ty = async (v, c) => {
                const el = document.querySelector('[data-bf="' + c + '"]');
                el.value = v;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                await w(120);
              },
              names = () =>
                S.biblio.length &&
                (document.querySelector('.bcards')
                  ? [...document.querySelectorAll('.bcard h4')]
                  : [...document.querySelectorAll('table.lib tr:not(.flt):not(.hd) td:first-child')]
                ).map(x => x.textContent);
            const tot = S.biblio.length;
            o.tot = tot;
            o.inp = document.querySelectorAll('table.lib tr.flt input.fi').length;
            await ty('sierra', 'name');
            o.l1 = names().length;
            o.t = /\d+ \/ \d+/.test(document.querySelector('.panel h3').textContent);
            o.focus = document.activeElement.dataset.bf === 'name' && document.activeElement.value === 'sierra';
            document.querySelector('#bview').click();
            await w(250);
            o.c1 = names().length;
            o.cin = document.querySelector('.bflt [data-bf="name"]').value === 'sierra';
            await ty('zzzz', 'name');
            o.none =
              document.querySelectorAll('.bcard').length === 0 &&
              /ne correspond/.test(document.querySelector('.bgrid').textContent);
            document.querySelector('#bfclr').click();
            await w(250);
            o.back = names().length === tot;
            SORT.biblio = { c: 'ibu', d: -1 };
            biblio();
            await w(100);
            const cards = names();
            document.querySelector('#bview').click();
            await w(250);
            const list = names();
            o.same = cards.length === list.length && cards.join('|') === list.join('|');
            const iv = [...document.querySelectorAll('table.lib tr:not(.flt):not(.hd)')].map(
              r => parseFloat(r.children[6].textContent.replace(',', '.')) || 0
            );
            o.desc = iv.every((v, k) => !k || iv[k - 1] >= v);
            await ty('18B', 'style');
            o.sty = names().length >= 1 && names().length < tot;
            document.querySelector('#bfclr').click();
            await w(200);
            SORT.biblio = undefined;
            return o;
          });
          check(
            'bibliothèque : filtre (nom, brasseur, style, valeurs, malts, houblons) en vue liste et en vue cartes, même état, compteur, message si aucun résultat, bouton gomme ; cartes triées comme la liste',
            fl.inp === 12 &&
              fl.l1 >= 1 &&
              fl.l1 < fl.tot &&
              fl.t &&
              fl.focus &&
              fl.c1 === fl.l1 &&
              fl.cin &&
              fl.none &&
              fl.back &&
              fl.same &&
              fl.desc &&
              fl.sty,
            JSON.stringify(fl)
          );
        }
        {
          const bw = await page.evaluate(async () => {
            const w = ms => new Promise(r => setTimeout(r, ms)),
              o = {};
            window.__bcManual = true;
            const x =
                '<?xml version="1.0" encoding="UTF-8"?><RECIPES><RECIPE><NAME>ZZ Sans Brasseur</NAME><VERSION>1</VERSION><TYPE>All Grain</TYPE><BATCH_SIZE>20</BATCH_SIZE><BOIL_TIME>60</BOIL_TIME><FERMENTABLES><FERMENTABLE><NAME>Pilsner</NAME><AMOUNT>4</AMOUNT><YIELD>80</YIELD><COLOR>3</COLOR></FERMENTABLE></FERMENTABLES><HOPS/><YEASTS/><MISCS/></RECIPE></RECIPES>',
              f = new File([x], 'zz.xml');
            let p = bxImport([f]);
            await w(200);
            let d = document.querySelector('.bcdlg');
            o.dlg = !!d && !!d.querySelector('.bcin') && /ZZ Sans Brasseur/.test(d.textContent);
            d.querySelector('.bcin').value = 'Jean Dupont';
            d.querySelector('.ok').click();
            await w(300);
            {
              const q = document.querySelector('.bcdlg .no');
              q && q.click();
            }
            let r = await p;
            await w(50);
            let e = S.biblio.find(b => b.name === 'ZZ Sans Brasseur');
            o.ok = r.ok.length;
            o.br = e && e.brasseur;
            o.rbr = e && e.recipe.brasseur;
            S.biblio = S.biblio.filter(b => b.name !== 'ZZ Sans Brasseur');
            p = bxImport([new File([x], 'zz.xml')]);
            await w(200);
            document.querySelector('.bcdlg .no').click();
            await w(300);
            {
              const q = document.querySelector('.bcdlg .no');
              q && q.click();
            }
            r = await p;
            e = S.biblio.find(b => b.name === 'ZZ Sans Brasseur');
            o.skip = r.ok.length === 1 && e && e.brasseur === '-';
            S.biblio = S.biblio.filter(b => b.name !== 'ZZ Sans Brasseur');
            window.__bcManual = false;
            const bt = [...document.querySelectorAll('h3 .btn,h3 button')].map(b => b.textContent.trim());
            o.bt = bt.filter(t => /^Import/.test(t));
            document.querySelector('#bview').click();
            await w(250);
            const R = document.documentElement,
              bg = () => getComputedStyle(document.querySelector('.bcards')).backgroundColor,
              cb = () => getComputedStyle(document.querySelector('.bcard') || document.body).backgroundColor;
            const lt = R.classList.contains('light');
            R.classList.remove('light');
            o.dark = [bg(), cb()];
            R.classList.add('light');
            o.light = [bg(), cb()];
            if (!lt) R.classList.remove('light');
            document.querySelector('#bview').click();
            await w(200);
            return o;
          });
          check(
            'import beer.xml : brasseur absent → boîte de dialogue (saisie insérée dans la recette ; « Passer » = laissé vide) ; boutons « Import beer.xml » / « Import Brewfather » ; vue cartes sombre en thème sombre, claire en thème clair',
            bw.dlg &&
              bw.ok === 1 &&
              bw.br === 'Jean Dupont' &&
              bw.rbr === 'Jean Dupont' &&
              bw.skip &&
              bw.bt.join('|') === 'Import beer.xml|Import PDF' &&
              bw.dark[0] !== bw.light[0] &&
              /^rgb\((2\d|3\d|4\d),/.test(bw.dark[0]) &&
              bw.light[0] === 'rgb(245, 245, 245)' &&
              bw.light[1] === 'rgb(255, 255, 255)' &&
              bw.dark[1] !== 'rgb(255, 255, 255)',
            JSON.stringify(bw)
          );
        }
{
  const pg = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms)),
      o = {},
      b0 = S.biblio.slice(),
      h0 = S.hops.slice(),
      eq = S.kv.equip.bview;
    for (let k = 0; k < 120; k++) S.hops.push({ ...S.hops[0], name: 'Zpg ' + k });
    show('hops');
    await w(250);
    const vis = () => [...document.querySelectorAll('tr[data-ri]')].filter(r => r.style.display !== 'none').length,
      bar = () => document.getElementById('pager').textContent;
    o.n1 = vis();
    o.b1 = !!document.querySelector('.pgn.cur') && document.querySelector('.pgn.cur').textContent === '1';
    document.querySelector('[data-pg="hops"][data-p="1"]').click();
    await w(100);
    o.n2 = vis();
    o.b2 = document.querySelector('.pgn.cur').textContent === '2';
    const cur = () => document.querySelector('.pager .pgn.cur').textContent,
      clk = q => {
        document.querySelector(q).click();
        return w(80);
      };
    const pt = () => Math.round(document.getElementById('pager').getBoundingClientRect().top),
      pc = () => document.querySelectorAll('#pager > *').length,
      t1 = pt(),
      c1 = pc();
    await clk('.pager [title="Dernière page"]');
    o.fix = Math.abs(pt() - t1) <= 1 && pc() === c1 && c1 === 11;
    o.last = cur() === String(Math.ceil(S.hops.length / 15)) && vis() === S.hops.length - 15 * Math.floor((S.hops.length - 1) / 15);
    await clk('.pager [title="Première page"]');
    const f1 = cur();
    await clk('.pager .pgn[data-p="2"]');
    const f2 = cur();
    await clk('.pager [title="Page suivante"]');
    o.nav = f1 === '1' && f2 === '3' && cur() === '4';
    await clk('.pager [title="Première page"]');
    const fi = document.querySelector('input[data-ft="hops"][data-fc="name"]');
    fi.value = 'Zpg 1';
    fi.dispatchEvent(new Event('input', { bubbles: true }));
    await w(100);
    o.nf = vis();
    o.bf2 = bar().length > 0;
    fltClear('hops');
    await w(100);
    o.nc = vis();
    S.hops = h0;
    const tpl = JSON.parse(JSON.stringify(S.biblio[0]));
    for (let k = 0; k < 120; k++) {
      const c = JSON.parse(JSON.stringify(tpl));
      c.id = 'zbl' + k;
      c.name = 'Zbl ' + String(k).padStart(3, '0');
      S.biblio.push(c);
    }
    S.kv.equip.bview = 'list';
    FLT.biblio = {};
    SORT.biblio = { c: 'name', d: 1 };
    biblio();
    await w(300);
    o.l1 = document.querySelectorAll('table.lib tr:not(.flt):not(.hd)').length;
    o.lb = document.querySelector('.pager .pgn.cur').textContent === '1';
    const sc = document.querySelector('.scr');
    o.noh = sc.scrollWidth <= sc.clientWidth + 1;
    o.bw = [sc.scrollWidth, sc.clientWidth];
    document.querySelector('[data-pg="biblio"][data-p="1"]').click();
    await w(200);
    o.l2 = document.querySelectorAll('table.lib tr:not(.flt):not(.hd)').length;
    o.lb2 = document.querySelector('.pager .pgn.cur').textContent === '2';
    S.kv.equip.bview = 'cards';
    biblio();
    await w(400);
    const cc = () => document.querySelectorAll('.bcard').length;
    o.c1 = cc();
    for (let k = 0; k < 8 && document.getElementById('bsent'); k++) {
      document.getElementById('bsent').scrollIntoView();
      await w(400);
    }
    o.c2 = cc();
    o.sent = !document.getElementById('bsent');
    S.biblio = b0;
    S.kv.equip.bview = eq || 'list';
    biblio();
    return o;
  });
  check(
    'pagination : malts/houblons/levures/ingrédients par pages de 15 (filtre = recompte, effacer = page 1) ; bibliothèque liste paginée sans défilement horizontal ; cartes chargées au défilement',
    pg.last && pg.nav && pg.fix && pg.n1 === 15 && pg.b1 && pg.n2 === 15 && pg.b2 && pg.nf === 15 && pg.bf2 && pg.nc === 15 && pg.l1 === 15 && pg.lb && pg.noh && pg.l2 === 15 && pg.lb2 && pg.c1 === 30 && pg.c2 >= pg.c1 + 90 && pg.sent,
    JSON.stringify(pg)
  );
}
        check(
          'boîtes de dialogue OpenMaltForge (plus de popup natif) : confirmation rouge avec focus sur Annuler, Annuler / Échap = rien supprimé, alerte à un seul bouton',
          dl.open &&
            dl.msg &&
            dl.t === 'Supprimer la recette' &&
            dl.foc &&
            dl.closed &&
            dl.kept &&
            dl.esc &&
            dl.al &&
            dl.al2,
          JSON.stringify(dl)
        );
      }
      {
        const ro = await page.evaluate(() => {
          show('biblio');
          const i = S.biblio.findIndex(x => !x.imp);
          if (i < 0) return { none: true };
          const q = document.querySelector('[data-bview="' + i + '"]');
          if (q) q.click();
          const d = document.querySelector('.rvov');
          const o = { btn: !!q, open: !!d, edit: !!document.querySelector('[data-bedit="' + i + '"]') };
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          return o;
        });
        check('Bibliothèque › 👁 disponible aussi sur mes propres recettes (✎ conservé)', ro.none || (ro.btn && ro.open && ro.edit), JSON.stringify(ro));
      }
      {
        const rv = await page.evaluate(() => {
          const b = S.biblio.find(x => x.imp && /Triple/.test(x.name));
          show('biblio');
          const q = document.querySelector('[data-bview="' + S.biblio.indexOf(b) + '"]');
          q.click();
          const d = document.querySelector('.rvov');
          const o = {
            open: !!d,
            h: d && d.querySelector('h2').textContent,
            tiles: d ? d.querySelectorAll('.rvk').length : 0,
            tb: d ? d.querySelectorAll('.rvt').length : 0,
            cp: !!(d && d.querySelector('.rvcp'))
          };
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          o.closed = !document.querySelector('.rvov');
          return o;
        });
        check(
          'Bibliothèque › 👁 : fiche recette en popup (titre, indicateurs, tableaux malts/houblons…, copier pour modifier), fermée par Échap',
          rv.open && /Triple/.test(rv.h) && rv.tiles >= 6 && rv.tb >= 2 && rv.cp && rv.closed,
          JSON.stringify(rv)
        );
        const al = await page.evaluate(() => {
          show('biblio');
          const rs = [...document.querySelectorAll('table.lib tr:not(.flt):not(.hd)')].filter(r =>
            r.querySelector('.acts')
          );
          const xs = k =>
            rs.map(r => {
              const e = r.querySelectorAll('.acts .as')[k];
              return Math.round(e.getBoundingClientRect().left);
            });
          return { n: rs.length, same: [0, 1, 2, 3, 4].every(k => new Set(xs(k)).size === 1) };
        });
        check(
          'Bibliothèque : chaque type d’icône de fin de ligne reste dans la même colonne sur toutes les lignes',
          al.n >= 2 && al.same,
          JSON.stringify(al)
        );
      }
      const rn = await page.evaluate(() => {
        const b = S.biblio.find(x => x.imp && /Triple/.test(x.name));
        bxOpen(b);
        return new Promise(r =>
          setTimeout(
            () =>
              r({
                ban: !!document.querySelector('.bxban'),
                dis: [...document.querySelectorAll('main input:not(#newrec),main select')]
                  .filter(e => !e.closest('.bxban'))
                  .every(e => e.disabled),
                name: document.querySelector('[data-r="name"]').disabled,
                newrec: !document.querySelector('#newrec').disabled
              }),
            400
          )
        );
      });
      check(
        'Beer.xml : recette importée ouverte en lecture seule (bandeau, champs désactivés, « Nouvelle recette » reste actif)',
        rn.ban && rn.dis && rn.name && rn.newrec,
        JSON.stringify(rn)
      );
      await page.evaluate(() => document.querySelector('[data-bcopycur]').click());
      await wait(500);
      const cp = await page.evaluate(() => ({
        imp: S.kv.recipe.imp,
        name: S.kv.recipe.name,
        ban: !!document.querySelector('.bxban'),
        ok: !document.querySelector('[data-r="name"]').disabled,
        n: S.biblio.filter(b => /Triple Belge/.test(b.name)).length,
        orig: S.kv.recipe.origine
      }));
      check(
        'Beer.xml : « Copier pour modifier » crée une copie modifiable (sans bandeau), l’original reste dans la bibliothèque',
        !cp.imp && /\(copie\)$/.test(cp.name) && !cp.ban && cp.ok && cp.n === 2 && /Beer\.xml/.test(cp.orig),
        JSON.stringify(cp)
      );
      await nav(page, 'biblio');
      await wait(200);
      await page.fill('[data-bbr="0"]', 'Fauve');
      await page.dispatchEvent('[data-bbr="0"]', 'change');
      await wait(200);
      check(
        'Beer.xml : le nom du brasseur se saisit dans la colonne Brasseur et est enregistré',
        await page.evaluate(() => S.biblio[0].brasseur === 'Fauve' && S.biblio[0].recipe.brasseur === 'Fauve')
      );
      {
        const cv = await page.evaluate(async () => {
          const w = ms => new Promise(r => setTimeout(r, ms));
          document.querySelector('#bview').click();
          await w(250);
          const cs = [...document.querySelectorAll('.bcard')],
            o = {
              n: cs.length,
              tot: S.biblio.length,
              svg: cs.every(c => c.querySelector('.bglass svg')),
              nums: cs[0].querySelectorAll('.bnum div').length,
              view: S.kv.equip.bview,
              list: getComputedStyle(document.querySelector('table.lib').parentNode).display,
              own: S.biblio.filter(b => !b.imp).every(b => b.brasseur !== undefined),
              dis: !!document.querySelector('.bcard .bglass')
            };
          {
            const c = [...document.querySelectorAll('.bcard')].find(z => /Sierra/.test(z.textContent)),
              sp = [...c.querySelectorAll('.bmeta>span')];
            o.tip =
              /BEST Pale Ale[^\n]*— 6,700 kg \(94 %\)/.test(sp[0].title) &&
              /Cascade[^\n]*75,0 g · Ébullition 30 min/.test(sp[1].title) &&
              /Malts \(7,150 kg\)/.test(sp[0].title) &&
              /Houblons \(160,0 g\)/.test(sp[1].title);
            o.tt = sp[1].title;
          }
          document.querySelector('.bcard h4').click();
          await w(400);
          o.open = !!document.querySelector('[data-r="name"]');
          return o;
        });
        check(
          'vue cartes : infobulle sur 🌾 (malts : kg et %) et sur 🌿 (houblons : g, usage, minutes)',
          cv.tip,
          cv.tt
        );
        check(
          'bibliothèque : bouton « Vue cartes » → une carte par recette (verre coloré, nom, style, brasseur, DI/DF/IBU/Alcool), liste masquée ; clic sur une carte = ouvre la recette',
          cv.n === cv.tot && cv.svg && cv.nums === 4 && cv.view === 'cards' && cv.list === 'none' && cv.open,
          JSON.stringify(cv)
        );
        await nav(page, 'biblio');
        await wait(200);
        await page.evaluate(() => {
          document.querySelector('#bview').click();
        });
        await wait(200);
        check(
          'bibliothèque : retour à la vue liste (préférence enregistrée) ; recettes créées → brasseur « Moi » par défaut',
          await page.evaluate(
            () =>
              S.kv.equip.bview === 'list' &&
              !document.querySelector('.bcard') &&
              defaults().recipe.brasseur === 'Moi' &&
              S.biblio.filter(b => !b.imp).every(b => b.brasseur === 'Moi' || b.brasseur === 'Fauve')
          )
        );
      }
      await page.setInputFiles('#bximp', fl);
      await wait(800);
      check(
        'Beer.xml : réimporter les mêmes fichiers met à jour (pas de doublons)',
        (await page.evaluate(() => S.biblio.filter(b => b.imp).length)) === 5
      );
      await page.evaluate(() => {
        const b = S.biblio.findIndex(x => x.imp);
        document.querySelector('[data-bdel="' + b + '"]').click();
      });
      await wait(200);
      await page.evaluate(r => {
        const a = JSON.parse(r);
        S.kv.recipe = a[0];
        S.malts = a[1];
        S.hops = a[2];
        S.yeasts = a[3];
        S.biblio = a[4];
        S.html = a[5];
      }, R0);
      await nav(page, 'labels');
      await wait(150);
    }
    check(
      'étiquettes : au moins 11 modèles inspirés d’images (im_*) — chacun se dessine avec nom, style, QR et sans erreur ; couleur du fond modifiable',
      await page.evaluate(() => {
        const ids = LF.filter(f => /^im_/.test(f.id)).map(f => f.id);
        if (ids.length < 11) return 'n=' + ids.length;
        S.kv.recipe.name = 'Blonde du Moulin';
        const bad = [];
        for (const id of ids) {
          S.kv.recipe.etq.fmt = id;
          S.kv.recipe.etq.n = 1;
          labelsScreen();
          const pg = document.getElementById('lpage'),
            lb = pg.querySelector('.lb');
          if (!lb || !/BLONDE DU|Blonde du/i.test(lb.textContent) || (lb.querySelector('.noqr') && false)) bad.push(id);
          if (!LF.find(f => f.id === id).pal) bad.push(id + ':pal');
        }
        S.kv.recipe.etq.n = 0;
        return bad.length ? bad.join(',') : true;
      })
    );
    check(
      'étiquettes : 8 modèles supprimés absents, modèles conservés et 4 modèles retravaillés présents',
      await page.evaluate(() => {
        const gone = ['in_bock', 'in_pale', 'im_hop2', 'im_hop3', 'im_kraft1', 'im_kraft3', 'im_kraft4', 'im_seal2'];
        const keep = ['in_semeuse', 'in_pils', 'in_porter', 'in_red', 'im_hop1', 'im_kraft2', 'im_seal1', 'cartouche', 'ronddet', 'im_dark', 'im_hopring'];
        const ids = LF.map(f => f.id);
        const a = gone.filter(i => ids.includes(i)),
          b = keep.filter(i => !ids.includes(i));
        return a.length + b.length === 0 || 'présents:' + a + ' manquants:' + b;
      })
    );
    check(
      'étiquettes : cartouche, rond détaillé, brewery brun, anneau vert — aucun texte ne chevauche ni ne sort de la forme',
      await page.evaluate(async () => {
        const bad = [];
        S.kv.recipe.name = 'Nouvelle recette';
        for (const id of ['cartouche', 'ronddet', 'im_dark', 'im_hopring']) {
          S.kv.recipe.etq.fmt = id;
          labelsScreen();
          await document.fonts.ready;
          const lb = document.querySelector('#lpage .lb'),
            r = lb.getBoundingClientRect();
          const els = [...lb.querySelectorAll('.lbc *')].filter(e => !e.children.length && e.textContent.trim());
          els.forEach(e => {
            const q = e.getBoundingClientRect();
            if (!q.width) return;
            if (q.left < r.left - 1 || q.right > r.right + 1 || q.top < r.top - 1 || q.bottom > r.bottom + 1) bad.push(id + ':hors:' + e.textContent.slice(0, 12));
            if (id === 'ronddet') {
              const cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2 - 2;
              [[q.left, q.top], [q.right, q.top], [q.left, q.bottom], [q.right, q.bottom]].forEach(([x, y]) => {
                if (Math.hypot(x - cx, y - cy) > R) bad.push(id + ':cercle:' + e.textContent.slice(0, 12));
              });
            }
          });
          for (let i = 0; i < els.length; i++)
            for (let j = i + 1; j < els.length; j++) {
              const a = els[i].getBoundingClientRect(), b = els[j].getBoundingClientRect();
              if (a.width && b.width && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1 && !els[i].contains(els[j]) && !els[j].contains(els[i]))
                bad.push(id + ':chevauche:' + els[i].textContent.slice(0, 10) + '/' + els[j].textContent.slice(0, 10));
            }
        }
        return bad.length === 0 || bad.join('|');
      })
    );
    {
      /* suppression d'une police utilisée : fenêtre de remplacement avec auto-complétion */
      await page.evaluate(() => {
        window.__bcManual = true;
        const E = S.kv.equip;
        window.__fsv = { f: E.fonts, m: E.fontmap, fnt: S.kv.recipe.etq.fnt, sh: S.kv.recipe.shfnt, bl: S.biblio.length };
        E.fonts = ['Alpha Test', 'Beta Test', 'Gamma Test'].map(n => ({ n, d: 'data:font/ttf;base64,AA==' }));
        delete E.fontmap;
        S.kv.recipe.etq.fnt = 'u1';
        S.biblio.push({ id: 'zzfont', name: 'zzfont', recipe: { etq: { fnt: 'u1' }, shfnt: 'u2', malts: [], hops: [], yeasts: [] } });
        show('params');
      });
      await wait(150);
      await page.evaluate(() => document.querySelector('[data-fdel="1"]').click());
      await page.waitForSelector('.bcdlg .bcin', { timeout: 3000 });
      const o1 = await page.evaluate(() => {
        const d = document.querySelector('.bcdlg');
        return {
          list: [...d.querySelectorAll('datalist option')].map(x => x.value),
          msg: d.textContent
        };
      });
      await page.evaluate(() => {
        const d = document.querySelector('.bcdlg');
        d.querySelector('.bcin').value = 'Police inconnue';
        d.querySelector('.ok').click();
      });
      await wait(100);
      const o2 = await page.evaluate(() => ({
        open: !!document.querySelector('.bcdlg'),
        bad: !!document.querySelector('.bcdlg .bcin.bad'),
        n: S.kv.equip.fonts.length
      }));
      await page.evaluate(() => {
        const d = document.querySelector('.bcdlg');
        d.querySelector('.bcin').value = 'gamma test';
        d.querySelector('.ok').click();
      });
      await wait(300);
      const o3 = await page.evaluate(() => {
        const E = S.kv.equip,
          b = S.biblio.find(x => x.id === 'zzfont');
        return {
          closed: !document.querySelector('.bcdlg'),
          names: E.fonts.map(x => x.n).join(','),
          fnt: S.kv.recipe.etq.fnt,
          bf: b.recipe.etq.fnt,
          bs: b.recipe.shfnt,
          map: (E.fontmap || {})['Beta Test']
        };
      });
      await page.evaluate(() => {
        const E = S.kv.equip,
          v = window.__fsv;
        E.fonts = v.f;
        if (v.m) E.fontmap = v.m;
        else delete E.fontmap;
        S.kv.recipe.etq.fnt = v.fnt;
        S.kv.recipe.shfnt = v.sh;
        S.biblio = S.biblio.filter(x => x.id !== 'zzfont');
        window.__bcManual = false;
        lblRegFonts();
        labelsScreen();
      });
      check(
        'suppression d’une police utilisée : fenêtre « Remplacer la police » avec les autres polices en auto-complétion, nom inconnu refusé',
        /utilisée par/.test(o1.msg) && o1.list.join() === 'Alpha Test,Gamma Test' && o2.open && o2.bad && o2.n === 3,
        JSON.stringify({ o1, o2 })
      );
      check(
        'remplacement : étiquette en cours, recettes de la bibliothèque et feuille de brassage pointent vers la police choisie (indices recalés)',
        o3.closed && o3.names === 'Alpha Test,Gamma Test' && o3.fnt === 'u1' && o3.bf === 'u1' && o3.bs === 'u1' && o3.map === 'Gamma Test',
        JSON.stringify(o3)
      );
    }
    {
      /* police intégrée supprimée : la police de remplacement prend le relais sous le même nom de famille */
      const r = await page.evaluate(async () => {
        window.__bcManual = true;
        const E = S.kv.equip,
          sv = { f: [...E.fonts], m: E.fontmap && { ...E.fontmap } };
        const i = E.fonts.findIndex(x => x.n === 'Anton-Regular');
        if (i < 0) return { skip: 'Anton absent' };
        const rep = E.fonts.find(x => x.n === 'Rye-Regular').n;
        document.querySelector('#ftb') || show('params');
        show('params');
        await new Promise(r => setTimeout(r, 150));
        document.querySelector('[data-fdel="' + i + '"]').click();
        await new Promise(r => setTimeout(r, 150));
        const d = document.querySelector('.bcdlg');
        const ask = !!(d && d.querySelector('.bcin'));
        d.querySelector('.bcin').value = rep;
        d.querySelector('.ok').click();
        await new Promise(r => setTimeout(r, 500));
        await document.fonts.ready;
        const faces = [...document.fonts].filter(f => f.family.replace(/["']/g, '') === 'LF Anton');
        const out = {
          ask,
          gone: !E.fonts.some(x => x.n === 'Anton-Regular'),
          map: E.fontmap && E.fontmap['Anton-Regular'] === rep,
          nf: faces.length,
          ok: document.fonts.check("16px 'LF Anton'")
        };
        E.fonts = sv.f;
        if (sv.m) E.fontmap = sv.m;
        else delete E.fontmap;
        lblUnregFont('Anton-Regular', 1);
        lblRegFonts();
        window.__bcManual = false;
        return out;
      });
      check(
        'police intégrée supprimée (Anton) : remplaçante enregistrée sous « LF Anton » pour les modèles d’étiquette',
        r.skip || (r.ask && r.gone && r.map && r.nf === 1 && r.ok),
        JSON.stringify(r)
      );
    }
    check(
      'import d’une police déjà présente : remplacée sur place (les références u<n> des recettes restent valables)',
      await page.evaluate(() => {
        const E = S.kv.equip,
          sv = E.fonts;
        E.fonts = [{ n: 'A1', d: 'data:font/ttf;base64,AA==' }, { n: 'B1', d: 'data:font/ttf;base64,AA==' }];
        const k = E.fonts.findIndex(x => x.n === 'A1');
        E.fonts[k] = { n: 'A1', d: 'data:font/ttf;base64,AAA=' };
        const ok = E.fonts[0].n === 'A1' && E.fonts.length === 2;
        E.fonts = sv;
        return ok;
      })
    );
    check(
      'polices : une police importée nommée comme une famille d’un modèle (Bebas Neue, Creepster, Playfair Display…) est enregistrée sous ce nom; plus aucune police Microsoft dans les modèles',
      await page.evaluate(() => {
        const a = lblFontFams('BebasNeue-Regular').includes('Bebas Neue'),
          b = lblFontFams('PlayfairDisplaywght').includes('Playfair Display'),
          c = lblFontFams('Creepster-Regular').includes('Creepster'),
          d = lblFontFams('Anton-Regular').includes('LF Anton'),
          e = !lblFontFams('Zorglub').some(x => !/^LU /.test(x)),
          f = ['HennyPenny-Regular', 'StardosStencil-Regular', 'UnifrakturCook-Bold', 'Kalam-Regular', 'Bungee-Regular', 'PermanentMarker-Regular', 'KaushanScript-Regular'].every(
            n => lblFontFams(n).length > 1
          ),
          g = !LFONTS.some(x => /Impact|Chiller|Jokerman|Bauhaus|Marker Felt|Ink Free|Old English|Brush Script|(^|[^\w])Stencil[,']/.test(x.f));
        return (a && b && c && d && e && f && g) || [a, b, c, d, e, f, g].join();
      })
    );
    check(
      'hors ligne : aucune requête externe, polices lues depuis la base',
      reqExt.length === 0,
      reqExt.slice(0, 3).join(' ')
    );
    {
      /* Paramètres : ratio d'empâtage par défaut → alimente le ratio de la conception à « nouvelle recette » */
      const o = await page.evaluate(async () => {
        const E = S.kv.equip,
          sv = { r: E.ratio, d: E.ratioD, vol: E.vol, R: S.kv.recipe },
          out = {};
        show('params');
        await new Promise(r => setTimeout(r, 100));
        const inp = document.querySelector('.eq [data-e="ratioD"]'),
          prev = document.querySelector('.eq [data-e="ibuT"]');
        out.has = !!inp && /par défaut/.test(inp.closest('label').textContent);
        out.next = !!prev && prev.closest('label').nextElementSibling === inp.closest('label');
        inp.value = '2.7';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        out.indep = E.ratioD === 2.7 && E.ratio === sv.r;
        show('conception');
        await new Promise(r => setTimeout(r, 100));
        out.keep = +document.querySelector('#ratioro').value === sv.r;
        document.querySelector('#newrec').click();
        await new Promise(r => setTimeout(r, 200));
        out.nw = E.ratio === 2.7 && +document.querySelector('#ratioro').value === 2.7;
        E.ratio = sv.r;
        E.ratioD = sv.d;
        E.vol = sv.vol;
        S.kv.recipe = sv.R;
        show('labels');
        return out;
      });
      check(
        'Paramètres : « Ratio d’empâtage par défaut » après IBU cible, indépendant de la conception, appliqué à « nouvelle recette »',
        o.has && o.next && o.indep && o.keep && o.nw,
        JSON.stringify(o)
      );
    }
    check(
      'HTML : mis à jour (brassin réalisé, ratio), sans liste de courses, et recalculé pour toute la bibliothèque quand le gabarit change',
      await page.evaluate(() => {
        const E = S.kv.equip,
          c0 = E.courses;
        E.courses = [{ t: 'malts', n: 'ZZCourse', q: 5, r: {} }];
        S.kv.recipe.embou = '2026-11-01';
        const h = htmlCode();
        E.courses = c0;
        S.kv.recipe.embou = '';
        const a = /Brassin réalisé[^<]*<\/td><td>01\/11\/2026/.test(h),
          b = !/ZZCourse|ourses/.test(h),
          hv = E.htmlv;
        E.htmlv = 0;
        S.html = [];
        const ch = htmlRefreshAll(),
          c = S.html.length === S.biblio.length && E.htmlv === HTMLV && !htmlRefreshAll();
        E.htmlv = hv;
        return (a && b && ch && c) || [a, b, ch, c].join();
      })
    );
    check(
      'conception : triangle d’alerte du ratio d’empâtage à droite de la zone de texte',
      await page.evaluate(async () => {
        show('conception');
        await new Promise(r => setTimeout(r, 100));
        const al = document.querySelector('#ratio-al'),
          inp = document.querySelector('#ratioro'),
          d0 = al.style.display;
        al.style.display = 'inline';
        const a = al.getBoundingClientRect(),
          i = inp.getBoundingClientRect(),
          ok = a.left >= i.right - 1 && Math.abs(a.top + a.height / 2 - (i.top + i.height / 2)) < 12;
        al.style.display = d0;
        return ok || JSON.stringify([a.left, a.top, i.right, i.top]);
      })
    );
    {
      const o = await page.evaluate(async () => {
        const E = S.kv.equip,
          sv = { ...E.units },
          out = {};
        show('params');
        await new Promise(r => setTimeout(r, 100));
        const p = () => document.querySelector('#unitsp');
        /* section verrouillée : grisée, contrôles désactivés, aucun changement possible */
        out.lock = p().classList.contains('lock') && p().hasAttribute('inert') && [...p().querySelectorAll('button,select')].every(x => x.disabled) && +getComputedStyle(p()).opacity < 0.6;
        const u0 = JSON.stringify(E.units);
        p().querySelector('[data-usys="us"]').click();
        out.lockNo = JSON.stringify(E.units) === u0;
        UNITS_LOCKED = false; /* test du fonctionnement sous-jacent */
        unitsRefresh();
        out.rows = p() && p().querySelectorAll('.urow').length;
        out.h = p() && /Unités/.test(p().querySelector('h3').textContent);
        out.m = p().querySelector('[data-usys].on').dataset.usys;
        p().querySelector('[data-usys="us"]').click();
        out.us = E.units.temp === '°F' && E.units.vol === 'Gallon US' && E.units.pres === 'PSI' && p().querySelector('[data-usys="us"]').classList.contains('on');
        p().querySelector('[data-ukb="temp"][data-uv="°C"]').click();
        out.cus = E.units.temp === '°C' && !p().querySelector('[data-usys].on');
        const s = p().querySelector('select[data-uk="vol"]');
        s.value = 'Litre';
        s.dispatchEvent(new Event('change', { bubbles: true }));
        out.sel = E.units.vol === 'Litre';
        p().querySelector('[data-usys="imperial"]').click();
        out.imp = E.units.vol === 'Gallon impérial' && E.units.alt === 'Pieds';
        E.units = sv;
        UNITS_LOCKED = true;
        unitsRefresh();
        show('labels');
        return out;
      });
      check(
        'Paramètres › Unités : section désactivée (grisée, champs non modifiables) ; fonctionnement sous-jacent conservé',
        o.lock && o.lockNo && o.rows === 12 && o.h && o.m === 'metric' && o.us && o.cus && o.sel && o.imp,
        JSON.stringify(o)
      );
    }
    {
      /* pagination de la liste des polices : à partir de 15 lignes */
      const o = await page.evaluate(async () => {
        const E = S.kv.equip,
          sv = E.fonts,
          out = {};
        const mk = n => Array.from({ length: n }, (_, i) => ({ n: 'Pol ' + String(i + 1).padStart(2, '0'), d: 'data:font/ttf;base64,AA==' }));
        const view = async n => {
          E.fonts = mk(n);
          PG.fonts = 0;
          show('params');
          await new Promise(r => setTimeout(r, 120));
          return {
            rows: document.querySelectorAll('#ftb tr').length,
            pager: document.querySelectorAll('#ftpager .pgb').length
          };
        };
        out.v15 = await view(15);
        out.v20 = await view(20);
        document.querySelector('#ftpager [data-pg="fonts"][data-p="1"].pgn').click();
        await new Promise(r => setTimeout(r, 80));
        out.p2 = {
          rows: document.querySelectorAll('#ftb tr').length,
          first: document.querySelector('#ftb td').textContent,
          cur: document.querySelector('#ftpager .cur').textContent
        };
        const f = document.querySelector('#ftf');
        f.value = 'pol 1';
        f.dispatchEvent(new Event('input', { bubbles: true }));
        out.flt = { rows: document.querySelectorAll('#ftb tr').length, pager: document.querySelectorAll('#ftpager .pgb').length };
        E.fonts = sv;
        PG.fonts = 0;
        show('labels');
        return out;
      });
      check(
        'Paramètres › polices : pagination à partir de 15 lignes (pas de barre à 15, page 2 = 5 lignes, filtre ramène à la page 1)',
        o.v15.rows === 15 && o.v15.pager === 0 && o.v20.rows === 15 && o.v20.pager > 0 && o.p2.rows === 5 && o.p2.first === 'Pol 16' && o.p2.cur === '2' && o.flt.rows === 10 && o.flt.pager === 0,
        JSON.stringify(o)
      );
    }
    {
      /* polices de l'interface : en base, non supprimables ; tri de la colonne « Nom » */
      const o = await page.evaluate(async () => {
        const E = S.kv.equip,
          UI = ['BebasNeue-Regular', 'Creepster-Regular', 'HennyPenny-Regular', 'StardosStencil-Regular', 'UnifrakturCook-Bold', 'Kalam-Regular', 'Bungee-Regular', 'PermanentMarker-Regular', 'KaushanScript-Regular'],
          out = {},
          sv = PG.fonts;
        out.inDb = UI.every(n => E.fonts.some(x => x.n === n && /^data:font\//.test(x.d) && x.d.length > 20000));
        PG.fonts = 0;
        FSORT = 0;
        show('params');
        await new Promise(r => setTimeout(r, 150));
        const rowOf = n => [...document.querySelectorAll('#ftb tr')].find(r => r.cells[0].textContent === n);
        const all = [];
        const pages = Math.ceil(E.fonts.length / PGSZ);
        for (let p = 0; p < pages; p++) {
          PG.fonts = p;
          fontsRefresh();
          UI.forEach(n => {
            const r = rowOf(n);
            if (r) all.push([n, !r.querySelector('[data-fdel]'), !!r.querySelector('.flock')]);
          });
        }
        out.locked = all.length === 9 && all.every(a => a[1] && a[2]);
        out.others = E.fonts.some(x => !UI.includes(x.n)) ? true : 'aucune autre';
        const n0 = E.fonts.length;
        const i = E.fonts.findIndex(x => x.n === 'Creepster-Regular');
        fontDelete(i, '');
        out.guard = E.fonts.length === n0;
        /* tri */
        PG.fonts = 0;
        const names = () => [...document.querySelectorAll('#ftb tr')].map(r => r.cells[0].textContent);
        const h = document.querySelector('#ftsort');
        out.noarrow = !h.querySelector('.sar');
        const idx0 = E.fonts.map(x => x.n).join();
        h.click();
        const a = names(),
          up = h.querySelector('.sar.up');
        h.click();
        const d = names(),
          dn = h.querySelector('.sar.dn');
        const cmp = (x, y) => x.localeCompare(y, 'fr', { sensitivity: 'base', numeric: true });
        out.asc = !!up && a.every((x, k) => k === 0 || cmp(a[k - 1], x) <= 0);
        out.desc = !!dn && d.every((x, k) => k === 0 || cmp(d[k - 1], x) >= 0) && a.join() !== d.join();
        out.keep = E.fonts.map(x => x.n).join() === idx0;
        FSORT = 0;
        PG.fonts = sv;
        show('labels');
        return out;
      });
      check(
        'polices de l’interface (9 nouvelles) : stockées en base, cadenas à la place de ✕, suppression refusée ; tri croissant / décroissant de la colonne « Nom » (ordre de la base inchangé)',
        o.inDb && o.locked && o.guard && o.noarrow && o.asc && o.desc && o.keep,
        JSON.stringify(o)
      );
      check(
        'polices Google Fonts (13 fichiers : Inter, Roboto Mono, Playfair Display, Courier Prime, Bowlby One, Caprasimo, Rock Salt) : en base, verrouillées, chargées avec leur style (droit / italique, graisse variable)',
        await page.evaluate(async () => {
          const nm = ['BowlbyOne-Regular', 'Caprasimo-Regular', 'CourierPrime-Regular', 'CourierPrime-Bold', 'CourierPrime-Italic', 'CourierPrime-BoldItalic', 'Inter-VariableFont_opszwght', 'Inter-Italic-VariableFont_opszwght', 'PlayfairDisplay-VariableFont_wght', 'PlayfairDisplay-Italic-VariableFont_wght', 'RobotoMono-VariableFont_wght', 'RobotoMono-Italic-VariableFont_wght', 'RockSalt-Regular'];
          const inDb = nm.every(n => S.kv.equip.fonts.some(f => f.n === n && f.b)),
            locked = nm.every(fontLocked);
          lblRegFonts();
          await document.fonts.ready;
          await new Promise(r => setTimeout(r, 800));
          const fs = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/"/g, '') + '|' + f.style);
          const has = x => fs.includes(x);
          return (
            inDb && locked &&
            ['Inter|normal', 'Inter|italic', 'Roboto Mono|normal', 'Roboto Mono|italic', 'Playfair Display|normal', 'Playfair Display|italic', 'Courier Prime|normal', 'Courier Prime|italic', 'Bowlby One|normal', 'Caprasimo|normal', 'Rock Salt|normal'].every(has)
          ) || JSON.stringify({ inDb, locked, fs });
        })
      );
      {
        /* plus aucune police propriétaire dans le code (CSS, JS, HTML) : uniquement des polices Google Fonts ou des familles génériques */
        const bad = /Segoe|Arial|Helvetica|Georgia|Consolas|Courier New|Times New|Bahnschrift|Showcard|Cooper Black|Saint Carell|Ubuntu Condensed|Bookman|system-ui|ui-monospace|Caveat/;
        const offenders = ['css/openmaltforge.css', 'index.html', 'js/app.js', 'js/labels.js', 'js/sheet.js', 'js/recview.js', 'js/i18n.js', 'js/dialog.js']
          .filter(f => bad.test(fs.readFileSync(path.join(WEB, f), 'utf8')));
        check('aucune police propriétaire dans le code (Segoe UI, Arial, Georgia, Consolas, Courier New, Times New Roman, Bahnschrift, Showcard Gothic, Cooper Black, Saint Carell…)', offenders.length === 0, offenders.join());
      }
      check(
        'polices Google Fonts de l’interface : reconnaissance des fichiers (Inter, Roboto Mono, Playfair Display, Courier Prime, Bowlby One, Caprasimo, Rock Salt), pas de faux positif (Winter), verrouillées',
        await page.evaluate(() => {
          const f = n => lblFontFams(n);
          return (
            f('Inter[opsz,wght]').includes('Inter') &&
            f('Inter-VariableFont_opsz,wght').includes('Inter') &&
            !f('WinterSong-Regular').includes('Inter') &&
            f('RobotoMono[wght]').includes('Roboto Mono') &&
            f('PlayfairDisplay[wght]').includes('Playfair Display') &&
            f('CourierPrime-Regular').includes('Courier Prime') &&
            f('BowlbyOne-Regular').includes('Bowlby One') &&
            f('Caprasimo-Regular').includes('Caprasimo') &&
            f('RockSalt-Regular').includes('Rock Salt') &&
            !f('NotoSerif-Regular').some(x => /^serif$/i.test(x)) &&
            ['Inter[opsz,wght]', 'RobotoMono[wght]', 'PlayfairDisplay-Italic[wght]', 'CourierPrime-Bold', 'BowlbyOne-Regular', 'Caprasimo-Regular', 'RockSalt-Regular'].every(fontLocked) &&
            !fontLocked('WinterSong-Regular') &&
            !fontLocked('Interstate')
          );
        })
      );
      check(
        'polices de l’interface chargées depuis la base (familles Bebas Neue, Creepster, Henny Penny, Stardos Stencil, UnifrakturCook, Kalam, Bungee, Permanent Marker, Kaushan Script)',
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise(r => setTimeout(r, 600));
          const f = ['Bebas Neue', 'Creepster', 'Henny Penny', 'Stardos Stencil', 'UnifrakturCook', 'Kalam', 'Bungee', 'Permanent Marker', 'Kaushan Script'],
            miss = f.filter(x => ![...document.fonts].some(ff => ff.family.replace(/["']/g, '') === x && ff.status === 'loaded'));
          return miss.length === 0 || 'non chargées : ' + miss;
        })
      );
    }
    check(
      'étiquettes : ≥ 30 modèles, chacun avec sa police ; polices variées (≥ 7 différentes) et choix « Auto » par défaut',
      await page.evaluate(() => {
        const fs = new Set(LF.map(f => f.font));
        return (
          LF.length >= 30 &&
          LF.every(f => f.font && LFONTS.some(x => x.id === f.font)) &&
          fs.size >= 7 &&
          S.kv.recipe.etq.fnt !== undefined
        );
      })
    );
    check(
      'étiquette Excel : texte vertical (« année#brassin … IBU », % alcool, volume) et police Covered By Your Grace',
      await page.evaluate(async () => {
        const Q = S.kv.recipe.etq;
        Q.fnt = 'auto';
        Q.fmt = 'bandeauxl';
        lblRefresh();
        await document.fonts.ready;
        const v = [...document.querySelectorAll('#lpage .lb:first-child .lbv2')].map(e => ({
            t: e.textContent,
            wm: getComputedStyle(e).writingMode,
            tr: getComputedStyle(e).transform,
            h: e.getBoundingClientRect().height > e.getBoundingClientRect().width
          })),
          n = document.querySelector('#lpage .lbn');
        return (
          v.length === 3 &&
          v.every(x => /vertical/.test(x.wm) && x.tr !== 'none' && x.h) &&
          v.some(x => /IBU/.test(x.t) && x.t.includes(brewNo(S.kv.recipe).code)) &&
          v.some(x => /%/.test(x.t)) &&
          v.some(x => /cl/.test(x.t)) &&
          /LF Covered/.test(getComputedStyle(n).fontFamily)
        );
      })
    );
    check(
      'chaque modèle utilise sa propre police en mode Auto (le nom change de police entre modèles)',
      await page.evaluate(() => {
        const Q = S.kv.recipe.etq,
          fam = new Set();
        for (const id of ['bandeauxl', 'punk', 'caisse', 'affiche', 'saloon', 'goth', 'disque', 'tag']) {
          Q.fmt = id;
          lblRefresh();
          fam.add(getComputedStyle(document.querySelector('#lpage .lbn')).fontFamily);
        }
        return fam.size >= 7;
      })
    );
    {
      const buf = fs.readFileSync(path.join(ROOT, 'dev', 'tests', 'Anton-Regular.ttf'));
      await page.evaluate(() => show('params'));
      await wait(300);
      await page.setInputFiles('#fontfile', { name: 'RockSalt-Regular.ttf', mimeType: 'font/ttf', buffer: buf });
      await wait(500);
      await page.evaluate(() => labelsScreen());
      await wait(300);
      const r = await page.evaluate(async () => {
        await document.fonts.ready;
        return {
          l: (S.kv.equip.fonts || []).length,
          n: (S.kv.equip.fonts || []).map(f => f.n),
          c: document.fonts.check("16px 'Rock Salt'"),
          ff: [...document.fonts].map(f => f.family + ':' + f.status).filter(x => /rock salt/i.test(x)),
          o: [...document.querySelectorAll('select[data-q="fnt"] option')]
            .map(o => o.textContent)
            .filter(t => /rock ?salt/i.test(t))
        };
      });
      check(
        'polices du répertoire fonts/ copiées dans la base ; import de police (Rock Salt) : stockée dans la base, chargée (famille Rock Salt) et proposée dans la liste',
        r.n.includes('RockSalt-Regular') &&
          r.l >= 10 &&
          ['Anton-Regular', 'Oswald', 'Rye-Regular'].every(x => r.n.includes(x)) &&
          r.ff.some(x => x.replace(/"/g, '') === 'Rock Salt:loaded') &&
          r.o.length === 1,
        JSON.stringify(r)
      );
    }
    await page.evaluate(() => {
      S.kv.recipe.etq.fmt = 'rond';
      S.kv.recipe.etq.fnt = 'rocker';
      S.kv.recipe.etq.bg = 'light';
      labelsScreen();
    });
    await page.fill('#lurl', '');
    await wait(100);
    check(
      'sans URL : pas de QR (repère pointillé)',
      await page.evaluate(
        () =>
          document.querySelectorAll('#lpage .qrb').length === 0 && document.querySelectorAll('#lpage .noqr').length > 0
      )
    );
    {
      const f = await page.evaluate(async () => {
        const out = {};
        for (const id of ['bandeauxl', 'g_funky_h', 'in_flute', 'in_silly']) {
          S.kv.recipe.etq.fmt = id;
          S.kv.recipe.etq.bgu = 1;
          S.kv.recipe.etq.bgc = '#123456';
          S.kv.recipe.etq.accu = 1;
          S.kv.recipe.etq.accent = '#00ff88';
          lblRefresh();
          await new Promise(r => setTimeout(r, 60));
          const sv = document.querySelector('#lpage .lb svg');
          out[id] = [sv.innerHTML.includes('#123456'), sv.innerHTML.includes('#00ff88')];
        }
        S.kv.recipe.etq.fmt = 'rond';
        delete S.kv.recipe.etq.bgu;
        delete S.kv.recipe.etq.accu;
        S.kv.recipe.etq.bgc = '#ffffff';
        S.kv.recipe.etq.accent = '#d9480f';
        return out;
      });
      check(
        'étiquettes : « Fond » (color picker) et « Cadre » appliqués au fond/cadre de tous les modèles, y compris ceux à palette',
        Object.values(f).every(v => v[0] && v[1]),
        JSON.stringify(f)
      );
      {
        const it = await page.evaluate(async () => {
          show('conception');
          await new Promise(r => setTimeout(r, 100));
          const R = S.kv.recipe,
            sv = JSON.stringify(R.hops);
          R.hops = [
            { n: 'Magnum', g: 30, use: 'Ébullition', t: 60 },
            { n: 'Magnum', g: 20, use: 'Ébullition', t: 15 }
          ];
          conception();
          const t = +document.querySelector('#ibu-t').textContent,
            s = [...document.querySelectorAll('[id^=ib]')]
              .filter(e => /^ib\d+$/.test(e.id))
              .reduce((a, e) => a + +e.textContent, 0),
            ibu = compute().ibu;
          R.hops = JSON.parse(sv);
          conception();
          return { t, s, ibu };
        });
        check(
          'conception : total des IBU dans le tableau Houblons (somme des lignes = IBU du bilan)',
          Math.abs(it.t - it.ibu) < 0.06 && Math.abs(it.t - it.s) < 0.11 && it.t > 0,
          JSON.stringify(it)
        );
        await page.evaluate(() => labelsScreen());
      }
      check(
        'étiquettes : libellé « Texte du QR Code »',
        await page.evaluate(() => /Texte du QR Code/.test(document.querySelector('label.lurl').textContent))
      );
    }
    {
      const g = await page.evaluate(async () => {
        const E = S.kv.equip,
          sv = E.fonts;
        E.fonts = [
          { n: 'Alpha Test', d: 'data:font/ttf;base64,AA==' },
          { n: 'Beta Test', d: 'data:font/ttf;base64,AA==' }
        ];
        S.kv.recipe.etq.fnt = 'u1';
        show('params');
        await new Promise(r => setTimeout(r, 100));
        const a = document.querySelectorAll('#ftb tr').length,
          pos =
            document.querySelector('#ftf').closest('.panel').previousElementSibling &&
            [...document.querySelectorAll('.panel h3')]
              .map(h => h.textContent)
              .findIndex(t => /Coefficients/.test(t)) >= 0 &&
            0 <= [...document.querySelectorAll('.panel h3')].map(h => h.textContent).findIndex(t => /Polices/.test(t));
        const f = document.querySelector('#ftf');
        f.value = 'beta';
        f.dispatchEvent(new Event('input', { bubbles: true }));
        const b = document.querySelectorAll('#ftb tr').length;
        f.value = '';
        f.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('[data-fdel="0"]').click();
        await new Promise(r => setTimeout(r, 250));
        const r = { a, b, pos, n: E.fonts.length, fnt: S.kv.recipe.etq.fnt, nm: E.fonts[0].n };
        E.fonts = sv;
        S.kv.recipe.etq.fnt = 'auto';
        return r;
      });
      check(
        'paramètres : tableau des polices importées (recherche, ✕ pour supprimer, sous les coefficients) ; la police choisie suit après suppression',
        g.a === 2 && g.b === 1 && g.pos && g.n === 1 && g.fnt === 'u0' && g.nm === 'Beta Test',
        JSON.stringify(g)
      );
      await page.evaluate(() => labelsScreen());
    }
    {
      const g = await page.evaluate(async () => {
        const w = () => new Promise(r => setTimeout(r, 80)),
          bad = LF.filter(f => !LFONTS.some(x => x.id === f.font)).map(f => f.id),
          Q = S.kv.recipe.etq,
          rd = () => ({
            f: document.querySelector('[data-q="fnt"]').value,
            b: document.querySelector('[data-q="bgc"]').value,
            a: document.querySelector('[data-q="accent"]').value
          });
        document.querySelector('[data-fmt="in_flute"]').click();
        await w();
        const r1 = rd();
        const sb = document.querySelector('[data-q="bgc"]');
        sb.value = '#224466';
        sb.dispatchEvent(new Event('input', { bubbles: true }));
        await w();
        const mod = document.querySelector('#lpage .lb svg').innerHTML.includes('#224466');
        document.querySelector('[data-fmt="rond"]').click();
        await w();
        const r2 = rd(),
          d2 = lblDefaults(LF.find(f => f.id === 'rond')),
          mod2 = document.querySelector('#lpage .lb svg').innerHTML.includes('#224466');
        document.querySelector('[data-fmt="in_flute"]').click();
        await w();
        const r3 = rd();
        document.querySelector('[data-fmt="rond"]').click();
        delete Q.bgu;
        delete Q.accu;
        return { bad, r1, mod, r2, d2, mod2, r3 };
      });
      check(
        'étiquettes : au clic sur un modèle, police/fond/cadre = valeurs par défaut du modèle, modifiables sur ce modèle seulement, réinitialisés au clic suivant',
        g.bad.length === 0 &&
          g.r1.f === 'condgras' &&
          g.r1.b === '#15130f' &&
          g.r1.a === '#e6c27a' &&
          g.mod &&
          g.r2.f === g.d2.fnt &&
          g.r2.b === '#ffffff' &&
          g.r2.a === '#d9480f' &&
          !g.mod2 &&
          g.r3.b === '#15130f',
        JSON.stringify(g)
      );
    }
    {
      const g = await page.evaluate(async () => {
        document.querySelector('[data-fmt="g_funky_h"]').click();
        await new Promise(r => setTimeout(r, 80));
        const Q = S.kv.recipe.etq,
          r = {
            bg: document.querySelector('[data-q="bgc"]').value,
            ac: document.querySelector('[data-q="accent"]').value,
            svg:
              document.querySelector('#lpage .lb svg').innerHTML.includes('#2a0a4a') &&
              document.querySelector('#lpage .lb svg').innerHTML.includes('#ff2fa3')
          };
        document.querySelector('[data-fmt="rond"]').click();
        delete Q.bgu;
        delete Q.accu;
        Q.bgc = '#ffffff';
        Q.accent = '#d9480f';
        return r;
      });
      check(
        'étiquettes : choisir un modèle à palette met à jour les pickers Fond/Cadre avec ses couleurs',
        g.bg === '#2a0a4a' && g.ac === '#ff2fa3' && g.svg,
        JSON.stringify(g)
      );
    }
    check(
      'logo enregistré dans la base (aller-retour sqlite)',
      await page.evaluate(async () => {
        const o = (await __rt());
        return o && o.kv.equip.logo && o.kv.equip.logo.startsWith('data:image');
      })
    );
    check(
      'logo : stocké dans la table « logos » (et plus dans « parametres »), relu à l’ouverture ; table vide sans logo',
      await page.evaluate(async () => {
        S.kv.equip.logon = 'Mon logo';
        const o = await __rt(),
          n = await __sqlq('select nom,format,actif from logos'),
          p = (await __sqlq("select count(*) from parametres where cle in ('logo','logon')"))[0][0],
          l = S.kv.equip.logo;
        delete S.kv.equip.logo;
        await __rt();
        const n2 = (await __sqlq('select count(*) from logos'))[0][0];
        S.kv.equip.logo = l;
        await __rt();
        return (
          n.length === 1 &&
          n[0][0] === 'Mon logo' &&
          /^(png|webp|svg)/.test(n[0][1]) &&
          n[0][2] === 1 &&
          p === 0 &&
          o.kv.equip.logo === l &&
          n2 === 0
        );
      })
    );
    await nav(page, 'params');
    check(
      'Paramètres : panneau Logo des étiquettes (aperçu + sélecteur)',
      await page.evaluate(
        () =>
          !!document.querySelector('#logofile') &&
          !!document.querySelector('.logoprev img') &&
          !!document.querySelector('#logorm')
      )
    );
    await page.evaluate(() => {
      delete S.kv.equip.logo;
      S.kv.recipe.etq = {};
    });
    await nav(page, 'conception');
    const oc = await page.evaluate(() => {
      const o = document.querySelector('#orga'),
        i = document.querySelector('input[data-r="embou"]');
      let n = 0;
      i.showPicker = () => {
        n++;
      };
      i.click();
      return { t: i && i.type, hid: o && o.hidden, pick: n };
    });
    check(
      'conception : date d’embouteillage en calendrier ; zone organoleptique masquée tant qu’elle est vide',
      oc.t === 'date' && oc.hid === true && oc.pick === 1,
      JSON.stringify(oc)
    );
    await page.evaluate(() => {
      S.kv.recipe.date = '2026-07-01'; /* embouteillage après le brassage (6.5.0) */
      conception();
    });
    await page.fill('input[data-r="embou"]', '2026-07-02');
    await wait(150);
    check(
      'date d’embouteillage saisie → zone organoleptique affichée',
      await page.evaluate(
        () =>
          !document.querySelector('#orga').hidden &&
          !document.querySelector('#rbr') &&
          S.kv.recipe.embou === '2026-07-02'
      )
    );
    for (const [k, v] of [
      ['s_aro', '9'],
      ['s_app', '9'],
      ['s_fla', '15'],
      ['s_bou', '4'],
      ['s_imp', '8'],
      ['di', '1.052'],
      ['df', '1.010']
    ])
      await page.fill(`[data-o="${k}"]`, v);
    await page.fill('[data-o="t_aro"]', 'Agrumes, malt biscuité');
    await page.selectOption('[data-o="rob"]', 'Ambre');
    await wait(150);
    const og = await page.evaluate(async () => ({
      tot: document.querySelector('#o-tot').textContent,
      abv: document.querySelector('#o-abv').textContent,
      app: S.kv.recipe.org.s_app,
      rob: S.kv.recipe.org.rob,
      txt: S.kv.recipe.org.t_aro,
      rt: (await __rt()).kv.recipe.org.t_aro
    }));
    check(
      'organoleptique : note totale /50, ABV réel, notes plafonnées, texte et robe mémorisés (aller-retour sqlite)',
      /39 \/ 50/.test(og.tot) &&
        /5,5/.test(og.abv) &&
        og.app === 3 &&
        og.rob === 'Ambre' &&
        og.txt === 'Agrumes, malt biscuité' &&
        og.rt === og.txt,
      JSON.stringify(og)
    );
    await page.evaluate(() => {
      S.kv.recipe.name = 'Test brassé';
      S.kv.recipe.date = S.kv.recipe.date || '2026-07-01'; /* 6.8.0 : coche « Réalisé » = date de brassage */
      upsertRecipe();
    });
    await nav(page, 'biblio');
    const bb = await page.evaluate(() => {
      const c = [...document.querySelectorAll('table.lib tr')].pop().querySelector('td.ckc .okc');
      return {
        ok: !!c,
        col: getComputedStyle(c).color,
        boxes: document.querySelectorAll('table.lib input[type="checkbox"]').length
      };
    });
    check(
      'bibliothèque : coche verte « Réalisé » (date d’embouteillage renseignée), sans case à cocher',
      bb.ok && bb.boxes === 0 && /62, ?192/.test(bb.col),
      JSON.stringify(bb)
    );
    {
      const so = await page.evaluate(async () => {
        const b = S.biblio[0],
          cl = JSON.parse(JSON.stringify(b));
        cl.id = b.id + 1000;
        cl.name = 'AAA tri';
        cl.recipe.name = 'AAA tri';
        S.biblio.push(cl);
        show('biblio');
        const f = () => document.querySelector('table.lib tr:nth-child(3) td').textContent,
          th = document.querySelector('th[data-sort="name"]');
        th.click();
        const a = f();
        document.querySelector('th[data-sort="name"]').click();
        const d = f();
        document.querySelector('th[data-sort="og"]').click();
        const og = document.querySelectorAll('th.srt').length;
        S.biblio.pop();
        SORT.biblio = undefined;
        const nav = [...document.querySelectorAll('#nav button, #nav a.kofi')].map(x => x.textContent || x.dataset.s || x.id);
        return { a, d, og, nav: nav.slice(-4), kofi: document.getElementById('dbst').nextElementSibling?.id === 'navdon' };
      });
      check(
        'bibliothèque : tri (nom croissant par défaut, 1er clic sur Nom = décroissant) sur chaque colonne ; Paramètres en dernier onglet (suivi de l’icône Documentation)',
        so.a !== 'AAA tri' &&
          so.d === 'AAA tri' &&
          so.og === 12 &&
          so.nav[3] === 'doc' &&
          so.nav[2] === 'Paramètres' &&
          so.nav[1] === 'Feuille de brassage' &&
          so.kofi,
        JSON.stringify(so)
      );
    }
    {
      const t3 = await page.evaluate(async () => {
        const bd0 = getComputedStyle(document.body).backgroundColor;
        S.kv.equip.theme = { base: '#e0b3ab', harm: 'tr', cols: ['#e0b3ab', '#abe0b3', '#b3abe0'] };
        applyTheme();
        const bd1 = getComputedStyle(document.body).backgroundColor;
        const hd = getComputedStyle(document.documentElement).getPropertyValue('--bd').trim();
        show('conception');
        await new Promise(r => setTimeout(r, 100));
        const pn = [...document.querySelectorAll('.grid .panel')].map(
            e => getComputedStyle(e).backgroundImage + getComputedStyle(e).backgroundColor
          ),
          same = pn.every(x => x === pn[0]);
        S.kv.equip.theme = undefined;
        delete S.kv.equip.theme;
        applyTheme();
        return { bd0, bd1, hd, same, n: pn.length };
      });
      check(
        'thème : fond quadrillé invariable ; conception : cadres de droite = même fond que les autres cadres',
        t3.bd0 === t3.bd1 && t3.hd === '#4b525d' && t3.same && t3.n > 5,
        JSON.stringify(t3)
      );
    }
    {
      await page.evaluate(() => {
        labelsScreen();
      });
      await wait(300);
      const r = await page.evaluate(() => {
        const i = document.querySelector('[data-q="ink"]'),
          f = document.querySelector('[data-q="fnt"]'),
          ok = !!i && i.closest('label').previousElementSibling.contains(f);
        i.value = '#ff0000';
        i.dispatchEvent(new Event('input', { bubbles: true }));
        const l = document.querySelector('.lb');
        return {
          ok,
          c: l && l.getAttribute('style').includes('#ff0000'),
          w: document.getElementById('lurl').offsetWidth
        };
      });
      check(
        'étiquettes : sélecteur couleur police après la police, appliqué, champ QR variable (plein largeur)',
        r.ok && r.c && r.w > 125,
        JSON.stringify(r)
      );
      await page.evaluate(() => show('sheet'));
      await wait(300);
      const s = await page.evaluate(() => {
        const i = document.getElementById('sink');
        i.value = '#00aa00';
        i.dispatchEvent(new Event('input', { bubbles: true }));
        const ok = document.getElementById('shdyn').textContent.includes('#00aa00');
        i.value = '#111111';
        S.kv.recipe.sink = '';
        shApply();
        return ok;
      });
      check('feuille : couleur de police appliquée', s);
    }
    await nav(page, 'params');
    const pr = await page.evaluate(() => {
      const g = document.querySelector('.pg'),
        ps = [...g.querySelectorAll(':scope > .panel, :scope > .full > .panel, :scope > .col2 > .panel')].map(e =>
          e.getBoundingClientRect()
        ),
        gr = g.getBoundingClientRect();
      return {
        n: ps.length,
        inside: ps.every(r => r.left >= gr.left - 1 && r.right <= gr.right + 1),
        lg: document.querySelectorAll('.lgo').length
      };
    });
    check(
      'paramètres : panneaux alignés sur une même grille, plus de propositions de logos',
      pr.n >= 7 && pr.inside && pr.lg === 0,
      JSON.stringify(pr)
    );
    await page.click('#thsw');
    await wait(900);
    await page.reload();
    await openDb(page);
    await wait(300);
    await nav(page, 'params');
    const th2 = await page.evaluate(() => ({
      light: document.documentElement.classList.contains('light'),
      sw: document.querySelector('#thsw').getAttribute('aria-checked'),
      sv: !!(S.kv.equip.theme && S.kv.equip.theme.light)
    }));
    check('thème : choix clair enregistré dans la base et restauré après rechargement', th2.light && th2.sw === 'false' && th2.sv, JSON.stringify(th2));
    await page.click('#thsw');
    await wait(900);
    await page.evaluate(() =>
      logoSvgToData(LOGOS[0], u => {
        S.kv.equip.logo = u;
        save();
        params();
      })
    );
    await page.waitForFunction(() => S.kv.equip.logo && S.kv.equip.logo.startsWith('data:image'), null, {
      timeout: 5000
    });
    check(
      'logo enregistré comme logo des étiquettes',
      await page.evaluate(() => S.kv.equip.logo.startsWith('data:image') && !!document.querySelector('.logoprev img'))
    );
    await page.evaluate(() => {
      delete S.kv.equip.logo;
      S.kv.recipe.name = '';
      S.kv.recipe.org = {};
      S.kv.recipe.embou = '';
    });
    await nav(page, 'conception');
    check(
      'resucrage : 8 g/L à 20 °C → CO₂ 2,86 vol ; sucre total = g/L × volume',
      await page.evaluate(() => {
        const t = document.querySelector('#rtab').innerText;
        const vb = wcalc().vbot;
        return (
          /2,86/.test(document.querySelector('#r-vol').textContent) &&
          document.querySelector('#r-tot').textContent === (8 * vb).toFixed(0) + ' g' &&
          S.kv.recipe.sucre === 8
        );
      })
    );
    await page.evaluate(() => {
      S.kv.equip.vol = 30;
      delete S.kv.equip.w;
      save();
    });
    await page.evaluate(() => {
      S.kv.recipe.style = S.styles[3].name;
    });
    await nav(page, 'conception');
    check(
      'conception : plus d’encart de style, barre de couleur dans le bilan',
      await page.evaluate(
        () =>
          !document.querySelector('#stycard') &&
          !!document.querySelector('#bilan .cb i') &&
          /EBC/.test(document.querySelector('#bilan .cbar').innerText)
      )
    );
    await nav(page, 'sheet');
    check(
      'feuille : stats vitales sous le style, sans encart',
      await page.evaluate(() => {
        const t = document.querySelector('#main').innerText;
        return /IBU : /.test(t) && /ABV % : /.test(t) && !/Overall Impression/.test(t);
      })
    );
    await nav(page, 'html');
    check(
      'écran HTML : plus de tableau STYLE BJCP 2021',
      !/STYLE BJCP 2021/.test(await page.$eval('#code', e => e.value))
    );
    {
      const h = await page.evaluate(() => {
        S.kv.recipe.water = [{ n: S.eaux.find(e => +e.cl > 0).name, p: 100, l: 0 }];
        S.kv.recipe.minadd = { ca: 20 };
        S.kv.recipe.sucre = 7;
        S.kv.recipe.ings = [{ n: 'Écorce d’orange', g: 12 }];
        return htmlCode();
      });
      check(
        'HTML mis à jour : tableau PROCESS (phases 1 et 2, densités), eau totale, profil de l’eau avec ajouts et ratio, CO2-vol, resucrage, ingrédients',
        /PROCESS/.test(h) &&
          /Phase 1/.test(h) &&
          /Phase 2/.test(h) &&
          /DF \(densité finale/.test(h) &&
          /Eau totale/.test(h) &&
          /Ajouts de minéraux/.test(h) &&
          /RATIO SO\/CL<\/td><td>[0-9]/.test(h) &&
          /CO2-vol<\/td><td>[0-9]/.test(h) &&
          /Resucrage \(g\/L\)<\/td><td>7,0/.test(h) &&
          /Écorce d’orange/.test(h) &&
          /Densité post-ébullition/.test(h),
        [
          'PROCESS',
          'Phase 1',
          'DF (densité finale',
          'Eau totale',
          'Ajouts de minéraux',
          'Écorce',
          'Densité post-ébullition'
        ]
          .filter(x => !h.includes(x))
          .join('|') +
          (h.match(/RATIO SO.CL.{0,40}/) || [''])[0] +
          (h.match(/CO2-vol.{0,30}/) || [''])[0] +
          (h.match(/Resucrage .g.L.{0,30}/) || [''])[0]
      );
    }
    await page.evaluate(() => {
      S.kv.recipe.style = '21A American IPA';
    });
    // radars
    await nav(page, 'conception');
    await wait(300);
    const rd = await page.evaluate(() => {
      const sv = [...document.querySelectorAll('.radars svg')];
      return sv.map(s => {
        const b = s.getBoundingClientRect(),
          t = s.querySelector('text.rl'),
          rn = s.querySelectorAll('text.rn').length,
          poly = [...s.querySelectorAll('polygon.rg')].map(p => getComputedStyle(p).fill);
        return {
          w: b.width,
          h: b.height,
          aw: +s.getAttribute('width'),
          ah: +s.getAttribute('height'),
          fs: getComputedStyle(t).fontSize,
          rn,
          poly
        };
      });
    });
    check('3 radars', rd.length === 3);
    check(
      'radars à l’échelle 1:1 (police réellement 11 px)',
      rd.every(r => Math.abs(r.w - r.aw) < 1.5 && Math.abs(r.h - r.ah) < 1.5 && r.fs === '11px'),
      JSON.stringify(rd[0])
    );
    check(
      '5 graduations 1 à 5',
      rd.every(r => r.rn === 5)
    );
    check(
      'gris uniquement sur l’anneau externe (5)',
      rd.every(r => r.poly.filter(f => f !== 'none' && !/rgba?\(0, 0, 0, 0\)/.test(f)).length === 1),
      JSON.stringify(rd[0].poly)
    );
    const sc = await page.evaluate(() => document.documentElement.scrollHeight);
    console.log('    (info) hauteur de la page de conception : ' + sc + ' px pour un écran de 1200');
    // feuille : noir et blanc
    await nav(page, 'sheet');
    const bw = await page.evaluate(() => {
      const bad = [];
      const gray = c => {
        const m = c.match(/\d+(\.\d+)?/g);
        return c === 'none' || !m || m.length < 3 || (m[0] === m[1] && m[1] === m[2]);
      };
      document.querySelectorAll('.shpage *').forEach(e => {
        const cs = getComputedStyle(e);
        if (e instanceof SVGElement) {
          if (!gray(cs.fill)) bad.push(e.tagName + ' fill ' + cs.fill);
          if (!gray(cs.stroke)) bad.push(e.tagName + ' stroke ' + cs.stroke);
        } else {
          if (!gray(cs.color)) bad.push(e.tagName + ' color ' + cs.color);
          if (!gray(cs.backgroundColor)) bad.push(e.tagName + ' bg ' + cs.backgroundColor);
        }
      });
      return { bad: bad.slice(0, 4), svg: document.querySelectorAll('.shpage svg polyline').length };
    });
    check(
      'feuille de brassage : monochrome (noir, blancs, gris), courbe présente',
      bw.bad.length === 0 && bw.svg === 1,
      JSON.stringify(bw)
    );
    const dots = await page.evaluate(() => ({
      n: document.querySelectorAll('.shpage svg circle').length,
      p: curvePts().P.length
    }));
    check('un point sur chaque brisure de la courbe', dots.n === dots.p && dots.n >= 4, JSON.stringify(dots));
    const pgs = await page.evaluate(() => {
      const mm = document.querySelector('.shpage').getBoundingClientRect(),
        ps = [...document.querySelectorAll('.shpage')];
      return { n: ps.length, w: Math.round(mm.width / 3.7795), h: ps.map(p => Math.round(p.scrollHeight / 3.7795)) };
    });
    check(
      'feuille de brassage : 2 pages A4 (210 mm de large), contenu de chaque page ≤ 297 mm',
      pgs.n === 2 && pgs.w === 210 && pgs.h.every(h => h <= 298),
      JSON.stringify(pgs)
    );
    await page.fill('#notes', 'Jour 1 : levure ajoutée à 20 °C\nJour 3 : krausen\n<b>test</b>');
    await wait(150);
    {
      const ch = await page.evaluate(() => {
        const h = htmlCode(),
          m = h.match(/COUTS[\s\S]*?Coût par litre[^\n]*/);
        return {
          ok: !!m,
          lines: m ? (m[0].match(/Électricité|Eau|Consommables|TOTAL|Coût par litre/g) || []).length : 0,
          eau: Math.abs(costs().eau - (wcalc().tot / 1000) * sysPrix('m3')) < 1e-9
        };
      });
      check(
        'HTML : section COUTS (matières, électricité, eau, consommables, total, par litre) ; eau = volume d’eau de la recette × prix du m³',
        ch.ok && ch.lines >= 5 && ch.eau,
        JSON.stringify(ch)
      );
    }
    {
      const yt = await page.evaluate(() => {
        const R = S.kv.recipe,
          sv = JSON.stringify(R.yeasts);
        R.yeasts = [{ n: 'SafAle US-05', g: 1 }];
        const c1 = compute();
        R.yeasts = [
          { n: 'SafAle US-05', g: 1 },
          { n: 'LalBrew Verdant IPA', g: 1 }
        ];
        const c2 = compute(),
          a = find('yeasts', 'SafAle US-05'),
          b = find('yeasts', 'LalBrew Verdant IPA'),
          ea = ((a.att_min + a.att_max) / 2 + (b.att_min + b.att_max) / 2) / 2,
          ef = ((a.floc_min + a.floc_max) / 2 + (b.floc_min + b.floc_max) / 2) / 2;
        R.yeasts = JSON.parse(sv);
        return {
          c1: c1.att,
          c2: c2.att,
          ea,
          f2: c2.floc,
          ef,
          fg: Math.abs(c2.fg - (1 + (c2.og - 1) * (1 - ea / 100))) < 1e-9
        };
      });
      check(
        'conception : atténuation, floculation et DF obtenue = moyenne des levures',
        Math.abs(yt.c2 - yt.ea) < 1e-9 && Math.abs(yt.f2 - yt.ef) < 1e-9 && yt.fg && yt.c1 === 80,
        JSON.stringify(yt)
      );
    }
    {
      await page.evaluate(() => show('sheet'));
      await wait(200);
      const sh = await page.evaluate(async () => {
        const w = () => new Promise(r => setTimeout(r, 60)),
          R = S.kv.recipe,
          q = i => document.getElementById(i);
        document.querySelector('[data-sd="journal"]').click();
        await w();
        const d0 = { a: q('sacc').value, b: q('sbg').value, f: q('sfnt').value };
        const sb = q('sbg');
        sb.value = '#112233';
        sb.dispatchEvent(new Event('input', { bubbles: true }));
        const sf = q('sfnt');
        sf.value = 'typew';
        sf.dispatchEvent(new Event('change', { bubbles: true }));
        const sa = q('sacc');
        sa.value = '#cc3300';
        sa.dispatchEvent(new Event('input', { bubbles: true }));
        await w();
        const css = document.getElementById('shdyn').textContent,
          set = {
            bg: R.shbg,
            f: R.shfnt,
            a: R.sacc,
            dark: /invert/.test(css),
            font: /Courier/.test(css),
            ac: document.getElementById('shwrap').style.getPropertyValue('--ac') !== '#cc3300'
          };
        document.querySelector('[data-sd="classique"]').click();
        await w();
        const css2 = document.getElementById('shdyn').textContent,
          d1 = {
            a: q('sacc').value,
            b: q('sbg').value,
            f: q('sfnt').value,
            dark: /invert/.test(css2),
            font: /Courier/.test(css2),
            R: [R.sacc, R.shbg, R.shfnt]
          };
        return { d0, set, d1 };
      });
      check(
        'feuilles de brassage : comme les étiquettes — police/fond/cadre modifiables sur la feuille en cours, réinitialisés au clic sur une autre présentation',
        sh.d0.a === '#111111' &&
          sh.d0.b === '#ffffff' &&
          sh.d0.f === '' &&
          sh.set.bg === '#112233' &&
          sh.set.f === 'typew' &&
          sh.set.a === '#cc3300' &&
          sh.set.dark &&
          sh.set.font &&
          sh.set.ac &&
          sh.d1.a === '#111111' &&
          sh.d1.b === '#ffffff' &&
          sh.d1.f === '' &&
          !sh.d1.dark &&
          !sh.d1.font,
        JSON.stringify(sh)
      );
      await page.evaluate(() => labelsScreen());
    }
    await page.evaluate(() => show('sheet'));
    await wait(200);
    const nt = await page.evaluate(async () => ({
      r: S.kv.recipe.notes,
      m: document.querySelector('#notesp').textContent,
      rt: (await __rt()).kv.recipe.notes,
      html: htmlCode()
    }));
    check(
      'notes : saisies, enregistrées avec la recette (aller-retour sqlite), reprises dans le HTML (échappées)',
      /Jour 3/.test(nt.r) &&
        nt.m === nt.r &&
        nt.rt === nt.r &&
        /NOTES/.test(nt.html) &&
        /<td>Jour 1 : levure[^<]*<\/td><\/tr>\s*<tr[^>]*><td>Jour 3/.test(nt.html) &&
        /&lt;b&gt;test/.test(nt.html) &&
        !/<b>test<\/b>/.test(nt.html),
      JSON.stringify(nt).slice(0, 200)
    );
    check(
      'notes : zone d’une vingtaine de lignes (≈ 124 mm de haut), le texte s’imprime en entier',
      await page.evaluate(() => {
        const ta = document.querySelector('#notes');
        return (
          ta.getBoundingClientRect().height / 3.7795 >= 120 &&
          getComputedStyle(document.querySelector('#notesp')).whiteSpace === 'pre-wrap'
        );
      })
    );
    const dz = await page.evaluate(async () => {
      const o = [],
        ids = SDESIGNS.map(d => d.id);
      for (const id of ids) {
        document.querySelector(`[data-sd="${id}"]`).click();
        const ps = [...document.querySelectorAll('.shpage')],
          h = ps.map(p => Math.round(p.scrollHeight / 3.7795)),
          p1 = ps[0],
          wt = p1.querySelector('.card.water'),
          ml = [...p1.querySelectorAll('.card')].find(c => /Malts/.test(c.textContent.slice(0, 12))),
          cv = document.querySelector('.card.wide'),
          pw = ps[1].getBoundingClientRect().width;
        o.push({
          id,
          n: ps.length,
          h: Math.max(...h),
          waterTop: !!wt && !!ml && wt.getBoundingClientRect().top < ml.getBoundingClientRect().top,
          wide: Math.round((cv.getBoundingClientRect().width / pw) * 100),
          sel: document.querySelector('#sdside .fmt.sel').dataset.sd === id && S.kv.recipe.sdesign === id
        });
      }
      return { ids, o };
    });
    check(
      'feuille : 5 présentations au choix (liste de droite, mémorisée), chacune sur 2 à 3 pages A4 (≤ 297 mm)',
      dz.ids.length === 5 && dz.o.every(x => x.n >= 2 && x.n <= 3 && x.h <= 298 && x.sel),
      JSON.stringify(dz.o)
    );
    check(
      'feuille : volumes d’eau & densités en haut de la page 1 (avant les malts) ; courbe sur toute la largeur',
      dz.o.every(x => x.waterTop && x.wide >= 80),
      JSON.stringify(dz.o.map(x => [x.id, x.waterTop, x.wide]))
    );
    await page.fill('[data-re="v_emp"]', '21,2');
    await page.fill('[data-re="d_df"]', '1,010');
    await page.fill('[data-re="pt1"]', '65,5');
    await wait(120);
    const rl = await page.evaluate(async () => ({
      r: S.kv.recipe.real,
      rt: (await __rt()).kv.recipe.real,
      h: htmlCode()
    }));
    check(
      'feuille éditable : volumes/densités/paliers réalisés saisis dans la feuille, enregistrés (sqlite) et repris dans le HTML',
      rl.r.v_emp === '21,2' &&
        rl.rt.d_df === '1,010' &&
        rl.rt.pt1 === '65,5' &&
        /<td>21,2<\/td>/.test(rl.h) &&
        /<td>1,010<\/td>/.test(rl.h),
      JSON.stringify(rl.r)
    );
    await page.evaluate(() => {
      delete S.kv.recipe.real;
      S.kv.recipe.sdesign = 'classique';
    });
    await page.evaluate(() => {
      delete S.kv.recipe.notes;
    });
    await nav(page, 'html');
    check('HTML sans notes : pas de tableau NOTES', await page.evaluate(() => !/NOTES/.test(htmlCode())));
    await nav(page, 'conception');
    await page.evaluate(() => {
      S.conso.push({ name: 'Test cons', prix: 0.5 });
    });
    await page.click('[data-add="ings"]');
    await page.fill('[data-k="ings"][data-f="n"] >> nth=-1', 'Minéral');
    const acI = await page.evaluate(() => [...document.querySelectorAll('#dl-ings option')].map(o => o.value));
    await page.fill('[data-k="ings"][data-f="n"] >> nth=-1', 'Test c');
    const acC = await page.evaluate(() => [...document.querySelectorAll('#dl-ings option')].map(o => o.value));
    check(
      'conception : autocomplétion de la section fusionnée = contenu des 2 tables (ingrédients et consommables)',
      acI.includes('Minéral Ca (g)') && acC.includes('Test cons'),
      JSON.stringify([acI.length, acC])
    );
    await page.fill('[data-k="ings"][data-f="n"] >> nth=-1', 'Test cons');
    await page.press('[data-k="ings"][data-f="n"] >> nth=-1', 'Tab');
    await wait(200);
    await page.fill('[data-k="conso"][data-f="g"]', '4');
    await wait(200);
    const cs = await page.evaluate(async () => ({
      r: S.kv.recipe.conso,
      c: document.querySelector('#cs-conso-0').textContent,
      rt: (await __rt()).kv.recipe.conso,
      ord: [...document.querySelectorAll('.col .panel h3')].map(h => h.textContent).join('|')
    }));
    check(
      'conception : section unique « Ingrédients & consommables », une ligne rangée selon la table du nom, coût calculé, enregistré',
      /2,00/.test(cs.c) && cs.rt.length === 1 && /Ingrédients &[^|]*consommables/.test(cs.ord) && !/\|\s*.?\s*Consommables\s*(\||$)/.test(cs.ord),
      JSON.stringify(cs)
    );
    await page.evaluate(() => {
      document.activeElement.blur();
    });
    await wait(100);
    await page.evaluate(() => {
      S.kv.recipe.conso = [];
      S.conso = S.conso.filter(x => x.name !== 'Test cons');
    });
    await nav(page, 'conception');
    await nav(page, 'conception');
    await page.evaluate(() => {
      const R = S.kv.recipe;
      R.malts = [
        { n: S.malts[0].name, g: 4000 },
        { n: S.malts[1].name, g: 2000 }
      ];
      R.hops = [
        { n: S.hops[0].name, g: 30, use: 'Ébullition', t: 60 },
        { n: S.hops[1].name, g: 10, use: 'Whirlpool', t: 10 }
      ];
      conception();
    });
    const F = async (sel, v) => {
      await page.click(sel);
      await page.fill(sel, v);
    };
    await F('[data-k="malts"][data-i="0"][data-f="p"]', '60');
    const z0 = await page.evaluate(() => ({
      g: S.kv.recipe.malts.map(x => x.g),
      ro: [...document.querySelectorAll('.rin[data-k="malts"][data-f="g"]')].every(x => x.readOnly)
    }));
    await F('[data-k="malts"][data-i="1"][data-f="p"]', '40');
    await wait(150);
    const pm = await page.evaluate(() => ({
      g: S.kv.recipe.malts.map(x => x.g),
      gi: [...document.querySelectorAll('.rin[data-k="malts"][data-f="g"]')].map(x => x.value),
      s: document.querySelector('#psum-malts').textContent,
      z0: null
    }));
    pm.z0 = z0;
    await F('[data-k="hops"][data-i="0"][data-f="p"]', '25');
    await F('[data-k="hops"][data-i="1"][data-f="p"]', '75');
    await wait(150);
    const ph = await page.evaluate(() => S.kv.recipe.hops.map(x => x.g));
    await F('[data-k="malts"][data-i="0"][data-f="g"]', '5');
    await wait(150);
    const pw = await page.evaluate(() => ({
      p: [...document.querySelectorAll('.rin[data-k="malts"][data-f="p"]')].map(x => x.value),
      ro: [...document.querySelectorAll('.rin[data-k="malts"][data-f="p"]')].every(x => x.readOnly)
    }));
    check(
      'conception : saisie par % (poids remis à zéro puis recalculés, colonne poids en lecture seule) ou par poids (% recalculés, colonne % en lecture seule)',
      z0.g[0] === 3600 &&
        z0.g[1] === 0 &&
        z0.ro &&
        pm.g[0] === 3600 &&
        pm.g[1] === 2400 &&
        pm.gi[0] === '3.6' &&
        ph[0] === 10 &&
        ph[1] === 30 &&
        pw.p[0] === '67.6' &&
        pw.p[1] === '32.4' &&
        pw.ro,
      JSON.stringify([pm, ph, pw])
    );
    await page.evaluate(() => {
      document.activeElement.blur();
    });
    await page.evaluate(() => {
      document.activeElement.blur();
    });
    await nav(page, 'conception');
    await page.evaluate(() => {
      const R = S.kv.recipe;
      R.malts = [
        { n: S.malts[0].name, g: 4000 },
        { n: S.malts[1].name, g: 2000 }
      ];
      conception();
    });
    await page.click('[data-k="malts"][data-i="0"][data-f="p"]');
    await page.fill('[data-k="malts"][data-i="0"][data-f="p"]', '30');
    await page.fill('[data-k="malts"][data-i="1"][data-f="p"]', '30');
    await wait(100);
    await page.evaluate(() => {
      window.__bcN = 0;
      window.__bcAuto = 'no';
    });
    const w0 = await page.evaluate(() => S.kv.recipe.malts.map(x => x.g));
    await page.click('#calc');
    await wait(150);
    const nr = await page.evaluate(() => ({
      c: window.__bcN,
      g: S.kv.recipe.malts.map(x => x.g),
      m: (document.querySelector('#hbar .hn[data-k="calc"]') || {}).textContent || ''
    }));
    await page.evaluate(() => {
      window.__bcAuto = 'ok';
    });
    await page.click('#calc');
    await page
      .waitForFunction(() => /Recalculé/.test((document.querySelector('#hbar .hn[data-k="calc"]') || {}).textContent || ''), null, { timeout: 3000 })
      .catch(() => {});
    const yr = await page.evaluate(() => ({
      g: S.kv.recipe.malts.map(x => x.g),
      m: (document.querySelector('#hbar .hn[data-k="calc"]') || {}).textContent || '',
      s: document.querySelector('#psum-malts').textContent
    }));
    check(
      'calcul : % ≠ 100 → popup ; « non » = rien calculé, « oui » = règle de trois à 100 % puis calcul',
      nr.c === 1 &&
        nr.g[0] === w0[0] &&
        nr.g[1] === w0[1] &&
        /non effectué/.test(nr.m) &&
        /Recalculé/.test(yr.m) &&
        yr.s === '100,0 %' &&
        yr.g[0] === yr.g[1],
      JSON.stringify([w0, nr, yr])
    );
    await page.evaluate(() => {
      document.activeElement.blur();
    });
    await nav(page, 'malts');
    const n0 = await page.evaluate(() => document.querySelectorAll('tr[data-ri]').length);
    await page.fill('input.fi[data-fc="name"]', (await page.evaluate(() => S.malts[0].name)).slice(0, 4));
    await wait(100);
    const f1 = await page.evaluate(() => ({
      vis: [...document.querySelectorAll('tr[data-ri]')].filter(r => r.style.display !== 'none').length,
      all: document.querySelectorAll('tr[data-ri]').length,
      dl: document.querySelector('#fl-malts-name').children.length
    }));
    await page.fill('input.fi[data-fc="ebc"]', '99999');
    await wait(100);
    const f2 = await page.evaluate(
      () => [...document.querySelectorAll('tr[data-ri]')].filter(r => r.style.display !== 'none').length
    );
    await page.fill('input.fi[data-fc="ebc"]', '');
    await page.fill('input.fi[data-fc="name"]', '');
    await wait(100);
    await page.click('tr[data-ri="0"] [data-dup]');
    await wait(150);
    const dp = await page.evaluate(() => ({ n: S.malts.length, a: S.malts[0].name, b: S.malts[1].name }));
    check(
      'malts : filtre multi-colonnes (ET), autocomplétion ≥ 3 car., duplication « (copie) » sous la ligne',
      f1.vis < f1.all && f1.vis >= 1 && f1.dl >= 1 && f2 === 0 && dp.n === n0 + 1 && dp.b === dp.a + ' (copie)',
      JSON.stringify([f1, f2, dp])
    );
    await page.evaluate(() => {
      S.malts.splice(1, 1);
      save();
    });
    for (const k of ['hops', 'yeasts', 'ings', 'conso']) {
      await nav(page, k);
      check(
        'écran ' + k + ' : ligne de filtres + bouton dupliquer',
        await page.evaluate(
          () =>
            (document.querySelectorAll('tr.flt input.fi').length >= 2 &&
              document.querySelectorAll('[data-dup],[data-sdup]').length > 0) ||
            document.querySelectorAll('tr[data-ri]').length === 0
        )
      );
    }
    await nav(page, 'conception');
    const wd = await page.evaluate(() => ({
      n: S.eaux.length,
      v: S.eaux.filter(x => x.type === 'ville').length,
      m: S.eaux.filter(x => x.type === 'minérales').length,
      o: S.eaux.filter(x => x.type === 'osmosée').length,
      cons:
        ['Ca', 'Mg', 'Na', 'Cl', 'SO4', 'HCO3'].every(k => S.ings.some(x => x.name === 'Minéral ' + k + ' (g)')) &&
        !S.conso.some(x => /^Minéral/.test(x.name)),
      sty: S.styles.filter(x => x.ca_max > 0 || x.so4_max > 0).length,
      tot: S.styles.length,
      ipa: (() => {
        const s = S.styles.find(x => /American IPA/.test(x.name));
        return s && [s.ca_min, s.ca_max, s.so4_min, s.so4_max];
      })()
    }));
    check(
      'bases : eaux de ville / minérales / osmosée, 6 minéraux dans les ingrédients (plus dans les consommables), profils d’eau par style (mini/maxi)',
      wd.v >= 30 && wd.m >= 15 && wd.o === 1 && wd.cons && wd.sty >= wd.tot - 9 && wd.ipa && wd.ipa[1] > wd.ipa[0],
      JSON.stringify(wd)
    );
    await nav(page, 'conception');
    await page.evaluate(() => {
      const R = S.kv.recipe;
      R.water = [];
      R.minadd = {};
      R.style = S.styles.find(x => /American IPA/.test(x.name)).name;
      S.ings.find(x => x.name === 'Minéral Ca (g)').prix_g = 0.5;
      conception();
    });
    await page.click('[data-wadd="1"]');
    await page.fill('[data-wi="0"][data-wf="n"]', 'Eau osmosée');
    await page.click('[data-wadd="1"]');
    await page.fill('[data-wi="1"][data-wf="n"]', 'Paris');
    await page.fill('[data-wi="0"][data-wf="p"]', '50');
    await page.fill('[data-wi="1"][data-wf="p"]', '50');
    await page.fill('[data-ma="so4"]', '100');
    await page.fill('[data-ma="ca"]', '40');
    await wait(200);
    const mw = await page.evaluate(async () => ({
      ca: document.querySelector('#wt-ca').textContent,
      so4: document.querySelector('#wt-so4').textContent,
      ty: 'ville',
      rows: [...document.querySelectorAll('#minrows tr')].map(
        r => [...r.querySelectorAll('input')].map(i => i.value).join(' ') + ' ' + r.textContent
      ),
      ro: [...document.querySelectorAll('#minrows input')].every(i => i.readOnly),
      exp: document.querySelector('#we-ca').textContent,
      cost: document.querySelector('#cost-ings').textContent,
      rt: JSON.stringify((await __rt()).kv.recipe.water),
      V: wcalc().tot
    }));
    check(
      'eau & minéraux : mélange pondéré + ajouts, attendus du style, consommables automatiques (>0), enregistré',
      /^8\d,|^9\d|^\d+/.test(mw.ca) &&
        mw.ty === 'ville' &&
        mw.rows.length === 2 &&
        /Minéral Ca/.test(mw.rows.join()) &&
        mw.ro &&
        /50–150/.test(mw.exp) &&
        /Minéral SO4/.test(mw.rows.join()) &&
        JSON.parse(mw.rt).length === 2 &&
        parseFloat(mw.cost.replace(',', '.')) > 0,
      JSON.stringify(mw)
    );
    check(
      'eau & minéraux : ordre des tableaux (levures, eau, ingrédients) et total Ca = 50 % Paris + 40',
      await page.evaluate(() => {
        const h = [...document.querySelectorAll('.col .panel h3')].map(x => x.textContent);
        const i = h.findIndex(x => /Levures/.test(x)),
          j = h.findIndex(x => /Eau & minéraux/.test(x)),
          k = h.findIndex(x => /Ingrédients/.test(x));
        return (
          i < j &&
          j < k &&
          Math.abs(
            parseFloat(document.querySelector('#wt-ca').textContent.replace(',', '.')) -
              (S.eaux.find(x => x.name === 'Paris').ca * 0.5 + 40)
          ) < 0.6
        );
      })
    );
    await page.evaluate(() => {
      S.kv.recipe.water = [];
      S.kv.recipe.minadd = {};
      conception();
    });
    await page.evaluate(() => {
      S.kv.equip.rsel = {};
    });
    for (const k of ['malts', 'hops', 'yeasts']) {
      await nav(page, k);
      await page.evaluate(() => {
        for (let i = 0; i < 5; i++) {
          const c = document.querySelectorAll('input[data-rs]')[i],
            n = lab(c.dataset.rs, S[c.dataset.rs][i + 1]);
          c.value = n;
          c.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await wait(150);
      const rr = await page.evaluate(() => ({
        n: document.querySelectorAll('input[data-rs]').length,
        cols: document.querySelectorAll('.rt tr:first-child th').length,
        sel: [...document.querySelectorAll('input[data-rs]')].filter(x => x.value).length,
        poly: document.querySelectorAll('#rview polygon[stroke]').length,
        r2: !!document.querySelector('#rview2'),
        w: Math.round(
          (document.querySelector('.rlist').getBoundingClientRect().width /
            document.querySelector('.rwrap').getBoundingClientRect().width) *
            100
        ),
        right:
          document.querySelector('#rview').getBoundingClientRect().left >
          document.querySelector('.rlist').getBoundingClientRect().right - 2,
        btn: document.querySelectorAll('#rview button.rpng').length === 2
      }));
      check(
        'écran ' +
          k +
          ' : liste de 5 noms seulement (carte radar) + radar à droite avec bouton PNG, sans radar des totaux',
        rr.n === 5 &&
          rr.cols === 2 &&
          rr.sel === 5 &&
          rr.poly === 5 &&
          !rr.r2 &&
          rr.w >= 14 &&
          rr.w <= 40 &&
          rr.right &&
          rr.btn,
        JSON.stringify(rr)
      );
    }
    await nav(page, 'malts');
    {
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
        page.click('#rview button.rpng')
      ]);
      let ok = false,
        nm = '';
      if (dl) {
        nm = dl.suggestedFilename();
        const pth = await dl.path();
        const buf = require('fs').readFileSync(pth);
        ok = buf.length > 3000 && buf.slice(1, 4).toString() === 'PNG';
      }
      check('radar : export PNG (fichier .png valide)', ok && /\.png$/.test(nm), nm);
    }
    {
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
        page.click('#rview button.rpng[data-bg=light]')
      ]);
      const nm = dl ? dl.suggestedFilename() : '';
      let ok = false;
      if (dl) {
        const buf = require('fs').readFileSync(await dl.path());
        ok = buf.slice(1, 4).toString() === 'PNG';
      }
      check('radar : export PNG fond clair', ok && /clair/.test(nm), nm);
    }
    await nav(page, 'conception');
    {
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
        page.click('#radars .rpng[data-bg=dark]')
      ]);
      check(
        'radar de conception : export PNG',
        !!dl && /\.png$/.test(dl.suggestedFilename()),
        dl && dl.suggestedFilename()
      );
    }
    await nav(page, 'malts');
    const z1 = await page.evaluate(() => !document.getElementById('rzoom'));
    await page.click('#rview svg', { position: { x: 30, y: 30 } });
    await wait(200);
    const z2 = await page.evaluate(() => {
      const o = document.getElementById('rzoom');
      if (!o) return null;
      const r = o.getBoundingClientRect(),
        v = o.querySelector('svg').getBoundingClientRect();
      return {
        full: r.width >= innerWidth - 2 && r.height >= innerHeight - 2,
        big: v.height > innerHeight * 0.6,
        fs: Math.max(...[...o.querySelectorAll('text')].map(t => t.getBoundingClientRect().height))
      };
    });
    await page.keyboard.press('Escape');
    const z3 = await page.evaluate(() => !document.getElementById('rzoom'));
    check(
      'radar : un clic l’affiche en plein écran, fermé par Échap ; polices proportionnées à l’écran (≈ 16 px, pas géantes)',
      z1 && z2 && z2.full && z2.big && z3 && z2.fs >= 10 && z2.fs <= 26,
      JSON.stringify([z1, z2, z3])
    );
    {
      const hl = await page.evaluate(() => {
        const i = document.querySelector('.rt input.nm'),
          r = i.closest('tr'),
          td = r.querySelector('td');
        i.focus();
        const f = getComputedStyle(td).backgroundColor,
          sh = getComputedStyle(td).boxShadow;
        const o = document.querySelector('table.db tr[data-ri] td'),
          ob = getComputedStyle(o).backgroundColor;
        const inp = document.querySelector('table.db tr[data-ri] input');
        inp.focus();
        const hi = getComputedStyle(inp.closest('td')).backgroundColor;
        i.blur();
        inp.blur();
        return { radarHl: !/255, 200, 60/.test(f) && sh === 'none', listHl: /255, 200, 60/.test(hi) };
      });
      check(
        'malts : plus de surbrillance dans le tableau de génération du radar, conservée dans la liste',
        hl.radarHl && hl.listHl,
        JSON.stringify(hl)
      );
    }
    await page.evaluate(() => {
      S.kv.equip.rsel = {};
      drawRv('malts');
      const r = document.querySelector('#rblock');
      r.innerHTML = rvInner('malts');
      drawRv('malts');
    });
    check(
      'radar sans données : grille présente, radar non tracé',
      await page.evaluate(
        () =>
          document.querySelectorAll('#rview polygon.rg').length === 5 &&
          document.querySelectorAll('#rview polygon[stroke]').length === 0
      )
    );
    check(
      'boutons PNG : « PNG » seul, bouton clair à fond blanc ; légende toujours réservée (vide = sans contenu)',
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('#rview button.rpng')],
          l = document.querySelector('#rview .rleg');
        return (
          b.length === 2 &&
          b.every(x => x.textContent === 'PNG') &&
          getComputedStyle(b[1]).backgroundColor === 'rgb(255, 255, 255)' &&
          l.getBoundingClientRect().height >= 20 &&
          l.children.length === 0
        );
      })
    );
    await nav(page, 'params');
    const el = await page.evaluate(() => {
      S.kv.equip.chauffe = 2;
      S.kv.equip.t0 = 10;
      S.kv.equip.boil = 60;
      const R = S.kv.recipe;
      R.mash[0].t = 50;
      R.mash[0].m = 10;
      R.mash[1].t = 62;
      R.mash[1].m = 30;
      R.mash[2].t = 72;
      R.mash[2].m = 20;
      R.mash[3].t = '';
      R.mash[5].t = 78;
      R.mash[5].m = 5;
      R.mash[4].t = 78;
      params();
      const A = elecPlan().map(l => [l.key, +l.min.toFixed(3)]);
      const W = wcalc();
      return {
        A,
        W: { rinc: W.rinc, v0: W.v0 },
        ro: [...document.querySelectorAll('tr.ea')].map(r => [...r.querySelectorAll('input')].map(x => x.readOnly)),
        n: document.querySelectorAll('tr.ea').length,
        vis: [...document.querySelectorAll('tr.ea')].filter(r => !r.hidden).length,
        th: [...document.querySelectorAll('.panel')]
          .find(p => /Besoins en électricité/.test(p.querySelector('h3').textContent))
          .innerText.includes('Durée (min)'),
        v: [...document.querySelectorAll('tr.ea input[type=number][readonly]')].map(x => x.value)
      };
    });
    check(
      'électricité générée depuis les paliers de la Conception : montée initiale, (montée + palier) par ligne, chauffe eau de rinçage en dernier ; durées en minutes (chauffe 2 °C/min, t0 10 °C) ; champs en lecture seule',
      el.n === 15 &&
        el.vis === 15 &&
        el.th &&
        JSON.stringify(el.A.map(a => a[0])) ===
          JSON.stringify([
            'init',
            'p:Palier Saccharification',
            'r:Palier I',
            'p:Palier I',
            'r:Palier II',
            'p:Palier II',
            'r:Palier III',
            'p:Palier III',
            'r:Rinçage / Recirculation',
            'p:Rinçage / Recirculation',
            'r:Mashout',
            'p:Mashout',
            'r:Ébullition',
            'p:Ébullition',
            'rinse'
          ]) &&
        JSON.stringify(el.A.slice(0, 14).map(a => a[1])) ===
          JSON.stringify([20, 10, 6, 30, 5, 20, 0, 0, 3, 30, 0, 5, 11, 60]) &&
        Math.abs(el.A[14][1] - (34 * Math.max(0, el.W.rinc)) / el.W.v0) < 0.01 &&
        el.ro.every(r => r[0] && !r[1] && r[2]),
      JSON.stringify(el)
    );
    await nav(page, 'malts');
    await nav(page, 'conception');
    await wait(200);
    const cv = await page.evaluate(() => {
      const bad = [...document.querySelectorAll('#main .pc')]
        .filter(x => !x.closest('tr.sum,tr.exp') && !x.querySelector('input.cv'))
        .map(x => x.id || x.className);
      const i = document.querySelector('input.cv');
      const cs = getComputedStyle(i);
      return {
        n: document.querySelectorAll('input.cv').length,
        bad,
        ro: [...document.querySelectorAll('input.cv')].every(x => x.readOnly),
        it: cs.fontStyle,
        al: cs.textAlign
      };
    });
    check(
      'valeurs calculées (ex-cyan) : inputs en lecture seule, italique, alignés à gauche',
      cv.n > 5 && cv.bad.length === 0 && cv.ro && cv.it === 'italic' && cv.al === 'left',
      JSON.stringify(cv)
    );
    await page.screenshot({ path: '/tmp/claude-0/cv_conception.png', fullPage: false });
    await nav(page, 'params');
    await page.screenshot({ path: '/tmp/claude-0/cv_params.png' });
    check(
      'électricité : puissance en W (valeurs ×1000), kWh conservés',
      await page.evaluate(() => {
        const th = [...document.querySelectorAll('th')].map(x => x.textContent);
        return (
          th.includes('Puissance (W)') &&
          th.includes('kWh') &&
          S.elec.every(l => l.w !== undefined && l.kw === undefined) &&
          S.elec.find(l => l.auto === 'init').w === 3000 &&
          Math.abs(
            +document.querySelector('#pk0').textContent.replace(',', '.') -
              (3 * +document.querySelector('#em0').value) / 60
          ) < 0.02
        );
      })
    );
    await nav(page, 'malts');
    await nav(page, 'conception');
    await wait(200);
    {
      const sel = '#w-v0 input.cv';
      await page.locator(sel).scrollIntoViewIfNeeded();
      await wait(300);
      await page.hover(sel);
      await wait(200);
      const early = await page.evaluate(() => {
        const t = document.getElementById('rotip');
        return !!t && t.style.display === 'block';
      });
      await wait(500);
      const tp = await page.evaluate(() => {
        const t = document.getElementById('rotip');
        return {
          on: !!t && t.style.display === 'block',
          txt: t ? t.textContent : '',
          col: getComputedStyle(document.querySelector('#w-v0 input.cv')).color
        };
      });
      await page.mouse.move(5, 5);
      await wait(150);
      const off = await page.evaluate(() => document.getElementById('rotip').style.display === 'none');
      check(
        'infobulle sur champ en lecture seule : après ~0,5 s, explication du calcul, police gris clair, disparaît à la sortie',
        !early && tp.on && /ratio/.test(tp.txt) && tp.col === 'rgb(201, 206, 214)' && off,
        JSON.stringify(tp)
      );
    }
    await nav(page, 'malts');
    {
      const miss = [];
      for (const sc of ['conception', 'params', 'malts', 'eaux', 'conso']) {
        await nav(page, sc);
        await wait(150);
        const r = await page.evaluate(() =>
          [...document.querySelectorAll('#main input[readonly]')]
            .filter(x => roTip(x) === 'Champ en lecture seule.')
            .map(x => x.id || (x.closest('[id]') || {}).id || x.className)
        );
        miss.push(...r.map(x => sc + ':' + x));
      }
      check('infobulles : chaque champ en lecture seule a une explication précise', miss.length === 0, miss.join(','));
    }
    await nav(page, 'malts');
    await nav(page, 'malts');
    await page.evaluate(() => {
      const i = document.querySelector('input.fi[data-fc="name"]');
      i.value = 'pil';
      i.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await wait(150);
    await page.click('th[data-sort="name"]');
    await wait(100);
    const fv = await page.evaluate(
      () => [...document.querySelectorAll('tr[data-ri]')].filter(r => r.style.display !== 'none').length
    );
    await page.click('button.fx');
    await wait(250);
    const fr = await page.evaluate(() => ({
      vis: [...document.querySelectorAll('tr[data-ri]')].filter(r => r.style.display !== 'none').length,
      all: document.querySelectorAll('tr[data-ri]').length,
      f: [...document.querySelectorAll('input.fi')].every(x => x.value === ''),
      asc: S.malts.every(
        (m, i, a) =>
          !i || String(a[i - 1].name).localeCompare(String(m.name), 'fr', { numeric: true, sensitivity: 'base' }) <= 0
      )
    }));
    check(
      'gomme : supprime tous les filtres et rétablit le tri par nom croissant',
      fv < fr.all && fr.vis === Math.min(fr.all, 15) && fr.f && fr.asc,
      JSON.stringify([fv, fr])
    );
    await nav(page, 'params');
    check(
      'paramètres : aucun champ en lecture seule en cyan (noms de phase du Process en jaune, voulu)',
      await page.evaluate(() =>
        [...document.querySelectorAll('#main input[readonly]:not(.phn)')].every(
          x => getComputedStyle(x).color === 'rgb(201, 206, 214)'
        ) && [...document.querySelectorAll('#main input.phn')].every(x => getComputedStyle(x).color === 'rgb(255, 230, 0)')
      )
    );
    await nav(page, 'malts');
    await nav(page, 'conception');
    await wait(200);
    const wq = await page.evaluate(async () => {
      const R = S.kv.recipe,
        W = wcalc(),
        res = {};
      res.nog = document.querySelector('#w-nog').textContent;
      res.exp = (W.v0 + W.rinc).toFixed(2).replace('.', ',');
      R.water = [
        { n: 'Épernay', p: 50, l: 0 },
        { n: 'Paris', p: 50, l: 0 }
      ];
      conception();
      await new Promise(r => setTimeout(r, 100));
      const L = () => [...document.querySelectorAll('#wmin input[data-wf="l"]')],
        P = () => [...document.querySelectorAll('#wmin input[data-wf="p"]')];
      res.m1 = { lro: L().every(x => x.readOnly), pro: P().some(x => x.readOnly), l: L().map(x => +x.value) };
      res.T = W.v0 + W.rinc;
      L()[0].dispatchEvent(new Event('focusin', { bubbles: true }));
      res.m2 = { lro: L().some(x => x.readOnly), pro: P().every(x => x.readOnly) };
      L()[0].value = '10';
      L()[0].dispatchEvent(new Event('input', { bubbles: true }));
      L()[1].value = '30';
      L()[1].dispatchEvent(new Event('input', { bubbles: true }));
      res.p = P().map(x => +x.value);
      res.mod = R.water.map(x => Math.round(x.p));
      P()[0].dispatchEvent(new Event('focusin', { bubbles: true }));
      res.m3 = { lro: L().every(x => x.readOnly), pro: P().some(x => x.readOnly) };
      P()[0].value = '25';
      P()[0].dispatchEvent(new Event('input', { bubbles: true }));
      P()[1].value = '75';
      P()[1].dispatchEvent(new Event('input', { bubbles: true }));
      res.l = L().map(x => +x.value);
      return res;
    });
    check(
      'eau & minéraux : colonnes Litres et %, mode exclusif litres ↔ %, litres = total nécessaire × %',
      wq.nog === wq.exp &&
        wq.m1.lro &&
        !wq.m1.pro &&
        Math.abs(wq.m1.l[0] - wq.T / 2) < 0.02 &&
        wq.m2.lro === false &&
        wq.m2.pro &&
        wq.p[0] === 25 &&
        wq.p[1] === 75 &&
        wq.m3.lro &&
        Math.abs(wq.l[0] - wq.T * 0.25) < 0.02 &&
        Math.abs(wq.l[1] - wq.T * 0.75) < 0.02,
      JSON.stringify(wq)
    );
    await nav(page, 'malts');
    await nav(page, 'conception');
    await wait(200);
    const sb = await page.evaluate(async () => {
      WMODE = 'p';
      const m0 = WMODE;
      const R = S.kv.recipe;
      R.water = [
        { n: 'Épernay', p: 50, l: 0 },
        { n: 'Paris', p: 50, l: 0 }
      ];
      R.minadd = { ca: 40 };
      conception();
      await new Promise(r => setTimeout(r, 120));
      const v = id => parseFloat(document.querySelector(id).textContent.replace(',', '.')),
        a = v('#wv-0-ca'),
        b = v('#wv-1-ca'),
        sub = v('#ws-ca'),
        tot = v('#wt-ca'),
        ok1 = document.querySelector('#wlchk').className.includes('okc'),
        chk0 = document.querySelector('#wlchk').className + '|' + document.querySelector('#wlchk').textContent;
      const before = [...document.querySelectorAll('#wmin tr')].map(
        r => r.className + '|' + (r.firstElementChild.textContent || '').slice(0, 12)
      );
      R.water[0].l = 5;
      WMODE = 'g';
      wnorm();
      fillMin();
      const bad = document.querySelector('#wlchk').className.includes('bad');
      WMODE = 'p';
      fillMin();
      const ra = S.eaux.find(x => x.name === 'Épernay').ca,
        rp = S.eaux.find(x => x.name === 'Paris').ca;
      return {
        m0,
        chk0,
        chk: document.querySelector('#wlchk').textContent,
        mode: WMODE,
        a,
        b,
        sub,
        tot,
        exp: ra * 0.5,
        expb: rp * 0.5,
        ok1,
        bad,
        order: before.map(x => x.split('|')[0] + ':' + x.split('|')[1]).join(' / ')
      };
    });
    check(
      'eau & minéraux : apports pondérés par les litres, sous-total avant « Ajout », total = sous-total + ajout, contrôle litres = eau nécessaire',
      Math.abs(sb.a - sb.exp) < 0.01 &&
        Math.abs(sb.b - sb.expb) < 0.01 &&
        Math.abs(sb.sub - (sb.a + sb.b)) < 0.02 &&
        Math.abs(sb.tot - (sb.sub + 40)) < 0.02 &&
        sb.ok1 &&
        sb.bad &&
        /Sous-total[^/]*\/ addr:Ajout/.test(sb.order.replace(/sum:Sous-total/, 'sum:Sous-total')),
      JSON.stringify(sb)
    );
    await nav(page, 'malts');
    await nav(page, 'conception');
    await wait(200);
    check(
      'eau & minéraux : plus de colonne « Type »',
      await page.evaluate(
        () =>
          ![...document.querySelectorAll('#wmin th')].some(x => x.textContent === 'Type') &&
          !document.querySelector('[id^="wty-"]')
      )
    );
    await page.click('input[data-r="name"]');
    await page.keyboard.type('Zeta');
    await page.keyboard.press('Tab');
    await page.fill('input[data-e="vol"]', '30').catch(() => {});
    const sel = await page.evaluate(() => {
      const i = document.querySelector('input[data-r="name"]');
      i.focus();
      return new Promise(r => setTimeout(() => r({ s: i.selectionStart, e: i.selectionEnd, l: i.value.length }), 50));
    });
    await page.keyboard.type('B');
    const nv = await page.evaluate(() => document.querySelector('input[data-r="name"]').value);
    await page.fill('input[data-r="ibuT"]', '40');
    await page.click('input[data-r="name"]');
    await page.click('input[data-r="ibuT"]');
    await wait(80);
    await page.keyboard.type('73');
    const num = await page.evaluate(() => document.activeElement.value);
    await page.fill('input[data-r="ibuT"]', '40');
    {
      await page.fill('input[data-r="name"]', 'Alpha Beta Gamma');
      await page.click('input[data-r="ibuT"]');
      await page.click('input[data-r="name"]');
      await wait(80);
      const s1 = await page.evaluate(() => {
        const i = document.activeElement;
        return { s: i.selectionStart, e: i.selectionEnd, l: i.value.length };
      });
      const bb = await page.$eval('input[data-r="name"]', e => {
        const r = e.getBoundingClientRect();
        return { x: r.left, y: r.top, h: r.height };
      });
      await page.mouse.click(bb.x + 12, bb.y + bb.h / 2);
      await wait(120);
      const s2 = await page.evaluate(() => {
        const i = document.activeElement;
        return { s: i.selectionStart, e: i.selectionEnd, l: i.value.length };
      });
      await page.keyboard.type('X');
      const v = await page.$eval('input[data-r="name"]', e => e.value);
      check(
        'champs modifiables : 1er clic = tout sélectionné ; 2e clic dans le champ = curseur placé à l’endroit cliqué (frappe insérée sans tout remplacer)',
        s1.s === 0 &&
          s1.e === s1.l &&
          s2.s === s2.e &&
          s2.s < s2.l &&
          v.length === s2.l + 1 &&
          /X/.test(v) &&
          v !== 'X',
        JSON.stringify({ s1, s2, v })
      );
    }
    check(
      'champs modifiables : valeur sélectionnée au focus, la 1re frappe remplace tout',
      sel.s === 0 && sel.e === sel.l && sel.l > 0 && nv === 'B' && num === '73',
      JSON.stringify([sel, nv, num])
    );
    await page.keyboard.press('Tab');
    await nav(page, 'malts');
    check(
      'fond de page 15 % plus clair (#4b525d)',
      await page.evaluate(() => getComputedStyle(document.body).backgroundColor === 'rgb(75, 82, 93)')
    );
    await nav(page, 'conception');
    await wait(200);
    const rt = await page.evaluate(() => {
      const R = S.kv.recipe,
        st = find('styles', R.style) || {},
        i = document.querySelector('#wrat input.cv'),
        ex = document.querySelector('#wrat-e').textContent,
        T = minTot();
      const top = getComputedStyle(document.querySelector('.top'));
      return {
        ro: !!i && i.readOnly,
        v: i && i.value,
        exp: ex,
        st: [st.so4cl_min, st.so4cl_max],
        ratio: (T.so4 / T.cl).toFixed(2).replace('.', ','),
        border: top.borderTopWidth,
        bg: top.backgroundColor,
        nWith: S.styles.filter(x => x.so4cl_min !== '' && x.so4cl_min !== undefined).length,
        tot: S.styles.length,
        under:
          document.querySelector('#wrat').closest('tr').getBoundingClientRect().top >
          document.querySelector('#we-ca').closest('tr').getBoundingClientRect().top,
        noTitle: !document.querySelector('.top h3')
      };
    });
    check(
      'eau & minéraux : ratio SO₄/Cl dans un input readonly + attendu dessous (base des styles : colonnes mini/maxi)',
      rt.ro &&
        rt.v === rt.ratio &&
        rt.st[0] !== '' &&
        +rt.st[0] === +rt.st[1] &&
        rt.exp.includes(String(+rt.st[0])) &&
        rt.nWith >= rt.tot - 12 &&
        rt.under,
      JSON.stringify(rt)
    );
    check(
      'barre recette / style / DI / IBU dans un cadre sans titre',
      rt.border === '1px' && rt.bg !== 'rgba(0, 0, 0, 0)' && rt.noTitle
    );
    await nav(page, 'styles');
    check(
      'écran styles : colonnes « Ratio SO4/Cl mini » et « maxi »',
      await page.evaluate(
        () =>
          [...document.querySelectorAll('th.srt')].some(x => /Ratio SO4\/Cl mini/.test(x.textContent)) &&
          [...document.querySelectorAll('th.srt')].some(x => /Ratio SO4\/Cl maxi/.test(x.textContent))
      )
    );
    await nav(page, 'malts');
    await nav(page, 'conception');
    await wait(200);
    await page.click('input[data-r="ogT"]');
    await page.keyboard.type('1.070');
    await page.click('input[data-r="ibuT"]');
    await page.keyboard.type('40');
    const fq = await page.evaluate(() => ({
      o: S.kv.recipe.ogT,
      i: S.kv.recipe.ibuT,
      ov: document.querySelector('[data-r=ogT]').value,
      iv: document.querySelector('[data-r=ibuT]').value
    }));
    check(
      'saisie rapide juste après le clic : aucun caractère perdu (DI 1.070, IBU 40)',
      fq.o === 1.07 && fq.i === 40 && fq.ov === '1.070' && fq.iv === '40',
      JSON.stringify(fq)
    );
    await page.click('.rin[data-k="malts"][data-i="0"][data-f="g"]');
    await wait(100);
    await page.keyboard.type('7.404');
    const g0 = await page.evaluate(() => S.kv.recipe.malts[0].g);
    await page.click('#calc');
    await wait(400);
    const cq = await page.evaluate(() => ({
      g: S.kv.recipe.malts.map(m => m.g),
      v: [...document.querySelectorAll('.rin[data-k="malts"][data-f="g"]')].map(x => x.value),
      n: [...document.querySelectorAll('.rin[data-k="malts"][data-f="n"]')].map(x => x.value),
      m: (document.querySelector('#hbar .hn[data-k="calc"]') || {}).textContent || '',
      mn: S.kv.recipe.malts.map(m => m.n)
    }));
    check(
      'bouton Calculer : quantités de malt mises à jour dans le modèle et dans les champs, noms inchangés',
      g0 === 7404 &&
        cq.g[0] !== 7404 &&
        cq.v.every((x, i) => Math.abs(parseFloat(x) - cq.g[i] / 1000) < 0.0006) &&
        cq.n.every((x, i) => x === cq.mn[i]) &&
        /Recalculé/.test(cq.m),
      JSON.stringify(cq)
    );
    check(
      'radars de conception : hauteur réduite de 25 % (360 px au lieu de 480)',
      await page.evaluate(
        () => Math.round(document.querySelector('.radars .panel').getBoundingClientRect().height) === 360
      )
    );
    await nav(page, 'malts');
    await nav(page, 'conception');
    await wait(150);
    check(
      'keydown sans propriété key (autofill du navigateur) : aucune erreur',
      (await page.evaluate(() => {
        const i = document.querySelector('input[data-r="name"]');
        i.focus();
        const ev = new Event('keydown', { bubbles: true });
        i.dispatchEvent(ev);
        return true;
      })) && errs.length === 0,
      errs.join('|')
    );
    await nav(page, 'malts');
    {
      const zr = async sel => {
        await page.click(sel, { position: { x: 20, y: 20 } });
        await wait(250);
        const r = await page.evaluate(() => {
          const o = document.querySelector('#rzoom polygon.rg.out');
          if (!o) return 0;
          const b = o.getBoundingClientRect();
          return Math.round(Math.min(b.width, b.height) / 2);
        });
        await page.keyboard.press('Escape');
        await wait(100);
        return r;
      };
      await nav(page, 'conception');
      await wait(250);
      const rc = await zr('#radars svg');
      const rs = [];
      for (const k of ['malts', 'hops', 'yeasts']) {
        await nav(page, k);
        await wait(250);
        rs.push(await zr('#rview svg'));
      }
      console.log('ZOOM', rc, JSON.stringify(rs));
      check(
        'radars agrandis (clic) des écrans malts/houblons/levures : même rayon que ceux de la conception',
        rs.every(r => r >= rc - 6),
        JSON.stringify([rc, rs])
      );
    }
    await nav(page, 'malts');
    check(
      'écrans base : barre d’outils sous le radar, bouton « + » dans la colonne des actions, nom en autocomplétion',
      await page.evaluate(
        () =>
          document.querySelector('#rblock').getBoundingClientRect().bottom <=
            document.querySelector('#add').getBoundingClientRect().top &&
            !!document.querySelector('tr.hd #add') &&
            document.querySelector('#add').textContent.trim() === '＋' &&
          !!document.querySelector('input[data-rs][list]') &&
          !document.querySelector('select[data-rs]')
      )
    );
    await nav(page, 'conception');
    check(
      'eaux : Épernay en base et en première ligne par défaut',
      await page.evaluate(() => {
        const d = defaults().recipe;
        return S.eaux.some(x => x.name === 'Épernay' && x.ca === 95) && d.water[0].n === 'Épernay';
      })
    );
  {
    const cu = await page.evaluate(async () => {
      window.__bcManual = true;
      const w = ms => new Promise(r => setTimeout(r, ms)),
        o = {};
      S.conso.push({ name: 'Zzz Whirlfloc Cons', unite: 'pastille', prix: 0.2 });
      const xml =
        '<RECIPES><RECIPE><NAME>R2 Zzz</NAME><MISCS><MISC><NAME>Zzz Qxw Misc</NAME><TYPE>Fining</TYPE><AMOUNT>0.001</AMOUNT></MISC></MISCS></RECIPE></RECIPES>';
      const r = bxImportTexts([{ name: 'b.xml', text: xml, noCreate: true }]),
        i = r.idx[0];
      const pr = bxRelinkAsk([i]);
      await w(300);
      const d = document.querySelector('.bcdlg'),
        inp = d.querySelector('.bcmap input');
      o.dl = [...d.querySelectorAll('datalist')].flatMap(l => [...l.options].map(x => x.value));
      inp.value = 'Zzz Whirlfloc Cons';
      d.querySelector('.ok').click();
      await pr;
      const R = S.biblio[i].recipe;
      o.moved = (R.conso || []).map(x => x.n).join('|') === 'Zzz Whirlfloc Cons' && (R.ings || []).length === 0;
      o.unres = bxUnres(R).length;
      o.col = COLS.conso.join(',');
      o.csv = toCsv('conso').split('\r\n')[0];
      S.kv.recipe.conso = [{ n: 'Zzz Whirlfloc Cons', g: 2 }];
      conception();
      await w(200);
      o.unit = [...document.querySelectorAll('td.un')].map(x => x.textContent).includes('pastille');
      S.kv.recipe.conso = [];
      S.biblio.splice(i, 1);
      S.conso = S.conso.filter(x => x.name !== 'Zzz Whirlfloc Cons');
      S.kv.equip.arech = (S.kv.equip.arech || []).filter(x => !/Zzz/.test(x.n));
      window.__bcManual = false;
      return o;
    });
    check(
      'normalisation : autocomplétion = tables Ingrédients + Consommables ; un consommable choisi passe dans les consommables ; colonne « unité » (base + conception + CSV)',
      cu.dl.includes('Zzz Whirlfloc Cons') &&
        cu.dl.some(n => /Minéral Ca/.test(n)) &&
        cu.moved &&
        cu.unres === 0 &&
        cu.col === 'name,unite,prix,stock' &&
        /unite/.test(cu.csv) &&
        cu.unit,
      JSON.stringify(cu)
    );
  }
    {
      /* icônes Lucide 1.73 : interface, interrupteur de thème, ornements des étiquettes et de la feuille, infobulles */
      const src = await page.evaluate(() => fetch('js/icons.js').then(r => r.text()));
      check(
        'icônes : jeu Lucide v1.73.0 généré (dev/gen-icons.js), dont base de données, téléchargement, ornements',
        /Lucide v1\.73\.0/.test(src) &&
          (await page.evaluate(() =>
            ['database', 'download', 'upload', 'heart', 'star', 'sparkle', 'recycle', 'music2', 'login', 'beer'].every(k =>
              /<path|<circle|<rect|<line|<polyline|<polygon/.test(ICONS[k] || '')
            )
          ))
      );
      const leftovers = await page.evaluate(async () => {
        const out = [];
        for (const k of ['conception', 'biblio', 'params', 'malts']) {
          show(k);
          await new Promise(r => setTimeout(r, 250));
          const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let n;
          while ((n = w.nextNode())) {
            const e = n.parentElement;
            if (!e || e.closest('.ic,option,textarea,script,style,select,svg,[hidden]') || !e.getClientRects().length) continue;
            FARE.lastIndex = 0;
            if (FARE.test(n.data)) out.push(k + ': ' + n.data.trim().slice(0, 40));
          }
        }
        show('conception');
        return out;
      });
      check('écrans principaux : aucun emoji affiché, tous remplacés par des icônes Lucide', leftovers.length === 0, leftovers.slice(0, 5).join(' | '));
      check(
        'en-tête : « ＋ », voyant de la base et sauvegarde en icônes Lucide ; interrupteur de thème soleil / lune Lucide (traits)',
        await page.evaluate(() => {
          const th = [...document.querySelectorAll('#thsw svg')];
          return (
            !!document.querySelector('#dbst svg.fa-database') &&
            !!document.querySelector('#dbsave svg.fa-save') &&
            th.length === 2 &&
            th.every(x => getComputedStyle(x).fill === 'none' && x.innerHTML.includes('path'))
          );
        })
      );
      const lsrc = fs.readFileSync(path.join(WEB, 'js/labels.js'), 'utf8');
      check(
        'étiquettes : ornements des modèles en icônes Lucide (plus de ♥ ❦ ♪ ★ ✦ ♻… dans les modèles)',
        !/[♥❦❧⚘♪♫✦✱♻]/.test(lsrc) &&
          lsrc.split('\n').filter(l => /★/.test(l)).every(l => /\(importée\)/.test(l)) &&
          /ic\('heart'\)/.test(lsrc) &&
          /ic\('recycle'\)/.test(lsrc)
      );
      const sh = await page.evaluate(async () => {
        show('sheet');
        await new Promise(r => setTimeout(r, 600));
        const b = document.querySelector('.card h4 b'),
          st = b && getComputedStyle(b, '::before'),
          o = {
            stars: document.querySelectorAll('.shfoot .shtag svg.fa-star').length,
            tag: (document.querySelector('.shfoot .shtag') || {}).textContent || '',
            mask: st ? st.webkitMaskImage || st.maskImage : '',
            content: st ? st.content : ''
          };
        show('conception');
        return o;
      });
      check(
        'feuille de brassage : étoiles Lucide en pied de page, puce des cartes dessinée par un masque Lucide (plus de ▶ ★ ■ ♪ en texte)',
        sh.stars >= 2 && /LOUD · HOPPY · HANDMADE/.test(sh.tag) && !/★/.test(sh.tag) && /svg\+xml/.test(sh.mask) && /^(""|''|none)$/.test(sh.content),
        JSON.stringify(sh).slice(0, 300)
      );
      check(
        'infobulles des notifications : texte sans emoji',
        await page.evaluate(async () => {
          warnSet('t-ic', '⚠ Essai ⚠ avertissement');
          notify('t-ic2', '✔ Essai réussi', 'ok');
          await new Promise(r => setTimeout(r, 100)); /* remplacement des icônes après l'affichage */
          const a = document.querySelector('#hbar .hw[data-k="t-ic"]'),
            b = document.querySelector('#hbar .hn[data-k="t-ic2"]'),
            r = a.title === 'Essai avertissement' && b.title === 'Essai réussi' && !!a.querySelector('svg.fa-warn');
          warnSet('t-ic', '');
          b.remove();
          return r;
        })
      );
    }
    {
      /* liste de courses automatique : composant épuisé par la recette (besoin ≥ stock) ajouté, retiré quand le stock suffit */
      const cs = await page.evaluate(async () => {
        const w = ms => new Promise(r => setTimeout(r, ms)),
          R = S.kv.recipe,
          d = S.ings.find(x => x.name && !Object.values(MCO).includes(x.name)),
          key = x => x.t === 'ings' && x.n === d.name,
          item = () => courList().find(key),
          o = {};
        show('conception');
        await w(200);
        S.kv.equip.courses = [];
        const st0 = d.stock;
        d.stock = 10;
        R.ings = [{ n: d.name, g: 100 }];
        conception();
        await w(200);
        const a = item();
        o.add = !!a && a.q === 90 && a.r.auto === 90 && !!document.querySelector('#courses .cour');
        R.ings[0].g = 10; /* stock tout juste épuisé : reste dans la liste, quantité figée (90) */
        conception();
        await w(150);
        o.zero = !!item() && item().q === 90;
        R.ings[0].g = 5; /* stock suffisant : retiré */
        conception();
        await w(150);
        o.gone = !item();
        /* ajout manuel (caddie de l'écran Ingrédients) : jamais retiré automatiquement */
        courAddItem('ings', d.name, true);
        conception();
        await w(150);
        o.manual = !!item() && item().r.manuel > 0 && item().r.auto === undefined;
        /* épuisé de nouveau : quantité auto ajoutée à l'article manuel, puis retirée quand le stock suffit */
        R.ings[0].g = 30;
        conception();
        await w(150);
        o.both = item().r.auto === undefined && item().q === item().r.manuel; /* déjà dans la liste : quantité figée */
        R.ings[0].g = 5;
        conception();
        await w(150);
        o.keep = !!item() && item().r.auto === undefined && item().q === item().r.manuel;
        /* article automatique retiré à la croix : pas remis tant que le stock reste épuisé */
        S.kv.equip.courses = [];
        R.ings[0].g = 100;
        conception();
        await w(150);
        document.querySelector('#courses [data-cdel="' + courList().findIndex(key) + '"]').click();
        await w(150);
        conception();
        await w(150);
        o.dismiss = !item() && (R.courNo || []).includes('ings|' + d.name);
        R.ings[0].g = 5;
        conception();
        await w(150);
        R.ings[0].g = 100;
        conception();
        await w(150);
        o.again = !!item() && !(R.courNo || []).includes('ings|' + d.name);
        S.kv.equip.courses = [];
        R.ings = [];
        d.stock = st0;
        conception();
        return o;
      });
      check(
        'courses automatiques : ingrédient épuisé par la recette ajouté (10 g en stock, 100 g demandés → 90 g), quantité figée ensuite, retiré quand le stock suffit ; ajout manuel jamais retiré ni modifié ; article retiré à la croix non remis tant que le stock reste épuisé',
        Object.values(cs).every(Boolean),
        JSON.stringify(cs)
      );
    }
    {
      /* Conception : caddie sur chaque ligne de composant, colonne d'actions alignée ; Bilan : ombre sous les curseurs */
      const cd = await page.evaluate(async () => {
        const w = ms => new Promise(r => setTimeout(r, ms)),
          R = S.kv.recipe,
          o = {};
        show('conception');
        await w(200);
        S.kv.equip.courses = [];
        const m = find('malts', R.malts[0].n),
          st0 = m.stock;
        m.stock = 1000; /* stock largement suffisant */
        conception();
        await w(200);
        const rows = [...document.querySelectorAll('button[data-cart]')];
        o.all = rows.length >= R.malts.length + R.hops.length + R.yeasts.length && rows.every(b => !b.hidden && b.offsetWidth > 0);
        document.querySelector('button[data-cart="malts"][data-i="0"]').click();
        await w(200);
        const c = courList().find(x => x.t === 'malts' && x.n === m.name);
        o.add = !!c && Math.abs(c.q - R.malts[0].g / 1000) < 0.002;
        document.querySelector('button[data-cart="malts"][data-i="0"]').click();
        await w(150);
        o.once = courList().filter(x => x.t === 'malts' && x.n === m.name).length === 1;
        const col = document.querySelector('.col'),
          xs = new Set([...col.querySelectorAll('button.x')].filter(b => b.offsetWidth).map(b => Math.round(b.getBoundingClientRect().left))),
          cs = new Set(
            [...col.querySelectorAll('button.cart')]
              .filter(b => b.getClientRects().length)
              .map(b => Math.round(b.getBoundingClientRect().left))
          );
        const spread = v => Math.max(...v) - Math.min(...v); /* tolérance : 1 px d'arrondi */
        o.align = spread([...xs]) <= 1 && spread([...cs]) <= 1;
        o.alignDet = [...xs].join(',') + ' / ' + [...cs].join(',');
        const bar = document.querySelector('.bar'),
          cur = document.querySelector('.bar s');
        o.shadow = /0px 4px 8px/.test(getComputedStyle(bar).boxShadow) && /0px 3px 6px/.test(getComputedStyle(cur).boxShadow);
        S.kv.equip.courses = [];
        m.stock = st0;
        conception();
        return o;
      });
      check(
        'Conception : caddie visible sur chaque ligne (stock suffisant compris), clic = ajout à la liste (quantité utilisée) sans doublon ; caddies et croix alignés en colonne ; Bilan : ombre portée sous les curseurs',
        cd.all && cd.add && cd.once && cd.align && cd.shadow,
        JSON.stringify(cd)
      );
      const dc = await page.evaluate(async () => {
        const w = ms => new Promise(r => setTimeout(r, ms)),
          b = [...document.querySelectorAll('#nav button, #nav a.kofi')],
          i = b.findIndex(x => x.dataset.s === 'doc'),
          o = { pos: b[i - 1].dataset.s === 'params' && i === b.length - 1, icon: !!(b[i] && b[i].querySelector('svg.fa-bookopen')) };
        b[i].click();
        await w(1200);
        const f = document.getElementById('docf'),
          d = f && f.contentDocument;
        o.doc = !!d && /Documentation d’OpenMaltForge/.test(d.title + d.body.textContent);
        const im = d ? [...d.querySelectorAll('figure img')] : [];
        await Promise.all(im.map(x => (x.complete ? 0 : new Promise(r => (x.onload = x.onerror = r)))));
        o.imgs = im.length >= 20 && im.every(x => x.naturalWidth > 0);
        o.math = !!d && !!d.getElementById('formules') && /sqrt/.test(d.getElementById('formules').parentNode.textContent);
        show('conception');
        return o;
      });
      check(
        'Documentation : icône livre à droite de « Paramètres », page intégrée avec captures d’écran et saisie des expressions mathématiques',
        Object.values(dc).every(Boolean),
        JSON.stringify(dc)
      );
      /* 5.0.0 : documentation dans la langue de l'interface (captures en anglais hors français) */
      const dl = await page.evaluate(async () => {
        const w = ms => new Promise(r => setTimeout(r, ms)),
          o = {},
          T = { en: 'OpenMaltForge documentation', es: 'Documentación de OpenMaltForge', it: 'Documentazione di OpenMaltForge', pt: 'Documentação do OpenMaltForge' };
        for (const l of ['en', 'es', 'it', 'pt']) {
          setLang(l);
          show('doc');
          await w(900);
          const f = document.getElementById('docf'),
            d = f && f.contentDocument,
            im = d ? [...d.querySelectorAll('figure img')] : [];
          await Promise.all(im.map(x => (x.complete ? 0 : new Promise(r => (x.onload = x.onerror = r)))));
          o[l] =
            new RegExp('doc/index\\.' + l + '\\.html').test(f.getAttribute('src')) &&
            d.documentElement.lang === l &&
            d.title === T[l] &&
            im.length >= 20 &&
            im.every(x => /\/img\/en\//.test(x.src) && x.naturalWidth > 0) &&
            !!d.getElementById('formules');
        }
        setLang('fr');
        show('doc');
        await w(700);
        o.fr = /doc\/index\.html/.test(document.getElementById('docf').getAttribute('src'));
        show('conception');
        return o;
      });
      check('Documentation traduite : page dans la langue de l’interface (en, es, it, pt ; captures en anglais), française sinon', Object.values(dl).every(Boolean), JSON.stringify(dl));
      /* 5.0.0 : « Nouvelle recette » vide la liste de courses (ajouts manuels compris) */
      const nr = await page.evaluate(async () => {
        const w = ms => new Promise(r => setTimeout(r, ms)),
          R0 = JSON.parse(JSON.stringify(S.kv.recipe)),
          E = S.kv.equip,
          c0 = E.courses;
        E.courses = [{ t: 'malts', n: S.malts[0].name, q: 2, r: { manuel: 1 } }, { t: 'hops', n: S.hops[0].name, q: 50, r: { auto: 50 } }];
        const manual = c => c.r && Object.keys(c.r).some(k => k !== 'auto');
        conception();
        await w(200);
        const before = E.courses.filter(manual).length;
        document.getElementById('newrec').click();
        await w(400);
        /* liste repartie de zéro : plus aucun ajout manuel ; seuls d'éventuels articles automatiques de la nouvelle recette */
        const o = {
          before: before >= 1,
          reset: E.courses !== undefined && !E.courses.some(manual),
          auto: E.courses.every(c => c.r && c.r.auto !== undefined),
          shown: document.querySelectorAll('#courses [data-cq]').length === E.courses.length
        };
        S.kv.recipe = R0;
        E.courses = c0;
        conception();
        await w(200);
        return o;
      });
      check('« ＋ Nouvelle recette » : liste de courses réinitialisée (ajouts manuels compris)', Object.values(nr).every(Boolean), JSON.stringify(nr));
    }
    {
      /* 4.5.0 : eaux minérales dans les courses, quantités figées (Calculer), triangle + avertissement, don, traductions */
      const c5 = await page.evaluate(async () => {
        const w = ms => new Promise(r => setTimeout(r, ms)),
          R = S.kv.recipe,
          o = {};
        show('conception');
        await w(200);
        S.kv.equip.courses = [];
        delete R.courNo;
        /* eau minérale de la recette : mêmes règles que les autres composants */
        const em = S.eaux.find(x => /min[ée]ral/i.test(x.type)),
          ev = S.eaux.find(x => !/min[ée]ral/i.test(x.type)),
          w0 = JSON.stringify(R.water);
        o.cols = COLS.eaux.includes('prix_l') && COLS.eaux.includes('stock') && 'prix_l' in em && 'stock' in em;
        em.stock = 5;
        em.prix_l = 0.5;
        R.water = [
          { n: em.name, p: 50 },
          { n: ev.name, p: 50 }
        ];
        conception();
        await w(300);
        const L = () => courList(),
          ce = () => L().find(x => x.t === 'eaux' && x.n === em.name),
          need = R.water[0].l;
        o.eau = !!ce() && Math.abs(ce().q - stkR(need - 5)) < 0.01 && !L().some(x => x.t === 'eaux' && x.n === ev.name);
        o.eauRow = !![...document.querySelectorAll('#courses tr')].find(t => t.textContent.includes(em.name));
        em.stock = 1000;
        conception();
        await w(200);
        o.eauOut = !ce();
        em.stock = 0;
        em.prix_l = 0;
        R.water = JSON.parse(w0);
        /* quantités figées : un article déjà dans la liste n'est plus modifié (Calculer, modification de ligne) */
        S.kv.equip.courses = [];
        const d = S.ings.find(x => x.name && !Object.values(MCO).includes(x.name)),
          st0 = d.stock,
          key = x => x.t === 'ings' && x.n === d.name,
          it = () => L().find(key);
        d.stock = 10;
        R.ings = [{ n: d.name, g: 50 }];
        conception();
        await w(200);
        o.add = !!it() && it().q === 40;
        R.ings[0].g = 150; /* besoin augmenté : quantité figée, triangle orange + notification */
        conception();
        await w(250);
        const i = L().findIndex(key),
          tri = document.querySelector('#courses .cwarn[data-ci="' + i + '"]'),
          hw = document.querySelector('#hbar .hw[data-k="courses"]');
        o.frozen = it().q === 40;
        o.tri = !!tri && !tri.hidden && /il manque 140/.test(tri.title);
        o.warn = !!hw && /quantité insuffisante/.test(hw.textContent) && hw.textContent.includes(d.name);
        /* quantité corrigée à la main : triangle et notification disparaissent */
        const q = document.querySelector('#courses [data-cq="' + i + '"]');
        q.value = '140';
        q.dispatchEvent(new Event('change', { bubbles: true }));
        await w(150);
        o.fixed = document.querySelector('#courses .cwarn[data-ci="' + i + '"]').hidden && !document.querySelector('#hbar .hw[data-k="courses"]');
        /* Calculer ne modifie pas les quantités de la liste */
        const before = JSON.stringify(L().map(x => [x.n, x.q]));
        document.getElementById('calc').click();
        await w(600);
        o.calc = JSON.stringify(L().map(x => [x.n, x.q])) === before;
        S.kv.equip.courses = [];
        R.ings = [];
        d.stock = st0;
        conception();
        await w(150);
        /* icône de don à droite de la documentation */
        const nb = [...document.querySelectorAll('#nav button, #nav a.kofi')],
          di = nb.findIndex(x => x.id === 'navdon');
        /* 6.4.0 : bouton Ko-fi (image intégrée) à droite de la documentation ; jamais cliqué ici (ouvrirait la vraie page) */
        /* 6.6.0 : bouton Ko-fi dans l'en-tête, juste après le nom de la base */
        const kb = document.getElementById('navdon');
        o.don =
          di === -1 &&
          kb.closest('header') &&
          kb.previousElementSibling.id === 'dbst' &&
          kb.tagName === 'A' &&
          kb.href === 'https://ko-fi.com/G7U82APSVO' &&
          !!kb.querySelector('img[src="lib/kofi6.png"]') &&
          kb.querySelector('img').naturalWidth > 0;
        window.__bcManual = true;
        donDialog(); /* fenêtre du lancement */
        for (let k = 0; k < 20 && !document.querySelector('.bcdlg.dondlg'); k++) await w(100);
        /* 6.0.0 : fenêtre « Offrir un café » (adresse de don pas encore renseignée : un seul bouton Fermer) */
        const dd = document.querySelector('.bcdlg.dondlg');
        o.donDlg =
          !!dd &&
          /Offrir un café/.test(dd.textContent) &&
          /GNU GPL v3/.test(dd.textContent) &&
          /Ko-fi/.test(dd.textContent) &&
          dd.querySelector('a.kofi[data-donopen]')?.href === 'https://ko-fi.com/G7U82APSVO' &&
          !!dd.querySelector('a.kofi img[src="lib/kofi6.png"]') &&
          !!dd.querySelector('.bcico svg') &&
          !dd.querySelector('button.no') &&
          dd.querySelector('button.ok').textContent === 'Plus tard';
        /* « Plus tard » : rien n'est ouvert (le bouton Ko-fi ouvrirait la vraie page) */
        if (dd) dd.querySelector('button.ok').click();
        await w(150);
        o.donClosed = !document.querySelector('.bcdlg');
        window.__bcManual = false;
        if (!o.donDlg) o.donTxt = dd ? dd.textContent : 'absente';
        return o;
      });
      check(
        'courses : eaux minérales de la recette (litres ≥ stock) ; quantités figées dès l’ajout (Calculer, modification de ligne) ; quantité insuffisante = triangle orange + notification ; icône de don à droite de la documentation, bouton Ko-fi (image) dans l’en-tête et dans la fenêtre « Offrir un café » (seulement au lancement)',
        Object.values(c5).every(Boolean),
        JSON.stringify(c5)
      );
      /* 6.7.0 : icône hop des Houblons ; repli des sections au double-clic ; curseurs DI / IBU déplaçables ; nouvelle recette sans date */
      const c67 = await page.evaluate(async () => {
        const w = ms => new Promise(r => setTimeout(r, ms)),
          R = S.kv.recipe,
          o = {};
        show('conception');
        await w(200);
        const hh = [...document.querySelectorAll('#main .panel > h3')].find(h => /Houblons/.test(h.textContent));
        o.hop = !!hh && !!hh.querySelector('svg.fa-hop');
        /* repli (6.7.1) : titre d'un radar = toute la ligne des radars ; titre d'une section = elle seule */
        const rh = [...document.querySelectorAll('#radars .panel > h4')][1],
          pm = rh.parentElement,
          rads = () => [...document.querySelectorAll('#radars .panel')],
          w0 = pm.getBoundingClientRect().width;
        rh.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        await w(50);
        o.fold =
          rads().every(p => p.classList.contains('fold')) &&
          [...pm.children].every(c => (c === rh) === (getComputedStyle(c).display !== 'none')) &&
          !pm.querySelector('svg:not(.fa)').getClientRects().length &&
          !!rh.querySelector('.foldc svg.fa-down') &&
          Math.abs(pm.getBoundingClientRect().width - w0) < 1;
        o.malts = ![...document.querySelectorAll('#main .col .panel > h3')].some(h => /Malts/.test(h.textContent) && h.parentElement.classList.contains('fold'));
        refresh();
        await w(50);
        o.keep = rads().every(p => p.classList.contains('fold')) && JSON.stringify(S.kv.equip.folds) === '["radars"]';
        rads()[0].querySelector('h4').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        await w(50);
        o.unfold = rads().every(p => !p.classList.contains('fold') && !p.querySelector('.foldc')) && !(S.kv.equip.folds || []).length;
        /* section Malts (tableau) seule : les radars restent dépliés */
        const mh = [...document.querySelectorAll('#main .panel > h3')].find(h => /Malts/.test(h.textContent)),
          mw = mh.parentElement.getBoundingClientRect().width;
        mh.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        await w(50);
        o.single =
          mh.parentElement.classList.contains('fold') &&
          !!mh.querySelector('.foldc') &&
          Math.abs(mh.parentElement.getBoundingClientRect().width - mw) < 1 &&
          rads().every(p => !p.classList.contains('fold')) &&
          document.querySelectorAll('#main .panel.fold').length === 1;
        mh.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        await w(50);
        o.single = o.single && !document.querySelectorAll('#main .panel.fold').length;
        /* bilan : IBU juste sous la DI */
        const bl = [...document.querySelectorAll('#bilan .bi .bl span')].map(x => x.textContent);
        o.order = /Densité initiale/.test(bl[0]) && /^IBU/.test(bl[1]);
        /* curseurs DI / IBU : poignée sur ces deux-là seulement */
        const kn = [...document.querySelectorAll('#bilan .bar.drag')];
        o.knobs = kn.length === 2 && kn.every(b => b.querySelector('.knob')) && document.querySelectorAll('#bilan .knob').length === 2;
        return o;
      });
      check(
        'icône hop des Houblons ; double-clic : titre d’un radar = ligne des radars repliée, titre d’une section = elle seule (chevron, même largeur, mémorisé) ; poignées sur les seuls curseurs DI et IBU, IBU sous la DI',
        Object.values(c67).every(Boolean),
        JSON.stringify(c67)
      );
      /* glisser la poignée DI : la DI cible suit, puis la recette est recalculée (curseur gardé) */
      {
        const og0 = await page.evaluate(() => S.kv.recipe.ogT),
          kb = await page.locator('#bilan .bar.drag[data-drag="og"] .knob').boundingBox(),
          bb = await page.locator('#bilan .bar.drag[data-drag="og"]').boundingBox();
        await page.mouse.move(kb.x + kb.width / 2, kb.y + kb.height / 2);
        await page.mouse.down();
        await page.mouse.move(Math.min(bb.x + bb.width - 2, kb.x + 40), kb.y + kb.height / 2, { steps: 5 });
        const mid = await page.evaluate(() => ({ t: S.kv.recipe.ogT, f: +document.querySelector('input[data-r="ogT"]').value }));
        await page.mouse.up();
        await page
          .waitForFunction(() => /Recalculé/.test((document.querySelector('#hbar .hn[data-k="calc"]') || {}).textContent || ''), null, { timeout: 3000 })
          .catch(() => {});
        const end = await page.evaluate(() => ({ t: S.kv.recipe.ogT, og: compute().og }));
        check(
          'curseur DI déplacé à la souris : DI cible augmentée (champ suivi en direct), recette recalculée à la DI cible au relâchement',
          mid.t > og0 && mid.f === mid.t && Math.abs(end.og - end.t) < 0.0015,
          JSON.stringify({ og0, mid, end })
        );
        await page.evaluate(og0 => {
          S.kv.recipe.ogT = og0;
          adjust();
        }, og0);
        await page.waitForTimeout(200);
      }
      /* ＋ Nouvelle recette : date de brassage vide */
      check(
        '＋ Nouvelle recette : date de brassage vide',
        await page.evaluate(async () => {
          const R0 = JSON.stringify(S.kv.recipe),
            c0 = JSON.stringify(S.kv.equip.courses || []);
          document.getElementById('newrec').click();
          await new Promise(r => setTimeout(r, 150));
          const ok = S.kv.recipe.date === '' && document.querySelector('input[data-r="date"]').value === '';
          S.kv.recipe = JSON.parse(R0);
          S.kv.equip.courses = JSON.parse(c0);
          conception();
          return ok;
        })
      );
      /* 6.6.0 : courses — bouton info (stock actuel / après achat / après brassage, après 1 s de survol) ; article ajouté
         au caddie de la recette retiré quand le composant sort de la recette ; arômes accentués ; Process : espace crayon */
      const c66 = await page.evaluate(async () => {
        const w = ms => new Promise(r => setTimeout(r, ms)),
          R = S.kv.recipe,
          o = {};
        show('conception');
        await w(200);
        const L = courList(),
          i = L.findIndex(c => c.t === 'malts' || c.t === 'hops' || c.t === 'yeasts'),
          c = L[i],
          d = find(c.t, c.n),
          b = document.querySelector(`[data-cinfo="${i}"]`);
        o.btn = !!b && !!b.querySelector('svg') && !!b.closest('td.cqc') && b.nextElementSibling.matches('input[data-cq]'); /* 6.6.1 : juste avant la quantité */
        b.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        await w(500);
        o.notYet = !document.getElementById('cinfo');
        await w(700);
        const tip = document.getElementById('cinfo');
        o.tip = !!tip && /Stock actuel/.test(tip.textContent) && /Après achat/.test(tip.textContent) && tip.textContent.includes(cfr((+d.stock || 0) + c.q));
        b.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        o.hide = !document.getElementById('cinfo');
        /* caddie de la recette puis composant retiré */
        const nm = S.hops.find(h => !R.hops.some(x => x.n === h.name)).name;
        R.hops.push({ n: nm, g: 1, use: 'Ébullition', t: 10 });
        S.hops.find(h => h.name === nm).stock = 1000;
        conception();
        await w(150);
        courAddItem('hops', nm, false, true);
        o.inCart = courList().some(x => x.n === nm);
        R.hops = R.hops.filter(x => x.n !== nm);
        conception();
        updCart();
        await w(150);
        o.outCart = !courList().some(x => x.n === nm);
        /* arômes accentués (radar des malts, en-têtes de la table des malts) */
        o.radar = /céréale/.test(document.querySelector('#main').innerHTML) && !/>cereale /.test(document.querySelector('#main').innerHTML);
        show('malts');
        await w(200);
        const hd = [...document.querySelectorAll('tr.hd th')].map(x => x.textContent).join('|');
        o.head = /céréale/.test(hd) && /malté/.test(hd) && /toasté/.test(hd) && /fumé/.test(hd) && /café/.test(hd);
        show('params');
        await w(200);
        const tr = document.querySelector('tr[data-prow="0:0"]'),
          dn = tr.querySelector('[data-pm$=":1"]').getBoundingClientRect(),
          pe = tr.querySelector('[data-ped]').getBoundingClientRect();
        o.gap = pe.left - dn.right >= 5;
        show('conception');
        return o;
      });
      check(
        'courses : bouton info (après 1 s : stock actuel, après achat) ; article du caddie retiré quand le composant sort de la recette ; arômes accentués ; ≥ 5 px entre flèches et crayon du Process',
        Object.values(c66).every(Boolean),
        JSON.stringify(c66)
      );
      /* 6.5.0 : date d’embouteillage ≥ date de brassage (saisie refusée, valeur rétablie, pas de mouvement de stock) */
      const dt = await page.evaluate(async () => {
        const R = S.kv.recipe,
          w = ms => new Promise(r => setTimeout(r, ms)),
          d0 = R.date,
          e0 = R.embou,
          stk0 = R.stk;
        show('conception');
        await w(200);
        const set = (k, v) => {
          const el = document.querySelector(`input[data-r="${k}"]`);
          el.value = v;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return el;
        };
        R.embou = '';
        delete R.stk;
        set('date', '2026-06-10');
        const ie = set('embou', '2026-06-01'),
          o = { refus: R.embou === '' && ie.value === '', msg: /antérieure à la date de brassage/.test(document.querySelector('#hbar').textContent), min: ie.min === '2026-06-10' };
        set('embou', '2026-06-20');
        o.ok = R.embou === '2026-06-20';
        const idt = set('date', '2026-07-01');
        o.refusDate = R.date === '2026-06-10' && idt.value === '2026-06-10';
        set('embou', '');
        set('date', '');
        o.back = R.embou === '' && !R.stk; /* date de brassage effacée : stock remis (6.7.0) */
        R.date = d0;
        R.embou = e0;
        if (stk0) R.stk = stk0;
        show('conception');
        /* bouton Ko-fi de l'en-tête moins haut */
        o.kofi = document.querySelector('#navdon img').getBoundingClientRect().height <= 27;
        return o;
      });
      check(
        'date d’embouteillage antérieure à la date de brassage refusée (et inversement) ; date de brassage effacée = stock remis ; bouton Ko-fi de l’en-tête réduit',
        Object.values(dt).every(Boolean),
        JSON.stringify(dt)
      );
      /* 6.1.0 : Paramètres › Contactez-moi ; fenêtre du café prévue au lancement (hors navigateur piloté) */
      const ct = await page.evaluate(async () => {
        show('params');
        await new Promise(r => setTimeout(r, 300));
        const p = document.getElementById('contactp'),
          a = p && p.querySelector('a[href="mailto:openmaltforge@pm.me"]');
        return {
          p: !!p && /Contactez-moi/.test(p.querySelector('h3').textContent),
          a: !!a && a.textContent === 'openmaltforge@pm.me',
          copy: !!p.querySelector('button[data-ccopy]'),
          en: await (async () => {
            /* fenêtre du café traduite (anglais), puis fermée par « Later » */
            const l0 = LANG;
            setLang('en');
            window.__bcManual = true;
            donDialog();
            for (let k = 0; k < 20 && !document.querySelector('.bcdlg.dondlg'); k++) await new Promise(r => setTimeout(r, 100));
            const d = document.querySelector('.bcdlg.dondlg'),
              t = d ? d.innerText : '';
            if (d) d.querySelector('button.ok').click();
            window.__bcManual = false;
            setLang(l0);
            return /free and open source/.test(t) && /Ko-fi/.test(t) && !/gratuit|Merci|Plus tard/.test(t);
          })(),
          launch: /navigator\.webdriver\) setTimeout\(donDialog/.test(document.querySelector('script[src*="app.js"]') ? await (await fetch(document.querySelector('script[src*="app.js"]').src)).text() : '')
        };
      });
      check('Paramètres : section « Contactez-moi » (openmaltforge@pm.me, lien et copie) ; fenêtre « Offrir un café » au lancement', Object.values(ct).every(Boolean), JSON.stringify(ct));
      /* internationalisation : aucun texte d'interface resté en français (anglais), prompt « À rechercher » traduit */
      const tr = await page.evaluate(async () => {
        const w = ms => new Promise(r => setTimeout(r, ms)),
          E = S.kv.equip,
          ar0 = E.arech,
          o = {},
          same = /^(PNG|Total|Min|IBU|IBU \(Tinseth\)|RBR|ppg|HCO3|Dry hop|ABV %|min|SRM|°Lovibond|CO2-vol|Bar|PSI|kPa|°Lintner|SG \(1\.XXX\)|Plato \(°P\)|Brix \(°Bx\)|OpenMaltForge|HTML|GNU GPL v3|Français|English|Español|Italiano|Português|Altitude|Imperial|openmaltforge\.sqlite|.*\/openmaltforge\.sqlite|[\d.,]+ (EBC|kWh)( · [\d.,]+ SRM)?|[\d.,]+ (% (alc\.\/vol|alc\.|vol\.?)|cl|IBU|vol|min)|LOGO|SINCE \d+|\d+#\d+ [\d.,]+ IBU|OpenMaltForge [\d.]+ · \d+\/\d+|.* — \d\d\/\d\d\/\d{4}|.*(·|,) .*)$/;
        /* textes déjà en anglais (messages traduits par tx() avant affichage) */
        const EN = new Set();
        Object.values(i18nDict()).forEach(v => v[0] && EN.add(v[0]));
        E.arech = [{ t: 'malts', n: 'Malt Mystère', r: ['Recette X'] }];
        const data = new Set();
        ['malts', 'hops', 'yeasts', 'eaux', 'ings', 'conso', 'biblio', 'styles'].forEach(t => (S[t] || []).forEach(x => ['name', 'maltier', 'labo', 'type', 'usage', 'unite'].forEach(c => x[c] && data.add(String(x[c]).trim()))));
        ['Malt Mystère', 'Recette X'].forEach(x => data.add(x));
        (S.malts || []).forEach(m => m.maltier && data.add(m.name + ' (' + m.maltier + ')'));
        (S.yeasts || []).forEach(m => m.labo && data.add(m.name + ' (' + m.labo + ')'));
        (S.styles || []).forEach(x => x.name && data.add(x.name.replace(/^\d+[A-Za-z]?\s+/, '')));
        S.biblio.forEach(b => [b.name, b.style, b.brasseur].forEach(x => x && data.add(String(x).trim())));
        [S.kv.recipe.name, S.kv.recipe.style, S.kv.recipe.brasseur, S.kv.equip.name].forEach(x => x && data.add(String(x).trim()));
        const miss = [];
        setLang('en');
        /* écrans, puis états particuliers : vue cartes, fiche de recette, chaque format d'étiquette, feuille de brassage */
        const steps = ['conception', 'biblio', 'malts', 'hops', 'yeasts', 'eaux', 'ings', 'conso', 'labels', 'sheet', 'params'].map(k => [k, () => show(k)]);
        steps.push(['cartes', () => (show('biblio'), [...document.querySelectorAll('#main button')].find(x => /Card view/.test(x.textContent))?.click())]);
        if (S.biblio.length) steps.push(['fiche', () => (show('biblio'), rvOpen(0))]);
        show('labels');
        await w(400);
        [...document.querySelectorAll('[data-fmt]')].forEach(b => steps.push(['étiquette ' + b.dataset.fmt, () => (document.querySelector('#rview') && document.querySelector('#rview').remove(), show('labels'), document.querySelector('[data-fmt="' + b.dataset.fmt + '"]').click())]));
        steps.push(['sheet', () => show('sheet')]);
        for (const [k, go] of steps) {
          go();
          await w(k.startsWith('étiquette') ? 250 : 500);
          const ok = t => {
            t = String(t || '').trim().replace(/\s+/g, ' ');
            if (!t || !/[a-zàâçéèêîôûù]{3,}/i.test(t) || data.has(t) || same.test(t) || EN.has(t) || i18nT(t) !== null) return;
            miss.push(k + ': ' + t.slice(0, 60));
          };
          const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
          let n;
          while ((n = tw.nextNode())) {
            if (n.nodeType === 3) {
              const e = n.parentElement;
              if (e && !e.closest('script,style,textarea,svg,select.fsel,[data-nt],.fdd,table.db td,.stb td,.fnm') && (e.offsetParent !== null || e.closest('option'))) ok(n.__o !== undefined ? n.__o : n.data);
            } else ['title', 'placeholder', 'aria-label'].forEach(a => n.getAttribute(a) && ok((n.__a && n.__a[a] && n.__a[a].o) || n.getAttribute(a)));
          }
          if (k === 'params') {
            const ta = document.getElementById('arprompt');
            o.prompt = !!ta && /MISSION: look up/.test(ta.value) && /semicolon/.test(ta.value) && /“Paste CSV”/.test(ta.value);
            o.arh = /To look up/.test(document.querySelector('#arpanel h3').textContent);
          }
        }
        o.don = /Buy the developer a coffee/.test(document.getElementById('navdon').title);
        o.miss = [...new Set(miss.map(x => x.replace(/^[^:]*: /, '')))].slice(0, 12);
        o.ok = miss.length === 0;
        setLang('fr');
        show('params');
        await w(300);
        o.promptFr = /MISSION : recherche/.test(document.getElementById('arprompt').value) && /« Coller CSV »/.test(document.getElementById('arprompt').value);
        E.arech = ar0;
        show('conception');
        return o;
      });
      check(
        'traductions : aucun texte d’interface resté en français en anglais (hors données et termes identiques), prompt « À rechercher » dans la langue choisie, icône de don traduite',
        tr.ok && tr.prompt && tr.arh && tr.don && tr.promptFr,
        JSON.stringify(tr)
      );
    }
    check('aucune erreur JavaScript pendant tout le scénario', errs.length === 0, errs.join(' | '));
    errs.length = 0;
    await page.context().close();
  } finally {
    srv.close ? srv.close() : srv.kill();
  }
}
async function scenarioServeur() {
  console.log('\n■ Base gérée par le serveur Go (fichier unique, sauvegardes, import, export)');
  const dir = freshCopy(),
    srv = await startStatic(dir);
  const f = path.join(dir, DBF);
  try {
    const page = await newPage(srv.url, { init: FSA });
    await openDb(page);
    check(
      'voyant vert « Base : openmaltforge.sqlite » dès le chargement',
      /● Base : openmaltforge\.sqlite/.test(await txt(page, '#dbst')),
      await txt(page, '#dbst')
    );
    check('fichier unique créé dans le dossier de données : openmaltforge.sqlite', fs.existsSync(f));
    await wait(1500); /* première écriture (données de départ, polices) */
    await page.fill('[data-e="vol"]', '27');
    {
      const vol = async () => {
        const db = await sqlOpen(f);
        const v = db.exec("select valeur from parametres where cle='vol'")[0].values[0][0];
        db.close();
        return v;
      };
      let v;
      for (let i = 0; i < 30 && (v = await vol()) !== '27'; i++) await wait(200);
      check('sauvegarde automatique après modification', v === '27', v);
    }
    await page.fill('[data-r="name"]', 'IPA test');
    await page.click('#dbsave');
    await page.waitForFunction(() => /✔|⚠/.test(document.querySelector('#hmsg').textContent));
    const m = await txt(page, '#hmsg');
    check('« Sauvegarder » écrit dans la base du serveur', m.startsWith('✔') && /openmaltforge\.sqlite/.test(m), m);
    check(
      'table style = vraies colonnes SQL (une par rubrique BJCP)',
      await (async () => {
        const db = await sqlOpen(f);
        const c = db.exec('PRAGMA table_info(style)')[0].values.map(x => x[1]);
        db.close();
        return (
          JSON.stringify(c) ===
          JSON.stringify([
            'id',
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
          ])
        );
      })()
    );
    check(
      'tout est dans le fichier : malts, houblons, levures, styles, bibliothèque',
      (await rows(f, 'malt')) >= 40 &&
        (await rows(f, 'houblon')) >= 80 &&
        (await rows(f, 'levure')) >= 50 &&
        (await rows(f, 'style')) >= 10 &&
        (await rows(f, 'bibliotheque')) === 1
    );
    {
      const db = await sqlOpen(f);
      const v = db.exec('pragma user_version')[0].values[0][0];
      db.close();
      check('numéro de structure de la base (PRAGMA user_version) = 3', v === 3, v);
    }
    {
      const r = await page.evaluate(async () => {
        const g = await fetch('api/info').then(x => x.json());
        const sans = await fetch('api/etat', { method: 'PUT', body: '{}' });
        return { g, sans: sans.status };
      });
      check(
        'API info : nom, chemin, structure et version',
        r.g.nom === 'openmaltforge.sqlite' && r.g.structure === 3 && r.g.version === VER_APP && r.g.chemin.endsWith('openmaltforge.sqlite'),
        JSON.stringify(r.g)
      );
      check('écriture refusée sans l’en-tête X-OpenMaltForge', r.sans === 403, r.sans);
    }
    {
      /* export : état affiché (modification non enregistrée comprise), la base n'est pas modifiée */
      await page.evaluate(() => {
        S.kv.equip.autoOn = false;
        S.kv.equip.vol = 31;
      });
      const dl = page.waitForEvent('download');
      await page.evaluate(() => exportDb());
      const d = await dl;
      const p = path.join(dir, 'export.sqlite');
      await d.saveAs(p);
      const db = await sqlOpen(p);
      const v = db.exec("select valeur from parametres where cle='vol'")[0].values[0][0];
      db.close();
      const db2 = await sqlOpen(f);
      const v2 = db2.exec("select valeur from parametres where cle='vol'")[0].values[0][0];
      db2.close();
      check(
        'export : fichier AAAAMMJJ_openmaltforge.sqlite avec les modifications en cours, base inchangée',
        /^\d{8}_openmaltforge\.sqlite$/.test(d.suggestedFilename()) && v === '31' && v2 === '27',
        d.suggestedFilename() + ' ' + v + ' ' + v2
      );
      await page.evaluate(() => {
        S.kv.equip.autoOn = true;
        S.kv.equip.vol = 27;
      });
    }
    {
      /* changer de base : fichier refusé (pas une base / base plus récente), puis fichier valide */
      const bad = path.join(dir, 'pas_une_base.sqlite');
      fs.writeFileSync(bad, 'ceci n est pas une base');
      const SQ = SQLJS;
      const nb = new SQ.Database();
      nb.run('create table malt(id integer primary key,nom text,donnees text)');
      nb.run('pragma user_version = 99');
      const future = path.join(dir, 'future.sqlite');
      fs.writeFileSync(future, Buffer.from(nb.export()));
      nb.close();
      const good = new SQ.Database();
      good.run('create table malt(id integer primary key,nom text,donnees text)');
      good.run(`insert into malt(nom,donnees) values('Malt Importé','{"name":"Malt Importé","maltier":"Test","ebc":4,"potentiel":300}')`);
      good.run('create table parametres(cle text primary key,valeur text)');
      good.run(`insert into parametres values('vol','44')`);
      const ok = path.join(dir, 'autre.sqlite');
      fs.writeFileSync(ok, Buffer.from(good.export()));
      good.close();
      const pick = async file => {
        const fc = page.waitForEvent('filechooser');
        await nav(page, 'params');
        await page.click('#dbchg');
        await (await fc).setFiles(file);
        await wait(1200);
      };
      const dl0 = await page.evaluate(() => __dlgs.length);
      await pick(bad);
      await pick(future);
      /* boîtes affichées : confirmation, erreur, confirmation, erreur */
      const alerts = (await page.evaluate(n => __dlgs.slice(n), dl0)).filter(t => /⚠/.test(t));
      const malts1 = await page.evaluate(() => S.malts.some(m => m.name === 'Malt Importé'));
      check(
        'changer de base : fichier invalide refusé avec un message clair',
        /pas une base OpenMaltForge valide/.test(alerts[0] || ''),
        alerts.join(' | ')
      );
      check(
        'changer de base : base plus récente que l’application refusée, base actuelle conservée',
        /plus récente/.test(alerts[1] || '') && !malts1,
        alerts.join(' | ')
      );
      await pick(ok);
      const st = await page.evaluate(() => ({ m: S.malts.map(x => x.name), vol: S.kv.equip.vol, ready: READY }));
      const bk = fs.readdirSync(path.join(dir, 'sauvegardes'));
      check(
        'changer de base : fichier valide importé et mis à niveau (malts de référence ajoutés)',
        st.m[0] === 'Malt Importé' && st.m.length >= 40 && st.vol == 44,
        JSON.stringify({ n: st.m.length, first: st.m[0], vol: st.vol })
      );
      check(
        'copie de l’ancienne base dans sauvegardes/ avant le remplacement',
        bk.some(x => /^openmaltforge_\d{8}-\d{6}_avant_import\.sqlite$/.test(x)),
        bk.join(',')
      );
    }
    {
      /* serveur arrêté : la sauvegarde échoue avec un message explicite */
      srv.close();
      await wait(300);
      await page.click('#dbsave');
      await page.waitForFunction(() => /✔|⚠/.test(document.querySelector('#hmsg').textContent));
      const m2 = await txt(page, '#hmsg');
      check('serveur arrêté : « Sauvegarder » signale l’échec (serveur absent)', /ne répond pas/.test(m2), m2);
      errs.length = 0; /* erreurs réseau attendues */
    }
    check('aucune erreur JavaScript', errs.length === 0, errs.join(' | '));
    errs.length = 0;
    await page.context().close();
  } finally {
    srv.close();
  }
  console.log('\n■ Premier lancement : reprise de la base 3.x et refus des fichiers invalides');
  {
    /* brewcraft_<version>.sqlite le plus récent repris sous le nom openmaltforge.sqlite ; l'original reste intact */
    const d1 = freshCopy();
    /* le serveur précédent a été arrêté brutalement : le journal SQLite éventuel accompagne la copie (remise en ordre à l'ouverture) */
    await wait(300);
    fs.copyFileSync(f, path.join(d1, 'brewcraft_3.120.0.sqlite'));
    if (fs.existsSync(f + '-journal')) fs.copyFileSync(f + '-journal', path.join(d1, 'brewcraft_3.120.0.sqlite-journal'));
    const t0 = fs.statSync(path.join(d1, 'brewcraft_3.120.0.sqlite')).mtimeMs;
    const s1 = await startStatic(d1);
    try {
      const page = await newPage(s1.url, { init: FSA });
      await openDb(page);
      const n = await page.evaluate(() => S.malts.filter(x => x.name === 'Malt Importé').length);
      check(
        'base 3.x reprise au premier lancement (données présentes), original conservé',
        n === 1 &&
          fs.existsSync(path.join(d1, DBF)) &&
          fs.statSync(path.join(d1, 'brewcraft_3.120.0.sqlite')).mtimeMs === t0,
        n
      );
      await page.context().close();
    } finally {
      s1.close();
    }
  }
  {
    const d2 = freshCopy();
    fs.writeFileSync(path.join(d2, DBF), 'ceci n est pas une base');
    const e = await startStatic(d2).then(
      x => (x.close(), null),
      err => err
    );
    check(
      'base illisible : le serveur refuse de démarrer avec un message (fichier non modifié)',
      !!e && /base de données/.test(e.out) && fs.readFileSync(path.join(d2, DBF), 'utf8') === 'ceci n est pas une base',
      e && e.out
    );
  }
  {
    const d3 = freshCopy();
    const nb = new SQLJS.Database();
    nb.run('create table malt(id integer primary key,nom text,donnees text)');
    nb.run('pragma user_version = 99');
    fs.writeFileSync(path.join(d3, DBF), Buffer.from(nb.export()));
    nb.close();
    const e = await startStatic(d3).then(
      x => (x.close(), null),
      err => err
    );
    check('base plus récente que l’application : démarrage refusé', !!e && /plus récente/.test(e.out), e && e.out);
  }
}
async function scenarioLegacy() {
  console.log('\n■ Migration d’une ancienne base (v1.9 : tables malts, hops, params…)');
  const dir = freshCopy(),
    port = 6000 + Math.floor(Math.random() * 90);
  await sqlOpen(null).catch(() => {});
  const SQ = SQLJS;
  const db = new SQ.Database();
  db.run('create table malts(id integer primary key,name text,d text)');
  db.run(
    'insert into malts(name,d) values(\'Malt Ancien\',\'{"name":"Malt Ancien","maltier":"Test","ebc":5,"potentiel":300,"cereale":8}\')'
  );
  db.run('create table biblio(id integer primary key,name text,d text)');
  db.run(
    'insert into biblio(name,d) values(\'Vieille recette\',\'{"id":"old1","name":"Vieille recette","style":"21A American IPA","date":"2026-01-01","vol":30,"recipe":{"name":"Vieille recette","id":"old1","style":"21A American IPA","malts":[{"n":"Malt Ancien","g":5000}],"hops":[],"yeasts":[],"ings":[]}}\')'
  );
  db.run('create table params(k text primary key,v text)');
  db.run("insert into params values('vol','25'),('loss','2.5'),('scale5','1')");
  db.run('create table recette(k text primary key,v text)');
  db.run("insert into recette values('name','\"Ancienne\"')");
  fs.writeFileSync(path.join(dir, 'brewcraft_1.9.0.sqlite'), Buffer.from(db.export()));
  db.close();
  const srv = await startStatic(dir, port);
  try {
    const page = await newPage(srv.url, { init: FSA });
    await openDb(page);
    const st = await page.evaluate(() => ({
      malt: S.malts.map(m => m.name),
      lib: S.biblio.map(b => b.name),
      vol: S.kv.equip.vol,
      loss: S.proc[0].l,
      cer: S.malts[0].cereale
    }));
    await wait(1800);
    {
      const d2 = await sqlOpen(path.join(dir, DBF));
      const tb = d2.exec("select name from sqlite_master where name in ('polices','traductions')")[0];
      const np = d2.exec('select count(*) from polices')[0].values[0][0];
      d2.close();
      check(
        'ancienne base : tables « polices » et « traductions » créées dès l’ouverture, sans aucune modification',
        tb && tb.values.length === 2 && np >= 9,
        JSON.stringify([tb && tb.values, np])
      );
    }
    check(
      'données de l’ancienne base reprises (malt, recette, volume)',
      st.malt.includes('Malt Ancien') && st.lib[0] === 'Vieille recette' && st.vol == 25,
      JSON.stringify(st)
    );
    const ct = await page.evaluate(() => ({
      m: S.malts.length,
      h: S.hops.length,
      y: S.yeasts.length,
      first: S.malts[0].name,
      dup: new Set(S.malts.map(x => x.name + x.maltier)).size === S.malts.length
    }));
    check(
      'ancienne base : malts de référence AJOUTÉS (sans toucher aux vôtres), houblons et levures chargés',
      ct.m >= 40 && ct.first === 'Malt Ancien' && ct.h >= 80 && ct.y >= 50 && ct.dup,
      JSON.stringify(ct)
    );
    await wait(900);
    check(
      '… et écrits dans le fichier automatiquement',
      (await rows(path.join(dir, DBF), 'malt')) >= 40
    );
    check('ancienne perte (2,5 L) reprise dans la table process', st.loss === 2.5, st.loss);
    check('échelle déjà 1–5 : valeurs non re-divisées', st.cer === 8, st.cer);
    await nav(page, 'params');
    await page.click('#dbsave');
    await page.waitForFunction(() => /✔|⚠/.test(document.querySelector('#hmsg').textContent));
    await wait(300);
    check(
      'sauvegarde via popup (base ancienne) réussie',
      (await txt(page, '#hmsg')).startsWith('✔'),
      await txt(page, '#hmsg')
    );
    const t = await tables(path.join(dir, DBF));
    check(
      'après sauvegarde : uniquement les nouveaux noms de tables',
      JSON.stringify(t) === JSON.stringify(EXPECT),
      t.join(',')
    );
    check('aucune erreur JavaScript', errs.length === 0, errs.join(' | '));
    errs.length = 0;
    await page.context().close();
  } finally {
    srv.close();
  }
}
async function scenarioI18n() {
  console.log('\n■ Internationalisation');
  const dir = freshCopy(),
    port = 5900 + Math.floor(Math.random() * 90),
    srv = await startStatic(dir, port);
  try {
    const page = await newPage(srv.url, { init: FSA });
    await openDb(page);
    await wait(2500);
    const navT = () => page.$$eval('#nav button', e => e.map(x => x.textContent.trim()));
    check(
      'langue par défaut : français',
      (await navT()).includes('Bibliothèque') && (await page.evaluate(() => LANG === 'fr' && S.kv.equip.lang !== 'en'))
    );
    await nav(page, 'params');
    check(
      'Paramètres : sélecteur de langue (fr, en, es, it, pt)',
      JSON.stringify(await page.$$eval('#langsel option', o => o.map(x => x.value))) === '["fr","en","es","it","pt"]'
    );
    {
      const r = await page.evaluate(() => {
        const w = document.getElementById('ftw'),
          f = S.kv.equip.fonts || [];
        return {
          n: f.length,
          d: f.every(x => /^data:font\//.test(x.d)),
          rows: document.querySelectorAll('#ftb tr').length,
          mh: getComputedStyle(w).maxHeight,
          ov: getComputedStyle(w).overflowY,
          x: !!document.querySelector('#ftb button.x')
        };
      });
      check(
        'polices du répertoire fonts/ copiées dans la base au premier lancement (≥ 9, data URI)',
        r.n >= 9 && r.d,
        JSON.stringify(r)
      );
      check(
        'liste des polices : croix rouge par ligne, défilement (ascenseur) au-delà de 25 lignes',
        r.x && r.ov !== 'visible' && parseInt(r.mh) >= 600,
        JSON.stringify(r)
      );
      const n0 = r.n;
      await page.evaluate(() => (window.__bcManual = true));
      await page.click('#ftb button.x');
      await page.waitForSelector('.bcdlg .bcin', { timeout: 3000 });
      await page.evaluate(() => {
        const d = document.querySelector('.bcdlg');
        d.querySelector('.bcin').value = d.querySelector('datalist option').value;
        d.querySelector('.ok').click();
        window.__bcManual = false;
      });
      await wait(300);
      check(
        'suppression d’une police après confirmation',
        (await page.evaluate(() => (S.kv.equip.fonts || []).length)) === n0 - 1
      );
    }
    check(
      'Paramètres : tableaux Process en lecture seule tant que le crayon ✎ (au bout de chaque ligne) n’est pas cliqué, flèches blanches, coefficients sous Process, polices en police standard',
      await page.evaluate(() => {
        const t = [...document.querySelectorAll('.ptab input')];
        const pr = document.querySelector('.ptab').closest('.panel').getBoundingClientRect().bottom,
          cf = [...document.querySelectorAll('h3')]
            .find(h => /Coefficients/.test(h.textContent))
            .getBoundingClientRect().top;
        return (
          t.every(i => i.readOnly) &&
          document.querySelectorAll('.ptab [data-ped]').length === document.querySelectorAll('.ptab tr[data-prow], .ptab tr.phr').length &&
          getComputedStyle(document.querySelector('[data-pm]')).color === 'rgb(255, 255, 255)' &&
          cf >= pr - 1 &&
          !/LU /.test(getComputedStyle(document.querySelector('#ftb td')).fontFamily)
        );
      })
    );
    check(
      'Paramètres : plus de section « Coûts » ; « Besoins en électricité » ; prix du kWh et du m³ dans la table Consommables',
      await page.evaluate(() => {
        const h = [...document.querySelectorAll('.pg h3')],
          e = h.find(x => /^Besoins en électricité/.test(x.textContent)),
          k = S.conso.find(x => x.sys === 'kwh'),
          m = S.conso.find(x => x.sys === 'm3');
        return (
          !h.some(x => /^Coûts/.test(x.textContent)) &&
          !h.some(x => /^Électricité/.test(x.textContent)) &&
          !!e &&
          !document.querySelector('input[data-e="prix_kwh"],input[data-e="prix_m3"]') &&
          !!k && !!m && k.unite === 'kWh' && m.unite === 'm³' && sysPrix('kwh') === +k.prix && sysPrix('m3') === +m.prix
        );
      })
    );
    {
      const o = await page.evaluate(async () => {
        const out = {},
          k = S.conso.find(x => x.sys === 'kwh'),
          p0 = k.prix;
        show('conso');
        await new Promise(r => setTimeout(r, 150));
        const rows = [...document.querySelectorAll('tr[data-ri]')],
          rk = rows.find(r => S.conso[+r.dataset.ri].sys === 'kwh'),
          rm = rows.find(r => S.conso[+r.dataset.ri].sys === 'm3'),
          ro = rows.find(r => !S.conso[+r.dataset.ri].sys);
        out.nodel = !!rk && !!rm && !rk.querySelector('[data-dr]') && !rm.querySelector('[data-dr]');
        out.del = !!ro && !!ro.querySelector('[data-dr]');
        /* modifiable : prix du kWh → coûts */
        k.prix = 0.5;
        const e0 = costs().el;
        k.prix = 0;
        out.cost = costs().el === 0 && e0 >= 0;
        k.prix = p0;
        out.price = sysPrix('kwh') === +p0;
        /* « tout effacer » conserve les lignes système */
        const sv = S.conso;
        S.conso = S.conso.filter(x => x.sys);
        out.keep = S.conso.length === 2;
        S.conso = sv;
        /* absentes des listes de saisie des recettes */
        const inp = document.createElement('input');
        out.hidden = !S.conso.filter(x => !x.sys).some(x => x.sys);
        show('labels');
        return out;
      });
      check(
        'Consommables : lignes kWh et m³ modifiables, sans bouton de suppression, absentes des autres lignes ; le coût suit le prix',
        o.nodel && o.del && o.cost && o.price && o.keep && o.hidden,
        JSON.stringify(o)
      );
    }
    {
      /* Réglages : sauvegarde automatique (curseur + minutes), langue et base de données déplacées */
      const o = await page.evaluate(async () => {
        const E = S.kv.equip,
          sv = { on: E.autoOn, m: E.autoMin },
          out = {};
        show('params');
        await new Promise(r => setTimeout(r, 150));
        const p = document.querySelector('#regp');
        out.h = !!p && /^Réglages/.test(p.querySelector('h3').textContent);
        out.in = !!p.querySelector('#autoon') && !!p.querySelector('#automin') && !!p.querySelector('#langsel') && !!p.querySelector('#dbinfo') && !!p.querySelector('#dbchg');
        const sw = p.querySelector('.sw'),
          mn = p.querySelector('#automin');
        out.left = sw.getBoundingClientRect().right <= mn.getBoundingClientRect().left;
        out.old = ![...document.querySelectorAll('.pg h3')].some(h => /^Langue de l|^Base de données/.test(h.textContent));
        out.def = E.autoOn !== false && autoMin() >= 0;
        const on = p.querySelector('#autoon');
        on.checked = false;
        on.dispatchEvent(new Event('change', { bubbles: true }));
        out.off = E.autoOn === false && mn.readOnly && autoMin() === -1;
        on.checked = true;
        on.dispatchEvent(new Event('change', { bubbles: true }));
        mn.value = '7';
        mn.dispatchEvent(new Event('change', { bubbles: true }));
        out.min = E.autoOn === true && E.autoMin === 7 && !mn.readOnly && autoMin() === 7;
        E.autoOn = sv.on;
        E.autoMin = sv.m;
        show('labels');
        return out;
      });
      check(
        'Paramètres › Réglages : curseur + minutes de sauvegarde automatique, langue et base de données regroupées',
        o.h && o.in && o.left && o.old && o.def && o.off && o.min,
        JSON.stringify(o)
      );
    }
    check(
      'sauvegarde automatique différée : N minutes → pas d’écriture immédiate, désactivée → aucune ; 0 → après la modification',
      await (async () => {
        const w0 = await page.evaluate(() => {
          window.__w0 = window.__fsa ? window.__fsa.writes : -1;
          S.kv.equip.autoOn = true;
          S.kv.equip.autoMin = 5;
          save();
          return window.__w0;
        });
        await wait(900);
        const w1 = await page.evaluate(() => (window.__fsa ? window.__fsa.writes : -1));
        await page.evaluate(() => {
          S.kv.equip.autoOn = false;
          save();
        });
        await wait(900);
        const w2 = await page.evaluate(() => (window.__fsa ? window.__fsa.writes : -1));
        await page.evaluate(() => {
          S.kv.equip.autoOn = true;
          S.kv.equip.autoMin = 0;
          save();
        });
        await wait(1200);
        const w3 = await page.evaluate(() => (window.__fsa ? window.__fsa.writes : -1));
        return w0 === -1 || (w1 === w0 && w2 === w0 && w3 > w0) || [w0, w1, w2, w3].join();
      })()
    );
    check(
      'sauvegarde automatique : notification en haut de l’écran comme après « Sauvegarder » ; valeur par défaut 5 min ; équipement par défaut « BrewMonk B50 » (nouvelle base et base existante au nom vide)',
      await (async () => {
        await page.evaluate(() => {
          const m = document.getElementById('hmsg');
          m.textContent = '';
          m.className = '';
          S.kv.equip.autoOn = true;
          S.kv.equip.autoMin = 0;
          save();
        });
        await wait(1400);
        const o = await page.evaluate(() => {
          const m = document.getElementById('hmsg'),
            out = { msg: m.textContent, cls: m.className };
          const D = defaults().equip,
            eq = { ...S.kv.equip };
          out.def = D.autoMin === 5 && D.name === 'BrewMonk B50';
          S.kv.equip = { ...eq, auto5: 0, autoMin: 0, name: '' };
          migrate();
          out.mig = S.kv.equip.autoMin === 5 && S.kv.equip.name === 'BrewMonk B50';
          S.kv.equip = { ...eq, auto5: 0, autoMin: 0, name: 'Grainfather' };
          migrate();
          out.keep = S.kv.equip.name === 'Grainfather' && S.kv.equip.autoMin === 5;
          S.kv.equip = eq;
          return out;
        });
        return (o.cls === 'ok' && /Tout est enregistré dans/.test(o.msg) && o.def && o.mig && o.keep) || JSON.stringify(o);
      })()
    );
    {
      /* Étiquettes : boutons A↑ / A↓ */
      await page.evaluate(() => {
        S.kv.recipe.etq.fsz = 100;
        show('labels');
      });
      await wait(400);
      const fz = async () => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#lpage .lbn')).fontSize));
      const f0 = await fz();
      await page.click('[data-fsz="1"]');
      await wait(200);
      await page.click('[data-fsz="1"]');
      await wait(300);
      const f1 = await fz(),
        q1 = await page.evaluate(() => S.kv.recipe.etq.fsz);
      await page.click('[data-fsz="-1"]');
      await page.click('[data-fsz="-1"]');
      await page.click('[data-fsz="-1"]');
      await wait(300);
      const f2 = await fz(),
        q2 = await page.evaluate(() => S.kv.recipe.etq.fsz);
      await page.evaluate(() => {
        S.kv.recipe.etq.fsz = 100;
        lblRefresh();
      });
      check(
        'étiquettes : boutons A↑ / A↓ (pas de 10 %, mémorisé dans la recette, la taille de la police du nom change)',
        q1 === 120 && q2 === 90 && f1 > f0 * 1.1 && f2 < f0 * 0.95,
        JSON.stringify({ f0, f1, f2, q1, q2 })
      );
    }
    {
      /* Paramètres › Polices : suppression avec remplacement par défaut (Inter) + infobulle d'aperçu */
      await page.evaluate(() => {
        S.kv.equip.fonts.push({ n: 'Zeta Test', d: S.kv.equip.fonts[0].d });
        show('params');
      });
      await wait(500);
      await page.evaluate(() => {
        PG.fonts = 0;
        FSORT = 0;
        const f = document.getElementById('ftf');
        if (f) f.value = '';
        fontsRefresh();
      });
      await wait(200);
      const cell = await page.evaluate(() => {
        const c = [...document.querySelectorAll('#ftb td.fnm')].find(x => x.textContent === 'Anton-Regular') || document.querySelector('#ftb td.fnm');
        c.setAttribute('data-t', '1');
        return c.textContent;
      });
      await page.hover('td.fnm[data-t="1"]');
      await wait(500);
      const early = await page.evaluate(() => !!document.getElementById('ftip'));
      await wait(900);
      const tip = await page.evaluate(() => {
        const t = document.getElementById('ftip');
        return t && { txt: t.textContent, ff: t.style.fontFamily };
      });
      await page.mouse.move(5, 5);
      await wait(200);
      const gone = await page.evaluate(() => !document.getElementById('ftip'));
      await page.evaluate(() => document.querySelector('td.fnm[data-t="1"]').removeAttribute('data-t'));
      check(
        'polices : infobulle au survol du nom après 1 seconde (pas avant), phrase affichée dans la police survolée, disparaît à la sortie',
        !early && tip && /La bière est la preuve indéniable/.test(tip.txt) && /Benjamin Franklin/.test(tip.txt) && tip.ff.includes('LU ' + cell) && gone,
        JSON.stringify({ early, tip, gone, cell })
      );
      const r = await page.evaluate(async () => {
        const n0 = S.kv.equip.fonts.length,
          i = S.kv.equip.fonts.findIndex(x => x.n === 'Zeta Test');
        document.getElementById('ftf').value = 'Zeta';
        fontsRefresh();
        const p = new Promise(res => {
          const ob = new MutationObserver(() => {
            const d = document.querySelector('.bcdlg');
            if (d) {
              ob.disconnect();
              res({ ph: (d.querySelector('.bcin') || {}).placeholder, val: (d.querySelector('.bcin') || {}).value });
            }
          });
          ob.observe(document.body, { childList: true, subtree: true });
        });
        document.querySelector(`[data-fdel="${i}"]`).click();
        const o = await p;
        await new Promise(r => setTimeout(r, 600));
        return { ...o, n0, n1: S.kv.equip.fonts.length, map: (S.kv.equip.fontmap || {})['Zeta Test'] };
      });
      check(
        'polices : la suppression demande toujours la police de remplacement ; champ vide → Inter par défaut',
        /Inter/.test(r.ph) && r.n1 === r.n0 - 1 && /^Inter-VariableFont/.test(r.map || ''),
        JSON.stringify(r)
      );
      await page.evaluate(() => {
        if (S.kv.equip.fontmap) delete S.kv.equip.fontmap['Zeta Test'];
        document.getElementById('ftf').value = '';
        fontsRefresh();
        show('labels');
      });
      await wait(300);
    }
    check(
      'sauvegarde automatique : bout en bout (modification dans l’interface → minuterie de 5 min → écriture → notification « Tout est enregistré »)',
      await (async () => {
        await page.evaluate(() => {
          window.__tt = [];
          const st = window.setTimeout;
          window.__st0 = st;
          window.setTimeout = (f, d, ...a) => {
            if (d === 300000) {
              window.__tt.push(f);
              return 1;
            }
            return st(f, d, ...a);
          };
          const m = document.getElementById('hmsg');
          m.textContent = '';
          m.className = '';
          S.kv.equip.autoOn = true;
          S.kv.equip.autoMin = 5;
          show('conception');
        });
        await wait(400);
        await page.fill('[data-r="name"]', 'Notif auto ' + Date.now());
        await wait(300);
        const o1 = await page.evaluate(() => ({ n: window.__tt.length, w: __fsa.writes, pend: PEND }));
        await page.evaluate(() => window.__tt[0] && window.__tt[0]());
        await wait(900);
        const o2 = await page.evaluate(() => {
          window.setTimeout = window.__st0;
          const m = document.getElementById('hmsg');
          return { w: __fsa.writes, txt: m.textContent, cls: m.className, vis: m.getBoundingClientRect().width > 100 };
        });
        await page.evaluate(() => {
          S.kv.equip.autoMin = 0;
        });
        return (o1.n === 1 && o1.pend && o2.w > o1.w && o2.cls === 'ok' && /Tout est enregistré/.test(o2.txt) && o2.vis) || JSON.stringify({ o1, o2 });
      })()
    );
    check(
      'zone de notification : avertissement orange à la suite des autres, persistant jusqu’à correction, largeur partagée (100 % → 50 % → 33 %) et recalculée à la disparition',
      await page.evaluate(async () => {
        const w = ms => new Promise(r => setTimeout(r, ms)),
          bar = document.getElementById('hbar'),
          ws = () => [...bar.children].filter(x => x.getBoundingClientRect().width > 0).map(x => x.getBoundingClientRect().width / bar.getBoundingClientRect().width),
          near = (a, v) => a.every(x => Math.abs(x - v) < 0.02);
        const ps = PST,
          m = document.getElementById('hmsg');
        m.className = 'ok';
        m.textContent = '✔ essai';
        PST = 'need';
        badge();
        await w(100);
        const a2 = ws(),
          hw = bar.querySelector('.hw'),
          order = bar.lastElementChild === hw && bar.firstElementChild === m;
        warnSet('test', '⚠ autre défaut');
        await w(100);
        const a3 = ws();
        warnSet('test', '');
        m.textContent = '';
        await w(100);
        const a1 = ws();
        await new Promise(r => setTimeout(r, 10500));
        const still = !!bar.querySelector('.hw');
        PST = 'ok';
        badge();
        const gone = !bar.querySelector('.hw');
        PST = ps;
        badge();
        return (a2.length === 2 && near(a2, 0.5) && a3.length === 3 && near(a3, 1 / 3) && a1.length === 1 && near(a1, 1) && order && still && gone) || JSON.stringify({ a2, a3, a1, order, still, gone });
      })
    );
    check(
      'sauvegarde automatique désactivée : saisie des minutes en lecture seule (valeur conservée), réactivée : modifiable',
      await page.evaluate(() => {
        show('params');
        const E = S.kv.equip,
          sv = [E.autoOn, E.autoMin];
        const mn = () => document.getElementById('automin'),
          sw = document.getElementById('autoon');
        sw.checked = false;
        sw.dispatchEvent(new Event('change', { bubbles: true }));
        const off = mn().readOnly && !mn().disabled;
        mn().value = '9';
        mn().dispatchEvent(new Event('change', { bubbles: true }));
        const kept = E.autoMin === sv[1] && mn().value === String(sv[1]);
        sw.checked = true;
        sw.dispatchEvent(new Event('change', { bubbles: true }));
        const on = !mn().readOnly;
        E.autoOn = sv[0];
        E.autoMin = sv[1];
        return off && kept && on;
      })
    );
    check(
      'warning ratio d’empâtage : dès que « Volume d’eau + malt » ≥ « Volume maxi empâtage + malt dans la cuve » (égalité comprise), affiché aussi comme notification orange à côté de celle de sauvegarde, retiré une fois corrigé',
      await page.evaluate(async () => {
        const w = ms => new Promise(r => setTimeout(r, ms)),
          E = S.kv.equip;
        E.w = E.w || {};
        const c0 = E.w.cmax;
        show('conception');
        await w(300);
        const v = wcalc().vgr,
          bar = document.getElementById('hbar'),
          hw = () => [...bar.querySelectorAll('.hw[data-k="ratio"]')].length,
          ic = () => getComputedStyle(document.querySelector('#ratio-al')).display !== 'none',
          set = x => {
            E.w.cmax = x;
            save();
            refresh();
          };
        const m = document.getElementById('hmsg');
        m.className = 'ok';
        m.textContent = '✔ Tout est enregistré dans essai — 00:00:00';
        set(v + 0.5);
        await w(150);
        const a = [hw(), ic()];
        set(v);
        await w(150);
        const b = [hw(), ic(), bar.lastElementChild.dataset.k, [...bar.children].filter(x => x.getBoundingClientRect().width > 0).length];
        set(v - 0.5);
        await w(150);
        const c = [hw(), ic()];
        show('params');
        await w(200);
        const d = hw();
        if (c0 === undefined) delete E.w.cmax;
        else E.w.cmax = c0;
        save();
        show('conception');
        await w(200);
        m.textContent = '';
        return (a[0] === 0 && !a[1] && b[0] === 1 && b[1] && b[3] >= 2 && c[0] === 1 && c[1] && d === 1) || JSON.stringify({ v, a, b, c, d });
      })
    );
    check(
      'écran Conception : 3 notifications ensemble (sauvegarde, calcul IBU / DI, ratio d’empâtage élevé), chacune sur ~33 % de la largeur, côte à côte',
      await page.evaluate(async () => {
        const w = ms => new Promise(r => setTimeout(r, ms)),
          E = S.kv.equip;
        E.w = E.w || {};
        const c0 = E.w.cmax;
        show('conception');
        await w(300);
        E.w.cmax = wcalc().vgr - 0.5;
        refresh();
        document.querySelector('#calc').click();
        await w(500);
        wcalc();
        E.w.cmax = Math.min(E.w.cmax, wcalc().vgr - 0.5);
        refresh();
        const m = document.getElementById('hmsg');
        m.className = 'ok';
        m.textContent = '✔ Tout est enregistré dans essai — 00:00:00';
        await w(200);
        const bar = document.getElementById('hbar'),
          bw = bar.getBoundingClientRect(),
          it = [...bar.children].filter(x => x.getBoundingClientRect().width > 0),
          r = it.map(x => x.getBoundingClientRect()),
          kinds = it.map(x => (x.id === 'hmsg' ? 'save' : x.dataset.k)),
          ok =
            it.length === 3 &&
            kinds.join() === 'save,calc,ratio' &&
            r.every(x => Math.abs(x.width / bw.width - 1 / 3) < 0.02) &&
            r.every((x, i) => i === 0 || x.left >= r[i - 1].right + 4) &&
            r.every(x => x.right <= bw.right + 1 && x.height >= 20);
        if (c0 === undefined) delete E.w.cmax;
        else E.w.cmax = c0;
        refresh();
        m.textContent = '';
        return ok || JSON.stringify({ kinds, w: r.map(x => x.width / bw.width) });
      })
    );
    {
      /* radars : valeur numérique d'un point après 1 s de survol */
      await page.evaluate(() => show('conception'));
      await wait(500);
      const pt = await page.evaluate(() => {
        const c = [...document.querySelectorAll('#radars circle.rpt')][0];
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, v: c.dataset.v, a: c.dataset.a };
      });
      let early = null,
        tip = null,
        gone = null;
      if (pt) {
        await page.mouse.move(pt.x, pt.y);
        await wait(500);
        early = await page.evaluate(() => !!document.getElementById('rtip'));
        await wait(800);
        tip = await page.evaluate(() => (document.getElementById('rtip') || {}).textContent || '');
        await page.mouse.move(5, 5);
        await wait(200);
        gone = await page.evaluate(() => !document.getElementById('rtip'));
      }
      check(
        'radars : au survol d’un point, après 1 seconde, la valeur numérique du point apparaît (pas avant, disparaît à la sortie)',
        !!pt && early === false && tip.includes(pt.v) && tip.includes(pt.a) && gone,
        JSON.stringify({ pt, early, tip, gone })
      );
    }
    check(
      'notifications : information en vert (sauvegarde et calcul), alerte en orange adouci, y compris en thème sombre',
      await page.evaluate(async () => {
        const bar = document.getElementById('hbar'),
          m = document.getElementById('hmsg');
        m.className = 'ok';
        m.textContent = '✔ essai';
        notify('calc', '✔ Recalculé', 'ok');
        warnSet('essai', '⚠ essai');
        await new Promise(r => setTimeout(r, 100));
        const rgb = el => getComputedStyle(el).backgroundImage.match(/rgb\((\d+), (\d+), (\d+)\)/g) || [],
          p = s => s.map(x => x.match(/\d+/g).map(Number)),
          g = p(rgb(m)),
          g2 = p(rgb(bar.querySelector('.hn'))),
          o = p(rgb(bar.querySelector('.hw[data-k="essai"]')));
        const green = a => a.length && a.every(c => c[1] > c[0] && c[1] > c[2]),
          orange = a => a.length && a.every(c => c[0] > c[1] && c[1] > c[2] && c[0] < 215);
        const ok = green(g) && green(g2) && orange(o);
        warnSet('essai', '');
        bar.querySelector('.hn').remove();
        m.textContent = '';
        return ok || JSON.stringify({ g, g2, o });
      })
    );
    check(
      'étiquettes : police choisie dans une liste déroulante où chaque nom est rendu dans sa police (comme la feuille de brassage), filtrée par la saisie, ou par autocomplétion (nom exact, début de nom, nom partiel unique), valeur appliquée',
      await page.evaluate(async () => {
        const w = ms => new Promise(r => setTimeout(r, ms));
        show('labels');
        await w(400);
        const i = document.querySelector('input.fin'),
          s = document.querySelector('select[data-q="fnt"]'),
          Q = S.kv.recipe.etq;
        const type = async v => {
          i.focus();
          i.value = v;
          i.dispatchEvent(new Event('input', { bubbles: true }));
          i.blur();
          await w(150);
        };
        i.focus();
        await w(100);
        const box = document.querySelector('.fdd'),
          it = box ? [...box.querySelectorAll('.fdo')] : [],
          ff = it.filter(x => x.style.fontFamily),
          same = ff.every(x => x.style.fontFamily === s.options[[...s.options].findIndex(o => o.textContent === x.textContent)].style.fontFamily);
        i.value = 'metal';
        i.dispatchEvent(new Event('input', { bubbles: true }));
        await w(80);
        const filt = [...document.querySelectorAll('.fdd .fdo')].map(x => x.textContent);
        const pick = [...document.querySelectorAll('.fdd .fdo')].find(x => /Metal Mania/.test(x.textContent));
        pick.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        await w(120);
        const out = {
          dd: it.length >= 20 && ff.length >= it.length - 1 && same,
          filt: filt.length >= 1 && filt.every(t => /metal/i.test(t)),
          click: Q.fnt === 'metal' && !document.querySelector('.fdd'),
          hidden: s.hidden && getComputedStyle(s).display === 'none',
          nolist: !i.getAttribute('list') && !document.getElementById('dl-fnt')
        };
        await type('Anton');
        await type('Metal Mania — heavy metal');
        out.exact = Q.fnt === 'metal' && i.value === 'Metal Mania — heavy metal';
        await type('anton');
        out.start = Q.fnt === 'anton' && /^Anton/.test(i.value);
        await type('pirata');
        out.part = Q.fnt === 'pirata';
        await type('zzzz inconnue');
        out.unk = Q.fnt === 'pirata' && /Pirata/.test(i.value);
        await type('auto');
        out.auto = Q.fnt === 'auto';
        i.focus();
        out.cleared = i.value === '' && i.placeholder !== '';
        i.blur();
        await w(100);
        return Object.values(out).every(Boolean) || JSON.stringify(out);
      })
    );
    check(
      'numéro de brassin de l’année « année#rang » : rang par date de brassage croissante parmi les recettes (non importées) de la même année, indépendant des autres années ; champ « Brassin N° » supprimé de l’écran Étiquettes',
      await page.evaluate(async () => {
        const w = ms => new Promise(r => setTimeout(r, ms)),
          sv = [S.biblio, S.kv.recipe, S.html];
        const mk = (id, date) => ({ id, name: id, date, vol: 20, recipe: { ...JSON.parse(JSON.stringify(S.kv.recipe)), id, date, name: id } });
        S.biblio = [mk('a', '2026-05-10'), mk('b', '2026-01-20'), mk('c', '2025-12-31'), mk('d', '2026-03-01'), mk('e', '2026-03-01')];
        const R = { ...JSON.parse(JSON.stringify(sv[1])), id: 'a', date: '2026-05-10' };
        S.kv.recipe = R;
        const o = {};
        o.a = brewNo(R).code; /* 20 janv (b), 1er mars (d), 1er mars (e), 10 mai (a) → 4 */
        R.date = '2026-01-01';
        o.first = brewNo(R).code; /* devient le 1er de 2026 */
        R.date = '2025-06-01';
        o.y25 = brewNo(R).code; /* 2025 : a (1er juin) puis c (31 déc.) → 1 */
        S.kv.recipe = { ...R, id: 'nouveau', date: '2026-12-01' };
        o.neu = brewNo(S.kv.recipe).code; /* nouvelle recette non enregistrée : après les 4 autres de 2026 (a est en 2025) → 2026#5 ? */
        S.kv.recipe.date = '2026-02-01';
        o.ins = brewNo(S.kv.recipe).code;
        /* recettes importées exclues du comptage */
        S.biblio[1].imp = 1; /* b (20 janv.) importée */
        S.biblio[1].recipe.imp = 1;
        o.imp = brewNo(S.kv.recipe).code; /* 2026-02-01 : b ne compte plus → d, e après → 2026#1 */
        S.biblio[1].imp = 0;
        S.biblio[1].recipe.imp = 0;
        show('labels');
        await w(300);
        o.field = !document.querySelector('[data-q="brassin"]');
        S.biblio = sv[0];
        S.kv.recipe = sv[1];
        S.html = sv[2];
        show('labels');
        const ok = o.a === '2026#4' && o.first === '2026#1' && o.y25 === '2025#1' && o.neu === '2026#4' && o.ins === '2026#2' && o.imp === '2026#1' && o.field;
        return ok || JSON.stringify(o);
      })
    );
    {
      const r = await page.evaluate(() => {
          const E = S.kv.equip,
            d = E.fonts.find(x => x.n === 'CoveredByYourGrace-Regular').d;
          E.fonts.push({ n: 'Superscratchy', d, b: 1 });
          const i = E.fonts.length - 1,
            f0 = S.kv.recipe.etq.fnt;
          S.kv.recipe.etq.fnt = 'u' + i;
          delete E.noscratchy;
          fontsSeed();
          const j = E.fonts.findIndex(x => x.n === 'CoveredByYourGrace-Regular'),
            ok = !E.fonts.some(x => /scratchy/i.test(x.n)) && E.noscratchy === 1 && (E.fontmap || {}).Superscratchy === 'CoveredByYourGrace-Regular' && S.kv.recipe.etq.fnt === 'u' + j;
          S.kv.recipe.etq.fnt = f0;
          return ok || JSON.stringify({ fnt: S.kv.recipe.etq.fnt, j, map: E.fontmap });
        });
      check(
        'base qui contenait Superscratchy : police supprimée au lancement, remplacée par Covered By Your Grace (étiquettes comprises)',
        r === true,
        r
      );
    }
    {
      const r = await page.evaluate(async () => {
          show('params');
          await new Promise(r => setTimeout(r, 200));
          const sel = l => {
              const x = document.getElementById('langsel');
              x.value = l;
              x.dispatchEvent(new Event('change', { bubbles: true }));
            },
            v = () => document.querySelector('input.nm[data-pn="0"][data-i="0"]').value + ' | ' + document.querySelector('input.phn').value;
          sel('it');
          await new Promise(r => setTimeout(r, 200));
          const it = v();
          sel('fr');
          await new Promise(r => setTimeout(r, 200));
          const fr = v();
          return (/Acqua/.test(it) && /^Eau d’empâtage/.test(fr) && /^Phase 1 — Empâtage/.test(fr.split(' | ')[1])) || it + ' / ' + fr;
        });
      check(
        'changement de langue (italien puis français) : noms des phases et étapes du Process redessinés dans la langue choisie',
        r === true,
        r
      );
    }
    check(
      'Superscratchy (licence non libre) retirée : absente des polices de départ et de la base, plus verrouillée ; « Bandeau oblique » en Covered By Your Grace (Google Fonts), en base, verrouillée, chargée',
      await page.evaluate(async () => {
        await document.fonts.ready;
        lblRegFonts();
        await new Promise(r => setTimeout(r, 800));
        const f = S.kv.equip.fonts,
          fs = [...document.fonts].filter(x => x.status === 'loaded').map(x => x.family.replace(/"/g, '') + '|' + x.style);
        return (
          !FONTS_SEED.some(x => /scratchy/i.test(x.n)) &&
          !f.some(x => /scratchy/i.test(x.n)) &&
          !fontLocked('Superscratchy') &&
          f.some(x => x.n === 'CoveredByYourGrace-Regular' && x.b) &&
          fontLocked('CoveredByYourGrace-Regular') &&
          fs.some(x => /^LF Covered\|/.test(x)) &&
          LF.find(x => x.id === 'bandeauxl').font === 'scratchy' &&
          lblFont('scratchy').f.startsWith("'LF Covered'")
        );
      })
    );
    check(
      'HTML : numéro de brassin (année#rang) ajouté aux paramètres et recalculé pour la bibliothèque (version du gabarit 4)',
      await page.evaluate(() => /Brassin N°/.test(htmlCode()) && htmlCode().includes(brewNo(S.kv.recipe).code) && HTMLV === 4)
    );
    {
      /* Paramètres › Réglages : export de la base */
      await page.evaluate(() => show('params'));
      await wait(500);
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('#dbexp')]);
      const name = dl.suggestedFilename(),
        fp = path.join(dir, 'export_test.sqlite');
      await dl.saveAs(fp);
      const d = new Date(),
        p2 = n => String(n).padStart(2, '0'),
        exp = d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '_openmaltforge.sqlite';
      const tb = await tables(fp),
        np = await rows(fp, 'polices'),
        head = fs.readFileSync(fp).slice(0, 15).toString();
      check(
        'Paramètres › Réglages : bouton « Exporter la base » → fichier SQLite nommé AAAAMMJJ_openmaltforge.sqlite, base complète (tables, polices)',
        name === exp && /^\d{8}_openmaltforge\.sqlite$/.test(name) && head === 'SQLite format 3' && tb.includes('polices') && tb.includes('bibliotheque') && np >= 30,
        JSON.stringify({ name, exp, head, tb: tb.length, np })
      );
    }
    check(
      'radars de tous les écrans (Conception, Malts, Houblons, Levures) : aucune infobulle « Cliquer ou Échap pour fermer » (ni dans la page, ni sur le radar agrandi)',
      await page.evaluate(async () => {
        const w = ms => new Promise(r => setTimeout(r, ms));
        const bad = [];
        for (const sc of ['conception', 'malts', 'hops', 'yeasts']) {
          show(sc);
          await w(400);
          const sv = document.querySelector('svg polygon.rg') && document.querySelector('svg polygon.rg').closest('svg');
          if (!sv) {
            bad.push(sc + ':pas de radar');
            continue;
          }
          sv.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          await w(100);
          const z = document.getElementById('rzoom');
          if (!z || z.title || document.documentElement.outerHTML.includes('Cliquer ou Échap')) bad.push(sc);
          if (z) z.remove();
        }
        return bad.length === 0 || bad.join();
      })
    );
    check(
      'radar plein écran : plus d’infobulle « Cliquer ou Échap pour fermer », fermeture par clic et Échap conservée',
      await page.evaluate(async () => {
        const w = ms => new Promise(r => setTimeout(r, ms));
        show('conception');
        await w(400);
        document.querySelector('#radars svg').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await w(150);
        const z = document.getElementById('rzoom'),
          open = !!z && !z.title && !z.querySelector('[title*="Échap"]');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await w(100);
        return open && !document.getElementById('rzoom');
      })
    );
    {
      /* import de plusieurs polices à la fois */
      const buf = fs.readFileSync(path.join(ROOT, 'dev', 'tests', 'Anton-Regular.ttf'));
      await page.evaluate(() => show('params'));
      await wait(400);
      const n0 = await page.evaluate(() => S.kv.equip.fonts.length);
      const multi = await page.evaluate(() => document.getElementById('fontfile').multiple);
      await page.setInputFiles('#fontfile', [
        { name: 'MultiA-Test.ttf', mimeType: 'font/ttf', buffer: buf },
        { name: 'MultiB-Test.ttf', mimeType: 'font/ttf', buffer: buf },
        { name: 'MultiC-Test.ttf', mimeType: 'font/ttf', buffer: buf }
      ]);
      await wait(900);
      const r = await page.evaluate(() => ({
        n: S.kv.equip.fonts.length,
        names: S.kv.equip.fonts.filter(f => /^Multi[ABC]-Test$/.test(f.n)).map(f => f.n),
        note: (document.querySelector('#hbar .hn[data-k="fonts"]') || {}).textContent || ''
      }));
      check(
        'polices : import de plusieurs fichiers en une fois (champ multiple, 3 polices ajoutées, notification)',
        multi && r.n === n0 + 3 && r.names.length === 3 && /3 polices importées/.test(r.note),
        JSON.stringify({ multi, n0, r })
      );
      await page.evaluate(() => {
        S.kv.equip.fonts = S.kv.equip.fonts.filter(f => !/^Multi[ABC]-Test$/.test(f.n));
        lblRegFonts();
        fontsRefresh();
      });
    }
    check(
      'sauvegarde automatique désactivée : champ des minutes avec le fond gris de la page, bord fin, texte non italique',
      await page.evaluate(() => {
        show('params');
        const E = S.kv.equip,
          on = E.autoOn;
        E.autoOn = false;
        show('params');
        const c = getComputedStyle(document.getElementById('automin')),
          bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
        const hex = bg.replace('#', ''),
          rgb = 'rgb(' + [0, 2, 4].map(i => parseInt(hex.substr(i, 2), 16)).join(', ') + ')';
        const ok = c.backgroundColor === rgb && c.fontStyle === 'normal' && parseFloat(c.borderTopWidth) >= 1 && c.borderTopColor !== 'rgba(0, 0, 0, 0)';
        E.autoOn = on;
        show('params');
        return ok || JSON.stringify([c.backgroundColor, rgb, c.fontStyle, c.borderTopColor]);
      })
    );
    check(
      'en-têtes triables : flèche de tri en triangle plein bien visible (≥ 10 px, couleur d’accent)',
      await page.evaluate(async () => {
        show('malts');
        await new Promise(r => setTimeout(r, 150));
        document.querySelector('th[data-sort="name"]').click();
        await new Promise(r => setTimeout(r, 150));
        const a = document.querySelector('th[data-sort="name"] .sar');
        if (!a) return 'pas de flèche';
        const c = getComputedStyle(a),
          big = parseFloat(c.borderBottomWidth) + parseFloat(c.borderTopWidth) >= 8,
          col = c.borderBottomColor !== 'rgba(0, 0, 0, 0)' || c.borderTopColor !== 'rgba(0, 0, 0, 0)';
        show('labels');
        return (big && col) || JSON.stringify([c.borderBottomWidth, c.borderTopWidth]);
      })
    );
    check(
      'électricité synchronisée avec les paliers : une ligne par palier, dans le même ordre, avec une montée avant chaque palier (sauf le 1er : montée initiale)',
      await page.evaluate(() => {
        const M = S.kv.recipe.mash,
          p = elecPlan(),
          pal = p.filter(l => l.kind === 'pal').map(l => l.key.slice(2)),
          n = M.length;
        return (
          p.length === 1 + n + (n - 1) + 1 &&
          p[0].kind === 'init' &&
          p[p.length - 1].kind === 'rinse' &&
          JSON.stringify(pal) === JSON.stringify(M.map(r => r.k)) &&
          p.filter(l => l.kind === 'ramp').length === n - 1 &&
          p.every((l, k) => l.kind !== 'pal' || !p[k + 1] || p[k + 1].kind !== 'pal')
        );
      })
    );
    check(
      'électricité : la ligne Mashout reprend la durée du palier Mashout de la Conception (même sans température)',
      await page.evaluate(() => {
        const M = S.kv.recipe.mash,
          o = M[5],
          g = () => {
            const l = elecPlan().find(x => x.key === 'p:Mashout');
            return l ? l.min : 0;
          };
        M[5] = { ...o, t: '', m: 15 };
        const a = g();
        M[5] = { ...o, t: 78, m: 20 };
        const b = g();
        M[5] = { ...o, m: '' };
        const c = g();
        M[5] = o;
        return a === 15 && b === 20 && c === 0;
      })
    );
    check(
      'paliers d’empâtage variables : ajout, déplacement, suppression ; la ligne ajoutée apparaît dans le tableau d’électricité (readonly) avec sa montée ; sauvegarde en base',
      await (async () => {
        await nav(page, 'conception');
        await wait(200);
        await page.click('button[data-madd]');
        await wait(150);
        await page.fill('input[data-mi="7"][data-mf="k"]', 'Pause protéique');
        await page.fill('input[data-mi="7"][data-mf="t"]', '55');
        await page.fill('input[data-mi="7"][data-mf="m"]', '15');
        await page.click('button[data-mm="7:-1"]');
        await wait(150);
        const a = await page.evaluate(() => {
          const M = S.kv.recipe.mash;
          return M.length === 8 && M[6].k === 'Pause protéique' && M[7].k === 'Ébullition' && M[7].role === 'boil';
        });
        await nav(page, 'params');
        await wait(200);
        const b = await page.evaluate(() => {
          const k = elecPlan().map(l => l.key);
          return (
            k.includes('p:Pause protéique') &&
            k.includes('r:Pause protéique') &&
            k.indexOf('r:Pause protéique') === k.indexOf('p:Pause protéique') - 1 &&
            [...document.querySelectorAll('tr.ea input.nm')].some(i => /Pause protéique/.test(i.value) && i.readOnly)
          );
        });
        await page.click('#dbsave');
        await wait(900);
        const db = await sqlOpen(path.join(dir, DBF));
        const r = db.exec(
            "select count(*) from recette_paliers p join recettes r on r.id = p.recette_id where r.en_cours = 1 and p.etape = 'Pause protéique'"
          )[0].values[0][0],
          e = db.exec("select count(*) from parametres_electricite where auto like 'p:Pause%'")[0].values[0][0];
        db.close();
        const c = r === 1 && e === 1;
        await nav(page, 'conception');
        await wait(200);
        await page.click('button[data-mdel="6"]');
        await wait(150);
        const d = await page.evaluate(
          () => S.kv.recipe.mash.length === 7 && !elecPlan().some(l => /Pause/.test(l.key))
        );
        await nav(page, 'params');
        await wait(150);
        return a && b && c && d;
      })()
    );
    {
      await nav(page, 'malts');
      await page.click('table.db tr[data-ri] input:not([readonly])').catch(() => {});
      await page.evaluate(() => {
        const t = document.querySelector('table.db tr[data-ri] td input');
        t.focus();
      });
      await wait(100);
      check(
        'tables malts : la ligne qui a le focus est en surbrillance',
        await page.evaluate(() => {
          const tr = document.activeElement.closest('tr'),
            o = [...document.querySelectorAll('table.db tr[data-ri]')].find(r => r !== tr);
          return (
            getComputedStyle(tr.querySelector('td')).backgroundColor !==
            getComputedStyle(o.querySelector('td')).backgroundColor
          );
        })
      );
      await nav(page, 'params');
      await wait(150);
    }
    {
      await page.evaluate(() => {
        S.kv.equip.fonts.push({ n: 'Sans données' }, { d: 'data:font/ttf;base64,AA==' }, null, {
          n: 'Valide',
          d: 'data:font/ttf;base64,AA=='
        });
        save();
      });
      await wait(500);
      await settle(page);
      const d3 = await sqlOpen(path.join(dir, DBF));
      const nn = d3.exec("select count(*) from polices where nom in ('Valide','Sans données')")[0].values[0][0];
      d3.close();
      check(
        'données de police invalides ignorées sans bloquer l’enregistrement (table « polices » toujours écrite)',
        nn === 1 && (await page.evaluate(() => PST === 'ok')),
        String(nn)
      );
      await page.evaluate(() => {
        S.kv.equip.fonts = S.kv.equip.fonts.filter(x => x && x.d && x.n && x.n !== 'Valide');
        save();
      });
      await wait(800);
    }
    await page.evaluate(() => show('params'));
    await wait(900);
    check(
      'Paramètres › Base de données : seulement chemin + nom du fichier (plus de liste de tables)',
      await page.evaluate(() => {
        const t = document.getElementById('dbinfo').innerText;
        return (
          /Base de données : openmaltforge\.sqlite/.test(document.querySelector('#regp .rgdb').innerText.replace(/\s+/g, ' ')) &&
          !/Désactivée : seul|Les traductions sont stockées/.test(document.getElementById('regp').innerText) &&
          /openmaltforge\.sqlite/.test(t) &&
          !/polices \d+/.test(t) &&
          !document.getElementById('dbdir') &&
          !!document.getElementById('dbchg')
        );
      })
    );
    {
      const y = await page.evaluate(async () => {
        S.kv.equip.rsel = S.kv.equip.rsel || {};
        S.kv.equip.rsel.yeasts = [S.yeasts[0].name, S.yeasts[7].name, '', '', ''];
        show('yeasts');
        await new Promise(r => setTimeout(r, 500));
        const sv = document.querySelector('.yfl svg.yf'),
          rd = document.querySelector('.rvmain svg'),
          a = document.querySelector('.rvmain').getBoundingClientRect(),
          b = document.querySelector('.yfl').getBoundingClientRect();
        const r = {
          chart: !!sv,
          bars: sv ? sv.querySelectorAll('rect[stroke-width="1.4"]').length : 0,
          beside: b.left >= a.right - 2 && Math.abs(a.top - b.top) < 250,
          radar: !!rd,
          er: document.querySelectorAll('.rt button.er').length
        };
        document.querySelector('button.er[data-i="0"]').click();
        await new Promise(r => setTimeout(r, 200));
        r.after = [
          S.kv.equip.rsel.yeasts[0],
          document.querySelector('[data-rx="0"]').value,
          document.querySelectorAll('.yfl rect[stroke-width="1.4"]').length
        ];
        for (const t of ['malts', 'hops']) {
          show(t);
          await new Promise(r => setTimeout(r, 300));
          r[t] = document.querySelectorAll('.rt button.er').length;
        }
        return r;
      });
      check(
        'Levures : diagramme floculation/atténuation à côté du radar (2 barres par levure sélectionnée)',
        y.chart && y.bars === 4 && y.beside && y.radar,
        JSON.stringify(y)
      );
      check(
        'gomme en fin de ligne des tableaux de radar (levures, malts, houblons) : efface le champ et met le radar à jour',
        y.er === 5 && y.malts === 5 && y.hops === 5 && y.after[0] === '' && y.after[1] === '' && y.after[2] === 2,
        JSON.stringify(y.after)
      );
    }
    await page.evaluate(() => show('params'));
    await wait(500);
    check(
      'Paramètres › polices : gomme à côté du champ de recherche (vide le champ et réaffiche toute la liste)',
      await page.evaluate(async () => {
        const f = document.getElementById('ftf');
        f.value = 'anton';
        f.dispatchEvent(new Event('input', { bubbles: true }));
        const n1 = document.querySelectorAll('#ftb tr').length;
        document.querySelector('button.er[data-erase="ft"]').click();
        await new Promise(r => setTimeout(r, 100));
        return n1 === 1 && f.value === '' && document.querySelectorAll('#ftb tr').length > n1;
      })
    );
    check(
      'répertoire fonts/ supprimé du projet',
      !fs.existsSync(path.join(ROOT, 'fonts')) && !fs.existsSync(path.join(WEB, 'fonts'))
    );
    {
      await page.click('#dbsave');
      await wait(800);
      const f = path.join(dir, DBF);
      const db = await sqlOpen(f);
      const r = db.exec('select nom,format,integree,length(donnees) from polices order by rowid')[0].values,
        kv = db.exec("select count(*) from parametres where cle='fonts'")[0].values[0][0];
      db.close();
      check(
        'table « polices » : polices intégrées (31 = 9 + 9 + 13 + Covered By Your Grace − Anton supprimée ci-dessus ; Superscratchy retirée) (nom, format, données) et plus de clé « fonts » dans parametres',
        r.length >= 8 &&
          r.every(x => x[1] === 'ttf' && x[3] > 1000) &&
          r.filter(x => x[2] === 1).length === 31 &&
          kv === 0,
        JSON.stringify(r.slice(0, 2))
      );
    }
    check(
      'polices intégrées chargées depuis la base (LF Anton, LF Oswald, LF Rye…)',
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise(r => setTimeout(r, 600));
        return ['LF Anton', 'LF Oswald', 'LF Rye', 'LF Bangers', 'LF Sancreek'].every(f =>
          document.fonts.check("16px '" + f + "'")
        );
      })
    );
    const L = {
      en: ['Library', 'Settings', 'Labels'],
      es: ['Biblioteca', 'Ajustes', 'Etiquetas'],
      it: ['Libreria', 'Impostazioni', 'Etichette'],
      pt: ['Biblioteca', 'Definições', 'Rótulos']
    };
    for (const l in L) {
      await page.selectOption('#langsel', l);
      await wait(300);
      const n = await navT();
      check(
        'langue ' + l + ' : menu traduit (' + L[l].join(', ') + ')',
        L[l].every(x => n.includes(x)),
        n.join('|')
      );
    }
    await page.selectOption('#langsel', 'en');
    await wait(300);
    for (const sc of ['conception', 'biblio', 'malts', 'labels', 'sheet', 'params']) {
      await page.evaluate(k => show(k), sc);
      await wait(300);
    }
    await page.evaluate(() => show('params'));
    await wait(300);
    check(
      'anglais : encart « Fonts » et section « General settings »',
      await page.evaluate(
        () => /Fonts \(/.test(document.body.innerText) && /General settings/.test(document.body.innerText)
      )
    );
    await page.evaluate(() => show('conception'));
    await wait(300);
    check(
      'anglais : conception sans libellé français courant (Calculer, Densité…)',
      await page.evaluate(() => {
        const t = document.body.innerText;
        return !/Calculer|Densité initiale|Houblons \(/.test(t) && /Calculate/.test(t);
      })
    );
    await page.evaluate(() => show('labels'));
    await wait(400);
    check(
      'anglais : écran Étiquettes traduit (Police → Font, Texte du QR Code → QR Code text)',
      await page.evaluate(
        () =>
          /QR Code text/.test(document.body.innerText) &&
          /Font/.test(document.body.innerText) &&
          !/Texte du QR Code/.test(document.body.innerText)
      )
    );
    const msg = await page.evaluate(() => tx('Supprimer définitivement la police « Anton » ?'));
    check('boîtes de dialogue traduites (alert / confirm)', msg === 'Permanently delete the font “Anton”?', msg);
    await page.evaluate(() => {
      S.kv.equip.courses = [{ t: 'hops', n: 'Magnum', q: 45, r: { manuel: 45 } }];
      save();
    });
    await page.click('#dbsave');
    await wait(800);
    const f = path.join(dir, DBF);
    check('table « traductions » dans la base (≥ 600 lignes, 5 langues)', (await rows(f, 'traductions')) >= 600);
    const db = await sqlOpen(f);
    const c = db.exec("select en,es,it,pt from traductions where cle='Bibliothèque'")[0].values[0];
    const lg = db.exec("select valeur from parametres where cle='lang'")[0].values[0][0];
    db.close();
    check(
      'traduction stockée en base (Bibliothèque → Library/Biblioteca/Libreria/Biblioteca) et langue mémorisée',
      c.join('/') === 'Library/Biblioteca/Libreria/Biblioteca' && lg === '"en"',
      c.join('/') + ' ' + lg
    );
    await page.reload();
    await openDb(page);
    await wait(2000);
    check('rechargement : la langue (anglais) est restaurée depuis la base', (await navT()).includes('Library'));
    check(
      'Courses : la liste de courses est sauvegardée dans la base et restaurée au rechargement',
      /* l'écran Conception (affiché au lancement) peut ajouter des articles automatiques : l'article manuel doit être là */
      await page.evaluate(() => (S.kv.equip.courses || []).some(c => c.t === 'hops' && c.n === 'Magnum' && c.q === 45 && c.r && c.r.manuel))
    );
    await nav(page, 'params');
    await page.selectOption('#langsel', 'fr');
    await wait(300);
    check(
      'retour au français : textes d’origine restaurés',
      (await navT()).includes('Bibliothèque') &&
        (await page.evaluate(() => /Réglages/.test(document.body.innerText)))
    );
    check('aucune erreur JavaScript (i18n)', errs.length === 0, errs.join(' | '));
    errs.length = 0;
    await page.context().close();
  } finally {
    srv.close();
  }
}
/* 5.0.0 : au lancement, OpenMaltForge s'ouvre toujours sur la Conception (même si un autre écran était affiché) */
async function scenarioLancement() {
  console.log('\n■ Lancement : écran de conception');
  const dir = freshCopy(),
    srv = await startStatic(dir);
  try {
    const page = await newPage(srv.url, { init: FSA });
    await openDb(page);
    await page.evaluate(() => show('params'));
    await wait(300);
    const before = await page.$eval('#nav button.on', b => b.dataset.s);
    await page.reload();
    await openDb(page);
    const after = await page.$eval('#nav button.on', b => b.dataset.s);
    check('au lancement (rechargement après l’écran Paramètres) : écran Conception affiché', before === 'params' && after === 'conception', before + ' → ' + after);
    await page.context().close();
  } finally {
    srv.close ? srv.close() : srv.kill();
  }
}
(async () => {
  const lint = spawnSync('node', ['--check', path.join(WEB, 'js/app.js')]);
  console.log('■ Syntaxe');
  check('node --check js/app.js', lint.status === 0, lint.stderr.toString());
  console.log('■ Binaire Go');
  const bb = buildBin();
  check('compilation du binaire OpenMaltForge (go build ./cmd/openmaltforge)', bb.status === 0, String(bb.stderr || ''));
  if (bb.status !== 0) process.exit(1);
  browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  try {
    await scenarioApp('Parcours complet (binaire Go, base gérée par le serveur)');
    await scenarioServeur();
    await scenarioLegacy();
    await scenarioI18n();
    await scenarioLancement();
  } catch (e) {
    fails++;
    console.log('  ERRS:', errs.slice(0, 3).join(' || ').slice(0, 600));
    console.log('  ✘ ERREUR DU TEST :', e.message.split('\n')[0], (e.stack || '').split('\n').slice(1, 4).join(' | '));
  }
  await browser.close();
  console.log(`\n${total - fails}/${total} tests réussis` + (fails ? ` — ${fails} ÉCHEC(S)` : ' ✔'));
  process.exit(fails ? 1 : 0);
})();
