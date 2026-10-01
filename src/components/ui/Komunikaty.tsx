import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { Fonts, Size } from '@/constants/theme';
import { useMotyw } from '@/theme/motyw';

import { Numpad, type NumpadUstawienia } from './Numpad';
import { Okno, Przycisk, Przyciski } from './Okno';

type Potwierdzenie = { tytul: string; tekst: string; ok: string; onOk: () => void };

type Ctx = {
  /** Komunikat na dole ekranu (toast z v19), znika sam po ~2 s. */
  toast: (tekst: string) => void;
  /** Okno „Na pewno?” z Anuluj / czerwonym przyciskiem (askConfirm z v19). */
  potwierdz: (p: Potwierdzenie) => void;
  /** Klawiatura numeryczna (openNumpad z v19). */
  numpad: (u: NumpadUstawienia) => void;
};

const Kontekst = createContext<Ctx>({ toast: () => {}, potwierdz: () => {}, numpad: () => {} });
export const useKomunikaty = () => useContext(Kontekst);

export function KomunikatyProvider({ children }: { children: ReactNode }) {
  const { c } = useMotyw();
  const [tekst, setTekst] = useState('');
  const [pot, setPot] = useState<Potwierdzenie | null>(null);
  const [np, setNp] = useState<NumpadUstawienia | null>(null);
  const [op] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback(
    (t: string) => {
      setTekst(t);
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(op, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      timer.current = setTimeout(() => Animated.timing(op, { toValue: 0, duration: 200, useNativeDriver: true }).start(), 2200);
    },
    [op],
  );

  return (
    <Kontekst.Provider value={{ toast, potwierdz: setPot, numpad: setNp }}>
      {children}
      <Okno widoczne={!!pot} onZamknij={() => setPot(null)} tytul={pot?.tytul} rozmiar="sm">
        <Text style={[styles.tekst, { color: c.text2 }]}>{pot?.tekst}</Text>
        <Przyciski>
          <Przycisk tekst="Anuluj" rodzaj="anuluj" onPress={() => setPot(null)} />
          <Przycisk
            tekst={pot?.ok ?? 'Usuń'}
            rodzaj="czerwony"
            onPress={() => {
              const f = pot?.onOk;
              setPot(null);
              f?.();
            }}
          />
        </Przyciski>
      </Okno>
      <Numpad ustawienia={np} onZamknij={() => setNp(null)} />
      <View pointerEvents="none" style={styles.toastWrap}>
        <Animated.View style={[styles.toast, { opacity: op, backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.toastTxt, { color: c.text }]}>{tekst}</Text>
        </Animated.View>
      </View>
    </Kontekst.Provider>
  );
}

const styles = StyleSheet.create({
  tekst: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 21 },
  toastWrap: { position: 'absolute', left: 0, right: 0, bottom: Size.navH + 14, alignItems: 'center' },
  toast: { borderWidth: 1, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 18, maxWidth: '90%' },
  toastTxt: { fontFamily: Fonts.bold, fontSize: 13, textAlign: 'center' },
});
