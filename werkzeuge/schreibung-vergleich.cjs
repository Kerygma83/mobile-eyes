// Belegt, dass das knappe Wörterbuch (schreibung.py --knapp, Build ohne Spieldaten) jeden Spieltext
// genauso schreibt wie das vollständige. Aufruf: node schreibung-vergleich.cjs voll.json knapp.json texte.json
// (läuft in ./pruefen.sh mit; texte.json aus schreibung.py --texte)
'use strict';
const fs = require('fs');
const S = require('./schreibung.js');
const [voll, knapp, texte] = process.argv.slice(2).map((p) => JSON.parse(fs.readFileSync(p, 'utf8')));
const woerter = (j) => Object.assign(Object.create(null), j.w, { SIE: 'Sie', IHNEN: 'Ihnen' });   // wie gen-shell.html
const v = woerter(voll), k = woerter(knapp);
let fehler = 0;
for (const t of texte) {
	const a = S.umwandeln(t, v), b = S.umwandeln(t, k);
	if (a !== b && ++fehler <= 5) console.log(`ABWEICHUNG\n  voll:  ${a}\n  knapp: ${b}`);
}
console.log(`Schreibung knapp/voll: ${texte.length} Texte, ${Object.keys(voll.w).length} → ${Object.keys(knapp.w).length} Wörter, ${fehler} Abweichungen`);
process.exit(fehler ? 1 : 0);
