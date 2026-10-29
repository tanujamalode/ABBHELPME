// Colours follow the supplied Stitch reference. No official ABB assets are bundled.
export const colors = {
  red: '#E4002B',
  redDark: '#B80022',
  redTint: '#FDECEF',
  navy: '#0F1B33',
  navy2: '#3B4863',
  muted: '#6B7690',
  border: '#E3E7EF',
  surface: '#FFFFFF',
  bg: '#FAF8F6',
  success: '#1E8E5A',
  warning: '#C77700',
  // category pastels (never the only signal — always paired with label + icon)
  blush: '#FDE8EC',
  blue: '#E6F0FD',
  green: '#E3F5EC',
  purple: '#EEE8FB',
  teal: '#E0F4F3',
  sand: '#F1EFEC',
  orange: '#FDEFD9',
} as const;

/**
 * Icon tile accents: a soft background with a saturated foreground of the same hue.
 * Used for every icon "box" so screens share one visual language.
 */
export const accents = {
  rose: { bg: '#FDE8EC', fg: '#D1103A' },
  blue: { bg: '#E4EEFD', fg: '#2563C9' },
  violet: { bg: '#EEE8FB', fg: '#6D45C9' },
  green: { bg: '#E1F4EA', fg: '#1A8452' },
  teal: { bg: '#DDF3F1', fg: '#0E7F78' },
  amber: { bg: '#FDEFD9', fg: '#B86A00' },
  slate: { bg: '#ECEFF5', fg: '#3B4863' },
} as const;
export type Accent = keyof typeof accents;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const shadow = {
  shadowColor: '#0F1B33', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
} as const;
export const MIN_TOUCH = 48;
