/**
 * Syllable splitting, so tapping a line offers real syllable-sized targets
 * rather than whole words. Tuned for Italian (where the rules are regular
 * enough to get right) and degrades to something sensible for English.
 *
 * This is a heuristic, not a linguistic model: the cost of an imperfect split
 * is a chord anchored one letter off, which the user can nudge.
 */

const VOWELS = 'aeiouàèéìíòóùúâêîôûäëïöü';
const STRONG_VOWELS = 'aeoàèéòó';

/** Consonant clusters that can legally open an Italian syllable. */
const VALID_ONSETS = new Set([
  'bl', 'br', 'ch', 'cl', 'cr', 'dr', 'fl', 'fr', 'gh', 'gl', 'gn', 'gr',
  'pl', 'pr', 'ps', 'qu', 'sc', 'sf', 'sg', 'sl', 'sm', 'sn', 'sp', 'sq',
  'sr', 'st', 'sv', 'tr', 'th', 'sh', 'wh', 'ph', 'wr',
]);

const isVowel = (char: string) => VOWELS.includes(char.toLowerCase());
const isStrongVowel = (char: string) => STRONG_VOWELS.includes(char.toLowerCase());

/** A chunk of a line, with the character offset it starts at. */
export type Chunk = {
  text: string;
  start: number;
};

export type Word = {
  text: string;
  start: number;
  syllables: Chunk[];
};

/**
 * Splits a single word into syllables. Returns offsets relative to the word.
 */
export function syllabify(word: string): Chunk[] {
  if (word.length <= 1) return [{ text: word, start: 0 }];

  // Walk the word into alternating consonant clusters and vowel nuclei.
  const nuclei: { start: number; end: number }[] = [];
  let i = 0;
  while (i < word.length) {
    if (!isVowel(word[i])) {
      i += 1;
      continue;
    }
    const start = i;
    while (i < word.length && isVowel(word[i])) i += 1;
    // Hiatus: two strong vowels belong to separate syllables ("po-e-ta"),
    // whereas a glide with i/u stays fused as a diphthong ("pie-de").
    let cursor = start;
    for (let j = start + 1; j < i; j += 1) {
      if (isStrongVowel(word[j]) && isStrongVowel(word[j - 1])) {
        nuclei.push({ start: cursor, end: j });
        cursor = j;
      }
    }
    nuclei.push({ start: cursor, end: i });
  }

  if (nuclei.length <= 1) return [{ text: word, start: 0 }];

  // Place a break inside each consonant cluster between two nuclei.
  const breaks: number[] = [];
  for (let n = 0; n < nuclei.length - 1; n += 1) {
    const clusterStart = nuclei[n].end;
    const clusterEnd = nuclei[n + 1].start;
    const cluster = word.slice(clusterStart, clusterEnd).toLowerCase();

    if (cluster.length === 0) {
      // Hiatus — break straight between the vowels.
      breaks.push(clusterStart);
    } else if (cluster.length === 1) {
      // A lone consonant opens the next syllable: "ca-sa".
      breaks.push(clusterStart);
    } else if (VALID_ONSETS.has(cluster)) {
      // The whole cluster can open a syllable: "fi-glio", "ma-gna".
      breaks.push(clusterStart);
    } else if (cluster[0] === 's' && !isVowel(cluster[1])) {
      // s + consonant travels with the following vowel: "pa-sta".
      breaks.push(clusterStart);
    } else if (VALID_ONSETS.has(cluster.slice(-2))) {
      // Tail of the cluster is a legal onset: "con-tro", "sem-pre".
      breaks.push(clusterEnd - 2);
    } else {
      // Anything else splits before the last consonant: "mam-ma", "por-ta".
      breaks.push(clusterEnd - 1);
    }
  }

  const chunks: Chunk[] = [];
  let prev = 0;
  for (const point of breaks) {
    if (point <= prev || point >= word.length) continue;
    chunks.push({ text: word.slice(prev, point), start: prev });
    prev = point;
  }
  chunks.push({ text: word.slice(prev), start: prev });

  return chunks.filter((chunk) => chunk.text.length > 0);
}

/**
 * Splits a line into words (keeping trailing whitespace attached so spacing
 * survives the render) and syllabifies each. Offsets are absolute within the
 * line, which is what chord anchors are stored against.
 */
export function splitLine(text: string): Word[] {
  const words: Word[] = [];
  const pattern = /\S+\s*/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const raw = match[0];
    const start = match.index;
    const core = raw.trimEnd();
    const trailing = raw.slice(core.length);

    const syllables = syllabify(core).map((chunk) => ({
      text: chunk.text,
      start: start + chunk.start,
    }));

    // Whitespace rides on the final syllable so words keep their gap.
    if (trailing && syllables.length > 0) {
      syllables[syllables.length - 1] = {
        ...syllables[syllables.length - 1],
        text: syllables[syllables.length - 1].text + trailing,
      };
    }

    words.push({ text: raw, start, syllables });
  }

  return words;
}

/**
 * Subdivides syllables further at any anchor position that lands mid-syllable,
 * so a chord always sits exactly over the character it's pinned to. Used by the
 * renderer after `splitLine`.
 */
export function applyAnchors(words: Word[], positions: number[]): Word[] {
  const sorted = [...new Set(positions)].sort((a, b) => a - b);
  if (sorted.length === 0) return words;

  return words.map((word) => {
    const syllables: Chunk[] = [];

    for (const syllable of word.syllables) {
      const end = syllable.start + syllable.text.length;
      const inner = sorted.filter((p) => p > syllable.start && p < end);

      if (inner.length === 0) {
        syllables.push(syllable);
        continue;
      }

      let cursor = syllable.start;
      for (const point of inner) {
        syllables.push({
          text: syllable.text.slice(cursor - syllable.start, point - syllable.start),
          start: cursor,
        });
        cursor = point;
      }
      syllables.push({
        text: syllable.text.slice(cursor - syllable.start),
        start: cursor,
      });
    }

    return { ...word, syllables };
  });
}

/**
 * Remaps chord anchors after the lyric text is edited, by matching the common
 * prefix and suffix around the change. Handles the common cases — typing at
 * the end, fixing a typo mid-line — without losing every chord on the line.
 */
export function remapPositions(before: string, after: string, positions: number[]): number[] {
  if (before === after) return positions;

  let prefix = 0;
  const maxPrefix = Math.min(before.length, after.length);
  while (prefix < maxPrefix && before[prefix] === after[prefix]) prefix += 1;

  let suffix = 0;
  const maxSuffix = Math.min(before.length - prefix, after.length - prefix);
  while (
    suffix < maxSuffix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const delta = after.length - before.length;
  const changeEnd = before.length - suffix;

  return positions.map((pos) => {
    if (pos <= prefix) return pos;
    if (pos >= changeEnd) return Math.max(0, Math.min(after.length, pos + delta));
    // The anchor sat inside the edited span — pin it to the start of the edit.
    return prefix;
  });
}
