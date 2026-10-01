import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = process.argv[2];
const W = 1280, H = 800;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5 });
const p = await ctx.newPage();
const bledy = []; p.on('pageerror', (e) => bledy.push(e.message));
const znaczniki = fs.existsSync(`${OUT}/znaczniki.json`) ? JSON.parse(fs.readFileSync(`${OUT}/znaczniki.json`, 'utf8')) : {};
const T = (t, exact = true) => (t instanceof RegExp ? p.getByText(t) : p.getByText(t, { exact })).last();
const klik = async (t, ms = 400, exact = true) => { await T(t, exact).click(); await p.waitForTimeout(ms); };
/** zrzut + numerki: cele = [[nr, locator, 'l'|'c'|'r']] — punkt przy lewej krawędzi / środku / prawej */
async function zrzut(nazwa, cele = []) {
  await p.waitForTimeout(2300);
  const pts = [];
  for (const [nr, loc, gdzie = 'l'] of cele) {
    const bb = await loc.boundingBox({ timeout: 3000 }).catch(() => null);
    if (!bb) { console.log('brak', nazwa, nr); continue; }
    const x = gdzie === 'c' ? bb.x + bb.width / 2 : gdzie === 'r' ? bb.x + bb.width : bb.x;
    pts.push({ nr, x: +(x / W * 100).toFixed(2), y: +((bb.y + bb.height / 2) / H * 100).toFixed(2) });
  }
  znaczniki[nazwa] = pts;
  await p.screenshot({ path: `${OUT}/${nazwa}.png` });
  fs.writeFileSync(`${OUT}/znaczniki.json`, JSON.stringify(znaczniki, null, 1));
}
const ETAP = process.argv[4] ?? 'wszystko';

await p.goto('http://127.0.0.1:8770/');
await p.getByPlaceholder('Hasło').waitFor({ timeout: 30000 });
await zrzut('01-logowanie', [[1, p.getByPlaceholder('Hasło')], [2, T('Zaloguj')]]);
await p.getByPlaceholder('Hasło').fill('test123');
await klik('Zaloguj', 4000);
await zrzut('02-start', [[1, T('Utwórz listę')], [2, T('Rezerwacje')], [3, T('Archiwum')]]);

await klik('Utwórz listę');
await p.getByPlaceholder('np. Janek').fill('Janek');
await zrzut('03-nowa-lista', [[1, T('Data')], [2, p.getByPlaceholder('np. Janek')], [3, T('Utwórz listę →')]]);
await klik('Utwórz listę →', 1500);
await zrzut('04-lista', [[1, p.getByText('Janek', { exact: true }).first(), 'c'], [2, T('＋ 👷', false).first()], [3, T('＋ Dodaj grupę')]]);

await klik('＋ Dodaj grupę');
await p.getByPlaceholder('np. Alex').fill('Kowalski');
await zrzut('05-grupa1', [[1, p.getByPlaceholder('np. Alex')], [2, T('PAINTBALL KLASYCZNY 0,68 cal')], [3, T('Dalej →')]]);
await klik('PAINTBALL KLASYCZNY 0,68 cal'); await klik('Dalej →');
await zrzut('06-grupa2', [[1, T('Pakiet SILT')], [2, T('Dodaj grupę ✓')]]);
await klik('Pakiet SILT'); await klik('Dodaj grupę ✓', 800);

await klik('👤＋ Dodaj gracza');
await p.getByPlaceholder('np. Bartek').fill('Bartek');
await zrzut('07-gracz', [[1, p.getByPlaceholder('np. Bartek')], [2, T('Zapisz i następny')], [3, T('Zapisz ✓')]]);
await klik('Zapisz i następny', 500);
await p.getByPlaceholder('np. Bartek').fill('Ola');
await klik('Zapisz i następny', 500);
await p.getByPlaceholder('np. Bartek').fill('Kuba');
await klik('Zapisz ✓', 600);

const pusty = (n) => p.getByText('＋ dotknij, aby dodać kulki / dym').nth(n);
await pusty(0).click(); await p.waitForTimeout(400);   // Kowalski
await zrzut('08-kulki', [[1, T('🎯 Z pakietu')], [2, T('➕ Dokupione')], [3, T('500')], [4, T(/^inna ilość$/i)], [5, T(/DYM$/)]]);
await klik('500', 600);
await pusty(0).click(); await p.waitForTimeout(400);   // Bartek
await klik('500', 600);
await p.getByText('🎯 500').nth(1).waitFor();
// Bartek: dokupione — dotknij jego chipów
const wierszBartka = p.locator('text=Bartek').first();
await p.getByText('🎯 500').nth(1).click({ position: { x: 200, y: 10 }, force: true }).catch(() => {});
await p.waitForTimeout(400);
await klik('200', 600);   // Bartek dokupione 200
await pusty(0).click(); await p.waitForTimeout(400);   // Ola
await T(/DYM$/).click(); await p.waitForTimeout(400);
await zrzut('x-dym', []);
await klik('Zapisz ✓', 600);
await T('Kuba').click(); await p.waitForTimeout(400);
await zrzut('10-gracz-pakiet', [[1, T('Pakiet SILT')], [2, T('Własny sprzęt')]]);
await T('Własny sprzęt').click(); await p.waitForTimeout(400);
await p.getByText('Własny', { exact: true }).first().click(); await p.waitForTimeout(300);
await T('＋').click(); await p.waitForTimeout(300);
await zrzut('11-sprzet', [[1, p.getByText('Własny', { exact: true }).first()], [2, p.getByText('✏️ zmień cenę').first()], [3, T('＋'), 'c']]);
await klik('Zapisz ✓', 500);
await klik('Zapisz ✓', 800);
// zadatek i płatność
await T('ZADATEK').click(); await p.waitForTimeout(400); await klik('OK →', 500);
await T('PŁATNOŚĆ').click(); await p.waitForTimeout(400); await klik('Gotówka', 600);
await p.evaluate(() => window.scrollTo(0, 0));
await T('PAINTBALL KLASYCZNY', false).first().scrollIntoViewIfNeeded();
await p.mouse.wheel(0, -2000); await p.waitForTimeout(300);
await zrzut('09-karta', [[1, T('Bartek')], [2, p.getByText('🎯 500').nth(1)], [3, T('👤＋ Dodaj gracza')], [4, T('📷 Gracze ze zdjęcia kartki')], [5, p.getByLabel('Usuń gracza').nth(1), 'c'], [6, T('Osób:', false).first(), 'r']]);
await T('FAKTURA').scrollIntoViewIfNeeded();
await zrzut('12-pieniadze', [[1, T('＋ Dodaj dodatek')], [2, T('PODSTAWA')], [3, T('KWOTA')], [4, T('ZADATEK')], [5, T('PŁATNOŚĆ')], [6, T('FAKTURA')]]);
await T('FAKTURA').click(); await p.waitForTimeout(400);
await p.getByPlaceholder('000-000-00-00').fill('5251234567');
await p.getByPlaceholder('+48 000 000 000').fill('500 600 700');
await p.getByPlaceholder('kontakt@firma.pl').fill('biuro@firma.pl');
await zrzut('13-faktura', [[1, p.getByPlaceholder('000-000-00-00')], [2, p.getByPlaceholder('+48 000 000 000')], [3, p.getByPlaceholder('kontakt@firma.pl')], [4, T('Gotówka'), 'c'], [5, T('Zapisz ✓')]]);
await klik('Zapisz ✓', 600);
await T('＋ Dodaj dodatek').click(); await p.waitForTimeout(400);
await zrzut('14-dodatek', [[1, T('Ognisko'), 'c'], [2, T('Inne'), 'c'], [3, T('Więcej'), 'c']]);
await klik('Ognisko', 400);
await zrzut('x-dodatek-cena', []);
await p.getByRole('textbox').last().fill('200');
await klik('Dodaj ✓', 600);
// zdjęcie kartki
await T('📷 Gracze ze zdjęcia kartki').click(); await p.waitForTimeout(400);
await zrzut('15-kartka', [[1, T('Zrób zdjęcie'), 'c'], [2, T('Wybierz z galerii'), 'c']]);
const [fc] = await Promise.all([p.waitForEvent('filechooser'), T('Wybierz z galerii').click()]);
await fc.setFiles(process.argv[3]);
await p.getByText('Odczytano', { exact: false }).waitFor({ timeout: 30000 });
await zrzut('16-kartka-tabela', [[1, p.getByPlaceholder('Imię').first()], [2, p.getByPlaceholder('np. 100 100').first()], [3, p.getByPlaceholder('np. 500').first()], [4, p.getByPlaceholder('0', { exact: true }).first()], [5, T('Dodaj graczy ✓')]]);
await klik('Anuluj', 500);
// wydatki
await T('Wydatki').click(); await p.waitForTimeout(1200);
await klik('＋ Dodaj wydatek');
await p.getByPlaceholder('np. Paliwo, woda').fill('Paliwo');
await p.getByRole('textbox').nth(1).fill('150');
await p.getByPlaceholder('np. paragon u Janka').fill('paragon u Janka');
await klik('Zapisz ✓', 500);
await klik('＋ Dodaj instruktora');
await klik('— wybierz —');
await klik('Janek (30 zł/h)');
await p.getByRole('textbox').nth(0).fill('8');
await zrzut('17-pensja', [[1, T('Janek (30 zł/h)')], [2, p.getByRole('textbox').nth(0)]]);
await klik('Dodaj ✓', 600);
await zrzut('18-wydatki', [[1, T('＋ Dodaj wydatek')], [2, T('＋ Dodaj instruktora')], [3, T('📤 Wyślij statystyki do bazy')]]);
// menu
await T('Menu').click(); await p.waitForTimeout(500);
await zrzut('19-menu', [[1, T('Cennik'), 'c'], [2, T('Raport PDF'), 'c'], [3, T('Rezerwacje'), 'c'], [4, T('Kosz'), 'c'], [5, T('Opcje'), 'c']]);
await klik('Raport PDF', 2500);
await zrzut('20-raport', [[1, T('🖨️ Drukuj')], [2, T('📤 Zapisz / wyślij PDF')]]);
await klik('← Wróć', 800);
await T('Menu').click(); await p.waitForTimeout(500);
await klik('Rezerwacje', 2500);
await zrzut('21-rezerwacje', [[1, T('SILT')], [2, T('Jan Kowalski').last()], [3, T('🔄'), 'c']]);
await T('Jan Kowalski').last().click(); await p.waitForTimeout(500);
await zrzut('22-rezerwacja', [[1, T('⚙️ Dla instruktora:', false)], [2, T('Następna ›')]]);
await klik('Zamknij', 400);
await p.goBack(); await p.waitForTimeout(1200);
await p.getByText('Lista', { exact: true }).last().click(); await p.waitForTimeout(1200);
// kosz: usuń Olę
await p.getByLabel('Usuń gracza').nth(2).click(); await p.waitForTimeout(400);
await klik('Usuń', 800);
await T('Menu').click(); await p.waitForTimeout(500);
await klik('Kosz', 1500);
await zrzut('23-kosz', [[1, T('↩ Przywróć')]]);
await p.goBack(); await p.waitForTimeout(1200);
await T('Menu').click(); await p.waitForTimeout(500);
await klik('Opcje', 600);
await zrzut('24-opcje', [[1, T('Wymuś synchronizację')], [2, T('Niewysłane zmiany')], [3, T('Coś nie działa?')], [4, T('Wersja aplikacji')]]);
await klik('Zamknij', 400);
await T('🗑 Usuń całą listę dnia').click(); await p.waitForTimeout(800);
await zrzut('25-pin', [[1, T('🔒 PIN admina')], [2, T('Anuluj')]]);
await klik('Anuluj', 400);
// KONIEC
console.log(bledy.length ? bledy.join('\n') : 'ok');
await b.close();
