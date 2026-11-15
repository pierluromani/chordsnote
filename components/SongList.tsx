import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { formatChord } from '../lib/chords';
import { font, palette, radius } from '../lib/theme';
import type { Notation, Song } from '../lib/types';
import { ConfirmDialog } from './ConfirmDialog';
import { Check, Heart, Trash } from './icons';
import { KeyTile, Tap } from './ui';

/**
 * The song list, grouped by initial with an A–Z index down the right edge.
 *
 * The index is a scrubber, not a set of buttons: dragging a thumb along it
 * walks the list group by group with a tick of haptic feedback at each change,
 * which is how you find a song one-handed while holding an instrument.
 */

/** Italian alphabet — no J, K, W, X, Y. */
const ALPHABET = 'ABCDEFGHILMNOPQRSTUVZ'.split('');

/** Letter a title files under; anything not A–Z lands on "#". */
function groupKey(title: string): string {
  const first = title
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')[0]
    ?.toUpperCase();
  return first && /[A-Z]/.test(first) ? first : '#';
}

export type SongGroup = { letter: string; songs: Song[] };

export function groupSongs(songs: Song[]): SongGroup[] {
  const groups = new Map<string, Song[]>();
  for (const song of [...songs].sort((a, b) => a.title.localeCompare(b.title, 'it'))) {
    const letter = groupKey(song.title || '—');
    const bucket = groups.get(letter);
    if (bucket) bucket.push(song);
    else groups.set(letter, [song]);
  }
  return [...groups.entries()].map(([letter, entries]) => ({ letter, songs: entries }));
}

export function SongList({
  groups,
  notation,
  onPressSong,
  onLongPressSong,
  onToggleFavorite,
  onDeleteSong,
  showIndex = true,
  bottomPadding = 96,
  ListEmptyComponent,
  onScroll,
  selectable = false,
  selectedIds,
  onToggleSelect,
}: {
  groups: SongGroup[];
  notation: Notation;
  onPressSong: (song: Song) => void;
  /** Opens the row's own menu — favourite, export, duplicate, delete. */
  onLongPressSong?: (song: Song) => void;
  onToggleFavorite?: (song: Song) => void;
  /** Enables the left/right swipe actions alongside `onToggleFavorite`. */
  onDeleteSong?: (song: Song) => void;
  showIndex?: boolean;
  bottomPadding?: number;
  ListEmptyComponent?: React.ReactNode;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Trades the key tile for a checkmark and the tap for a toggle — picking
   *  songs to export rather than opening one. */
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (song: Song) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});
  const lastLetter = useRef<string | null>(null);
  const [indexHeight, setIndexHeight] = useState(0);
  // Only one row's actions are ever open at a time, Gmail/WhatsApp-style —
  // opening a new one, or a tap anywhere while one is open, closes it.
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Song | null>(null);

  const present = useMemo(
    () => new Set(groups.map((group) => group.letter)),
    [groups]
  );

  /** Jump to the nearest group at or after `letter`. */
  const jumpTo = (letter: string) => {
    if (letter === lastLetter.current) return;
    lastLetter.current = letter;

    const target =
      groups.find((group) => group.letter === letter) ??
      groups.find((group) => group.letter > letter);
    const y = target ? offsets.current[target.letter] : undefined;
    if (y === undefined) return;

    Haptics.selectionAsync().catch(() => {});
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 4), animated: false });
  };

  /** Maps a finger position on the index column to a letter. */
  const letterAt = (y: number) => {
    if (indexHeight <= 0) return null;
    const step = indexHeight / ALPHABET.length;
    const index = Math.max(0, Math.min(ALPHABET.length - 1, Math.floor(y / step)));
    return ALPHABET[index];
  };

  if (groups.length === 0 && ListEmptyComponent) {
    return <View style={{ flex: 1 }}>{ListEmptyComponent}</View>;
  }

  return (
    <View style={styles.body}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 6,
          paddingLeft: 20,
          paddingRight: 6,
          paddingBottom: bottomPadding,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={32}
      >
        {groups.map((group, index) => (
          <View
            key={group.letter}
            onLayout={(event: LayoutChangeEvent) => {
              offsets.current[group.letter] = event.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.groupLetter, index > 0 && { paddingTop: 14 }]}>
              {group.letter}
            </Text>

            {group.songs.map((song) => {
              const row = (
                <SongRow
                  song={song}
                  notation={notation}
                  onPress={() => {
                    // A tap anywhere while a row's actions are open just
                    // dismisses them, the row's own action included — the
                    // same first-tap-to-close every swipeable list uses.
                    if (openRowId) {
                      setOpenRowId(null);
                      return;
                    }
                    selectable ? onToggleSelect?.(song) : onPressSong(song);
                  }}
                  onLongPress={
                    selectable || !onLongPressSong ? undefined : () => onLongPressSong(song)
                  }
                  onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(song) : undefined}
                  selectable={selectable}
                  selected={selectedIds?.has(song.id) ?? false}
                />
              );

              const swipeable = !selectable && (!!onToggleFavorite || !!onDeleteSong);
              if (!swipeable) return <React.Fragment key={song.id}>{row}</React.Fragment>;

              return (
                <SwipeRow
                  key={song.id}
                  isOpen={openRowId === song.id}
                  favorited={!!song.favorite}
                  favoriteLabel={song.favorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                  onOpen={() => setOpenRowId(song.id)}
                  onClose={() =>
                    setOpenRowId((prev) => (prev === song.id ? null : prev))
                  }
                  onToggleFavorite={
                    onToggleFavorite ? () => onToggleFavorite(song) : undefined
                  }
                  onRequestDelete={onDeleteSong ? () => setPendingDelete(song) : undefined}
                >
                  {row}
                </SwipeRow>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {showIndex ? (
        <View
          style={[styles.index, { paddingBottom: bottomPadding }]}
          onLayout={(event) => setIndexHeight(event.nativeEvent.layout.height - bottomPadding)}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(event) => {
            const letter = letterAt(event.nativeEvent.locationY);
            if (letter) jumpTo(letter);
          }}
          onResponderMove={(event) => {
            const letter = letterAt(event.nativeEvent.locationY);
            if (letter) jumpTo(letter);
          }}
          onResponderRelease={() => {
            lastLetter.current = null;
          }}
          accessibilityRole="adjustable"
          accessibilityLabel="Indice alfabetico"
        >
          {ALPHABET.map((letter) => (
            <Text
              key={letter}
              style={[
                styles.indexLetter,
                { color: present.has(letter) ? palette.accent : palette.textGhost },
              ]}
            >
              {letter}
            </Text>
          ))}
        </View>
      ) : null}

      <ConfirmDialog
        visible={pendingDelete !== null}
        title="Eliminare il brano?"
        message="Il brano verrà tolto dal catalogo e da ogni scaletta che lo contiene."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) onDeleteSong?.(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </View>
  );
}

const ACTION_WIDTH = 88;
const OPEN_THRESHOLD = ACTION_WIDTH * 0.4;

/**
 * Wraps a row with two backing actions revealed by a horizontal drag — a
 * favourite toggle under a swipe right, delete under a swipe left, the same
 * shape as Gmail/WhatsApp's row actions. Only one side is offered when only
 * one handler is passed in, and neither when both are missing (the caller
 * skips wrapping the row in that case).
 */
function SwipeRow({
  children,
  isOpen,
  favorited,
  favoriteLabel,
  onOpen,
  onClose,
  onToggleFavorite,
  onRequestDelete,
}: {
  children: React.ReactNode;
  isOpen: boolean;
  favorited: boolean;
  favoriteLabel: string;
  onOpen: () => void;
  onClose: () => void;
  onToggleFavorite?: () => void;
  onRequestDelete?: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  // The value `translateX` is resting at between gestures — a gesture's own
  // `translationX` is relative to where the finger went down, not to this.
  const resting = useRef(0);

  const settleTo = (value: number) => {
    resting.current = value;
    Animated.spring(translateX, {
      toValue: value,
      useNativeDriver: true,
      damping: 24,
      stiffness: 280,
      mass: 0.7,
      overshootClamping: true,
    }).start();
  };

  useEffect(() => {
    // Closing driven from outside — another row opened, or an action fired —
    // the gesture itself calls `settleTo` directly rather than through this.
    if (!isOpen) settleTo(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-12, 12])
        .runOnJS(true)
        .onUpdate((event) => {
          const max = onToggleFavorite ? ACTION_WIDTH : 0;
          const min = onRequestDelete ? -ACTION_WIDTH : 0;
          const next = Math.max(min, Math.min(max, resting.current + event.translationX));
          translateX.setValue(next);
        })
        .onEnd((event) => {
          const dx = resting.current + event.translationX;
          if (dx > OPEN_THRESHOLD && onToggleFavorite) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            settleTo(ACTION_WIDTH);
            onOpen();
          } else if (dx < -OPEN_THRESHOLD && onRequestDelete) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            settleTo(-ACTION_WIDTH);
            onOpen();
          } else {
            settleTo(0);
            onClose();
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onToggleFavorite, onRequestDelete]
  );

  return (
    <View style={styles.swipeContainer}>
      {onToggleFavorite ? (
        <View style={[styles.swipeAction, styles.swipeActionLeft]}>
          <Tap
            onPress={() => {
              settleTo(0);
              onClose();
              onToggleFavorite();
            }}
            accessibilityRole="button"
            accessibilityLabel={favoriteLabel}
            style={styles.swipeActionTap}
          >
            <Heart size={18} color={palette.accent} filled={favorited} />
            <Text style={styles.swipeActionLabel} numberOfLines={1}>
              {favorited ? 'Rimuovi' : 'Preferiti'}
            </Text>
          </Tap>
        </View>
      ) : null}

      {onRequestDelete ? (
        <View style={[styles.swipeAction, styles.swipeActionRight]}>
          <Tap
            onPress={() => {
              settleTo(0);
              onClose();
              onRequestDelete();
            }}
            accessibilityRole="button"
            accessibilityLabel="Elimina brano"
            style={[styles.swipeActionTap, styles.swipeActionDanger]}
          >
            <Trash size={18} color={palette.accentInk} />
            <Text style={styles.swipeActionLabelDanger} numberOfLines={1}>
              Elimina
            </Text>
          </Tap>
        </View>
      ) : null}

      {/* Web only: without this, react-native-gesture-handler sets
          touch-action: none on this row, which blocks the browser's native
          vertical scroll on the whole list the row sits in — not just the
          row itself — the instant a pan gesture is attached to it. */}
      <GestureDetector gesture={gesture} touchAction="pan-y">
        <Animated.View style={[styles.swipeContent, { transform: [{ translateX }] }]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export function SongRow({
  song,
  notation,
  onPress,
  onLongPress,
  onToggleFavorite,
  selectable = false,
  selected = false,
}: {
  song: Song;
  notation: Notation;
  onPress: () => void;
  onLongPress?: () => void;
  onToggleFavorite?: () => void;
  /** Swaps the key tile for a checkmark, picking rather than opening. */
  selectable?: boolean;
  selected?: boolean;
}) {
  return (
    <Tap
      onPress={onPress}
      onLongPress={
        onLongPress
          ? () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              onLongPress();
            }
          : undefined
      }
      delayLongPress={280}
      accessibilityRole={selectable ? 'checkbox' : 'button'}
      accessibilityState={selectable ? { checked: selected } : undefined}
      accessibilityLabel={`${song.title || 'Senza titolo'}, ${song.artist || 'senza artista'}, tonalità ${song.key}`}
      accessibilityHint={onLongPress ? 'Tieni premuto per le opzioni del brano' : undefined}
      style={styles.row}
    >
      {selectable ? (
        <View style={[styles.checkbox, selected && styles.checkboxOn]}>
          {selected ? <Check size={13} color={palette.accentInk} strokeWidth={2.6} /> : null}
        </View>
      ) : (
        <KeyTile label={formatChord(song.key, { notation })} />
      )}

      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {song.title || 'Senza titolo'}
        </Text>
        {song.artist ? (
          <Text style={styles.rowArtist} numberOfLines={1}>
            {song.artist}
          </Text>
        ) : null}
      </View>

      {!selectable && song.favorite ? (
        <Tap
          onPress={onToggleFavorite}
          disabled={!onToggleFavorite}
          accessibilityRole="button"
          accessibilityLabel="Togli dai preferiti"
          hitSlop={14}
        >
          <Heart size={16} color={palette.accent} />
        </Tap>
      ) : null}
    </Tap>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  swipeContainer: {
    overflow: 'hidden',
  },
  swipeContent: {
    backgroundColor: palette.bg,
  },
  swipeAction: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
  },
  swipeActionLeft: {
    left: 0,
    backgroundColor: palette.surfaceControlHi,
  },
  swipeActionRight: {
    right: 0,
  },
  swipeActionTap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  swipeActionDanger: {
    backgroundColor: palette.accent,
  },
  swipeActionLabel: {
    fontFamily: font.metaSemi,
    fontSize: 11,
    color: palette.accent,
  },
  swipeActionLabelDanger: {
    fontFamily: font.metaSemi,
    fontSize: 11,
    color: palette.accentInk,
  },
  groupLetter: {
    fontFamily: font.monoSemi,
    fontSize: 12,
    color: palette.textGhost,
    paddingTop: 8,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderSoft,
  },
  rowTitle: {
    fontFamily: font.displaySemi,
    fontSize: 15,
    color: palette.text,
  },
  rowArtist: {
    fontFamily: font.meta,
    fontSize: 12,
    color: palette.textDim,
    marginTop: 1,
  },
  checkbox: {
    width: 38,
    height: 38,
    borderRadius: radius.round,
    borderWidth: 1.5,
    borderColor: palette.borderControl,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    borderColor: palette.accent,
    backgroundColor: palette.accent,
  },
  index: {
    width: 22,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 1,
  },
  indexLetter: {
    fontFamily: font.monoSemi,
    fontSize: 9,
  },
});
