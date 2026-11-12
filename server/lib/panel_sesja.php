<?php
// SILT Lista — logowanie do stron www (panel.php, plan.php): jedno hasło PANEL_HASLO, wspólna sesja.
// Blokada po 5 złych hasłach z jednego IP na 15 min, wylogowanie po 30 min bez ruchu.

declare(strict_types=1);

const PANEL_SESJA_MIN = 30;     // wylogowanie po 30 min bez ruchu
const PANEL_PROBY = 5;          // złe hasła z jednego IP …
const PANEL_BLOKADA_MIN = 15;   // … blokują logowanie na 15 min

/** Sprawdza sesję; bez niej pokazuje logowanie i kończy. $skrypt = dokąd wrócić po zalogowaniu. */
function panel_wymagaj_logowania(string $skrypt): void
{
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
        header('Location: ' . $skrypt);
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
            $_SESSION['csrf'] = bin2hex(random_bytes(16));
            header('Location: ' . $skrypt);
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
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
}

/** Token do formularzy (ochrona przed wysłaniem formularza z obcej strony). */
function panel_csrf(): string
{
    return (string)($_SESSION['csrf'] ?? '');
}

function panel_sprawdz_csrf(): bool
{
    $t = (string)($_POST['csrf'] ?? '');
    return $t !== '' && hash_equals(panel_csrf(), $t);
}

function strona(string $tytul, string $tresc, string $css = '', string $js = ''): void
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
        . $css
        . '</style></head><body>' . $tresc . ($js !== '' ? '<script>' . $js . '</script>' : '') . '</body></html>';
}
