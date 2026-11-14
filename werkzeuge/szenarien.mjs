// Regressionstests für ./pruefen.sh (ausgeführt von werkzeuge/regression.mjs)
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
//   { taste: 'n' }                   Tastendruck
//   { js: 'Module._web_test_fight(213)' }
//   { warte: ms }
//   { warteAuf: 'z.ort == 0', max: ms }   Bedingung über den Spielzustand z (web_test_state)
//   { merke: 'start' }               Zustand unter einem Namen merken (m.start)
//   { erwarte: 'z.richtung == m.start.richtung', text: '…' }
//   { bild: 'name' }                 Screenshot der Seite
//
// Zustand z: timer, stadt, ort, dungeon, x, y, richtung, helden, kampf, dialog, menue, karte, haupt, spielzustand,
//   von der Seite: ov (Overlay sichtbar), ovText, ovN (Anzahl Einträge), vollbild (Ausschnitte ausgeblendet)

const ORT_TEMPEL = 2;
const THORWAL = 1;
const KAMPF_THOR8 = 213;

const spielBereit = [{ warteAuf: `z.timer == 1 && z.ort == ${ORT_TEMPEL} && z.haupt == 1`, max: 20000 }];

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
