<?php
// SILT Lista — funkcje wspólne: konfiguracja, baza, odpowiedzi JSON, czas.
// Działa na PHP 7.4+ (hosting) i MySQL 5.7+/MariaDB 10.3+.

declare(strict_types=1);

// config.php leży obok api.php. Testy mogą wskazać inny plik zmienną SILT_CONFIG.
$__cfg = getenv('SILT_CONFIG') ?: dirname(__DIR__) . '/config.php';
if (!is_file($__cfg)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'kod' => 'konfiguracja', 'msg' => 'Brak pliku config.php na serwerze (skopiuj config.example.php)'], JSON_UNESCAPED_UNICODE);
    exit;
}
require_once $__cfg;

// Ustawienia dodane po pierwszej wersji config.php — wartości domyślne, gdy ich tam nie ma.
if (!defined('STAT_API_URL'))      define('STAT_API_URL', 'https://filedops.pl/statystyka/api.php');
if (!defined('SMSAPI_TOKEN'))      define('SMSAPI_TOKEN', '');
if (!defined('SMSAPI_URL'))        define('SMSAPI_URL', 'https://api.smsapi.pl/sms.do');
if (!defined('SMS_FAKTURY_NUMER')) define('SMS_FAKTURY_NUMER', '48534500503');
if (!defined('SMS_NADAWCA'))       define('SMS_NADAWCA', '');
if (!defined('DNI_WSTECZ'))        define('DNI_WSTECZ', 14);
if (!defined('REZ_PODGLAD_URL'))   define('REZ_PODGLAD_URL', '');
if (!defined('PIN_ADMINA'))        define('PIN_ADMINA', '');
if (!defined('ANTHROPIC_API_KEY')) define('ANTHROPIC_API_KEY', '');
if (!defined('PANEL_HASLO'))       define('PANEL_HASLO', '');
if (!defined('MIESIECZNY_MAIL'))   define('MIESIECZNY_MAIL', '');
if (!defined('MAIL_OD'))           define('MAIL_OD', 'lista@filedops.pl');
if (!defined('MAIL_DZIEN'))        define('MAIL_DZIEN', 3);
if (!defined('MAIL_DO_PLIKU'))     define('MAIL_DO_PLIKU', '');
if (!defined('APK_REPO'))          define('APK_REPO', 'michalskorka86/silt-lista-app');
if (!defined('APK_BAZA_URL'))      define('APK_BAZA_URL', 'https://github.com/' . APK_REPO . '/releases/latest/download/');
if (!defined('OCR_MODEL'))         define('OCR_MODEL', 'claude-sonnet-5-5');
if (!defined('ANTHROPIC_URL'))     define('ANTHROPIC_URL', 'https://api.anthropic.com/v1/messages');

date_default_timezone_set('Europe/Warsaw');   // dzień listy liczymy po polsku; znaczniki czasu w bazie są w UTC

const LIMIT_ZMIAN_W_PACZCE = 200;   // ile zmian tablet może wysłać naraz
const ROZMIAR_STRONY_REV   = 2000;  // ile numerów rev obejmuje jedna strona pobierania

/** Błąd, który ma trafić do tabletu jako czytelny komunikat. */
class BladApi extends Exception
{
    public $kod;
    public $http;
    public function __construct(string $kod, string $msg, int $http = 400)
    {
        parent::__construct($msg);
        $this->kod = $kod;
        $this->http = $http;
    }
}

function baza(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
        $pdo->exec("SET time_zone = '+00:00'");   // NOW() i znaczniki czasu w UTC
    }
    return $pdo;
}

function odpowiedz(array $dane, int $http = 200): void
{
    http_response_code($http);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($dane, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function tresc_zadania(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') return [];
    $j = json_decode($raw, true);
    if (!is_array($j)) throw new BladApi('zle_dane', 'Nieczytelne dane (oczekiwano JSON)');
    return $j;
}

/** Aktualny czas UTC w formacie bazy, z milisekundami. */
function teraz_utc(): string
{
    return gmdate('Y-m-d H:i:s') . '.' . sprintf('%03d', (int)(microtime(true) * 1000) % 1000);
}

/**
 * Czas z tabletu (ISO 8601, np. 2026-09-30T20:35:12.123Z lub z przesunięciem)
 * → 'Y-m-d H:i:s.v' w UTC. Zwraca null, gdy nieczytelny.
 */
function czas_z_iso($v): ?string
{
    if (!is_string($v) || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})$/', $v)) return null;
    try {
        $d = new DateTimeImmutable($v);
    } catch (Exception $e) {
        return null;
    }
    $rok = (int)$d->format('Y');
    if ($rok < 2020 || $rok > 2100) return null;
    return $d->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.v');
}

/** Czas z bazy (UTC) → ISO dla tabletu. */
function czas_do_iso(?string $v): ?string
{
    if ($v === null || $v === '') return null;
    $d = DateTimeImmutable::createFromFormat('Y-m-d H:i:s.u', strlen($v) > 19 ? $v : $v . '.000', new DateTimeZone('UTC'));
    return $d ? $d->format('Y-m-d\TH:i:s.v\Z') : null;
}

function ip_klienta(): string
{
    return substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
}

function naglowek(string $nazwa): string
{
    $k = 'HTTP_' . strtoupper(str_replace('-', '_', $nazwa));
    return trim((string)($_SERVER[$k] ?? ''));
}

function ustawienie(string $klucz, string $domyslna = ''): string
{
    $st = baza()->prepare('SELECT wartosc FROM ustawienia WHERE klucz = ?');
    $st->execute([$klucz]);
    $v = $st->fetchColumn();
    return $v === false ? $domyslna : (string)$v;
}

function biezacy_rev(): int
{
    return (int)baza()->query("SELECT wartosc FROM licznik WHERE nazwa = 'rev'")->fetchColumn();
}

/**
 * Nowy numer zmiany (rev). Wywoływać WEWNĄTRZ transakcji: blokada licznika trwa do commit,
 * więc numery są zatwierdzane po kolei i pobieranie „od rev N” niczego nie pomija.
 */
function nowy_rev(): int
{
    $pdo = baza();
    $pdo->exec("UPDATE licznik SET wartosc = LAST_INSERT_ID(wartosc + 1) WHERE nazwa = 'rev'");
    return (int)$pdo->lastInsertId();
}

/** Dzisiejsza data w Polsce (dzień listy). */
function dzis(): string
{
    return date('Y-m-d');
}
