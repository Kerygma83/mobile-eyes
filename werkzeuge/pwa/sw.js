// Service Worker: alle Dateien der App offline vorhalten.
// VERSION und DATEIEN setzt werkzeuge/web-bauen.sh beim Bauen ein (Prüfsumme der Dateien);
// jeder neue Build ist damit ein Update. Spielstände liegen in IndexedDB und bleiben erhalten.
const VERSION = '__VERSION__';
const DATEIEN = __DATEIEN__;
const CACHE = 'schick-' + VERSION;

self.addEventListener('install', (e) => {
	// alles laden; erst danach gilt die neue Version als bereit (wartet auf „Jetzt laden“)
	e.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN.map((d) => new Request(d, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
	e.waitUntil((async () => {
		for (const name of await caches.keys()) {
			if (name.startsWith('schick-') && name !== CACHE) await caches.delete(name);
		}
		await self.clients.claim();
	})());
});

// Seite: „Jetzt laden“ → neue Version sofort übernehmen
self.addEventListener('message', (e) => {
	if (e.data === 'jetzt-aktualisieren') self.skipWaiting();
});

// Musik (musik/TrackNN.m4a, je einige MB) nicht vorab laden, sondern beim ersten Abspielen
// dauerhaft ablegen; eigener Cache, der Updates der App übersteht
const MUSIK = 'mobile-eyes-musik';

self.addEventListener('fetch', (e) => {
	if (e.request.method !== 'GET') return;
	const url = new URL(e.request.url);
	if (url.origin !== location.origin) return;
	if (url.pathname.includes('/musik/')) {
		e.respondWith(caches.open(MUSIK).then(async (c) => {
			const vorhanden = await c.match(e.request);
			if (vorhanden) return vorhanden;
			const antwort = await fetch(e.request);
			if (antwort.ok && antwort.status === 200) c.put(e.request, antwort.clone());
			return antwort;
		}));
		return;
	}
	// aus dem Cache (Parameter wie gen.html?intro ignorieren), sonst aus dem Netz
	e.respondWith(caches.open(CACHE).then(async (c) =>
		(await c.match(e.request, { ignoreSearch: true })) || fetch(e.request)));
});
