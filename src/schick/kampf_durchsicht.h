/*
 * Kampf: Figuren hinter Wänden sichtbar machen (kampf_durchsicht.cpp). Nicht im DOS-Original.
 */
#ifndef KAMPF_DURCHSICHT_H
#define KAMPF_DURCHSICHT_H

#if !defined(__BORLANDC__)

/* 0 aus, 1 Schachbrett, 2 Umriss */
extern int g_kampf_durchsicht;

/* vor der Zeichenschleife */
void kd_beginn(void);
/* nach jedem pic_copy Modus 2 der Schleife (g_pic_copy, g_pic_copy_rect); NULL: Waffe der Figur davor */
void kd_merke(const struct struct_fighter *f);
/* Element, das in dieser Runde nicht neu gezeichnet wird (steht im Hintergrund): Lage aus der Liste */
void kd_merke_liste(const struct struct_fighter *f);
/* nach der Schleife: verdeckte Figuren über die Wände legen */
void kd_zeichnen(uint8_t *dst);
/* Zahl der Objekte des Kampffelds in g_fightobj_list (seg040) */
int kd_kampfobjekte(void);

#endif
#endif
