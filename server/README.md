# SILT Lista — serwer aplikacji (PHP + MySQL)

API, z którym rozmawia aplikacja na tablecie. Stoi obok starej wersji v19 (`filedops.pl/lista/`)
i jej nie rusza — obie działają równolegle do czasu wyłączenia PWA.

## Instalacja na filedops.pl

1. **Baza** — phpMyAdmin → baza `serwer432573_lista` → Import, po kolei pliki z `sql/`
   (kodowanie utf-8): `001_schemat.sql` (tabele + cennik z v19), `002_statystyki.sql`, `003_min_wersja.sql`.
   Każdy plik importuje się raz; przy aktualizacji wgrywa się tylko nowe numery.
2. **Pliki** — wgraj do nowego folderu `lista-api/` (obok `lista/` i `statystyka/`):
   `api.php`, `cron.php`, `.htaccess`, cały folder `lib/`.
   Folderów `sql/` i `testy/` NIE wgrywaj.
3. **Konfiguracja** — skopiuj `config.example.php` jako `config.php` w `lista-api/`
   i uzupełnij: użytkownik i hasło bazy, `LISTA_HASLO` (hasło tabletów), `CRON_KEY`,
   `SMSAPI_TOKEN` (token z panelu smsapi.pl; bez niego SMS-y z fakturami nie idą, reszta działa).
4. **Sprawdzenie** — otwórz `https://filedops.pl/lista-api/api.php?akcja=start`.
   Poprawnie: `{"ok":false,"kod":"zaloguj",…}` (serwer działa, czeka na tablet).
   `https://filedops.pl/lista-api/config.php` musi dawać „Forbidden”.
5. **Cron** (panel LH.pl → Serwery → Zadania cron), codziennie o **6:00** (`0 6 * * *`), typ cURL:
   `https://filedops.pl/lista-api/cron.php?key=CRON_KEY`
   Co robi (dni od 14 dni wstecz do wczoraj):
   - wysyła do Statystyk dni niewysłane albo poprawione po wysyłce (nadpisuje, nie dubluje),
   - wysyła SMS z danymi do faktur na 48534500503 (każda faktura raz; nieudany — ponowi następnego dnia),
   - sprząta kosz po 30 dniach.
   Wynik widać po otwarciu tego adresu w przeglądarce.

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
- Stan wysyłki (`s_stat_wyslano`, `s_sms_wyslano`, błędy) serwer zapisuje z nowym rev — tablet widzi go po pobraniu.

Format zapytań i odpowiedzi: komentarze w `api.php` i `lib/synchronizacja.php`.

## Test lokalny

Statystyki i SMSAPI są w testach zastąpione atrapami (`testy/mock/`), nic nie idzie na zewnątrz.

```bash
mysql -uroot -e "CREATE DATABASE silt_test CHARACTER SET utf8mb4"
for f in server/sql/0*.sql; do mysql -uroot silt_test < $f; done
sh server/testy/config-test.sh /tmp/config-test.php localhost UŻYTKOWNIK HASŁO http://127.0.0.1:8766
export SILT_CONFIG=/tmp/config-test.php SILT_MOCK_DIR=/tmp PHP_CLI_SERVER_WORKERS=4
php -S 127.0.0.1:8765 -t server &     # API
php -S 127.0.0.1:8766 -t server &     # atrapy Statystyk i SMSAPI
php server/testy/test_api.php http://127.0.0.1:8765
SILT_API=http://127.0.0.1:8765/api.php npm test   # aplikacja (na świeżej bazie)
```
To samo uruchamia GitHub przy każdej zmianie (workflow „Sprawdź kod”, zadanie „serwer”).
