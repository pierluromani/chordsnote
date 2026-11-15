import { SECTION_LABELS, type Section, type SectionKind } from './types';

/**
 * Keyword groups per kind, checked in this order — most specific first, so
 * e.g. "pre-coro" is caught as a prechorus before its "coro" substring can
 * match chorus. Italian, English, and the shorthand actually written on
 * charts ("rit", "strofa 2") all point at the same kind, which is the whole
 * point: free-typed names still unify onto one of the eight colours.
 */
const KIND_KEYWORDS: [SectionKind, string[]][] = [
  ['prechorus', ['prechorus', 'pre chorus', 'precoro', 'pre coro', 'preritornello', 'pre ritornello']],
  ['chorus', ['chorus', 'ritornello', 'rit', 'coro', 'refrain']],
  ['intro', ['intro', 'introduzione']],
  ['outro', ['outro', 'finale', 'coda', 'fine']],
  ['bridge', ['bridge', 'ponte']],
  ['interlude', ['interlude', 'interludio', 'stacco', 'break']],
  ['solo', ['solo', 'assolo', 'strumentale']],
  ['verse', ['verse', 'strofa', 'verso']],
];

/** Lowercased, accent-stripped, non-letters collapsed to spaces — "Strofa 2." → "strofa". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

/**
 * Guesses a section's kind from the name typed into it, so the colour still
 * tracks what the section actually is even though there's no type picker
 * anymore. Matches whole words only ("rit" doesn't fire inside "ritratto"),
 * and returns undefined for anything that doesn't look like a known kind —
 * callers should leave `kind` as it was rather than reset it to something
 * arbitrary.
 */
export function inferSectionKind(label: string): SectionKind | undefined {
  const normalized = normalize(label);
  if (!normalized) return undefined;

  for (const [kind, keywords] of KIND_KEYWORDS) {
    for (const keyword of keywords) {
      const pattern = new RegExp(`(^|\\s)${keyword}($|\\s)`);
      if (pattern.test(normalized)) return kind;
    }
  }
  return undefined;
}

/**
 * A section's display name. Numbering only appears when a kind repeats, so a
 * song with one chorus says "Ritornello" rather than "Ritornello 1".
 */
export function sectionTitle(section: Section, sections: Section[]): string {
  if (section.label) return section.label;

  const sameKind = sections.filter((other) => other.kind === section.kind);
  if (sameKind.length < 2) return SECTION_LABELS[section.kind];

  const ordinal = sameKind.indexOf(section) + 1;
  return `${SECTION_LABELS[section.kind]} ${ordinal}`;
}

/**
 * Relative size of a section, used to scale the blocks in the barcode and the
 * rail so they read as a proportional map of the arrangement.
 */
export function sectionWeight(section: Section): number {
  const lines = section.lines.filter(
    (line) => line.text.trim() !== '' || line.chords.length > 0
  ).length;
  return Math.max(1, lines);
}
