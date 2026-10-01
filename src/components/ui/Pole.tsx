import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useMotyw } from '@/theme/motyw';

/** Pole formularza z etykietą (.m-field z v19). */
export const Pole = forwardRef<TextInput, TextInputProps & { etykieta: string; styleWrap?: StyleProp<ViewStyle>; duze?: boolean }>(
  function Pole({ etykieta, styleWrap, duze, style, ...rest }, ref) {
    const { c } = useMotyw();
    return (
      <View style={[styles.wrap, styleWrap]}>
        <Text style={[styles.label, { color: c.text2 }]}>{etykieta}</Text>
        <TextInput
          ref={ref}
          placeholderTextColor={c.text3}
          style={[
            styles.input,
            duze && styles.duze,
            { backgroundColor: c.surface2, borderColor: c.border, color: c.text },
            style,
          ]}
          {...rest}
        />
      </View>
    );
  },
);

/** Mała podpowiedź pod polem (.hint). */
export function Podpowiedz({ children }: { children: React.ReactNode }) {
  const { c } = useMotyw();
  return <Text style={[styles.hint, { color: c.text2 }]}>{children}</Text>;
}

/** Dwa pola obok siebie (.m-row). */
export function Rzad({ children }: { children: React.ReactNode }) {
  return <View style={styles.rzad}>{children}</View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 5, marginBottom: 12, flex: 1 },
  label: { fontFamily: Fonts.bold, fontSize: 12 },
  input: { borderWidth: 1, borderRadius: 8, paddingVertical: 11, paddingHorizontal: 12, fontFamily: Fonts.semibold, fontSize: 15 },
  duze: { fontSize: 17, padding: 14 },
  hint: { fontFamily: Fonts.regular, fontSize: 12, marginTop: -4, marginBottom: 10 },
  rzad: { flexDirection: 'row', gap: 10 },
});
