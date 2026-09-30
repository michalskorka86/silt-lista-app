import type { Baza } from './zapis';

/** Ustawienia aplikacji (motyw, token tabletu, id tabletu, ostatni rev, cennik…). */
export async function getUstawienie(db: Baza, klucz: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ wartosc: string | null }>('SELECT wartosc FROM ustawienia WHERE klucz = ?', klucz);
  return row?.wartosc ?? null;
}

export async function setUstawienie(db: Baza, klucz: string, wartosc: string | null) {
  await db.runAsync(
    'INSERT INTO ustawienia (klucz, wartosc) VALUES (?, ?) ON CONFLICT(klucz) DO UPDATE SET wartosc = excluded.wartosc',
    klucz,
    wartosc,
  );
}
