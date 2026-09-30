-- ============================================================
-- SILT Lista — schemat bazy serwera (MySQL 5.7+/8 lub MariaDB 10.3+)
-- Baza: serwer432573_lista  ·  kodowanie utf8mb4  ·  InnoDB
-- Wgranie: phpMyAdmin → baza serwer432573_lista → Import tego pliku (kodowanie utf-8).
-- ============================================================
--
-- ZASADY
-- • Id rekordów list (instruktorzy, grupy, gracze, pozycje…) nadaje TABLET
--   (praca bez zasięgu), stąd VARCHAR(40). Te same id co w SQLite na tablecie.
--   Stare id z v19 („g…”, „p…”) mieszczą się bez zmian przy przenoszeniu data/.
-- • Kolumny synchronizacji w każdej tabeli listy:
--     zmieniono  — kiedy zmieniono NA TABLECIE (rozstrzyga, która wersja wygrywa)
--     usunieto   — NULL = jest; data = w koszu (tablet: przywracanie przez 7 dni,
--                  serwer kasuje na dobre po 30 dniach — cron.php)
--     rev        — numer zmiany nadany przez SERWER (pobieranie „co nowego od…”)
--     tablet_id  — który tablet zmienił ostatnio
-- • Wszystkie znaczniki czasu (DATETIME) są w UTC; kolumna `data` to dzień listy (czas polski).
-- • Kolumny „s_…” wypełnia tylko serwer (statystyki, SMS) — tablet ich nie nadpisuje.
-- • Kolumny „w_…” w grupach to wynik obliczeń z tabletu (ta sama funkcja calc() co w v19),
--   żeby serwer, cron i panel www nie liczyły cen drugi raz.
-- • Ceny w grupie/graczu to KOPIA z cennika z chwili dodania — zmiana cennika
--   nie zmienia starych list.
-- ============================================================

SET NAMES utf8mb4;

-- ------------------------------------------------------------
-- 1. LISTY DNIA
-- ------------------------------------------------------------

-- Jedna lista na dzień (klucz = data). Dwa tablety tworzące ten sam dzień trafiają do tej samej listy.
CREATE TABLE listy (
  data            DATE          NOT NULL,
  uwagi           VARCHAR(500)  NULL,
  -- statystyki (wypełnia serwer)
  s_stat_wyslano  DATETIME      NULL,                -- NULL = nie wysłane
  s_stat_przez    VARCHAR(10)   NULL,                -- 'tablet' | 'auto' | 'panel'
  s_stat_wpisy    TEXT          NULL,                -- JSON [[tabela,id],…] wpisów w Statystykach (do nadpisania)
  s_stat_blad     VARCHAR(500)  NULL,
  -- synchronizacja
  zmieniono       DATETIME(3)   NOT NULL,
  usunieto        DATETIME(3)   NULL,
  rev             BIGINT UNSIGNED NOT NULL,
  tablet_id       VARCHAR(40)   NULL,
  PRIMARY KEY (data),
  KEY listy_rev (rev)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Zakładki instruktorów na liście (v19: tabs).
CREATE TABLE instruktorzy (
  id              VARCHAR(40)   NOT NULL,
  data            DATE          NOT NULL,
  imie            VARCHAR(40)   NOT NULL,
  kolejnosc       SMALLINT      NOT NULL DEFAULT 0,
  zmieniono       DATETIME(3)   NOT NULL,
  usunieto        DATETIME(3)   NULL,
  rev             BIGINT UNSIGNED NOT NULL,
  tablet_id       VARCHAR(40)   NULL,
  PRIMARY KEY (id),
  KEY instruktorzy_data (data),
  KEY instruktorzy_rev (rev),
  CONSTRAINT instruktorzy_lista FOREIGN KEY (data) REFERENCES listy (data) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Grupy (v19: groups).
CREATE TABLE grupy (
  id              VARCHAR(40)   NOT NULL,
  data            DATE          NOT NULL,
  instruktor_id   VARCHAR(40)   NULL,                -- zakładka; NULL gdy instruktor usunięty
  godzina         CHAR(5)       NOT NULL DEFAULT '', -- '10:00'
  utworzono       DATETIME(3)   NOT NULL,            -- kolejność grup w statystykach
  organizator     VARCHAR(80)   NOT NULL DEFAULT '',
  atrakcja        VARCHAR(20)   NOT NULL,            -- klucz z tabeli atrakcje: klasyk, emek, gotcha…
  -- pakiet grupy (kopia z cennika)
  pakiet_nazwa    VARCHAR(80)   NOT NULL DEFAULT '',
  pakiet_typ      VARCHAR(5)    NOT NULL DEFAULT 'os', -- 'os' (cena za osobę) | 'grupa'
  pakiet_kulki    INT           NOT NULL DEFAULT 0,
  pakiet_cena     DECIMAL(10,2) NOT NULL DEFAULT 0,
  pakiet_limit    SMALLINT      NOT NULL DEFAULT 0,  -- pakiet grupowy: do ilu osób
  pakiet_extra    DECIMAL(10,2) NOT NULL DEFAULT 0,  -- pakiet grupowy: cena za osobę ponad limit
  -- kulki dodatkowe (v19: kdod; NULL = atrakcja bez dokupowania, np. laser)
  kdod_ilosc      INT           NULL,
  kdod_cena       DECIMAL(10,2) NULL,
  -- wpisy ręczne
  gracze_reczne   SMALLINT      NOT NULL DEFAULT 0,  -- v19: gracze (liczba osób bez imion)
  kulki_reczne    INT           NOT NULL DEFAULT 0,  -- v19: kulkiManual
  kwota_reczna    DECIMAL(10,2) NULL,                -- v19: kwotaManual; NULL = licz automatycznie
  zadatek         DECIMAL(10,2) NOT NULL DEFAULT 0,
  platnosc        VARCHAR(10)   NOT NULL DEFAULT '', -- 'Gotówka' | 'Karta' | 'Przelew' | ''
  -- wynik obliczeń z tabletu (do statystyk, SMS, panelu)
  w_gracze        SMALLINT      NOT NULL DEFAULT 0,
  w_kulki         INT           NOT NULL DEFAULT 0,
  w_kulki_dok     INT           NOT NULL DEFAULT 0,
  w_dym           SMALLINT      NOT NULL DEFAULT 0,
  w_kwota         DECIMAL(10,2) NOT NULL DEFAULT 0,
  -- synchronizacja
  zmieniono       DATETIME(3)   NOT NULL,
  usunieto        DATETIME(3)   NULL,
  rev             BIGINT UNSIGNED NOT NULL,
  tablet_id       VARCHAR(40)   NULL,
  PRIMARY KEY (id),
  KEY grupy_data (data),
  KEY grupy_rev (rev),
  CONSTRAINT grupy_lista FOREIGN KEY (data) REFERENCES listy (data) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Gracze w grupie (v19: players).
CREATE TABLE gracze (
  id              VARCHAR(40)   NOT NULL,
  grupa_id        VARCHAR(40)   NOT NULL,
  imie            VARCHAR(60)   NOT NULL,
  notatka         VARCHAR(120)  NOT NULL DEFAULT '', -- np. 'org.'
  kolejnosc       SMALLINT      NOT NULL DEFAULT 0,
  -- inny pakiet niż grupa (v19: p.pk); NULL = pakiet grupy
  pakiet_nazwa    VARCHAR(80)   NULL,
  pakiet_kulki    INT           NULL,
  pakiet_cena     DECIMAL(10,2) NULL,
  -- własny sprzęt (v19: p.sprzet) — JSON [{"nazwa":"Własny","kwota":40}, …]; NULL = brak
  sprzet          TEXT          NULL,
  -- worki kulek dla własnego sprzętu (v19: p.worki); NULL = brak
  worki_ilosc     SMALLINT      NULL,
  worki_szt       INT           NULL,
  worki_cena      DECIMAL(10,2) NULL,
  zmieniono       DATETIME(3)   NOT NULL,
  usunieto        DATETIME(3)   NULL,
  rev             BIGINT UNSIGNED NOT NULL,
  tablet_id       VARCHAR(40)   NULL,
  PRIMARY KEY (id),
  KEY gracze_grupa (grupa_id),
  KEY gracze_rev (rev),
  CONSTRAINT gracze_grupa FOREIGN KEY (grupa_id) REFERENCES grupy (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kulki / dym / inne przy graczu (v19: p.items) — jeden „chip” = jeden wiersz.
CREATE TABLE pozycje (
  id              VARCHAR(40)   NOT NULL,
  gracz_id        VARCHAR(40)   NOT NULL,
  rodzaj          VARCHAR(5)    NOT NULL,            -- 'kulki' | 'dym' | 'inne'
  dokupione       TINYINT(1)    NOT NULL DEFAULT 0,  -- kulki: 0 = z pakietu, 1 = dokupione (v19: seg 'd')
  ilosc           INT           NOT NULL DEFAULT 0,  -- kulki: szt., dym: świece
  kwota           DECIMAL(10,2) NULL,                -- dym / inne (0 = gratis); kulki: NULL (liczone z kdod)
  nazwa           VARCHAR(80)   NULL,                -- tylko 'inne'
  kolejnosc       SMALLINT      NOT NULL DEFAULT 0,
  zmieniono       DATETIME(3)   NOT NULL,
  usunieto        DATETIME(3)   NULL,
  rev             BIGINT UNSIGNED NOT NULL,
  tablet_id       VARCHAR(40)   NULL,
  PRIMARY KEY (id),
  KEY pozycje_gracz (gracz_id),
  KEY pozycje_rev (rev),
  CONSTRAINT pozycje_gracz FOREIGN KEY (gracz_id) REFERENCES gracze (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dodatki grupy: catering, ognisko, GoPro… (v19: g.dodatki).
CREATE TABLE dodatki (
  id              VARCHAR(40)   NOT NULL,
  grupa_id        VARCHAR(40)   NOT NULL,
  nazwa           VARCHAR(80)   NOT NULL,
  kwota           DECIMAL(10,2) NOT NULL DEFAULT 0,
  kolejnosc       SMALLINT      NOT NULL DEFAULT 0,
  zmieniono       DATETIME(3)   NOT NULL,
  usunieto        DATETIME(3)   NULL,
  rev             BIGINT UNSIGNED NOT NULL,
  tablet_id       VARCHAR(40)   NULL,
  PRIMARY KEY (id),
  KEY dodatki_grupa (grupa_id),
  KEY dodatki_rev (rev),
  CONSTRAINT dodatki_grupa FOREIGN KEY (grupa_id) REFERENCES grupy (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dane do faktury (0 lub 1 na grupę). SMS o 6:00 idzie raz — pilnuje tego s_sms_wyslano.
CREATE TABLE faktury (
  grupa_id        VARCHAR(40)   NOT NULL,
  nip             VARCHAR(20)   NOT NULL,
  tel             VARCHAR(20)   NOT NULL,
  email           VARCHAR(120)  NOT NULL,
  kwota           DECIMAL(10,2) NOT NULL,
  platnosc        VARCHAR(10)   NOT NULL,
  s_sms_wyslano   DATETIME      NULL,                -- wypełnia serwer
  s_sms_blad      VARCHAR(500)  NULL,
  zmieniono       DATETIME(3)   NOT NULL,
  usunieto        DATETIME(3)   NULL,
  rev             BIGINT UNSIGNED NOT NULL,
  tablet_id       VARCHAR(40)   NULL,
  PRIMARY KEY (grupa_id),
  KEY faktury_rev (rev),
  KEY faktury_sms (s_sms_wyslano),
  CONSTRAINT faktury_grupa FOREIGN KEY (grupa_id) REFERENCES grupy (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Wydatki dnia.
CREATE TABLE wydatki (
  id              VARCHAR(40)   NOT NULL,
  data            DATE          NOT NULL,
  opis            VARCHAR(120)  NOT NULL,
  kwota           DECIMAL(10,2) NOT NULL DEFAULT 0,
  uwagi           VARCHAR(250)  NOT NULL DEFAULT '',
  kolejnosc       SMALLINT      NOT NULL DEFAULT 0,
  zmieniono       DATETIME(3)   NOT NULL,
  usunieto        DATETIME(3)   NULL,
  rev             BIGINT UNSIGNED NOT NULL,
  tablet_id       VARCHAR(40)   NULL,
  PRIMARY KEY (id),
  KEY wydatki_data (data),
  KEY wydatki_rev (rev),
  CONSTRAINT wydatki_lista FOREIGN KEY (data) REFERENCES listy (data) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pensje instruktorów dnia. Premia NIE jest pokazywana na liście — idzie tylko do Statystyk.
CREATE TABLE pensje (
  id              VARCHAR(40)   NOT NULL,
  data            DATE          NOT NULL,
  imie            VARCHAR(40)   NOT NULL,
  prac_id         VARCHAR(40)   NOT NULL DEFAULT '', -- id pracownika w Statystykach ('' = wpisany ręcznie)
  godziny         DECIMAL(5,2)  NOT NULL DEFAULT 0,
  stawka          DECIMAL(10,2) NOT NULL DEFAULT 0,
  kwota           DECIMAL(10,2) NOT NULL DEFAULT 0,  -- podstawa, zaokrąglona do 10 zł
  premia_stawka   DECIMAL(10,2) NOT NULL DEFAULT 0,  -- zł/h ze Statystyk w chwili dodania (zapas, gdy Statystyki nie odpowiadają)
  kolejnosc       SMALLINT      NOT NULL DEFAULT 0,
  zmieniono       DATETIME(3)   NOT NULL,
  usunieto        DATETIME(3)   NULL,
  rev             BIGINT UNSIGNED NOT NULL,
  tablet_id       VARCHAR(40)   NULL,
  PRIMARY KEY (id),
  KEY pensje_data (data),
  KEY pensje_rev (rev),
  CONSTRAINT pensje_lista FOREIGN KEY (data) REFERENCES listy (data) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2. CENNIK (zmiana ceny bez aktualizacji aplikacji)
-- ------------------------------------------------------------

-- v19: const ATR
CREATE TABLE atrakcje (
  klucz           VARCHAR(20)   NOT NULL,            -- klasyk, emek, sportowy, asg, gotcha, gel, laser
  nazwa           VARCHAR(60)   NOT NULL,
  podpis          VARCHAR(30)   NOT NULL DEFAULT '', -- np. '0,68 cal'
  stat_nazwa      VARCHAR(30)   NOT NULL,            -- nazwa w Statystykach: KLASYK, GOTHA…
  kolor           CHAR(7)       NOT NULL,            -- '#8B6355'
  kdod_ilosc      INT           NULL,                -- kulki dodatkowe: paczka (NULL = brak)
  kdod_cena       DECIMAL(10,2) NULL,
  opcje_pakiet    VARCHAR(100)  NOT NULL DEFAULT '', -- szybkie przyciski kulek z pakietu, np. '50,100,200,500'
  opcje_dok       VARCHAR(100)  NOT NULL DEFAULT '', -- szybkie przyciski kulek dokupionych
  kolejnosc       SMALLINT      NOT NULL DEFAULT 0,
  aktywna         TINYINT(1)    NOT NULL DEFAULT 1,
  PRIMARY KEY (klucz)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pakiety (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  atrakcja        VARCHAR(20)   NOT NULL,
  nazwa           VARCHAR(80)   NOT NULL,
  kulki           INT           NOT NULL DEFAULT 0,
  cena            DECIMAL(10,2) NOT NULL DEFAULT 0,  -- 0 przy typie 'grupa' = cena ustalana ręcznie
  typ             VARCHAR(5)    NOT NULL DEFAULT 'os',
  limit_osob      SMALLINT      NOT NULL DEFAULT 0,
  cena_extra      DECIMAL(10,2) NOT NULL DEFAULT 0,
  kolejnosc       SMALLINT      NOT NULL DEFAULT 0,
  aktywny         TINYINT(1)    NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY pakiety_atrakcja (atrakcja, kolejnosc),
  CONSTRAINT pakiety_atrakcja FOREIGN KEY (atrakcja) REFERENCES atrakcje (klucz) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- v19: const SPRZET (własny sprzęt gracza — gracz nie płaci podstawy)
CREATE TABLE sprzet (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nazwa           VARCHAR(40)   NOT NULL,
  cena            DECIMAL(10,2) NOT NULL,
  ikona           VARCHAR(8)    NOT NULL DEFAULT '',
  kolejnosc       SMALLINT      NOT NULL DEFAULT 0,
  aktywny         TINYINT(1)    NOT NULL DEFAULT 1,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- v19: DODATKI_MAIN / DODATKI_MORE (katalog przycisków; cenę wpisuje instruktor)
CREATE TABLE dodatki_katalog (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nazwa           VARCHAR(40)   NOT NULL,
  ikona           VARCHAR(8)    NOT NULL DEFAULT '',
  sekcja          VARCHAR(10)   NOT NULL DEFAULT 'glowne', -- 'glowne' | 'wiecej'
  kolejnosc       SMALLINT      NOT NULL DEFAULT 0,
  aktywny         TINYINT(1)    NOT NULL DEFAULT 1,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pojedyncze wartości: cena dymu, worek, minimalna wersja aplikacji, wersja cennika…
CREATE TABLE ustawienia (
  klucz           VARCHAR(40)   NOT NULL,
  wartosc         VARCHAR(500)  NOT NULL,
  PRIMARY KEY (klucz)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 3. TABLETY, SYNCHRONIZACJA, BŁĘDY
-- ------------------------------------------------------------

-- Zalogowane tablety. Hasło (LISTA_HASLO z config.php) wpisuje się raz → serwer wydaje
-- tabletowi własny token (tu tylko jego skrót SHA-256). Wylogowanie jednego tabletu = wylogowano.
CREATE TABLE tablety (
  id              VARCHAR(40)   NOT NULL,            -- nadaje aplikacja przy instalacji
  nazwa           VARCHAR(60)   NOT NULL DEFAULT '', -- np. 'Tablet 1' (ustawiane w panelu)
  token_hash      CHAR(64)      NOT NULL,
  haslo_znak      CHAR(16)      NOT NULL,            -- odcisk hasła z config.php; zmiana hasła = wszystkie tablety wylogowane
  zalogowano      DATETIME      NOT NULL,
  ostatnio        DATETIME      NULL,                -- ostatni kontakt
  wersja_app      VARCHAR(20)   NULL,
  model           VARCHAR(60)   NULL,
  wylogowano      DATETIME      NULL,
  PRIMARY KEY (id),
  UNIQUE KEY tablety_token (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Przyjęte zmiany z kolejki tabletu — ta sama zmiana wysłana drugi raz (np. zerwane
-- połączenie po zapisie) jest rozpoznawana i pomijana. Czyszczone po 30 dniach.
CREATE TABLE zmiany (
  tablet_id       VARCHAR(40)   NOT NULL,
  zmiana_id       VARCHAR(40)   NOT NULL,            -- id wpisu z tabeli kolejka na tablecie
  tabela          VARCHAR(20)   NOT NULL,
  rekord_id       VARCHAR(40)   NOT NULL,
  wynik           VARCHAR(10)   NOT NULL,            -- 'zapisano' | 'starsza' (serwer miał nowszą) | 'odrzucono'
  przyjeto        DATETIME(3)   NOT NULL,
  PRIMARY KEY (tablet_id, zmiana_id),
  KEY zmiany_przyjeto (przyjeto)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Licznik rev (jeden wiersz): UPDATE licznik SET wartosc = LAST_INSERT_ID(wartosc + 1)
CREATE TABLE licznik (
  nazwa           VARCHAR(20)   NOT NULL,
  wartosc         BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (nazwa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Błędne logowania (5 prób z jednego IP → blokada 15 min, jak w v19).
CREATE TABLE logowania_bledne (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ip              VARCHAR(45)   NOT NULL,
  czas            DATETIME      NOT NULL,
  PRIMARY KEY (id),
  KEY logowania_ip (ip, czas)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Zgłoszenia błędów z aplikacji (gdy się wysypie).
CREATE TABLE bledy (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tablet_id       VARCHAR(40)   NULL,
  wersja_app      VARCHAR(20)   NULL,
  czas            DATETIME      NOT NULL,            -- czas na tablecie
  przyjeto        DATETIME      NOT NULL,
  ekran           VARCHAR(60)   NULL,
  komunikat       VARCHAR(500)  NOT NULL,
  stos            TEXT          NULL,
  PRIMARY KEY (id),
  KEY bledy_czas (przyjeto)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 4. DANE POCZĄTKOWE (cennik 1:1 z v19 index.php)
-- ------------------------------------------------------------

INSERT INTO licznik (nazwa, wartosc) VALUES ('rev', 0);

INSERT INTO ustawienia (klucz, wartosc) VALUES
  ('dym_cena',        '10'),
  ('worek_szt',       '500'),
  ('worek_cena',      '40'),
  ('min_wersja_app',  '1.0.0'),
  ('cennik_wersja',   '1');     -- rośnie przy każdej zmianie cennika → tablet wie, że ma pobrać nowy

INSERT INTO atrakcje (klucz, nazwa, podpis, stat_nazwa, kolor, kdod_ilosc, kdod_cena, opcje_pakiet, opcje_dok, kolejnosc) VALUES
  ('klasyk',   'Paintball Klasyczny', '0,68 cal', 'KLASYK',             '#8B6355', 100,  15, '50,100,200,500', '100,200,500,1000', 1),
  ('emek',     'Paintball Emek',      '0,50 cal', 'EMEK',               '#5C6BC0', 100,  15, '50,100,200,500', '100,200,500,1000', 2),
  ('sportowy', 'Paintball Sportowy',  '0,68 cal', 'PAINTBALL SPORTOWY', '#2C6E3F', 100,  15, '100,200,500',    '100,200,500,1000', 3),
  ('asg',      'ASG',                 '',         'ASG',                '#D4607A', 1000, 50, '250,500,1000',   '500,1000,2000',    4),
  ('gotcha',   'Paintball Gotcha',    '',         'GOTHA',              '#7B1FA2', 100,  15, '50,100,200',     '100,200,500',      5),
  ('gel',      'GelBlaster',          '',         'GELBLASTER',         '#D4920A', 800,  20, '400,800',        '800,1600',         6),
  ('laser',    'Paintball Laserowy',  '',         'LASER',              '#D05A20', NULL, NULL, '',             '',                 7);

INSERT INTO pakiety (atrakcja, nazwa, kulki, cena, typ, limit_osob, cena_extra, kolejnosc) VALUES
  ('klasyk',   'Pakiet BASIC',                  200,  90,  'os',    0,  0,  1),
  ('klasyk',   'Pakiet SILT',                   500,  130, 'os',    0,  0,  2),
  ('klasyk',   'Pakiet MAXI',                   1000, 180, 'os',    0,  0,  3),
  ('emek',     'Pakiet BASIC',                  200,  90,  'os',    0,  0,  1),
  ('emek',     'Pakiet SILT',                   500,  130, 'os',    0,  0,  2),
  ('sportowy', 'Pakiet SILT',                   500,  150, 'os',    0,  0,  1),
  ('asg',      'Pakiet BASIC',                  500,  90,  'os',    0,  0,  1),
  ('asg',      'Pakiet SILT',                   1000, 130, 'os',    0,  0,  2),
  ('gotcha',   'Pakiet urodzinowy do 10 osób',  0,    850, 'grupa', 10, 70, 1),
  ('gel',      'Pakiet urodzinowy do 10 osób',  0,    850, 'grupa', 10, 70, 1),
  ('laser',    'Cena indywidualna',             0,    0,   'grupa', 0,  0,  1);

INSERT INTO sprzet (nazwa, cena, ikona, kolejnosc) VALUES
  ('Własny',       40, '🎒', 1),
  ('Własny',       30, '🎒', 2),
  ('Sama Replika', 60, '🔫', 3),
  ('Mundur',       10, '🥋', 4);

INSERT INTO dodatki_katalog (nazwa, ikona, sekcja, kolejnosc) VALUES
  ('Catering',              '🍕', 'glowne', 1),
  ('Ognisko',               '🔥', 'glowne', 2),
  ('Ognisko z kiełbaskami', '🌭', 'glowne', 3),
  ('Grill',                 '🍖', 'glowne', 4),
  ('Inne',                  '⭐', 'glowne', 5),
  ('GoPro',                 '📷', 'wiecej', 1),
  ('Fotograf',              '📸', 'wiecej', 2),
  ('Dyplomy',               '📜', 'wiecej', 3),
  ('Puchar',                '🏆', 'wiecej', 4),
  ('Bateria ASG',           '🔋', 'wiecej', 5),
  ('Butla HP',              '🧯', 'wiecej', 6),
  ('Maska',                 '🥽', 'wiecej', 7),
  ('Węgiel',                '⚫', 'wiecej', 8),
  ('Oświetlenie',           '💡', 'wiecej', 9),
  ('Nagłośnienie',          '🔊', 'wiecej', 10);
