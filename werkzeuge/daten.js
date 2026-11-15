// Spieldaten vom Nutzer: Builds ohne eingebaute Daten lesen sie einmal ein und halten sie im Browser.
//
// Quelle (eine Auswahl im Dialog):
//   - GOG-Installer (.exe, deutsch): innoextract als WebAssembly in einem Worker (daten-worker.js)
//   - ZIP mit dem Ordner des installierten Spiels (Dateien werden am Namen erkannt, Unterordner egal)
//   - die Dateien selbst (Mehrfachauswahl)
// Geprüft wird die deutsche Fassung 3.02 (MD5 von SCHICKM.EXE). Abgelegt wird nur, was das Spiel
// braucht, in IndexedDB ('mobile-eyes-spieldaten'); die CD-Musik (MUSIC/TrackNN.ogg) optional.
// Nichts verlässt das Gerät.
//
// Seite (shell.html):  const daten = spieldatenEinrichten();
//   daten.eingebaut          Build mit eingebauten Daten (SPIELDATEN=1): nichts zu tun
//   daten.holen()            Promise<Map name → Uint8Array>; zeigt den Import, solange nichts da ist
//   daten.musik(track)       Promise<Blob|null> (MUSIC/TrackNN.ogg)
//   daten.loeschen()         alles entfernen
//   daten.groesse()          Promise<Bytes>
// Heldenerschaffung (gen-shell.html): spieldatenEinrichten({ ohneDialog: true }).holen(['DSAGEN.DAT'])
'use strict';

const SPIELDATEN_MD5 = '4ce035f95ead01a8b2553b4487544e5d';   // SCHICKM.EXE, deutsche Fassung 3.02
// Dateien, die das Spiel liest (wie im README beim Einrichten); Pflicht sind die ersten vier
const SPIELDATEN_PFLICHT = ['SCHICK.DAT', 'SCHICKM.EXE', 'DSAGEN.DAT', 'FONT.NVF'];
const SPIELDATEN_MUSTER = /^(SCHICK\.DAT|SCHICKM\.EXE|DSAGEN\.DAT|FONT\.NVF|MOUSE\.NVF|POPUP\.NVF|SOUND\.(CFG|LTX|NVF)|[A-Z0-9_]+\.CHR|INTRODAT\.(DIR|SND|VOL)|[A-Z0-9_]+\.ADV)$/;
const SPIELDATEN_MUSIK = /^TRACK(\d\d)\.OGG$/;

function spieldatenEinrichten(optionen = {}) {
	const meta = document.querySelector('meta[name="spieldaten"]');
	const eingebaut = meta?.content === '1';

	// ---------- IndexedDB ----------
	let dbPromise = null;
	function db() {
		dbPromise ??= new Promise((ja, nein) => {
			const anfrage = indexedDB.open('mobile-eyes-spieldaten', 1);
			anfrage.onupgradeneeded = () => anfrage.result.createObjectStore('dateien');
			anfrage.onsuccess = () => ja(anfrage.result);
			anfrage.onerror = () => nein(anfrage.error);
		});
		return dbPromise;
	}
	async function tx(modus, fn) {
		const d = await db();
		return new Promise((ja, nein) => {
			const t = d.transaction('dateien', modus);
			const ergebnis = fn(t.objectStore('dateien'));
			t.oncomplete = () => ja(ergebnis?.result ?? ergebnis);
			t.onerror = t.onabort = () => nein(t.error || new Error('Speichern im Browser abgebrochen (Speicher voll oder privater Modus?).'));
		});
	}
	const schluessel = () => tx('readonly', (s) => s.getAllKeys());
	async function lesen(namen) {
		const ergebnis = new Map();
		await tx('readonly', (s) => {
			for (const n of namen) s.get(n).onsuccess = (e) => { if (e.target.result) ergebnis.set(n, e.target.result); };
		});
		return ergebnis;
	}

	/** Uint8Array je Datei (Musik nur auf Anfrage). Abgelegt als ArrayBuffer: Blobs kann Safari
	 *  im privaten Modus nicht in IndexedDB speichern */
	async function ausDb(nur) {
		const namen = (await schluessel()).filter((n) => !n.startsWith('MUSIC/') && (!nur || nur.includes(n)));
		const roh = await lesen(namen);
		const ergebnis = new Map();
		for (const [n, b] of roh) ergebnis.set(n, new Uint8Array(b));
		return ergebnis;
	}
	const vollstaendig = (namen) => SPIELDATEN_PFLICHT.every((p) => namen.includes(p));

	async function holen(nur) {
		if (eingebaut) return new Map();
		let namen = [];
		try { namen = await schluessel(); } catch (e) { console.warn('Spieldaten: kein IndexedDB', e); }
		if (!vollstaendig(namen)) {
			if (optionen.ohneDialog) throw new Error('Spieldaten fehlen');
			await dialog();
		}
		return ausDb(nur);
	}

	async function musik(track) {
		if (eingebaut) return null;
		try {
			const n = `MUSIC/TRACK${String(track).padStart(2, '0')}.OGG`;
			const b = (await lesen([n])).get(n);
			return b ? new Blob([b]) : null;
		} catch (e) { return null; }
	}

	async function groesse() {
		let summe = 0;
		await tx('readonly', (s) => {
			s.openCursor().onsuccess = (e) => {
				const c = e.target.result;
				if (!c) return;
				summe += c.value.byteLength || 0;
				c.continue();
			};
		});
		return summe;
	}
	const loeschen = () => tx('readwrite', (s) => s.clear());

	// ---------- Quellen ----------
	/** ZIP lesen: zentrales Verzeichnis, Methoden 0 (gespeichert) und 8 (Deflate) */
	async function zipLesen(datei, nimm, fortschritt) {
		const ende = new DataView(await datei.slice(Math.max(0, datei.size - 65557)).arrayBuffer());
		let pos = -1;
		for (let i = ende.byteLength - 22; i >= 0; i--) {
			if (ende.getUint32(i, true) === 0x06054b50) { pos = i; break; }
		}
		if (pos < 0) throw new Error('Keine gültige ZIP-Datei.');
		const anzahl = ende.getUint16(pos + 10, true);
		const cdGroesse = ende.getUint32(pos + 12, true);
		const cdStart = ende.getUint32(pos + 16, true);
		if (cdStart === 0xffffffff) throw new Error('ZIP64 wird nicht unterstützt – bitte nur die Spieldateien packen.');
		const cd = new DataView(await datei.slice(cdStart, cdStart + cdGroesse).arrayBuffer());
		const eintraege = [];
		for (let i = 0, p = 0; i < anzahl; i++) {
			if (cd.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP-Verzeichnis beschädigt.');
			const methode = cd.getUint16(p + 10, true);
			const komprimiert = cd.getUint32(p + 20, true);
			const nameLaenge = cd.getUint16(p + 28, true);
			const extra = cd.getUint16(p + 30, true);
			const kommentar = cd.getUint16(p + 32, true);
			const lokal = cd.getUint32(p + 42, true);
			const name = new TextDecoder().decode(new Uint8Array(cd.buffer, p + 46, nameLaenge));
			eintraege.push({ name, methode, komprimiert, lokal });
			p += 46 + nameLaenge + extra + kommentar;
		}
		const gewaehlt = eintraege.filter((e) => nimm(e.name));
		const ergebnis = [];
		for (const [i, e] of gewaehlt.entries()) {
			fortschritt?.(`Entpacke ${grundname(e.name)} (${i + 1}/${gewaehlt.length})`);
			const kopf = new DataView(await datei.slice(e.lokal, e.lokal + 30).arrayBuffer());
			const start = e.lokal + 30 + kopf.getUint16(26, true) + kopf.getUint16(28, true);
			const roh = datei.slice(start, start + e.komprimiert);
			let daten;
			if (e.methode === 0) daten = roh;
			else if (e.methode === 8) {
				if (typeof DecompressionStream === 'undefined') throw new Error('Dieser Browser kann keine ZIP-Dateien entpacken (zu alt).');
				daten = await new Response(roh.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
			} else throw new Error(`ZIP: Packverfahren ${e.methode} wird nicht unterstützt (${e.name}).`);
			ergebnis.push({ pfad: e.name, daten });
		}
		return ergebnis;
	}

	/** GOG-Installer: innoextract im Worker, liefert die Dateien unter app/ */
	function installerLesen(datei, mitMusik, fortschritt) {
		return new Promise((ja, nein) => {
			const w = new Worker('daten-worker.js');
			w.onmessage = (e) => {
				const m = e.data;
				if (m.text) fortschritt?.(m.text);
				if (m.fehler) { w.terminate(); nein(new Error(m.fehler)); }
				if (m.dateien) { w.terminate(); ja(m.dateien.map((d) => ({ pfad: d.pfad, daten: new Blob([d.daten]) }))); }
			};
			w.onerror = (e) => { w.terminate(); nein(new Error('Entpacken fehlgeschlagen: ' + (e.message || 'Worker'))); };
			w.postMessage({ datei, muster: [SPIELDATEN_MUSTER.source, ...(mitMusik ? [SPIELDATEN_MUSIK.source] : [])] });
		});
	}

	const grundname = (pfad) => pfad.split(/[\\/]/).pop();
	/** Ablagename oder null: SCHICK.DAT …, MUSIC/TRACK02.OGG */
	function ablagename(pfad, mitMusik) {
		const n = grundname(pfad).toUpperCase();
		if (SPIELDATEN_MUSTER.test(n)) return n;
		if (mitMusik && SPIELDATEN_MUSIK.test(n)) return 'MUSIC/' + n;
		return null;
	}

	async function einlesen(dateien, mitMusik, fortschritt) {
		let gefunden;
		const nimm = (pfad) => ablagename(pfad, mitMusik) !== null;
		if (dateien.length === 1 && /\.exe$/i.test(dateien[0].name)) {
			gefunden = await installerLesen(dateien[0], mitMusik, fortschritt);
		} else if (dateien.length === 1 && /\.zip$/i.test(dateien[0].name)) {
			gefunden = await zipLesen(dateien[0], nimm, fortschritt);
		} else {
			gefunden = [...dateien].map((d) => ({ pfad: d.webkitRelativePath || d.name, daten: d }));
		}
		const ablage = new Map();
		for (const g of gefunden) {
			const n = ablagename(g.pfad, mitMusik);
			if (n && !ablage.has(n)) ablage.set(n, g.daten instanceof Blob ? g.daten : new Blob([g.daten]));
		}
		const fehlt = SPIELDATEN_PFLICHT.filter((p) => !ablage.has(p));
		if (fehlt.length) {
			// die englische Fassung hat dieselben Nebendateien, aber BLADE.DAT/BLADEM.EXE statt SCHICK.DAT/SCHICKM.EXE
			throw new Error(fehlt.includes('SCHICK.DAT') && fehlt.includes('SCHICKM.EXE')
				? 'Darin ist die Schicksalsklinge nicht in der deutschen Fassung (englisch „Blade of Destiny“?). Nötig ist die deutsche GOG-Fassung.'
				: `Unvollständig, es fehlen: ${fehlt.join(', ')}.`);
		}
		fortschritt?.('Prüfe die Fassung …');
		const md5 = md5Hex(new Uint8Array(await ablage.get('SCHICKM.EXE').arrayBuffer()));
		if (md5 !== SPIELDATEN_MD5) {
			throw new Error('Das ist nicht die deutsche Fassung 3.02 (SCHICKM.EXE passt nicht). Nötig ist die deutsche GOG-Fassung.');
		}
		fortschritt?.('Speichere im Browser …');
		const puffer = [];
		for (const [n, b] of ablage) puffer.push([n, await b.arrayBuffer()]);
		await loeschen();
		await tx('readwrite', (s) => { for (const [n, b] of puffer) s.put(b, n); });
		try { await navigator.storage?.persist?.(); } catch (e) {}
		return ablage.size;
	}

	// ---------- Dialog ----------
	let dialogPromise = null;
	function dialog() {
		dialogPromise ??= new Promise((fertig) => {
			const stil = document.createElement('style');
			stil.textContent = `
			#spieldaten { position: fixed; inset: 0; z-index: 30; overflow-y: auto; display: flex; align-items: center; justify-content: center;
				background: var(--bg, #15110d); color: var(--text, #eee);
				padding: max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom)); }
			#spieldaten .karte { max-width: 32rem; width: 100%; display: flex; flex-direction: column; gap: 0.8rem;
				background: var(--panel, #241c15); border: 1px solid var(--rand, #4a3b2c); border-radius: 0.9rem; padding: 1.2rem; }
			#spieldaten h2 { margin: 0; font: bold 1.3rem Georgia, serif; color: var(--gold, #d8b25a); }
			#spieldaten p { margin: 0; line-height: 1.45; }
			#spieldaten .leise { color: var(--leise, #a99); font-size: 0.9rem; }
			#spieldaten label { display: flex; gap: 0.5rem; align-items: center; }
			#spieldaten button { min-height: 3rem; font-size: 1.05rem; touch-action: manipulation; }
			#spieldaten .status:empty, #spieldaten .fehler:empty { display: none; }
			#spieldaten .fehler { color: #ff8a6a; }
			#spieldaten .status { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.85rem; color: var(--leise, #a99); }
			`;
			document.head.append(stil);
			const el = document.createElement('div');
			el.id = 'spieldaten';
			el.setAttribute('role', 'dialog');
			el.setAttribute('aria-label', 'Spieldaten einlesen');
			el.innerHTML = `
			<div class="karte">
				<h2>Spieldaten einlesen</h2>
				<p>Mobile Eyes enthält keine Spieldaten. Nötig ist die deutsche GOG-Fassung von
				„Realms of Arkania 1 – Blade of Destiny Classic“ (Sprache Deutsch).</p>
				<p>Bitte den <b>GOG-Installer</b> (.exe, rund 120 MB) oder eine <b>ZIP-Datei</b> mit dem Ordner
				des installierten Spiels wählen. Am PC lassen sich auch die Spieldateien direkt markieren.</p>
				<label class="musik"><input type="checkbox" checked> CD-Musik übernehmen (rund 80 MB)</label>
				<p class="leise musik-hinweis" hidden>Dieser Browser spielt die Musik (OGG) nicht ab; sie wird nicht übernommen.</p>
				<button type="button" class="waehlen">Datei wählen …</button>
				<input type="file" multiple hidden accept=".exe,.zip,application/zip,application/x-msdownload,.DAT,.EXE,.NVF,.CHR,.ADV,.CFG,.LTX,.DIR,.SND,.VOL,.ogg">
				<p class="status" aria-live="polite"></p>
				<p class="fehler" role="alert"></p>
				<p class="leise">Die Dateien bleiben in diesem Browser auf diesem Gerät, nichts wird hochgeladen.
				Einmal eingelesen, startet das Spiel künftig direkt (auch offline).</p>
			</div>`;
			document.body.append(el);
			const auswahl = el.querySelector('input[type=file]');
			const knopf = el.querySelector('.waehlen');
			const status = el.querySelector('.status');
			const fehler = el.querySelector('.fehler');
			const musikWahl = el.querySelector('.musik input');
			const oggGeht = !!new Audio().canPlayType('audio/ogg; codecs="vorbis"');
			if (!oggGeht) {
				musikWahl.checked = false;
				el.querySelector('.musik').hidden = true;
				el.querySelector('.musik-hinweis').hidden = false;
			}
			knopf.addEventListener('click', () => auswahl.click());
			auswahl.addEventListener('change', async () => {
				const dateien = [...auswahl.files];
				auswahl.value = '';
				if (!dateien.length) return;
				knopf.disabled = true;
				fehler.textContent = '';
				status.textContent = 'Lese ' + (dateien.length === 1 ? dateien[0].name : `${dateien.length} Dateien`) + ' …';
				try {
					const n = await einlesen(dateien, musikWahl.checked, (t) => { status.textContent = t; });
					status.textContent = `${n} Dateien übernommen.`;
					el.remove();
					fertig();
				} catch (e) {
					console.warn('Spieldaten', e);
					fehler.textContent = e?.message || String(e);
					status.textContent = '';
				} finally {
					knopf.disabled = false;
				}
			});
		});
		return dialogPromise;
	}

	return { eingebaut, holen, musik, loeschen, groesse, dialog };
}

// ---------- MD5 (RFC 1321) – crypto.subtle kennt kein MD5 und fehlt ohne HTTPS ----------
function md5Hex(bytes) {
	const s = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
		4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
	const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
	const laenge = bytes.length;
	const bloecke = ((laenge + 8) >>> 6) + 1;
	const w = new Uint32Array(bloecke * 16);
	for (let i = 0; i < laenge; i++) w[i >> 2] |= bytes[i] << ((i % 4) * 8);
	w[laenge >> 2] |= 0x80 << ((laenge % 4) * 8);
	w[bloecke * 16 - 2] = (laenge * 8) >>> 0;
	w[bloecke * 16 - 1] = Math.floor(laenge / 0x20000000);
	let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
	for (let blk = 0; blk < bloecke; blk++) {
		let a = a0, b = b0, c = c0, d = d0;
		for (let i = 0; i < 64; i++) {
			let f, g;
			if (i < 16) { f = (b & c) | (~b & d); g = i; }
			else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
			else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
			else { f = c ^ (b | ~d); g = (7 * i) % 16; }
			const t = d;
			d = c;
			c = b;
			const x = (a + f + K[i] + w[blk * 16 + g]) >>> 0;
			b = (b + ((x << s[i]) | (x >>> (32 - s[i])))) >>> 0;
			a = t;
		}
		a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
	}
	return [a0, b0, c0, d0].map((v) => [0, 8, 16, 24].map((k) => ((v >>> k) & 0xff).toString(16).padStart(2, '0')).join('')).join('');
}
