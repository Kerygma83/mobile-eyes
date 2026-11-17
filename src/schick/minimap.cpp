/*
 * Minimap für die Web-Oberfläche. Nicht im DOS-Original (nur im Browser).
 *
 * web_minimap() gibt die erkundeten Felder der Automap (g_automap_buf) der aktuellen Stadt
 * bzw. Dungeon-Ebene als JSON an die Seite (werkzeuge/minimap.js), die sie neben dem
 * Steuerkreuz zeichnet und bei jedem Bild des Hauptbildschirms abgleicht. Die Farben
 * entsprechen render_automap() in seg074 (Index in g_palette_fight2); das Spiel wird nicht
 * verändert.
 *
 * Felder: je Feld zwei Hex-Ziffern, ff = unerkundet, sonst Farbe (Bits 0–4) und
 * Eingang + 1 (Bits 5–7, 0 = ohne Eingang).
 */
#if defined(__EMSCRIPTEN__)

#include <stdio.h>
#include <string.h>

#include <emscripten.h>

#include "v302de.h"
#include "common.h"
#include "datseg.h"
#include "seg066.h"
#include "seg074.h"

static char g_mm_buf[2048];

static unsigned char mm_mapval(const signed int x, const signed int y)
{
	return (g_map_size_x == 16) ? g_dng_map[16 * y + x] : g_dng_map[32 * y + x];
}

/* wie render_automap(): Farbe und Eingang eines erkundeten Felds */
static unsigned char mm_feld(const signed int x, const signed int y)
{
	signed int t;
	signed int c;

	if (gs_dungeon_id != DUNGEON_ID_NONE) {

		t = mm_mapval(x, y) >> 4;

		c = (t <= DNG_TILE_CORRIDOR) ? MAP_TILE_DARK_GREY :
			((t == DNG_TILE_CLOSED_DOOR) || (t == DNG_TILE_SMASHED_DOOR) || (t == DNG_TILE_OPEN_DOOR)) ? MAP_TILE_DARK_RED :
			(t == DNG_TILE_STAIR_UP) ? MAP_TILE_LIGHT_BLUE :
			(t == DNG_TILE_STAIR_DOWN) ? MAP_TILE_BLUE :
			(t == DNG_TILE_PIT_IN_CEILING) ? MAP_TILE_BRIGHT_GREEN :
			(t == DNG_TILE_CHEST) ? MAP_TILE_BROWN :
			(t == DNG_TILE_PIT) ? MAP_TILE_DARK_GREEN : MAP_TILE_RED;

		return (unsigned char)c;
	}

	if (!(t = get_maploc(x, y))) {
		t = get_border_index(mm_mapval(x, y));
	}

	c = (t <= TOWN_TILE_STREET) ? MAP_TILE_DARK_GREY :
		(t == TOWN_TILE_WATER) ? MAP_TILE_BLUE :
		(t == TOWN_TILE_GRASS) ? MAP_TILE_GREEN :
		(t == TOWN_TILE_SIGNPOST) ? MAP_TILE_RED :
		(t == TOWN_TILE_TEMPLE) ? MAP_TILE_ORANGE :
		(t == TOWN_TILE_INN_OR_TAVERN) ? MAP_TILE_LIGHT_BLUE :
		(t == TOWN_TILE_MERCHANT) ? MAP_TILE_GREY :
		(t == TOWN_TILE_SMITH) ? MAP_TILE_DARK_GREEN :
		(t == TOWN_TILE_HEALER) ? MAP_TILE_PINK :
		(t == TOWN_TILE_BLACK_FINGER) ? MAP_TILE_DARK_PURPLE :
		((t >= TOWN_TILE_HOUSE_1) && (t <= TOWN_TILE_HOUSE_4)) ? MAP_TILE_DARK_RED : MAP_TILE_BLACK;

	if ((t != TOWN_TILE_STREET) && (t != TOWN_TILE_GRASS) && (t != TOWN_TILE_WATER) && (t != TOWN_TILE_SIGNPOST)) {
		c |= ((mm_mapval(x, y) & 3) + 1) << 5;
	}

	return (unsigned char)c;
}

/* leere Zeichenkette: keine Minimap (weder Stadt noch Dungeon) */
extern "C" EMSCRIPTEN_KEEPALIVE const char* web_minimap(void)
{
	signed int x;
	signed int y;
	signed int i;
	size_t n;

	g_mm_buf[0] = '\0';

	if ((gs_dungeon_id == DUNGEON_ID_NONE) && (gs_town_id == TOWN_ID_NONE)) return g_mm_buf;
	if ((g_map_size_x != 16) && (g_map_size_x != 32)) return g_mm_buf;

	/* wie show_automap(): nur bei Licht (bei Dämmerlicht würfelt das Original eine Orientierungsprobe) */
	n = snprintf(g_mm_buf, sizeof(g_mm_buf), "{\"ort\":%d,\"dungeon\":%d,\"ebene\":%d,\"w\":%d,\"x\":%d,\"y\":%d,\"d\":%d,\"dunkel\":%d,\"gruppen\":[",
		gs_town_id, gs_dungeon_id, gs_dungeon_level, g_map_size_x, gs_x_target, gs_y_target, gs_direction,
		gs_dungeon_light != 0);

	/* andere Gruppen auf derselben Karte (wie render_automap) */
	for (i = 0, x = 0; i < 6; i++) {
		if ((gs_active_group_id != i) &&
			(gs_group_member_counts[i] > 0) &&
			(gs_groups_dng_level[i] == gs_dungeon_level) &&
			(gs_groups_town_id[i] == gs_town_id) &&
			(gs_groups_dungeon_id[i] == gs_dungeon_id) &&
			!is_group_in_prison(i))
		{
			n += snprintf(g_mm_buf + n, sizeof(g_mm_buf) - n, "%s[%d,%d,%d]", x++ ? "," : "",
				gs_groups_x_target[i], gs_groups_y_target[i], gs_groups_direction[i]);
		}
	}

	n += snprintf(g_mm_buf + n, sizeof(g_mm_buf) - n, "],\"felder\":\"");

	for (y = 0; y < 16; y++) {
		for (x = 0; x < g_map_size_x; x++) {
			n += snprintf(g_mm_buf + n, sizeof(g_mm_buf) - n, "%02x",
				(gs_dungeon_light == 0 && is_discovered(x, y)) ? mm_feld(x, y) : 0xff);
		}
	}

	snprintf(g_mm_buf + n, sizeof(g_mm_buf) - n, "\"}");

	return g_mm_buf;
}

#endif
