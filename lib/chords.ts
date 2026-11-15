import type { Notation } from './types';

/**
 * Chords are stored canonically in Anglo notation (C, C#, Bb, Am7, F/A) and
 * converted for display. Transposition re-spells accidentals to match the key
 * it lands in, so transposing to Eb gives you Ab rather than G#.
 */

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const PITCH: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const ITALIAN_ROOTS: Record<string, string> = {
  C: 'Do',
  D: 'Re',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
};

/** Italian syllable names, longest first so "Sol" wins before "Si" can match. */
const ITALIAN_TO_ANGLO: [string, string][] = [
  ['Sol', 'G'],
  ['Do', 'C'],
  ['Re', 'D'],
  ['Mi', 'E'],
  ['Fa', 'F'],
  ['La', 'A'],
  ['Si', 'B'],
];

/**
 * The name each key is conventionally written under, indexed by pitch class.
 * Transposition picks from these rather than deriving a spelling, which is
 * what keeps E + 2 landing on F#m (three sharps) instead of Gbm (nine flats).
 */
const MAJOR_KEY_NAMES = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B',
];
const MINOR_KEY_NAMES = [
  'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm',
];

/** Major keys conventionally written with flats, plus their relative minors. */
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']);
const FLAT_MINOR_KEYS = new Set(['D', 'G', 'C', 'F', 'Bb', 'Eb']);

export type ParsedChord = {
  root: string;
  /** Everything after the root: "m", "7", "maj7", "sus4", "m7b5"… */
  quality: string;
  /** Slash-bass note, if any. */
  bass?: string;
};

const CHORD_RE = /^([A-G](?:#|b|♯|♭)?)([^/\s]*)(?:\/([A-G](?:#|b|♯|♭)?))?$/;

function normalizeAccidentals(input: string): string {
  return input.replace(/♯/g, '#').replace(/♭/g, 'b');
}

/**
 * Accepts Anglo ("Am7") or Italian ("Lam7", "Do#") spellings and returns the
 * canonical Anglo form, or null when the text isn't a chord.
 */
export function parseChord(raw: string): ParsedChord | null {
  let text = normalizeAccidentals(raw.trim());
  if (!text) return null;

  text = italianToAnglo(text);

  const match = CHORD_RE.exec(text);
  if (!match) return null;

  const [, root, quality, bass] = match;
  return {
    root: normalizeRoot(root),
    quality: quality ?? '',
    bass: bass ? normalizeRoot(bass) : undefined,
  };
}

/** Rewrites leading Italian note names (including a slash bass) to Anglo. */
function italianToAnglo(text: string): string {
  const convert = (part: string): string => {
    for (const [it, anglo] of ITALIAN_TO_ANGLO) {
      if (part.toLowerCase().startsWith(it.toLowerCase())) {
        return anglo + part.slice(it.length);
      }
    }
    return part;
  };

  const slash = text.indexOf('/');
  if (slash === -1) return convert(text);
  return convert(text.slice(0, slash)) + '/' + convert(text.slice(slash + 1));
}

function normalizeRoot(root: string): string {
  return root[0].toUpperCase() + root.slice(1);
}

export function isChord(raw: string): boolean {
  return parseChord(raw) !== null;
}

/** Chromatic index 0–11 for a note name, or null if unparseable. */
export function noteToPitch(note: string): number | null {
  const clean = normalizeAccidentals(note.trim());
  const letter = clean[0]?.toUpperCase();
  if (letter === undefined || !(letter in PITCH)) return null;

  let pitch = PITCH[letter];
  for (const char of clean.slice(1)) {
    if (char === '#') pitch += 1;
    else if (char === 'b') pitch -= 1;
    else break;
  }
  return ((pitch % 12) + 12) % 12;
}

export function pitchToNote(pitch: number, useFlats: boolean): string {
  const index = ((pitch % 12) + 12) % 12;
  return useFlats ? FLAT_NAMES[index] : SHARP_NAMES[index];
}

export type ParsedKey = { root: string; minor: boolean };

/** Splits a key signature like "F#m" into its root and mode. */
export function parseKey(key: string): ParsedKey {
  const clean = normalizeAccidentals((key ?? '').trim());
  const match = /^([A-G](?:#|b)?)(.*)$/.exec(clean);
  if (!match) return { root: 'C', minor: false };

  const rest = match[2] ?? '';
  // "m" means minor, but "maj" does not.
  const minor = /^m(?!aj)/i.test(rest) || /^-/.test(rest);
  return { root: normalizeRoot(match[1]), minor };
}

export function formatKey(key: string, notation: Notation): string {
  const { root, minor } = parseKey(key);
  return displayRoot(root, notation) + (minor ? 'm' : '');
}

/** Whether a key is conventionally spelled with flats. */
export function keyPrefersFlats(key: string): boolean {
  const { root, minor } = parseKey(key);
  if (root.includes('b')) return true;
  if (root.includes('#')) return false;
  return minor ? FLAT_MINOR_KEYS.has(root) : FLAT_KEYS.has(root);
}

function displayRoot(root: string, notation: Notation): string {
  if (notation === 'anglo') return root;
  const letter = root[0].toUpperCase();
  const accidental = root.slice(1);
  return (ITALIAN_ROOTS[letter] ?? letter) + accidental;
}

/**
 * Renders a stored chord for display. `semitones` shifts it; `useFlats` picks
 * the spelling. Text that doesn't parse as a chord is passed through untouched
 * so free-form annotations like "N.C." survive.
 */
export function formatChord(
  raw: string,
  options: { notation?: Notation; semitones?: number; useFlats?: boolean } = {}
): string {
  const { notation = 'anglo', semitones = 0, useFlats = false } = options;

  const parsed = parseChord(raw);
  if (!parsed) return raw;

  const root = shiftNote(parsed.root, semitones, useFlats);
  const bass = parsed.bass ? shiftNote(parsed.bass, semitones, useFlats) : undefined;

  let out = displayRoot(root, notation) + parsed.quality;
  if (bass) out += '/' + displayRoot(bass, notation);
  return out;
}

function shiftNote(note: string, semitones: number, useFlats: boolean): string {
  const pitch = noteToPitch(note);
  if (pitch === null) return note;
  if (semitones === 0) {
    // Keep the original spelling when not transposing — the user's choice of
    // F# vs Gb is information we shouldn't discard.
    return note;
  }
  return pitchToNote(pitch + semitones, useFlats);
}

/** Transposes a key signature, returning canonical Anglo form. */
export function transposeKey(key: string, semitones: number): string {
  const { root, minor } = parseKey(key);
  const pitch = noteToPitch(root);
  if (pitch === null) return key;

  const target = ((pitch + semitones) % 12 + 12) % 12;
  return minor ? MINOR_KEY_NAMES[target] : MAJOR_KEY_NAMES[target];
}

/** Every key a song can be set to, in circle-of-fifths-friendly order. */
export function keyOptions(minor: boolean): string[] {
  return minor ? [...MINOR_KEY_NAMES] : [...MAJOR_KEY_NAMES];
}

const MAJOR_DEGREES = [0, 2, 4, 5, 7, 9, 11];
const MAJOR_QUALITIES = ['', 'm', 'm', '', '', 'm', 'dim'];
const MINOR_DEGREES = [0, 2, 3, 5, 7, 8, 10];
const MINOR_QUALITIES = ['m', 'dim', '', 'm', 'm', '', ''];

export const ROMAN_MAJOR = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
export const ROMAN_MINOR = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];

/**
 * The same seven degrees in the Nashville number system — the way a session
 * player calls them out, so the chart reads the same in any key.
 */
export const NASHVILLE_MAJOR = ['1', '2m', '3m', '4', '5', '6m', '7°'];
export const NASHVILLE_MINOR = ['1m', '2°', '3', '4m', '5m', '6', '7'];

/**
 * The seven chords that belong to a key. The chord picker leads with these
 * because they're what you actually reach for nine times out of ten.
 */
export function diatonicChords(
  key: string
): { chord: string; roman: string; number: string }[] {
  const { root, minor } = parseKey(key);
  const tonic = noteToPitch(root);
  if (tonic === null) return [];

  const useFlats = keyPrefersFlats(key);
  const degrees = minor ? MINOR_DEGREES : MAJOR_DEGREES;
  const qualities = minor ? MINOR_QUALITIES : MAJOR_QUALITIES;
  const romans = minor ? ROMAN_MINOR : ROMAN_MAJOR;
  const numbers = minor ? NASHVILLE_MINOR : NASHVILLE_MAJOR;

  return degrees.map((degree, i) => ({
    chord: pitchToNote(tonic + degree, useFlats) + qualities[i],
    roman: romans[i],
    number: numbers[i],
  }));
}

/** Root buttons for the picker, spelled to suit the song's key. */
export function rootOptions(useFlats: boolean): string[] {
  return useFlats ? [...FLAT_NAMES] : [...SHARP_NAMES];
}

export const QUALITY_OPTIONS = [
  { value: '', label: 'maj' },
  { value: 'm', label: 'min' },
  { value: '7', label: '7' },
  { value: 'm7', label: 'm7' },
  { value: 'maj7', label: 'maj7' },
  { value: 'sus4', label: 'sus4' },
  { value: 'sus2', label: 'sus2' },
  { value: '6', label: '6' },
  { value: 'm6', label: 'm6' },
  { value: '9', label: '9' },
  { value: 'add9', label: 'add9' },
  { value: 'dim', label: 'dim' },
  { value: 'aug', label: 'aug' },
  { value: 'm7b5', label: 'm7b5' },
  { value: '5', label: '5' },
] as const;

/** Semitone distance from `from` up to `to`, as a signed value in [-6, 6]. */
export function semitonesBetween(from: string, to: string): number {
  const a = noteToPitch(parseKey(from).root);
  const b = noteToPitch(parseKey(to).root);
  if (a === null || b === null) return 0;

  let diff = (b - a) % 12;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  return diff;
}

/** "+2" / "-3" / "Originale" — the label on the transpose control. */
export function transposeLabel(semitones: number): string {
  if (semitones === 0) return 'Originale';
  return semitones > 0 ? `+${semitones}` : `${semitones}`;
}
