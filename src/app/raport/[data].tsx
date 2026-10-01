import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { drukuj, udostepnij } from '@/components/raport/pdf';
import { PodgladHtml } from '@/components/raport/PodgladHtml';
import { TopBar } from '@/components/TopBar';
import { useKomunikaty } from '@/components/ui/Komunikaty';
import { Przycisk } from '@/components/ui/Okno';
import { Fonts } from '@/constants/theme';
import { useCennik, useDzien } from '@/hooks/useDane';
import { dataKrotko, dataPL } from '@/logika/format';
import { htmlRaportu, nazwaPliku } from '@/logika/raport';
import { useMotyw } from '@/theme/motyw';

/** 🖨️ Raport PDF dnia (ov-print z v19): podgląd kartki A4 + Drukuj / Zapisz i wyślij. Działa bez internetu. */
export default function Raport() {
  const { data } = useLocalSearchParams<{ data: string }>();
  const { c } = useMotyw();
  const { toast } = useKomunikaty();
  const dzien = useDzien(data);
  const cennik = useCennik();
  const [czeka, setCzeka] = useState<null | 'druk' | 'pdf'>(null);

  const html = useMemo(() => (dzien ? htmlRaportu(dzien, cennik) : ''), [dzien, cennik]);

  const wykonaj = async (co: 'druk' | 'pdf') => {
    if (czeka || !html) return;
    setCzeka(co);
    try {
      if (co === 'druk') await drukuj(html);
      else await udostepnij(html, nazwaPliku(data));
    } catch (e) {
      toast(`❌ Nie udało się utworzyć PDF${e instanceof Error && e.message ? ` (${e.message})` : ''}`);
    } finally {
      setCzeka(null);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <TopBar data={dataKrotko(data)} />
      <View style={[styles.pasek, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <Przycisk tekst="← Wróć" rodzaj="anuluj" rozciagnij={false} onPress={() => router.back()} style={styles.btn} />
        <Text style={[styles.tytul, { color: c.text }]} numberOfLines={1}>
          🖨️ Raport {dataPL(data)}
        </Text>
        <Przycisk
          tekst={czeka === 'druk' ? '⏳ Chwila…' : '🖨️ Drukuj'}
          rodzaj="anuluj"
          rozciagnij={false}
          wylaczony={!!czeka || !dzien}
          onPress={() => wykonaj('druk')}
          style={styles.btn}
        />
        <Przycisk
          tekst={czeka === 'pdf' ? '⏳ Tworzę PDF…' : '📤 Zapisz / wyślij PDF'}
          rozciagnij={false}
          wylaczony={!!czeka || !dzien}
          onPress={() => wykonaj('pdf')}
          style={styles.btn}
        />
      </View>
      {dzien && !dzien.lista ? (
        <Text style={[styles.pusto, { color: c.text2 }]}>Na tablecie nie ma listy z {dataPL(data)}.</Text>
      ) : html ? (
        <PodgladHtml html={html} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pasek: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1 },
  tytul: { flex: 1, minWidth: 140, fontFamily: Fonts.extrabold, fontSize: 17 },
  btn: { paddingVertical: 9, paddingHorizontal: 14, minHeight: 42 },
  pusto: { padding: 24, fontFamily: Fonts.regular, fontSize: 14 },
});
