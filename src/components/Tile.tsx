import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Fonts, Size } from '@/constants/theme';
import { useMotyw } from '@/theme/motyw';

type Props = {
  ico: string;
  nazwa: string;
  opis?: string;
  poziomo?: boolean; // ikona obok tekstu (jak kafelek „Rezerwacje” w v19)
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Kafelek ekranu startowego / menu (.home-tile z v19). */
export function Tile({ ico, nazwa, opis, poziomo, onPress, style }: Props) {
  const { c } = useMotyw();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        poziomo && styles.row,
        {
          backgroundColor: pressed ? c.accentSoft : c.surface,
          borderColor: pressed ? c.accent : c.border,
        },
        style,
      ]}>
      <Text style={styles.ico}>{ico}</Text>
      <View style={poziomo ? styles.textsLeft : styles.textsCenter}>
        <Text style={[styles.name, { color: c.text }]}>{nazwa}</Text>
        {opis ? <Text style={[styles.sub, { color: c.text2 }]}>{opis}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    borderRadius: Size.tileR,
    borderWidth: 2,
    alignItems: 'center',
    gap: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 14, paddingVertical: 20 },
  ico: { fontSize: 36 },
  textsCenter: { alignItems: 'center', gap: 2 },
  textsLeft: { alignItems: 'flex-start', gap: 2 },
  name: { fontFamily: Fonts.extrabold, fontSize: 18 },
  sub: { fontFamily: Fonts.regular, fontSize: 12 },
});
