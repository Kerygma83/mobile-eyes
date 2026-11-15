#!/usr/bin/env python3
"""Wörterbuch für die Groß-/Kleinschreibung der Spieltexte im Overlay (werkzeuge/schreibung.js).

Die Texte des Spiels stehen in Großbuchstaben. Dieses Skript sammelt alle Wörter aus den
Spieldaten und ordnet sie mit hunspell (de_DE) ein:
  nur klein bekannt          → klein ("der", "und")
  nur groß bekannt           → Nomen ("Schwert")
  beides (Weg/weg)           → mehrdeutig, entscheidet der Kontext zur Laufzeit
  unbekannt, mit ß bekannt   → ß-Schreibung ("STRASSE" → "Straße")
  unbekannt                  → Name, groß ("Thorwal")
werkzeuge/schreibung-korrektur.txt geht vor.

Ausgabe (JSON): {"v": 1, "w": {WORT: form}}; form ist eine Zeichenkette oder bei mehrdeutigen
Wörtern [klein, groß, merkmale] (Bits, siehe schreibung.js):
  1 K  klein, groß nur nach Begleiter („das Essen“, „beim Laden“)
  2 A  Adjektiv: klein, wenn ein Nomen folgt („alter Mann“ / „das Alter“)
  4 V  Verbform: klein neben einem Pronomen („ich wünsche“ / „Eure Wünsche“)
  8 N  mit K: groß nur nach neutralem Begleiter (Infinitiv: „das Schweigen“)
Das Wörterbuch ist aus den Spieldaten abgeleitet: es gehört nur nach build/.

Aufruf (im Werkzeug-Container):
  /usr/bin/python3 werkzeuge/schreibung.py build/web/schreibung.json
  /usr/bin/python3 werkzeuge/schreibung.py --bericht build/schreibung-bericht.txt
"""
import collections
import itertools
import json
import os
import re
import sys

import hunspell

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUELLEN = ['spiel/SCHICK.DAT', 'spiel/SCHICKM.EXE', 'spiel/DSAGEN.DAT']
KORREKTUR = os.path.join(WURZEL, 'werkzeuge/schreibung-korrektur.txt')

DOS = {0x8e: 'Ä', 0x99: 'Ö', 0x9a: 'Ü', 0x84: 'ä', 0x94: 'ö', 0x81: 'ü', 0xe1: 'ß'}
ERLAUBT = set(range(0x20, 0x7f)) | set(DOS) | {0x0d, 0x0a, 0xf0, 0xf1, 0xf2, 0xf3}
WORT = re.compile(r'[A-ZÄÖÜß]+')
K, A, V, N = 1, 2, 4, 8
ENDUNG_ADJ = re.compile(r'(e|er|en|es|em|ere|eren|erer|eres|erem|ste|sten|ster|stes|stem|este|esten|ester|estes|estem)$')
# Unbekannte Wörter mit typischer Adjektivendung (orkisch, gottgefällige, abenteuerlustiger)
UNBEKANNT_ADJ = re.compile(r'(isch|lich|ig|bar|sam|haft)(e|er|en|es|em)?$')
VORSILBE = re.compile(r'(hinunter|herunter|hinüber|herüber|hinauf|herauf|hinaus|heraus|hinein|herein|hinab|herab'
                      r'|hindurch|herum|umher|hervor|hinterher|vorbei|vorüber|davon|weiter|zurück|zusammen|entgegen'
                      r'|empor|nieder|heran|hin|her|los|fest|frei|näher|nach|durch|an|ab|auf|aus|ein|mit|vor|zu|weg)(zu)?')
# Pronomen und Zahlwörter: auch nach Artikel klein (die anderen, die meisten, die beiden)
PRONOMENARTIG = re.compile(r'^(ander|meist|beid|einig|viel|wenig|selb|jen|solch|manch|all|eig|ein|kein|jed|dies|welch|mein|dein|sein|ihr|unser|euer|eur|letzt|erst|zweit|dritt|nächst|übrig|folgend|gleich|ganz|halb)')


def texte():
    """Alle Textstücke (durch NUL getrennt) aus den Spieldateien, die nach Spieltext aussehen."""
    for pfad in QUELLEN:
        with open(os.path.join(WURZEL, pfad), 'rb') as f:
            daten = f.read()
        for stueck in daten.split(b'\0'):
            if len(stueck) < 2 or any(b not in ERLAUBT for b in stueck):
                continue
            t = ''.join(DOS.get(b, chr(b)) for b in stueck)
            # Kleinbuchstaben außerhalb von Platzhaltern (%s, %-2d, %ld): kein Spieltext
            if re.search(r'[a-z]', re.sub(r'%[-+ 0-9.]*l?[sdxuc]', '', t)):
                continue
            # mindestens ein Wort aus drei Buchstaben oder zwei Wörter (Menüs: „JA“, „NEIN“)
            if not (re.search(r'[A-ZÄÖÜ]{3}', t) or re.search(r'[A-ZÄÖÜ]{2}\W+[A-ZÄÖÜ]{2}', t)):
                continue
            yield t


def korrekturen():
    """WORT form | WORT standard|nachArtikel  (# Kommentar)"""
    k = {}
    with open(KORREKTUR, encoding='utf-8') as f:
        for nr, zeile in enumerate(f, 1):
            zeile = zeile.split('#', 1)[0].strip()
            if not zeile:
                continue
            teile = zeile.split()
            if len(teile) != 2 or teile[0] != teile[0].upper():
                sys.exit(f'{KORREKTUR}:{nr}: erwartet „WORT schreibung“')
            wort, form = teile
            if '|' in form:
                a, b = form.split('|')
                k[wort] = [a, b, K]
            else:
                k[wort] = form
    return k


class Einordnung:
    def __init__(self):
        self.h = hunspell.HunSpell('/usr/share/hunspell/de_DE.dic', '/usr/share/hunspell/de_DE.aff')

    def ok(self, w):
        return self.h.spell(w)

    def stämme(self, w):
        return [s.decode() if isinstance(s, bytes) else s for s in self.h.stem(w)]

    def adjektivisch(self, k):
        """flektierte Form eines Adjektivs (alter → alt, schwere → schwer)"""
        for st in self.stämme(k):
            if st != k and st[:1].islower() and k.startswith(st) and ENDUNG_ADJ.fullmatch(k[len(st):]) \
                    and st in self.stämme(st):   # Stamm ist Grundform („wart“ → „sein“ zählt nicht)
                return True
        return False

    def adjektiv_grundform(self, k):
        """Grundform eines steigerbaren Adjektivs (tief: tiefer, tiefste)"""
        return self.ok(k + 'er') and (self.ok(k + 'ste') or self.ok(k + 'este'))

    def infinitiv(self, k):
        return re.search(r'(en|ern|eln)$', k) is not None and k in self.stämme(k)

    def verbform(self, k):
        """konjugierte Form eines Verbs (macht → machen, wünsche → wünschen)"""
        return any(st != k and st[:1].islower() and re.search(r'(en|ern|eln)$', st) for st in self.stämme(k))

    def nomen_nur(self, k):
        gross = k[0].upper() + k[1:]
        return not self.ok(k) and self.ok(gross)

    def form(self, wort):
        """(form, art) für ein Wort in Großbuchstaben; art für den Bericht"""
        for k in self.kandidaten(wort):
            gross = k[0].upper() + k[1:]
            klein_ok, gross_ok = self.ok(k), self.ok(gross)
            if klein_ok and gross_ok and any(s[:1].isupper() for s in self.stämme(gross)):
                verbartig = re.search(r'(en|ern|eln)$', k) is not None
                m = K if verbartig or self.adjektiv_grundform(k) else 0
                if self.adjektivisch(k):
                    m |= A
                if not verbartig and self.verbform(k):
                    m |= V
                return [k, gross, m], 'mehrdeutig'
            if klein_ok:
                # flektierte Adjektive nach Begleiter groß (das Gute, der Fremde), sonst klein
                if self.adjektivisch(k) and not PRONOMENARTIG.match(k):
                    return [k, gross, K | A], 'klein'
                # Infinitiv: groß nur nach neutralem Begleiter (das Schweigen, beim Laufen)
                if self.infinitiv(k):
                    return [k, gross, K | N], 'klein'
                return k, 'klein'
            if gross_ok:
                return gross, 'nomen'
        k = wort.lower()
        for v in self.kandidaten(wort):
            if UNBEKANNT_ADJ.search(v):
                return v, 'unbekannt-klein'
            # trennbares Verb: Vorsilbe + bekanntes kleines Wort (hinunter|klettern, an|schleichen)
            m = VORSILBE.match(v)
            if m and len(v) - m.end() >= 4 and self.ok(v[m.end():]) and not self.nomen_nur(v[m.end():]):
                return v, 'unbekannt-klein'
            # Zusammensetzung: das längste bekannte Endstück (mindestens 5 Buchstaben, davor
            # mindestens 2) entscheidet: weiter|marschieren, er|feilschen → klein, handels|straße → groß
            for i in range(2, len(v) - 4):
                rest = v[i:]
                if self.nomen_nur(rest):
                    return v[0].upper() + v[1:], 'unbekannt-nomen'
                if self.ok(rest):
                    gross = rest[0].upper() + rest[1:]
                    if any(s[:1].isupper() for s in self.stämme(gross)):
                        break   # Endstück mehrdeutig: lieber groß lassen (meist Name)
                    return v, 'unbekannt-klein'
        return k[0].upper() + k[1:], 'unbekannt'

    @staticmethod
    def kandidaten(wort):
        """Kleingeschrieben, dazu Varianten mit ß statt ss (die Texte schreiben „SS“)"""
        k = wort.lower()
        yield k
        stellen = [m.start() for m in re.finditer('ss', k)]
        for n in range(1, len(stellen) + 1):
            for wahl in itertools.combinations(stellen, n):
                if any(b - a < 2 for a, b in zip(wahl, wahl[1:])):
                    continue
                v = k
                for s in reversed(wahl):
                    v = v[:s] + 'ß' + v[s + 2:]
                yield v


def main():
    args = sys.argv[1:]
    bericht = None
    if args[:1] == ['--bericht']:
        bericht = args[1]
        args = args[2:]
    ziel = args[0] if args else None

    zaehl = collections.Counter()
    beispiele = collections.defaultdict(list)
    for t in texte():
        for m in WORT.finditer(t):
            w = m.group()
            zaehl[w] += 1
            if len(beispiele[w]) < 3:
                beispiele[w].append(re.sub(r'[@\r\n]', ' ', t[max(0, m.start() - 30):m.end() + 30]))

    kor = korrekturen()
    ein = Einordnung()
    woerter, arten = {}, collections.defaultdict(list)
    for w in sorted(zaehl):
        if w in kor:
            woerter[w] = kor[w]
            arten['korrektur'].append(w)
            continue
        form, art = ein.form(w)
        woerter[w] = form
        arten[art].append(w)
    # Korrekturen für Wörter, die nicht in den Daten vorkommen (Bausteine, Heldennamen-Teile)
    for w, f in kor.items():
        woerter.setdefault(w, f)

    if ziel:
        os.makedirs(os.path.dirname(os.path.abspath(ziel)), exist_ok=True)
        with open(ziel, 'w', encoding='utf-8') as f:
            json.dump({'v': 1, 'w': woerter}, f, ensure_ascii=False, separators=(',', ':'))
        print(f'{ziel}: {len(woerter)} Wörter', file=sys.stderr)

    if bericht:
        with open(bericht, 'w', encoding='utf-8') as f:
            for art in ('unbekannt', 'unbekannt-klein', 'unbekannt-nomen', 'mehrdeutig', 'nomen', 'klein', 'korrektur'):
                liste = sorted(arten[art], key=lambda w: -zaehl[w])
                f.write(f'== {art}: {len(liste)} Wörter, {sum(zaehl[w] for w in liste)} Vorkommen\n')
                for w in liste:
                    f.write(f'{zaehl[w]:5} {w:20} {woerter[w]}\n')
                    if art in ('unbekannt', 'unbekannt-klein', 'mehrdeutig'):
                        for b in beispiele[w][:2]:
                            f.write(f'        … {b}\n')
        print(f'{bericht} geschrieben', file=sys.stderr)


if __name__ == '__main__':
    main()
