import { Linking, StyleSheet, Text } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useMotyw } from '@/theme/motyw';

import { zglos } from './bledy/zglos';
import { useKomunikaty } from './ui/Komunikaty';
import { Okno, Przycisk, Przyciski } from './ui/Okno';

/**
 * 🏠 Tryb kiosku: aplikacja jest „ekranem głównym” tabletu (intent HOME w app.json),
 * więc startuje po włączeniu tabletu i wraca po naciśnięciu Home.
 * Wyjście do zwykłego Androida — tylko tutaj, po PIN-ie admina.
 */
async function otworz(akcja: string, zapasowa?: string) {
  try {
    await Linking.sendIntent(akcja);
  } catch (e) {
    if (zapasowa) return otworz(zapasowa);
    throw e;
  }
}

export function OknoKiosk({ onZamknij }: { onZamknij: () => void }) {
  const { c } = useMotyw();
  const { toast } = useKomunikaty();

  const idz = (akcja: string, zapasowa?: string) => async () => {
    try {
      await otworz(akcja, zapasowa);
      onZamknij();
    } catch (e) {
      zglos(e, { dopisek: 'Kiosk' });
      toast('❌ Nie udało się otworzyć ustawień tabletu');
    }
  };

  return (
    <Okno widoczne onZamknij={onZamknij} tytul="🏠 Tryb kiosku" rozmiar="sm">
      <Text style={[styles.tekst, { color: c.text2 }]}>
        Gdy SILT Lista jest <Text style={{ color: c.text, fontFamily: Fonts.bold }}>ekranem głównym</Text>, tablet po włączeniu od razu
        otwiera listę, a przycisk Home zawsze do niej wraca.
        {'\n\n'}Włączenie: „🏠 Zmień ekran główny” → wybierz <Text style={{ color: c.text, fontFamily: Fonts.bold }}>SILT Lista</Text>.
        {'\n'}Wyłączenie (powrót do zwykłego Androida): to samo, ale wybierz poprzedni ekran główny (np. Lenovo / Launcher).
      </Text>
      <Przyciski>
        <Przycisk tekst="Anuluj" rodzaj="anuluj" onPress={onZamknij} />
        <Przycisk tekst="⚙️ Ustawienia tabletu" rodzaj="anuluj" onPress={idz('android.settings.SETTINGS')} />
        <Przycisk tekst="🏠 Zmień ekran główny" onPress={idz('android.settings.HOME_SETTINGS', 'android.settings.SETTINGS')} />
      </Przyciski>
    </Okno>
  );
}

const styles = StyleSheet.create({
  tekst: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 21 },
});
