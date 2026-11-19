/*
 * Kampf: Figuren hinter Wänden sichtbar machen. Nicht im DOS-Original (nur nativ).
 *
 * Das Kampffeld wird von hinten nach vorn gezeichnet (Liste ab g_fig_list_head): eine Wand vor einer
 * Figur wird nach ihr gezeichnet und verdeckt sie. Beim Zeichnen merkt sich kd_merke() jedes Element
 * (Lage, Sprite, Zuschnitt wie in pic_copy Modus 2); kd_zeichnen() legt danach die verdeckten Pixel
 * der Figuren wieder über die Wände: als Schachbrett (jedes zweite Pixel) oder als Umriss.
 * Durchscheinen: Helden, Gegner (nicht tot/bewusstlos), Waffen, Markierung; verdecken: die Objekte
 * des Kampffelds (Wände, Bäume, Fässer; nicht die Bodenobjekte mit z = -1).
 */
#if !defined(__BORLANDC__)

#include <string.h>

#include "v302de.h"
#include "common.h"
#include "datseg.h"
#include "kampf_durchsicht.h"

#if defined(__EMSCRIPTEN__)
#include <emscripten.h>
#endif

/* 0 aus, 1 Schachbrett, 2 Umriss (Einstellung im Browser) */
int g_kampf_durchsicht = 1;

/* Pixel, die kd_zeichnen() im letzten Bild über Wände gelegt hat (für Tests) */
static int g_kd_pixel;

#if defined(__EMSCRIPTEN__)
extern "C" EMSCRIPTEN_KEEPALIVE void web_kampf_durchsicht(const int art)
{
	g_kampf_durchsicht = (art >= 0 && art <= 2) ? art : 0;
}

extern "C" EMSCRIPTEN_KEEPALIVE int web_kampf_durchsicht_pixel(void)
{
	return g_kd_pixel;
}
#endif

enum { KD_NICHTS = 0, KD_FIGUR = 1, KD_WAND = 2 };

struct kd_element {
	signed short x1, y1, w, h;		/* Lage und Größe des Sprites */
	signed short rx1, ry1, rx2, ry2;	/* Zuschnitt (g_pic_copy_rect) */
	const uint8_t *src;
	unsigned char art;
	unsigned char farbe;			/* Umriss: Palettenindex */
};

#define KD_MAX 160
static struct kd_element g_kd[KD_MAX];
static int g_kd_anzahl;

/* Palettenindex, der einer Farbe am nächsten kommt (vgalib.cpp) */
extern unsigned char sdl_palette_naechste(const int r, const int g, const int b);

void kd_beginn(void)
{
	g_kd_anzahl = 0;
}

static int kd_ist_kampfobjekt(const struct struct_fighter *f)
{
	int i;
	/* Objekte des Kampffelds (FIG_draw_scenario): figure 0, ohne Animation, Id in g_fightobj_list */
	if (f->figure != 0 || f->sheet != -1) return 0;
	for (i = 0; i < kd_kampfobjekte(); i++) {
		if (g_fightobj_list[i] == f->id) return 1;
	}
	return 0;
}

static int kd_art(const struct struct_fighter *f, unsigned char *farbe)
{
	int i;

	*farbe = 0;
	if (!f) return KD_FIGUR;	/* Waffe ohne eigenes Element: zur Figur davor */
	if (kd_ist_kampfobjekt(f)) return (f->z == -1) ? KD_NICHTS : KD_WAND;

	for (i = 0; i <= 6; i++) {
		const struct struct_hero *h = get_hero(i);
		if (h->typus != HERO_TYPE_NONE && h->fighter_id == f->id) {
			if (h->flags.dead || h->flags.unconscious) return KD_NICHTS;
			*farbe = 1;	/* Held: Gold */
			return KD_FIGUR;
		}
	}
	for (i = 0; i < 20; i++) {
		if (g_enemy_sheets[i].fighter_id == f->id && g_enemy_sheets[i].monster_id) {
			if (g_enemy_sheets[i].flags.dead) return KD_NICHTS;
			*farbe = 2;	/* Gegner: Rot */
			return KD_FIGUR;
		}
	}
	*farbe = 1;	/* Markierung und Sonstiges */
	return KD_FIGUR;
}

void kd_merke(const struct struct_fighter *f)
{
	struct kd_element *e;
	unsigned char farbe;
	int art;

	if (!g_kampf_durchsicht || g_kd_anzahl >= KD_MAX) return;

	art = kd_art(f, &farbe);
	/* Waffe: wie die Figur, zu der sie gehört (zuletzt gemerkt) */
	if (!f && g_kd_anzahl > 0) {
		art = g_kd[g_kd_anzahl - 1].art;
		farbe = g_kd[g_kd_anzahl - 1].farbe;
	}

	e = &g_kd[g_kd_anzahl++];
	e->x1 = g_pic_copy.x1;
	e->y1 = g_pic_copy.y1;
	e->w = g_pic_copy.x2 - g_pic_copy.x1 + 1;
	e->h = g_pic_copy.y2 - g_pic_copy.y1 + 1;
	e->rx1 = g_pic_copy_rect.x1;
	e->ry1 = g_pic_copy_rect.y1;
	e->rx2 = g_pic_copy_rect.x2;
	e->ry2 = g_pic_copy_rect.y2;
	e->src = g_pic_copy.src;
	e->art = (unsigned char)art;
	e->farbe = farbe;
}

void kd_merke_liste(const struct struct_fighter *f)
{
	struct kd_element *e;
	unsigned char farbe;
	const int art = kd_art(f, &farbe);
	int x1, y1;

	/* Wände im Hintergrund verdecken schon dort; nur Figuren nachtragen */
	if (!g_kampf_durchsicht || g_kd_anzahl >= KD_MAX || art != KD_FIGUR) return;

	x1 = (10 - f->width / 2) + 10 * (f->cbx + f->cby) + f->offsetx;
	y1 = (118 - f->height) + 5 * (f->cbx - f->cby) + f->offsety;

	e = &g_kd[g_kd_anzahl++];
	e->x1 = x1;
	e->y1 = y1;
	e->w = f->width;
	e->h = f->height;
	e->rx1 = (x1 + f->x1 < 0) ? 0 : x1 + f->x1;
	e->ry1 = (y1 + f->y1 < 0) ? 0 : y1 + f->y1;
	e->rx2 = (x1 + f->x2 > 319) ? 319 : x1 + f->x2;
	e->ry2 = (y1 + f->y2 > 199) ? 199 : y1 + f->y2;
	e->src = f->gfxbuf;
	e->art = KD_FIGUR;
	e->farbe = farbe;
}

/* Pixel des Elements an (x, y) auf dem Bildschirm, 0 = durchsichtig oder außerhalb */
static inline uint8_t kd_pixel(const struct kd_element *e, const int x, const int y)
{
	if (x < e->x1 || y < e->y1 || x >= e->x1 + e->w || y >= e->y1 + e->h) return 0;
	if (x < e->rx1 || x > e->rx2 || y < e->ry1 || y > e->ry2) return 0;
	return e->src[(y - e->y1) * e->w + (x - e->x1)];
}

void kd_zeichnen(uint8_t *dst)
{
	int i, j, x, y;
	unsigned char farben[3] = { 0, 0, 0 };

	g_kd_pixel = 0;
	if (!g_kampf_durchsicht) return;

	if (g_kampf_durchsicht == 2) {
		farben[1] = sdl_palette_naechste(252, 204, 60);	/* Gold */
		farben[2] = sdl_palette_naechste(232, 48, 32);	/* Rot */
	}

	for (i = 0; i < g_kd_anzahl; i++) {
		const struct kd_element *f = &g_kd[i];
		if (f->art != KD_FIGUR) continue;

		/* sichtbarer Bereich der Figur */
		const int fx1 = (f->x1 > f->rx1) ? f->x1 : f->rx1;
		const int fy1 = (f->y1 > f->ry1) ? f->y1 : f->ry1;
		const int fx2 = (f->x1 + f->w - 1 < f->rx2) ? f->x1 + f->w - 1 : f->rx2;
		const int fy2 = (f->y1 + f->h - 1 < f->ry2) ? f->y1 + f->h - 1 : f->ry2;

		for (j = i + 1; j < g_kd_anzahl; j++) {
			const struct kd_element *w = &g_kd[j];
			if (w->art != KD_WAND) continue;

			/* Überlappung der Rechtecke */
			const int ux1 = (fx1 > w->x1) ? fx1 : w->x1;
			const int uy1 = (fy1 > w->y1) ? fy1 : w->y1;
			const int ux2 = (fx2 < w->x1 + w->w - 1) ? fx2 : w->x1 + w->w - 1;
			const int uy2 = (fy2 < w->y1 + w->h - 1) ? fy2 : w->y1 + w->h - 1;
			if (ux1 > ux2 || uy1 > uy2) continue;

			for (y = uy1; y <= uy2; y++) {
				if (y < 0 || y >= 200) continue;
				for (x = ux1; x <= ux2; x++) {
					uint8_t p;
					if (x < 0 || x >= 320) continue;
					if (!kd_pixel(w, x, y)) continue;	/* Wand verdeckt hier nicht */
					if (!(p = kd_pixel(f, x, y))) continue;
					if (g_kampf_durchsicht == 1) {
						/* Schachbrett */
						if ((x + y) & 1) {
							dst[y * 320 + x] = p;
							g_kd_pixel++;
						}
					} else {
						/* Umriss: Rand der Figur (ein Nachbar durchsichtig) */
						if (!kd_pixel(f, x - 1, y) || !kd_pixel(f, x + 1, y) ||
							!kd_pixel(f, x, y - 1) || !kd_pixel(f, x, y + 1)) {
							dst[y * 320 + x] = farben[f->farbe ? f->farbe : 1];
							g_kd_pixel++;
						}
					}
				}
			}
		}
	}
}

#endif
