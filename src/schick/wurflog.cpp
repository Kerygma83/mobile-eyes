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

#endif
