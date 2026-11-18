# Bugfixes aus dem Decomp-Projekt (Tracking)

Quelle: [MeowMuhMuhCow/schicksalsklinge, BUGFIXES.md](https://github.com/MeowMuhMuhCow/schicksalsklinge/blob/main/BUGFIXES.md), Version 1.5d vom 12.11.2026, übernommen am 18.11.2026 (ohne Changelog und Prüfanleitungen). Die Nummern sind die des Projekts (Schalter `FIX_nnnn` in dessen `s_fix.h`); Beschreibung und „So prüfst du es“ stehen dort. Laut Projekt sind die Behebungen am Quelltext entworfen, aber im Spiel noch nicht ausgiebig getestet.

Übernahme bei uns (Stufe 7 im [Stufenplan](stufenplan.md)): je Korrektur ein Commit im BrightEyes-Branch `web` unter `#ifdef M302de_ORIGINAL_BUGFIX` und `if (BUGFIX_WICHTIG)` bzw. `if (BUGFIX_ALLES)` (Laufzeitschalter `g_bugfixes`, im Browser die Einstellung „Fehlerkorrekturen“: An = Stufe W, Voreinstellung; Alle = auch Stufe A; Aus), mit Szenario, wo es sich auslösen lässt (`web_test_fix`); Status hier nachtragen.

**Spalten:** „Änderung dort“ und „Dateien“ (Modul in BrightEyes: `seg032` → `src/schick/seg032.cpp`) aus `Werkzeuge/fix_schalter.tsv` des Projekts; im Code dort steht jede Behebung als `#if FIX_nnnn` · Stufe W = „wichtig“, A = nur „alles“ · Schwere laut `s_fix.h` (kritisch: Hänger, Absturz, Speicherfehler) · 💰 Exploit (nützt dem Spieler) · Herkunft: BE = Fehler war in Bright-Eyes bekannt, BE-Fix = auch die Behebung stammt aus Bright-Eyes (bei uns ist `M302de_ORIGINAL_BUGFIX` nativ gesetzt, also vermutlich schon aktiv) · ⚑ = zuerst angehen.

**Umfang:** 284 Einträge – 25 kritisch, 120 mittel, 139 gering; 38 Exploits; 32 mit Behebung aus Bright-Eyes; 15 dort nur teilweise behoben.

**Hinweis 16/32 Bit:** Einige Fehler sind Überläufe von 16-Bit-`int` (z. B. 117, 137, 296). Nativ ist `int` 32 Bit, Spielstandvariablen aber oft fest 16 Bit – solche Einträge vor der Übernahme nachstellen, sie können bei uns anders oder gar nicht auftreten.


## Kampf (30)

| Nr | Fehler | Stufe | Schwere | Herkunft | Änderung dort | Dateien | Status |
|---:|---|:---:|---|---|---|---|---|
| 7 | ⚑ Heldenzug ohne verbliebene Heldenphasen: Endlosschleife möglich | W | krit. | BE | erst auf 0 Heldenphasen pruefen und den Zug an die Gegner geben (wie im Gegnerzweig) | seg032 | erledigt (Branch bugfixes) |
| 15 | ⚑ Bei genau 30 Beutestücken schreibt „MEHR“ über einen nicht gesetzten Zeiger | W | krit. |  | auch loot_names[30] belegen, dorthin schreibt "MEHR" auf Seite 2 bei genau 30 Stueck | seg035 | erledigt (Branch bugfixes) |
| 22 | ⚑ Übergelaufener Priester (Stufe 2) hängt das Spiel auf | W | krit. |  | ohne einen Zauber, den dieser Gegner auf seiner Seite einsetzen kann, gar nicht erst suchen | seg037 | erledigt (Branch bugfixes) |
| 25 | ⚑ Fliehender Doppelgegner: Wegsuche hängt | W | krit. | BE-Fix | beim Fluchtziel im ersten Rueckschritt keinen Platz fuer den Schwanz verlangen, die | seg038 | schon in BrightEyes behoben |
| 30 | ⚑ Angstgift: Schreiben über nicht gesetzten Zeiger bei Held gegen Held | W | krit. |  | Angstgift wirkt nur auf Gegner, beim Helden ist enemy_p nicht gesetzt | seg041 | erledigt (Branch bugfixes) |
| 11 | Zauberziel: begehbare Objekte (Id ≥ 50) werden nicht abgewiesen | W | mittel |  | begehbare Objekte (Id >= 50) wie im Angriffszweig abweisen | seg033 | erledigt (Branch bugfixes) |
| 18 | Computerkampf: Helden greifen auch übergelaufene Gegner an | W | mittel |  | uebergelaufene Gegner (Boeser Blick) kaempfen auf der Seite der Helden; uebergelaufene Gegner nicht angreifen; ein uebergelaufener Gegner steht in der Schusslinie wie ein Held | seg036 | erledigt (Branch bugfixes) |
| 34 | Wurfwaffe wird vor der Schadensberechnung abgelegt 💰 | W | mittel | BE-Fix | Wurfwaffe erst nach der Schadensberechnung ablegen (Bright-Eyes-Fix, Original-Bug 32) | seg042 | schon in BrightEyes behoben |
| 36 | Gegner-Balsam heilt über das Maximum oder gar nicht | W | mittel | BE-Fix | halben Verlust, mindestens 7, hoechstens bis zum Maximum heilen (Bright-Eyes-Fix) | seg102 | schon in BrightEyes behoben |
| 38 | Endkampf: ohne Grimring kämpft Heldenplatz 0 | W | mittel |  | dann den ersten handlungsfaehigen Helden der Gruppe nehmen | seg116 | erledigt (Branch bugfixes) |
| 313 | Lagerüberfall: nur Heldenplatz 0 ist wach, eingeteilte Wachen zählen nicht | W | mittel |  | beim Lagerueberfall ist die eingeteilte Wache wach (gs_camp_incident = Nummer der Wache,; erst nach dem Kampf loeschen, FIG_init_heroes() weckt die Wache; im Dungeon erst nach dem Kampf loeschen, FIG_init_heroes() weckt die Wache | seg039, seg051, seg052 | erledigt (Branch bugfixes); Wache über g_fig_camp_guard statt gs_camp_incident später zu löschen |
| 316 | Zerbrochene Waffe bleibt in der Hand, Computerkampf wechselt nicht | W | mittel |  | keine zerbrochene Waffe nehmen; ist die Waffe zerbrochen und liegt eine heile Nahkampfwaffe im Rucksack, zu ihr greifen | seg036 | erledigt (Branch bugfixes) |
| 319 | Computerkampf zaubert auch mit Zauberwert unter −5 | W | mittel |  | einen Zauber mit Zauberwert unter -5 kann der Held nicht wirken (test_spell() liefert 0, | seg036 | erledigt (Branch bugfixes) |
| 322 | Alte Nahkampfoption ohne Nachbarschaftsprüfung („Schattenboxen“) 💰 | W | mittel |  | alte Nahkampfoption nur, wenn das Ziel (Kopf oder Schwanz) noch direkt daneben steht | seg033 | erledigt (Branch bugfixes) |
| 8 | Schwanzteil eines durch eigenen Patzer getöteten Doppelgegners bleibt stehen | A | gering | BE-Fix | Schwanzteil eines durch eigenen Patzer getoeteten Doppelgegners vom Schachbrett nehmen | seg032 | schon in BrightEyes behoben |
| 9 | Abfrage g_max_enemies != 0 nach dem Sieg ist nie wahr | A | gering |  | Kuerzung merken, die Abfrage nach dem Sieg braucht sie; gemerkte Kuerzung pruefen (g_max_enemies ist hier schon 0) | seg032 | erledigt (Branch bugfixes), Stufe alles |
| 12 | Flucht über den oberen und unteren Rand kostet ein BP mehr | A | gering |  | wie am linken Rand reicht ein BP mehr als der Weg | seg034 | erledigt (Branch bugfixes), Stufe alles |
| 13 | Fluchtfeld wird mit dem Inhalt einer früheren Cursorposition geprüft | A | gering |  | im Fluchtfall den gerade gelesenen Inhalt des Randfelds pruefen | seg034 | erledigt (Branch bugfixes), Stufe alles |
| 14 | Verschachtelte ifs: tote Figur auf dem Zielfeld überspringt die Weg- und BP-Prüfung | A | gering | BE-Fix | if-Kette flach (Bright-Eyes-Fix), damit Weg und BP auch bei Leichen geprueft werden | seg034 | schon in BrightEyes behoben |
| 16 | Knochen mit Rune beendet die Beuteliste | A | gering | BE | den Knochen mit Rune aus der Beuteliste nehmen, statt die Liste an ihm abzubrechen | seg035 | erledigt (Branch bugfixes), Stufe alles |
| 17 | Meldung „ZIEL IST NICHT MEHR IN GÜLTIGER SCHUSSPOSITION“ kann doppelt kommen | A | gering |  | Schusslinie nur pruefen, wenn die Meldung nicht schon kam | seg035 | erledigt (Branch bugfixes), Stufe alles |
| 19 | Fluchtfelder (negative Ids) werden als Held gelesen | A | gering | BE-Fix | Fluchtfelder (negative Ids) sind kein Held, sie beenden die Suche; Fluchtfelder (negative Ids) sind kein Held (Bright-Eyes-Fix) | seg036, seg037 | schon in BrightEyes behoben (seg036: Suche läuft über Fluchtfelder weiter, folgenlos) |
| 20 | Umzingelt-Prüfung mit Grenze 25 statt 23 | A | gering |  | Grenze 23 (das Feld ist 0..23) | seg036 | erledigt (Branch bugfixes), Stufe alles |
| 24 | best_viewdir möglicherweise uninitialisiert | A | gering | BE-Fix | best_viewdir vorbelegen (Bright-Eyes-Fix) | seg038 | schon in BrightEyes behoben |
| 27 | Schwanzteile toter Doppelgegner sind nicht begehbar | A | gering | BE-Fix | tote Schwanzteile begehbar machen (Bright-Eyes-Fix) | seg038 | schon in BrightEyes behoben |
| 28 | Grenzprüfung: new_y > 23 doppelt, new_x > 23 fehlt | A | gering | BE-Fix | rechten Rand pruefen (Bright-Eyes-Fix) | seg038 | schon in BrightEyes behoben |
| 31 | Held gegen Held: Werte des Verteidigers falsch berechnet | A | gering | BE | Ruestungsbehinderung des Angegriffenen, nicht des Angreifers; PA-Zuschlag der Waffe (wie in seg043 und WERTE PRUEFEN) | seg042 | erledigt (Branch bugfixes), Stufe alles |
| 32 | Paradepatzer setzt backfire_1 statt backfire_2 | A | gering | BE | den Freischlag fuehrt der Angreifer aus, also ihn animieren | seg042 | erledigt (Branch bugfixes), Stufe alles |
| 312 | Gefesselte Gegner bleiben in der Kampfliste und kämpfen beim nächsten Betreten erneut 💰 | A | gering |  | gefesselte Gegner eines gewonnenen Kampfes gelten als besiegt (sonst schreibt | seg032 | erledigt (Branch bugfixes), Stufe alles |
| 327 | Piratenangriff: Ergebnis von do_fight() wird nicht ausgewertet 💰 (dort teilweise) | A | gering |  | nach verlorenem oder per VERLASSEN/LADEN beendetem Kampf kein Ausruestungsbildschirm | seg117 | erledigt (Branch bugfixes), Stufe alles; wie dort nur teilweise |

## Magie (28)

| Nr | Fehler | Stufe | Schwere | Herkunft | Änderung dort | Dateien | Status |
|---:|---|:---:|---|---|---|---|---|
| 196 | ⚑ Skelettarius belegt bei jedem Wirken 1288 Byte neu im Kampfobjektpuffer | W | krit. | BE | Grafikpuffer des ersetzten Gegners (je Gegner 0x508 Byte) fuer den Zombie wiederverwenden | seg099 | schon in BrightEyes behoben |
| 186 | Visibili wirkt nur auf den Zaubernden, der Kampf entfällt nur bei einem Einzelhelden | W | mittel | BE | der Kampf faellt aus, wenn alle lebenden Helden der Gruppe unsichtbar sind; wie im Loesungsbuch: die ganze Gruppe wird unsichtbar, die Kosten (Spielrunden x 5 AE) zahlt der Zaubernde einmal | seg032, seg101 | erledigt (Branch bugfixes) |
| 189 | Stabzauber: Abfrage „keine Stabzauber mehr“ auf Stufe 7 statt 4 | W | mittel | BE | ab dem 5. Stabzauber (Zuschlag 99) gibt es keine mehr | seg098 | erledigt (Branch bugfixes) |
| 190 | Stabzauber-Probe prüft die zweite Eigenschaft doppelt | W | mittel | BE | dritte Eigenschaft statt der zweiten ein zweites Mal | seg098 | schon in BrightEyes behoben |
| 191 | Foramen aus dem Zaubermenü ignoriert den Türzuschlag 💰 | W | mittel | BE | Zuschlag der Tuer vor der Gruppe auch beim freien Foramen (Suche endet am Listenende -1) | seg098 | schon in BrightEyes behoben (Suche jetzt mit Listenende -1, immer an) |
| 192 | Gardianum kostet AE und schützt nicht | W | mittel | BE | der Gardianum-Schild gilt fuer einen Kampf; Staerke des Schildes = Stufe des Zaubernden + eingesetzte AE (Loesungsbuch); ausgewertet in seg102; der Gardianum-Schild faengt ab, die AE zahlt der Gegner trotzdem | seg032, seg099, seg102 | erledigt (Branch bugfixes) |
| 197 | Foramen aus dem Zaubermenü wirkt nur nach geöffnetem Türmenü | W | mittel | BE | freies Foramen auch vor einer geschlossenen Tuer ohne geoeffnetes Tuermenue | seg099 | schon in BrightEyes behoben |
| 199 | Hexenspeichel: AE-Prüfung greift nie 💰 | W | mittel |  | hoechstens die fehlenden LE heilen, je LE 2 AE, und nicht mehr AE ausgeben, als da sind | seg099 | erledigt (Branch bugfixes) |
| 207 | Armatrutz: ein RS-Punkt mehr, als AE vorhanden 💰 | W | mittel | BE | groesster Bonus, dessen Quadrat die AE nicht uebersteigt | seg101, seg102 | erledigt (Branch bugfixes); Helden waren schon in BrightEyes behoben, jetzt auch Gegner (seg102) |
| 211 | g_ignite_mode wird nach dem Anzünden nicht zurückgesetzt | W | mittel | BE | Anzuendmodus zuruecksetzen, sonst findet "Brenne toter Stoff" danach nur noch diese Art | seg107 | schon in BrightEyes behoben |
| 212 | Tollwut: Sanftmut ohne Prüfung des Zauberwerts (dort teilweise) | W | mittel | BE | Zauberwert pruefen (die Meldung "beherrscht den Zauber nicht" braeuchte einen neuen Text); Magier mit 4. Stabzauber zahlen 2 AE weniger (sub_ae_splash) | seg120 | schon in BrightEyes behoben |
| 213 | Feuerbann wird gesetzt, aber nirgends ausgewertet | W | mittel | BE | Dauer Stufe in Stunden (Loesungsbuch); die Wirkung wertet seg102 aus | seg101, seg102 | erledigt (Branch bugfixes) |
| 382 | Große Gier ist nicht umgesetzt | W | mittel |  | der Gegner verlaesst den Kampfplatz (Loesungsbuch), wie beim Horriphobus ueber die Flucht; Kosten 8 AE aus der Zaubertabelle. | seg099 | erledigt (Branch bugfixes) |
| 383 | Transversalis auf der Landreise kostet AE ohne Wirkung | W | mittel |  | auf der Reise (Lager unterwegs) steht gs_town_id noch auf der Abreisestadt -> Meldung wie ausserhalb, keine AE | seg099 | erledigt (Branch bugfixes) |
| 385 | Curian zaubert im Kampf nur im Computerkampf mit Magie | W | mittel |  | ein NSC (Curian) zaubert auch im normalen Kampf, nicht nur im Computerkampf mit Magie | seg036 | erledigt (Branch bugfixes) |
| 187 | Transversalis-Kreuz darf eine Zeile unter die Karte | A | gering |  | das Kreuz bleibt auf der Karte (Zeilen 0..15) | seg074 | erledigt (Branch bugfixes), Stufe alles |
| 188 | Meditation bei LE 6 oder 7 kostet LE und bringt keine AE | A | gering |  | ohne umwandelbare LE (ae <= 0) keine LE abziehen | seg098 | erledigt (Branch bugfixes), Stufe alles |
| 193 | Spieltext „AUF %S RUHT …“ mit großem S | A | gering | BE | %S im geladenen Text zu %s machen | seg099 | schon in BrightEyes behoben |
| 195 | Skelettarius: Leiche darunter verschwindet aus der Auswahl | A | gering | BE | object_id des Ziels sichern (darunterliegende Leiche bleibt waehlbar) | seg099 | schon in BrightEyes behoben |
| 200 | Abbruch der Gegenstandswahl: inventory[−1] | A | gering | BE | Abbruch der Gegenstandswahl (-1) nicht als Inventarplatz benutzen; Abbruch der Gegenstandswahl (-1) nicht als Inventarplatz benutzen (g_dtp2 ist schon leer) | seg099, seg100 | schon in BrightEyes behoben |
| 201 | Analüs: volle AE-Kosten, wenn nur der Zuschlag die Probe kippt | A | gering | BE | am Zuschlag gescheitert -> halbe AE wie bei misslungenem Zauber | seg099 | erledigt (Branch bugfixes), Stufe alles |
| 202 | „Eigenschaften seid gelesen“ zeigt 80 % des Nahkampfschadens | A | gering | BE | Nahkampfschaden ungekuerzt anzeigen | seg100 | erledigt (Branch bugfixes), Stufe alles |
| 203 | Exposami vergleicht mit einem noch leeren Listeneintrag | A | gering |  | nur beschriebene Eintraege vergleichen | seg100 | erledigt (Branch bugfixes), Stufe alles |
| 205 | Eisenrost auf ein Tier kostet volle AE | A | gering |  | keine Kosten, wie bei Bannbaladin | seg100 | erledigt (Branch bugfixes), Stufe alles |
| 206 | Spieltext „VERWANDLET“ | A | gering | BE | Tippfehler im geladenen Text zur Laufzeit berichtigen | seg100 | schon in BrightEyes behoben |
| 208 | Paralue auf einen Helden prüft das alte Zauberziel | A | gering | BE | erst das neue Ziel setzen, dann pruefen | seg101 | erledigt (Branch bugfixes), Stufe alles |
| 210 | Brenne entzündet immer die erste Fackel oder Laterne | A | gering | BE | den benutzten Inventarplatz anzuenden, nicht die erste Fackel/Laterne | seg101 | schon in BrightEyes behoben |
| 386 | Analüs erkennt nur 28 Gegenstände, Grimring nicht (dort teilweise) | A | gering |  | magischer Gegenstand ohne Eintrag in g_analues_items -> Text 55 ("kann nicht sagen, was fuer ein Zauber") statt "nichts Besonderes" | seg099 | erledigt (Branch bugfixes), Stufe alles; wie dort nur teilweise |

## Reise & Ereignisse (48)

| Nr | Fehler | Stufe | Schwere | Herkunft | Änderung dort | Dateien | Status |
|---:|---|:---:|---|---|---|---|---|
| 137 | ⚑ Schiffstempo in 16 Bit, Schnellsegler mit −106: Tempo 0 bringt das Spiel zum Absturz | W | krit. | BE | Grundtempo ohne Vorzeichen (150 statt -106), Produkt in 32 Bit, Ergebnis 1..127 | seg064 | erledigt (Branch bugfixes) |
| 164 | ⚑ Waten durch den Bach mit uninitialisiertem Helden | W | krit. | BE | Held ist hier nicht gesetzt - den ersten verfuegbaren nehmen | seg113 | schon in BrightEyes behoben |
| 174 | ⚑ Zustand 33 ist eine Endlosschleife | W | krit. |  | statt Endlosschleife das Gespraech beenden | seg116 | erledigt (Branch bugfixes) |
| 180 | ⚑ Krakenmolch: Endlosschleife, wenn alle Helden über Bord oder tot sind | W | krit. | BE | Kampf endet, wenn kein Held mehr kaempft (sonst Endlosschleife) | seg117 | schon in BrightEyes behoben |
| 184 | ⚑ Verirrt im Wald: alle sieben Heldenplätze sterben | W | krit. | BE | nur die Helden der verirrten Gruppe | seg118 | schon in BrightEyes behoben |
| 127 | Nur die erste Seeroute (Thorwal–Prem) wird zurückgesetzt | W | mittel | BE | alle Seerouten zuruecksetzen | seg002 | offen |
| 136 | Passagepreis in 16 Bit: lange Routen werden spottbillig 💰 | W | mittel |  | mit der Entfernung in 32 Bit multiplizieren | seg064 | offen |
| 142 | Reiseereignisse: Lage wird nach Richtungswechsel falsch korrigiert 💰 | W | mittel | BE-Fix | Lage direkt nach dem Ereignis setzen, bei Richtungswechsel durch das Ereignis | seg094 | schon in BrightEyes behoben |
| 149 | replenish_stocks() bekommt die Heldenposition als Versuchszähler | W | mittel | BE | zweiter Parameter ist der Versuchszaehler, nicht die Heldenposition | seg109 | offen |
| 150 | „UMKEHREN“ auf der Rückreise behält die Rückwärtsrichtung (9 Stellen) | W | mittel | BE | Umkehren kehrt die aktuelle Richtung um | seg109, seg113, seg114, seg115, seg116, seg118 | offen |
| 151 | Furt: GE-Probe gilt fast immer als bestanden | W | mittel | BE | gewoehnliche GE-Probe, jedes Ergebnis <= 0 ist misslungen | seg109 | offen |
| 152 | Fährpreis wächst bei jedem Versuch weiter | W | mittel | BE | Preis bei jedem Versuch aus dem Grundpreis berechnen | seg109 | offen |
| 153 | Gruppenproben zählen alle 7 Plätze ohne Gruppen- und Todesprüfung | W | mittel | BE | nur lebende Helden der aktiven Gruppe; nur lebende Helden der aktiven Gruppe (wie count_heroes_in_group()) | seg109, seg116 | offen |
| 158 | Steilhang: Strickleiter macht den Sturz schlimmer | W | mittel | BE | schwerer Sturz nur ohne Seil und ohne Strickleiter | seg111 | offen |
| 159 | Gorahs Hütte: Silentium-Auswahl wird nie wiederholt 💰 | W | mittel |  | Nicht-Magier oder misslungener Silentium fuehren zurueck in die Auswahl | seg111 | offen |
| 161 | Kräuterbonus für Gegenstände über 127 greift nie | W | mittel |  | Kraeuternummern ueber 127 (int8_t) richtig vergleichen | seg051 | offen |
| 162 | Wegzoll 15 Dukaten insgesamt statt pro Person 💰 | W | mittel |  | 15 Dukaten pro Person, wie im Text verlangt | seg112 | offen |
| 165 | Sturz in die Klamm: hero_disappear() mit der Antwortzahl als Position | W | mittel |  | Position des Springers uebergeben | seg113 | offen |
| 166 | Harpyien: Fluchtoption ist kein Versuch 💰 | W | mittel | BE | VERSUCHEN ZU FLIEHEN? fuehrt zur Kriegskunst-Probe (else gehoert zur Antwort) | seg113 | offen |
| 167 | Nebeltal: Funktionsadresse als Held | W | mittel | BE | Funktion aufrufen statt ihre Adresse als Helden zu nehmen | seg113 | offen |
| 170 | Firun-Opfer: Schlafbonus bleibt für spätere Lager stehen 💰 | W | mittel |  | Schlafbonus gilt nur fuer dieses Lager | seg114 | offen |
| 177 | AT- und PA-Proben verkehrt herum (Höhlenbär, Krakenmolch) | W | mittel | BE | Attacke gelingt bei W20 <= AT; Schaden bei misslungener Parade (W20 > PA); Treffer bei W20 <= AT | seg117 | offen |
| 178 | Kvillotter beißt nie | W | mittel | BE | das schlechteste misslungene Ergebnis merken, sein Held wird gebissen | seg117 | offen |
| 179 | Krakenmolch: GE-Probe falsch ausgewertet | W | mittel | BE | misslungene GE-Probe = Wuergen, Patzer (-99) = Packen | seg117 | offen |
| 181 | Zufallsbegegnungen: Vergleich verkehrt herum, fast alle unerreichbar | W | mittel |  | aufsteigende Schwellen: W100 <= Wert | seg117 | offen |
| 185 | Kletterpartie: tödlicher Sturz bei knapp verfehlter Probe statt beim Patzer | W | mittel | BE | toedlich ist nur der Patzer (-99) | seg118 | offen |
| 367 | Weiterreisen ohne Nachtlager über unsichtbares Symbol 💰 | W | mittel |  | Weiterreisen nur ueber das sichtbare 7. Symbol (guter Lagerplatz) | seg051 | offen |
| 368 | Tavernenhinweis schaltet Reiseereignisse 66 und 75 ab | W | mittel |  | das Geruecht ueber das Raeuberlager setzt nicht den Erledigt-Merker von Reiseereignis 75 (Osterpatch NRS); Reiseereignis 75 bleibt moeglich (Osterpatch NRS); Hinweis auf den Nahrungsplatz setzt den Rastplatz-Merker, nicht den Erledigt-Merker der Spur (Kampf F066); Rastplatz-Merker statt Erledigt-Merker der Spur (Osterpatch NRS) | seg073 | offen |
| 372 | Seereise: jeder Umweg-Wert führt ins Totenschiff 💰 | W | mittel |  | nur der Umweg ins Totenschiff fuehrt dorthin; bei 99 (Gruppe tot, Kampf verlassen); bei 99 ist eine andere Gruppe aktiv, ihr Ort bleibt (wie bei der Landreise, seg093) | seg063 | offen |
| 128 | Sprung bis Mitternacht (Swafnild) überspringt feste Ereignisse und verbraucht 25 Stunden Licht | A | gering | BE | gewoehnlicher Zeitsprung bis Mitternacht (feste Uhrzeiten, Licht und Stunden werden richtig gezaehlt) | seg002 | offen |
| 129 | Wachenwahl: ESC liest g_wildcamp_herbstatus[−1] | A | gering | BE | answer != -1 vor allen drei Abfragen | seg051 | offen |
| 130 | Bei weniger als 3 Stunden Schlaf wechseln die Wachen nie | A | gering |  | mindestens 1 Stunde je Wache, sonst wechselt die Wache nie | seg051, seg052 | offen |
| 132 | Hafenmeister schimpft auch beim Verlassen über fehlendes Geld | A | gering |  | Geld nur pruefen, wenn die Gruppe etwas wissen will (nicht beim Verlassen) | seg063 | offen |
| 133 | Hunger-/Durst-Meldungssperre des NSC wird nicht zurückgesetzt | A | gering |  | auch den NSC | seg063 | offen |
| 135 | Schiffsnamen werden bei jedem Blick neu ausgewürfelt | A | gering | BE-Fix | Schiffsname fest aus dem Preisaufschlag der Passage (Bright-Eyes-Fix) | seg064 | schon in BrightEyes behoben |
| 138 | Angezeigte Reisedauer nur in groben Stufen | A | gering | BE-Fix | erst multiplizieren, dann teilen (Bright-Eyes-Fix); Tempo 0 abfangen | seg064 | schon in BrightEyes behoben (Abfangen von Tempo 0 fehlt dort, Tempo ist aber immer ≥ 1: mit Nr. 137 begrenzt, ohne sie ≥ 24 oder negativ) |
| 145 | Umweg-Linie wird um einen Punkt versetzt zurückgemalt | A | gering |  | erst zurueckschreiben, dann weitersetzen (wie beim Zeichnen) | seg094 | offen |
| 148 | Rastplatz: Status nur für den Anführer gelöscht | A | gering | BE | Status aller Helden zuruecksetzen, replenish_stocks() fragt selbst nach dem Helden (Plaetze 0..6) | seg109 | offen |
| 156 | „AM UFER DES DES BODIR“ | A | gering |  | fuehrendes "DES " des Flussnamens weglassen, der Furttext hat schon "AM UFER DES %s" | seg110 | offen |
| 160 | Hütte bei Orvil: Frage passt nicht zu den Antworten | A | gering |  | die zur Antwort passende Frage (Text 91) | seg112 | offen |
| 163 | Tatzelwurm-Spuren: Name aus einem Nullzeiger | A | gering |  | ohne Jaeger (hero == NULL) den ersten verfuegbaren Helden nennen | seg113 | offen |
| 168 | Dialogbild fehlt nach einem Lagerkampf | A | gering | BE | Kopfbild nach dem Lager neu laden | seg113, seg118 | offen |
| 171 | Olimone: get_hero(−1), wenn niemand das Rezept nehmen konnte | A | gering | BE | hat niemand das Rezept, den ersten verfuegbaren Helden nennen statt get_hero(-1) | seg114 | offen |
| 182 | Krankheitsprobe mit uninitialisiertem Helden | A | gering | BE | KK des betroffenen Helden | seg117 | offen |
| 183 | Waldweg: Erfolgstext beim ersten Versuch unerreichbar | A | gering |  | beim ersten Versuch (answer == 2) der Text fuer den schnellen Erfolg | seg118 | offen |
| 369 | Nach Gorah dreht sich die Reiserichtung immer um | A | gering |  | nur umkehren, wenn die Gruppe nicht schon Richtung Orvil reist (Richtung Orvil = Ziel Orvil vorwaerts | seg111 | offen |
| 371 | Grenz- und Straßentexte ohne Richtungsprüfung | A | gering |  | Strassenende/Orkland-Text 74 nur auf dem Weg nach Phexcaer (Ziel Phexcaer vorwaerts oder anderes Ziel nach Umkehr) | seg110 | offen |
| 375 | Jagd: Einzelheld schafft immer den Blattschuss 💰 | A | gering |  | mindestens die Haelfte (aufgerundet), ein Einzelheld muss treffen | seg117 | offen |

## Dungeons (54)

| Nr | Fehler | Stufe | Schwere | Herkunft | Änderung dort | Dateien | Status |
|---:|---|:---:|---|---|---|---|---|
| 80 | ⚑ Nur noch der NSC handlungsfähig: das Spiel läuft weiter | W | krit. | BE | die Pruefung von game_loop() anstossen, die den NSC allein nicht als handlungsfaehige; die Spielschleife prueft die Gruppen (der NSC allein zaehlt dort nicht); der NSC allein versucht es nicht noch einmal; die Spielschleife prueft die Gruppe | seg002, seg113, seg116 | erledigt (Branch bugfixes; Teil in check_group schon in BrightEyes) |
| 117 | Opferschale: ESC und große Eingaben (16-Bit-Überlauf) schenken Geld 💰 | W | krit. |  | in 32 Bit rechnen; ESC (-1) und Ueberlaeufe (<= 0) bringen kein Geld | seg085 | offen |
| 362 | Fluch der Goldmünzen (Burgruine): jeder Kampf gilt sofort als gewonnen 💰 | W | krit. |  | der Fluch der Goldmuenzen wirkt nur in Hyggeliks Ruine; dort faellt der Kampf aus (3 wie bei Visibili: | seg032 | offen |
| 79 | Stündliche Sondertimer laufen bei Zeitsprüngen nicht | W | mittel | BE | die stuendlichen Sondertimer aus do_timers() (Einhorn, Sphaerenriss, Orkmist-Faesser),; stuendliche Sondertimer mitzaehlen | seg002 | offen |
| 84 | Todesfalle (Totenschiff, Spinnenhöhle) beendet das Spiel auch für Gruppen draußen | W | mittel | BE | nur die Helden der Gruppe im Dungeon kommen um (wie beim verlorenen Kampf auf Reisen: | seg075 | offen |
| 87 | Dietrich-Zähler wird nach dem ersten Ebenenwechsel ständig zurückgesetzt 💰 | W | mittel | BE | den Ebenenwechsel nur einmal auswerten | seg076 | offen |
| 88 | Klammerfehler: Feld (1,8,5) zeigt in jedem Dungeon den Spiegeltext | W | mittel |  | beide Felder nur in Hyggeliks Ruine | seg076 | offen |
| 90 | Rückwärtsschritt prüft halbdurchlässige Wände nicht 💰 | W | mittel |  | rueckwaerts gilt das Richtungsflag der Gegenrichtung (wie vorwaerts) | seg076 | offen |
| 91 | Leeres Wasserfass füllt trotzdem alle Schläuche 💰 | W | mittel | BE | erst nachsehen, was im Fass ist: aus einem leeren Fass nichts fuellen, | seg076 | offen |
| 92 | Totenschiff-Spalt: nur Seil oder Strickleiter, kein Magierstab | W | mittel | BE | Seil, Strickleiter oder ein Magier mit Stabzauber ab Stufe 3 (Seil des Adepten), wie an den Gruben | seg077 | offen |
| 94 | Totenschiff: Deckenloch und Grube mit Zeilenbreite 32 statt 16 gesetzt | W | mittel | BE | Dungeonkarten sind 16 Felder breit | seg077 | offen |
| 97 | Rätseltruhe: 10 AP Zusatzbelohnung werden nie vergeben | W | mittel | BE-Fix | den Goldschluessel nur einmal (die Truhe gilt nach Fix 97 als offen); die Zusatzbelohnung (10 AP) freischalten (Bright-Eyes-Fix) | seg077 | schon in BrightEyes behoben |
| 102 | weight_sum wird in der Gruppenschleife zurückgesetzt | W | mittel |  | Summe einmal vor der Schleife loeschen | seg078 | offen |
| 105 | Teleporter und Schilfmeer treffen auch Helden anderer Gruppen | W | mittel |  | nur lebende Helden der aktiven Gruppe | seg079, seg110 | offen |
| 106 | Hebel und Geheimtür verlangen Betreten UND Drehen im selben Schritt | W | mittel |  | Betreten ODER Drehen (wie beim Hebel (1,3,11)); Betreten ODER Drehen (wie bei den Geheimtueren in seg078) | seg079, seg083 | offen |
| 110 | Zwei-Gruppen-Rätsel prüfen nur x/y der anderen Gruppe 💰 | W | mittel |  | die andere Gruppe muss in diesem Dungeon auf dieser Ebene stehen | seg081, seg083, seg088 | offen |
| 111 | Schleifen über 7 Plätze beginnen beim ersten verfügbaren Helden statt bei Platz 0 | W | mittel | BE | bei Platz 0 beginnen; bei Platz 0 beginnen (hero zeigte noch auf den ersten handlungsfaehigen Helden) | seg081, seg082, seg083 | offen |
| 114 | Armbrustfalle 4 zählt nicht herunter | W | mittel | BE | wie die Fallen 1 bis 3 herunterzaehlen | seg084 | offen |
| 119 | Geheimtüren: test_result bei falscher Hebelstellung uninitialisiert | W | mittel |  | bei falscher Hebelstellung kein Zufallswert | seg086 | offen |
| 121 | Verschütteter Gang (Zustand 3) blockiert nicht | W | mittel |  | der verschuettete Gang sperrt den Weg; Freiraeumen anbieten (Text 45) | seg089 | offen |
| 122 | Mit Werkzeug dauert das Freiräumen länger als ohne | W | mittel |  | mit Werkzeug 30 Minuten, ohne eine Stunde; mit Werkzeug 6 Stunden, ohne einen Tag | seg089, seg091 | offen |
| 124 | Texte 31 und 32 fehlen in der deutschen OBER.DTX | W | mittel | BE | Text 31 aus dem Datenpatch 1.2 ("%s ... HAT %s SICH ... KONNTET %s ... MEINT %s, ALS %s WIEDER HOCHKOMMT"): | seg090 | offen |
| 126 | Opfer für Efferd und Ingerimm zählen auch ohne Wegwerfen 💰 | W | mittel |  | Opfer zaehlen nur, wenn wirklich etwas weggeworfen wurde | seg105 | offen |
| 346 | Ereignisfelder lösen nach Gruppenwechsel erneut aus | W | mittel |  | Ereignisfeld-Merker auf das Feld der neuen Gruppe setzen, sonst loest ihr Feld erneut aus (Osterpatch NRS 2016) | seg049 | offen |
| 351 | Speerfallgrube (Spinnenhöhle): Spielende auch für Gruppen draußen | W | mittel |  | nur diese Gruppe ist verloren; gibt es noch andere Helden, geht das Spiel mit ihnen weiter | seg079 | offen |
| 354 | Gesperrte Türen ohne Meldung, Daspota-Falltür sperrt eine Tür für immer | W | mittel |  | die Daspota-Tuer (0,11,1) ist nur gesperrt, solange die Falltuer per Stein gesichert ist (Bit 0 von gs_dng06_pitdoor_flag); eine gesperrte Tuer meldet sich (Text 837 aus dem Datenpatch 1.2); gs_dng06_pitdoor_flag als Bits: 0x01 Falltuer gesichert, 0x02 Falltuer entdeckt, 0x04 Stein entdeckt. | seg076, seg081 | offen |
| 355 | Schatzlager nur beim ersten Betreten plünderbar (Daspota-Schatz, Zwingfeste) | W | mittel |  | der Daspota-Schatz bleibt pluenderbar; Text, 500 Dukaten und AP nur beim ersten Fund; das Beutelager bleibt pluenderbar (der Rest liegt in gs_dng14_chest_barrel im Spielstand) | seg081, seg087 | offen |
| 357 | Oberorken-Wasserfalle: Raum zu klein, Ertrinken nur an 5-Minuten-Marken | W | mittel |  | der Raum der Wasserfalle umfasst auch das Eingangsfeld (1,3,10), auf dem die Tuer (3,11) hinter der Gruppe zufaellt; steht der Zaehler auf 0, bei jedem Durchlauf auswerten (Meldung und Ertrinken), solange noch; die Helden ertrinken (Leiche und Ausruestung bleiben), statt geloescht zu werden | seg090 | offen |
| 432 | Manrek-Schatzkammertür: Sperre und Eisenschlüssel auf falschem Feld (0,12,8) statt (0,12,7) 💰 | W | mittel |  | die Schatzkammertuer der Manrek-Piratenhoehle steht laut F131.DDT auf (0,12,7), nicht auf (0,12,8): Sperre bis Hebelstellung 4 und Eisenschluessel wirken erst damit; Eisenschluessel fuer die Tuer auf (0,12,7) | seg076 | offen |
| 433 | Totenschiff-Falltüren lösen neben der Grube aus und schieben die Gruppe (bei (1,14,5) in die Wand) | W | mittel |  | die Falltueren loesen auf dem Feld aus, auf dem die Grube entsteht ((1,2,9) und (1,14,5)), | seg077 | offen |
| 81 | KK-Probe zählt Platz 0 ungeprüft | A | gering | BE | die ersten beiden handlungsfaehigen Helden der aktiven Gruppe | seg047 | offen |
| 82 | Gelber Pfeil der aktiven Gruppe wird vom violetten verdeckt | A | gering | BE-Fix | gelben Pfeil zuletzt zeichnen (Bright-Eyes-Fix zu Original-Bug 31) | seg074 | schon in BrightEyes behoben |
| 83 | Sichtprüfung <= 16 lässt eine 17. Spalte neben der Karte zu | A | gering |  | sichtbar sind die Spalten 0..15 | seg074 | offen |
| 85 | Kletter-Meldung nennt Plätze 0, 1, 2 … ohne Gruppenprüfung | A | gering |  | nur die handlungsfaehigen Helden der aktiven Gruppe aufzaehlen (wie count_heroes_available_in_group()) | seg075 | offen |
| 86 | Proben und Hilfen zählen versteinerte und bewusstlose Helden mit (nur !dead geprüft) | A | gering | BE | nur handlungsfaehige Helden (nicht versteinert, bewusstlos ...); nur ein handlungsfaehiger Magier hilft mit dem Stab; nur handlungsfaehige Helden springen (bewusstlose, versteinerte usw. werden getragen); nur handlungsfaehige Helden; nur handlungsfaehige Zauberkundige; versteinerte, bewusstlose usw. Helden kaempfen nicht mit | seg025, seg075, seg081, seg098, seg103, seg117 | offen |
| 89 | Symbol „Gruppen vereinen“ bleibt nach dem Vereinen aktiv | A | gering | BE-Fix | Symbol ausgrauen (Bright-Eyes-Fix zu Original-Bug 19) | seg076 | schon in BrightEyes behoben |
| 93 | Proben und Wirkungen mit get_hero(0) statt dem ersten handlungsfähigen Helden | A | gering | BE-Fix | der erste handlungsfaehige Held klettert; der erste handlungsfaehige Held (Bright-Eyes-Fix zu Original-Bug 66); der erste handlungsfaehige Held, mit seiner Position (vgl. Nr. 254) | seg077, seg078, seg080 | erledigt (Branch bugfixes, Stufe alles; seg078 war schon in BrightEyes) |
| 95 | Totenschiff: Meldung vom sinkenden Schiff kommt nie | A | gering | BE-Fix | leave_dungeon() hat gs_deathtrap schon geloescht (Bright-Eyes-Fix zu Original-Bug 30) | seg077 | schon in BrightEyes behoben |
| 96 | sprintf mit der Zahl 10 statt eines Namens | A | gering | BE-Fix | den Namen statt der Zahl 10 einsetzen (Bright-Eyes-Fix) | seg077 | schon in BrightEyes behoben |
| 98 | Klebriger Boden: „GELINGT ES, SICH LOSZUREISSEN“ nur nach einem Fehlversuch | A | gering | BE-Fix | die Befreiungsmeldung immer zeigen (Bright-Eyes-Fix zu Original-Bug 65) | seg078 | erledigt (Branch bugfixes, Stufe alles) |
| 101 | „IHR HÖRT EIN KNIRSCHEN“ auch bei schon offener Wand | A | gering | BE | nur melden, wenn die Wand noch steht | seg078 | offen |
| 107 | Absturz in den Abgrund: hero_disappear() mit Position 0 | A | gering |  | die Position des abgestuerzten Helden | seg080 | offen |
| 108 | Ratten beißen auch tote Helden | A | gering | BE | keine toten Helden | seg080 | offen |
| 109 | Armbrustfalle zählt nur Platz 0 und 1 | A | gering |  | die ersten beiden handlungsfaehigen Helden der Gruppe treffen | seg081 | offen |
| 113 | Hilferuf aus der Grube jede Minute statt alle 20 Minuten | A | gering |  | alle 20 Minuten | seg084 | offen |
| 115 | Loser Stein: Zustand „entfernt“ wird überschrieben | A | gering |  | den Zustand "Stein entfernt" (2) nicht ueberschreiben | seg085 | offen |
| 116 | Trittplatte wirkt nur beim Entschärfen | A | gering | BE | gs_dng10_floorplate_found als Bits (0x01 entdeckt, 0x02 entschaerft; alter Wert 1 = entdeckt). | seg085 | offen |
| 347 | Dungeonlicht: Lichtquellen anderer Gruppen zählen mit | A | gering |  | nur Lichtquellen der aktiven Gruppe zaehlen | seg106 | offen |
| 352 | Giftdorn-Truhe nach sechs Ladungen ohne Text | A | gering |  | leere Giftdorn-Truhe meldet sich wie eine verschlossene Truhe (TEXT.LTX 519) | seg079 | offen |
| 353 | Spinnenaltar: Auswahl ohne „später“, Text und Kampf wiederholen sich (dort teilweise) | A | gering |  | mit Kristallen gibt es zusaetzlich "SPAETER NOCHMAL KOMMEN." (Text 29); Antwort 3 beendet ohne Wirkung | seg079 | offen |
| 358 | Oberorken-Wasserraum: Türen beliebig oft knacken (je 1 AP) 💰 (dort teilweise) | A | gering |  | die Tuer faellt nur zu, solange die Wasserfalle aktiv ist (danach kein Wiederverschliessen und kein erneutes Knacken); auch die Tuer (3,6) faellt nur bei aktiver Wasserfalle zu | seg090 | offen |
| 361 | Runin: Drachenhort und Platinschlüssel-Auftrag unabhängig 💰 (dort teilweise) | A | gering |  | den magischen Wurfdolch gibt es nur noch als Lohn des Drachen fuer den Platinschluessel, | seg085 | offen |
| 434 | Speerfallgrube der Spinnenhöhle: eine Stunde Herausklettern auch, wenn niemand gestürzt ist | A | gering |  | ist niemand gestuerzt, muss auch niemand eine Stunde lang aus der Grube klettern | seg079 | offen |
| 435 | Runin: loser Stein vor dem Hebel (0,8,1) gilt erst nach Betätigen des Hebels als entfernt | A | gering |  | der Stein ist schon mit dieser Antwort entfernt; beim naechsten Besuch kommt Text 41 ("...WO IHR VORHIN DEN STEIN ENTFERNT HABT"), auch ohne den Hebel zu betaetigen | seg085 | offen |

## Städte & Orte (46)

| Nr | Fehler | Stufe | Schwere | Herkunft | Änderung dort | Dateien | Status |
|---:|---|:---:|---|---|---|---|---|
| 40 | ⚑ Einbruch: „noch jemand frei?“ zählt die gerade erwischte Gruppe mit | W | krit. |  | nur Helden anderer Gruppen zaehlen, die aktive wird ja gerade verhaftet | seg025 | erledigt (Branch bugfixes) |
| 67 | Zwingfeste: bei jedem Betreten 20 Dukaten 💰 | W | krit. | BE-Fix | das Geld gibt es nur einmal (Bright-Eyes-Fix); der Zugang haengt weiter an !gs_dng14_ugdalf_done | seg068 | schon in BrightEyes behoben |
| 39 | Akademie identifiziert und bricht Flüche nur ein einziges Mal im Spiel | W | mittel | BE | Akademie identifiziert und bricht Flueche am naechsten Tag wieder | seg002 | offen |
| 43 | Statusleiste setzt 6 statt 4 Werte je Held, beim NSC wird die Krankheitstabelle überschrieben 💰 | W | mittel | BE | das Feld hat 4 Werte je Held (sonst wird beim NSC g_disease_strength ueberschrieben) | seg029 | offen |
| 45 | Nicht vorhandene Antworten werden mitgemischt | W | mittel |  | fehlende Antworten auf txt_offset setzen, dann schuetzt sie die Pruefung beim Mischen | seg031 | offen |
| 48 | Brauender NSC bleibt in der Herberge stecken | W | mittel | BE-Fix | auch den NSC (Platz 6) finden (Bright-Eyes-Fix) | seg054 | schon in BrightEyes behoben |
| 49 | NSC kann in der Herberge nicht zaubern, magic_act[6] schreibt hinter das Feld | W | mittel | BE-Fix | Platz fuer den NSC (Bright-Eyes-Fix) | seg054 | schon in BrightEyes behoben |
| 50 | Brauende Helden: Einzelheld sieht sie nicht, nur der erste wird gefragt | W | mittel | BE-Fix | eine Gruppe mit der aktiven vereinen (der Rumpf von GRP_merge() fuer eine einzelne Gruppe); jeden brauenden Helden im Haus einzeln behandeln, auch beim Einzelhelden; nur die | seg054 | schon in BrightEyes behoben |
| 51 | Nach dem Abholen gelten zusammengeführte Brauer weiter als „brauend“ | W | mittel | BE | eine Gruppe mit der aktiven vereinen (der Rumpf von GRP_merge() fuer eine einzelne Gruppe); jeden brauenden Helden im Haus einzeln behandeln, auch beim Einzelhelden; nur die | seg054 | offen |
| 52 | Herberge: Preisaufschlag für Einzelzimmer und Suite vom Schlafsaalpreis berechnet | W | mittel |  | Aufschlag vom eigenen Preis | seg054 | offen |
| 53 | „Besonders guter Preis“ beim Händler verschlechtert den Verkauf (dort teilweise) | W | mittel |  | der "besonders gute Preis" darf den Verkauf nicht verschlechtern; gelungenes Feilschen verschlechtert den Verkauf nicht mehr | seg055 | offen |
| 54 | Einkaufskorb: Platzbedarf falsch berechnet | W | mittel | BE | Stapelbarkeit des Korbeintrags, 99 Stueck je Platz; die zusaetzlich gekaufte Ware mitzaehlen; die neue Ware mitzaehlen | seg056 | offen |
| 59 | Taverne im Gespräch: Runde und Essen werden in Heller statt Silber abgezogen 💰 | W | mittel |  | der Preis ist in Silbertalern genannt, das Geld wird in Hellern gefuehrt; Silberstuecke wie in do_tavern(), also mal 10 Heller | seg060 | offen |
| 63 | Firun-Wunder „keinen Hunger und Durst mehr“ wirkt nur auf einen Helden | W | mittel |  | alle Helden der Gruppe sind satt (der Text spricht alle an) | seg062 | offen |
| 65 | Straßenhändler überschreibt den Typ des gerade betretenen Gebäudes 💰 | W | mittel | BE-Fix | Gebaeudetyp sichern (Bright-Eyes-Fix, Original-Bug 24); Gebaeudetyp zurueckschreiben | seg067 | schon in BrightEyes behoben |
| 66 | Zeughaus: Störrebrandt-Schulden werden aus dem Staatsbudget bezahlt 💰 (dort teilweise) | W | mittel |  | im Zeughaus wird mit dem Budget des Hetmanns eingekauft, keine Schuldenabfrage | seg055 | offen |
| 68 | Akademie erkennt einen Fluch beim Helden auf Platz 0 nicht | W | mittel |  | -1 = niemand verflucht, damit auch Platz 0 erkannt wird | seg068 | offen |
| 72 | Spielhaus: Gewinn und Verlust vertauscht 💰 | W | mittel | BE-Fix | verloren wird, wenn hoechstens die Haelfte beim Falschspiel Erfolg hatte (Bright-Eyes-Fix) | seg070 | schon in BrightEyes behoben |
| 76 | Informanten werden von „erledigt“ (2) auf „bekannt“ (1) zurückgesetzt | W | mittel | BE | Isleif nur von 0 auf 1 setzen; wer ihn vor dem Auftrag schon besucht hat (2), behaelt "erledigt"; wie oben, "erledigt" (2) nicht zuruecksetzen; Isleif nur von unbekannt (0) auf bekannt (1) setzen, "erledigt" (2) bleibt erhalten; einen Informanten nur von 0 (unbekannt) auf 1 (bekannt) setzen, nicht von 2 (erledigt) zurueck | seg069, seg116, v302de.h | offen |
| 337 | Schmied Gurthag nach dem Kellerausgang dauerhaft unbenutzbar | W | mittel |  | Gurthag bleibt nach dem Kellerausgang nutzbar; beim Reden kommt weiter sein Kellerausgang-Dialog (Osterpatch NRS) | seg058 | offen |
| 339 | Akademie: Bezahlung mit erstem gleichen Stück, auch kaputt 💰 | W | mittel |  | das Stueck, das academy_get_equal_item() angeboten hat: erstes heiles Stueck dieser Art,; mit dem angebotenen (heilen) Stueck bezahlen, nicht mit dem ersten gleichen | seg068 | offen |
| 341 | Treborn Kolberg erscheint nach Algrids Hinweis nie, Olvir/Treborn wiederholt sich | W | mittel |  | Treborn erscheint, solange er nicht getroffen ist (Merker < 2); "bekannt" (1, von Algrid) sperrt nicht mehr.; "getroffen" als 2 fuehren (Osterpatch NRS); die Begegnung nur einmal je Reise | seg072, seg094 | offen |
| 426 | Spiel laden im Tempel: leave_location() läuft über den geladenen Spielstand | W | mittel |  | liegt der geladene Stand nicht in einem Tempel, sofort zurueck: keine Tempel-Ortszeile und kein leave_location() ueber den geladenen Stand (dreht sonst die Blickrichtung, setzt die Position zurueck) | seg061 | offen |
| 437 | Gruppenwechsel in eine Gruppe, die schon in einem Ort steht: Statuszeile und Herberge der alten Gruppe | W | mittel |  | Ort der neuen Gruppe wie beim Betreten (enter_location) aus dem Ortsverzeichnis ihrer Stadt | seg049 | offen |
| 41 | Verhaftung nur ab Platz 0, solange die Plätze zur Gruppe gehören | A | gering |  | alle 7 Plaetze der aktiven Gruppe verhaften (auch den NSC) | seg025 | offen |
| 46 | Tempel: bei 20, 30, … Helden eine leere Seite | A | gering |  | auch bei genau 20, 30, ... Helden zurueck zur ersten Seite | seg047 | offen |
| 47 | leave_location() dreht die Gruppe auch dort um, wo sie nicht umdrehen soll (dort teilweise) | A | gering | BE-Fix | Drehung nach dem Lager zuruecknehmen (Bright-Eyes-Fix zu Original-Bug 26); Drehung von leave_location() zuruecknehmen (Bright-Eyes-Fix zu Original-Bug 27) | seg052, seg067 | schon in BrightEyes behoben (wie dort nur teilweise) |
| 56 | Schmied zeigt das Geld des Helden, bezahlt wird aus der Gruppenkasse | A | gering |  | das Geld der Gruppe zeigen, daraus wird bezahlt | seg058 | offen |
| 57 | Bei genau passendem Geld Feilschprobe für 0 % | A | gering |  | auch bei genau passendem Geld | seg058 | offen |
| 60 | Trinkprobe über Plätze 0..n−1 statt über die Gruppenmitglieder | A | gering |  | alle 7 Plaetze durchgehen, Zustand 109 prueft die Gruppe; nur Helden der aktiven Gruppe | seg060 | offen |
| 61 | Praios-Wunder: Prüfung auf Zauberkundige wirkungslos | A | gering | BE-Fix | alle Helden der Gruppe pruefen, ein Zauberkundiger verhindert das Praios-Wunder (Bright-Eyes-Fix) | seg062 | erledigt (Branch bugfixes, Stufe alles; BrightEyes prüfte nur Plätze 0…n−1) |
| 62 | Praios und Hesinde heben Verwandlungen auch bei fremden Gruppen auf | A | gering |  | nur Helden der aktiven Gruppe ohne Goetterzorn (wie im renegade-Zweig) | seg062 | offen |
| 64 | Taschendieb: falsche Textteile, das Ende „Dieb entkommt“ erscheint nie | A | gering |  | Texte 24, 25, 29, 30 (26..28 sind die dreiteilige Geschichte oben) | seg067 | offen |
| 69 | Fluchbrechung: Text 63 erscheint mit „%s“ | A | gering |  | den Namen des verfluchten Helden einsetzen | seg068 | offen |
| 70 | Göttergunst über Index 0..13 statt 1..14 | A | gering |  | Goetter 1..14 (Praios bis Ifirn) | seg069, seg082, seg084 | offen |
| 71 | ESC ruft GUI_radio() mit −1 Optionen auf | A | gering | BE-Fix | eigene Variable fuer die Antwort, answer bleibt die Zahl der Optionen (Bright-Eyes-Fix) | seg070 | schon in BrightEyes behoben |
| 77 | Rückgabewert bleibt oft uninitialisiert | A | gering | BE | vorbelegen, sonst wird ein Stapelwert zurueckgegeben | seg073 | offen |
| 78 | Harikas Feilschbonus auch, wenn sie nicht dabei ist | A | gering |  | Harika hilft nur, wenn sie in der aktiven Gruppe und handlungsfaehig ist | seg103 | offen |
| 332 | Öffnungszeit 8–19 Uhr gilt auch für Straßenhändler und Treborn Kolberg | A | gering |  | Strassenhaendler und Treborn Kolberg haben keine Ladenzeiten | seg055 | offen |
| 334 | Beleidigter Wirt wirft nicht hinaus | A | gering |  | hat der Wirt die Gruppe hinausgeworfen, spricht er sie an (Dialog im Rauswurf-Zustand) und sie muss gehen; wirft der Wirt im Gespraech hinaus, verlaesst die Gruppe die Herberge | seg054 | offen |
| 336 | Essen in der Taverne verbraucht zusätzlich Proviant | A | gering |  | erst essen, dann die Stunde vergehen lassen (sonst isst herokeeping() vorher Proviant) | seg059 | offen |
| 338 | Treborn Kolbergs Laden: Ortszeile leer oder fremd | A | gering |  | auch Treborn Kolbergs Laden (unterwegs) heisst "STRASSENHAENDLER", nicht wie ein Ort der Stadt-LTX; bei Treborn Kolberg fuehrt "Reden" zurueck in sein Gespraech, kein Haendlerdialog im laufenden Dialog; der Laden ueberschreibt Text und Kopfbild des laufenden Gespraechs: INFO6.TLK (wie do_talk(11, 0)) und Treborns Kopf neu laden | seg055, seg072 | offen |
| 343 | Taverne: Gewinn wird als unsinnige Ausgabe angezeigt | A | gering |  | nur eine Ausgabe anzeigen, keinen Gewinn | seg059 | offen |
| 425 | Tavernenschlägerei schreibt über gs_town_outlawed_flags hinaus in die Rauswurf-Merker der Herbergen | A | gering |  | Merker je Stadt wie in TLK_inn; mit dem Tavernen-Index (bis 87) schrieb die Schlaegerei ueber das Feld (52 Byte) hinaus in die Rauswurf-Merker der Herbergen (mit Fix 334 noetig); wie oben (Zustand 33) | seg060 | offen |
| 438 | Hauswände auf der linken Straßenseite zeigen die Fassade verkehrt herum | A | gering |  | eine Spalte einer Hauswand (Farbe 128 = durchsichtig) holen und ihren sichtbaren Bereich bestimmen; Spalte x neu fuellen: der sichtbare Bereich [t, b] bekommt den Inhalt der Quellspalte c ([ct, cb]); Seitenwand in richtiger Reihenfolge. Attic hat jede Seitenwand nur einmal gezeichnet, und zwar mit | seg066 | offen |
| 439 | Tempel zeigen von der Seite eine Fachwerkwand statt ihrer Front | A | gering |  | Eingangsseite eines Tempels von der Seite: aus der Tempelfront erzeugen; Seitenansicht der Tempelfront. Attic hat fuer Tempel nur die Frontansicht gezeichnet (TDIVERSE.NVF Bild 5,; 252 = Seitenwand an der Eingangsseite eines Tempels (Umriss aus Haustyp 3, siehe fix_tempelseite) | seg066 | offen |

## Helden & Werte (40)

| Nr | Fehler | Stufe | Schwere | Herkunft | Änderung dort | Dateien | Status |
|---:|---|:---:|---|---|---|---|---|
| 235 | ⚑ Zufallsheld aus Plätzen 0..n−1 statt aus den Gruppenmitgliedern | W | krit. | BE | alle 7 Plaetze wuerfeln (auch den NSC); ohne lebenden Helden der Gruppe keine Endlosschleife | seg002 | erledigt (Branch bugfixes) |
| 244 | ⚑ Gruppenwechsel ohne Ausgang, wenn keine Gruppe frei handeln kann | W | krit. |  | nach einer vollen Runde ohne handlungsfaehige Gruppe nicht endlos weitersuchen: | seg049 | erledigt (Branch bugfixes) |
| 248 | Stufenanstieg: ESC bei „WELCHE POSITIVE EIGENSCHAFT“ bringt rund 168 000 Dukaten 💰 | W | krit. |  | Abbruch (ESC, rechte Maustaste) wiederholt die Abfrage | seg050 | offen |
| 260 | ⚑ Suche nach freier Gruppe ohne Grenze | W | krit. | BE | erste freie der 6 Gruppen, -1 wenn alle belegt sind; Abtrennen nur anbieten, wenn eine der 6 Gruppen frei ist | seg104 | erledigt (Branch bugfixes) |
| 401 | ⚑ Entlassene Helden hinterlassen Lücken in den Heldenplätzen | W | krit. |  | die Heldenplaetze wieder lueckenlos sortieren (viele Stellen setzen das voraus) | seg061 | erledigt (Branch bugfixes; ändert die Heldenplätze im Spielstand) |
| 229 | h_index wird nur einmal vor der Schleife auf −1 gesetzt | W | mittel |  | Held fuer jeden Timer neu suchen | seg002 | offen |
| 233 | Heil-, Stab- und Lichttimer runden kleine Zeitsprünge weg | W | mittel | BE | den Rest der angebrochenen 5 bzw. 15 Minuten mitrechnen | seg002 | offen |
| 234 | Stundenzählung für Kettenhemd-Schaden und Essen falsch | W | mittel | BE | Zahl der ueberschrittenen vollen Stunden | seg002 | offen |
| 238 | Erneute Vergiftung löscht die Protokollbytes | W | mittel | BE | die Protokollbytes der erlittenen Verluste nur bei einem gesunden Helden loeschen, | seg047 | offen |
| 240 | Erneute Erkrankung löscht die Protokollbytes, Verluste werden dauerhaft | W | mittel | BE | die Protokollbytes der erlittenen Verluste nur bei einem gesunden Helden loeschen, | seg047 | offen |
| 243 | Gruppe teilen klappt nicht richtig, wenn der NSC in einer anderen Gruppe ist | W | mittel | BE-Fix | handlungsfaehige Helden der aktiven Gruppe ohne den NSC (Platz 6) zaehlen; den NSC nicht mitzaehlen, egal in welcher Gruppe er ist (Bright-Eyes-Fix) | seg049 | schon in BrightEyes behoben |
| 249 | Stufenanstieg: ESC bei „WELCHE NEGATIVE EIGENSCHAFT“ senkt die Intuition | W | mittel |  | Abbruch (ESC, rechte Maustaste) wiederholt die Abfrage | seg050 | offen |
| 250 | MR-Neuberechnung beim Stufenanstieg verträgt sich nicht mit MR-Gegenständen | W | mittel |  | mit dem Grundwert vergleichen; die Boni der MR-Gegenstaende so aufschlagen wie | seg050 | offen |
| 253 | Spielende: Merker für bleibenden LE-Verlust wird gelöscht, LE-Maximum bleibt gesenkt | W | mittel | BE-Fix | den Merker fuer den bleibenden LE-Verlust behalten (das LE-Maximum bleibt ja gesenkt), | seg065 | in BrightEyes anders behoben (LE-Maximum wird beim Spielende wiederhergestellt) |
| 254 | set_mod_slot() mit who = 0 für einen anderen Helden | W | mittel |  | who = Position dieses Helden; Position des betroffenen Helden als Besitzer eintragen | seg080, seg115 | offen |
| 255 | Harikas Abschiedsgeschenk kostet Steigerungsversuche | W | mittel | BE | Steigerungsversuche sichern, inc_talent_novice() zieht sie ab | seg095 | offen |
| 256 | Entlassene NSC kommen nie wieder | W | mittel | BE | Zustand des NSC vor dem Loeschen merken, sonst wird der Timer immer -1 | seg095 | offen |
| 259 | Brauen: Abtrennen des einzigen Helden einer Gruppe möglich | W | mittel | BE-Fix | handlungsfaehige Helden der aktiven Gruppe ohne NSC (wie count_heroes_available_in_group_ignore_npc(); nur abtrennen, wenn in der aktiven Gruppe noch ein handlungsfaehiger Held bleibt | seg104 | schon in BrightEyes behoben |
| 264 | Verschwundener NSC: Datei und Timer um eins verschoben | W | mittel |  | Datei und Timer des NSC selbst (npc_id 1..6, wie add_npc()/remove_npc()) | seg113 | offen |
| 269 | Paralyse und Frostschäden: Erholung mit umgekehrter Bedingung | W | mittel | BE | FIX_0269 = 1 dreht die Bedingung um (Verlust vorhanden -> zurueckgeben) | seg119 | offen |
| 270 | Schlachtfeldfieber endet nie | W | mittel | BE | nach der Rueckgabe der KK wird der Held gesund | seg119 | offen |
| 273 | Tollwut: Beruhigen und Sanftmut werten misslungene Proben als Erfolg | W | mittel | BE | nur handlungsfaehige Helden der Gruppe, CH-Probe gelungen (> 0); nur eine gelungene Probe (> 0) beruhigt | seg120 | offen |
| 274 | Shurinknollengift und Bannstaub: Rückgabe der Werte fast nie | W | mittel |  | alle 12 Takte (Klammern um den Rest) | seg121 | offen |
| 402 | Aufgesparte Zaubersteigerungen laufen über 127 💰 | W | mittel |  | aufgesparte Zaubersteigerungen hoechstens 127 (signed char); hoechstens 127 (signed char) | seg050 | offen |
| 404 | Elixiere stapeln sich ohne Obergrenze 💰 | W | mittel |  | laufende Elixierwirkung (+5) auf derselben Eigenschaft des Helden suchen, -1 wenn keine; wirkt schon ein Elixier auf diese Eigenschaft, nur seine Dauer erneuern (kein weiteres +5) | seg108 | offen |
| 230 | Aufräumen ungültiger Ziele setzt nur den aktuellen Eintrag zurück | A | gering |  | alle Eintraege des ungueltigen Ziels zuruecksetzen | seg002 | offen |
| 231 | Notbehelf bei 100 belegten Timern versagt im Kampf | A | gering |  | auch im Kampf (g_timers_disabled) wirklich freigeben | seg002 | offen |
| 237 | BP-Anzeige bei Last ab 110 % falsch | A | gering | BE | ab 110 % Last nur 1 BP, wie im Kampf (FIG_do_round) | seg046 | offen |
| 242 | Ohne wählbaren Helden: Textbreite bleibt 3, geliefert wird Platz 0 (dort teilweise) | A | gering |  | Textbreite zuruecksetzen; die Rueckgabe bleibt 0 (die Aufrufer pruefen nicht auf -1) | seg047 | offen |
| 245 | Nachtwache folgt beim Tauschen nur einem der beiden Helden | A | gering |  | auch die Wache des zweiten Helden mitnehmen; auch die Wache auf dem Zielplatz mitnehmen | seg049 | offen |
| 246 | Regeneration: Ergebnis 0 bleibt 0, −1 wird zu 1 | A | gering | BE | auch Ergebnis 0 auf 1 setzen | seg049 | offen |
| 251 | Zaubersteigerung: Zähler i wird je Runde nicht zurückgesetzt | A | gering |  | jede Runde wieder beim ersten Zauber beginnen | seg050 | offen |
| 252 | Zufallszauber 1..86 statt 1..85 | A | gering |  | nur echte Zauber 1..SP__END-1 | seg050 | offen |
| 258 | Misslungene Wundheilung setzt Wundfieber ohne Prüfung | A | gering | BE | eine laufende Erkrankung oder Genesung nicht von vorn beginnen | seg103 | offen |
| 263 | Textdatei wird bei totem Patienten nicht zurückgeladen | A | gering |  | Textdatei auch bei nicht heilbarem Patienten zurueckladen | seg104 | offen |
| 265 | Verschlimmerung zu Blauer Keuche mit 4 statt 5 % | A | gering |  | 5 % wie vorgesehen | seg119 | offen |
| 266 | Nach dem Wechsel zu Blauer Keuche noch Dumpfschädel-Schaden am selben Tag | A | gering |  | nach der Verschlimmerung keinen Dumpfschaedel-Schaden mehr | seg119 | offen |
| 403 | Stufenaufstieg erst ab 101 statt 100 AP | A | gering |  | Aufstieg schon bei genau der geforderten AP-Zahl | seg002 | offen |
| 405 | Angriffsart bleibt nach dem Kampf im Helden stehen | A | gering |  | Angriffsart (aggressiv/vorsichtig) nicht in den naechsten Kampf mitnehmen | seg032 | offen |
| 407 | Gruppengeld: Rest der Teilung verfällt | A | gering |  | der NSC allein bekommt den Betrag, nicht dazu; der Rest der Teilung geht an den ersten Helden | seg002 | offen |

## Gegenstände & Inventar (18)

| Nr | Fehler | Stufe | Schwere | Herkunft | Änderung dort | Dateien | Status |
|---:|---|:---:|---|---|---|---|---|
| 214 | Magisches Bastardschwert ist als „benutzbar“ markiert (dort teilweise) | W | krit. | BE | Gegenstaende mit Nummer ausserhalb der Benutzen-Tabelle (magisches | seg107 | offen |
| 221 | ⚑ Zufälliger Gegenstandsverlust: Endlosschleife ohne ablegbaren Gegenstand | W | krit. | BE | ohne ablegbaren Gegenstand nichts verlieren (sonst Endlosschleife) | seg105 | erledigt (Branch bugfixes) |
| 222 | Tausch zweier Körperplätze ohne Prüfung und Boni 💰 | W | krit. |  | Meldung "... KANN AN DIESER POSITION NICHT GETRAGEN WERDEN" (wie in move_item()); liegen beide Plaetze am Koerper, auch den verdraengten Gegenstand pruefen | seg106 | offen |
| 218 | Analüs verspricht Wirkungen magischer Gegenstände, die es nicht gibt (dort teilweise) | W | mittel | BE | der gruene Ring (Schutz vor magischem Feuer) bewahrt vor den verbrannten Haenden | seg085 | offen |
| 220 | Zähler der belegten Inventarplätze driftet | W | mittel | BE | Stapel hoechstens 99, beim Zusammenlegen den Platzzaehler senken; neuer Stapel beim Empfaenger belegt einen Platz | seg106 | offen |
| 225 | Laterne nachfüllen: Öl beim letzten Zauberer gesucht, beim Benutzer entfernt | W | mittel | BE | Oel und Laterne beim Benutzer suchen, nicht beim letzten Zauberer | seg107 | offen |
| 216 | Truhenliste: 20 Byte je Name zu kurz | A | gering |  | 30 Byte je Name wie in loot_simple_chest() | seg092 | offen |
| 217 | Mengenabfrage lässt sich nicht abbrechen | A | gering |  | ESC (oder eine negative Eingabe) nimmt nichts mit | seg092 | offen |
| 223 | Wasserschlauch in der Hand wird nicht gefunden | A | gering | BE | auch den Wasserschlauch in der Hand finden | seg106 | offen |
| 224 | Waffengift: Schleuder wird nicht ausgeschlossen | A | gering | BE | auch die Schleuder ist eine Fernwaffe | seg107 | offen |
| 226 | Tarnele: Meldung ohne Text (dort teilweise) | A | gering |  | keinen alten Text zeigen; ein leerer Text oeffnet kein Fenster | seg108 | offen |
| 227 | Antikrankheitselixier ohne Krankheit schreibt in disease[0] | A | gering |  | ohne Krankheit nichts aendern (disease[0] ist unbenutzt) | seg108 | offen |
| 390 | Unzerbrechliche Waffen können zerbrechen (Held gegen Held, Curians Stab) (dort teilweise) | A | gering |  | Zauberstab, Hexenbesen, magische Orknase, magisches Kurzschwert und Grimring sind unzerbrechlich (bf -99),; unzerbrechliche Gegenstaende vor den Bruchpruefungen auf bf -99 setzen (Curians Stab); unzerbrechliche Waffe (bf -99) des Angegriffenen bleibt unzerbrechlich; unzerbrechliche Gegenstaende (wie in seg042) auch bei der Parade gegen Gegner auf bf -99 setzen (Curians Stab); vor der Bruchpruefung der Parade; unzerbrechliche Waffen (Zauberstab, Hexenbesen, magische Orknase, magisches Kurzschwert, Grimring) zerbrechen; unzerbrechliche Waffen zerbrechen nicht (bf > 0 bleibt Bedingung) | seg042, seg043, seg100, seg102 | offen |
| 394 | Wegwerfen: höchstens 99 Stück, Mengenabfrage auch bei einem Stück | A | gering |  | bei einem einzelnen Stueck nicht nach der Menge fragen | seg105 | offen |
| 397 | Tausch zwischen Helden prüft nur die Traglast des Empfängers 💰 | A | gering |  | beim Tausch auch die Traglast des Gebenden pruefen, wenn er dadurch schwerer wird | seg106 | offen |
| 398 | Zweihänder von rechter in linke Hand: falsche Meldung | A | gering |  | Tausch zwischen den Haenden kann keine Zweihandkollision ergeben | seg106 | offen |
| 400 | Waffengift über BENUTZEN umgeht die Klassensperre | A | gering |  | Klassensperre (z. B. Krieger und Gifte) auch beim Benutzen pruefen | seg107 | offen |
| 418 | Schatzkarte: wer nur Hjores Kartenteil 9 hat, bekommt „keine Kartenteile gefunden“ | A | gering |  | Hjores Kartenteil 9 zaehlt bei der Pruefung mit, ob ueberhaupt ein Teil da ist (gezeichnet wird es ja auch) | seg025 | offen |

## Technik & Oberfläche (20)

| Nr | Fehler | Stufe | Schwere | Herkunft | Änderung dort | Dateien | Status |
|---:|---|:---:|---|---|---|---|---|
| 309 | Fehlgeschlagener Start von GEN.EXE: Spiel läuft ohne Puffer weiter | W | krit. |  | nach dem Aufraeumen beenden statt ohne Puffer weiterzulaufen | seg120 | entfällt (Web: eigene Heldenerschaffung) |
| 414 | ⚑ Einhorn: Held als Zeiger im Spielstand (dort teilweise) | W | mittel |  | Heldenzeiger aus der gespeicherten Heldenposition neu setzen, der Speicherzeiger im Spielstand gilt nach dem Laden nicht mehr | seg116 | erledigt (Branch bugfixes) |
| 275 | Übertrag der Subtraktion fehlt im High-Word der Titellänge | A | gering |  | 32 Bit rechnen, der Uebertrag geht ins High-Word | seg001 | offen |
| 280 | Bright-Eyes-Fix für die AE-Leiste prüft den falschen Merker | A | gering | BE | AE-Leiste ausserhalb des Kampfes im 3D-Bildschirm neu zeichnen | seg002 | offen |
| 281 | Anschnitt oben vergrößert die Bildhöhe, statt sie zu verkleinern (3 Stellen) | A | gering |  | Anschnitt oben verkleinert die Hoehe | seg003, seg066, seg075 | offen |
| 282 | Wanduhr: Position läuft bis 84, Tabelle hat nur 81 Werte | A | gering | BE | Teiler 810 = HOURS(12) / 80, die Positionen bleiben in 0..80 | seg004 | erledigt (BrightEyes 2b9735db) |
| 284 | Zufallszahl kann 0 oder negativ werden | A | gering |  | ohne Vorzeichen rechnen (__abs__(-32768) bleibt negativ); Startwert wie bisher | seg007 | offen |
| 287 | Leeres Tagebuch: Vergleich mit gs_diary_entries[−1] | A | gering |  | bei leerem Tagebuch nicht mit gs_diary_entries[-1] vergleichen | seg024 | erledigt (BrightEyes b5b343b3) |
| 288 | Kopierhöhe line * 7 statt (line − startline) * 7 | A | gering |  | nur die gedruckten Zeilen kopieren | seg024 | offen |
| 289 | Speichern: do-while ohne Prüfung von findfirst | A | gering |  | nur anhaengen, wenn findfirst() etwas gefunden hat | seg026 | offen |
| 292 | Stadtdatei: liest 100 Byte mehr, als g_locations_tab fasst | A | gering |  | nur so viel lesen, wie g_locations_tab fasst | seg028 | offen |
| 293 | Kein break nach dem Fund | A | gering | BE-Fix | nach dem Fund aufhoeren (Bright-Eyes-Fix) | seg031 | schon in BrightEyes behoben |
| 294 | Bereichsprüfung clip_num > max statt >= max | A | gering |  | gueltig sind 0..clip_num_max-1; gueltig sind 0..ani_max_num-1 | seg036, seg037, seg044 | offen |
| 296 | Dukaten-Anzeige läuft ab 32768 D über | A | gering | BE | ab 32768 Dukaten die Dukaten als long ausgeben (Format "%dD %dS %dH": ab Zeichen 2 folgt "D ...") | seg047 | offen |
| 298 | Lesen vor g_hero_pic_posx bei Maus-x < 3 | A | gering |  | nicht vor die Tabelle lesen (Ergebnis wie bisher, hoechstens 0) | seg049 | offen |
| 299 | Kartenwerte ab 0xf0 lesen hinter die Tabelle | A | gering |  | nicht hinter die Tabelle lesen (Ergebnis bleibt 12) | seg066 | offen |
| 304 | Spielstandname bearbeiten: Schreibstelle hinter dem Namen | A | gering |  | nur die Zeichen des alten Namens ausgeben, Schreibstelle direkt dahinter | seg097 | offen |
| 306 | Abfrage „WIE VIELE DER … SOLLEN …“ im falschen Fall | A | gering | BE | WIE VIELE DER ... verlangt den 2. Fall | seg106 | offen |
| 308 | Speichermeldung nennt 5000 Byte zu wenig | A | gering |  | der wirkliche Fehlbetrag | seg120 | offen |
| 410 | Kampfmusik läuft nach direkt gestarteten Dungeonkämpfen weiter | A | gering |  | im Dungeon nach jedem Kampf wieder die Dungeonmusik (bisher nur in DNG_fight()) | seg032 | offen |

## Dort bewusst nicht behoben (108)

Aus `Werkzeuge/fix_schalter.tsv` des Projekts (Begründung gekürzt), dazu unsere Einschätzung (grob nach Stichworten der Begründung eingeteilt, beim Angehen prüfen). Ausführlich: `Bauen/FIXES.md` dort.

- **nativ machbar** (15): Hürde gilt nur für die byte-gleiche DOS-EXE (kein Platz im Segment, Tabelle im Datensegment darf nicht wachsen bzw. sich nicht ändern); bei uns ist das Code in BrightEyes → Kandidaten.
- **Spielstand-Format** (9): braucht neue oder geänderte Felder im Spielstand; bei uns nur, wenn das DOS-Format (datseg_status.h) gleich bleibt.
- **Umbau** (6): größerer Umbau der Spiellogik.
- **Absicht unklar** (46): Regel- oder Balancefrage, nicht eindeutig ein Fehler → Entscheidung nötig.
- **Spieldaten/Texte** (13): Fehler in den Spieldaten oder es fehlt ein Spieltext; Spieldaten liefern wir nicht aus → nur mit eigenem Text der Seite denkbar.
- **folgenlos** (19): ohne sichtbare Wirkung → nicht nötig.

### nativ machbar (15)

| Nr | Fehler | Schwere | Begründung dort | Status |
|---:|---|---|---|---|
| 2 | Wurfwaffe Schneidzahn hat keine Entfernungstabelle | mittel | braucht eine Fernkampftabelle im Datensegment | offen |
| 139 | Hafen Hjalsingor: Route nach Overthorn fehlt in der Liste | mittel | die Hafenliste steht im Datensegment (Tabelle g_harbors_linked_sea_routes_10) | offen |
| 140 | Hafen Leuchtturm Runin verweist auf eine Landweg-Liste | mittel | die Hafentabelle g_harbors steht im Datensegment | offen |
| 146 | Axt-Liste für Reiseereignisse | mittel | die Axt-Liste liegt im Datensegment; welche Aexte gemeint sind, ist ausserdem nicht belegt | offen |
| 345 | Kampf auf Spezialfeldern startet erst nach Drehen oder Menü | mittel | der Kampf startet beim ersten Drehen oder Menue; ihn schon beim Ankommen auszuloesen braucht einen eigenen Merker (Datensegment) fuer alle Wege (Treppe, … | offen |
| 4 | Doppelgegner überschreibt beim Zug über eine Leiche deren Feldinhalt | gering | residentes Modul seg005 hat keinen Platz (die Behebung wuerde das Segment um 6 Byte verlaengern, dort gibt es keinen toten Code zum Ausgleich) | offen |
| 29 | Geworfene Waffen werden nur als Gegenstandsnummer gemerkt | gering | braucht Platz fuer ganze Inventareintraege und Besitzer je Wurf - neue Daten im Datensegment | offen |
| 175 | Landschaft 7 liest hinter die 7 Spalten der Begegnungstabelle | gering | Tabelle im Datensegment; welche Landschaft fuer Typ 7 gemeint war, ist nicht belegt (mit Fix 181 liest Typ 7 weiter die verschobene Spalte) | offen |
| 204 | Hexenknoten: Grafikfehler beim zweiten Wirken | gering | Breite/Hoehe und das Zuruecksetzen bei Kampfende braeuchten neuen Speicher im Datensegment bzw. Zugriff auf eine statische Variable aus einem anderen Modul | offen |
| 333 | Tavernengerüchte in Serske: Lesen hinter dem Dateiende | gering | Tabelle der Geruechte im Datensegment, Datenfehler | offen |
| 340 | Informant Tiomar mit Manrin statt Brendhil eingetragen | gering | Datenfehler in der Tabelle g_informer_tab (Datensegment) | offen |
| 374 | Berghütte: Jagd zweimal möglich | gering | do_wildcamp() setzt die Status selbst zurueck; sie zu uebernehmen braeuchte einen neuen Zustand (Datensegment) oder Eingriff in seg051 | offen |
| 391 | Magier dürfen den verfluchten Lederhelm tragen | gering | Datenfehler (Sperrliste im Datensegment) | offen |
| 409 | Namensbeugung: Eigennamen mit Artikel, Adjektive ungebeugt | gering | Grenze des Grammatiksystems; braucht neue Tabellen im Datensegment | offen |
| 436 | STRASSE.LTX ist größer als der 10000-Byte-Textpuffer | gering | Puffergrenze; braucht eine andere Aufteilung der Textpuffer (Speicherplan) | offen |

### Spielstand-Format (9)

| Nr | Fehler | Schwere | Begründung dort | Status |
|---:|---|---|---|---|
| 58 | Tavernenmerker firstinfo, infopromise, round werden nie zurückgesetzt | mittel | unsicher: die Wirkung der Merker auf den Dialog ist nicht geprueft; sie stehen im Spielstand und koennen gewollt dauerhaft sein | offen |
| 131 | Seeweg Prem–Manrin nur 54 km lang | mittel | die Entfernung steht als Byte in der Tabelle g_sea_routes (Datensegment, Spielstand) | offen |
| 350 | Verlässt eine Teilgruppe das Totenschiff, sinkt es für die übrigen nicht mehr | mittel | die Todesfalle (gs_deathtrap) ist ein einziger Wert im Spielstand; sie je Gruppe zu fuehren aendert das Spielstandformat | offen |
| 359 | Prem-Mine: AP für Deckenfelder beliebig oft | mittel | die Felder einzeln zu merken braucht neue Merker im Spielstand | offen |
| 365 | Reiseziel nicht getrennt je Teilgruppe | mittel | braucht je Gruppe gesicherte Werte, also eine Aenderung des Spielstands | offen |
| 123 | Zähler der Grubenversuche steht nicht im Spielstand | gering | der Zaehler muesste in den Spielstand (neues Feld) | offen |
| 268 | Blaue Keuche: „DAS LEBEN WIRD WOHL NIE WIEDER SEIN“ immer | gering | braucht einen eigenen Merker im Heldendatensatz (Spielstand) und der Bright-Eyes-Fix einen neuen Text | offen |
| 360 | Orkhöhle: jedes Durchsuchen der Strohlager kostet CH −2 | gering | einmal je Lager braeuchte einen Merker je Strohlager (Spielstand) | offen |
| 384 | Herberge: Regenerationssperre nach Magie hängt am Heldenplatz | gering | ein Merker am Helden braeuchte ein Feld in der Heldenstruktur (Spielstand); die Sperre selbst ist gewollt | offen |

### Umbau (6)

| Nr | Fehler | Schwere | Begründung dort | Status |
|---:|---|---|---|---|
| 349 | Transversalis im Dungeon auf Felder außerhalb des Plans | mittel | welche Dungeon-Feldtypen begehbar sind, ist ohne Pruefung an den Plaenen (Totenschiff) nicht sicher; eine falsche Sperre wuerde Teleporte verhindern | offen |
| 99 | Wegteleportieren von Druckplatte oder Hebel wird nicht erkannt | gering | die Druckplatten muessten bei jedem Teleport und Gruppenwechsel in mehreren Dungeons neu ausgewertet werden - ein Umbau der Handler, kein eindeutiger Einzelfix | offen |
| 100 | Druckplatten der Verfallenen Herberge berücksichtigen andere Gruppen nur halb | gering | Neuauswertung aller Gruppen auf den Platten waere ein Umbau der Plattenlogik; der eindeutige Teil (Summe in der Schleife) ist Nr. 102 | offen |
| 104 | Beschwörungsszene erscheint auch nach dem Kampf | gering | ob der Kampf schon stattfand, steht nur in der Kampfliste; welcher Kampf zur Szene gehoert, ist im Handler nicht verknuepft | offen |
| 396 | Kräuterfund bei vollem Rucksack verloren | gering | die Weitergabe an die Gruppe aenderte den Ablauf (Wegwerf-Abfrage); geringer Nutzen | offen |
| 411 | Umlaute im Spielstandnamen ergeben „Diskette voll“ | gering | aendert die Dateinamen von Spielstaenden mit Umlaut im Namen; was das Original dabei schreibt, haengt von Bytes vor der ctype-Tabelle ab - vorhandene … | offen |

### Absicht unklar (46)

| Nr | Fehler | Schwere | Begründung dort | Status |
|---:|---|---|---|---|
| 1 | Speer wird als Fernkampfwaffe behandelt | mittel | unsicher (Wurfspeer moeglich); braucht Aenderungen der Waffentabelle im Datensegment | offen |
| 21 | Gegner schießen auch auf direkt benachbarte Helden | mittel | Absicht unklar (unsicher): ob Gegner im Handgemenge nicht schiessen duerfen, ist eine Regelfrage | offen |
| 37 | Gegner-Plumbumbarum wirkt eine Stunde statt 5 Kampfrunden | mittel | Absicht unklar (unsicher): ob der Gegnerzauber laenger wirken soll als der Heldenzauber, ist nicht belegbar | offen |
| 55 | Volle Korbsumme wird bezahlt, auch wenn nicht alles verteilt werden konnte | mittel | unsicher: Meldung 566 ("DAS NAECHSTE MAL SOLLTET IHR VORHER ETWAS PLATZ ...") deutet auf Absicht; mit Nr. 54 passt der Korb jetzt zum freien Platz | offen |
| 120 | Zeitabfragen „day_timer % X == 0“ greifen mehrmals hintereinander | mittel | unsicher, nicht gemessen; die zuletzt ausgewertete Zeitmarke zu merken braucht eine neue Variable (Datensegment) | offen |
| 134 | Efferds Schutz verhindert den Krakenmolch, nicht die Piraten | mittel | Auslegung (unsicher): ob Efferds Schutz auch vor Piraten schuetzen soll, ist nicht belegbar | offen |
| 143 | Gewaltmarsch-Tempo hängt von der schon gegangenen Strecke ab | mittel | unsicher: welcher feste Wert gemeint war, ist nicht belegbar (197 waere langsamer als normal) | offen |
| 172 | Brücke: Sturz in die Tiefe ist unerreichbar | mittel | unklar, welche Bedingung gemeint war: -99 hiesse ein patzender Hoehenangst-Wurf (also gerade keine Angst) laesst den Helden abstuerzen; test_talent() == -1 … | offen |
| 232 | Gift wirkt nur in game_loop(), bei Zeitsprüngen höchstens einmal | mittel | Gift alle 5 Minuten auch waehrend Rast und Reise auszuwerten hiesse bei langer Rast dutzende Meldungsfenster und meist den Tod (Shurinknollengift endet … | offen |
| 314 | Kampf: Waffe oder Gegenstand lässt sich nur tauschen, nicht ablegen | mittel | Absicht unklar: beide Menuepunkte tauschen nur mit belegten Rucksackplaetzen; ein Ablegen auf einen leeren Platz waere eine neue Bedienung | offen |
| 326 | Waffengift: jedes Gift macht 10 × Stärke Zusatzschaden | mittel | eigene Wirkungen je Gift waeren neue Regeln; welche Wirkung gedacht war, ist nicht belegbar (Spielbalance) | offen |
| 348 | Lager in Dungeons: immer einer von vier allgemeinen Lagerkämpfen | mittel | unsicher; Kaempfe je Dungeon waeren neue Daten | offen |
| 366 | Orkhöhle: Ausgang setzt die Gruppe direkt aufs Reiseziel | mittel | welcher feste Ausgangsort gemeint war, ist nicht belegbar | offen |
| 370 | Gorahs Haus nach Flucht der Helden unzugänglich | mittel | unklar, was nach einer Flucht der Helden gelten soll (Gorah lebt ja noch) | offen |
| 379 | Axxeleratus: zweite Aktion wiederholt den Angriff ohne Zielwahl | mittel | Absicht unklar (Spielbalance): Axxeleratus gibt eine zweite Aktion; ob sie neue BP und eine neue Wahl bekommen sollte, ist nicht belegbar - ein neues Menue … | offen |
| 380 | Böser Blick setzt dauerhaft zwei Attacken | mittel | unklar, ob die zwei Attacken gewollt sind; zuruecksetzen ginge nur an allen Stellen, die renegade loeschen, und der Ausgangswert ist im Gegnerblatt nicht … | offen |
| 393 | Steinschleuder ist unbenutzbar | mittel | es gibt keinen Munitionsgegenstand (Id 999 passt nicht in ein Byte); Bright-Eyes macht die Schleuder als Feature-Mod ohne Munition benutzbar - eine … | offen |
| 406 | Rüstungsbehinderung wirkt auf keine Talentprobe | mittel | unsicher; Behinderung bei Talentproben waere neue Spielregel (welche Talente, wie viel), nicht belegt | offen |
| 33 | Waffenbruch bei gleichen Würfen trifft nie die Waffe eines Gegners | gering | Designfrage (unsicher): Gegner haben keinen Bruchfaktor, vermutlich bewusst | offen |
| 44 | Antworten werden gemischt, das Ergebnis aber nie benutzt | gering | Absicht unklar: die gemischten Antworten zu benutzen waere eine sichtbare Spielaenderung, das Mischen zu streichen aendert nichts Sichtbares | offen |
| 73 | Spielhaus: „nach einigen Stunden“, aber die Zeit steht | gering | wie viele Stunden "einige" sein sollen, ist nicht belegbar | offen |
| 74 | Phextempel: gs_ptemple_closed wird nie gesetzt | gering | unsicher: ob die Geweihte nach der Beleidigung fuer immer verschwinden und der Tempel geschlossen bleiben soll, ist nicht belegbar | offen |
| 112 | Merker „Rätseltruhe geplündert“ wird nie gesetzt | gering | ob der Inhalt der Raetseltruhe immer ganz genommen wird, ist offen; der Merker wuerde uebrig gebliebene Gegenstaende sperren | offen |
| 141 | Ork-Monolith (Ereignis 71) steht auch auf dem Weg Oberorken–Felsteyn | gering | Eintrag der Ereignistabelle im Datensegment, Datenfehler (unsicher) | offen |
| 169 | „NACH GUT ACHT STUNDEN“, vergehen aber 12 | gering | unsicher: Umweg plus Rueckweg koennten gemeint sein | offen |
| 173 | Einsiedlersee: nur der erste Wasserschlauch wird gefüllt | gering | unsicher, ob Absicht | offen |
| 198 | Balsam: Mindestkosten 7 AE nicht einheitlich | gering | Balancefrage: ob 7 AE auch fuer weniger fehlende LE (oder bei voller LE) gelten sollen, ist nicht belegt | offen |
| 209 | Salander auf zweiteilige Gegner: „strange effect“ | gering | unsicher, im Spiel nicht nachgeprueft; Behandlung des Schwanzteils waere ein groesserer Eingriff in die Kampfliste | offen |
| 271 | Zeitzähler von Krankheiten und Giften können überlaufen | gering | unsicher, Folgen nicht geprueft; die Ursache Schlachtfeldfieber ist mit Fix 270 behoben | offen |
| 276 | NVF-Typ 1: Versatz mit nicht gelesenen Breiten und Höhen | gering | unsicher, ob NVF-Typ 1 mit Index > 0 im Spiel vorkommt; residentes Modul | offen |
| 285 | Modus 3: Anschnitt oben rückt die Quelle um die Bildbreite statt um 320 vor | gering | unsicher, ob der Fall im Spiel vorkommt; Assembler-Modul mit fester Laenge | offen |
| 300 | Gespiegelte Bilder werden am Rand von der falschen Seite beschnitten | gering | unsicher, im Spiel nicht geprueft: welcher Ausschnitt eines gespiegelten Bildes richtig ist, liesse sich nur am Bild klaeren | offen |
| 302 | Beugung der Namen: Bits mit + gesetzt, 2. und 3. Fall verwechselt | gering | unsicher: Bright-Eyes' Umbau aendert bei Gegenstaenden ohne Plural auch Artikel im 1./4. Fall; die Abfrage == 1 in GUI_name_inflect trifft ohnehin nur den … | offen |
| 315 | Schusslinie: bewusstlose und schlafende Figuren blockieren, Leichen nicht | gering | Absicht unklar (Spielbalance): ob bewusstlose oder schlafende Figuren die Schusslinie freigeben sollen, ist nicht belegbar | offen |
| 317 | Computerkampf: Held mit 1 BP oder weniger als 3 Rest-BP bleibt untätig | gering | KI-Entscheidung des Computerkampfs, kein eindeutiger Fehler: nach einer Bewegung mit weniger als 3 Rest-BP ist kein Angriff mehr moeglich; ob der Held … | offen |
| 318 | Computerkampf zaubert ohne Blick auf das Ziel | gering | KI-Schwaeche, kein eindeutiger Fehler (unsicher); eine zielabhaengige Zauberwahl waere neues Verhalten | offen |
| 320 | Gegner fliehen auch über den rechten Rand, Helden nicht | gering | Absicht nicht belegbar: die Fluchtraender unterscheiden sich bewusst je Hintergrund (Schiff), und Helden im Computerkampf fliehen ueber dieselbe Suche … | offen |
| 321 | Verschreckter Gegner ohne Fluchtweg tut nichts mehr | gering | kann Absicht sein (unsicher): ein umstellter Fliehender wehrt sich nicht | offen |
| 324 | Keine Waffenresistenzen für Skelette und Mumien | gering | Designaenderung (Resistenzen nach Handbuch), keine Fehlerbehebung | offen |
| 331 | Markt- und Hafenangebot stehen nicht im Spielstand | gering | Neuberechnen beim Laden aenderte das Angebot gegenueber dem Original auch ohne Ausnutzen; welcher Stand gelten soll, ist offen | offen |
| 335 | Wein und Schnaps ohne Zechenprobe | gering | unsicher: ob Wein/Schnaps eine Zechenprobe haben sollen, ist nicht belegt (Balance) | offen |
| 356 | Zwingfeste: Anseilen erst ab fünf Seilen, kein Seil verbraucht | gering | Absicht unklar (unsicher): feste Grenze von fuenf Seilen | offen |
| 373 | Floß ohne Werkzeug baubar | gering | unsicher, kann Absicht sein | offen |
| 392 | Zwei Kriegsbeile mit verschiedenen Werten | gering | unsicher; Waffentabelle im Datensegment | offen |
| 399 | Schild mit Zauberstab oder Hexenbesen kombinierbar | gering | unsicher, ob Stab/Besen mit Schild gewollt verboten sein sollen (Stab ist als Speer gefuehrt) | offen |
| 415 | Schiffsreise mit Händlermusik | gering | es gibt keine eigene Reisemusik; welches Stueck gemeint war, ist nicht belegbar | offen |

### Spieldaten/Texte (13)

| Nr | Fehler | Schwere | Begründung dort | Status |
|---:|---|---|---|---|
| 3 | MR von 19 Gegnertypen wird mit 15W4 statt 1W6 ausgewürfelt | mittel | Datenfehler in MONSTER.DAT (Spieldaten) | offen |
| 262 | Heilen Krankheiten: Wundfieber und Blaue Keuche nie heilbar, Erfolg wird als Misserfolg gemeldet | mittel | unsicher, ob die beiden Krankheiten per Talent heilbar sein sollen; eine eigene Meldung braeuchte einen neuen Text | offen |
| 325 | Spinnendämon gilt als Tier und ist für Waffengift empfänglich | mittel | is_animal steht in MONSTER.DAT (Spieldaten); ob Daemonen giftimmun sein sollen, ist eine Regelfrage (unsicher) | offen |
| 147 | Rastplatz-Text ohne Platzhalter: Ortsbeschreibung und Kräuterhinweis fehlen | gering | unsicher: ob FEATURE.LTX 15..19 als Formattexte gedacht sind, laesst sich ohne die Spieldaten nicht pruefen; Spieltext | offen |
| 157 | Brückenbau Auplog–Varnheim: Pronomen im falschen Fall | gering | Spieltext (FEATURE2.LTX) mit zwei statt drei Platzhaltern | offen |
| 194 | „IST DOCH GARNICHT TOT“ ohne Subjekt | gering | Spieltext (SPELLTXT.LTX) ohne %s; ein %s laesst sich nicht ohne Textaenderung einfuegen | offen |
| 215 | Magischer Brotbeutel wirkt wie der magische Beutel | gering | Datenfehler in ITEMS.DAT, ohne regulaeren Fundort folgenlos | offen |
| 261 | „DA SCHEINT ABER WAS ZU FEHLEN“ nennt die Zutat nicht | gering | Spieltext (SPELLTXT.LTX) ohne %s; der Name laesst sich nicht ohne Textaenderung einfuegen | offen |
| 311 | Geflohener Gegner gilt als getötet (Gorah) | gering | braeuchte eigene Texte fuer die Flucht Gorahs; die Spielwerte (Rune, Huette) bei Flucht sind Auslegungssache | offen |
| 323 | Schwacher Heshthot (Runin) hat nach der LE-Kürzung 0 LE | gering | Datenfehler in MONSTER.DAT (Spieldaten), kann gewollt sein (unsicher) | offen |
| 342 | Jurge Torfinsson: „nur Thorwaler“ auch bei reinen Thorwalern | gering | der Satz steht fest im Dialog (Spieldaten) | offen |
| 395 | Übergabe auf vollen 99er-Stapel: ohne Meldung nichts | gering | eine passende Meldung braeuchte einen neuen Text | offen |
| 412 | Namenlose Tage im Tagebuch als −5. bis −1. Swafnir | gering | die Formatstrings des Tagebuchs (Datensegment) verlangen Tag und Monatsnamen; eine eigene Zeile fuer die Namenlosen Tage braucht einen neuen Text | offen |

### folgenlos (19)

| Nr | Fehler | Schwere | Begründung dort | Status |
|---:|---|---|---|---|
| 5 | Schwanzteil fliehender oder selbst getöteter Doppelgegner bleibt auf dem Feld | gering | residentes Modul seg005 hat keinen Platz (+68 Byte, kein toter Code zum Ausgleich); der Teil fuer den Patzer-Tod steht unter Nr. 8 (seg032) | offen |
| 10 | Fluchtverteilung übergeht den NSC auf Platz 6 | gering | Mit allen 7 Plaetzen koennte der NSC allein durch einen anderen Ausgang fliehen und eine reine NSC-Gruppe bilden - die kennt das Spiel nicht (siehe Nr. 80, … | offen |
| 26 | memcpy 20 Byte in g_fig_move_pathdir[10] | gering | das Zielfeld liegt im Datensegment (darf nicht wachsen); die 10 Byte dahinter (g_fig_enemy_parry_action_used[0..9]) werden nie benutzt, lange Wege brauchen … | offen |
| 35 | double_size bleibt beim Rückverwandeln eines Doppelgegners ungesetzt | gering | ohne Wirkung: FIG_remove_from_list(..., 1) laesst die alten Werte des Gegners in g_fig_list_elem stehen, double_size ist also schon richtig | offen |
| 42 | Fehlende Haustypen 1 und 2: arr[1] bleibt ungesetzt | gering | ohne Wirkung: keine Stadt hat die Kombination (Haustyp 1 und 2 fehlen) | offen |
| 155 | Querverbindung: Herkunft wird nach Peilinen statt Kravik/Skelellen bestimmt | gering | folgenlos: ausgewertet wird nur Bit 0, das bei beiden Werten gleich ist | offen |
| 277 | Rückgabewert bei RLE-Bildern nicht gesetzt | gering | folgenlos (kein Aufrufer wertet den Wert aus); residentes Modul | offen |
| 278 | Heldenbild-Abfrage reicht ein Feld zu weit (ACTION_ID_HERO_NPC + 1) | gering | folgenlos (der Wert kommt nie vor); residentes Modul | offen |
| 279 | Lesen hinter icons_bak[9] | gering | folgenlos (hoechstens ein unnoetiges Neuzeichnen); residentes Modul | offen |
| 286 | Toter OPL-Code: Timer 1 startet nie, wirkungslose Befehle | gering | kein Fix noetig (toter Code) | offen |
| 291 | Letzte Figur liest das Ende hinter der TAB-Tabelle | gering | unsicher und folgenlos: read_archive_file() begrenzt auf das Dateiende, ob die letzte Figur je so geladen wird, ist offen | offen |
| 295 | Toter Zweig bei der Tiefe für Objekte 58..61 | gering | toter Zweig ohne Wirkung, kein Fehler im Spiel | offen |
| 297 | Bedingung state \|\| mode != 2 ist immer wahr | gering | ohne Wirkung: im else-Zweig ist state immer 1 | offen |
| 303 | Pronomentabelle hat 7 statt 8 Einträge | gering | braucht einen neuen Tabelleneintrag im Datensegment; folgenlos, der einzige Aufrufer nutzt den 4. Fall | offen |
| 305 | Feldzugriff vor der Grenzprüfung (3 Stellen) | gering | folgenlos: nur Lesezugriffe hinter dem Feld, das Ergebnis wird nie benutzt | offen |
| 310 | sprintf mit mehr Argumenten als Platzhaltern | gering | kein Fix noetig (ueberzaehlige Argumente sind harmlos) | offen |
| 381 | Böser Blick auf Leichen möglich | gering | folgenlos (tote Gegner kaempfen nicht); welche Meldung/Kosten richtig waeren, ist offen | offen |
| 413 | Zeitvorspulen ohne Bremse | gering | keine Fehlfunktion des Spiels, haengt vom Rechner bzw. den DOSBox-Zyklen ab | offen |
| 416 | Zufallswurf vor der Erledigt-Prüfung | gering | folgenlos: do_fight() prueft selbst, ob der Kampf erledigt ist | offen |
