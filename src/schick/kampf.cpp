/*
 * Kampfbildschirm der Web-Oberfläche. Nicht im DOS-Original (nur im Browser).
 *
 * Im mobilen Layout zeigt die Seite (werkzeuge/kampf.js) das Kampffeld zoombar und darunter ein
 * Bedienfeld: die Befehle des Kampfmenüs als Knöpfe, bei Ziel- und Bewegungswahl schräge Pfeile mit
 * Bestätigen, sonst den Kampfverlauf. web_kampf() meldet dafür, wer am Zug ist, die BP, die Phase
 * (Zielwahl seg034 FIG_cb_select_target, Bewegen FIG_move_hero), die Markierung, die Kosten des
 * Wegs und die Gruppe.
 *
 * Bedient wird mit den Eingaben des Originals: Menüwahl (web_menu_select), Pfeiltasten (die
 * Achsen des Felds), Eingabe und Escape. Das Kampfmenü und die Auswahllisten (Waffe, Gegenstand,
 * Zauber) melden sich mit g_web_kampf_dialog, damit die Seite sie statt im Overlay im Bedienfeld
 * zeigt. web_kampf_tipp(x, y) setzt bei Ziel- und Bewegungswahl nur den Mauszeiger, dem die
 * Markierung im Original folgt; erst ein zweites Tippen auf das markierte Feld bestätigt.
 */
#if defined(__EMSCRIPTEN__)

#include <stdarg.h>
#include <stdio.h>
#include <string.h>

#include <emscripten.h>

#include "v302de.h"
#include "common.h"
#include "datseg.h"
#include "seg038.h"
#include "seg039.h"
#include "seg096.h"
#include "kampf.h"

extern "C" void web_key(const int sym);					/* seg002.cpp */
extern "C" void web_click(const int x, const int y, const int button);	/* seg002.cpp */

signed int g_web_kampf_dialog = 0;
signed int g_web_kampf_ohne_sterne = 0;

/* Seite zeigt den Kampfverlauf selbst: Treffersterne weglassen (sie stehen nur kurz da) */
extern "C" EMSCRIPTEN_KEEPALIVE void web_kampf_sterne(const int an) { g_web_kampf_ohne_sterne = !an; }

static signed int g_wk_held = -1;	/* Held, der im Kampfmenü wählt */
static signed int g_wk_wdh = 0;		/* „Alte Optionen“ im Menü */
static signed int g_wk_phase = 0;	/* 2 Zielwahl, 3 Bewegen */
static signed int g_wk_x = 0, g_wk_y = 0;		/* Feld des Helden bei Ziel- und Bewegungswahl */
static signed int g_wk_mx = -1, g_wk_my = -1;	/* Markierung */
static signed int g_wk_problem = -1;	/* Bewegen: 0 möglich, 1 Flucht, 2 zu weit, 3 versperrt, 4 kein Weg; -1 noch nichts */
static signed int g_wk_kosten = 0;
static signed int g_wk_items[16];	/* Auswahlliste Waffe/Gegenstand: Gegenstände der Einträge */
static signed int g_wk_items_n = 0;

/* Ursprung des Felds im Bild: Mitte von Feld (x, y) liegt bei (9 + 10 (x + y), 116 + 5 (x - y)) */
enum { WK_BASIS_X = 9, WK_BASIS_Y = 116 };

void web_kampf_held(const signed int hero_pos) { g_wk_held = hero_pos; }
void web_kampf_menue(const signed int wiederholen) { g_wk_wdh = wiederholen; g_web_kampf_dialog = 1; }

void web_kampf_liste(const struct struct_hero *hero, const signed int *slots, const signed int n)
{
	signed int i;
	g_wk_items_n = (n > 16) ? 16 : n;
	for (i = 0; i < g_wk_items_n; i++) g_wk_items[i] = hero->inventory[slots[i]].item_id;
	g_web_kampf_dialog = 2;
}

void web_kampf_phase(const signed int phase, const signed int x, const signed int y)
{
	g_wk_phase = phase;
	g_wk_x = x; g_wk_y = y;
	g_wk_mx = x; g_wk_my = y;
	g_wk_problem = -1;
	g_wk_kosten = 0;
}

void web_kampf_marke(const signed int x, const signed int y) { g_wk_mx = x; g_wk_my = y; }

void web_kampf_weg(const signed int problem, const signed int kosten)
{
	g_wk_problem = problem;
	g_wk_kosten = kosten;
}

static char g_wk_buf[4096];
static size_t g_wk_len;

static void wk(const char *fmt, ...)
{
	va_list ap;
	int n;

	if (g_wk_len >= sizeof(g_wk_buf) - 1) return;
	va_start(ap, fmt);
	n = vsnprintf(g_wk_buf + g_wk_len, sizeof(g_wk_buf) - g_wk_len, fmt, ap);
	va_end(ap);
	if (n > 0) {
		g_wk_len += (size_t)n;
		if (g_wk_len > sizeof(g_wk_buf) - 1) g_wk_len = sizeof(g_wk_buf) - 1;
	}
}

/* Spieltext als "hex" im DOS-Zeichensatz */
static void wk_text(const char *t)
{
	wk("\"");
	if (t) {
		for (; *t; t++) wk("%02x", (unsigned char)*t);
	}
	wk("\"");
}

/* Name dessen, was auf dem Feld steht (Held 1–9, Gegner 10–49, Schwanz eines großen Gegners 30–49) */
static void wk_feld(const signed int x, const signed int y)
{
	signed int id;

	if ((x < 0) || (x > 23) || (y < 0) || (y > 23)) { wk("null"); return; }
	id = get_cb_val(x, y);
	if ((id > 0) && (id < 10)) {
		const struct struct_hero *h = get_hero(id - 1);
		wk("{\"art\":1,\"tot\":%d,\"name\":", h->flags.dead || h->flags.unconscious);
		wk_text(h->alias);
		wk("}");
	} else if ((id >= 10) && (id < 50)) {
		const struct enemy_sheet *e = &g_enemy_sheets[id - 10 - (id >= 30 ? 20 : 0)];
		wk("{\"art\":2,\"tot\":%d,\"name\":", e->flags.dead);
		wk_text(GUI_name_singular(g_monnames_index[e->monster_id]));
		wk("}");
	} else {
		wk("null");
	}
}

extern "C" EMSCRIPTEN_KEEPALIVE const char* web_kampf(void)
{
	signed int i;
	signed int ax = -1, ay = -1, gegner = 0, akteur = 0;

	g_wk_len = 0;
	g_wk_buf[0] = '\0';

	if (!g_in_fight) {
		g_wk_held = -1;
		g_wk_phase = 0;
		wk("{\"k\":0}");
		return g_wk_buf;
	}

	/* wer gerade zieht (seg032: Held bzw. Gegner, dessen Bild oben links steht) */
	if (g_fig_char_pic > 0) {
		akteur = g_fig_char_pic;
	} else if (g_fig_enemy_pic >= 10) {
		akteur = g_fig_enemy_pic;
		gegner = 1;
	}
	if (akteur) {
		signed int x, y;
		if (FIG_search_obj_on_cb(akteur, &x, &y)) { ax = x; ay = y; }
	}

	wk("{\"k\":1,\"auto\":%d,\"p\":%d,\"held\":%d,\"a\":[%d,%d,%d,%d],\"m\":[%d,%d],\"problem\":%d,\"kosten\":%d,",
		g_autofight != 0, g_wk_phase, g_wk_held, ax, ay, gegner, akteur, g_wk_mx, g_wk_my, g_wk_problem, g_wk_kosten);

	if (g_wk_held >= 0) {
		const struct struct_hero *h = get_hero(g_wk_held);
		const signed int waffe = h->inventory[HERO_INVENTORY_SLOT_RIGHT_HAND].item_id;
		wk("\"bp\":%d,\"wdh\":%d,\"zauber\":%d,\"fern\":%d,\"waffeWarn\":%d,\"lastWarn\":%d,",
			h->fight_bp_left, g_wk_wdh, h->typus >= HERO_TYPE_HEXE,
			FIG_get_range_weapon_type(h) != -1,
			!g_itemsdat[waffe].flags.weapon || h->inventory[HERO_INVENTORY_SLOT_RIGHT_HAND].flags.broken,
			h->attrib[ATTRIB_KK].current * 110 <= h->load);
	}

	wk("\"ziel\":");
	if (g_wk_phase) wk_feld(g_wk_mx, g_wk_my); else wk("null");
	wk(",\"wer\":");
	if (gegner && (ax >= 0)) wk_feld(ax, ay); else wk("null");

	/* letzte Auswahlliste (Waffe, Gegenstand): Werte wie auf der Gegenstandskarte des Heldenbogens */
	wk(",\"liste\":[");
	for (i = 0; i < g_wk_items_n; i++) {
		const struct item_stats *s = &g_itemsdat[g_wk_items[i]];
		wk("%s{\"id\":%d", i ? "," : "", g_wk_items[i]);
		if (s->flags.weapon && (s->table_index >= 0) && (s->table_index < 65)) {
			const struct weapon_descr *w = &g_weapons_table[s->table_index];
			wk(",\"kampf\":[%d,%d,%d,%d]", w->damage_d6, w->damage_const, w->at_mod, w->pa_mod);
		} else if (s->flags.armor && (s->table_index >= 0) && (s->table_index < 25)) {
			const struct armor_descr *r = &g_armors_table[s->table_index];
			wk(",\"schutz\":[%d,%d]", r->rs, r->be);
		}
		wk("}");
	}

	wk("],\"helden\":[");
	for (i = 0; i <= 6; i++) {
		const struct struct_hero *h = get_hero(i);
		if (!h->typus || (h->group_id != gs_active_group_id)) continue;
		wk("%s{\"i\":%d,\"name\":", (g_wk_buf[g_wk_len - 1] == '[') ? "" : ",", i);
		wk_text(h->alias);
		wk(",\"le\":%d,\"lem\":%d,\"ae\":%d,\"aem\":%d,\"weg\":%d}", h->le, h->le_max,
			h->typus >= HERO_TYPE_HEXE ? h->ae : 0, h->typus >= HERO_TYPE_HEXE ? h->ae_max : 0,
			h->flags.dead || h->flags.unconscious);
	}
	wk("]}");
	return g_wk_buf;
}

/* Antippen des Kampffelds (Spielkoordinate): bei Ziel- und Bewegungswahl nur den Zeiger setzen
 * (die Markierung folgt ihm), auf der Markierung bestätigen; sonst nichts.
 * 0: ignoriert, 1: markiert, 2: bestätigt */
extern "C" EMSCRIPTEN_KEEPALIVE int web_kampf_tipp(const int x, const int y)
{
	signed int fx, fy;

	if (!g_in_fight || !g_wk_phase) return 0;

	/* Feld unter dem Punkt wie in FIG_move_hero (seg034) */
	fx = ((x - WK_BASIS_X) / 10 + (y - WK_BASIS_Y) / 5) / 2;
	fy = -((y - WK_BASIS_Y) / 5 - fx);
	if ((fx == g_wk_mx) && (fy == g_wk_my)) {
		web_key(13);
		return 2;
	}
	web_click(x, y, 0);
	return 1;
}
#endif
