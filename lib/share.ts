import { slugify, toChordPro, toPlainText } from './chordpro';
import { shareTextFile } from './pdfDelivery';
import type { Notation, Song } from './types';

export type ExportFormat = 'plain' | 'chordpro';

export type ExportOptions = {
  format?: ExportFormat;
  notation?: Notation;
  semitones?: number;
};

/** The chart as text, in whichever of the two shapes was asked for. */
export function songText(song: Song, options: ExportOptions = {}): string {
  const { format = 'plain', notation = 'anglo', semitones = 0 } = options;
  return format === 'plain'
    ? toPlainText(song, { semitones, notation })
    : toChordPro(song, { semitones, notation: 'anglo' });
}

/** Hands the chart to the system share sheet as a file. */
export async function shareSong(song: Song, options: ExportOptions = {}): Promise<string> {
  const extension = options.format === 'chordpro' ? 'cho' : 'txt';
  return shareTextFile(`${slugify(song.title)}.${extension}`, songText(song, options));
}
