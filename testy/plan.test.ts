/// <reference types="node" />
// 📋 Plan dnia na tablecie: odczyt, kafelki przy „Dodaj grupę”, odhaczanie, poprawki z PIN-em.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { migrateDbIfNeeded } from '../src/db/migrations';
import { liczNiewyslane, usun, zapisz } from '../src/db/zapis';
import type { Atrakcja } from '../src/logika/cennik';
import { dodajGrupe, utworzListe, wczytajDzien } from '../src/logika/lista';
import {
  kafelkiPlanu,
  ladneImie,
  odhacz,
  polaczZPlanem,
  rzeczyDoZabrania,
  sumyPlanu,
  ustawStatusPlanu,
  usunGrupePlanu,
  wczytajPlan,
  zalatwiona,
  zapiszDzienPlanu,
  zapiszGrupePlanu,
} from '../src/logika/plan';
import { BazaNode } from './baza-node';

const EMEK: Atrakcja = {
  klucz: 'emek', nazwa: 'Paintball Emek', podpis: '0,50 cal', stat: 'EMEK', kolor: '#5C6BC0',
  kdod: { ilosc: 100, cena: 15 }, opcje_pakiet: [50, 100, 200, 500], opcje_dok: [100, 200, 500, 1000],
  pakiety: [{ id: 5, nazwa: 'Pakiet EMEK', kulki: 300, cena: 100, typ: 'os', limit: 0, extra: 0 }],
};
const D = '2026-11-14';
const Z = '2026-11-12T10:00:00.000Z';

let db: BazaNode;
beforeEach(async () => {
  db = new BazaNode();
  await migrateDbIfNeeded(db as never);
});

/** jak po pobraniu z serwera (bez kolejki) */
async function zSerwera(t: string, w: Record<string, unknown>) {
  const kol = Object.keys(w);
  await db.runAsync(`INSERT INTO ${t} (${kol.join(',')}, zmieniono, rev) VALUES (${kol.map(() => '?').join(',')}, ?, 1)`, ...(Object.values(w) as never[]), Z);
}

async function planSoboty() {
  await zSerwera('plan_grupy', { id: 'p1', data: D, godzina: '09:00', organizator: 'JERZY NOWAK', atrakcja: 'emek', uwagi: 'WIATA W LESIE', osoby: 20, zadatek: 'NIE', kolejnosc: 0 });
  await zSerwera('plan_grupy', { id: 'p2', data: D, godzina: '11:00', organizator: 'DAMIAN MUCHA', atrakcja: 'asg', uwagi: '', osoby: 31, zadatek: 'TAK', kolejnosc: 1 });
  await zSerwera('plan_grupy', { id: 'p3', data: D, godzina: '13:00', organizator: 'PATRYCJA PTAK', atrakcja: 'klasyk', uwagi: '', osoby: 21, zadatek: 'TAK', kolejnosc: 2 });
  await zSerwera('plan_dni', { data: D, pakowanie: JSON.stringify({ pb_kartony: 15, maski_worki: 10, naraz: { emek: 41 } }), do_zabrania: 'ŚMIESZNE STROJE / ŚWIECE DYMNE\nAGREGAT', uwagi: '' });
}

test('migracja v7: tabele planu i znacznik „dociągnij od zera”', async () => {
  const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  assert.equal(v!.user_version, 7);
  const u = await db.getFirstAsync<{ wartosc: string }>("SELECT wartosc FROM ustawienia WHERE klucz = 'dociagnij_tabele'");
  assert.equal(u!.wartosc, 'plan_dni,plan_grupy,plan_stan,plan_odhaczenia');
});

test('plan z serwera: grupy po kolei, pakowanie, sumy PB / EM, rzeczy do zabrania', async () => {
  await planSoboty();
  const p = await wczytajPlan(db, D);
  assert.deepEqual(p.grupy.map((g) => g.organizator), ['JERZY NOWAK', 'DAMIAN MUCHA', 'PATRYCJA PTAK']);
  assert.equal(p.dzien!.pakowanie!.pb_kartony, 15);
  assert.equal(p.dzien!.pakowanie!.naraz!.emek, 41);
  assert.deepEqual(sumyPlanu(p.grupy), { osoby: 72, pb: 21, em: 20 });
  assert.deepEqual(rzeczyDoZabrania(p.dzien!.do_zabrania).map((x) => x.nazwa), ['ŚMIESZNE STROJE', 'ŚWIECE DYMNE', 'AGREGAT']);
  assert.equal(await liczNiewyslane(db), 0);
});

test('kafelek przy „Dodaj grupę” → grupa na liście z ilością osób, w planie „na liście” u instruktora', async () => {
  await planSoboty();
  const t = (await utworzListe(db, D, 'Monika'))!;
  let p = await wczytajPlan(db, D);
  assert.equal(kafelkiPlanu(p).length, 3);
  const z = p.grupy[0];
  const gid = await dodajGrupe(db, D, t, ladneImie(z.organizator), EMEK, EMEK.pakiety[0]);
  await polaczZPlanem(db, z, gid);
  const dz = await wczytajDzien(db, D);
  assert.equal(dz.grupy[0].organizator, 'Jerzy Nowak');
  assert.equal(dz.grupy[0].w_gracze, 20);
  assert.equal(dz.grupy[0].w_kwota, 2000);
  p = await wczytajPlan(db, D);
  assert.equal(p.grupy[0].naLiscie, true);
  assert.equal(p.grupy[0].instruktor, 'Monika');
  assert.equal(zalatwiona(p.grupy[0]), true);
  assert.deepEqual(kafelkiPlanu(p).map((g) => g.id), ['p2', 'p3']);
  // grupa usunięta z listy → w planie znowu czeka, kafelek wraca
  await usun(db, 'grupy', gid);
  p = await wczytajPlan(db, D);
  assert.equal(p.grupy[0].naLiscie, false);
});

test('❌ nie przyszła → znika z kafelków, nie liczy się do sumy; cofnięcie przywraca', async () => {
  await planSoboty();
  await ustawStatusPlanu(db, { id: 'p2', data: D }, 'nie');
  let p = await wczytajPlan(db, D);
  assert.equal(p.grupy[1].status, 'nie');
  assert.deepEqual(kafelkiPlanu(p).map((g) => g.id), ['p1', 'p3']);
  assert.equal(sumyPlanu(p.grupy).osoby, 41);
  await ustawStatusPlanu(db, { id: 'p2', data: D }, '');
  p = await wczytajPlan(db, D);
  assert.equal(kafelkiPlanu(p).length, 3);
  const k = await db.getAllAsync<{ dane: string }>("SELECT dane FROM kolejka WHERE klucz = 'plan_stan:p2' AND wyslano IS NULL");
  assert.equal(k.length, 1, 'w kolejce tylko ostatnia zmiana stanu');
});

test('spakowane: odhaczenie i odznaczenie, każda pozycja osobno', async () => {
  await planSoboty();
  const [stroje] = rzeczyDoZabrania('ŚMIESZNE STROJE / AGREGAT');
  await odhacz(db, D, 'pb_kartony', true);
  await odhacz(db, D, stroje.klucz, true);
  let p = await wczytajPlan(db, D);
  assert.ok(p.spakowane.has('pb_kartony') && p.spakowane.has(stroje.klucz));
  await odhacz(db, D, 'pb_kartony', false);
  p = await wczytajPlan(db, D);
  assert.ok(!p.spakowane.has('pb_kartony') && p.spakowane.has(stroje.klucz));
  const ids = await db.getAllAsync<{ id: string }>('SELECT id FROM plan_odhaczenia');
  assert.ok(ids.every((x) => /^[A-Za-z0-9_-]{1,40}$/.test(x.id)), 'id pasuje do zasad serwera');
});

test('poprawki z PIN-em: dodanie i zmiana grupy planu, liczby pakowania, usunięcie', async () => {
  await planSoboty();
  const id = await zapiszGrupePlanu(db, D, { godzina: '14:30', organizator: 'Maciej', atrakcja: 'emek', uwagi: 'kamizelki', osoby: 7, zadatek: 'TAK' });
  let p = await wczytajPlan(db, D);
  assert.equal(p.grupy[3].id, id);
  assert.equal(p.grupy[3].kolejnosc, 3);
  await zapiszGrupePlanu(db, D, { ...p.grupy[1], osoby: 33 }, 'p2');
  await zapiszDzienPlanu(db, D, { pakowanie: { ...p.dzien!.pakowanie, em_kartony: 10 } });
  await usunGrupePlanu(db, 'p3');
  p = await wczytajPlan(db, D);
  assert.equal(p.grupy.find((g) => g.id === 'p2')!.osoby, 33);
  assert.equal(p.dzien!.pakowanie!.em_kartony, 10);
  assert.equal(p.dzien!.pakowanie!.pb_kartony, 15);
  assert.equal(p.grupy.some((g) => g.id === 'p3'), false);
  assert.equal(await liczNiewyslane(db), 4);
});

test('ladneImie: wielkie litery → normalne, reszta bez zmian', () => {
  assert.equal(ladneImie('JAROSŁAW MIĘTUS'), 'Jarosław Miętus');
  assert.equal(ladneImie('ANNA KOUCH-NOWAK'), 'Anna Kouch-Nowak');
  assert.equal(ladneImie('Ola z firmy XYZ'), 'Ola z firmy XYZ');
  assert.equal(ladneImie('  jan  '), 'jan');
});

test('zapis planu przez zapisz() trafia do kolejki z całym wierszem', async () => {
  await zapisz(db, 'plan_stan', { plan_id: 'p9', data: D, status: 'przyszla', grupa_id: null });
  const k = await db.getFirstAsync<{ dane: string }>('SELECT dane FROM kolejka WHERE wyslano IS NULL');
  assert.deepEqual(JSON.parse(k!.dane).rekord, { plan_id: 'p9', data: D, status: 'przyszla', grupa_id: null });
});
