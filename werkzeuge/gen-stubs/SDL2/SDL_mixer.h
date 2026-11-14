/* Ersatz für SDL2_mixer im Web-Build der Heldenerschaffung (ngen).
 * Musik ist dort aus (Ton kommt in Stufe 6); so muss der Emscripten-Port
 * samt ogg/vorbis nicht geladen werden. Alle Aufrufe tun nichts. */
#ifndef SDL_MIXER_STUB_H
#define SDL_MIXER_STUB_H
#include <SDL2/SDL.h>
typedef struct Mix_Music Mix_Music;
#define MIX_DEFAULT_FORMAT AUDIO_S16SYS
static inline int Mix_OpenAudio(int f, Uint16 fmt, int ch, int cs) { (void)f; (void)fmt; (void)ch; (void)cs; return -1; }
static inline void Mix_CloseAudio(void) {}
static inline Mix_Music *Mix_LoadMUS(const char *p) { (void)p; return NULL; }
static inline void Mix_FreeMusic(Mix_Music *m) { (void)m; }
static inline int Mix_PlayMusic(Mix_Music *m, int l) { (void)m; (void)l; return -1; }
static inline const char *Mix_GetError(void) { return "kein Ton im Web-Build"; }
#endif
