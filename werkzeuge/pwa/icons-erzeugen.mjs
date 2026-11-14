// Erzeugt die PNG-Icons aus icon.svg (im Playwright-Container):
//   werkzeuge/pwa/icons.sh
import fs from 'node:fs';
import { chromium } from 'playwright';

const svg = fs.readFileSync('/app/werkzeuge/pwa/icon.svg', 'utf8');
const browser = await chromium.launch();
for (const groesse of [180, 192, 512]) {
	const page = await browser.newPage({ viewport: { width: groesse, height: groesse } });
	await page.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${groesse}" height="${groesse}" `)}</body></html>`);
	await page.screenshot({ path: `/app/werkzeuge/pwa/icon-${groesse}.png` });
	await page.close();
}
await browser.close();
