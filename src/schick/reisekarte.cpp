/*
 * Reisekarte für die Web-Oberfläche. Nicht im DOS-Original (nur im Browser).
 *
 * Die Seite (werkzeuge/karte.js) zeigt die Reisekarte zoom- und verschiebbar mit Ortsnamen und
 * die Ziele am Wegweiser als Knöpfe. Dafür liefert das Spiel:
 *   web_karte()        Zustand als JSON: Karte sichtbar, Gruppenposition, Ziele am Wegweiser,
 *                      Ziel der laufenden Reise
 *   web_karte_namen()  Orte (Position, Name aus TEXT.LTX) und Gebiete (Mitte des größten
 *                      Klickfelds, hervorgehobener Name aus MAPTEXT.LTX) als JSON
 *   web_reise_wahl(n)  (seg093) Eintrag n wie im Wegweiser-Menü wählen
 * Namen gehen als Hex-Bytes im DOS-Zeichensatz hinaus (die Seite wandelt sie wie die Textboxen um).
 */
#if defined(__EMSCRIPTEN__)

#include <stdarg.h>
#include <stdio.h>
#include <string.h>

#include <emscripten.h>

#include "v302de.h"
#include "common.h"
#include "datseg.h"
#include "seg002.h"

extern signed int g_web_trv_wartet;
extern signed int g_web_trv_ziele[7];
extern signed int g_web_trv_ziele_n;
const struct mouse_action* web_travelmap_actions(void);

static char g_rk_buf[8192];
static size_t g_rk_len;

static void rk(const char *fmt, ...)
{
	va_list ap;
	int n;

	if (g_rk_len >= sizeof(g_rk_buf) - 1) return;
	va_start(ap, fmt);
	n = vsnprintf(g_rk_buf + g_rk_len, sizeof(g_rk_buf) - g_rk_len, fmt, ap);
	va_end(ap);
	if (n > 0) {
		g_rk_len += (size_t)n;
		if (g_rk_len > sizeof(g_rk_buf) - 1) g_rk_len = sizeof(g_rk_buf) - 1;
	}
}

/* Text als "hex"; von bis Ende oder bis zum Byte ende (0: ganzer Text) */
static void rk_hex(const char *t, const unsigned char ende)
{
	rk("\"");
	for (; t && *t && (unsigned char)*t != ende; t++) rk("%02x", (unsigned char)*t);
	rk("\"");
}

/* 1 = Reisekarte steht auf dem Bildschirm (keine Box, kein Kampf, kein Lager) */
static int rk_sichtbar(void)
{
	return gs_show_travel_map && !gs_dungeon_id && !gs_town_loc_type &&
		!g_in_fight && !g_dialogbox_lock && g_game_state == GAME_STATE_MAIN;
}

extern "C" EMSCRIPTEN_KEEPALIVE const char* web_karte(void)
{
	signed int i, x = -1, y = -1;

	g_rk_len = 0;
	if (!rk_sichtbar()) {
		rk("{\"m\":0}");
		return g_rk_buf;
	}

	if (g_traveling && gs_travel_course_ptr && gs_travel_course_ptr[0] != -1) {
		x = gs_travel_course_ptr[0];
		y = gs_travel_course_ptr[1];
	} else if (gs_town_id >= 1 && gs_town_id < TOWN_ID__END) {
		/* am Wegweiser: do_travel_mode() setzt gs_town_id auf den Ort des Wegweisers */
		x = g_town_positions[gs_town_id - 1].x;
		y = g_town_positions[gs_town_id - 1].y;
	}

	rk("{\"m\":1,\"x\":%d,\"y\":%d,\"reise\":%d,\"ziel\":%d,\"wahl\":[", x, y, g_traveling ? 1 : 0,
		g_traveling ? gs_journey_destination_town_id : 0);
	if (g_web_trv_wartet) {
		for (i = 0; i < g_web_trv_ziele_n; i++) rk("%s%d", i ? "," : "", g_web_trv_ziele[i]);
	}
	/* letzter Eintrag des Menüs: am Wegweiser bleiben (Text wie im Menü) */
	rk("],\"zurueck\":");
	rk_hex(g_web_trv_wartet ? get_ttx(613) : NULL, 0);
	rk("}");
	return g_rk_buf;
}

extern "C" EMSCRIPTEN_KEEPALIVE const char* web_karte_namen(void)
{
	const struct mouse_action *a;
	signed int i, id;

	g_rk_len = 0;
	/* Gebietsnamen stehen in MAPTEXT.LTX, das load_map() für die Reisekarte lädt */
	if (!g_text_ltx_index || g_tx_file_index != ARCHIVE_FILE_MAPTEXT_LTX) {
		rk("null");
		return g_rk_buf;
	}

	rk("{\"orte\":[");
	for (i = 0; i < TOWN_ID__END - 1; i++) {
		rk("%s[%d,%d,%d,", i ? "," : "", i + 1, g_town_positions[i].x, g_town_positions[i].y);
		rk_hex(get_ttx(235 + i + 1), 0);
		rk("]");
	}
	rk("],\"gebiete\":[");
	for (id = 1, i = 0; id <= 17; id++) {
		const struct mouse_action *groesste = NULL;
		const char *t, *name;
		long flaeche = -1;

		for (a = web_travelmap_actions(); a->x1 != -1; a++) {
			const long f = (long)(a->x2 - a->x1) * (a->y2 - a->y1);
			if (a->action == id && f > flaeche) { flaeche = f; groesste = a; }
		}
		if (!groesste) continue;
		/* Name: hervorgehobener Teil (0xf1 … 0xf0) der Beschreibung, sonst keiner */
		t = get_tx(51 + id);
		name = t ? strchr(t, (char)0xf1) : NULL;
		rk("%s[%d,%d,%d,", i++ ? "," : "", id, (groesste->x1 + groesste->x2) / 2, (groesste->y1 + groesste->y2) / 2);
		rk_hex(name ? name + 1 : NULL, 0xf0);
		rk("]");
	}
	rk("]}");
	return g_rk_buf;
}

#endif
