import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Fragment, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { archiwumOtwarte, useArchiwum } from '@/components/archiwum/dostep';
import { KartaGrupy } from '@/components/lista/KartaGrupy';
import { TopBar } from '@/components/TopBar';
import { Przycisk } from '@/components/ui/Okno';
import { Fonts } from '@/constants/theme';
import { useCennik, useDzien } from '@/hooks/useDane';
import { atrakcja as znajdzAtrakcje } from '@/logika/cennik';
import { dataKrotko, dataPL } from '@/logika/format';
import { useMotyw } from '@/theme/motyw';

/** Podgląd listy z archiwum (#screen-archive z v19): wszystkie grupy dnia z imieniem instruktora, bez edycji. */
export default function ListaArchiwum() {
  const { data } = useLocalSearchParams<{ data: string }>();
  const { c } = useMotyw();
  const { usunZHaslem } = useArchiwum();
  const dzien = useDzien(data);
  const cennik = useCennik();
  // wejście z pominięciem hasła (np. powrót po kilku godzinach) → z powrotem do kalendarza
  const [otwarte] = useState(archiwumOtwarte);

  if (!otwarte) return <Redirect href="/archiwum" />;
  if (!dzien) return <View style={[styles.root, { backgroundColor: c.bg }]} />;

  const imie = (id: string | null) => dzien.instruktorzy.find((i) => i.id === id)?.imie ?? '';
  const katalog = [...(cennik?.dodatki.glowne ?? []), ...(cennik?.dodatki.wiecej ?? [])];
  const ikonaDodatku = (nazwa: string) => katalog.find((d) => d.nazwa === nazwa)?.ikona ?? '⭐';
  const grupy = dzien.grupy;

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <TopBar data={dataKrotko(data)} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.naglowek}>
          <Przycisk tekst="← Kalendarz" rodzaj="anuluj" rozciagnij={false} onPress={() => router.back()} style={styles.btn} />
          <Text style={[styles.tytul, { color: c.text }]}>Lista: {dataPL(data)}</Text>
          <Przycisk tekst="🖨️ Drukuj / PDF" rodzaj="anuluj" rozciagnij={false} onPress={() => router.push({ pathname: '/raport/[data]', params: { data } })} style={styles.btn} />
          {dzien.lista ? (
            <Przycisk tekst="🗑 Usuń listę" rodzaj="usun" rozciagnij={false} onPress={() => usunZHaslem(data, () => router.back())} style={styles.btn} />
          ) : null}
        </View>

        {!dzien.lista ? (
          <Text style={[styles.pusto, { color: c.text2 }]}>Tej listy nie ma na tablecie (mogła zostać usunięta).</Text>
        ) : grupy.length ? (
          grupy.map((g, i) => (
            <Fragment key={g.id}>
              <Text style={[styles.instr, { color: c.text2 }]}>👷 {imie(g.instruktor_id)}</Text>
              <KartaGrupy grupa={g} numer={grupy.length - i} atrakcja={znajdzAtrakcje(cennik, g.atrakcja)} ikonaDodatku={ikonaDodatku} />
            </Fragment>
          ))
        ) : (
          <Text style={[styles.pusto, { color: c.text2 }]}>Brak grup</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 32, gap: 14 },
  naglowek: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  tytul: { flex: 1, minWidth: 160, fontFamily: Fonts.extrabold, fontSize: 18 },
  btn: { paddingVertical: 8, paddingHorizontal: 14, minHeight: 40 },
  instr: { fontFamily: Fonts.bold, fontSize: 12, marginLeft: 4, marginBottom: -8 },
  pusto: { padding: 20, fontFamily: Fonts.regular, fontSize: 14 },
});
