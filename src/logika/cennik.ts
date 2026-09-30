/**
 * Cennik z serwera (akcja=cennik) — atrakcje, pakiety, własny sprzęt, dodatki, dym, worek.
 * Zapisany w ustawieniach tabletu, więc działa bez zasięgu. Zmiana ceny na serwerze
 * = nowy cennik na tablecie przy najbliższym połączeniu, bez aktualizacji aplikacji.
 */

import { getUstawienie, setUstawienie } from '../db/ustawienia';
import type { Baza } from '../db/zapis';

export type Pakiet = {
  id: number;
  nazwa: string;
  kulki: number;
  cena: number;
  typ: 'os' | 'grupa';
  limit: number;
  extra: number;
};

export type Atrakcja = {
  klucz: string;
  nazwa: string;
  podpis: string;
  stat: string;
  kolor: string;
  kdod: { ilosc: number; cena: number } | null;
  opcje_pakiet: number[];
  opcje_dok: number[];
  pakiety: Pakiet[];
};

export type Cennik = {
  wersja: number;
  atrakcje: Atrakcja[];
  sprzet: { nazwa: string; cena: number; ikona: string }[];
  dodatki: { glowne: { nazwa: string; ikona: string }[]; wiecej: { nazwa: string; ikona: string }[] };
  dym_cena: number;
  worek: { szt: number; cena: number };
};

const KLUCZ = 'cennik';

export async function wczytajCennik(db: Baza): Promise<Cennik | null> {
  const s = await getUstawienie(db, KLUCZ);
  if (!s) return null;
  try {
    return JSON.parse(s) as Cennik;
  } catch {
    return null;
  }
}

export async function zapiszCennik(db: Baza, c: Cennik): Promise<void> {
  await setUstawienie(db, KLUCZ, JSON.stringify(c));
}

export const atrakcja = (c: Cennik | null, klucz: string): Atrakcja | undefined => c?.atrakcje.find((a) => a.klucz === klucz);
