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
import { canEditCatalog, type Catalog, type Setlist, type Song } from './types';

/**
 * The repertoire and the setlists of a shared band, kept the same on
 * everybody's phone.
 *
 * Being an editor has to mean something, and the only thing it can mean is
 * that what you write reaches the others. So band songs and band setlists live
 * under `/bands/{id}/songs` and `/bands/{id}/setlists`, and this module keeps
 * the local store and those collections in step.
 *
 * On deleting — the one place this parts company with `bandSync`'s "a sync
 * never removes anything" rule. It still doesn't remove anything because
 * something is *missing*: a song goes away here only when Firestore reports it
 * as `removed` while we are listening, which is somebody actually deleting it.
 * A snapshot that simply doesn't mention a song leaves it exactly where it is,
 * and it gets pushed up instead. Personal catalogs are never touched at all.
 */

/**
 * What we believe the server holds. The band is part of the record, not just
 * the timestamp: without it a local deletion has nowhere to be aimed, and the
 * only way to honour it would be to fire a delete at every band we can write
 * to and hope one of them is the right one.
 */
type Known = { bandId: string; updatedAt: number };

const songMirror = new Map<string, Known>();
const setlistMirror = new Map<string, Known>();

let listeners: Array<() => void> = [];
let unsubscribeStore: (() => void) | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let watchedBands = '';

/** Bands whose content is shared: the ones an account owns and I'm inside. */
function sharedBands(): Catalog[] {
  const account = useAuth.getState().account;
  if (!account) return [];
  return useStore
    .getState()
    .catalogs.filter(
      (catalog) =>
        catalog.kind === 'band' &&
        !!catalog.ownerUid &&
        (catalog.memberUids ?? []).includes(account.uid)
    );
}

/* ------------------------------------------------------------- In arrivo */

function applySongs(bandId: string, changes: Array<{ type: string; id: string; data: DocumentData }>) {
  if (changes.length === 0) return;

  useStore.setState((state) => {
    const byId = new Map(state.songs.map((song) => [song.id, song]));
    let touched = false;

    for (const change of changes) {
      if (change.type === 'removed') {
        if (byId.delete(change.id)) touched = true;
        songMirror.delete(change.id);
        continue;
      }

      const song = change.data as unknown as Song;
      if (!song || typeof song.id !== 'string') continue;
      songMirror.set(song.id, { bandId, updatedAt: song.updatedAt ?? 0 });

      const here = byId.get(song.id);
      if (here && (here.updatedAt ?? 0) >= (song.updatedAt ?? 0)) continue;
      byId.set(song.id, { ...song, catalogId: bandId, draft: undefined });
      touched = true;
    }

    if (!touched) return {};
    // Order matters to nobody here — the lists sort themselves — but keeping
    // the array stable avoids every open screen re-rendering from scratch.
    const kept = state.songs.filter((song) => byId.has(song.id)).map((song) => byId.get(song.id)!);
    const seen = new Set(kept.map((song) => song.id));
    const added = [...byId.values()].filter((song) => !seen.has(song.id));
    return { songs: [...added, ...kept] };
  });

  // Anything the setlists point at may have just arrived or gone.
  pruneDanglingSetlistItems();
}

function applySetlists(
  bandId: string,
  changes: Array<{ type: string; id: string; data: DocumentData }>
) {
  if (changes.length === 0) return;

  useStore.setState((state) => {
    const byId = new Map(state.setlists.map((setlist) => [setlist.id, setlist]));
    let touched = false;

    for (const change of changes) {
      if (change.type === 'removed') {
        if (byId.delete(change.id)) touched = true;
        setlistMirror.delete(change.id);
        continue;
      }

      const setlist = change.data as unknown as Setlist;
      if (!setlist || typeof setlist.id !== 'string') continue;
      setlistMirror.set(setlist.id, { bandId, updatedAt: setlist.updatedAt ?? 0 });

      const here = byId.get(setlist.id);
      if (here && (here.updatedAt ?? 0) >= (setlist.updatedAt ?? 0)) continue;
      byId.set(setlist.id, { ...setlist, catalogId: bandId });
      touched = true;
    }

    if (!touched) return {};
    const kept = state.setlists
      .filter((setlist) => byId.has(setlist.id))
      .map((setlist) => byId.get(setlist.id)!);
    const seen = new Set(kept.map((setlist) => setlist.id));
    const added = [...byId.values()].filter((setlist) => !seen.has(setlist.id));
    return { setlists: [...added, ...kept] };
  });
}

/* ------------------------------------------------------------- In partenza */

/**
 * Sends up whatever changed since last time. Drafts stay out — a song you're
 * halfway through writing is yours until you save it — and a viewer sends
 * nothing at all, since the rules would refuse it anyway.
 */
async function pushChanges() {
  const account = useAuth.getState().account;
  if (!account) return;

  const bands = sharedBands().filter((band) => canEditCatalog(band, account.uid));
  const writable = new Set(bands.map((band) => band.id));
  if (writable.size === 0) return;

  const state = useStore.getState();
  const jobs: Array<Promise<unknown>> = [];

  const localSongs = state.songs.filter(
    (song) => writable.has(song.catalogId) && !song.draft
  );
  const localSongIds = new Set(localSongs.map((song) => song.id));

  for (const song of localSongs) {
    const known = songMirror.get(song.id);
    if (known?.bandId === song.catalogId && known.updatedAt === song.updatedAt) continue;
    songMirror.set(song.id, { bandId: song.catalogId, updatedAt: song.updatedAt });
    jobs.push(
      setDoc(doc(db, 'bands', song.catalogId, 'songs', song.id), prune({ ...song, draft: undefined }))
        .catch(() => songMirror.delete(song.id))
    );
  }

  const localSetlists = state.setlists.filter((setlist) => writable.has(setlist.catalogId));
  const localSetlistIds = new Set(localSetlists.map((setlist) => setlist.id));

  for (const setlist of localSetlists) {
    const known = setlistMirror.get(setlist.id);
    if (known?.bandId === setlist.catalogId && known.updatedAt === setlist.updatedAt) continue;
    setlistMirror.set(setlist.id, { bandId: setlist.catalogId, updatedAt: setlist.updatedAt });
    jobs.push(
      setDoc(doc(db, 'bands', setlist.catalogId, 'setlists', setlist.id), prune(setlist))
        .catch(() => setlistMirror.delete(setlist.id))
    );
  }

  // Gone from here and we know the server had it: that's a real deletion, and
  // we know exactly which band's copy to take down. Bands we can no longer
  // write to are skipped — leaving one shouldn't empty it for everybody else.
  for (const [id, known] of [...songMirror.entries()]) {
    if (localSongIds.has(id) || !writable.has(known.bandId)) continue;
    songMirror.delete(id);
    jobs.push(deleteDoc(doc(db, 'bands', known.bandId, 'songs', id)).catch(() => undefined));
  }
  for (const [id, known] of [...setlistMirror.entries()]) {
    if (localSetlistIds.has(id) || !writable.has(known.bandId)) continue;
    setlistMirror.delete(id);
    jobs.push(deleteDoc(doc(db, 'bands', known.bandId, 'setlists', id)).catch(() => undefined));
  }

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

/* ------------------------------------------------------------ Avvio e stop */

function listenTo(bands: Catalog[]) {
  for (const stop of listeners) stop();
  listeners = [];

  for (const band of bands) {
    listeners.push(
      onSnapshot(
        collection(db, 'bands', band.id, 'songs'),
        (snapshot) =>
          applySongs(
            band.id,
            snapshot.docChanges().map((change) => ({
              type: change.type,
              id: change.doc.id,
              data: change.doc.data(),
            }))
          ),
        () => undefined
      )
    );
    listeners.push(
      onSnapshot(
        collection(db, 'bands', band.id, 'setlists'),
        (snapshot) =>
          applySetlists(
            band.id,
            snapshot.docChanges().map((change) => ({
              type: change.type,
              id: change.doc.id,
              data: change.doc.data(),
            }))
          ),
        () => undefined
      )
    );
  }
}

/**
 * Starts listening and pushing. Safe to call again — joining a band adds its
 * two listeners without disturbing the ones already running.
 */
export function startBandContentSync(): void {
  const account = useAuth.getState().account;
  if (!account) return;

  const attach = () => {
    const bands = sharedBands();
    const key = bands.map((band) => band.id).sort().join(',');
    if (key !== watchedBands) {
      watchedBands = key;
      listenTo(bands);
    }
  };

  attach();

  unsubscribeStore?.();
  unsubscribeStore = useStore.subscribe(() => {
    attach();
    schedulePush();
  });

  schedulePush();
}

export function stopBandContentSync(): void {
  for (const stop of listeners) stop();
  listeners = [];
  unsubscribeStore?.();
  unsubscribeStore = null;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  watchedBands = '';
  // Forgetting what the server had is what stops a signed-out session from
  // coming back later and deleting songs it merely can't see any more.
  songMirror.clear();
  setlistMirror.clear();
}
