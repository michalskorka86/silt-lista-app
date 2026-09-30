import type { SQLiteDatabase } from 'expo-sqlite';

export async function getUstawienie(db: SQLiteDatabase, klucz: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ wartosc: string | null }>(
    'SELECT wartosc FROM ustawienia WHERE klucz = ?',
    klucz,
  );
  return row?.wartosc ?? null;
}

export async function setUstawienie(db: SQLiteDatabase, klucz: string, wartosc: string | null) {
  await db.runAsync(
    'INSERT INTO ustawienia (klucz, wartosc) VALUES (?, ?) ON CONFLICT(klucz) DO UPDATE SET wartosc = excluded.wartosc',
    klucz,
    wartosc,
  );
}

/** Liczba zmian czekających na internet („⏳ Niewysłane”). */
export async function liczNiewyslane(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM kolejka WHERE wyslano IS NULL');
  return row?.n ?? 0;
}
