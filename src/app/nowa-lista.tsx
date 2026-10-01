import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TopBar } from '@/components/TopBar';
import { Kalendarz } from '@/components/ui/Kalendarz';
import { useKomunikaty } from '@/components/ui/Komunikaty';
import { Okno, Przycisk, Przyciski } from '@/components/ui/Okno';
import { Pole } from '@/components/ui/Pole';
import { SzybkieImiona } from '@/components/lista/SzybkieImiona';
import { Fonts } from '@/constants/theme';
import { useDatyList } from '@/hooks/useDane';
import { dataDluga, dataPL, dzisISO } from '@/logika/format';
import { utworzListe } from '@/logika/lista';
import { wczytajPracownikow, type Pracownik } from '@/sync/synchronizacja';
import { useMotyw } from '@/theme/motyw';

/** „Utwórz listę” — jak #screen-confirm-date w v19: data + imię instruktora. Istniejący dzień otwiera się do dopisania. */
export default function NowaLista() {
  const { c } = useMotyw();
  const db = useSQLiteContext();
  const { toast } = useKomunikaty();
  const daty = useDatyList();
  const [data, setData] = useState(dzisISO());
  const [imie, setImie] = useState('');
  const [kalendarz, setKalendarz] = useState(false);
  const [pracownicy, setPracownicy] = useState<Pracownik[]>([]);
  const [czeka, setCzeka] = useState(false);

  useEffect(() => {
    wczytajPracownikow(db).then(setPracownicy);
  }, [db]);

  const utworz = async () => {
    if (czeka) return;
    setCzeka(true);
    try {
      const t = await utworzListe(db, data, imie);
      toast(`📋 Lista: ${dataPL(data)}`);
      router.replace({ pathname: '/lista/[data]', params: t ? { data, t } : { data } });
    } finally {
      setCzeka(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={[styles.tytul, { color: c.text }]}>Utwórz listę</Text>

        <View style={styles.pole}>
          <Text style={[styles.label, { color: c.text2 }]}>Data</Text>
          <Pressable
            onPress={() => setKalendarz(true)}
            style={[styles.dataBtn, { backgroundColor: c.surface2, borderColor: c.border }]}>
            <Text style={[styles.dataTxt, { color: c.text }]}>📅 {dataDluga(data)}</Text>
            {daty.has(data) ? <Text style={[styles.dataInfo, { color: c.accent }]}>lista istnieje — otworzy się do dopisania</Text> : null}
          </Pressable>
        </View>

        <View>
          <Pole
            etykieta="Imię instruktora"
            value={imie}
            onChangeText={setImie}
            placeholder="np. Janek"
            maxLength={40}
            duze
            returnKeyType="go"
            onSubmitEditing={utworz}
            autoCapitalize="words"
          />
          <SzybkieImiona imiona={pracownicy.map((p) => p.imie)} onWybierz={setImie} />
        </View>

        <Przycisk tekst="Utwórz listę →" onPress={utworz} wylaczony={czeka} style={styles.duzy} tekstStyle={styles.duzyTxt} />
        <Przycisk tekst="← Wróć" rodzaj="anuluj" onPress={() => router.back()} style={styles.wroc} />
      </ScrollView>

      <Okno widoczne={kalendarz} onZamknij={() => setKalendarz(false)} tytul="📅 Data listy" rozmiar="sm">
        <Kalendarz
          wybrana={data}
          zaznaczone={daty}
          onWybierz={(d) => {
            setData(d);
            setKalendarz(false);
          }}
        />
        <Przyciski>
          <Przycisk tekst="Anuluj" rodzaj="anuluj" onPress={() => setKalendarz(false)} />
          <Przycisk
            tekst="Dziś"
            rodzaj="anuluj"
            onPress={() => {
              setData(dzisISO());
              setKalendarz(false);
            }}
          />
        </Przyciski>
      </Okno>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 24, gap: 16, width: '100%', maxWidth: 440, alignSelf: 'center', marginTop: 20 },
  tytul: { fontFamily: Fonts.extrabold, fontSize: 22 },
  pole: { gap: 5 },
  label: { fontFamily: Fonts.bold, fontSize: 12 },
  dataBtn: { borderWidth: 1, borderRadius: 8, padding: 14 },
  dataTxt: { fontFamily: Fonts.semibold, fontSize: 18 },
  dataInfo: { fontFamily: Fonts.semibold, fontSize: 12, marginTop: 4 },
  duzy: { flex: 0, paddingVertical: 16 },
  duzyTxt: { fontSize: 16 },
  wroc: { flex: 0 },
});
