// Regressionstests für ./pruefen.sh (ausgeführt von werkzeuge/regression.mjs)
//
// Schritte:
//   { tipp: [ausschnitt, x, y] }     Antippen im mobilen Layout, x/y in Spielkoordinaten (320x200);
//                                    ausschnitt = aria-label: Ansicht, Ortszeile, Gruppe, Aktionen, Bildschirm
//   { doppeltipp: [ausschnitt, x, y] }
//   { knopf: 'Vorwärts' }            Knopf der Steuerleiste (aria-label oder Text)
//   { schnell: ['…', '…'] }          mehrere Knöpfe ohne Pause
//   { taste: 'n' }                   Tastendruck
//   { js: 'Module._web_test_fight(213)' }
//   { warte: ms }
//   { warteAuf: 'z.ort == 0', max: ms }   Bedingung über den Spielzustand z (web_test_state)
//   { merke: 'start' }               Zustand unter einem Namen merken (m.start)
//   { erwarte: 'z.richtung == m.start.richtung', text: '…' }
//   { bild: 'name' }                 Screenshot der Seite
//
// Zustand z: timer, stadt, ort, dungeon, x, y, richtung, helden, kampf, dialog, menue, karte, haupt, spielzustand

const ORT_TEMPEL = 2;
const THORWAL = 1;
const KAMPF_THOR8 = 213;

const spielBereit = [{ warteAuf: `z.timer == 1 && z.ort == ${ORT_TEMPEL} && z.haupt == 1`, max: 20000 }];

/** n Helden im Tempel aufnehmen (Liste: erster Eintrag bei y≈90) */
function heldenAufnehmen(n) {
	const schritte = [{ tipp: ['Aktionen', 252, 69] }, { warteAuf: 'z.dialog == 1', max: 3000 }];
	for (let i = 1; i <= n; i++) {
		schritte.push({ tipp: ['Bildschirm', 125, 90] }, { warteAuf: `z.helden == ${i}`, max: 3000 }, { warte: 400 });
	}
	schritte.push({ knopf: 'Zurück' }, { warteAuf: 'z.dialog == 0 && z.haupt == 1', max: 3000 });
	return schritte;
}

const tempelVerlassen = [
	{ tipp: ['Aktionen', 306, 124] },
	{ warteAuf: `z.ort == 0 && z.stadt == ${THORWAL} && z.haupt == 1`, max: 5000 },
	{ warte: 500 },
];

export const szenarien = [
	{
		name: 'Start im Tempel',
		schritte: [...spielBereit, { erwarte: 'z.helden == 0 && z.stadt == 1', text: 'leere Gruppe in Thorwal' }],
	},
	{
		name: 'Helden aufnehmen',
		schritte: [...spielBereit, ...heldenAufnehmen(3), { erwarte: 'z.helden == 3' }],
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
			// „Computerkampf“ ist immer der 11. Eintrag; das Menü steht je nach Held an
			// anderer Stelle (g_basepos_x), deshalb per Tastatur wählen
			...Array(10).fill({ taste: 'ArrowDown' }),
			{ taste: 'Enter' },
			{ warteAuf: 'z.menue == 1', max: 3000 },      // „Soll Magie angewendet werden?“
			{ warte: 300 },
			{ taste: 'n' },
			{ warte: 20000 },
			{ bild: 'kampf' },
			{ warteAuf: 'z.kampf == 0', max: 300000 },
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
