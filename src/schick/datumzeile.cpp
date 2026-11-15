/*
 * Datumszeile für das mobile Layout der Web-Oberfläche. Nicht im DOS-Original (nur im Browser).
 *
 * Im Original zeigt ein Klick oben rechts über den Icons (Aktion 0xfc, seg002) Datum und
 * Uhrzeit in einer Textbox. Das mobile Layout zeigt diesen Bereich nicht; die Seite stellt
 * stattdessen unter den Porträts eine Zeile im Stil der Ortszeile dar.
 *
 * web_datum_zeile() setzt die Zeile knapp aus den Namen in TEXT.LTX zusammen (Wochentag,
 * Monat, Jahreszeit oder Feiertag), schreibt sie mit der Spielschrift in ein eigenes Bild
 * (Rahmen aus der Ortszeile des aktuellen Bildschirms, y 139–156) und gibt es als RGBA an
 * Module.datumZeile. Der Zustand des Spiels (Textpuffer, Farben, Bildschirm) bleibt unberührt.
 */
#if defined(__EMSCRIPTEN__)

#include <stdio.h>
#include <string.h>

#include <emscripten.h>

#include "v302de.h"
#include "common.h"
#include "datseg.h"
#include "seg002.h"
#include "seg096.h"
#include "vgalib.h"

#define DZ_W	320
#define DZ_Y	139	/* erste Zeile der Ortszeile im mobilen Layout */
#define DZ_H	18
#define DZ_X0	6	/* Text wie in GUI_print_loc_line */
#define DZ_TY	143
#define DZ_MAX	307

static uint32_t g_dz_bild[DZ_W * DZ_H];
static char g_dz_text[160];

/* Breite in Pixeln (Steuerzeichen 0xf0–0xf3 ohne Breite) */
static signed int dz_breite(const char *s)
{
	signed int w, b = 0;
	for (; *s; s++) {
		GUI_lookup_char_width(*s, &w);
		b += w;
	}
	return b;
}

static void dz_text(const int mit_klammer)
{
	const signed int hour = gs_day_timer / HOURS(1);
	char klammer[64] = "";

	if (gs_day_of_month < 0) {
		/* Namenlose Tage */
		snprintf(g_dz_text, sizeof(g_dz_text), "%s, NAMENLOSER TAG, %d HAL, %d UHR",
			get_ttx(349 + gs_day_of_week), gs_year, hour);
		return;
	}
	if (mit_klammer) {
		if (gs_special_date_id) {
			snprintf(klammer, sizeof(klammer), " (\xf3%s\xf0)", get_ttx(357 + gs_special_date_id));
		} else {
			snprintf(klammer, sizeof(klammer), " (%s)", get_ttx(551 + get_current_season()));
		}
	}
	snprintf(g_dz_text, sizeof(g_dz_text), "%s, %d. %s%s %d HAL, %d UHR",
		get_ttx(349 + gs_day_of_week), gs_day_of_month, get_ttx(21 + gs_month), klammer, gs_year, hour);
}

static uint8_t dz_farbe(const signed int index)
{
	return index == 0 ? 0xff : (uint8_t)g_textcolor_fg[index];
}

/* Zeichen wie GUI_font_to_buf / GUI_write_char_to_screen: 7 Zeilen, Breite aus der Tabelle */
static void dz_zeichen(uint8_t *bild, const char c, const signed int x, const signed int farbe, signed int *breite)
{
	const signed int index = GUI_lookup_char_width(c, breite);
	const uint8_t *fc = g_buf_font6 + index * 8;
	signed int i, j;

	if (c == 0x3a) fc++;

	for (i = 0; i < 7; i++, fc++) {
		for (j = 0; j < *breite && x + j < DZ_W; j++) {
			if ((0x80 >> j) & *fc) bild[(DZ_TY - DZ_Y + i) * DZ_W + x + j] = dz_farbe(farbe);
		}
	}
}

/* bei jedem Bild des Hauptbildschirms (Rahmen und Palette können sich ändern, etwa nachts) */
extern "C" EMSCRIPTEN_KEEPALIVE void web_datum_zeile(void)
{
	uint8_t bild[DZ_W * DZ_H];
	signed int i, x, w, farbe = 0;

	if (!g_text_ltx_index || !g_buf_font6 || !g_vga_memstart) return;

	dz_text(1);
	if (dz_breite(g_dz_text) > DZ_MAX - DZ_X0) dz_text(0);

	/* Rahmen der Ortszeile, Innenfläche schwarz wie clear_loc_line (x 3–316, y 140–153) */
	memcpy(bild, g_vga_memstart + DZ_Y * DZ_W, sizeof(bild));
	for (i = 140; i <= 153; i++) memset(bild + (i - DZ_Y) * DZ_W + 3, 0, 316 - 3 + 1);

	for (i = 0, x = DZ_X0; g_dz_text[i]; i++) {
		const unsigned char c = (unsigned char)g_dz_text[i];
		if (c >= 0xf0 && c <= 0xf3) { farbe = c - 0xf0; continue; }
		dz_zeichen(bild, (char)c, x, farbe, &w);
		x += w;
	}

	for (i = 0; i < DZ_W * DZ_H; i++) g_dz_bild[i] = sdl_palette_rgba(bild[i]);
	EM_ASM({ if (Module.datumZeile) Module.datumZeile(HEAPU8, $0, $1, $2); }, g_dz_bild, DZ_W, DZ_H);
}

#endif
