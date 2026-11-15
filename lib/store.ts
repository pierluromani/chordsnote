import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { extractInlineChords } from './chordpro';
import { formatChord, transposeKey } from './chords';
import { uid } from './id';
import { remapPositions } from './syllables';
import { useAuth } from './auth';
import {
  DEFAULT_SETTINGS,
  bandRoleOf,
  canEditCatalog,
  type BandRole,
  type Catalog,
  type Line,
  type Section,
  type SectionKind,
  type Setlist,
  type SetlistItem,
  type Settings,
  type Song,
} from './types';

type State = {
  catalogs: Catalog[];
  songs: Song[];
  setlists: Setlist[];
  settings: Settings;
  hydrated: boolean;
  /**
   * Whose cached data this is. Personal catalogs, songs and setlists never
   * leave the device, so without this every account signing in on one browser
   * would inherit — and, through `syncBands`, claim — the last one's material.
   */
  ownerUid: string | null;
  /**
   * Read state for each band's chat, local to this device — see the
   * `ponytail` note on `markChatSeen`. bandId → `createdAt` of the last
   * message seen.
   */
  chatSeen: Record<string, number>;

  /** Hands the local cache to `uid`, emptying it if it belonged to anyone else. */
  adoptAccount: (uid: string, displayName: string | null) => void;

  createCatalog: (partial?: Partial<Catalog>) => Catalog;
  /** The first personal catalog, creating one if there isn't one yet. */
  ensurePersonalCatalog: () => string;
  updateCatalog: (id: string, patch: Partial<Catalog>) => void;
  deleteCatalog: (id: string) => void;
  addMember: (catalogId: string, name: string) => void;
  removeMember: (catalogId: string, memberId: string) => void;

  createSong: (partial?: Partial<Song>) => Song;
  /**
   * Puts a copy of a song into another catalog — how a song of yours joins a
   * band's repertoire. A copy and not a move: the band's version is theirs to
   * edit, yours stays yours, and the two go their own way from here.
   */
  copySongToCatalog: (songId: string, catalogId: string) => Song | undefined;
  updateSong: (id: string, patch: Partial<Song>) => void;
  /** Moves a draft into the catalog proper. */
  publishSong: (id: string) => void;
  deleteSong: (id: string) => void;
  duplicateSong: (id: string) => Song | undefined;
  toggleFavorite: (id: string) => void;

  addSection: (songId: string, kind: SectionKind, atIndex?: number) => string | undefined;
  updateSection: (songId: string, sectionId: string, patch: Partial<Section>) => void;
  deleteSection: (songId: string, sectionId: string) => void;
  /** Drag-and-drop reorder: pulls the section at `from` and drops it at `to`. */
  reorderSections: (songId: string, from: number, to: number) => void;
  duplicateSection: (songId: string, sectionId: string) => void;

  /** Rewrites a section's lines from a textarea, preserving chords per line. */
  setSectionText: (songId: string, sectionId: string, text: string) => void;
  /** Adds an empty line, after `afterLineId` when given, otherwise at the end. */
  addLine: (songId: string, sectionId: string, afterLineId?: string) => void;
  deleteLine: (songId: string, sectionId: string, lineId: string) => void;
  setLineInstrumental: (
    songId: string,
    sectionId: string,
    lineId: string,
    instrumental: boolean
  ) => void;
  setLineDynamics: (
    songId: string,
    sectionId: string,
    lineId: string,
    dynamics: string | undefined
  ) => void;

  addChord: (
    songId: string,
    sectionId: string,
    lineId: string,
    pos: number,
    chord: string
  ) => void;
  updateChord: (
    songId: string,
    sectionId: string,
    lineId: string,
    chordId: string,
    chord: string
  ) => void;
  moveChord: (
    songId: string,
    sectionId: string,
    lineId: string,
    chordId: string,
    pos: number
  ) => void;
  /** Reorders the chords of a chords-only line, where `pos` is just a rank. */
  reorderChords: (
    songId: string,
    sectionId: string,
    lineId: string,
    from: number,
    to: number
  ) => void;
  deleteChord: (songId: string, sectionId: string, lineId: string, chordId: string) => void;

  /** Bakes a transposition into the stored song. */
  applyTranspose: (songId: string, semitones: number, useFlats: boolean) => void;

  createSetlist: (partial?: Partial<Setlist>) => Setlist;
  updateSetlist: (id: string, patch: Partial<Setlist>) => void;
  deleteSetlist: (id: string) => void;
  addToSetlist: (setlistId: string, item: SetlistItem) => void;
  updateSetlistItem: (setlistId: string, itemId: string, patch: Partial<SetlistItem>) => void;
  removeSetlistItem: (setlistId: string, itemId: string) => void;
  moveSetlistItem: (setlistId: string, itemId: string, direction: -1 | 1) => void;
  reorderSetlistItem: (setlistId: string, from: number, to: number) => void;

  setSettings: (patch: Partial<Settings>) => void;

  /**
   * ponytail: non letti locali al device — se serve che siano gli stessi su
   * telefono e browser, diventano una scrittura per utente sotto
   * `users/{uid}/chatSeen/{bandId}`.
   */
  markChatSeen: (bandId: string, at: number) => void;
};

/**
 * AsyncStorage wrapper that never rejects. A failing store shouldn't take the
 * app down mid-set: reads fall back to "nothing saved" and writes are dropped
 * with a warning, so the session keeps working in memory.
 */
const safeStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(name);
    } catch (error) {
      console.warn('Lettura archivio non riuscita', error);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch (error) {
      console.warn('Salvataggio non riuscito', error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(name);
    } catch (error) {
      console.warn('Cancellazione archivio non riuscita', error);
    }
  },
};

function touch(song: Song): Song {
  return { ...song, updatedAt: Date.now() };
}

export function emptyLine(text = ''): Line {
  return { id: uid('l'), text, chords: [] };
}

export function emptySection(kind: SectionKind): Section {
  return { id: uid('s'), kind, lines: [emptyLine()] };
}

export const useStore = create<State>()(
  persist(
    (set, get) => {
      /** Applies `recipe` to one song and stamps its updatedAt. */
      const editSong = (id: string, recipe: (song: Song) => Song) =>
        set((state) => ({
          songs: state.songs.map((song) => (song.id === id ? touch(recipe(song)) : song)),
        }));

      /** Applies `recipe` to one section of one song. */
      const editSection = (
        songId: string,
        sectionId: string,
        recipe: (section: Section) => Section
      ) =>
        editSong(songId, (song) => ({
          ...song,
          sections: song.sections.map((section) =>
            section.id === sectionId ? recipe(section) : section
          ),
        }));

      /** Applies `recipe` to one line of one section. */
      const editLine = (
        songId: string,
        sectionId: string,
        lineId: string,
        recipe: (line: Line) => Line
      ) =>
        editSection(songId, sectionId, (section) => ({
          ...section,
          lines: section.lines.map((line) => (line.id === lineId ? recipe(line) : line)),
        }));

      const editSetlist = (id: string, recipe: (setlist: Setlist) => Setlist) =>
        set((state) => ({
          setlists: state.setlists.map((setlist) =>
            setlist.id === id ? { ...recipe(setlist), updatedAt: Date.now() } : setlist
          ),
        }));

      return {
        catalogs: [],
        songs: [],
        setlists: [],
        settings: DEFAULT_SETTINGS,
        hydrated: false,
        ownerUid: null,
        chatSeen: {},

        adoptAccount: (uid, displayName) => {
          if (get().ownerUid === uid) return;
          set({
            ownerUid: uid,
            catalogs: [],
            songs: [],
            setlists: [],
            chatSeen: {},
            // A fresh account starts under its own name, not the placeholder
            // one the defaults carry.
            settings: { ...DEFAULT_SETTINGS, userName: displayName?.trim() || '' },
          });
        },

        createCatalog: (partial) => {
          const catalog: Catalog = {
            id: uid('cat'),
            name: 'Nuovo catalogo',
            kind: 'personal',
            color: get().catalogs.length % 5,
            members: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            ...partial,
          };
          set((state) => ({ catalogs: [...state.catalogs, catalog] }));
          return catalog;
        },

        ensurePersonalCatalog: () => {
          const existing = get().catalogs.find((catalog) => catalog.kind === 'personal');
          if (existing) return existing.id;
          return get().createCatalog({ name: 'Personale' }).id;
        },

        updateCatalog: (id, patch) =>
          set((state) => ({
            catalogs: state.catalogs.map((catalog) =>
              catalog.id === id ? { ...catalog, ...patch, updatedAt: Date.now() } : catalog
            ),
          })),

        deleteCatalog: (id) =>
          set((state) => ({
            catalogs: state.catalogs.filter((catalog) => catalog.id !== id),
            songs: state.songs.filter((song) => song.catalogId !== id),
            setlists: state.setlists.filter((setlist) => setlist.catalogId !== id),
          })),

        addMember: (catalogId, name) =>
          set((state) => ({
            catalogs: state.catalogs.map((catalog) =>
              catalog.id === catalogId
                ? {
                    ...catalog,
                    members: [
                      ...catalog.members,
                      // A name written by hand, not an account: whatever it's
                      // allowed to do is decided by whoever holds the phone.
                      { id: uid('m'), name, color: catalog.members.length % 4, role: 'viewer' },
                    ],
                    updatedAt: Date.now(),
                  }
                : catalog
            ),
          })),

        removeMember: (catalogId, memberId) =>
          set((state) => ({
            catalogs: state.catalogs.map((catalog) =>
              catalog.id === catalogId
                ? {
                    ...catalog,
                    members: catalog.members.filter((member) => member.id !== memberId),
                    updatedAt: Date.now(),
                  }
                : catalog
            ),
          })),

        createSong: (partial) => {
          const now = Date.now();
          const song: Song = {
            id: uid('song'),
            title: '',
            artist: '',
            key: 'C',
            catalogId: get().catalogs[0]?.id ?? '',
            favorite: false,
            // Everything starts as a draft. It joins the catalog when it's
            // saved, which is what makes discarding able to leave no trace.
            draft: true,
            sections: [emptySection('verse')],
            createdAt: now,
            updatedAt: now,
            ...partial,
          };
          set((state) => ({ songs: [song, ...state.songs] }));
          return song;
        },

        copySongToCatalog: (songId, catalogId) => {
          const source = get().songs.find((song) => song.id === songId);
          if (!source) return undefined;

          const { id, createdAt, updatedAt, draft, ...content } = source;
          return get().createSong({ ...content, catalogId, favorite: false, draft: undefined });
        },

        updateSong: (id, patch) => editSong(id, (song) => ({ ...song, ...patch })),

        publishSong: (id) => editSong(id, (song) => ({ ...song, draft: undefined })),

        deleteSong: (id) =>
          set((state) => ({
            songs: state.songs.filter((song) => song.id !== id),
            // A deleted song shouldn't leave a gap in anyone's running order.
            setlists: state.setlists.map((setlist) => ({
              ...setlist,
              items: setlist.items.filter(
                (item) => item.type !== 'song' || item.songId !== id
              ),
            })),
          })),

        duplicateSong: (id) => {
          const original = get().songs.find((song) => song.id === id);
          if (!original) return undefined;

          const now = Date.now();
          const copy: Song = {
            ...original,
            id: uid('song'),
            title: `${original.title} (copia)`,
            favorite: false,
            createdAt: now,
            updatedAt: now,
            sections: original.sections.map((section) => ({
              ...section,
              id: uid('s'),
              lines: section.lines.map((line) => ({
                ...line,
                id: uid('l'),
                chords: line.chords.map((chord) => ({ ...chord, id: uid('c') })),
              })),
            })),
          };
          set((state) => ({ songs: [copy, ...state.songs] }));
          return copy;
        },

        toggleFavorite: (id) =>
          editSong(id, (song) => ({ ...song, favorite: !song.favorite })),

        addSection: (songId, kind, atIndex) => {
          const section = emptySection(kind);
          editSong(songId, (song) => {
            const sections = [...song.sections];
            sections.splice(atIndex ?? sections.length, 0, section);
            return { ...song, sections };
          });
          return section.id;
        },

        updateSection: (songId, sectionId, patch) =>
          editSection(songId, sectionId, (section) => ({ ...section, ...patch })),

        deleteSection: (songId, sectionId) =>
          editSong(songId, (song) => ({
            ...song,
            sections: song.sections.filter((section) => section.id !== sectionId),
          })),

        reorderSections: (songId, from, to) =>
          editSong(songId, (song) => {
            const last = song.sections.length - 1;
            if (from === to || from < 0 || from > last || to < 0 || to > last) return song;

            const sections = [...song.sections];
            const [moved] = sections.splice(from, 1);
            sections.splice(to, 0, moved);
            return { ...song, sections };
          }),

        duplicateSection: (songId, sectionId) =>
          editSong(songId, (song) => {
            const index = song.sections.findIndex((section) => section.id === sectionId);
            if (index === -1) return song;

            const source = song.sections[index];
            const copy: Section = {
              ...source,
              id: uid('s'),
              lines: source.lines.map((line) => ({
                ...line,
                id: uid('l'),
                chords: line.chords.map((chord) => ({ ...chord, id: uid('c') })),
              })),
            };
            const sections = [...song.sections];
            sections.splice(index + 1, 0, copy);
            return { ...song, sections };
          }),

        setSectionText: (songId, sectionId, text) =>
          editSong(songId, (song) => {
            const targetSection = song.sections.find((s) => s.id === sectionId);
            if (!targetSection) return song;

            const rawIncoming = text.split('\n');
            const parsedIncoming = rawIncoming.map((raw) => extractInlineChords(raw));
            const oldLines = targetSection.lines;

            // Template lines with chords from the current section first, then the rest of the
            // song, so copying and pasting lyrics repeats their chords automatically.
            const templates: Line[] = [
              ...oldLines.filter((l) => l.text.trim() !== '' && l.chords.length > 0),
              ...song.sections
                .filter((s) => s.id !== sectionId)
                .flatMap((s) => s.lines)
                .filter((l) => l.text.trim() !== '' && l.chords.length > 0),
            ];
            const findTemplate = (lineText: string): Line | undefined => {
              const key = lineText.trim().toLowerCase();
              if (!key) return undefined;
              return templates.find((t) => t.text.trim().toLowerCase() === key);
            };

            const paired = new Array<Line | undefined>(parsedIncoming.length);
            if (parsedIncoming.length === oldLines.length) {
              for (let i = 0; i < parsedIncoming.length; i += 1) {
                paired[i] = oldLines[i];
              }
            } else {
              let prefix = 0;
              while (
                prefix < oldLines.length &&
                prefix < parsedIncoming.length &&
                oldLines[prefix].text === parsedIncoming[prefix].text
              ) {
                paired[prefix] = oldLines[prefix];
                prefix += 1;
              }
              let suffix = 0;
              while (
                suffix < oldLines.length - prefix &&
                suffix < parsedIncoming.length - prefix &&
                oldLines[oldLines.length - 1 - suffix].text ===
                  parsedIncoming[parsedIncoming.length - 1 - suffix].text
              ) {
                paired[parsedIncoming.length - 1 - suffix] =
                  oldLines[oldLines.length - 1 - suffix];
                suffix += 1;
              }
              const oldMid = oldLines.slice(prefix, oldLines.length - suffix);
              const newMidStart = prefix;
              const newMidEnd = parsedIncoming.length - suffix;
              const usedOld = new Set<number>();

              for (let i = newMidStart; i < newMidEnd; i += 1) {
                const matchIdx = oldMid.findIndex(
                  (old, idx) => !usedOld.has(idx) && old.text === parsedIncoming[i].text
                );
                if (matchIdx !== -1) {
                  usedOld.add(matchIdx);
                  paired[i] = oldMid[matchIdx];
                }
              }
              let nextOld = 0;
              for (let i = newMidStart; i < newMidEnd; i += 1) {
                if (paired[i]) continue;
                while (nextOld < oldMid.length && usedOld.has(nextOld)) nextOld += 1;
                if (nextOld < oldMid.length) {
                  const candidateOld = oldMid[nextOld];
                  if (candidateOld.chords.length > 0 || !findTemplate(parsedIncoming[i].text)) {
                    usedOld.add(nextOld);
                    paired[i] = candidateOld;
                    nextOld += 1;
                  }
                }
              }
            }

            const lines: Line[] = parsedIncoming.map((entry, index) => {
              const existing = paired[index];

              if (entry.chords.length > 0) {
                return {
                  id: existing?.id ?? uid('l'),
                  text: entry.text,
                  ...(entry.instrumental ? { instrumental: true } : {}),
                  ...(existing?.dynamics ? { dynamics: existing.dynamics } : {}),
                  chords: entry.chords,
                };
              }

              if (existing && existing.chords.length > 0) {
                const positions = remapPositions(
                  existing.text,
                  entry.text,
                  existing.chords.map((chord) => chord.pos)
                );
                return {
                  ...existing,
                  text: entry.text,
                  chords: existing.chords.map((chord, i) => ({
                    ...chord,
                    pos: positions[i],
                  })),
                };
              }

              const template = findTemplate(entry.text);
              if (template) {
                const positions = remapPositions(
                  template.text,
                  entry.text,
                  template.chords.map((chord) => chord.pos)
                );
                return {
                  id: existing?.id ?? uid('l'),
                  text: entry.text,
                  ...(existing?.dynamics ? { dynamics: existing.dynamics } : {}),
                  chords: template.chords.map((chord, i) => ({
                    id: uid('c'),
                    chord: chord.chord,
                    pos: positions[i],
                  })),
                };
              }

              return existing ? { ...existing, text: entry.text } : emptyLine(entry.text);
            });

            return {
              ...song,
              sections: song.sections.map((s) => (s.id === sectionId ? { ...s, lines } : s)),
            };
          }),

        // A section with no words still needs somewhere to put the next bar of
        // chords, and the text field can't make one there: an empty line is
        // invisible to it. So the chords tab adds lines itself.
        addLine: (songId, sectionId, afterLineId) =>
          editSection(songId, sectionId, (section) => {
            const lines = [...section.lines];
            const index = afterLineId
              ? lines.findIndex((line) => line.id === afterLineId)
              : -1;
            lines.splice(index === -1 ? lines.length : index + 1, 0, emptyLine());
            return { ...section, lines };
          }),

        deleteLine: (songId, sectionId, lineId) =>
          editSection(songId, sectionId, (section) => {
            const lines = section.lines.filter((line) => line.id !== lineId);
            // A section is never truly empty: without a line there is nothing
            // left to tap, and no way back in.
            return { ...section, lines: lines.length ? lines : [emptyLine()] };
          }),

        setLineInstrumental: (songId, sectionId, lineId, instrumental) =>
          editLine(songId, sectionId, lineId, (line) => ({ ...line, instrumental })),

        setLineDynamics: (songId, sectionId, lineId, dynamics) =>
          editLine(songId, sectionId, lineId, (line) => ({
            ...line,
            dynamics: dynamics || undefined,
          })),

        addChord: (songId, sectionId, lineId, pos, chord) =>
          editLine(songId, sectionId, lineId, (line) => {
            // One chord per position — placing on an occupied spot replaces it.
            const chords = line.chords.filter((existing) => existing.pos !== pos);
            chords.push({ id: uid('c'), pos, chord });
            chords.sort((a, b) => a.pos - b.pos);
            return { ...line, chords };
          }),

        updateChord: (songId, sectionId, lineId, chordId, chord) =>
          editLine(songId, sectionId, lineId, (line) => ({
            ...line,
            chords: line.chords.map((existing) =>
              existing.id === chordId ? { ...existing, chord } : existing
            ),
          })),

        moveChord: (songId, sectionId, lineId, chordId, pos) =>
          editLine(songId, sectionId, lineId, (line) => {
            const chords = line.chords
              .filter((existing) => existing.id === chordId || existing.pos !== pos)
              .map((existing) => (existing.id === chordId ? { ...existing, pos } : existing));
            chords.sort((a, b) => a.pos - b.pos);
            return { ...line, chords };
          }),

        reorderChords: (songId, sectionId, lineId, from, to) =>
          editLine(songId, sectionId, lineId, (line) => {
            const chords = [...line.chords].sort((a, b) => a.pos - b.pos);
            const last = chords.length - 1;
            if (from === to || from < 0 || from > last || to < 0 || to > last) return line;

            const [moved] = chords.splice(from, 1);
            chords.splice(to, 0, moved);
            // `pos` carries no meaning of its own here beyond the order, so the
            // ranks are simply renumbered from the new sequence.
            return { ...line, chords: chords.map((chord, index) => ({ ...chord, pos: index })) };
          }),

        deleteChord: (songId, sectionId, lineId, chordId) =>
          editLine(songId, sectionId, lineId, (line) => ({
            ...line,
            chords: line.chords.filter((chord) => chord.id !== chordId),
          })),

        applyTranspose: (songId, semitones, useFlats) => {
          if (semitones === 0) return;
          editSong(songId, (song) => ({
            ...song,
            key: transposeKey(song.key, semitones),
            sections: song.sections.map((section) => ({
              ...section,
              lines: section.lines.map((line) => ({
                ...line,
                chords: line.chords.map((chord) => ({
                  ...chord,
                  chord: formatChord(chord.chord, { semitones, useFlats }),
                })),
              })),
            })),
          }));
        },

        createSetlist: (partial) => {
          const now = Date.now();
          const setlist: Setlist = {
            id: uid('set'),
            catalogId: get().catalogs[0]?.id ?? '',
            name: 'Nuova scaletta',
            items: [],
            createdAt: now,
            updatedAt: now,
            ...partial,
          };
          set((state) => ({ setlists: [setlist, ...state.setlists] }));
          return setlist;
        },

        updateSetlist: (id, patch) => editSetlist(id, (setlist) => ({ ...setlist, ...patch })),

        deleteSetlist: (id) =>
          set((state) => ({ setlists: state.setlists.filter((s) => s.id !== id) })),

        addToSetlist: (setlistId, item) =>
          editSetlist(setlistId, (setlist) => ({
            ...setlist,
            items: [...setlist.items, item],
          })),

        updateSetlistItem: (setlistId, itemId, patch) =>
          editSetlist(setlistId, (setlist) => ({
            ...setlist,
            items: setlist.items.map((item) =>
              item.id === itemId ? ({ ...item, ...patch } as SetlistItem) : item
            ),
          })),

        removeSetlistItem: (setlistId, itemId) =>
          editSetlist(setlistId, (setlist) => ({
            ...setlist,
            items: setlist.items.filter((item) => item.id !== itemId),
          })),

        moveSetlistItem: (setlistId, itemId, direction) =>
          editSetlist(setlistId, (setlist) => {
            const index = setlist.items.findIndex((item) => item.id === itemId);
            const target = index + direction;
            if (index === -1 || target < 0 || target >= setlist.items.length) return setlist;

            const items = [...setlist.items];
            [items[index], items[target]] = [items[target], items[index]];
            return { ...setlist, items };
          }),

        reorderSetlistItem: (setlistId, from, to) =>
          editSetlist(setlistId, (setlist) => {
            const last = setlist.items.length - 1;
            if (from === to || from < 0 || from > last || to < 0 || to > last) return setlist;

            const items = [...setlist.items];
            const [moved] = items.splice(from, 1);
            items.splice(to, 0, moved);
            return { ...setlist, items };
          }),

        setSettings: (patch) =>
          set((state) => ({ settings: { ...state.settings, ...patch } })),

        markChatSeen: (bandId, at) =>
          set((state) => ({
            chatSeen: { ...state.chatSeen, [bandId]: Math.max(state.chatSeen[bandId] ?? 0, at) },
          })),
      };
    },
    {
      name: 'chordsnote-v1',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        catalogs: state.catalogs,
        songs: state.songs,
        setlists: state.setlists,
        settings: state.settings,
        ownerUid: state.ownerUid,
        chatSeen: state.chatSeen,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) console.warn('Ripristino archivio non riuscito', error);

        useStore.setState({
          hydrated: true,
          catalogs: state?.catalogs ?? [],
          songs: state?.songs ?? [],
          setlists: state?.setlists ?? [],
          settings: { ...DEFAULT_SETTINGS, ...(state?.settings ?? {}) },
          ownerUid: state?.ownerUid ?? null,
          chatSeen: state?.chatSeen ?? {},
        });
      },
    }
  )
);

/* -------------------------------------------------------------- Selettori */

export function useCatalogs(): Catalog[] {
  return useStore((state) => state.catalogs);
}

export function useCatalog(id: string | undefined): Catalog | undefined {
  return useStore((state) => state.catalogs.find((catalog) => catalog.id === id));
}

/** What I am in this band, or `null` if it isn't a band I'm in. */
export function useBandRole(id: string | undefined): BandRole | null {
  const catalog = useCatalog(id);
  const uid = useAuth((state) => state.account?.uid ?? null);
  return bandRoleOf(catalog, uid);
}

/**
 * Whether the songs and setlists of this catalog may be changed. Personal
 * catalogs always can; a band's only by its owner and its editors. Screens ask
 * this rather than checking roles themselves, so read-only stays one idea.
 */
export function useCanEdit(id: string | undefined): boolean {
  const catalog = useCatalog(id);
  const uid = useAuth((state) => state.account?.uid ?? null);
  // A catalog we don't know yet — a song opened from a link — isn't the place
  // to start refusing edits.
  if (!catalog) return true;
  return canEditCatalog(catalog, uid);
}

/** The same question for a song, which knows only which catalog it's in. */
export function useCanEditSong(song: Song | undefined): boolean {
  return useCanEdit(song?.catalogId);
}

export function useSong(id: string | undefined): Song | undefined {
  return useStore((state) => state.songs.find((song) => song.id === id));
}

export function useSetlist(id: string | undefined): Setlist | undefined {
  return useStore((state) => state.setlists.find((setlist) => setlist.id === id));
}

/** How many songs and setlists a catalog holds — the subtitle on every card. */
export function catalogCounts(
  catalogId: string,
  songs: Song[],
  setlists: Setlist[]
): { songs: number; setlists: number } {
  return {
    songs: songs.filter((song) => song.catalogId === catalogId && !song.draft).length,
    setlists: setlists.filter((setlist) => setlist.catalogId === catalogId).length,
  };
}

/** The repertoire: everything that has been saved, drafts left out. */
export function published(songs: Song[]): Song[] {
  return songs.filter((song) => !song.draft);
}

/** Songs still being written, newest first — what the "Bozze" tab lists. */
export function drafts(songs: Song[]): Song[] {
  return songs.filter((song) => song.draft).sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * A song deleted on another device shouldn't leave a hole in a set. Both sync
 * modules call this after applying what arrived, since either of them can be
 * the one that takes a song away.
 */
export function pruneDanglingSetlistItems(): void {
  useStore.setState((state) => {
    const ids = new Set(state.songs.map((song) => song.id));
    let touched = false;

    const setlists = state.setlists.map((setlist) => {
      const items = setlist.items.filter((item) => item.type !== 'song' || ids.has(item.songId));
      if (items.length === setlist.items.length) return setlist;
      touched = true;
      return { ...setlist, items };
    });

    return touched ? { setlists } : {};
  });
}

/** "126 brani · 5 scalette", omitting the half that's empty. */
export function countsLabel(counts: { songs: number; setlists: number }): string {
  const parts = [`${counts.songs} ${counts.songs === 1 ? 'brano' : 'brani'}`];
  if (counts.setlists > 0) {
    parts.push(`${counts.setlists} ${counts.setlists === 1 ? 'scaletta' : 'scalette'}`);
  }
  return parts.join(' · ');
}
