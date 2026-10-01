import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useArchiwum } from '@/components/archiwum/dostep';
import { TopBar } from '@/components/TopBar';
import { Kalendarz } from '@/components/ui/Kalendarz';
import { Karta } from '@/components/ui/Karta';
import { Przycisk } from '@/components/ui/Okno';
import { Fonts } from '@/constants/theme';
import { useDatyList, useListyMiesiaca } from '@/hooks/useDane';
import { dataPL, plGrup, zl } from '@/logika/format';
import { ym } from '@/logika/rezerwacje';
import { useMotyw } from '@/theme/motyw';

const DN = ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.'];

/** Archiwum (#screen-calendar z v19): kalendarz z kropkami + listy z miesiąca. Otwarcie listy — po haśle aplikacji. */
export default function Archiwum() {
  const { c } = useMotyw();
  const daty = useDatyList();
  const { zHaslem, usunZHaslem } = useArchiwum();
  const [mies, setMies] = useState(() => ym(new Date().getFullYear(), new Date().getMonth()));
  const listy = useListyMiesiaca(mies);

  const otworz = (data: string) => zHaslem(() => router.push({ pathname: '/archiwum/[data]', params: { data } }));

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.naglowek}>
          <Przycisk tekst="←" rodzaj="anuluj" rozciagnij={false} onPress={() => router.back()} style={styles.wstecz} />
          <Text style={[styles.tytul, { color: c.text }]}>Archiwum</Text>
        </View>

        <View style={[styles.kal, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Kalendarz zaznaczone={daty} onWybierz={(d) => daty.has(d) && otworz(d)} onMiesiac={(r, m) => setMies(ym(r, m))} />
        </View>

        <Karta ico="📋" tytul="Listy w tym miesiącu">
          {listy.length ? (
            listy.map((l) => {
              const dd = new Date(`${l.data}T12:00:00`);
              return (
                <View key={l.data} style={[styles.wiersz, { borderBottomColor: c.border }]}>
                  <Pressable onPress={() => otworz(l.data)} style={styles.opis}>
                    <Text style={[styles.data, { color: c.text }]}>
                      {DN[dd.getDay()]} {dataPL(l.data)}
                    </Text>
                    <Text style={[styles.info, { color: c.text2 }]}>
                      {plGrup(l.grupy)}
                      {l.brutto ? ` · ${zl(l.brutto)}` : ''}
                      {l.wyslane ? ' · ✓ statystyki wysłane' : ''}
                    </Text>
                  </Pressable>
                  <Przycisk tekst="📄 Otwórz" rodzaj="anuluj" rozciagnij={false} onPress={() => otworz(l.data)} style={styles.btn} />
                  <Przycisk tekst="🗑 Usuń" rodzaj="usun" rozciagnij={false} onPress={() => usunZHaslem(l.data)} style={styles.btn} />
                </View>
              );
            })
          ) : (
            <Text style={[styles.pusto, { color: c.text2 }]}>Brak list w tym miesiącu</Text>
          )}
        </Karta>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, gap: 14, width: '100%', maxWidth: 560, alignSelf: 'center' },
  naglowek: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wstecz: { paddingVertical: 8, paddingHorizontal: 14, minHeight: 40 },
  tytul: { fontFamily: Fonts.extrabold, fontSize: 18 },
  kal: { borderWidth: 1, borderRadius: 16, padding: 16 },
  wiersz: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1 },
  opis: { flex: 1 },
  data: { fontFamily: Fonts.bold, fontSize: 15 },
  info: { fontFamily: Fonts.regular, fontSize: 13, marginTop: 2 },
  btn: { paddingVertical: 8, paddingHorizontal: 14, minHeight: 40 },
  pusto: { padding: 16, fontFamily: Fonts.regular, fontSize: 14 },
});
