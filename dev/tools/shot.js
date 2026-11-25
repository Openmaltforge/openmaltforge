/* Outil de développement : construit le binaire, le lance sur un dossier de données temporaire, ouvre l'interface dans
   un navigateur Chromium sans fenêtre (Playwright) et exécute un script d'actions (captures, PDF…).
   Usage : node dev/tools/shot.js <dossier de sortie> <actions.js>
   actions.js : module.exports = async (page, outDir, dataDir, url) => { … }   — navigateur : variable CHROME. */
const fs = require('fs'),
  os = require('os'),
  path = require('path'),
  { spawn, spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..'),
  OUT = path.resolve(process.argv[2] || '.'),
  { chromium } = require(path.join(ROOT, 'dev/tests/node_modules/playwright-core'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omf-shot-')),
  bin = path.join(dir, 'omf'),
  go = process.env.GO || 'go';
const r = spawnSync(go, ['build', '-o', bin, './cmd/openmaltforge'], { cwd: ROOT, env: { ...process.env, CGO_ENABLED: '0' }, stdio: 'inherit' });
if (r.status) process.exit(1);
(async () => {
  const srv = spawn(bin, ['--no-browser', '--port', '0', '--dossier', path.join(dir, 'data')]);
  srv.stderr.on('data', d => process.stderr.write(d));
  const url = await new Promise(res =>
    srv.stdout.on('data', d => {
      const m = /localhost:(\d+)/.exec(d);
      if (m) res(`http://127.0.0.1:${m[1]}/`);
    })
  );
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/brave-browser', headless: true });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 800 }, acceptDownloads: true })).newPage();
  await p.addInitScript(() => (window.__bcManual = true));
  await p.goto(url);
  await p.waitForFunction(() => typeof READY !== 'undefined' && READY, null, { timeout: 30000 });
  await p.waitForTimeout(2000);
  await p.keyboard.press('Escape');
  try {
    await require(path.resolve(process.argv[3]))(p, OUT, path.join(dir, 'data'), url);
  } catch (e) {
    console.error(e);
  }
  await b.close();
  srv.kill();
  fs.rmSync(dir, { recursive: true, force: true });
})();
