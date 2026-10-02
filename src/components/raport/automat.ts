/**
 * Automatyczne PDF-y dni na tablecie (bez internetu):
 * folder wybrany raz w Opcjach (np. Dokumenty/SILT Lista) → podfoldery miesięcy → „2026-09-30 Lista.pdf”.
 * Pliki w wybranym folderze zostają po odinstalowaniu aplikacji.
 * Bez wybranego folderu PDF-y lądują w pamięci aplikacji (przeniosą się po wybraniu folderu).
 */

import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';

import { getUstawienie, setUstawienie } from '@/db/ustawienia';
import type { Baza } from '@/db/zapis';
import { dniDoPdf, folderMiesiaca, oznaczPdf, plikDnia } from '@/logika/pdfDni';

const KLUCZ_FOLDER = 'pdf_folder';
export const KLUCZ_OSTATNI = 'pdf_ostatni';

// A4 poziomo w punktach
const A4_POZIOMO = { width: 842, height: 595 };

/** Folder w pamięci aplikacji (gdy nie wybrano folderu na tablecie). */
const folderWewnetrzny = () => new Directory(Paths.document, 'PDF');

export async function folderPdf(db: Baza): Promise<{ uri: string; nazwa: string } | null> {
  const uri = await getUstawienie(db, KLUCZ_FOLDER);
  if (!uri) return null;
  return { uri, nazwa: nazwaFolderu(uri) };
}

/** „primary:Documents/SILT Lista” → „Documents/SILT Lista” */
export function nazwaFolderu(uri: string): string {
  const d = decodeURIComponent(uri.split('/tree/')[1] ?? uri);
  return d.replace(/^primary:/, '').replace(/\/document\/.*$/, '') || 'pamięć tabletu';
}

/** 📁 Wybór folderu (systemowe okno Androida). Zwraca nazwę albo null, gdy anulowano. */
export async function wybierzFolder(db: Baza): Promise<string | null> {
  let dir: Directory;
  try {
    dir = await Directory.pickDirectoryAsync();
  } catch {
    return null; // anulowano
  }
  await setUstawienie(db, KLUCZ_FOLDER, dir.uri);
  // nowy folder → PDF-y zrobią się w nim od nowa (stare zostają tam, gdzie były)
  await db.runAsync("DELETE FROM ustawienia WHERE klucz LIKE 'pdf:%'");
  return nazwaFolderu(dir.uri);
}

function podkatalog(rodzic: Directory, nazwa: string): Directory {
  const jest = rodzic.list().find((x): x is Directory => x instanceof Directory && x.name === nazwa);
  return jest ?? rodzic.createDirectory(nazwa);
}

/** Zapisuje PDF (z pliku tymczasowego) do folderu miesiąca, nadpisując starą wersję dnia. */
async function zapiszDoFolderu(db: Baza, data: string, tymczasowy: File): Promise<string> {
  const uri = await getUstawienie(db, KLUCZ_FOLDER);
  const glowny = uri ? new Directory(uri) : folderWewnetrzny();
  if (!uri && !glowny.exists) glowny.create({ intermediates: true, idempotent: true });
  const mies = podkatalog(glowny, folderMiesiaca(data));
  const nazwa = plikDnia(data);
  for (const x of mies.list()) if (x instanceof File && x.name === nazwa) x.delete();
  const cel = mies.createFile(nazwa, 'application/pdf');
  cel.write(await tymczasowy.bytes());
  return uri ? `${nazwaFolderu(uri)}/${folderMiesiaca(data)}` : 'pamięć aplikacji';
}

let trwa = false;

/**
 * Robi brakujące / nieaktualne PDF-y poprzednich dni. Bezpieczne do wołania często
 * (start aplikacji, powrót do aplikacji, zadanie w tle w nocy) — gdy nic się nie zmieniło, nic nie robi.
 */
export async function zrobBrakujacePdf(db: Baza): Promise<{ zrobione: string[]; bledy: string[] }> {
  const wynik = { zrobione: [] as string[], bledy: [] as string[] };
  if (trwa) return wynik;
  trwa = true;
  try {
    for (const d of await dniDoPdf(db)) {
      try {
        const { uri } = await Print.printToFileAsync({ html: d.html, ...A4_POZIOMO });
        const tmp = new File(uri);
        const gdzie = await zapiszDoFolderu(db, d.data, tmp);
        if (tmp.exists) tmp.delete();
        const t = new Date().toISOString();
        await oznaczPdf(db, d.data, { podpis: d.podpis, znacznik: d.znacznik, t, gdzie });
        await setUstawienie(db, KLUCZ_OSTATNI, JSON.stringify({ data: d.data, t, gdzie }));
        wynik.zrobione.push(d.data);
      } catch (e) {
        wynik.bledy.push(`${d.data}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } finally {
    trwa = false;
  }
  return wynik;
}
