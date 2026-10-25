-- Impreza firmowa: stawki wpisywane netto (w bazie brutto) + cena świecy dymnej ustalona dla grupy.
-- Wgrać RAZ w phpMyAdmin (zakładka SQL) — PRZED aktualizacją aplikacji na tabletach.
SET NAMES utf8mb4;
ALTER TABLE grupy
  ADD COLUMN firma TINYINT NOT NULL DEFAULT 0 AFTER platnosc_gotowka,
  ADD COLUMN dym_cena DECIMAL(10,2) NULL AFTER firma;
