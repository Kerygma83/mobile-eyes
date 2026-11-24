// Groß-/Kleinschreibung der Spieltexte im Overlay (dialog.js).
//
// Die Texte des Spiels stehen in Großbuchstaben. Mit dem Wörterbuch aus werkzeuge/schreibung.py
// (schreibung.json, aus den Spieldaten abgeleitet) wird daraus normale Schreibung: alles klein,
// Nomen und Namen groß, Satzanfänge groß. Mehrdeutige Wörter entscheidet der Kontext.
//
//   Schreibung.umwandeln(text, woerter)   text: dekodierter Spieltext (Großbuchstaben, ÄÖÜ;
//                                         @ = Umbruch, ~ = Tabulator, – = Farbe)
//
// Einträge im Wörterbuch (Schlüssel: Wort in Großbuchstaben):
//   'form'                 immer so
//   [klein, groß, bits]    mehrdeutig; bits: K klein, nach Begleiter groß („das Essen“)
//                                            A Adjektiv: klein vor Nomen („alter Mann“)
//                                            V Verbform: klein neben Pronomen („ich wünsche“)
//                                            N mit K: nur nach neutralem Begleiter („das Schweigen“)
// Unbekannte Wörter (Heldennamen u. a.) werden groß geschrieben.
'use strict';

const Schreibung = (() => {
	const K = 1, A = 2, V = 4, N = 8;
	const menge = (s) => new Set(s.split(' '));
	// Begleiter: danach steht ein Nomen (oder ein Adjektiv vor dem Nomen)
	const BEGLEITER = menge('der die das den dem des ein eine einen einem einer eines kein keine keinen keinem keiner keines ' +
		'mein meine meinen meinem meiner meines dein deine deinen deinem deiner deines sein seine seinen seinem seiner seines ' +
		'unser unsere unseren unserem unserer unseres euer eure euren eurem eurer eures ihre ihren ihrem ihrer ihres ' +
		'dieser diese diesen diesem dieses jener jene jenen jenem jenes jede jeden jedem jedes welche welchen ' +
		'welchem welches mancher manche manchen solche solchen beim zum zur vom im ins am ans aufs übers');
	// „jeder“ steht oft allein („das kann jeder sagen“): kein Begleiter
	// vor nominalisiertem Infinitiv („das Schweigen“, „beim Laufen“)
	const NEUTRAL = menge('das dem des ein einem eines kein keinem keines mein meinem meines dein deinem deines ' +
		'sein seinem seines unser unserem unseres euer eurem eures ihrem ihres dieses diesem jedes jedem welches welchem ' +
		'beim zum vom im ins am ans aufs übers');
	// vor nominalisiertem Adjektiv auf -es: „etwas Gutes“, „nichts Neues“
	const MENGENWORT = menge('etwas nichts alles viel wenig allerlei genug');
	// vor Nomen ohne Artikel („mit Fackeln“, „nach drei Tagen“); nicht „zu“ (zu sehen)
	const PRAEPOSITION = menge('mit in an auf aus bei nach von vor um über unter ohne gegen durch für seit bis zwischen ' +
		'hinter neben wegen trotz');
	const ZAHLWORT = menge('zwei drei vier fünf sechs sieben acht neun zehn elf zwölf zwanzig dreißig hundert tausend');
	const PRONOMEN = menge('ich du er sie es wir ihr man euch mich dich uns sich mir dir ihm');
	// „IN“ ist vor diesen Wörtern bzw. vor ~ oder Zahl die Eigenschaft Intuition
	// nach „…!>“ bzw. „…?>“ klein weiter („Halt!“, ruft er)
	const SPRECHVERB = menge('sagt sagte ruft rief fragt fragte meint meinte antwortet antwortete brüllt brüllte schreit ' +
		'schrie flüstert flüsterte murmelt murmelte erwidert erwiderte entgegnet entgegnete brummt brummte knurrt ' +
		'knurrte lacht lachte grinst grinste stöhnt stöhnte seufzt seufzte zischt zischte kreischt kreischte jammert ' +
		'jammerte erklärt erklärte grummelt grummelte');
	const IN_KUERZEL = menge('STEIGERN ELIXIER ELIXIERE');

	const WORT = /[A-ZÄÖÜß]+/g;
	const gross = (s) => s.charAt(0).toUpperCase() + s.slice(1);

	function umwandeln(text, woerter) {
		if (!text || !woerter || /[a-z]/.test(text)) return text;   // schon gemischt geschrieben
		// Wörter mit ihrem Abstand zum Vorgänger (Satzzeichen, Leerzeichen)
		const w = [];
		let ende = 0;
		for (const m of text.matchAll(WORT)) {
			w.push({ wort: m[0], start: m.index, vor: text.slice(ende, m.index), e: woerter[m[0]] });
			ende = m.index + m[0].length;
		}
		const nur = (s) => /^[ @]*$/.test(s);   // nur Leerraum (Zeilenumbruch @ trennt keinen Satz)
		const prev = (i) => (i > 0 && nur(w[i].vor)) ? w[i - 1] : null;
		const next = (i) => (i + 1 < w.length && nur(w[i + 1].vor)) ? w[i + 1] : null;
		const klein = (x) => x?.wort.toLowerCase();
		const bits = (x) => Array.isArray(x?.e) ? x.e[2] : 0;
		// Adjektiv, das meist klein steht (nicht „Ziele“, das auch Verbform/Adjektiv sein könnte)
		const adjektiv = (x) => (bits(x) & (A | K)) === (A | K);
		// kann ein Nomen sein (nach einem Adjektiv: „befestigten Weg“, „das gute Essen“)
		// streng: nur eindeutige Nomen (für Wörter, die selbst meist Nomen sind: „Ziele treffen“)
		const nomenhaft = (x, streng) => {
			if (!x) return false;
			if (x.e === undefined) return true;                          // Name
			if (Array.isArray(x.e)) return !streng;                      // mehrdeutig
			return x.e.charAt(0) !== x.e.charAt(0).toLowerCase();
		};
		// Begleiter, aber nicht als Relativpronomen direkt nach Komma („…, die gehen“)
		const begleiter = (x, i, liste = BEGLEITER) => x && liste.has(klein(x)) && !/,\s*$/.test(w[i].vor);

		function entscheide(i) {
			const x = w[i], [k, g, b] = x.e;
			const p1 = prev(i), n1 = next(i);
			if ((b & V) && (PRONOMEN.has(klein(p1)) || PRONOMEN.has(klein(n1)))) return k;
			if ((b & K) && p1 && k.endsWith('es') && MENGENWORT.has(klein(p1))) return g;   // „etwas Gutes“
			if (b & A) {
				// Adjektiv vor Nomen (auch über weitere Adjektive: „die alte graue Katze“)
				let n = n1, j = i + 1;
				while (n && adjektiv(n) && j < i + 4) { j++; n = next(j - 1); }
				if (n && nomenhaft(n, !(b & K))) return k;
			}
			if (!(b & K)) return g;
			if (PRONOMEN.has(klein(n1))) return k;                  // „das wollen wir“, „die suchen Euch“
			const p2 = p1 && prev(i - 1);
			const liste = (b & N) ? NEUTRAL : BEGLEITER;
			if (klein(p1) === 'am' && k.endsWith('sten')) return k;   // „am besten“
			if (p1 && begleiter(p1, i - 1, liste)) return g;
			if (p2 && adjektiv(p1) && begleiter(p2, i - 2, liste)) return g;   // „das lange Warten“
			if (b & N) return k;
			if (!(b & A) && p1 && (PRAEPOSITION.has(klein(p1)) || ZAHLWORT.has(klein(p1)) || adjektiv(p1))) return g;
			if (!(b & A) && !p1 && /\d\s*$/.test(x.vor)) return g;        // „3 Fackeln“
			return k;
		}

		let aus = '';
		let satzanfang = true;
		for (let i = 0; i < w.length; i++) {
			const x = w[i];
			aus += x.vor;
			// Satzanfang: Textbeginn, nach . ! ? : ~ und öffnendem <; nach „…!>“ nicht vor
			// einem Sprechverb („Halt!“ ruft er), nach „…,>“ nie
			const zeichen = x.vor.replace(/[^.!?:<>~]/g, '');
			if (/[.!?:<~]$/.test(zeichen) || /^[\s@]*$/.test(aus)) satzanfang = true;
			else if (/[.!?]>$/.test(zeichen) && !SPRECHVERB.has(x.wort.toLowerCase())) satzanfang = true;
			let form;
			const nebenZahl = /\d$/.test(x.vor) || /^\d/.test(text.slice(x.start + x.wort.length));
			if (x.wort.length <= 2 && nebenZahl) form = x.wort;          // Geld und Würfel: 3D, 1W6
			else if (x.wort === 'IN' && (IN_KUERZEL.has(next(i)?.wort) || /^\s*[~\d]/.test(text.slice(x.start + 2)))) form = 'IN';
			// Anrede nach Verb am Satzanfang: „Wählen Sie …“, „Wollen Sie …“
			else if (x.wort === 'SIE' && i > 0 && w[i - 1].satzanfang && /EN$/.test(w[i - 1].wort) && nur(x.vor)) form = 'Sie';
			else if (x.e === undefined) form = gross(x.wort.toLowerCase());
			else if (typeof x.e === 'string') form = x.e;
			else form = entscheide(i);
			if (satzanfang) form = gross(form);
			x.satzanfang = satzanfang;
			satzanfang = false;
			aus += form;
		}
		aus += text.slice(ende);
		// <…> sind im Spiel Anführungszeichen
		return aus.replace(/<([^<>]*)>/g, '„$1“').replace(/</g, '„');
	}

	return { umwandeln };
})();

if (typeof module !== 'undefined') module.exports = Schreibung;
