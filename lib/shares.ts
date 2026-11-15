import { collection, deleteDoc, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';

import { useAuth } from './auth';
import { db, prune } from './firebase';
import { isEmail, normalizeEmail } from './invites';
import { useStore } from './store';
import type { Song, SongShare } from './types';

/**
 * Handing a song to somebody else.
 *
 * The same shape as an invite, for the same reason: it is addressed to an
 * email, so you send the song to the address you already write to and it is
 * waiting the day they sign up. The song rides inside the document because the
 * recipient has no way to read your private branch.
 *
 * Accepting makes a copy in the recipient's own catalog, under a new id. From
 * then on the two are unrelated — for a song that stays in step with someone
 * else's, the answer is a band.
 */

const sharesRef = () => collection(db, 'shares');

export function shareId(songId: string, email: string): string {
  return `${songId}__${normalizeEmail(email)}`;
}

function fromDocument(id: string, data: Record<string, unknown>): SongShare | null {
  const song = data.song as Song | undefined;
  if (!song || typeof song !== 'object' || typeof data.email !== 'string') return null;
  return {
    id,
    songId: typeof data.songId === 'string' ? data.songId : song.id,
    email: data.email,
    fromUid: typeof data.fromUid === 'string' ? data.fromUid : '',
    fromName: typeof data.fromName === 'string' ? data.fromName : '',
    title: typeof data.title === 'string' ? data.title : song.title || 'Senza titolo',
    artist: typeof data.artist === 'string' ? data.artist : song.artist || '',
    song,
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
  };
}

export type ShareOutcome = { ok: true; share: SongShare } | { ok: false; reason: string };

/* ------------------------------------------------------------ Da chi invia */

/**
 * Refuses up front the cases that would produce a delivery nobody can use —
 * an address that isn't one, or your own — since each of those otherwise
 * fails silently, much later, as a share that simply never appears.
 */
export async function sendSong(song: Song, rawEmail: string): Promise<ShareOutcome> {
  const account = useAuth.getState().account;
  if (!account) return { ok: false, reason: 'Accedi al tuo account per inviare un brano.' };

  const email = normalizeEmail(rawEmail);
  if (!isEmail(email)) return { ok: false, reason: 'Questo indirizzo email non è valido.' };
  if (email === account.email?.toLowerCase()) {
    return { ok: false, reason: 'Questo è il tuo indirizzo.' };
  }

  const share: SongShare = {
    id: shareId(song.id, email),
    songId: song.id,
    email,
    fromUid: account.uid,
    fromName: account.name?.trim() || account.email || '',
    title: song.title || 'Senza titolo',
    artist: song.artist || '',
    // A draft is a song you're still writing; it arrives as a finished one.
    song: { ...song, draft: undefined, favorite: false },
    createdAt: Date.now(),
  };

  try {
    const { id, ...payload } = share;
    await setDoc(doc(sharesRef(), id), prune(payload));
    return { ok: true, share };
  } catch (error) {
    return { ok: false, reason: shareMessage(error) };
  }
}

/** The deliveries I have out, so they can be taken back before being taken up. */
export function subscribeSentSongs(handle: (shares: SongShare[]) => void): () => void {
  const account = useAuth.getState().account;
  if (!account) {
    handle([]);
    return () => undefined;
  }

  return onSnapshot(
    query(sharesRef(), where('fromUid', '==', account.uid)),
    (snapshot) => {
      const shares: SongShare[] = [];
      snapshot.forEach((entry) => {
        const share = fromDocument(entry.id, entry.data() as Record<string, unknown>);
        if (share) shares.push(share);
      });
      handle(shares.sort((a, b) => b.createdAt - a.createdAt));
    },
    () => handle([])
  );
}

export async function revokeShare(id: string): Promise<void> {
  await deleteDoc(doc(sharesRef(), id)).catch(() => undefined);
}

/* --------------------------------------------------------- A chi riceve */

/** Songs sent to me, kept live so one arriving is visible at once. */
export function subscribeSongsForMe(handle: (shares: SongShare[]) => void): () => void {
  const account = useAuth.getState().account;
  const email = account?.email?.toLowerCase();
  if (!account || !email) {
    handle([]);
    return () => undefined;
  }

  return onSnapshot(
    query(sharesRef(), where('email', '==', email)),
    (snapshot) => {
      const shares: SongShare[] = [];
      snapshot.forEach((entry) => {
        const share = fromDocument(entry.id, entry.data() as Record<string, unknown>);
        if (share) shares.push(share);
      });
      handle(shares.sort((a, b) => b.createdAt - a.createdAt));
    },
    () => handle([])
  );
}

/**
 * Taking it. The copy is made locally and lands in a catalog of mine, which
 * `personalContent` then sends up like anything else I wrote — the sender's
 * branch is never touched. The delivery is torn up only once the copy exists,
 * so a failure here leaves it there to try again.
 */
export async function acceptSharedSong(share: SongShare): Promise<ShareOutcome> {
  const account = useAuth.getState().account;
  if (!account) return { ok: false, reason: 'Accedi al tuo account.' };

  try {
    const store = useStore.getState();
    const catalogId = store.ensurePersonalCatalog();

    // The sender's id and dates are dropped rather than carried over: this is
    // my copy, made now, and it must not collide with anything already here.
    // `createSong` spreads what it is given over its own defaults, so leaving
    // these out is what lets it mint a fresh id.
    const { id, createdAt, updatedAt, draft, ...content } = share.song;
    store.createSong({ ...content, catalogId, favorite: false, draft: undefined });

    await revokeShare(share.id);
    return { ok: true, share };
  } catch (error) {
    return { ok: false, reason: shareMessage(error) };
  }
}

export async function declineSharedSong(share: SongShare): Promise<void> {
  await revokeShare(share.id);
}

/** Firestore's permission errors, said in a way that helps. */
export function shareMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  if (code === 'permission-denied') {
    return 'Non hai i permessi per questa operazione. Prova a ricaricare la pagina.';
  }
  if (code === 'unavailable' || code === 'failed-precondition') {
    return 'Nessuna connessione. Riprova quando sei online.';
  }
  return (error as { message?: string })?.message ?? 'Qualcosa è andato storto.';
}
