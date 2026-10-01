# SILT Lista — aplikacja na tablet: plan (30.09.2026)

Pełna lista do odhaczania: plik SILT_Lista_aplikacja_plan.xlsx (u użytkownika).

## Ustalenia
- **Rodzaj aplikacji:** Pełna aplikacja na Androida (React Native + Expo), instalowana z Google Play.
- **Dystrybucja:** Google Play, konto osobiste (na firmowym koncie Google), tylko test wewnętrzny dla Waszych tabletów. Bez D-U-N-S.
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
- [ ] Założyć konto Google Play Console (osobiste, na firmowym koncie Google) (Ty) — Jednorazowo 25 USD + potwierdzenie tożsamości. Bez D-U-N-S. Dystrybucja tylko przez test wewnętrzny.
- [x] Założyć darmowe konto Expo (expo.dev) (Ty) — Budowanie APK, aktualizacje w powietrzu, wysyłka do Google Play.
- [x] Założyć konto GitHub + prywatne repozytorium (Ty) — Kod z historią; GitHub zleca build w Expo po każdej zmianie.
- [x] Podać model tabletu Lenovo (Ty) — Lenovo Tab M10 (3. gen.) LTE.
- [ ] Sprawdzić wersję Androida na tablecie (Ty) — Ustawienia → Informacje o tablecie.
- [x] Założyć nową bazę MySQL dla Listy na filedops.pl (Ty) — serwer432573_lista. — Osobna, trzecia baza. Statystyki i rezerwacje zostają bez zmian.
- [ ] Przygotować firmowe konto Google na kopie PDF (Ty) — Jedno konto dla wszystkich tabletów, logowane raz w Opcjach.
- [ ] Wymyślić PIN admina (Ty) — Otwiera podgląd dnia (i np. cennik) na tablecie.
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
- [~] Start: Utwórz listę / Rezerwacje / Archiwum (Claude) — Utwórz listę gotowe; Archiwum i Rezerwacje w budowie.
- [x] Lista dnia: zakładki instruktorów, dodawanie grup (Claude)
- [x] Karta grupy i gracze (Claude)
- [x] Kulki i dym (Claude)
- [x] Inny pakiet / własny sprzęt (Claude)
- [x] Pieniądze: kwota, zadatek, płatność (Claude)
- [x] Faktura i dodatki (Claude)
- [x] Koniec dnia: godziny, pensje, wydatki (Claude) — ekran Wydatki: wydatki, pensje (pracownicy ze Statystyk, zaokrąglenie do 10 zł), podsumowanie, „📤 Wyślij statystyki”.
- [ ] Archiwum list (z hasłem) (Claude)
- [ ] Podgląd rezerwacji (SILT / Arsenał, działa offline) (Claude)
- [~] Kafelek menu: Cennik / Raport / Rezerwacje / Opcje (Claude) — Popup na środku ekranu. — Menu: Cennik i Opcje gotowe; Rezerwacje i Raport PDF w budowie.
- [ ] Zdjęcie kartki z graczami → odczyt (OCR / Claude) (Claude)
- [x] Praca bez zasięgu + wysyłka w tle, znacznik „⏳ Niewysłane” (Claude) — src/sync/.

## 3. Nowe funkcje v1
- [ ] Ustalić wygląd raportu PDF (co jest na wydruku) (Razem)
- [ ] PDF dnia generowany na tablecie (bez internetu) (Claude)
- [ ] Foldery miesięczne na tablecie (Claude) — Wybór miejsca przy 1. uruchomieniu, np. Dokumenty/SILT Lista/2026-09 Wrzesień/2026-09-30 Lista.pdf. Pliki przetrwają odinstalowanie.
- [ ] Automatyczne tworzenie PDF ok. 3:00 w nocy (Claude) — Plus dorabianie brakujących PDF-ów przy każdym uruchomieniu.
- [ ] Wbudowana wysyłka PDF na Google Drive (konto firmowe) (Claude) — Ta sama struktura folderów. Bez zasięgu czeka w kolejce. Kopie NIE idą na serwer.
- [ ] Kosz: skasowana grupa do przywrócenia przez 7 dni (Claude)
- [ ] Przywracanie danych na nowym tablecie (Claude)
- [ ] Zgłaszanie błędów (raport, gdy aplikacja się wysypie) (Claude)
- [ ] Blokada starej wersji w aplikacji (Claude)
- [ ] Aktualizacje „w powietrzu” (bez nowej instalacji) (Claude)
- [ ] PIN admina + podgląd dnia (przychód, gracze, kulki, dym) (Claude)

## 4. Panel www
- [ ] Panel w przeglądarce do przeglądania list (Claude) — Logowanie tak jak w Statystykach.

## 5. Testy i wdrożenie
- [ ] Pierwszy APK — test na tablecie obok PWA v19 (Razem)
- [ ] Test bez zasięgu, restart, rozładowanie baterii (Ty)
- [ ] Test wysyłki do Statystyk (nie dubluje) i SMS faktur (Razem)
- [ ] Test PDF w nocy i wysyłki na Google Drive (Ty)
- [ ] Wydanie w teście wewnętrznym + dodanie kont Google tabletów (Razem)
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
- Następny krok: Archiwum list (z hasłem), podgląd rezerwacji (offline), potem Raport PDF.
