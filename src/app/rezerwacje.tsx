import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { TopBar } from '@/components/TopBar';
import { Okno, Przycisk, Przyciski } from '@/components/ui/Okno';
import { Fonts, Size } from '@/constants/theme';
import { dzisISO } from '@/logika/format';
import { wczytajMiesiac, ym, type MiesiacRezerwacji, type Rezerwacja } from '@/logika/rezerwacje';
import { BladSerwera } from '@/sync/klient';
import { useSync } from '@/sync/SyncProvider';
import { useMotyw } from '@/theme/motyw';

const MIES = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
const MIES_D = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const DNI = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
const DNI_KR = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];

type Filtr = 'all' | 'silt' | 'arsenal';

const dzienOpis = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return `${DNI[d.getDay()]}, ${d.getDate()} ${MIES_D[d.getMonth()]}`;
};

/** Podgląd rezerwacji (rezerwacje.php z v19): miesiąc, dzień, szczegóły; filtr SILT / Arsenał; działa bez zasięgu. */
export default function Rezerwacje() {
  const { c } = useMotyw();
  const db = useSQLiteContext();
  const { pobierzRezerwacje } = useSync();
  const { width } = useWindowDimensions();
  const szeroki = width >= 900;
  const dzis = dzisISO();

  const [mies, setMies] = useState(() => ({ r: new Date().getFullYear(), m: new Date().getMonth() }));
  const [sel, setSel] = useState(dzis);
  const [filtr, setFiltr] = useState<Filtr>('silt');
  const [dane, setDane] = useState<MiesiacRezerwacji | null>(null);
  const [stan, setStan] = useState<'ok' | 'offline' | 'blad' | 'laduje'>('laduje');
  const [blad, setBlad] = useState('');
  const [szczegoly, setSzczegoly] = useState<Rezerwacja | null>(null);

  // Najpierw stan zapisany na tablecie (działa bez zasięgu), potem świeże dane z serwera.
  // `odswiez` zmienia się po 🔄 — wtedy pobieramy jeszcze raz.
  const [odswiez, setOdswiez] = useState(0);
  useEffect(() => {
    let aktywny = true;
    (async () => {
      const zapisane = await wczytajMiesiac(db, ym(mies.r, mies.m));
      if (!aktywny) return;
      setDane(zapisane);
      setStan('laduje');
      try {
        const swieze = await pobierzRezerwacje(mies.r, mies.m);
        if (!aktywny) return;
        setDane(swieze);
        setStan('ok');
      } catch (e) {
        if (!aktywny) return;
        if (e instanceof BladSerwera) {
          setStan('blad');
          setBlad(e.kod === 'rez_konfiguracja' ? 'Podgląd rezerwacji nie jest jeszcze skonfigurowany na serwerze.' : e.message);
        } else setStan('offline');
      }
    })();
    return () => {
      aktywny = false;
    };
  }, [db, mies, pobierzRezerwacje, odswiez]);
  const zaladuj = useCallback(() => setOdswiez((n) => n + 1), []);

  const wszystkie = useMemo(() => dane?.rezerwacje ?? [], [dane]);
  const lista = useMemo(
    () => (filtr === 'all' ? wszystkie : wszystkie.filter((b) => (filtr === 'arsenal' ? b.marka === 'arsenal' : b.marka !== 'arsenal'))),
    [wszystkie, filtr],
  );
  const dnia = (iso: string) => lista.filter((b) => b.data === iso).sort((a, b) => a.od.localeCompare(b.od));

  const komorki = useMemo(() => {
    const przes = (new Date(mies.r, mies.m, 1).getDay() + 6) % 7;
    const ile = new Date(mies.r, mies.m + 1, 0).getDate();
    const out: (string | null)[] = Array(przes).fill(null);
    for (let d = 1; d <= ile; d++) out.push(dzisISO(new Date(mies.r, mies.m, d)));
    while (out.length % 7) out.push(null);
    return out;
  }, [mies]);

  const zmien = (o: number) => {
    const d = new Date(mies.r, mies.m + o, 1);
    setMies({ r: d.getFullYear(), m: d.getMonth() });
  };
  const naDzis = () => {
    const d = new Date();
    setMies({ r: d.getFullYear(), m: d.getMonth() });
    setSel(dzis);
  };

  const godz = dane?.t ? new Date(dane.t).toLocaleString('pl-PL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const info =
    stan === 'offline'
      ? dane
        ? `📴 Brak zasięgu — pokazuję stan z ${godz} (odświeży się, gdy wróci internet)`
        : '📴 Brak zasięgu i brak zapisanych danych dla tego miesiąca'
      : stan === 'blad'
        ? `⚠️ ${blad}`
        : stan === 'laduje'
          ? '⏳ Pobieranie…'
          : godz
            ? `Zaktualizowano: ${godz}`
            : '';

  const wDniu = dnia(sel);
  const listaSzcz = szczegoly ? dnia(szczegoly.data) : [];
  const idx = szczegoly ? listaSzcz.findIndex((x) => x.id === szczegoly.id) : -1;

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <TopBar />
      <View style={[styles.top, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <Btn tekst="←" onPress={() => router.back()} />
        <Text style={[styles.h1, { color: c.text }]}>📅 Rezerwacje</Text>
        <View style={styles.seg}>
          {(
            [
              ['all', 'Wszystkie'],
              ['silt', 'SILT'],
              ['arsenal', 'Arsenał'],
            ] as const
          ).map(([k, n]) => (
            <Btn key={k} tekst={n} on={filtr === k} onPress={() => setFiltr(k)} />
          ))}
        </View>
        <Btn tekst="Dziś" onPress={naDzis} />
        <Btn tekst="🔄" onPress={zaladuj} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {dane?.atrakcje.length ? (
          <View style={styles.legenda}>
            {dane.atrakcje.map((a) => (
              <View key={a.nazwa} style={styles.legItem}>
                <View style={[styles.legKol, { backgroundColor: a.kolor }]} />
                <Text style={[styles.legTxt, { color: c.text2 }]}>{a.nazwa}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {info ? (
          <Text style={[styles.upd, { color: stan === 'offline' || stan === 'blad' ? c.yellow : c.text3 }, (stan === 'offline' || stan === 'blad') && styles.updOff]}>
            {info}
          </Text>
        ) : null}

        <View style={[styles.wrap, szeroki && styles.wrapSzeroki]}>
          {/* miesiąc */}
          <View style={[styles.karta, szeroki && { flex: 1.5 }, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={styles.mnav}>
              <Btn tekst="‹" onPress={() => zmien(-1)} />
              <Text style={[styles.mTytul, { color: c.text }]}>
                {MIES[mies.m]} {mies.r}
              </Text>
              <Btn tekst="›" onPress={() => zmien(1)} />
            </View>
            <View style={styles.siatka}>
              {DNI_KR.map((d) => (
                <Text key={d} style={[styles.th, { color: c.text2 }]}>
                  {d}
                </Text>
              ))}
              {komorki.map((iso, i) => {
                if (!iso) return <View key={`p${i}`} style={[styles.td, { height: szeroki ? 108 : 72, backgroundColor: c.surface2, borderColor: c.border }]} />;
                const ev = dnia(iso);
                const max = szeroki ? 4 : 2;
                const jestDzis = iso === dzis;
                return (
                  <Pressable
                    key={iso}
                    onPress={() => setSel(iso)}
                    style={[
                      styles.td,
                      { height: szeroki ? 108 : 72, borderColor: c.border },
                      iso === sel && { borderColor: c.green, borderWidth: 3 },
                    ]}>
                    <Text
                      style={[
                        styles.num,
                        { color: c.text },
                        jestDzis && { backgroundColor: c.green, color: '#fff' },
                        iso < dzis && !jestDzis && { opacity: 0.5 },
                      ]}>
                      {Number(iso.slice(8))}
                    </Text>
                    {ev.slice(0, max).map((b) => (
                      <Pressable
                        key={b.id}
                        onPress={() => {
                          setSel(iso);
                          setSzczegoly(b);
                        }}
                        style={[styles.ev, { backgroundColor: b.kolor }]}>
                        <Text style={styles.evTxt} numberOfLines={1}>
                          {b.od} {b.osoby}os {(b.klient || '').split(' ')[0]}
                        </Text>
                      </Pressable>
                    ))}
                    {ev.length > max ? <Text style={[styles.wiecej, { color: c.text2 }]}>+{ev.length - max} więcej</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* dzień */}
          <View style={[styles.karta, szeroki && { flex: 1 }, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={[styles.dayH, { borderBottomColor: c.border }]}>
              <Text style={[styles.dayHTxt, { color: c.text }]}>{dzienOpis(sel)}</Text>
            </View>
            <View style={styles.dayBody}>
              {wDniu.length ? (
                wDniu.map((b) => <KartaRezerwacji key={b.id} b={b} onPress={() => setSzczegoly(b)} />)
              ) : (
                <Text style={[styles.pusto, { color: c.text3 }]}>Brak rezerwacji w tym dniu</Text>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      <Okno widoczne={!!szczegoly} onZamknij={() => setSzczegoly(null)} rozmiar="md">
        {szczegoly ? (
          <>
            <View style={[styles.moHead, { backgroundColor: szczegoly.kolor }]}>
              <Text style={styles.moData}>{dzienOpis(szczegoly.data)}</Text>
              <View style={styles.rcTop}>
                <Text style={[styles.rcTime, { fontSize: 26 }]}>
                  {szczegoly.od}
                  {szczegoly.do ? `–${szczegoly.do}` : ''}
                </Text>
                <Text style={styles.rcOs}>{szczegoly.osoby} os.</Text>
              </View>
              <Text style={[styles.rcName, { fontSize: 20 }]}>{szczegoly.klient || '—'}</Text>
              <View style={styles.badges}>
                <Badge tekst={szczegoly.zadatek ? '✓ Zadatek opłacony' : 'Zadatek: brak'} />
                <Badge tekst={szczegoly.potw ? '✓ Potwierdzona' : 'Niepotwierdzona'} />
              </View>
            </View>
            <View style={styles.moBody}>
              <Wiersz l="Atrakcja" v={szczegoly.atrakcja} b />
              <Wiersz l="Miejsce" v={szczegoly.lok} />
              <Wiersz l="Liczba osób" v={String(szczegoly.osoby)} b />
              {szczegoly.dodatki.length ? <Wiersz l="Dodatki" v={szczegoly.dodatki.join(', ')} /> : null}
              {szczegoly.uwagi ? <Wiersz l="Uwagi" v={szczegoly.uwagi} /> : null}
              {szczegoly.instrukcje ? (
                <View style={[styles.instr, { backgroundColor: c.surface2, borderLeftColor: c.green }]}>
                  <Text style={[styles.instrTxt, { color: c.text }]}>
                    ⚙️ <Text style={{ fontFamily: Fonts.bold }}>Dla instruktora:</Text>
                    {'\n'}
                    {szczegoly.instrukcje}
                  </Text>
                </View>
              ) : null}
              {!szczegoly.dodatki.length && !szczegoly.uwagi && !szczegoly.instrukcje ? (
                <Text style={[styles.pustoMaly, { color: c.text3 }]}>Brak dodatków i uwag</Text>
              ) : null}
            </View>
            <Przyciski>
              <Przycisk tekst="‹ Poprzednia" rodzaj="anuluj" wylaczony={idx <= 0} onPress={() => setSzczegoly(listaSzcz[idx - 1])} />
              <Przycisk tekst="Następna ›" rodzaj="anuluj" wylaczony={idx < 0 || idx >= listaSzcz.length - 1} onPress={() => setSzczegoly(listaSzcz[idx + 1])} />
            </Przyciski>
            <Przyciski style={styles.zamknij}>
              <Przycisk tekst="Zamknij" rodzaj="anuluj" onPress={() => setSzczegoly(null)} />
            </Przyciski>
          </>
        ) : null}
      </Okno>
    </View>
  );
}

function Btn({ tekst, onPress, on }: { tekst: string; onPress: () => void; on?: boolean }) {
  const { c } = useMotyw();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { borderColor: on ? c.text : c.border, backgroundColor: on ? c.text : pressed ? c.surface2 : c.surface },
      ]}>
      <Text style={[styles.btnTxt, { color: on ? c.surface : c.text }]}>{tekst}</Text>
    </Pressable>
  );
}

function Badge({ tekst }: { tekst: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeTxt}>{tekst}</Text>
    </View>
  );
}

function KartaRezerwacji({ b, onPress }: { b: Rezerwacja; onPress: () => void }) {
  const wiecej = b.dodatki.length || b.uwagi || b.instrukcje;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.rc, { backgroundColor: b.kolor }, pressed && { transform: [{ scale: 0.98 }] }]}>
      <View style={styles.rcTop}>
        <Text style={styles.rcTime}>
          {b.od}
          {b.do ? `–${b.do}` : ''}
        </Text>
        <Text style={styles.rcOs}>{b.osoby} os.</Text>
        {b.zadatek ? <Badge tekst="✓ Zadatek" /> : null}
        {b.potw ? <Badge tekst="✓ Potw." /> : null}
        {b.marka !== 'silt' ? <Badge tekst={b.lok} /> : null}
      </View>
      <Text style={styles.rcName}>{b.klient || '—'}</Text>
      <Text style={styles.rcAttr}>{b.atrakcja}</Text>
      {wiecej ? (
        <Text style={styles.rcMore}>
          {b.instrukcje ? '⚙️ ' : ''}
          {b.dodatki.length ? '🎁 ' : ''}
          {b.uwagi ? '💬 ' : ''}Szczegóły ›
        </Text>
      ) : null}
    </Pressable>
  );
}

function Wiersz({ l, v, b }: { l: string; v: string; b?: boolean }) {
  const { c } = useMotyw();
  return (
    <View style={styles.moRow}>
      <Text style={[styles.moL, { color: c.text2 }]}>{l}</Text>
      <Text style={[styles.moV, { color: c.text }, b && { fontFamily: Fonts.bold }]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1 },
  h1: { flex: 1, minWidth: 140, fontFamily: Fonts.bold, fontSize: 18 },
  seg: { flexDirection: 'row', gap: 6 },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5 },
  btnTxt: { fontFamily: Fonts.semibold, fontSize: 15 },
  body: { paddingBottom: 30 },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 8, paddingHorizontal: 14 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legKol: { width: 10, height: 10, borderRadius: 3 },
  legTxt: { fontFamily: Fonts.regular, fontSize: 12 },
  upd: { fontFamily: Fonts.regular, fontSize: 12, paddingHorizontal: 14, paddingBottom: 8 },
  updOff: { fontFamily: Fonts.bold },
  wrap: { gap: 14, paddingHorizontal: 14 },
  wrapSzeroki: { flexDirection: 'row', alignItems: 'flex-start' },
  karta: { borderWidth: 1, borderRadius: Size.r2, overflow: 'hidden' },
  mnav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  mTytul: { fontFamily: Fonts.bold, fontSize: 18 },
  siatka: { flexDirection: 'row', flexWrap: 'wrap' },
  th: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: Fonts.semibold, fontSize: 12, paddingVertical: 6 },
  td: { width: `${100 / 7}%`, borderTopWidth: 1, borderRightWidth: 1, padding: 4, overflow: 'hidden' },
  num: { alignSelf: 'flex-start', minWidth: 24, textAlign: 'center', borderRadius: 12, paddingHorizontal: 4, paddingVertical: 1, marginBottom: 3, fontFamily: Fonts.bold, fontSize: 13, overflow: 'hidden' },
  ev: { borderRadius: 5, paddingVertical: 2, paddingHorizontal: 5, marginBottom: 2 },
  evTxt: { color: '#fff', fontFamily: Fonts.semibold, fontSize: 11 },
  wiecej: { fontFamily: Fonts.semibold, fontSize: 11 },
  dayH: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1 },
  dayHTxt: { fontFamily: Fonts.bold, fontSize: 18 },
  dayBody: { padding: 12, gap: 10 },
  pusto: { padding: 30, textAlign: 'center', fontFamily: Fonts.regular, fontSize: 15 },
  pustoMaly: { fontFamily: Fonts.regular, fontSize: 13 },
  rc: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16 },
  rcTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 10 },
  rcTime: { color: '#fff', fontFamily: Fonts.bold, fontSize: 20 },
  rcOs: { color: '#fff', fontFamily: Fonts.bold, fontSize: 16 },
  rcName: { color: '#fff', fontFamily: Fonts.semibold, fontSize: 16, marginTop: 4 },
  rcAttr: { color: '#fff', opacity: 0.95, fontFamily: Fonts.regular, fontSize: 13, marginTop: 2 },
  rcMore: { color: '#fff', opacity: 0.85, fontFamily: Fonts.semibold, fontSize: 12, marginTop: 6 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  badge: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 5, paddingVertical: 2, paddingHorizontal: 7 },
  badgeTxt: { color: '#fff', fontFamily: Fonts.bold, fontSize: 11 },
  moHead: { borderRadius: 14, paddingVertical: 18, paddingHorizontal: 20 },
  moData: { color: '#fff', opacity: 0.9, fontFamily: Fonts.regular, fontSize: 13 },
  moBody: { paddingTop: 14, gap: 12 },
  moRow: { flexDirection: 'row', gap: 10 },
  moL: { width: 110, fontFamily: Fonts.regular, fontSize: 13, paddingTop: 1 },
  moV: { flex: 1, fontFamily: Fonts.regular, fontSize: 15, lineHeight: 21 },
  instr: { borderLeftWidth: 4, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  instrTxt: { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 21 },
  zamknij: { marginTop: 8 },
});
