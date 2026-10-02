import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { wstrzymajZapisy, wznowZapisy } from '@/db/zapis';

/** Po ilu minutach w tle wolno po cichu przeładować aplikację z nową wersją (nikt nie jest w trakcie wpisywania). */
const PO_PRZERWIE_MS = 10 * 60 * 1000;

/**
 * Aktualizacje „w powietrzu” (EAS Update): poprawki ekranów, obliczeń, PDF itp. bez instalowania APK.
 * - przy starcie aplikacja sama pobiera nową wersję w tle (włączy się przy następnym starcie),
 * - po powrocie do aplikacji po co najmniej 10 min przerwy: sprawdza, pobiera i od razu przeładowuje.
 * Dane są w bazie tabletu, więc przeładowanie niczego nie gubi.
 * Nowy APK jest potrzebny tylko przy zmianie modułów systemowych (wtedy ta wersja aktualizacji nie dostanie).
 */
export function Aktualizacje() {
  useEffect(() => {
    if (!Updates.isEnabled) return;
    let wTle: number | null = null;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') wTle = Date.now();
      else if (s === 'active' && wTle !== null) {
        const przerwa = Date.now() - wTle;
        wTle = null;
        if (przerwa >= PO_PRZERWIE_MS) pobierzIPrzeladuj().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);
  return null;
}

/** Sprawdza i pobiera nową wersję. Zwraca: 'brak' | 'pobrano' (i przeładowuje) | 'niedostepne'. */
export async function pobierzIPrzeladuj(): Promise<'brak' | 'pobrano' | 'niedostepne'> {
  if (!Updates.isEnabled) return 'niedostepne';
  const s = await Updates.checkForUpdateAsync();
  if (!s.isAvailable) return 'brak';
  await Updates.fetchUpdateAsync();
  // Przeładowanie tylko, gdy nic się akurat nie zapisuje — inaczej baza mogłaby zostać zablokowana.
  // Gdy się nie da teraz, nowa wersja włączy się sama przy następnym uruchomieniu aplikacji.
  if (!(await wstrzymajZapisy())) {
    wznowZapisy();
    return 'pobrano';
  }
  try {
    await Updates.reloadAsync();
  } catch (e) {
    wznowZapisy();
    throw e;
  }
  return 'pobrano';
}

/** „0.1.0 · aktualizacja z 1.10, 15:50” (albo „wersja z instalacji”). */
export function opisWersji(wersja: string): string {
  if (!Updates.isEnabled) return wersja;
  if (Updates.isEmbeddedLaunch || !Updates.createdAt) return `${wersja} · wersja z instalacji`;
  return `${wersja} · aktualizacja z ${Updates.createdAt.toLocaleString('pl-PL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
}
