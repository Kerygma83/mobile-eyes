#!/usr/bin/env bash
# Wandelt die CD-Musik der GOG-Fassung (MUSIC/TrackNN.ogg) in AAC (.m4a) um:
# OGG spielt Safari auf iOS nicht zuverlässig ab, AAC überall.
#   werkzeuge/musik-umwandeln.sh   →  spiel/musik/TrackNN.m4a (Spieldaten, nicht im Repo)
set -euo pipefail
cd "$(dirname "$0")/.."
quelle=spieldaten/gog-de/app/MUSIC
[ -d "$quelle" ] || { echo "fehlt: $quelle (siehe README, Einrichten)" >&2; exit 1; }
mkdir -p spiel/musik
# ffmpeg braucht root zum Installieren, die Dateien sollen aber dem Nutzer gehören
docker run --rm -v "$PWD":/d -w /d -e UID_GID="$(id -u):$(id -g)" debian:13-slim bash -c '
	set -e
	apt-get update -qq >/dev/null && apt-get install -y -qq ffmpeg >/dev/null 2>&1
	for f in spieldaten/gog-de/app/MUSIC/Track*.ogg; do
		ziel="spiel/musik/$(basename "${f%.ogg}").m4a"
		ffmpeg -v error -y -i "$f" -vn -c:a aac -b:a 128k -movflags +faststart "$ziel"
		echo "$ziel"
	done
	chown -R "$UID_GID" spiel/musik'
du -sh spiel/musik
