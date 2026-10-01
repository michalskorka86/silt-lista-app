/** 🎤 Imiona z dyktowania (voiceName() z v19): „Bartek, Ola i Kamil” → ['Bartek', 'Ola', 'Kamil']. */

const wielka = (w: string) => w.charAt(0).toLocaleUpperCase('pl-PL') + w.slice(1);

export function imionaZMowy(tekst: string): string[] {
  return tekst
    .trim()
    .replace(/[.!?]+$/, '')
    .split(/\s*(?:,|;|\s+i\s+|\s+oraz\s+|\s+a także\s+)\s*/i)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => x.split(/\s+/).map(wielka).join(' ').slice(0, 40));
}
