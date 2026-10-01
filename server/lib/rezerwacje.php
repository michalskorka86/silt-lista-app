<?php
// SILT Lista — podgląd rezerwacji dla tabletu (jak w v19): serwer listy pobiera dane z podglad.php
// w systemie rezerwacji (REZ_PODGLAD_URL z tokenem) i oddaje tabletowi, który zapisuje je u siebie
// — dzięki temu podgląd działa też bez zasięgu (ostatni pobrany stan). Bez telefonów i e-maili klientów.

declare(strict_types=1);

/** GET ?akcja=rezerwacje&od=2026-10-01&do=2026-10-31 */
function akcja_rezerwacje(): void
{
    if (REZ_PODGLAD_URL === '' || strpos(REZ_PODGLAD_URL, 'TWOJA-DOMENA') !== false) {
        throw new BladApi('rez_konfiguracja', 'Podgląd rezerwacji nie jest skonfigurowany (REZ_PODGLAD_URL w config.php)', 503);
    }
    $od = (string)($_GET['od'] ?? '');
    $do = (string)($_GET['do'] ?? '');
    foreach ([$od, $do] as $d) {
        if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $d, $m) || !checkdate((int)$m[2], (int)$m[3], (int)$m[1])) {
            throw new BladApi('zle_dane', 'Zła data');
        }
    }
    $url = REZ_PODGLAD_URL . (strpos(REZ_PODGLAD_URL, '?') === false ? '?' : '&')
        . http_build_query(['action' => 'data', 'from' => $od, 'to' => $do, 'filter' => 'all']);
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_CONNECTTIMEOUT => 8]);
    $res = curl_exec($ch);
    $kod = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $j = json_decode((string)$res, true);
    if ($res === false || $kod >= 400 || !is_array($j)) {
        throw new BladApi('rez_serwer', 'Serwer rezerwacji nie odpowiada (HTTP ' . $kod . ')', 502);
    }
    if (empty($j['ok'])) throw new BladApi('rez_serwer', 'Rezerwacje: ' . ($j['msg'] ?? 'błąd'), 502);
    odpowiedz(['ok' => true, 'od' => $od, 'do' => $do, 'rezerwacje' => $j['data'] ?? [], 'atrakcje' => $j['atrakcje'] ?? []]);
}
