// Startet build/web in headless Chromium und spielt eine Schrittfolge ab.
// Aufruf (im Playwright-Container): node browsertest.mjs '<json-schritte>'
// Schritte: {"warte":ms} {"klick":[x,y]} (Spielkoordinaten 320x200) {"rechts":[x,y]}
//           {"taste":"Enter"} {"bild":"name"}
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const wurzel = process.env.WURZEL || '/app/build/web';   // z. B. /app/build/web-test
const ausgabe = '/app/build/screens';
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

const schritte = JSON.parse(process.argv[2] || '[{"warte":2000},{"bild":"start"}]');
const logdatei = `${ausgabe}/konsole.txt`;
const log = (z) => fs.appendFileSync(logdatei, z + '\n');

const browser = await chromium.launch();
const mobil = process.env.MOBIL === '1';
const page = await browser.newPage(mobil
	? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
	: { viewport: { width: 1300, height: 900 } });
page.on('console', (m) => { if (!/WEATHER/.test(m.text())) log(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => log(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto('http://localhost:8080/' + (process.env.SEITE || ''));   // z. B. gen.html?intro
await page.waitForTimeout(6000); // Start bis Tempel

const canvas = page.locator('canvas');
async function punkt([x, y]) {
	const box = await canvas.boundingBox();
	return [box.x + (x + 0.5) * box.width / 320, box.y + (y + 0.5) * box.height / 200];
}
let nr = 0;
let cdp = null;
for (const s of schritte) {
	if (s.warte) await page.waitForTimeout(s.warte);
	if (s.klick || s.rechts) {
		const [px, py] = await punkt(s.klick || s.rechts);
		await page.mouse.move(px, py);
		await page.waitForTimeout(150);
		await page.mouse.down({ button: s.rechts ? 'right' : 'left' });
		await page.waitForTimeout(80);
		await page.mouse.up({ button: s.rechts ? 'right' : 'left' });
		await page.waitForTimeout(700);
		log(`[test] ${s.rechts ? 'rechts' : 'klick'} ${s.klick || s.rechts}`);
	}
	if (s.tipp) {
		const [px, py] = await punkt(s.tipp);
		await page.touchscreen.tap(px, py);
		await page.waitForTimeout(700);
		log(`[test] tipp ${s.tipp}`);
	}
	if (s.doppeltipp) {
		const [px, py] = await punkt(s.doppeltipp);
		await page.touchscreen.tap(px, py);
		await page.waitForTimeout(60);
		await page.touchscreen.tap(px, py);
		await page.waitForTimeout(1200);
		log(`[test] doppeltipp ${s.doppeltipp}`);
	}
	if (s.js) {
		const ergebnis = await page.evaluate(s.js);
		if (ergebnis !== undefined) log(`[test] → ${JSON.stringify(ergebnis)}`);
		await page.waitForTimeout(500);
		log(`[test] js ${s.js}`);
	}
	if (s.tippAus) {
		// [aria-label des Ausschnitts, x, y] in Spielkoordinaten
		const [label, gx, gy] = s.tippAus;
		const el = page.locator(`canvas[aria-label="${label}"]`);
		const [ax, ay, aw, ah] = (await el.getAttribute('data-aus')).split(',').map(Number);
		const b = await el.boundingBox();
		await page.touchscreen.tap(b.x + (gx - ax + 0.5) / aw * b.width, b.y + (gy - ay + 0.5) / ah * b.height);
		await page.waitForTimeout(700);
		log(`[test] tippAus ${label} ${gx},${gy}`);
	}
	if (s.knopf) {
		await page.getByRole('button', { name: s.knopf, exact: true }).tap();
		await page.waitForTimeout(700);
		log(`[test] knopf ${s.knopf}`);
	}
	if (s.schnell) {
		// mehrere Knöpfe ohne Pause antippen (prüft die Reihenfolge)
		for (const k of s.schnell) await page.getByRole('button', { name: k, exact: true }).tap();
		await page.waitForTimeout(1200);
		log(`[test] schnell ${s.schnell.join(', ')}`);
	}
	if (s.seite) {
		nr++;
		const name = `${String(nr).padStart(2, '0')}-${s.seite}.png`;
		await page.screenshot({ path: `${ausgabe}/${name}`, timeout: 5000 }).then(() => log(`[test] seite ${name}`));
	}
	if (s.profil === 'start') {
		cdp = await page.context().newCDPSession(page);
		await cdp.send('Profiler.enable');
		await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
		await cdp.send('Profiler.start');
		log('[test] profil start');
	}
	if (s.profil === 'stop' && cdp) {
		const { profile } = await cdp.send('Profiler.stop');
		fs.writeFileSync(`${ausgabe}/profil.cpuprofile`, JSON.stringify(profile));
		log('[test] profil gespeichert');
	}
	if (s.taste) { await page.keyboard.press(s.taste); await page.waitForTimeout(500); log(`[test] taste ${s.taste}`); }
	if (s.bild) {
		nr++;
		const name = `${String(nr).padStart(2, '0')}-${s.bild}.png`;
		await canvas.screenshot({ path: `${ausgabe}/${name}`, timeout: 5000 })
			.then(() => log(`[test] bild ${name}`))
			.catch(() => log(`[test] bild ${name}: Seite blockiert`));
	}
}
await browser.close();
server.close();
