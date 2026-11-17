// Startmenü nach dem Intro: Titelbild aus dem Intro, „Spiel starten“, „Generierung“, Modus
// (Anfänger/Fortgeschritten) und Einstellungen. Ersetzt im Browser die beiden Textmenüs des Originals
// (Schwierigkeitsgrad; Hauptprogramm oder Generierung): das Spiel fragt über web_startmenue() (seg002)
// und macht danach wie im Original weiter (Generierung, dann Spielstand laden oder „Keinen“).
//
// Titelbild: das Bild „Die Schicksalsklinge“ aus INTRO_E.OVL, bei TITEL_ZEIT Sekunden virtueller Zeit voll
// eingeblendet. Es entsteht aus den Spieldaten und bleibt nur in diesem Browser (localStorage 'titelbild').
// Läuft das Intro so weit, hält die Seite es fest (titelAusIntro); sonst rechnet ein Worker das Intro
// einmal ohne Anzeige bis dorthin (einige Sekunden). Ohne INTRO_E.OVL steht der Titel als Text da.

const TITEL_ZEIT = 40;   // s virtuelle Zeit: Titel voll sichtbar (Einblendung bis ~35 s, Abblenden ab ~43 s)

function startmenueEinrichten(Module, { el, einstellungenOeffnen }) {
	const lies = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
	const merke = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
	const bildEl = el.querySelector('.titel img');
	const textEl = el.querySelector('.titel .text');
	const modusEl = el.querySelector('.modus');

	function titelZeigen(url) {
		if (!url) return;
		bildEl.src = url;
		bildEl.hidden = false;
		textEl.hidden = true;
	}

	// Bild 320×200 (RGBA) → PNG als data:-URL
	function alsUrl(rgba) {
		const c = document.createElement('canvas');
		c.width = 320; c.height = 200;
		c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba), 320, 200), 0, 0);
		return c.toDataURL('image/png');
	}

	function titelSpeichern(url) {
		merke('titelbild', url);
		titelZeigen(url);
	}

	// ohne gespeichertes Titelbild: Intro im Worker bis zum Titel rechnen
	let rechnet = false;
	function titelRechnen() {
		if (rechnet || lies('titelbild')) return;
		const dateien = {};
		try {
			for (const n of ['INTRO_E.OVL', 'INTRODAT.DIR', 'INTRODAT.VOL', 'INTRODAT.SND']) dateien[n] = Module.FS.readFile('/spiel/' + n);
		} catch (e) { return; }   // ältere Spieldaten ohne Intro: Titel als Text
		rechnet = true;
		const quelle = `importScripts(${JSON.stringify(new URL('intro.js', location.href).href)});
			onmessage = (e) => {
				try {
					const intro = new Intro(e.data, { argumente: 'nomusic', einDurchlauf: true });
					intro.laufen(${TITEL_ZEIT} * Intro.CPU_HZ);
					const rgba = new Uint8Array(320 * 200 * 4);
					intro.bild(rgba);
					postMessage(rgba, [rgba.buffer]);
				} catch (f) { postMessage(null); }
			};`;
		const url = URL.createObjectURL(new Blob([quelle], { type: 'text/javascript' }));
		const w = new Worker(url);
		w.onmessage = (e) => {
			w.terminate(); URL.revokeObjectURL(url); rechnet = false;
			if (e.data) titelSpeichern(alsUrl(e.data));
		};
		w.onerror = () => { w.terminate(); URL.revokeObjectURL(url); rechnet = false; };
		w.postMessage(dateien);
	}

	// Modus: im Browser gemerkt (Anfänger = 1, Fortgeschritten = 2 wie im Original)
	const modus = () => (lies('modus') === '2' ? 2 : 1);
	function modusZeigen() {
		for (const b of modusEl.querySelectorAll('button')) b.setAttribute('aria-pressed', String(Number(b.dataset.wert) === modus()));
	}
	modusEl.addEventListener('click', (e) => {
		const b = e.target.closest('button');
		if (!b) return;
		merke('modus', b.dataset.wert);
		modusZeigen();
	});
	el.querySelector('.einstellungen').addEventListener('click', () => einstellungenOeffnen());

	titelZeigen(lies('titelbild'));

	return {
		// vom Intro (shell.html, originalIntro): aktuelles Bild, sobald TITEL_ZEIT erreicht ist
		TITEL_ZEIT,
		titelAusIntro(rgba) { if (!lies('titelbild')) titelSpeichern(alsUrl(rgba)); },
		// Spieldaten entfernt: das Titelbild stammt daraus
		vergessen() { try { localStorage.removeItem('titelbild'); } catch (e) {} },
		// vom Spiel (web_startmenue): wartet auf die Wahl, liefert Modus + 10 × Wahl (0 Spiel, 1 Generierung)
		zeigen() {
			modusZeigen();
			titelRechnen();
			el.hidden = false;
			document.body.classList.add('startmenue');
			return new Promise((fertig) => {
				const wahl = (e) => {
					const b = e.target.closest('button[data-start]');
					if (!b) return;
					el.removeEventListener('click', wahl);
					el.hidden = true;
					document.body.classList.remove('startmenue');
					fertig(modus() + 10 * Number(b.dataset.start));
				};
				el.addEventListener('click', wahl);
			});
		},
	};
}
