#!/usr/bin/env bash
# Prüft alles: nativer Build, Web-Test-Build, Browser-Regressionstests.
#   ./pruefen.sh            alles
#   ./pruefen.sh kampf      nur Szenarien, deren Name „kampf“ enthält
#   SCHNELL=1 ./pruefen.sh  ohne nativen Build
#   PRUEF=1 ./pruefen.sh    Szenarien im Prüf-Build (SAFE_HEAP, Assertions; langsamer)
#   ASAN=1 ./pruefen.sh     Szenarien mit AddressSanitizer/UBSan (deutlich langsamer)
#   ZUFALL_MIN=20 ZUFALL_SAAT=3 ./pruefen.sh zufall   Testpartie per Zufallsspieler
set -euo pipefail
cd "$(dirname "$0")"
filter="${1:-}"

if [ ! -f spiel/SCHICK.DAT ]; then
	echo "Spieldaten fehlen: spiel/SCHICK.DAT (siehe README, Abschnitt Einrichten)" >&2
	exit 1
fi

if [ "${SCHNELL:-0}" != 1 ]; then
	echo "== Nativer Build"
	./werkzeug.sh bash -c 'set -o pipefail; cmake -S BrightEyes/src/schick -B build/nativ -DCMAKE_BUILD_TYPE=Release \
		-DCMAKE_CXX_FLAGS="-include /app/werkzeuge/compat.h" >/dev/null && cmake --build build/nativ -j"$(nproc)" 2>&1 | grep -E "error|Built target" '
	echo "== Heldenerschaffung nativ übersetzen (ngen, ohne SDL2_mixer)"
	./werkzeug.sh bash -c 'mkdir -p build/nativ-gen && cd BrightEyes/src/gen && for q in ngen cda_code vgalib ail_stub powerp20; do
		gcc -O1 -fno-asm -Wno-unused-result -I /app/werkzeuge/gen-stubs -c $q.c -o /app/build/nativ-gen/$q.o || exit 1; done && echo "ngen ok"'
fi

echo "== Web-Test-Build"
./werkzeug.sh env SPIELDATEN=1 TESTHOOKS=1 PRUEF="${PRUEF:-0}" ASAN="${ASAN:-0}" werkzeuge/web-bauen.sh | grep -E "error|→"
wurzel=/app/build/web-test
[ "${PRUEF:-0}" = 1 ] && wurzel+=-pruef
[ "${ASAN:-0}" = 1 ] && wurzel+=-asan

echo "== Browser-Regressionstests"
mkdir -p build/pw
docker run --rm --init --ipc=host --user "$(id -u):$(id -g)" -e HOME=/tmp -e BROWSER="${BROWSER:-}" -e WURZEL="$wurzel" -e ZUFALL_MIN="${ZUFALL_MIN:-}" -e ZUFALL_SAAT="${ZUFALL_SAAT:-}" \
	-v "$PWD":/app -w /app/build/pw mcr.microsoft.com/playwright:v1.64.1-noble bash -c \
	'[ -d node_modules/playwright ] || npm i -s playwright@1.64.1 >/dev/null 2>&1
	 cp /app/werkzeuge/regression.mjs /app/werkzeuge/szenarien.mjs . && node regression.mjs "$1"' _ "$filter"
