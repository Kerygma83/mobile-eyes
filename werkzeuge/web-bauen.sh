#!/usr/bin/env bash
# Baut BrightEyes (Schicksalsklinge) mit Emscripten nach build/web/.
# Aufruf über den Container:  ./werkzeug.sh werkzeuge/web-bauen.sh
set -euo pipefail
cd /app
src=BrightEyes/src/schick
out=build/web
mkdir -p "$out/obj"

# Header geändert? Dann alles neu übersetzen (keine Abhängigkeitsverfolgung pro Datei)
if [ -f "$out/obj/.stand" ] && [ -n "$(find "$src" -maxdepth 2 \( -name '*.h' -o -name '*.H' \) -newer "$out/obj/.stand")" ]; then
	echo "Header geändert – baue alles neu"
	rm -f "$out"/obj/*.o
fi

# Quelldateien aus der CMakeLists.txt übernehmen, damit beide Builds dieselben Dateien nutzen
mapfile -t quellen < <(sed -n '/set(SCHICK_SOURCES/,/)/p' "$src/CMakeLists.txt" | grep -o '[a-z0-9_]*\.cpp')

cflags=(-O2 -fno-asm -Wno-register -Wno-unused-result -sUSE_SDL=2)
objs=()
for q in "${quellen[@]}"; do
	o="$out/obj/${q%.cpp}.o"
	objs+=("$o")
	if [ ! -f "$o" ] || [ "$src/$q" -nt "$o" ]; then
		echo "em++ $q"
		em++ "${cflags[@]}" -c "$src/$q" -o "$o" &
		while [ "$(jobs -rp | wc -l)" -ge "$(nproc)" ]; do wait -n; done
	fi
done
wait
touch "$out/obj/.stand"

# Nur für lokale Tests: SPIELDATEN=1 packt /app/spiel mit ein. Niemals so ausliefern!
extra=()
if [ "${SPIELDATEN:-0}" = 1 ]; then
	extra=(--preload-file spiel@/spiel)
fi
# PROFIL=1: Funktionsnamen im WASM behalten (für CPU-Profile)
if [ "${PROFIL:-0}" = 1 ]; then
	extra+=(--profiling-funcs)
fi

em++ "${objs[@]}" -o "$out/index.html" "${extra[@]}" \
	-sUSE_SDL=2 -sASYNCIFY -sASYNCIFY_STACK_SIZE=65536 \
	-sALLOW_MEMORY_GROWTH -sSTACK_SIZE=1MB \
	-sFORCE_FILESYSTEM -sEXPORTED_RUNTIME_METHODS=FS,callMain \
	-lidbfs.js --pre-js werkzeuge/pre.js --shell-file werkzeuge/shell.html \
	-sEXPORTED_FUNCTIONS=_main,_web_key,_web_right_click,_web_click,_web_screen_mode${EXTRA_EXPORTS:-}
ls -la "$out" | grep -v obj
