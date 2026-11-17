/*
 * Menü der Web-Oberfläche. Nicht im DOS-Original (nur im Browser).
 *
 * Die Seite (werkzeuge/menue.js) bietet Speichern, Laden, Tagebuch und Hyggeliks Karte in
 * einem eigenen Menü an, statt über die Spieloptionen des Originals (Aktionsknopf „Info“,
 * seg025 game_options) bzw. die Icons im Tempel. Ausgeführt wird dasselbe wie dort, an
 * derselben Stelle der Spielschleife (nach handle_gui_input in Stadt, Dungeon und Tempel):
 *  - Stadt und Dungeon: wie game_options() (Speichern außerhalb des Tempels kostet im
 *    Original AP; nativ nicht, M302de_FEATURE_MOD Mod 4)
 *  - Tempel: als Wahl des Icons (Laden, Speichern), also mit den Regeln des Tempels
 *
 * web_menue_status() meldet, ob die Aktionen gerade möglich sind (Hauptbildschirm in Stadt,
 * Dungeon oder Tempel) und das Kampftempo (g_delay_factor, „Rechner anpassen“ des Originals).
 */
#if defined(__EMSCRIPTEN__)

#include <stdio.h>

#include <emscripten.h>

#include "v302de.h"
#include "common.h"
#include "datseg.h"
#include "seg024.h"
#include "seg025.h"
#include "seg026.h"
#include "webmenue.h"

extern "C" int web_screen_mode(void);

/* 1 Speichern, 2 Laden, 3 Tagebuch, 4 Hyggeliks Karte */
static signed int g_web_menue_auftrag = 0;

/* 0 nicht möglich, 1 Stadt, 2 Dungeon, 3 Tempel */
static signed int web_menue_ort(void)
{
	if ((g_game_state != GAME_STATE_MAIN) || !web_screen_mode()) return 0;
	if (gs_town_loc_type == LOCTYPE_TEMPLE) return 3;
	if (gs_town_loc_type != LOCTYPE_NONE) return 0;
	if (gs_town_id != TOWN_ID_NONE) return 1;
	if (gs_dungeon_id != DUNGEON_ID_NONE) return 2;
	return 0;
}

extern "C" EMSCRIPTEN_KEEPALIVE const char* web_menue_status(void)
{
	static char buf[64];
	snprintf(buf, sizeof(buf), "{\"ort\":%d,\"kampftempo\":%d}", web_menue_ort(), g_delay_factor);
	return buf;
}

/* Aktion vormerken; 0, wenn sie gerade nicht möglich ist */
extern "C" EMSCRIPTEN_KEEPALIVE int web_menue(const int auftrag)
{
	if ((auftrag < 1) || (auftrag > 4) || !web_menue_ort()) return 0;
	g_web_menue_auftrag = auftrag;
	return 1;
}

/* Kampftempo: Wartezeit der Kampfanimation (Original 4, „Rechner anpassen“ in den Spieloptionen) */
extern "C" EMSCRIPTEN_KEEPALIVE void web_kampftempo(const int faktor)
{
	if ((faktor >= 0) && (faktor <= 20)) g_delay_factor = faktor;
}

/* Tagebuch oder Karte wie in game_options(), danach den Hauptbildschirm neu aufbauen */
static void web_menue_anzeigen(const signed int auftrag)
{
	const signed int tw_bak = g_textbox_width;
	g_textbox_width = 3;

	if (auftrag == 3) {
		diary_show();
	} else {
		g_renderbuf_in_use_flag = 1;
		show_treasure_map();
		g_renderbuf_in_use_flag = 0;
	}

	g_textbox_width = tw_bak;
	g_fig_figure1 = g_fig_figure2 = g_current_ani = g_pp20_index = -1;
	g_special_screen = 0;
	g_request_refresh = 1;
}

/* Stadt und Dungeon (seg066 do_town, seg076 do_dungeon), nach handle_gui_input() */
void web_menue_stadt(void)
{
	const signed int auftrag = g_web_menue_auftrag;
	signed int tw_bak;
	signed int game_state;

	if (!auftrag) return;
	g_web_menue_auftrag = 0;

	if (auftrag >= 3) {
		web_menue_anzeigen(auftrag);
		if (gs_town_id != TOWN_ID_NONE) g_fading_state = 3;
		return;
	}

	tw_bak = g_textbox_width;
	g_textbox_width = 3;

	if (auftrag == 1) {
		save_game_state();
	} else {
		do {
			game_state = load_game_state();
		} while (game_state == -1);
	}

	g_textbox_width = tw_bak;
	g_request_refresh = 1;
}

/* Tempel (seg061 do_temple), nach handle_gui_input(): Laden und Speichern als Icon-Wahl */
signed int web_menue_tempel(void)
{
	const signed int auftrag = g_web_menue_auftrag;

	if (!auftrag) return 0;
	g_web_menue_auftrag = 0;

	if (auftrag == 1) return ACTION_ID_ICON_5;
	if (auftrag == 2) return ACTION_ID_ICON_4;

	web_menue_anzeigen(auftrag);
	return 0;
}

#endif
