/// <reference types="node" />
// Obliczenia grupy (port calc() z v19). Pełne porównanie z v19 na 5000 losowych grupach
// zrobione przy przenoszeniu; tu stałe przypadki, które pilnują, żeby się nie popsuło.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Grupa } from '../src/db/tabele';
import { policzGrupe, round10, type GraczZPozycjami } from '../src/logika/obliczenia';

const grupa = (z: Partial<Grupa>): Grupa => ({
  id: 'g', data: '2026-09-30', instruktor_id: null, godzina: '10:00', utworzono: '', organizator: '', atrakcja: 'klasyk',
  pakiet_nazwa: 'Pakiet SILT', pakiet_typ: 'os', pakiet_kulki: 500, pakiet_cena: 130, pakiet_limit: 0, pakiet_extra: 0,
  kdod_ilosc: 100, kdod_cena: 15, gracze_reczne: 0, kulki_reczne: 0, kwota_reczna: null, zadatek: 0, platnosc: '',
  w_gracze: 0, w_kulki: 0, w_kulki_dok: 0, w_dym: 0, w_kwota: 0, ...z,
});
const gracz = (z: Partial<GraczZPozycjami>): GraczZPozycjami => ({
  id: 'p', grupa_id: 'g', imie: 'X', notatka: '', kolejnosc: 0, pakiet_nazwa: null, pakiet_kulki: null, pakiet_cena: null,
  sprzet: null, worki_ilosc: null, worki_szt: null, worki_cena: null, pozycje: [], ...z,
});
const kulki = (ilosc: number, dokupione = false) =>
  ({ id: 'i', gracz_id: 'p', rodzaj: 'kulki', dokupione, ilosc, kwota: null, nazwa: null, kolejnosc: 0 }) as const;
const dym = (ilosc: number, kwota: number) =>
  ({ id: 'd', gracz_id: 'p', rodzaj: 'dym', dokupione: false, ilosc, kwota, nazwa: null, kolejnosc: 0 }) as const;

test('Klasyk: 10 osób × 130 zł + 500 dokupionych (75 zł) + 2 dymy (20 zł) = 1395 zł', () => {
  const w = policzGrupe(grupa({ gracze_reczne: 10, zadatek: 100 }), [gracz({ pozycje: [kulki(500), kulki(500, true), dym(2, 20)] })], []);
  assert.equal(w.gracze, 10);
  assert.equal(w.kulki, 1000);
  assert.equal(w.kD, 500);
  assert.equal(w.dymN, 2);
  assert.equal(w.kwota, 1395);
  assert.equal(w.doZap, 1295);
});

test('Gotcha: pakiet grupowy 850 zł do 10 osób, każda kolejna 70 zł; własny sprzęt bez podstawy', () => {
  const g = grupa({ atrakcja: 'gotcha', pakiet_typ: 'grupa', pakiet_cena: 850, pakiet_limit: 10, pakiet_extra: 70, gracze_reczne: 12 });
  assert.equal(policzGrupe(g, [], []).kwota, 990);
  const zSprzetem = gracz({ sprzet: [{ nazwa: 'Własny', kwota: 40 }] });
  assert.equal(policzGrupe(g, [zSprzetem], []).kwota, 850 + 70 + 40);
});

test('Kwota wpisana ręcznie wygrywa z automatyczną; dodatki doliczone do automatycznej', () => {
  const dod = [{ id: 'x', grupa_id: 'g', nazwa: 'Ognisko', kwota: 200, kolejnosc: 0 }];
  assert.equal(policzGrupe(grupa({ gracze_reczne: 2 }), [], dod).kwota, 460);
  assert.equal(policzGrupe(grupa({ gracze_reczne: 2, kwota_reczna: 300 }), [], dod).kwota, 300);
});

test('Worek kulek dla własnego sprzętu: liczy się do kulek i kwoty, nie jak kulki dokupione', () => {
  const p = gracz({ sprzet: [{ nazwa: 'Własny', kwota: 40 }], worki_ilosc: 2, worki_szt: 500, worki_cena: 40 });
  const w = policzGrupe(grupa({}), [p], []);
  assert.equal(w.kulki, 1000);
  assert.equal(w.kD, 0);
  assert.equal(w.kwota, 40 + 80);
});

test('Pensje zaokrąglane do 10 zł jak w v19', () => {
  assert.equal(round10(225), 230);
  assert.equal(round10(224), 220);
  assert.equal(round10(7.5 * 30), 230);
});
