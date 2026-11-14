#!/usr/bin/env bash
# Baut BrightEyes (Schicksalsklinge) mit Emscripten.
# Aufruf über den Container:  ./werkzeug.sh [env VAR=1 …] werkzeuge/web-bauen.sh
#
#   SPIELDATEN=1  packt /app/spiel mit ein (nur für Tests im LAN, niemals ausliefern!)
#   TESTHOOKS=1   Test-Build mit Abkürzungen (Kampf starten, Zustand abfragen)
#                 → baut nach build/web-test statt build/web
#   PROFIL=1      Funktionsnamen im WASM behalten (Stacktraces, CPU-Profile)
#   PRUEF=1       Prüf-Build mit Laufzeitprüfungen (Speicherzugriffe, Assertions)
set -euo pipefail
cd /app
src=BrightEyes/src/schick

cflags=(-O2 -fno-asm -Wno-register -Wno-unused-result -sUSE_SDL=2)
lflags=()
exports=_main,_web_key,_web_right_click,_web_click,_web_screen_mode,_web_party_state,_web_menu_select
runtime=FS,callMain
out=build/web

if [ "${TESTHOOKS:-0}" = 1 ]; then
	out=build/web-test
	cflags+=(-DWEB_TESTHOOKS)
	exports+=,_web_test_fight,_web_test_sign,_web_test_no_city_events,_web_test_state
	runtime+=,UTF8ToString
fi
if [ "${PRUEF:-0}" = 1 ]; then
	out+=-pruef
	lflags+=(-sASSERTIONS=2 -sSAFE_HEAP=1 -sSTACK_OVERFLOW_CHECK=2)
fi
if [ "${SPIELDATEN:-0}" = 1 ]; then
	lflags+=(--preload-file spiel@/spiel)
fi
if [ "${PROFIL:-0}" = 1 ]; then
	lflags+=(--profiling-funcs)
fi

mkdir -p "$out/obj"

# Header oder Schalter geändert? Dann alles neu übersetzen (keine Abhängigkeitsverfolgung pro Datei)
stand="${cflags[*]}"
if [ -f "$out/obj/.stand" ] && { [ "$(cat "$out/obj/.stand")" != "$stand" ] || \
	[ -n "$(find "$src" -maxdepth 2 \( -name '*.h' -o -name '*.H' \) -newer "$out/obj/.stand")" ]; }; then
	echo "Header oder Schalter geändert – baue alles neu"
	rm -f "$out"/obj/*.o
fi

# Quelldateien aus der CMakeLists.txt übernehmen, damit beide Builds dieselben Dateien nutzen
mapfile -t quellen < <(sed -n '/set(SCHICK_SOURCES/,/)/p' "$src/CMakeLists.txt" | grep -o '[a-z0-9_]*\.cpp')

objs=()
for q in "${quellen[@]}"; do
	o="$out/obj/${q%.cpp}.o"
	objs+=("$o")
	if [ ! -f "$o" ] || [ "$src/$q" -nt "$o" ]; then
		echo "em++ $q"
		rm -f "$o"	# schlägt das Übersetzen fehl, scheitert dann das Linken statt still alten Code zu nehmen
		em++ "${cflags[@]}" -c "$src/$q" -o "$o" &
		while [ "$(jobs -rp | wc -l)" -ge "$(nproc)" ]; do wait -n; done
	fi
done
wait
echo "$stand" > "$out/obj/.stand"

em++ "${objs[@]}" -o "$out/index.html" "${lflags[@]}" \
	-sUSE_SDL=2 -sASYNCIFY -sASYNCIFY_STACK_SIZE=65536 \
	-sALLOW_MEMORY_GROWTH -sSTACK_SIZE=1MB \
	-sFORCE_FILESYSTEM -sEXPORTED_RUNTIME_METHODS=$runtime \
	-lidbfs.js --pre-js werkzeuge/pre.js --shell-file werkzeuge/shell.html \
	-sEXPORTED_FUNCTIONS=$exports
echo "→ $out"
