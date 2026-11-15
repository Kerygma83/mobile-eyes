// Textboxen des Spiels als HTML-Overlay – gemeinsam für das Spiel (shell.html) und die
// Heldenerschaffung (gen-shell.html).
//
// Das Programm meldet jede Textbox (Spiel: seg097, ngen: gui_radio/infobox/enter_string) per
// Module.dialogAuf/dialogZu und bleibt selbst zuständig für Ablauf und Ergebnis; das Overlay
// schickt nur Tasten (Module._web_key), wählt einen Eintrag (Module._web_menu_select) oder
// bricht ab (Module._web_right_click).
//
// Aufruf: const overlay = textboxOverlay(Module, {
//             portraetQuelle: () => canvas,   // Bild, aus dem Porträts (32x32) kopiert werden
//             beimOeffnen: (d) => {},         // z. B. gehaltene Knöpfe loslassen
//             beimSchliessen: (leer) => {},   // leer = keine Box mehr offen
//             schreibungZusatz: { SIE: 'Sie' },  // eigene Wörter vor dem Wörterbuch
//         });
//         overlay.dialoge, overlay.alsText(bytes), overlay.spielText(bytes) (mit Schreibung),
//         overlay.portraetZeichnen(), overlay.neuZeichnen(),
//         overlay.schreibungBereit (Promise: Wörterbuch geladen?)
//
// Schreibung (schreibung.js): mit schreibung.json (Build ohne Daten: knappe Fassung) erscheinen die
// Texte in normaler Groß-/Kleinschreibung; localStorage 'schreibung' = 'original' schaltet ab,
// 'schriftgroesse' (Faktor, z. B. 1.15) vergrößert die Schrift.
'use strict';

function textboxOverlay(Module, optionen = {}) {
	const stil = document.createElement('style');
	stil.textContent = `
	#dialog {
		position: fixed; inset: 0; z-index: 10;
		display: flex; flex-direction: column; justify-content: flex-end;
		background: rgb(0 0 0 / 0.45);
		padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
	}
	#dialog[hidden] { display: none; }
	#dialog [hidden] { display: none !important; }
	#dialog .karte {
		display: flex; flex-direction: column; gap: 0.9rem;
		max-height: 78dvh; overflow-y: auto; overscroll-behavior: contain;
		margin: 0 0.5rem 0.5rem;
		padding: 1.1rem 1.1rem 1rem;
		background: var(--panel); color: var(--text);
		border: 1px solid var(--rand); border-radius: 0.9rem;
		box-shadow: 0 -0.3rem 1.5rem rgb(0 0 0 / 0.5);
		font: calc(1.12rem * var(--schrift, 1))/1.45 Georgia, 'Times New Roman', serif;
		letter-spacing: 0.02em;
	}
	#dialog .kopf { display: flex; align-items: center; gap: 0.8rem; }
	#dialog .kopf:empty, #dialog .name:empty { display: none; }
	#dialog .portraet { width: 4.5rem; height: auto; aspect-ratio: 32 / 38.4; border: 1px solid var(--rand); border-radius: 0.3rem; flex: none; }
	#dialog .name { color: var(--gold); font-weight: bold; }
	#dialog .text:empty { display: none; }
	#dialog .zeile { display: flex; justify-content: space-between; gap: 1rem; min-height: 1.45em; }
	#dialog .zeile > span:first-child { flex: 1; }
	#dialog .f1 { color: var(--gold); }
	#dialog .f2 { color: #e0906a; }
	#dialog .f3 { color: #92b8dc; }
	#dialog .optionen { display: flex; flex-direction: column; gap: 0.45rem; }
	#dialog.janein .optionen { flex-direction: row; }
	#dialog.janein .optionen button { flex: 1; }
	#dialog .optionen button {
		justify-content: flex-start; text-align: left;
		min-height: 3rem; padding: 0.5rem 0.9rem;
		font: inherit; letter-spacing: inherit;
		touch-action: manipulation;
	}
	#dialog .optionen button .zeile { flex: 1; }
	/* lange Menüs (z. B. Kampf mit 13 Einträgen) kompakter */
	#dialog.dicht .optionen { gap: 0.3rem; }
	#dialog.dicht .optionen button { min-height: 2.5rem; padding: 0.3rem 0.9rem; font-size: calc(1.02rem * var(--schrift, 1)); }
	#dialog .optionen button.vorwahl { border-color: var(--gold); }
	#dialog .optionen button.hervor { color: var(--gold); }
	#dialog .optionen button.frei { color: var(--leise); font-style: italic; }
	#dialog .eingabe { display: flex; gap: 0.5rem; }
	#dialog .eingabe input {
		flex: 1; min-width: 0; font: inherit; text-transform: uppercase;
		color: var(--text); background: var(--bg);
		border: 1px solid var(--rand); border-radius: 0.6rem; padding: 0.5rem 0.7rem;
	}
	/* iOS: ohne user-select lässt sich in das Feld nichts eintippen (body sperrt Auswahl) */
	#dialog .eingabe input { -webkit-user-select: text; user-select: text; }
	#dialog .schnellwahl { display: grid; grid-template-columns: repeat(auto-fit, minmax(2.9rem, 1fr)); gap: 0.4rem; }
	#dialog .schnellwahl button { min-height: 2.8rem; font: 1.05rem system-ui, sans-serif; touch-action: manipulation; }
	#dialog .fuss { display: flex; justify-content: flex-end; gap: 0.5rem; }
	#dialog .fuss button, #dialog .eingabe button { min-height: 2.8rem; padding: 0 1.1rem; font-size: 1rem; touch-action: manipulation; }
	#dialog .hinweis { color: var(--leise); font: 0.85rem system-ui, sans-serif; align-self: center; margin-right: auto; }
	#dialog.gesendet .karte { opacity: 0.6; }
`;
	document.head.append(stil);

	const huelle = document.createElement('div');
	huelle.innerHTML = `
<div id="dialog" hidden role="dialog" aria-modal="true" aria-label="Spieltext">
	<div class="karte">
		<div class="kopf"></div>
		<div class="text"></div>
		<form class="eingabe" hidden>
			<input type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="done" aria-label="Eingabe">
			<button type="submit">OK</button>
		</form>
		<div class="schnellwahl" hidden></div>
		<div class="optionen"></div>
		<div class="fuss">
			<span class="hinweis"></span>
			<button type="button" class="abbrechen">Abbrechen</button>
			<button type="button" class="weiter">Weiter</button>
		</div>
	</div>
</div>
`;
	document.body.append(huelle.firstElementChild);

		const dialogEl = document.getElementById('dialog');
		const dKopf = dialogEl.querySelector('.kopf');
		const dText = dialogEl.querySelector('.text');
		const dOptionen = dialogEl.querySelector('.optionen');
		const dEingabe = dialogEl.querySelector('.eingabe');
		const dFeld = dEingabe.querySelector('input');
		const dWeiter = dialogEl.querySelector('.weiter');
		const dAbbrechen = dialogEl.querySelector('.abbrechen');
		const dHinweis = dialogEl.querySelector('.hinweis');
		const dSchnell = dialogEl.querySelector('.schnellwahl');
		// Tastendrücke im Eingabefeld nicht an SDL (lauscht am Fenster) weitergeben: sonst
		// verhindert SDL das Tippen bzw. das Spiel bekommt die Zeichen doppelt
		for (const typ of ['keydown', 'keyup', 'keypress']) dFeld.addEventListener(typ, (e) => e.stopPropagation());
		const dialoge = [];   // Stapel, falls eine Box eine weitere öffnet
		const DOS = { 0x8e: 'Ä', 0x99: 'Ö', 0x9a: 'Ü', 0x84: 'ä', 0x94: 'ö', 0x81: 'ü', 0xe1: 'ß' };
		// Zeichen der Spielschrift (seg096 g_gui_char_width); andere ASCII-Zeichen zeichnet das Spiel
		// als Lücke, z. B. „^“ in Geldbeträgen („3D^1S^5H“ → „3D 1S 5H“)
		const SCHRIFT = new Set(" ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz,.-()!?0123456789':#&%<>/_+");
		const zeichenText = (b) => DOS[b] ?? (b >= 0x20 && b < 0x7f
			? (SCHRIFT.has(String.fromCharCode(b)) ? String.fromCharCode(b) : ' ') : '');

		// Wörterbuch für die Schreibung (fehlt, wenn ohne spiel/ gebaut: dann wie im Original)
		let woerter = null;
		const schreibungBereit = fetch('schreibung.json').then((r) => r.ok ? r.json() : null).then((j) => {
			if (!j?.w) return false;
			woerter = Object.assign(Object.create(null), j.w, optionen.schreibungZusatz);
			neuZeichnen();
			return true;
		}).catch(() => false);
		const schreibungAn = () => {
			try { return localStorage.getItem('schreibung') !== 'original'; } catch (e) { return true; }
		};
		/** Bytes als Zeichenkette; @ und ~ bleiben, Farben 0xf0–f3 als \uE000–\uE003 */
		function dekodiere(bytes) {
			let t = '';
			for (const b of bytes) {
				if (b === 0x40 || b === 0x7e) t += String.fromCharCode(b);
				else if (b >= 0xf0 && b <= 0xf3) t += String.fromCharCode(0xe000 + b - 0xf0);
				else if (b === 0x0d || b === 0x0a) t += ' ';
				else t += zeichenText(b);
			}
			return (woerter && schreibungAn() && typeof Schreibung !== 'undefined') ? Schreibung.umwandeln(t, woerter) : t;
		}

		/** Spieltext (Bytes im DOS-Zeichensatz) als Zeilen: @ = Umbruch, ~ = Tabulator, 0xf0–f3 = Farbe */
		function spieltext(bytes, ziel) {
			ziel.replaceChildren();
			if (!bytes) return;
			let zeile, spalte, span = null, farbe = 0;
			const neueSpalte = () => { spalte = document.createElement('span'); zeile.append(spalte); span = null; };
			const neueZeile = () => { zeile = document.createElement('div'); zeile.className = 'zeile'; ziel.append(zeile); neueSpalte(); };
			const zeichen = (z) => {
				if (!span) { span = document.createElement('span'); if (farbe) span.className = 'f' + farbe; spalte.append(span); }
				span.textContent += z;
			};
			neueZeile();
			for (const z of dekodiere(bytes)) {
				const c = z.charCodeAt(0);
				if (z === '@') neueZeile();
				else if (z === '~') neueSpalte();
				else if (c >= 0xe000 && c <= 0xe003) { farbe = c - 0xe000; span = null; }
				else zeichen(z);
			}
		}
		const alsText = (bytes) => bytes ? bytes.map(zeichenText).join('') : '';

		function senden(fn) {
			const d = dialoge.at(-1);
			// nur eine Antwort je Box, und nur wenn der Tipp auf dem Overlay begonnen hat: sonst
			// schließt das Loslassen des Tipps, der die Box geöffnet hat, sie gleich wieder
			if (!d || d.gesendet || !d.gedrueckt) return;   // nur eine Antwort je Box (sonst landen Tasten im nächsten Bildschirm)
			d.gesendet = true;
			dialogEl.classList.add('gesendet');
			fn();
			// Sicherheitsnetz: bleibt dieselbe Box offen (Taste verloren?), nach 2 s wieder
			// antippbar machen, statt die Bedienung dauerhaft zu sperren
			setTimeout(() => {
				if (dialoge.at(-1) !== d || !d.gesendet) return;
				console.warn('Textbox reagiert nicht auf die Antwort – wieder freigegeben');
				d.gesendet = false;
				dialogEl.classList.remove('gesendet');
			}, 2000);
		}
		function portraetZeichnen() {
			const d = dialoge.at(-1);
			const c = dKopf.querySelector('canvas');
			if (!d?.bildPos || !c || !optionen.portraetQuelle) return;
			c.getContext('2d').drawImage(optionen.portraetQuelle(), d.bildPos[0], d.bildPos[1], 32, 32, 0, 0, 32, 32);
		}
		function zeigeDialog() {
			const d = dialoge.at(-1);
			dialogEl.hidden = !d;
			if (!d) return;
			dialogEl.classList.toggle('gesendet', !!d.gesendet);
			// Schriftgröße aus den Einstellungen (shell.html), Stufen 0.9–1.3
			let schrift = 1;
			try { schrift = Math.min(1.5, Math.max(0.7, +localStorage.getItem('schriftgroesse') || 1)); } catch (e) {}
			dialogEl.style.setProperty('--schrift', schrift);
			dialogEl.classList.toggle('janein', d.art === 3);
			dialogEl.classList.toggle('dicht', d.optionen.length > 7);
			dKopf.replaceChildren();
			if (d.bild) {
				const c = document.createElement('canvas');
				c.width = c.height = 32; c.className = 'portraet';
				dKopf.append(c);
			}
			if (d.name) { const n = document.createElement('div'); n.className = 'name'; spieltext(d.name, n); dKopf.append(n); }
			spieltext(d.text, dText);
			dOptionen.replaceChildren(...d.optionen.map((o, i) => {
				const b = document.createElement('button');
				b.type = 'button';
				spieltext(o, b);
				if (!alsText(o).trim()) { b.classList.add('frei'); b.textContent = 'frei'; }   // z. B. leerer Spielstandplatz
				b.classList.toggle('vorwahl', i === d.vorwahl);
				b.classList.toggle('hervor', i === d.hervor);
				b.addEventListener('click', () => senden(() => Module._web_menu_select(i + 1)));
				return b;
			}));
			const eingabe = d.art === 1 || d.art === 4;
			dEingabe.hidden = !eingabe;
			dSchnell.replaceChildren();
			dSchnell.hidden = true;
			if (eingabe) {
				const zahl = d.art === 4;
				dFeld.maxLength = d.zeichen;
				dFeld.value = alsText(d.vorgabe);
				dFeld.inputMode = zahl ? 'numeric' : 'text';
				dFeld.pattern = zahl ? '[0-9]*' : '.*';
				dFeld.autocapitalize = zahl ? 'off' : 'characters';
				// Bereich im Text, z. B. „(0-50)“: Werte zum Antippen
				const bereich = zahl && /\((\d+)\s*-\s*(\d+)\)/.exec(alsText(d.text));
				if (bereich) {
					const von = +bereich[1], bis = Math.min(+bereich[2], 10 ** d.zeichen - 1);
					const schritt = bis - von <= 10 ? 1 : Math.ceil((bis - von) / 6 / 5) * 5;
					const werte = [];
					for (let v = von; v < bis; v += schritt) werte.push(v);
					werte.push(bis);
					dSchnell.replaceChildren(...werte.map((v) => {
						const b = document.createElement('button');
						b.type = 'button';
						b.textContent = v;
						b.addEventListener('click', () => { dFeld.value = String(v); dEingabe.requestSubmit(); });
						return b;
					}));
					dSchnell.hidden = false;
				} else {
					setTimeout(() => dFeld.focus(), 0);   // ohne Schnellwahl gleich die Tastatur
				}
			}
			dWeiter.hidden = d.art !== 0;
			dAbbrechen.hidden = d.art === 0;
			dHinweis.textContent = d.art === 0 ? 'Tippen zum Weiterlesen' : '';
			portraetZeichnen();
		}
		dialogEl.addEventListener('pointerdown', () => { const d = dialoge.at(-1); if (d) d.gedrueckt = true; });
		// Meldung: Tippen irgendwo schließt (wie eine Taste im Original)
		dialogEl.addEventListener('click', () => {
			if (dialoge.at(-1)?.art === 0) senden(() => Module._web_key(13));
		});
		dAbbrechen.addEventListener('click', () => {
			const d = dialoge.at(-1);
			senden(() => (d.art === 1 || d.art === 4) ? Module._web_key(27) : Module._web_right_click());
		});
		dEingabe.addEventListener('submit', (e) => {
			e.preventDefault();
			const d = dialoge.at(-1);
			let text = dFeld.value.toUpperCase().replace(/ß/g, 'SS');
			if (d.art === 4) text = text.replace(/[^0-9]/g, '');
			text = text.slice(0, d.zeichen);
			if (!text) { dFeld.focus(); return; }   // leer schließt das Spiel nicht, also gar nicht erst senden
			d.gedrueckt = true;   // Eingabe per Tastatur (Enter) ohne Tipp
			const codes = { Ä: 0x84, Ö: 0x94, Ü: 0x81 };
			dFeld.blur();
			senden(() => {
				for (let i = 0; i < d.zeichen; i++) Module._web_key(8);   // Vorgabe des Spiels löschen
				for (const z of text) {
					const c = codes[z] ?? z.toLowerCase().charCodeAt(0);
					if (c >= 0x20 && c <= 0x7a || c in { 0x81: 1, 0x84: 1, 0x94: 1 }) Module._web_key(c);
				}
				Module._web_key(13);
			});
		});

	Module.dialogAuf = (d) => {
		dialoge.push(d);
		optionen.beimOeffnen?.(d);
		zeigeDialog();
	};
	Module.dialogZu = () => {
		dialoge.pop();
		zeigeDialog();
		optionen.beimSchliessen?.(dialoge.length === 0);
	};
	Module.dialogBild = (x, y) => {
		const d = dialoge.at(-1);
		if (d) { d.bildPos = [x, y]; portraetZeichnen(); }
	};

	/** offene Box neu aufbauen (z. B. nach Umschalten der Schreibung) */
	function neuZeichnen() {
		const d = dialoge.at(-1);
		if (d && d.art !== 1 && d.art !== 4) zeigeDialog();   // Eingabefelder nicht zurücksetzen
	}

	return { dialoge, alsText, spielText: dekodiere, portraetZeichnen, neuZeichnen, schreibungBereit };
}
