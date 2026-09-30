import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Migracje bazy na tablecie. Wersja trzymana w PRAGMA user_version.
 * Zasada: NIGDY nie zmieniamy starej migracji — zawsze dopisujemy nową (kolejny `if`).
 * Tabele list (grupy, gracze, kulki, wydatki, pensje…) dojdą w kolejnej migracji,
 * razem ze schematem bazy Listy na serwerze (plan: etap 1).
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

  await db.execAsync(`PRAGMA user_version = ${version}`);
}
