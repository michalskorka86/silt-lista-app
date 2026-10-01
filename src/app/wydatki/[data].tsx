import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DolneMenu } from '@/components/lista/DolneMenu';
import { TopBar } from '@/components/TopBar';
import { DodajWiersz, Karta, Plakietka, WierszKarty } from '@/components/ui/Karta';
import { useKomunikaty } from '@/components/ui/Komunikaty';
import { OknoPensja, OknoWydatek } from '@/components/wydatki/Okna';
import { Fonts, Size } from '@/constants/theme';
import type { Wiersz } from '@/db/tabele';
import { useDzien, usePracownicy } from '@/hooks/useDane';
import { dataKrotko, zl } from '@/logika/format';
import { usunPensje, usunWydatek, zmienPensje } from '@/logika/lista';
import { useSync } from '@/sync/SyncProvider';
import { useMotyw } from '@/theme/motyw';

/** Wydatki, pensje, podsumowanie dnia i wysyłka statystyk (#screen-wydatki z v19). */
export default function WydatkiDnia() {
  const { data } = useLocalSearchParams<{ data: string }>();
  const { c } = useMotyw();
  const db = useSQLiteContext();
  const { potwierdz, numpad } = useKomunikaty();
  const { wyslijStatystyki } = useSync();
  const dzien = useDzien(data);
  const pracownicy = usePracownicy();
  const [wydatek, setWydatek] = useState<{ wydatek?: Wiersz<'wydatki'> } | null>(null);
  const [pensja, setPensja] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; tekst: string } | null>(null);
  const [wysyla, setWysyla] = useState(false);

  if (!dzien) return <View style={[styles.root, { backgroundColor: c.bg }]} />;
  const s = dzien.podsumowanie;
  const wyslano = dzien.lista?.s_stat_wyslano;

  const usunWiersz = (co: string, onOk: () => void) => potwierdz({ tytul: 'Usuń pozycję', tekst: `Usunąć ${co}?`, ok: 'Usuń', onOk });

  const wyslij = async (wymus: boolean) => {
    setWysyla(true);
    setStatus({ ok: true, tekst: '⏳ Wysyłanie…' });
    try {
      const msg = await wyslijStatystyki(data, wymus);
      setStatus({ ok: true, tekst: `✓ ${msg}` });
    } catch (e) {
      setStatus({ ok: false, tekst: `❌ ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setWysyla(false);
    }
  };
  const wyslijPrzycisk = () => {
    if (wyslano)
      potwierdz({
        tytul: 'Statystyki już wysłane',
        tekst: 'Statystyki z tego dnia są już w bazie. Wysłać ponownie? Poprzednio wysłane wpisy z tej listy zostaną zastąpione nowymi.',
        ok: 'Wyślij ponownie',
        onOk: () => wyslij(true),
      });
    else wyslij(false);
  };

  const stanWysylki =
    status ??
    (dzien.lista?.s_stat_blad && !wyslano
      ? { ok: false, tekst: `❌ ${dzien.lista.s_stat_blad}` }
      : wyslano
        ? { ok: true, tekst: `✓ Statystyki tego dnia zostały już wysłane (${new Date(wyslano).toLocaleString('pl-PL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })})` }
        : null);

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <TopBar data={dataKrotko(data)} />
      <ScrollView contentContainerStyle={styles.body}>
        <Karta ico="💸" tytul="Wydatki" suma={zl(s.wydatki)}>
          {dzien.wydatki.map((w) => (
            <WierszKarty key={w.id} onUsun={() => usunWiersz(`„${w.opis}”`, () => usunWydatek(db, w.id))}>
              <Pressable style={styles.main} onPress={() => setWydatek({ wydatek: w })}>
                <Text style={[styles.mainB, { color: c.text }]}>{w.opis}</Text>
                {w.uwagi ? <Text style={[styles.mainSub, { color: c.text2 }]}>💬 {w.uwagi}</Text> : null}
              </Pressable>
              <Plakietka tekst={zl(w.kwota)} onPress={() => setWydatek({ wydatek: w })} />
            </WierszKarty>
          ))}
          <DodajWiersz tekst="＋ Dodaj wydatek" onPress={() => setWydatek({})} />
        </Karta>

        <Karta ico="👷" tytul="Pensje instruktorów" suma={zl(s.pensje)}>
          {dzien.pensje.map((p) => (
            <WierszKarty key={p.id} onUsun={() => usunWiersz(`pensję ${p.imie}`, () => usunPensje(db, p.id))}>
              <View style={styles.main}>
                <Text style={[styles.mainB, { color: c.text }]}>{p.imie}</Text>
                {p.stawka ? <Text style={[styles.mainSub, { color: c.text2 }]}>{zl(p.stawka)}/h</Text> : null}
              </View>
              <Plakietka
                mala
                tekst={`${String(p.godziny).replace('.', ',')}h`}
                onPress={() => numpad({ tytul: `Godziny — ${p.imie}`, wartosc: p.godziny, onOk: (v) => zmienPensje(db, p.id, { godziny: v }) })}
              />
              <Plakietka
                tekst={zl(p.kwota)}
                onPress={() => numpad({ tytul: `Kwota — ${p.imie}`, wartosc: p.kwota, onOk: (v) => zmienPensje(db, p.id, { kwota: v }) })}
              />
            </WierszKarty>
          ))}
          <DodajWiersz tekst="＋ Dodaj instruktora" onPress={() => setPensja(true)} />
        </Karta>

        <Karta ico="📊" tytul="Podsumowanie dnia">
          <View style={styles.raport}>
            {[
              ['Przychód brutto', s.brutto],
              ['Zadatki', s.zadatki],
              ['Wydatki', s.wydatki],
              ['Pensje', s.pensje],
            ].map(([n, v], i, a) => (
              <View key={n as string} style={[styles.raportRow, i < a.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border }]}>
                <Text style={[styles.raportTxt, { color: c.text }]}>{n}</Text>
                <Text style={[styles.raportB, { color: c.text }]}>{zl(v as number)}</Text>
              </View>
            ))}
          </View>
        </Karta>

        <Karta>
          <View style={styles.wyslijWrap}>
            <Pressable
              onPress={wyslijPrzycisk}
              disabled={wysyla}
              style={({ pressed }) => [styles.wyslij, { backgroundColor: c.accent, opacity: wysyla ? 0.5 : pressed ? 0.8 : 1 }]}>
              <Text style={styles.wyslijTxt}>📤 Wyślij statystyki do bazy</Text>
            </Pressable>
            {stanWysylki ? (
              <View
                style={[
                  styles.status,
                  stanWysylki.ok
                    ? { backgroundColor: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.3)' }
                    : { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' },
                ]}>
                <Text style={[styles.statusTxt, { color: stanWysylki.ok ? c.green : c.red }]}>{stanWysylki.tekst}</Text>
              </View>
            ) : null}
            <Text style={[styles.info, { color: c.text2 }]}>Statystyki wysyłają się też same o 6:00 (jeśli nie zostały wysłane).</Text>
          </View>
        </Karta>
      </ScrollView>
      <DolneMenu data={data} />

      <OknoWydatek data={data} stan={wydatek} onZamknij={() => setWydatek(null)} />
      <OknoPensja data={data} widoczne={pensja} pracownicy={pracownicy} onZamknij={() => setPensja(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 12 },
  main: { flex: 1, minWidth: 0 },
  mainB: { fontFamily: Fonts.bold, fontSize: 14 },
  mainSub: { fontFamily: Fonts.regular, fontSize: 12, marginTop: 2 },
  raport: { padding: 12 },
  raportRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  raportTxt: { fontFamily: Fonts.regular, fontSize: 13 },
  raportB: { fontFamily: Fonts.bold, fontSize: 13 },
  wyslijWrap: { padding: 14 },
  wyslij: { padding: 14, borderRadius: Size.r2, alignItems: 'center' },
  wyslijTxt: { color: '#fff', fontFamily: Fonts.extrabold, fontSize: 15 },
  status: { marginTop: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: Size.r, borderWidth: 1 },
  statusTxt: { fontFamily: Fonts.semibold, fontSize: 12 },
  info: { fontFamily: Fonts.regular, fontSize: 12, marginTop: 10 },
});
