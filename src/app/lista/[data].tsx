import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DolneMenu } from '@/components/lista/DolneMenu';
import { KartaGrupy, type AkcjeKarty } from '@/components/lista/KartaGrupy';
import {
  OknoDodatek,
  OknoFaktura,
  OknoGracz,
  OknoInstruktor,
  OknoKdod,
  OknoNowaGrupa,
  OknoPlatnosc,
  OknoPodstawa,
  OknoPozycja,
} from '@/components/lista/Okna';
import { Zakladki } from '@/components/lista/Zakladki';
import { TopBar } from '@/components/TopBar';
import { useKomunikaty } from '@/components/ui/Komunikaty';
import { Przycisk } from '@/components/ui/Okno';
import { Fonts, Size } from '@/constants/theme';
import type { Wiersz } from '@/db/tabele';
import { useCennik, useDzien } from '@/hooks/useDane';
import { atrakcja as znajdzAtrakcje } from '@/logika/cennik';
import { dataKrotko, dataPL, plGrup } from '@/logika/format';
import { usunDodatek, usunInstruktora, usunListe, usunPozycje, type GraczPelny, type GrupaPelna } from '@/logika/lista';
import { useMotyw } from '@/theme/motyw';

/** Lista dnia (#screen-lista z v19): zakładki instruktorów, pasek listy, „＋ Dodaj grupę”, karty grup, dolne menu. */
export default function ListaDnia() {
  const { data, t } = useLocalSearchParams<{ data: string; t?: string }>();
  const { c } = useMotyw();
  const db = useSQLiteContext();
  const { toast, potwierdz, potwierdzHaslem } = useKomunikaty();
  const dzien = useDzien(data);
  const cennik = useCennik();
  const [aktywnaWybrana, setAktywna] = useState<string | null>(t ?? null);

  // okna
  const [oknoInstr, setOknoInstr] = useState(false);
  const [poInstr, setPoInstr] = useState<null | 'grupa'>(null);
  const [oknoGrupa, setOknoGrupa] = useState(false);
  const [gracz, setGracz] = useState<{ grupa: GrupaPelna; gracz?: GraczPelny } | null>(null);
  const [pozycja, setPozycja] = useState<{ grupa: GrupaPelna; gracz: GraczPelny; dym?: Wiersz<'pozycje'> } | null>(null);
  const [platnosc, setPlatnosc] = useState<GrupaPelna | null>(null);
  const [podstawa, setPodstawa] = useState<GrupaPelna | null>(null);
  const [kdod, setKdod] = useState<GrupaPelna | null>(null);
  const [dodatek, setDodatek] = useState<GrupaPelna | null>(null);
  const [faktura, setFaktura] = useState<GrupaPelna | null>(null);


  // Brak instruktorów na liście → od razu pytamy o imię (jak v19); „Anuluj” zamyka do następnego wejścia.
  const [pominietoInstr, setPominietoInstr] = useState(false);

  const liczby = useMemo(() => {
    const out: Record<string, number> = {};
    for (const g of dzien?.grupy ?? []) if (g.instruktor_id) out[g.instruktor_id] = (out[g.instruktor_id] ?? 0) + 1;
    return out;
  }, [dzien]);

  if (!dzien) return <View style={[styles.root, { backgroundColor: c.bg }]} />;

  // Aktywna zakładka: wybrana / z parametru, a gdy jej nie ma — pierwszy instruktor.
  const instr = dzien.instruktorzy.find((i) => i.id === aktywnaWybrana) ?? dzien.instruktorzy[0] ?? null;
  const aktywna = instr?.id ?? null;
  const pytajOInstr = !!dzien.lista && !dzien.instruktorzy.length && !pominietoInstr;
  const grupy = dzien.grupy.filter((g) => !aktywna || g.instruktor_id === aktywna);
  const atr = (g: GrupaPelna | null) => (g ? znajdzAtrakcje(cennik, g.atrakcja) : undefined);
  const katalog = [...(cennik?.dodatki.glowne ?? []), ...(cennik?.dodatki.wiecej ?? [])];
  const ikonaDodatku = (nazwa: string) => katalog.find((d) => d.nazwa === nazwa)?.ikona ?? '⭐';
  /** grupa z najświeższymi danymi (okno otwarte przed zapisem widzi aktualną kwotę / fakturę) */
  const aktualna = (g: GrupaPelna | null) => (g ? (dzien.grupy.find((x) => x.id === g.id) ?? g) : null);

  const dodajGrupe = () => {
    if (!aktywna) {
      toast('Najpierw dodaj instruktora');
      setPoInstr('grupa');
      setOknoInstr(true);
      return;
    }
    setOknoGrupa(true);
  };

  const usunZakladke = (id: string) => {
    const i = dzien.instruktorzy.find((x) => x.id === id);
    const n = liczby[id] ?? 0;
    potwierdzHaslem({
      tytul: '🗑 Usuń listę instruktora',
      tekst: `Usunąć listę instruktora ${i?.imie ?? ''}${n ? ` razem z ${plGrup(n)}` : ''}? Listy pozostałych instruktorów zostają. Podaj hasło aplikacji, żeby potwierdzić.`,
      ok: 'Usuń listę',
      onOk: async () => {
        await usunInstruktora(db, id);
        if (aktywnaWybrana === id) setAktywna(null);
      },
    });
  };

  const usunDzien = () =>
    potwierdzHaslem({
      tytul: '🗑 Usuń listę dnia',
      tekst:
        `Usunąć całą listę z ${dataPL(data)} — wszystkich instruktorów (${plGrup(dzien.grupy.length)}), wydatki i pensje — z tabletu i z serwera?` +
        (dzien.lista?.s_stat_wyslano ? ' Statystyki z tego dnia są już wysłane — w bazie statystyk zostaną.' : '') +
        ' Przez 7 dni można ją przywrócić z kosza. Podaj hasło aplikacji, żeby potwierdzić.',
      ok: 'Usuń listę',
      onOk: async () => {
        await usunListe(db, data);
        toast(`🗑 Lista ${dataPL(data)} usunięta`);
        router.dismissTo('/');
      },
    });

  const wBudowie = (co: string) => () => toast(`🔧 ${co} — w następnym kroku`);

  const akcje = (g: GrupaPelna): AkcjeKarty => ({
    onDodajGracza: () => setGracz({ grupa: g }),
    onEdytujGracza: (p) => setGracz({ grupa: g, gracz: p }),
    onPozycje: (p) => setPozycja({ grupa: g, gracz: p }),
    onChip: (p, poz) => {
      if (poz.rodzaj === 'dym') return setPozycja({ grupa: g, gracz: p, dym: poz });
      const opis = poz.rodzaj === 'kulki' ? `${poz.ilosc} kulek (${poz.dokupione ? 'dokupione' : 'z pakietu'})` : (poz.nazwa ?? '');
      potwierdz({ tytul: 'Usuń pozycję', tekst: `Usunąć „${opis}” u gracza ${p.imie}?`, ok: 'Usuń', onOk: () => usunPozycje(db, poz.id) });
    },
    onPlatnosc: () => setPlatnosc(g),
    onPodstawa: () => setPodstawa(g),
    onKdod: () => setKdod(g),
    onFaktura: () => setFaktura(g),
    onDodatek: () => setDodatek(g),
    onUsunDodatek: (d) =>
      potwierdz({ tytul: 'Usuń dodatek', tekst: `Usunąć „${d.nazwa}”?`, ok: 'Usuń', onOk: () => usunDodatek(db, d.id) }),
    onZdjecie: wBudowie('Gracze ze zdjęcia kartki'),
  });

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <TopBar data={dataKrotko(data)} />
      <Zakladki
        instruktorzy={dzien.instruktorzy}
        aktywna={aktywna}
        liczby={liczby}
        onWybierz={setAktywna}
        onDodaj={() => setOknoInstr(true)}
        onUsun={usunZakladke}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.bar, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.barInfo, { color: c.text2 }]}>
            Lista <Text style={[styles.barB, { color: c.text }]}>{dataPL(data)}</Text>
            {instr ? (
              <>
                {' · instruktor '}
                <Text style={[styles.barB, { color: c.text }]}>{instr.imie}</Text>
                {` · ${plGrup(liczby[instr.id] ?? 0)}`}
              </>
            ) : null}
            {dzien.instruktorzy.length > 1 ? ` · razem ${plGrup(dzien.grupy.length)}` : ''}
          </Text>
          {instr ? <Przycisk tekst={`🗑 Usuń listę: ${instr.imie}`} rodzaj="usun" onPress={() => usunZakladke(instr.id)} rozciagnij={false} style={styles.barBtn} /> : null}
          <Przycisk tekst="🗑 Usuń całą listę dnia" rodzaj="usun" onPress={usunDzien} rozciagnij={false} style={styles.barBtn} />
        </View>

        <Pressable onPress={dodajGrupe} style={({ pressed }) => [styles.addGroup, { borderColor: pressed ? c.accent : c.border2 }]}>
          <Text style={[styles.addGroupTxt, { color: c.text2 }]}>＋ Dodaj grupę</Text>
        </Pressable>

        {grupy.length ? (
          grupy.map((g, i) => (
            <KartaGrupy key={g.id} grupa={g} numer={grupy.length - i} atrakcja={atr(g)} akcje={akcje(g)} ikonaDodatku={ikonaDodatku} />
          ))
        ) : (
          <Text style={[styles.pusto, { color: c.text2 }]}>
            {dzien.instruktorzy.length ? 'Brak grup — kliknij „＋ Dodaj grupę”.' : 'Dodaj instruktora (＋ 👷 u góry), a potem grupę.'}
          </Text>
        )}
      </ScrollView>
      <DolneMenu data={data} />

      <OknoInstruktor
        widoczne={oknoInstr || pytajOInstr}
        data={data}
        onZamknij={() => {
          setOknoInstr(false);
          setPominietoInstr(true);
        }}
        onDodano={(id) => {
          setAktywna(id);
          if (poInstr === 'grupa') {
            setPoInstr(null);
            setTimeout(() => setOknoGrupa(true), 250);
          }
        }}
      />
      <OknoNowaGrupa widoczne={oknoGrupa} data={data} instruktorId={aktywna} cennik={cennik} onZamknij={() => setOknoGrupa(false)} />
      <OknoGracz stan={gracz} atrakcja={atr(gracz?.grupa ?? null)} cennik={cennik} onZamknij={() => setGracz(null)} />
      <OknoPozycja stan={pozycja} atrakcja={atr(pozycja?.grupa ?? null)} dymCena={cennik?.dym_cena ?? 10}
        worek={cennik?.worek ?? { szt: 500, cena: 40 }}
        onZamknij={() => setPozycja(null)}
      />
      <OknoPlatnosc grupa={platnosc} onZamknij={() => setPlatnosc(null)} />
      <OknoPodstawa grupa={podstawa} atrakcja={atr(podstawa)} onZamknij={() => setPodstawa(null)} />
      <OknoKdod grupa={kdod} atrakcja={atr(kdod)} onZamknij={() => setKdod(null)} />
      <OknoDodatek grupa={dodatek} cennik={cennik} onZamknij={() => setDodatek(null)} />
      <OknoFaktura grupa={aktualna(faktura)} onZamknij={() => setFaktura(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 16, gap: 14 },
  bar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: Size.r2 },
  barInfo: { flex: 1, minWidth: 180, fontFamily: Fonts.regular, fontSize: 13 },
  barB: { fontFamily: Fonts.bold, fontSize: 15 },
  barBtn: { paddingVertical: 9, paddingHorizontal: 14, minHeight: 40 },
  addGroup: { alignItems: 'center', justifyContent: 'center', padding: 16, borderWidth: 2, borderStyle: 'dashed', borderRadius: Size.r2 },
  addGroupTxt: { fontFamily: Fonts.bold, fontSize: 15 },
  pusto: { textAlign: 'center', paddingVertical: 40, paddingHorizontal: 16, fontFamily: Fonts.regular, fontSize: 14 },
});
