#!/usr/bin/env bash
# Spielt eine Schrittfolge im Browser ab: werkzeuge/test.sh '<json>'
cd "$(dirname "$0")/.."
mkdir -p build/pw
docker run --rm --init --ipc=host --user "$(id -u):$(id -g)" -e HOME=/tmp -e MOBIL="${MOBIL:-0}" -e SEITE="${SEITE:-}" -e WURZEL="${WURZEL:-}" -v "$PWD":/app -w /app/build/pw \
	mcr.microsoft.com/playwright:v1.64.1-noble bash -c \
	'[ -d node_modules/playwright ] || npm i -s playwright@1.64.1 >/dev/null 2>&1; cp /app/werkzeuge/browsertest.mjs . && timeout -s KILL 300 node browsertest.mjs "$1"' _ "$1" >/dev/null 2>&1
cat build/screens/konsole.txt
