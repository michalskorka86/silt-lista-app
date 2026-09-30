import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Migracje bazy na tablecie. Wersja trzymana w PRAGMA user_version.
 * Zasada: NIGDY nie zmieniamy starej migracji — zawsze dopisujemy nową (kolejny `if`).
 * Każda nowa migracja idzie w jednej transakcji razem z podniesieniem user_version,
 * więc przerwana (np. rozładowany tablet) nie zostawi bazy w połowie.
 */
export const DB_NAME = 'silt-lista.db';

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(`
      -- Ustawienia aplikacji (motyw, adres serwera, token tabletu itp.)
      CREATE TABLE IF NOT EXISTS ustawienia (
        klucz   TEXT PRIMARY KEY NOT NULL,
        wartosc TEXT
      );

      -- Kolejka zmian do wysłania na serwer (praca bez zasięgu).
      CREATE TABLE IF NOT EXISTS kolejka (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        typ       TEXT NOT NULL,           -- np. 'grupa.zapis', 'lista.zamknij'
        dane      TEXT NOT NULL,           -- JSON
        utworzono TEXT NOT NULL DEFAULT (datetime('now')),
        wyslano   TEXT,                    -- NULL = czeka na wysłanie
        proby     INTEGER NOT NULL DEFAULT 0,
        blad      TEXT
      );
      CREATE INDEX IF NOT EXISTS kolejka_niewyslane ON kolejka (wyslano, id);
    `);
    version = 1;
  }

  if (version < 2) {
    // Tabele list — kolumny jak na serwerze (server/sql/001_schemat.sql, src/db/tabele.ts).
    // Kwoty jako REAL (zaokrąglane do groszy przy zapisie), czasy jako tekst ISO (UTC).
    // Bez kluczy obcych: kasowanie to „usunieto” (kosz), a kolejność zapisu pilnuje kolejka.
    const sync = `
        zmieniono TEXT NOT NULL,
        usunieto  TEXT,
        rev       INTEGER`;
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(`
      CREATE TABLE IF NOT EXISTS listy (
        data TEXT PRIMARY KEY NOT NULL,
        uwagi TEXT,
        s_stat_wyslano TEXT, s_stat_przez TEXT, s_stat_blad TEXT,
        ${sync}
      );
      CREATE TABLE IF NOT EXISTS instruktorzy (
        id TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL,
        imie TEXT NOT NULL,
        kolejnosc INTEGER NOT NULL DEFAULT 0,
        ${sync}
      );
      CREATE INDEX IF NOT EXISTS instruktorzy_data ON instruktorzy (data);
      CREATE TABLE IF NOT EXISTS grupy (
        id TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL,
        instruktor_id TEXT,
        godzina TEXT NOT NULL DEFAULT '',
        utworzono TEXT NOT NULL,
        organizator TEXT NOT NULL DEFAULT '',
        atrakcja TEXT NOT NULL,
        pakiet_nazwa TEXT NOT NULL DEFAULT '',
        pakiet_typ TEXT NOT NULL DEFAULT 'os',
        pakiet_kulki INTEGER NOT NULL DEFAULT 0,
        pakiet_cena REAL NOT NULL DEFAULT 0,
        pakiet_limit INTEGER NOT NULL DEFAULT 0,
        pakiet_extra REAL NOT NULL DEFAULT 0,
        kdod_ilosc INTEGER,
        kdod_cena REAL,
        gracze_reczne INTEGER NOT NULL DEFAULT 0,
        kulki_reczne INTEGER NOT NULL DEFAULT 0,
        kwota_reczna REAL,
        zadatek REAL NOT NULL DEFAULT 0,
        platnosc TEXT NOT NULL DEFAULT '',
        w_gracze INTEGER NOT NULL DEFAULT 0,
        w_kulki INTEGER NOT NULL DEFAULT 0,
        w_kulki_dok INTEGER NOT NULL DEFAULT 0,
        w_dym INTEGER NOT NULL DEFAULT 0,
        w_kwota REAL NOT NULL DEFAULT 0,
        ${sync}
      );
      CREATE INDEX IF NOT EXISTS grupy_data ON grupy (data);
      CREATE TABLE IF NOT EXISTS gracze (
        id TEXT PRIMARY KEY NOT NULL,
        grupa_id TEXT NOT NULL,
        imie TEXT NOT NULL,
        notatka TEXT NOT NULL DEFAULT '',
        kolejnosc INTEGER NOT NULL DEFAULT 0,
        pakiet_nazwa TEXT,
        pakiet_kulki INTEGER,
        pakiet_cena REAL,
        sprzet TEXT,
        worki_ilosc INTEGER,
        worki_szt INTEGER,
        worki_cena REAL,
        ${sync}
      );
      CREATE INDEX IF NOT EXISTS gracze_grupa ON gracze (grupa_id);
      CREATE TABLE IF NOT EXISTS pozycje (
        id TEXT PRIMARY KEY NOT NULL,
        gracz_id TEXT NOT NULL,
        rodzaj TEXT NOT NULL,
        dokupione INTEGER NOT NULL DEFAULT 0,
        ilosc INTEGER NOT NULL DEFAULT 0,
        kwota REAL,
        nazwa TEXT,
        kolejnosc INTEGER NOT NULL DEFAULT 0,
        ${sync}
      );
      CREATE INDEX IF NOT EXISTS pozycje_gracz ON pozycje (gracz_id);
      CREATE TABLE IF NOT EXISTS dodatki (
        id TEXT PRIMARY KEY NOT NULL,
        grupa_id TEXT NOT NULL,
        nazwa TEXT NOT NULL,
        kwota REAL NOT NULL DEFAULT 0,
        kolejnosc INTEGER NOT NULL DEFAULT 0,
        ${sync}
      );
      CREATE INDEX IF NOT EXISTS dodatki_grupa ON dodatki (grupa_id);
      CREATE TABLE IF NOT EXISTS faktury (
        grupa_id TEXT PRIMARY KEY NOT NULL,
        nip TEXT NOT NULL,
        tel TEXT NOT NULL,
        email TEXT NOT NULL,
        kwota REAL NOT NULL,
        platnosc TEXT NOT NULL,
        s_sms_wyslano TEXT, s_sms_blad TEXT,
        ${sync}
      );
      CREATE TABLE IF NOT EXISTS wydatki (
        id TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL,
        opis TEXT NOT NULL,
        kwota REAL NOT NULL DEFAULT 0,
        uwagi TEXT NOT NULL DEFAULT '',
        kolejnosc INTEGER NOT NULL DEFAULT 0,
        ${sync}
      );
      CREATE INDEX IF NOT EXISTS wydatki_data ON wydatki (data);
      CREATE TABLE IF NOT EXISTS pensje (
        id TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL,
        imie TEXT NOT NULL,
        prac_id TEXT NOT NULL DEFAULT '',
        godziny REAL NOT NULL DEFAULT 0,
        stawka REAL NOT NULL DEFAULT 0,
        kwota REAL NOT NULL DEFAULT 0,
        premia_stawka REAL NOT NULL DEFAULT 0,
        kolejnosc INTEGER NOT NULL DEFAULT 0,
        ${sync}
      );
      CREATE INDEX IF NOT EXISTS pensje_data ON pensje (data);

      -- Kolejka: klucz = 'tabela:id' — nowsza niewysłana zmiana tego samego wiersza zastępuje starszą.
      ALTER TABLE kolejka ADD COLUMN klucz TEXT;
      CREATE INDEX IF NOT EXISTS kolejka_klucz ON kolejka (klucz, wyslano);
      PRAGMA user_version = 2;
    `);
    });
    version = 2;
  }

  await db.execAsync(`PRAGMA user_version = ${version}`);
}
