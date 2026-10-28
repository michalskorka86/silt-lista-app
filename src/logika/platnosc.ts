/**
 * Forma płatności grupy i podział kwoty „do zapłaty na miejscu” na gotówkę / kartę / przelew.
 * „Mieszana” = część gotówką (platnosc_gotowka), reszta kartą albo przelewem (platnosc_reszta).
 */
import type { Platnosc } from '../db/tabele';
import { zl } from './format';

export const MIESZANA = 'Mieszana';

export type Podzial = { gotowka: number; karta: number; przelew: number; brak: number };

const zaokr = (v: number) => Math.round(v * 100) / 100;

export function podzialPlatnosci(
  platnosc: Platnosc | string,
  gotowkaMieszana: number | null | undefined,
  doZap: number,
  reszta?: string | null,
): Podzial {
  const d = zaokr(doZap);
  const p: Podzial = { gotowka: 0, karta: 0, przelew: 0, brak: 0 };
  if (platnosc === 'Gotówka') p.gotowka = d;
  else if (platnosc === 'Karta') p.karta = d;
  else if (platnosc === 'Przelew') p.przelew = d;
  else if (platnosc === MIESZANA) {
    p.gotowka = zaokr(Math.min(Math.max(Number(gotowkaMieszana) || 0, 0), Math.max(d, 0)));
    if (reszta === 'Przelew') p.przelew = zaokr(d - p.gotowka);
    else p.karta = zaokr(d - p.gotowka);
  } else p.brak = d;
  return p;
}

/** Czym zapłacono resztę przy płatności mieszanej. */
export const nazwaReszty = (reszta?: string | null) => (reszta === 'Przelew' ? 'Przelew' : 'Karta');

/** Tekst do karty grupy / raportu: „Gotówka”, „Gotówka 300 zł + Karta 200 zł”, „Gotówka 300 zł + Przelew 200 zł”, „—”. */
export function opisPlatnosci(platnosc: Platnosc | string, gotowkaMieszana: number | null | undefined, doZap: number, reszta?: string | null): string {
  if (platnosc === MIESZANA) {
    const p = podzialPlatnosci(platnosc, gotowkaMieszana, doZap, reszta);
    return `Gotówka ${zl(p.gotowka)} + ${nazwaReszty(reszta)} ${zl(reszta === 'Przelew' ? p.przelew : p.karta)}`;
  }
  return platnosc || '—';
}

export function sumaPodzialow(a: Podzial[]): Podzial {
  return a.reduce(
    (s, x) => ({
      gotowka: zaokr(s.gotowka + x.gotowka),
      karta: zaokr(s.karta + x.karta),
      przelew: zaokr(s.przelew + x.przelew),
      brak: zaokr(s.brak + x.brak),
    }),
    { gotowka: 0, karta: 0, przelew: 0, brak: 0 },
  );
}
