/// <reference types="node" />
// 🏢 Impreza firmowa: stawki netto → zapis brutto (23% VAT).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { brutto, doPola, netto, zPola } from '../src/logika/vat';

test('netto ↔ brutto', () => {
  assert.equal(brutto(150), 184.5);
  assert.equal(brutto(13), 15.99);
  assert.equal(brutto(10), 12.3);
  assert.equal(netto(184.5), 150);
  assert.equal(netto(12.3), 10);
});

test('pola: w firmie netto, poza firmą bez zmian', () => {
  assert.equal(doPola(184.5, true), '150');
  assert.equal(doPola(15.99, true), '13');
  assert.equal(doPola(130, false), '130');
  assert.equal(doPola(null, true), '');
  assert.equal(zPola(150, true), 184.5);
  assert.equal(zPola(150, false), 150);
});

test('przykład: 40 os. × 150 zł netto = 7 380 zł brutto', () => {
  assert.equal(Math.round(40 * brutto(150) * 100) / 100, 7380);
});
