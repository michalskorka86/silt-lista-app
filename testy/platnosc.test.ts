/// <reference types="node" />
// 💵💳 Forma płatności: gotówka + karta, podział „do zapłaty” i gotówka w kasie.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { opisPlatnosci, podzialPlatnosci, sumaPodzialow } from '../src/logika/platnosc';

test('gotówka + karta: część gotówką, reszta kartą', () => {
  assert.deepEqual(podzialPlatnosci('Mieszana', 300, 780), { gotowka: 300, karta: 480, przelew: 0, brak: 0 });
  assert.equal(opisPlatnosci('Mieszana', 300, 780), 'Gotówka 300 zł + Karta 480 zł');
});

test('gotówka większa niż do zapłaty → cała kwota gotówką, karta 0', () => {
  assert.deepEqual(podzialPlatnosci('Mieszana', 1000, 780), { gotowka: 780, karta: 0, przelew: 0, brak: 0 });
});

test('pojedyncze formy i brak formy', () => {
  assert.deepEqual(podzialPlatnosci('Gotówka', null, 680), { gotowka: 680, karta: 0, przelew: 0, brak: 0 });
  assert.deepEqual(podzialPlatnosci('Karta', null, 680), { gotowka: 0, karta: 680, przelew: 0, brak: 0 });
  assert.deepEqual(podzialPlatnosci('', null, 1450), { gotowka: 0, karta: 0, przelew: 0, brak: 1450 });
  assert.equal(opisPlatnosci('', null, 1), '—');
});

test('suma dnia', () => {
  const s = sumaPodzialow([podzialPlatnosci('Gotówka', null, 680), podzialPlatnosci('Mieszana', 500, 1540), podzialPlatnosci('Przelew', null, 2200)]);
  assert.deepEqual(s, { gotowka: 1180, karta: 1040, przelew: 2200, brak: 0 });
});
