import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';

import { dataPL, plGrup } from '@/logika/format';
import { usunListe, wczytajDzien } from '@/logika/lista';

import { useKomunikaty } from '../ui/Komunikaty';

/**
 * Archiwum otwiera się po PIN-ie admina (albo haśle aplikacji, gdy PIN-u nie ustawiono) — jak hasło archiwum w v19.
 * Raz wpisane hasło wystarcza na 10 minut — potem trzeba je podać znowu
 * (tablet zostawiony na poligonie nie pokazuje starych list każdemu).
 */
const WAZNE_MS = 10 * 60 * 1000;
let otwarteDo = 0;

export const archiwumOtwarte = () => Date.now() < otwarteDo;
const odblokuj = () => {
  otwarteDo = Date.now() + WAZNE_MS;
};

export function useArchiwum() {
  const db = useSQLiteContext();
  const { toast, potwierdzHaslem } = useKomunikaty();

  /** Wykonuje `co` od razu, gdy archiwum jest otwarte, albo po wpisaniu hasła. */
  const zHaslem = useCallback(
    (co: () => void) => {
      if (archiwumOtwarte()) {
        odblokuj();
        co();
        return;
      }
      potwierdzHaslem({
        tytul: '📁 Archiwum',
        tekst: 'Archiwum list z poprzednich dni.',
        ok: 'Otwórz',
        rodzajOk: 'dalej',
        onOk: () => {
          odblokuj();
          co();
        },
      });
    },
    [potwierdzHaslem],
  );

  /** 🗑 Usuń listę — zawsze z hasłem (także gdy archiwum jest otwarte). */
  const usunZHaslem = useCallback(
    async (data: string, poUsunieciu?: () => void) => {
      const d = await wczytajDzien(db, data);
      potwierdzHaslem({
        tytul: '🗑 Usuń listę dnia',
        tekst:
          `Usunąć całą listę z ${dataPL(data)} — wszystkich instruktorów (${plGrup(d.grupy.length)}), wydatki i pensje — z tabletu i z serwera?` +
          (d.lista?.s_stat_wyslano ? ' Statystyki z tego dnia są już wysłane — w bazie statystyk zostaną.' : '') +
          ' Przez 7 dni można ją przywrócić z kosza.',
        ok: 'Usuń listę',
        onOk: async () => {
          await usunListe(db, data);
          toast(`🗑 Lista ${dataPL(data)} usunięta`);
          poUsunieciu?.();
        },
      });
    },
    [db, potwierdzHaslem, toast],
  );

  return { zHaslem, usunZHaslem };
}
