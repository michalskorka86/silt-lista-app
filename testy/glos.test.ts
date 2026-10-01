/// <reference types="node" />
// 🎤 Imiona z dyktowania — jak voiceName() w v19.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { imionaZMowy } from '../src/logika/glos';

test('kilka imion: przecinki, „i”, „oraz”', () => {
  assert.deepEqual(imionaZMowy('bartek, ola i kamil'), ['Bartek', 'Ola', 'Kamil']);
  assert.deepEqual(imionaZMowy('Ania oraz Zosia a także Igor.'), ['Ania', 'Zosia', 'Igor']);
});

test('jedno imię (z nazwiskiem) zostaje w całości', () => {
  assert.deepEqual(imionaZMowy('jan kowalski'), ['Jan Kowalski']);
  assert.deepEqual(imionaZMowy('Iwona'), ['Iwona']);
  assert.deepEqual(imionaZMowy('  '), []);
});

test('„i” w środku imienia nie dzieli', () => {
  assert.deepEqual(imionaZMowy('Igi i Iza'), ['Igi', 'Iza']);
  assert.deepEqual(imionaZMowy('Kinga'), ['Kinga']);
});
