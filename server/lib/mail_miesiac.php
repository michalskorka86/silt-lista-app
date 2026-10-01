<?php
// SILT Lista — kopia miesiąca mailem: od MAIL_DZIEN dnia miesiąca (domyślnie 3.) cron wysyła na MIESIECZNY_MAIL
// ZIP z poprzedniego miesiąca (raport każdego dnia, cały miesiąc, CSV). Raz na miesiąc; nieudana wysyłka — ponowi jutro.
// Pensje w treści i w ZIP-ie: tylko podstawa (bez premii).

declare(strict_types=1);

require_once __DIR__ . '/raport.php';

function zapisz_ustawienie(string $klucz, string $wartosc): void
{
    baza()->prepare('INSERT INTO ustawienia (klucz, wartosc) VALUES (?, ?) ON DUPLICATE KEY UPDATE wartosc = VALUES(wartosc)')->execute([$klucz, $wartosc]);
}

/** Cron: wysyła ZIP poprzedniego miesiąca, jeśli już czas i jeszcze nie poszedł. $teraz = true — od razu (test z cron.php?mail=teraz). */
function miesieczny_mail(bool $teraz = false): array
{
    if (MIESIECZNY_MAIL === '') return [];
    $ym = date('Y-m', strtotime(date('Y-m-01') . ' -1 month'));
    if (!$teraz) {
        if ((int)date('j') < (int)MAIL_DZIEN) return [];
        if (ustawienie('mail_miesiac', '') === $ym) return [];
    }
    $dni = miesiac_z_bazy($ym);
    if (!$dni && !$teraz) {
        zapisz_ustawienie('mail_miesiac', $ym);
        return ["mail miesiąca $ym: brak list — nic nie wysłano"];
    }
    $plik = zip_miesiaca_plik($ym);
    if ($plik === null) return ["mail miesiąca $ym: BŁĄD — serwer nie ma modułu ZIP"];
    try {
        $suma = ['brutto' => 0.0, 'wydatki' => 0.0, 'pensje' => 0.0, 'netto' => 0.0, 'grupy' => 0, 'graczy' => 0];
        foreach ($dni as $x) foreach ($suma as $k => $_) $suma[$k] += (float)$x[$k];
        $nazwa = nazwa_miesiaca($ym);
        $tresc = "Kopia list SILT za $nazwa (w załączniku).\r\n\r\n"
            . 'Dni z listami: ' . count($dni) . "\r\n"
            . 'Grupy / osoby: ' . (int)$suma['grupy'] . ' / ' . (int)$suma['graczy'] . "\r\n"
            . 'Przychód brutto: ' . r_zl($suma['brutto']) . "\r\n"
            . 'Wydatki: ' . r_zl($suma['wydatki']) . "\r\n"
            . 'Pensje (podstawa): ' . r_zl($suma['pensje']) . "\r\n"
            . 'Zostaje: ' . r_zl($suma['netto']) . "\r\n\r\n"
            . "W ZIP-ie: raport każdego dnia i cały miesiąc (pliki .html — otwórz w przeglądarce, Ctrl+P → Zapisz jako PDF) oraz podsumowanie .csv do Excela.\r\n"
            . "Ta sama paczka jest zawsze w panelu: lista-api/panel.php → ZIP miesiąca.\r\n";
        $ok = wyslij_mail_z_zalacznikiem(MIESIECZNY_MAIL, "SILT Lista — kopia list: $nazwa", $tresc, $plik, "SILT_lista_$ym.zip");
    } finally {
        @unlink($plik);
    }
    if (!$ok) return ["mail miesiąca $ym: BŁĄD wysyłki — ponowię jutro"];
    zapisz_ustawienie('mail_miesiac', $ym);
    return ["mail miesiąca $ym: wysłano na " . MIESIECZNY_MAIL];
}

/** Zwykły mail() z serwera (LH.pl) z jednym załącznikiem. Testy: MAIL_DO_PLIKU = katalog, mail zapisuje się jako .eml. */
function wyslij_mail_z_zalacznikiem(string $do, string $temat, string $tresc, string $plik, string $nazwaPliku): bool
{
    $granica = 'silt' . bin2hex(random_bytes(8));
    $naglowki = 'From: SILT Lista <' . MAIL_OD . ">\r\n"
        . "MIME-Version: 1.0\r\n"
        . "Content-Type: multipart/mixed; boundary=\"$granica\"";
    $cialo = "--$granica\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($tresc))
        . "--$granica\r\nContent-Type: application/zip; name=\"$nazwaPliku\"\r\nContent-Transfer-Encoding: base64\r\n"
        . "Content-Disposition: attachment; filename=\"$nazwaPliku\"\r\n\r\n"
        . chunk_split(base64_encode((string)file_get_contents($plik)))
        . "--$granica--\r\n";
    $tematKod = '=?UTF-8?B?' . base64_encode($temat) . '?=';
    if (MAIL_DO_PLIKU !== '') {
        return file_put_contents(rtrim(MAIL_DO_PLIKU, '/') . '/mail-' . date('YmdHis') . '-' . bin2hex(random_bytes(3)) . '.eml',
            "To: $do\r\nSubject: $tematKod\r\n$naglowki\r\n\r\n$cialo") !== false;
    }
    return mail($do, $tematKod, $cialo, $naglowki, '-f' . MAIL_OD);
}
