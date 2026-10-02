import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { OknoUstawien } from '@/components/lista/Menu';
import { PasekNowejWersji } from '@/components/NowaWersja';
import { Tile } from '@/components/Tile';
import { TopBar } from '@/components/TopBar';
import { Fonts } from '@/constants/theme';
import { useMotyw } from '@/theme/motyw';

/** Ekran startowy — układ jak #screen-home w v19. */
export default function Home() {
  const { c } = useMotyw();
  const dzis = new Date().toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const wersja = Constants.expoConfig?.version ?? '';
  const [opcje, setOpcje] = useState(false);

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.logo, { color: c.accent }]}>SILT</Text>
        <Text style={[styles.date, { color: c.text2 }]}>{dzis}</Text>
        <PasekNowejWersji />

        <View style={styles.grid}>
          <View style={styles.row}>
            <Tile ico="📁" nazwa="Archiwum" opis="Przeglądaj listy" onPress={() => router.push('/archiwum')} style={styles.half} />
            <Tile ico="➕" nazwa="Utwórz listę" opis="Nowy dzień pracy" onPress={() => router.push('/nowa-lista')} style={styles.half} />
          </View>
          <View style={styles.row}>
            <Tile ico="📅" nazwa="Rezerwacje" opis="Podgląd kalendarza" onPress={() => router.push('/rezerwacje')} style={styles.half} />
            <Tile ico="⚙️" nazwa="Opcje" opis="Synchronizacja, kiosk" onPress={() => setOpcje(true)} style={styles.half} />
          </View>
        </View>

        <Text style={[styles.ver, { color: c.text3 }]}>SILT Lista {wersja} · aplikacja</Text>
      </ScrollView>
      <OknoUstawien widoczne={opcje} onZamknij={() => setOpcje(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 24 },
  logo: { fontFamily: Fonts.black, fontSize: 56, letterSpacing: -4, lineHeight: 60 },
  date: { fontFamily: Fonts.regular, fontSize: 15, marginTop: -8 },
  grid: { width: '100%', maxWidth: 420, gap: 16 },
  row: { flexDirection: 'row', gap: 16 },
  half: { flex: 1 },
  ver: { fontFamily: Fonts.regular, fontSize: 11 },
});
