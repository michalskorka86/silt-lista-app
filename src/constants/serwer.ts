/** Adres API serwera Listy (server/ w repozytorium, wgrany na filedops.pl/lista-api/). */
export const API_URL = 'https://filedops.pl/lista-api/api.php';

/** Co ile sprawdzać serwer, gdy są niewysłane zmiany / gdy wszystko wysłane. */
export const SYNC_CO_MS_NIEWYSLANE = 60 * 1000;
export const SYNC_CO_MS_SPOKOJNIE = 5 * 60 * 1000;
/** Ile czekać po zmianie na tablecie, zanim wyślemy (zbiera kilka kliknięć w jedną wysyłkę). */
export const SYNC_PO_ZMIANIE_MS = 3000;
