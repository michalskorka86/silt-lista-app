<?php
// SILT Lista — synchronizacja z tabletem: wysyłanie zmian, pobieranie danych, cennik, błędy.

declare(strict_types=1);

/* ------------------------------------------------------------------
 * WYSYŁANIE ZMIAN (tablet → serwer)
 *
 * POST ?akcja=wyslij   {"zmiany": [ZMIANA, …]}   (max LIMIT_ZMIAN_W_PACZCE, w kolejności kolejki)
 * ZMIANA = {
 *   "id": "k000123",                       ← id wpisu z kolejki tabletu (ochrona przed dublowaniem)
 *   "tabela": "grupy",
 *   "rekord": { …cały wiersz… },           ← wszystkie kolumny z lib/tabele.php
 *   "zmieniono": "2026-09-30T18:05:12.345Z",
 *   "usunieto": null | "2026-09-30T18:06:00.000Z"   ← kosz; null = przywrócone / istnieje
 * }
 * Odpowiedź: {"ok":true, "wyniki":[{"id":"k000123","wynik":"zapisano"}, …], "rev":1234}
 *   zapisano  — gotowe; tablet oznacza zmianę jako wysłaną
 *   starsza   — serwer ma nowszą wersję tego wiersza; tablet oznacza jako wysłaną i pobiera dane
 *   odrzucono — złe dane (msg mówi co); ponowne wysłanie nic nie da, tablet pokazuje błąd
 *   czeka     — brak wiersza nadrzędnego (np. grupy dla gracza); tablet spróbuje później
 *   blad      — chwilowy błąd serwera; tablet spróbuje później
 * Ta sama zmiana wysłana ponownie dostaje ten sam wynik i niczego nie dubluje.
 * ------------------------------------------------------------------ */
function akcja_wyslij(array $tablet, array $body): void
{
    $zmiany = $body['zmiany'] ?? null;
    if (!is_array($zmiany)) throw new BladApi('zle_dane', 'Brak listy zmian');
    if (count($zmiany) > LIMIT_ZMIAN_W_PACZCE) throw new BladApi('zle_dane', 'Za dużo zmian naraz (max ' . LIMIT_ZMIAN_W_PACZCE . ')');

    $wyniki = [];
    foreach ($zmiany as $z) {
        $wyniki[] = przyjmij_zmiane((string)$tablet['id'], is_array($z) ? $z : []);
    }
    odpowiedz(['ok' => true, 'wyniki' => $wyniki, 'rev' => biezacy_rev()]);
}

function przyjmij_zmiane(string $tabletId, array $z): array
{
    $pdo = baza();
    $zid = (string)($z['id'] ?? '');
    if (!preg_match('/^[A-Za-z0-9_-]{1,40}$/', $zid)) {
        return ['id' => $zid, 'wynik' => 'odrzucono', 'msg' => 'Brak id zmiany'];
    }

    // 1) Sprawdzenie danych (bez bazy)
    try {
        $tabela = (string)($z['tabela'] ?? '');
        if (!isset(TABELE[$tabela])) throw new BladApi('odrzucono', 'Nieznana tabela');
        if (!is_array($z['rekord'] ?? null)) throw new BladApi('odrzucono', 'Brak danych wiersza');
        $rekord = przygotuj_rekord($tabela, $z['rekord']);
        $zmieniono = czas_z_iso($z['zmieniono'] ?? null);
        if ($zmieniono === null) throw new BladApi('odrzucono', 'Brak czasu zmiany');
        $usunieto = null;
        if (($z['usunieto'] ?? null) !== null) {
            $usunieto = czas_z_iso($z['usunieto']);
            if ($usunieto === null) throw new BladApi('odrzucono', 'Zły czas usunięcia');
        }
    } catch (BladApi $e) {
        zapamietaj_odrzucona($tabletId, $zid, (string)($z['tabela'] ?? ''), $z['rekord'] ?? null);
        return ['id' => $zid, 'wynik' => 'odrzucono', 'msg' => $e->getMessage()];
    }

    $pk = TABELE[$tabela]['pk'];
    $pkWartosc = $rekord[$pk];

    // 2) Zapis w jednej transakcji
    try {
        $pdo->beginTransaction();

        // Blokada licznika = zapisy idą po kolei, więc rev rośnie w kolejności zatwierdzania
        // (pobieranie „od rev N” nigdy nie pominie wiersza), a dwie jednoczesne powtórki
        // tej samej zmiany nie przejdą obie.
        $pdo->exec("UPDATE licznik SET wartosc = LAST_INSERT_ID(wartosc + 1) WHERE nazwa = 'rev'");
        $rev = (int)$pdo->lastInsertId();

        $st = $pdo->prepare('SELECT wynik FROM zmiany WHERE tablet_id = ? AND zmiana_id = ?');
        $st->execute([$tabletId, $zid]);
        $byla = $st->fetchColumn();
        if ($byla !== false) {                 // powtórka — już przyjęta wcześniej
            $pdo->rollBack();                  // nic nie zmieniamy (licznik też wraca)
            return ['id' => $zid, 'wynik' => $byla];
        }

        $st = $pdo->prepare("SELECT zmieniono FROM `$tabela` WHERE `$pk` = ? FOR UPDATE");
        $st->execute([$pkWartosc]);
        $obecny = $st->fetchColumn();

        if ($obecny !== false && strcmp((string)$obecny, $zmieniono) > 0) {
            $wynik = 'starsza';                // serwer ma nowszą wersję — nie nadpisujemy
        } else {
            $kolumny = $rekord + ['zmieniono' => $zmieniono, 'usunieto' => $usunieto, 'rev' => $rev, 'tablet_id' => $tabletId];
            if ($obecny === false) {
                $nazwy = array_keys($kolumny);
                $sql = "INSERT INTO `$tabela` (`" . implode('`,`', $nazwy) . '`) VALUES (' . implode(',', array_fill(0, count($nazwy), '?')) . ')';
                $pdo->prepare($sql)->execute(array_values($kolumny));
            } else {
                unset($kolumny[$pk]);
                $ustaw = implode(',', array_map(function ($k) { return "`$k` = ?"; }, array_keys($kolumny)));
                $pdo->prepare("UPDATE `$tabela` SET $ustaw WHERE `$pk` = ?")->execute(array_merge(array_values($kolumny), [$pkWartosc]));
            }
            $wynik = 'zapisano';
        }

        $pdo->prepare('INSERT INTO zmiany (tablet_id, zmiana_id, tabela, rekord_id, wynik, przyjeto) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$tabletId, $zid, $tabela, (string)$pkWartosc, $wynik, teraz_utc()]);
        $pdo->commit();
        return ['id' => $zid, 'wynik' => $wynik];
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ((int)($e->errorInfo[1] ?? 0) === 1452) {   // brak wiersza nadrzędnego (lista / grupa / gracz)
            return ['id' => $zid, 'wynik' => 'czeka', 'msg' => 'Brak wiersza nadrzędnego — spróbuję później'];
        }
        error_log('SILT Lista wyslij: ' . $e->getMessage());
        return ['id' => $zid, 'wynik' => 'blad', 'msg' => 'Błąd serwera — spróbuję później'];
    }
}

/** Odrzuconą zmianę zapisujemy w zmiany (żeby powtórka dostała ten sam wynik). */
function zapamietaj_odrzucona(string $tabletId, string $zid, string $tabela, $rekord): void
{
    try {
        $id = '';
        if (isset(TABELE[$tabela]) && is_array($rekord)) $id = (string)($rekord[TABELE[$tabela]['pk']] ?? '');
        baza()->prepare('INSERT IGNORE INTO zmiany (tablet_id, zmiana_id, tabela, rekord_id, wynik, przyjeto) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$tabletId, $zid, mb_substr($tabela, 0, 20), mb_substr(is_scalar($id) ? $id : '', 0, 40), 'odrzucono', teraz_utc()]);
    } catch (PDOException $e) {
        error_log('SILT Lista odrzucona: ' . $e->getMessage());
    }
}

/* ------------------------------------------------------------------
 * POBIERANIE (serwer → tablet): przywracanie na nowym tablecie i odświeżanie
 *
 * GET ?akcja=pobierz&od_rev=0
 * Odpowiedź: {"ok":true, "od_rev":0, "do_rev":2000, "wiecej":true,
 *             "dane":{"listy":[…], "instruktorzy":[…], "grupy":[…], …}}
 * Zawiera też wiersze w koszu (usunieto != null). Tablet pyta dalej od do_rev, dopóki wiecej = true.
 * ------------------------------------------------------------------ */
function akcja_pobierz(): void
{
    $od = (int)($_GET['od_rev'] ?? 0);
    if ($od < 0) $od = 0;
    $pdo = baza();

    // Jeden spójny obraz bazy dla licznika i wszystkich tabel.
    $pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    $pdo->exec('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    try {
        $max = biezacy_rev();
        $do = min($max, $od + ROZMIAR_STRONY_REV);
        $dane = [];
        foreach (TABELE as $tabela => $_) {
            $st = $pdo->prepare("SELECT * FROM `$tabela` WHERE rev > ? AND rev <= ? ORDER BY rev");
            $st->execute([$od, $do]);
            $dane[$tabela] = array_map(function ($w) use ($tabela) { return rekord_dla_tabletu($tabela, $w); }, $st->fetchAll());
        }
        $pdo->exec('COMMIT');
    } catch (Throwable $e) {
        $pdo->exec('ROLLBACK');
        throw $e;
    }
    odpowiedz(['ok' => true, 'od_rev' => $od, 'do_rev' => $do, 'wiecej' => $do < $max, 'dane' => $dane]);
}

/* ------------------------------------------------------------------
 * START — pierwsze pytanie aplikacji po uruchomieniu (także ze starą wersją)
 * GET ?akcja=start → minimalna wersja, wersja cennika, ostatni rev, czas serwera
 * ------------------------------------------------------------------ */
function akcja_start(array $tablet): void
{
    $min = ustawienie('min_wersja_app', '0.0.0');
    $wersja = naglowek('X-App-Wersja');
    odpowiedz([
        'ok' => true,
        'min_wersja' => $min,
        'aktualizacja' => $wersja === '' || version_compare($wersja, $min, '<'),
        'cennik_wersja' => (int)ustawienie('cennik_wersja', '1'),
        'rev' => biezacy_rev(),
        'czas_serwera' => gmdate('Y-m-d\TH:i:s\Z'),
        'tablet' => ['id' => $tablet['id'], 'nazwa' => $tablet['nazwa']],
    ]);
}

/* ------------------------------------------------------------------
 * CENNIK — GET ?akcja=cennik
 * Tablet pobiera, gdy cennik_wersja z „start” jest większa niż zapisana u niego.
 * ------------------------------------------------------------------ */
function akcja_cennik(): void
{
    $pdo = baza();
    $liczby = function (string $s): array {
        return $s === '' ? [] : array_map('intval', explode(',', $s));
    };

    $pakiety = [];
    foreach ($pdo->query('SELECT * FROM pakiety WHERE aktywny = 1 ORDER BY atrakcja, kolejnosc, id') as $p) {
        $pakiety[$p['atrakcja']][] = [
            'id' => (int)$p['id'], 'nazwa' => $p['nazwa'], 'kulki' => (int)$p['kulki'], 'cena' => (float)$p['cena'],
            'typ' => $p['typ'], 'limit' => (int)$p['limit_osob'], 'extra' => (float)$p['cena_extra'],
        ];
    }
    $atrakcje = [];
    foreach ($pdo->query('SELECT * FROM atrakcje WHERE aktywna = 1 ORDER BY kolejnosc, klucz') as $a) {
        $atrakcje[] = [
            'klucz' => $a['klucz'], 'nazwa' => $a['nazwa'], 'podpis' => $a['podpis'], 'stat' => $a['stat_nazwa'], 'kolor' => $a['kolor'],
            'kdod' => $a['kdod_ilosc'] === null ? null : ['ilosc' => (int)$a['kdod_ilosc'], 'cena' => (float)$a['kdod_cena']],
            'opcje_pakiet' => $liczby($a['opcje_pakiet']), 'opcje_dok' => $liczby($a['opcje_dok']),
            'pakiety' => $pakiety[$a['klucz']] ?? [],
        ];
    }
    $sprzet = [];
    foreach ($pdo->query('SELECT * FROM sprzet WHERE aktywny = 1 ORDER BY kolejnosc, id') as $s) {
        $sprzet[] = ['nazwa' => $s['nazwa'], 'cena' => (float)$s['cena'], 'ikona' => $s['ikona']];
    }
    $dodatki = ['glowne' => [], 'wiecej' => []];
    foreach ($pdo->query('SELECT * FROM dodatki_katalog WHERE aktywny = 1 ORDER BY sekcja, kolejnosc, id') as $d) {
        $dodatki[$d['sekcja'] === 'wiecej' ? 'wiecej' : 'glowne'][] = ['nazwa' => $d['nazwa'], 'ikona' => $d['ikona']];
    }

    odpowiedz([
        'ok' => true,
        'wersja' => (int)ustawienie('cennik_wersja', '1'),
        'atrakcje' => $atrakcje,
        'sprzet' => $sprzet,
        'dodatki' => $dodatki,
        'dym_cena' => (float)ustawienie('dym_cena', '10'),
        'worek' => ['szt' => (int)ustawienie('worek_szt', '500'), 'cena' => (float)ustawienie('worek_cena', '40')],
    ]);
}

/* ------------------------------------------------------------------
 * ZGŁOSZENIE BŁĘDU — POST ?akcja=blad {"czas","ekran","komunikat","stos"}
 * Działa też bez logowania (aplikacja mogła się wysypać przed zalogowaniem).
 * ------------------------------------------------------------------ */
const LIMIT_BLEDOW_NA_GODZINE = 100;

function akcja_blad(?array $tablet, array $body): void
{
    $pdo = baza();
    $n = (int)$pdo->query('SELECT COUNT(*) FROM bledy WHERE przyjeto > UTC_TIMESTAMP() - INTERVAL 1 HOUR')->fetchColumn();
    if ($n >= LIMIT_BLEDOW_NA_GODZINE) odpowiedz(['ok' => true, 'pominieto' => true]);

    $komunikat = mb_substr(trim((string)($body['komunikat'] ?? '')), 0, 500);
    if ($komunikat === '') throw new BladApi('zle_dane', 'Brak treści błędu');
    $czas = czas_z_iso($body['czas'] ?? null) ?? teraz_utc();

    $pdo->prepare('INSERT INTO bledy (tablet_id, wersja_app, czas, przyjeto, ekran, komunikat, stos) VALUES (?, ?, ?, UTC_TIMESTAMP(), ?, ?, ?)')
        ->execute([
            $tablet ? $tablet['id'] : null,
            mb_substr(naglowek('X-App-Wersja'), 0, 20) ?: null,
            substr($czas, 0, 19),
            mb_substr((string)($body['ekran'] ?? ''), 0, 60) ?: null,
            $komunikat,
            mb_substr((string)($body['stos'] ?? ''), 0, 20000) ?: null,
        ]);
    odpowiedz(['ok' => true]);
}
