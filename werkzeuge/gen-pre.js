// Heldenerschaffung (ngen) im Browser. Wird vom Spiel in einem iframe geöffnet,
// wie im Original per spawnl("gen.exe", "b", "a"|"n", …).
//
// Parameter aus der Adresse: gen.html?intro  → nur das Logo-Intro
//                            gen.html?a / ?n → Heldenerschaffung (Fortgeschritten / Anfänger)
// Neue Helden (*.CHR) landen in /spielstand (IDBFS, dieselbe Datenbank wie im Spiel);
// danach meldet die Seite dem Spiel „fertig“ (postMessage).
const SPIELSTAND = '/spielstand';
const parameter = location.search.replace(/^\?/, '').split('&')[0];   // weitere: &original

Module.arguments = parameter === 'intro' ? ['intro']
	: ['b', parameter === 'n' ? 'n' : 'a', '0'];   // "0": ohne Musik (Ton folgt in Stufe 6)

function melden() {
	(window.parent !== window ? window.parent : window).postMessage({ gen: 'fertig' }, location.origin);
}

Module.genFertig = function () {
	try {
		const neu = FS.readdir('/gen').filter((n) => /\.CHR$/i.test(n));
		for (const name of neu) FS.writeFile(`${SPIELSTAND}/${name.toUpperCase()}`, FS.readFile(`/gen/${name}`));
		if (neu.length) console.log('neue Helden:', neu.join(', '));
		FS.syncfs(false, (fehler) => {
			if (fehler) console.warn('Helden nicht gesichert', fehler);
			melden();
		});
	} catch (e) {
		console.warn('Helden nicht gesichert', e);
		melden();
	}
};

Module.preRun = Module.preRun || [];
// ohne eingebaute Spieldaten: DSAGEN.DAT von der Seite (daten.js, IndexedDB)
Module.preRun.push(function () {
	if (!Module.spieldatenHolen) return;
	addRunDependency('spieldaten');
	Module.spieldatenHolen().then((dateien) => {
		FS.mkdirTree('/gen');
		for (const [name, daten] of dateien) FS.writeFile(`/gen/${name}`, daten);
		removeRunDependency('spieldaten');
	}, (e) => console.warn('Spieldaten nicht geladen', e));
});
Module.preRun.push(function () {
	try { FS.mkdirTree('/gen/TEMP'); } catch (e) {}   // ngen legt neue Helden auch dort ab
	try { FS.chdir('/gen'); } catch (e) { console.warn('kein /gen', e); }
	try {
		FS.mkdir(SPIELSTAND);
		FS.mount(IDBFS, {}, SPIELSTAND);
		addRunDependency('spielstaende');
		FS.syncfs(true, () => removeRunDependency('spielstaende'));
	} catch (e) {
		console.warn('kein dauerhafter Speicher', e);
	}
});
