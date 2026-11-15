void draw_fight_screen(const signed int);
#if !defined(__BORLANDC__)
/* schneller Autokampf: ohne Zwischenbilder und Wartezeiten (Einstellung der Web-Seite) */
extern signed int g_fast_autofight;
signed int fast_autofight(void);
#endif
