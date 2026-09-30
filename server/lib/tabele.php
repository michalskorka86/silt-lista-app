<?php
// SILT Lista — opis tabel synchronizowanych z tabletem.
// Tylko kolumny wymienione tutaj tablet może zapisać. Kolumny serwera (s_…, rev, tablet_id,
// zmieniono, usunieto) ustawia API. Kolejność tabel = kolejność przy pobieraniu (najpierw rodzice).
//
// Opis kolumny: 'typ[:długość][!][?]'
//   typ: id | date | dt | hm | str | int | dec | bool | json
//   !  — wymagana (tablet musi ją podać)
//   ?  — może być NULL (brak wartości = NULL); bez ? brak wartości = domyślna (0 / '')

declare(strict_types=1);

const TABELE = [
    'listy' => ['pk' => 'data', 'kol' => [
        'data'  => 'date!',
        'uwagi' => 'str:500?',
    ]],
    'instruktorzy' => ['pk' => 'id', 'kol' => [
        'id'        => 'id!',
        'data'      => 'date!',
        'imie'      => 'str:40!',
        'kolejnosc' => 'int',
    ]],
    'grupy' => ['pk' => 'id', 'kol' => [
        'id'            => 'id!',
        'data'          => 'date!',
        'instruktor_id' => 'id?',
        'godzina'       => 'hm',
        'utworzono'     => 'dt!',
        'organizator'   => 'str:80',
        'atrakcja'      => 'str:20!',
        'pakiet_nazwa'  => 'str:80',
        'pakiet_typ'    => 'str:5',
        'pakiet_kulki'  => 'int',
        'pakiet_cena'   => 'dec',
        'pakiet_limit'  => 'int',
        'pakiet_extra'  => 'dec',
        'kdod_ilosc'    => 'int?',
        'kdod_cena'     => 'dec?',
        'gracze_reczne' => 'int',
        'kulki_reczne'  => 'int',
        'kwota_reczna'  => 'dec?',
        'zadatek'       => 'dec',
        'platnosc'      => 'str:10',
        'w_gracze'      => 'int',
        'w_kulki'       => 'int',
        'w_kulki_dok'   => 'int',
        'w_dym'         => 'int',
        'w_kwota'       => 'dec',
    ]],
    'gracze' => ['pk' => 'id', 'kol' => [
        'id'           => 'id!',
        'grupa_id'     => 'id!',
        'imie'         => 'str:60!',
        'notatka'      => 'str:120',
        'kolejnosc'    => 'int',
        'pakiet_nazwa' => 'str:80?',
        'pakiet_kulki' => 'int?',
        'pakiet_cena'  => 'dec?',
        'sprzet'       => 'json?',
        'worki_ilosc'  => 'int?',
        'worki_szt'    => 'int?',
        'worki_cena'   => 'dec?',
    ]],
    'pozycje' => ['pk' => 'id', 'kol' => [
        'id'        => 'id!',
        'gracz_id'  => 'id!',
        'rodzaj'    => 'str:5!',
        'dokupione' => 'bool',
        'ilosc'     => 'int',
        'kwota'     => 'dec?',
        'nazwa'     => 'str:80?',
        'kolejnosc' => 'int',
    ]],
    'dodatki' => ['pk' => 'id', 'kol' => [
        'id'        => 'id!',
        'grupa_id'  => 'id!',
        'nazwa'     => 'str:80!',
        'kwota'     => 'dec',
        'kolejnosc' => 'int',
    ]],
    'faktury' => ['pk' => 'grupa_id', 'kol' => [
        'grupa_id' => 'id!',
        'nip'      => 'str:20!',
        'tel'      => 'str:20!',
        'email'    => 'str:120!',
        'kwota'    => 'dec!',
        'platnosc' => 'str:10!',
    ]],
    'wydatki' => ['pk' => 'id', 'kol' => [
        'id'        => 'id!',
        'data'      => 'date!',
        'opis'      => 'str:120!',
        'kwota'     => 'dec',
        'uwagi'     => 'str:250',
        'kolejnosc' => 'int',
    ]],
    'pensje' => ['pk' => 'id', 'kol' => [
        'id'            => 'id!',
        'data'          => 'date!',
        'imie'          => 'str:40!',
        'prac_id'       => 'str:40',
        'godziny'       => 'dec',
        'stawka'        => 'dec',
        'kwota'         => 'dec',
        'premia_stawka' => 'dec',
        'kolejnosc'     => 'int',
    ]],
];

/** Dozwolone wartości kolumn tekstowych o zamkniętej liście. */
const WARTOSCI = [
    'grupy.pakiet_typ' => ['os', 'grupa'],
    'grupy.platnosc'   => ['', 'Gotówka', 'Karta', 'Przelew'],
    'pozycje.rodzaj'   => ['kulki', 'dym', 'inne'],
    'faktury.platnosc' => ['Gotówka', 'Karta', 'Przelew'],
];

function opis_kolumny(string $spec): array
{
    $wymagana = strpos($spec, '!') !== false;
    $pusta = strpos($spec, '?') !== false;
    $spec = str_replace(['!', '?'], '', $spec);
    $cz = explode(':', $spec);
    return ['typ' => $cz[0], 'dl' => isset($cz[1]) ? (int)$cz[1] : 0, 'wymagana' => $wymagana, 'null' => $pusta];
}

/**
 * Sprawdza i porządkuje rekord z tabletu. Zwraca [kolumna => wartość] gotowe do zapisu
 * albo rzuca BladApi('odrzucono', powód).
 */
function przygotuj_rekord(string $tabela, array $rekord): array
{
    $wynik = [];
    foreach (TABELE[$tabela]['kol'] as $kol => $spec) {
        $o = opis_kolumny($spec);
        $jest = array_key_exists($kol, $rekord);
        $v = $jest ? $rekord[$kol] : null;

        $tekstowa = in_array($o['typ'], ['str', 'hm'], true);
        if ($v === '' && !$tekstowa) $v = null;          // puste pole liczbowe = brak wartości
        if ($v === null) {
            if ($o['wymagana']) throw new BladApi('odrzucono', "Brak pola $kol");
            if ($o['null']) { $wynik[$kol] = null; continue; }
            $v = $tekstowa ? '' : 0;
            // kolumna z zamkniętą listą wartości bez pustej → pierwsza z listy (np. pakiet_typ = 'os')
            $lista = WARTOSCI[$tabela . '.' . $kol] ?? null;
            if ($lista !== null && !in_array('', $lista, true)) $v = $lista[0];
        }

        switch ($o['typ']) {
            case 'id':
                if (!is_string($v) || !preg_match('/^[A-Za-z0-9_-]{1,40}$/', $v)) throw new BladApi('odrzucono', "Złe id w polu $kol");
                break;
            case 'date':
                if (!is_string($v) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $v, $m) || !checkdate((int)$m[2], (int)$m[3], (int)$m[1])) {
                    throw new BladApi('odrzucono', "Zła data w polu $kol");
                }
                break;
            case 'dt':
                $c = czas_z_iso($v);
                if ($c === null) throw new BladApi('odrzucono', "Zły czas w polu $kol");
                $v = $c;
                break;
            case 'hm':
                $v = (string)$v;
                if ($v !== '' && !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $v)) throw new BladApi('odrzucono', "Zła godzina w polu $kol");
                break;
            case 'str':
                if (is_array($v) || is_bool($v)) throw new BladApi('odrzucono', "Złe pole $kol");
                $v = mb_substr(trim((string)$v), 0, $o['dl']);
                if ($o['wymagana'] && $v === '') throw new BladApi('odrzucono', "Puste pole $kol");
                break;
            case 'int':
                if (!is_numeric($v)) throw new BladApi('odrzucono', "Pole $kol musi być liczbą");
                $v = (int)round((float)$v);
                break;
            case 'dec':
                if (is_string($v)) $v = str_replace([',', ' '], ['.', ''], $v);   // „150,50” z klawiatury
                if (!is_numeric($v)) throw new BladApi('odrzucono', "Pole $kol musi być kwotą");
                $v = round((float)$v, 2);
                if (abs($v) >= 100000000) throw new BladApi('odrzucono', "Za duża kwota w polu $kol");
                break;
            case 'bool':
                $v = $v ? 1 : 0;
                break;
            case 'json':
                if (!is_array($v)) throw new BladApi('odrzucono', "Pole $kol musi być listą");
                $v = json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                if (strlen($v) > 5000) throw new BladApi('odrzucono', "Za dużo danych w polu $kol");
                break;
        }

        $dozwolone = WARTOSCI[$tabela . '.' . $kol] ?? null;
        if ($dozwolone !== null && !in_array($v, $dozwolone, true)) {
            throw new BladApi('odrzucono', "Niedozwolona wartość pola $kol");
        }
        $wynik[$kol] = $v;
    }
    return $wynik;
}

/** Wiersz z bazy → JSON dla tabletu (liczby jako liczby, czasy ISO UTC, sprzet jako lista). */
function rekord_dla_tabletu(string $tabela, array $w): array
{
    foreach ($w as $kol => $v) {
        if ($v === null) continue;
        $spec = TABELE[$tabela]['kol'][$kol] ?? null;
        if ($spec !== null) {
            $typ = opis_kolumny($spec)['typ'];
            if ($typ === 'int' || $typ === 'bool') $w[$kol] = (int)$v;
            elseif ($typ === 'dec') $w[$kol] = (float)$v;
            elseif ($typ === 'dt') $w[$kol] = czas_do_iso($v);
            elseif ($typ === 'json') $w[$kol] = json_decode($v, true);
        } elseif ($kol === 'rev') {
            $w[$kol] = (int)$v;
        } elseif (in_array($kol, ['zmieniono', 'usunieto', 's_stat_wyslano', 's_sms_wyslano'], true)) {
            $w[$kol] = czas_do_iso($v);
        }
    }
    unset($w['s_stat_wpisy'], $w['s_stat_rev']);   // wewnętrzne dane wysyłki — tabletowi niepotrzebne
    return $w;
}
