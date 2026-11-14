# Mobile Eyes – Die Schicksalsklinge im Browser

Das Schwarze Auge 1: *Die Schicksalsklinge* (Attic, 1992) als Web-App (PWA) mit mobilem Interface.
Die Spiellogik stammt aus [BrightEyes](https://github.com/Henne/BrightEyes) (Henne, siebenstreich u. a.):
eine nach C rekonstruierte, native SDL2-Fassung. Sie wird hier mit Emscripten nach WebAssembly übersetzt;
die Bedienung wird Schritt für Schritt durch ein Touch-Interface ersetzt.

Plan und Stand: [docs/stufenplan.md](docs/stufenplan.md)

## Spieldaten

Dieses Repository enthält **keine** Spieldaten. Nötig ist die deutsche GOG-Fassung
„Realms of Arkania 1 – Blade of Destiny Classic“ (Sprache Deutsch, `SCHICKM.EXE` mit MD5
`4ce035f95ead01a8b2553b4487544e5d`). Die englische Fassung funktioniert nicht.

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `BrightEyes/` | Untermodul: BrightEyes mit unseren Änderungen (Branch `brighteyes-web` dieses Repos) |
| `werkzeuge/` | Build-Image, Build-Skript, HTML-Seite (`shell.html`), Browser-Tests |
| `werkzeug.sh` | führt Befehle im Build-Container aus (auf dem Host ist kein Compiler nötig) |
| `compose.yaml`, `nginx.conf` | Auslieferung von `build/web` auf Port 8180 |
| `spieldaten/`, `spiel/` | GOG-Installer und entpackte Daten (nicht im Repo) |

## Einrichten

```sh
git clone --recurse-submodules forgejo:gero/mobile-eyes.git schick
cd schick

# GOG-Installer (deutsch) nach spieldaten/installer-de.exe legen, dann entpacken:
docker run --rm -v "$PWD/spieldaten":/d -w /d debian:13-slim bash -c \
  'apt-get update -qq && apt-get install -y -qq innoextract && innoextract -q -d gog-de installer-de.exe'
mkdir -p spiel && cp spieldaten/gog-de/app/{SCHICK.DAT,SCHICKM.EXE,DSAGEN.DAT,FONT.NVF,MOUSE.NVF,POPUP.NVF,SOUND.*,*.CHR,INTRODAT.*,*.ADV} spiel/
```

## Bauen und starten

```sh
# Web-Build mit eingebetteten Spieldaten (nur für Tests im LAN!)
./werkzeug.sh env SPIELDATEN=1 werkzeuge/web-bauen.sh

# Ausliefern auf http://<host>:8180
docker compose up -d

# Nativer Build zum Gegentesten
./werkzeug.sh bash -c 'cmake -S BrightEyes/src/schick -B build/nativ -DCMAKE_CXX_FLAGS="-include /app/werkzeuge/compat.h" && cmake --build build/nativ -j'
```

Alles prüfen (nativer Build, Test-Build mit Abkürzungen, Browser-Szenarien in der Handy-Ansicht;
Ergebnisse und Screenshots in `build/regression/`):

```sh
./pruefen.sh            # alles, ca. 3 Minuten
./pruefen.sh kampf      # nur Szenarien mit „kampf“ im Namen
SCHNELL=1 ./pruefen.sh  # ohne nativen Build
BROWSER=webkit ./pruefen.sh  # mit der Safari-Engine statt Chromium
```

Einzelner Ad-hoc-Browsertest (Screenshots nach `build/screens/`):

```sh
MOBIL=1 werkzeuge/test.sh '[{"tippAus":["Aktionen",252,69]},{"seite":"dialog"}]'
```

## Lizenz

Der Code von BrightEyes und die Änderungen daran stehen unter der GPL v3 (siehe `BrightEyes/copyright`);
die Dateien dieses Repos ebenso. Alle Rechte am Spiel, seinen Texten, Grafiken und Daten liegen bei den
jeweiligen Rechteinhabern.
