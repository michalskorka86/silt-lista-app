/**
 * Przechwytywanie awarii aplikacji → zgłoszenie na tablecie (wyśle się przy synchronizacji).
 * Działa też poza Reactem (globalny „łapacz” błędów JS), dlatego ma własne połączenie z bazą.
 */

import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

import { DB_NAME } from '@/db/migrations';
import { opisBledu, zapiszBlad } from '@/logika/bledy';

let ekran = '';
/** Ekran, na którym jest użytkownik (trafia do zgłoszenia). */
export const ustawEkran = (e: string) => {
  ekran = e;
};

let baza: Promise<SQLite.SQLiteDatabase> | null = null;
const db = () => (baza ??= SQLite.openDatabaseAsync(DB_NAME));

/** Zapisuje zgłoszenie (nigdy nie rzuca — zgłaszanie błędu nie może samo zepsuć aplikacji). */
export async function zglos(e: unknown, opcje: { ekran?: string; dopisek?: string } = {}): Promise<void> {
  try {
    const o = opisBledu(e);
    await zapiszBlad(await db(), {
      ekran: opcje.ekran ?? ekran,
      komunikat: opcje.dopisek ? `${opcje.dopisek}: ${o.komunikat}` : o.komunikat,
      stos: o.stos,
    });
  } catch {
    /* trudno */
  }
}

/** „📨 Zgłoś problem” — opis od instruktora. */
export async function zglosProblem(tekst: string): Promise<void> {
  await zapiszBlad(await db(), { ekran, komunikat: `Zgłoszenie: ${tekst.trim()}`.slice(0, 500) });
}

type Lapacz = (e: unknown, krytyczny?: boolean) => void;
type ErrorUtilsT = { getGlobalHandler(): Lapacz; setGlobalHandler(h: Lapacz): void };

let zainstalowano = false;
/** Globalny łapacz błędów JS: zapisuje zgłoszenie (max 0,8 s), potem oddaje błąd dalej jak zwykle. */
export function zainstalujLapacz(): void {
  const eu = (globalThis as { ErrorUtils?: ErrorUtilsT }).ErrorUtils;
  if (zainstalowano || Platform.OS === 'web' || !eu) return;
  zainstalowano = true;
  const poprzedni = eu.getGlobalHandler();
  eu.setGlobalHandler((e, krytyczny) => {
    const czekaj = new Promise((r) => setTimeout(r, 800));
    Promise.race([zglos(e, { dopisek: krytyczny ? 'Awaria' : 'Błąd' }), czekaj]).finally(() => poprzedni(e, krytyczny));
  });
}
