#!/usr/bin/env bash
# Baut innoextract (GOG-Installer entpacken) als WebAssembly für den Daten-Import im Browser.
# Aufruf über den Container:  ./werkzeug.sh werkzeuge/innoextract-wasm.sh
#   → build/innoextract-wasm/innoextract.js + .wasm (web-bauen.sh kopiert sie mit)
#
# Quellen werden einmal geladen und per SHA-256 geprüft; Bibliotheken (liblzma, Boost mit
# zlib/bzip2) landen in build/innoextract-wasm/prefix und werden nur einmal gebaut.
# C++-Ausnahmen (innoextract, Boost) als WebAssembly-Ausnahmen: -fwasm-exceptions überall.
# Stack 8 MB wie nativ: mit den 64 KB von Emscripten läuft das Einlesen des Kopfs über (Speicherfehler).
# Lizenzen: innoextract zlib-Lizenz, Boost BSL-1.0, xz/liblzma 0BSD; zlib und bzip2 als Emscripten-Ports.
set -euo pipefail
cd /app
arb=build/innoextract-wasm
mkdir -p "$arb"
cd "$arb"
prefix=$PWD/prefix
jobs=$(nproc)

quellen=(
	"https://constexpr.org/innoextract/files/innoextract-1.9.tar.gz 6344a69fc1ed847d4ed3e272e0da5998948c6b828cb7af39c6321aba6cf88126"
	"https://archives.boost.io/release/1.83.0/source/boost_1_83_0.tar.bz2 6478edfe2f3305127cffe8caf73ea0176c53769f4bf1585be237eb30798c3b8e"
	"https://github.com/tukaani-project/xz/releases/download/v5.6.3/xz-5.6.3.tar.gz b1d45295d3f71f25a4c9101bd7c8d16cb56348bbef3bbc738da0351e17c73317"
)
for q in "${quellen[@]}"; do
	set -- $q
	datei=$(basename "$1")
	[ -f "$datei" ] || curl -sSfL -o "$datei" "$1"
	echo "$2  $datei" | sha256sum -c --quiet
	verz=${datei%.tar.*}
	[ -d "$verz" ] || tar xf "$datei"
done

# liblzma (nur die Bibliothek)
if [ ! -f "$prefix/lib/liblzma.a" ]; then
	echo "== liblzma"
	(cd xz-5.6.3 && emconfigure ./configure --prefix="$prefix" --disable-shared --enable-static \
		--disable-xz --disable-xzdec --disable-lzmadec --disable-lzmainfo --disable-lzma-links \
		--disable-scripts --disable-doc --disable-nls --disable-threads >/dev/null \
		&& emmake make -j"$jobs" >/dev/null && emmake make install >/dev/null)
fi

# Boost: iostreams, filesystem, program_options, date_time, system direkt mit em++ übersetzen
# (b2 kennt das aktuelle Emscripten nicht); zlib und bzip2 als Emscripten-Ports
ports=(-sUSE_ZLIB=1 -sUSE_BZIP2=1)
if [ ! -f "$prefix/lib/libboost_iostreams.a" ]; then
	echo "== Boost"
	mkdir -p "$prefix/include" "$prefix/lib" boost-obj
	ln -sfn "$PWD/boost_1_83_0/boost" "$prefix/include/boost"
	bib() {   # bib name quelle…
		local name=$1; shift
		local objs=()
		for q in "$@"; do
			local o="boost-obj/${name}_$(basename "${q%.cpp}").o"
			em++ -O2 -std=c++14 -fwasm-exceptions "${ports[@]}" -DBOOST_ALL_NO_LIB -DBOOST_FILESYSTEM_SINGLE_THREADED -DNDEBUG -I"$prefix/include" -Iboost_1_83_0/libs/filesystem/src -c "$q" -o "$o"
			objs+=("$o")
		done
		emar rcs "$prefix/lib/libboost_$name.a" "${objs[@]}"
	}
	b=boost_1_83_0/libs
	bib filesystem $b/filesystem/src/{codecvt_error_category,directory,exception,operations,path,path_traits,portability,unique_path,utf8_codecvt_facet}.cpp
	bib program_options $b/program_options/src/*.cpp
	bib iostreams $b/iostreams/src/{file_descriptor,mapped_file,zlib,bzip2,gzip}.cpp
	bib date_time $b/date_time/src/gregorian/greg_month.cpp
	bib system $b/system/src/error_code.cpp
fi

echo "== innoextract"
# Ausgabe: ES-Modul-freie Fabrik InnoExtract() für einen Web Worker; Eingabe per WORKERFS
# (liest die Datei des Nutzers stückweise, ohne sie in den Speicher zu kopieren)
emcmake cmake -S innoextract-1.9 -B bau -DCMAKE_BUILD_TYPE=Release \
	-DLZMA_LIBRARY="$prefix/lib/liblzma.a" -DLZMA_INCLUDE_DIR="$prefix/include" \
	-DBoost_INCLUDE_DIR="$prefix/include" -DBoost_LIBRARY_DIR="$prefix/lib" -DBoost_NO_SYSTEM_PATHS=ON -DBoost_NO_BOOST_CMAKE=ON \
	-DCMAKE_FIND_ROOT_PATH_MODE_LIBRARY=BOTH -DCMAKE_FIND_ROOT_PATH_MODE_INCLUDE=BOTH \
	-DUSE_STATIC_LIBS=ON -DCMAKE_CXX_FLAGS="-fwasm-exceptions -sUSE_ZLIB=1 -sUSE_BZIP2=1" -DWITH_CONV=builtin -DUSE_LZMA=ON -DLZMA_USE_STATIC_LIBS=ON \
	-DCMAKE_EXE_LINKER_FLAGS="-fwasm-exceptions -sALLOW_MEMORY_GROWTH -sSTACK_SIZE=8MB -sMODULARIZE -sEXPORT_NAME=InnoExtract -sENVIRONMENT=worker -sINVOKE_RUN=0 -sEXIT_RUNTIME=1 -sFORCE_FILESYSTEM -lworkerfs.js -sEXPORTED_RUNTIME_METHODS=FS,callMain,WORKERFS -sUSE_ZLIB=1 -sUSE_BZIP2=1" \
	>/dev/null
cmake --build bau -j"$jobs" 2>&1 | grep -E "error|warning: unused|Linking|Built target" || true
cp bau/innoextract.js bau/innoextract.wasm .
ls -la innoextract.js innoextract.wasm
