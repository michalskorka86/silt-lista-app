/**
 * Zapis na tablecie. KAŻDA zmiana listy idzie przez zapisz()/usun():
 *   1) wiersz trafia do SQLite (od razu — nic nie ginie po restarcie ani rozładowaniu),
 *   2) w tej samej transakcji trafia do kolejki wysyłki na serwer.
 * Nowsza niewysłana zmiana tego samego wiersza zastępuje starszą w kolejce
 * (sto kliknięć „+100 kulek” bez zasięgu = jedna zmiana grupy do wysłania).
 *
 * Bez importów React Native — działa też w testach w Node (testy/synchronizacja.test.ts).
 */

import { policzGrupe, wynikiDoGrupy } from '../logika/obliczenia';
import {
  doSqlite,
  kolumnyTabeli,
  odczytajWiersz,
  TABELE,
  type Dodatek,
  type Gracz,
  type Grupa,
  type Kolumna,
  type Pozycja,
  type Rekordy,
  type Tabela,
  type Wiersz,
} from './tabele';

/** To, czego używamy z bazy expo-sqlite (SQLiteDatabase spełnia ten typ). */
export type Parametr = string | number | null;
export interface Baza {
  runAsync(sql: string, ...params: Parametr[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...params: Parametr[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: Parametr[]): Promise<T | null>;
  execAsync(sql: string): Promise<void>;
  withExclusiveTransactionAsync(task: (tx: Baza) => Promise<void>): Promise<void>;
  withTransactionAsync?(task: () => Promise<void>): Promise<void>;
}

// Transakcje idą JEDNA PO DRUGIEJ (kolejka w JS) na głównym połączeniu z bazą.
// Wcześniej każda transakcja wyłączna otwierała osobne połączenie — gdy aplikacja przeładowała się
// (aktualizacja) w trakcie takiej transakcji, blokada zapisu zostawała do restartu tabletu.
let ostatnia: Promise<void> = Promise.resolve();
let aktywne = 0;
let wstrzymane = false;

const pauza = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Transakcja: wszystko albo nic. Kolejne czekają na poprzednią. */
export async function transakcja(db: Baza, task: (tx: Baza) => Promise<void>): Promise<void> {
  const poprzednia = ostatnia;
  let zwolnij!: () => void;
  ostatnia = new Promise<void>((r) => (zwolnij = r));
  try {
    await poprzednia;
    while (wstrzymane) await pauza(200); // trwa przeładowanie aplikacji — nie zaczynamy nowego zapisu
    aktywne++;
    try {
      if (db.withTransactionAsync) await db.withTransactionAsync(() => task(db));
      else await db.withExclusiveTransactionAsync(task);
    } finally {
      aktywne--;
    }
  } finally {
    zwolnij();
  }
}

/**
 * Przed przeładowaniem aplikacji (aktualizacja): wstrzymuje nowe transakcje i czeka, aż skończą się trwające.
 * Zwraca false, gdy w `maxMs` się nie udało (wtedy NIE przeładowujemy — wznowZapisy()).
 */
export async function wstrzymajZapisy(maxMs = 15000): Promise<boolean> {
  wstrzymane = true;
  const koniec = Date.now() + maxMs;
  while (aktywne > 0 && Date.now() < koniec) await pauza(100);
  return aktywne === 0;
}
export function wznowZapisy(): void {
  wstrzymane = false;
}

// ── Powiadomienia o zmianach (odświeżanie ekranów, start wysyłki) ─────────

type Sluchacz = (tabela: Tabela | 'serwer') => void;
const sluchacze = new Set<Sluchacz>();
export function nasluchujZmian(s: Sluchacz): () => void {
  sluchacze.add(s);
  return () => sluchacze.delete(s);
}
export function powiadom(tabela: Tabela | 'serwer') {
  for (const s of sluchacze) {
    try {
      s(tabela);
    } catch {
      /* słuchacz nie może zepsuć zapisu */
    }
  }
}

// ── Id i czas ─────────────────────────────────────────────────

/** Id nadawane na tablecie: czas + losowe znaki (np. „g-m1x8k2p4-q9w3e7r1”). Max 40 znaków. */
export function nowyId(prefiks: string): string {
  let los = '';
  for (let i = 0; i < 8; i++) los += Math.floor(Math.random() * 36).toString(36);
  return `${prefiks}-${Date.now().toString(36)}-${los}`;
}

export const teraz = (): string => new Date().toISOString();

// ── Zapis ─────────────────────────────────────────────────────

function kluczWiersza(tabela: Tabela, rekord: Record<string, unknown>): string {
  return `${tabela}:${String(rekord[TABELE[tabela].pk])}`;
}

/** Tylko kolumny, które wysyłamy na serwer (bez s_…, rev, zmieniono…). */
function rekordDoWyslania(tabela: Tabela, rekord: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(TABELE[tabela].kol)) out[k] = rekord[k] ?? null;
  return out;
}

async function zapiszWTransakcji(
  tx: Baza,
  tabela: Tabela,
  rekord: Record<string, unknown>,
  usunieto: string | null,
  kiedy: string,
) {
  const kol = TABELE[tabela].kol as Record<string, Kolumna>;
  const nazwy = Object.keys(kol);
  const wartosci = nazwy.map((k) => doSqlite(kol[k], rekord[k]));
  const pk = TABELE[tabela].pk;
  const wszystkie = [...nazwy, 'zmieniono', 'usunieto'];
  const ustaw = wszystkie.filter((k) => k !== pk).map((k) => `${k} = excluded.${k}`).join(', ');
  await tx.runAsync(
    `INSERT INTO ${tabela} (${wszystkie.join(', ')}) VALUES (${wszystkie.map(() => '?').join(', ')})
     ON CONFLICT(${pk}) DO UPDATE SET ${ustaw}`,
    ...wartosci,
    kiedy,
    usunieto,
  );

  const klucz = kluczWiersza(tabela, rekord);
  await tx.runAsync('DELETE FROM kolejka WHERE klucz = ? AND wyslano IS NULL', klucz);
  await tx.runAsync(
    'INSERT INTO kolejka (typ, klucz, dane) VALUES (?, ?, ?)',
    tabela,
    klucz,
    JSON.stringify({ tabela, rekord: rekordDoWyslania(tabela, rekord), zmieniono: kiedy, usunieto }),
  );
}

/** Zapisuje wiersz (nowy albo zmieniony) i dopisuje go do kolejki wysyłki. */
export async function zapisz<T extends Tabela>(db: Baza, tabela: T, rekord: Rekordy[T]): Promise<void> {
  await zapiszWiele(db, [[tabela, rekord]]);
}

/** Kilka zapisów w jednej transakcji (np. nowa grupa + organizator jako pierwszy gracz). */
export async function zapiszWiele(db: Baza, zmiany: [Tabela, Rekordy[Tabela]][]): Promise<void> {
  const kiedy = teraz();
  await transakcja(db, async (tx) => {
    for (const [tabela, rekord] of zmiany) {
      await zapiszWTransakcji(tx, tabela, rekord as unknown as Record<string, unknown>, null, kiedy);
    }
  });
  for (const t of new Set(zmiany.map(([t]) => t))) powiadom(t);
}

/** Do kosza (usunieto = teraz) albo z kosza (przywroc). */
async function ustawKosz(db: Baza, tabela: Tabela, id: string, doKosza: boolean) {
  const w = await wczytaj(db, tabela, id);
  if (!w) return;
  const kiedy = teraz();
  await transakcja(db, async (tx) => {
    await zapiszWTransakcji(tx, tabela, w as unknown as Record<string, unknown>, doKosza ? kiedy : null, kiedy);
  });
  powiadom(tabela);
}

export const usun = (db: Baza, tabela: Tabela, id: string) => ustawKosz(db, tabela, id, true);
export const przywroc = (db: Baza, tabela: Tabela, id: string) => ustawKosz(db, tabela, id, false);

// ── Odczyt ────────────────────────────────────────────────────

export async function wczytaj<T extends Tabela>(db: Baza, tabela: T, id: string): Promise<Wiersz<T> | null> {
  const w = await db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM ${tabela} WHERE ${TABELE[tabela].pk} = ?`, id);
  return w ? odczytajWiersz(tabela, w) : null;
}

/** Wiersze tabeli spełniające warunek (bez kosza, chyba że zKoszem). */
export async function wczytajGdzie<T extends Tabela>(
  db: Baza,
  tabela: T,
  warunek: string,
  params: Parametr[],
  opcje: { zKoszem?: boolean; kolejnosc?: string } = {},
): Promise<Wiersz<T>[]> {
  const sql =
    `SELECT * FROM ${tabela} WHERE (${warunek})` +
    (opcje.zKoszem ? '' : ' AND usunieto IS NULL') +
    (opcje.kolejnosc ? ` ORDER BY ${opcje.kolejnosc}` : '');
  const w = await db.getAllAsync<Record<string, unknown>>(sql, ...params);
  return w.map((x) => odczytajWiersz(tabela, x));
}

// ── Przeliczenie grupy ────────────────────────────────────────

/**
 * Liczy kwotę i sumy grupy (jak v19) i zapisuje w_…, gdy się zmieniły.
 * Wołać po każdej zmianie graczy, pozycji, dodatków albo pól grupy.
 */
export async function przeliczGrupe(db: Baza, grupaId: string): Promise<Wiersz<'grupy'> | null> {
  const grupa = await wczytaj(db, 'grupy', grupaId);
  if (!grupa) return null;
  const gracze: Wiersz<'gracze'>[] = await wczytajGdzie(db, 'gracze', 'grupa_id = ?', [grupaId], { kolejnosc: 'kolejnosc, zmieniono' });
  const pozycje: Wiersz<'pozycje'>[] = gracze.length
    ? await wczytajGdzie(db, 'pozycje', `gracz_id IN (${gracze.map(() => '?').join(',')})`, gracze.map((g) => g.id))
    : [];
  const dodatki: Wiersz<'dodatki'>[] = await wczytajGdzie(db, 'dodatki', 'grupa_id = ?', [grupaId]);

  const wynik = policzGrupe(
    grupa as Grupa,
    gracze.map((g) => ({ ...(g as Gracz), pozycje: pozycje.filter((p) => p.gracz_id === g.id) as Pozycja[] })),
    dodatki as Dodatek[],
  );
  const w = wynikiDoGrupy(wynik);
  const zmiana = (Object.keys(w) as (keyof typeof w)[]).some((k) => grupa[k] !== w[k]);
  if (zmiana) {
    const nowa = { ...grupa, ...w };
    await zapisz(db, 'grupy', nowa);
    return nowa;
  }
  return grupa;
}

// ── Kolejka ───────────────────────────────────────────────────

/** Liczba zmian czekających na internet („⏳ Niewysłane”). */
export async function liczNiewyslane(db: Baza): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM kolejka WHERE wyslano IS NULL');
  return row?.n ?? 0;
}

export { kolumnyTabeli };
