# Mobile Eyes – Hinweise für Claude

Die Schicksalsklinge (DSA 1) als Web-App. Spiellogik aus BrightEyes (`BrightEyes/`, Untermodul), übersetzt mit Emscripten; mobile Oberfläche in `werkzeuge/shell.html`. Plan: `docs/stufenplan.md`.

## Regeln

- **Spieldaten nie einchecken oder ausliefern.** `spieldaten/`, `spiel/`, `build/` sind ignoriert. Builds mit `SPIELDATEN=1` nur im LAN (Port 8180).
- Auf dem Host gibt es keinen Compiler: alles über `./werkzeug.sh …` (Image `schick-werkzeug`, emsdk + g++/SDL2). Browser-Tests im Playwright-Image über `werkzeuge/test.sh`.
- Änderungen an BrightEyes im Untermodul, Branch `web` (Remote-Branch `brighteyes-web`), je Korrektur ein Commit mit Begründung. Upstream-Remote heißt `henne`.
- Abweichungen vom DOS-Original nur nativ: `#if !defined(__BORLANDC__)`; der Borland-Build muss unverändert bleiben. Web-Spezifisches unter `#if defined(__EMSCRIPTEN__)`.
- Neue Fehlerklasse gefunden → im ganzen Code nach demselben Muster suchen.
- Vor jedem Commit `./pruefen.sh` (nativer Build, Test-Build, Browser-Szenarien in `werkzeuge/szenarien.mjs`). Neue Fehler → neues Szenario.
- Test-Auslöser nur unter `#if defined(WEB_TESTHOOKS)` (Build mit `TESTHOOKS=1` → `build/web-test`, wird nie ausgeliefert). Vorhanden: `web_test_fight(id)`, `web_test_sign(typeindex)`, `web_test_input(stellen)`, `web_test_no_city_events(an)`, `web_test_talk(art, tlk, partner)` (1 Informant, 2 Händler/Zufall), `web_test_dungeon(id)`, `web_test_state()` (JSON). Hooks laufen in `game_loop()`, also nicht im Tempel.
- `BROWSER=webkit ./pruefen.sh …` testet mit der Safari-Engine (Desktop-WebKit, bildet iOS nur teilweise nach).
- Szenarien warten auf Spielzustände (`warteAuf`), nicht auf feste Zeiten; Textboxen und Menüs über das Overlay bedienen (`wahl`, `weiter`, `eingabe`, `abbrechen`).

## Typische Fehler im nativen Port

- **Warteschleifen auf Interrupt-Variablen:** Das Original ließ Maus (`mouse_isr`) und Timer (`timer_isr`, 18,2 Hz) per Interrupt laufen. Nativ werden beide in `sdl_event_loop()` nachgebildet (`sdl_timer_emulation`, `sdl_wait_vsync`). Schleifen ohne Eingabeabfrage hängen → `wait_for_vsync()` einbauen (oft als „SPEEDFIX“ auskommentiert).
- **16 vs. 32 Bit:** `int` war 16 Bit. Zeigerzugriffe wie `*(signed int*)` auf Spieldaten lesen nativ zu viel.
- **Unsichtbare Meldungen:** `GUI_output` wartet auf Eingabe; Fehlermeldungen beim Start blockieren sonst den ersten Klick.
- **Browser blockiert:** Jede Schleife muss irgendwann `sdl_event_loop()` erreichen (dort gibt `web_yield` an den Browser ab).

## Nützlich

- Start (Web): `main` in seg002 läuft wie im Original (Intro über `web_intro`, Startmenü, `call_gen` → `web_gen`). Die Heldenerschaffung ist ngen (`BrightEyes/src/gen`) als `gen.html` im iframe (`gen-shell.html`, `gen-pre.js`). Tests starten mit `?ohneIntro`; Schritte mit `imGen: true` gelten dem iframe.
- Overlays: `werkzeuge/dialog.js` (`textboxOverlay`) für Spiel und Heldenerschaffung; die Programme melden Boxen per `Module.dialogAuf/dialogZu`.
- Ton: `werkzeuge/ton.js`. Effekte: `play_voc` (seg002) gibt die VOC-Datei an `Module.tonEffekt`. Musik: `CD_set_track`/`CD_audio_pause`/`CD_audio_play` (seg001) spielen `musik/TrackNN.m4a`, die nicht in `index.data` liegt. Ton gibt es erst nach der ersten Berührung.
- Spielende: alle `exit()` laufen im Browser über `__wrap_exit` (seg002, Linker `--wrap=exit`) → `Module.spielEnde` (Hinweis mit Neustart); `main()` ruft am Ende im Browser `exit(0)`.
- PWA: `werkzeuge/pwa/` (Manifest, Icons, `sw.js`-Vorlage). `web-bauen.sh` setzt Version (Prüfsumme) und Dateiliste ein. Service Worker und Wake-Lock nur über HTTPS oder localhost.
- Spielstände: `save/load_game_state` in seg026 sind nativ eigene Zweige (`*_native`). Der Spielzustand wird über `datseg_status.h` in das DOS-Format (ds:0x2d34–0x4474) gebracht. Nach Änderungen an `datseg.cpp` `python3 werkzeuge/status-tabelle.py` ausführen; der Compiler prüft jede Größe gegen DOS. Im Browser liegen `*.GAM`/`GAMES.NAM` zusätzlich in IDBFS `/spielstand` (`pre.js`).

- Bildbereiche des Hauptbildschirms (320×200): Ansicht 0–239/0–135, Icons 241–318/57–134, Ortszeile y 136–156 (im mobilen Layout ab 139: 136–138 sind ein Übergangsstreifen), Porträts y 157–199 (`g_action_table_playmask` in `datseg.cpp`).
- Schnittstellen Seite ↔ Spiel: `web_key`, `web_right_click`, `web_click`, `web_screen_mode`, `web_menu_select`, `Module.onFrame`.
- Textboxen (`GUI_input`, `GUI_radio`, `GUI_dialogbox` in seg097) melden sich per `Module.dialogAuf/dialogZu` an die Seite (Overlay); das Spiel bleibt für Ablauf und Ergebnis zuständig. Texte sind Großbuchstaben im DOS-Zeichensatz (Ä 0x8e, Ö 0x99, Ü 0x9a, ß 0xe1; `@` Umbruch, `~` Tabulator, 0xf0–f3 Farbe).
- Schreibung im Overlay: `werkzeuge/schreibung.js` wandelt die Großbuchstaben-Texte beim Anzeigen in normale Schreibung (Satzanfänge, Nomen, Namen, ß; mehrdeutige Wörter nach Kontext). Wörterbuch `schreibung.json` erzeugt `werkzeuge/schreibung.py` (hunspell de_DE im Werkzeug-Image) beim Build mit `SPIELDATEN=1` – aus den Spieldaten abgeleitet, also nie einchecken. Fehlschreibungen: `werkzeuge/schreibung-korrektur.txt` ergänzen; `schreibung.py --bericht datei` listet unbekannte/mehrdeutige Wörter mit Kontext; Regeltest `werkzeuge/schreibung-test.cjs`. Einstellungen (Zahnrad in der Leiste, `#einstellungen` in `shell.html`): Schreibung (`localStorage.schreibung`), Schriftgröße der Textboxen (`schriftgroesse`, Faktor → CSS `--schrift`), Layout, Spielstände, Vollbild nur im Browser-Tab; Szenarien laufen mit Originalschreibung außer mit `schreibung: true`. Canvas-Texte bleiben groß (die Spielschrift hat keine Kleinbuchstaben).
- Fehlersuche: `PROFIL=1` beim Build behält Funktionsnamen (Stacktraces, CPU-Profile mit `werkzeuge/profil-auswerten.mjs`).
