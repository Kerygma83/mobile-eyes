# Build-Umgebung: Emscripten (Web) + g++/SDL2 (nativ, zum Gegentesten)
FROM emscripten/emsdk:4.0.10
RUN apt-get update \
 && apt-get install -y --no-install-recommends g++ cmake make libsdl2-dev \
 && rm -rf /var/lib/apt/lists/*
# SDL2-Port einmal vorab bauen, damit er im Image liegt
RUN embuilder build sdl2
# Wörterbuch für die Groß-/Kleinschreibung der Spieltexte (werkzeuge/schreibung.py)
RUN apt-get update \
 && apt-get install -y --no-install-recommends hunspell-de-de python3-hunspell \
 && rm -rf /var/lib/apt/lists/*
