// Arbeitsverzeichnis auf die Spieldaten setzen, fehlende Dateien anlegen und
// Spielstände dauerhaft im Browser halten (IndexedDB).
//
// /spiel liegt nur im Arbeitsspeicher. Spielstände (*.GAM und GAMES.NAM mit den
// Namen der 5 Plätze) und Helden (*.CHR, auch aus der Heldenerschaffung gen.html)
// liegen zusätzlich in /spielstand (IDBFS): beim Start von dort
// nach /spiel kopiert, nach jedem Speichern im Spiel zurück (Module.spielstaendeSichern,
// aufgerufen aus save_game_state in seg026).
const SPIELSTAND = '/spielstand';
const istSpielstand = (name) => name === 'GAMES.NAM' || /\.(GAM|CHR)$/i.test(name);

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

// nach der Heldenerschaffung (eigene Seite, gleiche Datenbank): neue Helden holen,
// ins Spielverzeichnis und nach TEMP (dort sucht der Tempel)
Module.heldenNachladen = () => new Promise((fertig) => {
	FS.syncfs(true, (fehler) => {
		if (fehler) console.warn('Helden nicht geladen', fehler);
		try {
			for (const name of FS.readdir(SPIELSTAND).filter((n) => /\.CHR$/i.test(n))) {
				let neu = true;
				try { FS.stat(`/spiel/${name}`); neu = false; } catch (e) {}
				if (!neu) continue;
				const daten = FS.readFile(`${SPIELSTAND}/${name}`);
				FS.writeFile(`/spiel/${name}`, daten);
				FS.writeFile(`/spiel/TEMP/${name}`, daten);
				console.log('neuer Held', name);
			}
		} catch (e) { console.warn('Helden nicht geladen', e); }
		fertig();
	});
});

Module.preRun = Module.preRun || [];
// Builds ohne eingebaute Spieldaten: die Seite liefert sie (daten.js, IndexedDB; beim ersten
// Start erst nach dem Import). Das Spiel startet erst, wenn sie in /spiel liegen.
Module.preRun.push(function () {
	if (!Module.spieldatenHolen) return;
	addRunDependency('spieldaten');
	Module.spieldatenHolen().then((dateien) => {
		FS.mkdirTree('/spiel');
		for (const [name, daten] of dateien) FS.writeFile(`/spiel/${name}`, daten);
		removeRunDependency('spieldaten');
	}, (e) => {
		console.warn('Spieldaten nicht geladen', e);
		Module.setStatus?.('Spieldaten nicht geladen – siehe Konsole');
	});
});
Module.preRun.push(function () {
	try { FS.mkdirTree('/spiel/TEMP'); } catch (e) {}
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
