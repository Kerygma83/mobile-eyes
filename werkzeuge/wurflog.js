// Würfelprotokoll: Proben, Zauber und Kampfwürfe des Spiels zum Nachlesen.
//
// Das Spiel (BrightEyes wurflog.cpp) meldet jeden Eintrag per Module.wurfLog({ art, erfolg, titel,
// ergebnis, details }); die Texte sind Bytes in UTF-8, Spieltexte (Namen) stehen zwischen 0x01 und
// 0x02 im DOS-Zeichensatz und laufen durch die Schreibung des Overlays.
//   art:    1 Probe, 2 Zauber, 3 Kampf, 4 Kampfrunde (Trenner), 5 Sonstiges (AP, Krankheit)
//   erfolg: -2 Patzer, -1 schlecht, 0 neutral, 1 gut, 2 glücklich – aus Sicht der Helden
//   details: Zeilen mit \n, Einrückung (verschachtelte Probe) mit \t
//
// Aufruf: const log = wurfLogEinrichten(Module, { spielText: overlay.spielText });
//         log.eintraege (Liste, höchstens MAX), log.oeffnen(), log.schliessen()
//         optionen.knopf: bekommt die Klasse „neu“, wenn bei geschlossenem Protokoll ein Eintrag
//         dazukommt; Öffnen nimmt sie wieder weg (nur ein Merker, nicht je Eintrag)
// Nur im Speicher: nach dem Neuladen ist das Protokoll leer.
'use strict';

function wurfLogEinrichten(Module, optionen = {}) {
	const MAX = 500;
	const stil = document.createElement('style');
	stil.textContent = `
	#wurflog {
		position: fixed; inset: 0; z-index: 11;
		display: flex; flex-direction: column; justify-content: flex-end;
		background: rgb(0 0 0 / 0.55);
		padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
	}
	#wurflog[hidden] { display: none; }
	#wurflog .karte {
		display: flex; flex-direction: column; gap: 0.6rem;
		height: 80dvh; margin: 0 0.5rem 0.5rem; padding: 1rem 0.9rem 0.8rem;
		background: var(--panel); border: 1px solid var(--rand); border-radius: 0.9rem;
	}
	#wurflog h2 { margin: 0; font: bold 1.2rem Georgia, serif; color: var(--gold); }
	#wurflog .liste {
		flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
		display: flex; flex-direction: column; gap: 0.25rem;
		-webkit-user-select: text; user-select: text;
		font-size: calc(0.95rem * var(--schrift, 1));
	}
	#wurflog .leer { color: var(--leise); font-style: italic; margin: auto; text-align: center; padding: 1rem; }
	#wurflog .eintrag { padding: 0.35rem 0.55rem; background: var(--bg); border: 1px solid var(--rand); border-radius: 0.5rem; border-left-width: 4px; }
	#wurflog details.eintrag > summary { list-style: none; cursor: pointer; position: relative; padding-right: 1.4rem; }
	#wurflog details.eintrag > summary::-webkit-details-marker { display: none; }
	#wurflog details.eintrag > summary::after { content: '▸'; color: var(--leise); position: absolute; right: 0.1rem; top: 50%; transform: translateY(-50%); }
	#wurflog details.eintrag[open] > summary::after { content: '▾'; }
	#wurflog .titel { font-weight: 600; }
	#wurflog .ergebnis { display: block; color: var(--leise); }
	#wurflog .details { margin: 0.35rem 0 0.1rem; padding: 0.3rem 0 0 0.6rem; border-top: 1px dashed var(--rand);
		font: 0.85em/1.45 ui-monospace, Menlo, Consolas, monospace; color: var(--text); }
	#wurflog .details div { white-space: pre-wrap; }
	#wurflog .e2 { border-left-color: #6fcf6f; } #wurflog .e2 .ergebnis { color: #8fe08f; font-weight: 600; }
	#wurflog .e1 { border-left-color: #4f9a4f; } #wurflog .e1 .ergebnis { color: #9fcf8f; }
	#wurflog .e-1 { border-left-color: #a8553f; } #wurflog .e-1 .ergebnis { color: #e0906a; }
	#wurflog .e-2 { border-left-color: #e0503a; } #wurflog .e-2 .ergebnis { color: #ff7a5c; font-weight: 600; }
	#wurflog .runde { margin: 0.5rem 0 0.1rem; color: var(--gold); font: 600 0.8rem system-ui, sans-serif;
		letter-spacing: 0.06em; text-transform: uppercase; display: flex; align-items: center; gap: 0.5rem; }
	#wurflog .runde::before, #wurflog .runde::after { content: ''; flex: 1; border-top: 1px solid var(--rand); }
	#wurflog .art { color: var(--leise); font-size: 0.8em; margin-right: 0.3rem; }
	#wurflog .fuss { display: flex; justify-content: space-between; gap: 0.5rem; }
	#wurflog .fuss button { min-height: 2.6rem; padding: 0 0.9rem; font-size: 0.95rem; touch-action: manipulation; }
	#wurflog .filter { display: flex; gap: 0.3rem; flex-wrap: wrap; }
	#wurflog .filter button { min-height: 2.1rem; padding: 0 0.7rem; font-size: 0.85rem; touch-action: manipulation; }
	#wurflog .filter button[aria-pressed="true"] { background: var(--knopf-aktiv); border-color: var(--gold); }
`;
	document.head.append(stil);

	const huelle = document.createElement('div');
	huelle.innerHTML = `
<div id="wurflog" hidden role="dialog" aria-modal="true" aria-label="Würfelprotokoll">
	<div class="karte">
		<h2>Würfelprotokoll</h2>
		<div class="filter" aria-label="Anzeigen">
			<button type="button" data-filter="alle" aria-pressed="true">Alles</button>
			<button type="button" data-filter="kampf" aria-pressed="false">Kampf</button>
			<button type="button" data-filter="proben" aria-pressed="false">Proben &amp; Zauber</button>
		</div>
		<div class="liste" aria-live="polite"></div>
		<div class="fuss">
			<button type="button" class="leeren">Leeren</button>
			<button type="button" class="schliessen">Schließen</button>
		</div>
	</div>
</div>`;
	document.body.append(huelle.firstElementChild);
	const el = document.getElementById('wurflog');
	const liste = el.querySelector('.liste');

	const utf8 = new TextDecoder();
	const spielText = optionen.spielText ?? ((b) => String.fromCharCode(...b));
	const spielRoh = optionen.spielRoh ?? ((b) => String.fromCharCode(...b));
	/** Bytes → Text: UTF-8, Abschnitte zwischen 0x01 und 0x02 als Spieltext (roh: ohne Schreibung,
	 *  also groß wie im Spiel) */
	function text(bytes, roh = false) {
		let t = '', teil = [], spiel = false;
		const fertig = () => {
			if (teil.length) t += spiel ? (roh ? spielRoh : spielText)(teil) : utf8.decode(new Uint8Array(teil));
			teil = [];
		};
		for (const b of bytes) {
			if (b === 1 || b === 2) { fertig(); spiel = b === 1; } else teil.push(b);
		}
		fertig();
		return t;
	}

	const eintraege = [];   // { art, erfolg, roh: { titel, ergebnis, details } }
	let filter = 'alle';
	const passt = (e) => filter === 'alle' || (filter === 'kampf' ? (e.art === 3 || e.art === 4) : (e.art === 1 || e.art === 2));

	function knoten(e) {
		const titel = text(e.roh.titel), ergebnis = text(e.roh.ergebnis), details = text(e.roh.details);
		if (e.art === 4) {
			const d = document.createElement('div');
			d.className = 'runde';
			d.textContent = titel;
			return d;
		}
		const mitDetails = details.length > 0;
		const k = document.createElement(mitDetails ? 'details' : 'div');
		k.className = 'eintrag e' + e.erfolg;
		const kopf = document.createElement(mitDetails ? 'summary' : 'div');
		const t = document.createElement('span');
		t.className = 'titel';
		t.textContent = titel;
		kopf.append(t);
		if (ergebnis) {
			const r = document.createElement('span');
			r.className = 'ergebnis';
			r.textContent = ergebnis;
			kopf.append(r);
		}
		k.append(kopf);
		if (mitDetails) {
			const d = document.createElement('div');
			d.className = 'details';
			for (const zeile of details.split('\n')) {
				const z = document.createElement('div');
				const tiefe = zeile.match(/^\t*/)[0].length;
				z.style.paddingLeft = tiefe + 'em';
				z.textContent = zeile.slice(tiefe);
				d.append(z);
			}
			k.append(d);
		}
		return k;
	}

	function leerHinweis() {
		if (liste.querySelector('.eintrag, .runde')) { liste.querySelector('.leer')?.remove(); return; }
		if (liste.querySelector('.leer')) return;
		const p = document.createElement('p');
		p.className = 'leer';
		p.textContent = 'Noch keine Würfe. Proben, Zauber und Kampfwürfe erscheinen hier.';
		liste.append(p);
	}
	function alleZeigen() {
		liste.replaceChildren(...eintraege.filter(passt).map(knoten));
		leerHinweis();
		liste.scrollTop = liste.scrollHeight;
	}

	Module.wurfLog = (roh) => {
		const e = { art: roh.art, erfolg: roh.erfolg, roh };
		eintraege.push(e);
		if (eintraege.length > MAX) eintraege.splice(0, eintraege.length - MAX);
		if (el.hidden) optionen.knopf?.classList.add('neu');
		if (el.hidden || !passt(e)) return;
		const unten = liste.scrollHeight - liste.scrollTop - liste.clientHeight < 40;
		liste.append(knoten(e));
		while (liste.childElementCount > MAX) liste.firstElementChild.remove();
		leerHinweis();
		if (unten) liste.scrollTop = liste.scrollHeight;
	};

	function oeffnen() {
		optionen.beimOeffnen?.();
		optionen.knopf?.classList.remove('neu');
		el.hidden = false;
		alleZeigen();
	}
	function schliessen() { el.hidden = true; liste.replaceChildren(); }
	el.querySelector('.schliessen').addEventListener('click', schliessen);
	el.addEventListener('click', (e) => { if (e.target === el) schliessen(); });
	el.querySelector('.leeren').addEventListener('click', () => { eintraege.length = 0; alleZeigen(); });
	el.querySelector('.filter').addEventListener('click', (e) => {
		const b = e.target.closest('button');
		if (!b) return;
		filter = b.dataset.filter;
		for (const x of el.querySelectorAll('.filter button')) x.setAttribute('aria-pressed', String(x === b));
		alleZeigen();
	});
	// Text für Tests und Fehlersuche
	// roh: Namen (Spieltexte) groß wie im Spiel, z. B. für das Kampflog
	const alsText = (roh = false) => eintraege.map((e) => [text(e.roh.titel, roh), text(e.roh.ergebnis, roh), text(e.roh.details, roh)]);

	return { eintraege, oeffnen, schliessen, alsText };
}
