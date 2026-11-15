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
import type { BandRole, Catalog, Member } from './types';

/**
 * Bands, shared between the accounts that play in them.
 *
 * A band used to be a private copy under `users/{uid}/bands` — fine for
 * carrying your own bands between phones, useless for playing with anyone.
 * Now it's one document at `/bands/{id}` that everybody in the line-up reads,
 * with two lists deciding who may do what: `memberUids` sees it, `editorUids`
 * writes its repertoire. The owner is in both.
 *
 * The rule this still follows: **nothing local is ever deleted by a sync.**
 * Merging keeps what's here and adds what the account knows. A band leaves
 * this device only when you delete it or leave it yourself. Songs and setlists
 * are the one exception, and a narrow one — see `bandContent.ts`.
 */

const bandsRef = () => collection(db, 'bands');
const bandRef = (bandId: string) => doc(db, 'bands', bandId);

/** The old private branch, still read once so nobody's bands go missing. */
const legacyBandsRef = (accountUid: string) => collection(db, 'users', accountUid, 'bands');

/* ------------------------------------------------------------- Conversione */

/** Firestore rejects `undefined`, so optional fields are dropped, not sent empty. */
function toDocument(band: Catalog): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: band.id,
    name: band.name,
    kind: 'band',
    color: band.color,
    members: band.members.map(cleanMember),
    ownerUid: band.ownerUid,
    memberUids: band.memberUids ?? [],
    editorUids: band.editorUids ?? [],
    createdAt: band.createdAt,
    updatedAt: band.updatedAt ?? band.createdAt,
  };
  if (band.description) out.description = band.description;
  return out;
}

/** Same reason: a member with no account carries no `uid` field at all. */
function cleanMember(member: Member): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: member.id,
    name: member.name,
    color: member.color,
    role: member.role ?? 'viewer',
  };
  if (member.uid) out.uid = member.uid;
  if (member.email) out.email = member.email;
  return out;
}

function fromDocument(data: Record<string, unknown>): Catalog | null {
  if (typeof data.id !== 'string' || typeof data.name !== 'string') return null;
  return {
    id: data.id,
    name: data.name,
    kind: 'band',
    color: typeof data.color === 'number' ? data.color : 0,
    members: Array.isArray(data.members) ? (data.members as Member[]) : [],
    description: typeof data.description === 'string' ? data.description : undefined,
    ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : undefined,
    memberUids: Array.isArray(data.memberUids) ? (data.memberUids as string[]) : [],
    editorUids: Array.isArray(data.editorUids) ? (data.editorUids as string[]) : [],
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : undefined,
  };
}

/* ----------------------------------------------------------- Appropriazione */

/**
 * Turns a band that only ever existed on this phone into one an account owns.
 * Everything else about it — name, colour, the line-up written by hand — is
 * left exactly as it was; all that's added is who it belongs to.
 */
export function claimBand(band: Catalog, account: { uid: string; name: string | null; email: string | null }): Catalog {
  const already = band.members.find((member) => member.uid === account.uid);
  const members = already
    ? band.members.map((member) =>
        member.uid === account.uid ? { ...member, role: 'owner' as BandRole } : member
      )
    : [
        {
          id: newId('m'),
          name: account.name?.trim() || account.email || 'Tu',
          color: band.members.length % 4,
          uid: account.uid,
          email: account.email?.toLowerCase() ?? undefined,
          role: 'owner' as BandRole,
        },
        ...band.members,
      ];

  return {
    ...band,
    ownerUid: account.uid,
    memberUids: [account.uid],
    editorUids: [account.uid],
    members,
  };
}

/* ------------------------------------------------------------- Scrittura */

/**
 * Sends a band up. Only the owner may: the security rules let everyone else
 * change the repertoire but not the line-up, so an editor pushing here would
 * just collect a permission error.
 */
export async function pushBand(band: Catalog): Promise<void> {
  const account = useAuth.getState().account;
  if (!account || band.kind !== 'band') return;
  if (band.ownerUid !== account.uid) return;
  await setDoc(bandRef(band.id), toDocument(band));
}

/**
 * Deleting a band for everyone in it.
 *
 * The shared document has to go, and it has to go *last*: the security rules
 * decide who may touch the repertoire by reading the band, so once the band is
 * gone its songs can no longer be reached at all. Deleting them afterwards is
 * impossible, which is why they're cleared first and best-effort — a leftover
 * song under a band that no longer exists is unreadable by anyone, but leaving
 * it there is still litter.
 */
export async function removeBand(bandId: string): Promise<void> {
  const account = useAuth.getState().account;
  if (!account) return;

  for (const kind of ['songs', 'setlists'] as const) {
    try {
      const contents = await getDocs(collection(db, 'bands', bandId, kind));
      await Promise.all(
        contents.docs.map((entry) =>
          deleteDoc(doc(db, 'bands', bandId, kind, entry.id)).catch(() => undefined)
        )
      );
    } catch {
      /* Nothing readable there, or no permission any more: move on. */
    }
  }

  await deleteDoc(bandRef(bandId)).catch(() => undefined);
}

/** Promoting to editor, or taking the promotion back. */
export async function setMemberRole(
  bandId: string,
  memberUid: string,
  role: Exclude<BandRole, 'owner'>
): Promise<void> {
  const state = useStore.getState();
  const band = state.catalogs.find((catalog) => catalog.id === bandId);
  const account = useAuth.getState().account;
  if (!band || !account || band.ownerUid !== account.uid) return;
  if (memberUid === band.ownerUid) return;

  const editorUids = new Set(band.editorUids ?? []);
  if (role === 'editor') editorUids.add(memberUid);
  else editorUids.delete(memberUid);

  const members = band.members.map((member) =>
    member.uid === memberUid ? { ...member, role } : member
  );

  state.updateCatalog(bandId, { members, editorUids: [...editorUids] });
  await pushBand({ ...band, members, editorUids: [...editorUids], updatedAt: Date.now() });
}

/**
 * Taking someone out of the band. Their copy of the repertoire stays on their
 * phone — there's no way to reach into it, and pretending otherwise would be
 * worse than saying so.
 */
export async function removeMemberRemote(bandId: string, memberUid: string): Promise<void> {
  const state = useStore.getState();
  const band = state.catalogs.find((catalog) => catalog.id === bandId);
  const account = useAuth.getState().account;
  if (!band || !account || band.ownerUid !== account.uid) return;
  if (memberUid === band.ownerUid) return;

  const members = band.members.filter((member) => member.uid !== memberUid);
  const memberUids = (band.memberUids ?? []).filter((entry) => entry !== memberUid);
  const editorUids = (band.editorUids ?? []).filter((entry) => entry !== memberUid);

  state.updateCatalog(bandId, { members, memberUids, editorUids });
  await pushBand({ ...band, members, memberUids, editorUids, updatedAt: Date.now() });
}

/** Leaving a band someone else owns. The owner deletes instead. */
export async function leaveBand(bandId: string): Promise<void> {
  const account = useAuth.getState().account;
  const state = useStore.getState();
  const band = state.catalogs.find((catalog) => catalog.id === bandId);
  if (!account || !band || band.ownerUid === account.uid) return;

  const snapshot = await getDoc(bandRef(bandId));
  if (snapshot.exists()) {
    const remote = fromDocument(snapshot.data() as Record<string, unknown>);
    if (remote) {
      await updateDoc(bandRef(bandId), {
        members: remote.members.filter((member) => member.uid !== account.uid).map(cleanMember),
        memberUids: (remote.memberUids ?? []).filter((entry) => entry !== account.uid),
        editorUids: (remote.editorUids ?? []).filter((entry) => entry !== account.uid),
        updatedAt: Date.now(),
      });
    }
  }
  // The local copy goes too: staying would leave a repertoire that looks
  // shared, updates from nobody, and can't be written to.
  state.deleteCatalog(bandId);
}

/* ---------------------------------------------------------------- Lettura */

async function fetchSharedBands(accountUid: string): Promise<Catalog[]> {
  const snapshot = await getDocs(
    query(bandsRef(), where('memberUids', 'array-contains', accountUid))
  );
  const bands: Catalog[] = [];
  snapshot.forEach((entry) => {
    const band = fromDocument(entry.data() as Record<string, unknown>);
    if (band) bands.push(band);
  });
  return bands;
}

/** Bands still sitting in the old private branch, from before sharing existed. */
async function fetchLegacyBands(accountUid: string): Promise<Catalog[]> {
  try {
    const snapshot = await getDocs(legacyBandsRef(accountUid));
    const bands: Catalog[] = [];
    snapshot.forEach((entry) => {
      const band = fromDocument(entry.data() as Record<string, unknown>);
      if (band) bands.push(band);
    });
    return bands;
  } catch {
    return [];
  }
}

/**
 * Brings the account's bands and this device's together, and claims for the
 * account every band that until now belonged to nobody. Returns how many
 * arrived from the account, so the screen can say something true about it.
 */
export async function syncBands(): Promise<{ pulled: number; pushed: number }> {
  const account = useAuth.getState().account;
  if (!account) return { pulled: 0, pushed: 0 };

  const [shared, legacy] = await Promise.all([
    fetchSharedBands(account.uid),
    fetchLegacyBands(account.uid),
  ]);

  const state = useStore.getState();
  const local = state.catalogs.filter((catalog) => catalog.kind === 'band');
  const merged = new Map(local.map((band) => [band.id, band]));
  const sharedIds = new Set(shared.map((band) => band.id));

  let pulled = 0;

  // The old branch first, so anything only there survives; it's then treated
  // like any other unclaimed local band and goes up shared.
  for (const band of legacy) {
    if (sharedIds.has(band.id) || merged.has(band.id)) continue;
    merged.set(band.id, { ...band, ownerUid: undefined, memberUids: [], editorUids: [] });
    pulled += 1;
  }

  for (const band of shared) {
    const here = merged.get(band.id);
    if (!here) {
      merged.set(band.id, band);
      pulled += 1;
      continue;
    }

    // Who's in the band is decided by the server, always. Only the owner can
    // have local edits worth keeping, and only if they're the newer ones.
    const mine = here.updatedAt ?? here.createdAt;
    const theirs = band.updatedAt ?? band.createdAt;
    if (band.ownerUid === account.uid && mine > theirs) {
      merged.set(band.id, {
        ...here,
        ownerUid: band.ownerUid,
        memberUids: band.memberUids,
        editorUids: band.editorUids,
      });
    } else {
      merged.set(band.id, band);
    }
  }

  // Everything this device made on its own now belongs to the account.
  const toPush: Catalog[] = [];
  for (const band of [...merged.values()]) {
    if (!band.ownerUid) {
      const claimed = claimBand(band, account);
      merged.set(band.id, claimed);
      toPush.push(claimed);
    } else if (band.ownerUid === account.uid && !sharedIds.has(band.id)) {
      toPush.push(band);
    } else if (band.ownerUid === account.uid) {
      const remote = shared.find((entry) => entry.id === band.id);
      const theirs = remote ? (remote.updatedAt ?? remote.createdAt) : 0;
      if ((band.updatedAt ?? band.createdAt) > theirs) toPush.push(band);
    }
  }

  useStore.setState((current) => ({
    catalogs: [
      ...current.catalogs.filter((catalog) => catalog.kind !== 'band'),
      ...merged.values(),
    ],
  }));

  await Promise.all(toPush.map((band) => pushBand(band).catch(() => undefined)));

  return { pulled, pushed: toPush.length };
}

/**
 * Stays listening while the app is open, so being promoted to editor — or
 * dropped from the line-up — shows up without anyone reopening the app.
 */
export function subscribeBands(onChange?: () => void): () => void {
  const account = useAuth.getState().account;
  if (!account) return () => undefined;

  return onSnapshot(
    query(bandsRef(), where('memberUids', 'array-contains', account.uid)),
    (snapshot) => {
      const remote: Catalog[] = [];
      snapshot.forEach((entry) => {
        const band = fromDocument(entry.data() as Record<string, unknown>);
        if (band) remote.push(band);
      });
      if (remote.length === 0 && snapshot.metadata.fromCache) return;

      useStore.setState((current) => {
        const byId = new Map(remote.map((band) => [band.id, band]));
        let changed = false;

        const catalogs = current.catalogs.map((catalog) => {
          const band = byId.get(catalog.id);
          if (!band || catalog.kind !== 'band') return catalog;
          byId.delete(catalog.id);

          // The owner's own device keeps whatever it has that's newer; the
          // line-up itself always comes down from the server.
          if (band.ownerUid === account.uid) {
            const mine = catalog.updatedAt ?? catalog.createdAt;
            const theirs = band.updatedAt ?? band.createdAt;
            if (mine >= theirs) {
              if (
                sameList(catalog.memberUids, band.memberUids) &&
                sameList(catalog.editorUids, band.editorUids)
              ) {
                return catalog;
              }
              changed = true;
              return { ...catalog, memberUids: band.memberUids, editorUids: band.editorUids };
            }
          }
          changed = true;
          return band;
        });

        // Bands the account joined elsewhere.
        for (const band of byId.values()) {
          catalogs.push(band);
          changed = true;
        }

        return changed ? { catalogs } : {};
      });

      onChange?.();
    },
    () => undefined
  );
}

function sameList(a: string[] | undefined, b: string[] | undefined): boolean {
  const left = a ?? [];
  const right = b ?? [];
  return left.length === right.length && left.every((entry) => right.includes(entry));
}
