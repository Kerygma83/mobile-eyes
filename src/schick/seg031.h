/* 0x20 */
char* load_current_town_gossip(void);
/* 0x25 */
void do_random_talk(const signed int, const signed int);
/* 0x2a */
char* get_informer_forename(void);
/* 0x2f */
signed int informer_id_from_current_town(void);
/* 0x34 */
char* get_informer_hint(void);
/* 0x39 */
char* get_informer_name(void);
/* 0x3e */
char* get_informer_name2(void);
/* 0x43 */
char* get_random_tavern_message(void);
/* 0x48 */
void drink_while_drinking(const signed int);
/* 0x4d */
void eat_while_drinking(const signed int);

#ifdef M302de_ORIGINAL_BUGFIX
signed int fix340_informer_town(const signed int);	/* Schicksalsklinge-Bugfix Nr. 340 */
#endif

#if defined(__EMSCRIPTEN__)
/* Tabelle der 15 Informanten (Name in TEXT.LTX, Stadt) für den Questlog der Seite */
const struct struct_informer_tab* web_informer_tab(void);
#endif
