import { useColorScheme } from 'react-native';

/**
 * Breaker-panel palette. See DESIGN.md.
 *
 * Light is the primary appearance — the use scene is an older person in a
 * kitchen in daylight. Dark is the same panel in shadow, not an inversion.
 */
export type Palette = {
  panel: string;
  card: string;
  ink: string;
  inkSecondary: string;
  rule: string;
  graphite: string;
  onGraphite: string;
  amber: string;
  caution: string;
};

const light: Palette = {
  panel: '#E6E4DD',
  card: '#F6F4EF',
  ink: '#191917',
  inkSecondary: '#5A5850',
  rule: '#C7C4BB',
  graphite: '#2C2C29',
  onGraphite: '#F6F4EF',
  amber: '#D2660A',
  caution: '#B32D19',
};

const dark: Palette = {
  panel: '#1A1A19',
  card: '#242423',
  ink: '#F1EFE9',
  inkSecondary: '#A5A29A',
  rule: '#3A3936',
  graphite: '#E8E6E0',
  onGraphite: '#1A1A19',
  amber: '#F0871F',
  caution: '#E2543C',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

/** 4pt base. Tight groups, generous separation. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  card: 14,
  plate: 10,
  flag: 4,
} as const;

/**
 * The card's single shadow: real offset plus soft blur, sitting it on the
 * panel. Never a zero-offset halo.
 */
export const cardShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
} as const;

/** Directory labels are printed like a circuit card. */
export const stencil = {
  textTransform: 'uppercase',
  letterSpacing: 1.1,
  fontWeight: '600',
} as const;
