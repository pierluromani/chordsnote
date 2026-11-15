// Aliased: the global `File` (browser Blob-backed constructor) is what the
// web delivery path needs, and expo-file-system's own `File` would shadow it.
import { File as ExpoFile, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { slugify, toPlainText } from './chordpro';
import { songPdfBlob, songPdfFilename, type PdfOptions } from './songPdfDoc';
import { songHtml } from './songPdfHtml';
import type { Notation, Song } from './types';

export type { PdfOptions };

export type TextOptions = {
  notation: Notation;
  semitones?: number;
  /** Off omits chords — lyrics only. Defaults to true. */
  chords?: boolean;
};

/**
 * Delivering one file per song via the system share sheet, so they leave
 * together as mail attachments — PDFs from `emailFiles`, plain-text charts
 * from `emailTextFiles`. Everything here returns '' on success and an
 * Italian sentence otherwise — the same contract `shareSong` already used, so
 * callers just show whatever comes back.
 */

type DeliveryFile = { name: string; blob: Blob; mime: string };

const isAbort = (error: unknown) => (error as { name?: string })?.name === 'AbortError';

/** Last resort when the browser offers no Web Share API: each file lands in
 *  the browser's own Downloads folder instead. */
function downloadAll(files: DeliveryFile[]): void {
  for (const file of files) {
    const url = URL.createObjectURL(file.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

/** Web: hands the files straight to `navigator.share`, falling back to a
 *  plain download when the browser can't share files at all. */
async function deliverWebFiles(files: DeliveryFile[], noun: string): Promise<string> {
  try {
    const shareFiles = files.map((file) => new File([file.blob], file.name, { type: file.mime }));
    // `title` alone (no `text`) is what pushed some Mail targets to add the
    // song title as a second, separate plain-text attachment — files only.
    const data: ShareData = { files: shareFiles };

    if (typeof navigator !== 'undefined' && navigator.canShare?.(data)) {
      try {
        await navigator.share(data);
        return '';
      } catch (error) {
        if (isAbort(error)) return '';
        // Falls through to the download fallback below.
      }
    }

    // A `mailto:` link can't carry an attachment — there is no way to hand a
    // file to the mail app without the Web Share API, so the honest fallback
    // is a plain download, with a note to attach the files by hand.
    downloadAll(files);
    return `Il browser non supporta l’invio diretto: i ${noun} sono scaricati, allegali tu alla mail`;
  } catch {
    return `Non è stato possibile creare i ${noun}`;
  }
}

/** Hands one PDF per song to the system share sheet, so the user can pick Mail. */
export async function emailFiles(songs: Song[], options: PdfOptions): Promise<string> {
  if (songs.length === 0) return 'Nessun brano selezionato';
  if (Platform.OS !== 'web') return sharePdfsSequentially(songs, options);

  let files: DeliveryFile[];
  try {
    files = songs.map((song) => ({
      name: songPdfFilename(song),
      blob: songPdfBlob(song, options),
      mime: 'application/pdf',
    }));
  } catch {
    return 'Non è stato possibile creare il PDF';
  }
  return deliverWebFiles(files, 'PDF');
}

/** Hands one .txt per song to the system share sheet, so the user can pick Mail. */
export async function emailTextFiles(songs: Song[], options: TextOptions): Promise<string> {
  if (songs.length === 0) return 'Nessun brano selezionato';
  return shareTextFiles(
    songs.map((song) => ({ name: `${slugify(song.title)}.txt`, content: toPlainText(song, options) })),
    'testi'
  );
}

/**
 * Hands one already-rendered chart (plain text or ChordPro) to the system
 * share sheet — the single-file sibling of `emailTextFiles`, for the
 * "Condividi" action rather than the bulk "Esporta" one.
 */
export async function shareTextFile(name: string, content: string): Promise<string> {
  return shareTextFiles([{ name, content }], 'file');
}

/** Native: one PDF per song via `expo-print`, one share sheet per file via `expo-sharing`. */
async function sharePdfsSequentially(songs: Song[], options: PdfOptions): Promise<string> {
  if (!(await Sharing.isAvailableAsync())) {
    return 'La condivisione non è disponibile su questo dispositivo';
  }
  try {
    for (const song of songs) {
      const { uri } = await Print.printToFileAsync({ html: songHtml(song, options) });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: song.title,
        UTI: 'com.adobe.pdf',
      });
    }
    return '';
  } catch {
    return 'Non è stato possibile creare il PDF';
  }
}

type TextFile = { name: string; content: string };

/** Web: Blob + Web Share/download, same as the PDF path. Native: write each
 *  file to the cache, then one `expo-sharing` call per file — `expo-file-system`
 *  has no web implementation, so that native-only route used to be the only one. */
async function shareTextFiles(files: TextFile[], noun: string): Promise<string> {
  if (Platform.OS === 'web') {
    return deliverWebFiles(
      files.map((file) => ({
        name: file.name,
        blob: new Blob([file.content], { type: 'text/plain' }),
        mime: 'text/plain',
      })),
      noun
    );
  }

  if (!(await Sharing.isAvailableAsync())) {
    return 'La condivisione non è disponibile su questo dispositivo';
  }
  try {
    for (const file of files) {
      const target = new ExpoFile(Paths.cache, file.name);
      if (target.exists) target.delete();
      target.create();
      target.write(file.content);
      await Sharing.shareAsync(target.uri, {
        mimeType: 'text/plain',
        dialogTitle: file.name,
        UTI: 'public.plain-text',
      });
    }
    return '';
  } catch {
    return 'Non è stato possibile creare il file';
  }
}
