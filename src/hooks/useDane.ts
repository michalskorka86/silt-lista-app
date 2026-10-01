import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import { nasluchujZmian } from '@/db/zapis';
import { wczytajCennik, type Cennik } from '@/logika/cennik';
import { datyList, wczytajDzien, type Dzien } from '@/logika/lista';

/** Odświeża dane po każdej zmianie na tablecie albo z serwera (zbiera kilka zmian w jedno odświeżenie). */
function useOdswiezanie(wczytaj: () => Promise<void>) {
  const czeka = useRef(false);
  useEffect(() => {
    wczytaj();
    return nasluchujZmian(() => {
      if (czeka.current) return;
      czeka.current = true;
      setTimeout(() => {
        czeka.current = false;
        wczytaj();
      }, 30);
    });
  }, [wczytaj]);
}

/** Lista dnia z bazy tabletu (zakładki, grupy, gracze, pozycje, dodatki, faktury + wyliczenia). */
export function useDzien(data: string) {
  const db = useSQLiteContext();
  const [dzien, setDzien] = useState<Dzien | null>(null);
  const wczytaj = useCallback(async () => setDzien(await wczytajDzien(db, data)), [db, data]);
  useOdswiezanie(wczytaj);
  return dzien;
}

/** Cennik zapisany na tablecie (pobrany z serwera). */
export function useCennik() {
  const db = useSQLiteContext();
  const [cennik, setCennik] = useState<Cennik | null>(null);
  const wczytaj = useCallback(async () => setCennik(await wczytajCennik(db)), [db]);
  useOdswiezanie(wczytaj);
  return cennik;
}

/** Daty list na tablecie (kropki w kalendarzu). */
export function useDatyList() {
  const db = useSQLiteContext();
  const [daty, setDaty] = useState<Set<string>>(new Set());
  const wczytaj = useCallback(async () => setDaty(new Set(await datyList(db))), [db]);
  useOdswiezanie(wczytaj);
  return daty;
}
