-- Pakiet „Dzień Otwarty” w Paintball Klasyczny i ASG.
-- Pakiet na całą grupę bez ceny: instruktor przy tworzeniu grupy wpisuje tylko ilość osób, kulki i kasę
-- (np. otwarty ASG na 110 osób — bez wpisywania każdego gracza). Dym / dodatki można dodać później.
-- Wgrać w phpMyAdmin (zakładka SQL). Można wgrać ponownie — nie zdubluje. cennik_wersja +1 → tablety pobiorą nowy cennik.

SET NAMES utf8mb4;

INSERT INTO pakiety (atrakcja, nazwa, kulki, cena, typ, limit_osob, cena_extra, kolejnosc)
SELECT 'klasyk', 'Dzień Otwarty', 0, 0, 'grupa', 0, 0, 10 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM pakiety WHERE atrakcja = 'klasyk' AND nazwa = 'Dzień Otwarty');

INSERT INTO pakiety (atrakcja, nazwa, kulki, cena, typ, limit_osob, cena_extra, kolejnosc)
SELECT 'asg', 'Dzień Otwarty', 0, 0, 'grupa', 0, 0, 10 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM pakiety WHERE atrakcja = 'asg' AND nazwa = 'Dzień Otwarty');

-- gdyby wcześniej wgrano wersję „na osobę”
UPDATE pakiety SET typ = 'grupa', cena = 0, kulki = 0 WHERE nazwa = 'Dzień Otwarty';

UPDATE ustawienia SET wartosc = CAST(wartosc AS UNSIGNED) + 1 WHERE klucz = 'cennik_wersja';
