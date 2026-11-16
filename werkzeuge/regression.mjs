// Führt die Szenarien aus werkzeuge/szenarien.mjs im Browser aus (Playwright, Handy-Ansicht).
// Aufruf im Playwright-Container:  node regression.mjs [namensfilter]
// Ergebnis: Exit-Code 0/1, Screenshots und Konsole je Szenario in build/regression/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
import { szenarien } from './szenarien.mjs';

const wurzel = process.env.WURZEL || '/app/build/web-test';
// Szenarien mit wurzel: 'frei' laufen im Build ohne eingebaute Spieldaten (…-frei)
let aktWurzel = wurzel;
const ausgabe = '/app/build/regression';
const filter = process.argv[2] || '';
fs.rmSync(ausgabe, { recursive: true, force: true });
fs.mkdirSync(ausgabe, { recursive: true });

const typen = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.data': 'application/octet-stream', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
	const datei = path.join(aktWurzel, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
	fs.readFile(datei, (err, inhalt) => {
		if (err) { res.writeHead(404); res.end(); return; }
		res.writeHead(200, { 'Content-Type': typen[path.extname(datei)] || 'application/octet-stream' });
		res.end(inhalt);
	});
}).listen(8080);

// BROWSER=webkit: Safari-Engine (iOS-Verhalten), Standard Chromium
const browser = await (process.env.BROWSER === 'webkit' ? webkit : chromium).launch();
const ergebnisse = [];

/** führt fn aus, scheitert nach ms mit „Seite blockiert“ */
function mitFrist(promise, ms, was) {
	let t;
	return Promise.race([
		promise.finally(() => clearTimeout(t)),
		new Promise((_, nein) => { t = setTimeout(() => nein(new Error(`Seite blockiert (${was})`)), ms); }),
	]);
}

// nurAufWunsch (lange Läufe wie der Zufallsspieler): nur, wenn der Filter sie nennt
const auswahl = szenarien.filter((s) => s.name.toLowerCase().includes(filter.toLowerCase()) && (filter || !s.nurAufWunsch));
for (const sz of auswahl) {
	const kurz = sz.name.replace(/[^A-Za-z0-9äöüÄÖÜß]+/g, '-').toLowerCase();
	const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
	// Szenarien vergleichen mit den Texten des Spiels (Großbuchstaben); die normale Schreibung
	// (schreibung.js) nur in Szenarien mit schreibung: true
	if (!sz.schreibung) await ctx.addInitScript(() => { try { localStorage.setItem('schreibung', 'original'); } catch (e) {} });
	const page = await ctx.newPage();
	const konsole = [];
	let laufzeitfehler = null;
	page.on('console', (m) => {
		konsole.push(`[${m.type()}] ${m.text()}`);
		// Sanitizer (ASAN=1): UBSan meldet nur und läuft weiter, das zählt trotzdem als Fehler
		if (/runtime error:|AddressSanitizer|LeakSanitizer/.test(m.text())) laufzeitfehler ??= new Error(`Sanitizer: ${m.text()}`);
	});
	page.on('dialog', (d) => d.accept());
	// lange Läufe (Chromium): Debugger gleich verbinden, bei einem Hänger lässt er sich nicht mehr einschalten
	let cdp = null;
	if (sz.nurAufWunsch && process.env.BROWSER !== 'webkit') {
		cdp = await ctx.newCDPSession(page);
		await cdp.send('Debugger.enable');
	}   // Rückfragen (confirm) bestätigen
	page.on('pageerror', (e) => { laufzeitfehler ??= e; konsole.push(`[pageerror] ${e.message}\n${e.stack}`); });

	// vor dem Start des Spiels (Modul lädt noch) gibt es keinen Zustand
	const zustand = async () => JSON.parse(await mitFrist(
		page.evaluate(() => {
			if (typeof Module === 'undefined' || !Module.calledRun) return '{}';
			// Spielzustand plus Overlay der Seite (ov = sichtbar, ovText = Text, ovN = Anzahl Einträge)
			const z = JSON.parse(Module.UTF8ToString(Module._web_test_state()));
			const d = document.getElementById('dialog');
			z.ov = d.hidden ? 0 : 1;
			z.ovText = d.hidden ? '' : d.querySelector('.text').textContent;
			z.ovN = d.hidden ? 0 : d.querySelectorAll('.optionen button').length;
			z.vollbild = document.getElementById('mobil').classList.contains('vollbild') ? 1 : 0;
			// Heldenerschaffung (iframe): sichtbar, Overlay, Text, Anzahl Einträge
			const gen = document.getElementById('gen');
			z.gen = gen.hidden ? 0 : 1;
			z.intro = document.getElementById('intro')?.hidden === false ? 1 : 0;
			const gd = !gen.hidden && gen.querySelector('iframe').contentDocument?.getElementById('dialog');
			z.gOv = gd && !gd.hidden ? 1 : 0;
			z.gText = z.gOv ? gd.querySelector('.text').textContent : '';
			z.gN = z.gOv ? gd.querySelectorAll('.optionen button').length : 0;
			// Menüs als Knöpfe unter dem Bild (gen-shell.html): Anzahl sichtbarer Knöpfe (mit „Abbrechen“)
			const gk = !gen.hidden && gen.querySelector('iframe').contentDocument?.getElementById('menueknoepfe');
			z.gKnoepfe = gk && !gk.hidden ? gk.querySelectorAll('button').length : 0;
			// Prüfsumme des Bildes der Heldenerschaffung (Canvas), um eine sichtbare Box zu erkennen
			z.gBild = 0;
			if (z.gen) {
				const gc = gen.querySelector('iframe').contentDocument?.getElementById('canvas');
				if (gc) {
					const t = document.createElement('canvas'); t.width = 320; t.height = 200;
					const tc = t.getContext('2d'); tc.drawImage(gc, 0, 0, 320, 200);
					const px = tc.getImageData(0, 0, 320, 200).data;
					let h = 0;
					for (let i = 0; i < px.length; i += 4) h = (h * 31 + px[i] + px[i + 1] * 7 + px[i + 2] * 13) | 0;
					z.gBild = h;
				}
			}
			// Ansicht zeigt dasselbe wie das aktuelle Spielbild? (0 = festgehalten, z. B. ohne die Box des Spiels)
			const ans = document.querySelector('canvas[aria-label="Ansicht"]');
			const a = ans.getContext('2d').getImageData(0, 0, 240, 136).data;
			const g = lebend.getContext('2d').getImageData(0, 0, 240, 136).data;   // aktuelles Spielbild
			let gleich = 1;
			for (let i = 0; i < a.length; i++) if (a[i] !== g[i]) { gleich = 0; break; }
			z.ansichtAktuell = gleich;
			// oberste Zeile der Ortszeile: dunkle Pixel zwischen x 3 und 299 (0 = durchgehende Rahmenlinie)
			const oz = document.querySelector('canvas[aria-label="Ortszeile"]').getContext('2d').getImageData(3, 0, 297, 1).data;
			z.ortRand = 0;
			for (let i = 0; i < oz.length; i += 4) if (oz[i] < 40 && oz[i + 1] < 40 && oz[i + 2] < 40) z.ortRand++;
			// Anteil rein schwarzer Pixel in der Ansicht (aktuelles Spielbild), in Prozent
			let schwarz = 0;
			for (let i = 0; i < g.length; i += 4) if (!g[i] && !g[i + 1] && !g[i + 2]) schwarz++;
			z.schwarz = Math.round(schwarz / (240 * 136) * 100);
			// weiße Pixel (Farbe des Mauszeigers) um die letzte Tippstelle in den Icons (306,124)
			const um = lebend.getContext('2d').getImageData(296, 114, 24, 24).data;
			let weiss = 0;
			for (let i = 0; i < um.length; i += 4) if (um[i] >= 235 && um[i + 1] >= 235 && um[i + 2] >= 235) weiss++;   // Zeiger: Farbe 0xff = 240,240,240
			z.zeiger = weiss;
			return JSON.stringify(z);
		}), 5000, 'Zustand abfragen'));
	const bewerte = (ausdruck, z, m) => Function('z', 'm', `return (${ausdruck});`)(z, m);
	async function punkt(label, gx, gy) {
		const el = page.locator(`canvas[aria-label="${label}"]`);
		// ohne data-aus (Datumszeile): Koordinaten in der Canvas selbst
		const aus = (await el.getAttribute('data-aus')) ?? `0,0,${await el.getAttribute('width')},${await el.getAttribute('height')}`;
		const [ax, ay, aw, ah] = aus.split(',').map(Number);
		const b = await el.boundingBox();
		if (!b) throw new Error(`Ausschnitt „${label}“ ist nicht sichtbar`);
		return [b.x + (gx - ax + 0.5) / aw * b.width, b.y + (gy - ay + 0.5) / ah * b.height];
	}
	const knopf = (name) => page.getByRole('button', { name, exact: true });

	/**
	 * Zufallsspieler: tippt dauer ms lang auf sichtbare Ausschnitte, Knöpfe und Overlay-Einträge.
	 * saat macht den Lauf wiederholbar (Spiel-Zufall bleibt eigen). Fehler: pageerror, Sanitizer,
	 * „Seite blockiert“ (Zustand kommt nicht zurück). Die letzten Aktionen landen in der Konsole.
	 */
	async function zufallsspieler({ dauer = 60000, saat = 1 }) {
		let a = saat >>> 0;
		const zufall = () => {   // mulberry32
			a = (a + 0x6d2b79f5) >>> 0;
			let t = Math.imul(a ^ (a >>> 15), 1 | a);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
		const eins = (liste) => liste[Math.floor(zufall() * liste.length)];
		const protokoll = [];
		const orte = new Map();
		const bis = Date.now() + dauer;
		let n = 0;
		let woVorher = '', gleich = 0;   // Aktionen am selben Ort: ab 40 strebt er nach draußen
		try {
			while (Date.now() < bis) {
				if (laufzeitfehler) throw laufzeitfehler;
				const z = await zustand();
				const wo = `${z.stadt}/${z.ort}/${z.dungeon}${z.kampf ? ' Kampf' : ''}${z.karte ? ' Karte' : ''}`;
				orte.set(wo, (orte.get(wo) || 0) + 1);
				gleich = wo === woVorher ? gleich + 1 : 0;
				woVorher = wo;
				const raus = gleich > 40 && zufall() < 0.5;
				let aktion;
				try {
				// Frist für die ganze Aktion: hängt das Spiel, warten auch DOM-Abfragen ewig
				await mitFrist((async () => {
				if (z.ov) {
					// Overlay: Eintrag wählen, Meldung weg, Zahl/Text eingeben oder abbrechen.
					// Nie das Spiel beenden (sonst ist der Lauf vorbei)
					const texte = await page.locator('#dialog .optionen button').allTextContents();
					const erlaubt = texte.map((t, i) => [t, i]).filter(([t]) => !/BEENDEN|VERLASSEN \/ LADEN/.test(t));   // beides beendet das Spiel (Kampf verlassen ohne Spielstand)
					const eingabe = await page.locator('#dialog input').isVisible();
					const r = zufall();
					const ausgang = erlaubt.filter(([t]) => /VERLASSEN|ZURÜCK|ABBRECHEN|NEIN|ENDE/.test(t));
					if (raus && ausgang.length) {
						const [t, i] = eins(ausgang);
						aktion = `wahl ${i + 1} „${t.trim()}“ (raus)`;
						await page.locator('#dialog .optionen button').nth(i).tap({ timeout: 2000 });
					} else if (eingabe) {
						const wert = String(Math.floor(zufall() * 20));
						aktion = `eingabe ${wert}`;
						await page.locator('#dialog input').fill(wert, { timeout: 2000 });
						await page.locator('#dialog .eingabe button').tap({ timeout: 2000 });
					} else if (erlaubt.length && r < 0.85) {
						const [t, i] = eins(erlaubt);
						aktion = `wahl ${i + 1} „${t.trim()}“`;
						await page.locator('#dialog .optionen button').nth(i).tap({ timeout: 2000 });
					} else if (await page.locator('#dialog .abbrechen').isVisible() && r < 0.95) {
						aktion = 'abbrechen';
						await page.locator('#dialog .abbrechen').tap({ timeout: 2000 });
					} else {
						aktion = 'weiter';
						await page.locator('#dialog .karte').tap({ timeout: 2000 });
					}
				} else {
					// Ausschnitte (Ansicht, Icons …) und Knöpfe der Steuerleiste, je nach Layout sichtbar
					const ziele = [];
					for (const el of await page.locator('canvas[aria-label]').all()) {
						if (await el.isVisible()) ziele.push(['ausschnitt', el]);
					}
					for (const el of await page.locator('#leiste button[data-key]').all()) {
						if (!(await el.isVisible())) continue;
						const taste = await el.getAttribute('data-key');
						if (['up', 'left', 'right', 'down'].includes(taste)) el._name = 'bewegung';
						if (taste === 'rechtsklick') el._zurueck = true;
						ziele.push(['knopf', el]);
					}
					// draußen öfter laufen; zu lange am selben Ort: Zurück (Rechtsklick)
					const laufen = ziele.filter(([art, el]) => art === 'knopf' && el._name === 'bewegung');
					if (!ziele.length) { aktion = 'warten'; await page.waitForTimeout(300); }
					else {
						let wahl = eins(ziele);
						const zurueck = ziele.find(([art, el]) => el._zurueck);
						if (raus && zurueck) wahl = zurueck;
						else if (z.ort == 0 && !z.kampf && !z.karte && laufen.length && zufall() < 0.5) wahl = eins(laufen);
						const [art, el] = wahl;
						const name = (await el.getAttribute('aria-label')) || (await el.textContent()).trim();
						if (art === 'knopf') {
							aktion = `knopf ${name}`;
							await el.tap({ timeout: 2000 });
						} else {
							const b = await el.boundingBox({ timeout: 2000 });
							if (!b) throw Object.assign(new Error('weg'), { name: 'TimeoutError' });   // gerade ausgeblendet
							const x = b.x + zufall() * b.width, y = b.y + zufall() * b.height;
							aktion = `tipp ${name} ${Math.round(x - b.x)},${Math.round(y - b.y)}`;
							await page.touchscreen.tap(x, y);
						}
					}
				}
				})(), 20000, 'Zufallsaktion');
				} catch (e) {
					// Ziel inzwischen verdeckt oder weg (Overlay ging gerade auf/zu): nächste Runde
					if (e.name !== 'TimeoutError') throw e;
					aktion += ' (verdeckt)';
				}
				protokoll.push(`${++n} [${wo}] ${aktion}`);
				await page.waitForTimeout(150 + zufall() * 350);
			}
		} catch (e) {
			konsole.push('[zufall] letzte Aktionen:\n' + protokoll.slice(-40).join('\n'));
			throw e;
		}
		konsole.push('[zufall] Aktionen:\n' + protokoll.join('\n'));
		konsole.push(`[zufall] ${n} Aktionen; Orte (stadt/ort/dungeon): ` + [...orte].map(([o, k]) => `${o}×${k}`).join(', '));
		console.log(`    ${n} Aktionen, Orte: ${[...orte.keys()].join(', ')}`);
	}

	const start = Date.now();
	let fehler = null;
	let nr = 0;
	const m = {};
	try {
		aktWurzel = sz.wurzel === 'frei' ? wurzel + '-frei' : wurzel;
		await page.goto('http://localhost:8080' + (sz.adresse ?? '/?ohneIntro'));
		for (const s of sz.schritte) {
			if (laufzeitfehler) throw laufzeitfehler;
			if (s.warte) await page.waitForTimeout(s.warte);
			// Fenstergröße ändern, etwa Querformat ([Breite, Höhe]; gilt bis zum Ende des Szenarios)
			if (s.groesse) { await page.setViewportSize({ width: s.groesse[0], height: s.groesse[1] }); await page.waitForTimeout(300); }
			if (s.tipp) { const [x, y] = await punkt(...s.tipp); await page.touchscreen.tap(x, y); await page.waitForTimeout(250); }
			// Antippen an einer Seitenposition, die ein Ausdruck in der Seite liefert ([x, y])
			if (s.tippBei) { const [x, y] = await page.evaluate(s.tippBei); await page.touchscreen.tap(x, y); await page.waitForTimeout(250); }
			if (s.ziehen) {
				// mit der Maus ziehen: [x1, y1, x2, y2] (Seitenkoordinaten) aus dem Ausdruck
				const [x1, y1, x2, y2] = await page.evaluate(s.ziehen);
				await page.mouse.move(x1, y1); await page.mouse.down();
				await page.mouse.move(x2, y2, { steps: 8 }); await page.mouse.up();
				await page.waitForTimeout(250);
			}
			if (s.doppeltipp) {
				const [x, y] = await punkt(...s.doppeltipp);
				await page.touchscreen.tap(x, y); await page.waitForTimeout(60); await page.touchscreen.tap(x, y);
				await page.waitForTimeout(250);
			}
			if (s.halten) {
				// Knopf drücken und nie loslassen (iOS Safari verliert das Loslassen bei Layoutwechsel)
				await knopf(s.halten).dispatchEvent('pointerdown', { pointerId: 77, pointerType: 'touch', isPrimary: true, bubbles: true });
				await page.waitForTimeout(250);
			}
			if (s.loslassen) {
				await knopf(s.loslassen).dispatchEvent('pointerup', { pointerId: 77, pointerType: 'touch', isPrimary: true, bubbles: true });
				await page.waitForTimeout(250);
			}
			// imGen: Schritt gilt dem Overlay der Heldenerschaffung (iframe)
			const ort = s.imGen ? page.frameLocator('#gen iframe') : page;
			if (s.genTipp) {
				// Tippen auf die Canvas der Heldenerschaffung, Spielkoordinaten 320x200
				const c = page.frameLocator('#gen iframe').locator('#canvas');
				const b = await c.boundingBox();
				// Maus statt Touch: SDL setzt Touch im Testbrowser nicht in Mausklicks um
				await page.mouse.click(b.x + (s.genTipp[0] + 0.5) / 320 * b.width, b.y + (s.genTipp[1] + 0.5) / 200 * b.height);
				await page.waitForTimeout(400);
			}
			if (s.genKnopfNr) { await page.frameLocator('#gen iframe').locator('#menueknoepfe button').nth(s.genKnopfNr - 1).tap(); await page.waitForTimeout(400); }
			if (s.genKnopf) { await page.frameLocator('#gen iframe').getByRole('button', { name: s.genKnopf, exact: true }).tap(); await page.waitForTimeout(400); }
			if (s.genWiederhole) {
				// solange die Frage im Overlay der Heldenerschaffung passt: Eintrag wählen
				const { solange, wahl, max = 30 } = s.genWiederhole;
				for (let i = 0; ; i++) {
					const z = await zustand();
					if (!z.gOv || !new RegExp(solange).test(z.gText)) break;
					if (i >= max) throw new Error(`genWiederhole: nach ${max} Runden noch „${z.gText}“`);
					await page.frameLocator('#gen iframe').locator('#dialog .optionen button').nth(wahl - 1).tap();
					await page.waitForTimeout(500);
				}
			}
			if (s.wahl !== undefined) {
				// Eintrag im Overlay: Nummer (1-basiert) oder Textteil
				const opt = ort.locator('#dialog .optionen button');
				await (typeof s.wahl === 'number' ? opt.nth(s.wahl - 1) : opt.filter({ hasText: s.wahl }).first()).tap();
				await page.waitForTimeout(250);
			}
			if (s.schnellwahl !== undefined) {
				await page.locator('#dialog .schnellwahl button').filter({ hasText: new RegExp(`^${s.schnellwahl}$`) }).tap();
				await page.waitForTimeout(250);
			}
			if (s.tippen !== undefined) {
				// echte Tastendrücke ins Feld (prüft, dass SDL sie nicht abfängt), dann Enter
				await ort.locator('#dialog input').tap();
				await page.keyboard.type(s.tippen, { delay: 40 });
				const wert = await ort.locator('#dialog input').inputValue();
				if (wert !== s.tippen) throw new Error(`Eingabefeld enthält „${wert}“ statt „${s.tippen}“ (Tasten abgefangen?)`);
				await page.keyboard.press('Enter');
				await page.waitForTimeout(250);
			}
			if (s.dateiWahl) {
				// Spieldaten-Import (daten.js): Datei(en) im versteckten Auswahlfeld setzen
				await page.locator('#spieldaten input[type=file]').setInputFiles(s.dateiWahl);
				await page.waitForTimeout(250);
			}
			if (s.exportiere) {
				// Spielstand über die Verwaltung herunterladen, nach build/regression/<datei>
				const zeile = page.locator('#verwaltung li').filter({ hasText: s.exportiere });
				const [dl] = await Promise.all([page.waitForEvent('download'), zeile.getByRole('button', { name: 'Exportieren' }).tap()]);
				await dl.saveAs(`${ausgabe}/${s.datei}`);
				if (fs.statSync(`${ausgabe}/${s.datei}`).size < 20 + 5952 + 286 * 4) throw new Error('Export zu klein');
			}
			if (s.importiere) {
				const [wahl] = await Promise.all([page.waitForEvent('filechooser'),
					page.locator('#verwaltung li').nth(s.importiere - 1).getByRole('button', { name: 'Importieren' }).tap()]);
				await wahl.setFiles(`${ausgabe}/${s.datei}`);
				await page.waitForEvent('load', { timeout: 10000 });   // Seite startet nach dem Import neu
			}
			if (s.offline !== undefined) { await ctx.setOffline(s.offline); }
			if (s.neuLaden) { await page.reload(); await page.waitForTimeout(500); }
			if (s.abbrechen) { await ort.locator('#dialog .abbrechen').tap(); await page.waitForTimeout(250); }
			if (s.weiter) { await ort.locator('#dialog .karte').tap(); await page.waitForTimeout(250); }
			if (s.eingabe !== undefined) {
				await page.locator('#dialog input').fill(s.eingabe);
				await page.locator('#dialog .eingabe button').tap();
				await page.waitForTimeout(250);
			}
			if (s.zufall) await zufallsspieler(s.zufall);
			if (s.knopf) { await knopf(s.knopf).tap(); await page.waitForTimeout(250); }
			if (s.schnell) { for (const k of s.schnell) await knopf(k).tap(); }
			if (s.taste) { await page.keyboard.press(s.taste); await page.waitForTimeout(250); }
			if (s.js) await mitFrist(page.evaluate(s.js), 5000, s.js);
			if (s.merke) m[s.merke] = await zustand();
			if (s.warteAuf) {
				const bis = Date.now() + (s.max || 5000);
				let z;
				for (;;) {
					if (laufzeitfehler) throw laufzeitfehler;
					// seite: Ausdruck in der Seite auswerten (z. B. FS, DOM), sonst über den Spielzustand
					z = s.seite ? await mitFrist(page.evaluate(`(() => { try { return !!(${s.warteAuf}); } catch (e) { return false; } })()`), 5000, s.warteAuf)
						: await zustand();
					if (s.seite ? z : bewerte(s.warteAuf, z, m)) break;
					if (Date.now() > bis) throw new Error(`Zeitüberschreitung: ${s.warteAuf}\n  Zustand: ${JSON.stringify(z)}`);
					await page.waitForTimeout(150);
				}
			}
			if (s.erwarte) {
				const z = await zustand();
				if (!bewerte(s.erwarte, z, m)) {
					throw new Error(`Erwartung verfehlt: ${s.text || s.erwarte}\n  ${s.erwarte}\n  Zustand: ${JSON.stringify(z)}\n  Gemerkt: ${JSON.stringify(m)}`);
				}
			}
			if (s.bild) {
				nr++;
				await mitFrist(page.screenshot({ path: `${ausgabe}/${kurz}-${nr}-${s.bild}.png` }), 8000, 'Screenshot');
			}
		}
		if (laufzeitfehler) throw laufzeitfehler;
	} catch (e) {
		fehler = e;
		// Hänger: Seite über DevTools anhalten und den Aufrufstapel festhalten (nur Chromium)
		if (/Seite blockiert/.test(e.message) && process.env.BROWSER !== 'webkit') {
			fs.writeFileSync(`${ausgabe}/${kurz}-konsole.txt`, konsole.join('\n'));
			try {
				if (!cdp) throw new Error('Debugger nur bei langen Läufen verbunden');
				// mehrmals anhalten: die Positionen zeigen, wo die Schleife kreist
				const proben = [];
				for (let k = 0; k < 8; k++) {
					const angehalten = new Promise((ja) => cdp.once('Debugger.paused', ja));
					await mitFrist(cdp.send('Debugger.pause'), 10000, 'Debugger.pause');
					const p = await mitFrist(angehalten, 10000, 'Debugger');
					proben.push(p.callFrames.filter((f) => f.url.endsWith('.wasm') || f.functionName.startsWith('$'))
						.map((f) => `${f.functionName}@${f.location.columnNumber}`).join(' ← '));
					await cdp.send('Debugger.resume').catch(() => {});
					await new Promise((r) => setTimeout(r, 150));
				}
				konsole.push('[hänger] Proben (Funktion@WASM-Offset):\n' + proben.map((x) => '  ' + x).join('\n'));
				fehler.message += '\n    Proben: ' + [...new Set(proben)].join(' | ');
			} catch (x) { konsole.push(`[hänger] kein Stapel: ${x.message}`); }
		}
		if (!/Seite blockiert/.test(e.message)) await page.screenshot({ path: `${ausgabe}/${kurz}-FEHLER.png`, timeout: 5000 }).catch(() => {});
	}
	fs.writeFileSync(`${ausgabe}/${kurz}-konsole.txt`, konsole.join('\n'));
	const dauer = ((Date.now() - start) / 1000).toFixed(0);
	ergebnisse.push({ name: sz.name, ok: !fehler, dauer, fehler });
	console.log(`${fehler ? '✗' : '✓'} ${sz.name} (${dauer} s)${fehler ? '\n    ' + String(fehler.message).replace(/\n/g, '\n    ') : ''}`);
	await mitFrist(ctx.close(), 10000, 'Kontext schließen').catch(() => {});
}

await mitFrist(browser.close(), 10000, "Browser schließen").catch(() => {});
server.close();
const gescheitert = ergebnisse.filter((e) => !e.ok).length;
console.log(`\n${ergebnisse.length - gescheitert}/${ergebnisse.length} Szenarien bestanden`);
process.exit(gescheitert ? 1 : 0);
