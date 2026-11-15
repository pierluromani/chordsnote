import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { bandAgenda, upcoming } from './agenda';
import { useAuth } from './auth';
import { subscribeMessages } from './bandChat';
import { db, prune } from './firebase';
import { uid as newId } from './id';
import { useStore } from './store';
import type { BandEvent, BandEventKind, BandMessage } from './types';

/**
 * Il calendario di una band: `bands/{bandId}/events`, fratello di `messages`.
 * Nessuno store, nessuna persistenza locale — vive nella schermata che lo
 * tiene aperto, come la bacheca.
 */

const eventsRef = (bandId: string) => collection(db, 'bands', bandId, 'events');

const KINDS: BandEventKind[] = ['gig', 'rehearsal', 'other'];

function fromDocument(id: string, bandId: string, data: Record<string, unknown>): BandEvent | null {
  if (typeof data.at !== 'string' || typeof data.title !== 'string') return null;

  return {
    id,
    bandId,
    kind: KINDS.includes(data.kind as BandEventKind) ? (data.kind as BandEventKind) : 'other',
    title: data.title,
    at: data.at,
    place: typeof data.place === 'string' ? data.place : undefined,
    note: typeof data.note === 'string' ? data.note : undefined,
    setlistId: typeof data.setlistId === 'string' ? data.setlistId : undefined,
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
  };
}

/** Scrive una data nuova o riscrive quella che c'è: l'id decide quale. */
export async function saveEvent(
  bandId: string,
  draft: Omit<BandEvent, 'id' | 'bandId' | 'createdBy' | 'createdAt'> & { id?: string }
): Promise<void> {
  const account = useAuth.getState().account;
  if (!account) return;

  const title = draft.title.trim().slice(0, 120);
  if (!title || !draft.at) return;

  const id = draft.id ?? newId('evt');
  await setDoc(
    doc(eventsRef(bandId), id),
    prune({
      kind: draft.kind,
      title,
      at: draft.at,
      place: draft.place?.trim() || undefined,
      note: draft.note?.trim() || undefined,
      setlistId: draft.setlistId,
      createdBy: account.uid,
      createdAt: Date.now(),
    })
  );
}

/** Dal vivo, in ordine di data. Come `subscribeMessages`, in errore torna vuota. */
export function subscribeEvents(
  bandId: string,
  handle: (events: BandEvent[]) => void
): () => void {
  return onSnapshot(
    query(eventsRef(bandId), orderBy('at')),
    (snapshot) => {
      const events: BandEvent[] = [];
      snapshot.forEach((entry) => {
        const event = fromDocument(entry.id, bandId, entry.data() as Record<string, unknown>);
        if (event) events.push(event);
      });
      handle(events);
    },
    () => handle([])
  );
}

export async function deleteEvent(bandId: string, eventId: string): Promise<void> {
  await deleteDoc(doc(eventsRef(bandId), eventId));
}

/**
 * Quello che di una band cambia da solo: le date in arrivo e i messaggi non
 * letti. Sta qui e non in due punti perché la dashboard, la card nella lista
 * band e il calendario chiedono le stesse tre cose.
 *
 * ponytail: due listener per band, quindi la lista band ne apre 2×N. Con le
 * band che una persona ha davvero non si sente; se un giorno se ne sentisse,
 * il posto dove metterle in cache è lo store.
 */
export function useBandPulse(bandId: string | undefined, live: boolean) {
  const [events, setEvents] = useState<BandEvent[]>([]);
  const [messages, setMessages] = useState<BandMessage[]>([]);

  const setlists = useStore((state) => state.setlists);
  const seen = useStore((state) => state.chatSeen[bandId ?? ''] ?? 0);
  const uid = useAuth((state) => state.account?.uid ?? null);

  useEffect(() => {
    if (!bandId || !live) {
      setEvents([]);
      setMessages([]);
      return;
    }
    const stopEvents = subscribeEvents(bandId, setEvents);
    const stopMessages = subscribeMessages(bandId, setMessages);
    return () => {
      stopEvents();
      stopMessages();
    };
  }, [bandId, live]);

  // Anche una band che vive solo su questo telefono ha un'agenda: le scalette
  // datate ci sono lo stesso, è solo Firestore che non c'è.
  const agenda = bandAgenda(
    events,
    setlists.filter((setlist) => setlist.catalogId === bandId)
  );
  const ahead = upcoming(agenda);

  return {
    events,
    agenda,
    ahead,
    next: ahead[0],
    lastMessage: messages[messages.length - 1],
    unread: messages.filter((message) => message.createdAt > seen && message.uid !== uid).length,
  };
}
