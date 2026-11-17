// Aktionsknöpfe im mobilen Layout: die neun Icons des Hauptbildschirms (Bereich 241–318/57–134)
// als beschriftete Knöpfe. Das Spiel meldet über web_icons(), welches Icon in welchem Feld steht
// (seg029, g_loaded_menu_icons); Antippen klickt wie bisher die Mitte des Felds (web_click), das
// Spiel bleibt also für Ablauf und Ergebnis zuständig. Das Bild im Knopf ist das Icon selbst,
// aus dem Spielbild ausgeschnitten. Die Beschriftungen sind eigene Texte, nicht aus den Spieldaten.

// MENU_ICON_* (common.h) → Beschriftung
const AKTION_TEXTE = {
	0: 'Held aufnehmen', 1: 'Held entlassen', 2: 'Held löschen', 3: 'Spiel laden', 4: 'Spiel speichern',
	5: 'Spiel beenden', 6: 'Beten', 7: 'Opfern', 8: 'Verlassen', 9: 'Wachen', 10: 'Gold geben',
	11: 'Zaubern', 12: 'Gruppe teilen', 13: 'Essen bestellen', 14: 'Gold nehmen', 15: 'Gruppen vereinen',
	16: 'Vorräte auffüllen', 17: 'Schlafen', 18: 'Reparieren', 19: 'Zimmer nehmen', 20: 'Kräuter suchen',
	21: 'Reden', 22: 'Kaufen', 23: 'Feilschen', 24: 'Verkaufen', 25: 'Talent anwenden',
	26: 'Weiter', 27: 'Zurück', 28: 'Held', 29: 'Gruppe wechseln', 30: 'Wunden heilen',
	31: 'Krankheit heilen', 32: 'Gift heilen', 33: 'Tür öffnen/schließen', 34: 'Tür aufbrechen',
	35: 'Schloss knacken', 36: 'Boden', 37: 'Info', 38: 'Truhe öffnen', 39: 'Karte',
	40: 'Passage buchen', 41: 'An Bord gehen', 42: 'Hafenmeister', 43: 'Markt', 44: 'Hyggeliks Karte',
	45: 'Gruppen vereinen', 46: 'Hebel ziehen', 47: 'Angreifen', 48: 'Lager abbrechen', 49: 'Herberge',
	50: 'Taverne', 51: 'Kampftempo', 52: 'Tagebuch', 53: 'Ton', 54: 'Lager aufschlagen',
};
const AKTION_GRAU = new Set([45]);   // MENU_ICON_MERGE_GROUP_GRAYED: das Spiel lehnt ab, Knopf bleibt antippbar
// im Menü der Seite (menue.js) statt als Knopf: Spiel laden, speichern, beenden (Tempel), Info (Spieloptionen)
const AKTION_IM_MENUE = new Set([3, 4, 5, 37]);
const AKTION_KARTE = 39;   // MENU_ICON_MAP: unter der Minimap, wenn sie zu sehen ist

// el: Raster der Knöpfe (zwei Reihen, drei Spalten, bei mehr als sechs Knöpfen vier);
// kartenEl: Platz unter der Minimap; karteUnterMinimap(): ob die Minimap zu sehen ist
function aktionenEinrichten(Module, { el, kartenEl, karteUnterMinimap = () => false }) {
	let stand = '';
	const felder = [];   // je Knopf: Feldnummer und Canvas fürs Icon

	function aufbauen(ids, unterMinimap) {
		el.textContent = '';
		if (kartenEl) kartenEl.textContent = '';
		felder.length = 0;
		ids.forEach((id, i) => {
			if (id < 0 || AKTION_IM_MENUE.has(id)) return;
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'aktion' + (AKTION_GRAU.has(id) ? ' grau' : '');
			b.dataset.icon = id;
			const c = document.createElement('canvas');
			c.width = 24; c.height = 24;
			const ctx = c.getContext('2d');
			ctx.imageSmoothingEnabled = false;
			const t = document.createElement('span');
			t.textContent = AKTION_TEXTE[id] ?? `Aktion ${id}`;
			b.append(c, t);
			b.setAttribute('aria-label', t.textContent);
			const x = 241 + 27 * (i % 3) + 12, y = 57 + 27 * Math.floor(i / 3) + 12;
			b.addEventListener('pointerdown', (e) => {
				e.preventDefault();
				Module._web_click?.(x, y, 1);
			});
			b.addEventListener('contextmenu', (e) => e.preventDefault());
			(id === AKTION_KARTE && unterMinimap && kartenEl ? kartenEl : el).append(b);
			felder.push({ i, ctx });
		});
		el.classList.toggle('vier', el.children.length > 6);
		if (kartenEl) kartenEl.hidden = kartenEl.children.length === 0;
	}

	return {
		// bei jedem Bild des Hauptbildschirms (quelle: das ganze 320×200-Bild)
		zeichnen(quelle) {
			const icons = Module._web_icons ? Module.UTF8ToString(Module._web_icons()) : '';
			const unter = karteUnterMinimap();
			const neu = icons + (unter ? '|m' : '');
			if (neu !== stand) { stand = neu; aufbauen(icons.split(',').map(Number), unter); }
			for (const { i, ctx } of felder) {
				ctx.drawImage(quelle, 241 + 27 * (i % 3), 57 + 27 * Math.floor(i / 3), 24, 24, 0, 0, 24, 24);
			}
		},
		get stand() { return stand; },
	};
}
