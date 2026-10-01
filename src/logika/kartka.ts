/**
 * 📷 Gracze ze zdjęcia kartki (jak w v19): serwer czyta zdjęcie (Claude), tablet pokazuje tabelę do poprawienia,
 * a „Dodaj graczy ✓” dopisuje graczy z kulkami i dymem do grupy. Ten sam gracz (imię) — dopisuje mu pozycje.
 * Bez importów React Native (testy w Node).
 */

import { wczytajGdzie, type Baza } from '../db/zapis';
import type { Klient } from '../sync/klient';
import { dodajDym, dodajGracza, dodajKulki } from './lista';

export type OdczytGracza = { imie: string; kulki: number[]; dokupione: number[]; dym: number };
/** Wiersz tabeli do poprawienia (pola tekstowe jak w v19: „100 100”). */
export type WierszKartki = { imie: string; pak: string; dok: string; dym: string };

export const pustyWiersz = (): WierszKartki => ({ imie: '', pak: '', dok: '', dym: '' });

/** Wysyła zdjęcie (base64) na serwer i zwraca wiersze do sprawdzenia. Odczyt trwa zwykle 5–20 s. */
export async function odczytajKartke(klient: Klient, obraz: string, typ = 'image/jpeg'): Promise<WierszKartki[]> {
  const r = await klient<{ gracze: OdczytGracza[] }>('kartka', { body: { obraz, typ }, timeoutMs: 90000 });
  return (r.gracze ?? []).map((g) => ({
    imie: g.imie === '?' ? '' : (g.imie ?? ''),
    pak: (g.kulki ?? []).join(' '),
    dok: (g.dokupione ?? []).join(' '),
    dym: g.dym ? String(g.dym) : '',
  }));
}

/** „100 100, 200” → [100, 100, 200] */
export const liczbyZTekstu = (t: string): number[] =>
  (String(t ?? '').match(/\d+/g) ?? []).map(Number).filter((v) => v > 0 && v <= 100000);

/** Dopisuje graczy z tabeli do grupy. Zwraca ilu graczy dodano / uzupełniono. */
export async function dodajZKartki(db: Baza, grupaId: string, wiersze: WierszKartki[], dymCena: number): Promise<number> {
  const istniejacy = await wczytajGdzie(db, 'gracze', 'grupa_id = ?', [grupaId]);
  let n = 0;
  for (const w of wiersze) {
    const imie = w.imie.trim();
    if (!imie) continue;
    const ten = istniejacy.find((p) => p.imie.trim().toLowerCase() === imie.toLowerCase());
    const id = ten?.id ?? (await dodajGracza(db, grupaId, imie));
    for (const k of liczbyZTekstu(w.pak)) await dodajKulki(db, id, k, false);
    for (const k of liczbyZTekstu(w.dok)) await dodajKulki(db, id, k, true);
    const dym = Math.min(50, parseInt(w.dym, 10) || 0);
    if (dym > 0) await dodajDym(db, id, dym, dym * dymCena);
    n++;
  }
  return n;
}
