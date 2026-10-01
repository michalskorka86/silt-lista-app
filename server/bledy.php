<?php
// ============================================================
// SILT Lista — podgląd zgłoszeń błędów z tabletów (awarie aplikacji, „📨 Zgłoś problem”).
//   https://filedops.pl/lista-api/bledy.php?key=CRON_KEY
// Ten sam klucz co cron. Pokazuje ostatnie 200 zgłoszeń (serwer trzyma je 180 dni).
// ============================================================

declare(strict_types=1);

require_once __DIR__ . '/lib/wspolne.php';

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');
if (CRON_KEY === '' || !hash_equals(CRON_KEY, (string)($_GET['key'] ?? ''))) {
    http_response_code(403);
    exit('Brak dostępu');
}

$h = function ($s): string {
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
};
$pl = function (?string $utc): string {
    if (!$utc) return '';
    $d = new DateTimeImmutable($utc, new DateTimeZone('UTC'));
    return $d->setTimezone(new DateTimeZone('Europe/Warsaw'))->format('d.m.Y H:i');
};

$wiersze = baza()->query(
    'SELECT b.*, t.nazwa AS tablet_nazwa, t.model FROM bledy b LEFT JOIN tablety t ON t.id = b.tablet_id ORDER BY b.id DESC LIMIT 200'
)->fetchAll();
?>
<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SILT Lista — zgłoszenia błędów</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0f0f11; color: #f4f4f5; margin: 0; padding: 16px; }
  h1 { font-size: 20px; color: #f97316; margin: 0 0 4px; }
  p.info { color: #a1a1aa; font-size: 13px; margin: 0 0 16px; }
  .b { background: #1a1a1d; border: 1px solid #2a2a2e; border-radius: 12px; padding: 12px 14px; margin-bottom: 10px; }
  .b.zgl { border-left: 5px solid #3b82f6; }
  .b.aw { border-left: 5px solid #ef4444; }
  .m { color: #a1a1aa; font-size: 12px; margin-bottom: 6px; }
  .k { font-weight: 700; font-size: 15px; white-space: pre-wrap; word-break: break-word; }
  details { margin-top: 6px; } summary { cursor: pointer; color: #a1a1aa; font-size: 12px; }
  pre { white-space: pre-wrap; word-break: break-all; font-size: 11px; color: #d4d4d8; background: #0f0f11; padding: 8px; border-radius: 8px; }
</style>
</head>
<body>
<h1>Zgłoszenia błędów z tabletów</h1>
<p class="info">Niebieskie — „📨 Zgłoś problem” od instruktora. Czerwone — awarie aplikacji. Najnowsze na górze (<?= count($wiersze) ?>).</p>
<?php if (!$wiersze): ?><p>Brak zgłoszeń 🎉</p><?php endif; ?>
<?php foreach ($wiersze as $b):
    $zgl = strpos($b['komunikat'], 'Zgłoszenie:') === 0; ?>
  <div class="b <?= $zgl ? 'zgl' : 'aw' ?>">
    <div class="m">
      <?= $h($pl($b['czas'])) ?> ·
      <?= $h($b['tablet_nazwa'] ?: ($b['model'] ?: ($b['tablet_id'] ?: 'tablet niezalogowany'))) ?> ·
      wersja <?= $h($b['wersja_app'] ?: '?') ?>
      <?= $b['ekran'] ? ' · ekran ' . $h($b['ekran']) : '' ?>
    </div>
    <div class="k"><?= $h($b['komunikat']) ?></div>
    <?php if ($b['stos']): ?><details><summary>szczegóły techniczne</summary><pre><?= $h($b['stos']) ?></pre></details><?php endif; ?>
  </div>
<?php endforeach; ?>
</body>
</html>
