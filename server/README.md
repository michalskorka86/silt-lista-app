# SILT Lista — serwer aplikacji (PHP + MySQL)

API, z którym rozmawia aplikacja na tablecie. Stoi obok starej wersji v19 (`filedops.pl/lista/`)
i jej nie rusza — obie działają równolegle do czasu wyłączenia PWA.

## Instalacja na filedops.pl

1. **Baza** — phpMyAdmin → baza `serwer432573_lista` → Import → plik `sql/001_schemat.sql`
   (kodowanie utf-8). Tworzy tabele i wpisuje cennik z v19.
2. **Pliki** — wgraj do nowego folderu `lista-api/` (obok `lista/` i `statystyka/`):
   `api.php`, `cron.php`, `.htaccess`, cały folder `lib/`.
   Folderów `sql/` i `testy/` NIE wgrywaj.
3. **Konfiguracja** — skopiuj `config.example.php` jako `config.php` w `lista-api/`
   i uzupełnij: użytkownik i hasło bazy, `LISTA_HASLO` (hasło tabletów), `CRON_KEY`.
4. **Sprawdzenie** — otwórz `https://filedops.pl/lista-api/api.php?akcja=start`.
   Poprawnie: `{"ok":false,"kod":"zaloguj",…}` (serwer działa, czeka na tablet).
   `https://filedops.pl/lista-api/config.php` musi dawać „Forbidden”.
5. **Cron** (panel hostingu → Zadania cron), raz dziennie, np. o 4:00:
   `php /pełna/ścieżka/lista-api/cron.php` — sprząta kosz po 30 dniach.

## Zmiana cennika (do czasu panelu www)

phpMyAdmin → tabele `atrakcje`, `pakiety`, `sprzet`, `dodatki_katalog`, `ustawienia`.
Po zmianie zwiększ `ustawienia.cennik_wersja` o 1 — tablety pobiorą nowy cennik przy następnym połączeniu.
Nieużywaną pozycję wyłącz (`aktywny = 0`) zamiast kasować.

## Blokada starej wersji aplikacji

`ustawienia.min_wersja_app` — aplikacja starsza niż ta wersja nie wyśle ani nie pobierze danych
i poprosi o aktualizację. Dane na tablecie czekają w kolejce do czasu aktualizacji.

## Jak działa synchronizacja (skrót)

- Tablet zapisuje wszystko u siebie (SQLite) i wrzuca zmianę do kolejki.
- Przy zasięgu wysyła paczkę zmian (`akcja=wyslij`). Każda zmiana ma własne id — powtórzona
  (np. po zerwanym połączeniu) niczego nie dubluje.
- Każdy wiersz niesie czas zmiany z tabletu; starsza wersja nie nadpisuje nowszej.
- Kasowanie = wpis `usunieto` (kosz). Serwer usuwa na dobre po `KOSZ_DNI` (30) dniach.
- Nowy tablet pobiera wszystko (`akcja=pobierz&od_rev=0`), potem tylko nowe zmiany.
- Kwoty grup (`w_…`) liczy tablet; serwer ich nie przelicza.

Format zapytań i odpowiedzi: komentarze w `api.php` i `lib/synchronizacja.php`.

## Test lokalny

```bash
mysql -uroot -e "CREATE DATABASE silt_test CHARACTER SET utf8mb4"
mysql -uroot silt_test < server/sql/001_schemat.sql
# config testowy: DB_NAME silt_test, LISTA_HASLO 'test123', CRON_KEY 'cron-test'
SILT_CONFIG=/tmp/config-test.php php -S 127.0.0.1:8765 -t server &
SILT_CONFIG=/tmp/config-test.php php server/testy/test_api.php http://127.0.0.1:8765
```
To samo uruchamia GitHub przy każdej zmianie (workflow „Sprawdź kod”, zadanie „serwer”).
