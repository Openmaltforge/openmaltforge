#!/bin/bash
# Envoie le site de présentation (site/) sur l'hébergement OVH, par SSH (clé, sans mot de passe).
#   OVH_SSH=<identifiant>@ssh.<cluster>.hosting.ovh.net scripts/deploy-site.sh [--essai]
# OVH_DIR : dossier du site sur le serveur (défaut : www). --essai : affiche ce qui serait envoyé, sans rien changer.
# Seuls les fichiers modifiés partent ; les fichiers du site absents en local (anciennes versions des téléchargements…)
# sont retirés du serveur, sauf les fichiers propres à OVH (.ovhconfig…).
set -euo pipefail
cd "$(dirname "$0")/.."
: "${OVH_SSH:?indiquez OVH_SSH=<identifiant>@ssh.<cluster>.hosting.ovh.net}"
DIR="${OVH_DIR:-www}"
[ -f site/index.html ] && [ -f site/.htaccess ] || { echo "site/ incomplet : lancez d'abord scripts/build.sh" >&2; exit 1; }
DRY=()
[ "${1:-}" = "--essai" ] && DRY=(--dry-run)
rsync -rlvz --checksum --delete "${DRY[@]}" \
  --exclude '.ovhconfig' --exclude '.well-known/' --exclude 'cgi-bin/' \
  site/ "$OVH_SSH:$DIR/"
[ ${#DRY[@]} -eq 0 ] || exit 0
V=$(grep -o "const VERSION = '[^']*'" site/index.html | cut -d"'" -f2)
echo "== Vérification en ligne (version $V)"
curl -fsS --max-time 20 https://openmaltforge.fr/ | grep -q "const VERSION = '$V'" && echo "https://openmaltforge.fr : version $V en ligne"
