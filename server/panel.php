<?php
// ============================================================
// SILT Lista — panel www: przeglądanie list z komputera.
//   https://filedops.pl/lista-api/panel.php
// Hasło: PANEL_HASLO w config.php. Miesiąc → dni (utarg, wydatki, pensje), dzień → raport jak PDF,
// „Drukuj cały miesiąc” (jeden PDF z przeglądarki), „ZIP miesiąca” (raport każdego dnia + CSV do Excela).
// Pensje: tylko podstawa — premia nigdy nie jest tu pokazywana (tylko w Statystykach).
// ============================================================

declare(strict_types=1);

require_once __DIR__ . '/lib/wspolne.php';
require_once __DIR__ . '/lib/raport.php';

const PANEL_SESJA_MIN = 30;     // wylogowanie po 30 min bez ruchu
const PANEL_PROBY = 5;          // złe hasła z jednego IP …
const PANEL_BLOKADA_MIN = 15;   // … blokują logowanie na 15 min

header('X-Robots-Tag: noindex');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');

session_name('silt_lista_panel');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/'), '/') . '/',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

if (isset($_GET['wyloguj'])) {
    $_SESSION = [];
    session_destroy();
    header('Location: panel.php');
    exit;
}

$blad = '';
if (PANEL_HASLO === '') {
    strona('Panel wyłączony', '<div class="login"><h1>SILT Lista</h1><p>Panel jest wyłączony — wpisz <b>PANEL_HASLO</b> w <code>config.php</code> na serwerze.</p></div>');
    exit;
}

// logowanie
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && isset($_POST['haslo'])) {
    $pdo = baza();
    $ip = ip_klienta();
    $st = $pdo->prepare('SELECT COUNT(*) FROM logowania_bledne WHERE ip = ? AND czas > UTC_TIMESTAMP() - INTERVAL ' . PANEL_BLOKADA_MIN . ' MINUTE');
    $st->execute([$ip]);
    if ((int)$st->fetchColumn() >= PANEL_PROBY) {
        $blad = 'Za dużo błędnych prób. Spróbuj ponownie za ' . PANEL_BLOKADA_MIN . ' minut.';
    } elseif (hash_equals(PANEL_HASLO, (string)$_POST['haslo'])) {
        $pdo->prepare('DELETE FROM logowania_bledne WHERE ip = ?')->execute([$ip]);
        session_regenerate_id(true);
        $_SESSION['ok'] = true;
        $_SESSION['ruch'] = time();
        header('Location: panel.php');
        exit;
    } else {
        $pdo->prepare('INSERT INTO logowania_bledne (ip, czas) VALUES (?, UTC_TIMESTAMP())')->execute([$ip]);
        $blad = 'Nieprawidłowe hasło';
    }
}

if (empty($_SESSION['ok']) || time() - (int)($_SESSION['ruch'] ?? 0) > PANEL_SESJA_MIN * 60) {
    $_SESSION = [];
    strona('Logowanie', '<form method="post" class="login"><h1>SILT <span>Lista</span></h1><p>Panel list — wpisz hasło</p>'
        . '<input type="password" name="haslo" placeholder="Hasło" autofocus autocomplete="current-password">'
        . ($blad ? '<div class="err">' . r_h($blad) . '</div>' : '')
        . '<button type="submit">Zaloguj</button></form>');
    exit;
}
$_SESSION['ruch'] = time();

// ── widoki ──────────────────────────────────────────────────
$poprawnyYm = function (string $ym): bool { return (bool)preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $ym); };
$poprawnaData = function (string $d): bool {
    return (bool)preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $d, $m) && checkdate((int)$m[2], (int)$m[3], (int)$m[1]);
};

if (isset($_GET['zip']) && $poprawnyYm((string)$_GET['zip'])) {
    zip_miesiaca((string)$_GET['zip']);
    exit;
}

if (isset($_GET['druk']) && $poprawnyYm((string)$_GET['druk'])) {
    $ym = (string)$_GET['druk'];
    $tresc = '';
    foreach (miesiac_z_bazy($ym) as $i => $x) {
        $d = dzien_z_bazy($x['data']);
        if ($d) $tresc .= '<div class="' . ($i ? 'dzien-nowy' : '') . '">' . raport_dnia($d) . '</div>';
    }
    druk('SILT lista ' . nazwa_miesiaca($ym), $tresc ?: '<p>Brak list w tym miesiącu.</p>', 'panel.php?m=' . $ym);
    exit;
}

if (isset($_GET['d']) && $poprawnaData((string)$_GET['d'])) {
    $data = (string)$_GET['d'];
    $d = dzien_z_bazy($data);
    druk('SILT lista ' . r_data_pl($data), $d ? raport_dnia($d) : '<p>Brak listy z tego dnia.</p>', 'panel.php?m=' . substr($data, 0, 7));
    exit;
}

$ym = isset($_GET['m']) && $poprawnyYm((string)$_GET['m']) ? (string)$_GET['m'] : date('Y-m');
widok_miesiaca($ym);

// ── funkcje widoków ─────────────────────────────────────────

function nazwa_miesiaca(string $ym): string
{
    return MIESIACE_PL[(int)substr($ym, 5, 2) - 1] . ' ' . substr($ym, 0, 4);
}

function przesun(string $ym, int $o): string
{
    return date('Y-m', mktime(12, 0, 0, (int)substr($ym, 5, 2) + $o, 1, (int)substr($ym, 0, 4)));
}

function widok_miesiaca(string $ym): void
{
    $dni = miesiac_z_bazy($ym);
    $DN = ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.'];
    $suma = ['grupy' => 0, 'graczy' => 0, 'kulki' => 0, 'dym' => 0, 'brutto' => 0.0, 'wydatki' => 0.0, 'pensje' => 0.0, 'netto' => 0.0];
    $w = '';
    foreach ($dni as $x) {
        foreach ($suma as $k => $_) $suma[$k] += (float)$x[$k];
        $dt = $x['data'];
        $w .= '<tr onclick="location.href=\'panel.php?d=' . $dt . '\'">'
            . '<td><a href="panel.php?d=' . $dt . '"><b>' . $DN[(int)date('w', strtotime($dt . ' 12:00'))] . ' ' . r_data_pl($dt) . '</b></a></td>'
            . '<td>' . r_h($x['instruktorzy'] ?? '') . '</td>'
            . '<td class="r">' . (int)$x['grupy'] . '</td><td class="r">' . (int)$x['graczy'] . '</td><td class="r">' . r_liczba($x['kulki']) . '</td><td class="r">' . ((int)$x['dym'] ?: '') . '</td>'
            . '<td class="r b">' . r_zl($x['brutto']) . '</td><td class="r">' . r_zl($x['wydatki']) . '</td><td class="r">' . r_zl($x['pensje']) . '</td><td class="r b">' . r_zl($x['netto']) . '</td>'
            . '<td class="c">' . ($x['s_stat_wyslano'] ? '✓' : '<span class="szary">—</span>') . '</td></tr>';
    }
    $tab = $dni
        ? '<table class="tab"><thead><tr><th>Dzień</th><th>Instruktorzy</th><th class="r">Grupy</th><th class="r">Osoby</th><th class="r">Kulki</th><th class="r">Dym</th>'
            . '<th class="r">Brutto</th><th class="r">Wydatki</th><th class="r">Pensje</th><th class="r">Zostaje</th><th class="c">Statystyki</th></tr></thead><tbody>' . $w . '</tbody>'
            . '<tfoot><tr><th>Razem (' . count($dni) . ' dni)</th><th></th><th class="r">' . (int)$suma['grupy'] . '</th><th class="r">' . (int)$suma['graczy'] . '</th><th class="r">' . r_liczba($suma['kulki']) . '</th><th class="r">' . ((int)$suma['dym'] ?: '') . '</th>'
            . '<th class="r">' . r_zl($suma['brutto']) . '</th><th class="r">' . r_zl($suma['wydatki']) . '</th><th class="r">' . r_zl($suma['pensje']) . '</th><th class="r">' . r_zl($suma['netto']) . '</th><th></th></tr></tfoot></table>'
        : '<p class="pusto">Brak list w tym miesiącu.</p>';

    $akcje = $dni
        ? '<a class="btn" href="panel.php?druk=' . $ym . '">🖨️ Drukuj / PDF cały miesiąc</a><a class="btn" href="panel.php?zip=' . $ym . '">⬇️ ZIP miesiąca</a>'
        : '';
    strona(
        'Listy — ' . nazwa_miesiaca($ym),
        '<header><div class="logo">SILT <span>Lista</span></div><a class="wyl" href="panel.php?wyloguj=1">Wyloguj</a></header>'
        . '<div class="nav"><a class="btn" href="panel.php?m=' . przesun($ym, -1) . '">←</a><h2>' . nazwa_miesiaca($ym) . '</h2><a class="btn" href="panel.php?m=' . przesun($ym, 1) . '">→</a>'
        . '<a class="btn" href="panel.php">Dziś</a><span class="sp"></span>' . $akcje . '</div>'
        . $tab
        . '<p class="info">Kliknij dzień, żeby zobaczyć raport (jak PDF z tabletu). Pensje to sama podstawa. „Zostaje” = brutto − wydatki − pensje.</p>'
    );
}

function strona(string $tytul, string $tresc): void
{
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    echo '<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' . r_h($tytul) . ' · SILT Lista</title><style>'
        . 'body{margin:0;background:#0f0f11;color:#f4f4f5;font-family:Inter,system-ui,sans-serif;font-size:14px}'
        . 'a{color:inherit}header{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;background:#18181b;border-bottom:1px solid #27272a}'
        . '.logo{font-weight:900;font-size:22px;color:#f97316;letter-spacing:-1px}.logo span{color:#f4f4f5;font-weight:700;font-size:15px;letter-spacing:0;margin-left:4px}'
        . '.wyl{color:#a1a1aa;text-decoration:none}.nav{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:16px 20px}.nav h2{margin:0 6px;font-size:20px;min-width:180px;text-align:center}'
        . '.sp{flex:1}.btn{display:inline-block;padding:9px 16px;border-radius:10px;background:#27272a;border:1px solid #3f3f46;color:#f4f4f5;text-decoration:none;font-weight:700;cursor:pointer;font-size:14px}'
        . '.btn:hover{border-color:#f97316}.tab{width:calc(100% - 40px);margin:0 20px;border-collapse:collapse;background:#18181b;border-radius:12px;overflow:hidden}'
        . '.tab th,.tab td{padding:10px 12px;border-bottom:1px solid #27272a;text-align:left}.tab thead th{font-size:11px;text-transform:uppercase;color:#a1a1aa;background:#1f1f23}'
        . '.tab tbody tr{cursor:pointer}.tab tbody tr:hover{background:rgba(249,115,22,.08)}.tab tbody a{text-decoration:none}.tab tfoot th{background:#1f1f23;color:#f97316}'
        . '.r{text-align:right!important;white-space:nowrap}.c{text-align:center!important}.b{font-weight:800}.szary{color:#52525b}.info,.pusto{color:#a1a1aa;padding:6px 20px;font-size:13px}'
        . '.login{max-width:360px;margin:12vh auto;background:#18181b;border:1px solid #27272a;border-radius:16px;padding:28px;display:flex;flex-direction:column;gap:12px}'
        . '.login h1{margin:0;color:#f97316;font-weight:900;letter-spacing:-2px;font-size:36px}.login h1 span{color:#f4f4f5;font-size:20px;letter-spacing:0}.login p{margin:0;color:#a1a1aa}'
        . '.login input{padding:13px;border-radius:10px;border:1px solid #3f3f46;background:#27272a;color:#f4f4f5;font-size:16px}.login button{padding:14px;border:0;border-radius:10px;background:#f97316;color:#fff;font-weight:800;font-size:16px;cursor:pointer}'
        . '.err{color:#ef4444;font-weight:600}@media(max-width:760px){.tab{font-size:12px}.tab th:nth-child(2),.tab td:nth-child(2),.tab th:nth-child(6),.tab td:nth-child(6){display:none}}'
        . '</style></head><body>' . $tresc . '</body></html>';
}

/** Strona z raportem (dzień albo cały miesiąc): pasek z przyciskami + białe kartki; przy druku tylko kartki. */
function druk(string $tytul, string $tresc, string $wstecz): void
{
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    echo '<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' . r_h($tytul) . '</title><style>'
        . raport_css()
        . 'body{margin:0;background:#52525b}.pasek{position:sticky;top:0;display:flex;gap:10px;align-items:center;padding:10px 16px;background:#18181b;color:#f4f4f5;font-family:Inter,system-ui,sans-serif;z-index:2}'
        . '.pasek b{flex:1;font-size:16px}.pasek a,.pasek button{padding:9px 16px;border-radius:10px;background:#27272a;border:1px solid #3f3f46;color:#f4f4f5;text-decoration:none;font-weight:700;font-size:14px;cursor:pointer}'
        . '.pasek button{background:#f97316;border-color:#f97316}.kartka{background:#fff;width:297mm;max-width:calc(100% - 24px);margin:12px auto;padding:9mm;box-shadow:0 6px 30px rgba(0,0,0,.4)}'
        . '@media print{body{background:#fff}.pasek{display:none}.kartka{width:auto;max-width:none;margin:0;padding:0;box-shadow:none}}'
        . '</style></head><body><div class="pasek"><a href="' . r_h($wstecz) . '">← Wróć</a><b>' . r_h($tytul) . '</b><button onclick="window.print()">🖨️ Drukuj / Zapisz jako PDF</button></div>'
        . '<div class="kartka">' . $tresc . '</div></body></html>';
}

/** ⬇️ ZIP miesiąca: raport każdego dnia (HTML — otwiera się w przeglądarce, Ctrl+P → PDF), cały miesiąc w jednym pliku, podsumowanie CSV. */
function zip_miesiaca(string $ym): void
{
    if (!class_exists('ZipArchive')) {
        strona('ZIP', '<p class="pusto">Serwer nie ma modułu ZIP (php-zip). Użyj „Drukuj / PDF cały miesiąc”.</p>');
        return;
    }
    $dni = miesiac_z_bazy($ym);
    $plik = tempnam(sys_get_temp_dir(), 'silt');
    $zip = new ZipArchive();
    $zip->open($plik, ZipArchive::OVERWRITE);
    $folder = 'SILT Lista ' . $ym . ' ' . MIESIACE_PL[(int)substr($ym, 5, 2) - 1];
    $calosc = '';
    $csv = "\xEF\xBB\xBF" . implode(';', ['Dzień', 'Instruktorzy', 'Grupy', 'Osoby', 'Kulki', 'Dym', 'Brutto', 'Zadatki', 'Wydatki', 'Pensje', 'Zostaje', 'Statystyki wysłane']) . "\r\n";
    $liczba = function ($v): string { return str_replace('.', ',', (string)round((float)$v, 2)); };
    foreach ($dni as $i => $x) {
        $d = dzien_z_bazy($x['data']);
        if (!$d) continue;
        $tresc = raport_dnia($d);
        $zip->addFromString($folder . '/' . $x['data'] . ' Lista.html', raport_plik_html('SILT lista ' . r_data_pl($x['data']), $tresc));
        $calosc .= '<div class="' . ($i ? 'dzien-nowy' : '') . '">' . $tresc . '</div>';
        $s = $d['podsumowanie'];
        $pola = [$x['data'], $x['instruktorzy'] ?? '', $s['grupy'], $s['graczy'], $s['kulki'], (int)$x['dym'], $liczba($s['brutto']), $liczba($s['zadatki']),
            $liczba($s['wydatki']), $liczba($s['pensje']), $liczba($s['netto']), $x['s_stat_wyslano'] ? 'tak' : 'nie'];
        $csv .= implode(';', array_map(function ($v) { return '"' . str_replace('"', '""', (string)$v) . '"'; }, $pola)) . "\r\n";
    }
    if ($calosc !== '') $zip->addFromString($folder . '/Cały miesiąc ' . $ym . '.html', raport_plik_html('SILT lista ' . nazwa_miesiaca($ym), $calosc));
    $zip->addFromString($folder . '/Podsumowanie ' . $ym . '.csv', $csv);
    $zip->addFromString($folder . '/Jak zrobić PDF.txt', "Otwórz plik .html w przeglądarce i naciśnij Ctrl+P → „Zapisz jako PDF” (A4 poziomo).\r\nPodsumowanie .csv otwiera się w Excelu.\r\n");
    $zip->close();
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="SILT_lista_' . $ym . '.zip"');
    header('Content-Length: ' . filesize($plik));
    header('Cache-Control: no-store');
    readfile($plik);
    unlink($plik);
}
