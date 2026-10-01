import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { dzisISO } from '@/logika/format';
import { useMotyw } from '@/theme/motyw';

const MIESIACE = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
const DNI = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

/**
 * Kalendarz miesiąca jak .cal-grid w v19: dziś podświetlone, kropka = dzień z listą.
 * Używany przy „Utwórz listę” (wybór daty) i w Archiwum.
 */
export function Kalendarz({
  wybrana,
  onWybierz,
  zaznaczone,
  onMiesiac,
}: {
  wybrana?: string | null;
  onWybierz: (iso: string) => void;
  zaznaczone?: Set<string>;
  /** po zmianie miesiąca strzałkami (Archiwum: lista list z tego miesiąca) */
  onMiesiac?: (rok: number, mies0: number) => void;
}) {
  const { c } = useMotyw();
  const start = wybrana ? new Date(`${wybrana}T12:00:00`) : new Date();
  const [rok, setRok] = useState(start.getFullYear());
  const [mies, setMies] = useState(start.getMonth());
  const dzis = dzisISO();

  const komorki = useMemo(() => {
    const pierwszy = new Date(rok, mies, 1);
    const przesun = (pierwszy.getDay() + 6) % 7; // poniedziałek = 0
    const ile = new Date(rok, mies + 1, 0).getDate();
    const out: (string | null)[] = Array(przesun).fill(null);
    for (let d = 1; d <= ile; d++) out.push(dzisISO(new Date(rok, mies, d)));
    while (out.length % 7) out.push(null);
    return out;
  }, [rok, mies]);

  const zmien = (o: number) => {
    const d = new Date(rok, mies + o, 1);
    setRok(d.getFullYear());
    setMies(d.getMonth());
    onMiesiac?.(d.getFullYear(), d.getMonth());
  };

  return (
    <View>
      <View style={styles.naglowek}>
        <Pressable onPress={() => zmien(-1)} style={[styles.strzalka, { backgroundColor: c.surface2, borderColor: c.border }]} hitSlop={6}>
          <Text style={[styles.strzalkaTxt, { color: c.text }]}>←</Text>
        </Pressable>
        <Text style={[styles.tytul, { color: c.text }]}>
          {MIESIACE[mies]} {rok}
        </Text>
        <Pressable onPress={() => zmien(1)} style={[styles.strzalka, { backgroundColor: c.surface2, borderColor: c.border }]} hitSlop={6}>
          <Text style={[styles.strzalkaTxt, { color: c.text }]}>→</Text>
        </Pressable>
      </View>
      <View style={styles.siatka}>
        {DNI.map((d) => (
          <View key={d} style={styles.kom}>
            <Text style={[styles.dzienTyg, { color: c.text2 }]}>{d}</Text>
          </View>
        ))}
        {komorki.map((iso, i) => {
          if (!iso) return <View key={`p${i}`} style={styles.kom} />;
          const jestDzis = iso === dzis;
          const wyb = iso === wybrana;
          const kropka = zaznaczone?.has(iso);
          return (
            <Pressable
              key={iso}
              onPress={() => onWybierz(iso)}
              style={({ pressed }) => [
                styles.kom,
                styles.dzien,
                jestDzis && { backgroundColor: 'rgba(249,115,22,0.2)' },
                wyb && { backgroundColor: c.accent },
                pressed && !wyb && { backgroundColor: 'rgba(249,115,22,0.1)' },
              ]}>
              <Text
                style={[
                  styles.dzienTxt,
                  { color: wyb ? '#fff' : jestDzis ? c.accent : c.text },
                  (jestDzis || wyb) && { fontFamily: Fonts.extrabold },
                ]}>
                {Number(iso.slice(8))}
              </Text>
              {kropka ? <View style={[styles.kropka, { backgroundColor: wyb ? '#fff' : c.accent }]} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  naglowek: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  strzalka: { borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  strzalkaTxt: { fontFamily: Fonts.bold, fontSize: 16 },
  tytul: { fontFamily: Fonts.extrabold, fontSize: 16 },
  siatka: { flexDirection: 'row', flexWrap: 'wrap' },
  kom: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 1 },
  dzien: { borderRadius: 8 },
  dzienTyg: { fontFamily: Fonts.bold, fontSize: 11 },
  dzienTxt: { fontFamily: Fonts.semibold, fontSize: 14 },
  kropka: { position: 'absolute', bottom: 4, width: 5, height: 5, borderRadius: 3 },
});
