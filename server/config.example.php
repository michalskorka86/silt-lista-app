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
