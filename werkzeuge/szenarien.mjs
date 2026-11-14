// Regressionstests für ./pruefen.sh (ausgeführt von werkzeuge/regression.mjs)
//
// Je Szenario: name, schritte, optional adresse (Standard '/?ohneIntro').
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
		schritte.push({ wahl: 1 }, { warteAuf: `z.helden == ${i} && z.ov == 1`, max: 3000 }, { warte: 300 });
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

export const szenarien = [
	{
		name: 'Start im Tempel',
		schritte: [...spielBereit, { erwarte: 'z.helden == 0 && z.stadt == 1', text: 'leere Gruppe in Thorwal' }],
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
		name: 'Helden aufnehmen',
		schritte: [...spielBereit, ...heldenAufnehmen(3, 'heldenliste'), { erwarte: 'z.helden == 3' }],
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
			{ knopf: 'Layout' }, { warte: 800 },
			{ merke: 'original' },
			{ knopf: 'Layout' }, { warte: 800 },
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
			{ knopf: 'Spielstände' },
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
];
