import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text } from 'react-native';

import { API_URL } from '@/constants/serwer';
import { Fonts, Size } from '@/constants/theme';
import { useMotyw } from '@/theme/motyw';

/** Strona z najnowszym APK na serwerze (przekierowuje do wydania na GitHubie). */
export const APK_URL = API_URL.replace(/api\.php$/, 'apk.php');

export type InfoApk = { runtimeVersion: string; numer: number; data: string; opis: string };

const CO_MS = 6 * 60 * 60 * 1000;
let ostatnio = 0;
let wynik: InfoApk | null = null;

/**
 * Czy jest nowszy APK (z nowymi modułami systemowymi)? Porównuje „odcisk” modułów zainstalowanej aplikacji
 * z najnowszym wydaniem. Zwykłe poprawki przychodzą same (aktualizacje w powietrzu) — tu chodzi tylko o APK.
 */
async function sprawdz(): Promise<InfoApk | null> {
  if (!Updates.isEnabled || !Updates.runtimeVersion) return null;
  if (Date.now() - ostatnio < CO_MS) return wynik;
  try {
    const r = await fetch(`${APK_URL}?info`, { headers: { Accept: 'application/json' } });
    const j = (await r.json()) as InfoApk & { ok?: boolean };
    ostatnio = Date.now();
    wynik = j.ok && j.runtimeVersion && j.runtimeVersion !== Updates.runtimeVersion ? j : null;
  } catch {
    /* bez zasięgu — sprawdzimy następnym razem */
  }
  return wynik;
}

export function useNowaWersja(): InfoApk | null {
  const [info, setInfo] = useState<InfoApk | null>(wynik);
  useEffect(() => {
    let aktywny = true;
    const odswiez = () => {
      sprawdz().then((w) => aktywny && setInfo(w));
    };
    odswiez();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && odswiez());
    return () => {
      aktywny = false;
      sub.remove();
    };
  }, []);
  return info;
}

export const pobierzApk = () => Linking.openURL(APK_URL);

export const opisApk = (i: InfoApk) =>
  `APK nr ${i.numer}${i.data ? ` z ${new Date(i.data).toLocaleDateString('pl-PL', { day: 'numeric', month: 'numeric' })}` : ''}${i.opis ? ` — ${i.opis}` : ''}`;

/** Pasek na ekranie startowym: „📥 Jest nowa wersja aplikacji”. */
export function PasekNowejWersji() {
  const { c } = useMotyw();
  const info = useNowaWersja();
  if (!info) return null;
  return (
    <Pressable onPress={pobierzApk} style={({ pressed }) => [styles.pasek, { borderColor: c.accent, backgroundColor: pressed ? c.accentSoft : c.surface }]}>
      <Text style={[styles.tytul, { color: c.text }]}>📥 Jest nowa wersja aplikacji</Text>
      <Text style={[styles.opis, { color: c.text2 }]}>
        {opisApk(info)}. Dotknij, aby pobrać, a potem otwórz pobrany plik i wybierz „Aktualizuj”. Dane zostają na tablecie.
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pasek: { width: '100%', maxWidth: 420, borderWidth: 2, borderRadius: Size.r2, padding: 14, gap: 4 },
  tytul: { fontFamily: Fonts.extrabold, fontSize: 16 },
  opis: { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18 },
});
