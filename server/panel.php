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
require_once __DIR__ . '/lib/panel_sesja.php';

panel_wymagaj_logowania('panel.php');

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
        . '<a class="btn" href="panel.php">Dziś</a><a class="btn" href="plan.php">📋 Plan dnia</a><span class="sp"></span>' . $akcje . '</div>'
        . $tab
        . '<p class="info">Kliknij dzień, żeby zobaczyć raport (jak PDF z tabletu). Pensje to sama podstawa. „Zostaje” = brutto − wydatki − pensje.</p>'
    );
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

/** ⬇️ ZIP miesiąca (lib/raport.php → zip_miesiaca_plik). */
function zip_miesiaca(string $ym): void
{
    $plik = zip_miesiaca_plik($ym);
    if ($plik === null) {
        strona('ZIP', '<p class="pusto">Serwer nie ma modułu ZIP (php-zip). Użyj „Drukuj / PDF cały miesiąc”.</p>');
        return;
    }
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="SILT_lista_' . $ym . '.zip"');
    header('Content-Length: ' . filesize($plik));
    header('Cache-Control: no-store');
    readfile($plik);
    unlink($plik);
}
