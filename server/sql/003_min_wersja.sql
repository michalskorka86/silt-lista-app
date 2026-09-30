-- ============================================================
-- SILT Lista — zmiana 003: minimalna wersja aplikacji na czas testów = 0.1.0
-- Wgranie: phpMyAdmin → baza serwer432573_lista → Import tego pliku (albo SQL → wklej).
-- ============================================================
-- Pierwsze wersje testowe aplikacji mają numer 0.x. Przy wydaniu 1.0 w Google Play
-- podniesiemy to z powrotem (wtedy stare wersje testowe poproszą o aktualizację).

UPDATE ustawienia SET wartosc = '0.1.0' WHERE klucz = 'min_wersja_app';
