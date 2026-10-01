import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import type { Wiersz } from '@/db/tabele';
import { useMotyw } from '@/theme/motyw';

/** Zakładki instruktorów (.tabs-row z v19): imię + liczba grup, „＋ 👷” dodaje instruktora. */
export function Zakladki({
  instruktorzy,
  aktywna,
  liczby,
  onWybierz,
  onDodaj,
  onUsun,
}: {
  instruktorzy: Wiersz<'instruktorzy'>[];
  aktywna: string | null;
  liczby: Record<string, number>;
  onWybierz: (id: string) => void;
  onDodaj: () => void;
  onUsun: (id: string) => void;
}) {
  const { c } = useMotyw();
  return (
    <View style={[styles.wrap, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {instruktorzy.map((t) => {
          const akt = t.id === aktywna;
          return (
            <Pressable
              key={t.id}
              onPress={() => onWybierz(t.id)}
              onLongPress={() => onUsun(t.id)}
              style={[styles.tab, { borderBottomColor: akt ? c.accent : 'transparent' }]}>
              <Text style={[styles.tabTxt, { color: akt ? c.accent : c.text2 }]}>{t.imie}</Text>
              <View
                style={[
                  styles.cnt,
                  akt
                    ? { backgroundColor: 'rgba(249,115,22,0.15)', borderColor: c.accent }
                    : { backgroundColor: c.surface3, borderColor: 'transparent' },
                ]}>
                <Text style={[styles.cntTxt, { color: akt ? c.accent : c.text2 }]}>{liczby[t.id] ?? 0}</Text>
              </View>
            </Pressable>
          );
        })}
        <Pressable
          onPress={onDodaj}
          accessibilityLabel="Dodaj instruktora"
          style={({ pressed }) => [styles.add, { borderColor: pressed ? c.accent : c.border2 }]}>
          <Text style={[styles.addTxt, { color: c.text2 }]}>＋ 👷</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 6, paddingHorizontal: 10 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 2 },
  tabTxt: { fontFamily: Fonts.bold, fontSize: 14 },
  cnt: { minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 6, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  cntTxt: { fontFamily: Fonts.extrabold, fontSize: 11 },
  add: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', marginLeft: 6 },
  addTxt: { fontFamily: Fonts.bold, fontSize: 14 },
});
