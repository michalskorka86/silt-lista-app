# Instrukcja dla instruktorów (PDF)

`SILT_Lista_instrukcja.pdf` — gotowa instrukcja (A4, do druku). Jak zmienią się ekrany, odśwież zrzuty i zbuduj PDF:

1. Serwer testowy + podgląd web (jak w `server/README.md`): PHP na 8765/8766, `podglad.mjs` na 8770, świeża baza `silt_test`.
2. Zrzuty z numerkami: `node docs/instrukcja/zrzuty.mjs docs/instrukcja/img <zdjęcie-kartki.jpg>` (Playwright + Chromium; tablet 1280×800).
3. HTML: `python3 docs/instrukcja/zbuduj.py` (treść rozdziałów jest w tym pliku).
4. PDF: `node docs/instrukcja/druk.mjs $PWD/docs/instrukcja/instrukcja.html $PWD/docs/instrukcja/SILT_Lista_instrukcja.pdf`.

Czcionka Inter z `node_modules/@expo-google-fonts/inter`.
