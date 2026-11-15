// Regressionstests für ./pruefen.sh (ausgeführt von werkzeuge/regression.mjs)
//
// Je Szenario: name, schritte, optional adresse (Standard '/?ohneIntro'), schreibung: true (Textboxen
// in normaler Schreibung statt in Großbuchstaben wie im Original).
//
// Schritte:
//   { tipp: [ausschnitt, x, y] }     Antippen im mobilen Layout, x/y in Spielkoordinaten (320x200);
//                                    ausschnitt = aria-label: Ansicht, Ortszeile, Gruppe, Aktionen, Bildschirm
//   { doppeltipp: [ausschnitt, x, y] }
//   { knopf: 'Vorwärts' }            Knopf der Steuerleiste (aria-label oder Text)
//   { schnell: ['…', '…'] }          mehrere Knöpfe ohne Pause
//   { wahl: 2 } / { wahl: 'Text' }  Eintrag im Overlay antippen (Nummer ab 1 oder Textteil)
//   { weiter: true }                 Meldung im Overlay antippen
//   { eingabe: '12' }                Text im Overlay eingeben und bestätigen
//   { schnellwahl: 20 }              Wert der Schnellwahl im Overlay antippen
//   { tippen: '37' }                 ins Eingabefeld tippen (echte Tasten) und Enter
//   { neuLaden: true }               Seite neu laden (Spielstände bleiben in IndexedDB)
//   { offline: true }                Netz abschalten (Service Worker muss liefern)
//   { exportiere: 'NAME', datei: 'X.GAM' }  Spielstand über „Spielstände“ herunterladen
//   { importiere: 2, datei: 'X.GAM' }      Datei in Platz 2 importieren (Seite startet neu)
//   { taste: 'n' }                   Tastendruck
//   { js: 'Module._web_test_fight(213)' }
//   { warte: ms }
//   { warteAuf: 'z.ort == 0', max: ms }   Bedingung über den Spielzustand z (web_test_state)
//   { warteAuf: 'js', seite: true }  Bedingung als Ausdruck in der Seite (FS, DOM)
//   { merke: 'start' }               Zustand unter einem Namen merken (m.start)
//   { erwarte: 'z.richtung == m.start.richtung', text: '…' }
//   { bild: 'name' }                 Screenshot der Seite
//
// Zustand z: timer, stadt, ort, dungeon, x, y, richtung, helden, kampf, dialog, menue, karte, haupt, spielzustand,
//   von der Seite: ov (Overlay sichtbar), ovText, ovN (Anzahl Einträge), vollbild (Ausschnitte ausgeblendet)

const ORT_TEMPEL = 2;
const THORWAL = 1;
const KAMPF_THOR8 = 213;

/** Start wie im Original: Schwierigkeitsgrad, Hauptprogramm, kein Spielstand (Seite mit ?ohneIntro) */
const startMenue = (grad = 1) => [
	{ warteAuf: 'z.ov == 1 && /SCHWIERIGKEITSGRAD/.test(z.ovText)', max: 20000 },
	{ wahl: grad },                                        // 1 Anfänger, 2 Fortgeschrittene
	{ warteAuf: 'z.ov == 1 && /GESTARTET/.test(z.ovText)', max: 3000 },
];
const spielBereit = [
	...startMenue(),
	{ wahl: 'HAUPTPROGRAMM' },
	{ warteAuf: 'z.ov == 1 && z.ovN == 6', max: 3000 },   // Spielstand laden: 5 Plätze + Keinen
	{ wahl: 6 },
	{ warteAuf: `z.timer == 1 && z.ort == ${ORT_TEMPEL} && z.haupt == 1`, max: 20000 },
];

/** n Helden im Tempel aufnehmen (Auswahl im Overlay, jeweils der erste Eintrag) */
function heldenAufnehmen(n, bild) {
	const schritte = [{ tipp: ['Aktionen', 252, 69] }, { warteAuf: 'z.dialog == 1 && z.ov == 1', max: 3000 }];
	if (bild) schritte.push({ bild });
	for (let i = 1; i <= n; i++) {
		schritte.push({ wahl: 1 }, { warteAuf: `z.helden == ${i} && z.ov == 1`, max: 3000 }, { warte: 300 },
			// gemeldet (iOS): beim erneuten Öffnen der Liste stand die Box des Spiels hinter dem Overlay
			{ erwarte: 'z.ansichtAktuell == 0', text: `Liste nach Held ${i}: Ansicht festgehalten, ohne Box des Spiels` });
	}
	schritte.push({ abbrechen: true }, { warteAuf: 'z.dialog == 0 && z.haupt == 1 && z.ov == 0', max: 3000 });
	return schritte;
}

const ohneZufall = [{ js: 'Module._web_test_no_city_events(1)' }];

const tempelVerlassen = [
	{ tipp: ['Aktionen', 306, 124] },
	{ warteAuf: `z.ort == 0 && z.stadt == ${THORWAL} && z.haupt == 1`, max: 5000 },
	{ warte: 500 },
];

/** Weg aus Buchstaben: V = vorwärts, L/R = drehen, Z = zurück; wartet nach jedem Schritt */
function wege(folge) {
	const name = { V: 'Vorwärts', L: 'Links drehen', R: 'Rechts drehen', Z: 'Umdrehen / zurück' };
	return [...folge.replace(/\s+/g, '')].flatMap((c) => [{ knopf: name[c] }, { warte: 350 }]);
}

/** Startpunkt für den Zufallsspieler */
function zufallStart(start) {
	const [art, nr] = start.split(':');
	if (art === 'dungeon') return [
		{ js: `Module._web_test_dungeon(${Number(nr)})` },
		{ warteAuf: `z.dungeon == ${Number(nr)} && z.haupt == 1`, max: 10000 },
	];
	if (art === 'weg') return [
		{ js: `Module._web_test_sign(${Number(nr)})` },
		{ knopf: 'Vorwärts' },
		{ warteAuf: 'z.karte == 1 || z.ov == 1', max: 5000 },
	];
	return [];
}

export const szenarien = [
	{
		name: 'Start im Tempel',
		schritte: [...spielBereit, { erwarte: 'z.helden == 0 && z.stadt == 1', text: 'leere Gruppe in Thorwal' },
			// gemeldet (iOS): über der Ortszeile stand ein Streifen mit „versetzten Zeichen“ (Zeilen 136–138)
			{ erwarte: 'z.ortRand == 0', text: 'Ortszeile beginnt mit ihrer Rahmenlinie' }],
	},
	{
		// Start wie SCHICK.BAT: Logo-Intro (gen.html?intro im iframe, überspringbar), danach das Startmenü
		name: 'Start mit Intro',
		adresse: '/',
		schritte: [
			{ warteAuf: 'z.gen == 1', max: 15000 },
			{ warte: 3000 },
			{ bild: 'intro' },
			{ genKnopf: 'Intro überspringen' },
			{ warteAuf: 'z.gen == 0 && z.ov == 1 && /SCHWIERIGKEITSGRAD/.test(z.ovText)', max: 5000 },
		],
	},
	{
		// Textboxen in normaler Groß-/Kleinschreibung (schreibung.js, Wörterbuch aus den Spieldaten);
		// die Einstellungen schalten auf Großbuchstaben wie im Original und zurück und ändern die Schriftgröße
		name: 'Schreibung: normal und wie im Original, Schriftgröße',
		schreibung: true,
		schritte: [
			{ warteAuf: 'z.ov == 1 && /Schwierigkeitsgrad/.test(z.ovText)', max: 20000 },
			{ erwarte: '/^Wählen Sie den/.test(z.ovText)', text: 'Satzanfang groß, Anrede „Sie“, sonst klein' },
			// das Overlay deckt die Leiste ab: Einstellungen über die Seite öffnen
			{ js: "document.getElementById('einstellungen-knopf').click()" },
			{ knopf: 'GROSS (Original)' }, { knopf: 'Schrift sehr groß' },
			{ warteAuf: 'z.ov == 1 && /^WÄHLEN SIE DEN/.test(z.ovText)', max: 2000 },
			{ warteAuf: "getComputedStyle(document.getElementById('dialog')).getPropertyValue('--schrift') == '1.3'", seite: true, max: 2000 },
			{ bild: 'einstellungen' },
			{ knopf: 'Normal' }, { knopf: 'Schrift normal' }, { knopf: 'Schließen' },
			{ warteAuf: 'z.ov == 1 && /^Wählen Sie den/.test(z.ovText)', max: 2000 },
			{ wahl: 1 },
			{ warteAuf: 'z.ov == 1 && /gestartet/.test(z.ovText)', max: 3000 },
			{ warteAuf: "[...document.querySelectorAll('#dialog .optionen button')].some((b) => b.textContent == 'Hauptprogramm')", seite: true, max: 2000 },
		],
	},
	{
		name: 'Helden aufnehmen',
		schritte: [...spielBereit, ...heldenAufnehmen(5, 'heldenliste'), { erwarte: 'z.helden == 5' }],
	},
	{
		name: 'Heldentausch und Charakterbogen',
		schritte: [
			...spielBereit, ...heldenAufnehmen(2),
			{ tipp: ['Gruppe', 20, 170] }, { warte: 600 },
			{ tipp: ['Gruppe', 60, 170] }, { warte: 800 },
			{ erwarte: 'z.haupt == 1', text: 'nach dem Tausch zurück im Hauptbildschirm' },
			{ doppeltipp: ['Gruppe', 20, 170] },
			{ warteAuf: 'z.haupt == 0', max: 3000 },
			{ bild: 'charakterbogen' },
			// Schließen nur über das Heldenmenü (Rechtsklick), letzter Eintrag „Zurück“
			{ knopf: 'Zurück' },
			{ warteAuf: 'z.menue == 1', max: 3000 },
			{ taste: 'ArrowUp' },
			{ taste: 'Enter' },
			{ warteAuf: 'z.haupt == 1', max: 3000 },
		],
	},
	{
		name: 'Stadt: laufen und drehen',
		schritte: [
			...spielBereit, ...heldenAufnehmen(1), ...tempelVerlassen,
			{ merke: 'start' },
			{ knopf: 'Rechts drehen' }, { warteAuf: 'z.richtung == (m.start.richtung + 1) % 4', max: 2000 },
			{ merke: 'gedreht' },
			{ knopf: 'Vorwärts' }, { warteAuf: 'z.x != m.gedreht.x || z.y != m.gedreht.y', max: 2000 },
			{ bild: 'stadt' },
		],
	},
	{
		// Häuser schwarz und Himmel weiß direkt nach dem Tempel (seg066: Paletten nativ nicht
		// zusammenhängend, Einblenden las Gebäude/Himmel aus nicht gesetztem Speicher)
		name: 'Stadtfarben nach dem Tempel',
		schritte: [
			...spielBereit, ...heldenAufnehmen(1), ...tempelVerlassen,
			{ warte: 1500 },
			{ bild: 'nach-tempel' },
			{ merke: 'vorher' },
			{ knopf: 'Rechts drehen' }, { warte: 600 }, { knopf: 'Links drehen' }, { warte: 1000 },
			{ merke: 'nachher' },
			{ erwarte: 'Math.abs(m.vorher.schwarz - m.nachher.schwarz) <= 2', text: 'gleiche Ansicht, gleiche Farben vor und nach dem Drehen' },
		],
	},
	{
		// Mauszeiger blieb im mobilen Layout an der letzten Tippstelle stehen (z. B. in den Ortsicons)
		name: 'Kein Mauszeiger im mobilen Layout',
		schritte: [
			...spielBereit, ...heldenAufnehmen(1), ...tempelVerlassen,
			{ warte: 800 },
			{ merke: 'mobil' },
			{ knopf: 'Einstellungen' }, { knopf: 'Original' }, { knopf: 'Schließen' }, { warte: 800 },
			{ merke: 'original' },
			{ knopf: 'Einstellungen' }, { knopf: 'Mobil' }, { knopf: 'Schließen' }, { warte: 800 },
			{ merke: 'wieder' },
			{ erwarte: 'm.original.zeiger > m.mobil.zeiger', text: 'im Original-Layout ist der Zeiger zu sehen' },
			{ erwarte: 'm.wieder.zeiger == m.mobil.zeiger', text: 'zurück im mobilen Layout wieder verschwunden' },
		],
	},
	{
		name: 'Tastenreihenfolge bei schnellem Tippen',
		schritte: [
			...spielBereit, ...heldenAufnehmen(1), ...tempelVerlassen,
			{ merke: 'start' },
			// rechts, vor, links: Ende in Startrichtung, einen Schritt quer zur Startrichtung versetzt
			{ schnell: ['Rechts drehen', 'Vorwärts', 'Links drehen'] },
			{ warte: 1500 },
			{ erwarte: 'z.richtung == m.start.richtung', text: 'Richtung wie am Anfang' },
			{
				erwarte: 'm.start.richtung % 2 == 0 ? (z.y == m.start.y && z.x != m.start.x) : (z.x == m.start.x && z.y != m.start.y)',
				text: 'Schritt quer zur Startrichtung (Reihenfolge erhalten)',
			},
		],
	},
	{
		name: 'Kampf bis zum Ende (Computerkampf)',
		schritte: [
			...spielBereit, ...heldenAufnehmen(3), ...tempelVerlassen,
			// Würfelprotokoll vor dem Kampf: Knopf in der Leiste, noch leer bis auf die Aufnahme
			{ knopf: 'Würfelprotokoll' },
			{ warteAuf: "!document.getElementById('wurflog').hidden", seite: true, max: 2000 },
			{ knopf: 'Schließen' },
			{ warteAuf: "document.getElementById('wurflog').hidden", seite: true, max: 2000 },
			{ js: `Module._web_test_fight(${KAMPF_THOR8})` },
			{ knopf: 'Vorwärts' },
			{ warteAuf: 'z.kampf == 1 && z.menue == 1', max: 15000 },
			{ warteAuf: 'z.ov == 1 && /WAS WILLST DU TUN/.test(z.ovText)', max: 3000 },
			{ bild: 'kampfmenue' },
			{ wahl: 'COMPUTERKAMPF' },
			{ warteAuf: 'z.menue == 1 && z.ov == 1 && z.ovN == 2', max: 3000 },   // „Soll Magie angewendet werden?“
			{ wahl: 2 },
			{ warte: 20000 },
			{ bild: 'kampf' },
			{ warteAuf: 'z.kampf == 0', max: 300000 },
			// Würfelprotokoll: Kampfrunden, Angriffe mit AT-Wurf und Ergebnis
			{ warteAuf: 'wurfLog.eintraege.some((e) => e.art === 4)', seite: true, max: 2000 },
			{ warteAuf: "wurfLog.alsText().some(([t, r, d]) => / greift .* an$/.test(t) && /^Attacke: W20 = \\d+ gegen AT -?\\d+/.test(d) && r)", seite: true, max: 2000 },
			{ warteAuf: "wurfLog.alsText().some(([t, r, d]) => /^(Treffer: \\d+ SP|pariert|verfehlt|Patzer)/.test(r))", seite: true, max: 2000 },
			{ js: 'wurfLog.oeffnen()', seite: true },
			{ warteAuf: "document.querySelectorAll('#wurflog .eintrag').length > 3", seite: true, max: 2000 },
			{ bild: 'wurflog' },
		],
	},
	{
		// Würfelprotokoll (wurflog.js, BrightEyes wurflog.cpp): Talent- und Eigenschaftsproben mit Einzelwürfen
		name: 'Würfelprotokoll: Proben',
		schritte: [
			...spielBereit, ...ohneZufall, ...heldenAufnehmen(1), ...tempelVerlassen,
			{ js: 'Module._web_test_probe(1, 10, 2)' },                // Klettern +2 (3W20)
			{ warteAuf: "wurfLog.alsText().some(([t, r, d]) => /: Klettern \\+2 \\(TaW -?\\d+\\)$/.test(t) && /bestanden|Patzer/.test(r) && /^MU \\d+, GE \\d+, KK \\d+; Erschwernis|Ausgleich/.test(d) && (d.match(/W20 = /g) || []).length >= 2)", seite: true, max: 3000 },
			{ js: 'Module._web_test_probe(1, 7, 0)' },                 // Schusswaffen (1W20 gegen Fernkampfwert)
			{ warteAuf: "wurfLog.alsText().some(([t, r, d]) => /: Schusswaffen \\+0/.test(t) && /\\(KL\\+GE\\+KK\\)\\/4/.test(d))", seite: true, max: 3000 },
			{ js: 'Module._web_test_probe(2, 6, -1)' },                // Eigenschaftsprobe KK -1
			{ warteAuf: "wurfLog.alsText().some(([t, r, d]) => /: Probe auf KK -1$/.test(t) && /^W20 = \\d+ -1 = -?\\d+ gegen KK \\d+$|^W20 = 20$/.test(d))", seite: true, max: 3000 },
			// Panel: Namen in normaler Schreibung (beim Öffnen umgewandelt), Details aufklappbar
			{ js: "localStorage.setItem('schreibung', 'normal')" },
			{ knopf: 'Würfelprotokoll' },
			{ warteAuf: "document.querySelectorAll('#wurflog details.eintrag').length >= 3", seite: true, max: 2000 },
			{ js: "document.querySelector('#wurflog details.eintrag summary').click()" },
			{ warteAuf: "document.querySelector('#wurflog details.eintrag').open && /^[A-ZÄÖÜ][a-zäöüß]+: Klettern/.test(document.querySelector('#wurflog .titel').textContent)", seite: true, max: 2000 },
			{ bild: 'proben' },
			{ knopf: 'Proben & Zauber' },
			{ warteAuf: "[...document.querySelectorAll('#wurflog .eintrag .titel')].length >= 3 && !document.querySelector('#wurflog .runde')", seite: true, max: 2000 },
		],
	},
	{
		// gemeldet auf iOS: nach der Meldung im Haus lief die Gruppe endlos weiter gegen das Haus
		name: 'Haus mit Meldung betreten',
		schritte: [
			...spielBereit, ...ohneZufall, ...heldenAufnehmen(1), ...tempelVerlassen,
			// Weg aus der Meldung, ab (9,9) mit Blick nach Süden → (2,6), Blick nach Westen
			...wege('L VVV L VV L VVVVVVVVVV R V L'),
			{ warteAuf: 'z.x == 2 && z.y == 6 && z.richtung == 3 && z.haupt == 1', max: 3000 },
			{ merke: 'vorHaus' },
			// Vorwärts gedrückt halten, ohne dass je ein Loslassen ankommt (wie auf iOS)
			{ halten: 'Vorwärts' },
			{ warteAuf: 'z.dialog == 1 && z.ort == 17 && z.ov == 1', max: 5000 },   // Ottaskin: „werdet ihr abgewiesen“
			{ warte: 2500 },
			{ erwarte: 'z.dialog == 1 && z.ov == 1', text: 'Meldung bleibt stehen (nicht von der Wiederholung weggeklickt)' },
			{ erwarte: '/ABGEWIESEN/.test(z.ovText)', text: 'Text der Meldung im Overlay' },
			{ erwarte: 'z.vollbild == 0', text: 'Ausschnitte bleiben hinter der Meldung stehen' },
			{ erwarte: 'z.ansichtAktuell == 0', text: 'Box des Spiels nicht zu sehen (Ansicht festgehalten)' },
			{ bild: 'meldung' },
			{ weiter: true },
			{ warteAuf: 'z.ov == 0 && z.ansichtAktuell == 1', max: 3000 },
			{ warteAuf: 'z.haupt == 1 && z.ort == 0', max: 5000 },
			{ merke: 'zurueck' },
			{ warte: 3000 },
			{ erwarte: 'z.x == m.zurueck.x && z.y == m.zurueck.y && z.ort == 0', text: 'Gruppe bleibt auf der Straße stehen' },
			{ bild: 'danach' },
		],
	},
	{
		name: 'Vorwärts halten läuft mehrere Schritte',
		schritte: [
			...spielBereit, ...ohneZufall, ...heldenAufnehmen(1), ...tempelVerlassen,
			// freie Straße von (12,7) zehn Felder nach Westen
			...wege('L VVV L VV L'),
			{ warteAuf: 'z.x == 12 && z.y == 7 && z.richtung == 3 && z.haupt == 1', max: 3000 },
			{ halten: 'Vorwärts' },
			{ warte: 1500 },
			{ loslassen: 'Vorwärts' },
			{ warte: 600 },
			{ merke: 'danach' },
			{ erwarte: 'z.x <= 9 && z.y == 7', text: 'mindestens drei Schritte beim Halten' },
			{ warte: 1500 },
			{ erwarte: 'z.x == m.danach.x', text: 'nach dem Loslassen stehen geblieben' },
		],
	},
	{
		// gemeldet: beim Feilschen ließ sich nichts eingeben (iOS, Prozentfeld mit 2 Stellen)
		name: 'Eingabe: Zahl wählen, tippen, Text, abbrechen',
		schritte: [
			...spielBereit, ...ohneZufall, ...heldenAufnehmen(1), ...tempelVerlassen,
			{ js: 'Module._web_test_input(2)' },
			{ warteAuf: 'z.ov == 1 && z.dialog == 1', max: 3000 },
			{ bild: 'zahl' },
			{ schnellwahl: 20 },
			{ warteAuf: 'z.eingabe == 20 && z.ov == 0', max: 3000 },
			{ js: 'Module._web_test_input(2)' },
			{ warteAuf: 'z.ov == 1', max: 3000 },
			{ tippen: '37' },
			{ warteAuf: 'z.eingabe == 37 && z.ov == 0', max: 3000 },
			{ js: 'Module._web_test_input(10)' },
			{ warteAuf: 'z.ov == 1', max: 3000 },
			{ tippen: '123' },
			{ warteAuf: 'z.eingabe == 123 && z.ov == 0', max: 3000 },
			{ js: 'Module._web_test_input(2)' },
			{ warteAuf: 'z.ov == 1', max: 3000 },
			{ abbrechen: true },
			{ warteAuf: 'z.eingabe == -1 && z.ov == 0 && z.haupt == 1', max: 3000 },
		],
	},
	{
		// Stufe 3: Speichern/Laden war nativ gar nicht umgesetzt; Spielstände müssen das Neuladen überstehen
		name: 'Spielstand: speichern, neu laden, laden',
		schritte: [
			...spielBereit, ...heldenAufnehmen(2),
			{ merke: 'gespeichert' },
			{ knopf: 'Zurück' },                                   // Tempelmenü
			{ warteAuf: 'z.ov == 1 && z.ovN == 9', max: 3000 },
			{ wahl: 5 },                                           // Spiel speichern
			{ warteAuf: 'z.ov == 1 && z.ovN == 6', max: 3000 },   // fünf Plätze + Abbrechen
			{ wahl: 1 },
			{ warteAuf: 'z.ov == 1 && z.ovN == 0', max: 3000 },   // Name
			{ tippen: 'TEST' },
			{ warteAuf: 'z.ov == 0 && z.dialog == 0', max: 5000 },
			{ warteAuf: "FS.readdir('/spielstand').includes('TEST____.GAM')", seite: true, max: 5000 },
			...tempelVerlassen,
			{ neuLaden: true },
			...spielBereit,
			{ erwarte: 'z.helden == 0', text: 'nach dem Neuladen ohne Helden' },
			{ knopf: 'Zurück' },
			{ warteAuf: 'z.ov == 1 && z.ovN == 9', max: 3000 },
			{ wahl: 4 },                                           // Spiel laden
			{ warteAuf: 'z.ov == 1 && z.ovN == 6', max: 3000 },
			{ bild: 'laden' },
			{ wahl: 'TEST' },
			{ warteAuf: 'z.helden == 2 && z.ov == 0', max: 5000 },
			{ erwarte: 'z.x == m.gespeichert.x && z.y == m.gespeichert.y && z.ort == m.gespeichert.ort', text: 'Position wie beim Speichern' },
			{ bild: 'geladen' },
			// Export und Import als Datei
			{ knopf: 'Einstellungen' },
			{ knopf: 'Spielstände exportieren und importieren …' },
			{ bild: 'verwaltung' },
			{ exportiere: 'TEST', datei: 'KOPIE.GAM' },
			{ importiere: 2, datei: 'KOPIE.GAM' },
			...spielBereit,
			{ erwarte: 'z.helden == 0' },
			{ knopf: 'Zurück' },
			{ warteAuf: 'z.ov == 1 && z.ovN == 9', max: 3000 },
			{ wahl: 4 },
			{ warteAuf: 'z.ov == 1 && z.ovN == 6', max: 3000 },
			{ wahl: 'KOPIE' },
			{ warteAuf: 'z.helden == 2 && z.ov == 0', max: 5000 },
		],
	},
	{
		// gemeldet (iOS): Meldung „Zuerst Grundwerte ermitteln!“ ließ sich nicht schließen
		name: 'Heldenerschaffung: Meldung schließen',
		schritte: [
			...startMenue(2),
			{ wahl: 'GENERIERUNG' },
			{ warteAuf: 'z.gen == 1 && z.gOv == 1 && z.gN == 9', max: 15000 },
			{ warte: 500 },
			{ merke: 'menue' },
			{ wahl: 'TYPUS WÄHLEN', imGen: true },
			{ warteAuf: 'z.gOv == 1 && /GRUNDWERTE/.test(z.gText)', max: 3000 },
			{ warte: 800 },
			{ bild: 'meldung' },
			{ erwarte: 'z.gBild == m.menue.gBild', text: 'Box von ngen nicht im Bild, solange das Overlay offen ist' },
			{ weiter: true, imGen: true },
			{ warteAuf: 'z.gOv == 0', max: 3000, text: 'Meldung geschlossen' },
			{ genKnopf: 'Menü' },
			{ warteAuf: 'z.gOv == 1 && z.gN == 9', max: 3000 },
		],
	},
	{
		// gemeldet (iOS): nach „Steigerung gelungen“ blieb die Erschaffung stehen
		name: 'Heldenerschaffung: Talente steigern',
		schritte: [
			...startMenue(2),
			{ wahl: 'GENERIERUNG' },
			{ warteAuf: 'z.gen == 1 && z.gOv == 1 && z.gN == 9', max: 15000 },   // Menü der Erschaffung
			{ bild: 'gen-menue' },
			{ wahl: 'NAME', imGen: true },
			{ warteAuf: 'z.gOv == 1 && /NAME/.test(z.gText)', max: 3000 },
			{ tippen: 'TESTHELD', imGen: true },
			{ warteAuf: 'z.gOv == 0', max: 3000 },
			{ genKnopf: 'Menü' },
			{ warteAuf: 'z.gOv == 1 && z.gN == 9', max: 3000 },
			{ wahl: 'NEUE WERTE', imGen: true },
			{ warteAuf: 'z.gOv == 1 && /WURF/.test(z.gText)', max: 3000 },
			{ genWiederhole: { solange: 'WURF', wahl: 1 } },
			{ warteAuf: 'z.gOv == 0', max: 3000 },
			{ genKnopf: 'Menü' },
			{ warteAuf: 'z.gOv == 1 && z.gN == 9', max: 3000 },
			{ wahl: 'TYPUS FREI WÄHLEN', imGen: true },   // „Typus wählen“ hängt von den Würfen ab
			{ warteAuf: 'z.gOv == 1 && /AUTOMATISCH/.test(z.gText)', max: 3000 },
			{ wahl: 'JA', imGen: true },
			{ warteAuf: 'z.gOv == 1 && /TYPUS/.test(z.gText) && z.gN == 12', max: 3000 },
			{ wahl: 'KRIEGER', imGen: true },
			{ warteAuf: 'z.gOv == 0', max: 3000 },
			{ genTipp: [294, 185] }, { warte: 800 },       // Pfeil rechts: Talente Kampf/Körper
			{ bild: 'talente' },
			{ genKnopf: 'Menü' },
			{ warteAuf: 'z.gOv == 1', max: 3000 },
			{ warteAuf: 'z.gOv == 1 && /TALENTGRUPPE/.test(z.gText)', max: 3000 },
			{ wahl: 1, imGen: true },                       // Kampf
			{ warteAuf: 'z.gOv == 1 && z.gN == 9', max: 3000 },
			{ wahl: 8, imGen: true },                       // Schußwaffen
			{ warteAuf: 'z.gOv == 1 && z.gN == 0', max: 3000 },   // Meldung: gelungen / misslungen
			{ weiter: true, imGen: true },
			{ warteAuf: 'z.gOv == 1 && /TALENTGRUPPE/.test(z.gText)', max: 3000 },
			{ wahl: 1, imGen: true },                       // Kampf
			{ warteAuf: 'z.gOv == 1 && z.gN == 9', max: 3000 },
			{ wahl: 8, imGen: true },                       // Schußwaffen
			{ warteAuf: 'z.gOv == 1 && z.gN == 0', max: 3000 },   // Meldung: gelungen / misslungen
			{ weiter: true, imGen: true },
			{ warteAuf: 'z.gOv == 1 && /TALENTGRUPPE/.test(z.gText)', max: 3000 },
			{ wahl: 1, imGen: true },                       // Kampf
			{ warteAuf: 'z.gOv == 1 && z.gN == 9', max: 3000 },
			{ wahl: 8, imGen: true },                       // Schußwaffen
			{ warteAuf: 'z.gOv == 1 && z.gN == 0', max: 3000 },   // Meldung: gelungen / misslungen
			{ weiter: true, imGen: true },
			{ warteAuf: 'z.gOv == 1 && /TALENTGRUPPE/.test(z.gText)', max: 3000 },
			{ wahl: 1, imGen: true },                       // Kampf
			{ warteAuf: 'z.gOv == 1 && z.gN == 9', max: 3000 },
			{ wahl: 8, imGen: true },                       // Schußwaffen
			{ warteAuf: 'z.gOv == 1 && z.gN == 0', max: 3000 },   // Meldung: gelungen / misslungen
			{ weiter: true, imGen: true },
			{ warteAuf: 'z.gOv == 1 && /TALENTGRUPPE/.test(z.gText)', max: 3000, text: 'nach der Meldung wieder die Gruppenauswahl' },
			{ bild: 'nach-steigern' },
			{ abbrechen: true, imGen: true },
			{ warteAuf: 'z.gOv == 0', max: 3000, text: 'nach dem Abbrechen kein Overlay mehr offen' },
		],
	},
	{
		// Stufe 2: Heldenerschaffung (ngen als gen.html im iframe) wie GEN.EXE aus dem Startmenü
		name: 'Heldenerschaffung: neuer Held im Tempel',
		schritte: [
			...startMenue(1),
			{ wahl: 'GENERIERUNG' },
			{ warteAuf: 'z.gen == 1 && z.gOv == 1 && z.gN == 9', max: 15000 },   // Menü der Erschaffung
			{ bild: 'gen-menue' },
			{ wahl: 'NAME', imGen: true },
			{ warteAuf: 'z.gOv == 1 && /NAME/.test(z.gText)', max: 3000 },
			{ tippen: 'TESTHELD', imGen: true },
			{ warteAuf: 'z.gOv == 0', max: 3000 },
			{ genKnopf: 'Menü' },
			{ warteAuf: 'z.gOv == 1 && z.gN == 9', max: 3000 },
			{ wahl: 'NEUE WERTE', imGen: true },
			{ warteAuf: 'z.gOv == 1 && /WURF/.test(z.gText)', max: 3000 },
			{ genWiederhole: { solange: 'WURF', wahl: 1 } },
			{ warteAuf: 'z.gOv == 0', max: 3000 },
			{ genKnopf: 'Menü' },
			{ warteAuf: 'z.gOv == 1 && z.gN == 9', max: 3000 },
			{ wahl: 'TYPUS FREI WÄHLEN', imGen: true },   // „Typus wählen“ hängt von den Würfen ab
			{ warteAuf: 'z.gOv == 1 && /AUTOMATISCH/.test(z.gText)', max: 3000 },
			{ wahl: 'JA', imGen: true },
			{ warteAuf: 'z.gOv == 1 && /TYPUS/.test(z.gText) && z.gN == 12', max: 3000 },
			{ wahl: 'KRIEGER', imGen: true },
			{ warteAuf: 'z.gOv == 0', max: 3000 },
			{ bild: 'krieger' },
			{ genKnopf: 'Menü' },
			{ warteAuf: 'z.gOv == 1 && z.gN == 9', max: 3000 },
			{ wahl: 'HELD SPEICHERN', imGen: true },
			{ warteAuf: 'z.gOv == 1 && /ABSPEICHERN/.test(z.gText)', max: 3000 },
			{ wahl: 'JA', imGen: true },
			{ warteAuf: 'z.gOv == 0', max: 3000 },
			{ genKnopf: 'Menü' },
			{ warteAuf: 'z.gOv == 1 && z.gN == 9', max: 3000 },
			{ wahl: 'PROGRAMMENDE', imGen: true },
			{ warteAuf: 'z.gOv == 1 && /VERLASSEN/.test(z.gText)', max: 3000 },
			{ wahl: 'JA', imGen: true },
			// zurück im Spiel: Spielstand laden → „Keinen“, dann Tempel
			{ warteAuf: 'z.gen == 0 && z.ov == 1 && z.ovN == 6', max: 10000 },
			{ wahl: 6 },
			{ warteAuf: `z.timer == 1 && z.ort == ${ORT_TEMPEL} && z.haupt == 1`, max: 20000 },
			{ tipp: ['Aktionen', 252, 69] },                // Helden aufnehmen
			{ warteAuf: 'z.ov == 1 && z.ovN > 0', max: 3000 },
			{ bild: 'tempel' },
			{ wahl: 'TESTHELD' },
			{ warteAuf: 'z.helden == 1', max: 3000 },
			// der neue Held liegt im Browser-Speicher und übersteht das Neuladen
			{ neuLaden: true },
			...spielBereit,
			{ tipp: ['Aktionen', 252, 69] },
			{ warteAuf: 'z.ov == 1 && z.ovN > 0', max: 3000 },
			{ wahl: 'TESTHELD' },
			{ warteAuf: 'z.helden == 1', max: 3000 },
		],
	},
	{
		// Stufe 5: die App startet ohne Netz aus dem Service Worker (Test läuft auf localhost = sicherer Kontext)
		name: 'PWA: offline starten',
		schritte: [
			...spielBereit,
			{ warteAuf: 'navigator.serviceWorker.controller !== null', seite: true, max: 15000 },
			{ warteAuf: "caches.keys().then((k) => k.some((n) => n.startsWith('schick-')))", seite: true, max: 15000 },
			{ offline: true },
			{ neuLaden: true },
			...spielBereit,
			{ erwarte: 'z.helden == 0 && z.stadt == 1', text: 'Spiel läuft offline' },
		],
	},
	{
		// Stufe 6: Soundeffekte (VOC aus SCHICK.DAT) und CD-Musik (musik/TrackNN.m4a)
		name: 'Ton: Effekt und Musik im Tempel',
		schritte: [
			{ js: `(() => { const alt = Module.tonEffekt; window.effekte = []; Module.tonEffekt = (b) => { const d = alt(b); window.effekte.push(d); return d; }; })()` },
			...spielBereit,
			{ warteAuf: 'ton.track == 7', seite: true, max: 5000 },          // Tempelmusik (TEMPLE.XMI → Track 7)
			{ tipp: ['Aktionen', 252, 69] },                                 // Heldenliste: FX3.VOC
			{ warteAuf: 'z.ov == 1', max: 3000 },
			{ warteAuf: 'window.effekte.length > 0 && window.effekte[0] > 50', seite: true, max: 3000 },
			{ warteAuf: 'ton.geladen == 7 && ton.musik.src.startsWith("blob:")', seite: true, max: 15000 },
		],
	},
	{
		name: 'Reisekarte',
		schritte: [
			...spielBereit, ...heldenAufnehmen(1), ...tempelVerlassen,
			{ js: 'Module._web_test_sign(1)' },
			{ knopf: 'Vorwärts' },
			{ warteAuf: 'z.karte == 1', max: 5000 },
			{ warte: 5000 },                               // Timer zeichnet die Gruppenmarkierung
			{ bild: 'reisekarte' },
		],
	},
	{
		// Gefunden vom Zufallsspieler (ASan): Gespräche lasen nativ die Zustandstabelle ab Adresse 0
		// (Offset aus der TLK-Datei ohne Basis), Texte und Antworten waren Zufall aus dem Speicher
		name: 'Gespräche: Händler und Informant',
		schritte: [
			...spielBereit, ...heldenAufnehmen(1), ...tempelVerlassen, ...ohneZufall,
			{ js: 'Module._web_test_talk(2, 15, 0)' },             // Kräuterhändler (talk_merchant)
			{ warteAuf: 'z.ov == 1', max: 5000 },
			{ bild: 'haendler' },
			// Begrüßung ist eine von vier Varianten (Zufall): wörtliche Rede und drei Antworten
			{ erwarte: 'z.ovN == 3 && /^<[A-ZÄÖÜ ,.!?]+>$/.test(z.ovText)', text: 'Begrüßung des Händlers mit drei Antworten' },
			{ abbrechen: true },
			{ warte: 1000 },
			{ js: 'Module._web_test_talk(1, 6, 1)' },              // Hjore in Thorwal (do_talk)
			{ warteAuf: 'z.ov == 1', max: 5000 },
			{ bild: 'hjore' },
			{ erwarte: '/WEISSHAARIGER ALTER MANN/.test(z.ovText)', text: 'Hjore öffnet (ohne Auftrag: „Ihr seid hier sicher falsch“)' },
			{ weiter: true },
			{ warteAuf: 'z.ov == 0 && z.dialog == 0', max: 5000 },
		],
	},
	{
		// Spielende wie im Original (Kampf verlassen, keinen Spielstand laden): vorher blieb eine leere Seite
		name: 'Spielende: Hinweis und Neustart',
		schritte: [
			...spielBereit, ...heldenAufnehmen(1), ...tempelVerlassen,
			{ js: `Module._web_test_fight(${KAMPF_THOR8})` },
			{ knopf: 'Vorwärts' },
			{ warteAuf: 'z.ov == 1 && /WAS WILLST DU TUN/.test(z.ovText)', max: 15000 },
			{ wahl: 'VERLASSEN' },
			{ warteAuf: 'z.ov == 1 && z.ovN == 2', max: 3000 },
			{ wahl: 'JA' },
			{ warteAuf: '!document.getElementById("dialog").hidden && /KEINEN/.test(document.querySelector("#dialog .optionen")?.textContent)', seite: true, max: 5000 },
			{ wahl: 'KEINEN' },
			{ warteAuf: '!document.getElementById("ende").hidden', seite: true, max: 10000 },
			{ bild: 'ende' },
			{ knopf: 'Neu starten' },
			...startMenue(),
		],
	},
	{
		name: 'Dungeon betreten (Verlassene Mine) und laufen',
		schritte: [
			...spielBereit, ...heldenAufnehmen(2), ...tempelVerlassen,
			{ js: 'Module._web_test_dungeon(13)' },
			{ warteAuf: 'z.dungeon == 13 && z.haupt == 1', max: 10000 },
			{ merke: 'start' },
			{ knopf: 'Vorwärts' },
			{ warteAuf: 'z.y != m.start.y || z.x != m.start.x || z.ov == 1', max: 5000 },
			{ bild: 'mine' },
		],
	},
	{
		// Testpartie per Zufall (nicht in ./pruefen.sh ohne Filter):
		//   ZUFALL_MIN=20 ZUFALL_SAAT=7 ASAN=1 SCHNELL=1 ./pruefen.sh zufall
		// Start: ZUFALL_START=dungeon:13 (Dungeon-ID) oder weg:1 (Wegweiser-Typindex), sonst Thorwal
		name: 'Zufallsspieler',
		nurAufWunsch: true,
		schritte: [
			...spielBereit, ...heldenAufnehmen(5), ...tempelVerlassen,
			...zufallStart(process.env.ZUFALL_START || ''),
			{ zufall: { dauer: Number(process.env.ZUFALL_MIN || 5) * 60000, saat: Number(process.env.ZUFALL_SAAT || 1) } },
			{ bild: 'ende' },
		],
	},
	{
		// Spielstand mit hochgerüsteter Gruppe zum Ausprobieren (nicht in ./pruefen.sh ohne Filter):
		//   SCHNELL=1 ./pruefen.sh testgruppe   → build/regression/TESTGRUPPE.GAM
		name: 'Testgruppe: hochgerüstet speichern',
		nurAufWunsch: true,
		schritte: [
			...spielBereit, ...ohneZufall, ...heldenAufnehmen(5),
			// sechster Held: danach ist die Gruppe voll, das Spiel schließt die Liste selbst
			{ tipp: ['Aktionen', 252, 69] }, { warteAuf: 'z.dialog == 1 && z.ov == 1', max: 3000 },
			{ wahl: 1 }, { warteAuf: 'z.helden == 6 && z.dialog == 0 && z.haupt == 1', max: 3000 },
			...tempelVerlassen,
			{ js: 'Module._web_test_ruesten()' },
			{ warte: 500 },
			// zurück in den Tempel (speichern geht nur dort)
			{ merke: 'draussen' }, ...wege('LLV'),
			{ warteAuf: `z.ort == ${ORT_TEMPEL} && z.haupt == 1`, max: 5000 },
			{ knopf: 'Zurück' },
			{ warteAuf: 'z.ov == 1 && z.ovN == 9', max: 3000 },
			{ wahl: 5 },
			{ warteAuf: 'z.ov == 1 && z.ovN == 6', max: 3000 },
			{ wahl: 1 },
			{ warteAuf: 'z.ov == 1 && z.ovN == 0', max: 3000 },
			{ tippen: 'TESTGRUP' },
			{ warteAuf: 'z.ov == 0 && z.dialog == 0', max: 5000 },
			{ warteAuf: "FS.readdir('/spielstand').some((d) => d.startsWith('TESTGRUP'))", seite: true, max: 5000 },
			{ knopf: 'Einstellungen' },
			{ knopf: 'Spielstände exportieren und importieren …' },
			{ exportiere: 'TESTGRUP', datei: 'TESTGRUPPE.GAM' },
			// lässt sich laden
			{ neuLaden: true }, ...spielBereit,
			{ knopf: 'Zurück' },
			{ warteAuf: 'z.ov == 1 && z.ovN == 9', max: 3000 },
			{ wahl: 4 },
			{ warteAuf: 'z.ov == 1 && z.ovN == 6', max: 3000 },
			{ wahl: 'TESTGRUP' },
			{ warteAuf: 'z.helden == 6 && z.ov == 0', max: 5000 },
			{ bild: 'geladen' },
		],
	},
];
