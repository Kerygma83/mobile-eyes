// Menü der Seite (Knopf „Menü“ in der Leiste): Spiel speichern und laden, Tagebuch, Hyggeliks Karte,
// Spielstände sichern/einlesen, Einstellungen, zurück zum Startmenü.
//
// Speichern, Laden, Tagebuch und Karte führt das Spiel aus wie seine eigenen Spieloptionen (Aktionsknopf
// „Info“) bzw. die Icons im Tempel (BrightEyes webmenue.cpp): web_menue(n) merkt die Aktion vor, das Spiel
// führt sie in der Schleife von Stadt, Dungeon oder Tempel aus, mit allen Abfragen. Möglich nur auf dem
// Hauptbildschirm dort (web_menue_status: ort 1 Stadt, 2 Dungeon, 3 Tempel). Speichern außerhalb des Tempels
// kostet in BrightEyes keine AP (M302de_FEATURE_MOD, Mod 4).

const MENUE_AKTIONEN = { speichern: 1, laden: 2, tagebuch: 3, karte: 4 };

function menueEinrichten(Module, { el, dialogOffen, spielstaende, einstellungen, zumStartmenue }) {
	const hinweisEl = el.querySelector('.hinweis-ort');

	function status() {
		try { return JSON.parse(Module.UTF8ToString(Module._web_menue_status())); } catch (e) { return { ort: 0 }; }
	}

	function zeigen() {
		const ort = Module._web_menue_status && !dialogOffen() ? status().ort : 0;
		for (const b of el.querySelectorAll('[data-menue]')) {
			if (b.dataset.menue in MENUE_AKTIONEN) b.disabled = !ort;
		}
		hinweisEl.textContent = ort ? '' : 'Speichern, Laden, Tagebuch und Karte gehen nur in einer Stadt, einem Dungeon oder einem Tempel.';
		el.hidden = false;
	}
	const schliessen = () => { el.hidden = true; };

	el.addEventListener('click', (e) => {
		if (e.target === el) { schliessen(); return; }
		const b = e.target.closest('button');
		if (!b || b.disabled) return;
		if (b.classList.contains('schliessen')) { schliessen(); return; }
		const wahl = b.dataset.menue;
		if (!wahl) return;
		if (wahl in MENUE_AKTIONEN) {
			schliessen();
			Module._web_menue?.(MENUE_AKTIONEN[wahl]);
		} else if (wahl === 'spielstaende') {
			schliessen(); spielstaende();
		} else if (wahl === 'einstellungen') {
			schliessen(); einstellungen();
		} else if (wahl === 'start') {
			if (confirm('Zurück zum Startmenü? Nicht gespeicherter Fortschritt geht verloren.')) zumStartmenue();
		}
	});

	return { zeigen, schliessen, get offen() { return !el.hidden; } };
}
