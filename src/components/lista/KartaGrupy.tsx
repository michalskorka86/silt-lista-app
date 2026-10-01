import { useSQLiteContext } from 'expo-sqlite';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import type { Wiersz } from '@/db/tabele';
import type { Atrakcja } from '@/logika/cennik';
import { liczba, zl, zlDash } from '@/logika/format';
import { usunGracza, usunGrupe, zmienGrupe, type GraczPelny, type GrupaPelna } from '@/logika/lista';
import { useMotyw } from '@/theme/motyw';

import { useKomunikaty } from '../ui/Komunikaty';
import { WierszGracza } from './WierszGracza';

export const IKONY_PLATNOSCI: Record<string, string> = { Gotówka: '💵', Karta: '💳', Przelew: '🏦' };

export function etykietaPakietu(g: Pick<GrupaPelna, 'pakiet_typ' | 'pakiet_cena' | 'pakiet_limit'>): string {
  if (g.pakiet_typ === 'grupa') return g.pakiet_cena ? zl(g.pakiet_cena) + (g.pakiet_limit ? ` / do ${g.pakiet_limit} os.` : '') : 'ustal cenę';
  return `${zl(g.pakiet_cena)} / os.`;
}

export type AkcjeKarty = {
  onDodajGracza: () => void;
  onEdytujGracza: (p: GraczPelny) => void;
  onPozycje: (p: GraczPelny) => void;
  onChip: (p: GraczPelny, poz: Wiersz<'pozycje'>) => void;
  onPlatnosc: () => void;
  onPodstawa: () => void;
  onKdod: () => void;
  onFaktura: () => void;
  onDodatek: () => void;
  onZdjecie: () => void;
};

/** Karta grupy (.group-card z v19): nagłówek, gracze, dodatki i ceny, Osób/Kulki/Kwota, Zadatek/Do zapłaty/Płatność/Faktura. */
export function KartaGrupy({ grupa: g, numer, atrakcja, akcje }: { grupa: GrupaPelna; numer: number; atrakcja?: Atrakcja; akcje: AkcjeKarty }) {
  const { c } = useMotyw();
  const db = useSQLiteContext();
  const { potwierdz, numpad } = useKomunikaty();
  const w = g.wynik;
  const kolor = atrakcja?.kolor ?? '#888888';
  const nazwa = atrakcja?.nazwa ?? g.atrakcja;

  const edytujGracze = () =>
    numpad({ tytul: 'Liczba osób', wartosc: w.gracze || null, onOk: (v) => zmienGrupe(db, g.id, { gracze_reczne: Math.round(v) }) });
  const edytujKulki = () =>
    numpad({ tytul: 'Kulki dla całej grupy (bez imion)', wartosc: w.kG || null, onOk: (v) => zmienGrupe(db, g.id, { kulki_reczne: Math.round(v) }) });
  const edytujKwote = () =>
    numpad({
      tytul: 'Kwota grupy (zł)',
      wartosc: w.kwota || null,
      onOk: (v) => zmienGrupe(db, g.id, { kwota_reczna: v }),
      extra: { tekst: `↺ Licz automatycznie (${zl(w.auto)})`, onPress: () => zmienGrupe(db, g.id, { kwota_reczna: null }) },
    });
  const edytujZadatek = () => numpad({ tytul: 'Zadatek (zł)', wartosc: g.zadatek || 100, onOk: (v) => zmienGrupe(db, g.id, { zadatek: v }) });

  const usunTe = () =>
    potwierdz({
      tytul: '🗑️ Usuń grupę',
      tekst: `Usunąć grupę ${nazwa}${g.organizator ? ` — ${g.organizator}` : ''}? Przez 7 dni można ją przywrócić z kosza.`,
      ok: 'Usuń grupę',
      onOk: () => usunGrupe(db, g.id),
    });

  const usunGraczaZ = (p: GraczPelny) =>
    potwierdz({ tytul: 'Usuń gracza', tekst: `Usunąć gracza ${p.imie} razem z jego kulkami?`, ok: 'Usuń', onOk: () => usunGracza(db, p.id) });

  const opisKulek =
    [w.kG ? `bez imion: ${liczba(w.kG)}` : '', w.kD ? `dokupione: ${liczba(w.kD)}` : '', w.kW ? `worki (wł. sprzęt): ${liczba(w.kW)}` : '']
      .filter(Boolean)
      .join(' · ') || 'dotknij, aby wpisać kulki dla całej grupy';
  const opisKwoty =
    g.kwota_reczna !== null
      ? `✋ ręcznie (auto: ${zl(w.auto)})`
      : `auto: podstawa ${zl(w.base)}` +
        (w.dodKw ? ` + kulki ${zl(w.dodKw)}` : '') +
        (w.sprzetKw ? ` + sprzęt ${zl(w.sprzetKw)}` : '') +
        (w.workiKw ? ` + worki ${zl(w.workiKw)}` : '') +
        (w.dymKw + w.inneKw + w.dodatkiKw ? ` + dodatki ${zl(w.dymKw + w.inneKw + w.dodatkiKw)}` : '');

  return (
    <View style={[styles.karta, { backgroundColor: c.surface, borderColor: c.border, borderLeftColor: kolor }]}>
      {/* nagłówek */}
      <View style={styles.head}>
        <View style={[styles.num, { backgroundColor: kolor }]}>
          <Text style={styles.numTxt}>{numer}</Text>
        </View>
        <View style={styles.tytul}>
          <Text style={[styles.typ, { color: kolor }]} numberOfLines={1}>
            {nazwa.toUpperCase()}
            <Text style={[styles.typSmall, { color: c.text2 }]}>  {g.pakiet_nazwa}</Text>
          </Text>
          <View style={styles.meta}>
            <Text style={[styles.metaTxt, { color: c.text2 }]}>
              Organizator: <Text style={{ color: c.text, fontFamily: Fonts.bold }}>{g.organizator || '—'}</Text>
            </Text>
            <View style={styles.metaOsob}>
              <Text style={[styles.metaTxt, { color: c.text2 }]}>Osób: </Text>
              <Pressable onPress={edytujGracze} style={[styles.osob, { backgroundColor: c.bg, borderColor: c.border }]}>
                <Text style={[styles.osobTxt, { color: c.text }]}>{w.gracze}</Text>
              </Pressable>
            </View>
            <Text style={[styles.metaTxt, { color: c.text2 }]}>
              🎯 Kulki: <Text style={{ color: c.text, fontFamily: Fonts.bold }}>{liczba(w.kulki)}</Text>
            </Text>
            {w.dymN ? (
              <Text style={[styles.metaTxt, { color: c.text2 }]}>
                💨 DYM: <Text style={{ color: c.text, fontFamily: Fonts.bold }}>{w.dymN}</Text>
              </Text>
            ) : null}
            <Text style={[styles.metaTxt, { color: c.text2 }]}>🕙 {g.godzina}</Text>
          </View>
        </View>
        <Pressable
          onPress={usunTe}
          accessibilityLabel="Usuń grupę"
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: pressed ? 'rgba(239,68,68,0.1)' : c.surface2, borderColor: pressed ? 'rgba(239,68,68,0.5)' : c.border },
          ]}>
          <Text style={styles.iconTxt}>🗑️</Text>
        </Pressable>
      </View>

      {/* gracze */}
      <View style={styles.gracze}>
        {g.gracze.map((p) => (
          <WierszGracza
            key={p.id}
            gracz={p}
            kolor={kolor}
            onEdytuj={() => akcje.onEdytujGracza(p)}
            onPozycje={() => akcje.onPozycje(p)}
            onChip={(poz) => akcje.onChip(p, poz)}
            onUsun={() => usunGraczaZ(p)}
          />
        ))}
      </View>
      <View style={styles.addRow}>
        <Kreskowany onPress={akcje.onDodajGracza} style={styles.flex}>
          👤＋ Dodaj gracza
        </Kreskowany>
        <Kreskowany onPress={akcje.onZdjecie}>📷 Gracze ze zdjęcia kartki</Kreskowany>
      </View>

      {/* dodatki i ceny */}
      <View style={styles.dod}>
        {g.dodatki.map((d) => (
          <View key={d.id} style={[styles.dodChip, { borderColor: 'rgba(34,197,94,0.5)', backgroundColor: 'rgba(34,197,94,0.1)' }]}>
            <Text style={[styles.dodTxt, { color: c.green }]}>
              {d.nazwa} {d.kwota ? zl(d.kwota) : 'gratis'}
            </Text>
          </View>
        ))}
        <Pressable onPress={akcje.onDodatek} style={[styles.dodAdd, { borderColor: c.border2 }]}>
          <Text style={[styles.dodAddTxt, { color: c.text2 }]}>＋ Dodaj dodatek</Text>
        </Pressable>
        <Kafel etykieta="Podstawa" wartosc={etykietaPakietu(g)} onPress={akcje.onPodstawa} />
        {g.kdod_ilosc ? <Kafel etykieta="Kulki dodatkowe" wartosc={`${zl(g.kdod_cena)} / ${g.kdod_ilosc} szt`} onPress={akcje.onKdod} /> : null}
        <Kafel etykieta="Kulki bez imion" wartosc={w.kG ? `🎯 ${liczba(w.kG)}` : '＋ wpisz'} onPress={edytujKulki} />
      </View>

      {/* osób / kulki / kwota */}
      <View style={[styles.sum, { borderTopColor: c.border, backgroundColor: c.surface2 }]}>
        <Komorka etykieta="Osób" onPress={edytujGracze}>
          <Text style={[styles.val, { color: c.text }]}>{w.gracze}</Text>
        </Komorka>
        <Komorka etykieta="Kulki" onPress={edytujKulki}>
          <Text style={[styles.val, { color: c.text }]}>{liczba(w.kulki)}</Text>
          <Text style={[styles.sub, { color: c.text2 }]}>{opisKulek}</Text>
        </Komorka>
        <Komorka etykieta="Kwota" onPress={edytujKwote} ostatnia>
          <Text style={[styles.val, { color: c.accent }]}>{zlDash(w.kwota)}</Text>
          <Text style={[styles.sub, { color: c.text2 }]}>{opisKwoty}</Text>
        </Komorka>
      </View>

      {/* zadatek / do zapłaty / płatność / faktura */}
      <View style={[styles.pay, { borderTopColor: c.border }]}>
        <PayKom etykieta="Zadatek" onPress={edytujZadatek} flex={1.4}>
          <Text style={[styles.val, styles.big, { color: c.accent }]}>{zlDash(w.zad)}</Text>
        </PayKom>
        <PayKom etykieta="Do zapłaty">
          <Text style={[styles.val, styles.payVal, { color: c.green }]}>{w.doZap > 0 ? zl(w.doZap) : '—'}</Text>
        </PayKom>
        <PayKom etykieta="Płatność" onPress={akcje.onPlatnosc}>
          <Text style={[styles.val, styles.payVal, { color: c.text }]}>{g.platnosc ? `${IKONY_PLATNOSCI[g.platnosc]} ${g.platnosc}` : '—'}</Text>
        </PayKom>
        <PayKom etykieta="Faktura" onPress={akcje.onFaktura} ostatnia>
          <Text style={[styles.val, styles.payVal, { color: g.faktura ? c.green : c.text }]}>🧾 {g.faktura ? 'Tak' : 'Nie'}</Text>
        </PayKom>
      </View>
    </View>
  );
}

function Kreskowany({ children, onPress, style }: { children: ReactNode; onPress: () => void; style?: object }) {
  const { c } = useMotyw();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.kresk, { borderColor: pressed ? c.accent : c.border2 }, style]}>
      <Text style={[styles.kreskTxt, { color: c.text2 }]}>{children}</Text>
    </Pressable>
  );
}

function Kafel({ etykieta, wartosc, onPress }: { etykieta: string; wartosc: string; onPress: () => void }) {
  const { c } = useMotyw();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.kafel, { backgroundColor: c.surface2, borderColor: pressed ? c.accent : c.border2 }]}>
      <Text style={[styles.kafelLbl, { color: c.text2 }]}>{etykieta.toUpperCase()}</Text>
      <Text style={[styles.kafelVal, { color: c.text }]}>{wartosc}</Text>
    </Pressable>
  );
}

function Komorka({ etykieta, onPress, ostatnia, children }: { etykieta: string; onPress: () => void; ostatnia?: boolean; children: ReactNode }) {
  const { c } = useMotyw();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.kom,
        !ostatnia && { borderRightWidth: 1, borderRightColor: c.border },
        pressed && { backgroundColor: 'rgba(249,115,22,0.06)' },
      ]}>
      <Text style={styles.edit}>✏️</Text>
      <Text style={[styles.lbl, { color: c.text2 }]}>{etykieta.toUpperCase()}</Text>
      {children}
    </Pressable>
  );
}

function PayKom({
  etykieta,
  onPress,
  ostatnia,
  flex = 1,
  children,
}: {
  etykieta: string;
  onPress?: () => void;
  ostatnia?: boolean;
  flex?: number;
  children: ReactNode;
}) {
  const { c } = useMotyw();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.payKom,
        { flex },
        !ostatnia && { borderRightWidth: 1, borderRightColor: c.border },
        pressed && { backgroundColor: 'rgba(249,115,22,0.06)' },
      ]}>
      <Text style={[styles.lbl, { color: c.text2 }]}>{etykieta.toUpperCase()}</Text>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  karta: { borderWidth: 1, borderLeftWidth: 6, borderRadius: 16, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  num: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  numTxt: { color: '#fff', fontFamily: Fonts.black, fontSize: 18 },
  tytul: { flex: 1, minWidth: 0 },
  typ: { fontFamily: Fonts.black, fontSize: 13, letterSpacing: 0.6 },
  typSmall: { fontFamily: Fonts.bold, letterSpacing: 0 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 4, marginTop: 4 },
  metaTxt: { fontFamily: Fonts.regular, fontSize: 13 },
  metaOsob: { flexDirection: 'row', alignItems: 'center' },
  osob: { minWidth: 40, paddingVertical: 3, paddingHorizontal: 9, borderRadius: 6, borderWidth: 1, alignItems: 'center' },
  osobTxt: { fontFamily: Fonts.extrabold, fontSize: 13 },
  iconBtn: { width: 42, height: 42, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  iconTxt: { fontSize: 17 },
  gracze: { gap: 6, paddingHorizontal: 12 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 6, marginHorizontal: 12 },
  kresk: { padding: 12, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kreskTxt: { fontFamily: Fonts.bold, fontSize: 13 },
  dod: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingTop: 10, paddingHorizontal: 12, paddingBottom: 12 },
  dodChip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1 },
  dodTxt: { fontFamily: Fonts.extrabold, fontSize: 12 },
  dodAdd: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed' },
  dodAddTxt: { fontFamily: Fonts.bold, fontSize: 12 },
  kafel: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  kafelLbl: { fontFamily: Fonts.extrabold, fontSize: 10, letterSpacing: 0.5 },
  kafelVal: { fontFamily: Fonts.extrabold, fontSize: 13 },
  sum: { flexDirection: 'row', borderTopWidth: 1 },
  kom: { flex: 1, paddingVertical: 9, paddingHorizontal: 12 },
  edit: { position: 'absolute', top: 7, right: 9, fontSize: 11, opacity: 0.35 },
  lbl: { fontFamily: Fonts.extrabold, fontSize: 10, letterSpacing: 0.6 },
  val: { fontFamily: Fonts.black, fontSize: 18, marginTop: 2 },
  sub: { fontFamily: Fonts.semibold, fontSize: 11, marginTop: 1 },
  pay: { flexDirection: 'row', borderTopWidth: 1 },
  payKom: { paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', gap: 4 },
  payVal: { fontSize: 15, textAlign: 'center' },
  big: { fontSize: 22 },
});
