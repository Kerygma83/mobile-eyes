#!/usr/bin/env python3
"""Erzeugt BrightEyes/src/schick/datseg_status.h aus datseg.cpp.

Unter DOS lag der Spielzustand als ein Block im Datensegment (ds:0x2d34 bis
ds:0x4474, 5952 Bytes) und wurde unverändert in Spielstände geschrieben.
Nativ sind das einzelne Variablen an beliebigen Adressen. Die Tabelle nennt
für jede Variable ihren Platz im DOS-Block; save/load in seg026 setzen den
Block daraus zusammen. Die Größe jeder Variable prüft der Compiler gegen den
Abstand zur nächsten (static_assert), so fallen Abweichungen beim Bauen auf.

Aufruf: python3 werkzeuge/status-tabelle.py   (im Projektverzeichnis)
"""
import re
import sys
from pathlib import Path

START, END = 0x2d34, 0x4474
# enthalten Zeiger und werden vor jeder Benutzung neu aufgebaut (seg064: Hafen):
# im Spielstand Nullen, beim Laden unverändert
FLUECHTIG = {'gs_harbor_options'}
quelle = Path('BrightEyes/src/schick/datseg.cpp')
ziel = Path('BrightEyes/src/schick/datseg_status.h')

zeilen = quelle.read_text(encoding='latin-1').split('\n')
decl = re.compile(r'^\s*(?:static\s+)?((?:const\s+)?(?:unsigned\s+|signed\s+)?(?:struct\s+)?\w+)'
                  r'\s*(\*?)\s*(\w+)\s*((?:\[[^\]]*\])*)\s*(=|;)')

eintraege = {}
stapel = []   # je #if: True = Zweig wird nativ übersprungen
for i, z in enumerate(zeilen):
    s = z.strip()
    if s.startswith('#if'):
        stapel.append('BORLANDC' in s and '!' not in s)
        continue
    if s.startswith('#else'):
        stapel[-1] = not stapel[-1]
        continue
    if s.startswith('#endif'):
        stapel.pop()
        continue
    if any(stapel):
        continue
    m = re.search(r'ds:(0x[0-9a-fA-F]+)', z)
    if not m:
        continue
    adr = int(m.group(1), 16)
    if not START <= adr < END:
        continue
    if 'start of the BSS' in '\n'.join(zeilen[:i]):
        break   # echte Zeiger im BSS (nativ ausgelagert), nicht Teil des Blocks
    j = i
    d = decl.match(z.split('//')[0])
    while not d and j > 0:   # mehrzeilige Initialisierung: Deklaration steht weiter oben
        j -= 1
        d = decl.match(zeilen[j].split('//')[0])
    typ, zeiger, name, felder = d.group(1), d.group(2), d.group(3), d.group(4)
    if adr in eintraege:
        sys.exit(f'doppelte Adresse {adr:#x}: {eintraege[adr][0]} und {name}')
    eintraege[adr] = (name, bool(zeiger), f'{typ} {zeiger}{name}{felder}')

adressen = sorted(eintraege)
kopf = Path('BrightEyes/src/schick/datseg.h').read_text(encoding='latin-1')
fehlend = [eintraege[a][2] for a in adressen
           if not re.search(r'extern[^;]*\b' + eintraege[a][0] + r'\b', kopf)]
aus = [
    '/* Erzeugt von werkzeuge/status-tabelle.py aus datseg.cpp - nicht von Hand ändern.',
    ' * Spielzustand im DOS-Datensegment (ds:0x2d34-0x4474), wie er in Spielständen steht:',
    ' *   STATUS_VAR(offset, länge, variable)   Daten, länge = Platz unter DOS',
    ' *   STATUS_PTR(offset, länge, variable)   Zeiger (unter DOS 4 Byte), wird umgerechnet',
    ' *   STATUS_DUMMY(offset, länge, variable) Platzhalter für nativ ausgelagerte Zeiger',
    ' *   STATUS_SKIP(offset, länge, variable)  enthält Zeiger, wird neu aufgebaut: nicht gespeichert */',
    f'#define STATUS_DOS_LENGTH {END - START}',
    '#ifndef STATUS_DECLARED',
    '#define STATUS_DECLARED',
    '/* nicht in datseg.h deklariert */',
    *[f'extern {d};' for d in fehlend],
    '#endif',
]
for k, adr in enumerate(adressen):
    name, zeiger, _ = eintraege[adr]
    laenge = (adressen[k + 1] if k + 1 < len(adressen) else END) - adr
    art = ('STATUS_PTR' if zeiger else 'STATUS_SKIP' if name in FLUECHTIG
           else 'STATUS_DUMMY' if name.endswith('_obsolete') else 'STATUS_VAR')
    aus.append(f'{art}(0x{adr - START:04x}, {laenge}, {name})')
ziel.write_text('\n'.join(aus) + '\n', encoding='utf-8')
print(f'{ziel}: {len(adressen)} Einträge')
