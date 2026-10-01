#!/bin/sh
# Tworzy config testowy z config.example.php: $1 = plik wynikowy, $2 = host bazy, $3 = użytkownik, $4 = hasło,
# $5 = adres serwera z atrapami Statystyk i SMSAPI (osobny `php -S`, np. http://127.0.0.1:8766)
sed -e "s/'localhost'/'$2'/" -e "s/'serwer432573_lista');/'silt_test');/" \
    -e "s/define('DB_USER', '[^']*')/define('DB_USER', '$3')/" -e "s/define('DB_PASS', '')/define('DB_PASS', '$4')/" \
    -e "s/define('LISTA_HASLO', '')/define('LISTA_HASLO', 'test123')/" -e "s/define('CRON_KEY', '')/define('CRON_KEY', 'cron-test')/" \
    -e "s#define('STAT_API_URL', '[^']*')#define('STAT_API_URL', '$5/testy/mock/statystyka.php')#" \
    -e "s/define('SMSAPI_TOKEN',      '')/define('SMSAPI_TOKEN', 'test-token')/" \
    -e "s#define('REZ_PODGLAD_URL', '')#define('REZ_PODGLAD_URL', '$5/testy/mock/podglad.php?token=test')#" \
    -e "s/define('PIN_ADMINA', '')/define('PIN_ADMINA', '1234')/" \
    -e "s/define('ANTHROPIC_API_KEY', '')/define('ANTHROPIC_API_KEY', 'test-key')/" \
    -e "s/define('PANEL_HASLO', '')/define('PANEL_HASLO', 'panel-test')/" \
    "$(dirname "$0")/../config.example.php" > "$1"
echo "define('SMSAPI_URL', '$5/testy/mock/sms.php');" >> "$1"
echo "define('ANTHROPIC_URL', '$5/testy/mock/anthropic.php');" >> "$1"
echo "define('APK_BAZA_URL', '$5/testy/mock/apk/');" >> "$1"
