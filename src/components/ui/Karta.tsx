import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Size } from '@/constants/theme';
import { useMotyw } from '@/theme/motyw';

/** Karta z nagłówkiem (.card / .card-head z v19). */
export function Karta({ ico, tytul, suma, children }: { ico?: string; tytul?: string; suma?: string; children: ReactNode }) {
  const { c } = useMotyw();
  return (
    <View style={[styles.karta, { backgroundColor: c.surface, borderColor: c.border }]}>
      {tytul ? (
        <View style={[styles.head, { backgroundColor: c.surface2, borderBottomColor: c.border }]}>
          {ico ? <Text style={styles.ico}>{ico}</Text> : null}
          <Text style={[styles.tytul, { color: c.text }]}>{tytul}</Text>
          {suma !== undefined ? <Text style={[styles.suma, { color: c.accent }]}>{suma}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Wiersz z treścią, plakietkami kwot i ✕ (.row-in z v19). */
export function WierszKarty({ children, onUsun }: { children: ReactNode; onUsun?: () => void }) {
  const { c } = useMotyw();
  return (
    <View style={[styles.wiersz, { borderBottomColor: c.border }]}>
      {children}
      {onUsun ? (
        <Pressable onPress={onUsun} hitSlop={8} style={({ pressed }) => [styles.del, pressed && { backgroundColor: 'rgba(239,68,68,0.1)' }]} accessibilityLabel="Usuń">
          <Text style={[styles.delTxt, { color: c.text3 }]}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Plakietka z kwotą do stuknięcia (.kwota-badge). */
export function Plakietka({ tekst, onPress, mala }: { tekst: string; onPress?: () => void; mala?: boolean }) {
  const { c } = useMotyw();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.badge,
        mala && styles.badgeMala,
        { backgroundColor: c.surface2, borderColor: pressed ? c.accent : c.border },
      ]}>
      <Text style={[styles.badgeTxt, { color: c.text }]}>{tekst}</Text>
    </Pressable>
  );
}

/** „＋ Dodaj …” na dole karty (.add-row-btn). */
export function DodajWiersz({ tekst, onPress }: { tekst: string; onPress: () => void }) {
  const { c } = useMotyw();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.add, { borderTopColor: c.border2 }, pressed && { backgroundColor: c.accentSoft }]}>
      <Text style={[styles.addTxt, { color: c.text2 }]}>{tekst}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  karta: { borderWidth: 1, borderRadius: Size.r2, overflow: 'hidden', marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1 },
  ico: { fontSize: 18 },
  tytul: { flex: 1, fontFamily: Fonts.extrabold, fontSize: 15 },
  suma: { fontFamily: Fonts.extrabold, fontSize: 14 },
  wiersz: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1 },
  del: { padding: 6, borderRadius: 5 },
  delTxt: { fontSize: 16 },
  badge: { minWidth: 70, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 7, borderWidth: 1, alignItems: 'flex-end' },
  badgeMala: { minWidth: 54 },
  badgeTxt: { fontFamily: Fonts.extrabold, fontSize: 13 },
  add: { paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: 1, borderStyle: 'dashed' },
  addTxt: { fontFamily: Fonts.bold, fontSize: 13 },
});
