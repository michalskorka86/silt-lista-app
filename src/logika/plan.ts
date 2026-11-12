/**
 * Plan dnia (rozpiska dla instruktorów): co spakować, które grupy przyjadą, kto przyszedł.
 * Plan wpisuje Michał na stronie lista-api/plan.php; tablet go pobiera, odhacza „przyszła / nie przyszła”
 * i „spakowane”, a z PIN-em admina może poprawić grupy i liczby.
 * Bez importów React Native (testy w Node).
 */
import type { Grupa, Pakowanie, PlanDzien, PlanGrupa, StatusPlanu, Wiersz } from '../db/tabele';
import { nowyId, usun, wczytaj, wczytajGdzie, zapisz, type Baza } from '../db/zapis';
import { zmienGrupe } from './lista';

export type GrupaPlanu = PlanGrupa & {
  status: StatusPlanu;
  grupa_id: string | null;
  /** grupa z planu jest już na liście (dodana kafelkiem) */
  naLiscie: boolean;
  /** instruktor, na którego liście jest grupa */
  instruktor: string | null;
};

export type Plan = {
  data: string;
  dzien: Wiersz<'plan_dni'> | null;
  grupy: GrupaPlanu[];
  /** klucze odhaczonych pozycji „Do spakowania” */
  spakowane: Set<string>;
};

/** Grupa „załatwiona” (przyszła, jest na liście albo nie przyjechała) — w planie robi się ciemniejsza. */
export const zalatwiona = (g: GrupaPlanu) => g.naLiscie || g.status === 'przyszla' || g.status === 'nie';

export async function wczytajPlan(db: Baza, data: string): Promise<Plan> {
  const dzien = await wczytaj(db, 'plan_dni', data);
  const grupy = await wczytajGdzie(db, 'plan_grupy', 'data = ?', [data], { kolejnosc: 'kolejnosc, godzina, id' });
  const stany = await wczytajGdzie(db, 'plan_stan', 'data = ?', [data]);
  const naLiscie = await db.getAllAsync<{ id: string; imie: string | null }>(
    `SELECT g.id, i.imie FROM grupy g LEFT JOIN instruktorzy i ON i.id = g.instruktor_id
     WHERE g.data = ? AND g.usunieto IS NULL`,
    data,
  );
  const instr = new Map(naLiscie.map((x) => [x.id, x.imie]));
  const odh = await wczytajGdzie(db, 'plan_odhaczenia', 'data = ? AND zrobione = 1', [data]);
  return {
    data,
    dzien: dzien && !dzien.usunieto ? dzien : null,
    grupy: grupy.map((g) => {
      const s = stany.find((x) => x.plan_id === g.id);
      const gid = s?.grupa_id ?? null;
      const jest = !!gid && instr.has(gid);
      return { ...g, status: s?.status ?? '', grupa_id: gid, naLiscie: jest, instruktor: jest ? (instr.get(gid!) ?? null) : null };
    }),
    spakowane: new Set(odh.map((o) => o.klucz)),
  };
}

/** Daty z planem (od dziś) — kropki w kalendarzu planu. */
export async function datyPlanu(db: Baza, od: string): Promise<string[]> {
  const w = await db.getAllAsync<{ data: string }>(
    'SELECT DISTINCT data FROM plan_grupy WHERE usunieto IS NULL AND data >= ? ORDER BY data',
    od,
  );
  return w.map((x) => x.data);
}

// ── Odhaczanie ────────────────────────────────────────────────

/** ✅ przyszła / ❌ nie przyszła / '' cofnij. Przy cofnięciu zostaje powiązanie z grupą na liście. */
export async function ustawStatusPlanu(db: Baza, g: Pick<PlanGrupa, 'id' | 'data'>, status: StatusPlanu, grupaId?: string | null) {
  const s = await wczytaj(db, 'plan_stan', g.id);
  await zapisz(db, 'plan_stan', {
    plan_id: g.id,
    data: g.data,
    status,
    grupa_id: grupaId !== undefined ? grupaId : (s?.grupa_id ?? null),
  });
}

/** Krótki, stały skrót tekstu (klucz pozycji „do zabrania”, gdy w nazwie są polskie znaki i spacje). */
function skrot(t: string): string {
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Rzeczy „do zabrania” z tekstu planu („ŚMIESZNE STROJE / ŚWIECE DYMNE …” albo każda w nowej linii). */
export function rzeczyDoZabrania(tekst: string): { klucz: string; nazwa: string }[] {
  const out: { klucz: string; nazwa: string }[] = [];
  for (const cz of tekst.split(/[/\n;]+/)) {
    const nazwa = cz.trim();
    if (!nazwa) continue;
    const klucz = 'z-' + skrot(nazwa.toLocaleLowerCase('pl-PL'));
    if (!out.some((x) => x.klucz === klucz)) out.push({ klucz, nazwa });
  }
  return out;
}

/** Odhacz / odznacz pozycję „Do spakowania” (każda pozycja osobnym wierszem). */
export async function odhacz(db: Baza, data: string, klucz: string, zrobione: boolean) {
  await zapisz(db, 'plan_odhaczenia', { id: `po-${data}-${klucz}`.slice(0, 40), data, klucz, zrobione });
}

// ── Grupa z planu → grupa na liście ───────────────────────────

/** „JERZY NOWAK” → „Jerzy Nowak” (rozpiska bywa pisana wielkimi literami); inne zostają jak są. */
export function ladneImie(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ');
  if (t !== t.toLocaleUpperCase('pl-PL') || t === t.toLocaleLowerCase('pl-PL')) return t;
  return t
    .toLocaleLowerCase('pl-PL')
    .replace(/(^|[\s-])(\p{L})/gu, (_, a: string, b: string) => a + b.toLocaleUpperCase('pl-PL'));
}

/** Kafelki przy „Dodaj grupę”: grupy z planu, których jeszcze nie ma na liście (i które nie odpadły). */
export const kafelkiPlanu = (plan: Plan | null) => (plan?.grupy ?? []).filter((g) => !g.naLiscie && g.status !== 'nie');

/** Po dodaniu grupy z kafelka: ilość osób z planu + odhaczenie „przyszła” z powiązaniem do grupy. */
export async function polaczZPlanem(db: Baza, g: PlanGrupa, grupaId: string, zmiany: Partial<Grupa> = {}) {
  const osoby = Math.max(0, Math.round(g.osoby || 0));
  if (osoby > 0 || Object.keys(zmiany).length) await zmienGrupe(db, grupaId, { ...(osoby > 0 ? { gracze_reczne: osoby } : {}), ...zmiany });
  await ustawStatusPlanu(db, g, 'przyszla', grupaId);
}

// ── Poprawki planu na tablecie (z PIN-em admina) ──────────────

export type PolaGrupyPlanu = Pick<PlanGrupa, 'godzina' | 'organizator' | 'atrakcja' | 'uwagi' | 'osoby' | 'zadatek'>;

export async function zapiszGrupePlanu(db: Baza, data: string, pola: PolaGrupyPlanu, id?: string): Promise<string> {
  const stara = id ? await wczytaj(db, 'plan_grupy', id) : null;
  let kolejnosc = stara?.kolejnosc ?? 0;
  if (!stara) {
    const r = await db.getFirstAsync<{ k: number | null }>('SELECT MAX(kolejnosc) AS k FROM plan_grupy WHERE data = ? AND usunieto IS NULL', data);
    kolejnosc = (r?.k ?? -1) + 1;
  }
  const nowe = stara?.id ?? nowyId('p');
  await zapisz(db, 'plan_grupy', {
    id: nowe,
    data,
    kolejnosc,
    godzina: pola.godzina.trim().slice(0, 20),
    organizator: pola.organizator.trim().slice(0, 80),
    atrakcja: pola.atrakcja,
    uwagi: pola.uwagi.trim().slice(0, 500),
    osoby: Math.max(0, Math.round(pola.osoby || 0)),
    zadatek: pola.zadatek.trim().slice(0, 20),
  });
  return nowe;
}

export const usunGrupePlanu = (db: Baza, id: string) => usun(db, 'plan_grupy', id);

export async function zapiszDzienPlanu(db: Baza, data: string, zmiany: Partial<Omit<PlanDzien, 'data'>>) {
  const d = await wczytaj(db, 'plan_dni', data);
  await zapisz(db, 'plan_dni', {
    data,
    pakowanie: d?.pakowanie ?? null,
    do_zabrania: d?.do_zabrania ?? '',
    uwagi: d?.uwagi ?? '',
    ...zmiany,
  });
}

/** Suma osób z planu (bez grup, które nie przyjechały) i sumy jak w rozpisce: PB = Klasyk + Sportowy, EM = Emek + Gotcha. */
export function sumyPlanu(grupy: GrupaPlanu[]) {
  const s = { osoby: 0, pb: 0, em: 0 };
  for (const g of grupy) {
    if (g.status === 'nie') continue;
    s.osoby += g.osoby;
    if (g.atrakcja === 'klasyk' || g.atrakcja === 'sportowy') s.pb += g.osoby;
    if (g.atrakcja === 'emek' || g.atrakcja === 'gotcha') s.em += g.osoby;
  }
  return s;
}

/** Pozycje „Do spakowania” z liczbami (kolejność jak w rozpisce). */
export const POZYCJE_PAKOWANIA: { klucz: keyof Omit<Pakowanie, 'naraz'>; ikona: string; nazwa: string; jedn: string }[] = [
  { klucz: 'pb_kartony', ikona: '📦', nazwa: 'Kulki 0,68 (PB)', jedn: 'kartonów' },
  { klucz: 'em_kartony', ikona: '📦', nazwa: 'Kulki EMEK', jedn: 'kartonów' },
  { klucz: 'maski_worki', ikona: '🥽', nazwa: 'Maski', jedn: 'worków' },
  { klucz: 'gotcha_worki', ikona: '🥽', nazwa: 'Maski Gotcha', jedn: 'worków' },
];
