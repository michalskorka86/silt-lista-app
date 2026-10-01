import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Logowanie } from '@/components/Logowanie';
import { AutomatPdf } from '@/components/raport/AutomatPdf';
import '@/components/raport/zadanieTla'; // zadanie w tle (PDF w nocy) — definiowane przy starcie
import { KomunikatyProvider } from '@/components/ui/Komunikaty';
import { DB_NAME, migrateDbIfNeeded } from '@/db/migrations';
import { SyncProvider, useSync } from '@/sync/SyncProvider';
import { MotywProvider, useMotyw } from '@/theme/motyw';

SplashScreen.preventAutoHideAsync();

function Nawigacja() {
  const { c, motyw } = useMotyw();
  const { zalogowany } = useSync();
  return (
    <>
      <StatusBar style={motyw === 'dark' ? 'light' : 'dark'} />
      {zalogowany === false ? (
        <Logowanie />
      ) : (
        <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: c.bg } }} />
      )}
      {zalogowany ? <AutomatPdf /> : null}
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
