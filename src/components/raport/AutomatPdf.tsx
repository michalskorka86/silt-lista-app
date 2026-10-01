import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, Text } from 'react-native';

import { Fonts } from '@/constants/theme';
import { getUstawienie, setUstawienie } from '@/db/ustawienia';
import { oczyscKosz } from '@/logika/kosz';
import { useMotyw } from '@/theme/motyw';

import { zglos } from '../bledy/zglos';
import { useKomunikaty } from '../ui/Komunikaty';
import { Okno, Przycisk, Przyciski } from '../ui/Okno';
import { folderPdf, wybierzFolder, zrobBrakujacePdf } from './automat';
import { zarejestrujZadaniePdf } from './zadanieTla';

const KLUCZ_PYTANO = 'pdf_folder_pytano';

/**
 * Niewidoczny „pilnujący” PDF-ów: przy starcie i po powrocie do aplikacji dorabia brakujące PDF-y,
 * rejestruje zadanie w tle (noc), a przy pierwszym uruchomieniu pyta o folder na PDF-y.
 */
export function AutomatPdf() {
  const db = useSQLiteContext();
  const { c } = useMotyw();
  const { toast } = useKomunikaty();
  const [pytaj, setPytaj] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let aktywny = true;
    const uruchom = () => {
      oczyscKosz(db)
        .catch((e) => zglos(e, { dopisek: 'Kosz' }))
        .then(() => zrobBrakujacePdf(db))
        .then((w) => w.bledy.forEach((b) => zglos(new Error(b), { dopisek: 'PDF' })))
        .catch((e) => zglos(e, { dopisek: 'PDF' }));
    };
    (async () => {
      await zarejestrujZadaniePdf();
      const folder = await folderPdf(db);
      const pytano = await getUstawienie(db, KLUCZ_PYTANO);
      if (!aktywny) return;
      if (!folder && !pytano) setPytaj(true);
      else uruchom();
    })();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') uruchom();
    });
    return () => {
      aktywny = false;
      sub.remove();
    };
  }, [db]);

  const zamknij = async (wybierz: boolean) => {
    setPytaj(false);
    await setUstawienie(db, KLUCZ_PYTANO, new Date().toISOString());
    if (wybierz) {
      const nazwa = await wybierzFolder(db);
      if (nazwa) toast(`📁 PDF-y będą zapisywane w: ${nazwa}`);
    }
    zrobBrakujacePdf(db).catch(() => {});
  };

  return (
    <Okno widoczne={pytaj} onZamknij={() => zamknij(false)} tytul="📁 Folder na raporty PDF" rozmiar="sm">
      <Text style={[styles.tekst, { color: c.text2 }]}>
        Tablet sam robi PDF z każdej listy (w nocy, ok. 3:00) i zapisuje go w folderach miesięcy, np.{' '}
        <Text style={{ color: c.text, fontFamily: Fonts.bold }}>2026-10 Październik / 2026-10-01 Lista.pdf</Text>.
        {'\n\n'}Wybierz folder na tablecie (najlepiej utwórz „SILT Lista” w Dokumentach) — pliki zostaną tam nawet po odinstalowaniu
        aplikacji. Folder można zmienić później w ☰ Menu → Opcje.
      </Text>
      <Przyciski>
        <Przycisk tekst="Później" rodzaj="anuluj" onPress={() => zamknij(false)} />
        <Przycisk tekst="📁 Wybierz folder" onPress={() => zamknij(true)} />
      </Przyciski>
    </Okno>
  );
}

const styles = StyleSheet.create({
  tekst: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 21 },
});
