/**
 * Automatyczne PDF-y dni (bez React Native — testy w Node).
 *
 * Zasada: dla każdej listy z poprzednich dni tablet ma mieć PDF w folderze miesiąca.
 * Wczorajsza lista czeka do 3:00 (do tej pory instruktorzy mogą jeszcze coś dopisać),
 * starsze — od razu (np. tablet był wyłączony w nocy). Gdy ktoś później zmieni starą listę,
 * PDF robi się na nowo (podpis treści się nie zgadza).
 */

import { getUstawienie, setUstawienie } from '../db/ustawienia';
import type { Baza } from '../db/zapis';
import { wczytajCennik } from './cennik';
import { dzisISO } from './format';
import { wczytajDzien } from './lista';
import { htmlRaportu } from './raport';
import { sha256 } from './sha256';

const MIESIACE = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];

/** Od której godziny robimy PDF wczorajszej listy. */
export const GODZINA_PDF = 3;
/** Ile dni wstecz pilnujemy PDF-ów (starsze listy zmienia się rzadko). */
export const DNI_WSTECZ_PDF = 45;

/** „2026-09 Wrzesień” */
export const folderMiesiaca = (data: string) => `${data.slice(0, 7)} ${MIESIACE[Number(data.slice(5, 7)) - 1]}`;
/** „2026-09-30 Lista.pdf” */
export const plikDnia = (data: string) => `${data} Lista.pdf`;

export type ZapisanyPdf = { podpis: string; znacznik: string; t: string; gdzie: string };
export type PdfDoZrobienia = { data: string; html: string; podpis: string; znacznik: string };

/** Szybki znacznik zmian dnia: najpóźniejsza zmiana czegokolwiek na liście (bez liczenia całego raportu). */
export async function znacznikDnia(db: Baza, data: string): Promise<string> {
  const w = await db.getFirstAsync<{ z: string | null }>(
    `SELECT MAX(z) AS z FROM (
       SELECT zmieniono AS z FROM listy WHERE data = ?1
       UNION ALL SELECT zmieniono FROM instruktorzy WHERE data = ?1
       UNION ALL SELECT zmieniono FROM grupy WHERE data = ?1
       UNION ALL SELECT zmieniono FROM wydatki WHERE data = ?1
       UNION ALL SELECT zmieniono FROM pensje WHERE data = ?1
       UNION ALL SELECT x.zmieniono FROM gracze x JOIN grupy g ON g.id = x.grupa_id WHERE g.data = ?1
       UNION ALL SELECT x.zmieniono FROM dodatki x JOIN grupy g ON g.id = x.grupa_id WHERE g.data = ?1
       UNION ALL SELECT x.zmieniono FROM faktury x JOIN grupy g ON g.id = x.grupa_id WHERE g.data = ?1
       UNION ALL SELECT p.zmieniono FROM pozycje p JOIN gracze x ON x.id = p.gracz_id JOIN grupy g ON g.id = x.grupa_id WHERE g.data = ?1
     )`,
    data,
  );
  return w?.z ?? '';
}

export async function wczytajZapisanyPdf(db: Baza, data: string): Promise<ZapisanyPdf | null> {
  try {
    return JSON.parse((await getUstawienie(db, `pdf:${data}`)) ?? 'null') as ZapisanyPdf | null;
  } catch {
    return null;
  }
}

export async function oznaczPdf(db: Baza, data: string, p: ZapisanyPdf): Promise<void> {
  await setUstawienie(db, `pdf:${data}`, JSON.stringify(p));
}

/** Pierwszy dzień, który już może mieć PDF (wczoraj po 3:00, inaczej przedwczoraj). */
export function ostatniDzienDoPdf(teraz: Date = new Date()): string {
  const d = new Date(teraz.getFullYear(), teraz.getMonth(), teraz.getDate() - (teraz.getHours() >= GODZINA_PDF ? 1 : 2));
  return dzisISO(d);
}

/** Dni, którym brakuje PDF-u albo których lista zmieniła się od ostatniego PDF-u (od najstarszego). */
export async function dniDoPdf(db: Baza, teraz: Date = new Date()): Promise<PdfDoZrobienia[]> {
  const do_ = ostatniDzienDoPdf(teraz);
  const od = dzisISO(new Date(teraz.getFullYear(), teraz.getMonth(), teraz.getDate() - DNI_WSTECZ_PDF));
  const daty = await db.getAllAsync<{ data: string }>(
    'SELECT data FROM listy WHERE usunieto IS NULL AND data >= ? AND data <= ? ORDER BY data',
    od,
    do_,
  );
  if (!daty.length) return [];
  let cennik: Awaited<ReturnType<typeof wczytajCennik>> | undefined;
  const out: PdfDoZrobienia[] = [];
  for (const { data } of daty) {
    const byl = await wczytajZapisanyPdf(db, data);
    const znacznik = await znacznikDnia(db, data);
    if (byl && byl.znacznik === znacznik) continue; // nic się nie zmieniło od ostatniego PDF-u
    const dzien = await wczytajDzien(db, data);
    if (cennik === undefined) cennik = await wczytajCennik(db);
    // podpis liczony bez godziny utworzenia (ta zmienia się przy każdym wydruku)
    const podpis = sha256(htmlRaportu(dzien, cennik, new Date(0)));
    if (byl?.podpis === podpis) {
      // zmiana bez wpływu na wydruk (np. tylko synchronizacja) — zapamiętujemy nowy znacznik
      await oznaczPdf(db, data, { ...byl, znacznik });
      continue;
    }
    out.push({ data, html: htmlRaportu(dzien, cennik, teraz), podpis, znacznik });
  }
  return out;
}
