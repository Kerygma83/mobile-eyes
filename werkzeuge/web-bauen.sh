#!/usr/bin/env bash
# Baut BrightEyes (Schicksalsklinge) mit Emscripten.
# Aufruf über den Container:  ./werkzeug.sh [env VAR=1 …] werkzeuge/web-bauen.sh
#
#   SPIELDATEN=1  packt /app/spiel mit ein (nur für Tests im LAN, niemals ausliefern!) → build/web;
#                 ohne: → build/web-frei, die Spieldaten liest der Nutzer im Browser ein (daten.js,
#                 GOG-Installer per innoextract-wasm.sh oder ZIP)
#   TESTHOOKS=1   Test-Build mit Abkürzungen (Kampf starten, Zustand abfragen)
#                 → baut nach build/web-test(-frei)
#   PROFIL=1      Funktionsnamen im WASM behalten (Stacktraces, CPU-Profile)
#   ASAN=1        AddressSanitizer + UBSan (Feldgrenzen, freigegebener Speicher, undefiniertes
#                 Verhalten) → build/…-asan, deutlich langsamer
#   PRUEF=1       Prüf-Build mit Laufzeitprüfungen (Speicherzugriffe, Assertions; unausgerichtete
#                 Zugriffe erlaubt: WASM kann sie, das Spiel liest gepackte Daten)
set -euo pipefail
cd /app
src=BrightEyes/src/schick

cflags=(-O2 -fno-asm -Wno-register -Wno-unused-result -sUSE_SDL=2)
lflags=()
exports=_main,_web_key,_web_right_click,_web_click,_web_screen_mode,_web_party_state,_web_menu_select,_web_mouse_cursor
runtime=FS,callMain,UTF8ToString
out=build/web

if [ "${TESTHOOKS:-0}" = 1 ]; then
	out=build/web-test
	cflags+=(-DWEB_TESTHOOKS)
	exports+=,_web_test_fight,_web_test_sign,_web_test_no_city_events,_web_test_state,_web_test_input,_web_test_talk,_web_test_dungeon
fi
if [ "${PRUEF:-0}" = 1 ]; then
	out+=-pruef
	lflags+=(-sASSERTIONS=2 -sSAFE_HEAP=2 -sSTACK_OVERFLOW_CHECK=2 --profiling-funcs)
fi
if [ "${ASAN:-0}" = 1 ]; then
	out+=-asan
	# shift-base: Linksschieben negativer Werte (MAP_POS mit -1) rechnet im Zweierkomplement, seit C++20 definiert
	san=(-fsanitize=address,undefined -fno-sanitize=alignment,shift-base -fno-omit-frame-pointer)
	cflags+=("${san[@]}" -gline-tables-only)
	lflags+=("${san[@]}" -gline-tables-only -sINITIAL_MEMORY=256MB --profiling-funcs)
fi
if [ "${SPIELDATEN:-0}" = 1 ]; then
	# Musik nicht ins Paket (rund 40 MB), sie liegt einzeln unter musik/ (siehe unten)
	lflags+=(--preload-file spiel@/spiel --exclude-file 'spiel/musik/*')
fi
if [ "${PROFIL:-0}" = 1 ]; then
	lflags+=(--profiling-funcs)
fi
# Objektdateien hängen nicht an den Spieldaten: mit und ohne Daten dieselben (nur das Linken unterscheidet sich)
obj="$out/obj"
[ "${SPIELDATEN:-0}" = 1 ] || out+=-frei

mkdir -p "$obj" "$out"

# Header oder Schalter geändert? Dann alles neu übersetzen (keine Abhängigkeitsverfolgung pro Datei)
stand="${cflags[*]}"
if [ -f "$obj/.stand" ] && { [ "$(cat "$obj/.stand")" != "$stand" ] || \
	[ -n "$(find "$src" -maxdepth 2 \( -name '*.h' -o -name '*.H' \) -newer "$obj/.stand")" ]; }; then
	echo "Header oder Schalter geändert – baue alles neu"
	rm -f "$obj"/*.o
fi

# Quelldateien aus der CMakeLists.txt übernehmen, damit beide Builds dieselben Dateien nutzen
mapfile -t quellen < <(sed -n '/set(SCHICK_SOURCES/,/)/p' "$src/CMakeLists.txt" | grep -o '[a-z0-9_]*\.cpp')

objs=()
for q in "${quellen[@]}"; do
	o="$obj/${q%.cpp}.o"
	objs+=("$o")
	if [ ! -f "$o" ] || [ "$src/$q" -nt "$o" ]; then
		echo "em++ $q"
		rm -f "$o"	# schlägt das Übersetzen fehl, scheitert dann das Linken statt still alten Code zu nehmen
		em++ "${cflags[@]}" -c "$src/$q" -o "$o" &
		while [ "$(jobs -rp | wc -l)" -ge "$(nproc)" ]; do wait -n; done
	fi
done
wait
echo "$stand" > "$obj/.stand"

em++ "${objs[@]}" -o "$out/index.html" "${lflags[@]}" \
	-sUSE_SDL=2 -sASYNCIFY -sASYNCIFY_STACK_SIZE=65536 \
	-sALLOW_MEMORY_GROWTH -sSTACK_SIZE=1MB \
	-sFORCE_FILESYSTEM -sEXPORTED_RUNTIME_METHODS=$runtime \
	-lidbfs.js --pre-js werkzeuge/pre.js --shell-file werkzeuge/shell.html -Wl,--wrap=exit \
	-sEXPORTED_FUNCTIONS=$exports

# ---- Heldenerschaffung (ngen, eigenes Programm wie GEN.EXE im Original) → $out/gen.html ----
gsrc=BrightEyes/src/gen
gobjs=()
for q in ngen cda_code vgalib ail_stub powerp20; do
	o="$obj/gen_$q.o"
	gobjs+=("$o")
	if [ ! -f "$o" ] || [ "$gsrc/$q.c" -nt "$o" ] || [ -n "$(find "$gsrc" -maxdepth 1 -name '*.h' -newer "$o")" ]; then
		echo "emcc gen/$q.c"
		rm -f "$o"
		# SDL2_mixer nur als Ersatz (werkzeuge/gen-stubs): Musik ist aus
		emcc -O2 -fno-asm -Wno-unused-result -I werkzeuge/gen-stubs -sUSE_SDL=2 -c "$gsrc/$q.c" -o "$o"
	fi
done
glflags=()
if [ "${PRUEF:-0}" = 1 ]; then glflags+=(-sASSERTIONS=2 -sSAFE_HEAP=2 -sSTACK_OVERFLOW_CHECK=2 --profiling-funcs); fi
if [ "${SPIELDATEN:-0}" = 1 ]; then
	glflags+=(--preload-file spiel/DSAGEN.DAT@/gen/DSAGEN.DAT)
else
	glflags+=(-sFORCE_FILESYSTEM)
fi
emcc "${gobjs[@]}" -o "$out/gen.html" "${glflags[@]}" \
	-sUSE_SDL=2 -sASYNCIFY -sASYNCIFY_STACK_SIZE=65536 -sALLOW_MEMORY_GROWTH -sSTACK_SIZE=1MB \
	-sEXPORTED_RUNTIME_METHODS=FS,UTF8ToString -lidbfs.js \
	--pre-js werkzeuge/gen-pre.js --shell-file werkzeuge/gen-shell.html
cp werkzeuge/dialog.js werkzeuge/ton.js werkzeuge/schreibung.js werkzeuge/wurflog.js werkzeuge/questlog.js werkzeuge/karte.js werkzeuge/heldenbogen.js werkzeuge/aktionen.js werkzeuge/minimap.js werkzeuge/menue.js werkzeuge/startmenue.js werkzeuge/daten.js werkzeuge/intro.js "$out/"
# Spieldaten eingebaut (1) oder Import im Browser (0): Kennung für daten.js
sed -i "s/__SPIELDATEN__/${SPIELDATEN:-0}/" "$out/index.html" "$out/gen.html"
# Versionsnummer der App (Datei VERSION) für Intro und Einstellungen
sed -i "s/__APPVERSION__/$(tr -d '[:space:]' < VERSION)/" "$out/index.html" "$out/gen.html"
# ohne Spieldaten: Import des GOG-Installers (innoextract als WebAssembly, einmal gebaut)
rm -f "$out"/innoextract.* "$out/daten-worker.js"
if [ "${SPIELDATEN:-0}" != 1 ]; then
	[ -f build/innoextract-wasm/innoextract.wasm ] || werkzeuge/innoextract-wasm.sh
	cp werkzeuge/daten-worker.js build/innoextract-wasm/innoextract.js build/innoextract-wasm/innoextract.wasm "$out/"
fi
# Wörterbuch für die Schreibung der Textboxen, aus den Spieldaten abgeleitet (nie einchecken).
# Ohne Spieldaten die knappe Fassung: ohne Namen und Nomen, die schreibung.js ohnehin groß
# schreibt (gleiche Anzeige, nur allgemeiner Wortschatz); fehlen die Daten hier, ohne Wörterbuch
rm -f "$out/schreibung.json"
if [ "${SPIELDATEN:-0}" = 1 ]; then
	/usr/bin/python3 werkzeuge/schreibung.py "$out/schreibung.json"
elif [ -f spiel/SCHICK.DAT ]; then
	/usr/bin/python3 werkzeuge/schreibung.py --knapp "$out/schreibung.json"
else
	echo "spiel/ fehlt: Build ohne Wörterbuch (Textboxen in Großbuchstaben)"
fi
# CD-Musik (spiel/musik/TrackNN.m4a, aus werkzeuge/musik-umwandeln.sh): nur mit Spieldaten
rm -rf "$out/musik"
if [ "${SPIELDATEN:-0}" = 1 ] && [ -d spiel/musik ]; then
	mkdir -p "$out/musik" && cp spiel/musik/*.m4a "$out/musik/"
fi

# Emscripten schreibt zufällige temporäre Dateinamen als Kommentar in die JS-Dateien;
# entfernen, damit derselbe Stand dieselbe Version ergibt (sonst Update-Hinweis bei jedem Build)
sed -i -E '/^[[:space:]]*\/\/ (end )?include: \/tmp\/tmp[^ ]*\.js$/d' "$out/index.js" "$out/gen.js"

# ---- PWA: Manifest, Icons, Service Worker mit Version (Prüfsumme aller Dateien) ----
cp werkzeuge/pwa/manifest.webmanifest werkzeuge/pwa/icon-*.png "$out/"
dateien=(index.html index.js index.wasm gen.html gen.js gen.wasm dialog.js ton.js schreibung.js wurflog.js questlog.js karte.js heldenbogen.js aktionen.js minimap.js menue.js startmenue.js daten.js intro.js manifest.webmanifest icon-180.png icon-192.png icon-512.png)
for d in index.data gen.data schreibung.json daten-worker.js innoextract.js innoextract.wasm; do [ -f "$out/$d" ] && dateien+=("$d"); done
version=$(cd "$out" && cat "${dateien[@]}" | sha256sum | cut -c1-12)
liste=$(printf '"./",'; printf '"%s",' "${dateien[@]}")
sed -e "s/__VERSION__/$version/" -e "s|__DATEIEN__|[${liste%,}]|" werkzeuge/pwa/sw.js > "$out/sw.js"
echo "→ $out (Version $version)"
