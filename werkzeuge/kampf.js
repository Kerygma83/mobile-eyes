// Kampfbildschirm im mobilen Hochformat (mit Aktionsknöpfen): Kampffeld zoom- und verschiebbar,
// darunter die Gruppe und ein Bedienfeld, das sich nach der Lage richtet:
//   - Kampfmenü des Spiels (seg033) als Knöpfe in Gruppen, mit BP-Kosten
//   - Auswahllisten (Waffe, Gegenstand, Zauber) als Liste
//   - Ziel- und Bewegungswahl (seg034): schräge Pfeile (die Achsen des Felds), Bestätigen, Abbrechen
//   - sonst (Gegner am Zug, Computerkampf): die letzten Würfe und das Kampftempo
//
// Das Spiel (BrightEyes kampf.cpp) liefert:
//   web_kampf()          {k, auto, p (2 Ziel, 3 Bewegen), held, a: [x, y, gegner, id], m: [x, y], problem,
//                         kosten, bp, wdh, zauber, fern, waffeWarn, lastWarn, ziel, wer, liste, helden}
//   web_kampf_tipp(x, y) bei Ziel-/Bewegungswahl: Zeiger setzen (die Markierung folgt), auf der
//                         Markierung bestätigen
// Kampfmenü und Listen melden sich als Box mit d.kampf (1 Menü, 2 Gegenstände); die Seite übernimmt
// sie statt des Overlays (dialog.js uebernehmen) und wählt mit web_menu_select wie das Overlay.
//
// Aufruf: const kampf = kampfEinrichten(Module, { el, bedienEl, quelle, spielText, dialoge, wurfLog,
//             tempo: { lies, setze }, bild: (id) => ImageData|undefined, layoutPasst });
//         kampf.pruefen() → true, wenn der Kampf so zu zeigen ist (bei jedem Bild)
//         kampf.zeichnen() nach dem Bild; kampf.uebernehmen(d) für dialog.js; kampf.zustand() für Tests
'use strict';

const KAMPF_TEXTE = {
	amZug: (n) => `${n} ist am Zug`,
	computer: (n) => `${n} (Computerkampf)`,
	bp: (n) => `${n} BP`,
	kampf: 'Kampf', ausruestung: 'Ausrüstung',
	tempo: 'Kampftempo',
	verlaufLeer: 'Noch keine Würfe in diesem Kampf',
	ziel: 'Ziel wählen', bewegen: 'Bewegen',
	zielKosten: (k, rest) => `Kostet ${k} BP, danach bleiben ${rest}`,
	weg: { '-1': 'Feld antippen oder mit den Pfeilen wählen', 1: 'Flucht vom Kampffeld', 2: 'Zu weit für die BP', 3: 'Feld ist besetzt', 4: 'Kein Weg dorthin' },
	felder: (n) => n === 1 ? '1 Feld' : `${n} Felder`,
	hinweis: 'Feld antippen markiert · zweites Tippen bestätigt',
	abbrechen: 'Abbrechen',
	mehr: 'Weitere Befehle',
};

// Einträge des Kampfmenüs (Nummer = Eintrag im Menü des Spiels = FIG_ACTION_*), Kosten in BP
const KAMPF_BEFEHLE = {
	1: { t: 'Bewegen', bp: 1, k: '1 BP je Feld' },
	2: { t: 'Angriff', fern: 'Schießen', bp: 3 },
	3: { t: 'Sichern', bp: 3 },
	4: { t: 'Zaubern', bp: 5 },
	5: { t: 'Benutzen', bp: 3, lang: 'Gegenstand benutzen' },
	6: { t: 'Wegwerfen', bp: 1, lang: 'Gegenstand wegwerfen' },
	7: { t: 'Waffe', bp: 2, lang: 'Waffe wechseln' },
	8: { t: 'Linke Hand', bp: 2, lang: 'Gegenstand der linken Hand wechseln' },
	9: { t: 'Werte prüfen' },
	10: { t: 'Abwarten' },
	11: { t: 'Computer', lang: 'Computerkampf' },
	12: { t: 'Verlassen / Laden' },
	13: { t: 'Wie zuvor', lang: 'Alte Optionen (wie letzte Runde)' },
};
// Bestätigen bei der Zielwahl, je nach gewähltem Befehl
const KAMPF_BESTAETIGEN = { 2: 'Angreifen', 4: 'Zaubern', 5: 'Benutzen' };

function kampfEinrichten(Module, optionen) {
	const el = optionen.el;
	const flaeche = el.querySelector('.flaeche');
	const inhalt = el.querySelector('.inhalt');
	const canvas = inhalt.querySelector('canvas');
	const ctx = canvas.getContext('2d');
	const bedienEl = optionen.bedienEl;
	const PIXEL_HOEHE = 1.2;
	const STUFEN = [1, 1.5, 2, 3];   // Zoom relativ zu „ganzes Feld“
	const MAX = 4;

	const hexText = (hex) => {
		const b = [];
		for (let i = 0; i + 1 < (hex?.length ?? 0); i += 2) b.push(parseInt(hex.slice(i, i + 2), 16));
		return optionen.spielText ? optionen.spielText(b) : String.fromCharCode(...b);
	};
	const bytesText = (b) => (b && optionen.spielText ? optionen.spielText(b) : '').replace(/[@~]/g, ' ').replace(/[-]/g, '').replace(/\s+/g, ' ').trim();

	let z = { k: 0 };
	let aktiv = false;
	let s = 1, ox = 0, oy = 0;
	let einpassen = false;     // beim nächsten Zeichnen: Startansicht
	let manuell = false;       // selbst verschoben/gezoomt: bis zum nächsten Kämpfer nicht mitführen
	let akteurAlt = '';
	let befehl = 0;            // zuletzt gewählter Befehl (Text für Bestätigen)
	let mehrOffen = false;

	function holen() {
		try { const t = Module._web_kampf?.(); return t ? JSON.parse(Module.UTF8ToString(t)) : { k: 0 }; } catch (e) { return { k: 0 }; }
	}

	// ---------- Ansicht ----------
	const groesse = () => ({ w: flaeche.clientWidth, h: flaeche.clientHeight });
	const ganz = () => { const { w, h } = groesse(); return Math.min(w / 320, h / (200 * PIXEL_HOEHE)) || 1; };
	const klemmen = (v, platz, bild) => bild <= platz ? (platz - bild) / 2 : Math.min(0, Math.max(platz - bild, v));
	function anwenden() {
		const { w, h } = groesse();
		const g = ganz();
		s = Math.min(g * MAX, Math.max(g, s));
		ox = klemmen(ox, w, 320 * s);
		oy = klemmen(oy, h, 200 * PIXEL_HOEHE * s);
		inhalt.style.transform = `translate(${ox}px, ${oy}px)`;
		canvas.style.width = `${320 * s}px`;
		canvas.style.height = `${200 * PIXEL_HOEHE * s}px`;
		const stufe = el.querySelector('.stufe');
		if (stufe) stufe.textContent = `${(s / g).toLocaleString('de-DE', { maximumFractionDigits: 1 })}×`;
	}
	function zentrieren(x, y) {
		const { w, h } = groesse();
		ox = w / 2 - x * s;
		oy = h / 2 - y * PIXEL_HOEHE * s;
	}
	function zoomUm(neu, px, py) {
		const kx = (px - ox) / s, ky = (py - oy) / s;
		const g = ganz();
		s = Math.min(g * MAX, Math.max(g, neu));
		ox = px - kx * s; oy = py - ky * s;
		anwenden();
	}
	// Feld (x, y) → Bildpunkt (Mitte der Figur, etwas über dem Boden)
	const feldPunkt = (x, y) => [9 + 10 * (x + y), 116 + 5 * (x - y) - 8];
	function sichtbar(x, y, rand) {
		const { w, h } = groesse();
		const [bx, by] = feldPunkt(x, y);
		const px = ox + bx * s, py = oy + by * PIXEL_HOEHE * s;
		return px >= w * rand && px <= w * (1 - rand) && py >= h * rand && py <= h * (1 - rand);
	}
	function aufFeld(x, y) { const [bx, by] = feldPunkt(x, y); zentrieren(bx, by); anwenden(); }

	// ---------- Gesten (wie karte.js): zwei Finger zoomen, ein Finger verschiebt, Tippen markiert ----------
	const zeiger = new Map();
	let geste = null;
	const punktIn = (e) => { const r = flaeche.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
	function gesteStarten() {
		const p = [...zeiger.values()];
		if (p.length === 1) geste = { art: geste?.art === 'zoom' ? 'zoom-ende' : 'tipp', start: { ...p[0] }, ox, oy };
		else if (p.length >= 2) {
			const [a, b] = p;
			geste = { art: 'zoom', d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s, kx: ((a.x + b.x) / 2 - ox) / s, ky: ((a.y + b.y) / 2 - oy) / s };
		}
	}
	flaeche.addEventListener('pointerdown', (e) => {
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
			const g = ganz();
			s = Math.min(g * MAX, Math.max(g, geste.s * Math.hypot(a.x - b.x, a.y - b.y) / geste.d));
			ox = (a.x + b.x) / 2 - geste.kx * s;
			oy = (a.y + b.y) / 2 - geste.ky * s;
			manuell = true;
			anwenden();
		} else if (p.length === 1 && geste.art !== 'zoom') {
			const dx = p[0].x - geste.start.x, dy = p[0].y - geste.start.y;
			if (geste.art === 'tipp' && Math.hypot(dx, dy) > 8) geste.art = 'ziehen';
			if (geste.art === 'ziehen' || geste.art === 'zoom-ende') {
				ox = geste.ox + dx; oy = geste.oy + dy;
				manuell = true;
				anwenden();
			}
		}
	});
	function loslassen(e, abgebrochen) {
		if (!zeiger.has(e.pointerId)) return;
		const p = zeiger.get(e.pointerId);
		zeiger.delete(e.pointerId);
		if (!abgebrochen && zeiger.size === 0 && geste?.art === 'tipp') tippen(p);
		if (zeiger.size === 0) geste = null;
		else gesteStarten();
	}
	flaeche.addEventListener('pointerup', (e) => loslassen(e, false));
	flaeche.addEventListener('pointercancel', (e) => loslassen(e, true));
	flaeche.addEventListener('contextmenu', (e) => e.preventDefault());
	flaeche.addEventListener('wheel', (e) => {
		e.preventDefault();
		const p = punktIn(e);
		manuell = true;
		zoomUm(s * Math.exp(-e.deltaY * 0.002), p.x, p.y);
	}, { passive: false });
	/** Tippen ins Feld: nur bei Ziel- und Bewegungswahl (sonst läge dort z. B. die Box des Spiels) */
	function tippen(p) {
		const x = Math.floor((p.x - ox) / s), y = Math.floor((p.y - oy) / (s * PIXEL_HOEHE));
		if (x < 0 || x >= 320 || y < 0 || y >= 200) return;
		if (z.p === 2 || z.p === 3) Module._web_kampf_tipp?.(x, y);
		setTimeout(aktualisieren, 60);
	}
	for (const b of el.querySelectorAll('button[data-zoom]')) {
		b.addEventListener('click', () => {
			const { w, h } = groesse();
			const g = ganz(), stufe = s / g;
			if (b.dataset.zoom === '+') zoomUm(g * (STUFEN.find((v) => v > stufe + 0.01) ?? MAX), w / 2, h / 2);
			else if (b.dataset.zoom === '-') zoomUm(g * ([...STUFEN].reverse().find((v) => v < stufe - 0.01) ?? 1), w / 2, h / 2);
			else if (b.dataset.zoom === 'ganz') { s = g; anwenden(); }
			else if (b.dataset.zoom === 'held') { manuell = false; mitfuehren(true); return; }
			manuell = true;
		});
	}
	new ResizeObserver(() => { if (aktiv) anwenden(); }).observe(flaeche);

	/** Ausschnitt nachführen: neuer Kämpfer → auf ihn; Markierung am Rand → auf sie */
	function mitfuehren(sofort) {
		const [ax, ay, gegner, id] = z.a ?? [-1, -1, 0, 0];
		const schluessel = `${gegner}:${id}`;
		if (schluessel !== akteurAlt) { akteurAlt = schluessel; manuell = false; sofort = true; }
		if ((z.p === 2 || z.p === 3) && z.m && z.m[0] >= -1 && !sichtbar(z.m[0], z.m[1], 0.12)) { aufFeld(z.m[0], z.m[1]); return; }
		if (ax < 0 || manuell) return;
		if (sofort || !sichtbar(ax, ay, 0.2)) aufFeld(ax, ay);
	}

	// ---------- Bedienfeld ----------
	let schluesselAlt = '';
	let gesendet = null;       // Box, für die schon eine Wahl geschickt ist (nur eine Antwort je Box)
	const knopf = (text, klick, cls = '', klein = '') => {
		const b = document.createElement('button');
		b.type = 'button';
		if (cls) b.className = cls;
		const t = document.createElement('span');
		t.textContent = text;
		b.append(t);
		if (klein) { const k = document.createElement('small'); k.textContent = klein; b.append(k); }
		b.addEventListener('click', klick);
		return b;
	};
	const div = (cls, ...kinder) => { const d = document.createElement('div'); d.className = cls; d.append(...kinder); return d; };
	const offeneBox = () => optionen.dialoge.at(-1);
	function waehlen(n) {
		const d = offeneBox();
		if (!d?.extern || gesendet === d) return;
		gesendet = d;
		if (d.kampf === 1) befehl = n;
		mehrOffen = false;
		bedienEl.classList.add('gesendet');
		Module._web_menu_select(n);
		// Sicherheitsnetz wie im Overlay: bleibt die Box offen, nach 2 s wieder bedienbar
		setTimeout(() => { if (gesendet === d && offeneBox() === d) { gesendet = null; bedienEl.classList.remove('gesendet'); } }, 2000);
	}
	function abbrechenBox() {
		const d = offeneBox();
		if (!d?.extern || gesendet === d) return;
		gesendet = d;
		Module._web_right_click?.();
	}
	const taste = (k) => Module._web_key?.(k);
	const TASTE = { up: 0x40000052, down: 0x40000051, left: 0x40000050, right: 0x4000004F, enter: 13, esc: 27 };

	function heldName(i) { const h = z.helden?.find((x) => x.i === i); return h ? hexText(h.name) : ''; }
	function gruppe() {
		const reihe = div('kb-gruppe');
		const amZug = z.a && !z.a[2] ? z.a[3] - 1 : -1;
		for (const h of z.helden ?? []) {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'kb-held' + (h.i === amZug ? ' an' : '') + (h.weg ? ' weg' : '');
			const n = document.createElement('span'); n.textContent = hexText(h.name);
			const le = div('kb-balken'); const leb = document.createElement('b'); leb.style.width = `${Math.max(0, Math.min(100, 100 * h.le / (h.lem || 1)))}%`; le.append(leb);
			b.append(n, le);
			if (h.aem > 0) { const ae = div('kb-balken ae'); const aeb = document.createElement('b'); aeb.style.width = `${Math.max(0, Math.min(100, 100 * h.ae / h.aem))}%`; ae.append(aeb); b.append(ae); }
			b.setAttribute('aria-label', `${n.textContent}: LE ${h.le} von ${h.lem}${h.aem > 0 ? `, AE ${h.ae} von ${h.aem}` : ''}`);
			// der Held am Zug: Werte prüfen (wie der Menüeintrag)
			b.addEventListener('click', () => { if (h.i === z.held && offeneBox()?.kampf === 1) waehlen(9); });
			reihe.append(b);
		}
		return reihe;
	}
	function bpAnzeige(rest, kostet = 0) {
		const d = div('kb-bp');
		for (let i = 0; i < Math.max(rest, 8); i++) { const p = document.createElement('i'); if (i >= rest) p.className = 'weg'; else if (i >= rest - kostet) p.className = 'kostet'; d.append(p); }
		const t = document.createElement('small'); t.textContent = KAMPF_TEXTE.bp(rest); d.append(t);
		return d;
	}
	function zugKopf(titel, kostet) {
		const b = document.createElement('b'); b.textContent = titel;
		const k = div('kb-zug', b);
		if (z.held >= 0 && z.bp !== undefined) k.append(bpAnzeige(z.bp, kostet));
		return k;
	}

	function menue(d) {
		const n = d.optionen.length;   // 12 oder 13 (mit „Alte Optionen“)
		const bp = z.bp ?? 0;
		const befehlKnopf = (nr, cls = '') => {
			const b = KAMPF_BEFEHLE[nr];
			const text = nr === 2 && z.fern ? b.fern : b.t;
			const k = knopf(text, () => waehlen(nr), cls, b.k ?? (b.bp ? KAMPF_TEXTE.bp(b.bp) : ''));
			k.dataset.befehl = nr;
			k.setAttribute('aria-label', nr === 2 && z.fern ? b.fern : (b.lang ?? b.t));
			if (b.bp && bp < b.bp) k.disabled = true;
			if ((nr === 7 && z.waffeWarn) || (nr === 6 && z.lastWarn)) k.classList.add('warn');
			return k;
		};
		// obere Reihe: Abwarten, Wie zuvor, Benutzen, ⋯ (Rest: Waffe, Linke Hand, Wegwerfen, Computerkampf,
		// Werte prüfen, Verlassen/Laden); darüber bis zum Kopf der Kampfverlauf
		const zug = div('kb-reihe ' + (n >= 13 ? 'vier' : 'drei'), befehlKnopf(10), ...(n >= 13 ? [befehlKnopf(13)] : []), befehlKnopf(5));
		const mehr = knopf('⋯', () => { mehrOffen = !mehrOffen; schluesselAlt = ''; bedienen(); }, 'kb-mehr' + (mehrOffen ? ' an' : ''));
		mehr.setAttribute('aria-label', KAMPF_TEXTE.mehr);
		mehr.setAttribute('aria-expanded', mehrOffen);
		zug.append(mehr);
		const mitte = mehrOffen
			? div('kb-mehr-liste', befehlKnopf(7), befehlKnopf(8), befehlKnopf(6), befehlKnopf(11), befehlKnopf(9), befehlKnopf(12))
			: verlaufListe();
		const unten = div('kb-unten',
			zug,
			div('kb-titel', document.createTextNode(KAMPF_TEXTE.kampf)),
			z.zauber ? div('kb-reihe zwei', befehlKnopf(3, 'gross'), befehlKnopf(4, 'gross')) : div('kb-reihe eins', befehlKnopf(3, 'gross')),
			div('kb-reihe zwei', befehlKnopf(1, 'gross'), befehlKnopf(2, 'gross haupt')));
		return [zugKopf(KAMPF_TEXTE.amZug(heldName(z.held))), mitte, unten];
	}

	function liste(d) {
		const titel = bytesText(d.text);
		const kopf = div('kb-banner', div('kb-banner-text', Object.assign(document.createElement('b'), { textContent: titel })));
		kopf.append(knopf(KAMPF_TEXTE.abbrechen, abbrechenBox));
		const eintraege = div('kb-liste');
		// Bilder nur, wenn der Heldenbogen sie schon geholt hat (im Kampf liegt GGSTS.NVF nicht im Speicher)
		const mitBild = d.kampf === 2 && d.optionen.some((o, i) => z.liste?.[i] && optionen.bild?.(z.liste[i].id));
		d.optionen.forEach((o, i) => {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'kb-eintrag';
			b.dataset.nr = i + 1;
			const info = d.kampf === 2 ? z.liste?.[i] : null;
			if (info && mitBild) {
				const c = document.createElement('canvas');
				c.width = c.height = 16;
				const bild = optionen.bild?.(info.id);
				if (bild) c.getContext('2d').putImageData(bild, 0, 0);
				else c.classList.add('leer');
				b.append(c);
			}
			const t = document.createElement('span');
			const name = document.createElement('b'); name.textContent = bytesText(o);
			t.append(name);
			const w = info ? werte(info) : '';
			if (w) { const k = document.createElement('small'); k.textContent = w; t.append(k); }
			b.append(t);
			b.addEventListener('click', () => waehlen(i + 1));
			eintraege.append(b);
		});
		return [kopf, eintraege];
	}
	const vz = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');
	function werte(g) {
		if (g.kampf) { const [w6, plus, at, pa] = g.kampf; return `${w6}W6${plus ? vz(plus) : ''} · AT ${vz(at)} · PA ${vz(pa)}`; }
		if (g.schutz) return `RS ${g.schutz[0]} · BE ${g.schutz[1]}`;
		return '';
	}

	function zielwahl() {
		const bewegen = z.p === 3;
		const bp = z.bp ?? 0;
		let titel, unter, kostet = 0;
		if (bewegen) {
			const p = z.problem;
			if (p === 0 && z.kosten > 0) { titel = `${KAMPF_TEXTE.bewegen}: ${KAMPF_TEXTE.felder(z.kosten)}`; unter = KAMPF_TEXTE.zielKosten(z.kosten, bp - z.kosten); kostet = z.kosten; }
			else { titel = KAMPF_TEXTE.bewegen; unter = KAMPF_TEXTE.weg[p > 0 ? p : -1]; }
		} else {
			const b = KAMPF_BEFEHLE[befehl];
			const was = befehl === 2 && z.fern ? b.fern : (b?.t ?? KAMPF_TEXTE.ziel);
			const ziel = z.ziel && !(z.m[0] === z.a?.[0] && z.m[1] === z.a?.[1]) ? hexText(z.ziel.name) : '';
			titel = ziel ? `${was}: ${ziel}` : `${was}: ${KAMPF_TEXTE.ziel}`;
			kostet = b?.bp ?? 0;
			unter = kostet ? KAMPF_TEXTE.zielKosten(kostet, bp - kostet) : '';
		}
		const text = div('kb-banner-text', Object.assign(document.createElement('b'), { textContent: titel }), Object.assign(document.createElement('small'), { textContent: unter }));
		const banner = div('kb-banner', text, knopf(KAMPF_TEXTE.abbrechen, () => taste(TASTE.esc)));
		const pfeil = (zeichen, k, label) => { const b = knopf(zeichen, () => taste(TASTE[k]), 'kb-pfeil'); b.setAttribute('aria-label', label); return b; };
		const leer = () => div('kb-leer');
		const ok = knopf(bewegen ? 'Hierhin' : (KAMPF_BESTAETIGEN[befehl] ?? 'Bestätigen'), () => taste(TASTE.enter), 'kb-ok');
		const kreuz = div('kb-diagonal',
			pfeil('↖', 'left', 'Nach links oben'), leer(), pfeil('↗', 'up', 'Nach rechts oben'),
			leer(), ok, leer(),
			pfeil('↙', 'down', 'Nach links unten'), leer(), pfeil('↘', 'right', 'Nach rechts unten'));
		const hinweis = div('kb-hinweis', document.createTextNode(KAMPF_TEXTE.hinweis));
		return [zugKopf(heldName(z.held), kostet), banner, kreuz, hinweis];
	}

	function verlaufListe() {
		const liste = div('kb-verlauf');
		// Namen groß wie im Spiel: so heben sie sich im Satz ab
		const eintraege = (optionen.wurfLog?.alsText?.(true) ?? []).slice(kampfStart).slice(-12);
		if (!eintraege.length) liste.append(div('kb-leise', document.createTextNode(KAMPF_TEXTE.verlaufLeer)));
		const helden = (z.helden ?? []).map((h) => hexText(h.name).toLowerCase()).filter(Boolean);
		eintraege.forEach(([titel, ergebnis], i) => {
			const a = document.createElement('span'); a.textContent = titel;
			const b = document.createElement('span'); b.textContent = ergebnis;
			const zeile = div('kb-verlauf-zeile', a, b);
			if (/(^|, )Treffer/.test(ergebnis)) zeile.classList.add('treffer');
			// Aktion eines eigenen Helden (Titel beginnt mit seinem Namen)
			if (helden.some((n) => titel.toLowerCase().startsWith(n + ' '))) zeile.classList.add('eigen');
			if (i === eintraege.length - 1) zeile.classList.add('neu');
			liste.append(zeile);
		});
		return liste;
	}

	function verlauf() {
		const [, , gegner, id] = z.a ?? [];
		const name = gegner ? (z.wer ? hexText(z.wer.name) : '') : heldName(id - 1);
		const titel = !name ? '' : z.auto && !gegner ? KAMPF_TEXTE.computer(name) : KAMPF_TEXTE.amZug(name);
		const kopf = div('kb-zug', Object.assign(document.createElement('b'), { textContent: titel }));
		const tempo = div('kb-wahl3');
		const jetzt = optionen.tempo?.lies();
		for (const [wert, text] of [['6', 'Langsam'], ['4', 'Normal'], ['2', 'Schnell']]) {
			const b = knopf(text, () => { optionen.tempo?.setze(wert); schluesselAlt = ''; bedienen(); }, wert === jetzt ? 'an' : '');
			b.setAttribute('aria-label', `Kampftempo ${text.toLowerCase()}`);
			b.setAttribute('aria-pressed', wert === jetzt);
			tempo.append(b);
		}
		return [kopf, verlaufListe(), div('kb-unten', div('kb-titel', document.createTextNode(KAMPF_TEXTE.tempo)), tempo)];
	}

	let kampfStart = 0;   // Würfelprotokoll: Einträge ab Kampfbeginn
	let modus = '';
	function bedienen() {
		const d = offeneBox();
		modus = d?.extern ? (d.kampf === 1 ? 'menue' : 'liste') : (z.p === 2 || z.p === 3) ? 'ziel' : 'verlauf';
		const anzahl = optionen.wurfLog?.eintraege?.length ?? 0;
		const schluessel = JSON.stringify([modus, d && d.extern ? [d.text, d.optionen, d.kampf] : null, z.helden, z.a, z.held, z.bp, z.p, z.m, z.problem, z.kosten,
			z.ziel, z.wer, z.liste, z.wdh, z.zauber, z.fern, z.waffeWarn, z.lastWarn, z.auto, mehrOffen, modus === 'verlauf' || modus === 'menue' ? anzahl : 0]);
		if (schluessel === schluesselAlt) return;
		schluesselAlt = schluessel;
		if (gesendet !== d) { gesendet = null; bedienEl.classList.remove('gesendet'); }
		const teile = modus === 'menue' ? menue(d) : modus === 'liste' ? liste(d) : modus === 'ziel' ? zielwahl() : verlauf();
		bedienEl.dataset.modus = modus;
		bedienEl.replaceChildren(gruppe(), ...teile);
	}

	function aktualisieren() {
		if (!aktiv) return;
		z = holen();
		if (z.k !== 1) return;
		bedienen();
		mitfuehren(false);
	}

	// ---------- Ablauf ----------
	function pruefen() {
		const war = aktiv;
		z = holen();
		aktiv = z.k === 1 && !!optionen.layoutPasst?.();
		if (aktiv !== war) Module._web_kampf_sterne?.(aktiv ? 0 : 1);
		if (aktiv && !war) {
			einpassen = true;
			akteurAlt = '';
			befehl = 0;
			mehrOffen = false;
			kampfStart = optionen.wurfLog?.eintraege?.length ?? 0;
			schluesselAlt = '';
		}
		if (!aktiv) bedienEl.replaceChildren();
		return aktiv;
	}
	function zeichnen() {
		if (!aktiv) return;
		const q = optionen.quelle();
		ctx.drawImage(q, 0, 0);
		if (einpassen && flaeche.clientHeight > 0) {
			einpassen = false;
			s = ganz() * 1.5;
			ox = oy = 0;
			anwenden();
			mitfuehren(true);
		}
		bedienen();
		mitfuehren(false);
	}
	// solange gekämpft wird: Stand auch ohne neues Bild abgleichen (Menü offen, Gegner überlegt)
	setInterval(() => { if (aktiv && !document.hidden) aktualisieren(); }, 200);

	return {
		pruefen, zeichnen, aktualisieren,
		/** dialog.js: Kampfmenü und Auswahllisten des Helden am Zug im Bedienfeld statt im Overlay */
		uebernehmen(d) {
			if (!aktiv) return false;
			z = holen();
			if (z.k !== 1 || z.held < 0 || d.art !== 2) return false;
			setTimeout(aktualisieren, 0);
			return true;
		},
		aktiv: () => aktiv,
		zustand: () => aktiv ? { modus, p: z.p, held: z.held, bp: z.bp, m: z.m, a: z.a, problem: z.problem, kosten: z.kosten, s: s / ganz(), ox, oy } : null,
		// für Tests: Feld → Seitenpunkt
		// (Mitte des Bereichs, den das Spiel dem Feld zuordnet: FIG_move_hero rechnet mit ganzzahliger Division)
		punkt: (x, y) => { const r = flaeche.getBoundingClientRect(); const [bx, by] = feldPunkt(x, y); return [r.left + ox + (bx + 5) * s, r.top + oy + (by + 8 + 2.5) * PIXEL_HOEHE * s]; },
	};
}
