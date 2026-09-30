<?php
// SILT Lista — logowanie tabletów i blokada starej wersji aplikacji.
//
// Tablet wysyła hasło (LISTA_HASLO z config.php) raz → dostaje własny token.
// Każde kolejne zapytanie ma nagłówki:
//   X-Tablet-Token: <token>       (nie Authorization — część hostingów go wycina)
//   X-App-Wersja:   1.2.3         (wersja aplikacji; starsza niż min_wersja_app = blokada zapisu)

declare(strict_types=1);

const PROBY_LOGOWANIA   = 5;    // po tylu błędnych hasłach z jednego IP…
const BLOKADA_MINUT     = 15;   // …blokada na tyle minut (jak w v19)

function znak_hasla(): string
{
    // Odcisk aktualnego hasła: zmiana hasła w config.php unieważnia tokeny wszystkich tabletów.
    return substr(hash('sha256', 'silt-lista|' . LISTA_HASLO), 0, 16);
}

function akcja_zaloguj(array $body): void
{
    $pdo = baza();
    $ip = ip_klienta();

    $st = $pdo->prepare('SELECT COUNT(*) FROM logowania_bledne WHERE ip = ? AND czas > UTC_TIMESTAMP() - INTERVAL ' . BLOKADA_MINUT . ' MINUTE');
    $st->execute([$ip]);
    if ((int)$st->fetchColumn() >= PROBY_LOGOWANIA) {
        throw new BladApi('blokada', 'Za dużo błędnych prób. Spróbuj ponownie za ' . BLOKADA_MINUT . ' minut.', 429);
    }

    $tabletId = (string)($body['tablet_id'] ?? '');
    if (!preg_match('/^[A-Za-z0-9_-]{8,40}$/', $tabletId)) throw new BladApi('zle_dane', 'Brak identyfikatora tabletu');

    $haslo = (string)($body['haslo'] ?? '');
    if (LISTA_HASLO !== '' && !hash_equals(LISTA_HASLO, $haslo)) {
        $pdo->prepare('INSERT INTO logowania_bledne (ip, czas) VALUES (?, UTC_TIMESTAMP())')->execute([$ip]);
        throw new BladApi('zle_haslo', 'Nieprawidłowe hasło', 401);
    }

    $token = bin2hex(random_bytes(32));
    $model = mb_substr(trim((string)($body['model'] ?? '')), 0, 60);
    $wersja = mb_substr(trim((string)($body['wersja'] ?? naglowek('X-App-Wersja'))), 0, 20);

    $pdo->prepare(
        'INSERT INTO tablety (id, token_hash, haslo_znak, zalogowano, ostatnio, wersja_app, model, wylogowano)
         VALUES (?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP(), ?, ?, NULL)
         ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash), haslo_znak = VALUES(haslo_znak),
           zalogowano = VALUES(zalogowano), ostatnio = VALUES(ostatnio), wersja_app = VALUES(wersja_app),
           model = VALUES(model), wylogowano = NULL'
    )->execute([$tabletId, hash('sha256', $token), znak_hasla(), $wersja, $model]);
    $pdo->prepare('DELETE FROM logowania_bledne WHERE ip = ?')->execute([$ip]);

    $st = $pdo->prepare('SELECT nazwa FROM tablety WHERE id = ?');
    $st->execute([$tabletId]);
    odpowiedz(['ok' => true, 'token' => $token, 'tablet' => ['id' => $tabletId, 'nazwa' => (string)$st->fetchColumn()]]);
}

/** Sprawdza token tabletu. Zwraca wiersz z tabeli tablety. */
function wymagaj_tabletu(): array
{
    $token = naglowek('X-Tablet-Token');
    if ($token === '') throw new BladApi('zaloguj', 'Tablet nie jest zalogowany', 401);

    $st = baza()->prepare('SELECT * FROM tablety WHERE token_hash = ? AND wylogowano IS NULL');
    $st->execute([hash('sha256', $token)]);
    $t = $st->fetch();
    if (!$t || !hash_equals($t['haslo_znak'], znak_hasla())) {
        throw new BladApi('zaloguj', 'Zaloguj tablet ponownie (hasło zostało zmienione albo tablet wylogowano)', 401);
    }

    $wersja = mb_substr(naglowek('X-App-Wersja'), 0, 20);
    baza()->prepare('UPDATE tablety SET ostatnio = UTC_TIMESTAMP(), wersja_app = ? WHERE id = ?')
        ->execute([$wersja !== '' ? $wersja : $t['wersja_app'], $t['id']]);
    return $t;
}

/** Blokada starej wersji: stara aplikacja nie może zapisywać ani pobierać danych list. */
function wymagaj_aktualnej_wersji(): void
{
    $min = ustawienie('min_wersja_app', '0.0.0');
    $wersja = naglowek('X-App-Wersja');
    if ($wersja === '' || version_compare($wersja, $min, '<')) {
        throw new BladApi('aktualizacja', 'Zaktualizuj aplikację SILT Lista (wymagana wersja ' . $min . ' lub nowsza)', 426);
    }
}

function akcja_wyloguj(array $t): void
{
    baza()->prepare('UPDATE tablety SET wylogowano = UTC_TIMESTAMP(), token_hash = ? WHERE id = ?')
        ->execute([hash('sha256', random_bytes(32)), $t['id']]);
    odpowiedz(['ok' => true]);
}
