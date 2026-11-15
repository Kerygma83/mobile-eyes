// Entpackt den GOG-Installer im Hintergrund (innoextract als WebAssembly, siehe innoextract-wasm.sh).
// Eingabe: { datei: File, muster: [RegExp-Quelltext …] } (Dateinamen in Großbuchstaben, die gebraucht werden). Die Datei wird per WORKERFS stückweise gelesen, nicht ganz kopiert.
// Meldungen: { text } Fortschritt, { fehler }, { dateien: [{ pfad, daten: ArrayBuffer }] } (nur app/…)
'use strict';
importScripts('innoextract.js');

onmessage = async (e) => {
	const { datei, muster } = e.data;
	const passt = (name) => muster.some((q) => new RegExp(q).test(name.toUpperCase()));
	const ausgabe = [];
	try {
		const m = await InnoExtract({
			print: (t) => {
				ausgabe.push(t);
				// innoextract meldet jede Datei als  - "app/SCHICK.DAT" (4.54 MiB)
				const datei = /^ - "(?:app\/)?([^"]+)"/.exec(t);
				if (datei) postMessage({ text: 'Entpacke ' + datei[1] });
			},
			printErr: (t) => ausgabe.push(t),
		});
		m.FS.mkdir('/ein');
		m.FS.mount(m.WORKERFS, { files: [datei] }, '/ein');
		m.FS.mkdir('/aus');
		postMessage({ text: 'Öffne den Installer …' });
		let code = 0;
		try {
			// nur app/ (das installierte Spiel), ohne Fortschrittsbalken und Farben
			code = m.callMain(['--extract', '--include', 'app', '--color=0', '--progress=0', '--output-dir', '/aus', `/ein/${datei.name}`]);
		} catch (ex) {
			code = ex?.status ?? 1;   // exit() wirft ExitStatus
		}
		if (code !== 0) {
			const meldung = ausgabe.filter((z) => /error|not a supported|unknown|corrupt/i.test(z)).slice(-2).join(' ');
			throw new Error('Das ist kein lesbarer GOG-Installer' + (meldung ? ` (${meldung})` : '') + '.');
		}
		const dateien = [];
		const sammeln = (verz) => {
			for (const n of m.FS.readdir(verz)) {
				if (n === '.' || n === '..') continue;
				const pfad = `${verz}/${n}`;
				if (m.FS.isDir(m.FS.stat(pfad).mode)) sammeln(pfad);
				else if (passt(n)) dateien.push({ pfad: pfad.replace(/^\/aus\//, ''), daten: m.FS.readFile(pfad).buffer });
			}
		};
		sammeln('/aus');
		postMessage({ dateien }, dateien.map((d) => d.daten));
	} catch (ex) {
		postMessage({ fehler: ex.message || String(ex) });
	}
};
