/// <reference types="node" />
// Automatyczne PDF-y dni: które dni dostają PDF i kiedy robi się go na nowo.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { migrateDbIfNeeded } from '../src/db/migrations';
import type { Atrakcja } from '../src/logika/cennik';
import { dodajGrupe, utworzListe, usunListe, zapiszWydatek, zmienGrupe } from '../src/logika/lista';
import { dniDoPdf, folderMiesiaca, oznaczPdf, ostatniDzienDoPdf, plikDnia } from '../src/logika/pdfDni';
import { BazaNode } from './baza-node';

const KLASYK: Atrakcja = {
  klucz: 'klasyk', nazwa: 'Paintball Klasyczny', podpis: '', stat: 'KLASYK', kolor: '#8B6355',
  kdod: { ilosc: 100, cena: 15 }, opcje_pakiet: [], opcje_dok: [],
  pakiety: [{ id: 2, nazwa: 'Pakiet SILT', kulki: 500, cena: 130, typ: 'os', limit: 0, extra: 0 }],
};

let db: BazaNode;
beforeEach(async () => {
  db = new BazaNode();
  await migrateDbIfNeeded(db as never);
});

const zrob = async (teraz: Date) => {
  const dni = await dniDoPdf(db, teraz);
  for (const d of dni) await oznaczPdf(db, d.data, { podpis: d.podpis, znacznik: d.znacznik, t: teraz.toISOString(), gdzie: 'test' });
  return dni.map((d) => d.data);
};

test('Nazwy folderów i plików', () => {
  assert.equal(folderMiesiaca('2026-09-30'), '2026-09 Wrzesień');
  assert.equal(folderMiesiaca('2026-01-02'), '2026-01 Styczeń');
  assert.equal(plikDnia('2026-09-30'), '2026-09-30 Lista.pdf');
});

test('Wczorajsza lista dopiero po 3:00, dzisiejsza nigdy', () => {
  assert.equal(ostatniDzienDoPdf(new Date(2026, 9, 2, 2, 59)), '2026-09-30');
  assert.equal(ostatniDzienDoPdf(new Date(2026, 9, 2, 3, 0)), '2026-10-01');
  assert.equal(ostatniDzienDoPdf(new Date(2026, 9, 1, 12, 0)), '2026-09-30');
});

test('PDF raz; zmiana listy → nowy PDF; usunięta lista bez PDF', async () => {
  const t = (await utworzListe(db, '2026-09-29', 'Monika'))!;
  const gid = await dodajGrupe(db, '2026-09-29', t, 'Alex', KLASYK, KLASYK.pakiety[0]);
  await utworzListe(db, '2026-09-30', 'Janek');
  await utworzListe(db, '2026-10-01', 'Janek'); // „dziś”
  await utworzListe(db, '2026-08-01', 'Stara'); // dawno (poza 45 dniami)

  const noc = new Date(2026, 9, 1, 3, 30);
  assert.deepEqual(await zrob(new Date(2026, 9, 1, 2, 0)), ['2026-09-29']); // przed 3:00 wczorajsza czeka
  assert.deepEqual(await zrob(noc), ['2026-09-30']);
  assert.deepEqual(await zrob(noc), [], 'bez zmian — nic do roboty');

  await zmienGrupe(db, gid, { gracze_reczne: 12 });
  assert.deepEqual(await zrob(noc), ['2026-09-29'], 'zmieniona lista dostaje nowy PDF');

  await zapiszWydatek(db, '2026-09-30', { opis: 'Paliwo', kwota: 100, uwagi: '' });
  await usunListe(db, '2026-09-30');
  assert.deepEqual(await zrob(noc), [], 'usuniętej listy nie drukujemy');
});
