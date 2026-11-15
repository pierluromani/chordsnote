import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ChevronLeft, ChevronRight, Close, ListBullet, Note, Plus, Send } from '../../components/icons';
import { Sheet, SheetRow } from '../../components/Sheet';
import { Avatar, CircleButton, EmptyState, FloatingBar, PillButton, Tap } from '../../components/ui';
import { deleteMessage, sendMessage, subscribeMessages } from '../../lib/bandChat';
import { formatChord } from '../../lib/chords';
import { goBack } from '../../lib/nav';
import { published, useCatalog, useSong, useSetlist, useStore } from '../../lib/store';
import { catalogColors, font, palette, radius, shadow } from '../../lib/theme';
import { formatTotal, type BandMessage, type Notation, type SetlistItem } from '../../lib/types';
import { useAuth } from '../../lib/auth';

/**
 * A band's bacheca: where "abbassiamo di un tono" and "ho caricato il nuovo
 * arrangiamento" happen inside the app instead of on WhatsApp. The one thing
 * that earns it a screen of its own: a message can carry a song or a setlist
 * as a tappable card.
 */

const FULL_DAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

function dayLabel(createdAt: number): string {
  const date = new Date(createdAt);
  return `${FULL_DAYS[date.getDay()]} ${date.getDate()}`;
}

function timeLabel(createdAt: number): string {
  const date = new Date(createdAt);
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * On web, the keyboard shrinks the *visual* viewport, not the layout one —
 * body stays full-height and iOS Safari pans the whole page to keep the
 * focused input visible, dragging the header along with it. Sizing the
 * screen to the live visual viewport means there's nothing left offscreen
 * to pan to, so only the ScrollView inside it needs to give up space.
 */
function useWebViewportHeight() {
  const [height, setHeight] = useState<number>();
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => setHeight(vv.height);
    update();
    vv.addEventListener('resize', update);
    return () => vv.removeEventListener('resize', update);
  }, []);
  return height;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const webViewportHeight = useWebViewportHeight();

  const catalog = useCatalog(id);
  const account = useAuth((state) => state.account);
  const songs = useStore((state) => state.songs);
  const setlists = useStore((state) => state.setlists);
  const notation = useStore((state) => state.settings.notation);
  const markChatSeen = useStore((state) => state.markChatSeen);

  const [messages, setMessages] = useState<BandMessage[]>([]);
  const [text, setText] = useState('');
  const [pendingRef, setPendingRef] = useState<BandMessage['ref']>();
  const [attachOpen, setAttachOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BandMessage | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!id) return;
    return subscribeMessages(id, setMessages);
  }, [id]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last && id) markChatSeen(id, last.createdAt);
  }, [messages, id, markChatSeen]);

  const memberByUid = useMemo(
    () => new Map((catalog?.members ?? []).map((member) => [member.uid, member])),
    [catalog?.members]
  );

  if (!catalog) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 40 }]}>
        <EmptyState
          title="Band non trovata"
          body="Forse è stata eliminata."
          action={<PillButton label="Torna alla home" onPress={() => router.replace('/')} />}
        />
      </View>
    );
  }

  const bandSongs = published(songs).filter((song) => song.catalogId === catalog.id);
  const bandSetlists = setlists.filter((setlist) => setlist.catalogId === catalog.id);

  const send = () => {
    const clean = text.trim();
    if (!clean && !pendingRef) return;
    void sendMessage(catalog.id, clean || pendingRef!.title, pendingRef);
    setText('');
    setPendingRef(undefined);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, webViewportHeight != null && { height: webViewportHeight }]}
    >
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <CircleButton label="Indietro" onPress={() => goBack(`/band/${catalog.id}`)}>
          <ChevronLeft size={18} color={palette.text} />
        </CircleButton>
        <View style={styles.headerMid}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {catalog.name}
          </Text>
          <Text style={styles.headerSub}>
            {`bacheca · ${catalog.members.length} ${catalog.members.length === 1 ? 'membro' : 'membri'}`}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 8,
          paddingBottom: insets.bottom + 130,
          gap: 18,
        }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <EmptyState
            title="Ancora nessun messaggio"
            body="Qui la band si aggiorna su brani e prove."
          />
        ) : (
          messages.map((message, index) => {
            const previous = messages[index - 1];
            const showDay = !previous || dayLabel(previous.createdAt) !== dayLabel(message.createdAt);
            const mine = message.uid === account?.uid;

            return (
              <React.Fragment key={message.id}>
                {showDay ? (
                  <View style={styles.daySep}>
                    <Text style={styles.daySepText}>{dayLabel(message.createdAt)}</Text>
                  </View>
                ) : null}
                <MessageRow
                  message={message}
                  mine={mine}
                  color={memberByUid.get(message.uid)?.color ?? 0}
                  notation={notation}
                  onLongPress={mine ? () => setDeleteTarget(message) : undefined}
                />
              </React.Fragment>
            );
          })
        )}
      </ScrollView>

      <FloatingBar bottomInset={insets.bottom}>
        {pendingRef ? (
          <View style={styles.pendingRow}>
            <View style={styles.pendingBody}>
              {pendingRef.kind === 'song' ? (
                <Note size={14} color={catalogColors[0].ink} />
              ) : (
                <ListBullet size={14} color={catalogColors[2].ink} />
              )}
              <Text style={styles.pendingTitle} numberOfLines={1}>
                {pendingRef.title}
              </Text>
            </View>
            <Tap
              onPress={() => setPendingRef(undefined)}
              accessibilityRole="button"
              accessibilityLabel="Rimuovi allegato"
              hitSlop={8}
            >
              <Close size={14} color={palette.textFaint} />
            </Tap>
          </View>
        ) : null}

        <View style={styles.composer}>
          <CircleButton label="Allega" onPress={() => setAttachOpen(true)}>
            <Plus size={17} color={palette.textSecondary} strokeWidth={2.2} />
          </CircleButton>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Scrivi alla band…"
            placeholderTextColor={palette.textGhost}
            multiline
            numberOfLines={1}
            maxLength={2000}
            style={styles.composerInput}
          />
          <CircleButton
            label="Invia"
            tone="accent"
            onPress={send}
            disabled={!text.trim() && !pendingRef}
          >
            <Send size={16} color={palette.accentInk} strokeWidth={2.4} />
          </CircleButton>
        </View>
      </FloatingBar>

      <Sheet visible={attachOpen} onClose={() => setAttachOpen(false)} title="Allega alla band">
        <View style={styles.attachList}>
          {bandSongs.length === 0 && bandSetlists.length === 0 ? (
            <Text style={styles.hint}>Ancora nessun brano o scaletta in questa band.</Text>
          ) : (
            <>
              {bandSongs.map((song) => (
                <SheetRow
                  key={song.id}
                  icon={<Note size={16} color={catalogColors[0].ink} />}
                  label={song.title}
                  value={formatChord(song.key, { notation })}
                  onPress={() => {
                    setPendingRef({ kind: 'song', id: song.id, title: song.title });
                    setAttachOpen(false);
                  }}
                />
              ))}
              {bandSetlists.map((setlist) => (
                <SheetRow
                  key={setlist.id}
                  icon={<ListBullet size={16} color={catalogColors[2].ink} />}
                  label={setlist.name}
                  onPress={() => {
                    setPendingRef({ kind: 'setlist', id: setlist.id, title: setlist.name });
                    setAttachOpen(false);
                  }}
                />
              ))}
            </>
          )}
        </View>
      </Sheet>

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Eliminare il messaggio?"
        message="Non si può annullare."
        confirmLabel="Elimina"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          const target = deleteTarget;
          setDeleteTarget(null);
          if (target) void deleteMessage(catalog.id, target.id);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function MessageRow({
  message,
  mine,
  color,
  notation,
  onLongPress,
}: {
  message: BandMessage;
  mine: boolean;
  color: number;
  notation: Notation;
  onLongPress?: () => void;
}) {
  return (
    <Tap
      onLongPress={onLongPress}
      disabled={!onLongPress}
      accessibilityLabel={onLongPress ? `Opzioni per il messaggio di ${message.name}` : undefined}
      style={[styles.msg, mine && styles.msgMine]}
    >
      {!mine ? <Avatar name={message.name} color={color} size={26} letters={2} /> : null}
      <View style={[styles.msgCol, mine && styles.msgColMine]}>
        <View style={styles.msgMeta}>
          {mine ? (
            <>
              <Text style={styles.msgTime}>{timeLabel(message.createdAt)}</Text>
              <Text style={styles.msgNameMine}>io</Text>
            </>
          ) : (
            <>
              <Text style={styles.msgName}>{message.name}</Text>
              <Text style={styles.msgTime}>{timeLabel(message.createdAt)}</Text>
            </>
          )}
        </View>
        <View style={[styles.bubble, mine && styles.bubbleMine]}>
          <Text style={styles.bubbleText}>{message.text}</Text>
        </View>
        {message.ref ? <AttachmentCard attachRef={message.ref} notation={notation} /> : null}
      </View>
    </Tap>
  );
}

function AttachmentCard({
  attachRef,
  notation,
}: {
  attachRef: NonNullable<BandMessage['ref']>;
  notation: Notation;
}) {
  const song = useSong(attachRef.kind === 'song' ? attachRef.id : undefined);
  const setlist = useSetlist(attachRef.kind === 'setlist' ? attachRef.id : undefined);
  const songs = useStore((state) => state.songs);

  const title = (attachRef.kind === 'song' ? song?.title : setlist?.name) ?? attachRef.title;

  let subtitle = 'Non più disponibile';
  if (attachRef.kind === 'song' && song) {
    subtitle = formatChord(song.key, { notation }) + (song.bpm ? ` · ${song.bpm} bpm` : '');
  } else if (attachRef.kind === 'setlist' && setlist) {
    const setSongs = setlist.items.filter(
      (item): item is Extract<SetlistItem, { type: 'song' }> => item.type === 'song'
    );
    const total = setSongs.reduce(
      (sum, item) => sum + (songs.find((s) => s.id === item.songId)?.duration ?? 0),
      0
    );
    subtitle = `${setSongs.length} ${setSongs.length === 1 ? 'brano' : 'brani'}${
      total ? ` · ${formatTotal(total)}` : ''
    }`;
  }

  return (
    <Tap
      onPress={() =>
        router.push(
          attachRef.kind === 'song'
            ? { pathname: '/song/[id]', params: { id: attachRef.id } }
            : { pathname: '/setlist/[id]', params: { id: attachRef.id } }
        )
      }
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      style={styles.attach}
    >
      <View style={[styles.attachIcon, attachRef.kind === 'setlist' && styles.attachIconSetlist]}>
        {attachRef.kind === 'song' ? (
          <Note size={16} color={catalogColors[0].ink} />
        ) : (
          <ListBullet size={16} color={catalogColors[2].ink} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.attachTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.attachSub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <ChevronRight size={16} color={palette.textGhost} strokeWidth={2.2} />
    </Tap>
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
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerMid: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  headerTitle: {
    fontFamily: font.display,
    fontSize: 16,
    letterSpacing: -0.2,
    color: palette.text,
  },
  headerSub: {
    fontFamily: font.metaMid,
    fontSize: 12,
    color: palette.textFaint,
  },
  daySep: {
    alignItems: 'center',
  },
  daySepText: {
    fontFamily: font.metaSemi,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.textFainter,
    backgroundColor: palette.surfaceRaised,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.round,
    overflow: 'hidden',
  },
  msg: {
    flexDirection: 'row',
    gap: 9,
    maxWidth: '88%',
    alignSelf: 'flex-start',
  },
  msgMine: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
    maxWidth: '82%',
  },
  msgCol: {
    gap: 6,
    flexShrink: 1,
  },
  msgColMine: {
    alignItems: 'flex-end',
  },
  msgMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  msgName: {
    fontFamily: font.metaSemi,
    fontSize: 12.5,
    color: palette.textSecondary,
  },
  msgNameMine: {
    fontFamily: font.metaMid,
    fontSize: 12.5,
    color: palette.textFaint,
  },
  msgTime: {
    fontFamily: font.meta,
    fontSize: 11,
    color: palette.textFainter,
  },
  bubble: {
    fontFamily: font.meta,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderCard,
    borderRadius: 16,
    borderTopLeftRadius: 5,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: palette.surfaceControl,
    borderColor: palette.surfaceControl,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 5,
  },
  bubbleText: {
    fontFamily: font.meta,
    fontSize: 14.5,
    lineHeight: 20,
    color: palette.text,
  },
  attach: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    width: '100%',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderCard,
    borderRadius: radius.card,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  attachIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.tile,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: catalogColors[0].tile,
  },
  attachIconSetlist: {
    backgroundColor: catalogColors[2].tile,
  },
  attachTitle: {
    fontFamily: font.displaySemi,
    fontSize: 13.5,
    color: palette.text,
  },
  attachSub: {
    fontFamily: font.monoSemi,
    fontSize: 11,
    color: palette.textFaint,
    marginTop: 2,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  pendingBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingTitle: {
    flex: 1,
    fontFamily: font.displaySemi,
    fontSize: 13,
    color: palette.text,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: palette.surface,
    borderRadius: radius.round,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 6,
    ...shadow.floating,
  },
  composerInput: {
    flex: 1,
    fontFamily: font.meta,
    fontSize: 14.5,
    color: palette.text,
    maxHeight: 100,
    padding: 0,
    textAlignVertical: 'center',
  },
  attachList: {
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    paddingHorizontal: 13,
  },
  hint: {
    fontFamily: font.meta,
    fontSize: 12.5,
    lineHeight: 18,
    color: palette.textFaint,
    paddingVertical: 14,
    paddingHorizontal: 2,
  },
});
