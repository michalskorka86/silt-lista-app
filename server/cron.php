<?php
// ============================================================
// SILT Lista — zadania codzienne serwera
// Cron (panel LH.pl → Serwery → Zadania cron), codziennie o 6:00 (0 6 * * *), typ cURL:
//   https://filedops.pl/lista-api/cron.php?key=CRON_KEY
//
// 1) statystyki dni do wczoraj (niewysłane albo poprawione po wysyłce) → Statystyki,
// 2) SMS z danymi do faktur (każda faktura raz; nieudany — ponowienie następnego dnia),
// 3) sprzątanie: kosz po KOSZ_DNI dniach, stare wpisy techniczne.
// ============================================================

declare(strict_types=1);

require_once __DIR__ . '/lib/wspolne.php';
require_once __DIR__ . '/lib/tabele.php';
require_once __DIR__ . '/lib/statystyki.php';

if (PHP_SAPI !== 'cli') {
    header('Content-Type: text/plain; charset=utf-8');
    if (CRON_KEY === '' || !hash_equals(CRON_KEY, (string)($_GET['key'] ?? ''))) {
        http_response_code(403);
        exit("Brak dostępu\n");
    }
}

function sprzatanie(): array
{
    $pdo = baza();
    $log = [];
    $dni = max(7, (int)KOSZ_DNI);

    // Kosz: od dzieci do rodziców (skasowanie rodzica i tak usuwa jego dzieci).
    foreach (array_reverse(array_keys(TABELE)) as $tabela) {
        $n = $pdo->exec("DELETE FROM `$tabela` WHERE usunieto IS NOT NULL AND usunieto < UTC_TIMESTAMP() - INTERVAL $dni DAY");
        if ($n) $log[] = "kosz $tabela: $n";
    }
    $n = $pdo->exec('DELETE FROM zmiany WHERE przyjeto < UTC_TIMESTAMP() - INTERVAL 30 DAY');
    if ($n) $log[] = "zmiany: $n";
    $pdo->exec('DELETE FROM logowania_bledne WHERE czas < UTC_TIMESTAMP() - INTERVAL 1 DAY');
    $pdo->prepare("DELETE FROM ustawienia WHERE klucz LIKE 'ocr\\_%' AND klucz < ?")->execute(['ocr_' . gmdate('YmdH', time() - 7200)]);
    $n = $pdo->exec('DELETE FROM bledy WHERE przyjeto < UTC_TIMESTAMP() - INTERVAL 180 DAY');
    if ($n) $log[] = "zgłoszenia błędów: $n";
    return $log;
}

try {
    $log = array_merge(codzienna_wysylka(), sprzatanie());
    echo date('Y-m-d H:i:s') . ' — ' . ($log ? implode("\n", $log) : 'brak zaległości') . "\n";
} catch (Throwable $e) {
    http_response_code(500);
    echo date('Y-m-d H:i:s') . ' — BŁĄD: ' . $e->getMessage() . "\n";
    exit(1);
}
