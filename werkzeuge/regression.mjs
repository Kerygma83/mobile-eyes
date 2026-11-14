// Führt die Szenarien aus werkzeuge/szenarien.mjs im Browser aus (Playwright, Handy-Ansicht).
// Aufruf im Playwright-Container:  node regression.mjs [namensfilter]
// Ergebnis: Exit-Code 0/1, Screenshots und Konsole je Szenario in build/regression/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
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

const browser = await chromium.launch();
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
		page.evaluate(() => (typeof Module !== 'undefined' && Module.calledRun)
			? Module.UTF8ToString(Module._web_test_state()) : '{}'), 5000, 'Zustand abfragen'));
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
