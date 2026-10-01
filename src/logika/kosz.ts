/**
 * 🗑️ Kosz: rzeczy usunięte w ostatnich 7 dniach — do przywrócenia jednym przyciskiem.
 * Usunięcie to tylko „usunieto = czas” (wiersz zostaje), więc przywrócenie = usunieto z powrotem na null,
 * przez przywroc() → kolejka → serwer (na innych tabletach też wraca).
 * Po 7 dniach tablet kasuje wiersze z kosza na dobre (serwer trzyma je 30 dni).
 * Bez importów React Native (testy w Node).
 */

import type { Tabela } from '../db/tabele';
import { powiadom, przeliczGrupe, przywroc, type Baza } from '../db/zapis';
import type { Cennik } from './cennik';
import { dataPL, plGrup, zl } from './format';

export const DNI_KOSZA = 7;
const DZIEN_MS = 86400000;
/** Rzeczy usunięte razem z listą / instruktorem (kasowane po kolei, chwilę wcześniej) wracają razem z nimi. */
const OKNO_MS = 2 * 60 * 1000;

export type RodzajKosza = 'lista' | 'instruktor' | 'grupa' | 'gracz' | 'wydatek' | 'pensja';
export type WpisKosza = {
  rodzaj: RodzajKosza;
  id: string;
  data: string; // dzień listy
  usunieto: string; // ISO
  ico: string;
  tytul: string;
  opis: string;
};

const granica = (teraz: Date, dni: number) => new Date(teraz.getTime() - dni * DZIEN_MS).toISOString();
const przed = (iso: string, ms: number) => new Date(Date.parse(iso) - ms).toISOString();

/** Kosz od najświeżej usuniętych. Pokazuje tylko „najwyższą” usuniętą rzecz (grupa w usuniętej liście wraca z listą). */
export async function wczytajKosz(db: Baza, cennik: Cennik | null, teraz: Date = new Date()): Promise<WpisKosza[]> {
  const od = granica(teraz, DNI_KOSZA);
  const out: WpisKosza[] = [];
  const atr = (k: string) => cennik?.atrakcje.find((a) => a.klucz === k)?.nazwa ?? k;

  for (const l of await db.getAllAsync<{ data: string; usunieto: string; n: number }>(
    `SELECT l.data, l.usunieto,
            (SELECT COUNT(*) FROM grupy g WHERE g.data = l.data
                AND g.usunieto >= strftime('%Y-%m-%dT%H:%M:%fZ', l.usunieto, '-120 seconds')) AS n
       FROM listy l WHERE l.usunieto >= ?`,
    od,
  ))
    out.push({ rodzaj: 'lista', id: l.data, data: l.data, usunieto: l.usunieto, ico: '📋', tytul: `Cała lista dnia ${dataPL(l.data)}`, opis: `${plGrup(l.n)}, wydatki i pensje` });

  for (const i of await db.getAllAsync<{ id: string; data: string; imie: string; usunieto: string }>(
    `SELECT i.id, i.data, i.imie, i.usunieto FROM instruktorzy i JOIN listy l ON l.data = i.data
      WHERE i.usunieto >= ? AND l.usunieto IS NULL`,
    od,
  ))
    out.push({ rodzaj: 'instruktor', id: i.id, data: i.data, usunieto: i.usunieto, ico: '👷', tytul: `Lista instruktora ${i.imie}`, opis: dataPL(i.data) });

  for (const g of await db.getAllAsync<{ id: string; data: string; atrakcja: string; organizator: string; w_kwota: number; imie: string | null; usunieto: string }>(
    `SELECT g.id, g.data, g.atrakcja, g.organizator, g.w_kwota, i.imie, g.usunieto
       FROM grupy g JOIN listy l ON l.data = g.data LEFT JOIN instruktorzy i ON i.id = g.instruktor_id
      WHERE g.usunieto >= ? AND l.usunieto IS NULL AND (i.id IS NULL OR i.usunieto IS NULL)`,
    od,
  ))
    out.push({
      rodzaj: 'grupa',
      id: g.id,
      data: g.data,
      usunieto: g.usunieto,
      ico: '👥',
      tytul: `Grupa ${atr(g.atrakcja)}${g.organizator ? ` — ${g.organizator}` : ''}`,
      opis: `${dataPL(g.data)}${g.imie ? ` · ${g.imie}` : ''}${g.w_kwota ? ` · ${zl(g.w_kwota)}` : ''}`,
    });

  for (const p of await db.getAllAsync<{ id: string; imie: string; data: string; organizator: string; usunieto: string }>(
    `SELECT p.id, p.imie, g.data, g.organizator, p.usunieto
       FROM gracze p JOIN grupy g ON g.id = p.grupa_id JOIN listy l ON l.data = g.data
      WHERE p.usunieto >= ? AND g.usunieto IS NULL AND l.usunieto IS NULL`,
    od,
  ))
    out.push({ rodzaj: 'gracz', id: p.id, data: p.data, usunieto: p.usunieto, ico: '👤', tytul: `Gracz ${p.imie}`, opis: `${dataPL(p.data)}${p.organizator ? ` · grupa ${p.organizator}` : ''}` });

  for (const w of await db.getAllAsync<{ id: string; data: string; opis: string; kwota: number; usunieto: string }>(
    'SELECT w.id, w.data, w.opis, w.kwota, w.usunieto FROM wydatki w JOIN listy l ON l.data = w.data WHERE w.usunieto >= ? AND l.usunieto IS NULL',
    od,
  ))
    out.push({ rodzaj: 'wydatek', id: w.id, data: w.data, usunieto: w.usunieto, ico: '🧾', tytul: `Wydatek ${w.opis} ${zl(w.kwota)}`, opis: dataPL(w.data) });

  for (const p of await db.getAllAsync<{ id: string; data: string; imie: string; kwota: number; usunieto: string }>(
    'SELECT p.id, p.data, p.imie, p.kwota, p.usunieto FROM pensje p JOIN listy l ON l.data = p.data WHERE p.usunieto >= ? AND l.usunieto IS NULL',
    od,
  ))
    out.push({ rodzaj: 'pensja', id: p.id, data: p.data, usunieto: p.usunieto, ico: '💰', tytul: `Pensja ${p.imie} ${zl(p.kwota)}`, opis: dataPL(p.data) });

  return out.sort((a, b) => b.usunieto.localeCompare(a.usunieto));
}

/** Ile dni zostało do skasowania na dobre (min. 0). */
export const dniDoKonca = (usunieto: string, teraz: Date = new Date()) =>
  Math.max(0, Math.ceil((Date.parse(usunieto) + DNI_KOSZA * DZIEN_MS - teraz.getTime()) / DZIEN_MS));

async function przywrocUsunieteOd(db: Baza, tabela: Tabela, pk: string, warunek: string, param: string, od: string) {
  const w = await db.getAllAsync<{ id: string }>(`SELECT ${pk} AS id FROM ${tabela} WHERE ${warunek} AND usunieto >= ?`, param, od);
  for (const x of w) await przywroc(db, tabela, x.id);
}

/** ↩ Przywraca wpis z kosza (razem z tym, co zostało usunięte w tej samej chwili). */
export async function przywrocZKosza(db: Baza, w: Pick<WpisKosza, 'rodzaj' | 'id' | 'usunieto'>): Promise<void> {
  const od = przed(w.usunieto, OKNO_MS);
  switch (w.rodzaj) {
    case 'lista':
      await przywroc(db, 'listy', w.id);
      await przywrocUsunieteOd(db, 'instruktorzy', 'id', 'data = ?', w.id, od);
      await przywrocUsunieteOd(db, 'grupy', 'id', 'data = ?', w.id, od);
      await przywrocUsunieteOd(db, 'wydatki', 'id', 'data = ?', w.id, od);
      await przywrocUsunieteOd(db, 'pensje', 'id', 'data = ?', w.id, od);
      break;
    case 'instruktor':
      await przywroc(db, 'instruktorzy', w.id);
      await przywrocUsunieteOd(db, 'grupy', 'id', 'instruktor_id = ?', w.id, od);
      break;
    case 'grupa':
      await przywroc(db, 'grupy', w.id);
      await przeliczGrupe(db, w.id);
      break;
    case 'gracz': {
      await przywroc(db, 'gracze', w.id);
      const g = await db.getFirstAsync<{ grupa_id: string }>('SELECT grupa_id FROM gracze WHERE id = ?', w.id);
      if (g) await przeliczGrupe(db, g.grupa_id);
      break;
    }
    case 'wydatek':
      await przywroc(db, 'wydatki', w.id);
      break;
    case 'pensja':
      await przywroc(db, 'pensje', w.id);
      break;
  }
}

/**
 * Kasuje na dobre (tylko na tablecie) to, co leży w koszu dłużej niż 7 dni — razem z zawartością usuniętych grup i graczy.
 * Pomija wiersze, których usunięcie jeszcze nie poszło na serwer.
 */
export async function oczyscKosz(db: Baza, teraz: Date = new Date()): Promise<number> {
  const g = granica(teraz, DNI_KOSZA);
  // usunięte dawno i usunięcie już wysłane na serwer
  const stare = (t: string, pk: string, alias = t) =>
    `${alias}.usunieto < '${g}' AND NOT EXISTS (SELECT 1 FROM kolejka k WHERE k.wyslano IS NULL AND k.klucz = '${t}:' || ${alias}.${pk})`;
  const grupy = `SELECT x.id FROM grupy x WHERE ${stare('grupy', 'id', 'x')}`;
  const gracze = `SELECT y.id FROM gracze y WHERE ${stare('gracze', 'id', 'y')} OR y.grupa_id IN (${grupy})`;
  let ile = 0;
  const kasuj = async (sql: string) => {
    const r = await db.runAsync(sql);
    ile += (r as { changes?: number }).changes ?? 0;
  };
  // najpierw zawartość (póki wiadomo, do czego należy), potem same usunięte wiersze
  await kasuj(`DELETE FROM pozycje WHERE gracz_id IN (${gracze}) OR (${stare('pozycje', 'id')})`);
  await kasuj(`DELETE FROM dodatki WHERE grupa_id IN (${grupy}) OR (${stare('dodatki', 'id')})`);
  await kasuj(`DELETE FROM faktury WHERE grupa_id IN (${grupy}) OR (${stare('faktury', 'grupa_id')})`);
  await kasuj(`DELETE FROM gracze WHERE id IN (${gracze})`);
  for (const [t, pk] of [
    ['grupy', 'id'],
    ['wydatki', 'id'],
    ['pensje', 'id'],
    ['instruktorzy', 'id'],
    ['listy', 'data'],
  ])
    await kasuj(`DELETE FROM ${t} WHERE ${stare(t, pk)}`);
  if (ile) for (const t of ['listy', 'grupy'] as const) powiadom(t);
  return ile;
}
