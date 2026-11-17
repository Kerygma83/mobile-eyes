// Ton im Browser: Soundeffekte (VOC aus SCHICK.DAT) und Musik (CD-Tracks der GOG-Fassung).
//
// Das Spiel ruft auf (seg002 play_voc, seg001 CD_*):
//   Module.tonEffekt(bytes)   VOC-Datei abspielen, Rückgabe: Dauer in ms
//   Module.musikSpielen(nr)   CD-Track nr in Schleife (musik/TrackNN.m4a, ohne eingebaute Spieldaten
//                             die eingelesene OGG-Datei über Module.musikDatei, daten.js)
//   Module.musikPause() / Module.musikWeiter()
// Browser erlauben Ton erst nach einer Berührung; bis dahin wird er still übergangen und
// die Musik beginnt mit dem ersten Tippen.
// Einstellungen (Menü der Seite, im Browser gemerkt): Musik und Effekte je an/aus und Lautstärke
// (localStorage ton_musik, ton_musik_vol, ton_effekte, ton_effekte_vol). Die Musik läuft dafür über
// Web Audio: iOS ändert die Lautstärke eines Audio-Elements nicht.
'use strict';

function tonEinrichten(Module) {
	const lies = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
	const merke = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
	const einst = {
		musik: lies('ton_musik') !== 'aus',
		musikVol: Number(lies('ton_musik_vol') ?? 80),
		effekte: lies('ton_effekte') !== 'aus',
		effekteVol: Number(lies('ton_effekte_vol') ?? 90),   // Original: SND_set_volume(90)
	};
	let musikGain = null;
	let ctx = null;            // AudioContext für die Effekte
	let effekt = null;         // laufender Effekt (das Original spielt immer nur einen)
	const musik = new Audio();
	musik.loop = true;
	musik.preload = 'auto';
	let musikTrack = 0;        // gewünschter Track (0 = keiner)
	let musikGeladen = 0;      // Track, dessen Datei in musik.src steckt
	let musikPausiert = false;
	let freigeschaltet = false;
	const urls = new Map();    // Track → Blob-URL (einmal geladen)

	// ---------- Freischalten beim ersten Tippen ----------
	function freischalten() {
		if (freigeschaltet) return;
		freigeschaltet = true;
		try {
			ctx = new (window.AudioContext || window.webkitAudioContext)();
			ctx.resume?.();
			// Musik über einen Gain-Knoten (Lautstärke auch auf iOS)
			musikGain = ctx.createGain();
			musikGain.gain.value = einst.musikVol / 100;
			ctx.createMediaElementSource(musik).connect(musikGain).connect(ctx.destination);
		} catch (e) { console.warn('kein Web Audio', e); }
		// iOS: ein Audio-Element darf später nur abspielen, wenn es einmal in einer Geste gestartet wurde
		musik.play().catch(() => {}).finally(() => { if (!musikLaeuft()) musik.pause(); });
		musikAktualisieren();
		schnittstelle.beimFreischalten?.();
	}
	for (const typ of ['pointerdown', 'keydown', 'touchend']) {
		window.addEventListener(typ, freischalten, { capture: true, passive: true });
	}
	// nach dem Zurückkehren in die App weiterlaufen lassen
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') { ctx?.resume?.(); musikAktualisieren(); }
		else musik.pause();
	});

	// ---------- Soundeffekte (Creative Voice File) ----------
	/** VOC → { rate, samples (Float32Array) } ; nur 8-Bit-PCM, Blöcke 1, 2, 3, 9 */
	function vocLesen(b) {
		let pos = 0;
		if (String.fromCharCode(...b.subarray(0, 19)) === 'Creative Voice File') pos = b[20] | (b[21] << 8);
		const teile = [];
		let rate = 11025, laenge = 0;
		while (pos + 4 <= b.length) {
			const typ = b[pos];
			if (typ === 0) break;
			const len = b[pos + 1] | (b[pos + 2] << 8) | (b[pos + 3] << 16);
			const daten = pos + 4;
			if (typ === 1 && b[daten + 1] === 0) {            // Tondaten: Zeitkonstante, Codec 0 = 8 Bit
				rate = Math.round(1000000 / (256 - b[daten]));
				teile.push(b.subarray(daten + 2, Math.min(daten + len, b.length)));
			} else if (typ === 2) {                            // Fortsetzung
				teile.push(b.subarray(daten, Math.min(daten + len, b.length)));
			} else if (typ === 3) {                            // Stille
				teile.push(new Uint8Array((b[daten] | (b[daten + 1] << 8)) + 1).fill(128));
			} else if (typ === 9 && b[daten + 4] === 8 && b[daten + 5] === 1) {   // neu: Rate, 8 Bit, mono
				rate = b[daten] | (b[daten + 1] << 8) | (b[daten + 2] << 16);
				teile.push(b.subarray(daten + 12, Math.min(daten + len, b.length)));
			}
			pos = daten + len;
		}
		for (const t of teile) laenge += t.length;
		const samples = new Float32Array(laenge);
		let i = 0;
		for (const t of teile) for (const v of t) samples[i++] = (v - 128) / 128;
		return { rate, samples };
	}

	Module.tonEffekt = (bytes) => {
		try {
			const { rate, samples } = vocLesen(bytes);
			if (!samples.length) return 0;
			const dauer = samples.length / rate * 1000;
			if (!ctx || ctx.state !== 'running' || !einst.effekte) return dauer;   // still (nicht freigeschaltet, aus)
			const puffer = ctx.createBuffer(1, samples.length, rate);
			puffer.copyToChannel(samples, 0);
			try { effekt?.stop(); } catch (e) {}
			effekt = ctx.createBufferSource();
			effekt.buffer = puffer;
			const lautstaerke = ctx.createGain();
			lautstaerke.gain.value = einst.effekteVol / 100;
			effekt.connect(lautstaerke).connect(ctx.destination);
			effekt.start();
			return dauer;
		} catch (e) {
			console.warn('Soundeffekt', e);
			return 0;
		}
	};

	// ---------- Musik (CD-Tracks) ----------
	const musikLaeuft = () => einst.musik && musikTrack && !musikPausiert && document.visibilityState === 'visible';

	async function musikAktualisieren() {
		if (!musikLaeuft()) { musik.pause(); return; }
		if (!freigeschaltet) return;
		const track = musikTrack;
		if (musikGeladen !== track) {
			musik.pause();
			let url = urls.get(track);
			if (!url) {
				try {
					if (Module.musikDatei) {
						// ohne eingebaute Spieldaten: eingelesene OGG-Datei aus dem Browser (daten.js)
						const blob = await Module.musikDatei(track);
						if (!blob) throw new Error('nicht eingelesen');
						url = URL.createObjectURL(new Blob([blob], { type: 'audio/ogg' }));
					} else {
						// ganze Datei holen (der Service Worker legt sie für offline ab), als Blob abspielen
						const antwort = await fetch(`musik/Track${String(track).padStart(2, '0')}.m4a`);
						if (!antwort.ok) throw new Error(antwort.status);
						url = URL.createObjectURL(new Blob([await antwort.arrayBuffer()], { type: 'audio/mp4' }));   // Typ fest: Safari
					}
					urls.set(track, url);
					// höchstens drei Tracks im Speicher halten (je einige MB)
					for (const [alt, altUrl] of urls) {
						if (urls.size <= 3) break;
						if (alt === musikGeladen) continue;
						URL.revokeObjectURL(altUrl);
						urls.delete(alt);
					}
				} catch (e) {
					console.warn(`Musik für Track ${track} nicht verfügbar`, e.message || e);
					return;
				}
				if (track !== musikTrack) return;               // inzwischen ein anderer Track gewünscht
			}
			musik.src = url;
			musikGeladen = track;
		}
		if (musikLaeuft()) musik.play().catch((e) => console.warn('Musik', e.message || e));
	}

	Module.musikSpielen = (track) => { musikTrack = track; musikAktualisieren(); };
	Module.musikPause = () => { musikPausiert = true; musik.pause(); };
	Module.musikWeiter = () => { musikPausiert = false; musikAktualisieren(); };

	const schnittstelle = {
		musik,
		// Einstellungen: { musik, musikVol, effekte, effekteVol } (an/aus, 0–100)
		get einstellungen() { return { ...einst }; },
		setze(neu) {
			Object.assign(einst, neu);
			merke('ton_musik', einst.musik ? 'an' : 'aus');
			merke('ton_musik_vol', String(einst.musikVol));
			merke('ton_effekte', einst.effekte ? 'an' : 'aus');
			merke('ton_effekte_vol', String(einst.effekteVol));
			if (musikGain) musikGain.gain.value = einst.musikVol / 100;   // vor dem Freischalten: beim Anlegen
			if (!einst.effekte) { try { effekt?.stop(); } catch (e) {} }
			musikAktualisieren();
		},
		get ctx() { return ctx; },
		get track() { return musikTrack; },     // gewünschter CD-Track
		get freigeschaltet() { return freigeschaltet; },   // nach der ersten Berührung
		beimFreischalten: null,                 // Rückruf der Seite (Hinweis „Einmal tippen für Ton“ ausblenden)
		get geladen() { return musikGeladen; }, // Track, dessen Datei bereitsteht
	};
	return schnittstelle;
}
