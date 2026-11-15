import {
  collection,
  deleteDoc,
  doc,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';

import { useAuth } from './auth';
import { db, prune } from './firebase';
import { uid as newId } from './id';
import type { BandMessage } from './types';

/**
 * A band's bacheca: `bands/{bandId}/messages`, the sibling of `songs` and
 * `setlists`. No store, no local persistence — like invites and deliveries,
 * a chat lives in whatever screen has it open.
 */

const messagesRef = (bandId: string) => collection(db, 'bands', bandId, 'messages');

function fromDocument(id: string, bandId: string, data: Record<string, unknown>): BandMessage | null {
  if (typeof data.uid !== 'string' || typeof data.text !== 'string') return null;
  const rawRef = data.ref as Record<string, unknown> | undefined;
  const ref =
    rawRef && (rawRef.kind === 'song' || rawRef.kind === 'setlist') && typeof rawRef.id === 'string'
      ? { kind: rawRef.kind, id: rawRef.id, title: typeof rawRef.title === 'string' ? rawRef.title : '' }
      : undefined;

  return {
    id,
    bandId,
    uid: data.uid,
    name: typeof data.name === 'string' ? data.name : 'Un membro',
    text: data.text,
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
    ref,
  };
}

export async function sendMessage(
  bandId: string,
  text: string,
  ref?: BandMessage['ref']
): Promise<void> {
  const account = useAuth.getState().account;
  if (!account) return;

  const clean = text.trim().slice(0, 2000);
  if (!clean) return;

  const message: BandMessage = {
    id: newId('msg'),
    bandId,
    uid: account.uid,
    name: account.name?.trim() || account.email || 'Tu',
    text: clean,
    createdAt: Date.now(),
    ref,
  };

  const { id, ...payload } = message;
  await setDoc(doc(messagesRef(bandId), id), prune(payload));
}

/** Live, newest 200. Degrades to empty on error, like `subscribeMyInvites`. */
export function subscribeMessages(
  bandId: string,
  handle: (messages: BandMessage[]) => void
): () => void {
  return onSnapshot(
    query(messagesRef(bandId), orderBy('createdAt'), limitToLast(200)),
    (snapshot) => {
      const messages: BandMessage[] = [];
      snapshot.forEach((entry) => {
        const message = fromDocument(entry.id, bandId, entry.data() as Record<string, unknown>);
        if (message) messages.push(message);
      });
      handle(messages);
    },
    () => handle([])
  );
}

export async function deleteMessage(bandId: string, messageId: string): Promise<void> {
  await deleteDoc(doc(messagesRef(bandId), messageId));
}
