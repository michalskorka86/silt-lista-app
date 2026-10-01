# Buduje instrukcję (HTML) ze zrzutów i znaczników; PDF robi potem Chromium (druk.mjs).
import json, html, os

KAT = os.path.dirname(os.path.abspath(__file__))
Z = json.load(open(os.path.join(KAT, 'img', 'znaczniki.json')))

def e(s):
    return html.escape(s, quote=False)

def rys(nazwa, podpis=None, szer=100):
    pts = ''.join(f'<span class="m" style="left:{max(m["x"], 3.5)}%;top:{m["y"]}%">{m["nr"]}</span>' for m in Z.get(nazwa, []))
    pod = f'<figcaption>{podpis}</figcaption>' if podpis else ''
    return f'<figure style="width:{szer}%"><div class="ekran"><img src="img/{nazwa}.png">{pts}</div>{pod}</figure>'

def lista(*punkty):
    return '<ol class="kroki">' + ''.join(f'<li><span class="nr">{i}</span><div>{p}</div></li>' for i, p in enumerate(punkty, 1)) + '</ol>'

def ramka(ikona, tytul, tresc, rodzaj=''):
    return f'<div class="ramka {rodzaj}"><div class="rt">{ikona} {tytul}</div><div>{tresc}</div></div>'

def b(t):  # przycisk / napis z ekranu
    return f'<b class="p">{t}</b>'

rozdzialy = []
def rozdzial(tytul, *tresc):
    rozdzialy.append((tytul, ''.join(tresc)))

# ───────────────────────── treść ─────────────────────────

rozdzial('5 złotych zasad',
    '<p class="lead">Jak zapamiętasz tylko tę stronę — i tak dasz radę.</p>',
    ramka('💾', 'Nie ma przycisku „Zapisz listę”.', 'Wszystko zapisuje się samo, od razu, w tablecie. Wpisałeś — jest zapisane. Nawet jak tablet się rozładuje.'),
    ramka('📴', 'Brak zasięgu to nie problem.', 'Aplikacja działa bez internetu. Jak tablet złapie zasięg, sam wyśle dane do biura.'),
    ramka('🟨', 'Żółte „⏳ Niewysłane” u góry = spokojnie.', 'To tylko znaczy „czekam na internet”. Dane są w tablecie. Nie rób nic dziwnego.'),
    ramka('🗑', 'Skasowałeś coś przez przypadek? Jest kosz.', f'Skasowaną grupę, gracza, wydatek czy pensję przywrócisz przez 7 dni: {b("☰ Menu → 🗑️ Kosz → ↩ Przywróć")}. Całe listy kasuje tylko szef (PIN).'),
    ramka('🚫', 'Nie odinstalowuj aplikacji i nie czyść jej danych.', 'Póki świeci „⏳ Niewysłane”, w tablecie są listy, które jeszcze nie poszły do biura. Jak coś „się zawiesiło” — rozdział 18 albo telefon do szefa.', 'czerwona'),
    ramka('👆', 'Jedna prosta rzecz', f'Prawie wszystko w aplikacji jest „klikalne”. Chcesz coś zmienić? Dotknij tego. Otworzy się okienko. W okienku zawsze jest {b("Anuluj")} — nic się nie stanie.', 'pomaranczowa'),
)

rozdzial('Otwieranie aplikacji',
    '<p>Na ekranie tabletu jest pomarańczowa ikonka <b>SILT Lista</b>. Dotknij jej.</p>',
    '<div class="dwa">', rys('01-logowanie', '🔒 Tylko za pierwszym razem na danym tablecie'), rys('02-start', 'Ekran startowy'), '</div>',
    lista(
        f'<b>Hasło</b> — tylko przy pierwszym uruchomieniu na tablecie. Wpisz hasło od szefa i dotknij {b("Zaloguj")}. Potem tablet pamięta.',
        f'{b("➕ Utwórz listę")} — tym zaczynasz każdy dzień pracy (rozdział 3).',
        f'{b("📅 Rezerwacje")} — kto dziś i w kolejne dni przyjeżdża (rozdział 14).',
    ),
    ramka('📥', 'Na ekranie startowym pojawiło się „Jest nowa wersja aplikacji”?', 'Powiedz szefowi. Zwykłe poprawki aplikacja instaluje sama — ten napis pojawia się rzadko, gdy trzeba pobrać nową wersję z internetu.'),
    f'<p class="mala">{b("📁 Archiwum")} (stare listy) otwiera się po PIN-ie szefa — zwykle nie jest Ci potrzebne.</p>',
)

rozdzial('Zaczynamy dzień',
    f'<p>Na ekranie startowym dotknij {b("➕ Utwórz listę")}.</p>',
    '<div class="dwa">', rys('03-nowa-lista'), rys('04-lista', 'Twoja lista'), '</div>',
    '<div class="dwa tekst"><div>',
    '<p class="pod">Utwórz listę</p>',
    lista('<b>Data</b> — sama wstawia się dzisiejsza. Nie ruszaj.', '<b>Twoje imię</b> — wpisz, jak masz na imię.', f'Dotknij {b("Utwórz listę →")}.'),
    '</div><div><p class="pod">Lista dnia</p>',
    lista('<b>Twoja zakładka</b>. Liczba obok = ile masz grup.', f'{b("＋ 👷")} — dodaj drugiego instruktora na tym tablecie.', f'{b("＋ Dodaj grupę")} — gdy przyjeżdża nowa grupa.'),
    '</div></div>',
    ramka('✅', 'Otworzyłeś aplikację drugi raz tego samego dnia?', f'Zrób dokładnie to samo: {b("Utwórz listę")} z dzisiejszą datą. Otworzy się lista, którą już zacząłeś — nic nie zniknie i nic się nie zdubluje.'),
    ramka('👥', 'Dwóch instruktorów na jednym tablecie?', 'Każdy ma swoją zakładkę u góry. Grupy dodajesz zawsze w swojej zakładce.'),
)

rozdzial('Dodajemy grupę',
    f'<p>Dotknij {b("＋ Dodaj grupę")}. Nowa grupa pojawia się zawsze na górze listy.</p>',
    '<div class="dwa">', rys('05-grupa1', 'Krok 1: kto i co'), rys('06-grupa2', 'Krok 2: pakiet'), '</div>',
    '<div class="dwa tekst"><div>',
    lista('Imię organizatora (osoby, która rezerwowała).', 'Dotknij kolorowego kafelka z atrakcją.', f'{b("Dalej →")}'),
    '</div><div>',
    lista('Dotknij pakietu, który wzięła grupa.', f'{b("Dodaj grupę ✓")}'),
    '</div></div>',
    ramka('💡', 'Organizator wpisze się sam', 'jako pierwszy gracz, z dopiskiem „org.”.'),
)

rozdzial('Karta grupy — co gdzie jest',
    '<p>Każda grupa to taka „karta”. Kolor paska z lewej = kolor atrakcji.</p>',
    rys('09-karta'),
    lista(
        '<b>Imię gracza</b> — dotknij, żeby poprawić imię albo zmienić mu pakiet / dać własny sprzęt (rozdział 8).',
        '<b>Pole obok imienia</b> — dotknij, żeby dopisać kulki albo dym (rozdział 7).',
        f'{b("👤＋ Dodaj gracza")} — kolejna osoba z grupy (rozdział 6).',
        f'{b("📷 Gracze ze zdjęcia kartki")} — tablet sam przepisze papierową listę (rozdział 11).',
        f'{b("✕")} — usuwa gracza (zapyta, czy na pewno; wróci z kosza).',
        f'<b>Osób</b> — ile osób naprawdę gra.',
    ),
    ramka('👥', 'Ważne: liczba osób', 'Kwota liczy się od liczby osób. Nie musisz wpisywać imion wszystkich graczy — dotknij liczby przy „Osób” i wpisz, ile osób gra.', 'pomaranczowa'),
)

rozdzial('Dodawanie graczy',
    f'<p>Dotknij {b("👤＋ Dodaj gracza")}. Otworzy się okienko:</p>',
    rys('07-gracz', szer=80),
    lista(
        'Wpisz imię. 🎤 Możesz też dotknąć mikrofonu na klawiaturze tabletu i powiedzieć imię.',
        f'{b("Zapisz i następny")} — zapisuje i od razu czyści pole na kolejną osobę. Najszybciej, jak dopisujesz całą grupę.',
        f'{b("Zapisz ✓")} — zapisuje i zamyka okienko.',
    ),
    ramka('💡', 'Nie wiesz, jak kto ma na imię?', 'Nie szkodzi. Wpisz np. „Czerwona bluza” albo „Gracz 5”. Ważne, żeby kulki były przy właściwej osobie.'),
)

rozdzial('Kulki i dym',
    '<p>Gracz bierze kulki → dotknij pola obok jego imienia. Otworzy się okienko:</p>',
    rys('08-kulki', szer=80),
    lista(
        f'{b("🎯 Z pakietu")} — kulki, które gracz ma w cenie pakietu.',
        f'{b("➕ Dokupione")} — kulki, za które gracz dopłaca. Aplikacja sama przełącza się tu, gdy pakiet się skończy.',
        'Dotknij, ile wydałeś (100, 200, 500…).',
        f'{b("✏️ Inna ilość")} — gdy liczba jest inna.',
        f'{b("💨 DYM")} — świeca dymna. Wpisz ile sztuk, cena podpowie się sama.',
    ),
    ramka('📏', 'Jak to potem wygląda', 'Czerwona kreska oddziela kulki z pakietu (przed kreską) od dokupionych (za kreską) — tak samo jak na papierowej liście.'),
    ramka('✋', 'Pomyłka?', f'Dotknij źle wpisanych kulek (np. {b("🎯 200")}) → aplikacja zapyta „Usunąć?” → {b("Usuń")}. Potem dopisz dobre.'),
)

rozdzial('Gracz z innym pakietem albo z własnym sprzętem',
    '<p>Czasem w grupie ktoś ma inny pakiet albo przyjechał ze swoim sprzętem. Dotknij <b>imienia</b> tego gracza:</p>',
    '<div class="dwa">', rys('10-gracz-pakiet', 'Pakiet gracza'), rys('11-sprzet', 'Własny sprzęt'), '</div>',
    '<div class="dwa tekst"><div>',
    lista('<b>Pakiet gracza</b> — zaznaczony jest pakiet całej grupy (napis GŁÓWNY). Dotknij innego, jeśli ten gracz wziął inny.', f'{b("🎒 Własny sprzęt")} — jeśli gracz ma swój sprzęt.'),
    '</div><div>',
    lista('Dotknij, co gracz bierze (np. Własny 40 zł, Mundur). Zaznaczone ma ✓.', f'{b("✏️ zmień cenę")} — gdy umówiliście inną cenę.', f'<b>Worek kulek</b> — {b("＋")} / {b("−")} ile worków kupił.'),
    '</div></div>',
    ramka('🧠', 'Zapamiętaj', 'Gracz z własnym sprzętem nie płaci pakietu. Płaci tylko za to, co zaznaczysz, i za swoje worki kulek (mają inną cenę niż zwykłe dokupione kulki).'),
)

rozdzial('Pieniądze: kwota, zadatek, płatność',
    '<p>Kwotę liczy aplikacja sama — z pakietu, dokupionych kulek, dymu, sprzętu i dodatków. Ty tylko sprawdzasz.</p>',
    rys('12-pieniadze'),
    lista(
        f'{b("＋ Dodaj dodatek")} — ognisko, catering, grill itp. (rozdział 10).',
        '<b>Podstawa</b> — cena pakietu. Zmieniasz tylko, jak szef ustalił z grupą inną cenę.',
        '<b>Kwota</b> — ile płaci grupa. Pod spodem jest rozpisane, z czego się wzięła. Możesz ją zmienić ręcznie (np. rabat), ale tylko jeśli tak ustalono — pojawi się „✋ ręcznie”.',
        '<b>Zadatek</b> — ile grupa wpłaciła wcześniej (zwykle 100 zł). „Do zapłaty” policzy się samo.',
        '<b>Płatność</b> — dotknij i wybierz: 💵 Gotówka / 💳 Karta / 🏦 Przelew.',
        '<b>Faktura</b> — tylko jeśli grupa chce fakturę (rozdział 10).',
    ),
    ramka('✅', 'Zanim grupa odjedzie', 'Sprawdź Kwotę, Zadatek i wybierz Płatność. To wszystko.', 'pomaranczowa'),
)

rozdzial('Faktura i dodatki',
    '<div class="dwa">', rys('13-faktura', '🧾 Faktura'), rys('14-dodatek', '🎁 Dodatki'), '</div>',
    '<div class="dwa tekst"><div>',
    f'<p>Dotknij <b>Faktura</b> na karcie grupy i wpisz:</p>',
    lista('<b>NIP</b> — przepisz dokładnie, cyfra po cyfrze.', '<b>Telefon</b> klienta.', '<b>E-mail</b> klienta.', '<b>Forma płatności</b> na fakturze.', f'{b("Zapisz ✓")}'),
    '<p class="mala">Rano dane same pójdą SMS-em do biura. Nic więcej nie robisz.</p>',
    '</div><div>',
    f'<p>Dotknij {b("＋ Dodaj dodatek")}, wybierz kafelek, wpisz cenę → {b("Dodaj ✓")}.</p>',
    lista('Kafelki z najczęstszymi dodatkami (np. Ognisko).', f'{b("⭐ Inne")} — wpisujesz nazwę sam.', f'{b("⋯ Więcej")} — pozostałe dodatki z cennika.'),
    '<p class="mala">Dodatek za darmo? Zostaw cenę pustą — zapisze się jako „gratis”. Pomyłka? Dotknij dodatku na karcie → Usuń → dodaj jeszcze raz.</p>',
    '</div></div>',
)

rozdzial('Gracze ze zdjęcia kartki',
    f'<p>Masz papierową kartkę z imionami i kulkami? Dotknij {b("📷 Gracze ze zdjęcia kartki")} na karcie grupy.</p>',
    '<div class="dwa">', rys('15-kartka', 'Skąd zdjęcie'), rys('16-kartka-tabela', 'Sprawdź, co tablet przepisał'), '</div>',
    '<div class="dwa tekst"><div>',
    lista(f'{b("📷 Zrób zdjęcie")} — aparat tabletu. Kartka płasko, cała w kadrze, bez cienia.', f'{b("🖼️ Wybierz z galerii")} — gdy zdjęcie już jest w tablecie.'),
    '</div><div>',
    lista('<b>Imię</b>', '<b>Kulki z pakietu</b> — np. „100 100”.', '<b>Dokupione</b> — liczby po kresce, np. „500”.', '<b>Dym</b> — ile świec.', f'{b("Dodaj graczy ✓")} — dopisuje wszystkich do grupy.'),
    '</div></div>',
    ramka('👀', 'Zawsze sprawdź tabelę', f'Tablet czyta pismo odręczne — może się pomylić. Popraw pola przed {b("Dodaj graczy ✓")}. Pusty wiersz bez imienia jest pomijany, {b("✕")} usuwa wiersz, {b("＋ Dodaj wiersz")} dodaje.', 'pomaranczowa'),
    ramka('📴', 'Bez zasięgu?', 'Odczyt zdjęcia potrzebuje internetu. Bez zasięgu pokaże się pusta tabela — możesz wpisać graczy w niej ręcznie albo zrobić zdjęcie później.'),
)

rozdzial('Koniec dnia',
    f'<p>Na dole ekranu dotknij {b("📝 Wydatki")}.</p>',
    '<div class="dwa">', rys('18-wydatki', 'Wydatki i pensje'), rys('17-pensja', 'Twoja pensja'), '</div>',
    lista(
        f'{b("＋ Dodaj wydatek")} — np. paliwo, zakupy. Wpisz, za co, ile, a w Uwagach np. „paragon u Janka”.',
        f'{b("＋ Dodaj instruktora")} — wybierz swoje imię z listy i wpisz, ile godzin pracowałeś. Resztę aplikacja policzy sama.',
        f'{b("📤 Wyślij statystyki do bazy")} — dotknij na sam koniec.',
    ),
    ramka('😌', 'Zapomniałeś wysłać albo nie ma zasięgu?', 'Nic się nie stało. Jak tablet złapie internet, lista pójdzie sama, a rano statystyki wyślą się same.'),
)

rozdzial('Raport PDF i menu',
    '<div class="dwa">', rys('19-menu', '☰ Menu (na dole ekranu)'), rys('20-raport', 'Raport dnia'), '</div>',
    '<div class="dwa tekst"><div>',
    '<p class="pod">☰ Menu</p>',
    lista(f'{b("💰 Cennik")} — aktualne ceny.', f'{b("🖨️ Raport PDF")} — raport dnia (obok).', f'{b("📅 Rezerwacje")} (rozdział 14).', f'{b("🗑️ Kosz")} (rozdział 16).', f'{b("⚙️ Opcje")} (rozdział 17).'),
    '</div><div>',
    '<p class="pod">Raport PDF (jak szef poprosi)</p>',
    lista(f'{b("🖨️ Drukuj")} — drukarka albo „Zapisz jako PDF”.', f'{b("📤 Zapisz / wyślij PDF")} — wyślesz plik mailem, WhatsAppem albo zapiszesz na Dysku.'),
    '<p class="mala">PDF z każdego dnia tablet robi też sam w nocy — nie musisz o tym pamiętać.</p>',
    '</div></div>',
)

rozdzial('Rezerwacje — kto przyjeżdża',
    f'<p>Ekran startowy → {b("📅 Rezerwacje")} (albo ☰ Menu → Rezerwacje). Tu tylko patrzysz — niczego nie zmienisz ani nie skasujesz.</p>',
    '<div class="dwa">', rys('21-rezerwacje'), rys('22-rezerwacja', 'Szczegóły rezerwacji'), '</div>',
    '<div class="dwa tekst"><div>',
    lista(f'Na górze wybierasz: {b("Wszystkie")} / {b("SILT")} / {b("Arsenał")}.', 'Dotknij dnia w kalendarzu, z prawej pokażą się rezerwacje. Dotknij rezerwacji — otworzą się szczegóły.', f'{b("Dziś")} wraca do dzisiejszego dnia, {b("🔄")} odświeża.'),
    '</div><div>',
    lista('<b>⚙️ Dla instruktora</b> — przeczytaj przed przyjazdem grupy!', f'{b("‹ Poprzednia")} / {b("Następna ›")} — kolejne rezerwacje tego dnia.'),
    '</div></div>',
    ramka('📴', 'Napis „Brak zasięgu — pokazuję stan z …”', 'Widzisz rezerwacje z ostatniego razu, gdy był internet. Ktoś mógł w międzyczasie coś zmienić.'),
)

rozdzial('Bez zasięgu',
    '<p>Na poligonie zasięg jest słaby. Aplikacja jest do tego przygotowana — wszystko zapisuje się w tablecie.</p>',
    ramka('✈️', 'Na polu możesz włączyć tryb samolotowy', 'Tablet wtedy nie szuka zasięgu i bateria wytrzyma cały dzień. Aplikacja działa normalnie.'),
    ramka('📶', 'Po pracy wyłącz tryb samolotowy', 'Jak tablet złapie Wi-Fi albo zasięg (magazyn, auto, dom), sam wyśle wszystko, co czeka. Wystarczy, że otworzysz aplikację.'),
    '<h3>Co znaczą kropki i napisy u góry ekranu</h3>',
    '<table class="tab"><tr><td class="ik"><span class="kr g"></span><span class="kr g"></span></td><td>Dwie zielone — wszystko zapisane i wysłane do biura. 👍</td></tr>'
    '<tr><td class="ik"><span class="kr g"></span><span class="kr r"></span></td><td>Zielona + czerwona — brak internetu. Dane są w tablecie, wyślą się później. Normalne na polu.</td></tr>'
    '<tr><td class="ik"><span class="kr g"></span><span class="kr o"></span></td><td>Pomarańczowa — właśnie wysyła. Poczekaj chwilę.</td></tr>'
    '<tr><td class="ik"><span class="pill">⏳ Niewysłane</span></td><td>Coś czeka na internet. Dotknij napisu — możesz spróbować <b>Wyślij teraz</b>.</td></tr>'
    '<tr><td class="ik"><span class="pill cz">⚠ Zaktualizuj</span></td><td>Powiedz szefowi — trzeba zainstalować nową wersję. Dane czekają bezpiecznie w tablecie.</td></tr></table>',
    ramka('❗', 'Dopóki świeci „⏳ Niewysłane”', 'Nie odinstalowuj aplikacji i nie czyść jej danych w ustawieniach tabletu.', 'czerwona'),
)

rozdzial('Kosz — cofnij skasowanie',
    f'<p>Skasowałeś grupę, gracza, wydatek albo pensję przez przypadek? {b("☰ Menu → 🗑️ Kosz")}.</p>',
    '<div class="dwa">', rys('23-kosz', 'Kosz'), rys('25-pin', 'Usuwanie listy — tylko szef'), '</div>',
    '<div class="dwa tekst"><div>',
    lista(f'{b("↩ Przywróć")} — wszystko wraca tak, jak było (grupa z graczami i kulkami, kwota się przeliczy).'),
    '<p class="mala">W koszu jest to, co skasowano w ostatnich 7 dniach. Starsze rzeczy znikają na dobre.</p>',
    '</div><div>',
    lista('<b>🔒 PIN admina</b> — usuwanie listy instruktora albo całego dnia i Archiwum wymagają 4-cyfrowego PIN-u szefa.', f'{b("Anuluj")} — gdy nie znasz PIN-u, po prostu zamknij.'),
    '</div></div>',
)

rozdzial('Opcje i zgłaszanie problemu',
    f'<p>{b("☰ Menu → ⚙️ Opcje")}</p>',
    rys('24-opcje', szer=80),
    lista(
        f'<b>Wymuś synchronizację</b> {b("🔄")} — wysyła i pobiera dane od razu (gdy jest zasięg).',
        '<b>Niewysłane zmiany</b> — ile rzeczy czeka na internet.',
        f'<b>Coś nie działa?</b> {b("📨")} — opisz problem własnymi słowami. Trafi do szefa razem z informacją, na jakim ekranie byłeś.',
        f'<b>Wersja aplikacji</b> {b("⬇️")} — sprawdza i od razu instaluje poprawki.',
    ),
    ramka('😕', 'Ekran „Coś poszło nie tak”', f'Gdy aplikacja się wysypie, zobaczysz ten napis i duży przycisk {b("🔄 Spróbuj ponownie")}. Dotknij go. Dane są bezpieczne, a opis błędu sam trafi do szefa.'),
    ramka('🔒', '„Wyloguj ten tablet” w Opcjach', 'Nie używaj, chyba że szef każe. Po wylogowaniu trzeba znowu wpisać hasło.', 'czerwona'),
)

rozdzial('Co zrobić, gdy…',
    '<dl class="faq">'
    '<dt>…wpisałem złe kulki / zły dym?</dt><dd>Dotknij ich przy graczu → Usuń → wpisz dobre.</dd>'
    '<dt>…wpisałem gracza do złej grupy?</dt><dd>Usuń go ✕ i dodaj w dobrej grupie. Jego kulki też przepisz.</dd>'
    '<dt>…grupa ma więcej osób, niż wpisałem imion?</dt><dd>Dotknij liczby Osób na karcie i wpisz prawdziwą liczbę. Kwota się przeliczy.</dd>'
    '<dt>…kwota się nie zgadza z tym, co ustalił szef?</dt><dd>Sprawdź pakiet (Podstawa) i liczbę osób. Jak dalej się nie zgadza — dotknij Kwota i wpisz ustaloną. Pod spodem zobaczysz „✋ ręcznie”.</dd>'
    '<dt>…skasowałem grupę albo gracza przez przypadek?</dt><dd>☰ Menu → 🗑️ Kosz → ↩ Przywróć. Masz na to 7 dni.</dd>'
    '<dt>…aplikacja „stoi”, nic nie reaguje?</dt><dd>Zamknij ją (przesuń z listy ostatnich aplikacji) i otwórz z ikonki. Potem Utwórz listę z dzisiejszą datą — wszystko będzie na miejscu.</dd>'
    '<dt>…pokazało się „Coś poszło nie tak”?</dt><dd>Dotknij 🔄 Spróbuj ponownie. Jak wraca — zamknij i otwórz aplikację. Błąd sam trafił do szefa.</dd>'
    '<dt>…aplikacja pyta o hasło?</dt><dd>Wpisz hasło od szefa i dotknij Zaloguj. Dane zostają w tablecie.</dd>'
    '<dt>…tablet się rozładował?</dt><dd>Naładuj i otwórz aplikację. Wszystko, co było wpisane, zostało zapisane.</dd>'
    '<dt>…coś działa dziwnie, ale nie wiem co?</dt><dd>☰ Menu → ⚙️ Opcje → Coś nie działa? 📨 — opisz to. Szef dostanie opis.</dd>'
    '<dt>…nie wiem, czy coś dotknąć?</dt><dd>Każde okienko ma Anuluj. Kasowanie zawsze pyta „czy na pewno”. Jak dalej nie wiesz — zadzwoń do szefa, zanim klikniesz.</dd>'
    '</dl>',
)

rozdzial('Ściąga — wydrukuj i przyklej do skrzynki 😉',
    '<div class="sciaga">'
    '<div><h4>☀️ Rano</h4><ul><li>Otwórz SILT Lista z ikonki.</li><li>📅 Rezerwacje → kto dziś jedzie, są instrukcje?</li><li>➕ Utwórz listę → dzisiejsza data → Twoje imię.</li><li>Na polu: tryb samolotowy OK.</li></ul></div>'
    '<div><h4>👥 Gdy przyjeżdża grupa</h4><ul><li>＋ Dodaj grupę → organizator → atrakcja → pakiet.</li><li>Wpisz liczbę osób.</li><li>Dodaj graczy (albo 📷 zdjęcie kartki).</li><li>Inny pakiet / własny sprzęt? → dotknij imienia.</li></ul></div>'
    '<div><h4>🎯 W trakcie</h4><ul><li>Kulki: dotknij pola obok imienia → Z pakietu albo Dokupione.</li><li>Dym: to samo okienko → 💨 DYM.</li><li>Ognisko, catering: ＋ Dodaj dodatek.</li></ul></div>'
    '<div><h4>💰 Gdy grupa się rozlicza</h4><ul><li>Sprawdź Kwotę i Zadatek.</li><li>Wybierz Płatność.</li><li>Chcą fakturę? → Faktura → NIP, telefon, e-mail.</li></ul></div>'
    '<div><h4>🌙 Koniec dnia</h4><ul><li>📝 Wydatki → dopisz wydatki.</li><li>＋ Dodaj instruktora → Ty → ile godzin.</li><li>📤 Wyślij statystyki do bazy.</li><li>Wyłącz tryb samolotowy, gdy będziesz w zasięgu.</li></ul></div>'
    '<div><h4>↩ Pomyłka</h4><ul><li>Skasowane → ☰ Menu → 🗑️ Kosz → Przywróć.</li><li>Coś nie działa → ⚙️ Opcje → 📨 Coś nie działa?</li></ul></div>'
    '</div>',
    ramka('🚫', 'Nigdy', 'Nie odinstalowuj aplikacji, nie czyść jej danych i nie kasuj grup „na próbę”.', 'czerwona'),
)

dla_szefa = (
    '<h2 class="szef">Dodatek — dla szefa</h2>'
    '<table class="tab szef">'
    '<tr><th>Nowy tablet</th><td>Na tablecie w przeglądarce otwórz <b>filedops.pl/lista-api/apk.php</b> → pobierz → zainstaluj (Android raz zapyta o zgodę na instalację z przeglądarki). Otwórz aplikację, wpisz hasło tabletów — wszystkie listy pobiorą się z serwera.</td></tr>'
    '<tr><th>Folder na PDF</th><td>Przy pierwszym uruchomieniu aplikacja pyta o folder (najlepiej „SILT Lista” w Dokumentach). PDF z każdego dnia robi się sam w nocy, w podfolderach miesięcy. Zmiana: ☰ Menu → ⚙️ Opcje → Folder na raporty PDF.</td></tr>'
    '<tr><th>PIN admina</th><td>4 cyfry w <b>lista-api/config.php</b> (PIN_ADMINA). Otwiera Archiwum i potwierdza usuwanie list. Zmiana PIN-u dochodzi do tabletów przy najbliższej synchronizacji.</td></tr>'
    '<tr><th>Aktualizacje</th><td>Poprawki: GitHub → Actions → „Wyślij aktualizację” — tablety pobiorą same. Nowy APK (rzadko): „Buduj APK (szybko)” — na tabletach pojawi się „📥 Jest nowa wersja aplikacji”.</td></tr>'
    '<tr><th>Panel www</th><td><b>filedops.pl/lista-api/panel.php</b> — listy z każdego miesiąca, raporty dni, druk całego miesiąca, ZIP miesiąca. Kopia miesiąca przychodzi też mailem od 3. dnia miesiąca.</td></tr>'
    '<tr><th>Zgłoszenia</th><td><b>filedops.pl/lista-api/bledy.php?key=…</b> (klucz crona) — awarie aplikacji i „📨 Coś nie działa?” od instruktorów.</td></tr>'
    '</table>'
)

# ───────────────────────── strona ─────────────────────────
spis = ''.join(f'<li><span>{i}</span>{e(t)}</li>' for i, (t, _) in enumerate(rozdzialy, 1))
tresc = ''.join(f'<section><div class="naglowek"><span class="rnr">ROZDZIAŁ {i}</span><h2>{e(t)}</h2></div>{c}</section>' for i, (t, c) in enumerate(rozdzialy, 1))

CSS = open(os.path.join(KAT, 'styl.css')).read()
out = f'''<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>SILT Lista — instrukcja dla instruktora</title>
<style>{CSS}</style></head><body>
<section class="okladka">
  <div class="logo">SILT</div>
  <h1>Lista na tablecie</h1>
  <p class="podt">— instrukcja dla instruktora</p>
  <p class="wstep">Przeczytaj raz od początku do końca. Zajmie Ci 15 minut.<br>Potem trzymaj pod ręką — jak czegoś zapomnisz, zajrzyj.<br>Nic nie zepsujesz, jeśli czytasz, co jest napisane na ekranie 🙂</p>
  <ol class="spis">{spis}</ol>
  <p class="wersja">Wersja dla aplikacji SILT Lista (Android) · październik 2026</p>
</section>
{tresc}
<section>{dla_szefa}</section>
</body></html>'''
open(os.path.join(KAT, 'instrukcja.html'), 'w').write(out)
print(len(rozdzialy), 'rozdziałów')
