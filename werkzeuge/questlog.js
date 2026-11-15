// Questlog: Haupt- und Nebenquests aus den Flags des Spielstands.
//
// Das Spiel (BrightEyes questlog.cpp) liefert über Module._web_questlog() ein JSON mit den Flags
// (siehe dort); Namen und Orte der Informanten kommen als Hex-Bytes im DOS-Zeichensatz und laufen
// durch die Schreibung des Overlays. Das Spiel wird nicht verändert: Der Questlog zeigt nur, was
// der Spielstand hergibt, und stimmt damit auch gleich nach dem Laden.
//
// Was angezeigt wird, steht in QUESTS (Bedingungen über den Zustand w) und in TEXTE. Die Texte
// sind vorläufig und knapp gehalten (keine Lösungen verraten: ein Schritt erscheint erst, wenn
// die Helden davon wissen). Eigene Texte, nicht aus den Spieldaten.
//
// Aufruf: const log = questLogEinrichten(Module, { spielText: overlay.spielText, knopf });
//         log.starten() (nach onRuntimeInitialized), log.oeffnen(), log.schliessen(),
//         log.zustand() (letzter Stand), log.alsText() (für Tests)
//         optionen.knopf bekommt die Klasse „neu“, wenn ein Eintrag dazukommt oder sich ändert.
'use strict';

// ---------- Texte (später ergänzen) ----------
const QUEST_TEXTE = {
	haupt: 'Die Schicksalsklinge',
	monate: (n) => n === 1 ? 'Seit einem Monat auf der Suche' : `Seit ${n} Monaten auf der Suche`,
	ausruf: 'Ein Herold verkündet in Thorwal: Der Hetmann sucht wagemutige Helden.',
	nichtAngenommen: 'Beim Hetmann gewesen, den Auftrag aber nicht angenommen.',
	auftrag: 'Auftrag des Hetmanns: Hyggeliks Schwert Grimring finden. Ein erster Hinweis führt nach Felsteyn.',
	briefNoetig: 'Man verlangt ein Empfehlungsschreiben des Hetmanns.',
	briefHet: 'Empfehlungsschreiben des Hetmanns erhalten.',
	briefJad: 'Schreiben von Jadra erhalten.',
	karten: (n) => `Kartenstücke von Hyggeliks Karte: ${n} von 9`,
	hyggelik: 'Die Karte ist vollständig genug: Hyggeliks Ruine lässt sich finden.',
	ruine: 'Der Weg zu Hyggeliks Ruine ist bekannt.',
	grimring: 'Grimring gefunden. Nun gilt es, die Orks aufzuhalten.',
	orkdokument: 'Ein Orkdokument entziffert.',

	informanten: 'Informanten',
	gehoert: 'gehört',
	besucht: 'besucht',
	karteErhalten: 'Kartenstück erhalten',
	// Informanten ohne festen Wohnort (Reihenfolge wie INFORMER_ID in common.h)
	unterwegs: { 9: 'unterwegs', 10: 'auf See', 11: 'unterwegs', 12: 'in der Wildnis' },
	notiz: {
		jurgeBrief: 'Will ein Schreiben des Hetmanns sehen.',
		tiomarBrief: 'Will eine Empfehlung sehen.',
		einhornKarte: 'Will ein fehlendes Kartenstück besorgen.',
		algridTreborn: 'Verweist auf Treborn.',
	},

	neben: 'Nebenquests',
	ugdalf: 'Ugdalf',
	ugdalfAuftrag: 'Meister Dramosch bittet, Ugdalf in den Gewölben unter der Zwingfeste zu suchen.',
	ugdalfGefunden: 'Ugdalf gefunden. Dramosch erwartet Nachricht.',
	ugdalfFertig: 'Dramosch hat die Helden belohnt.',
	totenschiff: 'Das Totenschiff',
	totenschiffGehoert: 'In der Taverne „Vier Winde“ von einem Geisterschiff gehört.',
	ardora: 'Ardora befreit.',
	totenschiffFertig: 'Das Totenschiff ist besiegt.',
	gorah: 'Der Druide Gorah',
	gorahAuftrag: 'Umbrik spricht von einem finsteren Druiden namens Gorah.',
	gorahBesiegt: 'Gorah ist besiegt.',
	namenlos: 'Der Tempel des Namenlosen',
	namenlosAuftrag: 'Eliane erzählt von einem Tempel des Namenlosen.',
	namenlosFertig: 'Den Tempel ausgeräuchert.',
	namenlosZerstoert: 'Das Götzenbild ist zerstört.',
	drache: 'Der Drache',
	dracheBegegnet: 'Einem Drachen begegnet.',
	dracheFertig: 'Der Drache hat die Helden belohnt.',
	daspota: 'Der Daspota-Schatz',
	daspotaGehoert: 'Vom Versteck des Daspota-Schatzes erfahren.',
	daspotaGefunden: 'Den Daspota-Schatz gefunden.',

	orte: 'Bekannte Orte',
	ortHinweis: 'An Reisestrecken, von denen die Helden gehört oder die sie selbst entdeckt haben.',
	// Dungeons (DUNGEON_ID in common.h): Name, Lage
	dungeon: {
		3: ['Spinnenhöhle', 'zwischen Ottarje und Skjal'],
		4: ['Wolfshöhle', 'zwischen Ottarje und Orvil'],
		5: ['Goblinhöhle', 'zwischen Felsteyn und Orkanger'],
		6: ['Versteck des Daspota-Schatzes', 'zwischen Rybon und Thoss'],
		7: ['Ruine des Schwarzmagiers', 'zwischen Rybon und Thoss'],
		8: ['Orkbehausung', 'zwischen Phexcaer und Skelellen'],
		10: ['Drachenhort', 'auf der Insel Runin'],
		11: ['Piratenhöhle', 'auf der Insel Manrek'],
	},

	leer: 'Noch keine Hinweise. Hört euch in den Tavernen um.',
	keinSpiel: 'Kein Spiel geladen.',
};

// Informant → Index seines Kartenstücks in w.karten (Hjore: Index 9, eine falsche Abschrift)
const INFORMANT_KARTE = { 0: 0, 1: 9, 4: 2, 5: 3, 6: 4, 8: 5, 10: 6, 11: 7, 14: 8 };

const kartenAnzahl = (w) => w.karten.slice(0, 9).filter((k) => k).length;

// ---------- Quests: Schritte erscheinen, wenn „wann“ gilt; „fertig“ hakt sie ab ----------
// Jeder Schritt hat eine feste id (für den Merker „neu“).
const T = QUEST_TEXTE;
const QUESTS = [
	{
		id: 'haupt', haupt: true, titel: T.haupt,
		wann: (w) => w.ausruf > 0 || w.auftrag,
		fertig: (w) => false,
		unter: (w) => w.auftrag && w.monate > 0 ? T.monate(w.monate) : '',
		schritte: [
			{ id: 'ausruf', wann: (w) => w.ausruf > 0, fertig: (w) => w.ausruf >= 3, text: T.ausruf },
			{ id: 'abgelehnt', wann: (w) => w.ausruf >= 3 && !w.auftrag, fertig: () => false, text: T.nichtAngenommen },
			{ id: 'auftrag', wann: (w) => w.auftrag, fertig: (w) => w.grimring, text: T.auftrag },
			{ id: 'brief', wann: (w) => !w.brief_het && (w.brief_noetig || w.jurge_brief), fertig: () => false, text: T.briefNoetig },
			{ id: 'brief_het', wann: (w) => w.brief_het, fertig: () => true, text: T.briefHet },
			{ id: 'brief_jad', wann: (w) => w.brief_jad, fertig: () => true, text: T.briefJad },
			{ id: 'karten', wann: (w) => kartenAnzahl(w) > 0, fertig: (w) => w.hyggelik, text: (w) => T.karten(kartenAnzahl(w)),
				schluessel: (w) => kartenAnzahl(w) },
			{ id: 'hyggelik', wann: (w) => w.hyggelik, fertig: (w) => w.ruine || w.grimring, text: T.hyggelik },
			{ id: 'ruine', wann: (w) => w.ruine, fertig: (w) => w.grimring, text: T.ruine },
			{ id: 'orkdokument', wann: (w) => w.orkdokument, fertig: () => true, text: T.orkdokument },
			{ id: 'grimring', wann: (w) => w.grimring, fertig: () => false, text: T.grimring },
		],
	},
	{
		id: 'ugdalf', titel: T.ugdalf, wann: (w) => w.ugdalf > 0, fertig: (w) => w.ugdalf === 4,
		schritte: [
			{ id: 'auftrag', wann: () => true, fertig: (w) => w.ugdalf_gefunden || w.ugdalf >= 3, text: T.ugdalfAuftrag },
			{ id: 'gefunden', wann: (w) => w.ugdalf >= 3, fertig: (w) => w.ugdalf === 4, text: T.ugdalfGefunden },
			{ id: 'fertig', wann: (w) => w.ugdalf === 4, fertig: () => true, text: T.ugdalfFertig },
		],
	},
	{
		id: 'totenschiff', titel: T.totenschiff, wann: (w) => w.totenschiff || w.ardora || w.totenschiff_ende,
		fertig: (w) => w.totenschiff_fertig,
		schritte: [
			{ id: 'gehoert', wann: (w) => w.totenschiff, fertig: (w) => w.totenschiff_fertig, text: T.totenschiffGehoert },
			{ id: 'ardora', wann: (w) => w.ardora, fertig: () => true, text: T.ardora },
			{ id: 'fertig', wann: (w) => w.totenschiff_fertig, fertig: () => true, text: T.totenschiffFertig },
		],
	},
	{
		id: 'gorah', titel: T.gorah, wann: (w) => w.umbrik_gorah || w.gorah,
		fertig: (w) => w.gorah && w.informanten[3]?.s === 2,
		schritte: [
			{ id: 'auftrag', wann: (w) => w.umbrik_gorah, fertig: (w) => w.gorah, text: T.gorahAuftrag },
			{ id: 'besiegt', wann: (w) => w.gorah, fertig: () => true, text: T.gorahBesiegt },
		],
	},
	{
		id: 'namenlos', titel: T.namenlos, wann: (w) => w.eliane_namenlos || w.namenlos_fertig,
		fertig: (w) => w.namenlos_fertig && w.informanten[8]?.s === 2,
		schritte: [
			{ id: 'auftrag', wann: (w) => w.eliane_namenlos, fertig: (w) => w.namenlos_fertig, text: T.namenlosAuftrag },
			{ id: 'fertig', wann: (w) => w.namenlos_fertig, fertig: () => true, text: T.namenlosFertig },
			{ id: 'zerstoert', wann: (w) => w.namenlos_zerstoert, fertig: () => true, text: T.namenlosZerstoert },
		],
	},
	{
		id: 'drache', titel: T.drache, wann: (w) => w.drache > 0, fertig: (w) => w.drache === 2,
		schritte: [
			{ id: 'begegnet', wann: () => true, fertig: (w) => w.drache === 2, text: T.dracheBegegnet },
			{ id: 'fertig', wann: (w) => w.drache === 2, fertig: () => true, text: T.dracheFertig },
		],
	},
	{
		id: 'daspota', titel: T.daspota, wann: (w) => ortBekannt(w, 6) || w.daspota_schatz, fertig: (w) => w.daspota_schatz,
		schritte: [
			{ id: 'gehoert', wann: (w) => ortBekannt(w, 6), fertig: (w) => w.daspota_schatz, text: T.daspotaGehoert },
			{ id: 'gefunden', wann: (w) => w.daspota_schatz, fertig: () => true, text: T.daspotaGefunden },
		],
	},
];

function ortBekannt(w, dungeon) { return w.orte.some(([d, f]) => d === dungeon && f); }

/** Zustand → Abschnitte zum Anzeigen: { quests: [...], informanten: [...], orte: [...] } */
function questLogInhalt(w, name) {
	const text = (t) => typeof t === 'function' ? t(w) : t;
	const quests = QUESTS.filter((q) => q.wann(w)).map((q) => ({
		id: q.id, haupt: !!q.haupt, titel: q.titel, unter: q.unter?.(w) || '', fertig: !!q.fertig(w),
		schritte: q.schritte.filter((s) => s.wann(w)).map((s) => ({
			id: `${q.id}.${s.id}`, text: text(s.text), fertig: !!s.fertig(w), schluessel: s.schluessel?.(w) ?? '',
		})),
	}));
	const informanten = w.informanten.map((inf, i) => {
		if (!inf.s) return null;
		const notizen = [];
		const k = INFORMANT_KARTE[i];
		if (k !== undefined && w.karten[k] === 1) notizen.push(T.karteErhalten);
		if (i === 0 && w.jurge_brief && !w.brief_het && inf.s !== 2) notizen.push(T.notiz.jurgeBrief);
		if (i === 14 && w.tiomar_brief && inf.s !== 2) notizen.push(T.notiz.tiomarBrief);
		if (i === 12 && w.einhorn_karte) notizen.push(T.notiz.einhornKarte);
		if (i === 13 && w.algrid_treborn) notizen.push(T.notiz.algridTreborn);
		return { id: `inf.${i}`, nr: i, name: name(inf.n), ort: inf.o ? name(inf.o) : (T.unterwegs[i] ?? ''),
			besucht: inf.s === 2, notizen };
	}).filter(Boolean);
	const orte = w.orte.filter(([, f]) => f).map(([d]) => ({ id: `ort.${d}`, name: T.dungeon[d]?.[0] ?? `Dungeon ${d}`,
		lage: T.dungeon[d]?.[1] ?? '' }));
	return { quests, informanten, orte };
}

/** Merker für „neu“: alles, was sichtbar ist, mit seinem Stand */
function questLogSchluessel(inhalt) {
	const s = new Set();
	for (const q of inhalt.quests) {
		s.add(`${q.id}:${q.fertig}`);
		for (const x of q.schritte) s.add(`${x.id}:${x.fertig}:${x.schluessel}`);
	}
	for (const i of inhalt.informanten) s.add(`${i.id}:${i.besucht}:${i.notizen.length}`);
	for (const o of inhalt.orte) s.add(o.id);
	return s;
}

function questLogEinrichten(Module, optionen = {}) {
	const stil = document.createElement('style');
	stil.textContent = `
	#questlog {
		position: fixed; inset: 0; z-index: 11;
		display: flex; flex-direction: column; justify-content: flex-end;
		background: rgb(0 0 0 / 0.55);
		padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
	}
	#questlog[hidden] { display: none; }
	#questlog .karte {
		display: flex; flex-direction: column; gap: 0.6rem;
		max-height: 85dvh; margin: 0 0.5rem 0.5rem; padding: 1rem 0.9rem 0.8rem;
		background: var(--panel); border: 1px solid var(--rand); border-radius: 0.9rem;
	}
	#questlog h2 { margin: 0; font: bold 1.2rem Georgia, serif; color: var(--gold); }
	#questlog .inhalt {
		flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
		display: flex; flex-direction: column; gap: 0.9rem;
		-webkit-user-select: text; user-select: text;
		font-size: calc(0.95rem * var(--schrift, 1));
	}
	#questlog .leer { color: var(--leise); font-style: italic; margin: auto; text-align: center; padding: 1rem; }
	#questlog h3 { margin: 0 0 0.35rem; font: 600 0.8rem system-ui, sans-serif; letter-spacing: 0.06em;
		text-transform: uppercase; color: var(--leise); }
	#questlog .quest { padding: 0.5rem 0.65rem; background: var(--bg); border: 1px solid var(--rand); border-radius: 0.5rem;
		border-left: 4px solid var(--gold); }
	#questlog .quest + .quest { margin-top: 0.4rem; }
	#questlog .quest.fertig { border-left-color: var(--rand); }
	#questlog .quest.fertig .qtitel { color: var(--leise); }
	#questlog .qtitel { font: 600 1.05rem Georgia, serif; }
	#questlog .unter { color: var(--leise); font-size: 0.85em; }
	#questlog ul { list-style: none; margin: 0.35rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
	#questlog li { position: relative; padding-left: 1.3rem; line-height: 1.35; }
	#questlog li::before { content: '◇'; position: absolute; left: 0.1rem; color: var(--gold); }
	#questlog li.fertig { color: var(--leise); }
	#questlog li.fertig::before { content: '✓'; color: #8fbf7f; }
	#questlog li.neu { color: var(--gold); }
	#questlog .personen li::before { content: '?'; color: var(--gold); }
	#questlog .personen li.fertig::before { content: '✓'; }
	#questlog .personen .ort, #questlog .orte .ort { color: var(--leise); }
	#questlog .personen .notiz { display: block; color: var(--leise); font-size: 0.88em; }
	#questlog .hinweis { margin: 0 0 0.3rem; color: var(--leise); font-size: 0.85em; }
	#questlog .orte li::before { content: '⌂'; }
	#questlog .fuss { display: flex; justify-content: flex-end; }
	#questlog .fuss button { min-height: 2.6rem; padding: 0 0.9rem; font-size: 0.95rem; touch-action: manipulation; }
`;
	document.head.append(stil);

	const huelle = document.createElement('div');
	huelle.innerHTML = `
<div id="questlog" hidden role="dialog" aria-modal="true" aria-label="Questlog">
	<div class="karte">
		<h2>Questlog</h2>
		<div class="inhalt"></div>
		<div class="fuss"><button type="button" class="schliessen">Schließen</button></div>
	</div>
</div>`;
	document.body.append(huelle.firstElementChild);
	const el = document.getElementById('questlog');
	const inhaltEl = el.querySelector('.inhalt');

	const spielText = optionen.spielText ?? ((b) => String.fromCharCode(...b));
	const name = (hex) => {
		const b = [];
		for (let i = 0; i + 1 < hex.length; i += 2) b.push(parseInt(hex.slice(i, i + 2), 16));
		return spielText(b);
	};

	let stand = null;        // letzter Zustand aus dem Spiel
	let gesehen = null;      // Schlüssel beim letzten Öffnen (oder beim Laden eines Spielstands)
	let bereit = false;

	/** Zustand aus dem Spiel holen (null, solange das Spiel nicht läuft) */
	function holen() {
		if (!bereit || typeof Module._web_questlog !== 'function' || !Module.UTF8ToString) return null;
		try { return JSON.parse(Module.UTF8ToString(Module._web_questlog())); } catch { return null; }
	}

	function pruefen() {
		const w = holen();
		if (!w) return;
		const vorher = stand;
		stand = w;
		if (!w.helden) return;
		const schluessel = questLogSchluessel(questLogInhalt(w, () => ''));
		// anderer Spielstand geladen (vorher kein Spiel oder Datum zurück): nichts ist „neu“
		const tag = (x) => (x.datum[2] * 13 + x.datum[1]) * 31 + x.datum[0];
		if (!gesehen || !vorher?.helden || tag(w) < tag(vorher)) { gesehen = schluessel; return; }
		if (!el.hidden) return;
		if ([...schluessel].some((s) => !gesehen.has(s))) optionen.knopf?.classList.add('neu');
	}

	function element(tag, klasse, text) {
		const e = document.createElement(tag);
		if (klasse) e.className = klasse;
		if (text !== undefined) e.textContent = text;
		return e;
	}

	function zeigen() {
		const w = stand;
		inhaltEl.replaceChildren();
		if (!w || !w.helden) { inhaltEl.append(element('p', 'leer', T.keinSpiel)); return; }
		const inhalt = questLogInhalt(w, name);
		const neu = (id) => gesehen && ![...gesehen].some((s) => s.startsWith(id + ':') || s === id);
		if (!inhalt.quests.length && !inhalt.informanten.length && !inhalt.orte.length) {
			inhaltEl.append(element('p', 'leer', T.leer));
			return;
		}
		const abschnitt = (titel, klasse) => {
			const s = element('section', klasse);
			if (titel) s.append(element('h3', '', titel));
			inhaltEl.append(s);
			return s;
		};
		const questKarte = (q, ziel) => {
			const k = element('div', 'quest' + (q.fertig ? ' fertig' : ''));
			k.dataset.quest = q.id;
			k.append(element('div', 'qtitel', q.titel));
			if (q.unter) k.append(element('div', 'unter', q.unter));
			const ul = element('ul');
			for (const s of q.schritte) {
				const li = element('li', (s.fertig ? 'fertig' : '') + (neu(s.id) ? ' neu' : ''), s.text);
				li.dataset.schritt = s.id;
				ul.append(li);
			}
			k.append(ul);
			ziel.append(k);
		};
		const haupt = inhalt.quests.filter((q) => q.haupt);
		const neben = inhalt.quests.filter((q) => !q.haupt);
		if (haupt.length) { const s = abschnitt(''); for (const q of haupt) questKarte(q, s); }
		if (inhalt.informanten.length) {
			const s = abschnitt(T.informanten, 'personen');
			const ul = element('ul');
			// offene zuerst, dann besuchte
			for (const i of [...inhalt.informanten].sort((a, b) => a.besucht - b.besucht)) {
				const li = element('li', (i.besucht ? 'fertig' : '') + (neu(i.id) ? ' neu' : ''));
				li.dataset.informant = i.nr;
				li.append(element('span', 'name', i.name));
				if (i.ort) li.append(document.createTextNode(' '), element('span', 'ort', `(${i.ort})`));
				li.append(document.createTextNode(' – ' + (i.besucht ? T.besucht : T.gehoert)));
				for (const n of i.notizen) li.append(element('span', 'notiz', n));
				ul.append(li);
			}
			s.append(ul);
		}
		if (neben.length) { const s = abschnitt(T.neben); for (const q of neben) questKarte(q, s); }
		if (inhalt.orte.length) {
			const s = abschnitt(T.orte, 'orte');
			s.append(element('p', 'hinweis', T.ortHinweis));
			const ul = element('ul');
			for (const o of inhalt.orte) {
				const li = element('li', neu(o.id) ? 'neu' : '');
				li.append(element('span', 'name', o.name));
				if (o.lage) li.append(document.createTextNode(' '), element('span', 'ort', o.lage));
				ul.append(li);
			}
			s.append(ul);
		}
	}

	function oeffnen() {
		optionen.beimOeffnen?.();
		pruefen();
		zeigen();
		optionen.knopf?.classList.remove('neu');
		el.hidden = false;
		inhaltEl.scrollTop = 0;
	}
	function schliessen() {
		el.hidden = true;
		if (stand?.helden) gesehen = questLogSchluessel(questLogInhalt(stand, () => ''));
		inhaltEl.replaceChildren();
	}
	el.querySelector('.schliessen').addEventListener('click', schliessen);
	el.addEventListener('click', (e) => { if (e.target === el) schliessen(); });

	/** nach onRuntimeInitialized: Stand regelmäßig prüfen (für den Merker am Knopf) */
	function starten() {
		bereit = true;
		pruefen();
		setInterval(() => { if (!document.hidden) pruefen(); }, 2000);
	}

	const alsText = () => inhaltEl.innerText;
	return { starten, oeffnen, schliessen, pruefen, zustand: () => stand, alsText };
}
