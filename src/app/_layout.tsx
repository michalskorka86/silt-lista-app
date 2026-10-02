import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack, usePathname, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Aktualizacje } from '@/components/Aktualizacje';
import { ustawEkran, zainstalujLapacz, zglos } from '@/components/bledy/zglos';
import { Logowanie } from '@/components/Logowanie';
import { AutomatPdf } from '@/components/raport/AutomatPdf';
import '@/components/raport/zadanieTla'; // zadanie w tle (PDF w nocy) — definiowane przy starcie
import { KomunikatyProvider } from '@/components/ui/Komunikaty';
import { Colors, Fonts } from '@/constants/theme';
import { DB_NAME, migrateDbIfNeeded } from '@/db/migrations';
import { SyncProvider, useSync } from '@/sync/SyncProvider';
import { MotywProvider, useMotyw } from '@/theme/motyw';

SplashScreen.preventAutoHideAsync();
// bez animacji znikania — krótsza chwila, w której Android może „zgubić” ekran powitalny na wierzchu
SplashScreen.setOptions({ duration: 0, fade: false });
zainstalujLapacz();

/**
 * Gdy ekran się wysypie: zamiast zamknięcia aplikacji — komunikat po polsku i „Spróbuj ponownie”.
 * Błąd zapisuje się na tablecie i przy zasięgu trafia na serwer (bledy.php).
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    zglos(error, { dopisek: 'Ekran' });
  }, [error]);
  const c = Colors.dark;
  return (
    <View style={[styles.blad, { backgroundColor: c.bg }]}>
      <Text style={styles.bladIco}>😕</Text>
      <Text style={[styles.bladTytul, { color: c.text }]}>Coś poszło nie tak</Text>
      <Text style={[styles.bladTekst, { color: c.text2 }]}>
        Dane są bezpieczne na tablecie. Opis błędu zapisał się i sam trafi do Michała.
      </Text>
      <Pressable onPress={retry} style={[styles.bladBtn, { backgroundColor: c.accent }]}>
        <Text style={styles.bladBtnTxt}>🔄 Spróbuj ponownie</Text>
      </Pressable>
    </View>
  );
}

function Nawigacja() {
  const { c, motyw } = useMotyw();
  const { zalogowany } = useSync();
  const sciezka = usePathname();
  useEffect(() => ustawEkran(sciezka), [sciezka]);
  return (
    <>
      <StatusBar style={motyw === 'dark' ? 'light' : 'dark'} />
      {zalogowany === false ? (
        <Logowanie />
      ) : (
        <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: c.bg } }} />
      )}
      {zalogowany ? <AutomatPdf /> : null}
      <Aktualizacje />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SQLiteProvider databaseName={DB_NAME} onInit={migrateDbIfNeeded}>
      <MotywProvider>
        <SyncProvider>
          <KomunikatyProvider>
            <Nawigacja />
          </KomunikatyProvider>
        </SyncProvider>
      </MotywProvider>
    </SQLiteProvider>
  );
}

const styles = StyleSheet.create({
  blad: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  bladIco: { fontSize: 56 },
  bladTytul: { fontFamily: Fonts.extrabold, fontSize: 22 },
  bladTekst: { fontFamily: Fonts.regular, fontSize: 15, textAlign: 'center', maxWidth: 420, lineHeight: 22 },
  bladBtn: { marginTop: 10, paddingVertical: 16, paddingHorizontal: 28, borderRadius: 12 },
  bladBtnTxt: { color: '#fff', fontFamily: Fonts.extrabold, fontSize: 16 },
});
