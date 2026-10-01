/**
 * Tabele list na tablecie — te same kolumny co na serwerze (server/lib/tabele.php).
 * Zmieniając kolumnę tutaj, zmień ją też w migracji (nowa migracja!) i na serwerze.
 *
 * Każdy wiersz ma dodatkowo kolumny synchronizacji:
 *   zmieniono — ISO, kiedy zmieniono na tablecie (rozstrzyga, która wersja wygrywa)
 *   usunieto  — ISO albo null (kosz)
 *   rev       — numer zmiany z serwera (null = jeszcze nie wrócił z serwera)
 */

export type Kolumna = 'text' | 'int' | 'real' | 'bool' | 'json';

type OpisTabeli = { pk: string; kol: Record<string, Kolumna>; serwer?: Record<string, Kolumna> };

export const TABELE = {
  listy: {
    pk: 'data',
    kol: { data: 'text', uwagi: 'text' },
    // wypełnia serwer (statystyki) — tablet tylko czyta
    serwer: { s_stat_wyslano: 'text', s_stat_przez: 'text', s_stat_blad: 'text' },
  },
  instruktorzy: {
    pk: 'id',
    kol: { id: 'text', data: 'text', imie: 'text', kolejnosc: 'int' },
  },
  grupy: {
    pk: 'id',
    kol: {
      id: 'text', data: 'text', instruktor_id: 'text', godzina: 'text', utworzono: 'text',
      organizator: 'text', atrakcja: 'text',
      pakiet_nazwa: 'text', pakiet_typ: 'text', pakiet_kulki: 'int', pakiet_cena: 'real',
      pakiet_limit: 'int', pakiet_extra: 'real',
      kdod_ilosc: 'int', kdod_cena: 'real',
      gracze_reczne: 'int', kulki_reczne: 'int', kwota_reczna: 'real', zadatek: 'real', platnosc: 'text',
      w_gracze: 'int', w_kulki: 'int', w_kulki_dok: 'int', w_dym: 'int', w_kwota: 'real',
    },
  },
  gracze: {
    pk: 'id',
    kol: {
      id: 'text', grupa_id: 'text', imie: 'text', notatka: 'text', kolejnosc: 'int',
      pakiet_nazwa: 'text', pakiet_kulki: 'int', pakiet_cena: 'real',
      sprzet: 'json', worki_ilosc: 'int', worki_szt: 'int', worki_cena: 'real',
    },
  },
  pozycje: {
    pk: 'id',
    kol: {
      id: 'text', gracz_id: 'text', rodzaj: 'text', dokupione: 'bool', ilosc: 'int',
      kwota: 'real', nazwa: 'text', kolejnosc: 'int',
    },
  },
  dodatki: {
    pk: 'id',
    kol: { id: 'text', grupa_id: 'text', nazwa: 'text', kwota: 'real', kolejnosc: 'int' },
  },
  faktury: {
    pk: 'grupa_id',
    kol: { grupa_id: 'text', nip: 'text', tel: 'text', email: 'text', kwota: 'real', platnosc: 'text' },
    serwer: { s_sms_wyslano: 'text', s_sms_blad: 'text' },
  },
  wydatki: {
    pk: 'id',
    kol: { id: 'text', data: 'text', opis: 'text', kwota: 'real', uwagi: 'text', kolejnosc: 'int' },
  },
  pensje: {
    pk: 'id',
    kol: {
      id: 'text', data: 'text', imie: 'text', prac_id: 'text', godziny: 'real', stawka: 'real',
      kwota: 'real', premia_stawka: 'real', kolejnosc: 'int',
    },
  },
} as const satisfies Record<string, OpisTabeli>;

export type Tabela = keyof typeof TABELE;

/** Kolejność: najpierw rodzice (ważne przy wysyłce i pobieraniu). */
export const KOLEJNOSC_TABEL = Object.keys(TABELE) as Tabela[];

// ── Typy wierszy ─────────────────────────────────────────────

export type Sync = { zmieniono: string; usunieto: string | null; rev: number | null };

export type Lista = { data: string; uwagi: string | null } & Partial<{
  s_stat_wyslano: string | null;
  s_stat_przez: string | null;
  s_stat_blad: string | null;
}>;

export type Instruktor = { id: string; data: string; imie: string; kolejnosc: number };

export type PakietTyp = 'os' | 'grupa';
export type Platnosc = '' | 'Gotówka' | 'Karta' | 'Przelew';

export type Grupa = {
  id: string;
  data: string;
  instruktor_id: string | null;
  godzina: string;
  utworzono: string;
  organizator: string;
  atrakcja: string;
  pakiet_nazwa: string;
  pakiet_typ: PakietTyp;
  pakiet_kulki: number;
  pakiet_cena: number;
  pakiet_limit: number;
  pakiet_extra: number;
  kdod_ilosc: number | null;
  kdod_cena: number | null;
  gracze_reczne: number;
  kulki_reczne: number;
  kwota_reczna: number | null;
  zadatek: number;
  platnosc: Platnosc;
  w_gracze: number;
  w_kulki: number;
  w_kulki_dok: number;
  w_dym: number;
  w_kwota: number;
};

/** Własny sprzęt gracza: nazwa i cena z cennika (cenę można zmienić przy graczu); i = pozycja w cenniku, ikona do wyświetlenia. */
export type SprzetGracza = { nazwa: string; kwota: number; ikona?: string; i?: number };

export type Gracz = {
  id: string;
  grupa_id: string;
  imie: string;
  notatka: string;
  kolejnosc: number;
  pakiet_nazwa: string | null;
  pakiet_kulki: number | null;
  pakiet_cena: number | null;
  sprzet: SprzetGracza[] | null;
  worki_ilosc: number | null;
  worki_szt: number | null;
  worki_cena: number | null;
};

export type Pozycja = {
  id: string;
  gracz_id: string;
  rodzaj: 'kulki' | 'dym' | 'inne';
  dokupione: boolean;
  ilosc: number;
  kwota: number | null;
  nazwa: string | null;
  kolejnosc: number;
};

export type Dodatek = { id: string; grupa_id: string; nazwa: string; kwota: number; kolejnosc: number };

export type Faktura = {
  grupa_id: string;
  nip: string;
  tel: string;
  email: string;
  kwota: number;
  platnosc: Exclude<Platnosc, ''>;
} & Partial<{ s_sms_wyslano: string | null; s_sms_blad: string | null }>;

export type Wydatek = { id: string; data: string; opis: string; kwota: number; uwagi: string; kolejnosc: number };

export type Pensja = {
  id: string;
  data: string;
  imie: string;
  prac_id: string;
  godziny: number;
  stawka: number;
  kwota: number;
  premia_stawka: number;
  kolejnosc: number;
};

export type Rekordy = {
  listy: Lista;
  instruktorzy: Instruktor;
  grupy: Grupa;
  gracze: Gracz;
  pozycje: Pozycja;
  dodatki: Dodatek;
  faktury: Faktura;
  wydatki: Wydatek;
  pensje: Pensja;
};

/** Wiersz z bazy tabletu (z kolumnami synchronizacji). */
export type Wiersz<T extends Tabela> = Rekordy[T] & Sync;

// ── Zamiana wiersz SQLite ↔ obiekt ───────────────────────────

/** Wartość do zapisu w SQLite. */
export function doSqlite(typ: Kolumna, v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  switch (typ) {
    case 'bool':
      return v ? 1 : 0;
    case 'json':
      return JSON.stringify(v);
    case 'int':
      return Math.round(Number(v)) || 0;
    case 'real':
      return Math.round(Number(v) * 100) / 100 || 0;
    default:
      return String(v);
  }
}

/** Wartość odczytana z SQLite → typ z TS. */
export function zSqlite(typ: Kolumna, v: unknown): unknown {
  if (v === null || v === undefined) return null;
  switch (typ) {
    case 'bool':
      return v === 1 || v === true;
    case 'json':
      try {
        return JSON.parse(String(v));
      } catch {
        return null;
      }
    default:
      return v;
  }
}

/** Wszystkie kolumny tabeli (dane tabletu + kolumny serwera). */
export function kolumnyTabeli(t: Tabela): Record<string, Kolumna> {
  const opis: OpisTabeli = TABELE[t];
  return { ...opis.kol, ...(opis.serwer ?? {}) };
}

export function odczytajWiersz<T extends Tabela>(t: T, surowy: Record<string, unknown>): Wiersz<T> {
  const kol = kolumnyTabeli(t);
  const w: Record<string, unknown> = { ...surowy };
  for (const [k, typ] of Object.entries(kol)) w[k] = zSqlite(typ, surowy[k]);
  return w as unknown as Wiersz<T>;
}
