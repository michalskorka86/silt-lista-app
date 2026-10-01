<?php
// ============================================================
// SILT Lista — serwer aplikacji — KONFIGURACJA
// Skopiuj ten plik jako config.php (w tym samym folderze) i uzupełnij pola oznaczone ←.
// config.php NIE trafia do repozytorium i nie wolno go nikomu udostępniać.
// ============================================================

// ── Baza danych Listy (osobna od Statystyk i rezerwacji) ─────
define('DB_HOST', 'localhost');
define('DB_NAME', 'serwer432573_lista');
define('DB_USER', 'serwer432573_lista');          // ← użytkownik bazy (w panelu hostingu)
define('DB_PASS', '');                            // ← hasło do bazy

// ── Dostęp tabletów ─────────────────────────────────────────
// Hasło wpisywane RAZ na każdym tablecie przy pierwszym uruchomieniu aplikacji.
// Zmiana hasła = wszystkie tablety muszą zalogować się ponownie.
// Puste '' = tryb testowy: tablet loguje się dowolnym hasłem. Nie zostawiać tak na stałe.
define('LISTA_HASLO', '');                        // ←

// Klucz do uruchamiania cron.php przez adres URL (długi, losowy; inny niż hasło).
define('CRON_KEY', '');                           // ←

// ── Kosz ────────────────────────────────────────────────────
// Po ilu dniach serwer kasuje na dobre rzeczy usunięte na tablecie (na tablecie kosz: 7 dni).
define('KOSZ_DNI', 30);

// ── Statystyki (aplikacja na filedops.pl) ───────────────────
define('STAT_API_URL', 'https://filedops.pl/statystyka/api.php');

// ── SMSAPI.pl — SMS z danymi do faktur (codziennie o 6:00) ──
define('SMSAPI_TOKEN',      '');                  // ← token OAuth z panelu smsapi.pl (puste = SMS-y nie idą)
define('SMS_FAKTURY_NUMER', '48534500503');       // numer, na który idą dane do faktur
define('SMS_NADAWCA',       '');                  // opcjonalnie: zarejestrowana nazwa nadawcy w SMSAPI

// Ile dni wstecz cron sprawdza niewysłane statystyki i SMS-y.
define('DNI_WSTECZ', 14);

// ── Rezerwacje — podgląd dla instruktorów (Menu → Rezerwacje) ──
// Ten sam adres co w lista/config.php z v19: podglad.php w systemie rezerwacji + ?token=PODGLAD_TOKEN
define('REZ_PODGLAD_URL', '');                    // ← np. https://…/rezerwacjaapp/podglad.php?token=…
