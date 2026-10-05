-- Pakiet „Dzień Otwarty” w Paintball Klasyczny i ASG.
-- Cena 0 i kulki 0 = bez podpowiedzi: instruktor sam wpisuje cenę za osobę i kulki przy tworzeniu grupy.
-- Wgrać RAZ w phpMyAdmin (zakładka SQL). cennik_wersja +1 → tablety same pobiorą nowy cennik.

SET NAMES utf8mb4;

INSERT INTO pakiety (atrakcja, nazwa, kulki, cena, typ, limit_osob, cena_extra, kolejnosc)
SELECT 'klasyk', 'Dzień Otwarty', 0, 0, 'os', 0, 0, 10 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM pakiety WHERE atrakcja = 'klasyk' AND nazwa = 'Dzień Otwarty');

INSERT INTO pakiety (atrakcja, nazwa, kulki, cena, typ, limit_osob, cena_extra, kolejnosc)
SELECT 'asg', 'Dzień Otwarty', 0, 0, 'os', 0, 0, 10 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM pakiety WHERE atrakcja = 'asg' AND nazwa = 'Dzień Otwarty');

UPDATE ustawienia SET wartosc = CAST(wartosc AS UNSIGNED) + 1 WHERE klucz = 'cennik_wersja';
