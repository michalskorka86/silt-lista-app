import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import type { Platnosc, Wiersz } from '@/db/tabele';
import type { Atrakcja, Cennik, Pakiet } from '@/logika/cennik';
import { num, zl } from '@/logika/format';
import {
  dodajDym,
  dodajGracza,
  dodajGrupe,
  dodajInne,
  dodajInstruktora,
  dodajKulki,
  kulkiZPakietu,
  usunPozycje,
  ustawPlatnosc,
  zmienGracza,
  zmienGrupe,
  zmienPozycje,
  type GraczPelny,
  type GrupaPelna,
} from '@/logika/lista';
import { useMotyw } from '@/theme/motyw';

import { useKomunikaty } from '../ui/Komunikaty';
import { Okno, Przycisk, Przyciski } from '../ui/Okno';
import { Podpowiedz, Pole, Rzad } from '../ui/Pole';
import { IKONY_PLATNOSCI } from './KartaGrupy';

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

  const dalej = () => {
    if (!atr) return toast('Wybierz atrakcję');
    setPk(0);
    setKrok(2);
  };
  const utworz = async () => {
    if (!atr || !instruktorId) return;
    await dodajGrupe(db, data, instruktorId, org, atr, atr.pakiety[pk]);
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
          <Pole etykieta="Imię organizatora" value={org} onChangeText={setOrg} placeholder="np. Alex" maxLength={40} autoFocus autoCapitalize="words" />
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
          <Przyciski>
            <Przycisk tekst="Anuluj" rodzaj="anuluj" onPress={onZamknij} />
            <Przycisk tekst="Dalej →" onPress={dalej} wylaczony={!cennik} />
          </Przyciski>
        </>
      ) : (
        <>
          <ListaPakietow pakiety={atr?.pakiety ?? []} wybrany={pk} onWybierz={setPk} />
          <Przyciski>
            <Przycisk tekst="← Wróć" rodzaj="anuluj" onPress={() => setKrok(1)} />
            <Przycisk tekst="Dodaj grupę ✓" onPress={utworz} />
          </Przyciski>
        </>
      )}
    </Okno>
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
          p.typ === 'grupa' && !p.cena ? 'cenę podajesz ręcznie w „Podstawa”' : '',
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
            <Text style={[styles.pkCena, { color: c.accent }]}>{p.cena ? zl(p.cena) + (p.typ === 'grupa' ? '' : ' / os.') : '—'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Gracz ─────────────────────────────────────────────────────

type StanGracza = { grupa: GrupaPelna; gracz?: GraczPelny };

export function OknoGracz({ stan, onZamknij }: { stan: StanGracza | null; onZamknij: () => void }) {
  return (
    <Okno widoczne={!!stan} onZamknij={onZamknij} tytul={stan?.gracz ? '👤 Edytuj gracza' : '👤 Nowy gracz'}>
      {stan ? <TrescGracz stan={stan} onZamknij={onZamknij} /> : null}
    </Okno>
  );
}

function TrescGracz({ stan, onZamknij }: { stan: StanGracza; onZamknij: () => void }) {
  const db = useSQLiteContext();
  const { toast } = useKomunikaty();
  const [imie, setImie] = useState(stan.gracz?.imie ?? '');
  const [uwagi, setUwagi] = useState(stan.gracz?.notatka ?? '');
  const pole = useRef<TextInput>(null);
  const nowy = !stan.gracz;

  const zapisz = async (nastepny: boolean) => {
    const i = imie.trim();
    if (!i) {
      if (nastepny) onZamknij();
      else toast('Podaj imię gracza');
      return;
    }
    if (stan.gracz) {
      await zmienGracza(db, stan.gracz.id, { imie: i, notatka: uwagi.trim() });
      onZamknij();
      return;
    }
    await dodajGracza(db, stan.grupa.id, i, uwagi);
    if (nastepny) {
      setImie('');
      setUwagi('');
      toast(`✅ Dodano: ${i}`);
      setTimeout(() => pole.current?.focus(), 50);
    } else onZamknij();
  };

  return (
    <>
      <Pole
        ref={pole}
        etykieta="Imię gracza"
        value={imie}
        onChangeText={setImie}
        placeholder="np. Bartek"
        maxLength={40}
        autoFocus
        autoCapitalize="words"
        blurOnSubmit={false}
        onSubmitEditing={() => zapisz(nowy)}
      />
      <Podpowiedz>🎤 Możesz też kliknąć mikrofon na klawiaturze tabletu i powiedzieć imię.</Podpowiedz>
      <Pole etykieta="Uwagi" value={uwagi} onChangeText={setUwagi} placeholder="np. org., VIP" maxLength={60} />
      <Przyciski>
        <Przycisk tekst="Anuluj" rodzaj="anuluj" onPress={onZamknij} />
        {nowy ? <Przycisk tekst="Zapisz i następny" rodzaj="anuluj" onPress={() => zapisz(true)} /> : null}
        <Przycisk tekst="Zapisz ✓" onPress={() => zapisz(false)} />
      </Przyciski>
    </>
  );
}

// ── Kulki / dym / inne przy graczu ────────────────────────────

type Widok = 'wybor' | 'dym' | 'inne';
type StanPozycji = { grupa: GrupaPelna; gracz: GraczPelny; dym?: Wiersz<'pozycje'> };
type PropsPozycji = { atrakcja?: Atrakcja; dymCena: number; onZamknij: () => void };

export function OknoPozycja({ stan, ...props }: PropsPozycji & { stan: StanPozycji | null }) {
  return stan ? <TrescPozycja stan={stan} {...props} /> : <Okno widoczne={false} onZamknij={props.onZamknij}>{null}</Okno>;
}

function TrescPozycja({ stan, atrakcja, dymCena, onZamknij }: PropsPozycji & { stan: StanPozycji }) {
  const { c } = useMotyw();
  const db = useSQLiteContext();
  const { numpad } = useKomunikaty();
  const { grupa: g, gracz: p } = stan;
  const limit = p.pakiet_kulki ?? g.pakiet_kulki ?? 0;
  const uzyte = kulkiZPakietu(p);
  const mozeDokupic = !!g.kdod_ilosc;

  const [widok, setWidok] = useState<Widok>(stan.dym ? 'dym' : 'wybor');
  const [dok, setDok] = useState(mozeDokupic && !!limit && uzyte >= limit);
  const [dymIlosc, setDymIlosc] = useState(String(stan.dym?.ilosc ?? 1));
  const [dymKwota, setDymKwota] = useState(String(stan.dym ? (stan.dym.kwota ?? 0) : dymCena));
  const [inneNazwa, setInneNazwa] = useState('');
  const [inneKwota, setInneKwota] = useState('');

  const opcje = (dok ? atrakcja?.opcje_dok : atrakcja?.opcje_pakiet) ?? [];
  const podtytul = stan.dym
    ? 'Świece dymne — zmień ilość lub usuń'
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
    const kw = num(dymKwota);
    onZamknij();
    if (stan.dym) {
      if (n <= 0) await usunPozycje(db, stan.dym.id);
      else await zmienPozycje(db, stan.dym.id, { ilosc: n, kwota: kw });
    } else await dodajDym(db, p.id, n, kw);
  };
  const zapiszInne = async () => {
    if (!inneNazwa.trim()) return;
    onZamknij();
    await dodajInne(db, p.id, inneNazwa, num(inneKwota));
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
            {opcje.map((v) => (
              <KOpt key={v} glowny={String(v)} pod={dok ? 'dokupione' : 'z pakietu'} onPress={() => kulki(v)} />
            ))}
            <KOpt glowny="✏️" pod="inna ilość" onPress={innaIlosc} />
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
            <Pole
              etykieta="Ilość świec dymnych"
              value={dymIlosc}
              onChangeText={(t) => {
                setDymIlosc(t);
                setDymKwota(String(Math.round(num(t)) * dymCena));
              }}
              keyboardType="number-pad"
              selectTextOnFocus
              autoFocus
            />
            <Pole etykieta="Kwota łącznie (zł)" value={dymKwota} onChangeText={setDymKwota} keyboardType="decimal-pad" selectTextOnFocus />
          </Rzad>
          <Podpowiedz>Sugestia: {dymCena} zł / szt · 0 = gratis</Podpowiedz>
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
          <Pole etykieta="Kwota (zł) — 0 = gratis" value={inneKwota} onChangeText={setInneKwota} keyboardType="decimal-pad" />
          <Przyciski>
            <Przycisk tekst="← Wróć" rodzaj="anuluj" onPress={() => setWidok('wybor')} />
            <Przycisk tekst="Dodaj ✓" onPress={zapiszInne} wylaczony={!inneNazwa.trim()} />
          </Przyciski>
        </>
      )}
    </Okno>
  );
}

function KOpt({ glowny, pod, dym, onPress }: { glowny: string; pod: string; dym?: boolean; onPress: () => void }) {
  const { c } = useMotyw();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.kOpt,
        { backgroundColor: pressed ? 'rgba(249,115,22,0.1)' : c.surface2, borderColor: dym ? 'rgba(168,85,247,0.5)' : pressed ? c.accent : c.border },
        pressed && { transform: [{ scale: 0.93 }] },
      ]}>
      <Text style={[styles.kOptTxt, { color: dym ? '#c084fc' : c.text }]}>{glowny}</Text>
      <Text style={[styles.kSub, { color: c.text2 }]}>{pod.toUpperCase()}</Text>
    </Pressable>
  );
}

// ── Płatność ──────────────────────────────────────────────────

export const PLATNOSCI: Exclude<Platnosc, ''>[] = ['Gotówka', 'Karta', 'Przelew'];

export function KafelkiPlatnosci({ wybrana, onWybierz }: { wybrana: string; onWybierz: (p: Exclude<Platnosc, ''>) => void }) {
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
  return (
    <Okno widoczne={!!grupa} onZamknij={onZamknij} tytul="💳 Forma płatności" rozmiar="sm">
      <KafelkiPlatnosci
        wybrana={grupa?.platnosc ?? ''}
        onWybierz={(p) => {
          onZamknij();
          if (grupa) ustawPlatnosc(db, grupa.id, p);
        }}
      />
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
  const [cena, setCena] = useState(grupa.pakiet_cena ? String(grupa.pakiet_cena) : '');
  const [extra, setExtra] = useState(grupa.pakiet_extra ? String(grupa.pakiet_extra) : '');

  const wybierz = (i: number) => {
    setIdx(i);
    const p = pakiety[i];
    setCena(p?.cena ? String(p.cena) : '');
    setExtra(p?.extra ? String(p.extra) : '');
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
      pakiet_cena: num(cena),
      pakiet_extra: grupowy && p.limit ? num(extra) : p.extra,
    });
  };

  return (
    <>
      <ListaPakietow pakiety={pakiety} wybrany={idx} onWybierz={wybierz} />
      <View style={styles.odstep} />
      <Rzad>
        <Pole
          etykieta={grupowy ? (p.limit ? `Cena za grupę do ${p.limit} os. (zł)` : 'Cena za grupę (zł)') : 'Cena za osobę (zł)'}
          value={cena}
          onChangeText={setCena}
          keyboardType="decimal-pad"
          selectTextOnFocus
        />
        {grupowy && p.limit ? (
          <Pole etykieta="Dodatkowy gracz (zł)" value={extra} onChangeText={setExtra} keyboardType="decimal-pad" selectTextOnFocus />
        ) : null}
      </Rzad>
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
  const [cena, setCena] = useState(String(grupa.kdod_cena ?? ''));
  const zapisz = async () => {
    const il = Math.round(num(ilosc));
    if (il <= 0) return toast('Podaj ilość kulek');
    onZamknij();
    await zmienGrupe(db, grupa.id, { kdod_ilosc: il, kdod_cena: num(cena) });
  };
  return (
    <>
      <Rzad>
        <Pole etykieta="Ilość kulek" value={ilosc} onChangeText={setIlosc} keyboardType="number-pad" selectTextOnFocus />
        <Pole etykieta="Cena (zł)" value={cena} onChangeText={setCena} keyboardType="decimal-pad" selectTextOnFocus />
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
