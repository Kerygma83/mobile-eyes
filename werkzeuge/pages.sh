#!/usr/bin/env bash
# Veröffentlicht den Build ohne Spieldaten (build/web-frei) als Branch gh-pages.
# Aufruf auf dem Host:  werkzeuge/pages.sh [--push]
#
# Ohne --push wird nur build/pages gebaut und committet (zum Ansehen); mit --push geht der
# Branch nach origin (Forgejo), der Push-Mirror bringt ihn zu GitHub (GitHub Pages: gh-pages, /).
# gh-pages muss auf Forgejo liegen: der Mirror löscht auf GitHub Branches, die es dort nicht gibt.
# Jede Veröffentlichung ist ein einzelner Commit (Force-Push), die Historie wächst nicht.
set -euo pipefail
cd "$(dirname "$0")/.."

./werkzeug.sh werkzeuge/web-bauen.sh

# Niemals Spieldaten ausliefern: eingebaute Pakete oder Musik → Abbruch
if compgen -G 'build/web-frei/*.data' >/dev/null || [ -d build/web-frei/musik ] || \
	grep -q 'name="spieldaten" content="1"' build/web-frei/index.html; then
	echo "STOPP: build/web-frei enthält Spieldaten" >&2
	exit 1
fi

# Ohne spiel/ baut web-bauen.sh kein Wörterbuch: die Seite zeigt dann alles in Großbuchstaben
if [ ! -f build/web-frei/schreibung.json ]; then
	echo "STOPP: build/web-frei/schreibung.json fehlt (spiel/ für die knappe Fassung nötig)" >&2
	exit 1
fi

stand=$(git rev-parse --short HEAD)
quelle=$(git -C BrightEyes rev-parse --short HEAD)
version=$(tr -d '[:space:]' < VERSION)
[ -z "$(git status --porcelain)" ] || echo "Hinweis: Arbeitsverzeichnis nicht sauber, Stand $stand plus Änderungen"

rm -rf build/pages
cp -r build/web-frei build/pages
touch build/pages/.nojekyll	# Pages soll die Dateien unverändert ausliefern
cat > build/pages/README.md <<EOF
# Mobile Eyes v$version (veröffentlichter Build)

Gebaut aus \`main\` $stand (BrightEyes \`brighteyes-web\` $quelle). Quellcode: Branch \`main\` dieses Repos.
Enthält keine Spieldaten; die Spieldaten liest jeder Nutzer selbst im Browser ein.
EOF

cd build/pages
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C ../.. config user.name)" -c user.email="$(git -C ../.. config user.email)" \
	commit -qm "Mobile Eyes v$version (main $stand)"
echo "→ build/pages: $(git log --oneline -1)"

if [ "${1:-}" = --push ]; then
	git push -f "$(git -C ../.. remote get-url origin)" gh-pages
fi
