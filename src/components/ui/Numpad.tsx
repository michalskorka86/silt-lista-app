import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Size } from '@/constants/theme';
import { num } from '@/logika/format';
import { useMotyw } from '@/theme/motyw';

import { Okno } from './Okno';

export type NumpadUstawienia = {
  tytul: string;
  wartosc?: number | null;
  onOk: (v: number) => void;
  /** dodatkowy przycisk pod klawiaturą, np. „↺ Licz automatycznie (1 395 zł)” */
  extra?: { tekst: string; onPress: () => void };
};

/** Klawiatura numeryczna z v19 (ov-numpad): 7-8-9 / 4-5-6 / 1-2-3 / , 0 ⌫ / OK →. */
export function Numpad({ ustawienia, onZamknij }: { ustawienia: NumpadUstawienia | null; onZamknij: () => void }) {
  return (
    <Okno widoczne={!!ustawienia} onZamknij={onZamknij} tytul={ustawienia?.tytul} rozmiar="sm">
      {ustawienia ? <Klawiatura ustawienia={ustawienia} onZamknij={onZamknij} /> : null}
    </Okno>
  );
}

function Klawiatura({ ustawienia, onZamknij }: { ustawienia: NumpadUstawienia; onZamknij: () => void }) {
  const { c } = useMotyw();
  const [val, setVal] = useState(ustawienia.wartosc ? String(ustawienia.wartosc).replace('.', ',') : '');

  const klawisz = (k: string) => {
    if (k === 'del') setVal((v) => v.slice(0, -1));
    else if (k === 'ok') {
      onZamknij();
      ustawienia.onOk(num(val));
    } else if (k === ',') setVal((v) => (v.includes(',') ? v : (v || '0') + ','));
    else setVal((v) => (v.length >= 9 ? v : (v === '0' ? '' : v) + k));
  };

  return (
    <>
      <View style={[styles.display, { backgroundColor: c.surface2, borderColor: c.border }]}>
        <Text style={[styles.displayTxt, { color: c.accent }]}>{val || '0'}</Text>
      </View>
      <View style={styles.grid}>
        {['7', '8', '9', '4', '5', '6', '1', '2', '3', ','].map((k) => (
          <Klawisz key={k} k={k} onPress={klawisz} />
        ))}
        <Klawisz k="0" onPress={klawisz} />
        <Klawisz k="del" label="⌫" styl="del" onPress={klawisz} />
        <Klawisz k="ok" label="OK →" styl="ok" onPress={klawisz} />
      </View>
      {ustawienia.extra ? (
        <Pressable
          onPress={() => {
            onZamknij();
            ustawienia.extra!.onPress();
          }}
          style={[styles.extra, { borderColor: c.border2 }]}>
          <Text style={[styles.extraTxt, { color: c.text2 }]}>{ustawienia.extra.tekst}</Text>
        </Pressable>
      ) : null}
    </>
  );
}

function Klawisz({ k, label, styl, onPress }: { k: string; label?: string; styl?: 'del' | 'ok'; onPress: (k: string) => void }) {
  const { c } = useMotyw();
  return (
    <Pressable
      onPress={() => onPress(k)}
      style={({ pressed }) => [
        styles.key,
        { backgroundColor: c.surface2, borderColor: c.border },
        styl === 'del' && { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' },
        styl === 'ok' && { backgroundColor: c.accent, borderColor: c.accent, flexBasis: '100%' },
        pressed && { transform: [{ scale: 0.94 }] },
      ]}>
      <Text style={[styles.keyTxt, { color: styl === 'del' ? c.red : styl === 'ok' ? '#fff' : c.text }]}>{label ?? k}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  display: { borderWidth: 1, borderRadius: Size.r, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 14, minHeight: 58 },
  displayTxt: { fontFamily: Fonts.extrabold, fontSize: 30, textAlign: 'right' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  key: {
    flexGrow: 1,
    flexBasis: '30%',
    paddingVertical: 17,
    borderRadius: Size.r,
    borderWidth: 1,
    alignItems: 'center',
  },
  keyTxt: { fontFamily: Fonts.extrabold, fontSize: 21 },
  extra: { marginTop: 8, padding: 12, borderRadius: Size.r, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center' },
  extraTxt: { fontFamily: Fonts.bold, fontSize: 14 },
});
