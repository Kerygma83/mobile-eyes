/*
 * Würfel-Log (siehe wurflog.h). Nicht im DOS-Original.
 */
#if !defined(__BORLANDC__)

#include <stdarg.h>
#include <stdio.h>
#include <string.h>

#include "v302de.h"
#include "common.h"
#include "datseg.h"
#include "wurflog.h"

#if defined(__EMSCRIPTEN__)
#include <emscripten.h>

/* Texte als Bytes an die Seite: UTF-8, Spieltexte zwischen 0x01 und 0x02 im DOS-Zeichensatz */
EM_JS(void, web_wurflog, (int art, int erfolg, const char *titel, const char *ergebnis, const char *details), {
	if (!Module.wurfLog) return;
	const s = (p) => {
		const b = [];
		while (HEAPU8[p]) b.push(HEAPU8[p++]);
		return b;
	};
	Module.wurfLog({ art, erfolg, titel: s(titel), ergebnis: s(ergebnis), details: s(details) });
});
#endif

static struct {
	int tiefe;
	int art;
	int erfolg;
	char titel[200];
	char ergebnis[240];
	char details[2400];
} e;

static int g_halten;	/* 1: nächsten Eintrag halten, 2: Eintrag gehalten (noch offen) */

static void anhaengen(char *ziel, const size_t groesse, const char *fmt, va_list ap)
{
	const size_t l = strlen(ziel);
	if (l + 1 < groesse) {
		vsnprintf(ziel + l, groesse - l, fmt, ap);
	}
}

static void detail_zeile(const char *fmt, va_list ap)
{
	int i;
	if (e.details[0]) {
		strncat(e.details, "\n", sizeof(e.details) - strlen(e.details) - 1);
	}
	/* Einrückung: verschachtelte Proben */
	for (i = 1; i < e.tiefe; i++) {
		strncat(e.details, "\t", sizeof(e.details) - strlen(e.details) - 1);
	}
	anhaengen(e.details, sizeof(e.details), fmt, ap);
}

static void detail_text(const char *text, ...)
{
	va_list ap;
	va_start(ap, text);
	detail_zeile(text, ap);
	va_end(ap);
}

int wlog_active(void)
{
	return e.tiefe > 0;
}

int wlog_begin(const int art, const char *fmt, ...)
{
	va_list ap;
	va_start(ap, fmt);

	if (e.tiefe == 0) {
		e.art = art;
		e.erfolg = WLOG_NEUTRAL;
		e.titel[0] = e.ergebnis[0] = e.details[0] = '\0';
		vsnprintf(e.titel, sizeof(e.titel), fmt, ap);
		e.tiefe = 1;
		va_end(ap);
		return 1;
	}

	/* verschachtelt: Titel als Detailzeile */
	detail_zeile(fmt, ap);
	e.tiefe++;
	va_end(ap);
	return 0;
}

void wlog_detail(const char *fmt, ...)
{
	va_list ap;
	if (e.tiefe == 0) return;
	va_start(ap, fmt);
	detail_zeile(fmt, ap);
	va_end(ap);
}

void wlog_result(const int erfolg, const char *fmt, ...)
{
	va_list ap;
	if (e.tiefe == 0) return;

	va_start(ap, fmt);
	e.ergebnis[0] = '\0';
	anhaengen(e.ergebnis, sizeof(e.ergebnis), fmt, ap);
	va_end(ap);
	e.erfolg = erfolg;

	if (e.tiefe > 1) {
		detail_text("→ %s", e.ergebnis);
	}
}

void wlog_result_add(const int erfolg, const char *fmt, ...)
{
	va_list ap;
	if (e.tiefe == 0) return;

	if (e.ergebnis[0]) {
		strncat(e.ergebnis, ", ", sizeof(e.ergebnis) - strlen(e.ergebnis) - 1);
	}
	va_start(ap, fmt);
	anhaengen(e.ergebnis, sizeof(e.ergebnis), fmt, ap);
	va_end(ap);
	e.erfolg = erfolg;
}

static void senden(void)
{
#if defined(__EMSCRIPTEN__)
	web_wurflog(e.art, e.erfolg, e.titel, e.ergebnis, e.details);
#else
	/* nativ eine Zeile, Spieltext-Marken entfernt */
	char zeile[sizeof(e.titel) + sizeof(e.ergebnis) + sizeof(e.details) + 8];
	char *z;
	snprintf(zeile, sizeof(zeile), "%s: %s [%s]", e.titel, e.ergebnis, e.details);
	for (z = zeile; *z; z++) {
		if (*z == '\x01' || *z == '\x02') *z = '"';
		else if (*z == '\n' || *z == '\t') *z = ' ';
	}
	D1_INFO("%s\n", zeile);
#endif
}

void wlog_end(const int offen)
{
	if (e.tiefe == 0 || offen == WLOG_WEITER) return;
	e.tiefe--;
	if (offen) {
		if (g_halten == 1) {
			/* offen lassen: die Wirkung folgt (wlog_freigeben) */
			e.tiefe = 1;
			g_halten = 2;
			return;
		}
		/* ein offen gebliebener innerer Eintrag zählt mit */
		e.tiefe = 0;
		senden();
	}
}

void wlog_halten(void)
{
	if (e.tiefe == 0) g_halten = 1;
}

void wlog_freigeben(void)
{
	if (g_halten == 2 && e.tiefe > 0) {
		e.tiefe = 0;
		senden();
	}
	g_halten = 0;
}

void wlog_flush(void)
{
	g_halten = 0;
	if (e.tiefe > 0) {
		e.tiefe = 0;
		senden();
	}
}

void wlog_note(const int art, const int erfolg, const char *fmt, ...)
{
	va_list ap;

	if (e.tiefe > 0) {
		/* während einer Probe: als Detail */
		va_start(ap, fmt);
		detail_zeile(fmt, ap);
		va_end(ap);
		return;
	}

	e.art = art;
	e.erfolg = erfolg;
	e.ergebnis[0] = e.details[0] = '\0';
	va_start(ap, fmt);
	vsnprintf(e.titel, sizeof(e.titel), fmt, ap);
	va_end(ap);
	senden();
}

const char *wlog_spiel(const char *dos)
{
	static char puffer[8][48];
	static int nr = 0;
	char *p = puffer[nr];
	nr = (nr + 1) % 8;
	snprintf(p, sizeof(puffer[0]), "\x01%s\x02", dos ? dos : "");
	return p;
}

const char *wlog_monster(const signed int monster_id)
{
	char name[40];
	const char *s = g_monnames_index ? g_monnames_index[monster_id] : NULL;
	size_t i = 0;

	if (!s) return wlog_spiel("?");
	/* Einzahl: bis zum Punkt (danach Pluralendungen, siehe GUI_name_plural) */
	while (s[i] && s[i] != '.' && i < sizeof(name) - 1) {
		name[i] = s[i];
		i++;
	}
	name[i] = '\0';
	return wlog_spiel(name);
}

const char *wlog_formel(const unsigned short val)
{
	static char puffer[4][16];
	static int nr = 0;
	char *p = puffer[nr];
	const int n = (val >> 12) & 0xf;
	const int i = (val >> 8) & 0xf;
	const int m = (i == 1) ? 6 : ((i == 2) ? 20 : ((i == 3) ? 3 : 4));
	const signed char x = (signed char)(val & 0xff);

	nr = (nr + 1) % 4;
	if (x) {
		snprintf(p, sizeof(puffer[0]), "%dW%d%+d", n, m, x);
	} else {
		snprintf(p, sizeof(puffer[0]), "%dW%d", n, m);
	}
	return p;
}

/* ---- Ereignisse ---- */

void wlog_kampfbeginn(const signed int fight_id, const signed int obergrenze)
{
	char name[20];
	char liste[sizeof(e.details) / 2];
	int i, gegner = 0, spaeter = 0;
	int offen;

	if (!g_current_fight) return;
	memcpy(name, g_current_fight->name, sizeof(g_current_fight->name));
	name[sizeof(g_current_fight->name)] = '\0';

	offen = wlog_begin(WLOG_KAMPFBEGINN, "Kampf %d: %s", fight_id, name);
	if (obergrenze > 0) {
		wlog_detail("Gegnerzahl gewürfelt: höchstens %d aus der Kampfliste", obergrenze);
	}
	liste[0] = '\0';
	for (i = 0; i < 20; i++) {
		const struct fight_enemy *f = &g_current_fight->enemies[i];
		if (!f->id) continue;
		gegner++;
		if (f->round_appear) spaeter++;
		if (g_monster_dat_buf) {
			char eintrag[80];
			if (f->round_appear) {
				snprintf(eintrag, sizeof(eintrag), "%s%s (ab Runde %d)", liste[0] ? ", " : "",
					wlog_monster(g_monster_dat_buf[(unsigned char)f->id].monster_id), f->round_appear + 1);
			} else {
				snprintf(eintrag, sizeof(eintrag), "%s%s", liste[0] ? ", " : "",
					wlog_monster(g_monster_dat_buf[(unsigned char)f->id].monster_id));
			}
			strncat(liste, eintrag, sizeof(liste) - strlen(liste) - 1);
		}
	}
	if (liste[0]) wlog_detail("%s", liste);
	if (spaeter) {
		wlog_result(WLOG_NEUTRAL, "%d Gegner, davon %d später", gegner, spaeter);
	} else {
		wlog_result(WLOG_NEUTRAL, "%d Gegner", gegner);
	}
	wlog_end(offen);
}

void wlog_lager(const int dungeon, const int stunden, const int wache, const int wurf, const int schwelle,
		const int travia, const int vorfall)
{
	const int offen = wlog_begin(WLOG_EREIGNIS, "%s: Überfall?", dungeon ? "Lager im Dungeon" : "Nachtlager");

	if (dungeon) {
		wlog_detail("W100 = %d, Überfall unter %d (%d Std.%s)", wurf, schwelle, stunden,
			wache ? ", mit Wache" : " × 4, ohne Wache");
	} else {
		wlog_detail("W100 = %d, Überfall unter %d (%s)", wurf, schwelle, wache ? "mit Wache" : "ohne Wache");
	}
	if (wurf >= schwelle) {
		wlog_result(WLOG_GUT, "kein Überfall");
	} else if (travia) {
		wlog_detail("Travias Segen hält den Überfall ab");
		wlog_result(WLOG_GLUECK, "kein Überfall (Travia)");
	} else {
		wlog_detail("Wache: W3 = %d", vorfall + 1);
		wlog_result(WLOG_SCHLECHT, "Überfall in der %d. Wache", vorfall + 1);
	}
	wlog_end(offen);
}

void wlog_reisetag(const int w_begegnung, const int s_begegnung, const int w_kampf, const int s_kampf)
{
	const int begegnung = (w_begegnung <= s_begegnung);
	const int kampf = (w_kampf <= s_kampf);
	const int offen = wlog_begin(WLOG_EREIGNIS, "Reisetag: Begegnung und Kampf?");

	wlog_detail("Zufallsbegegnung: W100 = %d, bis %d", w_begegnung, s_begegnung);
	wlog_detail("Kampf: W100 = %d, bis %d", w_kampf, s_kampf);
	if (begegnung && kampf) {
		wlog_result(WLOG_SCHLECHT, "Begegnung und Kampf");
	} else if (kampf) {
		wlog_result(WLOG_SCHLECHT, "Kampf");
	} else if (begegnung) {
		wlog_result(WLOG_NEUTRAL, "Begegnung");
	} else {
		wlog_result(WLOG_GUT, "nichts");
	}
	wlog_end(offen);
}

void wlog_seereise(const int w_tot, const int w_krake, const int w_pirat)
{
	const int tot = (w_tot >= 0) && (w_tot <= 20);
	const int krake = (w_krake <= 5);
	const int pirat = (w_pirat <= 10);
	const int offen = wlog_begin(WLOG_EREIGNIS, "Seereise: Ereignisse?");
	char ergebnis[80] = "";

	if (w_tot >= 0) {
		wlog_detail("Totenschiff: W100 = %d, bis 20", w_tot);
	} else {
		wlog_detail("Totenschiff: nicht gewürfelt (nur auf hoher See mit Auftrag)");
	}
	wlog_detail("Krakenmolch: W100 = %d, bis 5", w_krake);
	wlog_detail("Piraten: W100 = %d, bis 10", w_pirat);
	if (tot) strcat(ergebnis, "Totenschiff");
	if (krake) strcat(ergebnis, ergebnis[0] ? ", Krakenmolch" : "Krakenmolch");
	if (pirat) strcat(ergebnis, ergebnis[0] ? ", Piraten" : "Piraten");
	if (ergebnis[0]) {
		wlog_result(WLOG_SCHLECHT, "%s", ergebnis);
	} else {
		wlog_result(WLOG_GUT, "ruhige Fahrt");
	}
	wlog_end(offen);
}

void wlog_ansteckung(const char *held, const char *krankheit, const int wurf, const int schwelle, const int krank)
{
	const int offen = wlog_begin(WLOG_EREIGNIS, "%s: Ansteckung mit %s?", held, krankheit);

	wlog_detail("W100 = %d, angesteckt bis %d", wurf, schwelle);
	if (wurf > schwelle) {
		wlog_result(WLOG_GUT, "nicht angesteckt");
	} else if (krank) {
		wlog_result(WLOG_NEUTRAL, "schon erkrankt");
	} else {
		wlog_result(WLOG_SCHLECHT, "angesteckt");
	}
	wlog_end(offen);
}

void wlog_steigerung(const char *held, const int zauber, const int id, const int wert, const int wurf,
		const int fehlversuche)
{
	const int offen = wlog_begin(WLOG_STUFE, "%s: %s steigern (%s %d)", held,
		zauber ? names_spell[id] : names_talent[id], zauber ? "ZfW" : "TaW", wert);

#ifdef M302de_FEATURE_MOD
	/* Feature mod 2: wie in DSA 2/3 2W6, ab Wert 10 3W6 (seg050) */
	wlog_detail("%s = %d, gesteigert, wenn über %d", wert >= 10 ? "3W6" : "2W6", wurf, wert);
#else
	/* Original: gleichverteilt 2..12, ab Wert 11 3..18 */
	wlog_detail("%s = %d, gesteigert, wenn über %d", wert >= 11 ? "Zahl 3–18" : "Zahl 2–12", wurf, wert);
#endif
	if (fehlversuche) {
		wlog_detail("bisher %d Fehlversuch%s", fehlversuche, fehlversuche == 1 ? "" : "e");
	}
	if (wurf > wert) {
		wlog_result(WLOG_GUT, "gesteigert auf %d", wert + 1);
	} else {
		wlog_result(WLOG_SCHLECHT, "misslungen (%d. Fehlversuch)", fehlversuche + 1);
	}
	wlog_end(offen);
}

#endif
