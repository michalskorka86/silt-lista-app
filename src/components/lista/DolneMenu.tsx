import { router, usePathname } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Size } from '@/constants/theme';
import { useMotyw } from '@/theme/motyw';

import { OknoMenu } from './Menu';

/** Dolne menu listy (.nav-menu z v19): Dom / Lista / Wydatki / Menu. */
export function DolneMenu({ data }: { data: string }) {
  const { c } = useMotyw();
  const [menu, setMenu] = useState(false);
  const insets = useSafeAreaInsets();
  const sciezka = usePathname();

  const poz = [
    { ico: '🏠', nazwa: 'Dom', akt: false, onPress: () => router.dismissTo('/') },
    { ico: '📋', nazwa: 'Lista', akt: sciezka.startsWith('/lista'), onPress: () => router.replace({ pathname: '/lista/[data]', params: { data } }) },
    { ico: '📝', nazwa: 'Wydatki', akt: sciezka.startsWith('/wydatki'), onPress: () => router.replace({ pathname: '/wydatki/[data]', params: { data } }) },
    { ico: '☰', nazwa: 'Menu', akt: menu, onPress: () => setMenu(true) },
  ];

  return (
    <View
      style={[
        styles.nav,
        { height: Size.navH + insets.bottom, paddingBottom: insets.bottom, backgroundColor: c.surface, borderTopColor: c.border },
      ]}>
      {poz.map((p) => (
        <Pressable key={p.nazwa} onPress={p.onPress} style={styles.item} accessibilityLabel={p.nazwa}>
          <Text style={styles.ico}>{p.ico}</Text>
          <Text style={[styles.txt, { color: p.akt ? c.accent : c.text2 }]}>{p.nazwa}</Text>
        </Pressable>
      ))}
      <OknoMenu widoczne={menu} onZamknij={() => setMenu(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', borderTopWidth: 1 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  ico: { fontSize: 20, lineHeight: 24 },
  txt: { fontFamily: Fonts.bold, fontSize: 10 },
});
