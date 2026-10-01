/** Formatowanie jak w v19 (zl(), fmtDatePL(), plGrup()). Bez importów React Native. */

/** 1395 → „1 395 zł”, 12.5 → „12,5 zł”. */
export function zl(v: number | null | undefined): string {
  const n = Math.round((Number(v) || 0) * 100) / 100;
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' zł';
}

/** 0 → „—”. */
export const zlDash = (v: number | null | undefined): string => (v ? zl(v) : '—');

/** 1700 → „1 700”. */
export const liczba = (v: number): string => (Number(v) || 0).toLocaleString('pl-PL');

/** Dzisiejsza data lokalna jako YYYY-MM-DD (dzień listy). */
export function dzisISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** „2026-09-30” → „30.09.2026”. */
export function dataPL(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** „2026-09-30” → „śr., 30 wrz” (górny pasek). */
export function dataKrotko(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** „2026-09-30” → „środa, 30 września 2026”. */
export function dataDluga(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** 1 grupa, 2 grupy, 5 grup, 22 grupy… */
export function plGrup(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  return n + (n === 1 ? ' grupa' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? ' grupy' : ' grup');
}

/** Aktualna godzina „HH:MM”. */
export function terazHM(d: Date = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Liczba z pola tekstowego: „12,5” → 12.5; puste/złe → 0. */
export function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : 0;
}
