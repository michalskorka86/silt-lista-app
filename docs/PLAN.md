# SILT Lista — aplikacja na tablet: plan (30.09.2026)

Pełna lista do odhaczania: plik SILT_Lista_aplikacja_plan.xlsx (u użytkownika).

## Ustalenia
- **Rodzaj aplikacji:** Pełna aplikacja na Androida (React Native + Expo), instalowana z pliku APK.
- **Dystrybucja:** BEZ Google Play (decyzja Michała 01.10): APK z GitHuba instalowany z pliku, poprawki przez aktualizacje „w powietrzu”; nowy APK tylko przy nowych modułach systemowych.
- **Budowanie:** Expo (EAS Build / Update / Submit) + kod w prywatnym repozytorium GitHub.
- **Tablet:** Lenovo Tab M10 (3. gen.) LTE — aplikacja ma być lekka, PDF generowany w nocy.
- **Wygląd:** Zostaje jak w v19. Ekrany odtwarzane ze zrzutów; poprawki tylko po uzgodnieniu.
- **Dane na tablecie:** Baza SQLite w aplikacji zamiast pamięci Chrome.
- **Serwer:** Ten sam serwer (filedops.pl), nowa osobna baza MySQL dla Listy. Statystyki i rezerwacje bez zmian.
- **Połączenia:** Do Statystyk przez ich api.php, rezerwacje przez podglad.php — jak w v19.
- **PDF:** PDF z każdego dnia, automatycznie ok. 3:00; brakujące dorabiane przy uruchomieniu.
- **Foldery:** Folder na każdy miesiąc w pamięci tabletu (np. SILT Lista/2026-09 Wrzesień/).
- **Kopia PDF:** Wbudowana wysyłka na Google Drive (konto firmowe). Nie na serwer.
- **Zakres v1 — dodatki:** Cennik z serwera, kosz 7 dni, przywracanie na nowym tablecie, zgłaszanie błędów, blokada starej wersji, podgląd dnia (PIN admina), panel www.
- **Na później:** Historia zmian, rozliczenie kasy, powiadomienia o rezerwacjach, kiosk + profile, kilka tabletów na jednej liście.
- **Bez zmian z v19:** Cron 6:00, SMS z danymi do faktur na 48534500503, wysyłka do Statystyk, podgląd rezerwacji.

## 0. Przygotowanie
- [—] Konto Google Play Console — NIE robimy (bez Google Play, decyzja 01.10).
- [x] Założyć darmowe konto Expo (expo.dev) (Ty) — Budowanie APK, aktualizacje w powietrzu, wysyłka do Google Play.
- [x] Założyć konto GitHub + prywatne repozytorium (Ty) — Kod z historią; GitHub zleca build w Expo po każdej zmianie.
- [x] Podać model tabletu Lenovo (Ty) — Lenovo Tab M10 (3. gen.) LTE.
- [ ] Sprawdzić wersję Androida na tablecie (Ty) — Ustawienia → Informacje o tablecie.
- [x] Założyć nową bazę MySQL dla Listy na filedops.pl (Ty) — serwer432573_lista. — Osobna, trzecia baza. Statystyki i rezerwacje zostają bez zmian.
- [ ] Przygotować firmowe konto Google na kopie PDF (Ty) — Jedno konto dla wszystkich tabletów, logowane raz w Opcjach.
- [ ] Wymyślić PIN admina (Ty) — 4 cyfry, wpisać w lista-api/config.php (PIN_ADMINA). Otwiera Archiwum, potwierdza usuwanie list (później: podgląd dnia).
- [ ] Spisać ustalenia w skillu do budowy aplikacji (Claude) — Żeby każda sesja trzymała się tych samych zasad.

## 1. Serwer
- [x] Schemat bazy Listy (Claude) — server/sql/001_schemat.sql (do wgrania). — Listy, instruktorzy, grupy, gracze, kulki/dym, wydatki, pensje, faktury, cennik, kosz, kolejka zmian.
- [x] API synchronizacji (wysyłanie zmian z tabletu) (Claude) — server/api.php?akcja=wyslij. — Pojedyncze zmiany wysyłane przy zasięgu, bez dublowania.
- [x] Pobieranie wszystkich danych (przywracanie na nowym tablecie) (Claude) — akcja=pobierz&od_rev=0. — Nowy tablet po zalogowaniu pobiera dane z serwera.
- [x] Cennik, pakiety i własny sprzęt w bazie + pobieranie przez tablet (Claude) — akcja=cennik; strona tabletu w etapie 2. — Przenieść ATR, SPRZET, WOREK z index.php. Zmiana ceny bez aktualizacji aplikacji.
- [x] Przepiąć wysyłkę do Statystyk i SMS faktur (cron 6:00) na nową bazę (Claude) — api.php Statystyk i SMSAPI bez zmian, zmienia się tylko źródło danych. — lib/statystyki.php, cron.php o 6:00; ponowna wysyłka po poprawkach.
- [x] Minimalna wymagana wersja aplikacji (blokada starej wersji) (Claude) — ustawienia.min_wersja_app. — Stara wersja prosi o aktualizację zamiast wysyłać złe dane.
- [x] Przenieść istniejące listy z folderu data/ do bazy (Claude) — Żeby archiwum z v19 było widoczne w nowej aplikacji. — niepotrzebne: w v19 nie wprowadzono danych.

## 2. Aplikacja — podstawa
- [x] Projekt Expo / React Native: nazwa, ikona, podpis (Claude)
- [ ] Zrzuty ekranów v19 jako wzór wyglądu (Claude) — Wygląd zostaje jak w v19 (kolory, układ, zakładki, karty). Poprawki tylko po uzgodnieniu.
- [x] Baza SQLite na tablecie + automatyczny zapis każdej zmiany (Claude) — src/db/zapis.ts, kolejka zmian. — Nic nie ginie po restarcie ani rozładowaniu.
- [x] Logowanie tabletu hasłem (Claude) — ekran jak auth_lista.php z v19. — Jak w v19: raz na tablecie, potem pamięta.
- [x] Start: Utwórz listę / Rezerwacje / Archiwum (Claude)
- [x] Lista dnia: zakładki instruktorów, dodawanie grup (Claude)
- [x] Karta grupy i gracze (Claude)
- [x] Kulki i dym (Claude)
- [x] Inny pakiet / własny sprzęt (Claude)
- [x] Pieniądze: kwota, zadatek, płatność (Claude)
- [x] Faktura i dodatki (Claude)
- [x] Koniec dnia: godziny, pensje, wydatki (Claude) — ekran Wydatki: wydatki, pensje (pracownicy ze Statystyk, zaokrąglenie do 10 zł), podsumowanie, „📤 Wyślij statystyki”.
- [x] Archiwum list (z hasłem) (Claude) — hasło aplikacji, ważne 10 min; podgląd bez edycji; usuwanie zawsze z hasłem.
- [x] Podgląd rezerwacji (SILT / Arsenał, działa offline) (Claude) — przez serwer listy (REZ_PODGLAD_URL w config.php); tablet trzyma bieżący i następny miesiąc.
- [x] Kafelek menu: Cennik / Raport / Rezerwacje / Opcje (Claude) — Popup na środku ekranu.
- [x] Zdjęcie kartki z graczami → odczyt (OCR / Claude) (Claude) — 📷 w karcie grupy: aparat/galeria → serwer (Claude, klucz w config.php) → tabela do poprawienia → „Dodaj graczy ✓”. Bez zasięgu: wpisanie ręczne w tej samej tabeli.
- [x] Praca bez zasięgu + wysyłka w tle, znacznik „⏳ Niewysłane” (Claude) — src/sync/.

## 3. Nowe funkcje v1
- [x] Ustalić wygląd raportu PDF (co jest na wydruku) (Razem) — jak v19 (A4 poziomo, grupy od najstarszej) + strona: pensje (tylko podstawa, bez premii), wydatki, podsumowanie dnia.
- [x] PDF dnia generowany na tablecie (bez internetu) (Claude) — Menu → Raport PDF i Archiwum → Drukuj / PDF: podgląd, 🖨️ Drukuj, 📤 Zapisz / wyślij (menu Androida: Dysk, mail, WhatsApp, Pliki).
- [x] Foldery miesięczne na tablecie (Claude) — folder wybierany przy 1. uruchomieniu lub w Opcjach (📁). — Wybór miejsca przy 1. uruchomieniu, np. Dokumenty/SILT Lista/2026-09 Wrzesień/2026-09-30 Lista.pdf. Pliki przetrwają odinstalowanie.
- [x] Automatyczne tworzenie PDF ok. 3:00 w nocy (Claude) — Plus dorabianie brakujących PDF-ów przy każdym uruchomieniu. — Zadanie w tle co ok. godzinę (Android wybiera chwilę); wczorajsza lista po 3:00; zmieniona stara lista → nowy PDF; ostatnie 45 dni; Opcje → 🔄 robi od razu.
- [ ] Wbudowana wysyłka PDF na Google Drive (konto firmowe) (Claude) — Ta sama struktura folderów. Bez zasięgu czeka w kolejce. Kopie NIE idą na serwer.
- [x] Kosz: skasowana grupa do przywrócenia przez 7 dni (Claude) — ☰ Menu → 🗑️ Kosz: grupy, gracze, listy instruktorów, całe dni, wydatki, pensje; „↩ Przywróć” (wraca też na serwerze); po 7 dniach tablet kasuje na dobre.
- [ ] Przywracanie danych na nowym tablecie (Claude)
- [x] Zgłaszanie błędów (raport, gdy aplikacja się wysypie) (Claude) — awarie + „📨 Zgłoś problem” (Opcje) → tablet → serwer przy zasięgu; podgląd: lista-api/bledy.php?key=CRON_KEY. Wysypany ekran pokazuje „Coś poszło nie tak / Spróbuj ponownie”.
- [ ] Blokada starej wersji w aplikacji (Claude)
- [x] Aktualizacje „w powietrzu” (bez nowej instalacji) (Claude) — EAS Update: GitHub → Actions → „Wyślij aktualizację”. Tablet pobiera przy starcie i po powrocie po 10 min przerwy; Opcje → ⬇️ od razu. Nowy APK tylko przy nowych modułach systemowych.
- [x] PIN admina (Claude) — 4 cyfry do Archiwum i usuwania list. Podgląd dnia dla admina — NIE robimy (wszystko jest w PDF dnia; decyzja Michała 01.10).

## 4. Panel www
- [x] Panel w przeglądarce do przeglądania list (Claude) — lista-api/panel.php, hasło PANEL_HASLO; miesiąc → dni, dzień → raport jak PDF, druk całego miesiąca, ZIP miesiąca (HTML dni + CSV).

## 5. Testy i wdrożenie
- [ ] Pierwszy APK — test na tablecie obok PWA v19 (Razem)
- [ ] Test bez zasięgu, restart, rozładowanie baterii (Ty)
- [ ] Test wysyłki do Statystyk (nie dubluje) i SMS faktur (Razem)
- [ ] Test PDF w nocy i wysyłki na Google Drive (Ty)
- [ ] Wdrożenie: APK na wszystkie tablety + logowanie (Razem) — bez Google Play.
- [ ] Aktualizacja instrukcji PDF dla instruktorów (Claude)
- [ ] Wyłączenie starego PWA po okresie przejściowym (Ty)

## 6. Na później
- [ ] Historia zmian (kto, kiedy, co zmienił) (Claude)
- [ ] Rozliczenie kasy na koniec dnia (gotówka / karta / przelew) (Claude)
- [ ] Powiadomienie wieczorem o jutrzejszych rezerwacjach (Claude)
- [ ] Tryb kiosku + profile Admin / Instruktor (Razem) — Instruktor widzi tylko aplikację i Wi-Fi.
- [ ] Kilka tabletów na jednej liście jednocześnie (Claude)

## Stan (01.10.2026)
- Repozytorium: github.com/michalskorka86/silt-lista-app. Expo: projekt michal198926s-team/silt-lista.
- Etap 1 (serwer) ZAKOŃCZONY: baza serwer432573_lista + API na filedops.pl/lista-api/ (wgrane, działa). Cron 6:00: Statystyki + SMS faktur + kosz.
- Etap 2 — fundament danych gotowy: tabele list w SQLite (migracja 2), zapis z kolejką, obliczenia grupy (port calc() z v19, zgodny na 5000 losowych grupach), synchronizacja (wysyłka, pobieranie, cennik, pracownicy), logowanie tabletu, „⏳ Niewysłane” w górnym pasku. Testy z prawdziwym serwerem PHP w GitHub.
- Ustalenia: jedna lista na dzień z zakładkami instruktorów (jak v19); kwoty grup liczy tablet; kosz 7 dni na tablecie, 30 dni na serwerze; czas w bazie UTC; v19 nie ma danych do przeniesienia; wersje testowe aplikacji 0.x (min_wersja_app 0.1.0 do wydania 1.0).
- Ekrany (01.10): Utwórz listę (kalendarz, imię instruktora), lista dnia (zakładki, pasek, karty grup), gracze, kulki z pakietu/dokupione, dym, inne, osób/kulki bez imion/kwota/zadatek (numpad), płatność, podstawa i cena kulek dodatkowych. Sprawdzone w przeglądarce z lokalnym serwerem — dane dochodzą na serwer.
- Pakiet gracza, własny sprzęt + worki, dodatki, faktura — gotowe (01.10).
- Wydatki/pensje, podsumowanie dnia, wysyłka statystyk z tabletu, Menu (Cennik, Opcje) — gotowe (01.10).
- Archiwum list (z hasłem) i podgląd rezerwacji (offline) — gotowe (01.10). Na serwer: nowy lib/rezerwacje.php, api.php, wpis REZ_PODGLAD_URL w config.php.
- Raport PDF ręczny — gotowy (01.10). Wymaga nowej wersji APK (nowe moduły: drukowanie, udostępnianie, podgląd).
- Automatyczne PDF-y + foldery miesięcy — gotowe (01.10), do sprawdzenia na tablecie (nowy APK).
- PIN admina zamiast hasła (Archiwum, usuwanie list) — gotowy (01.10). Kopia PDF na Google Drive — na sam koniec.
- Aktualizacje „w powietrzu” — gotowe (01.10); działają od następnego APK.
- Kosz — gotowy (01.10), idzie aktualizacją „w powietrzu”.
- Zgłaszanie błędów — gotowe (01.10). Na serwer: bledy.php.
- Zdjęcie kartki → gracze — gotowe (01.10). Wymaga nowego APK (aparat) i ANTHROPIC_API_KEY w config.php.
- Panel www z ZIP-em miesiąca — gotowy (01.10). Na serwer: panel.php, lib/raport.php, lib/wspolne.php + PANEL_HASLO.
- Szybkie budowanie APK na GitHubie (Actions → „Buduj APK (szybko)”, wydanie w Releases), stały link filedops.pl/lista-api/apk.php i „📥 Jest nowa wersja aplikacji” na tablecie — gotowe (01.10), pierwsze uruchomienie do sprawdzenia.
- Następny krok: instrukcja dla instruktorów, na koniec kopia PDF na Google Drive.
