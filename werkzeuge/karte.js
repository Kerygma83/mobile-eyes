// Reisekarte im mobilen Layout: zoom- und verschiebbar, mit Orts- und Gebietsnamen,
// Reiseziele am Wegweiser als Knöpfe unter der Karte.
//
// Das Spiel (BrightEyes reisekarte.cpp, seg093) liefert:
//   web_karte()        {m: 1 Karte sichtbar, x, y Gruppe, reise, ziel, wahl: [Orts-IDs wie im Menü], zurueck: hex}
//   web_karte_namen()  {orte: [[id, x, y, hex]], gebiete: [[id, x, y, hex]]} (null, solange MAPTEXT fehlt)
//   web_reise_wahl(n)  Eintrag n des Wegweiser-Menüs wählen
// Antippen ohne Ziehen geht als Klick an das Spiel (Ortsbeschreibung wie im Original).
//
// Aufruf: const karte = karteEinrichten(Module, { el, spielText, quelle, dialogOffen });
//         karte.pruefen() → true, wenn die Reisekarte zu sehen ist (bei jedem Bild aufrufen)
//         karte.zeichnen() nach dem Bild: Karte übernehmen, Ansicht und Knöpfe aktualisieren
//         karte.zustand() für Tests
'use strict';

const KARTE_TEXTE = {
	ziele: 'Reiseziele',
	unterwegs: (ziel) => ziel ? `Unterwegs nach ${ziel}` : 'Unterwegs',
	rast: 'Rast oder Gewaltmarsch …',
};

function karteEinrichten(Module, optionen) {
	const el = optionen.el;
	const flaeche = el.querySelector('.flaeche');
	const inhalt = el.querySelector('.inhalt');
	const canvas = inhalt.querySelector('canvas');
	const ctx = canvas.getContext('2d');
	const namenEl = inhalt.querySelector('.namen');
	const zieleEl = el.querySelector('.ziele');
	const PIXEL_HOEHE = 1.2;   // DOS-Pixel sind 1,2-mal so hoch wie breit

	const hexText = (hex) => {
		const b = [];
		for (let i = 0; i + 1 < hex.length; i += 2) b.push(parseInt(hex.slice(i, i + 2), 16));
		return optionen.spielText ? optionen.spielText(b) : String.fromCharCode(...b);
	};

	let zustand = { m: 0 };
	let namen = null;          // {orte: Map(id → {x, y, name, el}), gebiete: [...]}
	let aktiv = false;
	let s = 1, ox = 0, oy = 0; // Maßstab (CSS-Pixel je Kartenpixel in x) und Verschiebung
	let zuletztBedient = 0;    // Zeitpunkt der letzten Geste: so lange folgt die Ansicht nicht der Gruppe
	let wahlSchluessel = '';
	let einpassen = false;   // beim nächsten Zeichnen auf die Fläche einpassen

	function json(f) {
		try { const t = Module[f]?.(); return t ? JSON.parse(Module.UTF8ToString(t)) : null; } catch (e) { return null; }
	}

	// ---------- Ansicht ----------
	const groesse = () => ({ w: flaeche.clientWidth, h: flaeche.clientHeight });
	function grenzen() {
		const { w, h } = groesse();
		const ganz = Math.min(w / 320, h / (200 * PIXEL_HOEHE));
		return { min: ganz, max: Math.max(ganz * 8, 6), fuellen: Math.max(w / 320, h / (200 * PIXEL_HOEHE)) };
	}
	function begrenzen() {
		const { w, h } = groesse();
		const g = grenzen();
		s = Math.min(g.max, Math.max(g.min, s));
		const bw = 320 * s, bh = 200 * PIXEL_HOEHE * s;
		ox = bw <= w ? (w - bw) / 2 : Math.min(0, Math.max(w - bw, ox));
		oy = bh <= h ? (h - bh) / 2 : Math.min(0, Math.max(h - bh, oy));
	}
	let alterMassstab = 0;
	function anwenden() {
		begrenzen();
		inhalt.style.transform = `translate(${ox}px, ${oy}px)`;
		if (s !== alterMassstab) {
			alterMassstab = s;
			canvas.style.width = `${320 * s}px`;
			canvas.style.height = `${200 * PIXEL_HOEHE * s}px`;
			namenSetzen();
		}
	}
	function zentrieren(x, y) {
		const { w, h } = groesse();
		ox = w / 2 - x * s;
		oy = h / 2 - y * PIXEL_HOEHE * s;
	}
	/** Maßstab ändern, der Punkt (px, py) in der Fläche bleibt stehen */
	function zoomUm(neu, px, py) {
		const kx = (px - ox) / s, ky = (py - oy) / s;
		s = neu;
		const g = grenzen();
		s = Math.min(g.max, Math.max(g.min, s));
		ox = px - kx * s; oy = py - ky * s;
		anwenden();
	}

	// ---------- Namen ----------
	function namenLaden() {
		const n = json('_web_karte_namen');
		if (!n) return;
		namen = { orte: new Map(), gebiete: [] };
		namenEl.textContent = '';
		for (const [id, x, y, hex] of n.orte) {
			const d = document.createElement('div');
			d.className = 'ort';
			d.dataset.ort = id;
			d.dataset.pos = `${x},${y}`;
			d.textContent = hexText(hex);
			namenEl.append(d);
			namen.orte.set(id, { x, y, name: d.textContent, el: d });
		}
		for (const [id, x, y, hex] of n.gebiete) {
			if (!hex) continue;
			const d = document.createElement('div');
			d.className = 'gebiet';
			d.dataset.gebiet = id;
			d.textContent = hexText(hex);
			namenEl.append(d);
			namen.gebiete.push({ x, y, name: d.textContent, el: d });
		}
		alterMassstab = 0;
		anwenden();
	}
	function namenSetzen() {
		if (!namen) return;
		for (const o of namen.orte.values()) {
			o.el.style.left = `${(o.x + 3) * s}px`;
			o.el.style.top = `${o.y * PIXEL_HOEHE * s}px`;
		}
		for (const g of namen.gebiete) {
			g.el.style.left = `${g.x * s}px`;
			g.el.style.top = `${g.y * PIXEL_HOEHE * s}px`;
		}
	}

	// ---------- Ziele ----------
	function zieleSetzen() {
		const z = zustand;
		const schluessel = JSON.stringify([z.wahl, z.reise, z.ziel, !!namen]);
		if (schluessel === wahlSchluessel) return;
		wahlSchluessel = schluessel;
		zieleEl.textContent = '';
		const ortName = (id) => namen?.orte.get(id)?.name ?? `Ort ${id}`;
		if (namen) for (const o of namen.orte.values()) o.el.classList.toggle('ziel', false);
		if (z.wahl?.length) {
			const h = document.createElement('h3');
			h.textContent = KARTE_TEXTE.ziele;
			zieleEl.append(h);
			const liste = document.createElement('div');
			liste.className = 'knoepfe';
			z.wahl.forEach((id, i) => {
				const letzter = i === z.wahl.length - 1;
				const b = document.createElement('button');
				b.type = 'button';
				b.textContent = letzter && z.zurueck ? hexText(z.zurueck) : ortName(id);
				if (letzter) b.classList.add('zurueck');
				else namen?.orte.get(id)?.el.classList.add('ziel');
				b.addEventListener('click', () => {
					if (optionen.dialogOffen?.()) return;
					Module._web_reise_wahl?.(i + 1);
				});
				liste.append(b);
			});
			zieleEl.append(liste);
		} else if (z.reise) {
			const p = document.createElement('p');
			p.textContent = KARTE_TEXTE.unterwegs(z.ziel ? ortName(z.ziel) : '');
			if (z.ziel) namen?.orte.get(z.ziel)?.el.classList.add('ziel');
			const b = document.createElement('button');
			b.type = 'button';
			b.textContent = KARTE_TEXTE.rast;
			b.addEventListener('click', () => { if (!optionen.dialogOffen?.()) Module._web_right_click?.(); });
			zieleEl.append(p, b);
		}
	}

	// ---------- Gesten ----------
	const zeiger = new Map();
	let geste = null;   // {art: 'tipp'|'ziehen'|'zoom', ...}
	const punktIn = (e) => { const r = flaeche.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
	function gesteStarten() {
		const p = [...zeiger.values()];
		if (p.length === 1) {
			geste = { art: geste?.art === 'zoom' ? 'zoom-ende' : 'tipp', start: { ...p[0] }, ox, oy };
		} else if (p.length >= 2) {
			const [a, b] = p;
			geste = { art: 'zoom', d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s,
				kx: ((a.x + b.x) / 2 - ox) / s, ky: ((a.y + b.y) / 2 - oy) / s };
		}
	}
	flaeche.addEventListener('pointerdown', (e) => {
		// Knöpfe (+/−) liegen auf der Karte: ihr Tippen ist keine Geste, sonst klickt es auch den Ort dahinter
		if (e.target.closest('button')) return;
		e.preventDefault();
		flaeche.setPointerCapture?.(e.pointerId);
		zeiger.set(e.pointerId, punktIn(e));
		gesteStarten();
	});
	flaeche.addEventListener('pointermove', (e) => {
		if (!zeiger.has(e.pointerId) || !geste) return;
		zeiger.set(e.pointerId, punktIn(e));
		const p = [...zeiger.values()];
		if (geste.art === 'zoom' && p.length >= 2) {
			const [a, b] = p;
			const g = grenzen();
			s = Math.min(g.max, Math.max(g.min, geste.s * Math.hypot(a.x - b.x, a.y - b.y) / geste.d));
			ox = (a.x + b.x) / 2 - geste.kx * s;
			oy = (a.y + b.y) / 2 - geste.ky * s;
			zuletztBedient = Date.now();
			anwenden();
		} else if (p.length === 1 && geste.art !== 'zoom') {
			const dx = p[0].x - geste.start.x, dy = p[0].y - geste.start.y;
			if (geste.art === 'tipp' && Math.hypot(dx, dy) > 8) geste.art = 'ziehen';
			if (geste.art === 'ziehen' || geste.art === 'zoom-ende') {
				ox = geste.ox + dx; oy = geste.oy + dy;
				zuletztBedient = Date.now();
				anwenden();
			}
		}
	});
	function loslassen(e, abgebrochen) {
		if (!zeiger.has(e.pointerId)) return;
		const p = zeiger.get(e.pointerId);
		zeiger.delete(e.pointerId);
		if (!abgebrochen && zeiger.size === 0 && geste?.art === 'tipp') {
			const x = Math.floor((p.x - ox) / s), y = Math.floor((p.y - oy) / (s * PIXEL_HOEHE));
			if (x >= 0 && x < 320 && y >= 0 && y < 200) Module._web_click?.(x, y, e.button === 2 ? 3 : 1);
		}
		if (zeiger.size === 0) geste = null;
		else gesteStarten();
	}
	flaeche.addEventListener('pointerup', (e) => loslassen(e, false));
	flaeche.addEventListener('pointercancel', (e) => loslassen(e, true));
	flaeche.addEventListener('contextmenu', (e) => e.preventDefault());
	flaeche.addEventListener('wheel', (e) => {
		e.preventDefault();
		const p = punktIn(e);
		zuletztBedient = Date.now();
		zoomUm(s * Math.exp(-e.deltaY * 0.002), p.x, p.y);
	}, { passive: false });
	for (const b of el.querySelectorAll('button[data-zoom]')) {
		b.addEventListener('click', () => {
			const { w, h } = groesse();
			zuletztBedient = Date.now();
			zoomUm(s * (b.dataset.zoom === '+' ? 1.5 : 1 / 1.5), w / 2, h / 2);
		});
	}
	new ResizeObserver(() => { if (aktiv) anwenden(); }).observe(flaeche);

	// ---------- Ablauf ----------
	function pruefen() {
		const z = json('_web_karte');
		const war = aktiv;
		aktiv = !!(z && z.m === 1);
		if (aktiv) zustand = z;
		if (aktiv && !war) einpassen = true;   // erst in zeichnen(): dann ist die Fläche eingeblendet
		return aktiv;
	}
	function zeichnen() {
		if (!aktiv) return;
		ctx.drawImage(optionen.quelle(), 0, 0);
		if (!namen) namenLaden();
		if (einpassen && flaeche.clientHeight > 0) {
			// beim Öffnen: Fläche ausfüllen, Gruppe in die Mitte
			einpassen = false;
			s = grenzen().fuellen;
			alterMassstab = 0;
			if (zustand.x >= 0) zentrieren(zustand.x, zustand.y);
			anwenden();
			zuletztBedient = 0;
		}
		// der Gruppe folgen, wenn sie den mittleren Bereich verlässt (nicht direkt nach einer Geste)
		const z = zustand;
		if (z.x >= 0 && Date.now() - zuletztBedient > 4000) {
			const { w, h } = groesse();
			const px = ox + z.x * s, py = oy + z.y * PIXEL_HOEHE * s;
			if (px < w * 0.2 || px > w * 0.8 || py < h * 0.2 || py > h * 0.8) { zentrieren(z.x, z.y); anwenden(); }
		}
		zieleSetzen();
	}

	return {
		pruefen, zeichnen,
		aktiv: () => aktiv,
		zustand: () => ({ ...zustand, s, ox, oy, namen: namen ? namen.orte.size + namen.gebiete.length : 0 }),
		// für Tests: Kartenpunkt → Bildschirmpunkt
		punkt: (x, y) => { const r = flaeche.getBoundingClientRect(); return [r.left + ox + (x + 0.5) * s, r.top + oy + (y + 0.5) * PIXEL_HOEHE * s]; },
	};
}
