import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { TopBar } from '@/components/TopBar';
import { useKomunikaty } from '@/components/ui/Komunikaty';
import { Karta } from '@/components/ui/Karta';
import { Przycisk } from '@/components/ui/Okno';
import { Fonts } from '@/constants/theme';
import { useCennik, useOdswiezanie } from '@/hooks/useDane';
import { DNI_KOSZA, dniDoKonca, przywrocZKosza, wczytajKosz, type WpisKosza } from '@/logika/kosz';
import { useMotyw } from '@/theme/motyw';

const kiedy = (iso: string) => new Date(iso).toLocaleString('pl-PL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
const dni = (n: number) => (n === 1 ? '1 dzień' : `${n} dni`);

/** 🗑️ Kosz: usunięte grupy, gracze, listy, wydatki i pensje z ostatnich 7 dni — „↩ Przywróć”. */
export default function Kosz() {
  const { c } = useMotyw();
  const db = useSQLiteContext();
  const cennik = useCennik();
  const { toast } = useKomunikaty();
  const [wpisy, setWpisy] = useState<WpisKosza[] | null>(null);
  const [czeka, setCzeka] = useState<string | null>(null);

  const wczytaj = useCallback(async () => setWpisy(await wczytajKosz(db, cennik)), [db, cennik]);
  useOdswiezanie(wczytaj);

  const przywroc = async (w: WpisKosza) => {
    if (czeka) return;
    setCzeka(w.id);
    try {
      await przywrocZKosza(db, w);
      toast(`↩ Przywrócono: ${w.tytul}`);
    } finally {
      setCzeka(null);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.naglowek}>
          <Przycisk tekst="←" rodzaj="anuluj" rozciagnij={false} onPress={() => router.back()} style={styles.wstecz} />
          <Text style={[styles.tytul, { color: c.text }]}>🗑️ Kosz</Text>
        </View>
        <Text style={[styles.info, { color: c.text2 }]}>
          Usunięte w ostatnich {DNI_KOSZA} dniach. „↩ Przywróć” oddaje wszystko tak, jak było (grupa wraca z graczami, lista — z grupami,
          wydatkami i pensjami). Po {DNI_KOSZA} dniach znikają na dobre.
        </Text>

        <Karta>
          {wpisy === null ? null : wpisy.length ? (
            wpisy.map((w) => (
              <View key={`${w.rodzaj}:${w.id}`} style={[styles.wiersz, { borderBottomColor: c.border }]}>
                <Text style={styles.ico}>{w.ico}</Text>
                <View style={styles.opis}>
                  <Text style={[styles.wTytul, { color: c.text }]}>{w.tytul}</Text>
                  <Text style={[styles.wOpis, { color: c.text2 }]}>{w.opis}</Text>
                  <Text style={[styles.wKiedy, { color: c.text3 }]}>
                    usunięto {kiedy(w.usunieto)} · zostało {dni(dniDoKonca(w.usunieto))}
                  </Text>
                </View>
                <Przycisk
                  tekst={czeka === w.id ? '⏳' : '↩ Przywróć'}
                  rozciagnij={false}
                  wylaczony={!!czeka}
                  onPress={() => przywroc(w)}
                  style={styles.btn}
                />
              </View>
            ))
          ) : (
            <Text style={[styles.pusto, { color: c.text2 }]}>Kosz jest pusty.</Text>
          )}
        </Karta>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, gap: 14, width: '100%', maxWidth: 720, alignSelf: 'center' },
  naglowek: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wstecz: { paddingVertical: 8, paddingHorizontal: 14, minHeight: 40 },
  tytul: { fontFamily: Fonts.extrabold, fontSize: 18 },
  info: { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 19 },
  wiersz: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1 },
  ico: { fontSize: 24 },
  opis: { flex: 1 },
  wTytul: { fontFamily: Fonts.bold, fontSize: 15 },
  wOpis: { fontFamily: Fonts.regular, fontSize: 13, marginTop: 2 },
  wKiedy: { fontFamily: Fonts.regular, fontSize: 11, marginTop: 3 },
  btn: { paddingVertical: 10, paddingHorizontal: 16, minHeight: 44 },
  pusto: { padding: 16, fontFamily: Fonts.regular, fontSize: 14 },
});
