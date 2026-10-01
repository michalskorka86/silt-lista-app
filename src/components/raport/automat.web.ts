// W przeglądarce (tylko testy na komputerze) automatycznych PDF-ów nie ma.
import type { Baza } from '@/db/zapis';

export const KLUCZ_OSTATNI = 'pdf_ostatni';
export const nazwaFolderu = (uri: string) => uri;
export async function folderPdf(_db: Baza): Promise<{ uri: string; nazwa: string } | null> {
  return null;
}
export async function wybierzFolder(_db: Baza): Promise<string | null> {
  return null;
}
export async function zrobBrakujacePdf(_db: Baza): Promise<{ zrobione: string[]; bledy: string[] }> {
  return { zrobione: [], bledy: [] };
}
