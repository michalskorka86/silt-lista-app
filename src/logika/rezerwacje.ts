/**
 * Podgląd rezerwacji (SILT / Arsenał) — jak w v19: dane przychodzą z systemu rezerwacji przez serwer listy
 * i zapisują się na tablecie (miesiąc = jeden wpis), więc bez zasięgu widać ostatnio pobrany stan.
 * Bez importów React Native (testy w Node).
 */

import { getUstawienie, setUstawienie } from '../db/ustawienia';
import type { Baza } from '../db/zapis';
import type { Klient } from '../sync/klient';

export type Rezerwacja = {
  id: number;
  data: string;
  od: string;
  do: string;
  osoby: number;
  klient: string;
  atrakcja: string;
  kolor: string;
  marka: string; // 'silt' | 'arsenal'
  lok: string;
  uwagi: string;
  instrukcje: string;
  dodatki: string[];
  potw: boolean;
  zadatek: boolean;
};

export type MiesiacRezerwacji = { t: string; rezerwacje: Rezerwacja[]; atrakcje: { nazwa: string; kolor: string }[] };

/** „2026-10” */
export const ym = (rok: number, mies0: number) => `${rok}-${String(mies0 + 1).padStart(2, '0')}`;

export async function wczytajMiesiac(db: Baza, klucz: string): Promise<MiesiacRezerwacji | null> {
  try {
    return JSON.parse((await getUstawienie(db, `rez:${klucz}`)) ?? 'null') as MiesiacRezerwacji | null;
  } catch {
    return null;
  }
}

/** Pobiera miesiąc z serwera i zapisuje na tablecie. Rzuca błąd klienta (brak zasięgu, brak konfiguracji). */
export async function pobierzMiesiac(db: Baza, klient: Klient, rok: number, mies0: number): Promise<MiesiacRezerwacji> {
  const od = `${ym(rok, mies0)}-01`;
  const ost = new Date(rok, mies0 + 1, 0).getDate();
  const doD = `${ym(rok, mies0)}-${String(ost).padStart(2, '0')}`;
  const r = await klient<{ rezerwacje: Rezerwacja[]; atrakcje: { nazwa: string; kolor: string }[] }>('rezerwacje', {
    params: { od, do: doD },
  });
  const m: MiesiacRezerwacji = { t: new Date().toISOString(), rezerwacje: r.rezerwacje ?? [], atrakcje: r.atrakcje ?? [] };
  await setUstawienie(db, `rez:${ym(rok, mies0)}`, JSON.stringify(m));
  return m;
}

const CO_MS = 30 * 60 * 1000;

/** W tle (przy synchronizacji, co 30 min): bieżący i następny miesiąc — żeby podgląd działał na poligonie bez zasięgu. */
export async function odswiezRezerwacjeWTle(db: Baza, klient: Klient): Promise<void> {
  const kiedy = await getUstawienie(db, 'rez_kiedy');
  if (kiedy && Date.now() - Date.parse(kiedy) < CO_MS) return;
  const d = new Date();
  await pobierzMiesiac(db, klient, d.getFullYear(), d.getMonth());
  const n = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  await pobierzMiesiac(db, klient, n.getFullYear(), n.getMonth());
  await setUstawienie(db, 'rez_kiedy', new Date().toISOString());
}
