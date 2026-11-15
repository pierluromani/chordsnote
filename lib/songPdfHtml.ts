import { formatChord, keyPrefersFlats, transposeKey } from './chords';
import { sectionTitle } from './sections';
import { applyAnchors, splitLine } from './syllables';
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
 * The native path to the same PDF: real HTML/CSS handed to `expo-print`,
 * which rasterises it through the platform's own WebKit rather than any
 * layout code of ours. One song, one document — a printed chart never
 * shares a sheet with another song, so there's nothing to paginate across.
 */
export function songHtml(song: Song, options: PdfOptions): string {
  const { notation, semitones = 0, chords: showChords = true } = options;
  const currentKey = transposeKey(song.key, semitones);
  const useFlats = keyPrefersFlats(currentKey);
  const chordLabel = (chord: string) => formatChord(chord, { notation, semitones, useFlats });

  const metaParts = [
    `Tono ${formatChord(currentKey, { notation })}`,
    song.bpm ? `${song.bpm} bpm` : null,
    formatDuration(song.duration),
    song.capo ? `Capo ${song.capo}` : null,
    semitones !== 0 ? `trasposto ${semitones > 0 ? '+' : ''}${semitones}` : null,
  ]
    .filter(Boolean)
    .join(' &middot; ');

  const sectionsHtml = song.sections
    .map((section) => sectionHtml(song, section, chordLabel, showChords))
    .join('');

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<title>${esc(song.title)}</title>
<style>${STYLES}</style>
</head>
<body>
  <header class="head">
    <h1>${esc(song.title || 'Senza titolo')}</h1>
    ${song.artist ? `<p class="artist">${esc(song.artist)}</p>` : ''}
    <p class="meta">${metaParts}</p>
  </header>
  <div class="columns">${sectionsHtml}</div>
  ${song.notes ? `<p class="notes">${esc(song.notes)}</p>` : ''}
  <footer class="foot">${esc(song.title || 'Senza titolo')}</footer>
</body>
</html>`;
}

function sectionHtml(
  song: Song,
  section: Section,
  chordLabel: (chord: string) => string,
  showChords: boolean
): string {
  const color = sectionColors[section.kind];
  const label = esc(sectionTitle(section, song.sections).toUpperCase());
  const dynamics = section.dynamics
    ? `<p class="dynamics">${esc(section.dynamics)}</p>`
    : '';
  // A chords-only line has nothing left to show once chords are hidden, unless it carries a dynamics note.
  const lines = section.lines
    .filter(
      (line) =>
        showChords || Boolean(line.dynamics) || !(line.instrumental || line.text.trim() === '')
    )
    .map((line) => lineHtml(line, chordLabel, showChords))
    .join('');

  return `<section class="section">
    <div class="section-title" style="color:${color}">${label}</div>
    ${dynamics}
    ${lines}
  </section>`;
}

function lineHtml(line: Line, chordLabel: (chord: string) => string, showChords: boolean): string {
  const dynHtml = line.dynamics ? `<p class="dynamics">${esc(line.dynamics)}</p>` : '';
  if (line.instrumental || line.text.trim() === '') {
    if (!showChords) return dynHtml;
    const chords = [...line.chords].sort((a, b) => a.pos - b.pos);
    const labels = chords.length
      ? chords.map((chord) => `<span class="chord">${esc(chordLabel(chord.chord))}</span>`).join('')
      : '<span class="chord dim">&mdash;</span>';
    return `<div class="bar">${labels}</div>${dynHtml}`;
  }

  const words = applyAnchors(
    splitLine(line.text),
    line.chords.map((chord) => chord.pos)
  );
  const hasChords = showChords && line.chords.length > 0;
  const chordAt = new Map(line.chords.map((chord) => [chord.pos, chord]));

  const wordsHtml = words
    .map((word) => {
      const syllablesHtml = word.syllables
        .map((syllable) => {
          const chord = chordAt.get(syllable.start);
          const box = hasChords
            ? `<span class="box">${chord ? esc(chordLabel(chord.chord)) : ''}</span>`
            : '';
          return `<span class="col">${box}<span class="lyr">${esc(syllable.text)}</span></span>`;
        })
        .join('');
      return `<span class="word">${syllablesHtml}</span>`;
    })
    .join('');

  const trailing = hasChords
    ? line.chords
        .filter((chord) => chord.pos >= line.text.length)
        .sort((a, b) => a.pos - b.pos)
        .map(
          (chord) =>
            `<span class="col"><span class="box">${esc(chordLabel(chord.chord))}</span><span class="lyr"> </span></span>`
        )
        .join('')
    : '';

  return `<div class="line">${wordsHtml}${trailing}</div>${dynHtml}`;
}

function esc(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const STYLES = `
  @page { size: A4; margin: 16mm 12mm 16mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  body {
    font-family: -apple-system, Helvetica, Arial, sans-serif;
    color: ${palette.text};
    margin: 0;
  }
  .head { margin-bottom: 4mm; }
  .head h1 { font-size: 20pt; margin: 0 0 2mm; }
  .artist { font-size: 12pt; color: ${palette.textMuted}; margin: 0 0 1mm; }
  .meta { font-size: 9.5pt; font-style: italic; color: ${palette.textFaint}; margin: 0; }
  .columns { column-count: 2; column-gap: 8mm; }
  .section { break-inside: avoid; margin-bottom: 5.5mm; }
  .section-title {
    font-weight: 700;
    font-size: 10.5pt;
    letter-spacing: 0.9px;
    margin-bottom: 2mm;
  }
  .dynamics {
    font-style: italic;
    font-size: 8.5pt;
    color: ${palette.dynamics};
    margin: 0 0 2mm;
  }
  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    font-family: 'Courier New', monospace;
    font-size: 10.5pt;
    line-height: 1.5;
    margin-bottom: 1mm;
  }
  .word { display: flex; align-items: flex-end; }
  .col { display: flex; flex-direction: column; align-items: flex-start; white-space: pre; }
  .box {
    display: block;
    height: 4mm;
    color: ${palette.accent};
    font-weight: 700;
    font-size: 9.5pt;
  }
  .lyr { white-space: pre; }
  .bar {
    display: flex;
    gap: 6mm;
    font-family: 'Courier New', monospace;
    font-weight: 700;
    font-size: 10.5pt;
    color: ${palette.accent};
    margin-bottom: 1mm;
  }
  .bar .dim { color: ${palette.textGhost}; }
  .notes {
    margin-top: 4mm;
    padding-top: 3mm;
    border-top: 0.3mm solid ${palette.borderCard};
    font-size: 9pt;
    color: ${palette.textMuted};
    white-space: pre-wrap;
  }
  .foot {
    position: fixed;
    bottom: 6mm;
    left: 12mm;
    right: 12mm;
    font-size: 7.5pt;
    color: ${palette.textFainter};
    text-align: right;
  }
`;
