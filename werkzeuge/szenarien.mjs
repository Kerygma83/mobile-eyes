// Regressionstests für ./pruefen.sh (ausgeführt von werkzeuge/regression.mjs)
//
// Je Szenario: name, schritte, optional adresse (Standard '/?ohneIntro'), schreibung: true (Textboxen
// in normaler Schreibung statt in Großbuchstaben wie im Original), aktionsknoepfe: true (Knöpfe mit
// Text statt der Icons, aktionen.js; sonst Icons wie im Original, die Szenarien tippen dorthin).
//
// Schritte:
//   { tipp: [ausschnitt, x, y] }     Antippen im mobilen Layout, x/y in Spielkoordinaten (320x200);
//                                    ausschnitt = aria-label: Ansicht, Ortszeile, Gruppe, Aktionen, Bildschirm
//   { doppeltipp: [ausschnitt, x, y] }
//   { tippBei: 'karte.punkt(120, 80)' } Antippen an der Seitenposition [x, y], die der Ausdruck liefert
//   { knopf: 'Vorwärts' }            Knopf der Steuerleiste (aria-label oder Text)
//   { genKnopf: 'NAME' }             Knopf der Heldenerschaffung (Text); { genKnopfNr: 2 } n-ter Knopf unter dem Bild
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
//   { erwarte: 'js', seite: true }   Erwartung als Ausdruck in der Seite (DOM)
//   { bild: 'name' }                 Screenshot der Seite
//   { groesse: [844, 390] }          Fenstergröße ändern (etwa Querformat), gilt bis zum Ende des Szenarios
//
// Zustand z: timer, stadt, ort, dungeon, x, y, richtung, helden, kampf, dialog, menue, karte, haupt, spielzustand,
//   von der Seite: ov (Overlay sichtbar), ovText, ovN (Anzahl Einträge), vollbild (Ausschnitte ausgeblendet)
//   hb (Heldenbogen mit Kacheln: web_heldenbogen() als Objekt, null wenn nicht zu sehen)

const ORT_TEMPEL = 2;
const THORWAL = 1;
const KAMPF_THOR8 = 213;

/** Startmenü (startmenue.js) mit Modus; danach { knopf: 'Spiel starten' } oder { knopf: 'Generierung' } */
const startMenue = (grad = 1) => [
	{ warteAuf: 'z.start == 1', max: 20000 },
	{ knopf: grad === 2 ? 'Fortgeschritten' : 'Anfänger' },
];
/** Spiel starten, kein Spielstand (Seite mit ?ohneIntro) */
const spielBereit = [
	...startMenue(),
	{ knopf: 'Spiel starten' },
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

/** Heldenbogen (heldenbogen.js): Kachel n (0–6 Körper, 7–22 Rucksack) bzw. Aktionsknopf der Karte antippen */
const hbKachel = (n) => ({ tippBei: `(() => { const r = document.querySelector('.hb-kachel[data-feld="' + (${typeof n === 'number' ? n : `(${n})`}) + '"]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()` });
const hbKnopf = (t) => ({ tippBei: `(() => { const b = [...document.querySelectorAll('#heldenbogen button')].find((b) => b.firstChild?.textContent === ${JSON.stringify(t)}); const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()` });

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
		// Start wie SCHICK.BAT: Original-Intro (INTRO_E.OVL, ausgeführt von intro.js), überspringbar,
		// danach das Startmenü
		name: 'Start mit Original-Intro',
		adresse: '/',
		schritte: [
			{ warteAuf: 'z.intro == 1', max: 15000 },
			// Ton erst nach einer Berührung: Hinweis oben, bis getippt wird
			{ warteAuf: "!document.getElementById('tonhinweis').hidden", seite: true, max: 1000 },
			// das Attic-Logo erscheint (blau): das Programm läuft und zeichnet
			{ warteAuf: "(() => { const d = document.querySelector('#intro canvas').getContext('2d').getImageData(0, 0, 320, 200).data; let n = 0; for (let i = 2; i < d.length; i += 4) if (d[i] > 100) n++; return n > 2000; })()", seite: true, max: 15000 },
			{ bild: 'intro' },
			// Musik wie in der GOG-Fassung: zuerst CD-Track 2 (Logos, Titel)
			{ warteAuf: "ton.track === 2", seite: true, max: 3000 },
			{ knopf: 'Intro überspringen' },
			{ warteAuf: 'z.intro == 0 && z.gen == 0 && z.start == 1', max: 5000 },
			{ warteAuf: 'ton.track === 0', seite: true, max: 1000 },          // Intro-Musik aus
			{ warteAuf: "document.getElementById('tonhinweis').hidden", seite: true, max: 2000 },
		],
	},
	{
		// Startmenü (startmenue.js) statt der Textmenüs: Titelbild aus dem Intro (ohne Intro im Worker gerechnet),
		// Modus gemerkt, Einstellungen erreichbar, „Spiel starten“ führt zur Spielstandwahl
		name: 'Startmenü: Titelbild, Modus, Einstellungen',
		schritte: [
			{ warteAuf: 'z.start == 1', max: 20000 },
			{ erwarte: "localStorage.getItem('modus') === null && document.querySelector('#start .modus [data-wert=\"1\"]').getAttribute('aria-pressed') === 'true'", seite: true, text: 'Anfänger voreingestellt' },
			{ warteAuf: "!document.querySelector('#start .titel img').hidden && document.querySelector('#start .titel img').naturalWidth === 320", seite: true, max: 30000 },
			// Titel „Die Schicksalsklinge“: rote Schrift unten links
			{ erwarte: "(() => { const c = document.createElement('canvas'); c.width = 320; c.height = 200; const x = c.getContext('2d'); x.drawImage(document.querySelector('#start .titel img'), 0, 0); const d = x.getImageData(0, 150, 120, 50).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 150 && d[i + 1] < 60) n++; return n > 500; })()", seite: true, text: 'Titelbild mit roter Schrift' },
			{ warte: 1500 }, { bild: 'startmenue' },   // nach dem Einblenden
			{ knopf: 'Fortgeschritten' },
			{ tippBei: "(() => { const r = document.querySelector('#start .einstellungen').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()" },
			{ warteAuf: "!document.getElementById('einstellungen').hidden", seite: true, max: 2000 },
			{ knopf: 'Schließen' },
			{ neuLaden: true },
			{ warteAuf: 'z.start == 1', max: 20000 },
			{ erwarte: "document.querySelector('#start .modus [data-wert=\"2\"]').getAttribute('aria-pressed') === 'true' && !document.querySelector('#start .titel img').hidden", seite: true, text: 'Modus und Titelbild nach dem Neuladen' },
			{ knopf: 'Spiel starten' },
			{ warteAuf: 'z.start == 0 && z.ov == 1 && z.ovN == 6', max: 5000 },   // Spielstand laden: 5 Plätze + Keinen
			{ erwarte: 'z.modus == 2', text: 'Spiel im Modus Fortgeschritten' },
		],
	},
	{
		// ohne INTRO_E.OVL (Spieldaten vor dem Intro eingelesen): Logo-Intro der Heldenerschaffung (gen.html?intro)
		name: 'Start mit Logo-Intro',
		adresse: '/?logoIntro',
		schritte: [
			{ warteAuf: 'z.gen == 1', max: 15000 },
			{ warte: 3000 },
			{ bild: 'intro' },
			{ genKnopf: 'Intro überspringen' },
			{ warteAuf: 'z.gen == 0 && z.start == 1', max: 5000 },
		],
	},
	{
		// Textboxen in normaler Groß-/Kleinschreibung (schreibung.js, Wörterbuch aus den Spieldaten);
		// die Einstellungen schalten auf Großbuchstaben wie im Original und zurück und ändern die Schriftgröße
		name: 'Schreibung: normal und wie im Original, Schriftgröße',
		schreibung: true,
		schritte: [
			// erste Textbox nach dem Startmenü: Spielstand laden (5 Plätze + „Keinen“)
			...startMenue(), { knopf: 'Spiel starten' },
			{ warteAuf: 'z.ov == 1 && z.ovN == 6', max: 5000 },
			{ merke: 'normal' },
			{ erwarte: '/^[A-ZÄÖÜ][a-zäöüß]/.test(z.ovText) && z.ovText != z.ovText.toUpperCase()', text: 'Satzanfang groß, sonst normale Schreibung' },
			{ warteAuf: "[...document.querySelectorAll('#dialog .optionen button')].some((b) => b.textContent == 'Keinen')", seite: true, max: 2000 },
			// das Overlay deckt die Leiste ab: Einstellungen über die Seite öffnen
			{ js: "einstellungenOeffnen('menue')" },
			{ knopf: 'GROSS (Original)' }, { knopf: 'Schrift sehr groß' },
			{ warteAuf: 'z.ov == 1 && z.ovText == m.normal.ovText.toUpperCase()', max: 2000 },
			{ warteAuf: "getComputedStyle(document.getElementById('dialog')).getPropertyValue('--schrift') == '1.3'", seite: true, max: 2000 },
			{ bild: 'einstellungen' },
			{ js: "document.querySelector('[data-einstellung=schreibung] [data-wert=normal]').click()", seite: true }, { knopf: 'Schrift normal' }, { knopf: 'Schließen' },
			{ warteAuf: 'z.ov == 1 && z.ovText == m.normal.ovText', max: 2000 },
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
			{ knopf: 'Menü' }, { knopf: 'Einstellungen' }, { knopf: 'Original' }, { knopf: 'Schließen' }, { warte: 800 },
			{ merke: 'original' },
			{ knopf: 'Menü' }, { knopf: 'Einstellungen' }, { knopf: 'Mobil' }, { knopf: 'Schließen' }, { warte: 800 },
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
			...spielBereit, ...heldenAufnehmen(3), ...tempelVerlassen, ...ohneZufall,
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
		// Einstellung „Autokampf: Schnell“ (seg005/seg032 fast_autofight): ohne Animationen und
		// Wartezeiten; derselbe Kampf dauert normal rund 50 s
		name: 'Schneller Autokampf',
		schritte: [
			...spielBereit, ...heldenAufnehmen(3), ...tempelVerlassen, ...ohneZufall,
			{ knopf: 'Menü' }, { knopf: 'Einstellungen' }, { knopf: 'Schnell' }, { knopf: 'Schließen' },
			{ warteAuf: "localStorage.getItem('autokampf') === 'schnell'", seite: true, max: 2000 },
			{ js: `Module._web_test_fight(${KAMPF_THOR8})` },   // startet in game_loop() ohne Schritt
			{ warteAuf: 'z.kampf == 1 && z.menue == 1', max: 15000 },
			{ warteAuf: 'z.ov == 1 && /WAS WILLST DU TUN/.test(z.ovText)', max: 3000 },
			{ wahl: 'COMPUTERKAMPF' },
			{ warteAuf: 'z.menue == 1 && z.ov == 1 && z.ovN == 2', max: 3000 },
			{ wahl: 2 },
			{ warte: 1000 },
			{ bild: 'schnellkampf' },
			{ warteAuf: 'z.kampf == 0', max: 15000 },   // gemessen rund 3 s
			{ warteAuf: "wurfLog.alsText().some(([t, r, d]) => / greift .* an$/.test(t) && r)", seite: true, max: 2000 },
		],
	},
	{
		// Kampfzauber im Würfelprotokoll: Probe und Schaden in einem Eintrag (wlog_halten/wlog_freigeben in
		// use_spell bzw. MON_cast_spell, Schaden aus FIG_do_spell_damage); Computerkampf mit Magie, alle sechs
		// Helden (darunter Zauberkundige)
		name: 'Würfelprotokoll: Zauberschaden im Kampf',
		schritte: [
			...spielBereit,
			// sechs Helden: mit dem sechsten ist die Gruppe voll, die Liste schließt von selbst
			{ tipp: ['Aktionen', 252, 69] }, { warteAuf: 'z.dialog == 1 && z.ov == 1', max: 3000 },
			...[1, 2, 3, 4, 5, 6].flatMap((n) => [{ wahl: 1 }, { warteAuf: `z.helden == ${n}`, max: 3000 }, { warte: 300 }]),
			{ warteAuf: 'z.dialog == 0 && z.haupt == 1 && z.ov == 0', max: 3000 },
			...tempelVerlassen, ...ohneZufall,
			{ knopf: 'Menü' }, { knopf: 'Einstellungen' }, { knopf: 'Schnell' }, { knopf: 'Schließen' },
			{ warteAuf: "localStorage.getItem('autokampf') === 'schnell'", seite: true, max: 2000 },
			{ js: `Module._web_test_fight(${KAMPF_THOR8})` },
			{ warteAuf: 'z.kampf == 1 && z.menue == 1', max: 15000 },
			{ warteAuf: 'z.ov == 1 && /WAS WILLST DU TUN/.test(z.ovText)', max: 3000 },
			{ wahl: 'COMPUTERKAMPF' },
			{ warteAuf: 'z.menue == 1 && z.ov == 1 && z.ovN == 2', max: 3000 },
			{ wahl: 1 },   // mit Magie
			{ warteAuf: 'z.kampf == 0', max: 30000 },
			{ warteAuf: "wurfLog.alsText().some(([t, r]) => /: (Fulminictus|Ignifaxius) /.test(t) && /^bestanden.*, Treffer: \\d+ SP$/.test(r))", seite: true, max: 2000 },
			// jeder gelungene Schadenszauber nennt den Schaden
			{ erwarte: "wurfLog.alsText().filter(([t, r]) => /: (Fulminictus|Ignifaxius) /.test(t) && /^bestanden/.test(r)).every(([, r]) => /Treffer: \\d+ SP/.test(r))", seite: true, text: 'Schaden bei jedem gelungenen Schadenszauber' },
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
			// Würfelknopf farbig bei neuen Einträgen, beim Öffnen wieder normal
			{ warteAuf: "document.getElementById('wurflog-knopf').classList.contains('neu')", seite: true, max: 1000 },
			{ knopf: 'Würfelprotokoll' },
			{ warteAuf: "document.querySelectorAll('#wurflog details.eintrag').length >= 3 && !document.getElementById('wurflog-knopf').classList.contains('neu')", seite: true, max: 2000 },
			{ js: "document.querySelector('#wurflog details.eintrag summary').click()" },
			{ warteAuf: "document.querySelector('#wurflog details.eintrag').open && /^[A-ZÄÖÜ][a-zäöüß]+: Klettern/.test(document.querySelector('#wurflog .titel').textContent)", seite: true, max: 2000 },
			{ bild: 'proben' },
			{ knopf: 'Proben & Zauber' },
			{ warteAuf: "[...document.querySelectorAll('#wurflog .eintrag .titel')].length >= 3 && !document.querySelector('#wurflog .runde')", seite: true, max: 2000 },
			// geschlossen: der nächste Eintrag färbt den Knopf wieder
			{ js: "document.querySelector('#wurflog .schliessen').click()" },
			{ js: 'Module._web_test_probe(2, 6, 0)' },
			{ warteAuf: "document.getElementById('wurflog-knopf').classList.contains('neu')", seite: true, max: 3000 },
		],
	},
	{
		// Questlog (questlog.js, BrightEyes questlog.cpp): Flags des Spielstands als Haupt- und Nebenquests;
		// web_test_quest stellt einen Fortschritt nach (Auftrag, Isleif besucht, zwei Kartenstücke, Ugdalf …)
		name: 'Questlog: Auftrag, Informanten, Nebenquests',
		schritte: [
			...spielBereit, ...heldenAufnehmen(1),
			{ js: "localStorage.setItem('schreibung', 'normal')" },   // Namen im Panel in normaler Schreibung
			// Leiste (mobil): ohne Ja/Nein (Overlay), Questlog neben Würfel und Zahnrad in zwei Reihen
			{ warteAuf: "(() => { const k = [...document.querySelectorAll('.aktionen button')].filter((b) => b.offsetParent); return k.length == 5 && new Set(k.map((b) => Math.round(b.getBoundingClientRect().top))).size == 2; })()", seite: true, max: 1000 },
			{ bild: 'leiste' },
			{ knopf: 'Questlog' },
			{ warteAuf: "!document.getElementById('questlog').hidden && /Noch keine Hinweise/.test(questLog.alsText())", seite: true, max: 2000 },
			{ js: "document.querySelector('#questlog .schliessen').click()" },
			{ js: 'Module._web_test_quest(2)' },
			// der Knopf färbt sich beim nächsten Abgleich (alle 2 s)
			{ warteAuf: "document.getElementById('questlog-knopf').classList.contains('neu')", seite: true, max: 5000 },
			{ knopf: 'Questlog' },
			{ warteAuf: "!document.getElementById('questlog-knopf').classList.contains('neu') && document.querySelector('#questlog [data-quest=haupt]')", seite: true, max: 2000 },
			{ warteAuf: "(() => { const t = questLog.alsText(); return /Auftrag des Hetmanns/.test(t) && /Kartenstücke von Hyggeliks Karte: 2 von 9/.test(t) && /Empfehlungsschreiben des Hetmanns erhalten/.test(t); })()", seite: true, max: 1000 },   // Hauptquest: Auftrag, Brief, Kartenstücke
			// Informanten: Isleif besucht (mit Kartenstück), Jurge und Umbrik nur gehört; Namen aus dem Spiel in normaler Schreibung
			{ warteAuf: "document.querySelector('#questlog [data-informant=\"4\"]').classList.contains('fertig') && /^Isleif /.test(document.querySelector('#questlog [data-informant=\"4\"] .name').textContent) && /Kartenstück erhalten/.test(document.querySelector('#questlog [data-informant=\"4\"]').textContent)", seite: true, max: 1000 },   // Isleif besucht, Name aus TEXT.LTX, Kartenstück
			{ warteAuf: "!document.querySelector('#questlog [data-informant=\"0\"]').classList.contains('fertig') && /\\(Skjal\\)/.test(document.querySelector('#questlog [data-informant=\"0\"]').textContent) && document.querySelectorAll('#questlog [data-informant]').length == 3", seite: true, max: 1000 },   // Jurge gehört, Wohnort Skjal; nur drei Informanten
			{ warteAuf: "document.querySelector('#questlog [data-quest=ugdalf]') && document.querySelector('#questlog [data-quest=totenschiff]') && /Ruine des Schwarzmagiers/.test(questLog.alsText()) && !document.querySelector('#questlog [data-quest=drache]')", seite: true, max: 1000 },   // Nebenquests und bekannte Orte
			{ bild: 'questlog' },
			{ js: "document.querySelector('#questlog .schliessen').click()" },
			{ js: 'Module._web_test_quest(0)' },
			{ knopf: 'Questlog' },
			{ warteAuf: "/Noch keine Hinweise/.test(questLog.alsText())", seite: true, max: 2000 },
		],
	},
	{
		// Datum und Uhrzeit: im Original per Klick oben rechts über den Icons, den das mobile Layout
		// nicht zeigt; dort als Zeile unter den Porträts (datumzeile.cpp), Antippen öffnet die Box
		name: 'Datumszeile unter den Porträts',
		schritte: [
			...spielBereit,
			{ warteAuf: "(() => { const c = document.getElementById('datum'); if (!c.offsetParent) return false; const d = c.getContext('2d').getImageData(6, 4, 300, 7).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 128) n++; return n > 150; })()", seite: true, max: 3000 },   // Text in der Spielschrift
			{ bild: 'datumszeile' },
			{ tipp: ['Datum und Uhrzeit', 160, 9] },
			{ warteAuf: 'z.ov == 1 && /ES IST .* UHR/.test(z.ovText)', max: 3000 },
			{ weiter: true },
			{ warteAuf: 'z.ov == 0 && z.haupt == 1', max: 3000 },
		],
	},
	{
		// gemeldet auf iOS: Infobildschirm und Kartenteile erschienen als Hauptbildschirm (Ausschnitte)
		name: 'Infobildschirm und Kartenteile im Vollbild',
		schritte: [
			...spielBereit, ...heldenAufnehmen(1), ...tempelVerlassen,
			{ js: 'Module._web_test_quest(2)' },   // zwei Kartenstücke
			{ tipp: ['Aktionen', 252, 96] },       // Icon 4 (Stadt): game_options()
			{ warteAuf: 'z.haupt == 0 && z.vollbild == 1 && z.ov == 0', max: 5000 },
			{ bild: 'infobildschirm' },
			{ tipp: ['Bildschirm', 80, 180] },     // Hyggeliks Karte
			{ warte: 1500 },
			{ erwarte: 'z.haupt == 0 && z.vollbild == 1 && z.ov == 0', text: 'Kartenteile im Vollbild' },
			{ bild: 'kartenteile' },
			{ tipp: ['Bildschirm', 160, 100] },    // zurück in den Infobildschirm
			{ warte: 1000 },
			{ erwarte: 'z.haupt == 0 && z.vollbild == 1', text: 'wieder im Infobildschirm' },
			{ js: 'Module._web_right_click()' },
			{ warteAuf: 'z.ov == 1 && z.ovN == 9', max: 3000 },
			{ wahl: 9 },
			{ warteAuf: 'z.ov == 0 && z.haupt == 1 && z.vollbild == 0', max: 5000 },
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
			{ knopf: 'Menü' },
			{ knopf: 'Spielstände sichern und einlesen' },
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
			{ knopf: 'Generierung' },
			{ warteAuf: 'z.gen == 1 && z.gOv == 0 && z.gKnoepfe == 9', max: 15000 },
			{ warte: 500 },
			{ merke: 'menue' },
			{ genKnopf: 'TYPUS WÄHLEN' },
			{ warteAuf: 'z.gOv == 1 && /GRUNDWERTE/.test(z.gText)', max: 3000 },
			{ warte: 800 },
			{ bild: 'meldung' },
			{ erwarte: 'z.gBild == m.menue.gBild', text: 'Box von ngen nicht im Bild, solange das Overlay offen ist' },
			{ weiter: true, imGen: true },
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 9', max: 3000, text: 'Meldung geschlossen, Menüknöpfe da' },
		],
	},
	{
		// gemeldet (iOS): nach „Steigerung gelungen“ blieb die Erschaffung stehen
		name: 'Heldenerschaffung: Talente steigern',
		schritte: [
			...startMenue(2),
			{ knopf: 'Generierung' },
			{ warteAuf: 'z.gen == 1 && z.gOv == 0 && z.gKnoepfe == 9', max: 15000 },   // Menü der Erschaffung als Knöpfe
			{ bild: 'gen-menue' },
			{ genKnopf: 'NAME' },
			{ warteAuf: 'z.gOv == 1 && /NAME/.test(z.gText)', max: 3000 },
			{ tippen: 'TESTHELD', imGen: true },
			{ warteAuf: 'z.gOv == 0', max: 3000 },
			{ genKnopf: 'NEUE WERTE' },
			{ warteAuf: 'z.gOv == 1 && /WURF/.test(z.gText)', max: 3000 },
			{ genWiederhole: { solange: 'WURF', wahl: 1 } },
			{ warteAuf: 'z.gOv == 0', max: 3000 },
			{ genKnopf: 'TYPUS FREI WÄHLEN' },   // „Typus wählen“ hängt von den Würfen ab
			{ warteAuf: 'z.gOv == 1 && /AUTOMATISCH/.test(z.gText)', max: 3000 },
			{ wahl: 'JA', imGen: true },
			{ warteAuf: 'z.gOv == 1 && /TYPUS/.test(z.gText) && z.gN == 12', max: 3000 },
			{ wahl: 'KRIEGER', imGen: true },
			{ warteAuf: 'z.gOv == 0', max: 3000 },
			{ genTipp: [294, 185] }, { warte: 800 },       // Pfeil rechts: Talente Kampf/Körper
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 2', max: 3000, text: 'Gruppen als Knöpfe' },
			{ bild: 'talente' },
			{ genKnopfNr: 1 },                               // Gruppe Kampf
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 10', max: 3000 },   // 9 Talente + Abbrechen unter dem Bild
			{ genKnopfNr: 8 },                               // Schußwaffen
			{ warteAuf: 'z.gOv == 1 && z.gN == 0', max: 3000 },   // Meldung: gelungen / misslungen
			{ weiter: true, imGen: true },
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 2', max: 3000, text: 'nach der Meldung wieder die Gruppen' },
			{ genKnopfNr: 1 },
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 10', max: 3000 },
			{ bild: 'talentliste' },
			{ genKnopfNr: 8 },
			{ warteAuf: 'z.gOv == 1 && z.gN == 0', max: 3000 },
			{ weiter: true, imGen: true },
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 2', max: 3000 },
			{ genKnopfNr: 1 },                               // Gruppe Kampf
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 10', max: 3000 },   // 9 Talente + Abbrechen unter dem Bild
			{ genKnopfNr: 8 },                               // Schußwaffen
			{ warteAuf: 'z.gOv == 1 && z.gN == 0', max: 3000 },   // Meldung: gelungen / misslungen
			{ weiter: true, imGen: true },
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 2', max: 3000, text: 'nach der Meldung wieder die Gruppen' },
			{ genKnopfNr: 1 },                               // Gruppe Kampf
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 10', max: 3000 },   // 9 Talente + Abbrechen unter dem Bild
			{ genKnopfNr: 8 },                               // Schußwaffen
			{ warteAuf: 'z.gOv == 1 && z.gN == 0', max: 3000 },   // Meldung: gelungen / misslungen
			{ weiter: true, imGen: true },
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 2', max: 3000, text: 'nach der Meldung wieder die Gruppen' },
			{ bild: 'nach-steigern' },
			{ genKnopfNr: 2 },                               // Gruppe Körper: 10 Talente + Abbrechen
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 11', max: 3000 },
			{ genKnopf: 'Abbrechen' },
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 2', max: 3000, text: 'nach dem Abbrechen wieder die Gruppen' },
			{ genTipp: [294, 185] }, { warte: 800 },       // Seite 2: Talente Natur/Wissen
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 2', max: 3000 },
			{ genTipp: [294, 185] }, { warte: 800 },       // Seite 3: drei Gruppen
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 3', max: 3000 },
			{ genTipp: [294, 185] }, { warte: 800 },       // Seite 4: AT/PA, sieben Waffen
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 7', max: 3000 },
			{ bild: 'atpa' },
			{ genKnopfNr: 3 },                               // dritte Waffe
			{ warteAuf: '(z.gOv == 0 && z.gKnoepfe == 3) || (z.gOv == 1 && z.gN == 0)', max: 3000, text: 'AT oder PA (+ Abbrechen) oder Meldung' },
		],
	},
	{
		// Zauberseiten (5–10) mit Knöpfen unter dem Bild: Gruppen einer je Reihe, Zauberlisten zwei je Reihe
		name: 'Heldenerschaffung: Zauber steigern',
		schritte: [
			...startMenue(2),
			{ knopf: 'Generierung' },
			{ warteAuf: 'z.gen == 1 && z.gOv == 0 && z.gKnoepfe == 9', max: 15000 },
			{ genKnopf: 'NEUE WERTE' },
			{ warteAuf: 'z.gOv == 1 && /WURF/.test(z.gText)', max: 3000 },
			{ genWiederhole: { solange: 'WURF', wahl: 1 } },
			{ warteAuf: 'z.gOv == 0', max: 3000 },
			{ genKnopf: 'TYPUS FREI WÄHLEN' },
			{ warteAuf: 'z.gOv == 1 && /AUTOMATISCH/.test(z.gText)', max: 3000 },
			{ wahl: 'JA', imGen: true },
			{ warteAuf: 'z.gOv == 1 && /TYPUS/.test(z.gText) && z.gN == 12', max: 3000 },
			{ wahl: 'HEXE', imGen: true },
			{ warteAuf: 'z.gOv == 1 && /UMWANDELN/.test(z.gText)', max: 3000 },
			{ wahl: 2, imGen: true },                       // Steigerungsversuche nicht umwandeln
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 9', max: 3000 },
			// Seiten 1–4 (Talente, AT/PA), dann die Zauber; Pfeile unten wie die roten Pfeile im Bild
			{ warteAuf: "!document.querySelector('#gen iframe').contentDocument.getElementById('pfeile').hidden", seite: true, max: 3000 },
			{ genKnopf: 'Seite vor' },
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 2', max: 3000 },
			{ genKnopf: 'Seite vor' },
			{ genKnopf: 'Seite vor' },
			{ genKnopf: 'Seite vor' },
			{ genKnopf: 'Seite vor' },
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 3', max: 3000, text: 'Seite 5: 3 Knöpfe' },
			{ genKnopfNr: 1 },                               // erste Gruppe
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 6', max: 3000, text: '5 Zauber + Abbrechen' },
			{ bild: 'zaubergruppe' },
			{ genKnopf: 'Abbrechen' },
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 3', max: 3000 },
			{ genKnopf: 'Seite vor' },
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 3', max: 3000, text: 'Seite 6: 3 Knöpfe' },
			{ genKnopf: 'Seite vor' },
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 3', max: 3000, text: 'Seite 7: 3 Knöpfe' },
			{ genKnopf: 'Seite vor' },
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 3', max: 3000, text: 'Seite 8: 3 Knöpfe' },
			{ genKnopf: 'Seite vor' },
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 16', max: 3000, text: 'Seite 9: 16 Knöpfe' },
			{ bild: 'zauberliste' },
			{ genKnopfNr: 1 },                               // erster Zauber: steigern
			{ warteAuf: 'z.gOv == 1 && z.gN == 0', max: 3000 },   // Meldung: gelungen / misslungen
			{ weiter: true, imGen: true },
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 16', max: 3000, text: 'nach der Meldung wieder die Zauber' },
			{ genKnopf: 'Seite vor' },
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 10', max: 3000, text: 'Seite 10: 10 Knöpfe' },
			{ genKnopf: 'Seite zurück' },
			{ warteAuf: 'z.gOv == 0 && z.gKnoepfe == 16', max: 3000, text: 'zurück auf Seite 9' },
			{ bild: 'pfeile' },
		],
	},
	{
		// Stufe 2: Heldenerschaffung (ngen als gen.html im iframe) wie GEN.EXE aus dem Startmenü
		name: 'Heldenerschaffung: neuer Held im Tempel',
		schritte: [
			...startMenue(1),
			{ knopf: 'Generierung' },
			{ warteAuf: 'z.gen == 1 && z.gOv == 0 && z.gKnoepfe == 9', max: 15000 },   // Menü der Erschaffung als Knöpfe
			{ warteAuf: "document.querySelector('#gen iframe').contentDocument.getElementById('pfeile').hidden", seite: true, max: 1000 },   // Anfänger: keine weiteren Seiten
			{ warteAuf: 'ton.track === 4', seite: true, max: 1000 },        // Musik der Heldenerschaffung (ngen start_music)
			{ bild: 'gen-menue' },
			{ genKnopf: 'NAME' },
			{ warteAuf: 'z.gOv == 1 && /NAME/.test(z.gText)', max: 3000 },
			{ tippen: 'TESTHELD', imGen: true },
			{ warteAuf: 'z.gOv == 0', max: 3000 },
			{ genKnopf: 'NEUE WERTE' },
			{ warteAuf: 'z.gOv == 1 && /WURF/.test(z.gText)', max: 3000 },
			{ genWiederhole: { solange: 'WURF', wahl: 1 } },
			{ warteAuf: 'z.gOv == 0', max: 3000 },
			{ genKnopf: 'TYPUS FREI WÄHLEN' },   // „Typus wählen“ hängt von den Würfen ab
			{ warteAuf: 'z.gOv == 1 && /AUTOMATISCH/.test(z.gText)', max: 3000 },
			{ wahl: 'JA', imGen: true },
			{ warteAuf: 'z.gOv == 1 && /TYPUS/.test(z.gText) && z.gN == 12', max: 3000 },
			{ wahl: 'KRIEGER', imGen: true },
			{ warteAuf: 'z.gOv == 0', max: 3000 },
			{ bild: 'krieger' },
			{ genKnopf: 'HELD SPEICHERN' },
			{ warteAuf: 'z.gOv == 1 && /ABSPEICHERN/.test(z.gText)', max: 3000 },
			{ wahl: 'JA', imGen: true },
			{ warteAuf: 'z.gOv == 0', max: 3000 },
			{ genKnopf: 'PROGRAMMENDE' },
			{ warteAuf: 'z.gOv == 1 && /VERLASSEN/.test(z.gText)', max: 3000 },
			{ wahl: 'JA', imGen: true },
			// zurück im Spiel: Spielstand laden → „Keinen“, dann Tempel
			{ warteAuf: 'z.gen == 0 && z.ov == 1 && z.ovN == 6', max: 10000 },
			{ warteAuf: 'ton.track !== 4', seite: true, max: 1000 },        // danach wieder die Musik des Spiels
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
			// angehaltener AudioContext (iOS nach App-Wechsel, Touch ohne Geste): die nächste Berührung setzt ihn fort
			{ warteAuf: "ton.ctx.state === 'running'", seite: true, max: 3000 },
			{ js: 'ton.ctx.suspend()' },
			{ warteAuf: "ton.ctx.state === 'suspended'", seite: true, max: 3000 },
			{ weiter: true },
			{ warteAuf: "ton.ctx.state === 'running'", seite: true, max: 3000 },
		],
	},
	{
		name: 'Reisekarte',
		schritte: [
			...spielBereit, ...heldenAufnehmen(1), ...tempelVerlassen,
			{ js: 'Module._web_test_sign(1)' },
			{ knopf: 'Vorwärts' },
			{ warteAuf: 'z.karte == 1', max: 5000 },
			// mobil: eigene Kartenansicht (karte.js) mit Namen und den Zielen des Wegweisers als Knöpfe
			{ warteAuf: "karte.aktiv() && karte.zustand().namen > 60 && document.querySelectorAll('#karte .ziele button').length >= 2", seite: true, max: 5000 },
			{ warteAuf: "(() => { const r = document.querySelector('#karte .flaeche').getBoundingClientRect(); return r.height > window.innerHeight * 0.4 && /^thorwal$/i.test(document.querySelector('#karte [data-ort=\"1\"]').textContent); })()", seite: true, max: 1000 },
			{ warte: 3000 },                               // Timer zeichnet die Gruppenmarkierung
			{ bild: 'reisekarte' },
			// Zoom-Knopf mit dem Finger: vergrößert, klickt aber nicht die Karte dahinter (sonst Ortsbeschreibung)
			{ js: "window.massstab = karte.zustand().s; window.kartenKlicks = 0; const k = Module._web_click; Module._web_click = (...a) => { window.kartenKlicks++; return k(...a); }" },
			{ tippBei: "(() => { const r = document.querySelector('#karte [data-zoom=\"+\"]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()" },
			{ warteAuf: 'karte.zustand().s > window.massstab * 1.4', seite: true, max: 1000 },
			{ warte: 500 },
			{ warteAuf: 'window.kartenKlicks === 0', seite: true, max: 1000 },
			{ erwarte: 'z.ov == 0 && z.karte == 1', text: 'keine Ortsbeschreibung nach dem Zoom-Knopf' },
			// Antippen eines Orts: Beschreibung wie im Original (Klick an der Kartenposition)
			{ tippBei: "(() => { const o = [...document.querySelectorAll('#karte .ziel')][0]; return karte.punkt(...o.dataset.pos.split(',').map(Number)); })()" },
			{ warteAuf: 'z.ov == 1 && z.dialog == 1', max: 3000 },
			{ weiter: true },
			{ warteAuf: 'z.ov == 0 && z.karte == 1', max: 3000 },
			// Namen am Rand: bis in die rechte obere Ecke gezogen, steht jeder Name ganz in der Fläche
			// (vorher endete die Karte am Bildrand, Namen oben und rechts waren abgeschnitten)
			{ ziehen: "(() => { const r = document.querySelector('#karte .flaeche').getBoundingClientRect(); return [r.x + r.width * 0.3, r.y + r.height * 0.7, r.x + r.width * 0.3 - 3000, r.y + r.height * 0.7 + 3000]; })()" },
			{ ziehen: "(() => { const r = document.querySelector('#karte .flaeche').getBoundingClientRect(); return [r.x + r.width * 0.3, r.y + r.height * 0.7, r.x + r.width * 0.3 - 3000, r.y + r.height * 0.7 + 3000]; })()" },
			{ warteAuf: "(() => { const f = document.querySelector('#karte .flaeche').getBoundingClientRect(); const n = [...document.querySelectorAll('#karte .namen div')].map((d) => d.getBoundingClientRect()); const oben = Math.min(...n.map((r) => r.top)), rechts = Math.max(...n.map((r) => r.right)); return oben >= f.top + 10 && rechts <= f.right; })()", seite: true, max: 1000 },
			{ erwarte: 'z.ov == 0 && z.karte == 1', text: 'Ziehen klickt nichts an' },
			{ bild: 'kartenrand' },
			// erstes Ziel per Knopf: die Reise beginnt ohne Menü
			{ js: "document.querySelector('#karte .ziele button').click()" },
			{ warteAuf: "karte.zustand().reise == 1 && /Unterwegs nach/.test(document.querySelector('#karte .ziele').textContent)", seite: true, max: 5000 },
			{ erwarte: 'z.ov == 0', text: 'kein Menü beim Wählen per Knopf' },
			// Datumszeile zwischen Karte und Zielen (die Uhr des Spiels liegt im Zoom oft außerhalb)
			{ warteAuf: "(() => { const c = document.getElementById('datum'); if (c.parentNode.id != 'karte' || !c.offsetParent) return false; const d = c.getContext('2d').getImageData(6, 4, 300, 7).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 128) n++; return n > 150; })()", seite: true, max: 3000 },
			{ warte: 3000 },
			{ bild: 'unterwegs' },
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
			// Begrüßung ist eine von vier Varianten (Zufall): wörtliche Rede und drei Antworten; eine Variante
			// beginnt mit einer Erzählung („NACHDEM IHR EINIGE ZEIT VOR DER THEKE …“) vor der Rede
			{ erwarte: 'z.ovN == 3 && /^[A-ZÄÖÜ ,.!?]*<[A-ZÄÖÜ ,.!?]+>$/.test(z.ovText)', text: 'Begrüßung des Händlers mit drei Antworten' },
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
			...spielBereit, ...heldenAufnehmen(1), ...tempelVerlassen, ...ohneZufall,
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
		// Im Querformat reichte die Ansicht (volle Breite) unter die Leiste, Ortszeile und Gruppe fehlten
		name: 'Querformat: Bild endet über der Leiste, Textbox so breit wie das Bild',
		schritte: [
			...spielBereit, ...heldenAufnehmen(1), ...tempelVerlassen,
			{ groesse: [844, 390] },
			{ warteAuf: "(() => { const l = document.getElementById('leiste').getBoundingClientRect().top; const t = [...document.querySelectorAll('#mobil > .teil')].filter((c) => c.offsetParent); return t.length >= 3 && t.every((c) => c.getBoundingClientRect().bottom <= l + 0.5); })()", seite: true, max: 2000 },
			// Textbox (Antippen der Datumszeile) nicht breiter als das Bild darüber
			{ tippBei: "(() => { const r = document.getElementById('datum').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()" },
			{ warteAuf: 'z.ov == 1', max: 3000 },
			{ warteAuf: "(() => { const k = document.querySelector('#dialog .karte').getBoundingClientRect(), b = document.querySelector('#mobil > .teil').getBoundingClientRect(); return k.width <= Math.max(b.width, 22 * 16) + 1 && Math.abs(k.left + k.width / 2 - b.left - b.width / 2) < 1; })()", seite: true, max: 2000 },
			{ bild: 'querformat' },
			{ weiter: true },
			{ warteAuf: 'z.ov == 0', max: 3000 },
			// Hochformat unverändert: Ansicht über die volle Breite
			{ groesse: [390, 844] },
			{ warteAuf: "Math.abs(document.querySelector('#mobil > .teil').getBoundingClientRect().width - document.getElementById('mobil').getBoundingClientRect().width) < 1", seite: true, max: 2000 },
		],
	},
	{
		// Aktionsknöpfe (aktionen.js) statt der Icons: Beschriftung je Ort, Antippen wie ein Klick aufs Icon,
		// im flachen Querformat wieder die Icons
		name: 'Aktionsknöpfe: Tempel und Stadt',
		aktionsknoepfe: true,
		schritte: [
			...spielBereit,
			{ warteAuf: "document.querySelectorAll('#aktionsknoepfe button').length == 6", seite: true, max: 3000 },
			{ erwarte: "[...document.querySelectorAll('#aktionsknoepfe button')].map((b) => b.textContent).join('|') == 'Held aufnehmen|Held entlassen|Held löschen|Beten|Opfern|Verlassen'", seite: true, text: 'Tempel: neun Knöpfe in der Reihenfolge der Icons' },
			{ erwarte: "getComputedStyle(document.getElementById('icons-halter')).display == 'none'", seite: true, text: 'Icons ausgeblendet' },
			{ erwarte: "[...document.querySelectorAll('#aktionsknoepfe canvas')].every((c) => c.getContext('2d').getImageData(0, 0, 24, 24).data.some((v, i) => i % 4 < 3 && v > 0))", seite: true, text: 'Icon im Knopf gezeichnet' },
			{ bild: 'aktionsknoepfe-tempel' },
			{ knopf: 'Held aufnehmen' },
			{ warteAuf: 'z.dialog == 1 && z.ov == 1', max: 3000 },
			{ wahl: 1 }, { warteAuf: 'z.helden == 1 && z.ov == 1', max: 3000 },
			{ abbrechen: true }, { warteAuf: 'z.dialog == 0 && z.haupt == 1 && z.ov == 0', max: 3000 },
			...ohneZufall,
			{ knopf: 'Verlassen' },
			{ warteAuf: `z.ort == 0 && z.stadt == ${THORWAL} && z.haupt == 1`, max: 5000 },
			{ warteAuf: "[...document.querySelectorAll('#aktionsknoepfe button')].map((b) => b.textContent).slice(0, 3).join('|') == 'Gruppe teilen|Gruppen vereinen|Gruppe wechseln'", seite: true, max: 3000 },
			{ erwarte: "document.querySelector('#aktionsknoepfe button[data-icon=\"45\"]')?.classList.contains('grau')", seite: true, text: 'Gruppen vereinen ausgegraut' },
			{ warte: 500 }, { bild: 'aktionsknoepfe-stadt' },
			// direkt unter dem Bild (Datumszeile), Leiste ganz sichtbar
			{ erwarte: "[...document.querySelectorAll('#aktionsknoepfe button')].every((b) => b.getBoundingClientRect().bottom <= document.getElementById('mobil').getBoundingClientRect().bottom + 0.5)", seite: true, text: 'Aktionsknöpfe nicht abgeschnitten' },
			{ erwarte: "Math.abs(document.getElementById('aktionsknoepfe').getBoundingClientRect().top - document.getElementById('datum').getBoundingClientRect().bottom) < 4", seite: true, text: 'Knöpfe bündig unter dem Bild' },
			{ erwarte: "document.getElementById('leiste').getBoundingClientRect().bottom <= innerHeight + 0.5", seite: true, text: 'Leiste ganz sichtbar' },
			{ erwarte: "[...document.querySelectorAll('#leiste .text')].every((t) => t.offsetParent && t.scrollWidth <= t.clientWidth)", seite: true, text: 'Protokoll, Aufträge, Menü ungekürzt' },
			// Info (Spieloptionen) und Karte nicht im Raster: im Menü bzw. unter der Minimap
			{ erwarte: "!document.querySelector('#aktionsknoepfe [data-icon=\"37\"]') && !document.querySelector('#aktionsknoepfe [data-icon=\"39\"]') && !!document.querySelector('#karte-unter [data-icon=\"39\"]')", seite: true, text: 'ohne Info, Karte unter der Minimap' },
			// OK und Zurück nur in den Vollbild-Ansichten (Tagebuch schließt mit OK)
			{ erwarte: "!document.querySelector('#leiste [data-key=enter]').offsetParent && !document.querySelector('#leiste [data-key=rechtsklick]').offsetParent", seite: true, text: 'Hauptbildschirm ohne OK und Zurück' },
			{ knopf: 'Menü' }, { knopf: 'Tagebuch' },
			{ warteAuf: 'z.haupt == 0 && z.vollbild == 1 && z.ov == 0', max: 5000 },
			{ warteAuf: "!!document.querySelector('#leiste [data-key=rechtsklick]').offsetParent && getComputedStyle(document.getElementById('aktionsknoepfe')).display == 'none'", seite: true, max: 2000 },
			{ erwarte: "Math.abs(document.querySelector('#mobil > .voll').getBoundingClientRect().bottom + 3 - document.getElementById('leiste').getBoundingClientRect().top) < 4", seite: true, text: 'Vollbild: Leiste direkt unter dem Bild' },
			{ bild: 'aktionsknoepfe-vollbild' },
			{ knopf: 'OK' },
			{ warteAuf: 'z.ov == 0 && z.haupt == 1 && z.vollbild == 0', max: 5000 },
			// Reisekarte behält den Platz über der Leiste
			{ js: 'Module._web_test_sign(1)' },
			{ knopf: 'Vorwärts' },
			{ warteAuf: 'z.karte == 1', max: 5000 },
			{ warteAuf: "karte.aktiv() && document.querySelectorAll('#karte .ziele button').length >= 2 && document.querySelector('#karte .flaeche').getBoundingClientRect().height > innerHeight * 0.4", seite: true, max: 5000 },
			{ erwarte: "document.getElementById('leiste').getBoundingClientRect().bottom <= innerHeight + 0.5", seite: true, text: 'Reisekarte: Leiste ganz sichtbar' },
			{ erwarte: "!document.querySelector('#leiste .kreuz').offsetParent && !document.querySelector('#leiste [data-key=rechtsklick]').offsetParent && !document.querySelector('#leiste [data-key=enter]').offsetParent", seite: true, text: 'Reisekarte: ohne Kreuz, OK und Zurück der Leiste' },
			{ bild: 'aktionsknoepfe-reisekarte' },
			{ tippBei: "(() => { const r = document.querySelector('#karte .ziele button.zurueck').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()" },
			{ warteAuf: 'z.karte == 0 && z.haupt == 1 && z.ov == 0', max: 5000 },
			{ groesse: [844, 390] },
			{ warteAuf: "getComputedStyle(document.getElementById('aktionsknoepfe')).display == 'none' && document.getElementById('icons').offsetParent !== null", seite: true, max: 2000 },
			{ groesse: [390, 844] },
			{ warteAuf: "getComputedStyle(document.getElementById('aktionsknoepfe')).display == 'grid'", seite: true, max: 2000 },
		],
	},
	{
		// Minimap (minimap.js) links neben dem Steuerkreuz: in der Stadt und im Dungeon, folgt der Gruppe,
		// nicht in Vollbild-Ansichten, abschaltbar
		name: 'Minimap: Stadt und Dungeon',
		aktionsknoepfe: true,
		schritte: [
			...spielBereit,
			{ knopf: 'Held aufnehmen' },
			{ warteAuf: 'z.dialog == 1 && z.ov == 1', max: 3000 },
			{ wahl: 1 }, { warteAuf: 'z.helden == 1 && z.ov == 1', max: 3000 },
			{ abbrechen: true }, { warteAuf: 'z.dialog == 0 && z.haupt == 1 && z.ov == 0', max: 3000 },
			...ohneZufall,
			{ knopf: 'Verlassen' },
			{ warteAuf: `z.ort == 0 && z.stadt == ${THORWAL} && z.haupt == 1`, max: 5000 },
			{ warteAuf: "document.body.classList.contains('minimap') && minimap.stand?.w == 32", seite: true, max: 3000 },
			{ erwarte: "(() => { const s = minimap.stand; return s.felder.length == 2 * 32 * 16 && s.felder.match(/../g).filter((v) => v != 'ff').length >= 4; })()", seite: true, text: 'Thorwal: 32 Spalten, Umgebung erkundet' },
			// Kreuz rechts, Minimap links, beide ganz in der Leiste, quadratisch
			{ erwarte: "(() => { const m = document.getElementById('minimap').getBoundingClientRect(), k = document.querySelector('#leiste .kreuz').getBoundingClientRect(), l = document.getElementById('leiste').getBoundingClientRect(); return m.width > 100 && Math.abs(m.width - m.height) < 1 && m.right <= k.left && m.left >= l.left && k.right <= l.right + 0.5 && m.bottom <= l.bottom; })()", seite: true, text: 'Minimap links, Kreuz rechts' },
			{ erwarte: "(() => { const d = document.getElementById('minimap').getContext('2d').getImageData(0, 0, 192, 192).data; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] < 60) return true; return false; })()", seite: true, text: 'gelber Pfeil der Gruppe' },
			{ bild: 'minimap-stadt' },
			// breites Browserfenster: Leiste so breit wie Bild und Aktionsknöpfe, nicht über die ganze Breite
			{ groesse: [1600, 900] },
			{ warteAuf: "(() => { const a = document.getElementById('aktionsknoepfe').getBoundingClientRect(); return a.width < 1000 && [document.querySelector('#leiste .rechts'), document.getElementById('minimap'), document.querySelector('#leiste .kreuz'), document.querySelector('#leiste .menue')].every((e) => { const r = e.getBoundingClientRect(); return r.left >= a.left - 0.5 && r.right <= a.right + 0.5; }); })()", seite: true, max: 2000 },
			{ bild: 'minimap-breit' },
			{ groesse: [390, 844] },
			{ js: "window.__mm = [minimap.stand.x, minimap.stand.y, minimap.stand.d].join()" },
			{ knopf: 'Rechts drehen' },
			{ warteAuf: "[minimap.stand.x, minimap.stand.y, minimap.stand.d].join() != window.__mm", seite: true, max: 3000 },
			// ein Schritt: die Felder um die Gruppe erscheinen ohne weiteres Bild (das Spiel deckt sie erst
			// nach dem Bild des Schritts auf); Blick nach Westen → zweimal links, dann nach Osten
			...wege('LL'),
			{ js: "window.__mm = [minimap.stand.x, minimap.stand.y].join()" },
			{ knopf: 'Vorwärts' },
			{ warteAuf: "[minimap.stand.x, minimap.stand.y].join() != window.__mm", seite: true, max: 3000 },
			{ warteAuf: "(() => { const s = minimap.stand; for (let y = Math.max(0, s.y - 1); y <= Math.min(15, s.y + 1); y++) for (let x = Math.max(0, s.x - 1); x <= Math.min(s.w - 1, s.x + 1); x++) if (s.felder.substr(2 * (x + y * s.w), 2) == 'ff') return false; return true; })()", seite: true, max: 1000 },
			// Tagebuch (Vollbild): ohne Minimap
			{ knopf: 'Menü' }, { knopf: 'Tagebuch' },
			{ warteAuf: 'z.haupt == 0 && z.vollbild == 1 && z.ov == 0', max: 5000 },
			{ warteAuf: "!document.getElementById('minimap').offsetParent", seite: true, max: 2000 },
			{ knopf: 'OK' },
			{ warteAuf: 'z.ov == 0 && z.haupt == 1 && z.vollbild == 0', max: 5000 },
			// Lager: ohne Minimap und Steuerkreuz (man läuft dort nicht), danach wieder da
			{ knopf: 'Lager aufschlagen' },
			{ warteAuf: 'z.ort == 18 && z.haupt == 1 && z.ov == 0', max: 5000 },
			{ warteAuf: "!document.getElementById('minimap').offsetParent && !document.querySelector('#leiste .kreuz').offsetParent && !!document.querySelector('#aktionsknoepfe button')", seite: true, max: 2000 },
			{ bild: 'minimap-lager' },
			{ knopf: 'Verlassen' },
			{ warteAuf: 'z.ort == 0 && z.haupt == 1 && z.ov == 0', max: 5000 },
			{ warteAuf: "!!document.getElementById('minimap').offsetParent && !!document.querySelector('#leiste .kreuz').offsetParent", seite: true, max: 2000 },
			// Dungeon: 16 Spalten, folgt beim Laufen
			{ js: 'Module._web_test_dungeon(13)' },
			{ warteAuf: 'z.dungeon == 13 && z.haupt == 1', max: 10000 },
			{ warteAuf: "minimap.stand?.dungeon == 13 && minimap.stand.w == 16 && !!document.getElementById('minimap').offsetParent", seite: true, max: 3000 },
			{ js: "window.__mm = [minimap.stand.x, minimap.stand.y].join()" },
			{ merke: 'start' },
			{ knopf: 'Vorwärts' },
			{ warteAuf: 'z.y != m.start.y || z.x != m.start.x || z.ov == 1', max: 5000 },
			{ warteAuf: "[minimap.stand.x, minimap.stand.y].join() != window.__mm", seite: true, max: 3000 },
			{ bild: 'minimap-dungeon' },
			// abschaltbar
			{ js: "einstellung.minimap.setze('aus')" },
			{ warteAuf: "!document.getElementById('minimap').offsetParent && !!document.querySelector('#leiste .kreuz').offsetParent", seite: true, max: 2000 },
			{ js: "einstellung.minimap.setze('an')" },
		],
	},
	{
		// Heldenbogen (heldenbogen.js, BrightEyes heldenbogen.cpp): im Hochformat statt des Kreuzes Gruppe,
		// Gegenstandskarte und Kacheln; Antippen wählt nur aus, Aktionen über die Eingaben des Originals
		name: 'Heldenbogen: Kacheln und Aktionen',
		aktionsknoepfe: true,
		schreibung: true,
		schritte: [
			...spielBereit,
			...[1, 2].flatMap((n) => [
				{ knopf: 'Held aufnehmen' }, { warteAuf: 'z.dialog == 1 && z.ov == 1', max: 3000 },
				{ wahl: 1 }, { warteAuf: `z.helden == ${n} && z.ov == 1`, max: 3000 },
				{ abbrechen: true }, { warteAuf: 'z.dialog == 0 && z.haupt == 1 && z.ov == 0', max: 3000 },
			]),
			{ doppeltipp: ['Gruppe', 20, 170] },
			{ warteAuf: 'z.hb && z.hb.offen == 1 && z.hb.seite == 1 && z.hb.helden.length == 2 && z.hb.held == 0', max: 3000 },
			// statt Kreuz, OK und Zurück: Ablage in der Leiste, ohne Scrollen, unter dem Bild
			{ erwarte: "(() => { const h = document.getElementById('heldenbogen'), r = h.getBoundingClientRect(), v = document.querySelector('#mobil .voll').getBoundingClientRect(); return !document.querySelector('#leiste .kreuz').offsetParent && !document.querySelector('#leiste [data-key=enter]').offsetParent && document.querySelectorAll('.hb-kachel').length == 23 && h.scrollHeight <= h.clientHeight + 1 && r.top >= v.bottom - 0.5 && document.querySelector('.hb-helden').getBoundingClientRect().top - v.bottom < 20 && document.querySelector('.hb-reiter').getBoundingClientRect().top < document.querySelector('.hb-karte').getBoundingClientRect().top && document.querySelector('#leiste .menue').getBoundingClientRect().top - document.querySelector('.hb-kacheln.acht').getBoundingClientRect().bottom < 20; })()", seite: true, text: 'Ablage statt Kreuz: Gruppe direkt unter dem Bild, Kacheln direkt über der Leiste' },
			// Testheld (Arbosh): Rucksack 7 Wasserschlauch, 8 Proviant, 9 und 10 Werkzeug; rechte Hand Waffe, Beine
			{ erwarte: 'z.hb.felder[7] && z.hb.felder[7].nahrung && z.hb.felder[9] && z.hb.felder[10] && z.hb.felder[3] && z.hb.felder[3].waffe && !z.hb.felder[14]', text: 'Inventar des Testhelden' },
			{ erwarte: "getComputedStyle(document.querySelector('.hb-helden button.an')).backgroundColor != getComputedStyle(document.querySelector('.hb-helden button:not(.an)')).backgroundColor", seite: true, text: 'aktiver Held farbig' },
			{ bild: 'heldenbogen' },
			// iPhone in Safari (Leisten oben und unten): Bild etwas kleiner, Ablage ohne Scrollen
			{ groesse: [390, 664] },
			{ warteAuf: "(() => { const h = document.getElementById('heldenbogen'); return h.clientHeight > 0 && h.scrollHeight <= h.clientHeight + 1 && document.querySelector('#leiste .menue').getBoundingClientRect().bottom <= innerHeight + 0.5 && document.querySelector('#mobil .voll').getBoundingClientRect().width >= 290 && document.querySelector('.hb-kachel').getBoundingClientRect().width >= 38; })()", seite: true, max: 3000 },
			{ bild: 'heldenbogen-klein' },
			{ groesse: [390, 844] },
			// Antippen wählt nur aus (Kachel und Bild)
			hbKachel(9),
			{ warteAuf: 'z.hb.sel == 9 && !z.hb.halt && !z.hb.laeuft', max: 2000 },
			{ tipp: ['Bildschirm', 0x20 + 9, 0x37 + 9] },
			{ warteAuf: 'z.hb.sel == 8 && !z.hb.halt', max: 2000 },
			{ erwarte: "document.querySelector('.hb-kachel[data-feld=\"8\"]').classList.contains('sel') && /Proviant/i.test(document.querySelector('.hb-karte').textContent)", seite: true, text: 'Karte zum Proviant' },
			// Ansehen: Text des Spiels (Auge)
			hbKachel(9),
			{ warteAuf: 'z.hb.sel == 9', max: 2000 },
			hbKnopf('Ansehen'),
			{ warteAuf: 'z.ov == 1', max: 3000 },
			{ weiter: true },
			{ warteAuf: 'z.ov == 0 && z.hb && !z.hb.halt && !z.hb.laeuft', max: 3000 },
			// Verschieben: Werkzeug von 10 nach 14
			{ js: 'window.__id = heldenbogen.daten.felder[10].id' },
			hbKachel(10),
			{ warteAuf: 'z.hb.sel == 10', max: 2000 },
			hbKnopf('Verschieben'),
			{ warteAuf: "document.querySelectorAll('.hb-kachel.ziel').length == 22", seite: true, max: 2000 },
			hbKachel(14),
			{ warteAuf: '!z.hb.laeuft && !z.hb.felder[10] && z.hb.felder[14]', max: 3000 },
			{ erwarte: 'heldenbogen.daten.felder[14].id == window.__id', seite: true, text: 'Werkzeug liegt in Feld 14' },
			// Ablegen und Ausrüsten: Waffe der rechten Hand in den Rucksack (erstes freies Feld: 10) und zurück
			{ js: 'window.__waffe = heldenbogen.daten.felder[3].id' },
			hbKachel(3),
			{ warteAuf: 'z.hb.sel == 3', max: 2000 },
			{ warteAuf: "/\\dW6/.test(document.querySelector('.hb-karte-kopf').textContent) && /AT .* PA /.test(document.querySelector('.hb-karte-kopf').textContent) && !/Rucksack \\d/.test(document.querySelector('.hb-karte').textContent)", seite: true, max: 2000 },
			{ bild: 'waffe' },
			hbKnopf('Ablegen'),
			{ warteAuf: '!z.hb.laeuft && !z.hb.felder[3] && z.hb.felder[10]', max: 3000 },
			{ erwarte: 'heldenbogen.daten.felder[10].id == window.__waffe', seite: true, text: 'Waffe im Rucksack' },
			hbKachel(10),
			{ warteAuf: 'z.hb.sel == 10', max: 2000 },
			hbKnopf('Ausrüsten'),
			{ warteAuf: '!z.hb.laeuft && z.hb.felder[3] && !z.hb.felder[10]', max: 3000 },
			{ erwarte: 'heldenbogen.daten.felder[3].id == window.__waffe', seite: true, text: 'Waffe wieder in der rechten Hand' },
			// Weitergeben: Werkzeug aus 14 an den zweiten Helden, danach wieder der erste
			hbKachel(14),
			{ warteAuf: 'z.hb.sel == 14', max: 2000 },
			hbKnopf('Verschieben'),
			{ warteAuf: "document.querySelectorAll('.hb-helden button.ziel').length == 1", seite: true, max: 2000 },
			{ bild: 'verschieben' },
			{ js: "document.querySelector('.hb-helden button.ziel').click()" },
			{ warteAuf: '!z.hb.laeuft && z.hb.held == 0 && !z.hb.felder[14]', max: 5000 },
			{ knopf: 'Hjaldis' },
			{ warteAuf: '!z.hb.laeuft && z.hb.held == 1', max: 3000 },
			{ erwarte: 'heldenbogen.daten.felder.some((f) => f && f.id == window.__id)', seite: true, text: 'Werkzeug beim zweiten Helden' },
			// Reiter: Talente zeigt das Bild der Talente, das Inventar bleibt; Auswahl merkt sich die Seite
			{ knopf: 'Talente' },
			{ warteAuf: '!z.hb.laeuft && z.hb.seite == 3', max: 3000 },
			{ js: 'window.__f = heldenbogen.daten.felder.findIndex((f, i) => f && i >= 7)' },
			{ erwarte: "window.__f >= 7 && document.querySelectorAll('.hb-kachel:not(.leer)').length >= 2 && !!document.querySelector('.hb-reiter [data-seite=\"3\"].an')", seite: true, text: 'Inventar auf der Seite Talente' },
			// Bilder vom Spiel (nicht aus dem Bild ausgeschnitten): farbige Pixel in der Kachel
			{ erwarte: "(() => { const d = document.querySelector('.hb-kachel[data-feld=\"' + window.__f + '\"] canvas').getContext('2d').getImageData(0, 0, 16, 16).data; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 120) return true; return false; })()", seite: true, text: 'Gegenstandsbild in der Kachel' },
			{ bild: 'talente' },
			hbKachel('window.__f'),
			{ warteAuf: "document.querySelector('.hb-kachel[data-feld=\"' + window.__f + '\"]').classList.contains('sel')", seite: true, max: 2000 },
			{ erwarte: 'z.hb.seite == 3', text: 'Auswahl ohne Seitenwechsel' },
			hbKnopf('Ansehen'),
			{ warteAuf: 'z.ov == 1', max: 3000 },
			{ weiter: true },
			{ warteAuf: 'z.ov == 0 && z.hb && !z.hb.laeuft && z.hb.seite == 3', max: 3000 },
			// Zauber nur für Zauberkundige
			{ erwarte: "document.querySelector('.hb-reiter [data-seite=\"4\"]').disabled == !heldenbogen.daten.helden.find((h) => h.i == heldenbogen.daten.held).zauber", seite: true, text: 'Reiter Zauber' },
			{ knopf: 'AT/PA' },
			{ warteAuf: '!z.hb.laeuft && z.hb.seite == 2', max: 3000 },
			{ knopf: 'Grundwerte' },
			{ warteAuf: '!z.hb.laeuft && z.hb.seite == 1', max: 3000 },
			// selten: Talent anwenden über „⋯“ (Auswahl des Spiels im Overlay)
			{ erwarte: "!document.querySelector('.hb-mehr-liste').offsetParent", seite: true, text: 'Talent/Zauber zugeklappt' },
			{ knopf: 'Talent anwenden, Zauber sprechen' },
			{ knopf: 'Talent anwenden' },
			{ warteAuf: 'z.ov == 1 && z.ovN > 1', max: 3000 },
			{ abbrechen: true },
			{ warteAuf: 'z.ov == 0 && z.hb && !z.hb.laeuft', max: 3000 },
			// Schließen
			{ knopf: 'Heldenbogen schließen' },
			{ warteAuf: 'z.haupt == 1 && !z.hb', max: 3000 },
			{ erwarte: "!!document.querySelector('#leiste .kreuz').offsetParent", seite: true, text: 'Kreuz wieder da' },
		],
	},
	{
		// Kampf im Hochformat (kampf.js): Feld zoombar, Kampfmenü als Knöpfe statt Overlay, Bewegen mit
		// schrägen Pfeilen, Antippen markiert nur, zweites Tippen bestätigt; Zielwahl abbrechen; Computerkampf
		name: 'Kampf: Feld, Befehle und Zielwahl',
		aktionsknoepfe: true,
		schreibung: true,   // Kampflog: Namen trotzdem groß
		schritte: [
			...spielBereit,
			{ knopf: 'Held aufnehmen' }, { warteAuf: 'z.dialog == 1 && z.ov == 1', max: 3000 },
			...[1, 2, 3].flatMap((n) => [{ wahl: 1 }, { warteAuf: `z.helden == ${n} && z.ov == 1`, max: 3000 }, { warte: 300 }]),
			{ abbrechen: true }, { warteAuf: 'z.dialog == 0 && z.haupt == 1 && z.ov == 0', max: 3000 },
			{ knopf: 'Verlassen' },
			{ warteAuf: `z.ort == 0 && z.stadt == ${THORWAL} && z.haupt == 1`, max: 5000 },
			{ warte: 500 },
			...ohneZufall,
			{ js: `Module._web_test_fight(${KAMPF_THOR8})` },
			{ knopf: 'Vorwärts' },
			{ warteAuf: 'z.kampf == 1 && z.kb && z.kb.modus == "menue" && z.kb.held >= 0', max: 15000 },
			// Feld statt Bild, Bedienfeld statt Kreuz, kein Overlay; alles ohne Scrollen
			{ erwarte: "document.getElementById('dialog').hidden && ['10', '5', '1', '2', '3'].every((n) => document.querySelector('#kampfbedien [data-befehl=\"' + n + '\"]')) && ![7, 8, 6, 11, 9, 12].some((n) => document.querySelector('#kampfbedien [data-befehl=\"' + n + '\"]')) && !!document.querySelector('#kampfbedien .kb-verlauf')", seite: true, text: 'Kampfmenü als Knöpfe mit Kampfverlauf, kein Overlay, der Rest hinter ⋯' },
			{ erwarte: "!document.querySelector('#leiste .kreuz').offsetParent && !document.querySelector('#mobil .voll').offsetParent && document.getElementById('kampf').getBoundingClientRect().height > 200", seite: true, text: 'Feld statt Bild, ohne Steuerkreuz' },
			{ erwarte: "(() => { const b = document.getElementById('kampfbedien'); return b.scrollHeight <= b.clientHeight + 1 && b.getBoundingClientRect().top >= document.getElementById('kampf').getBoundingClientRect().bottom - 0.5 && document.querySelector('#leiste .menue').getBoundingClientRect().bottom <= innerHeight + 0.5; })()", seite: true, text: 'Bedienfeld unter dem Feld, ohne Scrollen' },
			{ erwarte: 'Math.abs(z.kb.s - 1.5) < 0.01', text: 'Startansicht 1,5×' },
			{ bild: 'kampf-menue' },
			// iPhone in Safari: Feld niedriger, Bedienfeld ohne Scrollen
			{ groesse: [390, 664] },
			{ warteAuf: "(() => { const b = document.getElementById('kampfbedien'); return b.clientHeight > 0 && b.scrollHeight <= b.clientHeight + 1 && document.querySelector('#leiste .menue').getBoundingClientRect().bottom <= innerHeight + 0.5 && document.getElementById('kampf').getBoundingClientRect().height > 180; })()", seite: true, max: 3000 },
			{ bild: 'kampf-klein' },
			{ groesse: [390, 844] },
			// Zoom: Stufen und ganzes Feld
			{ knopf: 'Kampffeld vergrößern' },
			{ warteAuf: 'Math.abs(z.kb.s - 2) < 0.01', max: 2000 },
			{ knopf: 'Ganzes Kampffeld' },
			{ warteAuf: 'Math.abs(z.kb.s - 1) < 0.01', max: 2000 },
			{ knopf: 'Kampffeld vergrößern' },
			// Bewegen: schräge Pfeile verschieben die Markierung entlang der Feldachsen
			{ merke: 'vorher' },
			{ knopf: 'Bewegen' },
			{ warteAuf: 'z.kb.p == 3 && z.kb.modus == "ziel" && z.kb.m[0] == z.kb.a[0] && z.kb.m[1] == z.kb.a[1]', max: 3000 },
			{ knopf: 'Nach rechts unten' },
			{ warteAuf: 'z.kb.m[0] == z.kb.a[0] + 1 && z.kb.m[1] == z.kb.a[1]', max: 2000 },
			{ knopf: 'Nach rechts oben' },
			{ warteAuf: 'z.kb.m[0] == z.kb.a[0] + 1 && z.kb.m[1] == z.kb.a[1] + 1', max: 2000 },
			{ bild: 'kampf-bewegen' },
			// Antippen eines Felds markiert nur (die Markierung folgt dem Zeiger)
			{ tippBei: 'kampf.punkt(kampf.zustand().a[0] - 1, kampf.zustand().a[1])' },
			{ warteAuf: 'z.kb.p == 3 && z.kb.m[0] == z.kb.a[0] - 1 && z.kb.m[1] == z.kb.a[1]', max: 2000 },
			{ warte: 500 },
			{ erwarte: 'z.kb.p == 3 && z.kb.bp == m.vorher.kb.bp', text: 'erstes Tippen bewegt nicht' },
			// Abbrechen: zurück zu den Befehlen, BP unverändert
			{ knopf: 'Abbrechen' },
			{ warteAuf: 'z.kb.modus == "menue" && z.kb.p == 0', max: 3000 },
			// Angriff: Zielwahl mit „Angreifen“, abbrechen
			{ knopf: 'Angriff' },
			{ warteAuf: 'z.kb.p == 2 && z.kb.modus == "ziel"', max: 3000 },
			{ erwarte: "(() => { const b = document.querySelector('#kampfbedien .kb-ok'), t = b.firstChild; return t.textContent == 'Angreifen' && t.scrollWidth <= t.clientWidth; })()", seite: true, text: 'Bestätigen heißt „Angreifen“, nicht abgeschnitten' },
			{ bild: 'kampf-angriff' },
			// Abbrechen: das Original meldet danach „Ungültiges Ziel!“ (seg033, Abbruch liefert −99), die Meldung schließen
			{ knopf: 'Abbrechen' },
			{ warteAuf: 'z.kb.p == 0 && (z.ov == 1 || z.kb.modus == "menue")', max: 3000 },
			{ js: "(() => { const d = document.getElementById('dialog'); if (!d.hidden) { d.dispatchEvent(new PointerEvent('pointerdown')); d.click(); } })()" },
			{ warteAuf: 'z.kb.modus == "menue" && z.ov == 0', max: 3000 },
			// Weitere Befehle hinter ⋯
			{ knopf: 'Weitere Befehle' },
			{ warteAuf: "!!document.querySelector('#kampfbedien [data-befehl=\"12\"]')", seite: true, max: 2000 },
			{ knopf: 'Werte prüfen' },
			{ warteAuf: 'z.ov == 1', max: 3000 },
			{ weiter: true },
			{ warteAuf: 'z.kb && z.kb.modus == "menue" && z.ov == 0', max: 3000 },
			// Gegenstand der linken Hand: Auswahlliste im Bedienfeld statt im Overlay, abbrechen
			{ knopf: 'Weitere Befehle' },
			{ knopf: 'Gegenstand der linken Hand wechseln' },
			{ warteAuf: 'z.kb.modus == "liste" && z.ov == 0', max: 3000 },
			{ erwarte: "document.querySelectorAll('#kampfbedien .kb-eintrag').length > 0", seite: true, text: 'Gegenstände als Liste' },
			{ bild: 'kampf-liste' },
			{ knopf: 'Abbrechen' },
			{ warteAuf: 'z.kb.modus == "menue"', max: 3000 },
			// Computerkampf: Rückfrage als Overlay, dann Kampfverlauf mit Tempo
			{ knopf: 'Weitere Befehle' },
			{ knopf: 'Computerkampf' },
			{ warteAuf: 'z.ov == 1 && z.ovN == 2', max: 3000 },
			{ wahl: 2 },
			{ warteAuf: "kampf.zustand()?.modus == 'verlauf' && document.querySelectorAll('#kampfbedien .kb-wahl3 button').length == 3", seite: true, max: 10000 },
			{ warteAuf: "document.querySelectorAll('#kampfbedien .kb-verlauf-zeile').length > 0", seite: true, max: 20000 },
			{ bild: 'kampf-verlauf' },
			// eigene Aktionen im Verlauf hervorgehoben
			{ warteAuf: "document.querySelectorAll('#kampfbedien .kb-verlauf-zeile.eigen').length > 0", seite: true, max: 60000 },
			{ erwarte: "[...document.querySelectorAll('#kampfbedien .kb-verlauf-zeile.eigen > span:first-child')].every((t) => /^[A-ZÄÖÜ]{3,}\\b/.test(t.textContent))", seite: true, text: 'Kampflog: Heldennamen groß' },
			{ bild: 'kampf-verlauf-eigen' },
			{ warteAuf: 'z.kampf == 0', max: 300000 },
			{ warteAuf: "!document.getElementById('mobil').classList.contains('kampf')", seite: true, max: 5000 },
		],
	},
	{
		// Menü (menue.js) statt Einstellungen in der Leiste: Speichern und Laden im Tempel (wie die Icons) und in
		// der Stadt (wie die Spieloptionen, mit AP-Rückfrage), Tagebuch, Hyggeliks Karte, Einstellungen mit Ton
		// und Kampftempo, zurück zum Startmenü
		name: 'Menü: Speichern, Laden, Tagebuch, Einstellungen',
		aktionsknoepfe: true,
		schritte: [
			...spielBereit,
			{ knopf: 'Held aufnehmen' },
			{ warteAuf: 'z.dialog == 1 && z.ov == 1', max: 3000 },
			{ wahl: 1 }, { warteAuf: 'z.helden == 1 && z.ov == 1', max: 3000 },
			{ abbrechen: true }, { warteAuf: 'z.dialog == 0 && z.haupt == 1 && z.ov == 0', max: 3000 },
			// Tempel: sechs Knöpfe, Menü mit Speichern
			{ erwarte: "document.querySelectorAll('#aktionsknoepfe button').length == 6 && !document.getElementById('aktionsknoepfe').classList.contains('vier')", seite: true, text: 'Tempel: zwei Reihen zu drei' },
			{ knopf: 'Menü' },
			{ warteAuf: "!document.getElementById('menue').hidden && !document.querySelector('[data-menue=speichern]').disabled", seite: true, max: 2000 },
			{ bild: 'menue-tempel' },
			{ knopf: 'Spiel speichern' },
			{ warteAuf: 'z.ov == 1 && z.ovN == 6', max: 3000 },   // fünf Plätze + Abbrechen
			{ wahl: 1 },
			{ warteAuf: 'z.ov == 1 && z.ovN == 0', max: 3000 },   // Name
			{ tippen: 'MENUE' },
			{ warteAuf: 'z.ov == 0 && z.dialog == 0 && z.haupt == 1', max: 5000 },
			{ warteAuf: "FS.readdir('/spielstand').includes('MENUE___.GAM')", seite: true, max: 5000 },
			// Stadt: Speichern wie in den Spieloptionen (ohne AP-Verlust: Feature-Mod 4); Abbrechen lässt alles, wie es ist
			...ohneZufall,
			{ knopf: 'Verlassen' },
			{ warteAuf: `z.ort == 0 && z.stadt == ${THORWAL} && z.haupt == 1`, max: 5000 },
			{ warteAuf: "document.querySelectorAll('#aktionsknoepfe button').length <= 6", seite: true, max: 2000 },
			{ knopf: 'Menü' },
			{ warteAuf: "!document.getElementById('menue').hidden && !document.querySelector('[data-menue=speichern]').disabled", seite: true, max: 2000 },
			{ knopf: 'Spiel speichern' },
			{ warteAuf: 'z.ov == 1 && z.ovN == 6', max: 3000 },
			{ bild: 'menue-speichern-stadt' },
			{ abbrechen: true },
			{ warteAuf: 'z.ov == 0 && z.haupt == 1', max: 5000 },
			// Tagebuch (Vollbild), zurück mit OK
			{ knopf: 'Menü' }, { knopf: 'Tagebuch' },
			{ warteAuf: 'z.haupt == 0 && z.vollbild == 1', max: 5000 },
			{ bild: 'menue-tagebuch' },
			{ knopf: 'OK' },
			{ warteAuf: 'z.haupt == 1 && z.vollbild == 0 && z.ov == 0', max: 5000 },
			// Hyggeliks Karte: noch keine Teile → Meldung des Spiels
			{ knopf: 'Menü' }, { knopf: 'Hyggeliks Karte' },
			{ warteAuf: 'z.ov == 1', max: 3000 },
			{ weiter: true },
			{ warteAuf: 'z.ov == 0 && z.haupt == 1', max: 3000 },
			// Laden in der Stadt: zurück in den Tempel
			{ knopf: 'Menü' }, { knopf: 'Spiel laden' },
			{ warteAuf: 'z.ov == 1 && z.ovN == 6', max: 3000 },
			{ wahl: 'MENUE' },
			{ warteAuf: `z.ort == ${ORT_TEMPEL} && z.haupt == 1 && z.ov == 0`, max: 8000 },
			// Einstellungen aus dem Menü: Ton, Kampftempo, zurück zum Menü
			{ knopf: 'Menü' }, { knopf: 'Einstellungen' },
			{ warteAuf: "!document.getElementById('einstellungen').hidden", seite: true, max: 2000 },
			{ bild: 'einstellungen-ton' },
			{ knopf: 'Musik aus' },
			{ js: "(() => { const r = document.querySelector('[data-ton=effekte] input'); r.value = 40; r.dispatchEvent(new Event('input')); })()" },
			{ knopf: 'Kampftempo schnell' },
			{ erwarte: "localStorage.getItem('ton_musik') == 'aus' && localStorage.getItem('ton_effekte_vol') == '40' && localStorage.getItem('kampftempo') == '2' && JSON.parse(Module.UTF8ToString(Module._web_menue_status())).kampftempo == 2", seite: true, text: 'Ton und Kampftempo gemerkt' },
			{ knopf: 'Zurück zum Menü' },
			{ warteAuf: "!document.getElementById('menue').hidden && document.getElementById('einstellungen').hidden", seite: true, max: 2000 },
			// zurück zum Startmenü
			{ knopf: 'Zurück zum Startmenü' },
			{ warteAuf: 'z.start == 1', max: 20000 },
			{ erwarte: "localStorage.getItem('ton_musik') == 'aus'", seite: true, text: 'Einstellungen bleiben' },
			// Einstellungen aus dem Startmenü: mit Spielständen, ohne „‹ Menü“
			{ tippBei: "(() => { const r = document.querySelector('#start .einstellungen').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()" },
			{ warteAuf: "!document.getElementById('einstellungen').hidden && !!document.getElementById('spielstaende-knopf').offsetParent && !document.querySelector('#einstellungen .zurueck').offsetParent", seite: true, max: 2000 },
			{ knopf: 'Musik an' }, { knopf: 'Kampftempo normal' },
			{ knopf: 'Schließen' },
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
		// Build ohne Spieldaten (…-frei, daten.js): GOG-Installer im Browser einlesen (innoextract als
		// WebAssembly). Der englische Installer wird abgelehnt; nach dem Neuladen startet das Spiel direkt.
		name: 'Spieldaten: Installer einlesen',
		wurzel: 'frei',
		schritte: [
			{ warteAuf: "document.querySelector('#spieldaten .waehlen')", seite: true, max: 15000 },
			{ bild: 'import' },
			{ dateiWahl: '/app/spieldaten/installer.exe' },
			{ warteAuf: "/deutsche/.test(document.querySelector('#spieldaten .fehler').textContent)", seite: true, max: 120000 },
			{ bild: 'englisch' },
			{ dateiWahl: '/app/spieldaten/installer-de.exe' },
			{ warteAuf: "!document.getElementById('spieldaten')", seite: true, max: 180000 },
			...spielBereit,
			// alles da, mit Musik (Chromium spielt OGG)
			{ js: "spieldaten.groesse().then((b) => { window.datenGroesse = b; })", seite: true },
			{ warteAuf: 'window.datenGroesse > 80e6', seite: true, max: 5000 },
			{ js: "spieldaten.musik(2).then((b) => { window.track2 = b && b.size; })", seite: true },
			{ warteAuf: 'window.track2 > 1e6', seite: true, max: 5000 },
			{ neuLaden: true },
			...spielBereit,
			{ warteAuf: "!document.getElementById('spieldaten')", seite: true, max: 500 },   // nach dem Neuladen ohne Import
		],
	},
	{
		// ZIP mit dem Spielordner (pruefen.sh packt build/spieldaten-test.zip, Dateien in einem
		// Unterordner, gemischte Schreibung); danach Heldenerschaffung (DSAGEN.DAT im iframe aus dem Browser)
		name: 'Spieldaten: ZIP einlesen',
		wurzel: 'frei',
		schritte: [
			{ warteAuf: "document.querySelector('#spieldaten .waehlen')", seite: true, max: 15000 },
			// aufklappbare Liste der benötigten Dateien (für die Wahl einzelner Dateien)
			{ js: "document.querySelector('#spieldaten .dateiliste summary').click()" },
			{ warteAuf: "document.querySelector('#spieldaten .dateiliste').open && /SCHICKM\\.EXE/.test(document.querySelector('#spieldaten .dateiliste').textContent)", seite: true, max: 1000 },
			{ bild: 'dateiliste' },
			{ dateiWahl: '/app/build/spieldaten-test.zip' },
			{ warteAuf: "!document.getElementById('spieldaten')", seite: true, max: 60000 },
			...startMenue(2),
			{ knopf: 'Generierung' },
			{ warteAuf: 'z.gen == 1 && z.gOv == 0 && z.gKnoepfe == 9', max: 15000 },
			{ bild: 'heldenerschaffung' },
		],
	},
	{
		// Spieldaten aus einer älteren Version (ohne INTRO_E.OVL): beim Start erscheint der Dialog wieder,
		// mit den fehlenden Dateien; nach erneutem Einlesen startet das Spiel
		name: 'Spieldaten: unvollständig, noch einmal einlesen',
		wurzel: 'frei',
		schritte: [
			{ warteAuf: "document.querySelector('#spieldaten .waehlen')", seite: true, max: 15000 },
			{ dateiWahl: '/app/build/spieldaten-test.zip' },
			{ warteAuf: "!document.getElementById('spieldaten')", seite: true, max: 60000 },
			...startMenue(2),
			{ js: "new Promise((ok) => { const r = indexedDB.open('mobile-eyes-spieldaten', 1); r.onsuccess = () => { const tx = r.result.transaction('dateien', 'readwrite'); tx.objectStore('dateien').delete('INTRO_E.OVL'); tx.oncomplete = () => { r.result.close(); ok(); }; }; })" },
			{ js: "setTimeout(() => location.reload(), 0)" },
			{ warte: 1500 },
			{ warteAuf: "!document.querySelector('#spieldaten .nachtrag')?.hidden && /INTRO_E\\.OVL/.test(document.querySelector('#spieldaten .fehlt').textContent)", seite: true, max: 15000 },
			{ bild: 'nachtrag' },
			{ dateiWahl: '/app/build/spieldaten-test.zip' },
			{ warteAuf: "!document.getElementById('spieldaten')", seite: true, max: 60000 },
			...startMenue(2),
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
			{ knopf: 'Menü' },
			{ knopf: 'Spielstände sichern und einlesen' },
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
