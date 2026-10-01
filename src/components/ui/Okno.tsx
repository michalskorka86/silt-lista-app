import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Fonts, Size } from '@/constants/theme';
import { useMotyw } from '@/theme/motyw';

const SZEROKOSC = { sm: 420, md: 560, lg: 760 } as const;

/** Okno jak .overlay/.modal w v19: zawsze popup na środku, przyciemnione tło, tap w tło = zamknij. */
export function Okno({
  widoczne,
  onZamknij,
  tytul,
  podtytul,
  rozmiar = 'md',
  children,
}: {
  widoczne: boolean;
  onZamknij: () => void;
  tytul?: string;
  podtytul?: string;
  rozmiar?: keyof typeof SZEROKOSC;
  children: ReactNode;
}) {
  const { c } = useMotyw();
  const { height } = useWindowDimensions();
  return (
    <Modal visible={widoczne} transparent animationType="fade" onRequestClose={onZamknij} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <Pressable style={styles.tlo} onPress={onZamknij}>
          <Pressable
            onPress={() => {}}
            style={[styles.okno, { backgroundColor: c.surface, maxWidth: SZEROKOSC[rozmiar], maxHeight: height - 32 }]}>
            <ScrollView contentContainerStyle={styles.tresc} keyboardShouldPersistTaps="handled" bounces={false}>
              {tytul ? <Text style={[styles.tytul, { color: c.text }]}>{tytul}</Text> : null}
              {podtytul ? <Text style={[styles.podtytul, { color: c.text2 }]}>{podtytul}</Text> : null}
              {children}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Rząd przycisków na dole okna (.modal-btns). */
export function Przyciski({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.przyciski, style]}>{children}</View>;
}

type RodzajPrzycisku = 'dalej' | 'anuluj' | 'usun' | 'czerwony';

/** Przyciski z v19: btn-next (pomarańczowy), btn-cancel (szary), btn-danger (czerwony obrys), czerwony pełny (potwierdzenie usuwania). */
export function Przycisk({
  tekst,
  onPress,
  rodzaj = 'dalej',
  wylaczony,
  style,
  tekstStyle,
}: {
  tekst: string;
  onPress: () => void;
  rodzaj?: RodzajPrzycisku;
  wylaczony?: boolean;
  style?: StyleProp<ViewStyle>;
  tekstStyle?: StyleProp<TextStyle>;
}) {
  const { c } = useMotyw();
  const tlo =
    rodzaj === 'dalej' ? c.accent : rodzaj === 'czerwony' ? c.red : rodzaj === 'usun' ? 'rgba(239,68,68,0.12)' : c.surface2;
  const ramka = rodzaj === 'anuluj' ? c.border : rodzaj === 'usun' ? 'rgba(239,68,68,0.35)' : tlo;
  const kolor = rodzaj === 'dalej' || rodzaj === 'czerwony' ? '#fff' : rodzaj === 'usun' ? c.red : c.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={wylaczony}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: tlo, borderColor: ramka, opacity: wylaczony ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}>
      <Text
        style={[
          styles.btnTxt,
          { color: kolor, fontFamily: rodzaj === 'anuluj' ? Fonts.bold : Fonts.extrabold },
          tekstStyle,
        ]}
        numberOfLines={2}>
        {tekst}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tlo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  okno: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 20 },
  },
  tresc: { paddingVertical: 20, paddingHorizontal: 18 },
  tytul: { fontFamily: Fonts.extrabold, fontSize: 18, marginBottom: 14 },
  podtytul: { fontFamily: Fonts.regular, fontSize: 13, marginTop: -8, marginBottom: 14, lineHeight: 18 },
  przyciski: { flexDirection: 'row', gap: 8, marginTop: 16 },
  btn: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: Size.r,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTxt: { fontSize: 14, textAlign: 'center' },
});
