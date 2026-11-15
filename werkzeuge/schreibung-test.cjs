// Regeln von schreibung.js mit einem kleinen, selbst geschriebenen Wörterbuch (keine Spieldaten).
// Aufruf: node werkzeuge/schreibung-test.cjs   (läuft in ./pruefen.sh mit)
'use strict';
const S = require('./schreibung.js');

const K = 1, A = 2, V = 4, N = 8;
const w = {
	DER: 'der', DIE: 'die', DAS: 'das', DEN: 'den', DEM: 'dem', EIN: 'ein', EINEN: 'einen', IM: 'im', AM: 'am',
	UND: 'und', IST: 'ist', ES: 'es', ICH: 'ich', WIR: 'wir', SIE: 'sie', MIT: 'mit', NACH: 'nach', ZU: 'zu',
	IHR: 'Ihr', EUCH: 'Euch', SAGT: 'sagt', ER: 'er', DREI: 'drei', ETWAS: 'etwas', AUS: 'aus',
	WIRT: 'Wirt', MANN: 'Mann', SCHWERT: 'Schwert', TAGE: 'Tage', TAGEN: 'Tagen', DUKATEN: 'Dukaten',
	KANN: 'kann', GEHT: 'geht', GUT: ['gut', 'Gut', K], BRICHT: 'bricht', WOLLEN: ['wollen', 'Wollen', K], WÄHLEN: 'wählen', HALT: ['halt', 'Halt', K], ZEIT: 'Zeit',
	WEG: ['weg', 'Weg', K], LADEN: ['laden', 'Laden', K], ESSEN: ['essen', 'Essen', K],
	FACKELN: ['fackeln', 'Fackeln', K], SCHWEIGEN: ['schweigen', 'Schweigen', K | N],
	ALTER: ['alter', 'Alter', A], GUTES: ['gutes', 'Gutes', A], BESTEN: ['besten', 'Besten', K | A],
	BEFESTIGTEN: ['befestigten', 'Befestigten', K | A], WÜNSCHE: ['wünsche', 'Wünsche', V],
	NICHTS: ['nichts', 'Nichts', K], HABT: 'habt', GROSSE: 'große', STRASSE: 'Straße',
	MU: 'MU', IN: 'in', STEIGERN: 'steigern', HEISST: 'heißt', GEHEN: ['gehen', 'Gehen', K | N],
};

let fehler = 0;
function pruefe(ein, aus) {
	const ist = S.umwandeln(ein, w);
	if (ist !== aus) { fehler++; console.log(`FEHLER\n  ein:  ${ein}\n  soll: ${aus}\n  ist:  ${ist}`); }
}

pruefe('DER WIRT IST WEG.', 'Der Wirt ist weg.');                        // Satzanfang, K ohne Begleiter
pruefe('IHR GEHT DEN WEG NACH THORWAL.', 'Ihr geht den Weg nach Thorwal.'); // K nach Begleiter, Name
pruefe('ES IST ZEIT@ZU ESSEN. DAS ESSEN IST GUT', 'Es ist Zeit@zu essen. Das Essen ist gut');  // @ trennt keinen Satz
pruefe('IM LADEN', 'Im Laden');
pruefe('MIT FACKELN UND NACH DREI TAGEN', 'Mit Fackeln und nach drei Tagen');   // Präposition, Zahlwort
pruefe('ER BRICHT DAS SCHWEIGEN. DAS WOLLEN WIR!', 'Er bricht das Schweigen. Das wollen wir!');  // N, Pronomen danach
pruefe('DIE GEHEN', 'Die gehen');                                       // N: „die“ ist kein neutraler Begleiter
pruefe('EIN ALTER MANN. DAS ALTER', 'Ein alter Mann. Das Alter');        // A vor Nomen
pruefe('ETWAS GUTES', 'Etwas Gutes');
pruefe('AM BESTEN EINEN BEFESTIGTEN WEG', 'Am besten einen befestigten Weg');
pruefe('ICH WÜNSCHE EUCH DIE WÜNSCHE', 'Ich wünsche Euch die Wünsche');   // V neben Pronomen
pruefe('AUS DEM NICHTS', 'Aus dem Nichts');
pruefe('<HALT!> SAGT DER WIRT. <HALT!> DER MANN', '„Halt!“ sagt der Wirt. „Halt!“ Der Mann');  // Anführungszeichen
pruefe('ER SAGT: ES IST WEG', 'Er sagt: Es ist weg');                   // nach Doppelpunkt groß
pruefe('MU STEIGERN~IN STEIGERN~IN THORWAL', 'MU steigern~IN steigern~In Thorwal');  // Kürzel, ~ = Spaltenanfang
pruefe('DIE GROSSE STRASSE HEISST', 'Die große Straße heißt');           // ß aus dem Wörterbuch
pruefe('3D 5S 2H', '3D 5S 2H');                                          // Geldbeträge bleiben
pruefe('ARBOSH HABT 3 DUKATEN', 'Arbosh habt 3 Dukaten');                // unbekannt (Heldenname) → groß
pruefe('WÄHLEN SIE DEN WEG', 'Wählen Sie den Weg');                      // Anrede
pruefe('DER WIRT SAGT', 'Der Wirt sagt');        // Farbzeichen
pruefe('Schon gemischt', 'Schon gemischt');                              // bereits gemischt: unverändert

if (fehler) { console.log(`schreibung: ${fehler} Fehler`); process.exit(1); }
console.log('schreibung: alle Regeln ok');
