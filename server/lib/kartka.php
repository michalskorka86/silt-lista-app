<?php
// SILT Lista — 📷 gracze ze zdjęcia kartki (jak w v19): tablet wysyła zdjęcie, serwer pyta Claude (API Anthropic)
// i oddaje listę: imię, kulki z pakietu, dokupione (po kresce), dym. Klucz API zostaje na serwerze (config.php).

declare(strict_types=1);

const OCR_LIMIT_NA_GODZINE = 60;          // ochrona klucza API (np. zapętlony tablet)
const OCR_MAKS_BAJTOW = 8 * 1024 * 1024;  // zdjęcie po zmniejszeniu na tablecie ma ~0,5 MB

/** POST ?akcja=kartka {obraz: base64, typ: image/jpeg} → {gracze: [{imie, kulki[], dokupione[], dym}]} */
function akcja_kartka(array $body): void
{
    if (ANTHROPIC_API_KEY === '') {
        throw new BladApi('ocr_konfiguracja', 'Odczyt zdjęć nie jest włączony na serwerze (ANTHROPIC_API_KEY w config.php)', 503);
    }
    $typ = (string)($body['typ'] ?? 'image/jpeg');
    if (!in_array($typ, ['image/jpeg', 'image/png', 'image/webp'], true)) throw new BladApi('zle_dane', 'Nieobsługiwany format zdjęcia');
    $obraz = (string)($body['obraz'] ?? '');
    if ($obraz === '' || strlen($obraz) > OCR_MAKS_BAJTOW || base64_decode($obraz, true) === false) {
        throw new BladApi('zle_dane', 'Brak zdjęcia albo zdjęcie za duże');
    }

    // limit na godzinę
    $pdo = baza();
    $klucz = 'ocr_' . gmdate('YmdH');
    $pdo->prepare('INSERT INTO ustawienia (klucz, wartosc) VALUES (?, 1) ON DUPLICATE KEY UPDATE wartosc = wartosc + 1')->execute([$klucz]);
    if ((int)ustawienie($klucz, '0') > OCR_LIMIT_NA_GODZINE) {
        throw new BladApi('ocr_limit', 'Za dużo odczytów zdjęć w tej godzinie — wpisz graczy ręcznie albo spróbuj później', 429);
    }

    $prompt = "To zdjęcie odręcznej listy graczy z pola paintballowego. Każdy wiersz to jeden gracz: imię, a potem ilości wydanych kulek (np. 100 100 200). "
        . "Pionowa kreska | lub ukośnik / oddziela kulki z pakietu od kulek dokupionych — liczby PO kresce to dokupione. "
        . "Może być też zapis świec dymnych (np. 'dym', 'D', 'dym x2') — policz ich ilość. "
        . "Zwróć WYŁĄCZNIE JSON bez komentarzy w formacie: {\"gracze\":[{\"imie\":\"Alex\",\"kulki\":[100,100],\"dokupione\":[500],\"dym\":0}]}. "
        . "Zachowaj kolejność z kartki. Jeśli imienia nie da się odczytać, wpisz \"?\". Nie wymyślaj liczb, których nie widać.";
    $req = ['model' => OCR_MODEL, 'max_tokens' => 2000, 'messages' => [['role' => 'user', 'content' => [
        ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $typ, 'data' => $obraz]],
        ['type' => 'text', 'text' => $prompt],
    ]]]];
    $ch = curl_init(ANTHROPIC_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 60, CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_POSTFIELDS => json_encode($req),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-api-key: ' . ANTHROPIC_API_KEY, 'anthropic-version: 2023-06-01'],
    ]);
    $res = curl_exec($ch);
    $kod = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $j = json_decode((string)$res, true);
    if ($res === false || !is_array($j)) throw new BladApi('ocr_serwer', 'Odczyt zdjęcia: brak odpowiedzi (HTTP ' . $kod . ')', 502);
    if (isset($j['error'])) throw new BladApi('ocr_serwer', 'Odczyt zdjęcia: ' . ($j['error']['message'] ?? 'błąd'), 502);

    $txt = '';
    foreach ($j['content'] ?? [] as $c) if (($c['type'] ?? '') === 'text') $txt .= $c['text'];
    $a = strpos($txt, '{');
    $b = strrpos($txt, '}');
    $dane = ($a !== false && $b !== false) ? json_decode(substr($txt, $a, $b - $a + 1), true) : null;
    if (!is_array($dane) || !isset($dane['gracze']) || !is_array($dane['gracze'])) {
        throw new BladApi('ocr_nieczytelne', 'Nie udało się odczytać listy — zrób wyraźniejsze zdjęcie albo wpisz graczy ręcznie', 422);
    }
    $liczby = function ($v): array {
        return array_values(array_filter(array_map('intval', is_array($v) ? $v : []), function ($x) { return $x > 0 && $x <= 100000; }));
    };
    $gracze = [];
    foreach ($dane['gracze'] as $g) {
        if (!is_array($g)) continue;
        $gracze[] = [
            'imie' => mb_substr(trim((string)($g['imie'] ?? '')), 0, 60),
            'kulki' => $liczby($g['kulki'] ?? []),
            'dokupione' => $liczby($g['dokupione'] ?? []),
            'dym' => max(0, min(50, (int)($g['dym'] ?? 0))),
        ];
    }
    odpowiedz(['ok' => true, 'gracze' => array_slice($gracze, 0, 60)]);
}
