/**
 * 🏢 Impreza firmowa: stawki wpisuje się netto, a w bazie (i do obliczeń) trzymamy brutto — jak w całej aplikacji.
 * VAT 23% (usługi rekreacyjne / paintball).
 */
export const VAT = 0.23;
const zaokr = (v: number) => Math.round(v * 100) / 100;
/** netto → brutto (do zapisu) */
export const brutto = (netto: number): number => zaokr(netto * (1 + VAT));
/** brutto → netto (do wyświetlenia / edycji) */
export const netto = (b: number): number => zaokr(b / (1 + VAT));
/** wartość pola tekstowego do edycji: w grupie firmowej netto, inaczej brutto */
export const doPola = (b: number | null | undefined, firma: boolean): string =>
  b === null || b === undefined || b === 0 ? (b === 0 ? '0' : '') : String(firma ? netto(b) : b).replace('.', ',');
/** z pola do zapisu (brutto) */
export const zPola = (v: number, firma: boolean): number => (firma ? brutto(v) : v);
