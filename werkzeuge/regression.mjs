// Führt die Szenarien aus werkzeuge/szenarien.mjs im Browser aus (Playwright, Handy-Ansicht).
// Aufruf im Playwright-Container:  node regression.mjs [namensfilter]
// Ergebnis: Exit-Code 0/1, Screenshots und Konsole je Szenario in build/regression/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
import { szenarien } from './szenarien.mjs';

const wurzel = process.env.WURZEL || '/app/build/web-test';
const ausgabe = '/app/build/regression';
const filter = process.argv[2] || '';
fs.rmSync(ausgabe, { recursive: true, force: true });
fs.mkdirSync(ausgabe, { recursive: true });

const typen = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.data': 'application/octet-stream', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
	const datei = path.join(wurzel, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
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

for (const sz of szenarien.filter((s) => s.name.toLowerCase().includes(filter.toLowerCase()))) {
	const kurz = sz.name.replace(/[^A-Za-z0-9äöüÄÖÜß]+/g, '-').toLowerCase();
	const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
	const page = await ctx.newPage();
	const konsole = [];
	let laufzeitfehler = null;
	page.on('console', (m) => konsole.push(`[${m.type()}] ${m.text()}`));
	page.on('dialog', (d) => d.accept());   // Rückfragen (confirm) bestätigen
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
			const gd = !gen.hidden && gen.querySelector('iframe').contentDocument?.getElementById('dialog');
			z.gOv = gd && !gd.hidden ? 1 : 0;
			z.gText = z.gOv ? gd.querySelector('.text').textContent : '';
			z.gN = z.gOv ? gd.querySelectorAll('.optionen button').length : 0;
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
			const g = ganz.getContext('2d').getImageData(0, 0, 240, 136).data;
			let gleich = 1;
			for (let i = 0; i < a.length; i++) if (a[i] !== g[i]) { gleich = 0; break; }
			z.ansichtAktuell = gleich;
			// Anteil rein schwarzer Pixel in der Ansicht (aktuelles Spielbild), in Prozent
			let schwarz = 0;
			for (let i = 0; i < g.length; i += 4) if (!g[i] && !g[i + 1] && !g[i + 2]) schwarz++;
			z.schwarz = Math.round(schwarz / (240 * 136) * 100);
			// weiße Pixel (Farbe des Mauszeigers) um die letzte Tippstelle in den Icons (306,124)
			const um = ganz.getContext('2d').getImageData(296, 114, 24, 24).data;
			let weiss = 0;
			for (let i = 0; i < um.length; i += 4) if (um[i] >= 235 && um[i + 1] >= 235 && um[i + 2] >= 235) weiss++;   // Zeiger: Farbe 0xff = 240,240,240
			z.zeiger = weiss;
			return JSON.stringify(z);
		}), 5000, 'Zustand abfragen'));
	const bewerte = (ausdruck, z, m) => Function('z', 'm', `return (${ausdruck});`)(z, m);
	async function punkt(label, gx, gy) {
		const el = page.locator(`canvas[aria-label="${label}"]`);
		const [ax, ay, aw, ah] = (await el.getAttribute('data-aus')).split(',').map(Number);
		const b = await el.boundingBox();
		if (!b) throw new Error(`Ausschnitt „${label}“ ist nicht sichtbar`);
		return [b.x + (gx - ax + 0.5) / aw * b.width, b.y + (gy - ay + 0.5) / ah * b.height];
	}
	const knopf = (name) => page.getByRole('button', { name, exact: true });

	const start = Date.now();
	let fehler = null;
	let nr = 0;
	const m = {};
	try {
		await page.goto('http://localhost:8080' + (sz.adresse ?? '/?ohneIntro'));
		for (const s of sz.schritte) {
			if (laufzeitfehler) throw laufzeitfehler;
			if (s.warte) await page.waitForTimeout(s.warte);
			if (s.tipp) { const [x, y] = await punkt(...s.tipp); await page.touchscreen.tap(x, y); await page.waitForTimeout(250); }
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
		await page.screenshot({ path: `${ausgabe}/${kurz}-FEHLER.png`, timeout: 5000 }).catch(() => {});
	}
	fs.writeFileSync(`${ausgabe}/${kurz}-konsole.txt`, konsole.join('\n'));
	const dauer = ((Date.now() - start) / 1000).toFixed(0);
	ergebnisse.push({ name: sz.name, ok: !fehler, dauer, fehler });
	console.log(`${fehler ? '✗' : '✓'} ${sz.name} (${dauer} s)${fehler ? '\n    ' + String(fehler.message).replace(/\n/g, '\n    ') : ''}`);
	await ctx.close();
}

await browser.close();
server.close();
const gescheitert = ergebnisse.filter((e) => !e.ok).length;
console.log(`\n${ergebnisse.length - gescheitert}/${ergebnisse.length} Szenarien bestanden`);
process.exit(gescheitert ? 1 : 0);
