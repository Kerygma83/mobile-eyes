# Schicksalsklinge mobil – Stufenplan

Stand: 14.11.2026 · Basis: BrightEyes (Henne), Branch `web` in `BrightEyes/`, Build über `./werkzeug.sh`
Ziel: Die Schicksalsklinge als installierbare Web-App (PWA). Die Spiellogik bleibt aus BrightEyes, die Bedienung wird Bereich für Bereich durch ein mobiles Interface ersetzt.

## Stand heute

Läuft im Browser (Port 8180, nur LAN, mit eingebetteten GOG-Daten):
Tempel, Helden aufnehmen/tauschen, Charakterbogen, Laufen in Thorwal, Kampf (Computerkampf bis zum Ende), Reise mit Übernachtung, Touch-Steuerleiste.

Bisher behobene Fehler im nativen Port (je ein Commit im Branch `web`): Browser-Abgabe, Mausklick-Flags, Bildaktualisierung, Tastenreihenfolge, gesammeltes Zeichnen, `wait_for_vsync` mit Eingabeverarbeitung, Timer-Interrupt-Emulation, Kampf-Warteschleife, 16/32-Bit-Lesefehler bei der Reisekarte.

Bekannte offene Punkte: kein Ton, Original-Intro (`INTRO.EXE`) nicht nachgebaut. Behoben (14.11.): falsche Häuserfarben nach dem Tempel (Paletten nativ nicht zusammenhängend, seg066/seg075), Mauszeiger im mobilen Layout (ausgeblendet), Spielstände (Stufe 3). Kein Fehler: Reisemenü am Wegweiser erst nach Rechtsklick ist Originalverhalten (siehe Stufe 11).

## Überblick

Aufwand in Arbeitsstunden (gemeinsame Sitzungen mit Claude, grob geschätzt; Fehlersuche streut stark).

| Nr | Stufe | Lauffähiges Ergebnis | Aufwand |
| --- | --- | --- | --- |
| 0 | Projekt-Setup ✓ | Eigenes Repo, `./pruefen.sh` mit Browser-Regressionstests | 3–4 h |
| 1 | Stabilität | Bekannte Fehler behoben, Speicherfehler-Suche mit Prüf-Build | 6–10 h |
| 2 | Spielstart wie im Original | Intro, Hauptmenü „Neu/Laden“, Heldenerschaffung im Browser | 6–10 h |
| 3 | Dauerhafte Spielstände | Speichern überlebt Neuladen, Export/Import als Datei | 3–4 h |
| | **Meilenstein A: Durchspielbar im Browser** | Mehrstündige Testpartie ohne Hänger, Spielstände bleiben | |
| 4 | Spieldaten vom Nutzer | Daten-Import (Ordner oder ZIP), Prüfsumme, Ablage im Browser | 4–6 h |
| 5 | PWA | Installierbar, offline, Vollbild, Hoch-/Querformat | 3–4 h |
| 6 | Ton | Soundeffekte und CD-Musik (OGG aus der GOG-Fassung) | 6–10 h |
| | **Meilenstein B: Installierbare App ohne mitgelieferte Daten** | Auf echtem Android- und iOS-Gerät getestet | |
| 7 | Bugfixes übernehmen | Fehlerkorrekturen aus MeowMuhMuhCow/NRS als Schalter | 8–16 h |
| 8 | Mobiles UI I: Dialoge | Alle `GUI_*`-Dialoge als HTML (große Schrift, Touch) | 8–12 h |
| 9 | Mobiles UI II: Bewegung und Orte | Wischgesten, Ortsaktionen als Knöpfe statt Icon-Leiste | 8–12 h |
| 10 | Mobiles UI III: Helden und Inventar | Charakterbogen und Inventar als native Ansicht | 12–20 h |
| 11 | Mobiles UI IV: Reisen und Karte | Ziele antippen, Reiseereignisse als Dialoge | 6–10 h |
| 12 | Mobiles UI V: Kampf | Felder antippen, Aktionsleiste, Zoom | 12–20 h |
| | **Meilenstein C: Mobile Fassung** | Komplett im Hochformat spielbar | |
| 13 | Upstream und Pflege | Korrekturen an BrightEyes zurückgeben, Updates einpflegen | laufend |

Summe bis Meilenstein A: ca. 18–28 h · bis B: ca. 31–48 h · bis C: ca. 85–138 h.

Abhängigkeiten: 0 → 1 strikt (Tests zuerst). 2 und 3 nach 1, untereinander parallel. 4 braucht 3. 5 braucht 4. 6 unabhängig ab 1. 7 jederzeit ab 1. 8 vor 9–12 (gemeinsame Brücke C ↔ HTML). 9–12 untereinander frei.

### Vorschlag für die Reihenfolge der Sitzungen

| Sitzung | Inhalt | Dauer |
| --- | --- | --- |
| 1 | Stufe 0 komplett | 3–4 h |
| 2 | Stufe 1: bekannte Fehler, Prüf-Build | 3–4 h |
| 3 | Stufe 1: Testpartie, gefundene Hänger beheben | 3–4 h |
| 4 | Stufe 3 (Spielstände) + Beginn Stufe 2 (Hauptmenü, Intro) | 3–4 h |
| 5 | Stufe 2: Heldenerschaffung | 3–5 h |
| 6 | Stufe 4 + 5 (Daten-Import, PWA) → Meilenstein B ohne Ton | 4–6 h |
| 7–8 | Stufe 6 (Ton) | 6–10 h |
| ab 9 | Stufe 8 ff. (mobiles UI), Stufe 7 nach Bedarf dazwischen | |

## Definition of Done (gilt für jede Stufe)

- `./pruefen.sh` grün: nativer Build, Web-Build und Browser-Regressionstests (Handy-Ansicht).
- Jede Änderung an BrightEyes als eigener Commit im Branch `web` mit Begründung; Änderungen am Original-Verhalten nur nativ (`#if !defined(__BORLANDC__)`), damit der DOS-Build unverändert bleibt.
- Neue Fehlerklasse gefunden → im ganzen Code nach demselben Muster gesucht (wie bei `int`-Zeigern und Timer-Warteschleifen).
- Kein Build mit Spieldaten verlässt das LAN.

---

## Stufe 0 – Projekt-Setup

**Ziel:** Änderungen lassen sich jederzeit automatisch gegen Rückschritte prüfen.

**Umfang:**
- `/opt/stacks/schick` als Git-Repo (Werkzeuge, Shell, Compose, Doku); `BrightEyes/` als Submodul auf den eigenen Branch `web` (Fork oder lokales Remote).
- Test-Auslöser (Kampf starten, an Wegweiser setzen, Zeit vorspulen) als fester Bestandteil, nur im Test-Build (`TESTHOOKS=1`) übersetzt.
- Browser-Regressionstests aus den bisherigen Abläufen: Start, Helden aufnehmen, Tausch, Charakterbogen, Stadt laufen, Kampf bis Ende, Reisekarte, Reise mit Übernachtung.
- `./pruefen.sh`: nativer Build, Web-Build, Tests; Auswertung „Seite blockiert“ und `pageerror` als Fehlschlag.
- `README.md` und `CLAUDE.md` (Build, Testen, Regeln).

**Abnahmekriterien:**
- Frischer Clone + GOG-Installer in `spieldaten/` → `./pruefen.sh` läuft grün ohne weitere Handgriffe.
- Ein absichtlich wieder eingebauter Fehler (z. B. Kampf-Warteschleife ohne `wait_for_vsync`) lässt die Tests scheitern.

**Risiken:** Tests mit festen Klickkoordinaten sind empfindlich → Hilfsfunktionen, die auf Spielzustände warten (z. B. „Ort = Stadt“), statt fester Pausen.

**Umsetzungsnotizen (14.11.2026):**
- Repo `forgejo:gero/mobile-eyes`: `main` = Projekt, `brighteyes-web` = BrightEyes-Fork mit Hennes Historie; Untermodul mit relativer URL `../mobile-eyes.git`.
- Test-Auslöser fest unter `WEB_TESTHOOKS`: `web_test_fight`, `web_test_sign`, `web_test_state` (JSON mit Ort, Position, Richtung, Helden, Kampf, Dialog, Menü, Karte). Test-Build nach `build/web-test`, getrennt vom ausgelieferten `build/web`.
- 7 Szenarien (`werkzeuge/szenarien.mjs`), Laufzeit ca. 2 Minuten, alle über das mobile Layout. Gegenprobe: Kampf-Warteschleife ohne `wait_for_vsync` → „Seite blockiert“, Exit-Code 1.
- Erkenntnisse: Das Kampfmenü steht je nach Held an anderer Stelle (`g_basepos_x`), Eintrag „Computerkampf“ ist immer Nr. 11 → per Tastatur wählen. Der Charakterbogen schließt nur über sein Menü (Rechtsklick → „Zurück“), Esc wirkt dort nicht.
- Build-Skript: Objektdatei wird vor dem Übersetzen gelöscht (vorher blieb bei Compilerfehlern still der alte Stand liegen); Wechsel der Schalter erzwingt Neuübersetzung.

## Stufe 1 – Stabilität

**Ziel:** Keine Hänger und Abstürze in normaler Spielweise.

**Umfang:**
- Bekannte Fehler: Häuserfarben nach dem Tempel, Mauszeiger-Rest, Reisemenü erst nach Rechtsklick.
- Prüf-Build mit `-sASSERTIONS=2 -sSAFE_HEAP=1` (Web) bzw. AddressSanitizer (nativ), um versteckte Speicherfehler wie den der Reisekarte zu finden.
- Systematische Suche nach weiteren Mustern: Schleifen, die auf vom Interrupt gesetzte Variablen warten; Strukturen und Dateiformate mit `int`/`long` statt fester Breite; `sizeof`-Annahmen bei Spielständen.
- Testpartie: Thorwal → Reise → Dungeon (z. B. Totenschiff) mit Kampf, Zauber, Händler, Tempel, Heiler.

**Abnahmekriterien:** Prüf-Build meldet in allen Regressionstests keinen Speicherfehler; Testpartie von mindestens 2 Stunden ohne Hänger.

**Risiken:** Fehler, die auch im DOS-Original stecken (dort still, nativ Absturz) → mit der Bugfix-Liste von MeowMuhMuhCow abgleichen.

## Stufe 2 – Spielstart wie im Original

**Ziel:** Neues Spiel beginnen statt „Playground“-Start im Tempel.

**Umfang:**
- Nativen Start auf den Original-Ablauf umstellen: Intro (`INTRO.EXE`-Teil, ggf. überspringbar), Spielmodus Anfänger/Fortgeschritten, „Neues Spiel / Laden“. Die Kopierschutzabfrage bleibt aus.
- Heldenerschaffung: `src/gen` (natives SDL-Programm von BrightEyes) ebenfalls mit Emscripten übersetzen; als zweite Seite oder als Modus derselben App. Erzeugte `.CHR` landen im selben Browser-Speicher.

**Abnahmekriterien:** Neue Gruppe erschaffen, im Tempel aufnehmen, losspielen – alles im Browser.

**Risiken:** Der Generator ist ein eigenes Programm mit eigenem Zustand → zwei WASM-Module mit gemeinsamem Dateisystem (IndexedDB) statt Zusammenführung.

**Stand (14.11.):**
- Start wie `SCHICK.BAT`: Intro, Schwierigkeitsgrad, „Hauptprogramm / Generierung“, Spielstand laden oder „Keinen“. Kopierschutz aus.
- Das animierte Original-Intro (`INTRO.EXE`, `INTRODAT.*`) hat BrightEyes nicht nachgebaut. Gezeigt wird das Logo-Intro der Heldenerschaffung (Attic, Fanpro, Titel), überspringbar. Das echte Intro bleibt eine eigene Aufgabe (Format entschlüsseln).
- Heldenerschaffung: ngen als `gen.html` (zweites WASM-Modul) in einem iframe. Das Spiel wartet darauf wie auf `spawnl`. Neue CHR-Dateien kommen über IndexedDB `/spielstand` ins Spiel- und TEMP-Verzeichnis.
- ngen-Korrekturen: Abgabe an den Browser (Namenseingabe fror sonst ein), Tastenreihenfolge (aus „TEST“ wurde „ETS“), Formatfrage im Web fest auf CD.
- Overlays (`werkzeuge/dialog.js`, gemeinsam mit dem Spiel) für Menüs, Meldungen, Ja/Nein und Namenseingabe. Knopf „Menü“ ersetzt den Rechtsklick.
- Szenarien: Start mit Intro; Heldenerschaffung bis zum neuen Helden im Tempel, auch nach dem Neuladen.
- Offen: Tippen auf die Bildelemente der Erschaffung (Seitenpfeile, Geschlecht, Porträtwahl) auf dem Handy prüfen; die Erschaffungsseite ist im Hochformat klein.

## Stufe 3 – Dauerhafte Spielstände

**Ziel:** Gespeichertes bleibt erhalten.

**Umfang:** `GAMES.NAM`, `*.GAM`, `*.CHR` in einem dauerhaften Verzeichnis (IDBFS oder OPFS); Abgleich nach jedem Speichern; `navigator.storage.persist()`; Export/Import aller Spielstände als ZIP (Schutz vor Löschung durch den Browser, Übertragung PC ↔ Handy).

**Abnahmekriterien:** Speichern, Seite neu laden, Laden → gleicher Stand. Export auf dem PC, Import auf dem Handy funktioniert.

**Stand (14.11.):** Speichern und Laden waren in BrightEyes nur für DOS umgesetzt, nativ taten beide nichts. Jetzt gibt es eigene native Zweige in seg026. Der Spielzustand wird über eine aus `datseg.cpp` erzeugte Tabelle (`datseg_status.h`, 585 Variablen) in den DOS-Block gebracht, der Compiler prüft jede Größe. Spielstände überstehen das Neuladen (IDBFS) und lassen sich über „Spielstände“ exportieren und importieren. Szenario: speichern, neu laden, laden, exportieren, importieren. Offen: Spielstand aus der DOS-Fassung testweise laden (Format sollte passen, ungeprüft).

## Stufe 4 – Spieldaten vom Nutzer

**Ziel:** Die App enthält keine Spieldaten mehr.

**Umfang:** Erster Start: Assistent „Spieldaten auswählen“ (GOG-Ordner per Ordnerauswahl oder ZIP); Prüfung von `SCHICKM.EXE` (MD5 `4ce035f9…`, deutsche Fassung 3.02) mit verständlicher Meldung bei englischer Fassung; Ablage der benötigten Dateien (~6,5 MB) im Browser-Speicher. Option für später: GOG-Installer direkt einlesen (innoextract als WASM).

**Abnahmekriterien:** Build ohne `SPIELDATEN=1` startet, fragt nach den Daten, läuft danach offline.

**Risiken:** Ordnerauswahl auf iOS eingeschränkt → ZIP-Upload als Weg, der überall geht.

## Stufe 5 – PWA

**Ziel:** Installierbar wie eine App.

**Umfang:** Manifest, Icons, Service Worker (App-Shell offline, Updates sichtbar), Vollbild/Standalone, Bildschirmausrichtung, Wake-Lock während des Spiels; Hosting-Variante ohne Spieldaten im Image.

**Abnahmekriterien:** Auf Android und iOS installiert, offline startbar; Update der App ohne Verlust der Spielstände.

## Stufe 6 – Ton

**Ziel:** Soundeffekte und Musik.

**Umfang:** Soundeffekte (`play_voc` ist nativ leer): VOC aus `SCHICK.DAT` über SDL-Audio abspielen. Musik: CD-Tracks der GOG-Fassung (`MUSIC/Track02–…ogg`) per Web Audio statt MIDI; CD-Funktionen (`CD_*`) darauf abbilden. Lautstärke/Aus in den Einstellungen der App. Audio erst nach erster Berührung starten (Browser-Vorgabe).

**Abnahmekriterien:** Musik wechselt wie im Original (Stadt, Kampf, Reise); Effekte bei Klicks und Treffern.

**Risiken:** OGG-Dateien sind ~120 MB → nur auf Wunsch importieren, Spiel läuft auch ohne.

## Stufe 7 – Bugfixes übernehmen

**Ziel:** Die Fehlerkorrekturen der Community auch in der Web-Fassung.

**Umfang:** Die Liste aus MeowMuhMuhCow (`BUGFIXES.md`, 284 Einträge, teils aus NRS-Patch) durchgehen; Korrekturen, die die Spiellogik betreffen, als Schalter übertragen („wichtig“/„alle“ wie dort). Speicherformat bleibt kompatibel.

**Abnahmekriterien:** Ausgewählte Korrekturen laut „So prüfst du es“ der Liste nachgeprüft.

**Risiken:** Beide Projekte stammen von Bright-Eyes ab, sind aber unterschiedlich weit umbenannt → Übertragung von Hand, Eintrag für Eintrag.

## Stufe 8 – Mobiles UI I: Dialoge

**Ziel:** Alle Text- und Auswahlfenster als gut lesbare HTML-Dialoge.

**Umfang:** Brücke C ↔ JavaScript (`EM_ASYNC_JS`): `GUI_output`, `GUI_radio`, `GUI_bool`, `GUI_input`, `GUI_dialogbox` (mit Porträt) zeigen HTML statt 320×200-Fenster; Text aus dem Spiel, Umlaute/Zeichensatz umsetzen. Schalter „Original-Dialoge“ zum Vergleich.

**Abnahmekriterien:** Alle Dialoge der Regressionstests erscheinen als HTML; Zurück schließt; Spiellogik unverändert.

**Stand (14.11.):** Grundlage fertig. `GUI_input`, `GUI_radio`/`GUI_bool` und `GUI_dialogbox` melden sich per `EM_JS` an die Seite, das Overlay zeigt Text, Optionen, Eingabefeld und Porträt. Die Box des Spiels wird verdeckt, indem die Ansicht auf dem Bild davor stehen bleibt. Das Spiel bleibt für Ablauf und Ergebnis zuständig. Offen: Testszenario für Eingaben (Geldbetrag, Spielstandname), lange Menüs (Kampf: 13 Einträge) ohne Scrollen.

**Merkposten Groß-/Kleinschreibung und Schriftart:** Die Spieltexte liegen im Original nur in Großbuchstaben vor, die Spielschrift hat keine Kleinbuchstaben. Im Overlay ist das lange Fließtext in Versalien (derzeit Georgia). Mögliche Wege:
- Wörterbuch für die deutsche Großschreibung (Substantive), alles andere klein, Satzanfänge groß. Das Wörterbuch aus den Spieltexten selbst aufbauen und die Sonderfälle von Hand pflegen, etwa Eigennamen, Anreden und Abkürzungen wie „GGST.“.
- Schriftart, die Versalien gut lesbar macht: Kapitälchen-Schnitt oder eine zum Spiel passende, frei lizenzierte Fantasy-/Buchschrift (Google Fonts). Alternativ die Originalschrift des Spiels (`FONT6` aus den Spieldaten) vergrößert.
- Als Einstellung anbieten (Original-Versalien / normale Schreibung / Schriftart).

## Stufe 9 – Mobiles UI II: Bewegung und Orte

**Umfang:** Wischen (vor/zurück/drehen) auf der 3D-Ansicht; die Icon-Leiste rechts wird zu beschrifteten Knöpfen aus den Aktionstabellen des Spiels (je nach Ort: Tempel, Händler, Taverne …); Hochformat-Layout: Ansicht oben, Gruppe und Aktionen darunter.

## Stufe 10 – Mobiles UI III: Helden und Inventar

**Umfang:** Charakterbogen, Talente, Zauber und Inventar als native Ansicht, die direkt aus den Heldendaten liest (`hero.h`); Gegenstände per Antippen/Ziehen bewegen, über die vorhandenen Spielfunktionen.

**Risiken:** Inventarfunktionen sind eng mit der Darstellung verwoben → Aktionen über die bestehenden Funktionen auslösen, nicht nachbauen.

## Stufe 11 – Mobiles UI IV: Reisen und Karte

**Umfang:** Reisekarte zoom- und verschiebbar, Ziele antippen statt Rechtsklick-Menü (im Original zeigt der Wegweiser erst die Karte, das Zielmenü öffnet erst ein Rechtsklick; bis dahin: Knopf „Zurück“); Reiseereignisse über die Dialoge aus Stufe 8.

## Stufe 12 – Mobiles UI V: Kampf

**Umfang:** Kampffeld mit Zoom, Felder antippen für Bewegen/Angriff, Aktionsleiste statt Menü, Trefferanzeige gut sichtbar.

## Stufe 13 – Upstream und Pflege

**Umfang:** Fehler, die auch die Desktop-Fassung betreffen (Tastenreihenfolge, Timer, Reisekarte, Bildaktualisierung …), Henne als Pull Requests anbieten; neue BrightEyes-Stände in den Branch `web` übernehmen.

---

## Offene Fragen

- **Zielgeräte:** Nur Android, oder auch iOS? (beeinflusst Stufe 4 und 5)
- **Veröffentlichung:** Nur privat im LAN, oder öffentlich (Code unter GPL, Spieldaten bringt jeder selbst)? Markenrechte „Das Schwarze Auge“ prüfen.
- **Originaltreue vs. Komfort:** z. B. 0,2 s Doppelklick-Wartezeit nach jedem Klick, Kopierschutzabfrage, Anfängermodus. Als Einstellungen anbieten?
- **Bugfixes:** Alle übernehmen oder nur „wichtige“ (Stufe 7)?
- **Upstream:** Sollen die Korrekturen an Henne gehen (Stufe 13), und unter welchem Namen?
