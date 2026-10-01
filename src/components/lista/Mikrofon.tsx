import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';

import { useMotyw } from '@/theme/motyw';

import { zglos } from '../bledy/zglos';
import { useKomunikaty } from '../ui/Komunikaty';

function dostepny(): boolean {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

/**
 * 🎤 Dyktowanie imion (mic-btn z v19) — bez szukania mikrofonu na klawiaturze.
 * Najpierw zwykłe rozpoznawanie (dokładniejsze przy internecie); bez internetu druga próba na tablecie (offline).
 */
export function useMikrofon(onTekst: (t: string) => void) {
  const { toast } = useKomunikaty();
  const [slucha, setSlucha] = useState(false);
  const [jest] = useState(dostepny);
  const nasze = useRef(false); // zdarzenia rozpoznawania są wspólne — reagujemy tylko na swoje
  const offline = useRef(false);

  const uruchom = (naTablecie: boolean) => {
    offline.current = naTablecie;
    nasze.current = true;
    setSlucha(true);
    ExpoSpeechRecognitionModule.start({
      lang: 'pl-PL',
      interimResults: false,
      maxAlternatives: 1,
      continuous: false,
      requiresOnDeviceRecognition: naTablecie,
    });
  };

  useSpeechRecognitionEvent('result', (e) => {
    if (!nasze.current || !e.isFinal) return;
    const t = e.results[0]?.transcript ?? '';
    if (t.trim()) onTekst(t);
  });
  useSpeechRecognitionEvent('end', () => {
    if (!nasze.current) return;
    nasze.current = false;
    setSlucha(false);
  });
  useSpeechRecognitionEvent('error', (e) => {
    if (!nasze.current) return;
    if (e.error === 'network' && !offline.current) {
      nasze.current = false;
      setTimeout(() => uruchom(true), 150); // bez internetu — spróbuj rozpoznać na tablecie
      return;
    }
    nasze.current = false;
    setSlucha(false);
    if (e.error === 'aborted') return;
    if (e.error === 'no-speech' || e.error === 'speech-timeout') toast('🎤 Nie usłyszałem — stuknij mikrofon i powiedz jeszcze raz');
    else if (e.error === 'not-allowed') toast('🎤 Brak zgody na mikrofon — zezwól w ustawieniach tabletu');
    else if (e.error === 'network' || e.error === 'language-not-supported')
      toast('📴 Bez internetu dyktowanie wymaga polskiego pakietu mowy offline (Google) — wpisz imię ręcznie');
    else {
      toast('🎤 Dyktowanie nie zadziałało — wpisz imię ręcznie');
      zglos(new Error(`Mikrofon: ${e.error} ${e.message ?? ''}`), { dopisek: 'Dyktowanie' });
    }
  });

  const przelacz = async () => {
    if (slucha) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    try {
      const zgoda = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!zgoda.granted) return toast('🎤 Brak zgody na mikrofon — zezwól w ustawieniach tabletu');
      uruchom(false);
    } catch (e) {
      setSlucha(false);
      toast('🎤 Dyktowanie nie zadziałało — wpisz imię ręcznie');
      zglos(e, { dopisek: 'Dyktowanie' });
    }
  };

  // zamknięcie okna w trakcie słuchania
  useEffect(
    () => () => {
      if (nasze.current) ExpoSpeechRecognitionModule.abort();
    },
    [],
  );

  return { jest, slucha, przelacz };
}

/** Przycisk 🎤 obok pola (czerwony i pulsuje, gdy słucha). */
export function PrzyciskMikrofonu({ slucha, onPress }: { slucha: boolean; onPress: () => void }) {
  const { c } = useMotyw();
  const [puls] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!slucha) return;
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(puls, { toValue: 0.55, duration: 400, useNativeDriver: true }),
        Animated.timing(puls, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    );
    a.start();
    return () => {
      a.stop();
      puls.setValue(1);
    };
  }, [slucha, puls]);

  return (
    <Pressable onPress={onPress} accessibilityLabel={slucha ? 'Zatrzymaj dyktowanie' : 'Powiedz imię'} style={styles.wrap}>
      <Animated.View
        style={[
          styles.btn,
          { backgroundColor: slucha ? c.red : c.surface2, borderColor: slucha ? c.red : c.border, opacity: puls },
        ]}>
        <Text style={styles.ico}>🎤</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  btn: { width: 56, height: 46, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ico: { fontSize: 22 },
});
