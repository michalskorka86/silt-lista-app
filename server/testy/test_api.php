<?php
// ============================================================
// SILT Lista — test API na lokalnej bazie (NIE uruchamiać na serwerze produkcyjnym).
//
//   1. Pusta baza testowa + schemat:  mysql -uroot silt_test < server/sql/001_schemat.sql
//   2. config testowy (LISTA_HASLO = 'test123', CRON_KEY = 'cron-test'), np. /tmp/config-test.php
//   3. Serwer:  SILT_CONFIG=/tmp/config-test.php php -S 127.0.0.1:8765 -t server
//   4. Test:    SILT_CONFIG=/tmp/config-test.php php server/testy/test_api.php http://127.0.0.1:8765
// ============================================================

declare(strict_types=1);

$URL = rtrim($argv[1] ?? 'http://127.0.0.1:8765', '/') . '/api.php';
require getenv('SILT_CONFIG') ?: __DIR__ . '/../config.php';

$pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec("SET time_zone = '+00:00'");

$bledy = 0;
$token = '';
$WERSJA = '1.0.0';

function api(string $akcja, ?array $body = null, array $extra = [], array $naglowki = []): array
{
    global $URL, $token, $WERSJA;
    $ch = curl_init($URL . '?akcja=' . $akcja . ($extra ? '&' . http_build_query($extra) : ''));
    $h = array_merge(['Content-Type: application/json', 'X-App-Wersja: ' . $WERSJA], $token ? ['X-Tablet-Token: ' . $token] : [], $naglowki);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $h]);
    if ($body !== null) { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body)); }
    $res = (string)curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $j = json_decode($res, true);
    if (!is_array($j)) { echo "  Odpowiedź nie-JSON (HTTP $code): $res\n"; $j = []; }
    $j['_http'] = $code;
    return $j;
}

function sprawdz(string $opis, bool $ok, $pokaz = null): void
{
    global $bledy;
    echo ($ok ? '  ✔ ' : '  ✘ ') . $opis . ($ok || $pokaz === null ? '' : ' → ' . json_encode($pokaz, JSON_UNESCAPED_UNICODE)) . "\n";
    if (!$ok) $bledy++;
}

function wyniki(array $r): array { return array_map(function ($w) { return $w['wynik']; }, $r['wyniki'] ?? []); }

$T0 = '2026-09-30T10:00:00.000Z';
$T1 = '2026-09-30T10:05:00.000Z';
$T2 = '2026-09-30T10:10:00.000Z';

$lista    = ['id' => 'z1', 'tabela' => 'listy', 'rekord' => ['data' => '2026-09-30'], 'zmieniono' => $T0];
$instr    = ['id' => 'z2', 'tabela' => 'instruktorzy', 'rekord' => ['id' => 't1', 'data' => '2026-09-30', 'imie' => 'Monika', 'kolejnosc' => 0], 'zmieniono' => $T0];
$grupaRek = ['id' => 'g1', 'data' => '2026-09-30', 'instruktor_id' => 't1', 'godzina' => '10:30', 'utworzono' => $T0,
             'organizator' => 'Óla Źdźbło', 'atrakcja' => 'klasyk', 'pakiet_nazwa' => 'Pakiet SILT', 'pakiet_typ' => 'os',
             'pakiet_kulki' => 500, 'pakiet_cena' => 130, 'kdod_ilosc' => 100, 'kdod_cena' => 15,
             'zadatek' => 100, 'platnosc' => 'Karta', 'w_gracze' => 10, 'w_kulki' => 1700, 'w_kulki_dok' => 500, 'w_dym' => 2, 'w_kwota' => 1395];
$grupa    = ['id' => 'z3', 'tabela' => 'grupy', 'rekord' => $grupaRek, 'zmieniono' => $T0];
$gracz    = ['id' => 'z4', 'tabela' => 'gracze', 'rekord' => ['id' => 'p1', 'grupa_id' => 'g1', 'imie' => 'Bartek',
             'sprzet' => [['nazwa' => 'Własny', 'kwota' => 40]], 'worki_ilosc' => 1, 'worki_szt' => 500, 'worki_cena' => 40], 'zmieniono' => $T0];
$pozycja  = ['id' => 'z5', 'tabela' => 'pozycje', 'rekord' => ['id' => 'i1', 'gracz_id' => 'p1', 'rodzaj' => 'dym', 'ilosc' => 2, 'kwota' => 20], 'zmieniono' => $T0];
$faktura  = ['id' => 'z6', 'tabela' => 'faktury', 'rekord' => ['grupa_id' => 'g1', 'nip' => '1234567890', 'tel' => '500600700',
             'email' => 'a@b.pl', 'kwota' => 1395, 'platnosc' => 'Przelew'], 'zmieniono' => $T0];
$wydatek  = ['id' => 'z7', 'tabela' => 'wydatki', 'rekord' => ['id' => 'w1', 'data' => '2026-09-30', 'opis' => 'Paliwo', 'kwota' => '150,00'], 'zmieniono' => $T0];
$pensja   = ['id' => 'z8', 'tabela' => 'pensje', 'rekord' => ['id' => 'pn1', 'data' => '2026-09-30', 'imie' => 'Monika',
             'godziny' => 7.5, 'stawka' => 30, 'kwota' => 230, 'premia_stawka' => 5], 'zmieniono' => $T0];
$dodatek  = ['id' => 'z9', 'tabela' => 'dodatki', 'rekord' => ['id' => 'd1', 'grupa_id' => 'g1', 'nazwa' => 'Ognisko', 'kwota' => 200], 'zmieniono' => $T0];

echo "Logowanie\n";
$r = api('start');
sprawdz('start bez logowania → 401 zaloguj', $r['_http'] === 401 && ($r['kod'] ?? '') === 'zaloguj', $r);
$r = api('zaloguj', ['haslo' => 'zle', 'tablet_id' => 'tablet-test-1']);
sprawdz('złe hasło → 401', $r['_http'] === 401 && ($r['kod'] ?? '') === 'zle_haslo', $r);
$r = api('zaloguj', ['haslo' => 'test123', 'tablet_id' => 'tablet-test-1', 'model' => 'Lenovo TB328XU']);
sprawdz('dobre hasło → token', !empty($r['token']), $r);
$token = $r['token'] ?? '';

echo "Start i cennik\n";
$r = api('start');
sprawdz('start: min_wersja 1.0.0, bez aktualizacji', ($r['min_wersja'] ?? '') === '1.0.0' && ($r['aktualizacja'] ?? true) === false, $r);
$r = api('cennik');
$klasyk = $r['atrakcje'][0] ?? [];
sprawdz('cennik: 7 atrakcji, Klasyk ma 3 pakiety, SILT 130 zł', count($r['atrakcje'] ?? []) === 7 && count($klasyk['pakiety'] ?? []) === 3 && ($klasyk['pakiety'][1]['cena'] ?? 0) == 130, $r);
sprawdz('cennik: laser bez kulek dodatkowych, dym 10 zł, worek 500/40', array_key_exists('kdod', $r['atrakcje'][6] ?? []) && $r['atrakcje'][6]['kdod'] === null && ($r['dym_cena'] ?? 0) == 10 && ($r['worek']['szt'] ?? 0) === 500, $r);
sprawdz('cennik: 4 pozycje sprzętu, emoji zachowane', count($r['sprzet'] ?? []) === 4 && ($r['sprzet'][0]['ikona'] ?? '') === '🎒', $r['sprzet'] ?? null);

echo "Wysyłanie zmian\n";
$paczka = [$lista, $instr, $grupa, $gracz, $pozycja, $faktura, $wydatek, $pensja, $dodatek];
$r = api('wyslij', ['zmiany' => $paczka]);
sprawdz('9 zmian → wszystkie zapisano', wyniki($r) === array_fill(0, 9, 'zapisano'), $r);
$rev1 = $r['rev'] ?? 0;
$r = api('wyslij', ['zmiany' => $paczka]);
sprawdz('ta sama paczka drugi raz → te same wyniki, rev bez zmian', wyniki($r) === array_fill(0, 9, 'zapisano') && ($r['rev'] ?? -1) === $rev1, $r);
sprawdz('w bazie 1 grupa (bez dublowania)', (int)$pdo->query('SELECT COUNT(*) FROM grupy')->fetchColumn() === 1);
sprawdz('polskie znaki zapisane', $pdo->query("SELECT organizator FROM grupy WHERE id='g1'")->fetchColumn() === 'Óla Źdźbło');
sprawdz('kwota „150,00” (z przecinkiem) zapisana jako 150', (float)$pdo->query("SELECT kwota FROM wydatki WHERE id='w1'")->fetchColumn() === 150.0);

$r = api('wyslij', ['zmiany' => [['id' => 'z10', 'tabela' => 'gracze', 'rekord' => ['id' => 'p9', 'grupa_id' => 'nie-ma', 'imie' => 'X'], 'zmieniono' => $T0]]]);
sprawdz('gracz do nieistniejącej grupy → czeka', wyniki($r) === ['czeka'], $r);
$r = api('wyslij', ['zmiany' => [['id' => 'z10', 'tabela' => 'gracze', 'rekord' => ['id' => 'p9', 'grupa_id' => 'nie-ma', 'imie' => 'X'], 'zmieniono' => $T0]]]);
sprawdz('ponowienie „czeka” → dalej czeka (nie zapamiętane)', wyniki($r) === ['czeka'], $r);

$zla = $grupa; $zla['id'] = 'z11'; unset($zla['rekord']['atrakcja']);
$r = api('wyslij', ['zmiany' => [$zla]]);
sprawdz('grupa bez atrakcji → odrzucono z powodem', wyniki($r) === ['odrzucono'] && strpos($r['wyniki'][0]['msg'] ?? '', 'atrakcja') !== false, $r);
$r = api('wyslij', ['zmiany' => [$zla]]);
sprawdz('ponowienie odrzuconej → odrzucono', wyniki($r) === ['odrzucono'], $r);
$zla2 = $grupa; $zla2['id'] = 'z12'; $zla2['rekord']['platnosc'] = 'Bitcoin';
$r = api('wyslij', ['zmiany' => [$zla2]]);
sprawdz('niedozwolona płatność → odrzucono', wyniki($r) === ['odrzucono'], $r);
$zla3 = $grupa; $zla3['id'] = 'z13'; $zla3['zmieniono'] = 'jutro';
$r = api('wyslij', ['zmiany' => [$zla3]]);
sprawdz('zły czas zmiany → odrzucono', wyniki($r) === ['odrzucono'], $r);

echo "Która wersja wygrywa\n";
$nowa = $grupa; $nowa['id'] = 'z14'; $nowa['zmieniono'] = $T2; $nowa['rekord']['w_kwota'] = 1500; $nowa['rekord']['kwota_reczna'] = 1500;
$r = api('wyslij', ['zmiany' => [$nowa]]);
sprawdz('nowsza zmiana → zapisano', wyniki($r) === ['zapisano'], $r);
$stara = $grupa; $stara['id'] = 'z15'; $stara['zmieniono'] = $T1; $stara['rekord']['w_kwota'] = 999;
$r = api('wyslij', ['zmiany' => [$stara]]);
sprawdz('starsza zmiana → starsza, kwota zostaje 1500', wyniki($r) === ['starsza'] && (float)$pdo->query("SELECT w_kwota FROM grupy WHERE id='g1'")->fetchColumn() === 1500.0, $r);

echo "Pobieranie\n";
$r = api('pobierz', null, ['od_rev' => 0]);
$d = $r['dane'] ?? [];
sprawdz('od 0: po 1 wierszu w każdej tabeli', count($d['listy'] ?? []) === 1 && count($d['grupy'] ?? []) === 1 && count($d['gracze'] ?? []) === 1
    && count($d['pozycje'] ?? []) === 1 && count($d['faktury'] ?? []) === 1 && count($d['pensje'] ?? []) === 1 && ($r['wiecej'] ?? true) === false, $r);
$g = $d['grupy'][0] ?? [];
sprawdz('grupa: liczby jako liczby, czas ISO, kwota 1500', ($g['w_kwota'] ?? null) === 1500.0 || ($g['w_kwota'] ?? null) === 1500, $g);
sprawdz('grupa: zmieniono = ' . $T2, ($g['zmieniono'] ?? '') === $T2 && ($g['utworzono'] ?? '') === $T0, $g);
sprawdz('gracz: sprzęt jako lista', ($d['gracze'][0]['sprzet'][0]['nazwa'] ?? '') === 'Własny', $d['gracze'][0] ?? null);
sprawdz('lista: brak wewnętrznego s_stat_wpisy', !array_key_exists('s_stat_wpisy', $d['listy'][0] ?? []), $d['listy'][0] ?? null);
$rev2 = $r['do_rev'] ?? 0;

$kosz = $grupa; $kosz['id'] = 'z16'; $kosz['zmieniono'] = '2026-09-30T11:00:00.000Z'; $kosz['usunieto'] = '2026-09-30T11:00:00.000Z'; $kosz['rekord'] = $nowa['rekord'];
$r = api('wyslij', ['zmiany' => [$kosz]]);
$r = api('pobierz', null, ['od_rev' => $rev2]);
sprawdz('po usunięciu grupy pobieranie od ostatniego rev → tylko ta grupa, z datą usunięcia',
    count($r['dane']['grupy'] ?? []) === 1 && ($r['dane']['grupy'][0]['usunieto'] ?? null) === '2026-09-30T11:00:00.000Z' && count($r['dane']['listy'] ?? []) === 0, $r);

echo "Stara wersja aplikacji\n";
$WERSJA = '0.9.0';
$r = api('wyslij', ['zmiany' => [$lista]]);
sprawdz('wersja 0.9.0 → 426 aktualizacja', $r['_http'] === 426 && ($r['kod'] ?? '') === 'aktualizacja', $r);
$r = api('start');
sprawdz('start dalej działa i mówi „aktualizacja”', ($r['aktualizacja'] ?? false) === true, $r);
$WERSJA = '1.0.0';

echo "Zgłoszenie błędu\n";
$t = $token; $token = '';
$r = api('blad', ['komunikat' => 'TypeError: x is undefined', 'ekran' => 'lista', 'stos' => "at a\nat b", 'czas' => $T0]);
sprawdz('błąd bez logowania → przyjęty', ($r['ok'] ?? false) === true, $r);
$token = $t;

echo "Kosz — sprzątanie po 30 dniach\n";
$pdo->exec("UPDATE grupy SET usunieto = UTC_TIMESTAMP() - INTERVAL 31 DAY WHERE id = 'g1'");
$out = shell_exec('php ' . escapeshellarg(__DIR__ . '/../cron.php') . ' 2>&1');
sprawdz('cron.php skasował grupę razem z graczami, fakturą i dodatkami: ' . trim((string)$out),
    (int)$pdo->query('SELECT COUNT(*) FROM grupy')->fetchColumn() === 0 && (int)$pdo->query('SELECT COUNT(*) FROM gracze')->fetchColumn() === 0
    && (int)$pdo->query('SELECT COUNT(*) FROM faktury')->fetchColumn() === 0 && (int)$pdo->query('SELECT COUNT(*) FROM listy')->fetchColumn() === 1);

echo "Wylogowanie i blokada haseł\n";
$r = api('wyloguj', []);
$r = api('start');
sprawdz('po wylogowaniu → 401', $r['_http'] === 401, $r);
$token = '';
for ($i = 0; $i < 5; $i++) api('zaloguj', ['haslo' => 'zle', 'tablet_id' => 'tablet-test-2']);
$r = api('zaloguj', ['haslo' => 'test123', 'tablet_id' => 'tablet-test-2']);
sprawdz('po 5 złych hasłach nawet dobre → 429 blokada', $r['_http'] === 429, $r);

echo $bledy ? "\nBŁĘDY: $bledy\n" : "\nWszystko OK\n";
exit($bledy ? 1 : 0);
