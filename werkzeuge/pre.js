// Arbeitsverzeichnis auf die Spieldaten setzen und fehlende Dateien anlegen
Module.preRun = Module.preRun || [];
Module.preRun.push(function () {
	try { FS.mkdir('/spiel/TEMP'); } catch (e) {}
	try { FS.chdir('/spiel'); } catch (e) { console.warn('kein /spiel', e); }
	// GAMES.NAM (Namen der 5 Spielstände à 9 Bytes) entsteht erst beim ersten
	// Speichern. Fehlt sie, zeigt das Spiel beim Start eine Fehlermeldung.
	try { FS.stat('GAMES.NAM'); } catch (e) { FS.writeFile('GAMES.NAM', new Uint8Array(45)); }
});
