/// <reference types="node" />
// 🗑️ Kosz: co widać, przywracanie (razem z tym, co usunięto w tej samej chwili), kasowanie po 7 dniach.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { migrateDbIfNeeded } from '../src/db/migrations';
import type { Atrakcja } from '../src/logika/cennik';
import { oczyscKosz, przywrocZKosza, wczytajKosz } from '../src/logika/kosz';
import {
  dodajGracza,
  dodajGrupe,
  dodajPensje,
  usunGracza,
  usunGrupe,
  usunInstruktora,
  usunListe,
  usunWydatek,
  utworzListe,
  wczytajDzien,
  zapiszWydatek,
} from '../src/logika/lista';
import { BazaNode } from './baza-node';

const KLASYK: Atrakcja = {
  klucz: 'klasyk', nazwa: 'Paintball Klasyczny', podpis: '', stat: 'KLASYK', kolor: '#8B6355',
  kdod: { ilosc: 100, cena: 15 }, opcje_pakiet: [], opcje_dok: [],
  pakiety: [{ id: 2, nazwa: 'Pakiet SILT', kulki: 500, cena: 130, typ: 'os', limit: 0, extra: 0 }],
};
const D = '2026-10-01';
let db: BazaNode;
beforeEach(async () => {
  db = new BazaNode();
  await migrateDbIfNeeded(db as never);
});

test('Usunięty gracz i grupa → w koszu; przywrócenie oddaje kwotę', async () => {
  const t = (await utworzListe(db, D, 'Monika'))!;
  const gid = await dodajGrupe(db, D, t, 'Alex', KLASYK, KLASYK.pakiety[0]);
  const pid = await dodajGracza(db, gid, 'Ola', '');
  assert.equal((await wczytajDzien(db, D)).grupy[0].w_kwota, 260);
  await usunGracza(db, pid);
  assert.equal((await wczytajDzien(db, D)).grupy[0].w_kwota, 130);
  let k = await wczytajKosz(db, null);
  assert.deepEqual(k.map((x) => [x.rodzaj, x.tytul]), [['gracz', 'Gracz Ola']]);
  await przywrocZKosza(db, k[0]);
  assert.equal((await wczytajDzien(db, D)).grupy[0].w_kwota, 260);
  assert.equal((await wczytajKosz(db, null)).length, 0);

  await usunGrupe(db, gid);
  k = await wczytajKosz(db, null);
  assert.deepEqual(k.map((x) => x.rodzaj), ['grupa'], 'gracze usuniętej grupy nie pokazują się osobno');
  await przywrocZKosza(db, k[0]);
  const dz = await wczytajDzien(db, D);
  assert.equal(dz.grupy.length, 1);
  assert.equal(dz.grupy[0].gracze.length, 2, 'grupa wraca z graczami');
});

test('Cała lista wraca z instruktorami, grupami, wydatkami i pensjami; wcześniej usunięte zostają w koszu', async () => {
  const t1 = (await utworzListe(db, D, 'Monika'))!;
  const t2 = (await utworzListe(db, D, 'Janek'))!;
  await dodajGrupe(db, D, t1, 'Alex', KLASYK, KLASYK.pakiety[0]);
  await dodajGrupe(db, D, t2, 'Ola', KLASYK, KLASYK.pakiety[0]);
  await zapiszWydatek(db, D, { opis: 'Paliwo', kwota: 150, uwagi: '' });
  await zapiszWydatek(db, D, { opis: 'Woda', kwota: 20, uwagi: '' });
  await dodajPensje(db, D, { imie: 'Janek', prac_id: 'p', godziny: 5, stawka: 30, premia_stawka: 0 });
  // „Woda” usunięta dawno przed listą (cofamy jej czas o godzinę)
  const woda = (await wczytajDzien(db, D)).wydatki.find((w) => w.opis === 'Woda')!;
  await usunWydatek(db, woda.id);
  await db.runAsync("UPDATE wydatki SET usunieto = strftime('%Y-%m-%dT%H:%M:%fZ', usunieto, '-3600 seconds') WHERE id = ?", woda.id);

  await usunListe(db, D);
  let k = await wczytajKosz(db, null);
  assert.deepEqual(k.map((x) => x.rodzaj), ['lista'], 'tylko lista (reszta wraca z nią)');
  assert.match(k[0].opis, /2 grupy/);
  await przywrocZKosza(db, k[0]);
  const dz = await wczytajDzien(db, D);
  assert.ok(dz.lista);
  assert.equal(dz.instruktorzy.length, 2);
  assert.equal(dz.grupy.length, 2);
  assert.deepEqual(dz.wydatki.map((w) => w.opis), ['Paliwo']);
  assert.equal(dz.pensje.length, 1);
  k = await wczytajKosz(db, null);
  assert.deepEqual(k.map((x) => x.tytul), ['Wydatek Woda 20 zł']);

  await usunInstruktora(db, t2);
  k = await wczytajKosz(db, null);
  assert.equal(k[0].rodzaj, 'instruktor');
  await przywrocZKosza(db, k[0]);
  assert.equal((await wczytajDzien(db, D)).grupy.length, 2, 'instruktor wraca z grupami');
});

test('Po 7 dniach: znika z kosza i z tablety (gdy usunięcie już wysłane)', async () => {
  const t = (await utworzListe(db, D, 'Monika'))!;
  const gid = await dodajGrupe(db, D, t, 'Alex', KLASYK, KLASYK.pakiety[0]);
  await usunGrupe(db, gid);
  const za8dni = new Date(Date.now() + 8 * 86400000);
  assert.equal((await wczytajKosz(db, null, za8dni)).length, 0);
  assert.equal(await oczyscKosz(db, za8dni), 0, 'usunięcie czeka na wysłanie — nie kasujemy');
  await db.runAsync("UPDATE kolejka SET wyslano = 'x'");
  assert.ok((await oczyscKosz(db, za8dni)) >= 2, 'grupa i jej gracz skasowane');
  assert.equal((await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM gracze'))!.n, 0);
  assert.equal((await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM grupy'))!.n, 0);
  assert.equal((await wczytajDzien(db, D)).instruktorzy.length, 1, 'reszta listy zostaje');
});
