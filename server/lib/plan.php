<?php
// SILT Lista — plan dnia (rozpiska dla instruktorów): odczyt i zapis ze strony plan.php.
// Zapis ze strony idzie tą samą drogą co z tabletu: nowy rev + czas zmiany, więc tablety pobierają go
// przy zwykłej synchronizacji. Odhaczenia z tabletu (plan_stan, plan_odhaczenia) strona tylko czyta.

declare(strict_types=1);

/** Klucze liczb w „Do spakowania” (JSON plan_dni.pakowanie) — te same na tablecie (src/logika/plan.ts). */
const PLAN_PAKOWANIE = [
    'pb_osoby'     => 'PB — osób (Klasyk + Sportowy)',
    'pb_kartony'   => 'PB — kartonów kulek 0,68',
    'em_osoby'     => 'EM — osób (Emek + Gotcha)',
    'em_kartony'   => 'EM — kartonów kulek',
    'maski_worki'  => 'Maski — worków',
    'gotcha_worki' => 'Gotcha — worków masek',
];

/** Nazwy atrakcji jak w rozpisce (KLASYK, EMEK…) i kolory z cennika. */
function plan_atrakcje(): array
{
    $krotko = ['PAINTBALL SPORTOWY' => 'SPORTOWY', 'GOTHA' => 'GOTCHA'];
    $out = [];
    foreach (baza()->query('SELECT klucz, stat_nazwa, kolor FROM atrakcje WHERE aktywna = 1 ORDER BY kolejnosc, klucz') as $a) {
        $n = strtoupper((string)$a['stat_nazwa']);
        $out[$a['klucz']] = ['nazwa' => $krotko[$n] ?? $n, 'kolor' => (string)$a['kolor']];
    }
    return $out;
}

/** Plan jednego dnia: dzień (pakowanie), grupy (bez kosza) ze stanem z tabletu. */
function plan_dnia(string $data): array
{
    $pdo = baza();
    $st = $pdo->prepare('SELECT * FROM plan_dni WHERE data = ? AND usunieto IS NULL');
    $st->execute([$data]);
    $dzien = $st->fetch() ?: null;
    $pak = $dzien && $dzien['pakowanie'] ? (json_decode((string)$dzien['pakowanie'], true) ?: []) : [];

    $st = $pdo->prepare(
        'SELECT p.*, s.status, s.grupa_id, i.imie AS instruktor, (g.id IS NOT NULL) AS na_liscie
         FROM plan_grupy p
         LEFT JOIN plan_stan s ON s.plan_id = p.id AND s.usunieto IS NULL
         LEFT JOIN grupy g ON g.id = s.grupa_id AND g.usunieto IS NULL
         LEFT JOIN instruktorzy i ON i.id = g.instruktor_id
         WHERE p.data = ? AND p.usunieto IS NULL
         ORDER BY p.kolejnosc, p.godzina, p.id'
    );
    $st->execute([$data]);
    $grupy = $st->fetchAll();
    foreach ($grupy as &$g) {
        // „przyszła” z kafelka, a grupa na liście skasowana → grupa w planie znowu czeka (jak na tablecie)
        if ($g['status'] === 'przyszla' && $g['grupa_id'] !== null && !(int)$g['na_liscie']) $g['status'] = '';
    }
    unset($g);
    return [
        'data' => $data,
        'jest' => $dzien !== null,
        'rev' => $dzien ? (int)$dzien['rev'] : 0,
        'pakowanie' => $pak,
        'do_zabrania' => $dzien['do_zabrania'] ?? '',
        'uwagi' => $dzien['uwagi'] ?? '',
        'grupy' => $grupy,
    ];
}

/** Dni z planem od dziś (szybkie przejście na stronie). */
function plan_najblizsze_dni(int $ile = 21): array
{
    $st = baza()->prepare(
        'SELECT data, COUNT(*) AS grup, SUM(osoby) AS osob FROM plan_grupy
         WHERE usunieto IS NULL AND data >= ? GROUP BY data ORDER BY data LIMIT ' . (int)$ile
    );
    $st->execute([dzis()]);
    return $st->fetchAll();
}

/** Zapis jednego wiersza ze strony (jak zmiana z tabletu: nowy rev, czas zmiany, tablet_id = 'panel'). */
function plan_zapisz_wiersz(string $tabela, array $rekord, ?string $usunieto = null): void
{
    $pdo = baza();
    $r = przygotuj_rekord($tabela, $rekord);
    $pk = TABELE[$tabela]['pk'];
    $kol = $r + ['zmieniono' => teraz_utc(), 'usunieto' => $usunieto, 'rev' => nowy_rev(), 'tablet_id' => 'panel'];
    $nazwy = array_keys($kol);
    $ustaw = implode(',', array_map(function ($k) { return "`$k` = VALUES(`$k`)"; }, array_filter($nazwy, function ($k) use ($pk) { return $k !== $pk; })));
    $pdo->prepare("INSERT INTO `$tabela` (`" . implode('`,`', $nazwy) . '`) VALUES (' . implode(',', array_fill(0, count($nazwy), '?')) . ") ON DUPLICATE KEY UPDATE $ustaw")
        ->execute(array_values($kol));
}

/** Pakowanie w stałej kolejności kluczy (do porównania „czy coś się zmieniło”). */
function plan_norm(?array $p): array
{
    $p = $p ?: [];
    ksort($p);
    if (isset($p['naraz']) && is_array($p['naraz'])) ksort($p['naraz']);
    return $p;
}

function plan_nowe_id(): string
{
    return 'p-' . base_convert((string)time(), 10, 36) . '-' . bin2hex(random_bytes(4));
}

/**
 * Zapis całego dnia z formularza.
 * $grupy: [{id?, rev?, godzina, organizator, atrakcja, uwagi, osoby, zadatek, usun?}, …] w kolejności z formularza.
 * Wiersz zmieniony w międzyczasie na tablecie (inny rev niż przy otwarciu strony) nie jest nadpisywany.
 * Zwraca ['zapisane' => n, 'pominiete' => [organizator, …]].
 */
function plan_zapisz_dzien(string $data, array $grupy, array $pakowanie, string $doZabrania, string $uwagi, int $revDnia = -1): array
{
    $pdo = baza();
    $teraz = plan_dnia($data);
    $byly = [];
    foreach ($teraz['grupy'] as $g) $byly[$g['id']] = $g;
    $zapisane = 0;
    $pominiete = [];
    $pola = ['godzina', 'organizator', 'atrakcja', 'uwagi', 'osoby', 'zadatek', 'kolejnosc'];

    $pdo->beginTransaction();
    try {
        $kolejnosc = 0;
        foreach ($grupy as $g) {
            $id = trim((string)($g['id'] ?? ''));
            $org = trim((string)($g['organizator'] ?? ''));
            $usun = !empty($g['usun']);
            $stary = $id !== '' ? ($byly[$id] ?? null) : null;
            if ($id !== '' && !$stary) continue;                 // usunięty w międzyczasie / obcy id
            if (!$stary && ($org === '' || $usun)) continue;     // pusty nowy wiersz
            $rekord = [
                'id' => $stary ? $id : plan_nowe_id(),
                'data' => $data,
                'godzina' => trim((string)($g['godzina'] ?? '')),
                'organizator' => $org,
                'atrakcja' => (string)($g['atrakcja'] ?? ''),
                'uwagi' => trim(preg_replace('/\s+/u', ' ', (string)($g['uwagi'] ?? ''))),
                'osoby' => max(0, (int)($g['osoby'] ?? 0)),
                'zadatek' => trim((string)($g['zadatek'] ?? '')),
                'kolejnosc' => $kolejnosc++,
            ];
            if ($stary) {
                if (isset($g['rev']) && (int)$g['rev'] !== (int)$stary['rev']) {   // ktoś zmienił w międzyczasie
                    $pominiete[] = $stary['organizator'];
                    continue;
                }
                if ($usun || $org === '') {
                    plan_zapisz_wiersz('plan_grupy', array_intersect_key($stary, TABELE['plan_grupy']['kol']), teraz_utc());
                    $zapisane++;
                    continue;
                }
                $zmiana = false;
                foreach ($pola as $p) {
                    if ((string)$stary[$p] !== (string)$rekord[$p]) $zmiana = true;
                }
                if (!$zmiana) continue;
            }
            plan_zapisz_wiersz('plan_grupy', $rekord);
            $zapisane++;
        }

        // dzień: pakowanie + do zabrania + uwagi
        $pak = [];
        foreach ($pakowanie as $k => $v) {
            if ($k === 'naraz' && is_array($v)) {
                foreach ($v as $a => $n) if ((string)$n !== '') $pak['naraz'][(string)$a] = max(0, (int)$n);
            } elseif (isset(PLAN_PAKOWANIE[$k]) && (string)$v !== '') {
                $pak[$k] = max(0, (int)$v);
            }
        }
        $dzien = ['data' => $data, 'pakowanie' => $pak ?: null, 'do_zabrania' => trim($doZabrania), 'uwagi' => trim($uwagi)];
        $zmiana = !$teraz['jest']
            ? ($pak || $dzien['do_zabrania'] !== '' || $dzien['uwagi'] !== '')
            : (json_encode(plan_norm($pak)) !== json_encode(plan_norm($teraz['pakowanie']))
                || $dzien['do_zabrania'] !== $teraz['do_zabrania'] || $dzien['uwagi'] !== $teraz['uwagi']);
        if ($zmiana) {
            if ($teraz['jest'] && $revDnia >= 0 && $revDnia !== $teraz['rev']) {
                $pominiete[] = 'Do spakowania';
            } else {
                plan_zapisz_wiersz('plan_dni', $dzien);
                $zapisane++;
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    return ['zapisane' => $zapisane, 'pominiete' => $pominiete];
}

/** „Kopiuj z innego dnia” — tylko do pustego dnia. Odhaczenia z tabletu się nie kopiują. */
function plan_kopiuj(string $z, string $do): int
{
    $zrodlo = plan_dnia($z);
    if (plan_dnia($do)['grupy']) throw new RuntimeException('Ten dzień ma już grupy w planie — kopiować można tylko do pustego dnia.');
    $grupy = array_map(function ($g) {
        return array_intersect_key($g, array_flip(['godzina', 'organizator', 'atrakcja', 'uwagi', 'osoby', 'zadatek']));
    }, $zrodlo['grupy']);
    return plan_zapisz_dzien($do, $grupy, $zrodlo['pakowanie'], $zrodlo['do_zabrania'], $zrodlo['uwagi'])['zapisane'];
}
