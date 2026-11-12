import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OknoGrupyPlanu, OknoPakowania } from '@/components/plan/OknaPlanu';
import { useKomunikaty } from '@/components/ui/Komunikaty';
import { Fonts, Size } from '@/constants/theme';
import type { PlanDzien } from '@/db/tabele';
import { useCennik, usePlan } from '@/hooks/useDane';
import { atrakcja as znajdzAtrakcje } from '@/logika/cennik';
import { dataPL, dzisISO } from '@/logika/format';
import { odhacz, POZYCJE_PAKOWANIA, rzeczyDoZabrania, sumyPlanu, ustawStatusPlanu, zalatwiona, type GrupaPlanu } from '@/logika/plan';
import { useSync } from '@/sync/SyncProvider';
import { useMotyw } from '@/theme/motyw';

const DNI = ['NIEDZIELA', 'PONIEDZIAŁEK', 'WTOREK', 'ŚRODA', 'CZWARTEK', 'PIĄTEK', 'SOBOTA'];
const dzienTyg = (iso: string) => DNI[new Date(`${iso}T12:00:00`).getDay()];
const przesun = (iso: string, o: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + o);
  return dzisISO(d);
};

/** Poprawki planu z PIN-em: raz wpisany PIN wystarcza na 10 minut (jak archiwum). */
const EDYCJA_MS = 10 * 60 * 1000;
let edycjaDo = 0;

/**
 * 🗓️ Plan dnia (rozpiska) na cały ekran: co spakować + grupy z godzinami i uwagami.
 * Grupa, która przyszła (albo nie przyjechała), robi się ciemniejsza, ale zostaje — uwagi przydają się przy rozliczeniu.
 * Otwierany z ekranu głównego (dzień wcześniej, do pakowania) i z dolnego menu listy; ✕ wraca tam, skąd przyszedłeś.
 */
export default function PlanDnia() {
  const { data: param } = useLocalSearchParams<{ data: string }>();
  const { c } = useMotyw();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { potwierdzHaslem, potwierdz } = useKomunikaty();
  const { synchronizujTeraz, stan } = useSync();
  const cennik = useCennik();
  const [data, setData] = useState(param ?? dzisISO());
  const plan = usePlan(data);
  const [edycja, setEdycja] = useState(() => Date.now() < edycjaDo);
  const [oknoGrupy, setOknoGrupy] = useState<{ data: string; grupa?: GrupaPlanu } | null>(null);
  const [oknoPak, setOknoPak] = useState<{ data: string; dzien: PlanDzien | null } | null>(null);

  const dzis = dzisISO();
  const jutro = przesun(dzis, 1);
  const zamknij = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const wlaczEdycje = () => {
    if (edycja) return setEdycja(false);
    if (Date.now() < edycjaDo) return setEdycja(true);
    potwierdzHaslem({
      tytul: '✏️ Poprawki w planie',
      tekst: 'Zmiany w planie dnia (grupy, liczby do spakowania) — tylko z PIN-em admina.',
      ok: 'Edytuj',
      rodzajOk: 'dalej',
      onOk: () => {
        edycjaDo = Date.now() + EDYCJA_MS;
        setEdycja(true);
      },
    });
  };

  const pak = plan?.dzien?.pakowanie ?? {};
  const sumy = sumyPlanu(plan?.grupy ?? []);
  const rzeczy = rzeczyDoZabrania(plan?.dzien?.do_zabrania ?? '');
  const liczby = POZYCJE_PAKOWANIA.filter((p) => pak[p.klucz] != null);
  const naraz = (cennik?.atrakcje ?? []).filter((a) => pak.naraz?.[a.klucz] != null);
  const jestPakowanie = liczby.length || naraz.length || rzeczy.length || plan?.dzien?.uwagi;
  const grupy = plan?.grupy ?? [];
  const czeka = grupy.filter((g) => !zalatwiona(g)).length;
  const pb = pak.pb_osoby ?? sumy.pb;
  const em = pak.em_osoby ?? sumy.em;

  const nieprzyszla = (g: GrupaPlanu) =>
    potwierdz({
      tytul: '❌ Nie przyszła',
      tekst: `Oznaczyć, że grupa „${g.organizator}” nie przyjechała? Można to cofnąć.`,
      ok: 'Nie przyszła',
      onOk: () => ustawStatusPlanu(db, g, 'nie'),
    });

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      {/* pasek: ✕, dzień, strzałki, dziś / jutro, edycja */}
      <View style={[styles.bar, { paddingTop: insets.top + 8, backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <Pressable onPress={zamknij} style={[styles.x, { backgroundColor: c.surface2, borderColor: c.border }]} hitSlop={8} accessibilityLabel="Zamknij plan">
          <Text style={[styles.xTxt, { color: c.text }]}>✕</Text>
        </Pressable>
        <Pressable onPress={() => setData(przesun(data, -1))} style={[styles.strz, { backgroundColor: c.surface2, borderColor: c.border }]} hitSlop={6}>
          <Text style={[styles.strzTxt, { color: c.text }]}>←</Text>
        </Pressable>
        <View style={styles.tytulWrap}>
          <Text style={[styles.tytul, { color: c.text }]} numberOfLines={1}>
            🗓️ {dzienTyg(data)} <Text style={{ color: c.accent }}>{dataPL(data)}</Text>
          </Text>
          <Text style={[styles.podtytul, { color: c.text2 }]} numberOfLines={1}>
            {data === dzis ? 'dziś · ' : data === jutro ? 'jutro · ' : ''}
            {grupy.length ? `${grupy.length} grup · ${sumy.osoby} osób${czeka && czeka !== grupy.length ? ` · czeka ${czeka}` : ''}` : 'brak planu'}
          </Text>
        </View>
        <Pressable onPress={() => setData(przesun(data, 1))} style={[styles.strz, { backgroundColor: c.surface2, borderColor: c.border }]} hitSlop={6}>
          <Text style={[styles.strzTxt, { color: c.text }]}>→</Text>
        </Pressable>
        {[
          { iso: dzis, tekst: 'Dziś' },
          { iso: jutro, tekst: 'Jutro' },
        ].map((d) => (
          <Pressable
            key={d.tekst}
            onPress={() => setData(d.iso)}
            style={[styles.chip, { borderColor: data === d.iso ? c.accent : c.border, backgroundColor: data === d.iso ? 'rgba(249,115,22,0.12)' : c.surface2 }]}>
            <Text style={[styles.chipTxt, { color: data === d.iso ? c.accent : c.text }]}>{d.tekst}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={wlaczEdycje}
          style={[styles.chip, { borderColor: edycja ? c.accent : c.border, backgroundColor: edycja ? c.accent : c.surface2 }]}>
          <Text style={[styles.chipTxt, { color: edycja ? '#fff' : c.text }]}>{edycja ? '✓ Gotowe' : '✏️ Edytuj'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        {/* ── Do spakowania ── */}
        {jestPakowanie || edycja ? (
          <View style={[styles.karta, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={styles.kartaNag}>
              <Text style={[styles.kartaTytul, { color: c.text }]}>🎒 Do spakowania</Text>
              <Text style={[styles.kartaInfo, { color: c.text2 }]}>
                {`PB ${pb} os. · EM ${em} os.`} · stuknij, gdy spakowane
              </Text>
              {edycja ? (
                <Pressable onPress={() => setOknoPak({ data, dzien: plan?.dzien ?? null })} style={[styles.mini, { borderColor: c.accent }]}>
                  <Text style={[styles.miniTxt, { color: c.accent }]}>✏️ Zmień</Text>
                </Pressable>
              ) : null}
            </View>
            {liczby.length ? (
              <View style={styles.kafle}>
                {liczby.map((p) => {
                  const ok = plan?.spakowane.has(p.klucz);
                  return (
                    <Pressable
                      key={p.klucz}
                      onPress={() => odhacz(db, data, p.klucz, !ok)}
                      style={[styles.kafel, { borderColor: ok ? c.green : c.border, backgroundColor: ok ? 'rgba(34,197,94,0.12)' : c.surface2 }]}>
                      <Text style={[styles.kafelLiczba, { color: ok ? c.green : c.text }]}>
                        {p.ikona} {pak[p.klucz]}
                      </Text>
                      <Text style={[styles.kafelNazwa, { color: c.text2 }]}>
                        {p.jedn} · {p.nazwa}
                      </Text>
                      <Text style={[styles.kafelChk, { color: ok ? c.green : c.text3 }]}>{ok ? '✓' : '○'}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            {naraz.length ? (
              <View style={styles.narazRzad}>
                <Text style={[styles.narazTyt, { color: c.text2 }]}>Graczy w jednym czasie:</Text>
                {naraz.map((a) => (
                  <View key={a.klucz} style={[styles.naraz, { backgroundColor: a.kolor }]}>
                    <Text style={styles.narazTxt}>
                      {a.stat === 'GOTHA' ? 'GOTCHA' : a.stat.replace('PAINTBALL ', '')} {pak.naraz?.[a.klucz]}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {rzeczy.length ? (
              <View style={styles.rzeczy}>
                {rzeczy.map((r) => {
                  const ok = plan?.spakowane.has(r.klucz);
                  return (
                    <Pressable
                      key={r.klucz}
                      onPress={() => odhacz(db, data, r.klucz, !ok)}
                      style={[styles.rzecz, { borderColor: ok ? c.green : c.border, backgroundColor: ok ? 'rgba(34,197,94,0.12)' : c.surface2 }]}>
                      <Text style={[styles.rzeczTxt, { color: ok ? c.green : c.text }]}>
                        {ok ? '✓ ' : '○ '}
                        {r.nazwa}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            {plan?.dzien?.uwagi ? <Text style={[styles.uwagiDnia, { color: c.text }]}>💬 {plan.dzien.uwagi}</Text> : null}
          </View>
        ) : null}

        {/* ── Grupy ── */}
        {grupy.map((g, i) => {
          const a = znajdzAtrakcje(cennik, g.atrakcja);
          const ciemna = zalatwiona(g);
          return (
            <View key={g.id} style={[styles.grupa, { backgroundColor: c.surface, borderColor: c.border, borderLeftColor: a?.kolor ?? c.border2, opacity: ciemna ? 0.45 : 1 }]}>
              <View style={styles.gLewa}>
                <Text style={[styles.gNr, { color: c.text3 }]}>{i + 1}</Text>
                <Text style={[styles.gGodz, { color: c.text }]}>{g.godzina || '—'}</Text>
              </View>
              <View style={styles.gSrodek}>
                <View style={styles.gRzad}>
                  <Text style={[styles.gOrg, { color: c.text }]}>{g.organizator}</Text>
                  {a ? (
                    <View style={[styles.gAtr, { backgroundColor: a.kolor }]}>
                      <Text style={styles.gAtrTxt}>{a.stat === 'GOTHA' ? 'GOTCHA' : a.stat.replace('PAINTBALL ', '')}</Text>
                    </View>
                  ) : null}
                  <Text style={[styles.gOs, { color: c.text }]}>👥 {g.osoby || '?'}</Text>
                  {g.zadatek ? (
                    <Text style={[styles.gZad, { color: /^nie$/i.test(g.zadatek) ? c.red : c.green }]}>
                      zadatek: {g.zadatek}
                    </Text>
                  ) : null}
                </View>
                {g.uwagi ? <Text style={[styles.gUwagi, { color: c.text }]}>{g.uwagi}</Text> : null}
              </View>
              <View style={styles.gPrawa}>
                {edycja ? (
                  <Pressable onPress={() => setOknoGrupy({ data, grupa: g })} style={[styles.btn, { borderColor: c.accent }]}>
                    <Text style={[styles.btnTxt, { color: c.accent }]}>✏️ Popraw</Text>
                  </Pressable>
                ) : g.naLiscie ? (
                  <Text style={[styles.stan, { color: c.green }]}>✅ na liście{g.instruktor ? `\n${g.instruktor}` : ''}</Text>
                ) : g.status ? (
                  <>
                    <Text style={[styles.stan, { color: g.status === 'nie' ? c.red : c.green }]}>{g.status === 'nie' ? '❌ nie przyszła' : '✅ przyszła'}</Text>
                    <Pressable onPress={() => ustawStatusPlanu(db, g, '')} style={[styles.btn, { borderColor: c.border }]}>
                      <Text style={[styles.btnTxt, { color: c.text2 }]}>↩ Cofnij</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable onPress={() => ustawStatusPlanu(db, g, 'przyszla')} style={[styles.btn, { borderColor: c.green, backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                      <Text style={[styles.btnTxt, { color: c.green }]}>✅ Przyszła</Text>
                    </Pressable>
                    <Pressable onPress={() => nieprzyszla(g)} style={[styles.btn, { borderColor: 'rgba(239,68,68,0.4)' }]}>
                      <Text style={[styles.btnTxt, { color: c.red }]}>❌ Nie przyszła</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          );
        })}

        {edycja ? (
          <Pressable onPress={() => setOknoGrupy({ data })} style={({ pressed }) => [styles.dodaj, { borderColor: pressed ? c.accent : c.border2 }]}>
            <Text style={[styles.dodajTxt, { color: c.text2 }]}>＋ Dodaj grupę do planu</Text>
          </Pressable>
        ) : null}

        {!grupy.length && !jestPakowanie && !edycja ? (
          <View style={styles.pusto}>
            <Text style={[styles.pustoTyt, { color: c.text }]}>Brak planu na {dataPL(data)}</Text>
            <Text style={[styles.pustoTxt, { color: c.text2 }]}>
              Plan wpisuje się na stronie filedops.pl/lista-api/plan.php. Tablet pobiera go sam, gdy ma internet
              {stan?.ostatnio ? ` (ostatnio ${new Date(stan.ostatnio).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })})` : ''}.
            </Text>
            <Pressable onPress={() => synchronizujTeraz()} style={[styles.btn, styles.btnSrodek, { borderColor: c.accent }]}>
              <Text style={[styles.btnTxt, { color: c.accent }]}>🔄 Pobierz teraz</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <OknoGrupyPlanu stan={oknoGrupy} cennik={cennik} onZamknij={() => setOknoGrupy(null)} />
      <OknoPakowania stan={oknoPak} cennik={cennik} onZamknij={() => setOknoPak(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1, flexWrap: 'wrap' },
  x: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  xTxt: { fontFamily: Fonts.black, fontSize: 20 },
  strz: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  strzTxt: { fontFamily: Fonts.bold, fontSize: 16 },
  tytulWrap: { flex: 1, minWidth: 180, paddingHorizontal: 4 },
  tytul: { fontFamily: Fonts.extrabold, fontSize: 18 },
  podtytul: { fontFamily: Fonts.regular, fontSize: 12, marginTop: 1 },
  chip: { borderWidth: 1, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14 },
  chipTxt: { fontFamily: Fonts.bold, fontSize: 14 },
  body: { padding: 12, gap: 10 },
  karta: { borderWidth: 1, borderRadius: Size.r2, padding: 12, gap: 10 },
  kartaNag: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  kartaTytul: { fontFamily: Fonts.extrabold, fontSize: 16 },
  kartaInfo: { flex: 1, fontFamily: Fonts.regular, fontSize: 12 },
  mini: { borderWidth: 1, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 },
  miniTxt: { fontFamily: Fonts.bold, fontSize: 13 },
  kafle: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kafel: { flexGrow: 1, flexBasis: 200, borderWidth: 2, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  kafelLiczba: { fontFamily: Fonts.black, fontSize: 30, lineHeight: 36 },
  kafelNazwa: { fontFamily: Fonts.semibold, fontSize: 13 },
  kafelChk: { position: 'absolute', top: 8, right: 12, fontFamily: Fonts.black, fontSize: 22 },
  narazRzad: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  narazTyt: { fontFamily: Fonts.bold, fontSize: 12, marginRight: 4 },
  naraz: { borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10 },
  narazTxt: { color: '#fff', fontFamily: Fonts.extrabold, fontSize: 13 },
  rzeczy: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rzecz: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  rzeczTxt: { fontFamily: Fonts.bold, fontSize: 14 },
  uwagiDnia: { fontFamily: Fonts.semibold, fontSize: 14 },
  grupa: { flexDirection: 'row', borderWidth: 1, borderLeftWidth: 8, borderRadius: Size.r2, padding: 12, gap: 12, alignItems: 'center' },
  gLewa: { width: 92, alignItems: 'flex-start' },
  gNr: { fontFamily: Fonts.bold, fontSize: 11 },
  gGodz: { fontFamily: Fonts.black, fontSize: 20 },
  gSrodek: { flex: 1, gap: 6 },
  gRzad: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  gOrg: { fontFamily: Fonts.extrabold, fontSize: 17 },
  gAtr: { borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 },
  gAtrTxt: { color: '#fff', fontFamily: Fonts.extrabold, fontSize: 12 },
  gOs: { fontFamily: Fonts.extrabold, fontSize: 16 },
  gZad: { fontFamily: Fonts.bold, fontSize: 13 },
  gUwagi: { fontFamily: Fonts.semibold, fontSize: 15, lineHeight: 21 },
  gPrawa: { width: 150, gap: 8, alignItems: 'stretch' },
  stan: { fontFamily: Fonts.extrabold, fontSize: 14, textAlign: 'center' },
  btn: { borderWidth: 1, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 10, alignItems: 'center' },
  btnSrodek: { alignSelf: 'center', paddingHorizontal: 20, marginTop: 8 },
  btnTxt: { fontFamily: Fonts.bold, fontSize: 14 },
  dodaj: { alignItems: 'center', padding: 16, borderWidth: 2, borderStyle: 'dashed', borderRadius: Size.r2 },
  dodajTxt: { fontFamily: Fonts.bold, fontSize: 15 },
  pusto: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 8 },
  pustoTyt: { fontFamily: Fonts.extrabold, fontSize: 18 },
  pustoTxt: { fontFamily: Fonts.regular, fontSize: 14, textAlign: 'center', maxWidth: 520, lineHeight: 20 },
});
