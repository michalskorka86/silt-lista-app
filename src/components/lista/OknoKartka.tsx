import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Fonts, Size } from '@/constants/theme';
import { dodajZKartki, pustyWiersz, type WierszKartki } from '@/logika/kartka';
import type { GrupaPelna } from '@/logika/lista';
import { BladSerwera } from '@/sync/klient';
import { useSync } from '@/sync/SyncProvider';
import { useMotyw } from '@/theme/motyw';

import { zglos } from '../bledy/zglos';
import { useKomunikaty } from '../ui/Komunikaty';
import { Okno, Przycisk, Przyciski } from '../ui/Okno';
import { wezZdjecie } from './zdjecie';

/** 📷 Gracze ze zdjęcia kartki (ov-ocr z v19): zdjęcie → odczyt na serwerze → tabela do poprawienia → „Dodaj graczy ✓”. */
export function OknoKartka({ grupa, dymCena, onZamknij }: { grupa: GrupaPelna | null; dymCena: number; onZamknij: () => void }) {
  return (
    <Okno widoczne={!!grupa} onZamknij={onZamknij} tytul="📷 Gracze ze zdjęcia kartki" rozmiar="lg">
      {grupa ? <Tresc grupa={grupa} dymCena={dymCena} onZamknij={onZamknij} /> : null}
    </Okno>
  );
}

type Etap = 'wybor' | 'odczyt' | 'tabela';

function Tresc({ grupa, dymCena, onZamknij }: { grupa: GrupaPelna; dymCena: number; onZamknij: () => void }) {
  const { c } = useMotyw();
  const db = useSQLiteContext();
  const { toast } = useKomunikaty();
  const { odczytajKartke } = useSync();
  const [etap, setEtap] = useState<Etap>('wybor');
  const [zdjecie, setZdjecie] = useState<string | null>(null);
  const [info, setInfo] = useState('');
  const [wiersze, setWiersze] = useState<WierszKartki[]>([]);
  const [zapis, setZapis] = useState(false);

  const zrob = async (zrodlo: 'aparat' | 'galeria') => {
    let z;
    try {
      z = await wezZdjecie(zrodlo);
    } catch (e) {
      setInfo(`❌ ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    if (!z) return;
    setZdjecie(z.uri);
    setEtap('odczyt');
    setInfo('⏳ Odczytuję kartkę… (zwykle kilkanaście sekund)');
    try {
      const w = await odczytajKartke(z.base64);
      setWiersze(w.length ? w : [pustyWiersz()]);
      setInfo(w.length ? `Odczytano ${w.length} ${w.length === 1 ? 'wiersz' : 'wierszy'} — sprawdź przed dodaniem.` : 'Nie udało się odczytać wierszy — wpisz ręcznie albo zrób wyraźniejsze zdjęcie.');
    } catch (e) {
      setWiersze([pustyWiersz()]);
      if (e instanceof BladSerwera) {
        setInfo(e.kod === 'ocr_konfiguracja' ? '⚠️ Odczyt zdjęć nie jest jeszcze włączony na serwerze — wpisz graczy poniżej.' : `⚠️ ${e.message}`);
        if (e.kod !== 'ocr_konfiguracja' && e.kod !== 'ocr_nieczytelne') zglos(e, { dopisek: 'Zdjęcie kartki' });
      } else setInfo('📴 Odczyt zdjęcia wymaga internetu — wpisz graczy poniżej albo spróbuj przy zasięgu.');
    }
    setEtap('tabela');
  };

  const zmien = (i: number, pole: keyof WierszKartki, v: string) => setWiersze((w) => w.map((x, j) => (j === i ? { ...x, [pole]: v } : x)));

  const dodaj = async () => {
    if (zapis) return;
    setZapis(true);
    try {
      const n = await dodajZKartki(db, grupa.id, wiersze, dymCena);
      onZamknij();
      toast(n ? `✅ Dodano / uzupełniono graczy: ${n}` : 'Nikogo nie dodano (brak imion)');
    } finally {
      setZapis(false);
    }
  };

  if (etap === 'wybor')
    return (
      <>
        <Text style={[styles.info, { color: c.text2 }]}>
          Zrób zdjęcie kartki z imionami i kulkami (np. „Alex 100 100 | 500 dym”). Aplikacja odczyta graczy — przed dodaniem możesz
          wszystko poprawić.
        </Text>
        {info ? <Text style={[styles.info, { color: c.red }]}>{info}</Text> : null}
        <View style={styles.wybor}>
          <Kafel ico="📷" tekst="Zrób zdjęcie" onPress={() => zrob('aparat')} />
          <Kafel ico="🖼️" tekst="Wybierz z galerii" onPress={() => zrob('galeria')} />
        </View>
        <Przyciski>
          <Przycisk tekst="Anuluj" rodzaj="anuluj" onPress={onZamknij} />
        </Przyciski>
      </>
    );

  return (
    <>
      {zdjecie ? <Image source={{ uri: zdjecie }} style={styles.zdjecie} resizeMode="contain" /> : null}
      <View style={styles.status}>
        {etap === 'odczyt' ? <ActivityIndicator color={c.accent} /> : null}
        <Text style={[styles.info, { color: c.text2 }]}>{info}</Text>
      </View>
      {etap === 'tabela' ? (
        <>
          <View style={styles.wiersz}>
            {['Imię', 'Kulki z pakietu', 'Dokupione (po kresce)', 'Dym'].map((t, i) => (
              <Text key={t} style={[styles.naglowek, { color: c.text2 }, KOL[i]]}>
                {t.toUpperCase()}
              </Text>
            ))}
            <View style={styles.usunMiejsce} />
          </View>
          {wiersze.map((w, i) => (
            <View key={i} style={styles.wiersz}>
              <Wejscie wartosc={w.imie} onZmiana={(v) => zmien(i, 'imie', v)} placeholder="Imię" styl={KOL[0]} />
              <Wejscie wartosc={w.pak} onZmiana={(v) => zmien(i, 'pak', v)} placeholder="np. 100 100" liczby styl={KOL[1]} />
              <Wejscie wartosc={w.dok} onZmiana={(v) => zmien(i, 'dok', v)} placeholder="np. 500" liczby styl={KOL[2]} />
              <Wejscie wartosc={w.dym} onZmiana={(v) => zmien(i, 'dym', v)} placeholder="0" liczby styl={KOL[3]} />
              <Pressable onPress={() => setWiersze((x) => x.filter((_, j) => j !== i))} style={styles.usun} accessibilityLabel="Usuń wiersz">
                <Text style={[styles.usunTxt, { color: c.text3 }]}>✕</Text>
              </Pressable>
            </View>
          ))}
          <Pressable onPress={() => setWiersze((x) => [...x, pustyWiersz()])} style={[styles.dodajWiersz, { borderColor: c.border2 }]}>
            <Text style={[styles.dodajWierszTxt, { color: c.text2 }]}>＋ Dodaj wiersz</Text>
          </Pressable>
        </>
      ) : null}
      <Przyciski>
        <Przycisk tekst="📷 Nowe zdjęcie" rodzaj="anuluj" onPress={() => setEtap('wybor')} wylaczony={etap === 'odczyt'} />
        <Przycisk tekst="Anuluj" rodzaj="anuluj" onPress={onZamknij} />
        <Przycisk tekst={zapis ? '⏳' : 'Dodaj graczy ✓'} onPress={dodaj} wylaczony={etap !== 'tabela' || zapis || !wiersze.some((w) => w.imie.trim())} />
      </Przyciski>
    </>
  );
}

const KOL = [{ flex: 1.4 }, { flex: 1.3 }, { flex: 1 }, { flex: 0.5 }] as const;

function Wejscie({
  wartosc,
  onZmiana,
  placeholder,
  liczby,
  styl,
}: {
  wartosc: string;
  onZmiana: (v: string) => void;
  placeholder: string;
  liczby?: boolean;
  styl: object;
}) {
  const { c } = useMotyw();
  return (
    <TextInput
      value={wartosc}
      onChangeText={onZmiana}
      placeholder={placeholder}
      placeholderTextColor={c.text3}
      keyboardType={liczby ? 'numbers-and-punctuation' : 'default'}
      autoCapitalize={liczby ? 'none' : 'words'}
      style={[styles.pole, { backgroundColor: c.surface2, borderColor: c.border, color: c.text }, styl]}
    />
  );
}

function Kafel({ ico, tekst, onPress }: { ico: string; tekst: string; onPress: () => void }) {
  const { c } = useMotyw();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.kafel, { backgroundColor: pressed ? c.accentSoft : c.surface2, borderColor: pressed ? c.accent : c.border }]}>
      <Text style={styles.kafelIco}>{ico}</Text>
      <Text style={[styles.kafelTxt, { color: c.text }]}>{tekst}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  info: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, flexShrink: 1 },
  wybor: { flexDirection: 'row', gap: 12, marginTop: 14 },
  kafel: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 22, borderRadius: 16, borderWidth: 2 },
  kafelIco: { fontSize: 38 },
  kafelTxt: { fontFamily: Fonts.extrabold, fontSize: 15 },
  zdjecie: { width: '100%', height: 200, borderRadius: 10, marginBottom: 10 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  wiersz: { flexDirection: 'row', gap: 6, marginBottom: 6, alignItems: 'center' },
  naglowek: { fontFamily: Fonts.extrabold, fontSize: 10, letterSpacing: 0.4 },
  pole: { borderWidth: 1, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 10, fontFamily: Fonts.semibold, fontSize: 15, minWidth: 0 },
  usunMiejsce: { width: 36 },
  usun: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  usunTxt: { fontSize: 16 },
  dodajWiersz: { marginTop: 4, padding: 10, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: Size.r, alignItems: 'center' },
  dodajWierszTxt: { fontFamily: Fonts.bold, fontSize: 13 },
});
