import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Size } from '@/constants/theme';
import { useMotyw } from '@/theme/motyw';

/** Górny pasek jak w v19: logo SILT, data na środku, przełącznik motywu. */
export function TopBar({ data }: { data?: string }) {
  const { c, motyw, przelacz } = useMotyw();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        { paddingTop: insets.top, height: Size.topH + insets.top, backgroundColor: c.surface, borderBottomColor: c.border },
      ]}>
      <Text style={[styles.logo, { color: c.accent }]}>SILT</Text>
      <View style={[styles.dot, { backgroundColor: c.green }]} />
      <Text style={[styles.date, { color: c.text2 }]} numberOfLines={1}>
        {data ?? ''}
      </Text>
      <Pressable
        onPress={przelacz}
        accessibilityLabel="Zmień motyw"
        style={({ pressed }) => [styles.themeBtn, { borderColor: c.border, opacity: pressed ? 0.6 : 1 }]}>
        <Text style={styles.themeIco}>{motyw === 'dark' ? '☀️' : '🌙'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderBottomWidth: 1 },
  logo: { fontFamily: Fonts.black, fontSize: 20, letterSpacing: -1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  date: { flex: 1, textAlign: 'center', fontFamily: Fonts.semibold, fontSize: 13 },
  themeBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 9 },
  themeIco: { fontSize: 16 },
});
