#!/usr/bin/env bash
# Prüft alles: nativer Build, Web-Test-Build, Browser-Regressionstests.
#   ./pruefen.sh            alles
#   ./pruefen.sh kampf      nur Szenarien, deren Name „kampf“ enthält
#   SCHNELL=1 ./pruefen.sh  ohne nativen Build
set -euo pipefail
cd "$(dirname "$0")"
filter="${1:-}"

if [ ! -f spiel/SCHICK.DAT ]; then
	echo "Spieldaten fehlen: spiel/SCHICK.DAT (siehe README, Abschnitt Einrichten)" >&2
	exit 1
fi

if [ "${SCHNELL:-0}" != 1 ]; then
	echo "== Nativer Build"
	./werkzeug.sh bash -c 'cmake -S BrightEyes/src/schick -B build/nativ -DCMAKE_BUILD_TYPE=Release \
		-DCMAKE_CXX_FLAGS="-include /app/werkzeuge/compat.h" >/dev/null && cmake --build build/nativ -j"$(nproc)" 2>&1 | grep -E "error|Built target" '
fi

echo "== Web-Test-Build"
./werkzeug.sh env SPIELDATEN=1 TESTHOOKS=1 werkzeuge/web-bauen.sh | grep -E "error|→" 

echo "== Browser-Regressionstests"
mkdir -p build/pw
docker run --rm --init --ipc=host --user "$(id -u):$(id -g)" -e HOME=/tmp \
	-v "$PWD":/app -w /app/build/pw mcr.microsoft.com/playwright:v1.64.1-noble bash -c \
	'[ -d node_modules/playwright ] || npm i -s playwright@1.64.1 >/dev/null 2>&1
	 cp /app/werkzeuge/regression.mjs /app/werkzeuge/szenarien.mjs . && node regression.mjs "$1"' _ "$filter"
