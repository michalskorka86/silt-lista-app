/**
 * Lista dnia: odczyt i wszystkie zmiany robione z ekranów (odpowiedniki funkcji z v19).
 * Każda zmiana idzie przez zapisz()/usun() (SQLite + kolejka) i — gdy dotyczy kwoty — przeliczGrupe().
 * Bez importów React Native (testy w Node: testy/lista.test.ts).
 */

import type { Faktura, Gracz, Grupa, Platnosc, Pozycja, Wiersz } from '../db/tabele';
import { nowyId, przeliczGrupe, teraz, usun, wczytaj, wczytajGdzie, zapisz, zapiszWiele, type Baza } from '../db/zapis';
import type { Atrakcja, Pakiet } from './cennik';
import { terazHM } from './format';
import { policzGrupe, type WynikGrupy } from './obliczenia';

// ── Odczyt dnia ───────────────────────────────────────────────

export type GraczPelny = Wiersz<'gracze'> & { pozycje: Wiersz<'pozycje'>[] };
export type GrupaPelna = Wiersz<'grupy'> & {
  gracze: GraczPelny[];
  dodatki: Wiersz<'dodatki'>[];
  faktura: Wiersz<'faktury'> | null;
  wynik: WynikGrupy;
};
export type Dzien = {
  data: string;
  lista: Wiersz<'listy'> | null;
  instruktorzy: Wiersz<'instruktorzy'>[];
  /** najnowsza na górze (jak v19) */
  grupy: GrupaPelna[];
};

const wLiscie = (ids: string[]) => ids.map(() => '?').join(',');

export async function wczytajDzien(db: Baza, data: string): Promise<Dzien> {
  const lista = await wczytaj(db, 'listy', data);
  const instruktorzy = await wczytajGdzie(db, 'instruktorzy', 'data = ?', [data], { kolejnosc: 'kolejnosc, zmieniono' });
  const grupy = await wczytajGdzie(db, 'grupy', 'data = ?', [data], { kolejnosc: 'utworzono DESC' });
  const gIds = grupy.map((g) => g.id);
  const gracze = gIds.length
    ? await wczytajGdzie(db, 'gracze', `grupa_id IN (${wLiscie(gIds)})`, gIds, { kolejnosc: 'kolejnosc, zmieniono' })
    : [];
  const pIds = gracze.map((p) => p.id);
  const pozycje = pIds.length
    ? await wczytajGdzie(db, 'pozycje', `gracz_id IN (${wLiscie(pIds)})`, pIds, { kolejnosc: 'kolejnosc, zmieniono' })
    : [];
  const dodatki = gIds.length
    ? await wczytajGdzie(db, 'dodatki', `grupa_id IN (${wLiscie(gIds)})`, gIds, { kolejnosc: 'kolejnosc, zmieniono' })
    : [];
  const faktury = gIds.length ? await wczytajGdzie(db, 'faktury', `grupa_id IN (${wLiscie(gIds)})`, gIds) : [];

  return {
    data,
    lista: lista && !lista.usunieto ? lista : null,
    instruktorzy,
    grupy: grupy.map((g) => {
      const gg: GraczPelny[] = gracze
        .filter((p) => p.grupa_id === g.id)
        .map((p) => ({ ...p, pozycje: pozycje.filter((i) => i.gracz_id === p.id) }));
      const dd = dodatki.filter((d) => d.grupa_id === g.id);
      return {
        ...g,
        gracze: gg,
        dodatki: dd,
        faktura: faktury.find((f) => f.grupa_id === g.id) ?? null,
        wynik: policzGrupe(g, gg, dd),
      };
    }),
  };
}

/** Daty, dla których na tablecie jest lista (archiwum, kropki w kalendarzu). */
export async function datyList(db: Baza): Promise<string[]> {
  const w = await db.getAllAsync<{ data: string }>('SELECT data FROM listy WHERE usunieto IS NULL ORDER BY data');
  return w.map((x) => x.data);
}

// ── Lista i instruktorzy (zakładki) ───────────────────────────

/**
 * „Utwórz listę →”: tworzy dzień (jeśli go nie ma) i — gdy podano imię — zakładkę instruktora.
 * Zwraca id zakładki instruktora (istniejącej o tym imieniu albo nowej).
 */
export async function utworzListe(db: Baza, data: string, imieInstruktora: string): Promise<string | null> {
  const zmiany: Parameters<typeof zapiszWiele>[1] = [];
  const lista = await wczytaj(db, 'listy', data);
  if (!lista || lista.usunieto) zmiany.push(['listy', { data, uwagi: lista?.uwagi ?? null }]);
  let instrId: string | null = null;
  const imie = imieInstruktora.trim();
  if (imie) {
    const istn = await znajdzInstruktora(db, data, imie);
    if (istn) instrId = istn.id;
    else {
      instrId = nowyId('t');
      zmiany.push(['instruktorzy', { id: instrId, data, imie, kolejnosc: await nastepnaKolejnosc(db, 'instruktorzy', 'data', data) }]);
    }
  }
  if (zmiany.length) await zapiszWiele(db, zmiany);
  return instrId;
}

async function znajdzInstruktora(db: Baza, data: string, imie: string) {
  const w = await wczytajGdzie(db, 'instruktorzy', 'data = ? AND lower(imie) = lower(?)', [data, imie]);
  return w[0] ?? null;
}

async function nastepnaKolejnosc(db: Baza, tabela: 'instruktorzy' | 'gracze' | 'pozycje' | 'dodatki' | 'wydatki' | 'pensje', kol: string, wart: string) {
  const r = await db.getFirstAsync<{ n: number | null }>(`SELECT MAX(kolejnosc) AS n FROM ${tabela} WHERE ${kol} = ?`, wart);
  return (r?.n ?? -1) + 1;
}

/** Zakładka instruktora (jak addTab w v19: to samo imię = ta sama zakładka). Zwraca jej id. */
export async function dodajInstruktora(db: Baza, data: string, imie: string): Promise<string> {
  return (await utworzListe(db, data, imie))!;
}

/** Usuwa zakładkę instruktora razem z jego grupami (do kosza). */
export async function usunInstruktora(db: Baza, instruktorId: string): Promise<void> {
  const i = await wczytaj(db, 'instruktorzy', instruktorId);
  if (!i) return;
  const grupy = await wczytajGdzie(db, 'grupy', 'instruktor_id = ?', [instruktorId]);
  for (const g of grupy) await usun(db, 'grupy', g.id);
  await usun(db, 'instruktorzy', instruktorId);
}

/** Usuwa całą listę dnia (zakładki, grupy, wydatki, pensje — do kosza). */
export async function usunListe(db: Baza, data: string): Promise<void> {
  for (const g of await wczytajGdzie(db, 'grupy', 'data = ?', [data])) await usun(db, 'grupy', g.id);
  for (const i of await wczytajGdzie(db, 'instruktorzy', 'data = ?', [data])) await usun(db, 'instruktorzy', i.id);
  for (const w of await wczytajGdzie(db, 'wydatki', 'data = ?', [data])) await usun(db, 'wydatki', w.id);
  for (const p of await wczytajGdzie(db, 'pensje', 'data = ?', [data])) await usun(db, 'pensje', p.id);
  await usun(db, 'listy', data);
}

// ── Grupy ─────────────────────────────────────────────────────

/** Nowa grupa (organizator → atrakcja → pakiet). Organizator od razu jako pierwszy gracz „org.”. */
export async function dodajGrupe(
  db: Baza,
  data: string,
  instruktorId: string,
  organizator: string,
  atrakcja: Atrakcja,
  pakiet: Pakiet,
): Promise<string> {
  const id = nowyId('g');
  const org = organizator.trim();
  const grupa: Grupa = {
    id,
    data,
    instruktor_id: instruktorId,
    godzina: terazHM(),
    utworzono: teraz(),
    organizator: org,
    atrakcja: atrakcja.klucz,
    pakiet_nazwa: pakiet.nazwa,
    pakiet_typ: pakiet.typ,
    pakiet_kulki: pakiet.kulki,
    pakiet_cena: pakiet.cena,
    pakiet_limit: pakiet.limit,
    pakiet_extra: pakiet.extra,
    kdod_ilosc: atrakcja.kdod?.ilosc ?? null,
    kdod_cena: atrakcja.kdod?.cena ?? null,
    gracze_reczne: 0,
    kulki_reczne: 0,
    kwota_reczna: null,
    zadatek: 0,
    platnosc: '',
    w_gracze: 0,
    w_kulki: 0,
    w_kulki_dok: 0,
    w_dym: 0,
    w_kwota: 0,
  };
  const zmiany: Parameters<typeof zapiszWiele>[1] = [['grupy', grupa]];
  if (org) zmiany.push(['gracze', nowyGracz(id, org, 'org.', 0)]);
  await zapiszWiele(db, zmiany);
  await przeliczGrupe(db, id);
  return id;
}

/** Zmiana pól grupy (osób, kulki bez imion, kwota ręczna, zadatek, płatność, podstawa…). */
export async function zmienGrupe(db: Baza, grupaId: string, zmiany: Partial<Grupa>): Promise<void> {
  const g = await wczytaj(db, 'grupy', grupaId);
  if (!g) return;
  await zapisz(db, 'grupy', { ...g, ...zmiany });
  await przeliczGrupe(db, grupaId);
}

export const ustawPlatnosc = (db: Baza, grupaId: string, platnosc: Platnosc) => zmienGrupe(db, grupaId, { platnosc });

export const usunGrupe = (db: Baza, grupaId: string) => usun(db, 'grupy', grupaId);

// ── Gracze ────────────────────────────────────────────────────

function nowyGracz(grupaId: string, imie: string, notatka: string, kolejnosc: number): Gracz {
  return {
    id: nowyId('p'),
    grupa_id: grupaId,
    imie,
    notatka,
    kolejnosc,
    pakiet_nazwa: null,
    pakiet_kulki: null,
    pakiet_cena: null,
    sprzet: null,
    worki_ilosc: null,
    worki_szt: null,
    worki_cena: null,
  };
}

export async function dodajGracza(db: Baza, grupaId: string, imie: string, notatka = ''): Promise<string> {
  const g = nowyGracz(grupaId, imie.trim(), notatka.trim(), await nastepnaKolejnosc(db, 'gracze', 'grupa_id', grupaId));
  await zapisz(db, 'gracze', g);
  await przeliczGrupe(db, grupaId);
  return g.id;
}

export async function zmienGracza(db: Baza, graczId: string, zmiany: Partial<Gracz>): Promise<void> {
  const p = await wczytaj(db, 'gracze', graczId);
  if (!p) return;
  await zapisz(db, 'gracze', { ...p, ...zmiany });
  await przeliczGrupe(db, p.grupa_id);
}

export async function usunGracza(db: Baza, graczId: string): Promise<void> {
  const p = await wczytaj(db, 'gracze', graczId);
  if (!p) return;
  await usun(db, 'gracze', graczId);
  await przeliczGrupe(db, p.grupa_id);
}

// ── Kulki / dym / inne przy graczu ────────────────────────────

async function dodajPozycje(db: Baza, graczId: string, poz: Omit<Pozycja, 'id' | 'gracz_id' | 'kolejnosc'>) {
  const p = await wczytaj(db, 'gracze', graczId);
  if (!p) return;
  await zapisz(db, 'pozycje', {
    id: nowyId('i'),
    gracz_id: graczId,
    kolejnosc: await nastepnaKolejnosc(db, 'pozycje', 'gracz_id', graczId),
    ...poz,
  });
  await przeliczGrupe(db, p.grupa_id);
}

export const dodajKulki = (db: Baza, graczId: string, ilosc: number, dokupione: boolean) =>
  dodajPozycje(db, graczId, { rodzaj: 'kulki', dokupione, ilosc: Math.round(ilosc), kwota: null, nazwa: null });

/** Dym: jak v19 — kolejne świece u tego samego gracza dopisują się do istniejącej pozycji. */
export async function dodajDym(db: Baza, graczId: string, ilosc: number, kwota: number): Promise<void> {
  if (ilosc <= 0) return;
  const istn = (await wczytajGdzie(db, 'pozycje', "gracz_id = ? AND rodzaj = 'dym'", [graczId]))[0];
  if (istn) {
    await zmienPozycje(db, istn.id, { ilosc: istn.ilosc + ilosc, kwota: (istn.kwota ?? 0) + kwota });
    return;
  }
  await dodajPozycje(db, graczId, { rodzaj: 'dym', dokupione: false, ilosc, kwota, nazwa: null });
}

export const dodajInne = (db: Baza, graczId: string, nazwa: string, kwota: number) =>
  dodajPozycje(db, graczId, { rodzaj: 'inne', dokupione: false, ilosc: 0, kwota, nazwa: nazwa.trim() });

export async function zmienPozycje(db: Baza, pozycjaId: string, zmiany: Partial<Pozycja>): Promise<void> {
  const poz = await wczytaj(db, 'pozycje', pozycjaId);
  if (!poz) return;
  await zapisz(db, 'pozycje', { ...poz, ...zmiany });
  const p = await wczytaj(db, 'gracze', poz.gracz_id);
  if (p) await przeliczGrupe(db, p.grupa_id);
}

export async function usunPozycje(db: Baza, pozycjaId: string): Promise<void> {
  const poz = await wczytaj(db, 'pozycje', pozycjaId);
  if (!poz) return;
  await usun(db, 'pozycje', pozycjaId);
  const p = await wczytaj(db, 'gracze', poz.gracz_id);
  if (p) await przeliczGrupe(db, p.grupa_id);
}

/** Pakiet gracza w użyciu: ile kulek z pakietu już wydano (jak playerPakietUsed w v19). */
export const kulkiZPakietu = (p: GraczPelny) =>
  p.pozycje.filter((i) => i.rodzaj === 'kulki' && !i.dokupione).reduce((s, i) => s + i.ilosc, 0);

/** „＋ worek” przy graczu z własnym sprzętem (jak addWorek w v19): kolejny worek w cenie z cennika lub ustalonej przy graczu. */
export async function dodajWorek(db: Baza, graczId: string, worek: { szt: number; cena: number }): Promise<void> {
  const p = await wczytaj(db, 'gracze', graczId);
  if (!p) return;
  if (p.worki_ilosc) await zmienGracza(db, graczId, { worki_ilosc: p.worki_ilosc + 1 });
  else await zmienGracza(db, graczId, { worki_ilosc: 1, worki_szt: worek.szt, worki_cena: worek.cena });
}

// ── Dodatki grupy ─────────────────────────────────────────────

export async function dodajDodatek(db: Baza, grupaId: string, nazwa: string, kwota: number): Promise<void> {
  await zapisz(db, 'dodatki', {
    id: nowyId('d'),
    grupa_id: grupaId,
    nazwa: nazwa.trim(),
    kwota,
    kolejnosc: await nastepnaKolejnosc(db, 'dodatki', 'grupa_id', grupaId),
  });
  await przeliczGrupe(db, grupaId);
}

export async function usunDodatek(db: Baza, dodatekId: string): Promise<void> {
  const d = await wczytaj(db, 'dodatki', dodatekId);
  if (!d) return;
  await usun(db, 'dodatki', dodatekId);
  await przeliczGrupe(db, d.grupa_id);
}

// ── Faktura ───────────────────────────────────────────────────

/** Dane do faktury grupy — SMS z nimi idzie z serwera o 6:00 następnego dnia. */
export async function zapiszFakture(db: Baza, f: Faktura): Promise<void> {
  await zapisz(db, 'faktury', {
    grupa_id: f.grupa_id,
    nip: f.nip.trim(),
    tel: f.tel.trim(),
    email: f.email.trim(),
    kwota: f.kwota,
    platnosc: f.platnosc,
  });
}

export const usunFakture = (db: Baza, grupaId: string) => usun(db, 'faktury', grupaId);
