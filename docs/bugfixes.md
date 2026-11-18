# Bugfixes aus dem Decomp-Projekt (Tracking)

Quelle: [MeowMuhMuhCow/schicksalsklinge, BUGFIXES.md](https://github.com/MeowMuhMuhCow/schicksalsklinge/blob/main/BUGFIXES.md), Version 1.5d vom 12.11.2026, übernommen am 18.11.2026 (ohne Changelog und Prüfanleitungen). Die Nummern sind die des Projekts (Schalter `FIX_nnnn` in dessen `s_fix.h`); Beschreibung und „So prüfst du es“ stehen dort. Laut Projekt sind die Behebungen am Quelltext entworfen, aber im Spiel noch nicht ausgiebig getestet.

Übernahme bei uns (Stufe 7 im [Stufenplan](stufenplan.md)): je Korrektur ein Commit im BrightEyes-Branch `web`, nur nativ (`#if !defined(__BORLANDC__)`), mit Szenario, wo es sich auslösen lässt; Status hier nachtragen.

**Spalten:** Stufe W = „wichtig“, A = nur „alles“ · Schwere laut `s_fix.h` (kritisch: Hänger, Absturz, Speicherfehler) · 💰 Exploit (nützt dem Spieler) · Herkunft: BE = Fehler war in Bright-Eyes bekannt, BE-Fix = auch die Behebung stammt aus Bright-Eyes (bei uns ist `M302de_ORIGINAL_BUGFIX` nativ gesetzt, also vermutlich schon aktiv) · ⚑ = zuerst angehen.

**Umfang:** 284 Einträge – 25 kritisch, 120 mittel, 139 gering; 38 Exploits; 32 mit Behebung aus Bright-Eyes; 15 dort nur teilweise behoben.

**Hinweis 16/32 Bit:** Einige Fehler sind Überläufe von 16-Bit-`int` (z. B. 117, 137, 296). Nativ ist `int` 32 Bit, Spielstandvariablen aber oft fest 16 Bit – solche Einträge vor der Übernahme nachstellen, sie können bei uns anders oder gar nicht auftreten.


## Kampf (30)

| Nr | Fehler | Stufe | Schwere | Herkunft | Status |
|---:|---|:---:|---|---|---|
| 7 | ⚑ Heldenzug ohne verbliebene Heldenphasen: Endlosschleife möglich | W | krit. | BE | offen |
| 15 | ⚑ Bei genau 30 Beutestücken schreibt „MEHR“ über einen nicht gesetzten Zeiger | W | krit. |  | offen |
| 22 | ⚑ Übergelaufener Priester (Stufe 2) hängt das Spiel auf | W | krit. |  | offen |
| 25 | ⚑ Fliehender Doppelgegner: Wegsuche hängt | W | krit. | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 30 | ⚑ Angstgift: Schreiben über nicht gesetzten Zeiger bei Held gegen Held | W | krit. |  | offen |
| 11 | Zauberziel: begehbare Objekte (Id ≥ 50) werden nicht abgewiesen | W | mittel |  | offen |
| 18 | Computerkampf: Helden greifen auch übergelaufene Gegner an | W | mittel |  | offen |
| 34 | Wurfwaffe wird vor der Schadensberechnung abgelegt 💰 | W | mittel | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 36 | Gegner-Balsam heilt über das Maximum oder gar nicht | W | mittel | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 38 | Endkampf: ohne Grimring kämpft Heldenplatz 0 | W | mittel |  | offen |
| 313 | Lagerüberfall: nur Heldenplatz 0 ist wach, eingeteilte Wachen zählen nicht | W | mittel |  | offen |
| 316 | Zerbrochene Waffe bleibt in der Hand, Computerkampf wechselt nicht | W | mittel |  | offen |
| 319 | Computerkampf zaubert auch mit Zauberwert unter −5 | W | mittel |  | offen |
| 322 | Alte Nahkampfoption ohne Nachbarschaftsprüfung („Schattenboxen“) 💰 | W | mittel |  | offen |
| 8 | Schwanzteil eines durch eigenen Patzer getöteten Doppelgegners bleibt stehen | A | gering | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 9 | Abfrage g_max_enemies != 0 nach dem Sieg ist nie wahr | A | gering |  | offen |
| 12 | Flucht über den oberen und unteren Rand kostet ein BP mehr | A | gering |  | offen |
| 13 | Fluchtfeld wird mit dem Inhalt einer früheren Cursorposition geprüft | A | gering |  | offen |
| 14 | Verschachtelte ifs: tote Figur auf dem Zielfeld überspringt die Weg- und BP-Prüfung | A | gering | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 16 | Knochen mit Rune beendet die Beuteliste | A | gering | BE | offen |
| 17 | Meldung „ZIEL IST NICHT MEHR IN GÜLTIGER SCHUSSPOSITION“ kann doppelt kommen | A | gering |  | offen |
| 19 | Fluchtfelder (negative Ids) werden als Held gelesen | A | gering | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 20 | Umzingelt-Prüfung mit Grenze 25 statt 23 | A | gering |  | offen |
| 24 | best_viewdir möglicherweise uninitialisiert | A | gering | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 27 | Schwanzteile toter Doppelgegner sind nicht begehbar | A | gering | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 28 | Grenzprüfung: new_y > 23 doppelt, new_x > 23 fehlt | A | gering | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 31 | Held gegen Held: Werte des Verteidigers falsch berechnet | A | gering | BE | offen |
| 32 | Paradepatzer setzt backfire_1 statt backfire_2 | A | gering | BE | offen |
| 312 | Gefesselte Gegner bleiben in der Kampfliste und kämpfen beim nächsten Betreten erneut 💰 | A | gering |  | offen |
| 327 | Piratenangriff: Ergebnis von do_fight() wird nicht ausgewertet 💰 (dort teilweise) | A | gering |  | offen |

## Magie (28)

| Nr | Fehler | Stufe | Schwere | Herkunft | Status |
|---:|---|:---:|---|---|---|
| 196 | ⚑ Skelettarius belegt bei jedem Wirken 1288 Byte neu im Kampfobjektpuffer | W | krit. | BE | offen |
| 186 | Visibili wirkt nur auf den Zaubernden, der Kampf entfällt nur bei einem Einzelhelden | W | mittel | BE | offen |
| 189 | Stabzauber: Abfrage „keine Stabzauber mehr“ auf Stufe 7 statt 4 | W | mittel | BE | offen |
| 190 | Stabzauber-Probe prüft die zweite Eigenschaft doppelt | W | mittel | BE | offen |
| 191 | Foramen aus dem Zaubermenü ignoriert den Türzuschlag 💰 | W | mittel | BE | offen |
| 192 | Gardianum kostet AE und schützt nicht | W | mittel | BE | offen |
| 197 | Foramen aus dem Zaubermenü wirkt nur nach geöffnetem Türmenü | W | mittel | BE | offen |
| 199 | Hexenspeichel: AE-Prüfung greift nie 💰 | W | mittel |  | offen |
| 207 | Armatrutz: ein RS-Punkt mehr, als AE vorhanden 💰 | W | mittel | BE | offen |
| 211 | g_ignite_mode wird nach dem Anzünden nicht zurückgesetzt | W | mittel | BE | offen |
| 212 | Tollwut: Sanftmut ohne Prüfung des Zauberwerts (dort teilweise) | W | mittel | BE | offen |
| 213 | Feuerbann wird gesetzt, aber nirgends ausgewertet | W | mittel | BE | offen |
| 382 | Große Gier ist nicht umgesetzt | W | mittel |  | offen |
| 383 | Transversalis auf der Landreise kostet AE ohne Wirkung | W | mittel |  | offen |
| 385 | Curian zaubert im Kampf nur im Computerkampf mit Magie | W | mittel |  | offen |
| 187 | Transversalis-Kreuz darf eine Zeile unter die Karte | A | gering |  | offen |
| 188 | Meditation bei LE 6 oder 7 kostet LE und bringt keine AE | A | gering |  | offen |
| 193 | Spieltext „AUF %S RUHT …“ mit großem S | A | gering | BE | offen |
| 195 | Skelettarius: Leiche darunter verschwindet aus der Auswahl | A | gering | BE | offen |
| 200 | Abbruch der Gegenstandswahl: inventory[−1] | A | gering | BE | offen |
| 201 | Analüs: volle AE-Kosten, wenn nur der Zuschlag die Probe kippt | A | gering | BE | offen |
| 202 | „Eigenschaften seid gelesen“ zeigt 80 % des Nahkampfschadens | A | gering | BE | offen |
| 203 | Exposami vergleicht mit einem noch leeren Listeneintrag | A | gering |  | offen |
| 205 | Eisenrost auf ein Tier kostet volle AE | A | gering |  | offen |
| 206 | Spieltext „VERWANDLET“ | A | gering | BE | offen |
| 208 | Paralue auf einen Helden prüft das alte Zauberziel | A | gering | BE | offen |
| 210 | Brenne entzündet immer die erste Fackel oder Laterne | A | gering | BE | offen |
| 386 | Analüs erkennt nur 28 Gegenstände, Grimring nicht (dort teilweise) | A | gering |  | offen |

## Reise & Ereignisse (48)

| Nr | Fehler | Stufe | Schwere | Herkunft | Status |
|---:|---|:---:|---|---|---|
| 137 | ⚑ Schiffstempo in 16 Bit, Schnellsegler mit −106: Tempo 0 bringt das Spiel zum Absturz | W | krit. | BE | offen |
| 164 | ⚑ Waten durch den Bach mit uninitialisiertem Helden | W | krit. | BE | offen |
| 174 | ⚑ Zustand 33 ist eine Endlosschleife | W | krit. |  | offen |
| 180 | ⚑ Krakenmolch: Endlosschleife, wenn alle Helden über Bord oder tot sind | W | krit. | BE | offen |
| 184 | ⚑ Verirrt im Wald: alle sieben Heldenplätze sterben | W | krit. | BE | offen |
| 127 | Nur die erste Seeroute (Thorwal–Prem) wird zurückgesetzt | W | mittel | BE | offen |
| 136 | Passagepreis in 16 Bit: lange Routen werden spottbillig 💰 | W | mittel |  | offen |
| 142 | Reiseereignisse: Lage wird nach Richtungswechsel falsch korrigiert 💰 | W | mittel | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 149 | replenish_stocks() bekommt die Heldenposition als Versuchszähler | W | mittel | BE | offen |
| 150 | „UMKEHREN“ auf der Rückreise behält die Rückwärtsrichtung (9 Stellen) | W | mittel | BE | offen |
| 151 | Furt: GE-Probe gilt fast immer als bestanden | W | mittel | BE | offen |
| 152 | Fährpreis wächst bei jedem Versuch weiter | W | mittel | BE | offen |
| 153 | Gruppenproben zählen alle 7 Plätze ohne Gruppen- und Todesprüfung | W | mittel | BE | offen |
| 158 | Steilhang: Strickleiter macht den Sturz schlimmer | W | mittel | BE | offen |
| 159 | Gorahs Hütte: Silentium-Auswahl wird nie wiederholt 💰 | W | mittel |  | offen |
| 161 | Kräuterbonus für Gegenstände über 127 greift nie | W | mittel |  | offen |
| 162 | Wegzoll 15 Dukaten insgesamt statt pro Person 💰 | W | mittel |  | offen |
| 165 | Sturz in die Klamm: hero_disappear() mit der Antwortzahl als Position | W | mittel |  | offen |
| 166 | Harpyien: Fluchtoption ist kein Versuch 💰 | W | mittel | BE | offen |
| 167 | Nebeltal: Funktionsadresse als Held | W | mittel | BE | offen |
| 170 | Firun-Opfer: Schlafbonus bleibt für spätere Lager stehen 💰 | W | mittel |  | offen |
| 177 | AT- und PA-Proben verkehrt herum (Höhlenbär, Krakenmolch) | W | mittel | BE | offen |
| 178 | Kvillotter beißt nie | W | mittel | BE | offen |
| 179 | Krakenmolch: GE-Probe falsch ausgewertet | W | mittel | BE | offen |
| 181 | Zufallsbegegnungen: Vergleich verkehrt herum, fast alle unerreichbar | W | mittel |  | offen |
| 185 | Kletterpartie: tödlicher Sturz bei knapp verfehlter Probe statt beim Patzer | W | mittel | BE | offen |
| 367 | Weiterreisen ohne Nachtlager über unsichtbares Symbol 💰 | W | mittel |  | offen |
| 368 | Tavernenhinweis schaltet Reiseereignisse 66 und 75 ab | W | mittel |  | offen |
| 372 | Seereise: jeder Umweg-Wert führt ins Totenschiff 💰 | W | mittel |  | offen |
| 128 | Sprung bis Mitternacht (Swafnild) überspringt feste Ereignisse und verbraucht 25 Stunden Licht | A | gering | BE | offen |
| 129 | Wachenwahl: ESC liest g_wildcamp_herbstatus[−1] | A | gering | BE | offen |
| 130 | Bei weniger als 3 Stunden Schlaf wechseln die Wachen nie | A | gering |  | offen |
| 132 | Hafenmeister schimpft auch beim Verlassen über fehlendes Geld | A | gering |  | offen |
| 133 | Hunger-/Durst-Meldungssperre des NSC wird nicht zurückgesetzt | A | gering |  | offen |
| 135 | Schiffsnamen werden bei jedem Blick neu ausgewürfelt | A | gering | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 138 | Angezeigte Reisedauer nur in groben Stufen | A | gering | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 145 | Umweg-Linie wird um einen Punkt versetzt zurückgemalt | A | gering |  | offen |
| 148 | Rastplatz: Status nur für den Anführer gelöscht | A | gering | BE | offen |
| 156 | „AM UFER DES DES BODIR“ | A | gering |  | offen |
| 160 | Hütte bei Orvil: Frage passt nicht zu den Antworten | A | gering |  | offen |
| 163 | Tatzelwurm-Spuren: Name aus einem Nullzeiger | A | gering |  | offen |
| 168 | Dialogbild fehlt nach einem Lagerkampf | A | gering | BE | offen |
| 171 | Olimone: get_hero(−1), wenn niemand das Rezept nehmen konnte | A | gering | BE | offen |
| 182 | Krankheitsprobe mit uninitialisiertem Helden | A | gering | BE | offen |
| 183 | Waldweg: Erfolgstext beim ersten Versuch unerreichbar | A | gering |  | offen |
| 369 | Nach Gorah dreht sich die Reiserichtung immer um | A | gering |  | offen |
| 371 | Grenz- und Straßentexte ohne Richtungsprüfung | A | gering |  | offen |
| 375 | Jagd: Einzelheld schafft immer den Blattschuss 💰 | A | gering |  | offen |

## Dungeons (54)

| Nr | Fehler | Stufe | Schwere | Herkunft | Status |
|---:|---|:---:|---|---|---|
| 80 | ⚑ Nur noch der NSC handlungsfähig: das Spiel läuft weiter | W | krit. | BE | offen |
| 117 | Opferschale: ESC und große Eingaben (16-Bit-Überlauf) schenken Geld 💰 | W | krit. |  | offen |
| 362 | Fluch der Goldmünzen (Burgruine): jeder Kampf gilt sofort als gewonnen 💰 | W | krit. |  | offen |
| 79 | Stündliche Sondertimer laufen bei Zeitsprüngen nicht | W | mittel | BE | offen |
| 84 | Todesfalle (Totenschiff, Spinnenhöhle) beendet das Spiel auch für Gruppen draußen | W | mittel | BE | offen |
| 87 | Dietrich-Zähler wird nach dem ersten Ebenenwechsel ständig zurückgesetzt 💰 | W | mittel | BE | offen |
| 88 | Klammerfehler: Feld (1,8,5) zeigt in jedem Dungeon den Spiegeltext | W | mittel |  | offen |
| 90 | Rückwärtsschritt prüft halbdurchlässige Wände nicht 💰 | W | mittel |  | offen |
| 91 | Leeres Wasserfass füllt trotzdem alle Schläuche 💰 | W | mittel | BE | offen |
| 92 | Totenschiff-Spalt: nur Seil oder Strickleiter, kein Magierstab | W | mittel | BE | offen |
| 94 | Totenschiff: Deckenloch und Grube mit Zeilenbreite 32 statt 16 gesetzt | W | mittel | BE | offen |
| 97 | Rätseltruhe: 10 AP Zusatzbelohnung werden nie vergeben | W | mittel | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 102 | weight_sum wird in der Gruppenschleife zurückgesetzt | W | mittel |  | offen |
| 105 | Teleporter und Schilfmeer treffen auch Helden anderer Gruppen | W | mittel |  | offen |
| 106 | Hebel und Geheimtür verlangen Betreten UND Drehen im selben Schritt | W | mittel |  | offen |
| 110 | Zwei-Gruppen-Rätsel prüfen nur x/y der anderen Gruppe 💰 | W | mittel |  | offen |
| 111 | Schleifen über 7 Plätze beginnen beim ersten verfügbaren Helden statt bei Platz 0 | W | mittel | BE | offen |
| 114 | Armbrustfalle 4 zählt nicht herunter | W | mittel | BE | offen |
| 119 | Geheimtüren: test_result bei falscher Hebelstellung uninitialisiert | W | mittel |  | offen |
| 121 | Verschütteter Gang (Zustand 3) blockiert nicht | W | mittel |  | offen |
| 122 | Mit Werkzeug dauert das Freiräumen länger als ohne | W | mittel |  | offen |
| 124 | Texte 31 und 32 fehlen in der deutschen OBER.DTX | W | mittel | BE | offen |
| 126 | Opfer für Efferd und Ingerimm zählen auch ohne Wegwerfen 💰 | W | mittel |  | offen |
| 346 | Ereignisfelder lösen nach Gruppenwechsel erneut aus | W | mittel |  | offen |
| 351 | Speerfallgrube (Spinnenhöhle): Spielende auch für Gruppen draußen | W | mittel |  | offen |
| 354 | Gesperrte Türen ohne Meldung, Daspota-Falltür sperrt eine Tür für immer | W | mittel |  | offen |
| 355 | Schatzlager nur beim ersten Betreten plünderbar (Daspota-Schatz, Zwingfeste) | W | mittel |  | offen |
| 357 | Oberorken-Wasserfalle: Raum zu klein, Ertrinken nur an 5-Minuten-Marken | W | mittel |  | offen |
| 432 | Manrek-Schatzkammertür: Sperre und Eisenschlüssel auf falschem Feld (0,12,8) statt (0,12,7) 💰 | W | mittel |  | offen |
| 433 | Totenschiff-Falltüren lösen neben der Grube aus und schieben die Gruppe (bei (1,14,5) in die Wand) | W | mittel |  | offen |
| 81 | KK-Probe zählt Platz 0 ungeprüft | A | gering | BE | offen |
| 82 | Gelber Pfeil der aktiven Gruppe wird vom violetten verdeckt | A | gering | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 83 | Sichtprüfung <= 16 lässt eine 17. Spalte neben der Karte zu | A | gering |  | offen |
| 85 | Kletter-Meldung nennt Plätze 0, 1, 2 … ohne Gruppenprüfung | A | gering |  | offen |
| 86 | Proben und Hilfen zählen versteinerte und bewusstlose Helden mit (nur !dead geprüft) | A | gering | BE | offen |
| 89 | Symbol „Gruppen vereinen“ bleibt nach dem Vereinen aktiv | A | gering | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 93 | Proben und Wirkungen mit get_hero(0) statt dem ersten handlungsfähigen Helden | A | gering | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 95 | Totenschiff: Meldung vom sinkenden Schiff kommt nie | A | gering | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 96 | sprintf mit der Zahl 10 statt eines Namens | A | gering | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 98 | Klebriger Boden: „GELINGT ES, SICH LOSZUREISSEN“ nur nach einem Fehlversuch | A | gering | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 101 | „IHR HÖRT EIN KNIRSCHEN“ auch bei schon offener Wand | A | gering | BE | offen |
| 107 | Absturz in den Abgrund: hero_disappear() mit Position 0 | A | gering |  | offen |
| 108 | Ratten beißen auch tote Helden | A | gering | BE | offen |
| 109 | Armbrustfalle zählt nur Platz 0 und 1 | A | gering |  | offen |
| 113 | Hilferuf aus der Grube jede Minute statt alle 20 Minuten | A | gering |  | offen |
| 115 | Loser Stein: Zustand „entfernt“ wird überschrieben | A | gering |  | offen |
| 116 | Trittplatte wirkt nur beim Entschärfen | A | gering | BE | offen |
| 347 | Dungeonlicht: Lichtquellen anderer Gruppen zählen mit | A | gering |  | offen |
| 352 | Giftdorn-Truhe nach sechs Ladungen ohne Text | A | gering |  | offen |
| 353 | Spinnenaltar: Auswahl ohne „später“, Text und Kampf wiederholen sich (dort teilweise) | A | gering |  | offen |
| 358 | Oberorken-Wasserraum: Türen beliebig oft knacken (je 1 AP) 💰 (dort teilweise) | A | gering |  | offen |
| 361 | Runin: Drachenhort und Platinschlüssel-Auftrag unabhängig 💰 (dort teilweise) | A | gering |  | offen |
| 434 | Speerfallgrube der Spinnenhöhle: eine Stunde Herausklettern auch, wenn niemand gestürzt ist | A | gering |  | offen |
| 435 | Runin: loser Stein vor dem Hebel (0,8,1) gilt erst nach Betätigen des Hebels als entfernt | A | gering |  | offen |

## Städte & Orte (46)

| Nr | Fehler | Stufe | Schwere | Herkunft | Status |
|---:|---|:---:|---|---|---|
| 40 | ⚑ Einbruch: „noch jemand frei?“ zählt die gerade erwischte Gruppe mit | W | krit. |  | offen |
| 67 | Zwingfeste: bei jedem Betreten 20 Dukaten 💰 | W | krit. | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 39 | Akademie identifiziert und bricht Flüche nur ein einziges Mal im Spiel | W | mittel | BE | offen |
| 43 | Statusleiste setzt 6 statt 4 Werte je Held, beim NSC wird die Krankheitstabelle überschrieben 💰 | W | mittel | BE | offen |
| 45 | Nicht vorhandene Antworten werden mitgemischt | W | mittel |  | offen |
| 48 | Brauender NSC bleibt in der Herberge stecken | W | mittel | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 49 | NSC kann in der Herberge nicht zaubern, magic_act[6] schreibt hinter das Feld | W | mittel | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 50 | Brauende Helden: Einzelheld sieht sie nicht, nur der erste wird gefragt | W | mittel | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 51 | Nach dem Abholen gelten zusammengeführte Brauer weiter als „brauend“ | W | mittel | BE | offen |
| 52 | Herberge: Preisaufschlag für Einzelzimmer und Suite vom Schlafsaalpreis berechnet | W | mittel |  | offen |
| 53 | „Besonders guter Preis“ beim Händler verschlechtert den Verkauf (dort teilweise) | W | mittel |  | offen |
| 54 | Einkaufskorb: Platzbedarf falsch berechnet | W | mittel | BE | offen |
| 59 | Taverne im Gespräch: Runde und Essen werden in Heller statt Silber abgezogen 💰 | W | mittel |  | offen |
| 63 | Firun-Wunder „keinen Hunger und Durst mehr“ wirkt nur auf einen Helden | W | mittel |  | offen |
| 65 | Straßenhändler überschreibt den Typ des gerade betretenen Gebäudes 💰 | W | mittel | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 66 | Zeughaus: Störrebrandt-Schulden werden aus dem Staatsbudget bezahlt 💰 (dort teilweise) | W | mittel |  | offen |
| 68 | Akademie erkennt einen Fluch beim Helden auf Platz 0 nicht | W | mittel |  | offen |
| 72 | Spielhaus: Gewinn und Verlust vertauscht 💰 | W | mittel | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 76 | Informanten werden von „erledigt“ (2) auf „bekannt“ (1) zurückgesetzt | W | mittel | BE | offen |
| 337 | Schmied Gurthag nach dem Kellerausgang dauerhaft unbenutzbar | W | mittel |  | offen |
| 339 | Akademie: Bezahlung mit erstem gleichen Stück, auch kaputt 💰 | W | mittel |  | offen |
| 341 | Treborn Kolberg erscheint nach Algrids Hinweis nie, Olvir/Treborn wiederholt sich | W | mittel |  | offen |
| 426 | Spiel laden im Tempel: leave_location() läuft über den geladenen Spielstand | W | mittel |  | offen |
| 437 | Gruppenwechsel in eine Gruppe, die schon in einem Ort steht: Statuszeile und Herberge der alten Gruppe | W | mittel |  | offen |
| 41 | Verhaftung nur ab Platz 0, solange die Plätze zur Gruppe gehören | A | gering |  | offen |
| 46 | Tempel: bei 20, 30, … Helden eine leere Seite | A | gering |  | offen |
| 47 | leave_location() dreht die Gruppe auch dort um, wo sie nicht umdrehen soll (dort teilweise) | A | gering | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 56 | Schmied zeigt das Geld des Helden, bezahlt wird aus der Gruppenkasse | A | gering |  | offen |
| 57 | Bei genau passendem Geld Feilschprobe für 0 % | A | gering |  | offen |
| 60 | Trinkprobe über Plätze 0..n−1 statt über die Gruppenmitglieder | A | gering |  | offen |
| 61 | Praios-Wunder: Prüfung auf Zauberkundige wirkungslos | A | gering | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 62 | Praios und Hesinde heben Verwandlungen auch bei fremden Gruppen auf | A | gering |  | offen |
| 64 | Taschendieb: falsche Textteile, das Ende „Dieb entkommt“ erscheint nie | A | gering |  | offen |
| 69 | Fluchbrechung: Text 63 erscheint mit „%s“ | A | gering |  | offen |
| 70 | Göttergunst über Index 0..13 statt 1..14 | A | gering |  | offen |
| 71 | ESC ruft GUI_radio() mit −1 Optionen auf | A | gering | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 77 | Rückgabewert bleibt oft uninitialisiert | A | gering | BE | offen |
| 78 | Harikas Feilschbonus auch, wenn sie nicht dabei ist | A | gering |  | offen |
| 332 | Öffnungszeit 8–19 Uhr gilt auch für Straßenhändler und Treborn Kolberg | A | gering |  | offen |
| 334 | Beleidigter Wirt wirft nicht hinaus | A | gering |  | offen |
| 336 | Essen in der Taverne verbraucht zusätzlich Proviant | A | gering |  | offen |
| 338 | Treborn Kolbergs Laden: Ortszeile leer oder fremd | A | gering |  | offen |
| 343 | Taverne: Gewinn wird als unsinnige Ausgabe angezeigt | A | gering |  | offen |
| 425 | Tavernenschlägerei schreibt über gs_town_outlawed_flags hinaus in die Rauswurf-Merker der Herbergen | A | gering |  | offen |
| 438 | Hauswände auf der linken Straßenseite zeigen die Fassade verkehrt herum | A | gering |  | offen |
| 439 | Tempel zeigen von der Seite eine Fachwerkwand statt ihrer Front | A | gering |  | offen |

## Helden & Werte (40)

| Nr | Fehler | Stufe | Schwere | Herkunft | Status |
|---:|---|:---:|---|---|---|
| 235 | ⚑ Zufallsheld aus Plätzen 0..n−1 statt aus den Gruppenmitgliedern | W | krit. | BE | offen |
| 244 | ⚑ Gruppenwechsel ohne Ausgang, wenn keine Gruppe frei handeln kann | W | krit. |  | offen |
| 248 | Stufenanstieg: ESC bei „WELCHE POSITIVE EIGENSCHAFT“ bringt rund 168 000 Dukaten 💰 | W | krit. |  | offen |
| 260 | ⚑ Suche nach freier Gruppe ohne Grenze | W | krit. | BE | offen |
| 401 | ⚑ Entlassene Helden hinterlassen Lücken in den Heldenplätzen | W | krit. |  | offen |
| 229 | h_index wird nur einmal vor der Schleife auf −1 gesetzt | W | mittel |  | offen |
| 233 | Heil-, Stab- und Lichttimer runden kleine Zeitsprünge weg | W | mittel | BE | offen |
| 234 | Stundenzählung für Kettenhemd-Schaden und Essen falsch | W | mittel | BE | offen |
| 238 | Erneute Vergiftung löscht die Protokollbytes | W | mittel | BE | offen |
| 240 | Erneute Erkrankung löscht die Protokollbytes, Verluste werden dauerhaft | W | mittel | BE | offen |
| 243 | Gruppe teilen klappt nicht richtig, wenn der NSC in einer anderen Gruppe ist | W | mittel | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 249 | Stufenanstieg: ESC bei „WELCHE NEGATIVE EIGENSCHAFT“ senkt die Intuition | W | mittel |  | offen |
| 250 | MR-Neuberechnung beim Stufenanstieg verträgt sich nicht mit MR-Gegenständen | W | mittel |  | offen |
| 253 | Spielende: Merker für bleibenden LE-Verlust wird gelöscht, LE-Maximum bleibt gesenkt | W | mittel | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 254 | set_mod_slot() mit who = 0 für einen anderen Helden | W | mittel |  | offen |
| 255 | Harikas Abschiedsgeschenk kostet Steigerungsversuche | W | mittel | BE | offen |
| 256 | Entlassene NSC kommen nie wieder | W | mittel | BE | offen |
| 259 | Brauen: Abtrennen des einzigen Helden einer Gruppe möglich | W | mittel | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 264 | Verschwundener NSC: Datei und Timer um eins verschoben | W | mittel |  | offen |
| 269 | Paralyse und Frostschäden: Erholung mit umgekehrter Bedingung | W | mittel | BE | offen |
| 270 | Schlachtfeldfieber endet nie | W | mittel | BE | offen |
| 273 | Tollwut: Beruhigen und Sanftmut werten misslungene Proben als Erfolg | W | mittel | BE | offen |
| 274 | Shurinknollengift und Bannstaub: Rückgabe der Werte fast nie | W | mittel |  | offen |
| 402 | Aufgesparte Zaubersteigerungen laufen über 127 💰 | W | mittel |  | offen |
| 404 | Elixiere stapeln sich ohne Obergrenze 💰 | W | mittel |  | offen |
| 230 | Aufräumen ungültiger Ziele setzt nur den aktuellen Eintrag zurück | A | gering |  | offen |
| 231 | Notbehelf bei 100 belegten Timern versagt im Kampf | A | gering |  | offen |
| 237 | BP-Anzeige bei Last ab 110 % falsch | A | gering | BE | offen |
| 242 | Ohne wählbaren Helden: Textbreite bleibt 3, geliefert wird Platz 0 (dort teilweise) | A | gering |  | offen |
| 245 | Nachtwache folgt beim Tauschen nur einem der beiden Helden | A | gering |  | offen |
| 246 | Regeneration: Ergebnis 0 bleibt 0, −1 wird zu 1 | A | gering | BE | offen |
| 251 | Zaubersteigerung: Zähler i wird je Runde nicht zurückgesetzt | A | gering |  | offen |
| 252 | Zufallszauber 1..86 statt 1..85 | A | gering |  | offen |
| 258 | Misslungene Wundheilung setzt Wundfieber ohne Prüfung | A | gering | BE | offen |
| 263 | Textdatei wird bei totem Patienten nicht zurückgeladen | A | gering |  | offen |
| 265 | Verschlimmerung zu Blauer Keuche mit 4 statt 5 % | A | gering |  | offen |
| 266 | Nach dem Wechsel zu Blauer Keuche noch Dumpfschädel-Schaden am selben Tag | A | gering |  | offen |
| 403 | Stufenaufstieg erst ab 101 statt 100 AP | A | gering |  | offen |
| 405 | Angriffsart bleibt nach dem Kampf im Helden stehen | A | gering |  | offen |
| 407 | Gruppengeld: Rest der Teilung verfällt | A | gering |  | offen |

## Gegenstände & Inventar (18)

| Nr | Fehler | Stufe | Schwere | Herkunft | Status |
|---:|---|:---:|---|---|---|
| 214 | Magisches Bastardschwert ist als „benutzbar“ markiert (dort teilweise) | W | krit. | BE | offen |
| 221 | ⚑ Zufälliger Gegenstandsverlust: Endlosschleife ohne ablegbaren Gegenstand | W | krit. | BE | offen |
| 222 | Tausch zweier Körperplätze ohne Prüfung und Boni 💰 | W | krit. |  | offen |
| 218 | Analüs verspricht Wirkungen magischer Gegenstände, die es nicht gibt (dort teilweise) | W | mittel | BE | offen |
| 220 | Zähler der belegten Inventarplätze driftet | W | mittel | BE | offen |
| 225 | Laterne nachfüllen: Öl beim letzten Zauberer gesucht, beim Benutzer entfernt | W | mittel | BE | offen |
| 216 | Truhenliste: 20 Byte je Name zu kurz | A | gering |  | offen |
| 217 | Mengenabfrage lässt sich nicht abbrechen | A | gering |  | offen |
| 223 | Wasserschlauch in der Hand wird nicht gefunden | A | gering | BE | offen |
| 224 | Waffengift: Schleuder wird nicht ausgeschlossen | A | gering | BE | offen |
| 226 | Tarnele: Meldung ohne Text (dort teilweise) | A | gering |  | offen |
| 227 | Antikrankheitselixier ohne Krankheit schreibt in disease[0] | A | gering |  | offen |
| 390 | Unzerbrechliche Waffen können zerbrechen (Held gegen Held, Curians Stab) (dort teilweise) | A | gering |  | offen |
| 394 | Wegwerfen: höchstens 99 Stück, Mengenabfrage auch bei einem Stück | A | gering |  | offen |
| 397 | Tausch zwischen Helden prüft nur die Traglast des Empfängers 💰 | A | gering |  | offen |
| 398 | Zweihänder von rechter in linke Hand: falsche Meldung | A | gering |  | offen |
| 400 | Waffengift über BENUTZEN umgeht die Klassensperre | A | gering |  | offen |
| 418 | Schatzkarte: wer nur Hjores Kartenteil 9 hat, bekommt „keine Kartenteile gefunden“ | A | gering |  | offen |

## Technik & Oberfläche (20)

| Nr | Fehler | Stufe | Schwere | Herkunft | Status |
|---:|---|:---:|---|---|---|
| 309 | Fehlgeschlagener Start von GEN.EXE: Spiel läuft ohne Puffer weiter | W | krit. |  | entfällt (Web: eigene Heldenerschaffung) |
| 414 | ⚑ Einhorn: Held als Zeiger im Spielstand (dort teilweise) | W | mittel |  | offen |
| 275 | Übertrag der Subtraktion fehlt im High-Word der Titellänge | A | gering |  | offen |
| 280 | Bright-Eyes-Fix für die AE-Leiste prüft den falschen Merker | A | gering | BE | offen |
| 281 | Anschnitt oben vergrößert die Bildhöhe, statt sie zu verkleinern (3 Stellen) | A | gering |  | offen |
| 282 | Wanduhr: Position läuft bis 84, Tabelle hat nur 81 Werte | A | gering | BE | erledigt (BrightEyes 2b9735db) |
| 284 | Zufallszahl kann 0 oder negativ werden | A | gering |  | offen |
| 287 | Leeres Tagebuch: Vergleich mit gs_diary_entries[−1] | A | gering |  | erledigt (BrightEyes b5b343b3) |
| 288 | Kopierhöhe line * 7 statt (line − startline) * 7 | A | gering |  | offen |
| 289 | Speichern: do-while ohne Prüfung von findfirst | A | gering |  | offen |
| 292 | Stadtdatei: liest 100 Byte mehr, als g_locations_tab fasst | A | gering |  | offen |
| 293 | Kein break nach dem Fund | A | gering | BE-Fix | prüfen: BrightEyes-Behebung, bei uns vermutlich aktiv |
| 294 | Bereichsprüfung clip_num > max statt >= max | A | gering |  | offen |
| 296 | Dukaten-Anzeige läuft ab 32768 D über | A | gering | BE | offen |
| 298 | Lesen vor g_hero_pic_posx bei Maus-x < 3 | A | gering |  | offen |
| 299 | Kartenwerte ab 0xf0 lesen hinter die Tabelle | A | gering |  | offen |
| 304 | Spielstandname bearbeiten: Schreibstelle hinter dem Namen | A | gering |  | offen |
| 306 | Abfrage „WIE VIELE DER … SOLLEN …“ im falschen Fall | A | gering | BE | offen |
| 308 | Speichermeldung nennt 5000 Byte zu wenig | A | gering |  | offen |
| 410 | Kampfmusik läuft nach direkt gestarteten Dungeonkämpfen weiter | A | gering |  | offen |
