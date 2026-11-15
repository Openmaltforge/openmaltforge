// Captures d'écran de la documentation (web/doc/img/*.jpg), prises dans le vrai OpenMaltForge.
//
// Usage : node dev/doc/captures.js            (compile le binaire ; OPENMALTFORGE_BIN = binaire déjà compilé)
//         node dev/doc/captures.js en         interface en anglais → web/doc/img/en (captures des docs en/es/it/pt)
// Variables : CHROME (navigateur Chromium, défaut : Chrome / Chromium / Brave de /usr/bin), GO (commande go).
// Le script part d'une base vide (données de départ), prépare une recette de démonstration, puis photographie
// chaque écran. À relancer quand l'interface change.
const fs = require('fs'),
  os = require('os'),
  path = require('path'),
  { spawn, spawnSync } = require('child_process');
const LNG = process.argv[2] || 'fr',
  ROOT = path.join(__dirname, '..', '..'),
  OUT = path.join(ROOT, 'web', 'doc', 'img', ...(LNG === 'fr' ? [] : [LNG]));
const { chromium } = require(path.join(ROOT, 'dev', 'tests', 'node_modules', 'playwright-core'));
const CHROME =
  process.env.CHROME ||
  ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/brave-browser'].find(f =>
    fs.existsSync(f)
  );

function binary() {
  if (process.env.OPENMALTFORGE_BIN) return process.env.OPENMALTFORGE_BIN;
  const bin = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bc-doc-')), 'openmaltforge');
  const go = process.env.GO || [path.join(os.homedir(), 'sdk/go1.24.13/bin/go')].find(f => fs.existsSync(f)) || 'go';
  const r = spawnSync(go, ['build', '-o', bin, './cmd/openmaltforge'], {
    cwd: ROOT,
    env: { ...process.env, CGO_ENABLED: '0', GOTOOLCHAIN: 'local' },
    stdio: 'inherit'
  });
  if (r.status !== 0) process.exit(1);
  return bin;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-doc-data-'));
  const srv = spawn(binary(), ['--no-browser', '--port', '0', '--dossier', dir]);
  const url = await new Promise((res, rej) => {
    srv.stdout.on('data', d => {
      const m = /localhost:(\d+)/.exec(d);
      if (m) res(`http://127.0.0.1:${m[1]}/`);
    });
    srv.on('exit', c => rej(new Error('serveur arrêté : ' + c)));
  });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true,
    args: [LNG === 'fr' ? '--lang=fr-FR' : '--lang=en-GB'],
    env: { ...process.env, LANG: LNG === 'fr' ? 'fr_FR.UTF-8' : 'en_GB.UTF-8', LANGUAGE: LNG === 'fr' ? 'fr' : 'en_GB' }
  });
  /* langue du navigateur = langue des captures (format des champs de date : jj/mm/aaaa ou dd/mm/yyyy) */
  const page = await (
    await browser.newContext({ viewport: { width: 1500, height: 920 }, deviceScaleFactor: 1, locale: LNG === 'fr' ? 'fr-FR' : 'en-GB' })
  ).newPage();
  page.on('dialog', d => d.accept());
  await page.goto(url);
  await page.waitForFunction(() => typeof READY !== 'undefined' && READY, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  if (LNG !== 'fr')
    await page.evaluate(l => {
      setLang(l);
      S.kv.equip.lang = l;
    }, LNG);
  await page.addStyleTag({ content: 'html.doccap header, html.doccap .pg > header { position: static !important; }' });
  const wait = ms => page.waitForTimeout(ms);
  const shot = async (name, sel, o = {}) => {
    const file = path.join(OUT, name + '.jpg');
    const opt = { path: file, type: 'jpeg', quality: 84 };
    if (sel) {
      const el = typeof sel === 'string' ? page.locator(sel).first() : sel;
      if (!(await el.isVisible().catch(() => false))) {
        console.log('  ⚠ ' + name + ' : élément non visible, capture ignorée');
        return;
      }
      /* en-tête collant : remis dans le flux pour ne pas recouvrir le haut du panneau photographié */
      await page.evaluate(() => document.documentElement.classList.add('doccap'));
      await el.scrollIntoViewIfNeeded();
      await wait(250);
      const b = await el.boundingBox();
      const pad = o.pad ?? 6;
      await page.screenshot({
        ...opt,
        fullPage: true,
        clip: {
          x: Math.max(0, b.x - pad),
          y: Math.max(0, b.y + (await page.evaluate(() => scrollY)) - pad),
          width: Math.min(o.w || b.width + 2 * pad, 1500),
          height: Math.min(o.h || b.height + 2 * pad, 1400)
        }
      });
      await page.evaluate(() => document.documentElement.classList.remove('doccap'));
    } else {
      await page.evaluate(() => scrollTo(0, 0));
      await wait(200);
      await page.screenshot({ ...opt, clip: o.clip });
    }
    console.log('  ' + name + '.jpg');
  };
  /* panneau repéré par son titre français, traduit dans la langue des captures */
  const panel = t => page.locator('#main .panel').filter({ has: page.locator('h3', { hasText: TR[t] || t }) });
  const TR = {};
  for (const t of ['Malts', 'Houblons', 'Eau & minéraux', 'Ingrédients & consommables', 'Courses', 'Bilan de la recette', 'Paliers d’empâtage', 'Quantités d’eau', 'Resucrage & CO₂', 'Récapitulatif des coûts', 'Analyse organoleptique du brassin', 'Équipement & process', 'Réglages', 'Polices de caractères'])
    TR[t] = await page.evaluate(t => (LANG === 'fr' ? t : i18nT(t) || t), t);

  // --- recette de démonstration ---
  await page.evaluate(() => {
    const R = S.kv.recipe;
    R.name = 'Hop Session IPA';
    R.brasseur = 'Frédéric';
    R.malts = [
      { n: S.malts.find(m => /Pilsen/i.test(m.name)).name, g: 4500 },
      { n: S.malts.find(m => /Munich/i.test(m.name)).name, g: 800 },
      { n: S.malts.find(m => /Cara/i.test(m.name)).name, g: 300 }
    ];
    R.hops = [
      { n: 'Magnum', g: 15, use: 'Ébullition', t: 60 },
      { n: 'Citra', g: 40, use: 'Whirlpool', t: 15 },
      { n: 'Mosaic', g: 60, use: 'Dry hop', t: 0 }
    ];
    const ing = S.ings.find(i => /Irish moss|Mousse/i.test(i.name)) || S.ings[0];
    R.ings = [{ n: ing.name, g: 6 }];
    const cap = S.conso.find(c => /capsule/i.test(c.name)) || S.conso[0];
    /* captures en anglais : nom de démonstration en anglais (donnée de la base, jamais traduite) */
    if (LANG !== 'fr') cap.name = 'Bottle caps';
    R.conso = [{ n: cap.name, g: 60 }];
    S.malts.forEach(m => (m.stock = 25));
    S.hops.forEach(h => (h.stock = 100));
    S.hops.find(h => h.name === 'Mosaic').stock = 20;
    S.yeasts.forEach(y => (y.stock = 4));
    S.ings.forEach(i => (i.stock = 500));
    S.conso.forEach(c => (c.stock = 200));
    S.kv.equip.courses = [];
    show('conception');
  });
  await wait(1500);

  console.log('Conception');
  await shot('conception', null, { clip: { x: 0, y: 0, width: 1500, height: 560 } });
  await shot('conception-malts', panel('Malts'));
  await shot('conception-houblons', panel('Houblons'));
  await shot('conception-eau', panel('Eau & minéraux'));
  await shot('conception-ingredients', panel('Ingrédients & consommables'));
  /* quantité figée devenue insuffisante : triangle orange */
  await page.evaluate(() => {
    const h = S.kv.recipe.hops.find(x => x.n === 'Mosaic');
    h.g = 90;
    conception();
  });
  await wait(600);
  await shot('conception-courses', panel('Courses'));
  await page.evaluate(() => {
    S.kv.recipe.hops.find(x => x.n === 'Mosaic').g = 60;
    conception();
  });
  await wait(300);
  await shot('conception-bilan', panel('Bilan de la recette'));
  await shot('conception-paliers', panel('Paliers d’empâtage'));
  await shot('conception-eau-quantites', panel('Quantités d’eau'));
  await shot('conception-resucrage', panel('Resucrage & CO₂'));
  await shot('conception-couts', panel('Récapitulatif des coûts'));
  /* l'analyse organoleptique apparaît quand la date d'embouteillage est renseignée */
  await page.evaluate(() => {
    S.kv.recipe.embou = new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10);
    conception();
  });
  await wait(600);
  await shot('conception-organoleptique', panel('Analyse organoleptique du brassin'));
  await page.evaluate(() => {
    S.kv.recipe.embou = '';
    conception();
  });
  await wait(400);

  // saisie d'une formule
  console.log('Formules');
  const fin = page.locator('input[data-k="malts"][data-f="g"]').first();
  await fin.scrollIntoViewIfNeeded();
  await fin.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('=4,5+0,25');
  await wait(300);
  await shot('formule-saisie', panel('Malts'));
  await page.keyboard.press('Enter');
  await wait(500);
  await shot('formule-resultat', panel('Malts'));

  // bibliothèque : enregistrement de deux recettes
  console.log('Bibliothèque');
  await page.click('#dbsave');
  await wait(1500);
  await page.evaluate(() => {
    document.querySelector('#newrec').click();
  });
  await wait(600);
  await page.evaluate(() => {
    const R = S.kv.recipe;
    R.name = 'Dry Irish Stout';
    R.style = (S.styles.find(s => /Irish Stout/i.test(s.name)) || S.styles[0]).name;
    R.malts = [
      { n: S.malts.find(m => /Maris|Pale/i.test(m.name)).name, g: 3600 },
      { n: S.malts.find(m => /Roast|Torré|Black/i.test(m.name)).name, g: 400 }
    ];
    R.hops = [{ n: 'East Kent Goldings', g: 40, use: 'Ébullition', t: 60 }];
    conception();
  });
  await wait(500);
  await page.click('#dbsave');
  await wait(1500);
  await page.evaluate(() => show('biblio'));
  await wait(800);
  await shot('bibliotheque', '#main .panel');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('#main button')].find(x => /Vue cartes|Card view/.test(x.textContent));
    if (b) b.click();
  });
  await wait(700);
  await shot('bibliotheque-cartes', '#main .panel', { h: 620 });

  console.log('Bases');
  await page.evaluate(() => show('malts'));
  await wait(800);
  await shot('base-malts', '#main .panel', { h: 560 });
  await page.evaluate(() => show('styles'));
  await wait(800);
  await shot('styles', '#main .panel', { h: 520 });
  await page.evaluate(() => show('eaux'));
  await wait(800);
  await shot('eaux', '#main .panel', { h: 520 });

  console.log('HTML');
  await page.evaluate(() => show('html'));
  await wait(900);
  await shot('html', null, { clip: { x: 0, y: 0, width: 1500, height: 900 } });

  console.log('Étiquettes');
  await page.evaluate(() => show('labels'));
  await wait(1500);
  await shot('etiquettes', null, { clip: { x: 0, y: 0, width: 1500, height: 900 } });
  await page.locator('.lblform input.fin').first().click();
  await wait(700);
  await shot('etiquettes-polices', null, { clip: { x: 900, y: 140, width: 600, height: 520 } });
  await page.keyboard.press('Escape');

  console.log('Feuille de brassage');
  await page.evaluate(() => show('sheet'));
  await wait(1500);
  await shot('feuille', null, { clip: { x: 0, y: 0, width: 1500, height: 900 } });

  console.log('Paramètres');
  await page.evaluate(() => show('params'));
  await wait(1000);
  await shot('parametres-equipement', panel('Équipement & process'));
  await shot('parametres-process', '#procp');
  await shot('parametres-reglages', panel('Réglages'));
  await shot('parametres-polices', panel('Polices de caractères'), { h: 560 });

  await browser.close();
  srv.kill();
  console.log('Captures écrites dans ' + path.relative(ROOT, OUT));
})().catch(e => {
  console.error(e);
  process.exit(1);
});
