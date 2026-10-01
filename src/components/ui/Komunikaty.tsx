import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { Fonts, Size } from '@/constants/theme';
import { useSync } from '@/sync/SyncProvider';
import { useMotyw } from '@/theme/motyw';

import { Numpad, type NumpadUstawienia } from './Numpad';
import { Okno, Przycisk, Przyciski } from './Okno';
import { Pole } from './Pole';

type Potwierdzenie = {
  tytul: string;
  tekst: string;
  ok: string;
  onOk: () => void;
  /** kolor przycisku OK: czerwony (usuwanie, domyślnie) albo pomarańczowy (np. otwarcie archiwum) */
  rodzajOk?: 'czerwony' | 'dalej';
};

type Ctx = {
  /** Komunikat na dole ekranu (toast z v19), znika sam po ~2 s. */
  toast: (tekst: string) => void;
  /** Okno „Na pewno?” z Anuluj / czerwonym przyciskiem (askConfirm z v19). */
  potwierdz: (p: Potwierdzenie) => void;
  /** Klawiatura numeryczna (openNumpad z v19). */
  numpad: (u: NumpadUstawienia) => void;
  /** Jak potwierdz, ale wymaga hasła aplikacji (usuwanie list). */
  potwierdzHaslem: (p: Potwierdzenie) => void;
};

const Kontekst = createContext<Ctx>({ toast: () => {}, potwierdz: () => {}, numpad: () => {}, potwierdzHaslem: () => {} });
export const useKomunikaty = () => useContext(Kontekst);

export function KomunikatyProvider({ children }: { children: ReactNode }) {
  const { c } = useMotyw();
  const [tekst, setTekst] = useState('');
  const [pot, setPot] = useState<Potwierdzenie | null>(null);
  const [np, setNp] = useState<NumpadUstawienia | null>(null);
  const [potH, setPotH] = useState<Potwierdzenie | null>(null);
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
    <Kontekst.Provider value={{ toast, potwierdz: setPot, numpad: setNp, potwierdzHaslem: setPotH }}>
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
      <Okno widoczne={!!potH} onZamknij={() => setPotH(null)} tytul={potH?.tytul} rozmiar="sm">
        {potH ? <TrescHasla p={potH} onZamknij={() => setPotH(null)} /> : null}
      </Okno>
      <View pointerEvents="none" style={styles.toastWrap}>
        <Animated.View style={[styles.toast, { opacity: op, backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.toastTxt, { color: c.text }]}>{tekst}</Text>
        </Animated.View>
      </View>
    </Kontekst.Provider>
  );
}

// po tylu błędnych hasłach z rzędu — przerwa (jak blokada logowania w v19)
const PROBY = 5;
const PRZERWA_MS = 15 * 60 * 1000;
let bledne = 0;
let blokadaDo = 0;

function TrescHasla({ p, onZamknij }: { p: Potwierdzenie; onZamknij: () => void }) {
  const { c } = useMotyw();
  const { sprawdzHaslo } = useSync();
  const [haslo, setHaslo] = useState('');
  const [blad, setBlad] = useState('');
  const [czeka, setCzeka] = useState(false);

  const ok = async () => {
    if (!haslo || czeka) return;
    if (Date.now() < blokadaDo) return setBlad('Za dużo błędnych prób. Spróbuj ponownie za kilkanaście minut.');
    setCzeka(true);
    const w = await sprawdzHaslo(haslo);
    setCzeka(false);
    if (w === 'ok') {
      bledne = 0;
      onZamknij();
      p.onOk();
    } else if (w === 'offline') setBlad('Brak internetu — hasło trzeba raz sprawdzić na serwerze. Spróbuj przy zasięgu.');
    else if (w === 'blokada') setBlad('Za dużo błędnych prób. Spróbuj ponownie za 15 minut.');
    else {
      bledne++;
      if (bledne >= PROBY) {
        blokadaDo = Date.now() + PRZERWA_MS;
        bledne = 0;
      }
      setHaslo('');
      setBlad('Nieprawidłowe hasło');
    }
  };

  return (
    <>
      <Text style={[styles.tekst, { color: c.text2 }]}>{p.tekst}</Text>
      <View style={styles.odstep} />
      <Pole
        etykieta="Hasło aplikacji"
        value={haslo}
        onChangeText={(t) => {
          setHaslo(t);
          setBlad('');
        }}
        placeholder="Hasło"
        secureTextEntry
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={ok}
      />
      {blad ? <Text style={[styles.blad, { color: c.red }]}>{blad}</Text> : null}
      <Przyciski>
        <Przycisk tekst="Anuluj" rodzaj="anuluj" onPress={onZamknij} />
        <Przycisk tekst={czeka ? 'Sprawdzam…' : p.ok} rodzaj={p.rodzajOk ?? 'czerwony'} onPress={ok} wylaczony={!haslo || czeka} />
      </Przyciski>
    </>
  );
}

const styles = StyleSheet.create({
  odstep: { height: 14 },
  blad: { fontFamily: Fonts.semibold, fontSize: 14, marginTop: -4 },
  tekst: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 21 },
  toastWrap: { position: 'absolute', left: 0, right: 0, bottom: Size.navH + 14, alignItems: 'center' },
  toast: { borderWidth: 1, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 18, maxWidth: '90%' },
  toastTxt: { fontFamily: Fonts.bold, fontSize: 13, textAlign: 'center' },
});
