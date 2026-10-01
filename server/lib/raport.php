<?php
// SILT Lista — raport dnia na serwerze (panel www, ZIP miesiąca). Ten sam wygląd co PDF z tabletu
// (src/logika/raport.ts): A4 poziomo, grupy od najstarszej, potem pensje (TYLKO podstawa — nigdy premia),
// wydatki i podsumowanie dnia. Kwoty grup bierzemy z bazy (w_kwota liczy tablet).

declare(strict_types=1);

function r_h($s): string
{
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
}

/** 1234.5 → „1234,5 zł”, 12345 → „12 345 zł” (jak toLocaleString('pl-PL') na tablecie). */
function r_zl($v): string
{
    $n = round((float)$v, 2);
    $dec = abs($n - round($n)) < 0.005 ? 0 : (abs($n * 10 - round($n * 10)) < 0.05 ? 1 : 2);
    $s = number_format($n, $dec, ',', abs($n) >= 10000 ? "\u{00A0}" : '');
    return $s . ' zł';
}

function r_liczba($v): string
{
    $n = (int)$v;
    return number_format($n, 0, ',', abs($n) >= 10000 ? "\u{00A0}" : '');
}

function r_data_pl(string $iso): string
{
    [$y, $m, $d] = explode('-', $iso);
    return "$d.$m.$y";
}

const MIESIACE_PL = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];

/** Wszystko z jednego dnia (bez kosza) albo null, gdy listy nie ma. */
function dzien_z_bazy(string $data): ?array
{
    $pdo = baza();
    $st = $pdo->prepare('SELECT * FROM listy WHERE data = ? AND usunieto IS NULL');
    $st->execute([$data]);
    $lista = $st->fetch();
    if (!$lista) return null;

    $q = function (string $sql) use ($pdo, $data): array {
        $st = $pdo->prepare($sql);
        $st->execute([$data]);
        return $st->fetchAll();
    };
    $instr = $q('SELECT * FROM instruktorzy WHERE data = ? AND usunieto IS NULL ORDER BY kolejnosc, zmieniono');
    $grupy = $q('SELECT * FROM grupy WHERE data = ? AND usunieto IS NULL ORDER BY utworzono');
    $gracze = $q('SELECT x.* FROM gracze x JOIN grupy g ON g.id = x.grupa_id WHERE g.data = ? AND x.usunieto IS NULL ORDER BY x.kolejnosc, x.zmieniono');
    $poz = $q('SELECT p.* FROM pozycje p JOIN gracze x ON x.id = p.gracz_id JOIN grupy g ON g.id = x.grupa_id WHERE g.data = ? AND p.usunieto IS NULL ORDER BY p.kolejnosc, p.zmieniono');
    $dod = $q('SELECT d.* FROM dodatki d JOIN grupy g ON g.id = d.grupa_id WHERE g.data = ? AND d.usunieto IS NULL ORDER BY d.kolejnosc, d.zmieniono');
    $fak = $q('SELECT f.* FROM faktury f JOIN grupy g ON g.id = f.grupa_id WHERE g.data = ? AND f.usunieto IS NULL');
    $wyd = $q('SELECT * FROM wydatki WHERE data = ? AND usunieto IS NULL ORDER BY kolejnosc, zmieniono');
    // pensje: tylko podstawa (kwota). premia_stawka celowo NIE jest pobierana.
    $pen = $q('SELECT id, imie, godziny, stawka, kwota FROM pensje WHERE data = ? AND usunieto IS NULL ORDER BY kolejnosc, zmieniono');

    foreach ($gracze as &$p) {
        $p['pozycje'] = array_values(array_filter($poz, function ($i) use ($p) { return $i['gracz_id'] === $p['id']; }));
        $p['sprzet'] = $p['sprzet'] ? (json_decode($p['sprzet'], true) ?: []) : [];
    }
    unset($p);
    foreach ($grupy as &$g) {
        $g['gracze'] = array_values(array_filter($gracze, function ($p) use ($g) { return $p['grupa_id'] === $g['id']; }));
        $g['dodatki'] = array_values(array_filter($dod, function ($d) use ($g) { return $d['grupa_id'] === $g['id']; }));
        $g['faktura'] = null;
        foreach ($fak as $f) if ($f['grupa_id'] === $g['id']) $g['faktura'] = $f;
    }
    unset($g);

    $suma = function (array $a, string $k): float { return round(array_sum(array_map(function ($x) use ($k) { return (float)$x[$k]; }, $a)), 2); };
    $pods = [
        'grupy' => count($grupy),
        'graczy' => (int)array_sum(array_column($grupy, 'w_gracze')),
        'kulki' => (int)array_sum(array_column($grupy, 'w_kulki')),
        'brutto' => $suma($grupy, 'w_kwota'),
        'zadatki' => $suma($grupy, 'zadatek'),
        'wydatki' => $suma($wyd, 'kwota'),
        'pensje' => $suma($pen, 'kwota'),
    ];
    $pods['netto'] = round($pods['brutto'] - $pods['wydatki'] - $pods['pensje'], 2);

    return ['data' => $data, 'lista' => $lista, 'instruktorzy' => $instr, 'grupy' => $grupy, 'wydatki' => $wyd, 'pensje' => $pen, 'podsumowanie' => $pods];
}

function atrakcje_mapa(): array
{
    static $m = null;
    if ($m === null) {
        $m = [];
        foreach (baza()->query('SELECT klucz, nazwa, stat_nazwa, kolor FROM atrakcje') as $a) $m[$a['klucz']] = $a;
    }
    return $m;
}

function raport_css(): string
{
    return <<<CSS
@page { size: A4 landscape; margin: 9mm; }
* { box-sizing: border-box; }
.raport { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.p-group { break-inside: avoid; page-break-inside: avoid; border: 1.5px solid #000; border-radius: 6px; margin-bottom: 5mm; overflow: hidden; }
.p-head { display: flex; align-items: center; gap: 10px; padding: 5px 8px; border-bottom: 1.5px solid #000; }
.p-num { width: 22px; height: 22px; border-radius: 4px; color: #fff; font-weight: 900; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; }
.p-title { font-weight: 900; font-size: 13px; text-transform: uppercase; flex: 1; }
.p-meta { font-size: 11px; }
.p-body { display: flex; }
.p-left { flex: 1; border-right: 1.5px solid #000; }
.p-tbl { width: 100%; border-collapse: collapse; }
.p-tbl th, .p-tbl td { border-bottom: 1px solid #999; padding: 3px 6px; text-align: left; vertical-align: top; }
.p-tbl th { font-size: 9px; text-transform: uppercase; background: #eee; }
.p-tbl tr { break-inside: avoid; page-break-inside: avoid; }
.num { white-space: nowrap; }
.p-sep { color: #d00; font-weight: 900; padding: 0 3px; }
.p-dod { padding: 4px 6px; font-size: 10px; border-top: 1px solid #999; }
.p-right { width: 62mm; padding: 6px 8px; font-size: 12px; line-height: 1.55; }
.p-right .big { font-size: 15px; font-weight: 900; }
.p-page2 { break-before: page; page-break-before: always; padding: 1mm 1px 0 0; }
.p-h1 { font-size: 15px; font-weight: 900; margin: 0 0 3mm; }
.p-h2 { font-size: 13px; font-weight: 900; margin: 5mm 0 2mm; }
.p-list { width: 100%; border-collapse: collapse; font-size: 12px; }
.p-list th, .p-list td { border: 1px solid #000; padding: 5px 8px; text-align: left; }
.p-list th { background: #eee; }
.r, .p-list .r { text-align: right; white-space: nowrap; }
.p-sum { width: 50%; }
.p-sum .netto td, .p-sum .netto th { font-size: 14px; font-weight: 900; }
.p-stopka { margin-top: 4mm; font-size: 9px; color: #666; }
.dzien-nowy { break-before: page; page-break-before: always; }
CSS;
}

function raport_wiersz_gracza(array $p, int $i, bool $kolPakiet): string
{
    $kp = $kd = [];
    $dym = $inne = [];
    foreach ($p['pozycje'] as $x) {
        if ($x['rodzaj'] === 'kulki') {
            if ((int)$x['dokupione']) $kd[] = r_liczba($x['ilosc']);
            else $kp[] = r_liczba($x['ilosc']);
        } elseif ($x['rodzaj'] === 'dym') $dym[] = $x;
        else $inne[] = $x;
    }
    $wi = (int)($p['worki_ilosc'] ?? 0);
    $worki = $wi ? 'Worek ' . (int)$p['worki_szt'] . ($wi > 1 ? " ×$wi" : '') . ' · ' . r_zl($wi * (float)$p['worki_cena']) : '';
    $pk = '';
    if ($kolPakiet) {
        if ($p['sprzet']) {
            $pk = '<b>Własny sprzęt</b> (bez pakietu)<br>' . implode(', ', array_map(function ($s) { return r_h(($s['nazwa'] ?? '') . ' ' . r_zl($s['kwota'] ?? 0)); }, $p['sprzet']));
        } elseif ($p['pakiet_cena'] !== null) {
            $pk = '<b>' . r_h($p['pakiet_nazwa']) . '</b> ' . r_zl($p['pakiet_cena']);
        } else {
            $pk = '<span style="color:#888">główny</span>';
        }
        $pk = '<td>' . $pk . ($worki ? '<br>' . r_h($worki) : '') . '</td>';
    }
    $kulki = (implode(' · ', $kp) ?: ($wi ? '' : '—'))
        . ($kd ? '<span class="p-sep">|</span>' . implode(' · ', $kd) : '')
        . ($wi ? (($kp || $kd) ? ' · ' : '') . 'worki: ' . r_liczba($wi * (int)$p['worki_szt']) : '');
    $dymTxt = implode(', ', array_map(function ($d) { return 'DYM ×' . (int)$d['ilosc'] . ((float)$d['kwota'] ? ' (' . r_zl($d['kwota']) . ')' : ''); }, $dym));
    $inneTxt = implode(', ', array_map(function ($x) { return r_h($x['nazwa']) . ((float)$x['kwota'] ? ' ' . r_zl($x['kwota']) : ''); }, $inne));
    return '<tr><td>' . ($i + 1) . '</td><td><b>' . r_h($p['imie']) . '</b>' . ($p['notatka'] !== '' ? ' (' . r_h($p['notatka']) . ')' : '') . '</td>'
        . $pk . '<td class="num">' . $kulki . '</td><td class="num">' . $dymTxt . '</td><td>' . $inneTxt . '</td></tr>';
}

function raport_grupa(array $g, int $nr, array $d): string
{
    $a = atrakcje_mapa()[$g['atrakcja']] ?? ['nazwa' => $g['atrakcja'], 'stat_nazwa' => $g['atrakcja'], 'kolor' => '#666666'];
    $kolor = preg_match('/^#[0-9a-fA-F]{6}$/', $a['kolor']) ? $a['kolor'] : '#666666';
    $instr = '';
    foreach ($d['instruktorzy'] as $i) if ($i['id'] === $g['instruktor_id']) $instr = $i['imie'];
    $kolPakiet = false;
    $sprzetKw = $workiKw = 0.0;
    $nWl = $kW = 0;
    foreach ($g['gracze'] as $p) {
        if ($p['pakiet_cena'] !== null || $p['sprzet'] || (int)$p['worki_ilosc']) $kolPakiet = true;
        if ($p['sprzet']) {
            $nWl++;
            foreach ($p['sprzet'] as $s) $sprzetKw += (float)($s['kwota'] ?? 0);
        }
        $workiKw += (int)$p['worki_ilosc'] * (float)$p['worki_cena'];
        $kW += (int)$p['worki_ilosc'] * (int)$p['worki_szt'];
    }
    $nc = $kolPakiet ? 6 : 5;
    $wiersze = '';
    foreach ($g['gracze'] as $i => $p) $wiersze .= raport_wiersz_gracza($p, $i, $kolPakiet);
    if ((int)$g['kulki_reczne']) $wiersze .= '<tr><td></td><td><b>Cała grupa (bez imion)</b></td>' . ($kolPakiet ? '<td></td>' : '') . '<td class="num">' . r_liczba($g['kulki_reczne']) . '</td><td></td><td></td></tr>';
    if ($wiersze === '') $wiersze = '<tr><td colspan="' . $nc . '" style="color:#666">brak graczy na liście</td></tr>';
    $dod = $g['dodatki'] ? '<div class="p-dod"><b>Dodatki:</b> ' . implode(' · ', array_map(function ($x) { return r_h($x['nazwa']) . ' ' . ((float)$x['kwota'] ? r_zl($x['kwota']) : 'gratis'); }, $g['dodatki'])) . '</div>' : '';
    $kwota = (float)$g['w_kwota'];
    $zad = (float)$g['zadatek'];
    return '<div class="p-group">'
        . '<div class="p-head" style="background:' . $kolor . '22"><div class="p-num" style="background:' . $kolor . '">' . $nr . '</div>'
        . '<div class="p-title">' . r_h($a['nazwa']) . ' <span style="font-weight:600;text-transform:none">· ' . r_h($g['pakiet_nazwa']) . '</span></div>'
        . '<div class="p-meta">Organizator: <b>' . r_h($g['organizator'] !== '' ? $g['organizator'] : '—') . '</b> · Instruktor: <b>' . r_h($instr) . '</b> · ' . r_h($g['godzina']) . ' · ' . r_data_pl($d['data']) . '</div></div>'
        . '<div class="p-body"><div class="p-left"><table class="p-tbl"><tr><th style="width:24px">#</th><th>Gracz</th>' . ($kolPakiet ? '<th>Pakiet / sprzęt</th>' : '')
        . '<th>Kulki (pakiet | dokupione)</th><th>Świece dymne</th><th>Inne</th></tr>' . $wiersze . '</table>' . $dod . '</div>'
        . '<div class="p-right"><div><b>Atrakcja (' . r_h($a['stat_nazwa']) . ')</b></div>'
        . '<div>' . (int)$g['w_gracze'] . ' os | ' . r_liczba($g['w_kulki']) . ' kulek | ' . r_zl($kwota) . '</div>'
        . ((int)$g['w_dym'] ? '<div>w tym DYM: ' . (int)$g['w_dym'] . ' szt</div>' : '')
        . ($sprzetKw ? '<div>w tym własny sprzęt (' . $nWl . ' os): ' . r_zl($sprzetKw) . '</div>' : '')
        . ($workiKw ? '<div>w tym worki kulek: ' . r_zl($workiKw) . ' (' . r_liczba($kW) . ' szt)</div>' : '')
        . ($zad ? '<div>− ' . r_zl($zad) . ' zadatek</div>' : '')
        . '<div class="big">' . r_zl($kwota - $zad) . '</div>'
        . '<div>Forma płatności (' . r_h($g['platnosc'] !== '' ? $g['platnosc'] : '—') . ')</div>'
        . ($g['faktura'] ? '<div style="margin-top:4px;font-size:10px">🧾 Faktura: NIP ' . r_h($g['faktura']['nip']) . '</div>' : '')
        . '</div></div></div>';
}

/** Treść raportu jednego dnia (bez <html>) — do panelu, wydruku miesiąca i ZIP-a. */
function raport_dnia(array $d): string
{
    $s = $d['podsumowanie'];
    $h = '';
    foreach ($d['grupy'] as $i => $g) $h .= raport_grupa($g, $i + 1, $d);
    if (!$d['grupy']) $h .= '<div class="p-h1">SILT — ' . r_data_pl($d['data']) . ' · Brak grup</div>';

    $pensje = '';
    foreach ($d['pensje'] as $p) {
        $godz = rtrim(rtrim(number_format((float)$p['godziny'], 2, ',', ''), '0'), ',');
        $pensje .= '<tr><td>' . r_h($p['imie']) . '</td><td class="r">' . $godz . ' h</td><td class="r">' . ((float)$p['stawka'] ? r_zl($p['stawka']) . '/h' : '—') . '</td><td class="r">' . r_zl($p['kwota']) . '</td></tr>';
    }
    if ($pensje === '') $pensje = '<tr><td colspan="4">—</td></tr>';
    $wyd = '';
    foreach ($d['wydatki'] as $w) $wyd .= '<tr><td>' . r_h($w['opis']) . '</td><td class="r">' . r_zl($w['kwota']) . '</td><td>' . r_h($w['uwagi']) . '</td></tr>';
    if ($wyd === '') $wyd = '<tr><td colspan="3">—</td></tr>';

    $h .= '<div class="p-page2"><div class="p-h1">SILT — ' . r_data_pl($d['data']) . ' · Pensje, wydatki i podsumowanie dnia</div>'
        . '<div class="p-h2">Pensje</div><table class="p-list"><tr><th>Instruktor</th><th class="r">Ilość godzin</th><th class="r">Stawka</th><th class="r">Kwota</th></tr>'
        . $pensje . '<tr><th>Razem</th><th></th><th></th><th class="r">' . r_zl($s['pensje']) . '</th></tr></table>'
        . '<div class="p-h2">Wydatki</div><table class="p-list"><tr><th>Opis</th><th class="r">Kwota</th><th>Uwagi</th></tr>'
        . $wyd . '<tr><th>Razem</th><th class="r">' . r_zl($s['wydatki']) . '</th><th></th></tr></table>'
        . '<div class="p-h2">Podsumowanie dnia</div><table class="p-list p-sum">'
        . '<tr><td>Grup / osób / kulek</td><td class="r">' . $s['grupy'] . ' / ' . $s['graczy'] . ' / ' . r_liczba($s['kulki']) . '</td></tr>'
        . '<tr><td>Przychód brutto</td><td class="r">' . r_zl($s['brutto']) . '</td></tr>'
        . '<tr><td>Zadatki (w przychodzie)</td><td class="r">' . r_zl($s['zadatki']) . '</td></tr>'
        . '<tr><td>Wydatki</td><td class="r">− ' . r_zl($s['wydatki']) . '</td></tr>'
        . '<tr><td>Pensje</td><td class="r">− ' . r_zl($s['pensje']) . '</td></tr>'
        . '<tr class="netto"><th>Zostaje (brutto − wydatki − pensje)</th><th class="r">' . r_zl($s['netto']) . '</th></tr></table>'
        . '<div class="p-stopka">SILT Lista · raport z ' . r_data_pl($d['data']) . ' · z serwera ' . date('d.m.Y H:i') . '</div></div>';
    return '<div class="raport">' . $h . '</div>';
}

/** Samodzielny plik HTML (do ZIP-a): otwiera się w przeglądarce, Ctrl+P → „Zapisz jako PDF”. */
function raport_plik_html(string $tytul, string $tresc): string
{
    return '<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>' . r_h($tytul) . '</title><style>'
        . raport_css() . ' body{margin:0;background:#fff} @media screen{body{padding:12px}}</style></head><body>' . $tresc . '</body></html>';
}

/** Dni z listami w miesiącu ('2026-10') z podsumowaniem. */
function miesiac_z_bazy(string $ym): array
{
    $pdo = baza();
    $st = $pdo->prepare(
        "SELECT l.data, l.s_stat_wyslano,
                (SELECT GROUP_CONCAT(i.imie ORDER BY i.kolejnosc SEPARATOR ', ') FROM instruktorzy i WHERE i.data = l.data AND i.usunieto IS NULL) AS instruktorzy,
                (SELECT COUNT(*) FROM grupy g WHERE g.data = l.data AND g.usunieto IS NULL) AS grupy,
                (SELECT COALESCE(SUM(g.w_gracze),0) FROM grupy g WHERE g.data = l.data AND g.usunieto IS NULL) AS graczy,
                (SELECT COALESCE(SUM(g.w_kulki),0) FROM grupy g WHERE g.data = l.data AND g.usunieto IS NULL) AS kulki,
                (SELECT COALESCE(SUM(g.w_dym),0) FROM grupy g WHERE g.data = l.data AND g.usunieto IS NULL) AS dym,
                (SELECT COALESCE(SUM(g.w_kwota),0) FROM grupy g WHERE g.data = l.data AND g.usunieto IS NULL) AS brutto,
                (SELECT COALESCE(SUM(w.kwota),0) FROM wydatki w WHERE w.data = l.data AND w.usunieto IS NULL) AS wydatki,
                (SELECT COALESCE(SUM(p.kwota),0) FROM pensje p WHERE p.data = l.data AND p.usunieto IS NULL) AS pensje
           FROM listy l
          WHERE l.usunieto IS NULL AND l.data BETWEEN ? AND ?
          ORDER BY l.data"
    );
    $od = $ym . '-01';
    $st->execute([$od, date('Y-m-t', strtotime($od . ' 12:00:00'))]); // ostatni dzień miesiąca (MySQL 8 nie lubi „-31” w krótkich miesiącach)
    $dni = $st->fetchAll();
    foreach ($dni as &$x) $x['netto'] = round((float)$x['brutto'] - (float)$x['wydatki'] - (float)$x['pensje'], 2);
    return $dni;
}
