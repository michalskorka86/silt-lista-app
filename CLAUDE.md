# SILT Lista — aplikacja na tablet (zasady projektu)

Czytaj też `AGENTS.md` (zasady Expo) i `docs/PLAN.md` (ustalenia i zakres).

## Kontekst
- Następca PWA „SILT Lista” v19 (PHP, filedops.pl/lista). Backend PHP zostaje; aplikacja rozmawia z API.
- Tablet: Lenovo Tab M10 (3. gen.) LTE — średni procesor: listy lekkie, ciężkie rzeczy (PDF) w tle / w nocy.
- Słaby zasięg na poligonie: wszystko najpierw zapisuje się w SQLite na tablecie, na serwer idzie przez tabelę `kolejka`.
- Użytkownicy to instruktorzy, nie informatycy: duże przyciski, zawsze „Anuluj”, komunikaty po polsku, bez żargonu.

## Wygląd
- Wygląd zostaje jak w v19: kolory i wymiary TYLKO z `src/constants/theme.ts`, czcionka Inter, motyw ciemny domyślnie.
- Wzór ekranów: `index.php` z paczki v19 (w projekcie claude.ai „Apka do statystyk”). Zmiany wyglądu tylko po uzgodnieniu z Michałem.

## Kod
- Expo SDK 57, TypeScript strict, expo-router (ekrany w `src/app/`, reszta poza nim).
- Pakiety dodawaj przez `npx expo install` (bez dostępu do api.expo.dev: `EXPO_OFFLINE=1 npx expo install …`).
- Baza: `src/db/migrations.ts` — migracje przez `PRAGMA user_version`; starych migracji nie zmieniamy, dopisujemy nowe.
- Nazwy w kodzie domenowym po polsku (lista, grupa, gracz, kulki, dym, wydatki, pensje) — zgodnie z v19 i API.
- Przed commitem: `npx tsc --noEmit`, `npx expo lint` i `npm test` (z serwerem testowym — opis w `server/README.md`).

## Dane na tablecie i synchronizacja
- Tabele list: `src/db/tabele.ts` (typy + kolumny) = `server/lib/tabele.php`. Zmiana kolumny = nowa migracja SQLite + nowy plik SQL na serwerze + obie listy kolumn.
- Każda zmiana listy TYLKO przez `zapisz()/zapiszWiele()/usun()/przywroc()` z `src/db/zapis.ts` — zapisują wiersz i wpis w kolejce w jednej transakcji. Po zmianie graczy/pozycji/dodatków/pól grupy: `przeliczGrupe()`.
- Obliczenia grupy: `src/logika/obliczenia.ts` (port 1:1 `calc()` z v19 — nie zmieniać bez uzgodnienia).
- Id nowych wierszy: `nowyId('g')` itd. Czas: ISO UTC (`teraz()`). Dzień listy: data lokalna.
- Wysyłka w tle: `src/sync/SyncProvider.tsx` (po zmianie, co minutę, po powrocie do aplikacji); logika bez React Native w `src/sync/synchronizacja.ts` — testowana w Node (`testy/`).
- `src/db`, `src/logika`, `src/sync/klient.ts`, `src/sync/synchronizacja.ts` bez importów React Native i aliasu `@/` (względne ścieżki), żeby testy w Node działały.

## Serwer (`server/`)
- PHP 7.4+ bez frameworka, PDO MySQL/MariaDB; wgrywany ręcznie na filedops.pl/lista-api/ (instrukcja: `server/README.md`).
- Schemat: `server/sql/NNN_*.sql` — nowe zmiany jako kolejny plik, starych nie przerabiamy po wgraniu.
- Kolumny, które tablet może zapisać: `server/lib/tabele.php` — przy zmianie tabeli na tablecie zmień też tam.
- Synchronizacja: zmiana = cały wiersz + czas zmiany z tabletu (nowszy wygrywa), id zmiany z kolejki chroni przed dublowaniem, kasowanie = `usunieto` (kosz). Kwoty grup (`w_…`) liczy tablet.
- Czas w bazie: UTC. Dzień listy (`data`): czas polski.
- Przed commitem zmian serwera: test `server/testy/test_api.php` (opis w README); GitHub robi to samo w „Sprawdź kod”.

## Bezpieczeństwo
- Żadnych haseł, tokenów (SMSAPI, Anthropic, klucz tabletu) w repozytorium. Konfiguracja serwera zostaje w `config.php` na serwerze.
- Nie commituj danych klientów, dumpów bazy ani plików `.env`.

## Android
- Pakiet: `pl.silt.lista` (po pierwszym wydaniu w Google Play nie do zmiany).
- Katalogi `android/` i `ios/` są generowane — nie edytować ręcznie, konfiguracja w `app.json`.
