-- ============================================================
-- SILT Lista — zmiana 002: ponowna wysyłka statystyk po poprawkach
-- Wgranie: phpMyAdmin → baza serwer432573_lista → SQL → wklej i wykonaj (albo Import tego pliku).
-- ============================================================
--
-- s_stat_rev = ostatni numer zmiany (rev) grup, instruktorów, faktur, wydatków i pensji tego dnia
-- w chwili wysyłki do Statystyk. Jeśli po wysyłce coś na liście poprawiono (wyższy rev),
-- cron o 6:00 wyśle dzień ponownie — nadpisując poprzednie wpisy, bez dublowania.

ALTER TABLE listy
  ADD COLUMN s_stat_rev BIGINT UNSIGNED NULL AFTER s_stat_blad;
