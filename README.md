# OpenMaltForge v6.10.7

Application de bureau de conception de recettes de bière : un binaire Go unique qui embarque l'interface
(JavaScript sans framework) et gère la base SQLite, affichée dans une fenêtre d'application Chromium
(Edge, Chrome, Chromium ou Brave).

## Démarrage

- **Linux** : installer `openmaltforge_<version>_amd64.deb` (menu « OpenMaltForge »), ou lancer directement `openmaltforge_<version>_linux_amd64`.
- **Windows** : lancer `OpenMaltForge_<version>.exe`.
- **macOS** : décompresser `OpenMaltForge_<version>_macos_apple_silicon.zip` (ou `_macos_intel.zip`), glisser
  `OpenMaltForge.app` dans Applications ; premier lancement par clic droit › Ouvrir (application non signée).

La base est le fichier unique `~/OpenMaltForge/openmaltforge.sqlite`. Au premier lancement, la base d'OpenBrew 5.x
(`~/OpenBrew/openbrew.sqlite`), sinon celle de BrewCraft 4.x (`~/BrewCraft/brewcraft.sqlite`), est reprise automatiquement, sinon la plus récente d'une version 3.x
(`brewcraft_<version>.sqlite`) ; l'original n'est pas modifié.
Avant toute mise à niveau de la structure, une copie est écrite dans `~/OpenMaltForge/sauvegardes/`.

Les modifications sont écrites dans la base par le bouton « Sauvegarder » ou par la sauvegarde automatique
(réglable dans Paramètres › Réglages).

Options : `--no-browser` (serveur seul, affiche l'adresse), `--port <n>`, `--dossier <chemin>` (ou variable
`OPENMALTFORGE_DIR`), `--version`. Variable `OPENMALTFORGE_BROWSER` : navigateur à utiliser.

## Contenu

- `cmd/openmaltforge/` : point d'entrée (mode bureau ou serveur seul).
- `internal/db/` : ouverture de la base (`modernc.org/sqlite`, Go pur), migrations versionnées (`PRAGMA user_version`).
- `internal/store/` : conversion base SQLite ↔ état JSON de l'application.
- `internal/server/` : serveur local (127.0.0.1) et API `/api/etat`, `/api/info`, `/api/export`, `/api/import`.
- `internal/desktop/` : fenêtre Chromium, entrée de menu et icônes Linux.
- `web/` : interface embarquée (`index.html`, `css/`, `js/`, `lib/`).
- `packaging/deb/`, `scripts/build.sh` : construction des livrables dans `bin/<version>/` (icône à part dans
  `bin/<version>/icone/`).
- `dev/` : tests e2e (`dev/tests`), icône, données BJCP et générateurs.

## Fonctions utiles

- **Numéro de brassin** (étiquettes, HTML) : `année#rang`, l'année étant celle de la date de brassage et le rang la position de la recette parmi celles de la bibliothèque brassées la même année, par date croissante, recettes importées exclues du comptage (ex. `2026#12`).
- **Export** : Paramètres › Réglages › « Exporter la base… » télécharge une copie SQLite nommée `AAAAMMJJ_openmaltforge.sqlite` (état affiché, modifications non enregistrées comprises).
- **Changer de base** : Paramètres › Réglages › « Changer de base… » remplace la base par le contenu d'un autre fichier `.sqlite` (vérifié et mis à niveau ; l'ancienne base est copiée dans `sauvegardes/`).

## Polices

Uniquement des polices libres de Google Fonts, stockées dans la base (table `polices`) : les polices de l'interface ne sont pas supprimables ; les autres peuvent être remplacées à la suppression (Inter par défaut). La police par défaut du « Bandeau oblique » est Covered By Your Grace (Google Fonts, depuis la 6.3.0) ; Superscratchy, de licence non libre, a été retirée de l'application et des bases.

## Développement

```bash
go test ./...                    # tests Go (base, migrations, état JSON, API)
node dev/tests/e2e.js            # tests de bout en bout (binaire Go + navigateur Chromium du système)
scripts/build.sh                 # livrables dans bin/<version>/
```

Go 1.24 (`~/sdk/go1.24.13`). Les tests e2e utilisent `playwright-core` (dans `dev/tests/node_modules`, voir `dev/README.md`).
