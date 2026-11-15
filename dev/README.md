# Développement OpenMaltForge

- `python3 dev/gen-data.py` : régénère `web/js/data.js` (malts, houblons, levures de départ). Ces données sont chargées
  par le navigateur quand la base est vide (premier lancement) : il n'y a plus de base de départ à générer.
- `node dev/tests/e2e.js` : tests de bout en bout. Le script compile le binaire Go (`go build ./cmd/openmaltforge`), le lance
  en mode serveur seul (`--no-browser --dossier <dossier temporaire>`) pour chaque scénario et le pilote avec Playwright.
  Variables : `CHROME` (navigateur Chromium ; défaut : Chrome, Chromium ou Brave trouvé dans `/usr/bin`),
  `OPENMALTFORGE_BIN` (binaire déjà compilé), `GO` (commande go), `PLAYWRIGHT` (module Playwright).
  Commande habituelle : `timeout 900 node dev/tests/e2e.js 2>&1 | grep "✘\|tests réussis"`.
- Installation de `playwright-core` (sans navigateur ; npm n'est pas installé sur le poste) :
  ```bash
  cd dev/tests && curl -sL https://registry.npmjs.org/playwright-core/-/playwright-core-1.65.1.tgz -o /tmp/pc.tgz \
    && mkdir -p node_modules/playwright-core && tar xzf /tmp/pc.tgz -C node_modules/playwright-core --strip-components=1
  ```
  (avec npm : `npm install` dans `dev/tests`).
- `dev/tests/lib/sql-wasm.*` : sql.js, utilisé **uniquement par les tests** pour lire les fichiers de base et fabriquer
  d'anciennes bases ; l'application ne l'utilise plus.
- Aides de test injectées dans la page : `__rt()` (aller-retour réel de l'état par le serveur et SQLite),
  `__sqlq(requête)` (lecture du fichier de base), `__fsa.writes` (nombre d'écritures de la base).
- `python3 dev/icon/mkicons.py <version>` : icônes PNG, `openmaltforge.ico` et `cmd/openmaltforge/rsrc_windows_amd64.syso`
  (appelé par `scripts/build.sh`, qui recopie aussi les PNG dans `internal/desktop/icons/`).
