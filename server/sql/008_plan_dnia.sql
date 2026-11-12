-- Plan dnia (rozpiska dla instruktorów): grupy z godzinami i uwagami, co spakować, odhaczenia z tabletu.
-- Wpisywany na stronie lista-api/plan.php, tablety pobierają go przy synchronizacji.
-- Wgrać RAZ w phpMyAdmin (zakładka SQL) — PRZED aktualizacją aplikacji na tabletach.
SET NAMES utf8mb4;

-- Dzień planu: co spakować (liczby wpisuje Michał) i lista rzeczy do zabrania.
CREATE TABLE plan_dni (
  data            DATE          NOT NULL,
  pakowanie       TEXT          NULL,                -- JSON {pb_osoby, pb_kartony, em_osoby, em_kartony, maski_worki, gotcha_worki, naraz:{klasyk,…}}
  do_zabrania     VARCHAR(500)  NOT NULL DEFAULT '', -- „ŚMIESZNE STROJE / ŚWIECE DYMNE / …” (oddzielone / albo nową linią)
  uwagi           VARCHAR(500)  NOT NULL DEFAULT '',
  zmieniono       DATETIME(3)   NOT NULL,
  usunieto        DATETIME(3)   NULL,
  rev             BIGINT UNSIGNED NOT NULL,
  tablet_id       VARCHAR(40)   NULL,
  PRIMARY KEY (data),
  KEY plan_dni_rev (rev)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Grupy z rozpiski (jeszcze nie lista — lista powstaje, gdy grupa przyjedzie).
CREATE TABLE plan_grupy (
  id              VARCHAR(40)   NOT NULL,
  data            DATE          NOT NULL,
  godzina         VARCHAR(20)   NOT NULL DEFAULT '', -- „09:00” albo „11:00-14:00”
  organizator     VARCHAR(80)   NOT NULL,
  atrakcja        VARCHAR(20)   NOT NULL DEFAULT '', -- klucz z tabeli atrakcje ('' = nie wiadomo)
  uwagi           VARCHAR(500)  NOT NULL DEFAULT '',
  osoby           SMALLINT      NOT NULL DEFAULT 0,
  zadatek         VARCHAR(20)   NOT NULL DEFAULT '', -- 'TAK' / 'NIE' / kwota
  kolejnosc       SMALLINT      NOT NULL DEFAULT 0,
  zmieniono       DATETIME(3)   NOT NULL,
  usunieto        DATETIME(3)   NULL,
  rev             BIGINT UNSIGNED NOT NULL,
  tablet_id       VARCHAR(40)   NULL,
  PRIMARY KEY (id),
  KEY plan_grupy_data (data),
  KEY plan_grupy_rev (rev)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Co się stało z grupą z planu (zapisuje tablet): przyszła / nie przyszła, która grupa na liście.
-- Osobna tabela, żeby poprawka planu na stronie nie kasowała odhaczenia z tabletu (i odwrotnie).
CREATE TABLE plan_stan (
  plan_id         VARCHAR(40)   NOT NULL,
  data            DATE          NOT NULL,
  status          VARCHAR(10)   NOT NULL DEFAULT '', -- '' | 'przyszla' | 'nie'
  grupa_id        VARCHAR(40)   NULL,                -- grupa na liście utworzona z planu
  zmieniono       DATETIME(3)   NOT NULL,
  usunieto        DATETIME(3)   NULL,
  rev             BIGINT UNSIGNED NOT NULL,
  tablet_id       VARCHAR(40)   NULL,
  PRIMARY KEY (plan_id),
  KEY plan_stan_data (data),
  KEY plan_stan_rev (rev)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Odhaczone „spakowane” (każda pozycja osobno — dwa tablety nie nadpisują sobie odhaczeń).
CREATE TABLE plan_odhaczenia (
  id              VARCHAR(40)   NOT NULL,
  data            DATE          NOT NULL,
  klucz           VARCHAR(40)   NOT NULL,
  zrobione        TINYINT       NOT NULL DEFAULT 0,
  zmieniono       DATETIME(3)   NOT NULL,
  usunieto        DATETIME(3)   NULL,
  rev             BIGINT UNSIGNED NOT NULL,
  tablet_id       VARCHAR(40)   NULL,
  PRIMARY KEY (id),
  KEY plan_odhaczenia_data (data),
  KEY plan_odhaczenia_rev (rev)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
