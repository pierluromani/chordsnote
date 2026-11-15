import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Check, ChevronLeft, Close, Person } from '../../../components/icons';
import {
  CatalogMark,
  CircleButton,
  Eyebrow,
  PrimaryButton,
  Tap,
} from '../../../components/ui';
import { useAuth } from '../../../lib/auth';
import { goBack } from '../../../lib/nav';
import { revokeShare, sendSong, subscribeSentSongs } from '../../../lib/shares';
import { useSong, useStore } from '../../../lib/store';
import { font, palette, radius } from '../../../lib/theme';
import { canEditCatalog, type SongShare } from '../../../lib/types';

/**
 * Getting a song of yours to somebody else — the two ways that mean different
 * things, on one page so the difference is visible.
 *
 * Into a band is a copy the band then owns and its editors can change. To a
 * person is a delivery: they get their own copy in their own catalog, and from
 * then on the two are unrelated. Neither one gives anybody a way into what you
 * keep for yourself.
 */
export default function ShareSongScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const song = useSong(id);
  const account = useAuth((state) => state.account);
  const catalogs = useStore((state) => state.catalogs);
  const copySongToCatalog = useStore((state) => state.copySongToCatalog);

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<SongShare[]>([]);

  useEffect(() => subscribeSentSongs(setSent), [account?.uid]);

  const bands = catalogs.filter(
    (catalog) => catalog.kind === 'band' && canEditCatalog(catalog, account?.uid ?? null)
  );
  const outstanding = sent.filter((share) => share.songId === id);

  if (!song) {
    return (
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
          <CircleButton label="Indietro" onPress={() => goBack('/')}>
            <ChevronLeft size={18} color={palette.text} />
          </CircleButton>
          <Text style={styles.headerTitle}>Condividi</Text>
          <View style={{ width: 36 }} />
        </View>
        <Text style={styles.hint}>Questo brano non esiste più.</Text>
      </View>
    );
  }

  const addToBand = (bandId: string, bandName: string) => {
    copySongToCatalog(song.id, bandId);
    setError(null);
    setNote(`“${song.title || 'Il brano'}” è ora nel repertorio di ${bandName}.`);
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    setNote(null);
    const result = await sendSong(song, email);
    if (result.ok) {
      setEmail('');
      setNote(`Inviato a ${result.share.email}. Lo troverà al prossimo accesso.`);
    } else {
      setError(result.reason);
    }
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <CircleButton label="Indietro" onPress={() => goBack(`/song/${song.id}`)}>
          <ChevronLeft size={18} color={palette.text} />
        </CircleButton>
        <Text style={styles.headerTitle}>Condividi</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: insets.bottom + 28,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.preview}>
          <View style={{ flex: 1 }}>
            <Text style={styles.previewName} numberOfLines={1}>
              {song.title || 'Senza titolo'}
            </Text>
            <Text style={styles.previewMeta} numberOfLines={1}>
              {song.artist || 'Senza interprete'}
            </Text>
          </View>
        </View>

        <Eyebrow style={styles.label}>Aggiungi a una band</Eyebrow>
        {bands.length > 0 ? (
          <View style={styles.group}>
            {bands.map((band) => (
              <Tap
                key={band.id}
                onPress={() => addToBand(band.id, band.name)}
                accessibilityRole="button"
                accessibilityLabel={`Aggiungi al repertorio di ${band.name}`}
                style={styles.row}
              >
                <CatalogMark name={band.name} color={band.color} kind="band" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {band.name}
                  </Text>
                  <Text style={styles.rowMeta}>Ne riceve una copia modificabile</Text>
                </View>
                <Check size={17} color={palette.accent} />
              </Tap>
            ))}
          </View>
        ) : (
          <Text style={styles.hint}>
            Non sei in nessuna band in cui puoi scrivere. Creane una dalla schermata Cataloghi.
          </Text>
        )}

        <Eyebrow style={styles.label}>Invia a un musicista</Eyebrow>
        <TextInput
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setError(null);
          }}
          placeholder="email@esempio.it"
          placeholderTextColor={palette.textGhost}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!busy}
          onSubmitEditing={send}
          returnKeyType="send"
          accessibilityLabel="Email di chi riceve"
          style={styles.input}
        />
        <PrimaryButton label="Invia il brano" onPress={send} disabled={busy || !email.trim()} />
        <Text style={styles.hint}>
          Riceverà una sua copia, da tenere nel proprio catalogo. Le modifiche che farai dopo
          l’invio non lo raggiungeranno: per un brano che resta in comune, usate una band.
        </Text>

        {outstanding.length > 0 ? (
          <>
            <Eyebrow style={styles.label}>In attesa di risposta</Eyebrow>
            <View style={styles.group}>
              {outstanding.map((share) => (
                <View key={share.id} style={styles.row}>
                  <Person size={18} color={palette.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {share.email}
                    </Text>
                    <Text style={styles.rowMeta}>Non ancora accettato</Text>
                  </View>
                  <Tap
                    onPress={() => void revokeShare(share.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Annulla l’invio a ${share.email}`}
                    hitSlop={8}
                  >
                    <Close size={17} color={palette.textFaint} />
                  </Tap>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: font.displaySemi,
    fontSize: 14,
    color: palette.text,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  previewName: {
    fontFamily: font.displaySemi,
    fontSize: 16,
    color: palette.text,
  },
  previewMeta: {
    fontFamily: font.meta,
    fontSize: 12,
    color: palette.textDim,
    marginTop: 2,
  },
  label: {
    marginBottom: 9,
  },
  group: {
    gap: 8,
    marginBottom: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowTitle: {
    fontFamily: font.displaySemi,
    fontSize: 15,
    color: palette.text,
  },
  rowMeta: {
    fontFamily: font.meta,
    fontSize: 12,
    color: palette.textDim,
    marginTop: 1,
  },
  input: {
    fontFamily: font.meta,
    fontSize: 15,
    color: palette.text,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderControl,
    borderRadius: radius.cardLg,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 14,
  },
  hint: {
    fontFamily: font.meta,
    fontSize: 12,
    lineHeight: 17,
    color: palette.textFaint,
    marginTop: 10,
    marginBottom: 22,
  },
  error: {
    fontFamily: font.meta,
    fontSize: 12.5,
    lineHeight: 18,
    color: palette.accent,
    marginTop: 4,
  },
  note: {
    fontFamily: font.meta,
    fontSize: 12.5,
    lineHeight: 18,
    color: palette.accent,
    marginTop: 4,
  },
});
