-- Płatność „Gotówka + karta” (Mieszana): ile gotówką, reszta kartą.
-- Wgrać RAZ w phpMyAdmin (zakładka SQL) — PRZED aktualizacją aplikacji na tabletach.
SET NAMES utf8mb4;
ALTER TABLE grupy ADD COLUMN platnosc_gotowka DECIMAL(10,2) NULL AFTER platnosc;
