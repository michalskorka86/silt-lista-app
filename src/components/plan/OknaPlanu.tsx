import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import type { Pakowanie, PlanDzien } from '@/db/tabele';
import type { Cennik } from '@/logika/cennik';
import { num } from '@/logika/format';
import { usunGrupePlanu, zapiszDzienPlanu, zapiszGrupePlanu, type GrupaPlanu } from '@/logika/plan';
import { useMotyw } from '@/theme/motyw';

import { useKomunikaty } from '../ui/Komunikaty';
import { Okno, Przycisk, Przyciski } from '../ui/Okno';
import { Podpowiedz, Pole, Rzad } from '../ui/Pole';
import { PoleLiczby } from '../ui/PoleLiczby';

// ── Grupa w planie (dodanie / poprawka z PIN-em) ──────────────

export function OknoGrupyPlanu({
  stan,
  cennik,
  onZamknij,
}: {
  /** null = zamknięte; { data } = nowa grupa; { data, grupa } = poprawka */
  stan: { data: string; grupa?: GrupaPlanu } | null;
  cennik: Cennik | null;
  onZamknij: () => void;
}) {
  return (
    <Okno widoczne={!!stan} onZamknij={onZamknij} tytul={stan?.grupa ? '✏️ Grupa w planie' : '＋ Grupa do planu'} rozmiar="lg">
      {stan ? <TrescGrupyPlanu key={stan.grupa?.id ?? 'nowa'} data={stan.data} grupa={stan.grupa} cennik={cennik} onZamknij={onZamknij} /> : null}
    </Okno>
  );
}

function TrescGrupyPlanu({ data, grupa, cennik, onZamknij }: { data: string; grupa?: GrupaPlanu; cennik: Cennik | null; onZamknij: () => void }) {
  const db = useSQLiteContext();
  const { c } = useMotyw();
  const { toast, potwierdz } = useKomunikaty();
  const [godzina, setGodzina] = useState(grupa?.godzina ?? '');
  const [org, setOrg] = useState(grupa?.organizator ?? '');
  const [atr, setAtr] = useState(grupa?.atrakcja ?? '');
  const [uwagi, setUwagi] = useState(grupa?.uwagi ?? '');
  const [osoby, setOsoby] = useState(grupa?.osoby ? String(grupa.osoby) : '');
  const [zadatek, setZadatek] = useState(grupa?.zadatek ?? '');

  const zapisz = async () => {
    if (!org.trim()) return toast('Wpisz organizatora');
    await zapiszGrupePlanu(db, data, { godzina, organizator: org, atrakcja: atr, uwagi, osoby: Math.round(num(osoby)), zadatek }, grupa?.id);
    onZamknij();
    toast(grupa ? '✓ Zapisano zmiany w planie' : '✓ Dodano grupę do planu');
  };
  const usun = () =>
    grupa &&
    potwierdz({
      tytul: 'Usuń z planu',
      tekst: `Usunąć grupę „${grupa.organizator}” z planu dnia? Lista instruktora się nie zmienia.`,
      ok: 'Usuń',
      onOk: async () => {
        await usunGrupePlanu(db, grupa.id);
        onZamknij();
      },
    });

  return (
    <>
      <Rzad>
        <Pole etykieta="Godzina" value={godzina} onChangeText={setGodzina} placeholder="09:00" maxLength={20} styleWrap={styles.waskie} />
        <Pole etykieta="Organizator *" value={org} onChangeText={setOrg} placeholder="Imię i nazwisko" maxLength={80} autoCapitalize="words" />
      </Rzad>
      <Text style={[styles.label, { color: c.text2 }]}>Atrakcja</Text>
      <View style={styles.atrGrid}>
        {(cennik?.atrakcje ?? []).map((a) => {
          const wyb = atr === a.klucz;
          return (
            <Pressable key={a.klucz} onPress={() => setAtr(wyb ? '' : a.klucz)} style={[styles.atrTile, { backgroundColor: a.kolor, borderColor: wyb ? '#fff' : 'transparent' }]}>
              <Text style={styles.atrTxt}>{a.stat === 'GOTHA' ? 'GOTCHA' : a.stat.replace('PAINTBALL ', '')}</Text>
              {wyb ? <Text style={styles.atrCheck}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <Pole etykieta="Uwagi" value={uwagi} onChangeText={setUwagi} placeholder="pakiet, ognisko, wiata…" maxLength={500} multiline style={styles.uwagi} />
      <Rzad>
        <PoleLiczby etykieta="Ilość osób" value={osoby} onChangeText={setOsoby} tytul="Ilość osób w planie" />
        <View style={styles.flex}>
          <Text style={[styles.label, { color: c.text2 }]}>Zadatek</Text>
          <View style={styles.zadRzad}>
            {['TAK', 'NIE'].map((z) => (
              <Pressable
                key={z}
                onPress={() => setZadatek(zadatek === z ? '' : z)}
                style={[styles.zad, { borderColor: zadatek === z ? c.accent : c.border, backgroundColor: zadatek === z ? 'rgba(249,115,22,0.12)' : c.surface2 }]}>
                <Text style={[styles.zadTxt, { color: c.text }]}>{z}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Rzad>
      <Przyciski>
        {grupa ? <Przycisk tekst="🗑 Usuń" rodzaj="usun" onPress={usun} rozciagnij={false} /> : null}
        <Przycisk tekst="Anuluj" rodzaj="anuluj" onPress={onZamknij} />
        <Przycisk tekst="Zapisz ✓" onPress={zapisz} />
      </Przyciski>
    </>
  );
}

// ── Do spakowania (liczby z rozpiski) ─────────────────────────

const POLA: { klucz: keyof Omit<Pakowanie, 'naraz'>; nazwa: string }[] = [
  { klucz: 'pb_osoby', nazwa: 'PB — osób' },
  { klucz: 'pb_kartony', nazwa: 'PB — kartonów 0,68' },
  { klucz: 'em_osoby', nazwa: 'EM — osób' },
  { klucz: 'em_kartony', nazwa: 'EM — kartonów' },
  { klucz: 'maski_worki', nazwa: 'Maski — worków' },
  { klucz: 'gotcha_worki', nazwa: 'Gotcha — worków masek' },
];

export function OknoPakowania({
  stan,
  cennik,
  onZamknij,
}: {
  stan: { data: string; dzien: PlanDzien | null } | null;
  cennik: Cennik | null;
  onZamknij: () => void;
}) {
  return (
    <Okno widoczne={!!stan} onZamknij={onZamknij} tytul="🎒 Do spakowania" rozmiar="lg">
      {stan ? <TrescPakowania data={stan.data} dzien={stan.dzien} cennik={cennik} onZamknij={onZamknij} /> : null}
    </Okno>
  );
}

function TrescPakowania({ data, dzien, cennik, onZamknij }: { data: string; dzien: PlanDzien | null; cennik: Cennik | null; onZamknij: () => void }) {
  const db = useSQLiteContext();
  const { c } = useMotyw();
  const { toast } = useKomunikaty();
  const p = dzien?.pakowanie ?? {};
  const [liczby, setLiczby] = useState<Record<string, string>>(() => Object.fromEntries(POLA.map((x) => [x.klucz, p[x.klucz] != null ? String(p[x.klucz]) : ''])));
  const [naraz, setNaraz] = useState<Record<string, string>>(() =>
    Object.fromEntries((cennik?.atrakcje ?? []).map((a) => [a.klucz, p.naraz?.[a.klucz] != null ? String(p.naraz[a.klucz]) : ''])),
  );
  const [doZabrania, setDoZabrania] = useState(dzien?.do_zabrania ?? '');
  const [uwagi, setUwagi] = useState(dzien?.uwagi ?? '');

  const zapisz = async () => {
    const pak: Pakowanie = {};
    for (const x of POLA) if (liczby[x.klucz].trim()) pak[x.klucz] = Math.max(0, Math.round(num(liczby[x.klucz])));
    const nr: Record<string, number> = {};
    for (const [k, v] of Object.entries(naraz)) if (v.trim()) nr[k] = Math.max(0, Math.round(num(v)));
    if (Object.keys(nr).length) pak.naraz = nr;
    await zapiszDzienPlanu(db, data, { pakowanie: Object.keys(pak).length ? pak : null, do_zabrania: doZabrania.trim(), uwagi: uwagi.trim() });
    onZamknij();
    toast('✓ Zapisano');
  };

  const para = (i: number) => (
    <Rzad key={i}>
      {POLA.slice(i, i + 2).map((x) => (
        <PoleLiczby key={x.klucz} etykieta={x.nazwa} value={liczby[x.klucz]} onChangeText={(t) => setLiczby((l) => ({ ...l, [x.klucz]: t }))} />
      ))}
    </Rzad>
  );

  return (
    <>
      {para(0)}
      {para(2)}
      {para(4)}
      <Text style={[styles.label, { color: c.text2 }]}>Graczy w jednym czasie</Text>
      <View style={styles.narazGrid}>
        {(cennik?.atrakcje ?? []).map((a) => (
          <View key={a.klucz} style={styles.narazPole}>
            <PoleLiczby
              etykieta={a.stat === 'GOTHA' ? 'GOTCHA' : a.stat.replace('PAINTBALL ', '')}
              value={naraz[a.klucz] ?? ''}
              onChangeText={(t) => setNaraz((n) => ({ ...n, [a.klucz]: t }))}
            />
          </View>
        ))}
      </View>
      <Pole etykieta="Do zabrania (oddzielaj „/”)" value={doZabrania} onChangeText={setDoZabrania} placeholder="ŚMIESZNE STROJE / ŚWIECE DYMNE / AGREGAT" maxLength={500} multiline style={styles.uwagi} />
      <Pole etykieta="Uwagi do dnia" value={uwagi} onChangeText={setUwagi} maxLength={500} multiline style={styles.uwagi} />
      <Podpowiedz>Zmiana trafi też na stronę planu (lista-api/plan.php).</Podpowiedz>
      <Przyciski>
        <Przycisk tekst="Anuluj" rodzaj="anuluj" onPress={onZamknij} />
        <Przycisk tekst="Zapisz ✓" onPress={zapisz} />
      </Przyciski>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  waskie: { flex: 0, minWidth: 130 },
  label: { fontFamily: Fonts.bold, fontSize: 12, marginBottom: 6 },
  atrGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  atrTile: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, borderWidth: 2, minWidth: 110, alignItems: 'center' },
  atrTxt: { color: '#fff', fontFamily: Fonts.extrabold, fontSize: 13 },
  atrCheck: { position: 'absolute', top: 2, right: 6, color: '#fff', fontFamily: Fonts.black, fontSize: 12 },
  uwagi: { minHeight: 64, textAlignVertical: 'top' },
  zadRzad: { flexDirection: 'row', gap: 8 },
  zad: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  zadTxt: { fontFamily: Fonts.extrabold, fontSize: 15 },
  narazGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10 },
  narazPole: { width: 130 },
});
