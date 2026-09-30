<?php
// SILT Lista — wysyłka do Statystyk i SMS z danymi do faktur (jak w v19, źródło: baza Listy).
//
// Statystyki (filedops.pl/statystyka/api.php), te same tabele co przy ręcznym wpisie:
//   grupy   — 1 wiersz na grupę (atrakcja jak w Statystykach), przychód = kwota grupy z tabletu
//   koszty  — wydatki z listy (kategoria „Inne”, opis + uwagi)
//   pensje  — godziny, pensja (podstawa) i premia = godziny × premia (zł/h) pracownika ze Statystyk
// Id wpisów są stałe, a przed wysyłką kasowane są poprzednie wpisy dnia → ponowna wysyłka
// nadpisuje, nie dubluje. Dzień poprawiony po wysyłce cron wysyła ponownie (s_stat_rev).
//
// SMS: dla każdej grupy z fakturą — raz (s_sms_wyslano); nieudany ponawiany przy następnym cronie.

declare(strict_types=1);

/* ---------------------------- Statystyki: HTTP ---------------------------- */

function stat_wywolaj(string $metoda, string $tabela, string $id = '', ?array $body = null)
{
    $url = STAT_API_URL . '?table=' . urlencode($tabela) . ($id !== '' ? '&id=' . urlencode($id) : '');
    $ch = curl_init($url);
    $opt = [CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => $metoda, CURLOPT_TIMEOUT => 20, CURLOPT_CONNECTTIMEOUT => 10];
    if ($body !== null) {
        $opt[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE);
        $opt[CURLOPT_HTTPHEADER] = ['Content-Type: application/json'];
    }
    curl_setopt_array($ch, $opt);
    $res = curl_exec($ch);
    $kod = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($res === false) throw new Exception("Statystyki ($tabela): $err");
    $j = json_decode((string)$res, true);
    if ($kod >= 400 || (is_array($j) && isset($j['error']))) {
        throw new Exception("Statystyki ($tabela): " . (is_array($j) && isset($j['error']) ? $j['error'] : "HTTP $kod"));
    }
    return $j;
}

/** Pracownicy ze Statystyk (imię, stawka, premia) — do ekranu pensji na tablecie i do premii. */
function stat_pracownicy(): array
{
    static $cache = null;
    if ($cache === null) {
        $j = stat_wywolaj('GET', 'pracownicy');
        if (isset($j['data']) && is_array($j['data'])) $j = $j['data'];
        $cache = [];
        foreach ((array)$j as $w) {
            if (!is_array($w)) continue;
            $cache[] = [
                'id' => (string)($w['id'] ?? ''),
                'imie' => (string)($w['imie'] ?? ''),
                'stawka' => (float)($w['stawka'] ?? 0),
                'premia' => (float)($w['premia'] ?? 0),
                'aktywny' => !isset($w['aktywny']) || (bool)(int)$w['aktywny'],
            ];
        }
    }
    return $cache;
}

function stat_id(string $prefiks, string $surowe): string
{
    // krótkie, stałe id (kolumna id w Statystykach jest krótka) — ten sam wzór co w v19
    return $prefiks . substr(md5($surowe), 0, 11);
}

/* ---------------------------- Dane dnia z bazy ---------------------------- */

/** Najwyższy rev danych dnia, od których zależą statystyki. */
function rev_tresci_dnia(string $data): int
{
    $st = baza()->prepare(
        'SELECT GREATEST(
            COALESCE((SELECT MAX(rev) FROM grupy WHERE data = :d1), 0),
            COALESCE((SELECT MAX(rev) FROM instruktorzy WHERE data = :d2), 0),
            COALESCE((SELECT MAX(f.rev) FROM faktury f JOIN grupy g ON g.id = f.grupa_id WHERE g.data = :d3), 0),
            COALESCE((SELECT MAX(rev) FROM wydatki WHERE data = :d4), 0),
            COALESCE((SELECT MAX(rev) FROM pensje WHERE data = :d5), 0))'
    );
    $st->execute([':d1' => $data, ':d2' => $data, ':d3' => $data, ':d4' => $data, ':d5' => $data]);
    return (int)$st->fetchColumn();
}

/** Wiersze do wysłania do Statystyk: [[tabela, id, body], …]. */
function wiersze_statystyk(string $data): array
{
    $pdo = baza();
    $wiersze = [];

    $st = $pdo->prepare(
        'SELECT g.*, COALESCE(a.stat_nazwa, UPPER(g.atrakcja)) AS stat_atrakcja, i.imie AS instruktor,
                (f.grupa_id IS NOT NULL) AS ma_fakture
         FROM grupy g
         LEFT JOIN atrakcje a ON a.klucz = g.atrakcja
         LEFT JOIN instruktorzy i ON i.id = g.instruktor_id
         LEFT JOIN faktury f ON f.grupa_id = g.id AND f.usunieto IS NULL
         WHERE g.data = ? AND g.usunieto IS NULL
         ORDER BY g.utworzono, g.id'
    );
    $st->execute([$data]);
    foreach ($st->fetchAll() as $g) {
        $nota = 'Lista: org. ' . ($g['organizator'] !== '' ? $g['organizator'] : '-') . ', instr. ' . ($g['instruktor'] ?: '-')
            . ($g['pakiet_nazwa'] !== '' ? ', ' . $g['pakiet_nazwa'] : '')
            . ((int)$g['w_kulki_dok'] ? ', dokupione ' . (int)$g['w_kulki_dok'] . ' kulek' : '')
            . ((int)$g['w_dym'] ? ', dym ' . (int)$g['w_dym'] : '')
            . ((int)$g['ma_fakture'] ? ', FAKTURA' : '')
            . ($g['platnosc'] !== '' ? ', ' . $g['platnosc'] : '');
        $wiersze[] = ['grupy', stat_id('LG', $data . $g['id']), [
            'data' => $data, 'atrakcja' => $g['stat_atrakcja'], 'gracze' => (int)$g['w_gracze'], 'grupy' => 1,
            'kulki' => (int)$g['w_kulki'], 'przychod' => round((float)$g['w_kwota'], 2), 'koszty' => 0,
            'notatka' => mb_substr($nota, 0, 250),
        ]];
    }

    $st = $pdo->prepare('SELECT * FROM wydatki WHERE data = ? AND usunieto IS NULL ORDER BY kolejnosc, id');
    $st->execute([$data]);
    foreach ($st->fetchAll() as $w) {
        if (!(float)$w['kwota'] && $w['opis'] === '') continue;
        $opis = trim($w['opis'] . ($w['uwagi'] !== '' ? ' — ' . $w['uwagi'] : ''));
        $wiersze[] = ['koszty', stat_id('LK', $data . $w['id']), [
            'data' => $data, 'kategoria' => 'Inne', 'opis' => mb_substr($opis, 0, 250), 'kwota' => round((float)$w['kwota'], 2),
        ]];
    }

    $st = $pdo->prepare('SELECT * FROM pensje WHERE data = ? AND usunieto IS NULL ORDER BY kolejnosc, id');
    $st->execute([$data]);
    $pensje = $st->fetchAll();
    if ($pensje) {
        // Premia jak przy ręcznym wpisie: godziny × premia pracownika ze Statystyk.
        // Gdy Statystyki nie odpowiadają → stawka premii zapisana na tablecie przy dodaniu pensji.
        $poId = []; $poImieniu = [];
        try {
            foreach (stat_pracownicy() as $p) {
                if ($p['id'] !== '') $poId[$p['id']] = $p;
                if ($p['imie'] !== '') $poImieniu[mb_strtolower(trim($p['imie']))] = $p;
            }
        } catch (Exception $e) { /* zostaje premia z tabletu */ }
        foreach ($pensje as $p) {
            $h = (float)$p['godziny'];
            $prac = $poId[$p['prac_id']] ?? ($poImieniu[mb_strtolower(trim($p['imie']))] ?? null);
            $stawkaPremii = $prac ? $prac['premia'] : (float)$p['premia_stawka'];
            $wiersze[] = ['pensje', stat_id('LP', $data . $p['id']), [
                'data' => $data, 'pracownikId' => $p['prac_id'], 'pracownikImie' => $p['imie'],
                'godziny' => $h, 'stawka' => (float)$p['stawka'], 'kwota' => round((float)$p['kwota'], 2),
                'premia' => round($h * $stawkaPremii, 2),
            ]];
        }
    }
    return $wiersze;
}

/* ---------------------------- Wysyłka dnia ---------------------------- */

/**
 * Wysyła dzień do Statystyk. $przez: 'auto' (cron) | 'tablet'.
 * Zwraca opis wyniku; przy błędzie zapisuje go w listy.s_stat_blad i rzuca wyjątek.
 */
function wyslij_statystyki_dnia(string $data, string $przez): string
{
    $pdo = baza();
    $st = $pdo->prepare('SELECT * FROM listy WHERE data = ? AND usunieto IS NULL');
    $st->execute([$data]);
    $lista = $st->fetch();
    if (!$lista) throw new Exception('Brak listy z dnia ' . $data . ' na serwerze');

    $revTresci = rev_tresci_dnia($data);
    $poprzednie = json_decode((string)$lista['s_stat_wpisy'], true) ?: [];

    try {
        $wiersze = wiersze_statystyk($data);
        // 1) usuń wpisy poprzedniej wysyłki (np. grupa skasowana po wysłaniu)
        foreach ($poprzednie as $pw) {
            try { stat_wywolaj('DELETE', (string)$pw[0], (string)$pw[1]); } catch (Exception $e) { /* już nie ma */ }
        }
        // 2) wyślij aktualne (DELETE + POST = nadpisanie)
        $wyslane = [];
        foreach ($wiersze as [$tabela, $id, $body]) {
            try { stat_wywolaj('DELETE', $tabela, $id); } catch (Exception $e) { /* nie było */ }
            $body['id'] = $id;
            stat_wywolaj('POST', $tabela, '', $body);
            $wyslane[] = [$tabela, $id];
        }
    } catch (Exception $e) {
        // Zapamiętaj, co już poszło — przy ponownej próbie zostanie skasowane i wysłane od nowa.
        $wpisy = array_merge($poprzednie, $wyslane ?? []);
        zapisz_stan_statystyk($data, [
            's_stat_blad' => mb_substr($e->getMessage(), 0, 500),
            's_stat_wpisy' => json_encode(array_values(array_unique($wpisy, SORT_REGULAR))),
        ]);
        throw $e;
    }

    zapisz_stan_statystyk($data, [
        's_stat_wyslano' => gmdate('Y-m-d H:i:s'),
        's_stat_przez' => $przez,
        's_stat_wpisy' => json_encode($wyslane),
        's_stat_blad' => null,
        's_stat_rev' => $revTresci,
    ]);
    $n = count($wiersze);
    return $n ? "wysłano ($n wpisów)" : 'lista pusta — usunięto poprzednie wpisy';
}

/** Zapis kolumn s_… listy + nowy rev (tablet zobaczy zmianę przy następnym pobieraniu). */
function zapisz_stan_statystyk(string $data, array $kolumny): void
{
    $pdo = baza();
    $pdo->beginTransaction();
    try {
        $kolumny['rev'] = nowy_rev();
        $ustaw = implode(',', array_map(function ($k) { return "`$k` = ?"; }, array_keys($kolumny)));
        $pdo->prepare("UPDATE listy SET $ustaw WHERE data = ?")->execute(array_merge(array_values($kolumny), [$data]));
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

/** Czy dzień trzeba (ponownie) wysłać do Statystyk. */
function dzien_do_wyslania(array $lista): bool
{
    $maTresc = (int)baza()->query(
        'SELECT (SELECT COUNT(*) FROM grupy WHERE data = ' . baza()->quote($lista['data']) . ' AND usunieto IS NULL)'
        . ' + (SELECT COUNT(*) FROM wydatki WHERE data = ' . baza()->quote($lista['data']) . ' AND usunieto IS NULL)'
        . ' + (SELECT COUNT(*) FROM pensje WHERE data = ' . baza()->quote($lista['data']) . ' AND usunieto IS NULL)'
    )->fetchColumn() > 0;
    $bylyWpisy = (json_decode((string)$lista['s_stat_wpisy'], true) ?: []) !== [];

    if ($lista['s_stat_wyslano'] === null) return $maTresc || $bylyWpisy;
    return rev_tresci_dnia($lista['data']) > (int)$lista['s_stat_rev'];   // poprawiono po wysyłce
}

/* ---------------------------- SMS faktur ---------------------------- */

function sms_wyslij(string $tresc): void
{
    if (SMSAPI_TOKEN === '' || SMSAPI_TOKEN === 'WPISZ_TOKEN_TUTAJ') throw new Exception('Brak tokenu SMSAPI w config.php');
    $post = ['to' => SMS_FAKTURY_NUMER, 'message' => $tresc, 'encoding' => 'utf-8', 'format' => 'json'];
    if (SMS_NADAWCA !== '') $post['from'] = SMS_NADAWCA;
    $ch = curl_init(SMSAPI_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($post),
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . SMSAPI_TOKEN],
        CURLOPT_TIMEOUT => 15,
    ]);
    $res = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    if ($res === false) throw new Exception('SMSAPI: ' . $err);
    $j = json_decode((string)$res, true);
    if (!is_array($j)) throw new Exception('SMSAPI: nieczytelna odpowiedź');
    if (isset($j['error'])) throw new Exception('SMSAPI: ' . ($j['message'] ?? $j['error']));
}

function zl_sms($v): string
{
    $v = round((float)$v, 2);
    return (floor($v) == $v ? number_format($v, 0, ',', ' ') : number_format($v, 2, ',', ' ')) . ' zl';
}

function tresc_sms_faktury(array $f): string
{
    return "SILT - dane do faktury\n"
        . date('d.m.Y', strtotime($f['data'])) . ' ' . $f['stat_atrakcja'] . "\n"
        . 'Organizator: ' . ($f['organizator'] !== '' ? $f['organizator'] : '-') . ' (instr. ' . ($f['instruktor'] ?: '-') . ")\n"
        . 'NIP: ' . $f['nip'] . "\n"
        . 'Tel: ' . $f['tel'] . "\n"
        . 'Email: ' . $f['email'] . "\n"
        . 'Kwota: ' . zl_sms($f['kwota']) . "\n"
        . 'Platnosc: ' . $f['platnosc'];
}

function zapisz_stan_sms(string $grupaId, string $data, array $kolumny): void
{
    $pdo = baza();
    $pdo->beginTransaction();
    try {
        $przed = rev_tresci_dnia($data);
        $kolumny['rev'] = nowy_rev();
        $ustaw = implode(',', array_map(function ($k) { return "`$k` = ?"; }, array_keys($kolumny)));
        $pdo->prepare("UPDATE faktury SET $ustaw WHERE grupa_id = ?")->execute(array_merge(array_values($kolumny), [$grupaId]));
        // To zmiana serwera, nie poprawka listy: jeśli statystyki dnia były aktualne, zostają aktualne
        // (inaczej cron wysłałby dzień jeszcze raz tylko dlatego, że poszedł SMS).
        $pdo->prepare('UPDATE listy SET s_stat_rev = ? WHERE data = ? AND s_stat_wyslano IS NOT NULL AND s_stat_rev >= ?')
            ->execute([$kolumny['rev'], $data, $przed]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

/* ---------------------------- Codziennie o 6:00 ---------------------------- */

/**
 * Dla dni od (dziś − DNI_WSTECZ) do wczoraj:
 *  1) statystyki niewysłane albo poprawione po wysyłce → wyślij,
 *  2) faktury bez wysłanego SMS → wyślij SMS.
 */
function codzienna_wysylka(): array
{
    $pdo = baza();
    $od = date('Y-m-d', strtotime('-' . (int)DNI_WSTECZ . ' days'));
    $do = dzis();
    $log = [];

    $st = $pdo->prepare('SELECT * FROM listy WHERE data >= ? AND data < ? AND usunieto IS NULL ORDER BY data');
    $st->execute([$od, $do]);
    foreach ($st->fetchAll() as $lista) {
        if (!dzien_do_wyslania($lista)) continue;
        try {
            $log[] = $lista['data'] . ': statystyki ' . wyslij_statystyki_dnia($lista['data'], 'auto');
        } catch (Exception $e) {
            $log[] = $lista['data'] . ': BŁĄD statystyk — ' . $e->getMessage();
        }
    }

    $st = $pdo->prepare(
        'SELECT f.*, g.data, g.organizator, COALESCE(a.stat_nazwa, UPPER(g.atrakcja)) AS stat_atrakcja, i.imie AS instruktor
         FROM faktury f
         JOIN grupy g ON g.id = f.grupa_id AND g.usunieto IS NULL
         JOIN listy l ON l.data = g.data AND l.usunieto IS NULL
         LEFT JOIN atrakcje a ON a.klucz = g.atrakcja
         LEFT JOIN instruktorzy i ON i.id = g.instruktor_id
         WHERE f.usunieto IS NULL AND f.s_sms_wyslano IS NULL AND g.data >= ? AND g.data < ?
         ORDER BY g.data, g.utworzono'
    );
    $st->execute([$od, $do]);
    foreach ($st->fetchAll() as $f) {
        try {
            sms_wyslij(tresc_sms_faktury($f));
            zapisz_stan_sms($f['grupa_id'], $f['data'], ['s_sms_wyslano' => gmdate('Y-m-d H:i:s'), 's_sms_blad' => null]);
            $log[] = $f['data'] . ': SMS faktura (' . ($f['organizator'] ?: '-') . ')';
        } catch (Exception $e) {
            zapisz_stan_sms($f['grupa_id'], $f['data'], ['s_sms_blad' => mb_substr($e->getMessage(), 0, 500)]);
            $log[] = $f['data'] . ': BŁĄD SMS — ' . $e->getMessage();
        }
    }
    return $log;
}

/* ---------------------------- Akcje API dla tabletu ---------------------------- */

/**
 * POST ?akcja=statystyki {"data":"2026-09-30"} — wyślij dzień do Statystyk teraz
 * (przycisk na tablecie). Tablet najpierw wysyła swoją kolejkę zmian, potem woła tę akcję.
 * Dzień już wysłany i niepoprawiany → nic nie robi (chyba że "wymus": true).
 */
function akcja_statystyki(array $body): void
{
    $data = (string)($body['data'] ?? '');
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $data, $m) || !checkdate((int)$m[2], (int)$m[3], (int)$m[1])) {
        throw new BladApi('zle_dane', 'Zła data');
    }
    $st = baza()->prepare('SELECT * FROM listy WHERE data = ? AND usunieto IS NULL');
    $st->execute([$data]);
    $lista = $st->fetch();
    if (!$lista) throw new BladApi('brak_listy', 'Tej listy nie ma jeszcze na serwerze — poczekaj, aż tablet wyśle zmiany', 404);

    if (empty($body['wymus']) && $lista['s_stat_wyslano'] !== null && !dzien_do_wyslania($lista)) {
        odpowiedz(['ok' => true, 'msg' => 'Statystyki z tego dnia są już wysłane', 'wyslano' => czas_do_iso($lista['s_stat_wyslano'])]);
    }
    try {
        $wynik = wyslij_statystyki_dnia($data, 'tablet');
    } catch (Exception $e) {
        throw new BladApi('statystyki', 'Nie udało się wysłać do Statystyk: ' . $e->getMessage() . ' — spróbuję o 6:00', 502);
    }
    odpowiedz(['ok' => true, 'msg' => 'Wysłano do Statystyk (' . $data . '): ' . $wynik]);
}

/** GET ?akcja=pracownicy — lista pracowników ze Statystyk (ekran pensji). */
function akcja_pracownicy(): void
{
    try {
        $lista = array_values(array_filter(stat_pracownicy(), function ($p) { return $p['aktywny']; }));
    } catch (Exception $e) {
        throw new BladApi('statystyki', 'Statystyki nie odpowiadają — wpisz pracownika ręcznie', 502);
    }
    odpowiedz(['ok' => true, 'pracownicy' => $lista]);
}
