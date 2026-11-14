#!/usr/bin/env bash
# Führt einen Befehl im Build-Container aus (Projekt unter /app, eigener Benutzer).
#   ./werkzeug.sh bash
#   ./werkzeug.sh cmake -S BrightEyes/src/schick -B build/nativ
set -euo pipefail
cd "$(dirname "$0")"

bild=schick-werkzeug
docker build -q -t "$bild" werkzeuge >/dev/null

optionen=(--rm --init --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/app -w /app)
if [ -t 0 ] && [ -t 1 ]; then optionen+=(-it); else optionen+=(-i); fi

exec docker run "${optionen[@]}" "$bild" "$@"
