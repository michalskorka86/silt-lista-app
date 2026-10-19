/// <reference types="node" />
// ✅ Kontrola braków przed ręczną wysyłką statystyk.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { brakiDnia, opisBrakow } from '../src/logika/kontrola';

const cennik = {
  atrakcje: [
    { klucz: 'asg', nazwa: 'ASG', opcje_pakiet: [250, 500], kdod: { ilosc: 1000, cena: 50 } },
    { klucz: 'laser', nazwa: 'Paintball Laserowy', opcje_pakiet: [], kdod: null },
  ],
} as never;
const g = (z: Record<string, unknown>, w: Record<string, number>) =>
  ({ instruktor_id: 'i1', atrakcja: 'asg', organizator: 'Kowalski', godzina: '10:00', platnosc: 'Gotówka', ...z, wynik: { doZap: 100, gracze: 10, kulki: 500, ...w } }) as never;
const instruktorzy = [{ id: 'i1', imie: 'Janek' }, { id: 'i2', imie: 'Dima' }] as never;

test('kompletna grupa → brak uwag', () => {
  assert.deepEqual(brakiDnia({ grupy: [g({}, {})], instruktorzy }, cennik), []);
});

test('braki wypisane z instruktorem', () => {
  const b = brakiDnia({ grupy: [g({ platnosc: '' }, { gracze: 1, kulki: 0 }), g({ instruktor_id: 'i2', platnosc: '' }, {})], instruktorzy }, cennik);
  assert.equal(b.length, 2);
  assert.deepEqual(b[0].braki, ['forma płatności', 'ilość osób', 'ilość kulek']);
  assert.equal(b[1].instruktor, 'Dima');
  assert.match(opisBrakow(b), /Janek:[\s\S]*ASG, org\. Kowalski[\s\S]*Dima:/);
});

test('laser bez kulek i grupa opłacona zadatkiem — bez uwag', () => {
  assert.deepEqual(brakiDnia({ grupy: [g({ atrakcja: 'laser' }, { kulki: 0 }), g({ platnosc: '' }, { doZap: 0 })], instruktorzy }, cennik), []);
});
