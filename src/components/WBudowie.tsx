import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TopBar } from '@/components/TopBar';
import { Fonts, Size } from '@/constants/theme';
import { useMotyw } from '@/theme/motyw';

/** Tymczasowy ekran „w budowie” dla sekcji, które dopiero przenosimy z v19. */
export function WBudowie({ tytul, ico, opis }: { tytul: string; ico: string; opis: string }) {
  const { c } = useMotyw();
  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <TopBar />
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, { borderColor: c.border, backgroundColor: c.surface2, opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[styles.backTxt, { color: c.text }]}>←</Text>
        </Pressable>
        <Text style={[styles.title, { color: c.text }]}>{tytul}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.ico}>{ico}</Text>
        <Text style={[styles.info, { color: c.text2 }]}>{opis}</Text>
        <Text style={[styles.badge, { color: c.accent, borderColor: c.accent }]}>W budowie</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  back: { borderWidth: 1, borderRadius: Size.r, paddingVertical: 8, paddingHorizontal: 14 },
  backTxt: { fontFamily: Fonts.bold, fontSize: 16 },
  title: { fontFamily: Fonts.extrabold, fontSize: 18 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  ico: { fontSize: 56 },
  info: { fontFamily: Fonts.medium, fontSize: 15, textAlign: 'center', maxWidth: 420 },
  badge: { fontFamily: Fonts.extrabold, fontSize: 12, borderWidth: 1, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 },
});
