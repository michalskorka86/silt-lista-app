import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import type { Wiersz } from '@/db/tabele';
import { num, zl } from '@/logika/format';
import { dodajPensje, zapiszWydatek } from '@/logika/lista';
import { round10 } from '@/logika/obliczenia';
import type { Pracownik } from '@/sync/synchronizacja';
import { useMotyw } from '@/theme/motyw';

import { useKomunikaty } from '../ui/Komunikaty';
import { Okno, Przycisk, Przyciski } from '../ui/Okno';
import { Podpowiedz, Pole, Rzad } from '../ui/Pole';
import { PoleLiczby } from '../ui/PoleLiczby';

// ── Wydatek ───────────────────────────────────────────────────

type StanWydatku = { wydatek?: Wiersz<'wydatki'> };

export function OknoWydatek({ data, stan, onZamknij }: { data: string; stan: StanWydatku | null; onZamknij: () => void }) {
  return (
    <Okno widoczne={!!stan} onZamknij={onZamknij} tytul="💸 Wydatek" rozmiar="sm">
      {stan ? <TrescWydatek data={data} stan={stan} onZamknij={onZamknij} /> : null}
    </Okno>
  );
}

function TrescWydatek({ data, stan, onZamknij }: { data: string; stan: StanWydatku; onZamknij: () => void }) {
  const db = useSQLiteContext();
  const { toast } = useKomunikaty();
  const w = stan.wydatek;
  const [opis, setOpis] = useState(w?.opis ?? '');
  const [kwota, setKwota] = useState(w ? String(w.kwota) : '');
  const [uwagi, setUwagi] = useState(w?.uwagi ?? '');

  const zapisz = async () => {
    if (!opis.trim()) return toast('Podaj opis wydatku');
    onZamknij();
    await zapiszWydatek(db, data, { id: w?.id, opis, kwota: num(kwota), uwagi });
  };

  return (
    <>
      <Pole etykieta="Opis" value={opis} onChangeText={setOpis} placeholder="np. Paliwo, woda" maxLength={60} autoFocus={!w} />
      <PoleLiczby etykieta="Kwota (zł)" value={kwota} onChangeText={setKwota} tytul={opis.trim() ? `${opis.trim()} — kwota (zł)` : 'Wydatek — kwota (zł)'} />
      <Pole
        etykieta="Uwagi (drukują się w PDF)"
        value={uwagi}
        onChangeText={setUwagi}
        placeholder="np. paragon u Janka"
        multiline
        numberOfLines={2}
        maxLength={250}
        style={styles.uwagi}
      />
      <Przyciski>
        <Przycisk tekst="Anuluj" rodzaj="anuluj" onPress={onZamknij} />
        <Przycisk tekst="Zapisz ✓" onPress={zapisz} />
      </Przyciski>
    </>
  );
}

// ── Pensja instruktora ────────────────────────────────────────

export function OknoPensja({
  data,
  widoczne,
  pracownicy,
  onZamknij,
}: {
  data: string;
  widoczne: boolean;
  pracownicy: Pracownik[];
  onZamknij: () => void;
}) {
  return (
    <Okno widoczne={widoczne} onZamknij={onZamknij} tytul="👷 Pensja instruktora" rozmiar="sm">
      {widoczne ? <TrescPensja data={data} pracownicy={pracownicy} onZamknij={onZamknij} /> : null}
    </Okno>
  );
}

const INNY = -1;

function TrescPensja({ data, pracownicy, onZamknij }: { data: string; pracownicy: Pracownik[]; onZamknij: () => void }) {
  const { c } = useMotyw();
  const db = useSQLiteContext();
  const { toast } = useKomunikaty();
  const [wybor, setWybor] = useState<number | null>(null); // indeks pracownika albo INNY
  const [lista, setLista] = useState(false);
  const [imie, setImie] = useState('');
  const [godz, setGodz] = useState('');
  const [stawka, setStawka] = useState('');

  const prac = wybor !== null && wybor >= 0 ? pracownicy[wybor] : null;
  const g = num(godz);
  const st = num(stawka);

  const wybierz = (i: number) => {
    setWybor(i);
    setLista(false);
    if (i >= 0) setStawka(String(pracownicy[i].stawka));
  };

  const zapisz = async () => {
    const im = wybor === INNY ? imie.trim() : (prac?.imie ?? '');
    if (!im) return toast('Wybierz instruktora');
    if (!g) return toast('Podaj liczbę godzin');
    onZamknij();
    await dodajPensje(db, data, { imie: im, prac_id: prac?.id ?? '', godziny: g, stawka: st, premia_stawka: prac?.premia ?? 0 });
  };

  const etykieta = wybor === null ? '— wybierz —' : wybor === INNY ? '➕ Inny (wpisz ręcznie)' : `${prac!.imie} (${prac!.stawka} zł/h)`;

  return (
    <>
      <View style={styles.pole}>
        <Text style={[styles.label, { color: c.text2 }]}>Instruktor</Text>
        <Pressable onPress={() => setLista((x) => !x)} style={[styles.select, { backgroundColor: c.surface2, borderColor: lista ? c.accent : c.border }]}>
          <Text style={[styles.selectTxt, { color: wybor === null ? c.text3 : c.text }]}>{etykieta}</Text>
          <Text style={[styles.selectTxt, { color: c.text2 }]}>{lista ? '▲' : '▼'}</Text>
        </Pressable>
        {lista ? (
          <View style={[styles.opcje, { backgroundColor: c.surface2, borderColor: c.border }]}>
            {pracownicy.map((p, i) => (
              <Pressable key={p.id || p.imie} onPress={() => wybierz(i)} style={({ pressed }) => [styles.opcja, { borderBottomColor: c.border }, pressed && { backgroundColor: c.accentSoft }]}>
                <Text style={[styles.opcjaTxt, { color: c.text }]}>
                  {p.imie} ({p.stawka} zł/h)
                </Text>
              </Pressable>
            ))}
            <Pressable onPress={() => wybierz(INNY)} style={({ pressed }) => [styles.opcja, pressed && { backgroundColor: c.accentSoft }]}>
              <Text style={[styles.opcjaTxt, { color: c.text }]}>➕ Inny (wpisz ręcznie)</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {wybor === INNY ? <Pole etykieta="Imię i nazwisko" value={imie} onChangeText={setImie} maxLength={50} autoFocus autoCapitalize="words" /> : null}
      <Podpowiedz>
        {pracownicy.length
          ? `Pracownicy ze statystyk: ${pracownicy.length}`
          : 'Brak listy pracowników ze statystyk (tablet pobierze ją przy zasięgu) — wpisz ręcznie.'}
      </Podpowiedz>
      <Rzad>
        <PoleLiczby etykieta="Godziny" value={godz} onChangeText={setGodz} />
        <PoleLiczby etykieta="Stawka (zł/h)" value={stawka} onChangeText={setStawka} />
      </Rzad>
      {g ? (
        <Podpowiedz>
          Pensja (podstawa): {String(g).replace('.', ',')} h × {zl(st)} = {zl(g * st)}
          {round10(g * st) !== g * st ? ` → ${zl(round10(g * st))} (zaokrąglone)` : ''}
        </Podpowiedz>
      ) : null}
      <Przyciski>
        <Przycisk tekst="Anuluj" rodzaj="anuluj" onPress={onZamknij} />
        <Przycisk tekst="Dodaj ✓" onPress={zapisz} />
      </Przyciski>
    </>
  );
}

const styles = StyleSheet.create({
  uwagi: { minHeight: 64, textAlignVertical: 'top' },
  pole: { gap: 5, marginBottom: 12 },
  label: { fontFamily: Fonts.bold, fontSize: 12 },
  select: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingVertical: 11, paddingHorizontal: 12 },
  selectTxt: { fontFamily: Fonts.semibold, fontSize: 15 },
  opcje: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  opcja: { paddingVertical: 13, paddingHorizontal: 12, borderBottomWidth: 1 },
  opcjaTxt: { fontFamily: Fonts.semibold, fontSize: 15 },
});
