import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Size } from '@/constants/theme';
import { useSync } from '@/sync/SyncProvider';
import { useMotyw } from '@/theme/motyw';

const godzina = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '';

/**
 * Górny pasek jak w v19: logo SILT, kropka auto-zapisu, kropka synchronizacji,
 * „⏳ Niewysłane” (zmiany czekające na internet), data na środku, przełącznik motywu.
 */
export function TopBar({ data }: { data?: string }) {
  const { c, motyw, przelacz } = useMotyw();
  const { stan, niewyslane, trwa, synchronizujTeraz } = useSync();
  const insets = useSafeAreaInsets();

  const s = stan?.stan;
  const kolorSync = trwa ? c.accent : s === 'ok' ? c.green : s === 'offline' || s === 'blad' || s === 'aktualizacja' ? c.red : c.text3;

  const infoSync = () => {
    const tekst = trwa
      ? '🟡 Synchronizacja…'
      : s === 'ok'
        ? `🟢 Zsynchronizowano ${godzina(stan?.ostatnio)}`
        : s === 'offline'
          ? '🔴 Brak połączenia — dane są zapisane na tablecie i wyślą się same, gdy wróci zasięg'
          : s === 'aktualizacja' || s === 'blad'
            ? `🔴 ${stan?.komunikat ?? 'Błąd synchronizacji'}`
            : '⚪ Zapis tylko na tablecie';
    Alert.alert('Synchronizacja', tekst, [{ text: 'OK' }]);
  };

  const infoNiewyslane = () =>
    Alert.alert(
      '⏳ Niewysłane zmiany',
      `Na serwer nie trafiło jeszcze ${niewyslane} ${niewyslane === 1 ? 'zmiana' : niewyslane < 5 ? 'zmiany' : 'zmian'}. ` +
        'Dane są bezpieczne na tablecie. Wyślą się same, gdy tablet złapie internet — możesz też spróbować teraz.',
      [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Wyślij teraz', onPress: () => synchronizujTeraz() },
      ],
    );

  return (
    <View
      style={[
        styles.bar,
        { paddingTop: insets.top, height: Size.topH + insets.top, backgroundColor: c.surface, borderBottomColor: c.border },
      ]}>
      <Text style={[styles.logo, { color: c.accent }]}>SILT</Text>
      <View style={[styles.dot, { backgroundColor: c.green }]} accessibilityLabel="Auto-zapis" />
      <Pressable onPress={infoSync} hitSlop={12} accessibilityLabel="Synchronizacja">
        <View style={[styles.syncDot, { backgroundColor: kolorSync }]} />
      </Pressable>
      {s === 'aktualizacja' ? (
        <Pressable onPress={infoSync} style={[styles.badge, { borderColor: c.red, backgroundColor: 'rgba(239,68,68,.15)' }]}>
          <Text style={[styles.badgeTxt, { color: c.red }]}>⚠ Zaktualizuj</Text>
        </Pressable>
      ) : niewyslane > 0 ? (
        <Pressable onPress={infoNiewyslane} style={[styles.badge, { borderColor: c.yellow, backgroundColor: 'rgba(234,179,8,.15)' }]}>
          <Text style={[styles.badgeTxt, { color: c.yellow }]}>⏳ Niewysłane</Text>
        </Pressable>
      ) : null}
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
  syncDot: { width: 10, height: 10, borderRadius: 5 },
  badge: { borderWidth: 1, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 },
  badgeTxt: { fontFamily: Fonts.extrabold, fontSize: 12 },
  date: { flex: 1, textAlign: 'center', fontFamily: Fonts.semibold, fontSize: 13 },
  themeBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 9 },
  themeIco: { fontSize: 16 },
});
