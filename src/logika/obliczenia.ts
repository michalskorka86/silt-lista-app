/**
 * Obliczenia grupy — przeniesione 1:1 z calc() w v19 (index.php), na danych z bazy tabletu.
 * Wynik trafia do kolumn w_… grupy; serwer, Statystyki i SMS biorą te liczby bez przeliczania.
 *
 * Plik bez importów aplikacji (tylko typy), żeby dało się go testować w Node (testy/obliczenia.test.ts).
 */

import type { Dodatek, Gracz, Grupa, Pozycja } from '../db/tabele';

export type GraczZPozycjami = Gracz & { pozycje: Pozycja[] };

export type WynikGrupy = {
  kP: number; // kulki z pakietu (przy graczach)
  kD: number; // kulki dokupione
  kG: number; // kulki dla całej grupy (bez imion)
  kW: number; // kulki z worków (własny sprzęt)
  workiKw: number;
  nWl: number; // gracze z własnym sprzętem
  dymN: number;
  dymKw: number;
  inneKw: number;
  sprzetKw: number;
  nP: number; // gracze z imionami
  gracze: number; // liczba osób (max z ręcznej i z imion)
  kulki: number; // wszystkie kulki
  base: number; // podstawa (pakiety)
  dodKw: number; // kulki dokupione — kwota
  dodatkiKw: number;
  auto: number; // kwota policzona automatycznie
  kwota: number; // kwota grupy (ręczna albo auto)
  zad: number;
  doZap: number;
};

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

export const maSprzet = (g: Gracz): boolean => !!(g.sprzet && g.sprzet.length);

/** Pakiet gracza: własny (inny niż grupy) albo pakiet grupy. */
export function pakietGracza(grupa: Grupa, g: Gracz): { nazwa: string; kulki: number; cena: number } {
  if (g.pakiet_cena !== null && g.pakiet_cena !== undefined) {
    return { nazwa: g.pakiet_nazwa ?? '', kulki: g.pakiet_kulki ?? 0, cena: g.pakiet_cena };
  }
  return { nazwa: grupa.pakiet_nazwa, kulki: grupa.pakiet_kulki, cena: grupa.pakiet_cena };
}

export function policzGrupe(grupa: Grupa, gracze: GraczZPozycjami[], dodatki: Dodatek[]): WynikGrupy {
  let kP = 0, kD = 0, dymN = 0, dymKw = 0, inneKw = 0;
  for (const p of gracze) {
    for (const it of p.pozycje) {
      if (it.rodzaj === 'kulki') {
        if (it.dokupione) kD += num(it.ilosc);
        else kP += num(it.ilosc);
      } else if (it.rodzaj === 'dym') {
        dymN += num(it.ilosc);
        dymKw += num(it.kwota);
      } else {
        inneKw += num(it.kwota);
      }
    }
  }

  const worki = (p: Gracz) => (p.worki_ilosc ? { n: num(p.worki_ilosc), szt: num(p.worki_szt), cena: num(p.worki_cena) } : null);

  const nP = gracze.length;
  const liczbaOsob = Math.max(num(grupa.gracze_reczne), nP);
  const kG = num(grupa.kulki_reczne);
  const kW = gracze.reduce((s, p) => { const w = worki(p); return s + (w ? w.n * w.szt : 0); }, 0);
  const kulki = kP + kD + kG + kW;

  let base = 0;
  const nWl = gracze.filter(maSprzet).length; // gracze z własnym sprzętem — bez podstawy
  if (grupa.pakiet_typ === 'grupa') {
    base = num(grupa.pakiet_cena) + (grupa.pakiet_limit ? Math.max(0, liczbaOsob - nWl - grupa.pakiet_limit) * num(grupa.pakiet_extra) : 0);
  } else {
    base =
      gracze.reduce((s, p) => s + (maSprzet(p) ? 0 : num(pakietGracza(grupa, p).cena)), 0) +
      Math.max(0, liczbaOsob - nP) * num(grupa.pakiet_cena);
  }

  const sprzetKw = gracze.reduce((s, p) => s + (p.sprzet ?? []).reduce((a, x) => a + num(x.kwota), 0), 0);
  const workiKw = gracze.reduce((s, p) => { const w = worki(p); return s + (w ? w.n * w.cena : 0); }, 0);
  const dodKw = grupa.kdod_ilosc ? Math.round((kD / grupa.kdod_ilosc) * num(grupa.kdod_cena) * 100) / 100 : 0;
  const dodatkiKw = dodatki.reduce((s, d) => s + num(d.kwota), 0);
  const auto = base + dodKw + dymKw + inneKw + dodatkiKw + sprzetKw + workiKw;
  const kwota = grupa.kwota_reczna !== null && grupa.kwota_reczna !== undefined ? num(grupa.kwota_reczna) : auto;
  const zad = num(grupa.zadatek);

  return {
    kP, kD, kG, kW, workiKw, nWl, dymN, dymKw, inneKw, sprzetKw, nP,
    gracze: liczbaOsob, kulki, base, dodKw, dodatkiKw, auto, kwota, zad, doZap: kwota - zad,
  };
}

/** Kolumny w_… do zapisania w grupie. */
export function wynikiDoGrupy(w: WynikGrupy): Pick<Grupa, 'w_gracze' | 'w_kulki' | 'w_kulki_dok' | 'w_dym' | 'w_kwota'> {
  return {
    w_gracze: w.gracze,
    w_kulki: w.kulki,
    w_kulki_dok: w.kD,
    w_dym: w.dymN,
    w_kwota: Math.round(w.kwota * 100) / 100,
  };
}

/** Pensje zaokrąglamy do pełnych dziesiątek, od 5 w górę: 225 → 230, 224 → 220 (jak v19). */
export const round10 = (v: number): number => Math.round((+v || 0) / 10 + 1e-9) * 10;
