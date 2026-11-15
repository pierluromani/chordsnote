import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatChord } from '../lib/chords';
import { emailFiles } from '../lib/pdfDelivery';
import { shareSong } from '../lib/share';
import { useCanEditSong, useSong, useStore } from '../lib/store';
import { font, palette, radius } from '../lib/theme';
import type { Song } from '../lib/types';
import { Copy, Export, Heart, Pencil, Person, Trash } from './icons';
import { Sheet, SheetRow } from './Sheet';
import { Chip } from './ui';

/**
 * What you can do to a song without opening it — reached by holding a row down.
 * Deleting asks a second time inside the sheet rather than handing off to a
 * system dialog, which on the web build never appears at all.
 */
export function SongMenu({ songId, onClose }: { songId: string | null; onClose: () => void }) {
  const notation = useStore((state) => state.settings.notation);
  const toggleFavorite = useStore((state) => state.toggleFavorite);
  const duplicateSong = useStore((state) => state.duplicateSong);
  const deleteSong = useStore((state) => state.deleteSong);

  const live = useSong(songId ?? undefined);
  // Held on to so the sheet still has something to draw while it fades out,
  // including after the song it was about has just been deleted.
  const [shown, setShown] = useState<Song | undefined>(live);
  useEffect(() => {
    if (live) setShown(live);
  }, [live]);

  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [chords, setChords] = useState(true);

  const close = () => {
    onClose();
    setTimeout(() => {
      setConfirming(false);
      setStatus(null);
      setPdfOpen(false);
      setChords(true);
    }, 250);
  };

  const song = live ?? shown;
  const subtitle = song
    ? [song.artist, formatChord(song.key, { notation })].filter(Boolean).join(' · ')
    : '';

  // In a band you only read, the song is still yours to open, mark and send on
  // — what's missing is everything that would change it for everybody else.
  const canEdit = useCanEditSong(song);

  return (
    <>
    <Sheet
      visible={songId !== null && !pdfOpen}
      onClose={close}
      title={song?.title || 'Senza titolo'}
      subtitle={subtitle || undefined}
    >
      <View style={styles.menu}>
        <SheetRow
          icon={<Heart size={17} color={palette.accent} filled={!!song?.favorite} />}
          label={song?.favorite ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}
          onPress={() => {
            if (song) toggleFavorite(song.id);
            close();
          }}
        />
        {canEdit ? (
          <SheetRow
            icon={<Pencil size={17} color={palette.accent} />}
            label="Modifica"
            onPress={() => {
              if (!song) return;
              close();
              router.push(`/song/${song.id}/edit`);
            }}
          />
        ) : null}
        <SheetRow
          icon={<Person size={17} color={palette.accent} />}
          label="Invia a un musicista o a una band"
          onPress={() => {
            if (!song) return;
            close();
            router.push(`/song/${song.id}/share`);
          }}
        />
        <SheetRow
          icon={<Export size={17} color={palette.accent} />}
          label="Esporta come testo"
          onPress={async () => {
            if (!song) return;
            const result = await shareSong(song, { format: 'chordpro', notation });
            if (result) setStatus(result);
            else close();
          }}
        />
        <SheetRow
          icon={<Export size={17} color={palette.accent} />}
          label="Esporta PDF"
          last={!canEdit}
          onPress={() => setPdfOpen(true)}
        />
        {canEdit ? (
          <>
            <SheetRow
              icon={<Copy size={17} color={palette.accent} />}
              label="Duplica"
              onPress={() => {
                if (song) duplicateSong(song.id);
                close();
              }}
            />
            <SheetRow
              icon={<Trash size={17} color={palette.accent} />}
              label={confirming ? 'Tocca di nuovo per eliminare' : 'Elimina brano'}
              danger
              last
              onPress={() => {
                if (!confirming) {
                  setConfirming(true);
                  return;
                }
                if (song) deleteSong(song.id);
                close();
              }}
            />
          </>
        ) : null}
      </View>

      {!canEdit ? (
        <Text style={styles.readOnly}>
          In questa band puoi leggere il repertorio, non modificarlo.
        </Text>
      ) : null}
      {confirming ? (
        <Text style={styles.note}>
          Il brano verrà tolto dal catalogo e da ogni scaletta che lo contiene.
        </Text>
      ) : null}
      {status ? <Text style={styles.note}>{status}</Text> : null}
    </Sheet>

    <Sheet
      visible={pdfOpen}
      onClose={() => setPdfOpen(false)}
      title="Esporta PDF"
      subtitle="Nella tonalità originale"
    >
      <View style={styles.optionRow}>
        <Chip label="Con accordi" active={chords} onPress={() => setChords(true)} />
        <Chip label="Solo testo" active={!chords} onPress={() => setChords(false)} />
      </View>
      <View style={styles.menu}>
        <SheetRow
          icon={<Export size={17} color={palette.accent} />}
          label="Esporta"
          last
          onPress={async () => {
            if (!song) return;
            const result = await emailFiles([song], { notation, chords });
            if (result) setStatus(result);
            else close();
          }}
        />
      </View>
      {status ? <Text style={styles.note}>{status}</Text> : null}
    </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  menu: {
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 12,
  },
  note: {
    fontFamily: font.meta,
    fontSize: 12,
    lineHeight: 17,
    color: palette.accent,
    marginTop: 10,
  },
  readOnly: {
    fontFamily: font.meta,
    fontSize: 12,
    lineHeight: 17,
    color: palette.textFaint,
    marginTop: 10,
  },
});
