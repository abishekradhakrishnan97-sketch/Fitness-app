// Design tokens — Neo-brutalist system.
// Paper + ink, 2px outlines, hard offset shadows, flat saturated data colours,
// Space Grotesk for text and Space Mono for numbers/labels.
// Every text token is >= 4.5:1 on every surface in both themes (see scripts/contrast check).

import type { TextStyle, ViewStyle } from 'react-native';

export type ThemeName = 'dark' | 'light';

export interface Palette {
  background: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  /** Hairline separators inside cards (decorative). */
  border: string;
  borderStrong: string;
  /** Ink outline for cards, inputs, chips, buttons (>= 3:1). */
  inputBorder: string;
  ink: string;
  /** Hard offset shadow colour. */
  shadow: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  /** Fill for primary actions and selected state. */
  primary: string;
  onPrimary: string;
  /** Interactive text/icons on normal surfaces (links, ghost buttons). */
  primaryText: string;
  primarySoft: string;
  accent: string;
  protein: string;
  carbs: string;
  fat: string;
  fibre: string;
  water: string;
  success: string;
  warning: string;
  danger: string;
  dangerSoft: string;
  warningSoft: string;
  infoSoft: string;
  overlay: string;
  ringTrack: string;
}

export const palettes: Record<ThemeName, Palette> = {
  light: {
    background: '#F2EEE3',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFDF6',
    surfaceSunken: '#E8E3D5',
    border: '#D9D3C3',
    borderStrong: '#0A0A0A',
    inputBorder: '#0A0A0A',
    ink: '#0A0A0A',
    shadow: '#0A0A0A',
    text: '#0A0A0A',
    textMuted: '#38352E',
    textSubtle: '#57534A',
    primary: '#C6F432',
    onPrimary: '#0A0A0A',
    primaryText: '#0A0A0A',
    primarySoft: '#E9FBB0',
    accent: '#C6F432',
    protein: '#4D7CFE',
    carbs: '#FFB020',
    fat: '#FF5DA2',
    fibre: '#2BD97C',
    water: '#22C7E8',
    success: '#13692F',
    warning: '#7A4300',
    danger: '#B30000',
    dangerSoft: '#FFD9D4',
    warningSoft: '#FFE6B3',
    infoSoft: '#DCE6FF',
    overlay: 'rgba(10, 10, 10, 0.55)',
    ringTrack: '#E8E3D5',
  },
  dark: {
    background: '#0B0B0B',
    surface: '#151515',
    surfaceRaised: '#1C1C1C',
    surfaceSunken: '#101010',
    border: '#2E2E2E',
    borderStrong: '#F2EEE3',
    inputBorder: '#F2EEE3',
    ink: '#F2EEE3',
    shadow: '#C6F432',
    text: '#F2EEE3',
    textMuted: '#C9C4B6',
    textSubtle: '#A29D90',
    primary: '#C6F432',
    onPrimary: '#0A0A0A',
    primaryText: '#C6F432',
    primarySoft: '#2A3310',
    accent: '#C6F432',
    protein: '#7EA0FF',
    carbs: '#FFB020',
    fat: '#FF7AB5',
    fibre: '#2BD97C',
    water: '#33D2F0',
    success: '#2BD97C',
    warning: '#FFB020',
    danger: '#FF6B5E',
    dangerSoft: '#3A1512',
    warningSoft: '#352508',
    infoSoft: '#141E3A',
    overlay: 'rgba(0, 0, 0, 0.7)',
    ringTrack: '#262626',
  },
};

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;

/** Icon sizes (Ionicons, one outline/filled family). */
export const iconSize = { sm: 16, md: 20, lg: 24 } as const;

/** Minimum touch target (iOS 44pt; Android 48dp is met by padding where rows are larger). */
export const minTouch = 44;

/** Near-square corners: brutalist, but friendly enough for a health app. */
export const radius = { sm: 4, md: 6, lg: 8, xl: 10, pill: 999 } as const;

export const stroke = { hairline: 1, base: 2, heavy: 3 } as const;

export const fonts = {
  display: 'SpaceGrotesk_700Bold',
  semibold: 'SpaceGrotesk_600SemiBold',
  medium: 'SpaceGrotesk_500Medium',
  regular: 'SpaceGrotesk_400Regular',
  mono: 'SpaceMono_400Regular',
  monoBold: 'SpaceMono_700Bold',
} as const;

export const typography = {
  display: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: -1.5 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.8 },
  heading: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  caption: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  overline: { fontFamily: fonts.monoBold, fontSize: 12, lineHeight: 16, letterSpacing: 1 },
  /** Big numbers: calories, weights. */
  stat: { fontFamily: fonts.monoBold, fontSize: 32, lineHeight: 36, letterSpacing: -1 },
  statSm: { fontFamily: fonts.monoBold, fontSize: 18, lineHeight: 22, letterSpacing: -0.4 },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

/** Hard offset shadow — the signature neo-brutalist depth cue (no blur). */
export function hardShadow(color: string, size = 4): ViewStyle {
  return { boxShadow: `${size}px ${size}px 0px 0px ${color}` } as ViewStyle;
}

export const layout = {
  /** Content max width on large screens so mobile-first layouts don't stretch. */
  maxContentWidth: 760,
  wideBreakpoint: 900,
} as const;
