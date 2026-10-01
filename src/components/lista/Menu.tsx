import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { getUstawienie } from '@/db/ustawienia';
import { useCennik } from '@/hooks/useDane';
import { dataPL, zl } from '@/logika/format';
import { useSync, WERSJA_APLIKACJI } from '@/sync/SyncProvider';
import { useMotyw } from '@/theme/motyw';

import { opisWersji, pobierzIPrzeladuj } from '../Aktualizacje';
import { folderPdf, KLUCZ_OSTATNI, wybierzFolder, zrobBrakujacePdf } from '../raport/automat';
import { useKomunikaty } from '../ui/Komunikaty';
import { Okno, Przycisk, Przyciski } from '../ui/Okno';

type Widok = 'menu' | 'cennik' | 'opcje';

/** ☰ Menu z dolnego paska (ov-menu z v19): Cennik / Raport PDF / Rezerwacje / Opcje. */
export function OknoMenu({ widoczne, data, onZamknij }: { widoczne: boolean; data: string; onZamknij: () => void }) {
  return widoczne ? <TrescMenu data={data} onZamknij={onZamknij} /> : <Okno widoczne={false} onZamknij={onZamknij}>{null}</Okno>;
}

function TrescMenu({ data, onZamknij }: { data: string; onZamknij: () => void }) {
  const [widok, setWidok] = useState<Widok>('menu');

  if (widok === 'cennik') return <OknoCennik onZamknij={onZamknij} />;
  if (widok === 'opcje') return <OknoOpcje onZamknij={onZamknij} />;

  return (
    <Okno widoczne onZamknij={onZamknij} tytul="☰ Menu" rozmiar="sm">
      <View style={styles.siatka}>
        <Kafel ico="💰" nazwa="Cennik" onPress={() => setWidok('cennik')} />
        <Kafel
          ico="🖨️"
          nazwa="Raport PDF"
          onPress={() => {
            onZamknij();
            router.push({ pathname: '/raport/[data]', params: { data } });
          }}
        />
        <Kafel
          ico="📅"
          nazwa="Rezerwacje"
          onPress={() => {
            onZamknij();
            router.push('/rezerwacje');
          }}
        />
        <Kafel ico="⚙️" nazwa="Opcje" onPress={() => setWidok('opcje')} />
      </View>
      <Przyciski>
        <Przycisk tekst="Zamknij" rodzaj="anuluj" onPress={onZamknij} />
      </Przyciski>
    </Okno>
  );
}

/** 💰 Cennik — z serwera (zmiana ceny na serwerze = nowy cennik na tablecie bez aktualizacji aplikacji). */
function OknoCennik({ onZamknij }: { onZamknij: () => void }) {
  const { c } = useMotyw();
  const cennik = useCennik();
  return (
    <Okno widoczne onZamknij={onZamknij} tytul="💰 Cennik">
      {!cennik ? <Text style={[styles.cTxt, { color: c.text2 }]}>Brak cennika na tablecie — połącz tablet z internetem.</Text> : null}
      {cennik?.atrakcje.map((a) => (
        <View key={a.klucz} style={styles.cSekcja}>
          <View style={styles.cTytul}>
            <View style={[styles.cKropka, { backgroundColor: a.kolor }]} />
            <Text style={[styles.cTytulTxt, { color: c.text }]}>
              {a.nazwa} <Text style={{ color: c.text2, fontFamily: Fonts.semibold }}>({a.stat})</Text>
            </Text>
          </View>
          {a.pakiety.map((p) => (
            <WierszCennika
              key={p.id}
              l={`${p.nazwa}${p.kulki ? ` ${p.kulki} kulek` : ''}`}
              p={p.cena ? zl(p.cena) + (p.typ === 'grupa' ? '' : ' / os.') : 'indywidualnie'}
            />
          ))}
          {a.pakiety
            .filter((p) => p.extra)
            .map((p) => (
              <WierszCennika key={`e${p.id}`} l="Dodatkowy gracz" p={zl(p.extra)} />
            ))}
          {a.kdod ? <WierszCennika l={`Dodatkowe kulki ${a.kdod.ilosc} szt`} p={zl(a.kdod.cena)} /> : null}
        </View>
      ))}
      {cennik ? (
        <>
          <View style={styles.cSekcja}>
            <Text style={[styles.cTytulTxt, { color: c.text }]}>💨 Świeca dymna</Text>
            <WierszCennika l="1 szt" p={zl(cennik.dym_cena)} />
          </View>
          <View style={styles.cSekcja}>
            <Text style={[styles.cTytulTxt, { color: c.text }]}>🎒 Własny sprzęt</Text>
            {cennik.sprzet.map((s, i) => (
              <WierszCennika key={i} l={`${s.ikona} ${s.nazwa}`} p={zl(s.cena)} />
            ))}
            <WierszCennika l={`🎯 Worek kulek ${cennik.worek.szt} szt`} p={zl(cennik.worek.cena)} />
          </View>
        </>
      ) : null}
      <Przyciski>
        <Przycisk tekst="Zamknij" rodzaj="anuluj" onPress={onZamknij} />
      </Przyciski>
    </Okno>
  );
}

/** ⚙️ Opcje (ov-opcje z v19): synchronizacja, stan wysyłki, wylogowanie tabletu. */
function OknoOpcje({ onZamknij }: { onZamknij: () => void }) {
  const { toast, potwierdz } = useKomunikaty();
  const { stan, niewyslane, trwa, synchronizujTeraz, wyloguj } = useSync();
  const db = useSQLiteContext();
  const [pdf, setPdf] = useState<{ folder: string | null; ostatni: string } | null>(null);
  const [pdfTrwa, setPdfTrwa] = useState(false);
  const [odswiez, setOdswiez] = useState(0);

  useEffect(() => {
    let aktywny = true;
    (async () => {
      const f = await folderPdf(db);
      const o = JSON.parse((await getUstawienie(db, KLUCZ_OSTATNI)) ?? 'null') as { data: string; t: string } | null;
      if (aktywny)
        setPdf({
          folder: f?.nazwa ?? null,
          ostatni: o ? `ostatni: lista ${dataPL(o.data)} (${new Date(o.t).toLocaleString('pl-PL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })})` : 'jeszcze żadnego',
        });
    })();
    return () => {
      aktywny = false;
    };
  }, [db, odswiez]);

  const zmienFolder = async () => {
    const nazwa = await wybierzFolder(db);
    if (!nazwa) return;
    toast(`📁 PDF-y będą zapisywane w: ${nazwa}`);
    setOdswiez((n) => n + 1);
    zrobTeraz();
  };

  const [aktTrwa, setAktTrwa] = useState(false);
  const sprawdzAktualizacje = async () => {
    if (aktTrwa) return;
    setAktTrwa(true);
    try {
      const w = await pobierzIPrzeladuj(); // gdy jest nowa wersja — aplikacja od razu się przeładuje
      toast(w === 'brak' ? '✅ Masz najnowszą wersję' : w === 'niedostepne' ? 'Aktualizacje działają tylko w zainstalowanej aplikacji' : '⬇️ Instaluję…');
    } catch {
      toast('📴 Nie udało się sprawdzić aktualizacji — brak internetu?');
    } finally {
      setAktTrwa(false);
    }
  };

  const zrobTeraz = async () => {
    if (pdfTrwa) return;
    setPdfTrwa(true);
    const w = await zrobBrakujacePdf(db);
    setPdfTrwa(false);
    setOdswiez((n) => n + 1);
    toast(
      w.bledy.length
        ? `❌ Nie udało się zrobić PDF: ${w.bledy[0]}`
        : w.zrobione.length
          ? `✅ Zrobiono PDF: ${w.zrobione.length}`
          : '✅ Wszystkie PDF-y są aktualne',
    );
  };

  const sync = async () => {
    const s = await synchronizujTeraz();
    if (!s) return;
    toast(s.stan === 'ok' ? '✅ Zsynchronizowano' : s.stan === 'offline' ? '📴 Brak internetu — dane są na tablecie, wyślą się same' : `❌ ${s.komunikat ?? 'Błąd'}`);
  };

  const ostatnio = stan?.ostatnio
    ? new Date(stan.ostatnio).toLocaleString('pl-PL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'jeszcze nie';

  return (
    <Okno widoczne onZamknij={onZamknij} tytul="⚙️ Opcje" rozmiar="sm">
      <Opcja l="Wymuś synchronizację" sub={trwa ? 'Synchronizacja…' : `Ostatnio: ${ostatnio}`} btn="🔄" onPress={sync} />
      <Opcja
        l="Niewysłane zmiany"
        sub={niewyslane ? `${niewyslane} — wyślą się same przy zasięgu` : 'Wszystko wysłane ✓'}
      />
      {stan?.odrzucone ? (
        <Opcja l="Zmiany odrzucone przez serwer" sub={`${stan.odrzucone} w ostatnich 7 dniach — zgłoś to Michałowi`} />
      ) : null}
      <Opcja
        l="Wyloguj ten tablet"
        sub="Przy następnym otwarciu trzeba będzie wpisać hasło"
        btn="🔒"
        onPress={() =>
          potwierdz({
            tytul: '🔒 Wylogować ten tablet?',
            tekst:
              'Przy następnym otwarciu trzeba będzie wpisać hasło.' +
              (niewyslane ? ` Uwaga: ${niewyslane} zmian czeka na wysłanie — zostaną na tablecie i wyślą się po zalogowaniu.` : ''),
            ok: 'Wyloguj',
            onOk: () => {
              onZamknij();
              wyloguj();
            },
          })
        }
      />
      {Platform.OS !== 'web' ? (
        <>
          <Opcja
            l="Folder na raporty PDF"
            sub={pdf?.folder ? `${pdf.folder} — PDF z każdej listy, w folderach miesięcy` : 'Nie wybrano — PDF-y są tylko w pamięci aplikacji'}
            btn="📁"
            onPress={zmienFolder}
          />
          <Opcja
            l="Automatyczne PDF-y (w nocy, ok. 3:00)"
            sub={pdfTrwa ? 'Tworzę PDF-y…' : (pdf?.ostatni ?? '')}
            btn="🔄"
            onPress={zrobTeraz}
          />
        </>
      ) : null}
      <Opcja
        l="Wersja aplikacji"
        sub={aktTrwa ? 'Sprawdzam aktualizację…' : `SILT Lista ${opisWersji(WERSJA_APLIKACJI)}`}
        btn={Platform.OS !== 'web' ? '⬇️' : undefined}
        onPress={sprawdzAktualizacje}
      />
      <Przyciski>
        <Przycisk tekst="Zamknij" rodzaj="anuluj" onPress={onZamknij} />
      </Przyciski>
    </Okno>
  );
}

function Kafel({ ico, nazwa, onPress }: { ico: string; nazwa: string; onPress: () => void }) {
  const { c } = useMotyw();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.kafel, { backgroundColor: pressed ? c.accentSoft : c.surface, borderColor: pressed ? c.accent : c.border }]}>
      <Text style={styles.kafelIco}>{ico}</Text>
      <Text style={[styles.kafelNazwa, { color: c.text }]}>{nazwa}</Text>
    </Pressable>
  );
}

function WierszCennika({ l, p }: { l: string; p: string }) {
  const { c } = useMotyw();
  return (
    <View style={[styles.cRow, { borderBottomColor: c.border }]}>
      <Text style={[styles.cTxt, { color: c.text }]}>{l}</Text>
      <Text style={[styles.cCena, { color: c.accent }]}>{p}</Text>
    </View>
  );
}

function Opcja({ l, sub, btn, onPress }: { l: string; sub?: string; btn?: string; onPress?: () => void }) {
  const { c } = useMotyw();
  return (
    <View style={[styles.oRow, { borderBottomColor: c.border }]}>
      <View style={styles.flex}>
        <Text style={[styles.oTxt, { color: c.text }]}>{l}</Text>
        {sub ? <Text style={[styles.oSub, { color: c.text2 }]}>{sub}</Text> : null}
      </View>
      {btn && onPress ? <Przycisk tekst={btn} rodzaj="anuluj" rozciagnij={false} onPress={onPress} style={styles.oBtn} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  siatka: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kafel: { flexGrow: 1, flexBasis: '45%', paddingVertical: 18, paddingHorizontal: 12, borderRadius: 18, borderWidth: 2, alignItems: 'center', gap: 8 },
  kafelIco: { fontSize: 36 },
  kafelNazwa: { fontFamily: Fonts.extrabold, fontSize: 14 },
  cSekcja: { marginBottom: 14 },
  cTytul: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cKropka: { width: 12, height: 12, borderRadius: 4 },
  cTytulTxt: { fontFamily: Fonts.extrabold, fontSize: 13, marginBottom: 2 },
  cRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1 },
  cTxt: { fontFamily: Fonts.regular, fontSize: 14 },
  cCena: { fontFamily: Fonts.bold, fontSize: 14 },
  oRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  oTxt: { fontFamily: Fonts.semibold, fontSize: 14 },
  oSub: { fontFamily: Fonts.regular, fontSize: 12, marginTop: 2 },
  oBtn: { paddingVertical: 8, paddingHorizontal: 14, minHeight: 40 },
});
