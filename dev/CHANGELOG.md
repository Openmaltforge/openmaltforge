# BrewCraft v3.122.1

## v3.122.1

- Radars : l'infobulle « Cliquer ou Échap pour fermer » n'existe plus dans le code (vérifié dans Chromium sur Conception, Malts, Houblons et Levures, radar agrandi compris). Si elle apparaît encore, le navigateur sert d'anciens fichiers : l'en-tête doit afficher **v3.122.1** ; sinon recharger avec Ctrl+Maj+R (vider le cache).
- `index.html` : en-têtes « no-cache » pour que le navigateur recharge toujours les scripts à jour.
- Tests : 331.

## v3.122.0

- Paramètres › Polices de caractères : le bouton « Importer » accepte **plusieurs fichiers à la fois** (sélection multiple) ; une seule sauvegarde et une notification « ✔ N polices importées ». Un fichier de même nom remplace la police existante.
- Paramètres › Réglages : champ des minutes de la sauvegarde automatique (lecture seule) : fond = gris du fond de la page, bord fin, texte normal (plus d'italique).
- Tests : 329.

## v3.121.1

- Radars : suppression de l'infobulle « Cliquer ou Échap pour fermer » (le radar plein écran se ferme toujours par clic ou Échap).

## v3.121.0

- Notifications d'information (sauvegarde, calcul de la recette…) : **vert** identique dans les deux cas (correction : la notification « Recalculé » héritait par erreur du style du thème clair en thème sombre).
- Notifications d'alerte (ratio d'empâtage, base non synchronisée) : orange **adouci**, même dégradé sombre / bordure / texte clair que le vert.
- Radars (Conception, Malts, Houblons, Levures, comparatif) : après 1 seconde de survol d'un point, une infobulle affiche sa **valeur numérique** (et le nom de la série / de l'axe).
- Tests : 327.

## v3.120.0

- Infobulle de visualisation des polices (Paramètres › Polices de caractères) : la citation « La bière est la preuve indéniable que Dieu nous aime et veut nous voir heureux. » — Benjamin Franklin remplace la phrase d'exemple.
- Zone de notification de l'écran Conception : la notification « ✔ Recalculé : DI … / … IBU » (et ses erreurs) a désormais **sa propre case** au lieu d'écraser celle de sauvegarde : sauvegarde + calcul IBU/DI + ratio d'empâtage élevé s'affichent ensemble (33 % de largeur chacune). Les messages temporaires disparaissent après 10 s, les avertissements orange restent jusqu'à correction.
- Tests : 324.

## v3.119.1

- Notifications : bords arrondis (pilules), espace de 8 px entre chacune, ombre légère ; l'avertissement est d'un **orange franc** (dégradé orange, texte foncé, gras).

## v3.119.0

- Warning du ratio d'empâtage (Conception) : déclenché dès que **« Volume d’eau + malt (L) »** (Process — pertes et ajouts d’eau) est **supérieur ou égal** à **« Volume maxi empâtage + malt dans la cuve (L) »** (Paramètres de brassage) — l'égalité déclenche aussi l'alerte (avant : seulement le dépassement, calculé sur eau + malt en kg). Même critère pour le champ rouge du Process et le message de l'écran Paramètres.
- Ce warning s'affiche aussi comme **notification orange** dans la zone de notification, à côté de « ✔ Tout est enregistré… » (et de l'avertissement de base non synchronisée) ; il reste tant que le défaut n'est pas corrigé, quel que soit l'écran affiché.
- Tests : 323.

## v3.118.0

- La base fournie s'appelle désormais **`brewcraft_<version>.sqlite`** (ex. `brewcraft_3.118.0.sqlite`) ; les messages de l'application citent ce nom. Un autre nom de fichier reste accepté (le navigateur ouvre le fichier choisi).
- Paramètres › Réglages : sauvegarde automatique désactivée → le champ des minutes passe en **lecture seule** (valeur conservée, texte grisé en italique).
- Zone de notification sous le menu : quand la base n'est plus synchronisée (⚠), une **notification orange** s'ajoute à la suite des autres et reste jusqu'à ce que le défaut soit corrigé (clic = nouvelle tentative d'enregistrement). Les notifications se partagent la largeur à parts égales : 1 → 100 %, 2 → 50 %, 3 → 33 %…, recalculée quand l'une disparaît.
- Test de bout en bout de la notification de sauvegarde automatique (modification dans l'interface → minuterie de 5 min → écriture → « ✔ Tout est enregistré »).
- Tests : 322.

## v3.117.0

- Étiquettes : deux boutons **A↑ / A↓** à côté de « Police » augmentent / réduisent de 10 % la taille de la police du nom (de 40 % à 250 %, mémorisée avec la recette). Le texte est toujours réduit automatiquement s'il déborde de son cadre.
- Paramètres › Polices de caractères : la suppression d'une police ouvre **toujours** la fenêtre de remplacement ; si aucune police n'est saisie, c'est **Inter** qui remplace (le champ propose « Inter-… (par défaut) »).
- Survol du nom d'une police pendant 1 seconde : une infobulle affiche la phrase « Portez ce vieux whisky au juge blond qui fume 0123456789 » dans cette police.
- Tests : 319.

## v3.116.0

- Sauvegarde automatique : quand elle écrit la base, la même notification qu'après un clic sur « Sauvegarder » s'affiche en haut de l'écran (« ✔ Tout est enregistré dans … — heure »). Une erreur n'est annoncée que si la base était jusque-là synchronisée.
- Valeur par défaut de la sauvegarde automatique : **5 minutes** (appliquée une fois aux bases existantes).
- Équipement : le nom par défaut est **BrewMonk B50** (nouvelles bases, et bases existantes dont le nom est vide ; un nom déjà saisi est conservé).
- La migration d'une ancienne base et l'ajout des polices intégrées sont écrits immédiatement (sans attendre les 5 minutes) ; la notification ne remplace pas un autre message affiché (ex. récapitulatif d'import).
- Tests : 316.

## v3.115.0

- 13 polices Google Fonts insérées dans la base (table `polices`) : Bowlby One, Caprasimo, Courier Prime (Regular, Bold, Italic, BoldItalic), Inter (droit + italique, variable), Playfair Display (droit + italique, variable), Roboto Mono (droit + italique, variable) et Rock Salt. Ajoutées une fois aux bases existantes, présentes dans `brewcraft.sqlite`.
- Non supprimables (cadenas) comme les 9 polices de l'interface. Les variantes italiques sont enregistrées avec `font-style: italic` (vrai italique pour le journal de bord, Inter, etc.).
- Il y a maintenant 31 polices dans la base (9 de départ supprimables avec remplacement, 22 verrouillées).
- Tests : 315.

## v3.114.1

- Paramètres › Réglages : suppression des deux phrases d'aide (sauvegarde automatique, traductions) ; la base s'affiche « Base de données : brewcraft.sqlite » sur la ligne du bouton « Changer de base… ».

## v3.114.0

- **Plus aucune police propriétaire** : Segoe UI, Arial, Helvetica, Georgia, Times New Roman, Consolas, Courier New, Arial Narrow, Bahnschrift, Showcard Gothic, Cooper Black, Saint Carell, Superscratchy, Ubuntu Condensed et Bookman sont retirées du CSS, des modèles d'étiquette et des exports HTML. Seules subsistent des polices Google Fonts (à insérer dans la base) et des familles génériques (`sans-serif`, `serif`, `monospace`).
- Interface : **Inter** (texte), **Roboto Mono** (zones de code), **Playfair Display** (journal de bord), **Oswald** (déjà dans la base, titres condensés).
- Étiquettes : Showcard Gothic → **Bowlby One**, Cooper Black → **Caprasimo**, Bahnschrift → **Oswald Bold**, Superscratchy → **Rock Salt**, Saint Carell → **Playfair Display**, Courier New → **Courier Prime**, Segoe UI → **Inter**, Georgia / Times New Roman → **Playfair Display**. Les identifiants des modèles sont inchangés (les recettes existantes gardent leur police choisie).
- Ces polices sont reconnues par nom de fichier (ex. `Inter[opsz,wght].ttf`, `RobotoMono[wght].ttf`, `RockSalt-Regular.ttf`) et sont non supprimables. Sans fichier, le navigateur retombe sur la police générique.
- Tests : 314.

## v3.113.1

- Flèche de tri jaune des en-têtes de colonne : taille réduite de 1 pt (≈ 1,33 px).

## v3.113.0

- Polices de l'interface : Bebas Neue, Bungee, Creepster, Henny Penny, Kalam, Kaushan Script, Permanent Marker, Stardos Stencil et UnifrakturCook sont stockées dans la table `polices` (ajoutées une fois aux bases existantes, présentes dans `brewcraft.sqlite`). Non supprimables : un cadenas remplace la croix. Licences dans `lib/FONTS-LICENSES.txt`.
- Paramètres › Polices de caractères : tri croissant / décroissant sur la colonne « Nom » (clic sur l'en-tête, même flèche que les autres listes ; l'ordre de la base, utilisé par les références des recettes, n'est pas modifié).
- Tests : 312.

## v3.112.0

- En-têtes de colonne des listes : flèche de tri en triangle plein, jaune, bien visible.
- Paramètres › nouvelle section **Réglages** : curseur d'activation + durée en minutes de la sauvegarde automatique (0 = après chaque modification, comportement précédent ; N > 0 = écriture au plus tard N minutes après la première modification ; désactivée = seul « Enregistrer » écrit, avec avertissement à la fermeture si des modifications sont en attente). Elle regroupe aussi la langue et le contenu de « Base de données » (anciennes sections supprimées).
- « Électricité » devient « Besoins en électricité ».
- Section « Coûts » supprimée : le prix du kWh (ligne « Électricité ») et du m³ (ligne « Eau ») sont deux lignes de la table Consommables, modifiables mais non supprimables (conservées par « Tout effacer », absentes des listes de saisie des recettes). Les anciennes valeurs sont reprises au premier lancement.
- Tests : 310.

## v3.111.0

- Étiquettes : les polices Microsoft / Apple des modèles sont remplacées par des polices Google Fonts (SIL OFL / Apache 2.0) : Impact → Bebas Neue (repli Anton), Chiller → Creepster, Jokerman → Henny Penny, Stencil → Stardos Stencil, Old English → UnifrakturCook, Ink Free → Kalam / Caveat Brush, Bauhaus 93 → Bungee, Marker Felt → Permanent Marker, Brush Script → Kaushan Script. Les polices de départ de BrewCraft servent de repli tant que les fichiers ne sont pas importés.
- Pour activer une police : Paramètres › Polices › Importer le fichier .ttf (nom de fichier d'origine, ex. `Creepster-Regular.ttf`) — il est stocké dans la base et utilisé automatiquement par les modèles concernés. Les polices variables (`…[wght].ttf`) sont prises en charge.
- Feuille de brassage et journal : plus de référence à Impact / Ink Free dans le CSS.
- Paramètres › Polices de caractères : pagination à partir de 15 lignes (même barre que les autres listes, remise à la page 1 par la recherche). Polices « Bold » / « Light » importées : graisse reconnue d'après le nom du fichier.
- Tests : 306.

## v3.110.0

- Conception : le triangle d'alerte du ratio d'empâtage s'affiche à droite de la zone de texte.
- Paramètres › Unités (nouvelle section, même style que les autres) : préréglages Métrique / Imperial / US et 12 lignes (densité affichée et saisie, couleur, couleur du grain, température, volume, poids, houblon, carbonatation, pression, altitude, pouvoir diastatique). Les choix sont enregistrés dans les paramètres de la base (`units`). Pour l'instant ils mémorisent la préférence : les écrans de calcul restent en unités métriques.
- Tests : 305.

## v3.109.0

- Polices : les 9 polices TTF fournies sont stockées dans la table `polices` de la base (copiées au premier lancement) et lues depuis la base ; aucune requête réseau, l'application fonctionne hors ligne. Une police importée dont le nom correspond à une famille citée par un modèle d'étiquette (Impact, Chiller, Stencil, Playfair Display, Old English…) est enregistrée sous ce nom : les modèles l'utilisent aussitôt.
- Suppression d'une police utilisée (étiquette ou feuille de brassage d'une recette, modèle d'étiquette) : fenêtre « Remplacer la police » avec auto-complétion sur les polices de la base ; les recettes de la bibliothèque et les modèles basculent sur la police choisie (`fontmap` dans les paramètres). Réimporter une police l'enregistre sur place (références inchangées).
- Paramètres › Équipement & process : « Ratio d'empâtage par défaut (L/kg) » après « IBU cible par défaut » ; appliqué au ratio de la Conception à « Nouvelle recette ».
- HTML : ajout de la ligne « Brassin réalisé (embouteillage) » ; le code HTML stocké de toutes les recettes de la bibliothèque est recalculé quand le gabarit change (`HTMLV`) ; la liste de courses n'y figure pas (test).
- Tests : 303.

## v3.108.0

- Étiquettes : 8 modèles supprimés (ovale orange & marine, pale ale marine & or, houblon vertical bleu acier et nuit, kraft bandes verte/orange/rouge, sceau vintage brun foncé).
- Cartouche coins coupés : moitié basse exploitée (malts, houblons, dates), plus de texte tronqué.
- Rond détaillé : texte recentré dans le cercle, logo décollé du bord, QR et listes ajustés.
- Brewery brun (Dark & Light) : cadre filet avec ornements, listes et QR sans chevauchement.
- Anneau vert houblon & ruban : liseré pointillé, ombre du ruban, espacements.
- Tests : modèles supprimés absents, 4 modèles sans débordement ni chevauchement.

## v3.107.1

- **Eau & minéraux** : une eau choisie à 0 % (ligne ajoutée, pas encore dosée) affichait 0,00 partout. Ses caractéristiques (Cl, SO₄, Ca, Mg, Na, HCO₃) sont maintenant affichées, estompées, avec une infobulle ; elles n'entrent pas dans le sous-total tant que le % est à 0. Test de non-régression ajouté.

## v3.107.0

- **Radar agrandi (Malts, Houblons, Levures)** : correction de l'affichage. La croix de fermeture (icône Lucide) héritait de la taille du graphique et recouvrait tout l'écran. Elle garde maintenant sa taille ; le diagramme atténuation / floculation est concerné aussi.
- **Tests de non-régression Playwright** (`dev/tests/e2e.js`) : le zoom des radars est vérifié sur les 3 écrans (graphique, légende et croix dans la fenêtre, taille de la croix ≤ 60 px, Échap ferme), ainsi que le diagramme de floculation.
- **Paramètres** : « Volume à embouteiller (L) » et « Durée d'ébullition (min) » deviennent, comme la DI cible, des **valeurs par défaut pour les nouvelles recettes**, indépendantes de la Conception (volume de la recette = champ de la Conception ; ébullition = ligne du tableau des paliers). À la première ouverture, elles reprennent les valeurs actuelles.
- **Notification « Recalculé : DI … / … IBU »** : s'affiche maintenant dans la bande sous le menu, avec le même comportement que les autres (10 secondes, hauteur d'en-tête stable) ; l'ancien emplacement dans l'écran Conception est supprimé.

## v3.106.0

- **Icônes alignées par colonne** dans l'écran Eaux (et tous les écrans de base, ainsi que la colonne ✕ de la Conception) : l'emplacement du caddie est réservé même quand il est masqué.
- **Performances** : la génération de la base SQLite à chaque sauvegarde (≈ 360 ms, thread bloqué) passe à ≈ 70 ms (une seule transaction) ; le caddie ne recalcule plus le besoin de la recette pour chaque ligne (un calcul par mise à jour).
- **Feuille de courses** : tient toujours sur **1 seule page A4** (mise à l'échelle automatique quand la liste est longue).
- **Liste de courses sauvegardée** : test de bout en bout ajouté (enregistrement dans la base, rechargement, liste restaurée).

## v3.105.0

- **Section « Courses »** : titre et cadre harmonisés avec les autres sections de la Conception (panneau « 🛒 Courses », imprimante à droite) ; le tableau garde l'affichage groupé par rubrique (titres jaunes, quantités modifiables, estimation, ✕ rouge, total).
- **Eaux minérales** : l'écran Eaux a son caddie, **uniquement sur les lignes de type « minérales »** (le type modifié met le caddie à jour). Un clic ajoute 10 L (modifiable) à la rubrique « Eaux minérales » de la liste de courses, également imprimée sur la feuille.

## v3.104.2

- **Section « Courses »** : retour au visuel de la fiche (en-tête avec caddie, tableau groupé par rubrique, total en pied) avec le bouton imprimante, quantités modifiables et ✕ rouge.

## v3.104.1

- **Section « Courses »** harmonisée avec les autres sections de la Conception (même panneau : titre « 🛒 Courses », bouton imprimante à droite, tableau Article / À acheter / Unité / Coût, ligne Total, ✕ rouge).

## v3.104.0

- **Section « Courses »** (Conception) : même visuel que l'ancien popup de consultation (en-tête avec caddie et pastilles, tableau par rubrique, total) ; quantités modifiables et ✕ rouge pour retirer une ligne. Le bouton œil (popup) est supprimé et remplacé par un bouton **imprimante** qui imprime directement la liste.
- La section **n'apparaît que s'il y a au moins un article à acheter**.

## v3.103.0

- **Feuille de courses imprimée** refaite dans le style de la fiche recette : en-tête avec verre et pastilles (date, nombre d'articles), tuiles chiffrées (articles par rubrique, estimation), une carte par rubrique avec cases à cocher, quantités et estimation, total.
- **Section « Courses »** (Conception) : la liste des composants est de nouveau affichée (type, article, quantité) avec **✕ rouge pour retirer** une ligne ; l'œil ouvre le popup (quantités modifiables, impression).

## v3.102.1

- **Courses (correctif)** : dans les écrans Malts, Houblons, Levures, Ingrédients et Consommables, le caddie est maintenant **toujours visible** à la fin de chaque ligne (avant, il n'apparaissait que si le stock était insuffisant pour la recette, donc presque jamais). Un clic ajoute l'article : le manque pour la recette en cours s'il y en a un, sinon une quantité par défaut (1 kg de malt, 100 g de houblon ou d'ingrédient, 1 sachet, 1 unité) modifiable dans la liste.
- Chaque ajout affiche un **message de confirmation** en haut (article, quantité, nombre d'articles de la liste), et le caddie devient vert.
- Dans la Conception, le caddie reste affiché uniquement quand le stock est insuffisant pour la recette.

## v3.102.0

- **Liste de courses en popup** (même présentation que la fiche recette) : ouverte par l'œil de la section « Courses » ; quantités modifiables, ✕ rouge pour retirer une ligne, **imprimante** dans le popup pour imprimer. Les boutons Imprimer / Vider de la section sont supprimés (elle affiche un résumé : nombre d'articles et estimation).
- **Nouvelle feuille imprimée** : style sobre et typographique (noir sur blanc, titre en capitales, lignes pointillées, cases à cocher, total, zone de notes).
- **Caddie dans les écrans Malts, Houblons, Levures, Ingrédients, Consommables** : devant le ✕ de chaque ligne, même comportement que dans la Conception (visible si le stock est inférieur au besoin de la recette en cours, donc aussi si le stock saisi est négatif ; un clic ajoute le manque à la liste).

## v3.101.0

- **Courses** : dans la Conception, une ligne de malt / houblon / levure / ingrédient / consommable affiche un **caddie** 🛒 devant le ✕ quand le stock de la base, moins la quantité saisie dans la recette, est inférieur à 0 (les minéraux de l'eau sont comptés dans le besoin). Un clic ajoute le manque à la liste de courses (par recette : recliquer met à jour au lieu de doubler). Le caddie devient vert quand l'article est déjà dans la liste.
- Nouvelle section **🛒 Courses** sous « Ingrédients & consommables » : quantités modifiables, estimation du prix d'après la base, ✕ pour retirer, « Vider ». La liste est conservée dans la base (Paramètres).
- Bouton **🖨** : feuille A4 soignée (en-tête, rubriques Malts / Houblons / Levures / Ingrédients / Consommables, cases à cocher, quantités, estimation et total).

## v3.100.0

- **Stock** : nouvelle colonne **stock** dans les listes Malts (kg), Houblons (g), Levures (sachets), Ingrédients (g) et Consommables (unités). Saisie après le clic sur ✎ comme les autres valeurs ; présente dans l'export/import CSV (0 par défaut).
- **Filtre stock** (placeholder « filtrer… ») : **1** = stock strictement supérieur à 0, **0** = pas de stock.
- **Déduction automatique** : quand la recette passe à **Réalisé** (date d'embouteillage renseignée dans la Conception), les malts, houblons, levures, ingrédients, consommables et minéraux ajoutés à l'eau de la recette sont déduits du stock (jamais en dessous de 0). Une seule fois par recette ; si la date est effacée, les quantités déduites sont remises en stock. Une copie de recette repart sans déduction.

## v3.99.7

- **DI / IBU cibles par défaut** : valeurs indépendantes de l'écran Conception. Elles ne sont plus modifiées par la cible saisie dans une recette, et chaque « Nouvelle recette » démarre toujours avec les valeurs des Paramètres.

## v3.99.6

- **Paramètres › Équipement & process** : nouveaux champs **DI cible par défaut** et **IBU cible par défaut**, synchronisés dans les deux sens avec la cible de l'écran Conception (modifier l'un met à jour l'autre) et repris par « Nouvelle recette ». À la première ouverture, ils reprennent la cible de la recette en cours.

## v3.99.5

- **Correspondance à l'import** : pour un ingrédient absent de la base, l'autocomplétion propose **tous les composants** (malts, houblons, levures, ingrédients, consommables, avec leur catégorie en libellé). La liste « Stocker comme malt / ingrédient » est supprimée : la ligne passe automatiquement dans la catégorie du composant choisi (PDF et Beer.xml, y compris ↻ Recharger). Sucre/lactose sans choix restent rangés comme ingrédients.

## v3.99.4

- **Bibliothèque : 👁 Consulter pour toutes les recettes**, y compris les miennes (liste et cartes) ; ✎ ouvrir dans la conception reste disponible pour mes recettes.

## v3.99.3

- **Consommables : colonne « unité »** (nouvelle colonne de la base, après le nom) : saisie libre du type de consommable (pièce, g, dose…) ; elle est affichée dans la colonne « Unité » de la section « Ingrédients & consommables » de la conception, exportée/importée en CSV (nom;unite;prix). Les valeurs de départ (capsules, sucre de resucrage, sanitiseur, filtre) sont renseignées ; sur une base existante la colonne est ajoutée vide.
- **Normalisation à l'import** : l'autocomplétion de la boîte de correspondance propose les tables **Ingrédients + Consommables** ; un consommable choisi range la ligne dans les consommables de la recette (quantité 1) ; un consommable n'est plus signalé comme inconnu (↻).

## v3.47.0

- Étiquettes et Feuille de brassage : sélecteur « Couleur police » (après le choix de police), propre à l’étiquette / feuille en cours, réinitialisé au changement de modèle. Champ « Texte du QR Code » réduit.

## v3.98.1

- Bouton « ＋ » (ajout de ligne) des écrans Malts, Houblons, Levures, Ingrédients : même cadre (liseret bleu) et même croix que les boutons « ＋ » de l'écran Conception.

## v3.99.2

- **Correspondance à l'import** (beer.xml, PDF, icône ↻) : pour un ingrédient absent de la base, l'autocomplétion propose le contenu des tables **Ingrédients et Consommables**, et un consommable choisi est accepté. Dans la conception, un nom qui n'existe que dans les consommables est rangé automatiquement avec les consommables.

## v3.99.1

- Flèches ▲ ▼ et croix de fin de ligne portées à **12 px** (Paliers d’empâtage de la conception, tableau Process des Paramètres).

## v3.99.0

- **Bouton « ＋ »** de la colonne des actions (Malts, Houblons, Levures, Ingrédients, Consommables) : même cadre bleu et même croix que les boutons « ＋ » de l'écran de conception.
- **Minéraux** (Ca, Mg, Na, Cl, SO4, HCO3) : retirés de la base Consommables et placés dans la base **Ingrédients** (le prix déjà saisi est conservé, migration automatique). Ils continuent d'apparaître (lignes automatiques « — auto ») dans la section ingrédients & consommables de l'écran de conception et dans les coûts.
- **Écran de conception** : les sections « Ingrédients » et « Consommables » sont **fusionnées** en une seule, « Ingrédients & consommables » (colonnes Quantité, Unité g / unité, Coût). La ligne est rangée automatiquement dans la bonne table de la recette selon la base où le nom est trouvé ; l'**autocomplétion propose le contenu des 2 tables**.

## v3.98.0

- **Pagination** : toujours 7 emplacements de largeur fixe — les 3 premières pages, « … » (remplacé par la page courante quand elle est au milieu), les 3 dernières pages. La barre ne bouge plus : des lignes vides complètent la dernière page pour garder la même hauteur de tableau.
- **Bouton « + » (ajout de ligne)** des écrans Malts, Houblons, Levures, Ingrédients : plus de « ＋ Ligne » dans le titre ; un simple bouton « + » dans l'en-tête de la colonne des actions, à droite, sous « Tout effacer ».

## v3.97.0

- **Pagination** dès **15 lignes** (pages de 15) : barre « « ‹ 1 2 3 … 8 9 10 › » » ; le chevron simple avance / recule d'une page, le double chevron va à la première / dernière page, un clic sur un numéro ouvre cette page.
- Boutons **« Importer CSV » supprimés** (Malts, Houblons, Levures, Ingrédients, Styles) : l'import passe par « Coller CSV ».
- Écran **Styles** : la ligne sélectionnée a la même surbrillance (jaune) que les lignes actives des écrans Malts / Houblons / Levures.
- Paramètres › Process : croix de suppression **rouge**.
- Bibliothèque : filtre de la colonne « Réalisé » avec le placeholder « filtrer… ».

## v3.96.0

- **Icônes Lucide** (https://lucide.dev, licence ISC, v0.468.0) à la place de Font Awesome : mêmes 32 icônes, embarquées dans `js/icons.js` (éléments SVG 24×24, traits arrondis de 2 px, couleur du texte). Correspondances : ✎ → pencil, ✕ → x, ↻ → rotate-cw, ⚠ → triangle-alert, 📂 → folder-open, 🖨 → printer, ▦ → layout-grid, ▲/▼ → chevron-up/down, 🗑 → trash-2, 🌾 → wheat, 🌿 → leaf, 🧫 → flask-conical, 🧂 → cooking-pot, 📦 → package, 🌡 → thermometer, 🍾 → wine, 📝 → sticky-note, 🎲 → dices…

## v3.95.0

- **Pagination** : écrans Malts, Houblons, Levures, Ingrédients (et Eaux) et Bibliothèque en vue liste, par pages de **50 lignes** dès que la liste (filtrée) dépasse 50 lignes ; barre « ‹ Précédent · Page x / y · Suivant › » sous le tableau. Un filtre, un tri ou « Effacer » revient à la page 1.
- **Bibliothèque, vue cartes** : pas de pagination, les cartes sont chargées **par lots de 30 au fil du défilement** vers le bas.
- **Bibliothèque, vue liste** : largeurs recalculées (Nom 20 %, Brasseur **10 %**, total des colonnes en % < 100 %) pour supprimer l'ascenseur horizontal.

## v3.94.3

- Icônes : le cyan est retiré, les icônes des boutons (✎ ↻ 📄 …) sont **blanches** en thème sombre (couleur du texte en thème clair pour rester visibles).

## v3.94.2

- Bibliothèque : colonne **Brasseur** portée à **15 %** de la largeur du conteneur (Nom : 20 %).

## v3.94.1

- Bibliothèque : colonne **Nom** (zone de texte du nom de la recette) réduite à **20 %** de la largeur du conteneur.
- **Paramètres › À rechercher** : le prompt interdit désormais toute source, URL, lien ou note dans les CSV (les sources éventuelles uniquement dans le récapitulatif) ; prix introuvable = **0**.
- **Prix vide = 0** pour les malts, houblons, levures et ingrédients : au chargement d'une base existante, à la saisie dans la table (cellule vidée → 0) et à l'import / « Coller CSV ».
- **Nettoyage** : code mort supprimé (`HFONT`, `NEEDF`, `lblCol`, `lbiCol`, `bxMisc`, `PDS_HEADS`), ~3 000 caractères de règles CSS orphelines supprimés (`.bxbox`, `.bxmod`, `.chip`, `.lgo`, `.wgrid`…), dossier `dev/icons` supprimé (les icônes sont dans `js/icons.js`). Tous les scripts, `index.html`, le CSS et les README sont reformatés avec Prettier (`.prettierrc` : 120 colonnes, indentation 2 espaces) ; les fichiers de données générés (`data.js`, `logos.js`, `i18n_seed.js`, `fonts_seed.js`) ne sont pas reformatés.

## v3.94.0

- **Import beer.xml** : les ingrédients inconnus ne sont plus créés d'office dans les bibliothèques. Après l'import, la boîte de **correspondance** s'ouvre (une seule pour toutes les recettes importées) : choix de l'ingrédient de la base, ou « Stocker comme ingrédient » pour un malt qui n'en est pas un (lactose, sucre…). « Plus tard » conserve les noms en texte : l'icône **↻** reste affichée sur la ligne de la recette (liste et cartes) tant qu'un ingrédient est absent de la base. L'ancienne boîte « fermentescibles » est supprimée (fusionnée dans la correspondance).
- **Auteur absent** : « - » au lieu d'un champ vide (beer.xml ; champ vide dans la boîte « Nom du brasseur » = « - »).
- **Recettes importées non modifiables** : le champ Brasseur est en lecture seule ; seules actions : consulter 👁, copier, supprimer (et ↻ tant que la correspondance n'est pas faite).
- **Icônes Font Awesome Free 6.5.2 (classic, solid)** : 33 icônes seulement, embarquées dans `js/icons.js` (chemins SVG, licence CC BY 4.0). Les pictogrammes de l'interface (✔ ✕ ✎ 👁 📄 ↻ 💾 🖨 📂 🍺 🌾 🌿 ☰ ▦ ▲ ▼ …) sont remplacés à l'affichage par ces icônes (couleur et taille du texte, caractère d'origine conservé invisible). Les listes déroulantes (`<option>`), champs de saisie et les ornements des étiquettes ne sont pas concernés.
- Tests : import beer.xml (non-création, ↻, « - », lecture seule, correspondance).

## v3.93.0

- Import (beer.xml) : quand le nom du brasseur est absent, la saisie propose une **autocomplétion** avec les brasseurs déjà présents dans la bibliothèque (sans doublon, triés, plus ceux saisis pendant le même import).
- Bibliothèque (vue liste) : colonnes **Malts, Houblons et Levures** (nouvelle colonne, avec tri et filtre) tronquées à la largeur de la cellule avec « … » ; au survol, **infobulle avec le texte complet**. Colonne **Nom** élargie d'environ 10 % (largeur minimale 9,6 % de la fenêtre contre ≈ 8,7 % avant).
- **Plusieurs recettes de même nom** : l'import ne remplace plus une recette du même nom et du même brasseur que si son contenu est identique (volume et toutes les quantités : ré-import du même fichier = mise à jour). Une recette différente portant le même nom est ajoutée à côté. Le reste de l'application travaille par identifiant, pas par nom.

## v3.92.1

- ↻ Recharger la recette : un malt inconnu comme « Milk Sugar (Lactose) » (recette importée avant le choix malt/ingrédient) propose maintenant la liste « Stocker comme malt / ingrédient » (défaut : ingrédient pour lactose, sucre, miel…). Avant, « Lactose » était refusé car cherché dans les malts. Choisi comme ingrédient : il est retiré des malts de la recette et ajouté à ses ingrédients (quantité conservée en g).

## v3.92.0

- Base Ingrédients : champs plus larges (nom 300 px, type 170, dose 100, usage 380, prix/g 100).
- Saisie dans les champs : le 1er clic (qui donne le focus) sélectionne toujours tout le texte, mais un clic dans un champ **déjà actif** place maintenant le curseur à l'endroit cliqué (avant, le texte était re-sélectionné à chaque clic tant qu'on n'avait pas tapé, d'où le besoin d'appuyer sur « Fin »).

## v3.91.2

- Clignotement / saisie impossible après « ＋ Ligne » : reproduit dans Chrome **sans** Live Server (ajout puis saisie dans Ingrédients) → aucun rechargement, saisie normale ; la cause probable est le rechargement automatique de Live Server à chaque écriture de `brewcraft.sqlite`. Le dossier caché **`.vscode`** (réglage `liveServer.settings.ignoreFiles`) n'était pas inclus dans les zips récents : il l'est de nouveau. À faire : copier `.vscode/settings.json` à la racine du dossier ouvert dans VS Code, puis arrêter et relancer « Go Live ».

## v3.91.1

- Correction du clignotement à l'insertion d'une ligne dans les bases (Malts, Houblons, Levures, Ingrédients, Eaux, Consommables) : ajout, copie et suppression ne reconstruisent plus tout l'écran (tableau, filtres, radar) ; seules les lignes du tableau sont remplacées, le compteur du titre est mis à jour et la position de défilement est conservée (retour en haut à l'ajout).

## v3.91.0

- Notifications : elles s'affichent dans une bande réservée **sous le menu** (hauteur fixe, toujours présente) : l'en-tête ne change pas de taille à l'apparition ni à la disparition. Elles restent visibles **10 secondes**, quelle que soit leur origine.
- Imports (PDF et beer.xml) : les fermentescibles inconnus de la base des malts (lactose, sucre, miel, sirop…) peuvent être rangés au choix **comme malt ou comme ingrédient** (liste déroulante « Stocker comme malt / ingrédient » dans la boîte de correspondance ; par défaut ingrédient pour lactose, sucre, miel, etc.). Choisi comme ingrédient : il est retiré des malts et ajouté aux ingrédients de la recette (quantité en g) ; champ vide = nom conservé. Import beer.xml : nouvelle boîte « Malts et ingrédients », affichée seulement s'il y a des fermentescibles inconnus.

## v3.90.0

- Malts, Houblons, Levures, Ingrédients (et autres tables) : bouton « 📋 Coller CSV » ouvrant une boîte avec une zone de texte. Séparateur détecté automatiquement (« ; », « , » ou tabulation), 1re ligne = noms de colonnes (colonne `name` obligatoire). Une ligne dont le nom existe déjà met à jour l'entrée, sinon elle est ajoutée. Validation (texte vide, colonne `name` absente) sans fermer la boîte ; Entrée = saut de ligne dans la zone.
- Bibliothèque : filtre sur la colonne « Réalisé » (liste et cartes) : 1 / oui (aussi o, yes, x, ✔) = recettes avec la coche verte ; 0 / non = recettes sans coche ; vide = toutes.

## v3.89.0

- Imports : si le style de la recette n'existe pas dans la base, il apparaît dans la boîte de correspondance (ligne « Style », liste des styles de la base, suggestion pré-remplie si un nom proche existe). Choisi = style de la base inséré dans la recette ; champ vide = style conservé en texte. Import PDF : dans la même boîte que les ingrédients ; import beer.xml : boîte « Style de la recette » dédiée (affichée seulement si un style est inconnu).

## v3.88.0

- Bibliothèque › icône ↻ (recharger) : ouvre maintenant la boîte « Recharger la recette » : chaque ingrédient absent de la base est listé avec la liste de la base (suggestion pré-remplie si un nom proche existe). Vous saisissez la correspondance ; champ vide = l’ingrédient reste en texte et part dans « À rechercher » ; « Annuler » ne change rien.
- Bibliothèque › icônes de fin de ligne : une colonne fixe par type d’icône (👁, ✎, ↻, 📄, ✕), identique sur toutes les lignes, que l’icône soit présente ou non.
- Bibliothèque › 👁 (consulter, recettes importées) : popup « fiche recette » soignée (nom, style, brasseur, source ; DI, DF, IBU, EBC, alcool, volume, rendement, grains ; tableaux malts / houblons / levures / autres ingrédients / empâtage ; notes ; ingrédients « hors base » signalés). Fermeture par ✕, Échap ou clic à l’extérieur ; bouton « Copier pour modifier ». Disponible aussi en vue cartes. Nouveau fichier `js/recview.js`.

## v3.87.1

- Sauvegarde : quand Chrome doit redemander l’autorisation d’écriture (fenêtre « Enregistrer les modifications apportées à brewcraft.sqlite ? », propre au navigateur et non personnalisable), une boîte BrewCraft « Autorisation d’écriture » s’affiche d’abord et explique quoi cliquer (« Continuer » / « Plus tard »).

## v3.87.0

- Boîte « Correspondance des ingrédients » : la catégorie « Divers » devient **« Ingrédient »**.
- Paramètres › « 📂 Changer de base… » : le clic ouvre d’abord une boîte de dialogue BrewCraft « Changer de base de données » (base actuelle, emplacement, taille, date de modification, nombre de recettes / malts / houblons / levures / styles, rappel que les modifications en cours sont enregistrées avant le changement) avec « Annuler » ou « Choisir un fichier… ». Le sélecteur de fichiers du système, qu’un site web ne peut pas personnaliser, ne s’ouvre qu’après confirmation.

## v3.86.0

- **Import PDF : correspondance des ingrédients inconnus.** Quand un PDF contient des ingrédients absents de la base, une boîte « Correspondance des ingrédients » les liste (type, nom du PDF, recette concernée) avec, pour chacun, un champ à liste déroulante contenant les ingrédients disponibles de la base (saisir quelques lettres pour filtrer). Une suggestion est pré-remplie quand un nom proche existe. Valeur choisie = l’ingrédient de la base est utilisé dans la recette ; **champ vide = l’ingrédient n’existe pas** : il reste en texte dans la recette et rejoint la liste / le prompt « À rechercher ». Une valeur qui n’est pas dans la base est refusée.
- Icône de rechargement des recettes : flèches (couleur du texte : blanches en thème sombre) sur **fond transparent**, à la place de l’emoji sur fond bleu.
- Bouton de rechargement : rapprochement **tolérant** des noms (ordre des mots, accents et ü/ue, « Malt », « Labs », codes de levure WLP 066 / WLP066, S-04 / S04, Hallertauer / Hallertau, « Oats, Flaked » / « Flaked Oats », Lactose / Milk Sugar (Lactose)…), meilleur score unique (en cas d’égalité, rien n’est relié). Les ingrédients reliés sortent de « À rechercher ».

## v3.85.0

- Bibliothèque (vue liste et vue cartes) : icône 🔄 en fin de ligne, présente **uniquement** sur les recettes dont au moins un ingrédient (malt, houblon, levure, divers) n’existe pas dans la base. Un clic recharge la recette et relie à la base les ingrédients désormais présents (par exemple après l’import d’un CSV issu de « À rechercher ») : noms alignés sur les fiches de la base, code HTML régénéré. S’il reste des ingrédients absents, le message les liste ; l’icône disparaît quand tout est reconnu.

## v3.84.1

- Paramètres : la section « À rechercher » est placée tout en bas de l’écran (toujours masquée quand il n’y a rien à rechercher).

## v3.84.0

- Paramètres › nouvelle section **« 🔎 À rechercher »** : liste des ingrédients (malts, houblons, levures, divers) rencontrés lors d’un import PDF et absents de la base. Elle n’apparaît que s’il y en a ; un ✕ retire un ingrédient, « Tout effacer » vide la liste, et un ingrédient disparaît seul dès qu’il existe dans la base (après import d’un CSV).
- Un **prompt copiable** (bouton « 📋 Copier le prompt ») demande à une IA ayant accès au web de rechercher ces ingrédients et de générer des **fichiers CSV à importer** (malts_nouveaux.csv, houblons_nouveaux.csv, levures_nouvelles.csv, ingredients_nouveaux.csv) : en-têtes exacts de chaque écran, règles par colonne (notes 0-5, potentiel = rendement × 3,846…), une ligne d’exemple tirée de la base, source en URL, rien d’inventé. Les données déjà connues par la recette (couleur, alpha, atténuation…) et le nom de la recette sont rappelés pour chaque ingrédient.
- Nouveau fichier `js/arech.js`.

## v3.83.0

- L’import Brewfather par lien est supprimé. Nouveau bouton « Import PDF » (Bibliothèque) : lit un ou plusieurs PDF, reconnaît le format et insère la recette dans la bibliothèque (lecture seule, copie avant modification, comme Beer.xml).
  - Formats pris en charge : **Brewfather** (page de recette imprimée en PDF depuis le navigateur) et **BeerSmith** (export PDF).
  - Données reprises : nom, style, brasseur, volume, ébullition, rendement, DI / DF / IBU / EBC / ABV, malts / extraits / sucres, houblons (usage, minutes, dry hop en jours), levures (en sachets), divers, paliers d’empâtage, fermentation, carbonatation, notes, profil d’eau, valeurs mesurées.
  - Brasseur absent → « Brasseur Inconnu ».
  - Ingrédient absent des bibliothèques : conservé comme **simple texte** dans la recette, **non ajouté** aux bibliothèques ; le message d’import liste ces ingrédients.
- Nouveaux fichiers : `js/pdftext.js` (extraction de texte PDF intégrée, sans bibliothèque externe, hors ligne ; ni PDF chiffrés ni scans), `js/pdfimport.js` (analyse des formats, conversion BeerXML). Exemples dans `dev/tests/pdf/`.

## v3.82.0

- Imports (Beer.xml et Brewfather) : si le nom du brasseur n’est pas indiqué dans le fichier / la page, une boîte de dialogue le demande pour chaque recette concernée ; le nom saisi est inséré dans la recette (« Passer » ou champ vide = laissé vide, modifiable ensuite dans la colonne Brasseur).
- Boutons de la Bibliothèque renommés : « Import beer.xml » et « Import Brewfather ».
- Vue cartes : fond et cartes sombres quand le thème est sombre, fond clair et cartes blanches quand le thème est clair.

## v3.81.0

- Bibliothèque : correction du filtre — on pouvait taper un seul caractère (le champ était re-sélectionné à chaque lettre par la règle « valeur sélectionnée au focus » ; la lettre suivante remplaçait la précédente). Les champs de filtre de la bibliothèque sont désormais exclus de cette règle.
- Popups harmonisés : l’écran de chargement de la base et la fenêtre « Importer une recette Brewfather » reprennent le style des boîtes de dialogue BrewCraft (carte arrondie, filet jaune, ombre, flou d’arrière-plan, boutons jaunes, thèmes clair/sombre).

## v3.80.0

- Malts / Houblons / Levures : plus de surbrillance de la ligne dans le tableau de génération du radar (la surbrillance reste dans la vue liste). Bibliothèque : surbrillance uniquement en vue liste, jamais en vue cartes.
- Radar agrandi (clic) : les polices sont dimensionnées d’après la largeur de l’écran (≈ 1,1 % de la largeur, entre 11 et 16 px) au lieu d’être agrandies avec le dessin ; la légende suit aussi (11 à 16 px) ; recalcul au redimensionnement de la fenêtre.

## v3.79.0

- Bibliothèque : filtre comme dans Malts / Houblons / Levures — une ligne de filtres sous l’en-tête en vue liste, une barre de filtres au-dessus des cartes en vue cartes. Champs : Nom, Brasseur, Style, DI, DF, IBU, EBC, ABV, Malts, Houblons (recherche partielle, sans accents ni casse). Les filtres sont communs aux deux vues, le titre affiche « n / total », la gomme efface les filtres et revient au tri par nom.
- Vue cartes : les recettes sont triées exactement comme en vue liste (même tri partagé ; par défaut nom croissant dans les deux vues). La liste « Trier par » des cartes propose désormais aussi Réalisé, Malts et Houblons.

## v3.78.0

- Les popups natifs du navigateur (confirmer / alerter) sont remplacés par des boîtes de dialogue BrewCraft : carte arrondie, filet jaune, bouton principal jaune (rouge pour les suppressions, avec le focus sur « Annuler »), thème clair/sombre, traduites. Entrée = valider, Échap ou clic en dehors = annuler.
- Concerne : suppression d’une recette / d’un style / d’une police, vider une table, rétablir le tableau Process, pourcentages ≠ 100 % au calcul, messages d’erreur (fichier invalide, image illisible, ouverture de base).
- Nouveau fichier `js/dialog.js` (`bcAsk`, `bcAlert`).

## v3.77.0

- Bibliothèque : nouveau bouton « Importer Brewfather » (à côté de « Importer beer.xml »). Saisir le lien d’une recette partagée (recipe.brewfather.app/… ou web.brewfather.app/share/…) : la page est lue via le service de rendu r.jina.ai (le lien lui est transmis), convertie en BeerXML puis insérée dans la bibliothèque dans les mêmes conditions que les fichiers Beer.xml (lecture seule, copie avant modification, brasseur = auteur de la recette, pas de tag). Réimporter la même recette la remplace.
- Si la lecture automatique échoue : coller le contenu de la page (Ctrl+A / Ctrl+C), texte anglais ou français accepté.
- Nouveau fichier `js/brewfather.js` ; fixtures `dev/tests/brewfather/`.

## v3.76.1

- Bibliothèque : la pastille « Beer.xml » est supprimée (vue liste et vue cartes). Les recettes importées restent en lecture seule (icône 👁 au lieu de ✎, copie 📄 pour les modifier).

## v3.76.0

- Vue cartes : infobulle au survol de 🌾 (liste des malts, kg et %) et de 🌿 (liste des houblons : g, usage, minutes).
- Recette Brewfather « Sierra Nevada Pale Ale v1 » (page partagée, auteur BYO Magazine) convertie en `Sierra_Nevada_Pale_Ale_Brewfather.xml` : à importer avec « Importer beer.xml » (mêmes conditions : lecture seule, copie avant modification). L’import direct par lien n’est pas possible : la page Brewfather charge ses données par une connexion Firebase authentifiée.
- Correction de l’import Beer.xml : la quantité de levure est un nombre de SACHETS (1 sachet = 11 g ; levure liquide = 1), et non des grammes. Réimporter les fichiers déjà importés corrige les anciennes recettes. Divers non pesés (acide lactique…) : litres convertis en ml.

## v3.75.0

- Bibliothèque : bouton « ▦ Vue cartes » / « ☰ Vue liste » (préférence enregistrée dans la base). Vue cartes : verre coloré selon l’EBC de la bière, nom, style, type, brasseur (modifiable directement, ✔ vert si réalisée), malts / houblons / volume, DI, DF, IBU, alcool ; tri par champ avec inversion ; clic sur une carte = ouvre la recette ; 📄 copier et ✕ supprimer au survol.
- Colonne « Brasseur » : modifiable sur chaque recette (liste et cartes). Les recettes que vous créez ont « Moi » par défaut ; les recettes déjà enregistrées sans brasseur passent à « Moi » une seule fois. La copie d’une recette importée prend « Moi » (le brasseur d’origine est conservé dans l’origine de la copie).

## v3.74.0

- Bibliothèque : bouton « Importer beer.xml » (au niveau du titre, plusieurs fichiers à la fois, format BeerXML 1.0, encodage lu dans le prologue) et nouvelle colonne « Brasseur » (reprise de la balise <BREWER> si elle existe, sinon saisie directe dans la colonne ; enregistrée dans la base).
- Conversion : nom, style BJCP (rapproché de la liste du logiciel), volume, malts/sucres, houblons (usage Boil → Ébullition, Aroma → Whirlpool, Dry Hop, First Wort), levures, ingrédients divers, paliers d’empâtage + rinçage + ébullition, notes (recette, empâtage, fermentation, carbonatation). DI / DF / IBU / EBC / ABV affichés dans la bibliothèque = valeurs du fichier.
- Les ingrédients sont rapprochés de vos bibliothèques (mots entiers, jamais de correspondance partielle de mot) ; ceux qui n’existent pas sont ajoutés (potentiel d’après le rendement, alpha, atténuation) pour que la recette se calcule ; le nombre est annoncé après l’import. Réimporter un fichier met à jour la recette (pas de doublon).
- Recettes importées en LECTURE SEULE : pastille « Beer.xml », bouton 👁 (consulter), écran Conception verrouillé avec bandeau « Copier pour modifier ». Nouveau bouton 📄 « Copier la recette » sur chaque ligne : crée une copie modifiable (« … (copie) »), l’original reste intact.
- Nouveau fichier `js/beerxml.js` ; jeux d’essai dans `dev/tests/beerxml/`.

## v3.73.0

- Étiquettes : 16 nouveaux modèles inspirés de vos images de référence (écussons, badges, houblon, kraft, art déco, ruban) — Écusson jaune « Beer Light » (bandeau noir, rayons, textes verticaux) ; Brewery brun à cadre filet (Dark & Light) ; Houblon vertical en 3 coloris (crème & bleu, bleu acier, nuit) ; Kraft artisanal à bande diagonale en 4 coloris (vert, jaune, orange, rouge) ; Sceau vintage denté beige & brun et brun foncé (grain, épis, chope) ; Badge noir & blanc « Craft Beer » (script, couronne de points) ; Badge premium bleu nuit & or (octogone art déco) ; Ruban crème sur rayons ; Anneau vert houblon & ruban ; Blason marine à couronne, épis et ruban rouge.
- Chaque modèle reprend les données de la recette (nom, style, % alc., volume, année, brassin/IBU, QR Code, malts/houblons) et reste modifiable (police, couleur de police, fond, cadre). Textes courbes en SVG (arcs « Premium quality », style de bière), pictogrammes dessinés (houblon, chope, épis, étoile) : aucune image externe.

## v3.72.3

- Process : valeurs (pertes, ajouts, volumes, densités, VOLUMES D’EAU) alignées à gauche, comme « Quantité de grains (kg) ».

## v3.72.2

- Tableau des paliers d’empâtage : croix ✕ de fin de ligne en rouge ; bouton d’ajout réduit à « ＋ » (sans le mot « ligne »).

## v3.72.1

- **Électricité synchronisée à 100 %** avec le tableau des paliers : une ligne par palier (même ordre, même si la durée est vide), une « Montée en température » avant chaque palier sauf le premier (remplacé par la montée initiale), puis « Chauffe eau de rinçage ». Plus aucune ligne masquée.
- Flèches ▲▼ du tableau des paliers en blanc (couleur du texte en thème clair).

## v3.72.0

- **Paliers d’empâtage variables** (Conception) : lignes ajoutables (＋ ligne), déplaçables (▲▼) et supprimables (✕), nom/°C/min modifiables ; enregistrés dans la recette (table `recette`, clé `mash`). Les rôles « Rinçage / Recirculation » (T° de l’eau de rinçage) et « Ébullition » (durée) suivent leur ligne.
- **Électricité** (Paramètres) générée depuis ce tableau : 1ʳᵉ ligne « Montée en température initiale », puis pour chaque palier une ligne « Montée en température » (écart de °C ÷ chauffe °C/min) suivie du palier (lecture seule, durée reprise), et en dernière ligne « Chauffe eau de rinçage ». Seule la puissance (W) est saisie ; les puissances sont mémorisées par nom de palier dans `parametres_electricite`. Les anciennes puissances sont reprises à la migration.
- **HTML** : tableau PALIERS dynamique + nouveau tableau ÉLECTRICITÉ (puissance, durée, kWh).

## v3.71.1

- Électricité : ajout de la ligne « Rinçage / Recirculation » (palier de la Conception) et de sa montée en température ; toutes les lignes de « Paliers d’empâtage » sont désormais reprises (Saccharification, I, II, III, Rinçage / Recirculation, Mashout).

## v3.71.0

- **Électricité** : après « Chauffe initiale », une ligne par palier d’empâtage de la Conception (Saccharification, I, II, III, puis Mashout), avec entre chaque palier une ligne « Montée en température » = écart de température ÷ chauffe (°C/min) (ex. 67 → 78 °C à 1 °C/min = 11 min). Les paliers et montées inutilisés sont masqués. La ligne unique « Paliers d’empâtage » est supprimée ; les puissances déjà saisies sont reprises à la migration.

## v3.70.0

- Process › « VOLUMES D’EAU » : cases au style lecture seule (italique, fond transparent, bordure fine).
- **Électricité** : la ligne Mashout reprend la durée du palier Mashout de la Conception (paliers d’empâtage), même si la température n’est pas renseignée.

## v3.69.0

- **Paramètres** : nouvelle section « Coûts » (prix du kWh et du m³ d’eau), retirés de « Électricité ».
- **Malts, Houblons, Levures** : la ligne qui a le focus est mise en surbrillance (bande jaune à gauche, fond teinté ; thème clair inclus).

## v3.68.1

- Process : cases pertes / ajouts / volumes / densités avec le style lecture seule des Paramètres de brassage (italique, fond transparent, bordure fine).

## v3.68.0

- **Process — pertes et ajouts d’eau** : toutes les cases (pertes, ajouts, volumes, densités) sont en lecture seule, affichées comme des champs calculés/repris ; boutons crayon et « ＋ ligne » retirés (valeurs issues des Paramètres de brassage et de la Conception).

## v3.67.1

- Paramètres : deux colonnes indépendantes (gauche : Process, coefficients, langue, base de données, logos ; droite : Paramètres de brassage, Électricité, Polices) → plus de trou sous « Paramètres de brassage ».

## v3.67.0

- **Paramètres** : « Paramètres de brassage » passe sur la moitié droite, face à « Process » (remonté à gauche, avec les coefficients) ; « Base de données » descend sous « Langue de l’application » (colonne de gauche, avant les logos) ; Électricité et Polices à droite.

## v3.66.0

- **Formules dans tous les champs** (bases malts/houblons/levures…, recette, paramètres) : un champ qui commence par « = » est évalué à la sortie (Entrée, Tab ou clic ailleurs) et remplacé par le résultat, puis enregistré comme une saisie normale. Opérations + − × ÷ ^ ( ) %, sqrt/abs/round, virgule ou point ; expression invalide = ancienne valeur conservée. Pas d’eval.

## v3.65.0

- Paramètres › Paramètres de brassage : paragraphe « DENSITÉS » retiré ; la valeur calculée « TEMPÉRATURE » est dans un champ en lecture seule, comme les autres valeurs reprises ou calculées.

## v3.64.0

- **HTML** : le bloc « Embouteillage » affiche, sous le resucrage, la densité avec le sucre ajouté et la DF après refermentation en bouteilles (identiques au tableau Process).

## v3.64.0

- Conception › eau : message « ✔ Total des litres = quantité totale d’eau nécessaire » retiré (l’avertissement ⚠ en cas d’écart reste).

## v3.63.0

- **Process phase 3** : nouvelle ligne **Fermentation** (atténuation moyenne des levures de la Conception, affichée dans le libellé) avec la densité obtenue en fin de ligne ; « Resucrage (N g) » : le sucre fait remonter la densité (calculée en fin de ligne) ; **DF** = densité après refermentation en bouteilles. Le HTML suit.
- Message « ✔ Volume d’eau + malt … » retiré (seul l’avertissement de dépassement reste).

## v3.62.0

- **HTML** : sections EQUIPEMENT, DONNÉES DE BASE & PARAMÈTRES, VARIABLES DE PERTES / AJOUTS, CONTRAINTES & TEMPÉRATURES, VOLUMES D’EAU, DENSITÉS et QUANTITES D’EAU supprimées ; ligne « Eau totale avec la glace » dans le tableau EAU ; PROCESS avec les lignes DI / « Resucrage (N g) » / DF.
- **Process** : lignes récapitulatives supprimées ; ligne **DI** (densité initiale = cible de l’écran Conception) après « Glace dans le fermenteur » – les points extraits sont recalculés pour atteindre cette DI ; « Resucrage » affiche entre parenthèses la quantité de sucre prévue (g/L × volume embouteillé) utilisée pour la densité ; ligne **DF** (densité après resucrage puis atténuation moyenne des levures).
- **Paramètres** : durée d’ébullition en minutes (comme la Conception).

## v3.61.0

- **Thème** : nouveau bouton « ☀ Thème clair par défaut » (thème clair dessiné pour BrewCraft : fonds clairs, accent ambre, encre sombre) ; l'ancien bouton devient « 🌙 Thème sombre par défaut ». Le choix est enregistré dans la base.
- **Process — pertes et ajouts d'eau** : valeurs calculées (volumes, densités, volumes d'eau) dans des champs en lecture seule ; ajout du **volume de glace** et du **volume d'eau + malt** (en rouge s'il dépasse « Volume maxi empâtage + malt dans la cuve »).
- **Phase 3 — Embouteillage** (démarre à « Perte au fond du fermenteur », puis resucrage) : densité calculée avec le sucre de resucrage (saccharose 0,384 L° par g/L) ; la phase 2 se termine à la glace avec une ligne « Volume et densité finales ». Migration automatique des anciennes bases.
- **HTML** : tableau PROCESS avec la phase 3 ; « Volume de glace dans le fermenteur » ; PARAMETRES sans date d'embouteillage, équipement ni volume ; volumes d'eau avec volume d'eau + malt et glace.

## v3.60.0

- Conception : « Volume de moût (L) » devient **« Volume à embouteiller (L) »** (même libellé dans Paramètres et dans le HTML). C'est la source unique du calcul : le tableau Process vise ce volume en bouteilles, et le volume en fermenteur en est déduit (+ perte au fond du fermenteur − resucrage). Le paramètre séparé « Volume souhaité en bouteilles » (qui pouvait diverger) est supprimé ; le volume en fermenteur sert au contrôle du maximum du fermenteur.

## v3.59.0

- **Écran HTML mis à jour** avec tous les paramètres : PARAMETRES (date d'embouteillage, style, volume de moût, ratio d'empâtage, DI et IBU cibles), EQUIPEMENT, les trois tableaux « Paramètres de brassage » (base, pertes/ajouts, contraintes & températures), volumes d'eau, densités, T° du moût en fin de transfert, QUANTITES D'EAU, levures (sachets, floculation), eau (litres) et ANALYSE ORGANOLEPTIQUE (si date d'embouteillage).
- Paramètres : champ du chemin de la base supprimé (le nom du fichier reste affiché avec « Changer de base… »).

## v3.58.1

- Paramètres › Équipement & process : températures et durée d'empâtage retirées (elles se règlent dans l'écran Conception ; les valeurs restent utilisées par défaut).

## v3.58.0

- **Table « logos »** dans la base (`id, nom, format, donnees, actif`) : le logo des étiquettes (choisi dans Paramètres, proposé ou importé) y est stocké et n'est plus dans « parametres ». Les anciennes bases sont migrées automatiquement à la première sauvegarde ; supprimer le logo vide la table.

## v3.57.1

- Paramètres › Base de données : champ unique « chemin complet + nom » (Linux `/home/…/dossier/brewcraft.sqlite`, Windows `C:/Users/…/dossier/brewcraft.sqlite`, séparateurs `/`). À chaque **changement de base**, l'ancien chemin est effacé et le champ est sélectionné pour saisir celui de la nouvelle (le navigateur ne communique pas le chemin d'un fichier ; en `file://` il est déduit automatiquement).

## v3.57.0

- **+312 levures** (`CAT.yeasts`) : jeu de données Beer Maverick (via `machug/brewsignal`, MIT) — Omega, Wyeast, White Labs, Yeast Bay, Escarpment, Imperial, GigaYeast, Bootleg, RVA, East Coast, Fermentis. Retenues seulement si atténuation min/max, floculation, températures min/max et descriptif sont publiés (bactéries, floculation « unknown », valeurs manquantes écartées). Floculation catégorielle convertie en % (low 20–40, medium 30–50, medium-high 60–80, high 70–90, very high 80–95). **Notes aromatiques 0–5 = estimations** tirées du descriptif ; prix vides. Fichier `levures_nouvelles.csv`.
- Paramètres › Base de données : **chemin du dossier + nom du fichier** (le navigateur ne donne pas le chemin : saisi une fois, mémorisé dans la base) ; plus rien d'autre.
- Polices : la police est **préchargée avant** de redessiner (plus de planche masquée puis réaffichée) ; `.vscode/settings.json` ignore aussi les fichiers temporaires `.crswap` (cause probable du rechargement de la page vers « Conception » avec Live Server) ; dernier écran mémorisé aussi en `localStorage`.
- Radars (Malts/Houblons/Levures) : gomme encore plus près du champ.
- Levures : clic sur le diagramme atténuation/floculation → plein écran, comme le radar.

## v3.56.0

- **+95 malts** (catalogue complémentaire, `js/catalog.js` → `CAT.malts`) : Castle Malting (EBC et caractéristiques publiés + extrait sec des fiches de spécification) et Weyermann (catalogue brasserie). Seuls les malts dont EBC, extrait et descriptif sensoriel sont publiés sont retenus (adjuvants, flocons, orge crue, sarrasin, malts sans extrait publié écartés).
- Potentiel (L°/kg) = extrait sec % × 3,8 ; EBC = milieu de la fourchette publiée. **Notes aromatiques 0–5 = estimations** déduites du texte. PPG, B46 et prix non renseignés.
- Migration par table (`equip.catd`) : les bases existantes reçoivent les malts sans écraser l'existant.
- Fichier : `malts_nouveaux.csv`.

## v3.55.0

- **Catalogue complémentaire de houblons** : +66 variétés (151 au total), ajoutées une seule fois à ta base existante sans rien écraser (migration `cat1`).
- Source : fiches Beer Maverick lues une par une (fourchette alpha + descripteurs d'arômes). Seuls les houblons **entièrement renseignés** sont retenus.
- **Notes aromatiques 0-5 = estimations** déduites des descripteurs (1er cité = 5, 2e = 4, 3e = 3, suivants = 2). Prix laissés vides.
- Fichiers : `js/catalog.js`, `dev/catalog/` (données brutes, script `build_hops.py`, `hops_new.csv` au format d'import).

## v3.54.1

- Le `brewcraft.sqlite` fourni dans le zip était une ancienne base (14 tables) : il est régénéré avec le schéma actuel (16 tables, dont `polices` et `traductions`, 9 polices intégrées). `dev/tests/make-db.js` mis à jour.
- Rappel : le navigateur mémorise le fichier `brewcraft.sqlite` choisi lors d’une session précédente (même dossier d’origine) ; si vous dézippez une version dans un nouvel dossier, utilisez Paramètres › Base de données › « Changer de base… » pour choisir le fichier du nouveau dossier, ou copiez votre ancien `brewcraft.sqlite` dans le nouveau dossier.

## v3.54.0

- Écran Levures : à côté du radar, diagramme « Atténuation et floculation (%) » avec, pour chaque levure sélectionnée (couleur du radar), une barre pleine (plage d’atténuation min–max) et une barre en pointillés (plage de floculation min–max).
- Icône gomme en fin de ligne des tableaux de noms des radars (Malts, Houblons, Levures) et à côté du champ de recherche du tableau des polices (Paramètres) : efface le contenu du champ.

## v3.53.0

- Paramètres › « Base de données » : affiche le fichier réellement ouvert par le navigateur (nom, taille, date) et la liste de ses tables avec leur nombre de lignes, relue sur le disque ; bouton « Changer de base… » pour choisir un autre `brewcraft.sqlite`. Permet de vérifier que la table `polices` est bien dans le fichier ouvert (le navigateur mémorise le fichier choisi lors d’une session précédente).

## v3.52.2

- Les fichiers JS/CSS sont chargés avec un numéro de version (`?v=…`) pour éviter qu’un cache navigateur ou d’hébergement serve d’anciens fichiers (cause possible d’une table `polices` absente).
- Enregistrement robuste : une police invalide dans les données n’empêche plus l’écriture de la base.

## v3.52.1

- Correctif : la base existante est maintenant réécrite une fois à l’ouverture, ce qui crée immédiatement les tables `polices` et `traductions` (auparavant, elles n’apparaissaient qu’après une modification suivie d’une sauvegarde).

## v3.52.0

- Feuille de brassage : les paramètres de conception (cadre, fond, police, couleur de police) sont dans un cadre « Feuille de brassage », comme pour les étiquettes.
- Étiquettes : le cadre des paramètres occupe toute la largeur de la page ; seul le champ « Texte du QR Code » est de taille variable (il prend la place restante).

## v3.51.0

- Polices : stockées dans une table SQLite dédiée `polices` (`nom`, `format`, `donnees` = data URI base64, `integree`). Le répertoire `fonts/` est supprimé du projet : les 9 polices intégrées (New Rocker, Metal Mania, Bangers, Anton, Black Ops One, Pirata One, Rye, Sancreek, Oswald) sont copiées dans la base au premier lancement depuis `js/fonts_seed.js` (nécessaire uniquement pour initialiser une base neuve) puis lues depuis la base. Licences : `lib/FONTS-LICENSES.txt`.
- Paramètres : champs d’« Équipement & process » alignés en bas.

## v3.50.0

- Paramètres : tableaux du bloc Process en lecture seule (crayon ✎ en fin de ligne pour modifier), flèches ▲▼ blanches ; « Coefficients d’utilisation des houblons » placé sous « Process — pertes et ajouts d’eau » ; champs d’« Équipement & process » alignés en bas ; liste des polices affichée avec la police standard.

## v3.49.0

- **Internationalisation** : français (par défaut), anglais, espagnol, italien, portugais. Langue choisie dans Paramètres › « Langue de l’application » (mémorisée dans la base).
- Toutes les traductions sont stockées dans la table SQLite `traductions` (colonnes `cle` = texte français, `fr`, `en`, `es`, `it`, `pt`) ; elles sont modifiables directement dans la base. Les traductions livrées (`js/i18n_seed.js`) sont ajoutées à la base sans écraser vos modifications. `{}` = nombre, `{*}` = texte libre dans une clé.
- Un traducteur DOM (`js/i18n.js`) traduit menus, écrans, bulles d’aide, placeholders, messages et boîtes de dialogue ; les données (malts, houblons, styles BJCP, noms de recettes…) ne sont pas traduites.
- Polices : toutes celles du répertoire `fonts/` sont copiées dans la base au premier lancement ; les polices importées y sont stockées ; la liste (Paramètres) affiche 25 lignes puis un ascenseur, croix rouge + confirmation pour supprimer.

## v3.48.0

- Polices : plus de scan du dossier `fonts/` ni de dossier local. Les polices importées sont stockées dans la base (≈ 100–300 Ko chacune : pas d’impact notable sur les performances pour quelques dizaines de polices).
- Paramètres : nouvel encart « Polices de caractères » sous les coefficients des houblons : champ de recherche avec autocomplétion au-dessus de la colonne Nom, bouton ✕ en fin de ligne pour supprimer, bouton d’import.

## v3.48.0

- Polices : l'import se fait uniquement dans Paramètres › « Polices de caractères » (sous les coefficients des houblons) : champ de recherche avec autocomplétion, tableau Nom + croix de suppression. Le bouton d'import a été retiré des écrans Étiquettes et Feuille de brassage ; les polices importées restent proposées dans leurs listes.

## v3.47.1

- Correctif : sélection d'une police dans la feuille de brassage (« Cannot read properties of undefined (reading 'push') », l'attribut `data-al` des listes de polices était pris pour un bouton d'ajout).
- Sélecteur de couleur de police après le choix de police (Étiquettes et Feuille de brassage) ; champ « Texte du QR Code » réduit.

## v3.46.0

- Thème : le fond quadrillé des pages ne change plus (invariable) ; les cadres de droite de Conception (bilan…) ont le même fond que les autres cadres.

## v3.45.1

- Conception : total des IBU dans la ligne Total du tableau Houblons.

## v3.45.0 — Étiquettes : valeurs par défaut par modèle

- Au clic sur un modèle, le bandeau de conception affiche sa police, sa couleur de fond et la couleur de son cadre par défaut. Ces trois réglages restent modifiables et ne s’appliquent qu’à l’étiquette en cours ; un clic sur un autre modèle les réinitialise avec les valeurs par défaut de ce modèle.

## v3.44.1

- Conception : « DI cible » et « IBU cible » juste avant « Calculer », les trois dans un cadre 1 px de la couleur des liserets.

## v3.44.0

- Bibliothèque : tri croissant/décroissant sur chaque colonne (clic sur l’en-tête, flèche ▲/▼), comme Malts / Houblons / Levures.
- Étiquettes : choisir un modèle à palette (reggae, funky, flûte…) renseigne les sélecteurs Fond et Cadre avec ses couleurs ; ce que tu vois correspond donc toujours aux couleurs saisies, et la police choisie s’applique à tous les modèles.
- Thème : la police des titres ne change plus avec l’harmonie.
- Navigation : « Paramètres » placé après « Feuille de brassage ».

## v3.43.1

- Étiquettes : « Fond » (color picker) et « Cadre » s’appliquent désormais aussi aux modèles à palette (reggae, funky, flûte…) dès qu’on les modifie ; le texte s’adapte au fond (clair/sombre). « URL du QR Code » devient « Texte du QR Code » (texte libre accepté).
- Paramètres : « Thème de l’application » et « Paramètres de brassage » ont le même fond que les autres blocs.

## v3.43.0 — Thème enrichi

- Tous les blocs ont un liseret 1 px arrondi (comme les cartes radar). Le thème pilote désormais : la couleur des liserets (2ᵉ couleur de l’harmonie), deux fonds de blocs différents (teinte de la 1ʳᵉ et de la 2ᵉ couleur, en dégradé) et la police des titres (une par harmonie : Georgia, Trebuchet, Palatino, Bahnschrift, Rockwell, Century Gothic).
- HTML : ligne « Coût par bouteille 33 cl » supprimée.

## v3.42.1 — Paramètres

- « Équipement & process » sur toute la largeur ; « Coefficients d’utilisation des houblons » déplacé sous Électricité.

## v3.42.1 — Atténuation et floculation

- Conception : colonnes Atténuation et Floculation dans le tableau Levures (ligne par levure, moyenne en total) ; le Bilan affiche « Densité finale obtenue », l’atténuation et la floculation (barre + plage attendue). Avec 2 levures ou plus, la densité finale utilise la moyenne des atténuations.

## v3.41.0 — Paramètres simplifiés, coûts dans le HTML

- Paramètres : Électricité sous le logo, blocs « Eau » et « Consommables » retirés (déjà dans Conception). Le prix du m³ d’eau se règle dans le bloc Électricité ; le coût de l’eau = volume d’eau total de la recette × prix du m³.
- Écran HTML : nouvelle section COUTS (malts, houblons, levures, ingrédients, électricité, eau, consommables, total, coût par litre et par bouteille 33 cl).

## v3.40.1 — Correctif thème + paramètres compacts

- Thème : un clic n’importe où sur une harmonie (libellé ou pastilles) la calcule et l’applique immédiatement ; changer la couleur de base recalcule le thème appliqué. Enregistré dans la base et restauré au rechargement.
- Page Paramètres : équipement et coefficients houblons côte à côte, thème sur une seule ligne, paramètres de brassage sur 4 colonnes.

## v3.40.0 — Thème personnalisable

- **Paramètres → Thème de l’application** : sélecteur de couleur (picker + code hex + aléatoire). Les 6 harmonies (analogues, complémentaires, complémentaires divisées, triadiques, tétradiques, carré) sont générées automatiquement ; un clic sur une harmonie applique la charte à tout BrewCraft (accent, couleurs secondaires, fonds teintés). Choix enregistré dans la base. **↺ Thème par défaut** rétablit le thème d’origine.
- « Paramètres de brassage » : tableaux répartis en grille multi-colonnes, lignes resserrées (moins de défilement).

## v3.39.1 — Paramètres

- Le bloc « VOLUMES D’EAU » est déplacé en tête du tableau « Process — pertes et ajouts d’eau » ; le panneau « Calcul des volumes d’eau » devient « Paramètres de brassage ».

## v3.39.0 — Étiquettes inspirées de vraies étiquettes

- 14 nouveaux modèles : Noir & or (La Flûte), Taches pastel (L’Alsacienne), Éventail doré, Tour de bouteille (Silly), Phare & vagues (Ar-Men), Ovale vintage bleu et Ovale Bock, Pilsner / Porter / Pale Ale (style Family Brewery), Blason rouge & or, Tag kraft vertical, Kraft fiche à remplir, Kraft bio. Pictogrammes 18+ / recyclage / grossesse sur certains.
- Nouvelles polices : « Bahnschrift / Anton » (condensé gras) et « Playfair / Didot » (vintage). Si tu as la police **Saint Carell**, copie `SaintCarell.otf` (ou .ttf) dans le dossier `fonts/` : elle sera utilisée automatiquement par le style vintage ; sinon bouton « Importer une police ».

## v3.38.1 — Retrait des feuilles « musique »

- Les 6 feuilles de brassage thématiques (reggae, romantique, funky, soul, salsa, punk) sont supprimées ; retour aux 5 présentations. Les 12 modèles d’étiquettes musique restent.

## v3.38.0 — Tableau Process (phases 1 & 2), styles musique, écrans ingrédients

- **Paramètres → tableau Process** : deux sous-tableaux. _Phase 1 — Empâtage → pré-rinçage_ (emp. : pertes grains, mort, rétention…) et _Phase 2 — Rinçage → mise en bouteille_ (rinçage, évaporation, trub, contraction, glace, fermenteur, resucrage). Chaque ligne a une saisie **Pertes** et une saisie **Ajouts** (vide = calcul automatique depuis les Paramètres, saisie = valeur imposée, ↺ pour revenir à l’auto) et affiche le **volume** et la **densité** correspondants. Lignes ajoutables/supprimables à volonté. La dernière ligne est le **volume mis en bouteille visé** (écran Conception) ; l’eau de rinçage s’équilibre automatiquement pour l’atteindre. Les lignes personnalisées se propagent à l’eau totale, aux minéraux, à la feuille de brassage et à l’écran HTML.
- Écran **HTML** mis à jour : eau & process, profil d’eau, densités (dont post-ébullition), embouteillage (CO₂, résiduel, resucrage), ingrédients.
- Écrans **Malts / Houblons / Levures** : liste + radar dans une carte, tableau en dessous.
- **12 nouveaux modèles d’étiquettes** (étiquette 98×62 et affiche 75×105) : Reggae, Romantique, Funky, Soul, Salsa, Punk (lettres découpées « ransom note »). Chaque modèle a sa palette propre (la couleur de cadre et le fond clair/sombre ne s’appliquent pas à ces modèles). 4 nouvelles polices système : Marker Felt, Brush Script, Showcard Gothic, Cooper Black (repli automatique si absentes).

## v3.37.0 — Étiquettes et feuilles rock'n roll

- Étiquettes : **une police par modèle** (liste « Police » = Auto par défaut, ou une police imposée à toute la planche), 9 nouveaux modèles (Étiquette Excel compacte, Punk, Caisse stencil, Affiche de concert, Avis de recherche, Gothique, Disque vinyle, Tag graffiti) → 33 formats.
- 9 polices proposées en plus : Superscratchy, Impact, Chiller, Jokerman, Stencil, Old English, Ink Free, Bauhaus 93, Courier (polices système, avec repli sur les polices embarquées si absentes).
- **Texte vertical** comme dans l’Excel : « 2026#6 … IBU », « Alc : x % » et volume (bandeau Excel, Punk, Caisse, Affiche, Tag, compacte).
- Bandeau (feuille Excel) en **Superscratchy** : bouton « Importer une police » (stockée dans la base) ou fichier `fonts/Superscratchy.ttf`, ou police installée sur le PC. Sans elle : repli sur Bangers.
- Feuilles de brassage : les 5 présentations conservées, relookées rock'n roll (noir & blanc, accent configurable) : titres Bangers / Anton / Metal Mania / New Rocker / BlackOps, ombres dures, rayures, étoiles, dents de scie.

## v3.36.0 — Eau et minéraux

- Nouvel écran **Eaux** (base : 41 eaux de ville issues de moneaudebrassage.fr — moyenne des réseaux de chaque ville —, 20 eaux minérales, eau osmosée ; colonne type ville / minérales / osmosée ; Cl, SO4, Ca, Mg, Na, HCO3 en mg/L).
- Conception : tableau **Eau & minéraux** sous les levures (une ou plusieurs eaux avec % de mélange, ligne « Ajout de minéraux », total, attendu du style en vert/rouge).
- Écran Styles : 12 colonnes ajoutées (Ca, Mg, Na, Cl, SO4, HCO3 mini/maxi, source moneaudebrassage.fr ; 0/0 = pas de profil publié).
- Consommables : 6 minéraux (prix au gramme d’ion, à ajuster) ; tout minéral ajouté > 0 apparaît automatiquement dans le tableau Consommables de la recette (g = mg/L × eau totale) et dans le coût.

## v3.18.0

- Styles : plus de bouton dupliquer.
- Conception : le calcul exige 100 % de malts et de houblons ; sinon popup « Redimensionner à 100 % ? » (non = aucun calcul, oui = règle de trois puis calcul).

## v3.17.0

- Conception (malts, houblons) : saisir un % remet tous les poids à zéro puis les recalcule (colonne poids en lecture seule) ; saisir un poids recalcule les % (colonne % en lecture seule). La colonne sans focus est toujours en lecture seule.
- Écrans Malts, Houblons, Levures, Styles, Ingrédients, Consommables : ligne de filtres au-dessus du tableau (plusieurs colonnes = ET, autocomplétion dès 3 caractères sur les colonnes texte) et icône ⧉ dupliquer (copie placée dessous, nom suffixé « (copie) »).

## v3.16.0

Conception : malts et houblons saisissables en poids **ou** en pourcentage. Saisir un % recalcule tous les poids à partir du total courant ; saisir un poids recalcule les %. Houblons : nouvelle colonne % entre poids et α %.

## v3.15.0

Conception : « attendus » en plus petit ; tableau **Consommables** sous les ingrédients (quantité × prix/unité de l’écran Consommables, inclus dans le coût et enregistré avec la recette). Design responsive (téléphone / tablette : navigation défilante, colonnes empilées, tableaux défilables, feuille de brassage et étiquettes mises à l’échelle de l’écran).

## v3.14.2

Écrans Malts, Houblons, Levures, Styles, Ingrédients, Consommables : tri par défaut sur le nom (croissant), en-tête « nom ». Houblons : en-têtes et radar en français.

## v3.14.1

HTML : chaque ligne de notes saisie = une ligne `<tr>` du tableau NOTES.
Application de conception de recettes de bière. Tout est dans ce dossier : aucune installation, aucun serveur à écrire.

## Démarrer

1. Ouvrir le dossier **BrewCraft lui-même** (pas son parent) dans VS Code — sinon le réglage `.vscode/settings.json` qui empêche Live Server de recharger la page à chaque écriture du `.sqlite` n’est pas pris en compte —, clic droit sur `index.html` → **Open with Live Server** (« Go Live »).
2. Utiliser **Chrome ou Edge**. Avec **Brave** : taper `brave://flags/#file-system-access-api` dans la barre d’adresse, choisir _Enabled_, puis _Relancer_.

## Où sont enregistrées les données ?

Dans `brewcraft_<version>.sqlite`, à la racine du projet.

- **Au démarrage**, un popup oblige à indiquer la base : cliquez sur « Sélectionner la base de données » et choisissez `brewcraft_<version>.sqlite`. Dès qu'elle est sélectionnée, toutes les données (malts, houblons, levures, styles, ingrédients, consommables, paramètres, recettes, HTML…) alimentent l'application.
- Tant que la base n'est pas chargée, l'application est inutilisable et aucune sauvegarde n'est possible.
- Un seul bouton **💾 Sauvegarder** (en haut à droite) enregistre tout dans la base ; les modifications sont aussi enregistrées automatiquement.
- À chaque nouvelle ouverture, le popup se réaffiche : le navigateur demande de réautoriser l'accès au fichier (un clic).
- Voyant : vert = synchronisé ; orange = autorisation d'écriture à renouveler (cliquer sur Sauvegarder).

## Données fournies

Malts : brewpark.com (EBC publié). Houblons (pellets) et levures (sachets 11 g) : autobrasseur.fr (noms, prix TTC). Les valeurs techniques absentes de ces sites (potentiel, alpha-acides, atténuation, floculation, températures) et toutes les notes aromatiques sont des **estimations** modifiables dans l'application. Les prix des malts ne sont pas publics (connexion requise) : à saisir.

## Hébergement (OVH)

Un hébergement statique ne peut pas écrire `brewcraft_<version>.sqlite` : les données restent alors dans le navigateur, qui ne les partage pas entre appareils.

## Développement

Voir `dev/README.md`.

## v3.9.1 — Styles BJCP 2021

Tous les styles et sous-styles de https://www.bjcp.org/style/2021/beer/ (123 entrées, texte original anglais) sont dans la table `style`, une colonne SQL par rubrique : overall impression, appearance, aroma, flavor, mouthfeel, comments, history, characteristic ingredients, style comparison, IBU/SRM/OG/FG/ABV (min/max), commercial examples. Les catégories génériques (Fruit Beer, Spice, Smoked, etc.) n'ont pas de statistiques vitales (« varies with base style »).
Régénération : `python3 dev/gen-data.py && node dev/tests/make-db.js` (sources dans `dev/bjcp/`).

## v3.9.1 — Calcul des volumes d’eau

Panneau « Calcul des volumes d’eau » dans Paramètres, reprenant l’onglet « calculs » de cerveza_1.9.4.xlsx (données de base, pertes, volumes d’eau, densités, process, température). Champ vide = valeur automatique (recette / équipement).

## v3.9.1

Conception : ratio d’empâtage (lecture seule), tableau « Quantités d’eau », tableau « Resucrage & CO₂ » (sucre g/L, température, vol CO₂, sucre total). Paramètres : grains non modifiables, rinçage = tableau Process.

## v3.9.1

Glace saisie dans Conception (lecture seule dans Paramètres), alerte ⚠ > 45 L (empâtage + malt), feuille de brassage avec les valeurs calculées (eau, températures, resucrage).

## v3.9.1 — Étiquettes

Onglet « Étiquettes » : 11 formats (bandeau, bandeau incliné, classique, carré, rond, capsule, ovale, contre-étiquette, hexagone, écusson, ruban) sur planche A4 calepinée au maximum, QR Code (lib/qrcode.js, MIT, Kazuhiko Arase) généré depuis une URL, logo chargé dans Paramètres. Impression : bouton « Imprimer la planche A4 » (marges 0, échelle 100

## v3.9.1 — Étiquettes

Onglet « Étiquettes » : 11 formats (bandeau, bandeau incliné, classique, carré, rond, capsule, ovale, contre-étiquette, hexagone, écusson, ruban) sur planche A4 calepinée au maximum, QR Code (lib/qrcode.js, licence MIT, Kazuhiko Arase) généré depuis une URL, logo chargé dans Paramètres. Impression : bouton « Imprimer la planche A4 » (marges 0, échelle 100 %).

## v3.10.0 — Étiquettes : lisibilité, polices rock, ergonomie

- **Formats agrandis** (24 au total, dont « Bandeau large » 190 × 62) : texte ≥ 3 mm, nom ajusté automatiquement pour ne jamais déborder, détails réduits à l’essentiel.
- **Polices « rock’n roll »** embarquées dans `fonts/` (SIL Open Font License, fonctionne hors ligne et à l’impression) : New Rocker, Metal Mania, Bangers, Anton, Black Ops One, Rye, Sancreek, Pirata One + Classique. Texte courant en Oswald (condensé, lisible). Choix mémorisé par recette.
- **Fond clair ou sombre** (fond noir, texte clair, logo sur pastille blanche).
- Formulaire : tous les champs sur **une seule ligne** ; « Embouteillage » = calendrier (un clic n’importe où dans le champ ouvre le sélecteur, comme pour la date de brassage ; même comportement sur tous les champs date).
- Clic sur un format : la liste de droite **conserve sa position** (plus de retour en haut).
- Tests : 109/109 (`node dev/tests/e2e.js`).

## v3.11.0 — Bandeau Excel, dégustation, brassin réalisé, logos

- **Étiquettes** : retour du **bandeau de la feuille Excel** (parallélogramme 188 × 34 mm, logo en gris à gauche, nom en gros, alcool / code brassin, 3 lignes de détail ; QR à droite si une URL est saisie). Format par défaut, en tête de liste.
- **Date d’embouteillage** déplacée dans **Conception** (à côté de la date de brassage) ; les étiquettes la reprennent.
- **Analyse organoleptique** : zone affichée dans Conception dès que la date d’embouteillage est renseignée (grille BJCP : arôme /12, aspect /3, saveur /20, bouche /5, impression /10 ; robe, limpidité, mousse, carbonatation ; DI/DF mesurées → ABV réel). Enregistrée avec la recette.
- **Bibliothèque** : colonne « Réalisé » (coche verte). Coche verte « Réalisé » (lecture seule) dès que la date d’embouteillage est renseignée.
- **Paramètres** : mise en page en grille homogène (mêmes marges, titres et champs partout).
- **Logos** : 6 propositions « Espumaloca » dans Paramètres › Logo (un clic = logo des étiquettes). Générées par `python3 dev/gen-logos.py` (textes convertis en tracés, polices OFL de `fonts/`) → `js/logos.js`.
- Tests : 115/115.

## v3.11.2

- Paramètres › Variables de pertes : la **durée d’ébullition** reprend le palier « Ébullition » de l’écran Conception (paliers d’empâtage) et n’est plus modifiable.

## v3.11.3

- Paramètres : champs modifiables (calcul des volumes d’eau, tableaux) avec la même apparence que ceux des paliers d’empâtage (fond sombre, bordure, texte normal, alignés à gauche).

## v3.11.3

- Tous les champs numériques modifiables ont la même apparence que ceux des paliers d’empâtage (64 px, texte à gauche, même fond/bord/police).

## v3.12.0 — Feuille de brassage

- Mise en page **2 pages A4** (aperçu fidèle, impression/PDF sans coupure) : bandeau d’en-tête avec logo, chiffres clés (DI, DF, ABV, IBU, EBC, IBU/DI), cartes Malts / Houblons (barres de proportion), Levure, Resucrage, Paliers, courbe de température ; page 2 : volumes d’eau avec colonnes « réalisé » à remplir à la main + **zone de notes** (20 lignes).
- Design monochrome (noir / gris) pour rester économe à l’impression.
- **Notes** : enregistrées avec la recette (base sqlite), reprises dans le rendu HTML (tableau « NOTES »), imprimées en entier même au-delà de 20 lignes.

## v3.14.0 — Feuille de brassage : 5 présentations vraiment différentes

Classique (bandeau + cartes), **Fiche à remplir** (formulaire 3 pages inspiré d'une fiche papier : bandeau estimé/mesuré, additifs, frise d'ébullition, densités, embouteillage, page de notes), **Affiche rock** (bandeau latéral noir, chiffres géants), **Pas à pas** (frise verticale numérotée), **Journal de bord** (papier réglé, serif, marge). Les anciennes présentations « Fiche technique » et « Tableau de bord » sont remplacées (retour au Classique).

## v3.13.0 — Feuille de brassage éditable, 5 présentations

- **Volumes d’eau & densités en haut de la page 1** ; **courbe de température sur toute la largeur**.
- **5 présentations A4** au choix dans la liste de droite (comme les étiquettes) : Classique, Fiche technique, Affiche rock, Journal de bord, Tableau de bord. Choix et **couleur d’accent** mémorisés par recette ; monochrome par défaut.
- Feuille **en HTML éditable** : on saisit directement dedans les volumes / densités réalisés, les températures et durées réelles des paliers, et les notes (20 lignes). Tout est enregistré avec la recette (sqlite) ; volumes/densités réalisés repris dans le rendu HTML.
- Bouton « Imprimer / PDF » : 2 pages A4 (3 si les notes dépassent 20 lignes). Code dans `js/sheet.js`.

### v3.36.0

- Minéraux ajoutés automatiquement : affichés dans une zone de texte non modifiable (tableau Consommables).
- Tableau Eau & minéraux : valeurs numériques au format du coût des levures (2 décimales, couleur teal) ; conformité vert/rouge sur la ligne « Attendu ».
- Radar multi-sélection (5 max) et Épernay par défaut : déjà en place.

### v3.36.0

- Radar (malts, houblons, levures) : la liste de cases est remplacée par un tableau de 5 lignes (liste déroulante + valeurs des arômes), ligne « Moyenne » en bas, et un second radar à droite du premier affichant cette moyenne.
- Minéraux auto du tableau Consommables : une ligne avec champs en lecture seule (même affichage que les autres lignes).

### v3.36.0

- Tous les radars : si la souris reste plus d'1 seconde dessus, il s'affiche en plein écran (comme une galerie). Clic, ✕ ou Échap pour fermer.

### v3.36.0

- Consommables : une ligne par minéral ajouté (champs en lecture seule, même taille que les champs saisis).

### v3.36.0

- Consommables : quantité des minéraux auto à la même taille que les champs saisissables.
- Malts / houblons / levures : tableau réduit au nom (5 lignes, 25 %), radar à droite, radar des totaux supprimé.
- Chaque radar a un bouton « ⬇ PNG » (export image avec titre et légende).

### v3.36.0

- Radars : un clic ouvre le radar en plein écran (plus de délai de survol).
- Tableau de sélection du radar : saisie avec autocomplétion après 3 caractères.
- Écrans malts/houblons/levures : la barre (titre, + Ligne, import/export, tout effacer) passe sous le radar.

### v3.36.0

- Radars : second bouton « ⬇ PNG clair » (export sur fond blanc, textes et grille sombres).
- Radars sans données : la grille reste affichée, le tracé n'apparaît pas.

### v3.36.0

- Radars : bouton PNG clair noté « PNG » sur fond blanc ; légende des radars malts/houblons/levures toujours réservée (invisible si le tableau est vide).

### v3.36.0

- Eau & minéraux : « attendu » au format du Bilan de la recette (petit texte, min–max).
- Consommables (conception) : plus de total de quantité.
- Paramètres › Électricité : durées en minutes ; lignes automatiques (chauffe initiale, paliers d'empâtage, montée entre-paliers, mashout, ébullition, chauffe eau de rinçage) calculées d'après « Chauffe (°C/min)», la température initiale et les paliers de la recette ; désignation et durée en lecture seule, puissance modifiable. Anciennes lignes conservées (h → min).

### v3.36.0

- Électricité : puissance en W (anciennes valeurs kW × 1000), kWh conservés.
- Toutes les valeurs calculées (ex-cyan) sont affichées dans des inputs en lecture seule, texte en italique aligné à gauche (lignes « Total » et « attendu » inchangées).

### v3.36.0

- Champs en lecture seule : police gris clair.
- Infobulle après 0,5 s de survol de chaque champ en lecture seule : explication du calcul ou du champ repris.

### v3.36.0

- Écrans avec filtres : icône gomme en fin de ligne de filtres (efface tous les filtres, retour au tri par nom croissant).
- Paramètres : tous les champs en lecture seule en gris ; propositions de logos « Espumaloca » retirées.

### v3.36.0

- Quantités d'eau : ligne « Quantité totale d'eau nécessaire (hors glace) » (empâtage + rinçage).
- Électricité : durée « Chauffe eau de rinçage » = (T° rinçage − T° initiale) ÷ chauffe × (volume d'eau de rinçage ÷ volume d'eau d'empâtage).
- Eau & minéraux : colonnes Litres et %, mode exclusif comme malts/houblons (saisie des litres → % recalculés ; saisie des % → litres = total nécessaire × %).

### v3.36.0

- Eau & minéraux : chaque eau affiche son apport en mg/L pondéré par sa part des litres ; ligne « Sous-total » (somme des apports + total des litres et %) avant « Ajout de minéraux » ; Total = sous-total + ajout ; contrôle ✔/⚠ : total des litres = quantité totale d'eau nécessaire.

### v3.36.0

- Eau & minéraux : colonne « Type » supprimée.
- Tous les champs modifiables (texte et numériques) : contenu sélectionné à l'entrée, la première frappe remplace l'ancienne valeur.
- Fond de page (quadrillé) 15 % plus clair.

### v3.36.0

- Conception : la barre Recette / Style / Volume / Ratio / DI / IBU est dans un cadre (sans titre).
- Eau & minéraux : ligne « Ratio SO₄/Cl » (input en lecture seule) + « attendu » dessous.
- Base des styles : nouvelles colonnes « Ratio SO4/Cl mini » et « maxi » (valeur du site moneaudebrassage.fr, migration automatique).

### v3.36.0

- Radars de l'écran Conception : hauteur réduite de 25 % (480 → 360 px).
- Correctif de saisie : la sélection automatique du contenu à l'entrée dans un champ ne vole plus le focus, ne se déclenche plus après le début de la frappe, et s'applique immédiatement au clic (plus de premier caractère perdu → DI/IBU invalides → « Calculer » sans effet).

### v3.36.0

- Correctif : erreur « Cannot read properties of undefined (reading 'length') » sur un évènement clavier sans propriété `key` (remplissage automatique du navigateur).

### v3.36.0

- Radars des écrans malts/houblons/levures : même géométrie que ceux de la conception, donc agrandis (clic) à la même taille ; légende en bas de l'écran pour ne plus réduire le radar.
