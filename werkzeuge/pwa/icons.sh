#!/usr/bin/env bash
# Erzeugt werkzeuge/pwa/icon-{180,192,512}.png aus icon.svg (Playwright-Container)
cd "$(dirname "$0")/../.."
mkdir -p build/pw
docker run --rm --init --ipc=host --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/app -w /app/build/pw \
	mcr.microsoft.com/playwright:v1.64.1-noble bash -c \
	'[ -d node_modules/playwright ] || npm i -s playwright@1.64.1 >/dev/null 2>&1; cp /app/werkzeuge/pwa/icons-erzeugen.mjs . && node icons-erzeugen.mjs'
ls -la werkzeuge/pwa/*.png
