/* 0x20 */
void do_wildcamp(void);
#ifdef M302de_ORIGINAL_BUGFIX
extern signed int g_wildcamp_keep_status;	/* Schicksalsklinge-Bugfix Nr. 374 */
#endif
/* 0x25 */
signed int replenish_stocks(signed int, const signed int);
/* 0x2a */
signed int gather_herbs(struct struct_hero*, const signed int, const signed int);
