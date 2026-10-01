/**
 * Raport PDF dnia (printList() z v19): A4 poziomo.
 * Strony z grupami (od najstarszej), na końcu: pensje (tylko podstawa — NIGDY premia), wydatki i podsumowanie dnia.
 * Zwraca gotowy HTML — tablet zamienia go na PDF bez internetu (expo-print).
 * Bez importów React Native (testy w Node).
 */

import type { Cennik } from './cennik';
import { dataPL, liczba, num, zl } from './format';
import type { Dzien, GraczPelny, GrupaPelna } from './lista';

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[z]!);

export const nazwaPliku = (data: string) => `SILT_lista_${data}.pdf`;

const CSS = `
@page { size: A4 landscape; margin: 9mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.p-group { break-inside: avoid; page-break-inside: avoid; border: 1.5px solid #000; border-radius: 6px; margin-bottom: 5mm; overflow: hidden; }
.p-head { display: flex; align-items: center; gap: 10px; padding: 5px 8px; border-bottom: 1.5px solid #000; }
.p-num { width: 22px; height: 22px; border-radius: 4px; color: #fff; font-weight: 900; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; }
.p-title { font-weight: 900; font-size: 13px; text-transform: uppercase; flex: 1; }
.p-meta { font-size: 11px; }
.p-body { display: flex; }
.p-left { flex: 1; border-right: 1.5px solid #000; }
.p-tbl { width: 100%; border-collapse: collapse; }
.p-tbl th, .p-tbl td { border-bottom: 1px solid #999; padding: 3px 6px; text-align: left; vertical-align: top; }
.p-tbl th { font-size: 9px; text-transform: uppercase; background: #eee; }
.p-tbl tr { break-inside: avoid; page-break-inside: avoid; }
.num { white-space: nowrap; }
.p-sep { color: #d00; font-weight: 900; padding: 0 3px; }
.p-dod { padding: 4px 6px; font-size: 10px; border-top: 1px solid #999; }
.p-right { width: 62mm; padding: 6px 8px; font-size: 12px; line-height: 1.55; }
.p-right .big { font-size: 15px; font-weight: 900; }
.p-page2 { break-before: page; page-break-before: always; padding: 1mm 1px 0 0; }
.p-h1 { font-size: 15px; font-weight: 900; margin: 0 0 3mm; }
.p-h2 { font-size: 13px; font-weight: 900; margin: 5mm 0 2mm; }
.p-list { width: 100%; border-collapse: collapse; font-size: 12px; }
.p-list th, .p-list td { border: 1px solid #000; padding: 5px 8px; text-align: left; }
.p-list th { background: #eee; }
.r, .p-list .r { text-align: right; white-space: nowrap; }
.p-sum { width: 50%; }
.p-sum .netto td, .p-sum .netto th { font-size: 14px; font-weight: 900; }
.p-stopka { margin-top: 4mm; font-size: 9px; color: #666; }
@media screen {
  html, body { background: #52525b; }
  .kartka { background: #fff; width: 297mm; margin: 12px auto; padding: 9mm; box-shadow: 0 6px 30px rgba(0,0,0,.4); }
}
`;

function wierszGracza(p: GraczPelny, i: number, kolPakiet: boolean): string {
  const kp = p.pozycje.filter((x) => x.rodzaj === 'kulki' && !x.dokupione).map((x) => liczba(x.ilosc ?? 0));
  const kd = p.pozycje.filter((x) => x.rodzaj === 'kulki' && x.dokupione).map((x) => liczba(x.ilosc ?? 0));
  const dym = p.pozycje.filter((x) => x.rodzaj === 'dym');
  const inne = p.pozycje.filter((x) => x.rodzaj === 'inne');
  const sprzet = p.sprzet ?? [];
  const worki = p.worki_ilosc ? `Worek ${p.worki_szt ?? ''}${p.worki_ilosc > 1 ? ` ×${p.worki_ilosc}` : ''} · ${zl(p.worki_ilosc * num(p.worki_cena))}` : '';
  const pk = kolPakiet
    ? `<td>${
        sprzet.length
          ? `<b>Własny sprzęt</b> (bez pakietu)<br>${sprzet.map((x) => esc(`${x.nazwa} ${zl(x.kwota)}`)).join(', ')}`
          : p.pakiet_cena !== null
            ? `<b>${esc(p.pakiet_nazwa)}</b> ${zl(p.pakiet_cena)}`
            : '<span style="color:#888">główny</span>'
      }${worki ? `<br>${esc(worki)}` : ''}</td>`
    : '';
  const wKulek = p.worki_ilosc ? liczba(p.worki_ilosc * (p.worki_szt ?? 0)) : '';
  const kulki =
    (kp.join(' · ') || (p.worki_ilosc ? '' : '—')) +
    (kd.length ? `<span class="p-sep">|</span>${kd.join(' · ')}` : '') +
    (p.worki_ilosc ? `${kp.length || kd.length ? ' · ' : ''}worki: ${wKulek}` : '');
  return `<tr><td>${i + 1}</td><td><b>${esc(p.imie)}</b>${p.notatka ? ` (${esc(p.notatka)})` : ''}</td>${pk}
    <td class="num">${kulki}</td>
    <td class="num">${dym.map((d) => `DYM ×${d.ilosc ?? 1}${num(d.kwota) ? ` (${zl(d.kwota)})` : ''}`).join(', ')}</td>
    <td>${inne.map((x) => esc(x.nazwa) + (num(x.kwota) ? ` ${zl(x.kwota)}` : '')).join(', ')}</td></tr>`;
}

function grupaHtml(g: GrupaPelna, nr: number, d: Dzien, cennik: Cennik | null): string {
  const a = cennik?.atrakcje.find((x) => x.klucz === g.atrakcja);
  const kolor = a?.kolor ?? '#666666';
  const w = g.wynik;
  const instr = d.instruktorzy.find((i) => i.id === g.instruktor_id)?.imie ?? '';
  const kolPakiet = g.gracze.some((p) => p.pakiet_cena !== null || (p.sprzet ?? []).length || p.worki_ilosc);
  const nc = kolPakiet ? 6 : 5;
  const wiersze =
    g.gracze.map((p, i) => wierszGracza(p, i, kolPakiet)).join('') +
      (w.kG ? `<tr><td></td><td><b>Cała grupa (bez imion)</b></td>${kolPakiet ? '<td></td>' : ''}<td class="num">${liczba(w.kG)}</td><td></td><td></td></tr>` : '') ||
    `<tr><td colspan="${nc}" style="color:#666">brak graczy na liście</td></tr>`;
  const dod = g.dodatki.length
    ? `<div class="p-dod"><b>Dodatki:</b> ${g.dodatki.map((x) => `${esc(x.nazwa)} ${num(x.kwota) ? zl(x.kwota) : 'gratis'}`).join(' · ')}</div>`
    : '';
  return `<div class="p-group">
    <div class="p-head" style="background:${kolor}22"><div class="p-num" style="background:${kolor}">${nr}</div>
      <div class="p-title">${esc(a?.nazwa ?? g.atrakcja)} <span style="font-weight:600;text-transform:none">· ${esc(g.pakiet_nazwa)}</span></div>
      <div class="p-meta">Organizator: <b>${esc(g.organizator || '—')}</b> · Instruktor: <b>${esc(instr)}</b> · ${esc(g.godzina)} · ${dataPL(d.data)}</div></div>
    <div class="p-body"><div class="p-left">
      <table class="p-tbl"><tr><th style="width:24px">#</th><th>Gracz</th>${kolPakiet ? '<th>Pakiet / sprzęt</th>' : ''}<th>Kulki (pakiet | dokupione)</th><th>Świece dymne</th><th>Inne</th></tr>${wiersze}</table>${dod}</div>
      <div class="p-right">
        <div><b>Atrakcja (${esc(a?.stat ?? g.atrakcja)})</b></div>
        <div>${w.gracze} os | ${liczba(w.kulki)} kulek | ${zl(w.kwota)}</div>
        ${w.dymN ? `<div>w tym DYM: ${w.dymN} szt</div>` : ''}
        ${w.sprzetKw ? `<div>w tym własny sprzęt (${w.nWl} os): ${zl(w.sprzetKw)}</div>` : ''}
        ${w.workiKw ? `<div>w tym worki kulek: ${zl(w.workiKw)} (${liczba(w.kW)} szt)</div>` : ''}
        ${w.zad ? `<div>− ${zl(w.zad)} zadatek</div>` : ''}
        <div class="big">${zl(w.doZap)}</div>
        <div>Forma płatności (${esc(g.platnosc || '—')})</div>
        ${g.faktura ? `<div style="margin-top:4px;font-size:10px">🧾 Faktura: NIP ${esc(g.faktura.nip)}</div>` : ''}
      </div></div></div>`;
}

/** Cały raport dnia jako HTML (A4 poziomo). */
export function htmlRaportu(d: Dzien, cennik: Cennik | null, wygenerowano: Date = new Date()): string {
  const grupy = [...d.grupy].reverse(); // od najstarszej (jak v19)
  const s = d.podsumowanie;
  let h = grupy.map((g, i) => grupaHtml(g, i + 1, d, cennik)).join('');
  if (!grupy.length) h += '<div class="p-h1">Brak grup</div>';

  // Pensje: tylko podstawa (godziny × stawka). Premia NIGDY nie trafia na wydruk.
  const pensje =
    d.pensje
      .map(
        (p) =>
          `<tr><td>${esc(p.imie)}</td><td class="r">${String(num(p.godziny)).replace('.', ',')} h</td><td class="r">${num(p.stawka) ? `${zl(p.stawka)}/h` : '—'}</td><td class="r">${zl(p.kwota)}</td></tr>`,
      )
      .join('') || '<tr><td colspan="4">—</td></tr>';
  const wydatki =
    d.wydatki.map((w) => `<tr><td>${esc(w.opis)}</td><td class="r">${zl(w.kwota)}</td><td>${esc(w.uwagi ?? '')}</td></tr>`).join('') ||
    '<tr><td colspan="3">—</td></tr>';

  h += `<div class="p-page2"><div class="p-h1">SILT — ${dataPL(d.data)} · Pensje, wydatki i podsumowanie dnia</div>
    <div class="p-h2">Pensje</div>
    <table class="p-list"><tr><th>Instruktor</th><th class="r">Ilość godzin</th><th class="r">Stawka</th><th class="r">Kwota</th></tr>
      ${pensje}
      <tr><th>Razem</th><th></th><th></th><th class="r">${zl(s.pensje)}</th></tr></table>
    <div class="p-h2">Wydatki</div>
    <table class="p-list"><tr><th>Opis</th><th class="r">Kwota</th><th>Uwagi</th></tr>
      ${wydatki}
      <tr><th>Razem</th><th class="r">${zl(s.wydatki)}</th><th></th></tr></table>
    <div class="p-h2">Podsumowanie dnia</div>
    <table class="p-list p-sum">
      <tr><td>Grup / osób / kulek</td><td class="r">${grupy.length} / ${s.graczy} / ${liczba(s.kulki)}</td></tr>
      <tr><td>Przychód brutto</td><td class="r">${zl(s.brutto)}</td></tr>
      <tr><td>Zadatki (w przychodzie)</td><td class="r">${zl(s.zadatki)}</td></tr>
      <tr><td>Wydatki</td><td class="r">− ${zl(s.wydatki)}</td></tr>
      <tr><td>Pensje</td><td class="r">− ${zl(s.pensje)}</td></tr>
      <tr class="netto"><th>Zostaje (brutto − wydatki − pensje)</th><th class="r">${zl(s.netto)}</th></tr>
    </table>
    <div class="p-stopka">SILT Lista · raport z ${dataPL(d.data)} · utworzono ${wygenerowano.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div></div>`;

  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=1150"><title>${nazwaPliku(d.data)}</title><style>${CSS}</style></head><body><div class="kartka">${h}</div></body></html>`;
}
