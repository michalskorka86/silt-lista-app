<?php
// ============================================================
// SILT Lista — najnowszy APK do zainstalowania na tablecie (bez Google Play).
//   https://filedops.pl/lista-api/apk.php        → pobranie silt-lista.apk (najnowsze wydanie z GitHuba)
//   https://filedops.pl/lista-api/apk.php?info   → {runtimeVersion, numer, data, opis} — tablet sprawdza, czy ma aktualny APK
// APK budują GitHub Actions („Buduj APK (szybko)”) i publikują w Releases repozytorium APK_REPO.
// ============================================================

declare(strict_types=1);

require_once __DIR__ . '/lib/wspolne.php';

$baza_url = APK_BAZA_URL;

if (!isset($_GET['info'])) {
    header('Cache-Control: no-store');
    header('Location: ' . $baza_url . 'silt-lista.apk', true, 302);
    exit;
}

// info: z pamięci (30 min), żeby nie pytać GitHuba przy każdym tablecie
try {
    $zapis = json_decode(ustawienie('apk_info', ''), true);
    if (!is_array($zapis) || (time() - (int)($zapis['_t'] ?? 0)) > 1800) {
        $ch = curl_init($baza_url . 'wersja.json');
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 5, CURLOPT_TIMEOUT => 10, CURLOPT_USERAGENT => 'silt-lista']);
        $res = curl_exec($ch);
        $kod = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $j = $kod === 200 ? json_decode((string)$res, true) : null;
        if (is_array($j) && !empty($j['runtimeVersion'])) {
            $zapis = [
                'runtimeVersion' => mb_substr((string)$j['runtimeVersion'], 0, 64),
                'numer' => (int)($j['numer'] ?? 0),
                'data' => mb_substr((string)($j['data'] ?? ''), 0, 30),
                'opis' => mb_substr((string)($j['opis'] ?? ''), 0, 120),
                '_t' => time(),
            ];
            $json = json_encode($zapis, JSON_UNESCAPED_UNICODE);
            if (strlen($json) <= 500) {
                baza()->prepare('INSERT INTO ustawienia (klucz, wartosc) VALUES (?, ?) ON DUPLICATE KEY UPDATE wartosc = VALUES(wartosc)')->execute(['apk_info', $json]);
            }
        } elseif (!is_array($zapis)) {
            odpowiedz(['ok' => false, 'kod' => 'apk_brak', 'msg' => 'Brak wydanego APK'], 404);
        }
    }
    unset($zapis['_t']);
    odpowiedz(['ok' => true] + $zapis + ['url' => 'apk.php']);
} catch (Throwable $e) {
    odpowiedz(['ok' => false, 'kod' => 'serwer', 'msg' => 'Błąd serwera'], 500);
}
