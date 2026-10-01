import Constants from 'expo-constants';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { API_URL, SYNC_CO_MS_NIEWYSLANE, SYNC_CO_MS_SPOKOJNIE, SYNC_PO_ZMIANIE_MS } from '@/constants/serwer';
import { liczNiewyslane, nasluchujZmian } from '@/db/zapis';
import { utworzKlienta } from '@/sync/klient';
import {
  sprawdzHaslo as sprawdzHasloTabletu,
  synchronizuj,
  tokenTabletu,
  wyslijStatystyki as wyslijStatystykiDnia,
  wyloguj as wylogujTablet,
  zaloguj as zalogujTablet,
  type StanSynchronizacji,
} from '@/sync/synchronizacja';

type Kontekst = {
  /** null = jeszcze sprawdzamy */
  zalogowany: boolean | null;
  stan: StanSynchronizacji | null;
  niewyslane: number;
  trwa: boolean;
  synchronizujTeraz: () => Promise<StanSynchronizacji | null>;
  zaloguj: (haslo: string) => Promise<void>;
  wyloguj: () => Promise<void>;
  /** Hasło aplikacji przed usunięciem listy: ok / zle / offline (brak zapamiętanego hasła i zasięgu) / blokada */
  sprawdzHaslo: (haslo: string) => Promise<'ok' | 'zle' | 'offline' | 'blokada'>;
  /** „📤 Wyślij statystyki do bazy” — zwraca komunikat, rzuca Error z opisem */
  wyslijStatystyki: (data: string, wymus: boolean) => Promise<string>;
};

const Ctx = createContext<Kontekst>({
  zalogowany: null,
  stan: null,
  niewyslane: 0,
  trwa: false,
  synchronizujTeraz: async () => null,
  zaloguj: async () => {},
  wyloguj: async () => {},
  sprawdzHaslo: async () => 'zle',
  wyslijStatystyki: async () => '',
});

export const WERSJA_APLIKACJI = Constants.expoConfig?.version ?? '0.0.0';
const MODEL = Platform.OS === 'android' ? `${Platform.constants.Brand} ${Platform.constants.Model}` : Platform.OS;

/**
 * Logowanie tabletu i wysyłka w tle:
 *  – po starcie aplikacji i po powrocie do niej,
 *  – kilka sekund po każdej zmianie na liście,
 *  – co minutę, dopóki coś czeka (co 5 minut, gdy wszystko wysłane).
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const klient = useMemo(() => utworzKlienta({ url: API_URL, wersja: WERSJA_APLIKACJI, token: () => tokenTabletu(db) }), [db]);
  const [zalogowany, setZalogowany] = useState<boolean | null>(null);
  const [stan, setStan] = useState<StanSynchronizacji | null>(null);
  const [niewyslane, setNiewyslane] = useState(0);
  const [trwa, setTrwa] = useState(false);
  const opoznienie = useRef<ReturnType<typeof setTimeout> | null>(null);

  const synchronizujTeraz = useCallback(async () => {
    if (!(await tokenTabletu(db))) {
      setZalogowany(false);
      return null;
    }
    setTrwa(true);
    try {
      const s = await synchronizuj(db, klient);
      setStan(s);
      setNiewyslane(s.niewyslane);
      if (s.stan === 'zaloguj') setZalogowany(false);
      return s;
    } finally {
      setTrwa(false);
    }
  }, [db, klient]);

  // Start: czy tablet jest zalogowany; jeśli tak — od razu synchronizacja.
  useEffect(() => {
    let aktywny = true;
    (async () => {
      const token = await tokenTabletu(db);
      setNiewyslane(await liczNiewyslane(db));
      if (!aktywny) return;
      setZalogowany(!!token);
      if (token) synchronizujTeraz();
    })();
    return () => {
      aktywny = false;
    };
  }, [db, synchronizujTeraz]);

  // Zmiana na tablecie → licznik „Niewysłane” od razu, wysyłka po chwili.
  useEffect(() => {
    return nasluchujZmian((t) => {
      if (t === 'serwer') return;
      liczNiewyslane(db).then(setNiewyslane);
      if (opoznienie.current) clearTimeout(opoznienie.current);
      opoznienie.current = setTimeout(() => synchronizujTeraz(), SYNC_PO_ZMIANIE_MS);
    });
  }, [db, synchronizujTeraz]);

  // Co minutę / co 5 minut, tylko gdy zalogowany.
  useEffect(() => {
    if (!zalogowany) return;
    const t = setInterval(() => synchronizujTeraz(), niewyslane > 0 ? SYNC_CO_MS_NIEWYSLANE : SYNC_CO_MS_SPOKOJNIE);
    return () => clearInterval(t);
  }, [zalogowany, niewyslane, synchronizujTeraz]);

  // Powrót do aplikacji (np. po wyłączeniu ekranu) → synchronizacja.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && zalogowany) synchronizujTeraz();
    });
    return () => sub.remove();
  }, [zalogowany, synchronizujTeraz]);

  const zaloguj = useCallback(
    async (haslo: string) => {
      await zalogujTablet(db, klient, haslo, MODEL, WERSJA_APLIKACJI);
      setZalogowany(true);
      synchronizujTeraz();
    },
    [db, klient, synchronizujTeraz],
  );

  const wyloguj = useCallback(async () => {
    await wylogujTablet(db, klient);
    setZalogowany(false);
    setStan(null);
  }, [db, klient]);

  const wyslijStatystyki = useCallback(
    async (data: string, wymus: boolean) => {
      setTrwa(true);
      try {
        return await wyslijStatystykiDnia(db, klient, data, wymus);
      } finally {
        setTrwa(false);
        setNiewyslane(await liczNiewyslane(db));
      }
    },
    [db, klient],
  );

  const sprawdzHaslo = useCallback((haslo: string) => sprawdzHasloTabletu(db, klient, haslo, MODEL, WERSJA_APLIKACJI), [db, klient]);

  return (
    <Ctx.Provider value={{ zalogowany, stan, niewyslane, trwa, synchronizujTeraz, zaloguj, wyloguj, sprawdzHaslo, wyslijStatystyki }}>
      {children}
    </Ctx.Provider>
  );
}

export const useSync = () => useContext(Ctx);
