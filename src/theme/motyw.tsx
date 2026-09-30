import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { Colors, type Palette } from '@/constants/theme';
import { getUstawienie, setUstawienie } from '@/db/ustawienia';

type Motyw = 'dark' | 'light';

const Ctx = createContext<{ motyw: Motyw; c: Palette; przelacz: () => void }>({
  motyw: 'dark',
  c: Colors.dark,
  przelacz: () => {},
});

/** Motyw jak w v19: domyślnie ciemny, przycisk ☀️/🌙 w górnym pasku, wybór zapamiętany w tablecie. */
export function MotywProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [motyw, setMotyw] = useState<Motyw>('dark');

  useEffect(() => {
    getUstawienie(db, 'motyw').then((m) => {
      if (m === 'light' || m === 'dark') setMotyw(m);
    });
  }, [db]);

  const przelacz = () => {
    const nowy: Motyw = motyw === 'dark' ? 'light' : 'dark';
    setMotyw(nowy);
    setUstawienie(db, 'motyw', nowy);
  };

  return <Ctx.Provider value={{ motyw, c: Colors[motyw], przelacz }}>{children}</Ctx.Provider>;
}

export const useMotyw = () => useContext(Ctx);
