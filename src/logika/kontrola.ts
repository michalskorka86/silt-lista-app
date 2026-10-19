/**
 * ✅ Kontrola przed RĘCZNĄ wysyłką statystyk („📤 Wyślij statystyki do bazy”):
 * czy każda grupa ma formę płatności, ilość osób i kulki. Automatyczna wysyłka o 6:00 tego nie sprawdza.
 */
import { atrakcja, type Cennik } from './cennik';
import type { Dzien } from './lista';

export type BrakGrupy = { instruktor: string; grupa: string; braki: string[] };

export function brakiDnia(dzien: Pick<Dzien, 'grupy' | 'instruktorzy'>, cennik: Cennik | null): BrakGrupy[] {
  const out: BrakGrupy[] = [];
  for (const g of dzien.grupy) {
    const w = g.wynik;
    const braki: string[] = [];
    if (!g.platnosc && w.doZap > 0) braki.push('forma płatności');
    // organizator dopisuje się sam jako gracz — sama 1 osoba oznacza, że nikt nie wpisał ilości
    if (w.gracze <= 1) braki.push('ilość osób');
    const a = atrakcja(cennik, g.atrakcja);
    const zKulkami = a ? a.opcje_pakiet.length > 0 || !!a.kdod : true; // np. laser — bez kulek
    if (zKulkami && w.kulki <= 0) braki.push('ilość kulek');
    if (!braki.length) continue;
    const instr = dzien.instruktorzy.find((i) => i.id === g.instruktor_id)?.imie ?? 'bez instruktora';
    const nazwa = [a?.nazwa ?? g.atrakcja, g.organizator ? `org. ${g.organizator}` : '', g.godzina].filter(Boolean).join(', ');
    out.push({ instruktor: instr, grupa: nazwa, braki });
  }
  return out;
}

/** Tekst komunikatu: pogrupowane po instruktorach. */
export function opisBrakow(b: BrakGrupy[]): string {
  const wg = new Map<string, BrakGrupy[]>();
  for (const x of b) wg.set(x.instruktor, [...(wg.get(x.instruktor) ?? []), x]);
  return [...wg.entries()]
    .map(([instr, gr]) => `👷 ${instr}:\n` + gr.map((x) => `  • ${x.grupa} — brak: ${x.braki.join(', ')}`).join('\n'))
    .join('\n\n');
}
