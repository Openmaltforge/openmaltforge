#!/bin/bash
# Envoie le site de présentation (site/) sur l'hébergement OVH d'openmaltforge.fr, en SFTP, avec lftp.
# Le mot de passe n'apparaît jamais ici : lftp le lit dans ~/.netrc (fichier de l'utilisateur, droits 600, une ligne
# « machine ftp.cluster129.hosting.ovh.net login openmaf password … »). Ne jamais lire ni afficher ce fichier.
# Usage : scripts/deploy-site.sh [--essai]     (--essai : liste ce qui serait envoyé ou supprimé, sans rien changer)
# Variables : OVH_HOST (défaut ftp.cluster129.hosting.ovh.net), OVH_USER (défaut openmaf), OVH_DIR (défaut www).
# Seuls les fichiers modifiés partent ; les fichiers du site absents en local (anciennes versions des téléchargements…)
# sont supprimés du serveur, sauf les fichiers propres à OVH (.ovhconfig…).
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${OVH_HOST:-ftp.cluster129.hosting.ovh.net}"
USR="${OVH_USER:-openmaf}"
DIR="${OVH_DIR:-www}"
[ -f site/index.html ] && [ -f site/.htaccess ] || { echo "site/ incomplet : lancez d'abord scripts/build.sh" >&2; exit 1; }
# Référencement Google : fichiers à garder sur le site à chaque envoi (sinon Search Console perd la propriété validée)
SEO="google34523b237b2d0c04.html robots.txt sitemap.xml"
for f in $SEO; do
  [ -f "site/$f" ] || { echo "site/$f absent : fichier nécessaire au référencement Google, envoi annulé" >&2; exit 1; }
done
grep -q 'google-site-verification: google34523b237b2d0c04.html' site/google34523b237b2d0c04.html ||
  { echo "site/google34523b237b2d0c04.html : contenu de vérification incorrect, envoi annulé" >&2; exit 1; }
for u in $(grep -o '<loc>[^<]*</loc>' site/sitemap.xml | sed 's#<loc>https://openmaltforge.fr/##;s#</loc>##'); do
  [ -f "site/${u:-index.html}" ] || { echo "sitemap.xml cite /$u, absent de site/ : envoi annulé" >&2; exit 1; }
done
[ -f "$HOME/.netrc" ] || { echo "~/.netrc absent : identifiant et mot de passe SFTP à y enregistrer" >&2; exit 1; }
DRY=""
[ "${1:-}" = "--essai" ] && DRY="--dry-run"
# connexion par mot de passe seulement : une clé SSH protégée par une phrase de passe coupait la connexion
lftp <<FIN
set sftp:auto-confirm yes
set net:max-retries 2
set net:timeout 30
set sftp:connect-program "ssh -a -x -o PubkeyAuthentication=no"
open sftp://$USR@$HOST
mirror --reverse --delete --only-newer --no-perms --verbose $DRY --exclude-glob .ovhconfig --exclude ^\.well-known/ --exclude ^cgi-bin/ site/ $DIR/
quit
FIN
[ -z "$DRY" ] || exit 0
V=$(grep -o "const VERSION = '[^']*'" site/index.html | cut -d"'" -f2)
echo "== Vérification en ligne (version $V)"
PAGE=$(curl -fsS --max-time 20 "https://openmaltforge.fr/?v=$V" || true)
if grep -q "const VERSION = '$V'" <<<"$PAGE"; then
  echo "https://openmaltforge.fr : version $V en ligne"
else
  echo "attention : la page en ligne n'affiche pas encore la version $V (cache ?)" >&2
fi
for f in $SEO; do
  C=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://openmaltforge.fr/$f")
  [ "$C" = 200 ] && echo "https://openmaltforge.fr/$f : en ligne" || echo "attention : https://openmaltforge.fr/$f répond $C (référencement Google)" >&2
done
