import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import type { Wiersz } from '@/db/tabele';
import { zl } from '@/logika/format';
import type { GraczPelny } from '@/logika/lista';
import { useMotyw } from '@/theme/motyw';

/**
 * Wiersz gracza w karcie grupy (.gc-player z v19):
 * 👤 | imię (uwagi) | kulki z pakietu ┃ dokupione | DYM | inne | ✕
 */
export function WierszGracza({
  gracz,
  kolor,
  onEdytuj,
  onPozycje,
  onChip,
  onUsun,
}: {
  gracz: GraczPelny;
  kolor: string;
  onEdytuj: () => void;
  onPozycje: () => void;
  onChip: (p: Wiersz<'pozycje'>) => void;
  onUsun: () => void;
}) {
  const { c } = useMotyw();
  const { width } = useWindowDimensions();
  const kp = gracz.pozycje.filter((i) => i.rodzaj === 'kulki' && !i.dokupione);
  const kd = gracz.pozycje.filter((i) => i.rodzaj === 'kulki' && i.dokupione);
  const dym = gracz.pozycje.filter((i) => i.rodzaj === 'dym');
  const inne = gracz.pozycje.filter((i) => i.rodzaj === 'inne');
  const maSprzet = !!gracz.sprzet?.length;

  const puste = !gracz.pozycje.length && !maSprzet && !gracz.worki_ilosc && gracz.pakiet_cena === null;

  return (
    <View style={[styles.wiersz, { backgroundColor: c.surface2, borderColor: c.border }]}>
      <Pressable onPress={onEdytuj} style={[styles.ico, { backgroundColor: kolor }]}>
        <Text style={styles.icoTxt}>👤</Text>
      </Pressable>
      <Pressable onPress={onEdytuj} style={[styles.imie, { width: width < 700 ? 120 : 190 }]}>
        <Text style={[styles.imieTxt, { color: c.text }]} numberOfLines={1}>
          {gracz.imie}
          {gracz.notatka ? <Text style={{ color: c.text2, fontFamily: Fonts.semibold }}> ({gracz.notatka})</Text> : null}
        </Text>
      </Pressable>
      <Pressable onPress={onPozycje} style={({ pressed }) => [styles.pozycje, pressed && { backgroundColor: 'rgba(249,115,22,0.05)' }]}>
        {puste ? <Text style={[styles.puste, { color: c.text3 }]}>＋ dotknij, aby dodać kulki / dym</Text> : null}
        {gracz.pakiet_cena !== null && !maSprzet ? (
          <Chip styl="pk" tekst={`📦 ${gracz.pakiet_nazwa ?? ''} ${zl(gracz.pakiet_cena)}`} onPress={onEdytuj} />
        ) : null}
        {(gracz.sprzet ?? []).map((x, i) => (
          <Chip key={`s${i}`} styl="sp" tekst={`${x.ikona ?? '🎒'} ${x.nazwa} ${zl(x.kwota)}`} onPress={onEdytuj} />
        ))}
        {gracz.worki_ilosc ? (
          <Chip
            styl="sp"
            tekst={`🎯 Worek ${gracz.worki_szt ?? ''}${gracz.worki_ilosc > 1 ? ` ×${gracz.worki_ilosc}` : ''} · ${zl(gracz.worki_ilosc * (gracz.worki_cena ?? 0))}`}
            onPress={onEdytuj}
          />
        ) : null}
        {kp.map((i) => (
          <Chip key={i.id} styl="kulki" tekst={`🎯 ${i.ilosc}`} onPress={() => onChip(i)} />
        ))}
        {kd.length ? <View style={[styles.sep, { backgroundColor: c.red }]} /> : null}
        {kd.map((i) => (
          <Chip key={i.id} styl="dok" tekst={`🎯 ${i.ilosc}`} onPress={() => onChip(i)} />
        ))}
        {dym.map((i) => (
          <Chip key={i.id} styl="dym" tekst={`💨 DYM ×${i.ilosc} · ${i.kwota ? zl(i.kwota) : 'gratis'}`} onPress={() => onChip(i)} />
        ))}
        {inne.map((i) => (
          <Chip key={i.id} styl="inne" tekst={`📦 ${i.nazwa ?? ''}${i.kwota ? ` ${zl(i.kwota)}` : ''}`} onPress={() => onChip(i)} />
        ))}
      </Pressable>
      <Pressable onPress={onUsun} style={[styles.del, { borderLeftColor: c.border }]} accessibilityLabel="Usuń gracza">
        <Text style={[styles.delTxt, { color: c.text3 }]}>✕</Text>
      </Pressable>
    </View>
  );
}

type StylChipa = 'kulki' | 'dok' | 'dym' | 'inne' | 'pk' | 'sp';

function Chip({ tekst, styl, onPress }: { tekst: string; styl: StylChipa; onPress: () => void }) {
  const { c } = useMotyw();
  const s = {
    kulki: { bg: 'rgba(249,115,22,0.15)', bd: 'rgba(249,115,22,0.45)', fg: c.accent },
    dok: { bg: 'rgba(234,179,8,0.14)', bd: 'rgba(234,179,8,0.5)', fg: c.yellow },
    dym: { bg: 'rgba(168,85,247,0.15)', bd: 'rgba(168,85,247,0.5)', fg: '#c084fc' },
    inne: { bg: c.surface3, bd: c.border2, fg: c.text2 },
    pk: { bg: 'rgba(59,130,246,0.15)', bd: c.blue, fg: c.text },
    sp: { bg: 'rgba(168,85,247,0.15)', bd: c.purple, fg: c.text },
  }[styl];
  return (
    <Pressable onPress={onPress} style={[styles.chip, { backgroundColor: s.bg, borderColor: s.bd }]}>
      <Text style={[styles.chipTxt, { color: s.fg }]}>{tekst}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wiersz: { flexDirection: 'row', alignItems: 'stretch', borderWidth: 1, borderRadius: 10, overflow: 'hidden', minHeight: 48 },
  ico: { width: 44, alignItems: 'center', justifyContent: 'center' },
  icoTxt: { fontSize: 18 },
  imie: { paddingHorizontal: 12, justifyContent: 'center' },
  imieTxt: { fontFamily: Fonts.bold, fontSize: 15 },
  pozycje: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 4, minHeight: 46 },
  puste: { fontFamily: Fonts.semibold, fontSize: 12 },
  chip: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1 },
  chipTxt: { fontFamily: Fonts.extrabold, fontSize: 13 },
  sep: { width: 4, alignSelf: 'stretch', minHeight: 26, marginHorizontal: 4, borderRadius: 2 },
  del: { width: 46, borderLeftWidth: 1, alignItems: 'center', justifyContent: 'center' },
  delTxt: { fontSize: 15 },
});
