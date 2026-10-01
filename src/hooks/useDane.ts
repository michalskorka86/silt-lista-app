import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import { nasluchujZmian } from '@/db/zapis';
import { wczytajCennik, type Cennik } from '@/logika/cennik';
import { datyList, listyMiesiaca, wczytajDzien, type Dzien, type ListaArchiwum } from '@/logika/lista';
import { wczytajPracownikow, type Pracownik } from '@/sync/synchronizacja';

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

/** Archiwum: listy z miesiąca („2026-10”) z liczbą grup i utargiem. */
export function useListyMiesiaca(rokMies: string) {
  const db = useSQLiteContext();
  const [lista, setLista] = useState<ListaArchiwum[]>([]);
  const wczytaj = useCallback(async () => setLista(await listyMiesiaca(db, rokMies)), [db, rokMies]);
  useOdswiezanie(wczytaj);
  return lista;
}

/** Pracownicy ze Statystyk zapisani na tablecie (ekran pensji). */
export function usePracownicy() {
  const db = useSQLiteContext();
  const [lista, setLista] = useState<Pracownik[]>([]);
  const wczytaj = useCallback(async () => setLista(await wczytajPracownikow(db)), [db]);
  useOdswiezanie(wczytaj);
  return lista;
}
