#if defined(__EMSCRIPTEN__)
/* Kampfbildschirm der Web-Oberfläche (kampf.cpp) */
extern signed int g_web_kampf_dialog;	/* nächste Auswahl: 1 Kampfmenü, 2 Gegenstände */
extern signed int g_web_kampf_ohne_sterne;	/* 1: Treffersterne nicht zeichnen (seg005) */
void web_kampf_held(const signed int hero_pos);
void web_kampf_menue(const signed int wiederholen);
void web_kampf_liste(const struct struct_hero *hero, const signed int *slots, const signed int n);
void web_kampf_phase(const signed int phase, const signed int x, const signed int y);
void web_kampf_marke(const signed int x, const signed int y);
void web_kampf_weg(const signed int problem, const signed int kosten);
#endif
