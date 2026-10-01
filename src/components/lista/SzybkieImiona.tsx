import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useMotyw } from '@/theme/motyw';

/** Szybkie imiona pracowników ze Statystyk (.quick-names / .qn z v19). */
export function SzybkieImiona({ imiona, onWybierz }: { imiona: string[]; onWybierz: (imie: string) => void }) {
  const { c } = useMotyw();
  if (!imiona.length) return null;
  return (
    <View style={styles.wrap}>
      {imiona.map((i) => (
        <Pressable
          key={i}
          onPress={() => onWybierz(i)}
          style={({ pressed }) => [styles.qn, { backgroundColor: c.surface2, borderColor: pressed ? c.accent : c.border2 }]}>
          <Text style={[styles.txt, { color: c.text }]}>{i}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -4, marginBottom: 12 },
  qn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1 },
  txt: { fontFamily: Fonts.bold, fontSize: 13 },
});
