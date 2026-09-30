/**
 * Kolory i wymiary przeniesione 1:1 z SILT Lista v19 (index.php, :root oraz motyw jasny).
 * Zmieniaj tylko tutaj — ekrany korzystają wyłącznie z tych wartości.
 */

export type Palette = {
  accent: string;
  accent2: string;
  bg: string;
  surface: string;
  surface2: string;
  surface3: string;
  border: string;
  border2: string;
  text: string;
  text2: string;
  text3: string;
  green: string;
  red: string;
  blue: string;
  yellow: string;
  purple: string;
  accentSoft: string; // tło podświetlenia (rgba(249,115,22,.08))
};

const common = {
  accent: '#f97316',
  accent2: '#ea580c',
  green: '#22c55e',
  red: '#ef4444',
  blue: '#3b82f6',
  yellow: '#eab308',
  purple: '#a855f7',
  accentSoft: 'rgba(249,115,22,0.08)',
};

export const Colors: Record<'dark' | 'light', Palette> = {
  dark: {
    ...common,
    bg: '#0f0f11',
    surface: '#1a1a1f',
    surface2: '#232328',
    surface3: '#2a2a30',
    border: '#2e2e35',
    border2: '#3a3a42',
    text: '#f0f0f4',
    text2: '#8888a0',
    text3: '#555566',
  },
  light: {
    ...common,
    bg: '#f5f5f7',
    surface: '#ffffff',
    surface2: '#f0f0f3',
    surface3: '#e8e8ec',
    border: '#e2e2e8',
    border2: '#d0d0d8',
    text: '#111116',
    text2: '#666678',
    text3: '#aaaabc',
  },
};

/** Czcionka Inter jak w v19 (ładowana w src/app/_layout.tsx). */
export const Fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  black: 'Inter_900Black',
} as const;

export const Size = {
  topH: 55,
  navH: 60,
  r: 10,
  r2: 14,
  tileR: 18,
} as const;
