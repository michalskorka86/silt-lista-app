<?php
// ============================================================
// SILT Lista — test API na lokalnej bazie (NIE uruchamiać na serwerze produkcyjnym).
//
//   1. Pusta baza testowa + schemat:  mysql -uroot silt_test < server/sql/001_schemat.sql
//                                     mysql -uroot silt_test < server/sql/002_statystyki.sql
//   2. config testowy: server/testy/config-test.sh (baza silt_test, atrapy Statystyk i SMSAPI)
//   3. Serwer:  SILT_CONFIG=… SILT_MOCK_DIR=… php -S 127.0.0.1:8765 -t server
//   4. Test:    SILT_CONFIG=… SILT_MOCK_DIR=… php server/testy/test_api.php http://127.0.0.1:8765
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

$lista    = ['id' => 'z1', 'tabela' => 'listy', 'rekord' => ['data' => '2025-06-01'], 'zmieniono' => $T0];
$instr    = ['id' => 'z2', 'tabela' => 'instruktorzy', 'rekord' => ['id' => 't1', 'data' => '2025-06-01', 'imie' => 'Monika', 'kolejnosc' => 0], 'zmieniono' => $T0];
$grupaRek = ['id' => 'g1', 'data' => '2025-06-01', 'instruktor_id' => 't1', 'godzina' => '10:30', 'utworzono' => $T0,
             'organizator' => 'Óla Źdźbło', 'atrakcja' => 'klasyk', 'pakiet_nazwa' => 'Pakiet SILT', 'pakiet_typ' => 'os',
             'pakiet_kulki' => 500, 'pakiet_cena' => 130, 'kdod_ilosc' => 100, 'kdod_cena' => 15,
             'zadatek' => 100, 'platnosc' => 'Karta', 'w_gracze' => 10, 'w_kulki' => 1700, 'w_kulki_dok' => 500, 'w_dym' => 2, 'w_kwota' => 1395];
$grupa    = ['id' => 'z3', 'tabela' => 'grupy', 'rekord' => $grupaRek, 'zmieniono' => $T0];
$gracz    = ['id' => 'z4', 'tabela' => 'gracze', 'rekord' => ['id' => 'p1', 'grupa_id' => 'g1', 'imie' => 'Bartek',
             'sprzet' => [['nazwa' => 'Własny', 'kwota' => 40]], 'worki_ilosc' => 1, 'worki_szt' => 500, 'worki_cena' => 40], 'zmieniono' => $T0];
$pozycja  = ['id' => 'z5', 'tabela' => 'pozycje', 'rekord' => ['id' => 'i1', 'gracz_id' => 'p1', 'rodzaj' => 'dym', 'ilosc' => 2, 'kwota' => 20], 'zmieniono' => $T0];
$faktura  = ['id' => 'z6', 'tabela' => 'faktury', 'rekord' => ['grupa_id' => 'g1', 'nip' => '1234567890', 'tel' => '500600700',
             'email' => 'a@b.pl', 'kwota' => 1395, 'platnosc' => 'Przelew'], 'zmieniono' => $T0];
$wydatek  = ['id' => 'z7', 'tabela' => 'wydatki', 'rekord' => ['id' => 'w1', 'data' => '2025-06-01', 'opis' => 'Paliwo', 'kwota' => '150,00'], 'zmieniono' => $T0];
$pensja   = ['id' => 'z8', 'tabela' => 'pensje', 'rekord' => ['id' => 'pn1', 'data' => '2025-06-01', 'imie' => 'Monika',
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
sprawdz('start: min_wersja 0.1.0, bez aktualizacji', ($r['min_wersja'] ?? '') === '0.1.0' && ($r['aktualizacja'] ?? true) === false, $r);
sprawdz('start: skrót PIN-u admina (bez samego PIN-u)', ($r['pin_skrot'] ?? '') === hash('sha256', 'silt-lista-pin|tablet-test-1|1234') && strpos(json_encode($r), '1234') === false, $r);
$r = api('cennik');
$klasyk = $r['atrakcje'][0] ?? [];
sprawdz('cennik: 7 atrakcji, Klasyk ma 4 pakiety, SILT 130 zł', count($r['atrakcje'] ?? []) === 7 && count($klasyk['pakiety'] ?? []) === 4 && ($klasyk['pakiety'][1]['cena'] ?? 0) == 130, $r);
sprawdz('cennik: Dzień Otwarty (Klasyk) na grupę, bez ceny — osoby, kulki i kasę wpisuje instruktor', ($klasyk['pakiety'][3]['typ'] ?? '') === 'grupa' && ($klasyk['pakiety'][3]['nazwa'] ?? '') === 'Dzień Otwarty' && ($klasyk['pakiety'][3]['cena'] ?? 1) == 0 && ($klasyk['pakiety'][3]['kulki'] ?? 1) === 0, $klasyk['pakiety'] ?? null);
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
$WERSJA = '0.0.9';
$r = api('wyslij', ['zmiany' => [$lista]]);
sprawdz('wersja 0.0.9 → 426 aktualizacja', $r['_http'] === 426 && ($r['kod'] ?? '') === 'aktualizacja', $r);
$r = api('start');
sprawdz('start dalej działa i mówi „aktualizacja”', ($r['aktualizacja'] ?? false) === true, $r);
$WERSJA = '1.0.0';

echo "Zgłoszenie błędu\n";
$t = $token; $token = '';
$r = api('blad', ['komunikat' => 'TypeError: x is undefined', 'ekran' => 'lista', 'stos' => "at a\nat b", 'czas' => $T0]);
sprawdz('błąd bez logowania → przyjęty', ($r['ok'] ?? false) === true, $r);
$token = $t;
$r = api('blad', ['komunikat' => 'Zgłoszenie: kwota <się> nie zmienia', 'ekran' => '/lista/2025-06-01', 'czas' => $T0]);
sprawdz('zgłoszenie z tabletu → przyjęte', ($r['ok'] ?? false) === true, $r);
$bledyUrl = preg_replace('#/api\.php$#', '/bledy.php', $URL);
$ctx = stream_context_create(['http' => ['ignore_errors' => true]]);
$bez = (string)@file_get_contents($bledyUrl, false, $ctx);
sprawdz('bledy.php bez klucza → brak dostępu', strpos($bez, 'Brak dostępu') !== false, $bez);
$z = (string)@file_get_contents($bledyUrl . '?key=cron-test', false, $ctx);
sprawdz('bledy.php z kluczem: oba zgłoszenia, tekst bezpieczny, tablet z nazwą/modelem',
    strpos($z, 'TypeError: x is undefined') !== false && strpos($z, 'kwota &lt;się&gt; nie zmienia') !== false && strpos($z, 'Lenovo TB328XU') !== false, mb_substr($z, 0, 300));

echo "Gracze ze zdjęcia kartki\n";
$r = api('kartka', ['obraz' => '', 'typ' => 'image/jpeg']);
sprawdz('kartka bez zdjęcia → 400', $r['_http'] === 400, $r);
$r = api('kartka', ['obraz' => base64_encode('jpeg-test'), 'typ' => 'image/gif']);
sprawdz('kartka w złym formacie → 400', $r['_http'] === 400, $r);
$r = api('kartka', ['obraz' => base64_encode('jpeg-test'), 'typ' => 'image/jpeg']);
sprawdz('kartka → gracze (kulki, dokupione, dym), złe liczby odrzucone',
    count($r['gracze'] ?? []) === 3 && $r['gracze'][0]['dokupione'] === [500] && $r['gracze'][0]['dym'] === 1 && $r['gracze'][1]['kulki'] === [200], $r);
$t = $token; $token = '';
$r = api('kartka', ['obraz' => base64_encode('x'), 'typ' => 'image/jpeg']);
sprawdz('kartka bez logowania → 401', $r['_http'] === 401, $r);
$token = $t;

echo "Panel www\n";
$panelUrl = preg_replace('#/api\.php$#', '/panel.php', $URL);
$ciastka = tempnam(sys_get_temp_dir(), 'pnl');
$www = function (string $q, ?array $post = null) use ($panelUrl, $ciastka): array {
    $ch = curl_init($panelUrl . $q);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_COOKIEJAR => $ciastka, CURLOPT_COOKIEFILE => $ciastka, CURLOPT_HEADER => true]);
    if ($post !== null) { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post)); }
    $r = (string)curl_exec($ch);
    $hs = (int)curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $out = ['naglowki' => substr($r, 0, $hs), 'tresc' => substr($r, $hs), 'http' => (int)curl_getinfo($ch, CURLINFO_HTTP_CODE)];
    curl_close($ch);
    return $out;
};
$r = $www('?m=2025-06');
sprawdz('panel bez logowania → formularz hasła, bez danych', strpos($r['tresc'], 'name="haslo"') !== false && strpos($r['tresc'], '01.06.2025') === false, mb_substr($r['tresc'], 0, 200));
$r = $www('', ['haslo' => 'zle']);
sprawdz('panel: złe hasło → komunikat', strpos($r['tresc'], 'Nieprawidłowe hasło') !== false, mb_substr($r['tresc'], -300));
$www('', ['haslo' => 'panel-test']);
$r = $www('?m=2025-06');
sprawdz('panel: miesiąc z dniem, instruktorem i utargiem', strpos($r['tresc'], '01.06.2025') !== false && strpos($r['tresc'], 'Monika') !== false && strpos($r['tresc'], 'ZIP miesiąca') !== false, mb_substr($r['tresc'], 0, 300));
$r = $www('?d=2025-06-01');
sprawdz('panel: raport dnia — pensja 230 zł, bez premii', strpos($r['tresc'], 'Pensje') !== false && strpos($r['tresc'], '230 zł') !== false
    && stripos($r['tresc'], 'premi') === false && strpos($r['tresc'], '37,5') === false, mb_substr(strip_tags($r['tresc']), 0, 400));
$r = $www('?zip=2025-06');
$zipPlik = tempnam(sys_get_temp_dir(), 'zip');
file_put_contents($zipPlik, $r['tresc']);
$z = new ZipArchive();
$nazwy = [];
if ($z->open($zipPlik) === true) { for ($i = 0; $i < $z->numFiles; $i++) $nazwy[] = $z->getNameIndex($i); $csvZip = $z->getFromName('SILT Lista 2025-06 Czerwiec/Podsumowanie 2025-06.csv'); $z->close(); }
sprawdz('panel: ZIP miesiąca — raport dnia, cały miesiąc, CSV', in_array('SILT Lista 2025-06 Czerwiec/2025-06-01 Lista.html', $nazwy, true)
    && in_array('SILT Lista 2025-06 Czerwiec/Podsumowanie 2025-06.csv', $nazwy, true) && strpos((string)($csvZip ?? ''), '"2025-06-01"') !== false, $nazwy);
$r = $www('?wyloguj=1');
$r = $www('?m=2025-06');
sprawdz('panel: po wylogowaniu znowu hasło', strpos($r['tresc'], 'name="haslo"') !== false, mb_substr($r['tresc'], 0, 100));
@unlink($ciastka); @unlink($zipPlik);

echo "APK do pobrania\n";
$apkUrl = preg_replace('#/api\.php$#', '/apk.php', $URL);
$ch = curl_init($apkUrl);
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true, CURLOPT_FOLLOWLOCATION => false]);
$r = (string)curl_exec($ch);
$kod = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
sprawdz('apk.php → przekierowanie do najnowszego silt-lista.apk', $kod === 302 && preg_match('#Location: .*/silt-lista\.apk#i', $r) === 1, mb_substr($r, 0, 300));
$info = json_decode((string)@file_get_contents($apkUrl . '?info'), true);
sprawdz('apk.php?info → runtimeVersion i numer wydania', ($info['runtimeVersion'] ?? '') === 'abc123' && ($info['numer'] ?? 0) === 7, $info);

echo "Kosz — sprzątanie po 30 dniach\n";
$pdo->exec("UPDATE grupy SET usunieto = UTC_TIMESTAMP() - INTERVAL 31 DAY WHERE id = 'g1'");
$out = shell_exec('php ' . escapeshellarg(__DIR__ . '/../cron.php') . ' 2>&1');
sprawdz('cron.php skasował grupę razem z graczami, fakturą i dodatkami: ' . trim((string)$out),
    (int)$pdo->query('SELECT COUNT(*) FROM grupy')->fetchColumn() === 0 && (int)$pdo->query('SELECT COUNT(*) FROM gracze')->fetchColumn() === 0
    && (int)$pdo->query('SELECT COUNT(*) FROM faktury')->fetchColumn() === 0 && (int)$pdo->query('SELECT COUNT(*) FROM listy')->fetchColumn() === 1);


echo "Statystyki i SMS faktur (cron 6:00)\n";
$MOCK = getenv('SILT_MOCK_DIR') ?: sys_get_temp_dir();
@unlink("$MOCK/stat.json"); @unlink("$MOCK/sms.json"); @unlink("$MOCK/sms.fail");
$stat = function () use ($MOCK) { return is_file("$MOCK/stat.json") ? json_decode(file_get_contents("$MOCK/stat.json"), true) : []; };
$smsy = function () use ($MOCK) { return is_file("$MOCK/sms.json") ? json_decode(file_get_contents("$MOCK/sms.json"), true) : []; };
$cron = function () { return trim((string)shell_exec('php ' . escapeshellarg(__DIR__ . '/../cron.php') . ' 2>&1')); };
$W = date('Y-m-d', strtotime('-1 day'));
$z = 100;
$zm = function (string $tabela, array $rekord, string $czas = '2026-09-29T10:00:00.000Z', $usunieto = null) use (&$z) {
    return ['id' => 's' . (++$z), 'tabela' => $tabela, 'rekord' => $rekord, 'zmieniono' => $czas, 'usunieto' => $usunieto];
};
$g2 = ['id' => 'g2', 'data' => $W, 'instruktor_id' => 't2', 'godzina' => '11:00', 'utworzono' => '2026-09-29T09:00:00.000Z',
       'organizator' => 'Firma X', 'atrakcja' => 'klasyk', 'pakiet_nazwa' => 'Pakiet SILT', 'pakiet_kulki' => 500, 'pakiet_cena' => 130,
       'platnosc' => 'Karta', 'w_gracze' => 10, 'w_kulki' => 1700, 'w_kulki_dok' => 500, 'w_dym' => 2, 'w_kwota' => 1395];
$g3 = ['id' => 'g3', 'data' => $W, 'instruktor_id' => 't2', 'utworzono' => '2026-09-29T09:30:00.000Z', 'organizator' => 'Urodziny Zosi',
       'atrakcja' => 'gotcha', 'pakiet_nazwa' => 'Pakiet urodzinowy do 10 osób', 'pakiet_typ' => 'grupa', 'pakiet_cena' => 850,
       'w_gracze' => 8, 'w_kwota' => 850];
$r = api('zaloguj', ['haslo' => 'test123', 'tablet_id' => 'tablet-test-3']);
$token = $r['token'] ?? '';
$r = api('wyslij', ['zmiany' => [
    $zm('listy', ['data' => $W]),
    $zm('instruktorzy', ['id' => 't2', 'data' => $W, 'imie' => 'Janek']),
    $zm('grupy', $g2), $zm('grupy', $g3),
    $zm('faktury', ['grupa_id' => 'g2', 'nip' => '1234567890', 'tel' => '500600700', 'email' => 'biuro@firmax.pl', 'kwota' => 1395, 'platnosc' => 'Przelew']),
    $zm('wydatki', ['id' => 'w2', 'data' => $W, 'opis' => 'Paliwo', 'kwota' => 150, 'uwagi' => 'Orlen']),
    $zm('pensje', ['id' => 'pn2', 'data' => $W, 'imie' => 'Janek', 'prac_id' => 'pr1', 'godziny' => 7.5, 'stawka' => 30, 'kwota' => 230, 'premia_stawka' => 3]),
]]);
sprawdz('lista z wczoraj wysłana z tabletu', wyniki($r) === array_fill(0, 7, 'zapisano'), $r);

$out = $cron();
$s = $stat();
$grupyS = array_values($s['grupy'] ?? []);
usort($grupyS, function ($a, $b) { return $a['przychod'] <=> $b['przychod']; });
sprawdz('cron: 2 grupy w Statystykach (GOTHA 850, KLASYK 1395)', count($grupyS) === 2 && $grupyS[0]['atrakcja'] === 'GOTHA'
    && $grupyS[1]['atrakcja'] === 'KLASYK' && $grupyS[1]['przychod'] == 1395 && $grupyS[1]['gracze'] === 10 && $grupyS[1]['kulki'] === 1700, [$out, $s]);
sprawdz('notatka grupy jak w v19', ($grupyS[1]['notatka'] ?? '') === 'Lista: org. Firma X, instr. Janek, Pakiet SILT, dokupione 500 kulek, dym 2, FAKTURA, Karta', $grupyS[1] ?? null);
$koszt = array_values($s['koszty'] ?? [])[0] ?? [];
sprawdz('koszt: „Paliwo — Orlen” 150 zł, kategoria Inne', ($koszt['opis'] ?? '') === 'Paliwo — Orlen' && $koszt['kwota'] == 150 && $koszt['kategoria'] === 'Inne', $koszt);
$pen = array_values($s['pensje'] ?? [])[0] ?? [];
sprawdz('pensja 230 zł, premia 7,5 h × 5 zł (ze Statystyk, nie z tabletu) = 37,5', ($pen['kwota'] ?? 0) == 230 && ($pen['premia'] ?? 0) == 37.5 && $pen['pracownikId'] === 'pr1', $pen);
$sms = $smsy();
sprawdz('SMS z fakturą na 48534500503', count($sms) === 1 && $sms[0]['to'] === '48534500503' && strpos($sms[0]['message'], 'NIP: 1234567890') !== false
    && strpos($sms[0]['message'], date('d.m.Y', strtotime($W)) . ' KLASYK') !== false && strpos($sms[0]['message'], 'Kwota: 1 395 zl') !== false, $sms);

$r = api('pobierz', null, ['od_rev' => 0]);
$lw = array_values(array_filter($r['dane']['listy'] ?? [], function ($l) use ($W) { return $l['data'] === $W; }))[0] ?? [];
$fw = $r['dane']['faktury'][0] ?? [];
sprawdz('tablet widzi „wysłane do statystyk” i „SMS wysłany”', !empty($lw['s_stat_wyslano']) && ($lw['s_stat_przez'] ?? '') === 'auto'
    && !empty($fw['s_sms_wyslano']) && !array_key_exists('s_stat_rev', $lw), [$lw, $fw]);

$ile = count($stat()['grupy'] ?? []);
$out = $cron();
sprawdz('drugi cron: nic nie wysyła ponownie → ' . $out, strpos($out, 'brak zaległości') !== false && count($smsy()) === 1 && count($stat()['grupy'] ?? []) === $ile, $out);

$g2b = $g2; $g2b['w_kwota'] = 1500;
api('wyslij', ['zmiany' => [$zm('grupy', $g2b, '2026-09-29T15:00:00.000Z')]]);
$out = $cron();
$pr = array_map(function ($g) { return $g['przychod']; }, array_values($stat()['grupy'] ?? []));
sort($pr);
sprawdz('poprawka po wysyłce → cron wysyła dzień ponownie, bez dublowania (850, 1500)', $pr == [850, 1500], [$out, $pr]);
sprawdz('SMS nie idzie drugi raz', count($smsy()) === 1, $smsy());

api('wyslij', ['zmiany' => [$zm('grupy', $g3, '2026-09-29T16:00:00.000Z', '2026-09-29T16:00:00.000Z')]]);
$r = api('statystyki', ['data' => $W]);
sprawdz('grupa usunięta + przycisk „wyślij” na tablecie → w Statystykach zostaje 1 grupa', ($r['ok'] ?? false) === true && count($stat()['grupy'] ?? []) === 1, $r);
$r = api('statystyki', ['data' => $W]);
sprawdz('ponowne „wyślij” bez zmian → „już wysłane”', strpos($r['msg'] ?? '', 'już wysłane') !== false, $r);
$r = api('statystyki', ['data' => '2024-01-01']);
sprawdz('„wyślij” dla dnia, którego nie ma → czytelny błąd', $r['_http'] === 404 && ($r['kod'] ?? '') === 'brak_listy', $r);

$g4 = $g3; $g4['id'] = 'g4'; $g4['organizator'] = 'Szkoła';
touch("$MOCK/sms.fail");
api('wyslij', ['zmiany' => [$zm('grupy', $g4, '2026-09-29T17:00:00.000Z'),
    $zm('faktury', ['grupa_id' => 'g4', 'nip' => '9876543210', 'tel' => '600', 'email' => 's@s.pl', 'kwota' => 850, 'platnosc' => 'Przelew'], '2026-09-29T17:00:00.000Z')]]);
$out = $cron();
$blad = $pdo->query("SELECT s_sms_blad FROM faktury WHERE grupa_id='g4'")->fetchColumn();
sprawdz('SMS nie przeszedł → błąd zapisany, SMS czeka', count($smsy()) === 1 && strpos((string)$blad, 'brak środków') !== false, [$out, $blad]);
unlink("$MOCK/sms.fail");
$out = $cron();
sprawdz('następny cron → SMS wysłany', count($smsy()) === 2 && strpos($smsy()[1]['message'], 'Szkoła') !== false
    && $pdo->query("SELECT s_sms_blad FROM faktury WHERE grupa_id='g4'")->fetchColumn() === null, [$out, $smsy()]);

$r = api('rezerwacje', null, ['od' => '2026-10-01', 'do' => '2026-10-31']);
sprawdz('rezerwacje z podglad.php (przez serwer listy)', count($r['rezerwacje'] ?? []) === 2 && ($r['rezerwacje'][0]['klient'] ?? '') === 'Jan Kowalski'
    && count($r['atrakcje'] ?? []) === 2 && !isset($r['rezerwacje'][0]['telefon']), $r);
$r = api('rezerwacje', null, ['od' => 'zle', 'do' => '2026-10-31']);
sprawdz('rezerwacje: zła data → 400', $r['_http'] === 400, $r);

$r = api('pracownicy');
sprawdz('pracownicy ze Statystyk (tylko aktywni)', count($r['pracownicy'] ?? []) === 1 && $r['pracownicy'][0]['imie'] === 'Janek' && $r['pracownicy'][0]['premia'] == 5, $r);

echo "Kopia miesiąca mailem\n";
foreach (glob($MOCK . '/mail-*.eml') ?: [] as $f) unlink($f);
$poprz = date('Y-m', strtotime(date('Y-m-01') . ' -1 month'));
$out = shell_exec('php ' . escapeshellarg(__DIR__ . '/../cron.php') . ' mail=teraz 2>&1');
$maile = glob($MOCK . '/mail-*.eml') ?: [];
$eml = $maile ? (string)file_get_contents($maile[0]) : '';
$zipOk = false;
if (preg_match('/filename="SILT_lista_' . preg_quote($poprz) . '\.zip"\r\n\r\n([A-Za-z0-9+\/=\r\n]+)/', $eml, $m)) {
    $tmp = tempnam(sys_get_temp_dir(), 'z');
    file_put_contents($tmp, base64_decode($m[1]));
    $z = new ZipArchive();
    if ($z->open($tmp) === true) { $zipOk = $z->locateName('Podsumowanie ' . $poprz . '.csv', ZipArchive::FL_NODIR) !== false; $z->close(); }
    unlink($tmp);
}
sprawdz('cron mail=teraz → mail na adres z config, ZIP poprzedniego miesiąca w załączniku: ' . trim((string)$out),
    count($maile) === 1 && strpos($eml, 'To: test@example.com') !== false && $zipOk && stripos(base64_decode((string)preg_replace('/.*?Content-Transfer-Encoding: base64\r\n\r\n(.*?)--silt.*/s', '$1', $eml)), 'premi') === false, mb_substr($eml, 0, 400));

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
