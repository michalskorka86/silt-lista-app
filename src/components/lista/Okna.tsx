import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import type { Platnosc, SprzetGracza, Wiersz } from '@/db/tabele';
import type { Atrakcja, Cennik, Pakiet } from '@/logika/cennik';
import { liczba, num, zl } from '@/logika/format';
import { imionaZMowy } from '@/logika/glos';
import { podzialPlatnosci } from '@/logika/platnosc';
import { brutto, doPola, netto, zPola } from '@/logika/vat';
import {
  dodajDodatek,
  dodajDym,
  dodajGracza,
  dodajGraczyZeSprzetem,
  dodajGrupe,
  dodajInne,
  dodajInstruktora,
  dodajKulki,
  dodajWorek,
  kulkiZPakietu,
  usunFakture,
  usunPozycje,
  ustawPlatnosc,
  ustawPlatnoscMieszana,
  zmienGracza,
  zmienGrupe,
  zapiszFakture,
  zmienPozycje,
  type GraczPelny,
  type GrupaPelna,
} from '@/logika/lista';
import { useMotyw } from '@/theme/motyw';

import { useKomunikaty } from '../ui/Komunikaty';
import { Okno, Przycisk, Przyciski } from '../ui/Okno';
import { Podpowiedz, Pole, Rzad } from '../ui/Pole';
import { Numpad, type NumpadUstawienia } from '../ui/Numpad';
import { PoleLiczby } from '../ui/PoleLiczby';
import { IKONY_PLATNOSCI } from './KartaGrupy';
import { PrzyciskMikrofonu, useMikrofon } from './Mikrofon';

// ── Instruktor (zakładka) ─────────────────────────────────────

export function OknoInstruktor(props: {
  widoczne: boolean;
  data: string;
  onZamknij: () => void;
  onDodano: (id: string) => void;
}) {
  return (
    <Okno widoczne={props.widoczne} onZamknij={props.onZamknij} tytul="👷 Instruktor" rozmiar="sm">
      {props.widoczne ? <TrescInstruktor {...props} /> : null}
    </Okno>
  );
}

function TrescInstruktor({ data, onZamknij, onDodano }: { data: string; onZamknij: () => void; onDodano: (id: string) => void }) {
  const db = useSQLiteContext();
  const { toast } = useKomunikaty();
  const [imie, setImie] = useState('');
  const zapisz = async () => {
    if (!imie.trim()) return toast('Podaj imię instruktora');
    const id = await dodajInstruktora(db, data, imie);
    onZamknij();
    onDodano(id);
  };
  return (
    <>
      <Pole etykieta="Imię instruktora" value={imie} onChangeText={setImie} placeholder="np. Monika" maxLength={40} autoFocus onSubmitEditing={zapisz} autoCapitalize="words" />
      <Przyciski>
        <Przycisk tekst="Anuluj" rodzaj="anuluj" onPress={onZamknij} />
        <Przycisk tekst="Dodaj ✓" onPress={zapisz} />
      </Przyciski>
    </>
  );
}

// ── Nowa grupa: organizator → atrakcja → pakiet ───────────────

type PropsNowaGrupa = {
  widoczne: boolean;
  data: string;
  instruktorId: string | null;
  cennik: Cennik | null;
  onZamknij: () => void;
};

export function OknoNowaGrupa(props: PropsNowaGrupa) {
  // klucz = nowe okno (czysty formularz) przy każdym otwarciu
  return props.widoczne ? <TrescNowaGrupa {...props} /> : <Okno widoczne={false} onZamknij={props.onZamknij}>{null}</Okno>;
}

function TrescNowaGrupa({ data, instruktorId, cennik, onZamknij }: PropsNowaGrupa) {
  const { c } = useMotyw();
  const db = useSQLiteContext();
  const { toast } = useKomunikaty();
  const [krok, setKrok] = useState<1 | 2>(1);
  const [org, setOrg] = useState('');
  const [atr, setAtr] = useState<Atrakcja | null>(null);
  const [pk, setPk] = useState(0);
  const [brakOrg, setBrakOrg] = useState(false);
  // pakiet bez ceny (Dzień Otwarty, laser) — instruktor wpisuje tylko ilość osób, kulki i kasę, bez podpowiedzi
  const [reczneOsoby, setReczneOsoby] = useState('');
  const [reczneKulki, setReczneKulki] = useState('');
  const [recznaKasa, setRecznaKasa] = useState('');
  const wybranyPk = atr?.pakiety[pk];
  const reczny = !!wybranyPk && !wybranyPk.cena;
  const zKulkami = !!atr?.opcje_pakiet.length;
  const poleOrg = useRef<TextInput>(null);
  // 🏢 impreza firmowa: stawki ustalane indywidualnie, wpisywane NETTO (zapis brutto)
  const [firma, setFirma] = useState(false);
  const [fCena, setFCena] = useState('');
  const [fKdod, setFKdod] = useState('');
  const [fDym, setFDym] = useState('');
  const [fCatering, setFCatering] = useState(false);

  const dalej = () => {
    if (!org.trim()) {
      setBrakOrg(true);
      poleOrg.current?.focus();
      return toast('Wpisz imię organizatora');
    }
    if (!atr) return toast('Wybierz atrakcję');
    setPk(0);
    setKrok(2);
  };
  const utworz = async () => {
    if (!atr || !instruktorId || !org.trim()) return;
    let pakiet = atr.pakiety[pk];
    if (firma && !reczny && !fCena.trim()) return toast(`Wpisz cenę netto za ${pakiet.typ === 'grupa' ? 'grupę' : 'osobę'}`);
    // kasa = cena pakietu na całą grupę (dym / dodatki dodane później doliczą się do niej)
    if (reczny) pakiet = { ...pakiet, typ: 'grupa', cena: zPola(Math.max(0, num(recznaKasa)), firma), limit: 0, extra: 0 };
    else if (firma) pakiet = { ...pakiet, cena: brutto(Math.max(0, num(fCena))) };
    const id = await dodajGrupe(db, data, instruktorId, org.trim(), atr, pakiet);
    if (firma) {
      await zmienGrupe(db, id, {
        firma: 1,
        ...(fKdod.trim() && atr.kdod ? { kdod_cena: brutto(num(fKdod)) } : {}),
        ...(fDym.trim() ? { dym_cena: brutto(num(fDym)) } : {}),
      });
      if (fCatering) await dodajDodatek(db, id, 'Catering', 0);
    }
    if (reczny && (reczneOsoby.trim() || reczneKulki.trim()))
      await zmienGrupe(db, id, {
        gracze_reczne: Math.max(0, Math.round(num(reczneOsoby))),
        kulki_reczne: zKulkami ? Math.max(0, Math.round(num(reczneKulki))) : 0,
      });
    onZamknij();
    toast(`✅ Dodano grupę ${atr.nazwa}`);
  };

  return (
    <Okno
      widoczne
      onZamknij={onZamknij}
      rozmiar="lg"
      tytul={krok === 1 ? '➕ Nowa grupa' : `${atr?.nazwa ?? ''} — pakiet`}
      podtytul={
        krok === 2 && atr
          ? `Organizator: ${org.trim() || '—'}${atr.kdod ? ` · kulki dodatkowe: ${atr.kdod.ilosc} szt – ${zl(atr.kdod.cena)}` : ''}`
          : undefined
      }>
      {krok === 1 ? (
        <>
          <Pole
            ref={poleOrg}
            etykieta="Imię organizatora *"
            value={org}
            onChangeText={(t) => {
              setOrg(t);
              if (t.trim()) setBrakOrg(false);
            }}
            placeholder="np. Alex"
            maxLength={40}
            autoFocus
            autoCapitalize="words"
            style={brakOrg ? { borderColor: c.red } : undefined}
          />
          {brakOrg ? <Text style={[styles.brakOrg, { color: c.red }]}>Wpisz imię organizatora — bez niego nie da się dodać grupy.</Text> : null}
          <Text style={[styles.label, { color: c.text2 }]}>Atrakcja</Text>
          {!cennik ? (
            <Podpowiedz>Brak cennika na tablecie — połącz tablet z internetem, żeby go pobrać.</Podpowiedz>
          ) : (
            <View style={styles.atrGrid}>
              {cennik.atrakcje.map((a) => {
                const wyb = atr?.klucz === a.klucz;
                return (
                  <Pressable key={a.klucz} onPress={() => setAtr(a)} style={[styles.atrTile, { backgroundColor: a.kolor, borderColor: wyb ? '#fff' : 'transparent' }]}>
                    <Text style={styles.atrTxt}>
                      {a.nazwa.toUpperCase()}
                      {a.podpis ? ` ${a.podpis}` : ''}
                    </Text>
                    {wyb ? <Text style={styles.atrCheck}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          )}
          <Przelacznik
            ikona="🏢"
            tytul="Impreza firmowa"
            opis="stawki ustalone indywidualnie, wpisywane netto (aplikacja doliczy 23% VAT)"
            wlaczony={firma}
            onPress={() => setFirma((x) => !x)}
          />
          <Przyciski>
            <Przycisk tekst="Anuluj" rodzaj="anuluj" onPress={onZamknij} />
            <Przycisk tekst="Dalej →" onPress={dalej} wylaczony={!cennik} />
          </Przyciski>
        </>
      ) : (
        <>
          <ListaPakietow pakiety={atr?.pakiety ?? []} wybrany={pk} onWybierz={setPk} />
          {reczny ? (
            <>
              <View style={styles.odstep} />
              <Rzad>
                <PoleLiczby etykieta="Ilość osób" value={reczneOsoby} onChangeText={setReczneOsoby} tytul={`${wybranyPk?.nazwa} — ilość osób`} />
                {zKulkami ? (
                  <PoleLiczby etykieta="Kulki (razem)" value={reczneKulki} onChangeText={setReczneKulki} tytul={`${wybranyPk?.nazwa} — kulki razem`} />
                ) : null}
                <PoleLiczby etykieta={firma ? 'Kasa netto (zł)' : 'Kasa (zł)'} value={recznaKasa} onChangeText={setRecznaKasa} tytul={`${wybranyPk?.nazwa} — kasa${firma ? ' netto' : ''} (zł)`} />
              </Rzad>
              <Podpowiedz>Wszystko można potem zmienić na karcie grupy. Dym i dodatki dodasz normalnie — doliczą się do kasy.</Podpowiedz>
            </>
          ) : null}
          {firma && !reczny ? (
            <>
              <View style={styles.odstep} />
              <Text style={[styles.label, { color: c.text2 }]}>🏢 STAWKI DLA FIRMY — NETTO (pakiet wyżej = ile kulek na osobę)</Text>
              <Rzad>
                <PoleLiczby
                  etykieta={wybranyPk?.typ === 'grupa' ? 'Cena za grupę netto *' : 'Cena za osobę netto *'}
                  value={fCena}
                  onChangeText={setFCena}
                  placeholder="wpisz"
                  autoOtworz={!fCena.trim()}
                />
                {atr?.kdod ? (
                  <PoleLiczby etykieta={`Kulki dodatkowe netto / ${atr.kdod.ilosc} szt`} value={fKdod} onChangeText={setFKdod} placeholder={`cennik ${netto(atr.kdod.cena)}`} />
                ) : null}
                <PoleLiczby etykieta="Świeca dymna netto / szt" value={fDym} onChangeText={setFDym} placeholder={`cennik ${netto(cennik?.dym_cena ?? 10)}`} />
              </Rzad>
              <Przelacznik ikona="🍕" tytul="Catering w cenie" opis="dodaje do grupy „Catering” za 0 zł" wlaczony={fCatering} onPress={() => setFCatering((x) => !x)} />
              <Podpowiedz>
                {[
                  fCena.trim() ? `${wybranyPk?.typ === 'grupa' ? 'grupa' : 'osoba'} ${zl(brutto(num(fCena)))}` : '',
                  fKdod.trim() && atr?.kdod ? `kulki ${zl(brutto(num(fKdod)))} / ${atr.kdod.ilosc} szt` : '',
                  fDym.trim() ? `świeca ${zl(brutto(num(fDym)))}` : '',
                ].filter(Boolean).length
                  ? 'Brutto: ' +
                    [
                      fCena.trim() ? `${wybranyPk?.typ === 'grupa' ? 'grupa' : 'osoba'} ${zl(brutto(num(fCena)))}` : '',
                      fKdod.trim() && atr?.kdod ? `kulki ${zl(brutto(num(fKdod)))} / ${atr.kdod.ilosc} szt` : '',
                      fDym.trim() ? `świeca ${zl(brutto(num(fDym)))}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Puste pola kulek i świecy = ceny z cennika. Wszystko zmienisz potem na karcie grupy.'}
              </Podpowiedz>
            </>
          ) : null}
          <Przyciski>
            <Przycisk tekst="← Wróć" rodzaj="anuluj" onPress={() => setKrok(1)} />
            <Przycisk tekst="Dodaj grupę ✓" onPress={utworz} />
          </Przyciski>
        </>
      )}
    </Okno>
  );
}

/** Kafelek tak/nie (impreza firmowa, catering w cenie). */
function Przelacznik({ ikona, tytul, opis, wlaczony, onPress }: { ikona: string; tytul: string; opis: string; wlaczony: boolean; onPress: () => void }) {
  const { c } = useMotyw();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: wlaczony }}
      style={[styles.gratis, { borderColor: wlaczony ? c.accent : c.border, backgroundColor: wlaczony ? 'rgba(249,115,22,0.12)' : c.surface2 }]}>
      <Text style={styles.gratisIco}>{ikona}</Text>
      <View style={styles.flex}>
        <Text style={[styles.plPkNazwa, { color: c.text }]}>{tytul}</Text>
        <Text style={[styles.plPkSub, { color: c.text2 }]}>{opis}</Text>
      </View>
      <Text style={[styles.gratisCheck, { color: wlaczony ? c.accent : c.text3 }]}>{wlaczony ? '✓' : '○'}</Text>
    </Pressable>
  );
}

/** Kafelki pakietów (.pk-tile z v19). */
export function ListaPakietow({ pakiety, wybrany, onWybierz }: { pakiety: Pakiet[]; wybrany: number; onWybierz: (i: number) => void }) {
  const { c } = useMotyw();
  return (
    <View style={styles.pkList}>
      {pakiety.map((p, i) => {
        const wyb = i === wybrany;
        const opis = [
          p.kulki ? `${p.kulki} kulek` : '',
          p.typ === 'grupa' && p.extra ? `dodatkowy gracz ${zl(p.extra)}` : '',
          !p.cena ? 'wpisujesz sam: ilość osób, kulki, kasę' : '',
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <Pressable
            key={p.id}
            onPress={() => onWybierz(i)}
            style={[styles.pkTile, { borderColor: wyb ? c.accent : c.border, backgroundColor: wyb ? 'rgba(249,115,22,0.1)' : c.surface2 }]}>
            <View style={styles.flex}>
              <Text style={[styles.pkNazwa, { color: c.text }]}>{p.nazwa}</Text>
              {opis ? <Text style={[styles.pkOpis, { color: c.text2 }]}>{opis}</Text> : null}
            </View>
            <Text style={[styles.pkCena, { color: c.accent }]}>{p.cena ? zl(p.cena) + (p.typ === 'grupa' ? '' : ' / os.') : '✏️'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Gracz ─────────────────────────────────────────────────────

type StanGracza = { grupa: GrupaPelna; gracz?: GraczPelny };
type PropsGracza = { atrakcja?: Atrakcja; cennik: Cennik | null; onZamknij: () => void };

export function OknoGracz({ stan, ...props }: PropsGracza & { stan: StanGracza | null }) {
  return (
    <Okno widoczne={!!stan} onZamknij={props.onZamknij} tytul={stan?.gracz ? '👤 Edytuj gracza' : '👤 Nowy gracz'}>
      {stan ? <TrescGracz stan={stan} {...props} /> : null}
    </Okno>
  );
}

type PakietGracza = { nazwa: string; kulki: number; cena: number } | null;
/** Gracz za darmo (np. nauczyciel) = własny pakiet gracza „Gratis” za 0 zł, kulki jak w pakiecie grupy. */
export const GRATIS = 'Gratis';
type Worki = { n: number; szt: number; cena: number };

function pakietZGracza(p?: GraczPelny): PakietGracza {
  return p && p.pakiet_cena !== null ? { nazwa: p.pakiet_nazwa ?? '', kulki: p.pakiet_kulki ?? 0, cena: p.pakiet_cena } : null;
}

function TrescGracz({ stan, atrakcja, cennik, onZamknij }: PropsGracza & { stan: StanGracza }) {
  const { c } = useMotyw();
  const db = useSQLiteContext();
  const { toast } = useKomunikaty();
  const g = stan.grupa;
  const worekCennik = cennik?.worek ?? { szt: 500, cena: 40 };
  const [imie, setImie] = useState(stan.gracz?.imie ?? '');
  const [uwagi, setUwagi] = useState(stan.gracz?.notatka ?? '');
  const [pk, setPk] = useState<PakietGracza>(pakietZGracza(stan.gracz));
  const [sprzet, setSprzet] = useState<SprzetGracza[]>(stan.gracz?.sprzet ?? []);
  const [worki, setWorki] = useState<Worki | null>(
    stan.gracz?.worki_ilosc
      ? { n: stan.gracz.worki_ilosc, szt: stan.gracz.worki_szt ?? worekCennik.szt, cena: stan.gracz.worki_cena ?? worekCennik.cena }
      : null,
  );
  const [oknoSprzet, setOknoSprzet] = useState(false);
  const pole = useRef<TextInput>(null);
  const nowy = !stan.gracz;

  const wlasny = sprzet.length > 0;
  const gratis = pk?.nazwa === GRATIS && pk.cena === 0;
  const naOsobe = g.pakiet_typ !== 'grupa';
  const pakietyOs = (atrakcja?.pakiety ?? []).filter((p) => p.typ !== 'grupa' && (p.cena > 0 || p.nazwa === g.pakiet_nazwa));

  const reset = () => {
    setImie('');
    setUwagi('');
    setPk(null);
    setSprzet([]);
    setWorki(null);
  };

  const zapisz = async (nastepny: boolean) => {
    const i = imie.trim();
    if (!i) {
      if (nastepny) onZamknij();
      else toast('Podaj imię gracza');
      return;
    }
    const pakiet = wlasny ? null : pk;
    const dane = {
      imie: i,
      notatka: uwagi.trim(),
      pakiet_nazwa: pakiet?.nazwa ?? null,
      pakiet_kulki: pakiet?.kulki ?? null,
      pakiet_cena: pakiet?.cena ?? null,
      sprzet: sprzet.length ? sprzet : null,
      worki_ilosc: worki?.n ? worki.n : null,
      worki_szt: worki?.n ? worki.szt : null,
      worki_cena: worki?.n ? worki.cena : null,
    };
    if (stan.gracz) {
      await zmienGracza(db, stan.gracz.id, dane);
      onZamknij();
      return;
    }
    const id = await dodajGracza(db, g.id, i, uwagi);
    await zmienGracza(db, id, dane);
    if (nastepny) {
      reset();
      toast(`✅ Dodano: ${i}`);
      setTimeout(() => pole.current?.focus(), 50);
    } else onZamknij();
  };

  const opisSprzetu = [
    ...sprzet.map((x) => `${x.nazwa} ${zl(x.kwota)}`),
    ...(worki?.n ? [`Worek ${worki.szt}${worki.n > 1 ? ` ×${worki.n}` : ''} · ${zl(worki.n * worki.cena)}`] : []),
  ];
  const razemSprzet = sprzet.reduce((a, x) => a + x.kwota, 0) + (worki?.n ? worki.n * worki.cena : 0);

  // 🎤 kilka imion naraz → od razu dodaje graczy (jak v19); jedno imię → wpisuje do pola
  const mikrofon = useMikrofon(async (t) => {
    const imiona = imionaZMowy(t);
    if (!imiona.length) return;
    if (imiona.length > 1 && nowy) {
      for (const n of imiona) await dodajGracza(db, g.id, n);
      onZamknij();
      toast(`✅ Dodano graczy: ${imiona.join(', ')}`);
    } else setImie(imiona[0]);
  });

  return (
    <>
      <View style={styles.imieRzad}>
        <Pole
          ref={pole}
          etykieta="Imię gracza"
          value={imie}
          onChangeText={setImie}
          placeholder="np. Bartek"
          maxLength={40}
          autoFocus={nowy}
          autoCapitalize="words"
          blurOnSubmit={false}
          onSubmitEditing={() => zapisz(nowy)}
        />
        {mikrofon.jest ? <PrzyciskMikrofonu slucha={mikrofon.slucha} onPress={mikrofon.przelacz} /> : null}
      </View>
      <Podpowiedz>
        {mikrofon.jest
          ? nowy
            ? '🎤 Stuknij mikrofon i powiedz imię — albo kilka naraz, np. „Bartek, Ola i Kamil”.'
            : '🎤 Stuknij mikrofon i powiedz imię.'
          : '🎤 Możesz też kliknąć mikrofon na klawiaturze tabletu i powiedzieć imię.'}
      </Podpowiedz>
      <Pole etykieta="Uwagi" value={uwagi} onChangeText={setUwagi} placeholder="np. org., VIP" maxLength={60} />

      {naOsobe && !wlasny && pakietyOs.length > 1 ? (
        <>
          <Text style={[styles.sekcja, { color: c.text2 }]}>PAKIET GRACZA</Text>
          <View style={styles.plPkGrid}>
            {pakietyOs.map((p) => {
              const glowny = p.nazwa === g.pakiet_nazwa;
              const wyb = pk ? pk.nazwa === p.nazwa : glowny;
              const cena = glowny ? g.pakiet_cena : p.cena;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setPk(glowny ? null : { nazwa: p.nazwa, kulki: p.kulki, cena: p.cena })}
                  style={[styles.plPk, { borderColor: wyb ? c.accent : c.border, backgroundColor: wyb ? 'rgba(249,115,22,0.12)' : c.surface2 }]}>
                  {glowny ? <Text style={[styles.plPkMain, { color: c.text2 }]}>GŁÓWNY</Text> : null}
                  <Text style={[styles.plPkNazwa, { color: c.text }]}>{p.nazwa}</Text>
                  {p.kulki ? <Text style={[styles.plPkSub, { color: c.text2 }]}>{p.kulki} kulek</Text> : null}
                  <Text style={[styles.plPkCena, { color: c.accent }]}>{zl(cena)}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
      {naOsobe && !wlasny ? (
        <Pressable
          onPress={() => setPk(gratis ? null : { nazwa: GRATIS, kulki: g.pakiet_kulki, cena: 0 })}
          style={[styles.gratis, { borderColor: gratis ? c.green : c.border, backgroundColor: gratis ? 'rgba(34,197,94,0.12)' : c.surface2 }]}>
          <Text style={styles.gratisIco}>🎁</Text>
          <View style={styles.flex}>
            <Text style={[styles.plPkNazwa, { color: c.text }]}>Gratis</Text>
            <Text style={[styles.plPkSub, { color: c.text2 }]}>gra za darmo, np. nauczyciel ze szkołą — kulki z pakietu grupy</Text>
          </View>
          <Text style={[styles.gratisCheck, { color: gratis ? c.green : c.text3 }]}>{gratis ? '✓' : '○'}</Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={() => setOknoSprzet(true)}
        style={[
          styles.spTile,
          opisSprzetu.length
            ? { borderStyle: 'solid', borderColor: c.purple, backgroundColor: 'rgba(168,85,247,0.10)' }
            : { borderColor: c.border2 },
        ]}>
        <Text style={styles.spIco}>🎒</Text>
        <View style={styles.flex}>
          <Text style={[styles.spNazwa, { color: c.text }]}>Własny sprzęt{wlasny ? ' — bez podstawy (pakietu)' : ''}</Text>
          <Text style={[styles.spOpis, { color: c.text2 }]}>
            {opisSprzetu.length ? `${opisSprzetu.join(' · ')} — razem ${zl(razemSprzet)}` : 'Własny · Sama Replika · Mundur · worek kulek'}
          </Text>
        </View>
        <Text style={[styles.spStrzalka, { color: c.text2 }]}>›</Text>
      </Pressable>

      <Przyciski>
        <Przycisk tekst="Anuluj" rodzaj="anuluj" onPress={onZamknij} />
        {nowy ? <Przycisk tekst="Zapisz i następny" rodzaj="anuluj" onPress={() => zapisz(true)} /> : null}
        <Przycisk tekst="Zapisz ✓" onPress={() => zapisz(false)} />
      </Przyciski>

      <Okno widoczne={oknoSprzet} onZamknij={() => setOknoSprzet(false)} tytul={`🎒 Własny sprzęt${imie.trim() ? ` — ${imie.trim()}` : ''}`} rozmiar="sm"
        podtytul="Gracz z własnym sprzętem nie płaci podstawy (pakietu) — płaci tylko za zaznaczone pozycje i worki kulek.">
        {oknoSprzet ? (
          <TrescSprzet
            katalog={cennik?.sprzet ?? []}
            worekCennik={worekCennik}
            sprzet={sprzet}
            worki={worki}
            onAnuluj={() => setOknoSprzet(false)}
            onZapisz={(sp, w) => {
              setSprzet(sp);
              setWorki(w);
              if (sp.length) setPk(null);
              setOknoSprzet(false);
            }}
          />
        ) : null}
      </Okno>
    </>
  );
}

/** Własny sprzęt gracza (ov-sprzet z v19): kafelki z cennika, zmiana ceny, worki kulek. */
function TrescSprzet({
  katalog,
  worekCennik,
  sprzet,
  worki,
  onAnuluj,
  onZapisz,
}: {
  katalog: { nazwa: string; cena: number; ikona: string }[];
  worekCennik: { szt: number; cena: number };
  sprzet: SprzetGracza[];
  worki: Worki | null;
  onAnuluj: () => void;
  onZapisz: (sprzet: SprzetGracza[], worki: Worki | null) => void;
}) {
  const { c } = useMotyw();
  const { numpad } = useKomunikaty();
  const [sel, setSel] = useState(() =>
    katalog.map((d, i) => {
      const ex = sprzet.find((x) => (x.i !== undefined ? x.i === i : x.nazwa === d.nazwa && x.kwota === d.cena));
      return { on: !!ex, kw: ex ? ex.kwota : d.cena };
    }),
  );
  const [w, setW] = useState<Worki>(worki ?? { n: 0, szt: worekCennik.szt, cena: worekCennik.cena });

  const przelacz = (i: number) => setSel((s) => s.map((x, j) => (j === i ? { ...x, on: !x.on } : x)));
  const cena = (i: number) =>
    numpad({
      tytul: `${katalog[i].nazwa} — nowa cena (teraz ${zl(sel[i].kw)})`,
      onOk: (v) => setSel((s) => s.map((x, j) => (j === i ? { on: true, kw: Math.max(0, v) } : x))),
    });
  const cenaWorka = () =>
    numpad({
      tytul: `Worek ${w.szt} — nowa cena (teraz ${zl(w.cena)})`,
      onOk: (v) => setW((x) => ({ ...x, cena: Math.max(0, v), n: x.n || 1 })),
    });

  const zapisz = () =>
    onZapisz(
      katalog.flatMap((d, i) => (sel[i]?.on ? [{ nazwa: d.nazwa, kwota: sel[i].kw, ikona: d.ikona, i }] : [])),
      w.n > 0 ? w : null,
    );

  return (
    <>
      <View style={styles.spGrid}>
        {katalog.map((d, i) => {
          const on = sel[i]?.on;
          return (
            <Pressable
              key={i}
              onPress={() => przelacz(i)}
              style={[styles.spKafel, { borderColor: on ? c.purple : c.border, backgroundColor: on ? 'rgba(168,85,247,0.14)' : c.surface2 }]}>
              {on ? <Text style={[styles.spChk, { color: c.purple }]}>✓</Text> : null}
              <Text style={styles.spKafelIco}>{d.ikona}</Text>
              <Text style={[styles.spKafelNazwa, { color: c.text }]}>{d.nazwa}</Text>
              <Text style={[styles.spKafelCena, { color: c.purple }]}>{zl(sel[i]?.kw ?? d.cena)}</Text>
              <Pressable onPress={() => cena(i)} style={[styles.spEd, { borderColor: c.border2, backgroundColor: c.surface }]}>
                <Text style={[styles.spEdTxt, { color: c.text }]}>✏️ zmień cenę</Text>
              </Pressable>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setW((x) => ({ ...x, n: x.n + 1 }))}
          style={[styles.spKafel, styles.spWorek, { borderColor: w.n ? c.purple : c.border, backgroundColor: w.n ? 'rgba(168,85,247,0.14)' : c.surface2 }]}>
          {w.n ? <Text style={[styles.spChk, { color: c.purple }]}>✓</Text> : null}
          <Text style={styles.spKafelIco}>🎯</Text>
          <Text style={[styles.spKafelNazwa, { color: c.text }]}>Dodatkowe kulki — worek {w.szt} szt</Text>
          <Text style={[styles.spKafelCena, { color: c.purple }]}>{zl(w.cena)} / worek</Text>
          <Text style={[styles.spOpis, { color: c.text2, textAlign: 'center' }]}>osobna cena dla własnego sprzętu — nie liczy się jak kulki dodatkowe z pakietu</Text>
          <View style={styles.wkRow}>
            <Pressable onPress={() => setW((x) => ({ ...x, n: Math.max(0, x.n - 1) }))} style={[styles.wkB, { borderColor: c.border2, backgroundColor: c.surface }]}>
              <Text style={[styles.wkBTxt, { color: c.text }]}>−</Text>
            </Pressable>
            <Text style={[styles.wkN, { color: c.text }]}>
              {w.n} {w.n === 1 ? 'worek' : 'worki'}
            </Text>
            <Pressable onPress={() => setW((x) => ({ ...x, n: x.n + 1 }))} style={[styles.wkB, { borderColor: c.border2, backgroundColor: c.surface }]}>
              <Text style={[styles.wkBTxt, { color: c.text }]}>＋</Text>
            </Pressable>
            <Pressable onPress={cenaWorka} style={[styles.spEd, { borderColor: c.border2, backgroundColor: c.surface, marginTop: 0 }]}>
              <Text style={[styles.spEdTxt, { color: c.text }]}>✏️ zmień cenę</Text>
            </Pressable>
          </View>
          {w.n ? (
            <Text style={[styles.spKafelNazwa, { color: c.text, marginTop: 6 }]}>
              Razem {zl(w.n * w.cena)} · {liczba(w.n * w.szt)} kulek
            </Text>
          ) : null}
        </Pressable>
      </View>
      <Przyciski>
        <Przycisk tekst="Anuluj" rodzaj="anuluj" onPress={onAnuluj} />
        <Przycisk tekst="Zapisz ✓" onPress={zapisz} />
      </Przyciski>
    </>
  );
}

// ── Kilka osób z własnym sprzętem naraz ───────────────────────

export function OknoSprzetGrupy({ grupa, cennik, onZamknij }: { grupa: GrupaPelna | null; cennik: Cennik | null; onZamknij: () => void }) {
  return (
    <Okno widoczne={!!grupa} onZamknij={onZamknij} tytul="🎒 Osoby z własnym sprzętem" rozmiar="sm">
      {grupa ? <TrescSprzetGrupy grupa={grupa} katalog={cennik?.sprzet ?? []} onZamknij={onZamknij} /> : null}
    </Okno>
  );
}

function TrescSprzetGrupy({
  grupa,
  katalog,
  onZamknij,
}: {
  grupa: GrupaPelna;
  katalog: { nazwa: string; cena: number; ikona: string }[];
  onZamknij: () => void;
}) {
  const db = useSQLiteContext();
  const { c } = useMotyw();
  const { toast } = useKomunikaty();
  const F = !!grupa.firma;
  const [ile, setIle] = useState('');
  const [wyb, setWyb] = useState(katalog.length ? 0 : -1);
  const [cena, setCena] = useState(katalog.length ? doPola(katalog[0].cena, F) : '');
  const osoby = Math.max(num(grupa.gracze_reczne), grupa.gracze.length);
  const n = Math.round(num(ile));
  const kw = zPola(num(cena), F);

  const wybierz = (i: number) => {
    setWyb(i);
    setCena(doPola(katalog[i].cena, F));
  };
  const zapisz = async () => {
    if (n <= 0) return toast('Podaj ilość osób');
    if (n > 100) return toast('Za dużo osób naraz (maks. 100)');
    const d = wyb >= 0 ? katalog[wyb] : null;
    onZamknij();
    await dodajGraczyZeSprzetem(db, grupa.id, n, { nazwa: d?.nazwa ?? 'Własny', kwota: kw, ikona: d?.ikona ?? '🎒', ...(d ? { i: wyb } : {}) });
    toast(`🎒 Dodano ${n} os. z własnym sprzętem`);
  };

  return (
    <>
      <PoleLiczby etykieta="Ilu osób z własnym sprzętem?" value={ile} onChangeText={setIle} autoOtworz tytul="Osoby z własnym sprzętem — ilość" />
      {katalog.length ? (
        <View style={styles.spGrid}>
          {katalog.map((d, i) => {
            const on = i === wyb;
            return (
              <Pressable
                key={i}
                onPress={() => wybierz(i)}
                style={[styles.spKafel, { borderColor: on ? c.purple : c.border, backgroundColor: on ? 'rgba(168,85,247,0.14)' : c.surface2 }]}>
                {on ? <Text style={[styles.spChk, { color: c.purple }]}>✓</Text> : null}
                <Text style={styles.spKafelIco}>{d.ikona}</Text>
                <Text style={[styles.spKafelNazwa, { color: c.text }]}>{d.nazwa}</Text>
                <Text style={[styles.spKafelCena, { color: c.purple }]}>{F ? `${zl(netto(d.cena))} netto` : zl(d.cena)}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <PoleLiczby etykieta={F ? 'Cena za osobę — netto (zł)' : 'Cena za osobę (zł)'} value={cena} onChangeText={setCena} tytul={`Własny sprzęt — cena za osobę${F ? ' netto' : ''} (zł)`} />
      <Podpowiedz>
        {n > 0
          ? `${n} × ${zl(F ? netto(kw) : kw)}${F ? ' netto' : ''} = ${zl(n * (F ? netto(kw) : kw))}. Osób w grupie: ${osoby} → ${osoby + n}. Osoby z pakietu zostają bez zmian.`
          : `Osób w grupie teraz: ${osoby}. Dopiszę osoby „Własny sprzęt 1, 2, 3…” — bez wpisywania imion.`}
      </Podpowiedz>
      <Przyciski>
        <Przycisk tekst="Anuluj" rodzaj="anuluj" onPress={onZamknij} />
        <Przycisk tekst="Dodaj ✓" onPress={zapisz} />
      </Przyciski>
    </>
  );
}

// ── Kulki / dym / inne przy graczu ────────────────────────────

type Widok = 'wybor' | 'dym' | 'inne';
type StanPozycji = { grupa: GrupaPelna; gracz: GraczPelny; dym?: Wiersz<'pozycje'> };
type PropsPozycji = { atrakcja?: Atrakcja; dymCena: number; worek: { szt: number; cena: number }; onZamknij: () => void };

export function OknoPozycja({ stan, ...props }: PropsPozycji & { stan: StanPozycji | null }) {
  return stan ? <TrescPozycja stan={stan} {...props} /> : <Okno widoczne={false} onZamknij={props.onZamknij}>{null}</Okno>;
}

function TrescPozycja({ stan, atrakcja, dymCena, worek, onZamknij }: PropsPozycji & { stan: StanPozycji }) {
  const { c } = useMotyw();
  const db = useSQLiteContext();
  const { numpad } = useKomunikaty();
  const { grupa: g, gracz: p } = stan;
  const limit = p.pakiet_kulki ?? g.pakiet_kulki ?? 0;
  const uzyte = kulkiZPakietu(p);
  // gracz z własnym sprzętem (albo z workami): zamiast kulek z pakietu — worki (jak v19)
  const wlasny = !!p.sprzet?.length || !!p.worki_ilosc;
  const mozeDokupic = !!g.kdod_ilosc && !wlasny;

  const [widok, setWidok] = useState<Widok>(stan.dym ? 'dym' : 'wybor');
  const [dok, setDok] = useState(mozeDokupic && !!limit && uzyte >= limit);
  const [dymIlosc, setDymIlosc] = useState(String(stan.dym?.ilosc ?? 1));
  // 🏢 firma: kwoty wpisywane netto; cena świecy może być ustalona dla grupy (dym_cena)
  const F = !!g.firma;
  const dymSzt = F ? netto(g.dym_cena ?? dymCena) : (g.dym_cena ?? dymCena);
  const [dymKwota, setDymKwota] = useState(stan.dym ? doPola(stan.dym.kwota ?? 0, F) : String(dymSzt).replace('.', ','));
  const [inneNazwa, setInneNazwa] = useState('');
  const [inneKwota, setInneKwota] = useState('');

  const opcje = (dok ? atrakcja?.opcje_dok : atrakcja?.opcje_pakiet) ?? [];
  const wor = p.worki_ilosc ? { szt: p.worki_szt ?? worek.szt, cena: p.worki_cena ?? worek.cena } : worek;
  const podtytul = stan.dym
    ? 'Świece dymne — zmień ilość lub usuń'
    : wlasny
      ? `Własny sprzęt (bez pakietu) · worek ${wor.szt} szt – ${zl(wor.cena)}${p.worki_ilosc ? ` · ma ${p.worki_ilosc} ${p.worki_ilosc === 1 ? 'worek' : 'worki'}` : ''}`
      : [p.pakiet_nazwa ?? g.pakiet_nazwa, limit ? `${limit} kulek · wykorzystane ${uzyte}/${limit}` : '', mozeDokupic ? `dokupione: ${zl(g.kdod_cena)} / ${g.kdod_ilosc} szt` : '']
        .filter(Boolean)
        .join(' · ');

  const kulki = async (v: number) => {
    onZamknij();
    await dodajKulki(db, p.id, v, dok && mozeDokupic);
  };
  const innaIlosc = () => {
    const d = dok && mozeDokupic;
    onZamknij();
    numpad({ tytul: `Kulki ${d ? 'dokupione' : 'z pakietu'} — ${p.imie}`, onOk: (v) => v > 0 && dodajKulki(db, p.id, v, d) });
  };
  const zapiszDym = async () => {
    const n = Math.round(num(dymIlosc));
    const kw = zPola(num(dymKwota), F);
    onZamknij();
    if (stan.dym) {
      if (n <= 0) await usunPozycje(db, stan.dym.id);
      else await zmienPozycje(db, stan.dym.id, { ilosc: n, kwota: kw });
    } else await dodajDym(db, p.id, n, kw);
  };
  const zapiszInne = async () => {
    if (!inneNazwa.trim()) return;
    onZamknij();
    await dodajInne(db, p.id, inneNazwa, zPola(num(inneKwota), F));
  };

  return (
    <Okno widoczne onZamknij={onZamknij} tytul={`${stan.dym ? '💨' : '🎯'} ${p.imie}`} podtytul={podtytul}>
      {widok === 'wybor' ? (
        <>
          {mozeDokupic ? (
            <View style={[styles.seg, { backgroundColor: c.surface2, borderColor: c.border }]}>
              <Pressable onPress={() => setDok(false)} style={[styles.segBtn, !dok && { backgroundColor: c.accent }]}>
                <Text style={[styles.segTxt, { color: !dok ? '#fff' : c.text2 }]}>🎯 Z pakietu</Text>
              </Pressable>
              <Pressable onPress={() => setDok(true)} style={[styles.segBtn, dok && { backgroundColor: c.yellow }]}>
                <Text style={[styles.segTxt, { color: dok ? '#111' : c.text2 }]}>➕ Dokupione</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.kGrid}>
            {wlasny ? (
              <KOpt
                glowny={`🎯 + worek ${wor.szt}`}
                pod={`własny sprzęt · ${zl(wor.cena)} / worek${p.worki_ilosc ? ` · ma już ${p.worki_ilosc}` : ''}`}
                szeroki
                onPress={() => {
                  onZamknij();
                  dodajWorek(db, p.id, wor);
                }}
              />
            ) : null}
            {wlasny ? null : opcje.map((v) => (
              <KOpt key={v} glowny={String(v)} pod={dok ? 'dokupione' : 'z pakietu'} onPress={() => kulki(v)} />
            ))}
            {wlasny ? null : <KOpt glowny="✏️" pod="inna ilość" onPress={innaIlosc} />}
            <KOpt glowny="💨 DYM" pod="świeca dymna" dym onPress={() => setWidok('dym')} />
          </View>
          <Pressable onPress={() => setWidok('inne')} style={[styles.alt, { borderColor: c.border2 }]}>
            <Text style={[styles.altTxt, { color: c.text2 }]}>✏️ Inna pozycja (mundur, butla, wejściówka…)</Text>
          </Pressable>
          <Przyciski>
            <Przycisk tekst="Zamknij" rodzaj="anuluj" onPress={onZamknij} />
          </Przyciski>
        </>
      ) : widok === 'dym' ? (
        <>
          <Rzad>
            <PoleLiczby
              etykieta="Ilość świec dymnych"
              value={dymIlosc}
              onChangeText={(t) => {
                setDymIlosc(t);
                setDymKwota(String(Math.round(Math.round(num(t)) * dymSzt * 100) / 100).replace('.', ','));
              }}
              autoOtworz={!dymIlosc.trim()}
            />
            <PoleLiczby etykieta={F ? 'Kwota łącznie netto (zł)' : 'Kwota łącznie (zł)'} value={dymKwota} onChangeText={setDymKwota} />
          </Rzad>
          <Podpowiedz>
            Sugestia: {zl(dymSzt)}{F ? ' netto' : ''} / szt · 0 = gratis{F && num(dymKwota) ? ` · brutto ${zl(brutto(num(dymKwota)))}` : ''}
          </Podpowiedz>
          <Przyciski>
            {stan.dym ? (
              <Przycisk
                tekst="Usuń dym"
                rodzaj="usun"
                onPress={() => {
                  onZamknij();
                  usunPozycje(db, stan.dym!.id);
                }}
              />
            ) : (
              <Przycisk tekst="← Wróć" rodzaj="anuluj" onPress={() => setWidok('wybor')} />
            )}
            <Przycisk tekst="Zapisz ✓" onPress={zapiszDym} />
          </Przyciski>
        </>
      ) : (
        <>
          <Pole etykieta="Nazwa pozycji" value={inneNazwa} onChangeText={setInneNazwa} placeholder="np. Mundur, Butla" autoFocus />
          <PoleLiczby etykieta={F ? 'Kwota netto (zł) — 0 = gratis' : 'Kwota (zł) — 0 = gratis'} value={inneKwota} onChangeText={setInneKwota} tytul={inneNazwa.trim() ? `${inneNazwa.trim()} — kwota (zł)` : undefined} />
          <Przyciski>
            <Przycisk tekst="← Wróć" rodzaj="anuluj" onPress={() => setWidok('wybor')} />
            <Przycisk tekst="Dodaj ✓" onPress={zapiszInne} wylaczony={!inneNazwa.trim()} />
          </Przyciski>
        </>
      )}
    </Okno>
  );
}

function KOpt({ glowny, pod, dym, szeroki, onPress }: { glowny: string; pod: string; dym?: boolean; szeroki?: boolean; onPress: () => void }) {
  const { c } = useMotyw();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.kOpt,
        szeroki && { flexBasis: '100%' },
        { backgroundColor: pressed ? 'rgba(249,115,22,0.1)' : c.surface2, borderColor: dym ? 'rgba(168,85,247,0.5)' : pressed ? c.accent : c.border },
        pressed && { transform: [{ scale: 0.93 }] },
      ]}>
      <Text style={[styles.kOptTxt, { color: dym ? '#c084fc' : c.text }]}>{glowny}</Text>
      <Text style={[styles.kSub, { color: c.text2 }]}>{pod.toUpperCase()}</Text>
    </Pressable>
  );
}

// ── Płatność ──────────────────────────────────────────────────

export const PLATNOSCI: Exclude<Platnosc, '' | 'Mieszana'>[] = ['Gotówka', 'Karta', 'Przelew'];

export function KafelkiPlatnosci({ wybrana, onWybierz }: { wybrana: string; onWybierz: (p: Exclude<Platnosc, '' | 'Mieszana'>) => void }) {
  const { c } = useMotyw();
  return (
    <View style={styles.payGrid}>
      {PLATNOSCI.map((p) => {
        const wyb = wybrana === p;
        return (
          <Pressable
            key={p}
            onPress={() => onWybierz(p)}
            style={[styles.payOpt, { borderColor: wyb ? c.accent : c.border, backgroundColor: wyb ? 'rgba(249,115,22,0.1)' : c.surface2 }]}>
            <Text style={styles.payIco}>{IKONY_PLATNOSCI[p]}</Text>
            <Text style={[styles.payName, { color: c.text2 }]}>{p}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function OknoPlatnosc({ grupa, onZamknij }: { grupa: GrupaPelna | null; onZamknij: () => void }) {
  const db = useSQLiteContext();
  const { c } = useMotyw();
  const [np, setNp] = useState<NumpadUstawienia | null>(null);
  const mieszana = grupa?.platnosc === 'Mieszana';
  const doZap = grupa?.wynik.doZap ?? 0;
  const podzial = grupa ? podzialPlatnosci(grupa.platnosc, grupa.platnosc_gotowka, doZap) : null;
  // gotówka + karta: wpisujesz ile gotówką, reszta liczy się sama jako karta
  const wpiszGotowke = () =>
    grupa &&
    setNp({
      tytul: `Ile gotówką? (do zapłaty ${zl(doZap)} — reszta kartą)`,
      wartosc: mieszana ? grupa.platnosc_gotowka : null,
      onOk: (v) => {
        onZamknij();
        ustawPlatnoscMieszana(db, grupa.id, Math.min(v, Math.max(doZap, 0)));
      },
    });
  return (
    <Okno widoczne={!!grupa} onZamknij={onZamknij} tytul="💳 Forma płatności" rozmiar="sm">
      <KafelkiPlatnosci
        wybrana={grupa?.platnosc ?? ''}
        onWybierz={(p) => {
          onZamknij();
          if (grupa) ustawPlatnosc(db, grupa.id, p);
        }}
      />
      <Pressable
        onPress={wpiszGotowke}
        style={[styles.payMix, { borderColor: mieszana ? c.accent : c.border, backgroundColor: mieszana ? 'rgba(249,115,22,0.1)' : c.surface2 }]}>
        <Text style={styles.payIco}>💵💳</Text>
        <View style={styles.flex}>
          <Text style={[styles.plPkNazwa, { color: c.text }]}>Gotówka + karta</Text>
          <Text style={[styles.plPkSub, { color: c.text2 }]}>
            {mieszana && podzial ? `gotówka ${zl(podzial.gotowka)} · karta ${zl(podzial.karta)} — stuknij, żeby zmienić` : 'wpisujesz ile gotówką, reszta liczy się jako karta'}
          </Text>
        </View>
      </Pressable>
      <Numpad ustawienia={np} onZamknij={() => setNp(null)} />
      <Przyciski>
        <Przycisk tekst="Anuluj" rodzaj="anuluj" onPress={onZamknij} />
      </Przyciski>
    </Okno>
  );
}

// ── Podstawa (pakiet + cena grupy) ────────────────────────────

type PropsGrupy = { atrakcja?: Atrakcja; onZamknij: () => void };

export function OknoPodstawa({ grupa, ...props }: PropsGrupy & { grupa: GrupaPelna | null }) {
  return (
    <Okno widoczne={!!grupa} onZamknij={props.onZamknij} tytul="💰 Podstawa — pakiet i cena">
      {grupa ? <TrescPodstawa grupa={grupa} {...props} /> : null}
    </Okno>
  );
}

function TrescPodstawa({ grupa, atrakcja, onZamknij }: PropsGrupy & { grupa: GrupaPelna }) {
  const db = useSQLiteContext();
  const pakiety = atrakcja?.pakiety ?? [];
  const start = Math.max(0, pakiety.findIndex((p) => p.nazwa === grupa.pakiet_nazwa));
  const [idx, setIdx] = useState(start);
  const [firma, setFirma] = useState(!!grupa.firma);
  const [cena, setCena] = useState(grupa.pakiet_cena ? doPola(grupa.pakiet_cena, !!grupa.firma) : '');
  const [extra, setExtra] = useState(grupa.pakiet_extra ? doPola(grupa.pakiet_extra, !!grupa.firma) : '');

  const wybierz = (i: number) => {
    setIdx(i);
    const p = pakiety[i];
    setCena(p?.cena ? doPola(p.cena, firma) : '');
    setExtra(p?.extra ? doPola(p.extra, firma) : '');
  };
  // przełączenie firmy przelicza wpisane kwoty (netto ↔ brutto), żeby cena się nie zmieniła
  const przelaczFirme = () => {
    const na = !firma;
    const przelicz = (t: string) => (t.trim() ? String(na ? netto(num(t)) : brutto(num(t))).replace('.', ',') : t);
    setCena(przelicz(cena));
    setExtra(przelicz(extra));
    setFirma(na);
  };

  const p = pakiety[idx];
  const grupowy = p?.typ === 'grupa';
  const zapisz = async () => {
    if (!p) return;
    onZamknij();
    await zmienGrupe(db, grupa.id, {
      pakiet_nazwa: p.nazwa,
      pakiet_typ: p.typ,
      pakiet_kulki: p.kulki,
      pakiet_limit: p.limit,
      pakiet_cena: zPola(num(cena), firma),
      pakiet_extra: grupowy && p.limit ? zPola(num(extra), firma) : p.extra,
      firma: firma ? 1 : 0,
    });
  };

  return (
    <>
      <ListaPakietow pakiety={pakiety} wybrany={idx} onWybierz={wybierz} />
      <View style={styles.odstep} />
      <Rzad>
        <PoleLiczby
          etykieta={(grupowy ? (p.limit ? `Cena za grupę do ${p.limit} os.` : 'Cena za grupę') : 'Cena za osobę') + (firma ? ' netto (zł)' : ' (zł)')}
          value={cena}
          onChangeText={setCena}
        />
        {grupowy && p.limit ? (
          <PoleLiczby etykieta={firma ? 'Dodatkowy gracz netto (zł)' : 'Dodatkowy gracz (zł)'} value={extra} onChangeText={setExtra} />
        ) : null}
      </Rzad>
      <Przelacznik
        ikona="🏢"
        tytul="Impreza firmowa"
        opis={firma && cena.trim() ? `ceny netto · brutto ${zl(brutto(num(cena)))}${grupowy ? '' : ' / os.'}` : 'ceny wpisywane netto (+23% VAT)'}
        wlaczony={firma}
        onPress={przelaczFirme}
      />
      <Podpowiedz>
        {p?.cena
          ? `Cennik: ${zl(p.cena)}${grupowy ? '' : ' / os.'} — możesz dać inną cenę dla tej grupy.`
          : 'Cena indywidualna — wpisz kwotę ustaloną z klientem.'}
      </Podpowiedz>
      <Przyciski>
        <Przycisk tekst="Anuluj" rodzaj="anuluj" onPress={onZamknij} />
        <Przycisk tekst="Zapisz ✓" onPress={zapisz} />
      </Przyciski>
    </>
  );
}

// ── Cena kulek dodatkowych ────────────────────────────────────

export function OknoKdod({ grupa, ...props }: PropsGrupy & { grupa: GrupaPelna | null }) {
  return (
    <Okno widoczne={!!grupa} onZamknij={props.onZamknij} tytul="🎯 Kulki dodatkowe — cena" rozmiar="sm">
      {grupa ? <TrescKdod grupa={grupa} {...props} /> : null}
    </Okno>
  );
}

function TrescKdod({ grupa, atrakcja, onZamknij }: PropsGrupy & { grupa: GrupaPelna }) {
  const db = useSQLiteContext();
  const { toast } = useKomunikaty();
  const [ilosc, setIlosc] = useState(String(grupa.kdod_ilosc ?? ''));
  const F = !!grupa.firma;
  const [cena, setCena] = useState(doPola(grupa.kdod_cena, F));
  const zapisz = async () => {
    const il = Math.round(num(ilosc));
    if (il <= 0) return toast('Podaj ilość kulek');
    onZamknij();
    await zmienGrupe(db, grupa.id, { kdod_ilosc: il, kdod_cena: zPola(num(cena), F) });
  };
  return (
    <>
      <Rzad>
        <PoleLiczby etykieta="Ilość kulek" value={ilosc} onChangeText={setIlosc} tytul="Dokupione kulki — ilość" />
        <PoleLiczby etykieta={F ? 'Cena netto (zł)' : 'Cena (zł)'} value={cena} onChangeText={setCena} tytul={`Dokupione kulki — cena${F ? ' netto' : ''} (zł)`} />
      </Rzad>
      {atrakcja?.kdod ? (
        <Podpowiedz>
          Cennik: {atrakcja.kdod.ilosc} szt – {zl(atrakcja.kdod.cena)}. Np. dla fajnej grupy: 500 szt – 50 zł.
        </Podpowiedz>
      ) : null}
      <Przyciski>
        <Przycisk tekst="Anuluj" rodzaj="anuluj" onPress={onZamknij} />
        <Przycisk tekst="Zapisz ✓" onPress={zapisz} />
      </Przyciski>
    </>
  );
}

// ── Dodatki grupy (catering, ognisko, GoPro…) ─────────────────

export function OknoDodatek({ grupa, cennik, onZamknij }: { grupa: GrupaPelna | null; cennik: Cennik | null; onZamknij: () => void }) {
  return grupa ? <TrescDodatek grupa={grupa} cennik={cennik} onZamknij={onZamknij} /> : <Okno widoczne={false} onZamknij={onZamknij}>{null}</Okno>;
}

function TrescDodatek({ grupa, cennik, onZamknij }: { grupa: GrupaPelna; cennik: Cennik | null; onZamknij: () => void }) {
  const { c } = useMotyw();
  const db = useSQLiteContext();
  const { toast } = useKomunikaty();
  const [wiecej, setWiecej] = useState(false);
  const [wybrany, setWybrany] = useState<{ nazwa: string; ikona: string } | null>(null);
  const [opis, setOpis] = useState('');
  const [kwota, setKwota] = useState('');
  const glowne = cennik?.dodatki.glowne ?? [];
  const reszta = cennik?.dodatki.wiecej ?? [];
  const inne = wybrany?.nazwa === 'Inne';

  const dodaj = async () => {
    if (!wybrany) return;
    const nazwa = inne ? opis.trim() || 'Inne' : wybrany.nazwa;
    onZamknij();
    await dodajDodatek(db, grupa.id, nazwa, zPola(num(kwota), !!grupa.firma));
    toast(`✅ Dodano: ${nazwa}`);
  };

  if (wybrany)
    return (
      <Okno widoczne onZamknij={onZamknij} tytul={`${wybrany.ikona} ${wybrany.nazwa}`} rozmiar="sm">
        {inne ? <Pole etykieta="Nazwa" value={opis} onChangeText={setOpis} placeholder="np. Transport, Namiot" autoFocus /> : null}
        <PoleLiczby
          etykieta={grupa.firma ? 'Kwota netto (zł) — 0 lub puste = gratis' : 'Kwota (zł) — 0 lub puste = gratis'}
          value={kwota}
          onChangeText={setKwota}
          tytul={`${wybrany.ikona} ${wybrany.nazwa} — kwota (zł)`}
          autoOtworz={!inne && !kwota.trim()}
        />
        <Przyciski>
          <Przycisk tekst="← Wróć" rodzaj="anuluj" onPress={() => setWybrany(null)} />
          <Przycisk tekst="Dodaj ✓" onPress={dodaj} />
        </Przyciski>
      </Okno>
    );

  return (
    <Okno widoczne onZamknij={onZamknij} tytul="🎁 Dodaj dodatek">
      {!glowne.length ? <Podpowiedz>Brak listy dodatków na tablecie — połącz tablet z internetem.</Podpowiedz> : null}
      <View style={styles.dtGrid}>
        {glowne.map((d) => (
          <KafelDodatku key={d.nazwa} d={d} onPress={() => setWybrany(d)} />
        ))}
        {reszta.length ? (
          <Pressable onPress={() => setWiecej((x) => !x)} style={[styles.dtOpt, { borderColor: c.border, backgroundColor: c.surface2 }]}>
            <Text style={styles.dtIco}>⋯</Text>
            <Text style={[styles.dtNazwa, { color: c.text2 }]}>Więcej</Text>
          </Pressable>
        ) : null}
      </View>
      {wiecej ? (
        <View style={[styles.dtGrid, styles.dtWiecej, { borderTopColor: c.border }]}>
          {reszta.map((d) => (
            <KafelDodatku key={d.nazwa} d={d} onPress={() => setWybrany(d)} />
          ))}
        </View>
      ) : null}
      <Przyciski>
        <Przycisk tekst="Zamknij" rodzaj="anuluj" onPress={onZamknij} />
      </Przyciski>
    </Okno>
  );
}

function KafelDodatku({ d, onPress }: { d: { nazwa: string; ikona: string }; onPress: () => void }) {
  const { c } = useMotyw();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.dtOpt, { borderColor: pressed ? c.accent : c.border, backgroundColor: pressed ? 'rgba(249,115,22,0.1)' : c.surface2 }]}>
      <Text style={styles.dtIco}>{d.ikona}</Text>
      <Text style={[styles.dtNazwa, { color: c.text2 }]}>{d.nazwa}</Text>
    </Pressable>
  );
}

// ── Faktura ───────────────────────────────────────────────────

export function OknoFaktura({ grupa, onZamknij }: { grupa: GrupaPelna | null; onZamknij: () => void }) {
  return (
    <Okno widoczne={!!grupa} onZamknij={onZamknij} tytul="🧾 Dane do faktury">
      {grupa ? <TrescFaktura grupa={grupa} onZamknij={onZamknij} /> : null}
    </Okno>
  );
}

function TrescFaktura({ grupa, onZamknij }: { grupa: GrupaPelna; onZamknij: () => void }) {
  const { c } = useMotyw();
  const db = useSQLiteContext();
  const { toast } = useKomunikaty();
  const f = grupa.faktura;
  const [nip, setNip] = useState(f?.nip ?? '');
  const [tel, setTel] = useState(f?.tel ?? '');
  const [email, setEmail] = useState(f?.email ?? '');
  const [kwota, setKwota] = useState(String(f?.kwota ?? (grupa.wynik.kwota || '')));
  // na fakturze jedna forma: przy „gotówka + karta” nic nie podpowiadamy
  const [plat, setPlat] = useState<Platnosc>(f?.platnosc ?? (grupa.platnosc === 'Mieszana' ? '' : grupa.platnosc) ?? '');

  const zapisz = async () => {
    const kw = num(kwota);
    if (!nip.trim() || !tel.trim() || !email.trim() || !kw || !plat) return toast('⚠️ Uzupełnij wszystkie pola i formę płatności');
    onZamknij();
    await zapiszFakture(db, { grupa_id: grupa.id, nip, tel, email, kwota: kw, platnosc: plat as Exclude<Platnosc, '' | 'Mieszana'> });
    toast('✅ Dane faktury zapisane — SMS pójdzie o 6:00');
  };

  return (
    <>
      <Pole etykieta="NIP" value={nip} onChangeText={setNip} placeholder="000-000-00-00" maxLength={16} autoFocus={!f} keyboardType="number-pad" />
      <Rzad>
        <Pole etykieta="Telefon" value={tel} onChangeText={setTel} placeholder="+48 000 000 000" keyboardType="phone-pad" maxLength={20} />
        <Pole etykieta="E-mail" value={email} onChangeText={setEmail} placeholder="kontakt@firma.pl" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={120} />
      </Rzad>
      <PoleLiczby etykieta="Kwota (zł)" value={kwota} onChangeText={setKwota} tytul="Faktura — kwota (zł)" />
      <Text style={[styles.label, { color: c.text2 }]}>Forma płatności na fakturze</Text>
      <KafelkiPlatnosci wybrana={plat} onWybierz={setPlat} />
      {f?.s_sms_wyslano ? <Podpowiedz>📱 SMS z tymi danymi został już wysłany.</Podpowiedz> : null}
      <Przyciski>
        {f ? (
          <Przycisk
            tekst="Bez faktury"
            rodzaj="usun"
            onPress={() => {
              onZamknij();
              usunFakture(db, grupa.id);
            }}
          />
        ) : null}
        <Przycisk tekst="Anuluj" rodzaj="anuluj" onPress={onZamknij} />
        <Przycisk tekst="Zapisz ✓" onPress={zapisz} />
      </Przyciski>
    </>
  );
}

const styles = StyleSheet.create({
  imieRzad: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  payMix: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1.5, borderRadius: 10, marginTop: 10 },
  gratis: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1.5, borderRadius: 10, marginTop: 10 },
  gratisIco: { fontSize: 24 },
  gratisCheck: { fontFamily: Fonts.black, fontSize: 20 },
  brakOrg: { fontFamily: Fonts.semibold, fontSize: 12, marginTop: -6, marginBottom: 10 },
  flex: { flex: 1 },
  dtGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dtWiecej: { marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  dtOpt: { flexGrow: 1, flexBasis: '30%', paddingVertical: 16, paddingHorizontal: 6, borderRadius: 12, borderWidth: 2, alignItems: 'center', gap: 5 },
  dtIco: { fontSize: 24 },
  dtNazwa: { fontFamily: Fonts.bold, fontSize: 12, textAlign: 'center' },
  sekcja: { fontFamily: Fonts.bold, fontSize: 12, letterSpacing: 0.5, marginTop: 4, marginBottom: 8 },
  plPkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  plPk: { flexGrow: 1, flexBasis: 150, borderWidth: 2, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  plPkMain: { position: 'absolute', top: 6, right: 8, fontFamily: Fonts.extrabold, fontSize: 10 },
  plPkNazwa: { fontFamily: Fonts.bold, fontSize: 14 },
  plPkSub: { fontFamily: Fonts.regular, fontSize: 12 },
  plPkCena: { fontFamily: Fonts.extrabold, fontSize: 15, marginTop: 4 },
  spTile: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 4 },
  spIco: { fontSize: 26 },
  spNazwa: { fontFamily: Fonts.bold, fontSize: 15 },
  spOpis: { fontFamily: Fonts.regular, fontSize: 12 },
  spStrzalka: { fontSize: 20 },
  spGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  spKafel: { flexGrow: 1, flexBasis: '45%', borderWidth: 2, borderRadius: 14, paddingTop: 16, paddingHorizontal: 12, paddingBottom: 12, alignItems: 'center' },
  spWorek: { flexBasis: '100%' },
  spChk: { position: 'absolute', top: 8, left: 10, fontSize: 18, fontFamily: Fonts.black },
  spKafelIco: { fontSize: 30 },
  spKafelNazwa: { fontFamily: Fonts.bold, fontSize: 16, marginTop: 4, textAlign: 'center' },
  spKafelCena: { fontFamily: Fonts.black, fontSize: 20, marginTop: 2 },
  spEd: { marginTop: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 },
  spEdTxt: { fontFamily: Fonts.bold, fontSize: 12 },
  wkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  wkB: { width: 48, height: 44, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  wkBTxt: { fontFamily: Fonts.black, fontSize: 22 },
  wkN: { minWidth: 80, textAlign: 'center', fontFamily: Fonts.extrabold, fontSize: 16 },
  odstep: { height: 14 },
  label: { fontFamily: Fonts.bold, fontSize: 12, marginBottom: 8 },
  atrGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  atrTile: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 58,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 3,
    justifyContent: 'center',
  },
  atrTxt: { color: '#fff', fontFamily: Fonts.extrabold, fontSize: 13, letterSpacing: 0.3, paddingRight: 20 },
  atrCheck: { position: 'absolute', right: 12, color: '#fff', fontSize: 18, fontFamily: Fonts.black },
  pkList: { gap: 8 },
  pkTile: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 2 },
  pkNazwa: { fontFamily: Fonts.extrabold, fontSize: 15 },
  pkOpis: { fontFamily: Fonts.semibold, fontSize: 12, marginTop: 2 },
  pkCena: { fontFamily: Fonts.black, fontSize: 16 },
  seg: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, padding: 4, marginBottom: 12, gap: 4 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 7, alignItems: 'center' },
  segTxt: { fontFamily: Fonts.extrabold, fontSize: 13 },
  kGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  kOpt: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 100,
    paddingVertical: 18,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  kOptTxt: { fontFamily: Fonts.black, fontSize: 20 },
  kSub: { fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 0.5 },
  alt: { padding: 12, borderRadius: 10, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center' },
  altTxt: { fontFamily: Fonts.bold, fontSize: 13 },
  payGrid: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  payOpt: { flex: 1, paddingVertical: 18, paddingHorizontal: 8, borderRadius: 12, borderWidth: 2, alignItems: 'center', gap: 5 },
  payIco: { fontSize: 24 },
  payName: { fontFamily: Fonts.bold, fontSize: 12 },
});
