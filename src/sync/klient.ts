/**
 * Klient API serwera Listy (filedops.pl/lista-api/api.php).
 * Bez importów React Native — adres, wersję i token podaje aplikacja (albo test w Node).
 */

export type KonfiguracjaKlienta = {
  url: string; // pełny adres api.php
  wersja: string; // wersja aplikacji → nagłówek X-App-Wersja (blokada starej wersji)
  token: () => Promise<string | null>;
  timeoutMs?: number;
};

/** Brak internetu, serwer nie odpowiada, przekroczony czas. Dane czekają na tablecie. */
export class BladPolaczenia extends Error {}

/** Serwer odpowiedział błędem (kod z API: zaloguj, aktualizacja, zle_haslo, blokada…). */
export class BladSerwera extends Error {
  kod: string;
  http: number;
  constructor(kod: string, message: string, http: number) {
    super(message);
    this.kod = kod;
    this.http = http;
  }
}

export type Klient = <T = Record<string, unknown>>(
  akcja: string,
  opcje?: { body?: unknown; params?: Record<string, string | number>; timeoutMs?: number },
) => Promise<T>;

export function utworzKlienta(k: KonfiguracjaKlienta): Klient {
  return async function zapytanie<T>(
    akcja: string,
    opcje: { body?: unknown; params?: Record<string, string | number>; timeoutMs?: number } = {},
  ) {
    const qs = new URLSearchParams({ akcja, ...Object.fromEntries(Object.entries(opcje.params ?? {}).map(([a, b]) => [a, String(b)])) });
    const token = await k.token();
    const headers: Record<string, string> = { 'X-App-Wersja': k.wersja, Accept: 'application/json' };
    if (token) headers['X-Tablet-Token'] = token;
    if (opcje.body !== undefined) headers['Content-Type'] = 'application/json';

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opcje.timeoutMs ?? k.timeoutMs ?? 20000);
    let res: Response;
    try {
      res = await fetch(`${k.url}?${qs.toString()}`, {
        method: opcje.body !== undefined ? 'POST' : 'GET',
        headers,
        body: opcje.body !== undefined ? JSON.stringify(opcje.body) : undefined,
        signal: ctrl.signal,
      });
    } catch {
      throw new BladPolaczenia('Brak połączenia z serwerem');
    } finally {
      clearTimeout(timer);
    }

    let json: { ok?: boolean; kod?: string; msg?: string } & Record<string, unknown>;
    try {
      json = await res.json();
    } catch {
      // np. strona błędu hostingu albo zerwane połączenie w trakcie
      throw res.status >= 500 || res.status === 0
        ? new BladPolaczenia(`Serwer nie odpowiada poprawnie (HTTP ${res.status})`)
        : new BladSerwera('nieczytelna_odpowiedz', `Nieczytelna odpowiedź serwera (HTTP ${res.status})`, res.status);
    }
    if (!res.ok || json.ok === false) {
      if (res.status >= 500 && json.kod === 'serwer') throw new BladPolaczenia(json.msg ?? 'Błąd serwera');
      throw new BladSerwera(json.kod ?? 'blad', json.msg ?? `Błąd serwera (HTTP ${res.status})`, res.status);
    }
    return json as T;
  } as Klient;
}
