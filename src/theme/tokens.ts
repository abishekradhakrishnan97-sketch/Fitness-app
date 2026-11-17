// Design tokens. Dark is the primary theme; light mirrors it with contrast-checked values.

export type ThemeName = 'dark' | 'light';

export interface Palette {
  background: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  border: string;
  borderStrong: string;
  /** Outline for inputs and selectable chips: >= 3:1 against surfaces (WCAG 1.4.11). */
  inputBorder: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  primary: string;
  onPrimary: string;
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
  dark: {
    background: '#0A0C0F',
    surface: '#12151A',
    surfaceRaised: '#191D24',
    surfaceSunken: '#0E1014',
    border: '#232831',
    borderStrong: '#323944',
    inputBorder: '#5C687D',
    text: '#F3F5F8',
    textMuted: '#A3ACB9',
    textSubtle: '#7D8795',
    primary: '#C8F23C',
    onPrimary: '#0A0C0F',
    primarySoft: 'rgba(200, 242, 60, 0.12)',
    accent: '#C8F23C',
    protein: '#5CC2FF',
    carbs: '#FFB84D',
    fat: '#FF7AA2',
    fibre: '#7EE3A0',
    water: '#4DD4EC',
    success: '#4ADE80',
    warning: '#FFB84D',
    danger: '#FF6363',
    dangerSoft: 'rgba(255, 99, 99, 0.12)',
    warningSoft: 'rgba(255, 184, 77, 0.12)',
    infoSoft: 'rgba(92, 194, 255, 0.10)',
    overlay: 'rgba(0, 0, 0, 0.6)',
    ringTrack: '#1E232B',
  },
  light: {
    background: '#F5F6F8',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    surfaceSunken: '#ECEFF3',
    border: '#E2E6EC',
    borderStrong: '#CBD2DC',
    inputBorder: '#798BA5',
    text: '#0D1015',
    textMuted: '#515B69',
    textSubtle: '#626C7A',
    primary: '#2E5A00',
    onPrimary: '#FFFFFF',
    primarySoft: 'rgba(46, 90, 0, 0.08)',
    accent: '#76A800',
    protein: '#166DB8',
    carbs: '#9B5C00',
    fat: '#C62D5F',
    fibre: '#207B36',
    water: '#097686',
    success: '#1A7B36',
    warning: '#9B5D00',
    danger: '#C62828',
    dangerSoft: 'rgba(198, 40, 40, 0.08)',
    warningSoft: 'rgba(179, 107, 0, 0.09)',
    infoSoft: 'rgba(26, 127, 214, 0.08)',
    overlay: 'rgba(13, 16, 21, 0.45)',
    ringTrack: '#E7EBF0',
  },
};

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;

/** Icon sizes (Ionicons, one outline/filled family). */
export const iconSize = { sm: 16, md: 20, lg: 24 } as const;

/** Minimum touch target (iOS 44pt; Android 48dp is met by padding where rows are larger). */
export const minTouch = 44;

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.8 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.4 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400', letterSpacing: 0 },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: 0 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.2 },
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.2 },
} as const;

export type TypographyVariant = keyof typeof typography;

export const layout = {
  /** Content max width on large screens so mobile-first layouts don't stretch. */
  maxContentWidth: 760,
  wideBreakpoint: 900,
} as const;
