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

const typen = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.data': 'application/octet-stream' };
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
			// Ansicht zeigt dasselbe wie das aktuelle Spielbild? (0 = festgehalten, z. B. ohne die Box des Spiels)
			const ans = document.querySelector('canvas[aria-label="Ansicht"]');
			const a = ans.getContext('2d').getImageData(0, 0, 240, 136).data;
			const g = ganz.getContext('2d').getImageData(0, 0, 240, 136).data;
			let gleich = 1;
			for (let i = 0; i < a.length; i++) if (a[i] !== g[i]) { gleich = 0; break; }
			z.ansichtAktuell = gleich;
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
		await page.goto('http://localhost:8080/');
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
			if (s.wahl !== undefined) {
				// Eintrag im Overlay: Nummer (1-basiert) oder Textteil
				const opt = page.locator('#dialog .optionen button');
				await (typeof s.wahl === 'number' ? opt.nth(s.wahl - 1) : opt.filter({ hasText: s.wahl }).first()).tap();
				await page.waitForTimeout(250);
			}
			if (s.schnellwahl !== undefined) {
				await page.locator('#dialog .schnellwahl button').filter({ hasText: new RegExp(`^${s.schnellwahl}$`) }).tap();
				await page.waitForTimeout(250);
			}
			if (s.tippen !== undefined) {
				// echte Tastendrücke ins Feld (prüft, dass SDL sie nicht abfängt), dann Enter
				await page.locator('#dialog input').tap();
				await page.keyboard.type(s.tippen, { delay: 40 });
				const wert = await page.locator('#dialog input').inputValue();
				if (wert !== s.tippen) throw new Error(`Eingabefeld enthält „${wert}“ statt „${s.tippen}“ (Tasten abgefangen?)`);
				await page.keyboard.press('Enter');
				await page.waitForTimeout(250);
			}
			if (s.abbrechen) { await page.locator('#dialog .abbrechen').tap(); await page.waitForTimeout(250); }
			if (s.weiter) { await page.locator('#dialog .karte').tap(); await page.waitForTimeout(250); }
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
					z = await zustand();
					if (bewerte(s.warteAuf, z, m)) break;
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
