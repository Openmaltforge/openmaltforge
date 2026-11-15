# Diffuser OpenMaltForge

Notes et textes prêts à copier pour publier OpenMaltForge et le faire connaître. Rien n'est publié automatiquement :
chaque envoi se fait depuis vos propres comptes.

## 0. Préalable : publier le code source

La licence GNU GPL v3 oblige à fournir le code source à quiconque reçoit les binaires. C'est aussi la première chose
que regardent les dépôts Linux et les communautés du logiciel libre.

- Créer un dépôt public sur **Codeberg** (association européenne, libre) ou **GitHub** (plus visible), puis :
  `git remote add origin <adresse>` et `git push -u origin main --tags`.
- Y publier chaque version comme « release » avec les 7 fichiers de `bin/<version>/` (`.exe`, zip Windows, binaire et
  archive Linux, `.deb`, les deux zip macOS).
- Ajouter le lien du dépôt sur le site (`site/index.html`) et dans la documentation.

## 1. Dépôts Linux (du plus simple au plus long)

| Canal | Pour qui | Effort | Remarques |
|---|---|---|---|
| **Dépôt APT personnel** | Debian, Ubuntu, Mint | faible | Héberger les `.deb` signés (GPG) sur le site avec `reprepro` ou `aptly` ; l'utilisateur ajoute le dépôt une fois, puis `apt upgrade` installe les nouvelles versions. |
| **AUR** (Arch, Manjaro) | Arch | faible | Écrire un `PKGBUILD` « `openmaltforge-bin` » qui télécharge le binaire Linux ; compte AUR gratuit. |
| **AppImage** + AppImageHub | toutes distributions | faible | Un seul fichier exécutable ; référencement sur appimage.github.io. |
| **Fedora COPR** | Fedora, RHEL | moyen | Il faut un paquet `.rpm` (outil `nfpm` ou fichier `.spec`) ; COPR construit et héberge. |
| **Launchpad PPA** | Ubuntu | moyen | Paquet source obligatoire, compilé chez Launchpad sans accès réseau : dépendances Go à inclure (`go mod vendor`). |
| **Flathub** / **Snap Store** | toutes | élevé | Le bac à sable empêche de lancer le navigateur installé sur le système, dont OpenMaltForge a besoin. Faisable surtout après le passage à une fenêtre intégrée (WebKitGTK), prévu plus tard. |
| **Debian officiel** (puis Ubuntu) | tous | très élevé | Demande « ITP », paquet source conforme à la charte Debian Go, parrain Debian (mentors.debian.net) ; plusieurs mois. |

Ordre conseillé : code source public → dépôt APT personnel + AUR → AppImage → COPR → Debian officiel si l'application
prend.

## 2. Faire connaître l'application aux brasseurs amateurs

- **Forums de brassage** : forum de Brassage Amateur (brassageamateur.com) en français ; HomeBrewTalk (rubrique
  logiciels) en anglais. Présenter l'application dans la rubrique prévue, répondre aux questions, revenir à chaque
  version.
- **Reddit** : r/Homebrewing (respecter les règles sur l'autopromotion : fil hebdomadaire ou message de présentation
  honnête), r/brewing, r/opensource, r/selfhosted (application hors ligne).
- **Logiciel libre en français** : dépêche sur **LinuxFr.org**, fiche dans l'annuaire **Framalibre**, partage sur
  Mastodon (mots-clés #brassage #homebrewing #logiciellibre).
- **Annuaires** : AlternativeTo (en alternative à BeerSmith, Brewfather, Brewer's Friend), Product Hunt, « Show HN » sur
  Hacker News le jour d'une version importante.
- **Terrain** : clubs et associations de brasseurs amateurs, salons et concours, magasins de matériel de brassage
  (une fiche ou un QR code vers le site), vidéastes qui testent du matériel et des logiciels de brassage.
- **Accueil des retours** : adresse openmaltforge@pm.me et suivi des tickets du dépôt public ; une page « Nouveautés »
  sur le site à chaque version.

## 3. Texte d'annonce (français)

> **OpenMaltForge : un logiciel de brassage libre et gratuit, pensé par un brasseur**
>
> Je suis brasseur professionnel et j'ai développé OpenMaltForge, une application de bureau gratuite et libre
> (GNU GPL v3) pour concevoir et brasser ses bières, de la recette à l'étiquette :
> - recettes (malts, houblons, levures, eau, paliers, styles BJCP) avec le bilan en direct ;
> - calculs : DI, DF, IBU (Tinseth), couleur EBC, alcool, volumes d'eau, process par phases avec la densité à chaque étape ;
> - coûts, stocks et liste de courses automatique ;
> - étiquettes et feuille de brassage imprimables, import BeerXML et PDF.
>
> Elle fonctionne hors ligne, sans compte ni abonnement : vos données restent sur votre ordinateur (une seule base
> SQLite). Windows, Linux et macOS ; interface en français, anglais, espagnol, italien et portugais.
>
> Téléchargement : <adresse du site> — Contact : openmaltforge@pm.me
> Vos retours m'intéressent !

## 4. Announcement text (English)

> **OpenMaltForge: a free, open-source brewing app made by a brewer**
>
> I'm a professional brewer and I built OpenMaltForge, a free and open-source (GNU GPL v3) desktop application to
> design and brew your beers, from recipe to label:
> - recipes (malts, hops, yeasts, water, mash steps, BJCP styles) with a live summary;
> - calculations: OG, FG, IBU (Tinseth), EBC colour, ABV, water volumes, a phase-by-phase process with the gravity at
>   every step;
> - costs, stock and an automatic shopping list;
> - printable labels and brew sheet, BeerXML and PDF import.
>
> It works offline, with no account and no subscription: your data stays on your computer (a single SQLite database).
> Windows, Linux and macOS; interface in English, French, Spanish, Italian and Portuguese.
>
> Download: <website address> — Contact: openmaltforge@pm.me
> Feedback is very welcome!
