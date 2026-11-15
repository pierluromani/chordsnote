import { formatChord, keyPrefersFlats, parseChord, transposeKey } from './chords';
import { uid } from './id';
import { inferSectionKind, sectionTitle } from './sections';
import {
  formatDuration,
  type ChordAnchor,
  type Line,
  type Notation,
  type Section,
  type SectionKind,
  type Song,
} from './types';

/**
 * ChordPro (https://www.chordpro.org) in and out: `[C]`-bracketed inline
 * chords, `{directive: value}` metadata, `{start_of_x}`/`{end_of_x}` section
 * blocks. `toChordPro` and `parseChordPro` are exact inverses of each other on
 * a song this app wrote — that round trip is what the seed library and the
 * "Esporta" sheet both lean on.
 */

export type ParsedSong = Omit<Song, 'id' | 'createdAt' | 'updatedAt'>;

export type ChordProResult = {
  /** Directive text that didn't match anything this parser understands. */
  warnings: string[];
  song: ParsedSong;
};

type ChordProOptions = {
  semitones?: number;
  notation?: Notation;
  /** Off omits chord lines — lyrics only. Defaults to true. Only `toPlainText` reads this; a chordless ChordPro file would defeat the format's point. */
  chords?: boolean;
};


/** Strips `[chord]` tokens out of a line, keeping their offsets in the plain text. */
export function extractChords(rawLine: string): { text: string; chords: ChordAnchor[] } {
  const chords: ChordAnchor[] = [];
  let text = '';
  let i = 0;
  while (i < rawLine.length) {
    if (rawLine[i] === '[') {
      const end = rawLine.indexOf(']', i);
      if (end !== -1) {
        const chord = rawLine.slice(i + 1, end).trim();
        if (chord) chords.push({ id: uid('c'), pos: text.length, chord });
        i = end + 1;
        continue;
      }
    }
    text += rawLine[i];
    i += 1;
  }
  return { text, chords };
}

/**
 * The section-kind guesser the editor already uses when you rename a section.
 * Sharing it means an imported "Ritornello 2" lands on the same colour it
 * would have if you had typed the name in by hand.
 */
function classify(label: string): SectionKind | undefined {
  return inferSectionKind(label);
}

/** `{start_of_X}` block names, plus the shorthand forms. */
const BLOCK_KINDS: Record<string, SectionKind> = {
  verse: 'verse',
  chorus: 'chorus',
  bridge: 'bridge',
  intro: 'intro',
  outro: 'outro',
  prechorus: 'prechorus',
  interlude: 'interlude',
  solo: 'solo',
  instrumental: 'solo',
  tab: 'solo',
  sov: 'verse',
  soc: 'chorus',
  sob: 'bridge',
  sot: 'solo',
};

/**
 * One whitespace-separated token that is unmistakably a chord. Deliberately
 * strict, and Anglo-only: it decides whether a whole line is a row of chords
 * sitting above a lyric, so a false positive would swallow a line of words.
 * "Backbeat" and "And" must not match here even though they open on a note
 * letter, which is why the quality has to be a known suffix rather than any
 * trailing text.
 */
const QUALITY = String.raw`(?:maj|min|m|dim|aug|sus|add|\+)?\d*(?:sus\d?|add\d+|maj\d+|m\d+|[#b]\d+|\d+)*`;
const CHORD_TOKEN = new RegExp(`^[A-G][#b]?${QUALITY}(?:/[A-G][#b]?)?$`);

/** The same, in Italian note names — "La", "Sol7", "Lam/Do". */
const ITALIAN_NOTE = '(?:Do|Re|Mi|Fa|Sol|La|Si)';
const ITALIAN_CHORD_TOKEN = new RegExp(
  `^${ITALIAN_NOTE}[#b]?${QUALITY}(?:/${ITALIAN_NOTE}[#b]?)?$`,
  'i'
);

/** Whether one bare token reads as a chord name, in either notation. */
export function looksLikeChord(token: string): boolean {
  return CHORD_TOKEN.test(token) || ITALIAN_CHORD_TOKEN.test(token);
}

/** A line made only of chords — the top half of a chord-over-lyrics chart. */
function isChordRow(line: string): boolean {
  const trimmed = line.trim();
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  if (tokens.every((token) => CHORD_TOKEN.test(token))) return true;

  // Italian note names double as ordinary words — "la la la" is a lyric, not a
  // bar of A. Only read them as chords when the line is spaced out the way a
  // chord row is, which a sung line never is.
  if (!/ {2,}/.test(trimmed)) return false;
  return tokens.every((token) => ITALIAN_CHORD_TOKEN.test(token));
}

/**
 * Chords are stored in Anglo notation whatever the file used, matching what
 * the picker writes — so an imported "Lam7" comes back out as Am7. Anything that
 * isn't a chord ("N.C.") is left exactly as written.
 */
function canonicalChord(raw: string): string {
  const parsed = parseChord(raw);
  if (!parsed) return raw;
  return parsed.root + parsed.quality + (parsed.bass ? `/${parsed.bass}` : '');
}

/**
 * Strips `[chord]` tokens out of a line typed or pasted into the editor's
 * lyrics field, leaving non-chord brackets (`[x2]`, `[coro]`) untouched in the
 * lyric text.
 */
export function extractInlineChords(rawLine: string): {
  text: string;
  chords: ChordAnchor[];
  instrumental?: boolean;
} {
  const chords: ChordAnchor[] = [];
  let text = '';
  let i = 0;
  while (i < rawLine.length) {
    if (rawLine[i] === '[') {
      const end = rawLine.indexOf(']', i);
      if (end !== -1) {
        const inside = rawLine.slice(i + 1, end).trim();
        const tokens = inside.split(/\s+/).filter(Boolean);
        if (tokens.length > 0 && tokens.every(looksLikeChord)) {
          for (const token of tokens) {
            chords.push({ id: uid('c'), pos: text.length, chord: canonicalChord(token) });
          }
          i = end + 1;
          continue;
        }
      }
    }
    text += rawLine[i];
    i += 1;
  }
  if (text.trim() === '' && chords.length > 0) {
    return {
      text: '',
      instrumental: true,
      chords: chords.map((chord, index) => ({ ...chord, pos: index })),
    };
  }
  return { text, chords };
}

/** Each chord on a chord row, with the column it starts at. */
function chordRow(line: string): { pos: number; chord: string }[] {
  const out: { pos: number; chord: string }[] = [];
  const pattern = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    out.push({ pos: match.index, chord: match[0] });
  }
  return out;
}

/** `## Verse 1` — a heading, once a page has been rendered down to text. */
const HEADING = /^#{1,6}\s+(.+)$/;

/**
 * A line that names a section rather than carrying one. Charts found in the
 * wild write these four ways — `[Verse 1]`, `## Verse 1`, `Ritornello:`, or a
 * bare `CHORUS` — and the bracketed form is the one that matters most, because
 * otherwise it parses as an inline chord called "Verse 1".
 */
function sectionHeader(line: string): { kind: SectionKind; label: string } | undefined {
  const trimmed = line.trim();
  if (!trimmed) return undefined;

  // Forms that announce themselves as headings — brackets on their own line,
  // or a markdown heading mark. Their text is taken at face value; only
  // whether it names a section still has to be decided.
  const marked =
    /^\[([^\]]+)\]$/.exec(trimmed)?.[1] ?? HEADING.exec(trimmed)?.[1];
  if (marked !== undefined) {
    const label = marked.trim();
    const kind = classify(label);
    return kind ? { kind, label } : undefined;
  }

  // Unmarked: only a short line, and only when it's punctuated or shouted like
  // a heading, so an ordinary lyric can never be mistaken for one.
  const colon = trimmed.endsWith(':');
  const label = (colon ? trimmed.slice(0, -1) : trimmed).trim();
  if (!label || label.split(/\s+/).length > 3) return undefined;
  if (!colon && label !== label.toUpperCase()) return undefined;

  const kind = classify(label);
  return kind ? { kind, label } : undefined;
}

/** "4:12" or a bare seconds count → seconds. */
function parseDuration(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const clock = /^(\d+):(\d{1,2})$/.exec(raw.trim());
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

/**
 * Reads a chart in either of the two shapes people actually have: ChordPro,
 * with `[C]` chords inline and `{}` directives, or the plain chord-over-lyrics
 * layout every tab site prints, where a row of chords sits above the line it
 * belongs to. Both are handled in one pass rather than sniffed up front, so a
 * file that mixes them — a ChordPro export with a row of chords over a lyric —
 * still comes through whole.
 *
 * The one thing decided about the file as a whole is whether it names its own
 * sections. Once it has named even one, its directives are taken as the only
 * word on where sections begin, and the guesswork that reads a heading out of
 * a bare line is put away: in a chart that says where the chorus starts, a
 * line reading "[finale rallentato]" is a remark, not a new section.
 */
export function parseChordPro(source: string): ChordProResult {
  const warnings: string[] = [];
  const meta: {
    title?: string;
    artist?: string;
    key?: string;
    bpm?: string;
    capo?: string;
    duration?: string;
  } = {};
  const sections: Section[] = [];
  let current: Section | null = null;

  /**
   * Whether the file names its own sections with directives.
   *
   * It changes how the rest of the page is read. A chart that marks its
   * sections has already said where each one begins, so a blank line between
   * two stanzas is a breath inside a section rather than the end of it, and a
   * line in brackets is something written into the section, not a new heading.
   * A bare tab-site chart says none of that, and there the blank line and the
   * bracket are all there is to go on.
   */
  let declared = false;

  const openSection = (kind: SectionKind, label?: string): Section => {
    const section: Section = { id: uid('s'), kind, label, lines: [] };
    sections.push(section);
    return section;
  };

  /** A section a directive asked for, by name. */
  const declareSection = (kind: SectionKind, label?: string): Section => {
    declared = true;
    return openSection(kind, label);
  };

  const rows = source.split(/\r?\n/).map((line) => line.replace(/\t/g, '    ').trimEnd());

  for (let i = 0; i < rows.length; i += 1) {
    let line = rows[i];
    const directive = /^\s*\{\s*([^:}]+?)\s*(?::\s*([^}]*?))?\s*\}\s*$/.exec(line);

    if (directive) {
      let name = directive[1].toLowerCase().replace(/[\s-]+/g, '_');
      let value = (directive[2] ?? '').trim();

      /**
       * `{meta: name value}` — the standard's catch-all directive, and the one
       * MySongBook writes everything through, section names included. Unpacking
       * it into the name and value it carries lets every branch below answer
       * for both spellings at once.
       */
      if (name === 'meta') {
        const space = value.search(/\s/);
        name = (space === -1 ? value : value.slice(0, space))
          .toLowerCase()
          .replace(/[\s-]+/g, '_');
        value = space === -1 ? '' : value.slice(space + 1).trim();
      }

      if (name === 'section') {
        // "Chorus Pietro E Danilo" — the name is kept whole, because whoever
        // wrote who sings it there meant it to be read on stage. Only the
        // colour comes from the word inside it.
        current = declareSection(classify(value) ?? 'verse', value || undefined);
      } else if (['title', 't'].includes(name)) meta.title = value;
      else if (['artist', 'subtitle', 'st', 'a'].includes(name)) meta.artist = value;
      else if (name === 'key') meta.key = value;
      else if (['tempo', 'bpm'].includes(name)) meta.bpm = value;
      else if (name === 'capo') meta.capo = value;
      else if (name === 'duration' || name === 'length') meta.duration = value;
      else if (name === 'dynamics') {
        if (current) {
          if (current.lines.length > 0) {
            const last = current.lines[current.lines.length - 1];
            last.dynamics = last.dynamics ? `${last.dynamics} · ${value}` : value;
          } else {
            current.dynamics = value;
          }
        }
      } else if (name === 'label') {
        // ChordPro's own way of naming the block you're inside.
        declared = true;
        if (current) current.label = value || undefined;
        else current = openSection('verse', value || undefined);
      } else if (name === 'comment' || name === 'c' || name === 'ci' || name === 'cb') {
        /**
         * In the standard a comment is an annotation, but in practice it is
         * how most files write a section title — and a title that lands in
         * the dynamics note is a title the user has lost. So anything short
         * enough to be a name starts a section, whether or not it's a word we
         * recognise ("Estribillo", "Parte A"); only something long enough to
         * be a real remark is kept as a note on the section it sits in.
         */
        const kind = classify(value);
        if (kind) current = declareSection(kind, value);
        else if (!value) continue;
        else if (value.split(/\s+/).length <= 4) current = declareSection('verse', value);
        else if (current && !current.dynamics) current.dynamics = value;
        else current = declareSection('verse', value);
      } else if (name.startsWith('start_of_') || ['sov', 'soc', 'sob', 'sot'].includes(name)) {
        const kind = BLOCK_KINDS[name.replace('start_of_', '')];
        if (kind) current = declareSection(kind, value || undefined);
      } else if (name.startsWith('end_of_') || ['eov', 'eoc', 'eob', 'eot'].includes(name)) {
        current = null;
      }
      continue;
    }

    if (line.trim() === '') {
      // Only a file that leaves its sections unnamed ends one here: where the
      // sections are declared, a gap between two stanzas of the same chorus
      // would otherwise cut it in half.
      if (!declared && current && current.lines.length > 0) current = null;
      continue;
    }

    /**
     * A line that is nothing but brackets, inside a chart that names its own
     * sections: it's an instruction written into the section — "[carica
     * batteria]" — and it belongs in the amber note. Left alone it would parse
     * as a chord by that name, or worse, steal a section heading, since half
     * these remarks ("finale rallentato") read like one.
     */
    const bracketed = /^\[([^\]]+)\]$/.exec(line.trim())?.[1]?.trim();
    if (declared && bracketed && !looksLikeChord(bracketed)) {
      const section = current ?? (current = openSection('verse'));
      if (section.lines.length > 0) {
        const last = section.lines[section.lines.length - 1];
        last.dynamics = last.dynamics ? `${last.dynamics} · ${bracketed}` : bracketed;
      } else {
        section.dynamics = section.dynamics ? `${section.dynamics} · ${bracketed}` : bracketed;
      }
      continue;
    }

    const header = declared ? undefined : sectionHeader(line);
    if (header) {
      current = openSection(header.kind, header.label);
      continue;
    }

    // A heading that names nothing we know is still not lyrics with hashes in
    // front of them — drop the marks and keep the words.
    line = line.replace(HEADING, '$1');

    const section = current ?? (current = openSection('verse'));

    // A row of bare chords: it belongs to the lyric underneath it, unless
    // there is no lyric underneath — then it's a bar of chords on its own.
    if (isChordRow(line)) {
      const next = rows[i + 1] ?? '';
      const pairs = chordRow(line);
      const lyricFollows =
        next.trim() !== '' &&
        !isChordRow(next) &&
        !sectionHeader(next) &&
        !/^\s*\{/.test(next) &&
        !next.includes('[');

      // Positions are left as written even when they run past the end of the
      // lyric: a chord hanging off the end of a line is a real thing on a
      // chart, and the renderer already has a place to put it.
      const anchors = pairs.map((pair) => ({
        id: uid('c'),
        pos: pair.pos,
        chord: canonicalChord(pair.chord),
      }));

      if (lyricFollows) {
        section.lines.push({ id: uid('l'), text: next, chords: anchors });
        i += 1;
      } else {
        section.lines.push({ id: uid('l'), text: '', instrumental: true, chords: anchors });
      }
      continue;
    }

    const { text, chords } = extractChords(line);
    const parsedLine: Line = {
      id: uid('l'),
      text: text.trimEnd(),
      chords: chords.map((chord) => ({ ...chord, chord: canonicalChord(chord.chord) })),
    };
    if (parsedLine.text.trim() === '' && chords.length > 0) {
      parsedLine.instrumental = true;
      // `[C][G][Am]` written with nothing between them all extract at offset
      // zero. On a bar of chords `pos` is only the running order, so spread
      // them out rather than leaving the order resting on a tie-break.
      parsedLine.chords = parsedLine.chords.map((chord, index) => ({ ...chord, pos: index }));
    }
    section.lines.push(parsedLine);
  }

  const nonEmpty = sections.filter((section) => section.lines.length > 0);

  return {
    warnings,
    song: {
      title: meta.title || 'Senza titolo',
      artist: meta.artist || '',
      key: meta.key || 'C',
      bpm: (meta.bpm && Number(meta.bpm)) || undefined,
      capo: (meta.capo && Number(meta.capo)) || undefined,
      duration: parseDuration(meta.duration),
      catalogId: '',
      favorite: false,
      sections: nonEmpty.length > 0 ? nonEmpty : [{ id: uid('s'), kind: 'verse', lines: [] }],
    },
  };
}

function chordAt(song: Song, chord: string, options: ChordProOptions): string {
  const semitones = options.semitones ?? 0;
  const key = transposeKey(song.key, semitones);
  return formatChord(chord, {
    notation: options.notation ?? 'anglo',
    semitones,
    useFlats: keyPrefersFlats(key),
  });
}

/** Formats one section's lines with inline `[Chord]` brackets for copying/pasting. */
export function sectionToChordProLines(
  song: Song,
  section: Section,
  options: ChordProOptions = {}
): string {
  return section.lines
    .map((rawLine) => {
      const ordered = [...rawLine.chords].sort((a, b) => a.pos - b.pos);
      if (rawLine.text.trim() === '' && ordered.length > 0) {
        return ordered.map((chord) => `[${chordAt(song, chord.chord, options)}]`).join(' ');
      }
      let text = '';
      let cursor = 0;
      for (const chord of ordered) {
        const pos = Math.max(0, Math.min(rawLine.text.length, chord.pos));
        text += rawLine.text.slice(cursor, pos);
        text += `[${chordAt(song, chord.chord, options)}]`;
        cursor = pos;
      }
      text += rawLine.text.slice(cursor);
      return text;
    })
    .join('\n');
}

/** A song as ChordPro text — the exact format `parseChordPro` reads back in. */
export function toChordPro(song: Song, options: ChordProOptions = {}): string {
  const lines: string[] = [];
  lines.push(`{title: ${song.title}}`);
  if (song.artist) lines.push(`{artist: ${song.artist}}`);
  lines.push(`{key: ${transposeKey(song.key, options.semitones ?? 0)}}`);
  if (song.bpm) lines.push(`{tempo: ${song.bpm}}`);
  if (song.capo) lines.push(`{capo: ${song.capo}}`);
  if (song.duration) lines.push(`{duration: ${formatDuration(song.duration)}}`);
  lines.push('');

  song.sections.forEach((section) => {
    const title = sectionTitle(section, song.sections);
    lines.push(`{start_of_${section.kind}: ${title}}`);
    if (section.dynamics) lines.push(`{dynamics: ${section.dynamics}}`);

    for (const rawLine of section.lines) {
      const ordered = [...rawLine.chords].sort((a, b) => a.pos - b.pos);

      // A bar of chords has no lyric to hang them on, so write them spaced
      // out — packed together they would all read back at position 0 and
      // lose the order they were played in.
      if (rawLine.text.trim() === '' && ordered.length > 0) {
        lines.push(ordered.map((chord) => `[${chordAt(song, chord.chord, options)}]`).join(' '));
        if (rawLine.dynamics) lines.push(`{dynamics: ${rawLine.dynamics}}`);
        continue;
      }

      let text = '';
      let cursor = 0;
      for (const chord of ordered) {
        const pos = Math.max(0, Math.min(rawLine.text.length, chord.pos));
        text += rawLine.text.slice(cursor, pos);
        text += `[${chordAt(song, chord.chord, options)}]`;
        cursor = pos;
      }
      text += rawLine.text.slice(cursor);
      lines.push(text);
      if (rawLine.dynamics) lines.push(`{dynamics: ${rawLine.dynamics}}`);
    }

    lines.push(`{end_of_${section.kind}}`);
    lines.push('');
  });

  return lines.join('\n').trimEnd() + '\n';
}

/** A song as a plain, print-friendly chart — chords on their own line, above the lyric. */
export function toPlainText(song: Song, options: ChordProOptions = {}): string {
  const { chords: showChords = true } = options;
  const lines: string[] = [];
  const key = transposeKey(song.key, options.semitones ?? 0);

  lines.push(song.title.toUpperCase());
  if (song.artist) lines.push(song.artist);

  const meta = [`Tonalità: ${key}`];
  if (song.bpm) meta.push(`${song.bpm} bpm`);
  if (song.capo) meta.push(`Capo ${song.capo}`);
  if (song.duration) meta.push(formatDuration(song.duration)!);
  lines.push(meta.join('  ·  '));
  lines.push('');

  song.sections.forEach((section) => {
    lines.push(`[${sectionTitle(section, song.sections).toUpperCase()}]`);
    if (section.dynamics) lines.push(`(${section.dynamics})`);

    for (const rawLine of section.lines) {
      const chords = showChords ? [...rawLine.chords].sort((a, b) => a.pos - b.pos) : [];
      if (chords.length > 0) {
        let chordLine = '';
        for (const chord of chords) {
          const label = chordAt(song, chord.chord, options);
          const pos = Math.max(0, Math.min(rawLine.text.length, chord.pos));
          const at = Math.max(chordLine.length === 0 ? 0 : chordLine.length + 1, pos);
          chordLine = chordLine.padEnd(at, ' ') + label;
        }
        lines.push(chordLine);
      }
      if (!rawLine.instrumental) lines.push(rawLine.text);
      if (rawLine.dynamics) lines.push(`(${rawLine.dynamics})`);
    }
    lines.push('');
  });

  if (song.notes) {
    lines.push('---');
    lines.push(song.notes);
  }

  return lines.join('\n').trimEnd() + '\n';
}

/** "Sotto lo stesso cielo" → "sotto-lo-stesso-cielo", for export filenames. */
export function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'canzone'
  );
}
