<?php
// ============================================================
// SILT Lista — API aplikacji na tablet
// Adres: https://filedops.pl/lista-api/api.php?akcja=…
//
//   POST zaloguj   {haslo, tablet_id, model, wersja}   → {token}
//   GET  start                                         → min. wersja, wersja cennika, rev
//   GET  cennik                                        → atrakcje, pakiety, sprzęt, dodatki, dym, worek
//   POST wyslij    {zmiany:[…]}                         → wynik każdej zmiany
//   GET  pobierz   &od_rev=N                           → wiersze zmienione po N
//   POST statystyki {data, wymus?}                     → wyślij dzień do Statystyk teraz
//   GET  pracownicy                                    → pracownicy ze Statystyk (ekran pensji)
//   GET  rezerwacje &od=…&do=…                         → podgląd rezerwacji (z podglad.php)
//   POST blad      {czas, ekran, komunikat, stos}       → zgłoszenie awarii
//   POST wyloguj
//
// Nagłówki: X-Tablet-Token (po zalogowaniu), X-App-Wersja (zawsze).
// Szczegóły formatu: lib/synchronizacja.php.
// ============================================================

declare(strict_types=1);

require_once __DIR__ . '/lib/wspolne.php';
require_once __DIR__ . '/lib/tabele.php';
require_once __DIR__ . '/lib/logowanie.php';
require_once __DIR__ . '/lib/synchronizacja.php';
require_once __DIR__ . '/lib/statystyki.php';
require_once __DIR__ . '/lib/rezerwacje.php';

$akcja = (string)($_GET['akcja'] ?? '');
$metoda = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    $wymagaPost = ['zaloguj', 'wyslij', 'statystyki', 'blad', 'wyloguj'];
    if (in_array($akcja, $wymagaPost, true) && $metoda !== 'POST') {
        throw new BladApi('metoda', 'Ta akcja wymaga POST', 405);
    }

    switch ($akcja) {
        case 'zaloguj':
            akcja_zaloguj(tresc_zadania());
            break;

        case 'blad':
            $tablet = null;
            if (naglowek('X-Tablet-Token') !== '') {
                try { $tablet = wymagaj_tabletu(); } catch (BladApi $e) { $tablet = null; }
            }
            akcja_blad($tablet, tresc_zadania());
            break;

        case 'start':
            akcja_start(wymagaj_tabletu());
            break;

        case 'cennik':
            wymagaj_tabletu();
            akcja_cennik();
            break;

        case 'wyslij':
            $tablet = wymagaj_tabletu();
            wymagaj_aktualnej_wersji();
            akcja_wyslij($tablet, tresc_zadania());
            break;

        case 'pobierz':
            wymagaj_tabletu();
            wymagaj_aktualnej_wersji();
            akcja_pobierz();
            break;

        case 'statystyki':
            wymagaj_tabletu();
            wymagaj_aktualnej_wersji();
            akcja_statystyki(tresc_zadania());
            break;

        case 'pracownicy':
            wymagaj_tabletu();
            akcja_pracownicy();
            break;

        case 'rezerwacje':
            wymagaj_tabletu();
            akcja_rezerwacje();
            break;

        case 'wyloguj':
            akcja_wyloguj(wymagaj_tabletu());
            break;

        default:
            throw new BladApi('nieznana_akcja', 'Nieznana akcja', 404);
    }
} catch (BladApi $e) {
    odpowiedz(['ok' => false, 'kod' => $e->kod, 'msg' => $e->getMessage()], $e->http);
} catch (Throwable $e) {
    error_log('SILT Lista API: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    odpowiedz(['ok' => false, 'kod' => 'serwer', 'msg' => 'Błąd serwera — spróbuj za chwilę'], 500);
}
