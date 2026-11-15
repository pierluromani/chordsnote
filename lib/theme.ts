/**
 * Design tokens — direction "Palco".
 *
 * A high-contrast warm light theme built for playing live: readable under stage
 * lights, no large dark fields to throw reflections, big type, almost no
 * chrome. One red accent carries every action and every chord; a single amber
 * is reserved exclusively for dynamics notes, so the moment you see amber you
 * know you're reading a performance instruction and not the song.
 */

export const palette = {
  bg: '#FAF8F6',
  surface: '#FFFFFF',
  /** Editor cards — a touch warmer than `surface`. */
  surfaceAlt: '#F2EFEC',
  /** Sheets, menus, note blocks. */
  surfaceRaised: '#F7F4F2',
  /** Icon buttons, inactive chips, avatar placeholders. */
  surfaceControl: '#F0EBE7',
  /** Stepper keys, pressed controls. */
  surfaceControlHi: '#E6DFDA',

  border: '#F7F4F2',
  /** Between rows of a list — lighter than the surface they sit on. */
  borderSoft: '#FFFFFF',
  borderCard: '#F0EBE7',
  borderControl: '#E6DFDA',
  borderDashed: '#E6DFDA',

  accent: '#D93A2B',
  accentInk: '#FAF8F6',
  accentDeep: '#C0301F',
  accentDeep2: '#E2523C',
  /** Selected chord in the editor. */
  chordHighlight: '#F7D5CF',
  /** Dashed rule under an editable chord. */
  chordUnderline: '#FBE3DF',

  text: '#1A1614',
  textSecondary: '#3A322E',
  textMuted: '#6B5F59',
  textDim: '#8A7C74',
  textFaint: '#9A8C84',
  textFainter: '#A79890',
  textGhost: '#C9BDB6',

  dynamics: '#8A6420',
  dynamicsDim: '#B4832A',

  onHero: '#FFFFFF',
  onHeroDim: '#F5BDB4',
  onHeroLabel: '#F7C9C2',

  overlay: 'rgba(0,0,0,0.05)',
  white: '#FFFFFF',
} as const;

/**
 * A hue per section type, so the shape of an arrangement is readable at a
 * glance and the same section always answers to the same colour. Ordered by
 * energy: warm greys for the framing sections, red for the chorus.
 *
 * This is the one place the "Palco" rule of a single accent is relaxed — the
 * colour is doing structural work here, not decoration, and it only ever
 * appears on section headings. Chords stay red everywhere.
 */
export const sectionColors = {
  intro: '#8A7C74',
  verse: '#6B5F59',
  prechorus: '#2A6A88',
  chorus: '#D93A2B',
  bridge: '#4A7A34',
  solo: '#B4661F',
  interlude: '#7A5E8B',
  outro: '#5A6B7A',
} as const;

/** The section hue at rule strength — a hairline, not a band of colour. */
export function sectionRule(color: string): string {
  return `${color}2E`;
}

/** Colour a personal catalog's spine, or a band catalog's initial tile. */
export const catalogColors = [
  { bar: '#D93A2B', tile: '#F7D5CF', ink: '#C0301F' },
  { bar: '#D99A2E', tile: '#FAEBD2', ink: '#8A6420' },
  { bar: '#2A6A88', tile: '#DCEAF2', ink: '#2A6A88' },
  { bar: '#5A7A28', tile: '#E6F0D4', ink: '#5A7A28' },
  { bar: '#9A3560', tile: '#FADDE7', ink: '#9A3560' },
] as const;

/** Band member avatars, assigned round-robin. */
export const memberColors = [
  { bg: '#C0301F', ink: '#FFFFFF' },
  { bg: '#2E6E8B', ink: '#FFFFFF' },
  { bg: '#7A5E8B', ink: '#FFFFFF' },
  { bg: '#F6E7C8', ink: '#1A1614' },
] as const;

/**
 * Three families, each with one job. Sora carries titles, song lyrics and
 * button labels; Hanken Grotesk every piece of metadata and every uppercase
 * micro-label; JetBrains Mono the chords, the numbering and the A–Z index —
 * anything where a fixed advance width helps the eye scan.
 */
export const font = {
  displayBlack: 'Sora_800ExtraBold',
  display: 'Sora_700Bold',
  displaySemi: 'Sora_600SemiBold',
  displayMid: 'Sora_500Medium',
  displayReg: 'Sora_400Regular',

  meta: 'HankenGrotesk_400Regular',
  metaItalic: 'HankenGrotesk_400Regular_Italic',
  metaMid: 'HankenGrotesk_500Medium',
  metaSemi: 'HankenGrotesk_600SemiBold',
  metaBold: 'HankenGrotesk_700Bold',

  mono: 'JetBrainsMono_400Regular',
  monoSemi: 'JetBrainsMono_600SemiBold',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const radius = {
  logo: 8,
  pillule: 10,
  field: 11,
  tile: 11,
  card: 13,
  cardLg: 14,
  section: 16,
  sheet: 20,
  round: 999,
} as const;

/**
 * Two shadows. The handoff specifies them at 0.45/0.6 opacity, which was tuned
 * against the dark explorations; on this warm near-white ground that reads as
 * soot, so the opacity is dialled back and the colour warmed to match the
 * screenshots.
 */
export const shadow = {
  floating: {
    shadowColor: '#5A3A30',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  sheet: {
    shadowColor: '#3A241E',
    shadowOpacity: 0.2,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 16 },
    elevation: 20,
  },
} as const;

/** The dissolve that lifts a floating bar off the content scrolling under it. */
export const fadeGradient = [
  'rgba(250,248,246,0)',
  'rgba(250,248,246,0.92)',
  palette.bg,
] as const;
