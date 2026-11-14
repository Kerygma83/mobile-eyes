// Arbeitsverzeichnis auf die Spieldaten setzen, fehlende Dateien anlegen und
// Spielstände dauerhaft im Browser halten (IndexedDB).
//
// /spiel liegt nur im Arbeitsspeicher. Spielstände (*.GAM und GAMES.NAM mit den
// Namen der 5 Plätze) liegen zusätzlich in /spielstand (IDBFS): beim Start von dort
// nach /spiel kopiert, nach jedem Speichern im Spiel zurück (Module.spielstaendeSichern,
// aufgerufen aus save_game_state in seg026).
const SPIELSTAND = '/spielstand';
const istSpielstand = (name) => name === 'GAMES.NAM' || /\.GAM$/i.test(name);

function kopiereSpielstaende(von, nach, aufraeumen) {
	const dateien = FS.readdir(von).filter(istSpielstand);
	for (const name of dateien) FS.writeFile(`${nach}/${name}`, FS.readFile(`${von}/${name}`));
	// beim Sichern: überschriebene oder umbenannte Spielstände auch dort entfernen
	if (aufraeumen) {
		for (const name of FS.readdir(nach).filter(istSpielstand)) {
			if (!dateien.includes(name)) FS.unlink(`${nach}/${name}`);
		}
	}
	return dateien.length;
}

Module.spielstaendeSichern = function () {
	try {
		kopiereSpielstaende('/spiel', SPIELSTAND, true);
		FS.syncfs(false, (fehler) => {
			if (fehler) console.warn('Spielstände nicht gesichert', fehler);
			Module.spielstaendeGesichert?.(!fehler);
		});
	} catch (e) {
		console.warn('Spielstände nicht gesichert', e);
		Module.spielstaendeGesichert?.(false);
	}
};

Module.preRun = Module.preRun || [];
Module.preRun.push(function () {
	try { FS.mkdir('/spiel/TEMP'); } catch (e) {}
	try { FS.chdir('/spiel'); } catch (e) { console.warn('kein /spiel', e); }

	const fertig = () => {
		// GAMES.NAM (Namen der 5 Spielstände à 9 Bytes) entsteht erst beim ersten
		// Speichern. Fehlt sie, zeigt das Spiel beim Start eine Fehlermeldung.
		try { FS.stat('GAMES.NAM'); } catch (e) { FS.writeFile('GAMES.NAM', new Uint8Array(45)); }
	};

	try {
		FS.mkdir(SPIELSTAND);
		FS.mount(IDBFS, {}, SPIELSTAND);
	} catch (e) {
		console.warn('kein dauerhafter Speicher', e);
		fertig();
		return;
	}
	// Spiel erst starten, wenn die Spielstände geladen sind
	addRunDependency('spielstaende');
	FS.syncfs(true, (fehler) => {
		if (fehler) console.warn('Spielstände nicht geladen', fehler);
		try {
			const n = kopiereSpielstaende(SPIELSTAND, '/spiel', false);
			if (n) console.log(`${n} Spielstand-Dateien geladen`);
		} catch (e) { console.warn('Spielstände nicht geladen', e); }
		fertig();
		removeRunDependency('spielstaende');
	});
});
