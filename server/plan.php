<?php
// ============================================================
// SILT Lista — plan dnia (rozpiska dla instruktorów) do wpisywania z komputera / telefonu.
//   https://filedops.pl/lista-api/plan.php
// Hasło jak do panelu (PANEL_HASLO). Grupy z godzinami, uwagami, ilością osób i zadatkiem + „Do spakowania”.
// Tablety pobierają plan przy synchronizacji; instruktor odhacza tam, która grupa przyszła i co spakował.
// ============================================================

declare(strict_types=1);

require_once __DIR__ . '/lib/wspolne.php';
require_once __DIR__ . '/lib/tabele.php';
require_once __DIR__ . '/lib/raport.php';
require_once __DIR__ . '/lib/panel_sesja.php';
require_once __DIR__ . '/lib/plan.php';

const PLAN_CSS = '
h2 small{color:#a1a1aa;font-weight:600;font-size:15px;margin-left:6px}.inl{display:inline}
input,select,textarea{font:inherit;color:#f4f4f5;background:#27272a;border:1px solid #3f3f46;border-radius:8px;padding:8px 9px;width:100%;box-sizing:border-box}
textarea{resize:vertical}input:focus,select:focus,textarea:focus{outline:none;border-color:#f97316}
.chipy{display:flex;flex-wrap:wrap;gap:6px;padding:0 20px 10px}.chip{padding:6px 10px;border-radius:99px;background:#18181b;border:1px solid #27272a;text-decoration:none;font-size:12px;color:#a1a1aa}
.chip.akt{border-color:#f97316;color:#f97316}
.ok,.blad{margin:0 20px 12px;padding:10px 14px;border-radius:10px;font-weight:600}.ok{background:rgba(34,197,94,.12);color:#22c55e}.blad{background:rgba(239,68,68,.12);color:#ef4444}
.sekcja{margin:0 20px 16px;padding:14px;background:#18181b;border:1px solid #27272a;border-radius:12px}
.sekcja h3{margin:0 0 12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:16px}.razem{color:#a1a1aa;font-weight:600;font-size:13px;flex:1}
.w{display:grid;grid-template-columns:26px 92px minmax(150px,1.2fr) 130px minmax(200px,2fr) 70px 90px auto;gap:8px;align-items:end;padding:8px 8px 8px 10px;margin-bottom:6px;border-radius:10px;background:#1f1f23;border-left:6px solid var(--k)}
.w.usuniety{opacity:.35}.lp{color:#71717a;font-weight:800;align-self:center}
.f{display:flex;flex-direction:column;gap:3px}.f i{font-style:normal;font-size:11px;color:#a1a1aa;font-weight:700}
.akc{display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.st{font-size:12px;font-weight:700;white-space:nowrap}.st.ok{color:#22c55e}.st.nie{color:#ef4444}
.mini{padding:4px 8px;border-radius:7px;background:#27272a;border:1px solid #3f3f46;color:#f4f4f5;cursor:pointer;font-size:12px}
.usun{display:flex;align-items:center;gap:3px;cursor:pointer;font-size:13px;white-space:nowrap}.usun input{width:auto}
.siatka{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:12px}
.f.n{border-left:5px solid var(--k);padding-left:7px}.f.p i .mini{margin-left:4px;padding:1px 6px}
.zapisz{position:sticky;bottom:0;display:flex;align-items:center;gap:14px;padding:12px 20px;background:rgba(15,15,17,.95);border-top:1px solid #27272a}
.btn.duzy{background:#f97316;border-color:#f97316;padding:12px 26px;font-size:16px}.btn.mal{padding:6px 12px;font-size:13px}#niezapisane{color:#f97316;font-weight:700}
.kopiuj{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.kopiuj input{width:auto}.info{margin:0 0 6px;padding:0}
@media(max-width:900px){.w{grid-template-columns:26px 1fr 1fr;grid-template-areas:"lp godz atr" "org org org" "uw uw uw" "os os zad" "akc akc akc"}
.lp{grid-area:lp}.godz{grid-area:godz}.org{grid-area:org}.atr{grid-area:atr}.uw{grid-area:uw}.os{grid-area:os}.zad{grid-area:zad}.akc{grid-area:akc}
.nav h2{min-width:0;font-size:17px}.sekcja{margin:0 10px 14px;padding:10px}.nav,.chipy{padding-left:10px;padding-right:10px}}
';

const PLAN_JS = '
(function(){
  var f=document.getElementById("plan"), wiersze=document.getElementById("wiersze");
  var zmiany=false; function zmien(){zmiany=true;document.getElementById("niezapisane").hidden=false;}
  f.addEventListener("input",function(){zmien();licz();});
  f.addEventListener("submit",function(){zmiany=false;});
  window.addEventListener("beforeunload",function(e){if(zmiany){e.preventDefault();e.returnValue="";}});
  function nr(){[].forEach.call(wiersze.children,function(w,i){w.querySelector(".lp").textContent=i+1;
    [].forEach.call(w.querySelectorAll("[name^=\'g[\']"),function(el){el.name=el.name.replace(/^g\\[\\d+\\]/,"g["+i+"]");});});}
  function kolor(w){var s=w.querySelector("select");w.style.setProperty("--k",(KOLORY[s.value]||"transparent"));}
  function licz(){var razem=0,pb=0,em=0;[].forEach.call(wiersze.children,function(w){
      if(w.querySelector(".usun input").checked||!w.querySelector("[name$=\'[organizator]\']").value.trim())return;
      var n=parseInt(w.querySelector("[name$=\'[osoby]\']").value,10)||0,a=w.querySelector("select").value;razem+=n;
      if(a==="klasyk"||a==="sportowy")pb+=n;if(a==="emek"||a==="gotcha")em+=n;});
    document.getElementById("razem").textContent=razem;
    var s=document.querySelector("[data-suma=pb_osoby]");if(s)s.textContent=pb;s=document.querySelector("[data-suma=em_osoby]");if(s)s.textContent=em;}
  wiersze.addEventListener("click",function(e){var w=e.target.closest(".w");if(!w)return;
    if(e.target.hasAttribute("data-gora")&&w.previousElementSibling){wiersze.insertBefore(w,w.previousElementSibling);nr();zmien();}
    if(e.target.hasAttribute("data-dol")&&w.nextElementSibling){wiersze.insertBefore(w.nextElementSibling,w);nr();zmien();}});
  wiersze.addEventListener("change",function(e){var w=e.target.closest(".w");if(!w)return;
    if(e.target.tagName==="SELECT")kolor(w);if(e.target.closest(".usun"))w.classList.toggle("usuniety",e.target.checked);licz();});
  document.getElementById("dodaj").onclick=function(){var t=document.getElementById("szablon").content.firstElementChild.cloneNode(true);
    wiersze.appendChild(t);nr();t.querySelector("[name$=\'[godzina]\']").focus();};
  document.getElementById("sortuj").onclick=function(){var w=[].slice.call(wiersze.children);
    function k(x){var o=x.querySelector("[name$=\'[organizator]\']").value.trim(),g=x.querySelector("[name$=\'[godzina]\']").value.trim();return (o?"0":"1")+(g||"99:99");}
    w.sort(function(a,b){return k(a)<k(b)?-1:k(a)>k(b)?1:0;}).forEach(function(x){wiersze.appendChild(x);});nr();zmien();};
  [].forEach.call(document.querySelectorAll("[data-wpisz]"),function(b){b.onclick=function(){var k=b.getAttribute("data-wpisz");
    document.querySelector("[name=\'pak["+k+"]\']").value=document.querySelector("[data-suma="+k+"]").textContent;zmien();};});
  licz();
})();
';

panel_wymagaj_logowania('plan.php');

$poprawnaData = function (string $d): bool {
    return (bool)preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $d, $m) && checkdate((int)$m[2], (int)$m[3], (int)$m[1]);
};
$data = (string)($_GET['d'] ?? $_POST['d'] ?? '');
if (!$poprawnaData($data)) $data = date('Y-m-d', strtotime('+1 day 12:00'));   // domyślnie jutro (pakowanie dzień wcześniej)

$komunikat = '';
$blad = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    if (!panel_sprawdz_csrf()) {
        $blad = 'Strona była otwarta za długo — odśwież ją i wpisz zmiany jeszcze raz.';
    } elseif (isset($_POST['kopiuj'])) {
        $z = (string)($_POST['z'] ?? '');
        try {
            if (!$poprawnaData($z)) throw new RuntimeException('Wybierz dzień, z którego skopiować plan.');
            $n = plan_kopiuj($z, $data);
            header('Location: plan.php?d=' . $data . '&ok=' . urlencode("Skopiowano plan z " . r_data_pl($z) . " ($n)"));
            exit;
        } catch (RuntimeException $e) {
            $blad = $e->getMessage();
        }
    } else {
        try {
            $grupy = is_array($_POST['g'] ?? null) ? array_values($_POST['g']) : [];
            $pak = is_array($_POST['pak'] ?? null) ? $_POST['pak'] : [];
            $w = plan_zapisz_dzien($data, $grupy, $pak, (string)($_POST['do_zabrania'] ?? ''), (string)($_POST['uwagi'] ?? ''), (int)($_POST['rev_dnia'] ?? -1));
            $msg = $w['zapisane'] ? '✓ Zapisano — tablety pobiorą plan przy najbliższej synchronizacji' : 'Bez zmian';
            if ($w['pominiete']) $msg .= '. ⚠ W międzyczasie zmienione na tablecie (nie nadpisano, sprawdź): ' . implode(', ', $w['pominiete']);
            header('Location: plan.php?d=' . $data . '&ok=' . urlencode($msg));
            exit;
        } catch (BladApi $e) {
            $blad = 'Nie zapisano: ' . $e->getMessage();
        }
    }
}
if (isset($_GET['ok'])) $komunikat = mb_substr((string)$_GET['ok'], 0, 400);

$atrakcje = plan_atrakcje();
$plan = plan_dnia($data);

if (isset($_GET['druk'])) {
    druk_planu($plan, $atrakcje);
    exit;
}
widok_planu($plan, $atrakcje, plan_najblizsze_dni(), $komunikat, $blad);

// ── widoki ──────────────────────────────────────────────────

function dzien_tyg(string $data): string
{
    return ['NIEDZIELA', 'PONIEDZIAŁEK', 'WTOREK', 'ŚRODA', 'CZWARTEK', 'PIĄTEK', 'SOBOTA'][(int)date('w', strtotime($data . ' 12:00'))];
}

function przesun_dzien(string $data, int $o): string
{
    return date('Y-m-d', strtotime($data . ' 12:00 ' . ($o >= 0 ? '+' : '') . $o . ' day'));
}

function wiersz_grupy(int $i, array $g, array $atrakcje): string
{
    $id = (string)($g['id'] ?? '');
    $opcje = '<option value="">—</option>';
    foreach ($atrakcje as $k => $a) {
        $opcje .= '<option value="' . r_h($k) . '"' . (($g['atrakcja'] ?? '') === $k ? ' selected' : '') . '>' . r_h($a['nazwa']) . '</option>';
    }
    $kolor = $atrakcje[$g['atrakcja'] ?? '']['kolor'] ?? '';
    $stan = '';
    if ($id !== '') {
        if (!empty($g['na_liscie'])) $stan = '<span class="st ok">✅ na liście' . ($g['instruktor'] ? ': ' . r_h($g['instruktor']) : '') . '</span>';
        elseif (($g['status'] ?? '') === 'przyszla') $stan = '<span class="st ok">✅ przyszła</span>';
        elseif (($g['status'] ?? '') === 'nie') $stan = '<span class="st nie">❌ nie przyszła</span>';
    }
    $zad = (string)($g['zadatek'] ?? '');
    return '<div class="w" style="--k:' . r_h($kolor ?: 'transparent') . '">'
        . '<input type="hidden" name="g[' . $i . '][id]" value="' . r_h($id) . '">'
        . ($id !== '' ? '<input type="hidden" name="g[' . $i . '][rev]" value="' . (int)$g['rev'] . '">' : '')
        . '<span class="lp">' . ($i + 1) . '</span>'
        . '<label class="f godz"><i>Godzina</i><input name="g[' . $i . '][godzina]" value="' . r_h($g['godzina'] ?? '') . '" placeholder="09:00" maxlength="20"></label>'
        . '<label class="f org"><i>Organizator</i><input name="g[' . $i . '][organizator]" value="' . r_h($g['organizator'] ?? '') . '" placeholder="Imię i nazwisko" maxlength="80"></label>'
        . '<label class="f atr"><i>Atrakcja</i><select name="g[' . $i . '][atrakcja]">' . $opcje . '</select></label>'
        . '<label class="f uw"><i>Uwagi</i><textarea name="g[' . $i . '][uwagi]" rows="2" maxlength="500" placeholder="pakiet, ognisko, wiata…">' . r_h($g['uwagi'] ?? '') . '</textarea></label>'
        . '<label class="f os"><i>Osób</i><input name="g[' . $i . '][osoby]" value="' . ((int)($g['osoby'] ?? 0) ?: '') . '" inputmode="numeric" placeholder="0"></label>'
        . '<label class="f zad"><i>Zadatek</i><input name="g[' . $i . '][zadatek]" value="' . r_h($zad) . '" list="zadatki" maxlength="20" placeholder="TAK / 200"></label>'
        . '<div class="akc">' . $stan
        . '<button type="button" class="mini" data-gora title="Wyżej">↑</button><button type="button" class="mini" data-dol title="Niżej">↓</button>'
        . '<label class="usun" title="Usuń z planu"><input type="checkbox" name="g[' . $i . '][usun]" value="1"> 🗑</label></div>'
        . '</div>';
}

function widok_planu(array $plan, array $atrakcje, array $dni, string $komunikat, string $blad): void
{
    $data = $plan['data'];
    $wiersze = '';
    $i = 0;
    foreach ($plan['grupy'] as $g) $wiersze .= wiersz_grupy($i++, $g, $atrakcje);
    $puste = max(3, 10 - $i);
    for ($k = 0; $k < $puste; $k++) $wiersze .= wiersz_grupy($i++, [], $atrakcje);
    $szablon = wiersz_grupy(999, [], $atrakcje);

    $pak = $plan['pakowanie'];
    $naraz = '';
    foreach ($atrakcje as $k => $a) {
        $naraz .= '<label class="f n" style="--k:' . r_h($a['kolor']) . '"><i>' . r_h($a['nazwa']) . '</i><input name="pak[naraz][' . r_h($k) . ']" value="' . r_h((string)($pak['naraz'][$k] ?? '')) . '" inputmode="numeric" placeholder="0"></label>';
    }
    $liczby = '';
    foreach (PLAN_PAKOWANIE as $k => $opis) {
        $podp = in_array($k, ['pb_osoby', 'em_osoby'], true) ? ' <button type="button" class="mini" data-wpisz="' . $k . '">z tabeli: <b data-suma="' . $k . '">0</b></button>' : '';
        $liczby .= '<label class="f p"><i>' . r_h($opis) . $podp . '</i><input name="pak[' . $k . ']" value="' . r_h((string)($pak[$k] ?? '')) . '" inputmode="numeric" placeholder="0"></label>';
    }

    $szybkie = '';
    foreach ($dni as $x) {
        $szybkie .= '<a class="chip' . ($x['data'] === $data ? ' akt' : '') . '" href="plan.php?d=' . $x['data'] . '">' . mb_substr(dzien_tyg($x['data']), 0, 3) . ' ' . r_data_pl($x['data']) . ' · ' . (int)$x['grup'] . ' gr. · ' . (int)$x['osob'] . ' os.</a>';
    }

    $tresc = '<header><div class="logo">SILT <span>Plan dnia</span></div><div><a class="wyl" href="panel.php">Listy</a> · <a class="wyl" href="plan.php?wyloguj=1">Wyloguj</a></div></header>'
        . '<div class="nav"><a class="btn" href="plan.php?d=' . przesun_dzien($data, -1) . '">←</a>'
        . '<h2>' . dzien_tyg($data) . ' <small>' . r_data_pl($data) . '</small></h2>'
        . '<a class="btn" href="plan.php?d=' . przesun_dzien($data, 1) . '">→</a>'
        . '<form method="get" class="inl"><input type="date" name="d" value="' . $data . '" onchange="this.form.submit()"></form>'
        . '<a class="btn" href="plan.php?d=' . date('Y-m-d') . '">Dziś</a><a class="btn" href="plan.php?d=' . date('Y-m-d', strtotime('+1 day 12:00')) . '">Jutro</a>'
        . '<span class="sp"></span><a class="btn" href="plan.php?d=' . $data . '&druk=1" target="_blank">🖨️ Drukuj</a></div>'
        . ($szybkie ? '<div class="chipy">' . $szybkie . '</div>' : '')
        . ($komunikat ? '<div class="ok">' . r_h($komunikat) . '</div>' : '')
        . ($blad ? '<div class="blad">' . r_h($blad) . '</div>' : '')
        . '<form method="post" id="plan"><input type="hidden" name="csrf" value="' . r_h(panel_csrf()) . '"><input type="hidden" name="d" value="' . $data . '">'
        . '<input type="hidden" name="rev_dnia" value="' . (int)$plan['rev'] . '">'
        . '<div class="sekcja"><h3>Grupy <span class="razem">razem osób: <b id="razem">0</b></span>'
        . '<button type="button" class="btn mal" id="sortuj">↕ Ułóż po godzinie</button></h3>'
        . '<div id="wiersze">' . $wiersze . '</div>'
        . '<button type="button" class="btn" id="dodaj">＋ Dodaj wiersz</button>'
        . '<p class="info">Zadatek: wpisz kwotę (np. 200) — przejdzie na tablet do grupy. Samo TAK = instruktor wpisze kwotę przy dodawaniu grupy.</p></div>'
        . '<div class="sekcja"><h3>Do spakowania</h3>'
        . '<p class="info">Graczy w jednym czasie:</p><div class="siatka">' . $naraz . '</div>'
        . '<div class="siatka">' . $liczby . '</div>'
        . '<label class="f"><i>Do zabrania (oddzielaj „/” albo nową linią — na tablecie każda rzecz do odhaczenia)</i><textarea name="do_zabrania" rows="2" maxlength="500" placeholder="ŚMIESZNE STROJE / ŚWIECE DYMNE / RĘKAWICZKI / OŚWIETLENIE / KAMIZELKI / AGREGAT">' . r_h($plan['do_zabrania']) . '</textarea></label>'
        . '<label class="f"><i>Uwagi do dnia</i><textarea name="uwagi" rows="2" maxlength="500">' . r_h($plan['uwagi']) . '</textarea></label></div>'
        . '<div class="zapisz"><button type="submit" class="btn duzy">💾 Zapisz plan</button><span id="niezapisane" hidden>● niezapisane zmiany</span></div>'
        . '</form>'
        . (!$plan['grupy'] ? '<form method="post" class="sekcja kopiuj"><input type="hidden" name="csrf" value="' . r_h(panel_csrf()) . '"><input type="hidden" name="d" value="' . $data . '">'
            . '<b>Pusty dzień?</b> Skopiuj plan z dnia <input type="date" name="z" value="' . przesun_dzien($data, -7) . '"> <button class="btn" name="kopiuj" value="1">📋 Kopiuj</button></form>' : '')
        . '<datalist id="zadatki"><option value="TAK"><option value="NIE"></datalist>'
        . '<template id="szablon">' . $szablon . '</template>';

    $kolory = [];
    foreach ($atrakcje as $k => $a) $kolory[$k] = $a['kolor'];
    strona('Plan ' . r_data_pl($data), $tresc, PLAN_CSS, 'var KOLORY=' . json_encode($kolory) . ';' . PLAN_JS);
}

/** Wydruk jak rozpiska z Excela (A4 poziomo). */
function druk_planu(array $plan, array $atrakcje): void
{
    $w = '';
    $lp = 0;
    $suma = 0;
    foreach ($plan['grupy'] as $g) {
        $suma += (int)$g['osoby'];
        $kol = $atrakcje[$g['atrakcja']]['kolor'] ?? '#ffffff';
        $w .= '<tr style="background:' . r_h($kol) . '33"><td>' . ++$lp . '</td><td>' . r_h($g['godzina']) . '</td><td>' . r_h($g['organizator']) . '</td>'
            . '<td>' . r_h($atrakcje[$g['atrakcja']]['nazwa'] ?? '') . '</td><td class="uw">' . r_h($g['uwagi']) . '</td><td>' . ((int)$g['osoby'] ?: '') . '</td>'
            . '<td>' . r_h($g['zadatek']) . '</td><td>' . r_h($g['instruktor'] ?? '') . '</td></tr>';
    }
    $pak = $plan['pakowanie'];
    $naraz = '';
    foreach ($atrakcje as $k => $a) {
        if (isset($pak['naraz'][$k])) $naraz .= '<tr><td>Graczy w jednym czasie ' . r_h($a['nazwa']) . '</td><td>' . (int)$pak['naraz'][$k] . '</td></tr>';
    }
    $sp = '';
    foreach (PLAN_PAKOWANIE as $k => $opis) {
        if (isset($pak[$k])) $sp .= '<tr><td>' . r_h($opis) . '</td><td>' . (int)$pak[$k] . '</td></tr>';
    }
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Plan ' . r_data_pl($plan['data']) . '</title><style>'
        . '@page{size:A4 landscape;margin:10mm}body{font-family:Arial,sans-serif;font-size:11px;color:#000}h1{text-align:center;font-size:16px;margin:0 0 6px}'
        . 'table{border-collapse:collapse;width:100%}td,th{border:1px solid #333;padding:4px 6px;text-align:center}th{background:#eee}td.uw{text-align:left;font-weight:600}'
        . '.dol{display:flex;gap:20px;margin-top:10px;align-items:flex-start}.dol table{width:auto}.dol td:first-child{text-align:left}p{margin:8px 0}'
        . '@media screen{body{max-width:1100px;margin:16px auto}}</style></head><body onload="window.print()">'
        . '<h1>' . dzien_tyg($plan['data']) . ' ' . r_data_pl($plan['data']) . '</h1>'
        . '<table><thead><tr><th>LP</th><th>Godzina</th><th>Organizator</th><th>Atrakcja</th><th>Uwagi</th><th>Ilość osób</th><th>Zadatek</th><th>Instruktor</th></tr></thead>'
        . '<tbody>' . $w . '</tbody><tfoot><tr><th colspan="5" style="text-align:right">RAZEM</th><th>' . $suma . '</th><th colspan="2"></th></tr></tfoot></table>'
        . '<div class="dol">' . ($naraz ? '<table>' . $naraz . '</table>' : '') . ($sp ? '<table>' . $sp . '</table>' : '') . '</div>'
        . ($plan['do_zabrania'] ? '<p><b>Do zabrania:</b> ' . r_h($plan['do_zabrania']) . '</p>' : '')
        . ($plan['uwagi'] ? '<p><b>Uwagi:</b> ' . r_h($plan['uwagi']) . '</p>' : '')
        . '</body></html>';
}
