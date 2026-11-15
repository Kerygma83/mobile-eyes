/*
 * Questlog für die Web-Oberfläche. Nicht im DOS-Original (nur im Browser).
 *
 * web_questlog() liest die Flags des Spielstands, die Haupt- und Nebenquests betreffen,
 * und gibt sie als JSON an die Seite (werkzeuge/questlog.js). Die Seite entscheidet, was
 * sie anzeigt; das Spiel wird nicht verändert. Alles steht im Spielstand, der Questlog
 * stimmt also auch gleich nach dem Laden.
 *
 * Namen und Orte stammen aus TEXT.LTX und gehen als Hex-Bytes im DOS-Zeichensatz hinaus
 * (die Seite wandelt sie wie die Textboxen um).
 */
#if defined(__EMSCRIPTEN__)

#include <stdarg.h>
#include <stdio.h>
#include <string.h>

#include <emscripten.h>

#include "v302de.h"
#include "common.h"
#include "datseg.h"
#include "seg031.h"

static char g_ql_buf[8192];
static size_t g_ql_len;

static void ql(const char *fmt, ...)
{
	va_list ap;
	int n;

	if (g_ql_len >= sizeof(g_ql_buf) - 1) return;
	va_start(ap, fmt);
	n = vsnprintf(g_ql_buf + g_ql_len, sizeof(g_ql_buf) - g_ql_len, fmt, ap);
	va_end(ap);
	if (n > 0) {
		g_ql_len += (size_t)n;
		if (g_ql_len > sizeof(g_ql_buf) - 1) g_ql_len = sizeof(g_ql_buf) - 1;
	}
}

/* Spieltext als "hex" (ohne Text: leere Zeichenkette) */
static void ql_text(const char *t)
{
	ql("\"");
	if (t) {
		for (; *t; t++) ql("%02x", (unsigned char)*t);
	}
	ql("\"");
}

static const char* ql_ttx(const signed int no)
{
	return g_text_ltx_index ? get_ttx(no) : NULL;
}

extern "C" EMSCRIPTEN_KEEPALIVE const char* web_questlog(void)
{
	signed int i;
	const struct struct_informer_tab *inf = web_informer_tab();

	g_ql_len = 0;
	g_ql_buf[0] = '\0';

	ql("{\"helden\":%d,\"datum\":[%d,%d,%d]", gs_total_hero_counter,
		gs_day_of_month, gs_month, gs_year);

	/* Hauptquest */
	ql(",\"ausruf\":%d,\"auftrag\":%d,\"monate\":%d,\"brief_het\":%d,\"brief_jad\":%d,\"brief_noetig\":%d",
		gs_heard_announce, gs_got_main_quest, gs_quested_months, gs_got_letter_het, gs_got_letter_jad,
		gs_need_letter);
	ql(",\"karten\":[");
	for (i = 0; i < 10; i++) ql("%s%d", i ? "," : "", gs_treasure_maps[i]);
	ql("],\"hyggelik\":%d,\"ruine\":%d,\"grimring\":%d", gs_find_hyggelik, gs_tevent115_flag, gs_got_grimring);

	/* Informanten: Stufe 0 unbekannt, 1 gehört, 2 besucht */
	ql(",\"informanten\":[");
	for (i = 0; i < INFORMER_ID__END; i++) {
		ql("%s{\"s\":%d,\"n\":", i ? "," : "", gs_informer_flags[i]);
		ql_text(ql_ttx(inf[i].name_id));
		ql(",\"o\":");
		ql_text(inf[i].town_id > 0 ? ql_ttx(inf[i].town_id + 0xeb) : NULL);
		ql("}");
	}
	ql("]");
	ql(",\"jurge_brief\":%d,\"umbrik_gorah\":%d,\"gorah\":%d,\"isleif_gruss\":%d,\"isleif_karte\":%d"
		",\"ragna_frage\":%d,\"eliane_namenlos\":%d,\"tiomar_brief\":%d,\"swafnild_ohne_karte\":%d"
		",\"einhorn\":%d,\"einhorn_karte\":%d,\"algrid_treborn\":%d,\"einsiedler\":%d,\"mueller\":%d",
		gs_jurge_awaits_letter, gs_umbrik_quest_gorah, gs_tevent064_flag, gs_isleif_jandas_regards,
		gs_isleif_map_given, gs_ragna_asked_map, gs_eliane_quest_nameless, gs_tiomar_awaits_letter,
		gs_swafnild_nomap, gs_met_unicorn_flag, gs_unicorn_get_map, gs_algrid_treborns_hint,
		gs_hermit_visited, gs_visited_miller);

	/* Nebenquests */
	ql(",\"ugdalf\":%d,\"ugdalf_gefunden\":%d,\"totenschiff\":%d,\"totenschiff_ende\":%d,\"totenschiff_fertig\":%d"
		",\"ardora\":%d,\"namenlos_fertig\":%d,\"namenlos_zerstoert\":%d,\"drache\":%d,\"daspota_schatz\":%d"
		",\"schuldbuch\":%d,\"orkdokument\":%d",
		gs_quest_ugdalf, gs_dng14_ugdalf_done, gs_quest_deadship, gs_deadship_final, gs_quest_deadship_done,
		gs_dng01_ardora_freed, gs_quest_nameless_done, gs_nameless_destroyed, gs_dng10_dragon_quest,
		gs_dng06_dasptreas_found, !gs_debtbook_read_flag, gs_orcdocument_read_flag);

	/* Bekannte Eingänge an Reisestrecken: [Dungeon, Flag] (gehört oder selbst gefunden) */
	ql(",\"orte\":[[%d,%d],[%d,%d],[%d,%d],[%d,%d],[%d,%d],[%d,%d],[%d,%d],[%d,%d]]",
		DUNGEON_ID_SPINNENHOEHLE, gs_tevent051_flag,
		DUNGEON_ID_WOLFSHOEHLE, gs_tevent061_flag,
		DUNGEON_ID_GOBLINHOEHLE, gs_tevent076_flag,
		DUNGEON_ID_DASPOTASCHATZ, gs_tevent094_flag,
		DUNGEON_ID_RUINE_DES_SCHWARZMAGIERS, gs_tevent100_flag,
		DUNGEON_ID_ORKBEHAUSUNG, gs_tevent108_flag,
		DUNGEON_ID_DRACHENHORT, gs_tevent129_flag,
		DUNGEON_ID_PIRATENHOEHLE, gs_tevent131_flag);

	ql("}");
	return g_ql_buf;
}

#endif
