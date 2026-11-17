// Heldenbogen im mobilen Hochformat. Direkt unter dem Bild die Gruppe (waagerecht scrollbar, Schließen) und
// die Reiter für die Seiten des Bogens (Grundwerte, AT/PA, Talente, Zauber); unten im Daumenbereich die Karte
// zum gewählten Gegenstand, Ausrüstung und Rucksack als große Kacheln. Das Inventar bleibt auf allen Seiten.
//
// Das Spiel bleibt zuständig (BrightEyes heldenbogen.cpp): web_heldenbogen() meldet Felder, Gruppe, Seite und
// Auswahl; jede Aktion ist eine Folge von Schritten (web_heldenbogen_schritt), die status_menu mit den
// Eingaben des Originals ausführt (Feld wählen, aufnehmen, auf Feld/Auge/Mund ablegen, Held wechseln, Seite,
// Menüeinträge). Antippen wählt nur aus, auch im Bild (web_heldenbogen_ablage).
// Gegenstände bearbeitet status_menu nur auf den Seiten Grundwerte und AT/PA: auf Talente und Zauber merkt
// sich die Seite die Auswahl selbst, eine Aktion wechselt dafür kurz zu den Grundwerten und wieder zurück.
// Bilder der Gegenstände liefert das Spiel (web_heldenbogen_bild → Module.heldenbogenBild), die Seite merkt
// sie sich je Gegenstand; die Anzahl bei Stapeln zeichnet die Seite.
'use strict';

const HB_KOERPER = ['Kopf', 'Arme', 'Körper', 'Rechte Hand', 'Linke Hand', 'Beine', 'Füße'];
const HB_KURZ = ['Kopf', 'Arme', 'Körper', 'R. Hand', 'L. Hand', 'Beine', 'Füße'];
const HB_SCHRITT = { waehlen: 1, aufnehmen: 2, ablegen: 3, ablegenFrei: 4, held: 5, benutzen: 6, wegwerfen: 7, schliessen: 8, seite: 9, talent: 10, zauber: 11 };
const HB_AUGE = 23, HB_MUND = 24;
const HB_REITER = [['Grundwerte', 1], ['AT/PA', 2], ['Talente', 3], ['Zauber', 4]];

function heldenbogenEinrichten(Module, { el, spielText, dialogOffen, layoutPasst }) {
	const text = (hex) => {
		const b = [];
		for (let i = 0; i + 1 < (hex?.length ?? 0); i += 2) b.push(parseInt(hex.slice(i, i + 2), 16));
		return b.length ? spielText(b) : '';
	};

	el.innerHTML = `
		<div class="hb-oben">
			<div class="hb-kopf"><div class="hb-helden" role="group" aria-label="Gruppe"></div>
				<button type="button" class="hb-mehr" aria-label="Talent anwenden, Zauber sprechen" aria-haspopup="true">⋯</button>
				<button type="button" class="hb-zu" aria-label="Heldenbogen schließen">Schließen</button></div>
			<div class="hb-mehr-liste" hidden>
				<button type="button" data-mehr="talent">Talent anwenden</button>
				<button type="button" data-mehr="zauber">Zauber sprechen</button>
			</div>
			<div class="hb-reiter" role="group" aria-label="Seiten">${HB_REITER.map(([t, n]) => `<button type="button" data-seite="${n}">${t}</button>`).join('')}</div>
		</div>
		<div class="hb-unten">
			<div class="hb-karte" aria-live="polite"></div>
			<div class="hb-fach"><div class="hb-titel"><span>Ausrüstung</span><span class="hb-last"></span></div>
				<div class="hb-kacheln sieben"></div></div>
			<div class="hb-fach"><div class="hb-titel"><span>Rucksack</span><span class="hb-belegt"></span></div>
				<div class="hb-kacheln acht"></div></div>
		</div>`;
	const heldenEl = el.querySelector('.hb-helden');
	const karteEl = el.querySelector('.hb-karte');
	const lastEl = el.querySelector('.hb-last');
	const belegtEl = el.querySelector('.hb-belegt');
	const mehrEl = el.querySelector('.hb-mehr-liste');
	const reiter = [...el.querySelectorAll('.hb-reiter button')];

	// Kacheln: 7 Körperfelder, 16 Rucksackfelder
	const kacheln = Array.from({ length: 23 }, (_, i) => {
		const b = document.createElement('button');
		b.type = 'button';
		b.className = 'hb-kachel';
		b.dataset.feld = i;
		const c = document.createElement('canvas');
		c.width = 16; c.height = 16;
		const zahl = document.createElement('b');
		const leer = document.createElement('small');
		if (i < 7) leer.textContent = HB_KURZ[i];
		b.append(c, zahl, leer);
		(i < 7 ? el.querySelector('.hb-kacheln.sieben') : el.querySelector('.hb-kacheln.acht')).append(b);
		return { b, ctx: c.getContext('2d'), zahl, id: 0 };
	});

	// Bilder der Gegenstände (vom Spiel, je Gegenstand einmal)
	const bilder = new Map();
	Module.heldenbogenBild = (id, rgba) => { bilder.set(id, new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, 1024), 16, 16)); };
	function bild(id) {
		if (!bilder.has(id)) Module._web_heldenbogen_bild?.(id);
		return bilder.get(id);
	}

	let daten = { offen: 0 };
	let modus = null;        // { art: 'verschieben' | 'fuettern', von, held, verb }
	let selLokal = 7;        // Auswahl auf den Seiten Talente und Zauber (dort wählt status_menu nicht)
	let sichtbar = false;
	let wartet = false;      // Schritte eingereiht, Spiel noch nicht fertig
	let karteSchluessel = '';
	let heldenZiel = -1;     // Held, zu dem die Reihe zuletzt gescrollt wurde (danach darf man frei scrollen)

	function holen() {
		try { return JSON.parse(Module.UTF8ToString(Module._web_heldenbogen())); } catch (e) { return { offen: 0 }; }
	}

	const inventarSeite = () => daten.seite < 3;
	const auswahl = () => (inventarSeite() ? daten.sel : selLokal);
	const gesperrt = () => wartet || !!daten.laeuft || dialogOffen();

	// Schritte einreihen; auf Talente/Zauber vorher zu den Grundwerten und danach zurück
	function schritte(folge, { inventar = true } = {}) {
		if (!Module._web_heldenbogen_schritt || dialogOffen()) return false;
		daten = holen();   // frisch: nicht an einem veralteten „läuft“ scheitern
		if (!daten.offen || daten.laeuft) return false;
		const seite = daten.seite;
		const ganz = inventar && seite >= 3 ? [['seite', 1], ...folge, ['seite', seite]] : folge;
		for (const [art, wert = 0] of ganz) Module._web_heldenbogen_schritt(HB_SCHRITT[art], wert);
		wartet = true;
		zeigen();
		nachsehen();
		return true;
	}
	// bis die Schritte ausgeführt sind, öfter nachsehen (nicht jeder Schritt bringt ein neues Bild)
	function nachsehen() {
		setTimeout(() => {
			if (!sichtbar) { wartet = false; return; }
			daten = holen();
			if (daten.laeuft) { nachsehen(); return; }
			wartet = false;
			zeigen();
		}, 60);
	}

	const feldName = (i) => (i < 7 ? HB_KOERPER[i] : `Rucksack ${i - 6}`);
	const gegenstand = (i) => daten.felder?.[i] ?? null;
	const nameVon = (g) => text(g.name);
	const mehrereHelden = () => (daten.helden?.length ?? 0) > 1;

	function art(g) {
		if (g.waffe) return text(g.typ) || 'Waffe';
		if (g.ruestung) return g.ziel >= 0 ? `Rüstung (${HB_KOERPER[g.ziel]})` : 'Rüstung';
		if (g.nahrung) return g.art === 0 ? 'Getränk' : 'Proviant';
		if (g.trank) return 'Kraut, Trank oder Gift';
		if (g.benutzbar) return 'Gegenstand zum Benutzen';
		return 'Gegenstand';
	}

	const vz = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '');
	// Kampfwerte: Schaden, KK-Zuschlag, AT/PA-Modifikator, Bruchfaktor; Rüstungsschutz und Behinderung
	function werte(g) {
		if (g.kampf) {
			const [w6, plus, kk, at, pa, bf] = g.kampf;
			return {
				haupt: `${w6}W6${vz(plus)}`,
				mehr: [`AT ${vz(at) || '±0'}`, `PA ${vz(pa) || '±0'}`, kk ? `KK-Zuschlag ab ${kk}` : '', bf === -99 ? 'unzerbrechlich' : `BF ${bf}`].filter(Boolean).join(' · '),
			};
		}
		if (g.schutz) return { haupt: `RS ${g.schutz[0]}`, mehr: `BE ${g.schutz[1]}` };
		return null;
	}

	// ---------- Aktionen ----------
	function aktionen(i, g) {
		const liste = [];
		if (i >= 7 && g.ziel >= 0) {
			liste.push({ t: 'Ausrüsten', z: HB_KOERPER[g.ziel], haupt: true, f: [['waehlen', i], ['aufnehmen'], ['ablegen', g.ziel]] });
		}
		if (i < 7) liste.push({ t: 'Ablegen', z: 'Rucksack', f: [['waehlen', i], ['aufnehmen'], ['ablegenFrei']] });
		if (g.nahrung || g.trank) {
			const verb = g.trank ? 'Einnehmen' : g.art === 0 ? 'Trinken' : 'Essen';
			liste.push({ t: verb, haupt: i >= 7 && !(g.ziel >= 0), f: [['waehlen', i], ['aufnehmen'], ['ablegen', HB_MUND]] });
			if (mehrereHelden()) liste.push({ t: verb, z: 'anderer Held', m: { art: 'fuettern', von: i, verb } });
		}
		if (g.benutzbar && !g.trank && !g.nahrung) liste.push({ t: 'Benutzen', f: [['waehlen', i], ['benutzen']] });
		liste.push({ t: 'Ansehen', f: [['waehlen', i], ['aufnehmen'], ['ablegen', HB_AUGE]] });
		liste.push({ t: 'Verschieben', z: mehrereHelden() ? 'oder geben' : '', m: { art: 'verschieben', von: i } });
		if (!g.fest) liste.push({ t: 'Wegwerfen', f: [['waehlen', i], ['wegwerfen']] });
		return liste;
	}

	// Karte nur neu aufbauen, wenn sich etwas geändert hat (sonst gehen Berührungen verloren)
	function karteZeigen() {
		const i = auswahl();
		const g = gegenstand(i);
		const schluessel = JSON.stringify([i, g, modus, mehrereHelden(), daten.held]);
		if (schluessel !== karteSchluessel) {
			karteSchluessel = schluessel;
			karteAufbauen(i, g);
		}
		for (const k of karteEl.querySelectorAll('button')) k.disabled = gesperrt();
	}

	function karteAufbauen(i, g) {
		karteEl.replaceChildren();
		if (modus) {
			const mg = gegenstand(modus.von);
			const banner = document.createElement('div');
			banner.className = 'hb-banner';
			const t = document.createElement('span');
			const n = document.createElement('b');
			n.textContent = mg ? nameVon(mg) : '';
			t.append(n, modus.art === 'fuettern'
				? `: Wer soll ${modus.verb === 'Essen' ? 'essen' : modus.verb === 'Trinken' ? 'trinken' : 'einnehmen'}? Held antippen.`
				: mehrereHelden() ? ': Kachel oder Held antippen' : ': Kachel antippen');
			const ab = document.createElement('button');
			ab.type = 'button'; ab.textContent = 'Abbrechen';
			ab.addEventListener('click', () => { modus = null; zeigen(); });
			banner.append(t, ab);
			karteEl.append(banner);
			return;
		}
		const kopf = document.createElement('div');
		kopf.className = 'hb-karte-kopf';
		const b = document.createElement('b');
		const s = document.createElement('small');
		if (!g) {
			b.textContent = feldName(i);
			s.textContent = 'leer';
			kopf.append(b, s);
			karteEl.append(kopf);
			return;
		}
		b.textContent = nameVon(g) + (g.magisch ? ' (magisch)' : '');
		const gewicht = g.gew * (g.stapel ? Math.max(1, g.n) : 1);
		const w = werte(g);
		s.textContent = [art(g), w?.haupt, g.stapel && g.n > 1 ? `${g.n} Stück` : '', `${gewicht} Unzen`].filter(Boolean).join(' · ');
		kopf.append(b, s);
		if (w?.mehr) {
			const m = document.createElement('small');
			m.textContent = w.mehr;
			kopf.append(m);
		}
		if (g.verboten) {
			const w = document.createElement('small');
			w.className = 'warn';
			w.textContent = 'Für diesen Helden verboten';
			kopf.append(w);
		}
		const knoepfe = document.createElement('div');
		knoepfe.className = 'hb-aktionen';
		for (const a of aktionen(i, g)) {
			const k = document.createElement('button');
			k.type = 'button';
			if (a.haupt) k.classList.add('haupt');
			k.textContent = a.t;
			if (a.z) { const z = document.createElement('small'); z.textContent = a.z; k.append(z); }
			k.addEventListener('click', () => {
				if (a.m) { modus = { ...a.m, held: daten.held }; zeigen(); } else schritte(a.f);
			});
			knoepfe.append(k);
		}
		karteEl.append(kopf, knoepfe);
	}

	function heldenZeigen() {
		const helden = daten.helden ?? [];
		const schluessel = helden.map((h) => h.i + h.name).join('|');
		if (heldenEl.dataset.schluessel !== schluessel) {
			heldenEl.dataset.schluessel = schluessel;
			heldenEl.replaceChildren(...helden.map((h) => {
				const k = document.createElement('button');
				k.type = 'button';
				k.dataset.held = h.i;
				k.textContent = text(h.name);
				return k;
			}));
		}
		for (const k of heldenEl.children) {
			const i = Number(k.dataset.held);
			const h = helden.find((x) => x.i === i);
			const an = i === daten.held;
			k.classList.toggle('an', an);
			// aktiven Helden in der Reihe sichtbar halten (nur die Reihe scrollen, nicht die Seite)
			if (an && heldenEl.clientWidth && heldenZiel !== i) {
				const links = k.offsetLeft, rechts = links + k.offsetWidth;
				if (links < heldenEl.scrollLeft || rechts > heldenEl.scrollLeft + heldenEl.clientWidth) {
					heldenEl.scrollLeft = Math.max(0, links - (heldenEl.clientWidth - k.offsetWidth) / 2);
				}
				heldenZiel = i;
			}
			k.setAttribute('aria-pressed', an ? 'true' : 'false');
			k.classList.toggle('ziel', !!modus && !an);
			// Zauberseiten: status_menu blättert nur zu Zauberkundigen
			k.disabled = gesperrt() || (!modus && daten.seite >= 4 && !h?.zauber);
		}
	}

	function reiterZeigen() {
		const zauber = daten.helden?.find((h) => h.i === daten.held)?.zauber;
		for (const r of reiter) {
			const n = Number(r.dataset.seite);
			const an = n === 4 ? daten.seite >= 4 : n === daten.seite;
			r.classList.toggle('an', an);
			r.setAttribute('aria-pressed', an ? 'true' : 'false');
			r.disabled = gesperrt() || !!modus || (n === 4 && !zauber);
			if (n === 4) r.textContent = daten.seite === 5 ? 'Zauber 2/2' : daten.seite === 4 ? 'Zauber 1/2' : 'Zauber';
		}
	}

	function kachelnZeigen() {
		let belegt = 0;
		const sel = auswahl();
		kacheln.forEach((k, i) => {
			const g = gegenstand(i);
			if (g && i >= 7) belegt++;
			k.b.classList.toggle('leer', !g);
			k.b.classList.toggle('sel', !modus && i === sel);
			k.b.classList.toggle('von', !!modus && i === modus.von);
			k.b.classList.toggle('ziel', modus?.art === 'verschieben' && i !== modus.von);
			k.b.classList.toggle('verboten', !!g?.verboten);
			k.b.disabled = gesperrt() || modus?.art === 'fuettern';
			k.zahl.textContent = g?.stapel && g.n > 1 ? g.n : '';
			k.b.setAttribute('aria-label', g ? `${nameVon(g)}${g.stapel && g.n > 1 ? `, ${g.n} Stück` : ''} (${feldName(i)})` : `${feldName(i)}: leer`);
			const id = g?.id ?? 0;
			if (k.id !== id) {
				const b = id ? bild(id) : null;
				k.ctx.clearRect(0, 0, 16, 16);
				if (b) k.ctx.putImageData(b, 0, 0);
				k.id = b || !id ? id : 0;   // ohne Bild: beim nächsten Mal noch einmal versuchen
			}
		});
		belegtEl.textContent = `${belegt} von 16 belegt`;
		lastEl.textContent = `Last ${daten.last} Unzen`;
	}

	function zeigen() {
		if (inventarSeite()) selLokal = daten.sel;
		heldenZeigen();
		reiterZeigen();
		karteZeigen();
		kachelnZeigen();
		el.querySelector('.hb-zu').disabled = el.querySelector('.hb-mehr').disabled = gesperrt();
		if (gesperrt()) mehrEl.hidden = true;
	}

	// ---------- Eingaben ----------
	el.addEventListener('click', (e) => {
		const b = e.target.closest('button');
		if (!b || b.disabled) return;
		if (!b.closest('.hb-mehr-liste') && !b.classList.contains('hb-mehr')) mehrEl.hidden = true;
		if (b.classList.contains('hb-kachel')) {
			const i = Number(b.dataset.feld);
			if (modus?.art === 'verschieben') {
				const von = modus.von;
				modus = null;
				if (i === von) zeigen();
				else schritte([['waehlen', von], ['aufnehmen'], ['ablegen', i]]);
			} else if (i !== auswahl()) {
				if (inventarSeite()) schritte([['waehlen', i]]);
				else { selLokal = i; zeigen(); }
			}
		} else if (b.dataset.held !== undefined) {
			const h = Number(b.dataset.held);
			if (h === daten.held) return;
			if (modus) {
				const { art: a, von, held: eigener } = modus;
				modus = null;
				const ablegen = a === 'fuettern' ? ['ablegen', HB_MUND] : ['ablegenFrei'];
				schritte([['waehlen', von], ['aufnehmen'], ['held', h], ablegen, ['held', eigener]]);
			} else schritte([['held', h]], { inventar: false });
		} else if (b.dataset.seite !== undefined) {
			const n = Number(b.dataset.seite);
			const ziel = n === 4 && daten.seite === 4 ? 5 : n === 4 && daten.seite === 5 ? 4 : n;
			if (ziel !== daten.seite) schritte([['seite', ziel]], { inventar: false });
		} else if (b.classList.contains('hb-zu')) {
			modus = null;
			schritte([['schliessen']], { inventar: false });
		} else if (b.classList.contains('hb-mehr')) {
			mehrEl.hidden = !mehrEl.hidden;
		} else if (b.dataset.mehr) {
			mehrEl.hidden = true;
			modus = null;
			schritte([[b.dataset.mehr]], { inventar: false });
		}
	});

	return {
		/** neuen Stand holen; true, wenn die Ablage zu sehen sein soll */
		aktualisieren() {
			if (!Module._web_heldenbogen) return false;
			const vorher = daten;
			daten = holen();
			const an = !!daten.offen && layoutPasst();
			Module._web_heldenbogen_ablage?.(an ? 1 : 0);
			if (!an) { modus = null; sichtbar = false; wartet = false; mehrEl.hidden = true; return false; }
			if (!vorher.offen) { modus = null; selLokal = daten.sel; heldenZiel = -1; }
			if (vorher.held !== daten.held && !daten.laeuft && !wartet) modus = null;
			// Verschieben über das Bild: ein anderes Feld angetippt → dorthin ablegen
			if (modus?.art === 'verschieben' && !daten.laeuft && !wartet && inventarSeite() &&
				daten.sel !== modus.von && vorher.sel === modus.von) {
				const { von } = modus;
				const ziel = daten.sel;
				modus = null;
				schritte([['waehlen', von], ['aufnehmen'], ['ablegen', ziel]]);
			}
			sichtbar = true;
			zeigen();
			return true;
		},
		get sichtbar() { return sichtbar; },
		get daten() { return daten; },
		get modus() { return modus; },
		/** Bild eines Gegenstands, sofern schon einmal geholt (Kampf: Auswahllisten) */
		bildBekannt: (id) => bilder.get(id),
	};
}
