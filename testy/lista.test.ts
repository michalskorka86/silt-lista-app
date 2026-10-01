/// <reference types="node" />
// Akcje listy dnia (to, co robią ekrany) na bazie tabletu w pamięci — bez serwera.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { migrateDbIfNeeded } from '../src/db/migrations';
import { liczNiewyslane } from '../src/db/zapis';
import type { Atrakcja } from '../src/logika/cennik';
import {
  dodajDodatek,
  dodajDym,
  dodajGracza,
  dodajGrupe,
  dodajInne,
  dodajKulki,
  dodajWorek,
  datyList,
  listyMiesiaca,
  usunDodatek,
  dodajPensje,
  usunPensje,
  usunWydatek,
  zapiszWydatek,
  zmienPensje,
  usunFakture,
  zapiszFakture,
  zmienGracza,
  usunGracza,
  usunInstruktora,
  usunListe,
  usunPozycje,
  utworzListe,
  wczytajDzien,
  zmienGrupe,
} from '../src/logika/lista';
import { BazaNode } from './baza-node';

const KLASYK: Atrakcja = {
  klucz: 'klasyk', nazwa: 'Paintball Klasyczny', podpis: '0,68 cal', stat: 'KLASYK', kolor: '#8B6355',
  kdod: { ilosc: 100, cena: 15 }, opcje_pakiet: [50, 100, 200, 500], opcje_dok: [100, 200, 500, 1000],
  pakiety: [{ id: 2, nazwa: 'Pakiet SILT', kulki: 500, cena: 130, typ: 'os', limit: 0, extra: 0 }],
};
const GOTCHA: Atrakcja = {
  klucz: 'gotcha', nazwa: 'Paintball Gotcha', podpis: '', stat: 'GOTHA', kolor: '#7B1FA2',
  kdod: { ilosc: 100, cena: 15 }, opcje_pakiet: [], opcje_dok: [],
  pakiety: [{ id: 9, nazwa: 'Pakiet urodzinowy do 10 osób', kulki: 0, cena: 850, typ: 'grupa', limit: 10, extra: 70 }],
};
const D = '2026-10-01';

let db: BazaNode;
beforeEach(async () => {
  db = new BazaNode();
  await migrateDbIfNeeded(db as never);
});

test('Utwórz listę z instruktorem; to samo imię drugi raz = ta sama zakładka', async () => {
  const t1 = await utworzListe(db, D, 'Monika');
  const t2 = await utworzListe(db, D, 'monika');
  assert.equal(t1, t2);
  const t3 = await utworzListe(db, D, 'Janek');
  assert.notEqual(t1, t3);
  const dz = await wczytajDzien(db, D);
  assert.ok(dz.lista);
  assert.deepEqual(dz.instruktorzy.map((i) => i.imie), ['Monika', 'Janek']);
  assert.deepEqual(await datyList(db), [D]);
});

test('Nowa grupa: organizator jako pierwszy gracz „org.”, pakiet i kulki dodatkowe z cennika', async () => {
  const t = (await utworzListe(db, D, 'Monika'))!;
  await dodajGrupe(db, D, t, 'Alex', KLASYK, KLASYK.pakiety[0]);
  const g = (await wczytajDzien(db, D)).grupy[0];
  assert.equal(g.pakiet_cena, 130);
  assert.equal(g.kdod_cena, 15);
  assert.equal(g.gracze.length, 1);
  assert.equal(g.gracze[0].imie, 'Alex');
  assert.equal(g.gracze[0].notatka, 'org.');
  assert.equal(g.w_kwota, 130);
  assert.match(g.godzina, /^\d{2}:\d{2}$/);
});

test('Gracze, kulki, dym, inne → kwota grupy liczona i zapisana jak w v19', async () => {
  const t = (await utworzListe(db, D, 'Monika'))!;
  const gid = await dodajGrupe(db, D, t, 'Alex', KLASYK, KLASYK.pakiety[0]);
  const org = (await wczytajDzien(db, D)).grupy[0].gracze[0].id;
  const ola = await dodajGracza(db, gid, 'Ola');
  await dodajKulki(db, org, 500, false);
  await dodajKulki(db, org, 200, true);
  await dodajDym(db, ola, 1, 10);
  await dodajDym(db, ola, 2, 20); // dopisuje się do istniejącego dymu
  await dodajInne(db, ola, 'Mundur', 10);
  let g = (await wczytajDzien(db, D)).grupy[0];
  assert.equal(g.gracze[1].pozycje.filter((p) => p.rodzaj === 'dym').length, 1);
  assert.equal(g.w_dym, 3);
  // 2 × 130 + 200 dokupionych (30 zł) + dym 30 + mundur 10
  assert.equal(g.w_kwota, 260 + 30 + 30 + 10);
  assert.equal(g.w_kulki, 700);

  await zmienGrupe(db, gid, { gracze_reczne: 10, zadatek: 100, platnosc: 'Karta' });
  g = (await wczytajDzien(db, D)).grupy[0];
  assert.equal(g.w_gracze, 10);
  assert.equal(g.w_kwota, 1300 + 70);
  assert.equal(g.wynik.doZap, 1270);

  await usunPozycje(db, g.gracze[1].pozycje.find((p) => p.rodzaj === 'inne')!.id);
  await usunGracza(db, ola);
  g = (await wczytajDzien(db, D)).grupy[0];
  assert.equal(g.gracze.length, 1);
  assert.equal(g.w_kwota, 1300 + 30);

  await zmienGrupe(db, gid, { kwota_reczna: 1000 });
  assert.equal((await wczytajDzien(db, D)).grupy[0].w_kwota, 1000);
});

test('Pakiet grupowy (Gotcha) bez organizatora', async () => {
  const t = (await utworzListe(db, D, 'Monika'))!;
  const gid = await dodajGrupe(db, D, t, '', GOTCHA, GOTCHA.pakiety[0]);
  await zmienGrupe(db, gid, { gracze_reczne: 12 });
  const g = (await wczytajDzien(db, D)).grupy[0];
  assert.equal(g.gracze.length, 0);
  assert.equal(g.w_kwota, 850 + 2 * 70);
});

test('Najnowsza grupa na górze; usunięcie instruktora zabiera jego grupy; usunięcie listy', async () => {
  const t1 = (await utworzListe(db, D, 'Monika'))!;
  const t2 = (await utworzListe(db, D, 'Janek'))!;
  await dodajGrupe(db, D, t1, 'Pierwsza', KLASYK, KLASYK.pakiety[0]);
  await new Promise((r) => setTimeout(r, 5));
  await dodajGrupe(db, D, t2, 'Druga', KLASYK, KLASYK.pakiety[0]);
  let dz = await wczytajDzien(db, D);
  assert.deepEqual(dz.grupy.map((g) => g.organizator), ['Druga', 'Pierwsza']);

  await usunInstruktora(db, t2);
  dz = await wczytajDzien(db, D);
  assert.deepEqual(dz.instruktorzy.map((i) => i.imie), ['Monika']);
  assert.deepEqual(dz.grupy.map((g) => g.organizator), ['Pierwsza']);

  await usunListe(db, D);
  dz = await wczytajDzien(db, D);
  assert.equal(dz.lista, null);
  assert.equal(dz.grupy.length, 0);
  assert.deepEqual(await datyList(db), []);
  assert.ok((await liczNiewyslane(db)) > 0, 'usunięcia czekają w kolejce na serwer');
});

test('Własny sprzęt bez podstawy, worki, inny pakiet gracza, dodatki i faktura', async () => {
  const t = (await utworzListe(db, D, 'Monika'))!;
  const gid = await dodajGrupe(db, D, t, '', KLASYK, KLASYK.pakiety[0]);
  const a = await dodajGracza(db, gid, 'Ania');
  const b = await dodajGracza(db, gid, 'Bartek');
  // Ania: własny sprzęt (40) + 2 worki po 40 zł → bez podstawy 130
  await zmienGracza(db, a, { sprzet: [{ nazwa: 'Własny', kwota: 40, i: 0 }] });
  await dodajWorek(db, a, { szt: 500, cena: 40 });
  await dodajWorek(db, a, { szt: 500, cena: 40 });
  // Bartek: inny pakiet (MAXI 180)
  await zmienGracza(db, b, { pakiet_nazwa: 'Pakiet MAXI', pakiet_kulki: 1000, pakiet_cena: 180 });
  let g = (await wczytajDzien(db, D)).grupy[0];
  assert.equal(g.w_kwota, 40 + 80 + 180);
  assert.equal(g.w_kulki, 1000);
  assert.equal(g.gracze[0].worki_ilosc, 2);

  await dodajDodatek(db, gid, 'Ognisko', 200);
  await dodajDodatek(db, gid, 'Dyplomy', 0);
  g = (await wczytajDzien(db, D)).grupy[0];
  assert.equal(g.dodatki.length, 2);
  assert.equal(g.w_kwota, 300 + 200);
  await usunDodatek(db, g.dodatki[0].id);
  assert.equal((await wczytajDzien(db, D)).grupy[0].w_kwota, 300);

  await zapiszFakture(db, { grupa_id: gid, nip: ' 1234567890 ', tel: '500', email: 'a@b.pl', kwota: 300, platnosc: 'Przelew' });
  g = (await wczytajDzien(db, D)).grupy[0];
  assert.equal(g.faktura?.nip, '1234567890');
  await usunFakture(db, gid);
  assert.equal((await wczytajDzien(db, D)).grupy[0].faktura, null);
  await zapiszFakture(db, { grupa_id: gid, nip: '1', tel: '2', email: 'c@d.pl', kwota: 1, platnosc: 'Karta' });
  assert.equal((await wczytajDzien(db, D)).grupy[0].faktura?.platnosc, 'Karta', 'faktura przywrócona po „Bez faktury”');
});

test('Wydatki, pensje (zaokrąglenie do 10 zł) i podsumowanie dnia', async () => {
  const t = (await utworzListe(db, D, 'Monika'))!;
  const gid = await dodajGrupe(db, D, t, '', KLASYK, KLASYK.pakiety[0]);
  await zmienGrupe(db, gid, { gracze_reczne: 10, zadatek: 100 });
  await zapiszWydatek(db, D, { opis: 'Paliwo', kwota: 150, uwagi: 'Orlen' });
  await zapiszWydatek(db, D, { opis: 'Woda', kwota: 20.5, uwagi: '' });
  await dodajPensje(db, D, { imie: 'Janek', prac_id: 'pr1', godziny: 7.5, stawka: 30, premia_stawka: 5 });
  let dz = await wczytajDzien(db, D);
  assert.equal(dz.pensje[0].kwota, 230); // 225 → 230
  assert.deepEqual(
    { b: dz.podsumowanie.brutto, z: dz.podsumowanie.zadatki, w: dz.podsumowanie.wydatki, p: dz.podsumowanie.pensje, n: dz.podsumowanie.netto },
    { b: 1300, z: 100, w: 170.5, p: 230, n: 1300 - 170.5 - 230 },
  );
  // edycja wydatku (to samo id), godzin (przelicza) i kwoty (ręcznie)
  await zapiszWydatek(db, D, { id: dz.wydatki[0].id, opis: 'Paliwo', kwota: 160, uwagi: '' });
  await zmienPensje(db, dz.pensje[0].id, { godziny: 8 });
  dz = await wczytajDzien(db, D);
  assert.equal(dz.wydatki.length, 2);
  assert.equal(dz.wydatki[0].kwota, 160);
  assert.equal(dz.pensje[0].kwota, 240);
  await zmienPensje(db, dz.pensje[0].id, { kwota: 250 });
  assert.equal((await wczytajDzien(db, D)).pensje[0].kwota, 250);
  await usunWydatek(db, dz.wydatki[1].id);
  await usunPensje(db, dz.pensje[0].id);
  dz = await wczytajDzien(db, D);
  assert.equal(dz.podsumowanie.wydatki, 160);
  assert.equal(dz.podsumowanie.pensje, 0);
});

test('Archiwum: listy z miesiąca z liczbą grup i utargiem, od najnowszej; usunięte znikają', async () => {
  const t = (await utworzListe(db, D, 'Monika'))!;
  await dodajGrupe(db, D, t, 'Alex', KLASYK, KLASYK.pakiety[0]);
  await dodajGrupe(db, D, t, 'Ola', KLASYK, KLASYK.pakiety[0]);
  await utworzListe(db, '2026-10-05', 'Janek');
  await utworzListe(db, '2026-09-30', 'Janek');
  const paz = await listyMiesiaca(db, '2026-10');
  assert.deepEqual(
    paz.map((l) => [l.data, l.grupy, l.brutto, l.wyslane]),
    [
      ['2026-10-05', 0, 0, false],
      [D, 2, 260, false],
    ],
  );
  await usunListe(db, '2026-10-05');
  assert.deepEqual((await listyMiesiaca(db, '2026-10')).map((l) => l.data), [D]);
  assert.deepEqual((await listyMiesiaca(db, '2026-09')).map((l) => l.data), ['2026-09-30']);
});

test('Raport PDF: grupy od najstarszej, pensja tylko podstawa (bez premii), podsumowanie dnia', async () => {
  const { htmlRaportu } = await import('../src/logika/raport');
  const t = (await utworzListe(db, D, 'Monika'))!;
  await dodajGrupe(db, D, t, 'Pierwszy <b>', KLASYK, KLASYK.pakiety[0]);
  await new Promise((r) => setTimeout(r, 5));
  await dodajGrupe(db, D, t, 'Drugi', KLASYK, KLASYK.pakiety[0]);
  await zapiszWydatek(db, D, { opis: 'Paliwo', kwota: 150, uwagi: '' });
  await dodajPensje(db, D, { imie: 'Janek', prac_id: 'pr1', godziny: 7.5, stawka: 30, premia_stawka: 5 });
  const html = htmlRaportu(await wczytajDzien(db, D), null);
  assert.ok(html.indexOf('Pierwszy &lt;b&gt;') < html.indexOf('Drugi'), 'najstarsza grupa pierwsza, tekst bezpieczny');
  assert.match(html, /Janek<\/td><td class="r">7,5 h<\/td><td class="r">30 zł\/h<\/td><td class="r">230 zł/);
  assert.doesNotMatch(html, /premi/i);
  assert.doesNotMatch(html, /267|37,5/); // 7,5 h × 5 zł premii nigdzie
  assert.match(html, /Podsumowanie dnia/);
  assert.match(html, /Wydatki<\/td><td class="r">− 150 zł/);
});
