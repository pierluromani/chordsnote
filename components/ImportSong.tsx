import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { parseChordPro, type ChordProResult, type ParsedSong } from '../lib/chordpro';
import { fetchChart } from '../lib/fetchChart';
import { font, palette, radius } from '../lib/theme';
import { Import, Plus } from './icons';
import { Sheet, SheetRow } from './Sheet';
import { PrimaryButton } from './ui';

/** Reads a picked document's text content, on web or native. */
async function readAsset(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  if (Platform.OS === 'web' && asset.file) return asset.file.text();
  return new File(asset.uri).text();
}

/**
 * "Nuovo brano", with the two ways to skip typing it in by hand: pick a
 * ChordPro file off the device, or fetch one from a URL. Both funnel through
 * the same parser — only where the text comes from differs — so the caller
 * always gets back the same shape and decides what to do with it.
 */
export function ImportSheet({
  visible,
  onClose,
  onBlank,
  onImported,
}: {
  visible: boolean;
  onClose: () => void;
  /** "Brano vuoto" — the plain, empty-song path. */
  onBlank: () => void;
  onImported: (song: ParsedSong) => void;
}) {
  const [step, setStep] = useState<'menu' | 'url'>('menu');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    onClose();
    // Deferred past the close animation, so the sheet doesn't visibly reset
    // to "menu" while it's still fading out.
    setTimeout(() => {
      setStep('menu');
      setUrl('');
      setBusy(false);
      setError(null);
    }, 250);
  };

  /**
   * `requireChords` is on for the URL path only. A file was chosen on purpose,
   * so lyrics with no chords are a fair thing to import; a page that came back
   * without a single chord on it is almost always the wrong page, not a song.
   */
  const finish = (result: ChordProResult, requireChords = false) => {
    const lines = result.song.sections.flatMap((section) => section.lines);
    if (lines.length === 0) {
      setBusy(false);
      setError('Non ho trovato testo o accordi da importare.');
      return;
    }
    if (requireChords && !lines.some((line) => line.chords.length > 0)) {
      setBusy(false);
      setError(
        'Da questa pagina non ho ricavato nessun accordo. Apri il link della pagina con gli accordi del brano, non della ricerca o dell’elenco.'
      );
      return;
    }
    onImported(result.song);
    close();
  };

  const pickFile = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: false });
      if (result.canceled || !result.assets?.[0]) {
        setBusy(false);
        return;
      }
      const text = await readAsset(result.assets[0]);
      finish(parseChordPro(text));
    } catch {
      setBusy(false);
      setError('Non riesco a leggere questo file.');
    }
  };

  const importFromUrl = async () => {
    const trimmed = url.trim();
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmed);
    } catch {
      setError('Indirizzo non valido.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const { text } = await fetchChart(parsedUrl.toString());
      finish(parseChordPro(text), true);
    } catch {
      setBusy(false);
      setError(
        'Non riesco a leggere un brano da questo indirizzo. Controlla che la pagina contenga davvero testo e accordi, oppure scarica il file e importalo da qui.'
      );
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={step === 'menu' ? 'Nuovo brano' : 'Importa da URL'}
      subtitle={
        step === 'url'
          ? 'Il link a una pagina con gli accordi, o a un file ChordPro.'
          : undefined
      }
      footer={
        step === 'url' ? (
          <PrimaryButton
            label={busy ? 'Importazione…' : 'Importa'}
            onPress={importFromUrl}
            disabled={busy || !url.trim()}
          />
        ) : undefined
      }
    >
      {step === 'menu' ? (
        <View style={styles.menu}>
          <SheetRow
            icon={<Plus size={17} color={palette.accent} />}
            label="Brano vuoto"
            onPress={() => {
              onBlank();
              close();
            }}
          />
          <SheetRow
            icon={<Import size={17} color={palette.accent} />}
            label={busy ? 'Apertura in corso…' : 'Importa file ChordPro'}
            onPress={busy ? undefined : pickFile}
          />
          <SheetRow
            icon={<Import size={17} color={palette.accent} />}
            label="Importa da un link"
            last
            onPress={busy ? undefined : () => setStep('url')}
          />
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://…"
            placeholderTextColor={palette.textGhost}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!busy}
            style={styles.urlInput}
          />
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  menu: {
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    overflow: 'hidden',
  },
  urlInput: {
    fontFamily: font.mono,
    fontSize: 14,
    color: palette.text,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderControl,
    borderRadius: radius.card,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  error: {
    fontFamily: font.meta,
    fontSize: 12,
    lineHeight: 17,
    color: palette.accent,
    marginTop: 10,
  },
});
