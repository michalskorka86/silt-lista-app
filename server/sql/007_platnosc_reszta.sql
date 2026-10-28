-- Płatność mieszana: reszta (poza gotówką) kartą albo przelewem („Gotówka + przelew”). '' = karta.
-- Wgrać RAZ w phpMyAdmin (zakładka SQL) — PRZED aktualizacją aplikacji na tabletach.
SET NAMES utf8mb4;
ALTER TABLE grupy ADD COLUMN platnosc_reszta VARCHAR(10) NOT NULL DEFAULT '' AFTER platnosc_gotowka;
