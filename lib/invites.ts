import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

import { useAuth } from './auth';
import { db } from './firebase';
import { uid as newId } from './id';
import { useStore } from './store';
import type { Catalog, Invite, InvitedRole, Member } from './types';

/**
 * Inviting someone into a band.
 *
 * An invite is addressed to an email, not to an account. That's the whole
 * point: you invite the bass player by the address you already write to, and
 * the invitation is waiting the day they sign up — no user directory to search
 * and nothing to look up about people who aren't here yet.
 *
 * The document id is `${bandId}__${email}`, which makes inviting the same
 * person twice rewrite one invitation instead of piling up a second, and lets
 * the security rules find an invite from the band alone.
 */

const invitesRef = () => collection(db, 'invites');

export function inviteId(bandId: string, email: string): string {
  return `${bandId}__${normalizeEmail(email)}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Loose on purpose — the real check is whether the invitation is ever read. */
export function isEmail(value: string): boolean {
  const email = normalizeEmail(value);
  return /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email);
}

function fromDocument(id: string, data: Record<string, unknown>): Invite | null {
  if (typeof data.bandId !== 'string' || typeof data.email !== 'string') return null;
  const role = data.role === 'editor' ? 'editor' : 'viewer';
  return {
    id,
    bandId: data.bandId,
    bandName: typeof data.bandName === 'string' ? data.bandName : 'Una band',
    bandColor: typeof data.bandColor === 'number' ? data.bandColor : 0,
    email: data.email,
    role,
    ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : '',
    invitedByName: typeof data.invitedByName === 'string' ? data.invitedByName : '',
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
  };
}

/* ------------------------------------------------------------ Dal fondatore */

export type InviteOutcome =
  | { ok: true; invite: Invite }
  | { ok: false; reason: string };

/**
 * Sends the invitation. Refuses the cases that would produce an invite nobody
 * can use — an address that isn't one, your own, someone already in the band —
 * because each of those otherwise fails silently much later.
 */
export async function sendInvite(
  band: Catalog,
  rawEmail: string,
  role: InvitedRole
): Promise<InviteOutcome> {
  const account = useAuth.getState().account;
  if (!account) return { ok: false, reason: 'Accedi al tuo account per invitare qualcuno.' };
  if (!band.ownerUid) {
    return { ok: false, reason: 'Questa band non è ancora legata al tuo account.' };
  }
  if (band.ownerUid !== account.uid) {
    return { ok: false, reason: 'Solo chi ha fondato la band può invitare.' };
  }

  const email = normalizeEmail(rawEmail);
  if (!isEmail(email)) return { ok: false, reason: 'Questo indirizzo email non è valido.' };
  if (email === account.email?.toLowerCase()) {
    return { ok: false, reason: 'Sei già nella band.' };
  }
  if (band.members.some((member) => member.email === email && member.uid)) {
    return { ok: false, reason: 'Questa persona è già nella band.' };
  }

  const invite: Invite = {
    id: inviteId(band.id, email),
    bandId: band.id,
    bandName: band.name,
    bandColor: band.color,
    email,
    role,
    ownerUid: account.uid,
    invitedByName: account.name?.trim() || account.email || '',
    createdAt: Date.now(),
  };

  try {
    const { id, ...payload } = invite;
    await setDoc(doc(invitesRef(), id), payload);
    return { ok: true, invite };
  } catch (error) {
    return { ok: false, reason: inviteMessage(error) };
  }
}

export async function revokeInvite(id: string): Promise<void> {
  await deleteDoc(doc(invitesRef(), id));
}

/**
 * The invitations this band has out — what the owner sees under the line-up.
 *
 * `ownerUid` is in the query and not only in the rule on purpose: a Firestore
 * query is allowed by proving the rule from its own constraints, never by
 * looking at what comes back, so filtering by band alone is refused outright.
 */
export async function listBandInvites(bandId: string): Promise<Invite[]> {
  const account = useAuth.getState().account;
  if (!account) return [];
  try {
    const snapshot = await getDocs(
      query(
        invitesRef(),
        where('ownerUid', '==', account.uid),
        where('bandId', '==', bandId)
      )
    );
    const invites: Invite[] = [];
    snapshot.forEach((entry) => {
      const invite = fromDocument(entry.id, entry.data() as Record<string, unknown>);
      if (invite) invites.push(invite);
    });
    return invites.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------ All'invitato */

/** Invitations addressed to me, kept live so one arriving is visible at once. */
export function subscribeMyInvites(handle: (invites: Invite[]) => void): () => void {
  const account = useAuth.getState().account;
  const email = account?.email?.toLowerCase();
  if (!account || !email) {
    handle([]);
    return () => undefined;
  }

  return onSnapshot(
    query(invitesRef(), where('email', '==', email)),
    (snapshot) => {
      const invites: Invite[] = [];
      snapshot.forEach((entry) => {
        const invite = fromDocument(entry.id, entry.data() as Record<string, unknown>);
        if (invite) invites.push(invite);
      });
      handle(invites.sort((a, b) => b.createdAt - a.createdAt));
    },
    () => handle([])
  );
}

/**
 * Accepting. Two writes, in this order: joining the band, then tearing up the
 * invitation. The other way round the invitation would be gone before it had
 * been used, and the security rules — which read it to decide whether the join
 * is allowed — would turn the join down.
 */
export async function acceptInvite(invite: Invite): Promise<InviteOutcome> {
  const account = useAuth.getState().account;
  if (!account) return { ok: false, reason: 'Accedi al tuo account.' };

  try {
    const bandRef = doc(db, 'bands', invite.bandId);
    const snapshot = await getDoc(bandRef);
    if (!snapshot.exists()) {
      await revokeInvite(invite.id).catch(() => undefined);
      return { ok: false, reason: 'Questa band non esiste più.' };
    }

    const data = snapshot.data() as Record<string, unknown>;
    const members = Array.isArray(data.members) ? (data.members as Member[]) : [];
    const memberUids = Array.isArray(data.memberUids) ? (data.memberUids as string[]) : [];
    const editorUids = Array.isArray(data.editorUids) ? (data.editorUids as string[]) : [];

    if (memberUids.includes(account.uid)) {
      await revokeInvite(invite.id).catch(() => undefined);
      return { ok: true, invite };
    }

    const me: Member = {
      id: newId('m'),
      name: account.name?.trim() || account.email || 'Nuovo membro',
      color: members.length % 4,
      uid: account.uid,
      email: invite.email,
      role: invite.role,
    };

    await updateDoc(bandRef, {
      members: [...members, me],
      memberUids: [...memberUids, account.uid],
      editorUids: invite.role === 'editor' ? [...editorUids, account.uid] : editorUids,
      updatedAt: Date.now(),
    });
    await deleteDoc(doc(invitesRef(), invite.id));

    return { ok: true, invite };
  } catch (error) {
    return { ok: false, reason: inviteMessage(error) };
  }
}

export async function declineInvite(invite: Invite): Promise<void> {
  await revokeInvite(invite.id).catch(() => undefined);
}

/**
 * Leaving a band is `leaveBand`; this is only for the local side of accepting,
 * kept here so the screen has one place to call after an invitation is taken.
 */
export function bandAlreadyHere(bandId: string): boolean {
  return useStore.getState().catalogs.some((catalog) => catalog.id === bandId);
}

/** Firestore's permission errors, said in a way that helps. */
export function inviteMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  if (code === 'permission-denied') {
    return 'Non hai i permessi per questa operazione. Prova a ricaricare la pagina.';
  }
  if (code === 'unavailable' || code === 'failed-precondition') {
    return 'Nessuna connessione. Riprova quando sei online.';
  }
  return (error as { message?: string })?.message ?? 'Qualcosa è andato storto.';
}
