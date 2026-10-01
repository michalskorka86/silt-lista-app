/**
 * Synchronizacja tabletu z serwerem Listy.
 *
 *   1) start      — czy wersja aplikacji jest aktualna, czy jest nowy cennik
 *   2) wysyłka    — kolejka zmian z tabletu (po 100, w kolejności zapisu)
 *   3) pobieranie — zmiany z serwera od ostatniego rev (stan statystyk / SMS, przywracanie na nowym tablecie)
 *
 * Każdy krok przerwany brakiem zasięgu niczego nie psuje: kolejka zostaje, następna próba zaczyna od nowa.
 * Bez importów React Native — test w Node: testy/synchronizacja.test.ts.
 */

import { getUstawienie, setUstawienie } from '../db/ustawienia';
import { doSqlite, kolumnyTabeli, KOLEJNOSC_TABEL, TABELE, type Tabela } from '../db/tabele';
import { liczNiewyslane, nowyId, powiadom, teraz, transakcja, type Baza } from '../db/zapis';
import { wyslijBledy } from '../logika/bledy';
import { wczytajCennik, zapiszCennik, type Cennik } from '../logika/cennik';
import { odswiezRezerwacjeWTle } from '../logika/rezerwacje';
import { sha256 } from '../logika/sha256';
import { BladPolaczenia, BladSerwera, type Klient } from './klient';

export type StanSynchronizacji = {
  /** ok = wszystko wysłane; offline = brak zasięgu (dane bezpieczne na tablecie) */
  stan: 'ok' | 'offline' | 'blad' | 'zaloguj' | 'aktualizacja';
  niewyslane: number;
  odrzucone: number; // zmiany, których serwer nie przyjął (złe dane) — do pokazania w Opcjach
  ostatnio: string | null; // ostatnia udana synchronizacja (ISO)
  komunikat?: string;
};

const PACZKA = 100;
const PRACOWNICY_CO_MS = 6 * 3600 * 1000;

// ── Logowanie ─────────────────────────────────────────────────

export async function idTabletu(db: Baza): Promise<string> {
  let id = await getUstawienie(db, 'tablet_id');
  if (!id) {
    id = nowyId('t');
    await setUstawienie(db, 'tablet_id', id);
  }
  return id;
}

export const tokenTabletu = (db: Baza) => getUstawienie(db, 'token');

/** Skrót hasła zapamiętany na tablecie (samo hasło nie jest zapisywane). */
const skrotHasla = (haslo: string, tabletId: string) => sha256(`silt-lista|${tabletId}|${haslo}`);

/** Hasło → token tabletu. Rzuca BladSerwera('zle_haslo' | 'blokada') albo BladPolaczenia. */
export async function zaloguj(db: Baza, klient: Klient, haslo: string, model: string, wersja: string): Promise<void> {
  const tabletId = await idTabletu(db);
  const r = await klient<{ token: string }>('zaloguj', {
    body: { haslo, tablet_id: tabletId, model, wersja },
  });
  await setUstawienie(db, 'token', r.token);
  await setUstawienie(db, 'haslo_skrot', skrotHasla(haslo, tabletId));
}

/**
 * Sprawdza hasło aplikacji (to samo co przy logowaniu tabletu) — np. przed usunięciem listy.
 * Działa bez zasięgu, jeśli tablet logował się w tej wersji aplikacji (zna skrót hasła).
 * Tablet bez zapamiętanego skrótu sprawdza hasło na serwerze (i od razu go zapamiętuje).
 */
export async function sprawdzHaslo(
  db: Baza,
  klient: Klient,
  haslo: string,
  model: string,
  wersja: string,
): Promise<'ok' | 'zle' | 'offline' | 'blokada'> {
  const skrot = await getUstawienie(db, 'haslo_skrot');
  if (skrot) return skrot === skrotHasla(haslo, await idTabletu(db)) ? 'ok' : 'zle';
  try {
    await zaloguj(db, klient, haslo, model, wersja);
    return 'ok';
  } catch (e) {
    if (e instanceof BladSerwera) return e.kod === 'blokada' ? 'blokada' : 'zle';
    return 'offline';
  }
}

/** PIN admina ustawiony na serwerze (config.php)? Tablet zna tylko jego skrót — sprawdza bez zasięgu. */
export async function jestPinAdmina(db: Baza): Promise<boolean> {
  return !!(await getUstawienie(db, 'pin_skrot'));
}

export async function sprawdzPin(db: Baza, pin: string): Promise<boolean> {
  const skrot = await getUstawienie(db, 'pin_skrot');
  return !!skrot && skrot === sha256(`silt-lista-pin|${await idTabletu(db)}|${pin}`);
}

export async function wyloguj(db: Baza, klient: Klient): Promise<void> {
  try {
    await klient('wyloguj', { body: {} });
  } catch {
    /* bez zasięgu też wylogowujemy tablet lokalnie */
  }
  await setUstawienie(db, 'token', null);
  await setUstawienie(db, 'haslo_skrot', null);
  await setUstawienie(db, 'pin_skrot', null);
}

// ── Wysyłka kolejki ───────────────────────────────────────────

type WierszKolejki = { id: number; dane: string };
type WynikZmiany = { id: string; wynik: 'zapisano' | 'starsza' | 'odrzucono' | 'czeka' | 'blad'; msg?: string };

/** Wysyła całą kolejkę (zmiany „starsza” zaktualizuje pobieranie, które idzie zaraz potem). */
async function wyslijKolejke(db: Baza, klient: Klient): Promise<void> {
  // Dwa przejścia: zmiana „czeka” (np. gracz przed swoją grupą) dostaje drugą szansę w tej samej synchronizacji.
  for (let przejscie = 0; przejscie < 2; przejscie++) {
    let kursor = 0;
    let czekaja = 0;
    for (;;) {
      const wiersze = await db.getAllAsync<WierszKolejki>(
        'SELECT id, dane FROM kolejka WHERE wyslano IS NULL AND id > ? ORDER BY id LIMIT ?',
        kursor,
        PACZKA,
      );
      if (!wiersze.length) break;
      kursor = wiersze[wiersze.length - 1].id;

      const zmiany = wiersze.map((w) => ({ id: `k${w.id}`, ...JSON.parse(w.dane) }));
      const r = await klient<{ wyniki: WynikZmiany[] }>('wyslij', { body: { zmiany } });

      const kiedy = teraz();
      await transakcja(db, async (tx) => {
        for (const w of r.wyniki) {
          const id = parseInt(w.id.slice(1), 10);
          if (w.wynik === 'zapisano' || w.wynik === 'starsza') {
            await tx.runAsync('UPDATE kolejka SET wyslano = ?, blad = NULL WHERE id = ?', kiedy, id);
          } else if (w.wynik === 'odrzucono') {
            // Złe dane — ponowienie nic nie da. Oznaczamy jako załatwione, z powodem (widać w Opcjach).
            await tx.runAsync('UPDATE kolejka SET wyslano = ?, blad = ? WHERE id = ?', kiedy, w.msg ?? 'odrzucono', id);
          } else {
            czekaja++;
            await tx.runAsync('UPDATE kolejka SET proby = proby + 1, blad = ? WHERE id = ?', w.msg ?? w.wynik, id);
          }
        }
      });
    }
    if (!czekaja) break;
  }
}

// ── Pobieranie ────────────────────────────────────────────────

type OdpowiedzPobierz = { do_rev: number; wiecej: boolean; dane: Partial<Record<Tabela, Record<string, unknown>[]>> };

async function pobierzZmiany(db: Baza, klient: Klient): Promise<void> {
  let od = parseInt((await getUstawienie(db, 'rev')) ?? '0', 10) || 0;
  let zmieniono = false;
  for (let strona = 0; strona < 500; strona++) {
    const r = await klient<OdpowiedzPobierz>('pobierz', { params: { od_rev: od } });
    await transakcja(db, async (tx) => {
      for (const tabela of KOLEJNOSC_TABEL) {
        for (const w of r.dane[tabela] ?? []) {
          if (await zastosujWiersz(tx, tabela, w)) zmieniono = true;
        }
      }
      await tx.runAsync(
        'INSERT INTO ustawienia (klucz, wartosc) VALUES (?, ?) ON CONFLICT(klucz) DO UPDATE SET wartosc = excluded.wartosc',
        'rev',
        String(r.do_rev),
      );
    });
    od = r.do_rev;
    if (!r.wiecej) break;
  }
  if (zmieniono) powiadom('serwer');
}

/** Wiersz z serwera → baza tabletu. Pomija wiersze z niewysłaną zmianą na tablecie (tablet jest nowszy). */
async function zastosujWiersz(tx: Baza, tabela: Tabela, w: Record<string, unknown>): Promise<boolean> {
  const pk = TABELE[tabela].pk;
  const klucz = `${tabela}:${String(w[pk])}`;
  const czeka = await tx.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM kolejka WHERE klucz = ? AND wyslano IS NULL',
    klucz,
  );
  if (czeka && czeka.n > 0) return false;

  const kol = kolumnyTabeli(tabela);
  const nazwy = [...Object.keys(kol), 'zmieniono', 'usunieto', 'rev'];
  const wartosci = [
    ...Object.entries(kol).map(([k, typ]) => doSqlite(typ, w[k])),
    String(w.zmieniono ?? teraz()),
    w.usunieto ? String(w.usunieto) : null,
    typeof w.rev === 'number' ? w.rev : null,
  ];
  const ustaw = nazwy.filter((k) => k !== pk).map((k) => `${k} = excluded.${k}`).join(', ');
  await tx.runAsync(
    `INSERT INTO ${tabela} (${nazwy.join(', ')}) VALUES (${nazwy.map(() => '?').join(', ')})
     ON CONFLICT(${pk}) DO UPDATE SET ${ustaw}`,
    ...wartosci,
  );
  return true;
}

// ── Cennik i pracownicy ───────────────────────────────────────

async function odswiezCennik(db: Baza, klient: Klient, wersjaNaSerwerze: number): Promise<void> {
  const mam = await wczytajCennik(db);
  if (mam && mam.wersja >= wersjaNaSerwerze) return;
  const c = await klient<Cennik & { ok: boolean }>('cennik');
  const { ok: _ok, ...cennik } = c;
  await zapiszCennik(db, cennik);
  powiadom('serwer');
}

export type Pracownik = { id: string; imie: string; stawka: number; premia: number };

async function odswiezPracownikow(db: Baza, klient: Klient): Promise<void> {
  const kiedy = await getUstawienie(db, 'pracownicy_kiedy');
  if (kiedy && Date.now() - Date.parse(kiedy) < PRACOWNICY_CO_MS) return;
  try {
    const r = await klient<{ pracownicy: Pracownik[] }>('pracownicy');
    await setUstawienie(db, 'pracownicy', JSON.stringify(r.pracownicy));
    await setUstawienie(db, 'pracownicy_kiedy', teraz());
    powiadom('serwer');
  } catch (e) {
    if (e instanceof BladPolaczenia) throw e;
    /* Statystyki nie odpowiadają — zostaje ostatnia lista; pensję można wpisać ręcznie */
  }
}

export async function wczytajPracownikow(db: Baza): Promise<Pracownik[]> {
  try {
    return JSON.parse((await getUstawienie(db, 'pracownicy')) ?? '[]') as Pracownik[];
  } catch {
    return [];
  }
}

// ── Całość ────────────────────────────────────────────────────

let trwa: Promise<StanSynchronizacji> | null = null;

/** Pełna synchronizacja. Równoległe wywołania dostają ten sam wynik (nie wysyłamy dwa razy). */
export function synchronizuj(db: Baza, klient: Klient): Promise<StanSynchronizacji> {
  if (!trwa) {
    trwa = synchronizujRaz(db, klient).finally(() => {
      trwa = null;
    });
  }
  return trwa;
}

async function stan(db: Baza, s: StanSynchronizacji['stan'], komunikat?: string): Promise<StanSynchronizacji> {
  const odrzucone = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM kolejka WHERE wyslano IS NOT NULL AND blad IS NOT NULL AND wyslano > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 days')",
  );
  return {
    stan: s,
    niewyslane: await liczNiewyslane(db),
    odrzucone: odrzucone?.n ?? 0,
    ostatnio: await getUstawienie(db, 'sync_ostatnio'),
    komunikat,
  };
}

async function synchronizujRaz(db: Baza, klient: Klient): Promise<StanSynchronizacji> {
  if (!(await tokenTabletu(db))) return stan(db, 'zaloguj');
  try {
    const s = await klient<{ aktualizacja: boolean; min_wersja: string; cennik_wersja: number; pin_skrot?: string | null }>('start');
    if (s.pin_skrot !== undefined) await setUstawienie(db, 'pin_skrot', s.pin_skrot);
    if (s.aktualizacja) {
      return stan(db, 'aktualizacja', `Zaktualizuj aplikację (wymagana wersja ${s.min_wersja}). Dane czekają bezpiecznie na tablecie.`);
    }
    await odswiezCennik(db, klient, s.cennik_wersja);
    await wyslijKolejke(db, klient);
    try {
      await wyslijBledy(db, klient);
    } catch (e) {
      if (e instanceof BladPolaczenia) throw e;
      // zgłoszenie odrzucone przez serwer — nie blokuje synchronizacji list
    }
    await pobierzZmiany(db, klient);
    await odswiezPracownikow(db, klient);
    try {
      await odswiezRezerwacjeWTle(db, klient);
    } catch (e) {
      if (e instanceof BladPolaczenia) throw e;
      /* podgląd rezerwacji nieskonfigurowany / serwer rezerwacji nie odpowiada — lista działa dalej */
    }
    await setUstawienie(db, 'sync_ostatnio', teraz());
    // stare, wysłane wpisy kolejki nie są potrzebne
    await db.runAsync("DELETE FROM kolejka WHERE wyslano IS NOT NULL AND wyslano < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')");
    return stan(db, 'ok');
  } catch (e) {
    if (e instanceof BladPolaczenia) return stan(db, 'offline', 'Brak połączenia — dane są zapisane na tablecie i wyślą się same');
    if (e instanceof BladSerwera) {
      if (e.kod === 'zaloguj') {
        await setUstawienie(db, 'token', null);
        await setUstawienie(db, 'haslo_skrot', null);
        return stan(db, 'zaloguj', e.message);
      }
      if (e.kod === 'aktualizacja') return stan(db, 'aktualizacja', e.message);
      return stan(db, 'blad', e.message);
    }
    return stan(db, 'blad', e instanceof Error ? e.message : String(e));
  }
}

/**
 * „📤 Wyślij statystyki do bazy” (jak v19): najpierw wysyła zmiany z tabletu, potem prosi serwer
 * o wysłanie dnia do Statystyk, na koniec pobiera stan („wysłane o …”).
 * Zwraca komunikat dla instruktora; rzuca Error z czytelnym opisem, gdy się nie da.
 */
export async function wyslijStatystyki(db: Baza, klient: Klient, data: string, wymus: boolean): Promise<string> {
  const s1 = await synchronizuj(db, klient);
  if (s1.stan === 'offline') throw new Error('Brak internetu — statystyki wyślą się same o 6:00 albo spróbuj przy zasięgu.');
  if (s1.stan !== 'ok') throw new Error(s1.komunikat ?? 'Nie udało się połączyć z serwerem.');
  if (s1.niewyslane > 0) throw new Error('Nie wszystkie zmiany dotarły na serwer — spróbuj za chwilę.');
  let msg: string;
  try {
    const r = await klient<{ msg: string }>('statystyki', { body: { data, wymus } });
    msg = r.msg;
  } catch (e) {
    if (e instanceof BladPolaczenia) throw new Error('Brak internetu — statystyki wyślą się same o 6:00.');
    throw new Error(e instanceof Error ? e.message : String(e));
  }
  await synchronizuj(db, klient);
  return msg;
}
