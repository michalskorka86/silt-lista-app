import { useEffect, useEffectEvent, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { num } from '@/logika/format';
import { useMotyw } from '@/theme/motyw';

import { Numpad, type NumpadUstawienia } from './Numpad';

/**
 * Pole na kwotę / ilość — wygląda jak `Pole`, ale zamiast klawiatury systemowej otwiera klawiaturę aplikacji (Numpad).
 * Wartość jak w zwykłym polu: tekst z przecinkiem („12,5”). Systemowa klawiatura zostaje tylko przy NIP, telefonie, e-mailu i kartce.
 */
export function PoleLiczby({
  etykieta,
  value,
  onChangeText,
  placeholder = '0',
  autoOtworz,
  tytul,
}: {
  etykieta: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  /** od razu po otwarciu okna pokaż klawiaturę (zamiast autoFocus) */
  autoOtworz?: boolean;
  /** tytuł klawiatury, gdy ma być inny niż etykieta */
  tytul?: string;
}) {
  const { c } = useMotyw();
  // własna klawiatura (nie ta wspólna z Komunikatów) — żeby zawsze była NAD oknem, w którym jest pole
  const [np, setNp] = useState<NumpadUstawienia | null>(null);

  const otworz = () =>
    setNp({
      tytul: tytul ?? etykieta,
      wartosc: value.trim() ? num(value) : null,
      onOk: (v) => onChangeText(String(v).replace('.', ',')),
    });

  const otworzNaStart = useEffectEvent(otworz);
  useEffect(() => {
    if (!autoOtworz) return;
    const t = setTimeout(() => otworzNaStart(), 250); // po animacji okna
    return () => clearTimeout(t);
  }, [autoOtworz]);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: c.text2 }]}>{etykieta}</Text>
      <Pressable
        onPress={otworz}
        accessibilityRole="button"
        accessibilityLabel={etykieta}
        style={({ pressed }) => [styles.input, { backgroundColor: c.surface2, borderColor: pressed ? c.accent : c.border }]}>
        <Text style={[styles.txt, { color: value.trim() ? c.text : c.text3 }]}>{value.trim() || placeholder}</Text>
      </Pressable>
      <Numpad ustawienia={np} onZamknij={() => setNp(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 5, marginBottom: 12, flex: 1 },
  label: { fontFamily: Fonts.bold, fontSize: 12 },
  input: { borderWidth: 1, borderRadius: 8, paddingVertical: 11, paddingHorizontal: 12, minHeight: 46, justifyContent: 'center' },
  txt: { fontFamily: Fonts.semibold, fontSize: 15 },
});
