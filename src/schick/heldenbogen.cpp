/*
 * Heldenbogen der Web-Oberfläche. Nicht im DOS-Original (nur im Browser).
 *
 * Im mobilen Layout zeigt die Seite (werkzeuge/heldenbogen.js) unter dem Bild des Heldenbogens
 * (seg048 status_menu) Ausrüstung und Rucksack als große Kacheln und eine Karte mit den Aktionen
 * zum gewählten Gegenstand. web_heldenbogen() meldet dafür den Inhalt der 23 Felder, die Gruppe
 * und die Auswahl.
 *
 * Die Aktionen der Seite laufen über die Eingaben, die status_menu selbst kennt: Die Seite reiht
 * Schritte ein (web_heldenbogen_schritt), status_menu führt je Durchlauf nach handle_input()
 * einen davon aus (web_heldenbogen_weiter):
 *  - wählen: Feld wählen wie mit den Pfeiltasten
 *  - aufnehmen: RETURN auf dem gewählten Feld (der Gegenstand hängt am Zeiger)
 *  - ablegen: RETURN auf einem Feld, dem Auge (23, ansehen) oder dem Mund (24, essen/trinken),
 *    also move_item, pass_item, print_item_description oder consume wie im Original
 *  - Held: ←/→, bis der Held erreicht ist (mit aufgenommenem Gegenstand: weitergeben)
 *  - benutzen, wegwerfen, Talent anwenden, Zauber sprechen: wie die Einträge im Menü des Heldenbogens
 *  - Seite (Grundwerte, AT/PA, Talente, Zauber 1 und 2): wie die Seitenwahl im Menü
 *  - schließen: wie „Zurück“ im Menü
 *
 * web_heldenbogen_bild(id) gibt das Bild eines Gegenstands (16×16, GGSTS.NVF wie für den Mauszeiger
 * mit Gegenstand) als RGBA an Module.heldenbogenBild, damit die Kacheln es auf jeder Seite zeigen.
 * Regeln, Rückfragen und Meldungen kommen damit unverändert aus dem Spiel.
 *
 * Mit web_heldenbogen_ablage(1) wählt Antippen eines Felds im Bild nur aus, statt den Gegenstand
 * gleich aufzunehmen (seg048); Querformat und Desktop behalten die Bedienung des Originals.
 */
#if defined(__EMSCRIPTEN__)

#include <stdarg.h>
#include <stdio.h>
#include <string.h>

#include <emscripten.h>

#include "v302de.h"
#include "common.h"
#include "datseg.h"
#include "seg007.h"
#include "seg048.h"
#include "seg096.h"
#include "seg097.h"
#include "seg105.h"
#include "seg106.h"
#include "seg107.h"
#include "seg002.h"
#include "seg026.h"
#include "seg098.h"
#include "seg103.h"
#include "vgalib.h"
#include "heldenbogen.h"

enum {
	HB_WAEHLEN = 1,
	HB_AUFNEHMEN = 2,
	HB_ABLEGEN = 3,		/* Wert: Feld 0-22, 23 Auge, 24 Mund */
	HB_ABLEGEN_FREI = 4,	/* erstes passendes Rucksackfeld des Helden, der gerade gezeigt wird */
	HB_HELD = 5,		/* Wert: Heldenposition 0-6 */
	HB_BENUTZEN = 6,
	HB_WEGWERFEN = 7,
	HB_SCHLIESSEN = 8,
	HB_SEITE = 9,		/* Wert: 1 Grundwerte, 2 AT/PA, 3 Talente, 4 und 5 Zauber */
	HB_TALENT = 10,
	HB_ZAUBER = 11
};

static signed int g_hb_offen = 0;
static signed int g_hb_ablage = 0;
static signed int g_hb_schritte[24][2];
static signed int g_hb_anzahl = 0;
static signed int g_hb_pos = 0;
static signed int g_hb_versuche = 0;
static signed int g_hb_item = ITEM_NONE;	/* aufgenommener Gegenstand */

static char g_hb_buf[12288];
static size_t g_hb_len;

static void hb(const char *fmt, ...)
{
	va_list ap;
	int n;

	if (g_hb_len >= sizeof(g_hb_buf) - 1) return;
	va_start(ap, fmt);
	n = vsnprintf(g_hb_buf + g_hb_len, sizeof(g_hb_buf) - g_hb_len, fmt, ap);
	va_end(ap);
	if (n > 0) {
		g_hb_len += (size_t)n;
		if (g_hb_len > sizeof(g_hb_buf) - 1) g_hb_len = sizeof(g_hb_buf) - 1;
	}
}

/* Spieltext als "hex" im DOS-Zeichensatz */
static void hb_text(const char *t)
{
	hb("\"");
	if (t) {
		for (; *t; t++) hb("%02x", (unsigned char)*t);
	}
	hb("\"");
}

/* Körperfeld, auf das „Ausrüsten“ den Gegenstand legt; -1: keins */
static signed int hb_ziel(const signed int item_id)
{
	const struct item_stats *s = &g_itemsdat[item_id];

	if (s->flags.weapon) return HERO_INVENTORY_SLOT_RIGHT_HAND;
	if (s->flags.armor) {
		if (s->subtype == ARMOR_TYPE_LEFT_HAND) return HERO_INVENTORY_SLOT_LEFT_HAND;
		if ((s->subtype >= 0) && (s->subtype <= HERO_INVENTORY_SLOT_FEET)) return s->subtype;
	}
	return -1;
}

/* Rucksackfeld für einen weitergegebenen oder abgelegten Gegenstand: derselbe Stapel, sonst das
 * erste freie Feld; -1: keins (dann bleibt der Gegenstand, wo er ist) */
static signed int hb_freies_feld(const struct struct_hero *hero, const signed int item_id)
{
	signed int i;

	if (g_itemsdat[item_id].flags.stackable) {
		for (i = HERO_INVENTORY_SLOT_KNAPSACK_1; i <= HERO_INVENTORY_SLOT_KNAPSACK_16; i++) {
			if (hero->inventory[i].item_id == item_id) return i;
		}
	}
	for (i = HERO_INVENTORY_SLOT_KNAPSACK_1; i <= HERO_INVENTORY_SLOT_KNAPSACK_16; i++) {
		if (hero->inventory[i].item_id == ITEM_NONE) return i;
	}
	return -1;
}

extern "C" EMSCRIPTEN_KEEPALIVE const char* web_heldenbogen(void)
{
	const struct struct_hero *hero;
	signed int i;

	g_hb_len = 0;
	g_hb_buf[0] = '\0';

	if (!g_hb_offen || (g_status_page_hero < 0) || (g_status_page_hero > 6)) {
		hb("{\"offen\":0}");
		return g_hb_buf;
	}
	hero = get_hero(g_status_page_hero);

	hb("{\"offen\":1,\"seite\":%d,\"held\":%d,\"sel\":%d,\"halt\":%d,\"laeuft\":%d,\"last\":%d,",
		g_status_page_mode, g_status_page_hero, g_statuspage_sel_inv_slot_3,
		g_statuspage_sel_inv_slot_4 != -1, g_hb_anzahl > 0, hero->load);

	hb("\"helden\":[");
	for (i = 0; i <= 6; i++) {
		const struct struct_hero *h = get_hero(i);
		if (!h->typus || (h->group_id != gs_active_group_id)) continue;
		hb("%s{\"i\":%d,\"name\":", (g_hb_len && g_hb_buf[g_hb_len - 1] == '[') ? "" : ",", i);
		hb_text(h->alias);
		hb(",\"typus\":%d,\"zauber\":%d}", h->typus, h->typus >= HERO_TYPE_HEXE);
	}
	hb("],\"felder\":[");
	for (i = 0; i < NR_HERO_INVENTORY_SLOTS; i++) {
		const signed int id = hero->inventory[i].item_id;
		if (i) hb(",");
		if (id == ITEM_NONE) { hb("null"); continue; }
		{
			const struct item_stats *s = &g_itemsdat[id];
			hb("{\"id\":%d,\"n\":%d,\"gew\":%d,\"name\":", id, hero->inventory[i].quantity, s->weight);
			hb_text(GUI_name_singular(g_itemsname[id]));
			hb(",\"typ\":");
			hb_text(s->flags.weapon ? get_ttx(48 + s->subtype) : NULL);
			hb(",\"waffe\":%d,\"ruestung\":%d,\"benutzbar\":%d,\"nahrung\":%d,\"trank\":%d,\"stapel\":%d,"
				"\"fest\":%d,\"art\":%d,\"verboten\":%d,\"ziel\":%d,\"magisch\":%d}",
				s->flags.weapon, s->flags.armor, s->flags.usable, s->flags.nutrition, s->flags.herb_potion,
				s->flags.stackable, s->flags.undropable, s->subtype,
#ifdef M302de_ORIGINAL_BUGFIX
				/* Schicksalsklinge-Bugfix Nr. 391 */
				fix391_forbidden(hero->typus, id),
#else
				is_in_int_array(id, g_forbidden_item_ids_table[hero->typus - 1]) ? 1 : 0,
#endif
				hb_ziel(id), (s->magic && hero->inventory[i].flags.magic_revealed) ? 1 : 0);
			/* Kampfwerte: Waffe [W6, Zuschlag, KK-Zuschlag, AT, PA, Bruchfaktor des Stücks],
			 * Rüstung [RS (abzüglich verlorenem RS), BE] */
			if (s->flags.weapon && (s->table_index >= 0) && (s->table_index < 65)) {
				const struct weapon_descr *w = &g_weapons_table[s->table_index];
				g_hb_len--;	/* "}" */
				hb(",\"kampf\":[%d,%d,%d,%d,%d,%d]}", w->damage_d6, w->damage_const, w->damage_kk_bonus,
					w->at_mod, w->pa_mod, hero->inventory[i].bf);
			} else if (s->flags.armor && (s->table_index >= 0) && (s->table_index < 25)) {
				const struct armor_descr *r = &g_armors_table[s->table_index];
				g_hb_len--;
				hb(",\"schutz\":[%d,%d]}", r->rs - hero->inventory[i].rs_lost, r->be);
			}
		}
	}
	hb("]}");
	return g_hb_buf;
}

/* Schritt einreihen (die Seite reiht eine ganze Aktion auf einmal ein); 0: abgelehnt */
extern "C" EMSCRIPTEN_KEEPALIVE int web_heldenbogen_schritt(const int art, const int wert)
{
	if (!g_hb_offen || (art < HB_WAEHLEN) || (art > HB_ZAUBER)) return 0;
	if (g_hb_anzahl >= (signed int)(sizeof(g_hb_schritte) / sizeof(g_hb_schritte[0]))) return 0;
	g_hb_schritte[g_hb_anzahl][0] = art;
	g_hb_schritte[g_hb_anzahl][1] = wert;
	g_hb_anzahl++;
	return 1;
}

/* Bild eines Gegenstands als RGBA an die Seite (Module.heldenbogenBild); 0: nicht verfügbar
 * (GGSTS.NVF liegt nur bei offenem Heldenbogen im Puffer) */
extern "C" EMSCRIPTEN_KEEPALIVE int web_heldenbogen_bild(const int item_id)
{
	static uint8_t icon[16 * 16];
	static uint32_t rgba[16 * 16];
	struct nvf_extract_desc nvf;
	signed int width;
	signed int height;
	signed int i;

	/* nur auf den Seiten mit Inventar: dort liest auch status_menu GGSTS.NVF (Mauszeiger), auf den
	 * anderen Seiten ist nicht sicher, dass der Puffer noch die Datei enthält */
	if (!g_hb_offen || (g_status_page_mode >= 3) || (item_id <= ITEM_NONE) || (item_id >= 255)) return 0;

	nvf.dst = icon;
	nvf.src = g_buffer10_ptr;
	nvf.compression_type = 0;
	nvf.width = &width;
	nvf.height = &height;
	nvf.image_num = g_itemsdat[item_id].gfx;
	process_nvf_extraction(&nvf);
	if ((width != 16) || (height != 16)) return 0;

	for (i = 0; i < 16 * 16; i++) rgba[i] = sdl_palette_rgba(icon[i]);
	EM_ASM({ if (Module.heldenbogenBild) Module.heldenbogenBild($0, HEAPU8.slice($1, $1 + 1024)); }, item_id, rgba);
	return 1;
}

/* Antippen eines Felds im Bild wählt nur aus (mobiles Layout mit Kacheln) */
extern "C" EMSCRIPTEN_KEEPALIVE void web_heldenbogen_ablage(const int an)
{
	g_hb_ablage = an;
}

signed int web_heldenbogen_nur_waehlen(void)
{
	return g_hb_ablage;
}

void web_heldenbogen_offen(const signed int offen)
{
	g_hb_offen = offen;
	g_hb_anzahl = g_hb_pos = g_hb_versuche = 0;
}

static void hb_fertig(void)
{
	g_hb_anzahl = g_hb_pos = g_hb_versuche = 0;
}

/* in status_menu nach handle_input(): einen Schritt ausführen; 1: Heldenbogen schließen */
signed int web_heldenbogen_weiter(const signed int hero_pos, const signed int ein_held)
{
	struct struct_hero *hero;
	signed int art;
	signed int wert;

	if ((g_hb_pos >= g_hb_anzahl) || g_action || g_mouse_rightclick_event) return 0;

	art = g_hb_schritte[g_hb_pos][0];
	wert = g_hb_schritte[g_hb_pos][1];
	hero = get_hero(hero_pos);

	switch (art) {
	case HB_WAEHLEN:
		if ((g_status_page_mode < 3) && (g_statuspage_sel_inv_slot_4 == -1) &&
			(wert >= 0) && (wert < NR_HERO_INVENTORY_SLOTS))
		{
			g_statuspage_sel_inv_slot_3 = wert;
		}
		g_hb_pos++;
		break;

	case HB_AUFNEHMEN:
		if ((g_status_page_mode >= 3) || (g_statuspage_sel_inv_slot_4 != -1) ||
			(hero->inventory[g_statuspage_sel_inv_slot_3].item_id == ITEM_NONE))
		{
			hb_fertig();	/* nichts aufzunehmen: Rest verwerfen */
			return 0;
		}
		g_hb_item = hero->inventory[g_statuspage_sel_inv_slot_3].item_id;
		g_action = ACTION_ID_RETURN;
		g_hb_pos++;
		break;

	case HB_ABLEGEN_FREI:
		if (g_statuspage_sel_inv_slot_4 != -1) {
			/* beim gezeigten Helden (nach einem Wechsel der Empfänger); kein Platz: zurück auf das
			 * eigene Feld bzw. beim Empfänger auf das letzte Feld (Tausch oder Meldung des Spiels) */
			wert = hb_freies_feld(get_hero(g_status_page_hero), g_hb_item);
			if (wert == -1) {
				wert = ein_held ? g_statuspage_sel_inv_slot_3 : HERO_INVENTORY_SLOT_KNAPSACK_16;
			}
			g_statuspage_sel_inv_slot_4 = wert;
			g_action = ACTION_ID_RETURN;
		}
		g_hb_pos++;
		break;

	case HB_ABLEGEN:
		if ((g_statuspage_sel_inv_slot_4 != -1) && (wert >= 0) && (wert <= HERO_INVENTORY_SLOT_MOUTH)) {
			g_statuspage_sel_inv_slot_4 = wert;
			g_action = ACTION_ID_RETURN;
		}
		g_hb_pos++;
		break;

	case HB_HELD:
		if ((g_status_page_hero != wert) && (g_hb_versuche < 7) && (gs_group_member_counts[gs_active_group_id] > 1)) {
			g_action = ACTION_ID_RIGHT;
			g_hb_versuche++;
		} else {
			g_hb_versuche = 0;
			g_hb_pos++;
		}
		break;

	case HB_BENUTZEN:
		/* wie „Gegenstand benutzen“ im Menü des Heldenbogens */
		if ((g_status_page_mode < 3) && ein_held && (g_statuspage_sel_inv_slot_4 == -1)) {
			use_item(g_statuspage_sel_inv_slot_3, hero_pos);
			reset_item_selector();
			g_request_refresh = 1;
		}
		g_hb_pos++;
		break;

	case HB_WEGWERFEN:
		/* wie „Gegenstand wegwerfen“ im Menü des Heldenbogens */
		if ((g_status_page_mode < 3) && ein_held && (g_statuspage_sel_inv_slot_4 == -1)) {
			drop_item(hero, g_statuspage_sel_inv_slot_3, -1);
			reset_item_selector();
			g_request_refresh = 1;
		}
		g_hb_pos++;
		break;

	case HB_SEITE:
		/* wie die Seitenwahl im Menü: Talente und Zauber heben die Auswahl auf, Zauber nur für Zauberkundige */
		if ((g_statuspage_sel_inv_slot_4 == -1) && (wert >= 1) && (wert <= 5) && (wert != g_status_page_mode) &&
			((wert < 4) || (hero->typus >= HERO_TYPE_HEXE)))
		{
			if (wert >= 3) reset_item_selector();
			g_status_page_mode = wert;
			g_request_refresh = 1;
		}
		g_hb_pos++;
		break;

	case HB_TALENT:
		/* wie „Talent anwenden“ im Menü des Heldenbogens */
		if (g_statuspage_sel_inv_slot_4 == -1) {
			g_forbid_ta_falschspiel = 1;
			GUI_use_talent(hero_pos, 0);
			g_forbid_ta_falschspiel = 0;
			if (g_tx_file_index == 19) {
				load_tx2(ARCHIVE_FILE_CHARTEXT_LTX);
			}
		}
		g_hb_pos++;
		break;

	case HB_ZAUBER:
		/* wie „Zauber sprechen“ im Menü des Heldenbogens */
		if (g_statuspage_sel_inv_slot_4 == -1) {
			if (select_magic_user() != -2) {
				load_tx2(ARCHIVE_FILE_CHARTEXT_LTX);
				reset_item_selector();
			}
			g_request_refresh = 1;
		}
		g_hb_pos++;
		break;

	case HB_SCHLIESSEN:
		hb_fertig();
		reset_item_selector();
		return 1;
	}

	if (g_hb_pos >= g_hb_anzahl) hb_fertig();
	return 0;
}

#endif
