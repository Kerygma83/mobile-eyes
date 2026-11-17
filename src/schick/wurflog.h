/*
 * Würfel-Log: Proben, Zauber und Kampfwürfe als lesbare Einträge.
 *
 * Nicht im DOS-Original (nur nativ). Ein Eintrag hat einen Titel, eine Ergebniszeile und
 * Detailzeilen mit den Einzelwürfen. Im Browser geht er an Module.wurfLog (Würfel-Panel),
 * sonst als eine Zeile nach stderr.
 *
 *   int offen = wlog_begin(WLOG_PROBE, "%s: Klettern %+d", wlog_spiel(hero->alias), handicap);
 *   wlog_detail("W20 = %d", wurf);
 *   wlog_result(WLOG_GUT, "bestanden");
 *   wlog_end(offen);
 *
 * Verschachtelt (z. B. Talentprobe -> test_attrib3): ein innerer wlog_begin() öffnet keinen
 * neuen Eintrag, sondern schreibt seinen Titel als Detailzeile; wlog_end() schließt nur den
 * Eintrag, den es geöffnet hat. wlog_result() setzt immer das Ergebnis des Eintrags (innen
 * zusätzlich als Detailzeile). Ohne offenen Eintrag tun wlog_detail/wlog_result nichts.
 *
 * Texte sind UTF-8. Spieltexte (Heldennamen, Gegnernamen: DOS-Zeichensatz, Großbuchstaben)
 * mit wlog_spiel() einbetten; die Seite wandelt sie um.
 */
#ifndef WURFLOG_H
#define WURFLOG_H

#if !defined(__BORLANDC__)

/* Art des Eintrags */
#define WLOG_PROBE	1	/* Eigenschafts-/Talentprobe */
#define WLOG_ZAUBER	2	/* Zauberprobe (auch gegnerische) */
#define WLOG_KAMPF	3	/* Angriff im Kampf */
#define WLOG_RUNDE	4	/* Trenner: Kampfrunde / Kampfbeginn */
#define WLOG_SONST	5	/* AP, Krankheit u. a. */

/* Ausgang aus Sicht der Helden */
#define WLOG_PATZER	-2
#define WLOG_SCHLECHT	-1
#define WLOG_NEUTRAL	0
#define WLOG_GUT	1
#define WLOG_GLUECK	2

/* für wlog_end(): Eintrag des Aufrufers fortgesetzt, nichts schließen */
#define WLOG_WEITER	-1

#if defined(__GNUC__)
#define WLOG_PRINTF(f, a) __attribute__((format(printf, f, a)))
#else
#define WLOG_PRINTF(f, a)
#endif

int wlog_begin(const int art, const char *fmt, ...) WLOG_PRINTF(2, 3);
void wlog_detail(const char *fmt, ...) WLOG_PRINTF(1, 2);
void wlog_result(const int erfolg, const char *fmt, ...) WLOG_PRINTF(2, 3);
void wlog_result_add(const int erfolg, const char *fmt, ...) WLOG_PRINTF(2, 3);
void wlog_end(const int offen);
/* offenen Eintrag abschicken (Sicherheitsnetz an Stellen ohne Probe, etwa Spielschleife) */
void wlog_flush(void);
/* Zauber im Kampf: den nächsten Eintrag nach wlog_end() offen halten, damit die Wirkung (Schaden)
 * noch ins Ergebnis kommt; wlog_freigeben() schickt ihn ab */
void wlog_halten(void);
void wlog_freigeben(void);
/* einzelne Meldung ohne Details */
void wlog_note(const int art, const int erfolg, const char *fmt, ...) WLOG_PRINTF(3, 4);
int wlog_active(void);

/* Spieltext (DOS-Zeichensatz) zum Einbetten; 8 Puffer im Wechsel */
const char *wlog_spiel(const char *dos);
/* Gegnername (Einzahl, ohne Artikel) zu einer Monster-ID */
const char *wlog_monster(const signed int monster_id);
/* Würfelformel aus den Gegnerdaten (n*Wm+x, wie dice_template) */
const char *wlog_formel(const unsigned short val);

#endif
#endif
