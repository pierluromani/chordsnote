import { jsPDF } from 'jspdf';

import { formatChord, keyPrefersFlats, transposeKey } from './chords';
import { slugify } from './chordpro';
import { sectionTitle } from './sections';
import { applyAnchors, splitLine, type Word } from './syllables';
import { palette, sectionColors } from './theme';
import { formatDuration, type Line, type Notation, type Section, type Song } from './types';

export type PdfOptions = {
  notation: Notation;
  /** Semitones the song is currently displayed transposed by. */
  semitones?: number;
  /** Off prints lyrics only — no chord labels, no chords-only lines. Defaults to true. */
  chords?: boolean;
};

/**
 * A page as two hand-laid columns of print, drawn with real text rather than
 * a picture of the screen. jsPDF has no flexbox: everywhere `ChordLine`
 * leans on `alignItems`/`flexWrap` this instead walks syllables left to right
 * and asks the font for its own width, in millimetres, at every step.
 */

const PAGE = { w: 210, h: 297 };
const MARGIN = { top: 20, bottom: 16, left: 12, right: 12 };
const GUTTER = 8;
const COLUMN_W = (PAGE.w - MARGIN.left - MARGIN.right - GUTTER) / 2;
const CONTENT_BOTTOM = PAGE.h - MARGIN.bottom;

const LYRIC_SIZE = 10.5;
const LYRIC_LINE = 5.2;
const CHORD_SIZE = 9.5;
const CHORD_GAP = 4.6; // space reserved above the lyric baseline for the chord
const SECTION_GAP = 5.5; // above a section heading
const TITLE_SIZE = 10.5;
const TITLE_H = 5;

/** Builds one song's PDF and returns it as a downloadable/writable Blob. */
export function songPdfBlob(song: Song, options: PdfOptions): Blob {
  const doc = buildDoc(song, options);
  return doc.output('blob');
}

/** The filename a song's PDF should be written under, extension included. */
export function songPdfFilename(song: Song): string {
  return `${slugify(song.title)}.pdf`;
}

function buildDoc(song: Song, options: PdfOptions): jsPDF {
  const { notation, semitones = 0, chords: showChords = true } = options;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  const currentKey = transposeKey(song.key, semitones);
  const useFlats = keyPrefersFlats(currentKey);
  const chordLabel = (chord: string) =>
    formatChord(chord, { notation, semitones, useFlats });

  let y = drawHeader(doc, song, currentKey, semitones, notation);

  // Two columns, refilled left then right, a new page opening on the left
  // again once both are full — the same order a printed chart reads in.
  let col = 0;
  let colTop = y;
  let colY = y;

  const columnX = () => MARGIN.left + col * (COLUMN_W + GUTTER);

  const newPage = () => {
    doc.addPage();
    col = 0;
    colTop = MARGIN.top;
    colY = colTop;
  };

  const nextColumn = () => {
    if (col === 0) {
      col = 1;
      colY = colTop;
    } else {
      newPage();
    }
  };

  for (const section of song.sections) {
    const height = measureSection(doc, song, section, chordLabel, showChords);
    if (colY + height > CONTENT_BOTTOM && colY > colTop) {
      nextColumn();
    }
    // A section taller than a whole empty column still has to go somewhere;
    // it prints where it is and simply runs into the next column visually
    // rather than vanishing.
    colY = drawSection(doc, song, section, chordLabel, columnX(), colY, showChords);
  }

  drawFooter(doc, song.title);
  return doc;
}

/** Title, artist, and the meta line — printed once, full width, above the columns. */
function drawHeader(
  doc: jsPDF,
  song: Song,
  currentKey: string,
  semitones: number,
  notation: Notation
): number {
  let y = MARGIN.top;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(palette.text);
  doc.text(song.title || 'Senza titolo', MARGIN.left, y);
  y += 6.5;

  if (song.artist) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(palette.textMuted);
    doc.text(song.artist, MARGIN.left, y);
    y += 5.5;
  }

  const metaParts = [
    `Tono ${formatChord(currentKey, { notation })}`,
    song.bpm ? `${song.bpm} bpm` : null,
    formatDuration(song.duration),
    song.capo ? `Capo ${song.capo}` : null,
    semitones !== 0 ? `trasposto ${semitones > 0 ? '+' : ''}${semitones}` : null,
  ].filter(Boolean);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9.5);
  doc.setTextColor(palette.textFaint);
  doc.text(metaParts.join('  ·  '), MARGIN.left, y);
  y += 8;

  return y;
}

/** Fixed at the bottom of every page: the song title, so loose sheets sort themselves out. */
function drawFooter(doc: jsPDF, title: string): void {
  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(palette.textFainter);
    const label = `${title || 'Senza titolo'}  ·  pag. ${p}/${pages}`;
    const width = doc.getTextWidth(label);
    doc.text(label, PAGE.w - MARGIN.right - width, PAGE.h - 9);
  }
}

/* --------------------------------------------------------------- Sections */

type Plan =
  | { kind: 'title'; height: number }
  | { kind: 'dynamics'; height: number; text: string }
  | LinePlan;

type Row = {
  syllables: Word['syllables'];
  hasChordAbove: boolean;
  /** Chords parked past the end of the text — only ever on the last row. */
  trailing?: string[];
};

type LinePlan = {
  kind: 'line';
  line: Line;
  height: number;
  /** Pre-wrapped rows of syllables, one entry per printed row. */
  rows: Row[];
  /** Instrumental / textless lines print as a bare row of chord labels instead. */
  bare?: string[];
};

/** Walks a section once to find its total height, without drawing anything. */
function measureSection(
  doc: jsPDF,
  song: Song,
  section: Section,
  chordLabel: (chord: string) => string,
  showChords: boolean
): number {
  const plan = planSection(doc, song, section, chordLabel, showChords);
  return plan.reduce((sum, entry) => sum + entry.height, 0) + SECTION_GAP;
}

function drawSection(
  doc: jsPDF,
  song: Song,
  section: Section,
  chordLabel: (chord: string) => string,
  x: number,
  y: number,
  showChords: boolean
): number {
  const plan = planSection(doc, song, section, chordLabel, showChords);
  const color = sectionColors[section.kind];
  let cursor = y + SECTION_GAP;

  for (const entry of plan) {
    if (entry.kind === 'title') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(TITLE_SIZE);
      // One line, always — a title that wrapped would grow past the height
      // already budgeted for it, so a name too long to fit is cut with an
      // ellipsis instead, same as `numberOfLines={1}` does on screen.
      const label = truncate(doc, sectionTitle(section, song.sections).toUpperCase(), COLUMN_W);
      doc.setTextColor(color);
      doc.text(label, x, cursor + TITLE_H);
      cursor += entry.height;
      continue;
    }

    if (entry.kind === 'dynamics') {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(palette.dynamics);
      doc.text(entry.text, x, cursor + 3, { maxWidth: COLUMN_W });
      cursor += entry.height;
      continue;
    }

    // A chords-only or textless line: bare labels in a row, no syllables.
    if (entry.bare) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(CHORD_SIZE + 1);
      doc.setTextColor(palette.accent);
      let bx = x;
      for (const label of entry.bare) {
        doc.text(label, bx, cursor + CHORD_SIZE * 0.34);
        bx += doc.getTextWidth(label) + 6;
      }
      cursor += entry.height;
      continue;
    }

    for (const row of entry.rows) {
      const baseline = cursor + (row.hasChordAbove ? CHORD_GAP : 0) + LYRIC_LINE * 0.72;
      let rx = x;
      for (const syllable of row.syllables) {
        const chord = showChords ? entry.line.chords.find((c) => c.pos === syllable.start) : undefined;
        if (chord) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(CHORD_SIZE);
          doc.setTextColor(palette.accent);
          doc.text(chordLabel(chord.chord), rx, baseline - CHORD_GAP);
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(LYRIC_SIZE);
        doc.setTextColor(palette.text);
        doc.text(syllable.text, rx, baseline);
        rx += doc.getTextWidth(syllable.text);
      }

      if (row.trailing) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(CHORD_SIZE);
        doc.setTextColor(palette.accent);
        for (const label of row.trailing) {
          rx += rx > x ? 3 : 0;
          doc.text(label, rx, baseline - CHORD_GAP);
          rx += doc.getTextWidth(label);
        }
      }

      cursor += (row.hasChordAbove ? CHORD_GAP : 0) + LYRIC_LINE;
    }
  }

  return cursor;
}

/**
 * One pass that both `measureSection` and `drawSection` share, so the height
 * used to decide where a section lands is exactly the height it prints at —
 * a proportional font means the wrap points still have to be computed for
 * real, not guessed.
 */
function planSection(
  doc: jsPDF,
  song: Song,
  section: Section,
  chordLabel: (chord: string) => string,
  showChords: boolean
): Plan[] {
  const plan: Plan[] = [{ kind: 'title', height: TITLE_H + 2.5 }];

  if (section.dynamics) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    const rows = doc.splitTextToSize(section.dynamics, COLUMN_W).length;
    plan.push({ kind: 'dynamics', height: rows * 4 + 2, text: section.dynamics });
  }

  for (const line of section.lines) {
    plan.push(planLine(doc, line, chordLabel, showChords));
    if (line.dynamics) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      const rows = doc.splitTextToSize(line.dynamics, COLUMN_W).length;
      plan.push({ kind: 'dynamics', height: rows * 4 + 2, text: line.dynamics });
    }
  }

  return plan;
}

function planLine(
  doc: jsPDF,
  line: Line,
  chordLabel: (chord: string) => string,
  showChords: boolean
): LinePlan {
  if (line.instrumental || line.text.trim() === '') {
    // Nothing but chords on this line — with chords hidden there's nothing
    // left to print, so it simply takes up no room.
    if (!showChords) return { kind: 'line', line, rows: [], height: 0 };
    const sorted = [...line.chords].sort((a, b) => a.pos - b.pos);
    return {
      kind: 'line',
      line,
      rows: [],
      bare: sorted.length ? sorted.map((c) => chordLabel(c.chord)) : ['—'],
      height: CHORD_SIZE * 1.6,
    };
  }

  const words = applyAnchors(
    splitLine(line.text),
    line.chords.map((c) => c.pos)
  );
  const hasChords = showChords && line.chords.length > 0;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(LYRIC_SIZE);

  const rows: Row[] = [];
  let current: Word['syllables'] = [];
  let width = 0;

  const flush = () => {
    if (current.length === 0) return;
    rows.push({ syllables: current, hasChordAbove: hasChords });
    current = [];
    width = 0;
  };

  for (const word of words) {
    const wordWidth = word.syllables.reduce(
      (sum, syllable) => sum + doc.getTextWidth(syllable.text),
      0
    );
    if (width > 0 && width + wordWidth > COLUMN_W) flush();
    for (const syllable of word.syllables) current.push(syllable);
    width += wordWidth;
  }
  flush();

  // A line with no words but a trailing chord still needs one printed row.
  if (rows.length === 0) rows.push({ syllables: [], hasChordAbove: hasChords });

  // Chords parked past the end of the text — a turnaround after the last
  // held note — get appended to the last row as bare labels, same as the
  // editor's own "dopo le parole" column. Measured in the chord font so the
  // row's own width tracking stays honest even though it never wraps them.
  const trailing = showChords
    ? line.chords
        .filter((chord) => chord.pos >= line.text.length)
        .sort((a, b) => a.pos - b.pos)
        .map((chord) => chordLabel(chord.chord))
    : [];
  if (trailing.length > 0) rows[rows.length - 1].trailing = trailing;

  const rowHeight = LYRIC_LINE + (hasChords ? CHORD_GAP : 0);
  return { kind: 'line', line, rows, height: rows.length * rowHeight };
}

/** Cuts `text` down to `maxWidth` in the current font, marking the cut with "…". */
function truncate(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(`${cut}…`) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}
