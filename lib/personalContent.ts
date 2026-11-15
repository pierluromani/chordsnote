import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  type DocumentData,
} from 'firebase/firestore';

import { useAuth } from './auth';
import { db, prune } from './firebase';
import { pruneDanglingSetlistItems, useStore } from './store';
import type { Catalog, Setlist, Song } from './types';

/**
 * Your own catalogs, songs and setlists, kept on the account instead of on one
 * phone — the counterpart to `bandContent`, which does the same for what a
 * band shares.
 *
 * Everything lives under `/users/{uid}`, a branch the rules hand to exactly
 * one account. There are no roles to weigh and no other writer to lose a race
 * against: whoever can read this can write it, so the merge only ever has to
 * settle a disagreement between two of your own devices, by `updatedAt`.
 *
 * Deleting follows the same rule `bandContent` uses. Something goes only when
 * we watched it go — Firestore reported it `removed`, or it was in our mirror
 * and has since left the store. A snapshot that simply doesn't mention a song
 * leaves it alone and sends it up instead, so a device coming back from a long
 * time offline can't wipe what it never saw.
 *
 * Drafts travel too. Nobody else can read them, and a song you were halfway
 * through writing is exactly the thing you'd resent losing when you pick up a
 * different device.
 */

/** What we believe the server holds: id to the stamp we last saw. */
const catalogMirror = new Map<string, number>();
const songMirror = new Map<string, number>();
const setlistMirror = new Map<string, number>();

let listeners: Array<() => void> = [];
let unsubscribeStore: (() => void) | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let watchedUid = '';

type Change = { type: string; id: string; data: DocumentData };

/** Catalogs carry `updatedAt` only once edited; before that, creation stands. */
const stamp = (entry: { updatedAt?: number; createdAt?: number }): number =>
  entry.updatedAt ?? entry.createdAt ?? 0;

/** The catalogs that are mine alone. A band's content is not this module's. */
function personalCatalogIds(): Set<string> {
  return new Set(
    useStore
      .getState()
      .catalogs.filter((catalog) => catalog.kind === 'personal')
      .map((catalog) => catalog.id)
  );
}

/**
 * Rebuilds a list so what was already there keeps its position and anything
 * new lands at the end — catalogs are drawn in array order, and a list that
 * reshuffles itself under the reader is its own kind of bug.
 */
function merge<T extends { id: string }>(previous: T[], byId: Map<string, T>): T[] {
  const kept = previous.filter((entry) => byId.has(entry.id)).map((entry) => byId.get(entry.id)!);
  const seen = new Set(kept.map((entry) => entry.id));
  return [...kept, ...[...byId.values()].filter((entry) => !seen.has(entry.id))];
}

/* -------------------------------------------------------------- In arrivo */

function applyCatalogs(changes: Change[]) {
  if (changes.length === 0) return;

  useStore.setState((state) => {
    const byId = new Map(state.catalogs.map((catalog) => [catalog.id, catalog]));
    let touched = false;

    for (const change of changes) {
      if (change.type === 'removed') {
        catalogMirror.delete(change.id);
        // Only ever a personal one: a band that happened to share an id is
        // somebody else's business entirely.
        if (byId.get(change.id)?.kind === 'personal' && byId.delete(change.id)) touched = true;
        continue;
      }

      const catalog = change.data as unknown as Catalog;
      if (!catalog || typeof catalog.id !== 'string') continue;
      catalogMirror.set(catalog.id, stamp(catalog));

      const here = byId.get(catalog.id);
      if (here && stamp(here) >= stamp(catalog)) continue;
      byId.set(catalog.id, { ...catalog, kind: 'personal' });
      touched = true;
    }

    return touched ? { catalogs: merge(state.catalogs, byId) } : {};
  });
}

function applySongs(changes: Change[]) {
  if (changes.length === 0) return;

  const mine = personalCatalogIds();

  useStore.setState((state) => {
    const byId = new Map(state.songs.map((song) => [song.id, song]));
    let touched = false;

    for (const change of changes) {
      if (change.type === 'removed') {
        songMirror.delete(change.id);
        // A band song is `bandContent`'s to remove, never this module's.
        const here = byId.get(change.id);
        if (here && mine.has(here.catalogId) && byId.delete(change.id)) touched = true;
        continue;
      }

      const song = change.data as unknown as Song;
      if (!song || typeof song.id !== 'string') continue;
      songMirror.set(song.id, stamp(song));

      const here = byId.get(song.id);
      if (here && stamp(here) >= stamp(song)) continue;
      byId.set(song.id, song);
      touched = true;
    }

    return touched ? { songs: merge(state.songs, byId) } : {};
  });

  pruneDanglingSetlistItems();
}

function applySetlists(changes: Change[]) {
  if (changes.length === 0) return;

  const mine = personalCatalogIds();

  useStore.setState((state) => {
    const byId = new Map(state.setlists.map((setlist) => [setlist.id, setlist]));
    let touched = false;

    for (const change of changes) {
      if (change.type === 'removed') {
        setlistMirror.delete(change.id);
        const here = byId.get(change.id);
        if (here && mine.has(here.catalogId) && byId.delete(change.id)) touched = true;
        continue;
      }

      const setlist = change.data as unknown as Setlist;
      if (!setlist || typeof setlist.id !== 'string') continue;
      setlistMirror.set(setlist.id, stamp(setlist));

      const here = byId.get(setlist.id);
      if (here && stamp(here) >= stamp(setlist)) continue;
      byId.set(setlist.id, setlist);
      touched = true;
    }

    return touched ? { setlists: merge(state.setlists, byId) } : {};
  });
}

/* ------------------------------------------------------------ In partenza */

async function pushChanges() {
  const account = useAuth.getState().account;
  if (!account) return;

  const state = useStore.getState();
  const mine = personalCatalogIds();
  const jobs: Array<Promise<unknown>> = [];

  const at = (kind: string, id: string) => doc(db, 'users', account.uid, kind, id);

  const catalogs = state.catalogs.filter((catalog) => catalog.kind === 'personal');
  for (const catalog of catalogs) {
    if (catalogMirror.get(catalog.id) === stamp(catalog)) continue;
    catalogMirror.set(catalog.id, stamp(catalog));
    jobs.push(
      setDoc(at('catalogs', catalog.id), prune(catalog)).catch(() =>
        catalogMirror.delete(catalog.id)
      )
    );
  }

  const songs = state.songs.filter((song) => mine.has(song.catalogId));
  for (const song of songs) {
    if (songMirror.get(song.id) === stamp(song)) continue;
    songMirror.set(song.id, stamp(song));
    jobs.push(setDoc(at('songs', song.id), prune(song)).catch(() => songMirror.delete(song.id)));
  }

  const setlists = state.setlists.filter((setlist) => mine.has(setlist.catalogId));
  for (const setlist of setlists) {
    if (setlistMirror.get(setlist.id) === stamp(setlist)) continue;
    setlistMirror.set(setlist.id, stamp(setlist));
    jobs.push(
      setDoc(at('setlists', setlist.id), prune(setlist)).catch(() =>
        setlistMirror.delete(setlist.id)
      )
    );
  }

  // Gone from here, and we know the server had it: that is a real deletion.
  const sweep = (mirror: Map<string, number>, kind: string, alive: Set<string>) => {
    for (const id of [...mirror.keys()]) {
      if (alive.has(id)) continue;
      mirror.delete(id);
      jobs.push(deleteDoc(at(kind, id)).catch(() => undefined));
    }
  };

  sweep(catalogMirror, 'catalogs', new Set(catalogs.map((entry) => entry.id)));
  sweep(songMirror, 'songs', new Set(songs.map((entry) => entry.id)));
  sweep(setlistMirror, 'setlists', new Set(setlists.map((entry) => entry.id)));

  await Promise.all(jobs);
}

/** Typing a lyric shouldn't be one write per keystroke. */
function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushChanges();
  }, 900);
}

/* ----------------------------------------------------------- Avvio e stop */

function listenTo(uid: string) {
  for (const stop of listeners) stop();
  listeners = [];

  const watch = (kind: string, apply: (changes: Change[]) => void) =>
    listeners.push(
      onSnapshot(
        collection(db, 'users', uid, kind),
        (snapshot) =>
          apply(
            snapshot.docChanges().map((change) => ({
              type: change.type,
              id: change.doc.id,
              data: change.doc.data(),
            }))
          ),
        () => undefined
      )
    );

  // Catalogs first, so a song arriving in the same tick already has a home.
  watch('catalogs', applyCatalogs);
  watch('songs', applySongs);
  watch('setlists', applySetlists);
}

export function startPersonalSync(): void {
  const account = useAuth.getState().account;
  if (!account) return;

  if (watchedUid !== account.uid || listeners.length === 0) {
    watchedUid = account.uid;
    listenTo(account.uid);
  }

  unsubscribeStore?.();
  unsubscribeStore = useStore.subscribe(schedulePush);

  schedulePush();
}

export function stopPersonalSync(): void {
  for (const stop of listeners) stop();
  listeners = [];
  unsubscribeStore?.();
  unsubscribeStore = null;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  watchedUid = '';
  // Forgetting what the server had is what stops a signed-out session from
  // coming back later and deleting songs it merely can't see any more.
  catalogMirror.clear();
  songMirror.clear();
  setlistMirror.clear();
}
