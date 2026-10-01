/// <reference types="node" />
// Synchronizacja tabletu z PRAWDZIWYM serwerem PHP (lokalnie, baza testowa, atrapy Statystyk i SMSAPI).
// Baza tabletu: SQLite w pamięci (node:sqlite) z tymi samymi migracjami co w aplikacji.
//
// Uruchamiane, gdy ustawione SILT_API (adres testowego api.php), np. w GitHub „Sprawdź kod”:
//   SILT_API=http://127.0.0.1:8765/api.php node --test --experimental-strip-types --no-warnings \
//     --import ./testy/rejestruj.mjs testy/synchronizacja.test.ts
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

import { migrateDbIfNeeded } from '../src/db/migrations';
import { BazaNode } from './baza-node';
import { przeliczGrupe, usun, wczytaj, wczytajGdzie, zapisz, zapiszWiele, type Baza } from '../src/db/zapis';
import { wczytajCennik } from '../src/logika/cennik';
import { przywrocZKosza, wczytajKosz } from '../src/logika/kosz';
import { ileBledowCzeka, zapiszBlad } from '../src/logika/bledy';
import { BladSerwera, utworzKlienta } from '../src/sync/klient';
import { jestPinAdmina, sprawdzHaslo, sprawdzPin, synchronizuj, tokenTabletu, wyslijStatystyki, zaloguj } from '../src/sync/synchronizacja';
import { dodajPensje, zapiszWydatek } from '../src/logika/lista';
import { setUstawienie } from '../src/db/ustawienia';

const API = process.env.SILT_API;
const HASLO = 'test123';

async function nowyTablet(url = API!, wersja = '1.0.0') {
  const db = new BazaNode();
  await migrateDbIfNeeded(db as never);
  const klient = utworzKlienta({ url, wersja, token: () => tokenTabletu(db), timeoutMs: 5000 });
  return { db, klient };
}

const niewyslane = async (db: Baza) =>
  (await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM kolejka WHERE wyslano IS NULL'))!.n;

const wczoraj = (() => {
  const d = new Date(Date.now() - 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

test('synchronizacja z serwerem', { skip: !API && 'brak SILT_API (serwer testowy)' }, async (t) => {
  const { db, klient } = await nowyTablet();

  await t.test('migracje: baza tabletu w wersji 3', async () => {
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    assert.equal(v!.user_version, 3);
  });

  await t.test('bez logowania → „zaloguj”, złe hasło → błąd, dobre → token', async () => {
    assert.equal((await synchronizuj(db, klient)).stan, 'zaloguj');
    await assert.rejects(zaloguj(db, klient, 'zle', 'test', '1.0.0'), (e) => e instanceof BladSerwera && e.kod === 'zle_haslo');
    await zaloguj(db, klient, HASLO, 'Lenovo test', '1.0.0');
    assert.ok(await tokenTabletu(db));
  });

  await t.test('hasło przed usunięciem listy: działa bez zasięgu, złe odrzuca', async () => {
    const offline = utworzKlienta({ url: 'http://127.0.0.1:1/api.php', wersja: '1.0.0', token: () => tokenTabletu(db), timeoutMs: 2000 });
    assert.equal(await sprawdzHaslo(db, offline, HASLO, 'x', '1.0.0'), 'ok');
    assert.equal(await sprawdzHaslo(db, offline, 'zle', 'x', '1.0.0'), 'zle');
    // tablet zalogowany starszą wersją (bez zapamiętanego skrótu): offline → prośba o zasięg, online → serwer sprawdza
    await setUstawienie(db, 'haslo_skrot', null);
    assert.equal(await sprawdzHaslo(db, offline, HASLO, 'x', '1.0.0'), 'offline');
    assert.equal(await sprawdzHaslo(db, klient, 'zle', 'x', '1.0.0'), 'zle');
    assert.equal(await sprawdzHaslo(db, klient, HASLO, 'x', '1.0.0'), 'ok');
    assert.equal(await sprawdzHaslo(db, offline, HASLO, 'x', '1.0.0'), 'ok');
  });

  await t.test('pierwsza synchronizacja pobiera cennik', async () => {
    const s = await synchronizuj(db, klient);
    assert.equal(s.stan, 'ok', s.komunikat ?? '');
    const c = await wczytajCennik(db);
    assert.equal(c?.atrakcje.length, 7);
    assert.equal(c?.atrakcje.find((a) => a.klucz === 'klasyk')?.pakiety[1].cena, 130);
  });

  await t.test('zgłoszenia błędów: zapis bez zasięgu, to samo raz, wysyłka przy synchronizacji', async () => {
    await zapiszBlad(db, { ekran: '/lista/x', komunikat: 'TypeError: a is undefined', stos: 'at x' });
    await zapiszBlad(db, { ekran: '/lista/x', komunikat: 'TypeError: a is undefined', stos: 'at x' });
    await zapiszBlad(db, { ekran: '/kosz', komunikat: 'Zgłoszenie: nie działa przywracanie' });
    assert.equal(await ileBledowCzeka(db), 2, 'powtórka w ciągu 10 min zapisana raz');
    assert.equal((await synchronizuj(db, klient)).stan, 'ok');
    assert.equal(await ileBledowCzeka(db), 0);
  });

  await t.test('PIN admina z serwera: tablet zna tylko skrót, sprawdza bez zasięgu', async () => {
    assert.equal(await jestPinAdmina(db), true);
    assert.equal(await sprawdzPin(db, '1234'), true);
    assert.equal(await sprawdzPin(db, '0000'), false);
    // inny tablet ma inny skrót tego samego PIN-u
    const t2 = await nowyTablet();
    assert.equal(await jestPinAdmina(t2.db), false);
  });

  const G = 'g-test-1';
  await t.test('lista dnia na tablecie: zapis + kolejka bez dublowania wiersza', async () => {
    const utworzono = new Date().toISOString();
    await zapiszWiele(db, [
      ['listy', { data: wczoraj, uwagi: null }],
      ['instruktorzy', { id: 't-1', data: wczoraj, imie: 'Monika', kolejnosc: 0 }],
      ['grupy', {
        id: G, data: wczoraj, instruktor_id: 't-1', godzina: '10:30', utworzono, organizator: 'Firma X', atrakcja: 'klasyk',
        pakiet_nazwa: 'Pakiet SILT', pakiet_typ: 'os', pakiet_kulki: 500, pakiet_cena: 130, pakiet_limit: 0, pakiet_extra: 0,
        kdod_ilosc: 100, kdod_cena: 15, gracze_reczne: 10, kulki_reczne: 0, kwota_reczna: null, zadatek: 100, platnosc: 'Karta',
        w_gracze: 0, w_kulki: 0, w_kulki_dok: 0, w_dym: 0, w_kwota: 0,
      }],
      ['gracze', { id: 'p-1', grupa_id: G, imie: 'Firma X', notatka: 'org.', kolejnosc: 0, pakiet_nazwa: null, pakiet_kulki: null,
        pakiet_cena: null, sprzet: null, worki_ilosc: null, worki_szt: null, worki_cena: null }],
    ]);
    for (let i = 0; i < 5; i++) {
      await zapisz(db, 'pozycje', { id: `i-${i}`, gracz_id: 'p-1', rodzaj: 'kulki', dokupione: true, ilosc: 100, kwota: null, nazwa: null, kolejnosc: i });
      await przeliczGrupe(db, G); // po każdym kliknięciu „+100” grupa przeliczona i zapisana
    }
    await zapisz(db, 'pozycje', { id: 'i-dym', gracz_id: 'p-1', rodzaj: 'dym', dokupione: false, ilosc: 2, kwota: 20, nazwa: null, kolejnosc: 9 });
    const g = await przeliczGrupe(db, G);
    assert.equal(g?.w_kwota, 1395);
    assert.equal(g?.w_kulki_dok, 500);
    // lista, instruktor, grupa (1 mimo 6 przeliczeń), gracz, 6 pozycji
    assert.equal(await niewyslane(db), 10);
  });

  await t.test('bez zasięgu: stan „offline”, nic nie ginie', async () => {
    const offline = utworzKlienta({ url: 'http://127.0.0.1:1/api.php', wersja: '1.0.0', token: () => tokenTabletu(db), timeoutMs: 2000 });
    const s = await synchronizuj(db, offline);
    assert.equal(s.stan, 'offline');
    assert.equal(s.niewyslane, 10);
  });

  await t.test('po odzyskaniu zasięgu wszystko wysłane', async () => {
    const s = await synchronizuj(db, klient);
    assert.equal(s.stan, 'ok', s.komunikat ?? '');
    assert.equal(s.niewyslane, 0);
    const g = await wczytaj(db, 'grupy', G);
    assert.ok(g?.rev, 'grupa dostała numer z serwera');
  });

  await t.test('nowy tablet po zalogowaniu pobiera całą listę (przywracanie)', async () => {
    const t2 = await nowyTablet();
    await zaloguj(t2.db, t2.klient, HASLO, 'drugi', '1.0.0');
    assert.equal((await synchronizuj(t2.db, t2.klient)).stan, 'ok');
    const g = await wczytaj(t2.db, 'grupy', G);
    assert.equal(g?.w_kwota, 1395);
    assert.equal(g?.organizator, 'Firma X');
    const poz = await wczytajGdzie(t2.db, 'pozycje', 'gracz_id = ?', ['p-1']);
    assert.equal(poz.length, 6);
    assert.equal(poz.find((p) => p.id === 'i-0')?.dokupione, true);
  });

  await t.test('cron 6:00 wysyła statystyki i SMS → tablet widzi to po synchronizacji', async () => {
    await zapisz(db, 'faktury', { grupa_id: G, nip: '1234567890', tel: '500600700', email: 'a@b.pl', kwota: 1395, platnosc: 'Przelew' });
    assert.equal((await synchronizuj(db, klient)).stan, 'ok');
    const out = execFileSync('php', [new URL('../server/cron.php', import.meta.url).pathname], { encoding: 'utf8' });
    assert.match(out, /statystyki wysłano/);
    await synchronizuj(db, klient);
    const l = await wczytaj(db, 'listy', wczoraj);
    const f = await wczytaj(db, 'faktury', G);
    assert.ok(l?.s_stat_wyslano, 'lista: wysłane do statystyk');
    assert.ok(f?.s_sms_wyslano, 'faktura: SMS wysłany');
  });

  await t.test('„📤 Wyślij statystyki” z tabletu: wydatki i pensje dochodzą, ponowne wysłanie bez dubli', async () => {
    await zapiszWydatek(db, wczoraj, { opis: 'Paliwo', kwota: 150, uwagi: '' });
    await dodajPensje(db, wczoraj, { imie: 'Janek', prac_id: 'pr1', godziny: 7.5, stawka: 30, premia_stawka: 5 });
    const msg = await wyslijStatystyki(db, klient, wczoraj, true);
    assert.match(msg, /Wysłano do Statystyk/);
    const msg2 = await wyslijStatystyki(db, klient, wczoraj, false);
    assert.match(msg2, /już wysłane/);
    const l = await wczytaj(db, 'listy', wczoraj);
    assert.ok(l?.s_stat_wyslano);
    assert.equal(l?.s_stat_przez, 'tablet');
  });

  await t.test('kosz: usunięty gracz znika z kwoty, na serwerze ma datę usunięcia', async () => {
    await zapisz(db, 'gracze', { id: 'p-2', grupa_id: G, imie: 'Ola', notatka: '', kolejnosc: 1, pakiet_nazwa: null, pakiet_kulki: null,
      pakiet_cena: null, sprzet: [{ nazwa: 'Własny', kwota: 40 }], worki_ilosc: null, worki_szt: null, worki_cena: null });
    assert.equal((await przeliczGrupe(db, G))?.w_kwota, 1395 - 130 + 40);
    await usun(db, 'gracze', 'p-2');
    assert.equal((await przeliczGrupe(db, G))?.w_kwota, 1395);
    await synchronizuj(db, klient);
    const t2 = await nowyTablet();
    await zaloguj(t2.db, t2.klient, HASLO, 'trzeci', '1.0.0');
    await synchronizuj(t2.db, t2.klient);
    const ola = await wczytaj(t2.db, 'gracze', 'p-2');
    assert.ok(ola?.usunieto, 'gracz w koszu także na innym tablecie');
    assert.equal((await wczytajGdzie(t2.db, 'gracze', 'grupa_id = ?', [G])).length, 1);
  });

  await t.test('kosz: „↩ Przywróć” na jednym tablecie → gracz wraca na serwerze i na innym tablecie', async () => {
    const k = await wczytajKosz(db, null);
    const ola = k.find((x) => x.id === 'p-2')!;
    assert.ok(ola, 'gracz w koszu');
    await przywrocZKosza(db, ola);
    assert.equal((await wczytaj(db, 'grupy', G))?.w_kwota, 1395 - 130 + 40);
    assert.equal((await synchronizuj(db, klient)).stan, 'ok');
    const t2 = await nowyTablet();
    await zaloguj(t2.db, t2.klient, HASLO, 'piaty', '1.0.0');
    await synchronizuj(t2.db, t2.klient);
    assert.equal((await wczytaj(t2.db, 'gracze', 'p-2'))?.usunieto, null);
    assert.equal((await wczytaj(t2.db, 'grupy', G))?.w_kwota, 1395 - 130 + 40);
    // z powrotem do kosza (dalsze testy liczą na 1395)
    await usun(db, 'gracze', 'p-2');
    await przeliczGrupe(db, G);
    await synchronizuj(db, klient);
  });

  await t.test('zmiana z tabletu jest wysyłana przed pobieraniem, więc nie ginie', async () => {
    const t2 = await nowyTablet();
    await zaloguj(t2.db, t2.klient, HASLO, 'czwarty', '1.0.0');
    await synchronizuj(t2.db, t2.klient);
    const g2 = (await wczytaj(t2.db, 'grupy', G))!;
    await zapisz(t2.db, 'grupy', { ...g2, organizator: 'Zmiana z tabletu 2' });
    await synchronizuj(t2.db, t2.klient);

    const g1 = (await wczytaj(db, 'grupy', G))!;
    await zapisz(db, 'grupy', { ...g1, platnosc: 'Gotówka' }); // nowsza, jeszcze niewysłana
    const s = await synchronizuj(db, klient); // najpierw wysyła swoją, potem pobiera
    assert.equal(s.stan, 'ok');
    assert.equal((await wczytaj(db, 'grupy', G))?.platnosc, 'Gotówka');
  });

  await t.test('stara wersja aplikacji → „aktualizacja”, kolejka czeka', async () => {
    const stara = utworzKlienta({ url: API!, wersja: '0.0.1', token: () => tokenTabletu(db) });
    const g = (await wczytaj(db, 'grupy', G))!;
    await zapisz(db, 'grupy', { ...g, zadatek: 200 });
    const s = await synchronizuj(db, stara);
    assert.equal(s.stan, 'aktualizacja');
    assert.equal(s.niewyslane, 1);
  });
});
