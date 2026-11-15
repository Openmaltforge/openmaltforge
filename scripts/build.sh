#!/bin/bash
# Construit les livrables d'OpenMaltForge dans bin/<version>/ :
#   OpenMaltForge_<v>.exe, openmaltforge_<v>_linux_amd64, openmaltforge_<v>_amd64.deb (+ archives .zip / .tar.gz),
#   OpenMaltForge_<v>_macos_apple_silicon.zip et OpenMaltForge_<v>_macos_intel.zip (application .app)
# Copie aussi l'icône à part (bin/<v>/icone/) et prépare le site de présentation (site/, binaires dans
# site/telechargements/). La version est lue dans web/js/app.js (const VER). Rien n'est livré si une vérification échoue.
# Variables : GO (commande go ; défaut ~/sdk/go1.24.13/bin/go s'il existe).
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$PWD
VER=$(grep -o "const VER = '[^']*'" web/js/app.js | cut -d"'" -f2)
GO="${GO:-}"
if [ -z "$GO" ]; then
  if [ -x "$HOME/sdk/go1.24.13/bin/go" ]; then GO="$HOME/sdk/go1.24.13/bin/go"; else GO=go; fi
fi
export GOTOOLCHAIN=local CGO_ENABLED=0

echo "== OpenMaltForge $VER"
# cohérence des numéros de version
grep -q "<span class=\"ver\">v$VER</span>" web/index.html || { echo "index.html : version ≠ $VER" >&2; exit 1; }
if grep -o '?v=[0-9.]*' web/index.html | grep -vq "?v=$VER"; then echo "index.html : paramètres ?v= ≠ $VER" >&2; exit 1; fi
head -1 README.md | grep -q "v$VER" || { echo "README.md : titre ≠ v$VER" >&2; exit 1; }

echo "== Qualité et tests Go"
NF=$("$(dirname "$("$GO" env GOROOT)/bin/go")/gofmt" -l cmd internal web 2>/dev/null || gofmt -l cmd internal web)
[ -z "$NF" ] || { echo "fichiers mal formatés (gofmt -w) : $NF" >&2; exit 1; }
"$GO" vet ./...
GOOS=windows "$GO" vet ./...
"$GO" test ./...
for f in web/js/*.js; do node --check "$f"; done

echo "== Icônes"
python3 dev/icon/mkicons.py "$VER"
cp dev/icon/icon{16,32,48,64,128,256}.png internal/desktop/icons/

echo "== Compilation"
OUT=bin/$VER
rm -rf "$OUT"
mkdir -p "$OUT"
LD="-s -w -X openmaltforge/internal/config.Version=$VER"
GOOS=windows GOARCH=amd64 "$GO" build -trimpath -ldflags "$LD -H=windowsgui" -o "$OUT/OpenMaltForge_$VER.exe" ./cmd/openmaltforge
GOOS=linux GOARCH=amd64 "$GO" build -trimpath -ldflags "$LD" -o "$OUT/openmaltforge_${VER}_linux_amd64" ./cmd/openmaltforge
v=$("$OUT/openmaltforge_${VER}_linux_amd64" --version)
[ "$v" = "OpenMaltForge $VER" ] || { echo "version du binaire : $v" >&2; exit 1; }

echo "== macOS (application OpenMaltForge.app, Apple Silicon et Intel)"
for A in arm64 amd64; do
  N=$([ "$A" = arm64 ] && echo apple_silicon || echo intel)
  M=$(mktemp -d)
  APP="$M/OpenMaltForge.app/Contents"
  mkdir -p "$APP/MacOS" "$APP/Resources"
  GOOS=darwin GOARCH=$A "$GO" build -trimpath -ldflags "$LD" -o "$APP/MacOS/openmaltforge" ./cmd/openmaltforge
  cp dev/icon/openmaltforge.icns "$APP/Resources/openmaltforge.icns"
  sed "s/@VERSION@/$VER/g" packaging/macos/Info.plist > "$APP/Info.plist"
  cp packaging/macos/LISEZMOI.txt "$M/LISEZMOI.txt"
  (cd "$M" && zip -qry "$ROOT/$OUT/OpenMaltForge_${VER}_macos_${N}.zip" OpenMaltForge.app LISEZMOI.txt)
  rm -rf "$M"
done

echo "== Paquet .deb"
D=$(mktemp -d)
P=$D/openmaltforge_${VER}_amd64
mkdir -p "$P/DEBIAN" "$P/usr/bin" "$P/usr/share/applications" "$P/usr/share/pixmaps"
install -m755 "$OUT/openmaltforge_${VER}_linux_amd64" "$P/usr/bin/openmaltforge"
for z in 16 32 48 64 128 256; do
  mkdir -p "$P/usr/share/icons/hicolor/${z}x${z}/apps"
  install -m644 "dev/icon/icon$z.png" "$P/usr/share/icons/hicolor/${z}x${z}/apps/openmaltforge.png"
done
install -m644 dev/icon/icon128.png "$P/usr/share/pixmaps/openmaltforge.png"
sed "s/@VERSION@/$VER/" packaging/deb/control.in > "$P/DEBIAN/control"
install -m755 packaging/deb/postinst "$P/DEBIAN/postinst"
install -m644 packaging/deb/openmaltforge.desktop "$P/usr/share/applications/openmaltforge.desktop"
dpkg-deb -Zxz --root-owner-group --build "$P" "$OUT/openmaltforge_${VER}_amd64.deb" >/dev/null
rm -rf "$D"

echo "== Icône de l'application (à part des binaires)"
mkdir -p "$OUT/icone"
cp dev/icon/openmaltforge.ico dev/icon/openmaltforge.icns "$OUT/icone/"
for z in 16 32 48 64 128 256 512; do cp "dev/icon/icon$z.png" "$OUT/icone/openmaltforge_${z}.png"; done

echo "== Archives"
(cd "$OUT" && zip -q "OpenMaltForge_${VER}_windows.zip" "OpenMaltForge_${VER}.exe" &&
  tar czf "openmaltforge_${VER}_linux_amd64.tar.gz" --mode='a+rx,go-w' "openmaltforge_${VER}_linux_amd64")
echo "== Site web (site/) : binaires à télécharger et icône"
mkdir -p site/telechargements
rm -f site/telechargements/*
cp "$OUT/OpenMaltForge_$VER.exe" "$OUT/OpenMaltForge_${VER}_windows.zip" "$OUT/openmaltforge_${VER}_linux_amd64" \
  "$OUT/openmaltforge_${VER}_linux_amd64.tar.gz" "$OUT/openmaltforge_${VER}_amd64.deb" \
  "$OUT/OpenMaltForge_${VER}_macos_apple_silicon.zip" "$OUT/OpenMaltForge_${VER}_macos_intel.zip" site/telechargements/
mkdir -p site/img/fr site/img/en
for f in conception; do
  cp "web/doc/img/$f.jpg" site/img/fr/ && cp "web/doc/img/en/$f.jpg" site/img/en/
done
cp dev/icon/icon256.png site/icon.png
cp dev/icon/icon32.png site/favicon.png
cp dev/icon/openmaltforge.ico site/favicon.ico
sed -i "s/\(const VERSION = '\)[^']*'/\1$VER'/" site/index.html
grep -q "const VERSION = '$VER'" site/index.html || { echo "site/index.html : version non mise à jour" >&2; exit 1; }

ls -la "$OUT"
