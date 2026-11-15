import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyDNbM0KK-sky86zHWai-Az9VLRnRi5k52o',
  authDomain: 'chordsnote.firebaseapp.com',
  projectId: 'chordsnote',
  storageBucket: 'chordsnote.firebasestorage.app',
  messagingSenderId: '696926494489',
  appId: '1:696926494489:web:74d19ffc20f1fc562caf88',
});
const auth = getAuth(app);
const db = getFirestore(app);

const stamp = Date.now();
const A = { email: `aa${stamp}@chordsnote.test`, pass: 'prova123' };
const B = { email: `ab${stamp}@chordsnote.test`, pass: 'prova123' };
const C = { email: `ac${stamp}@chordsnote.test`, pass: 'prova123' };

const pass = (m) => console.log('  ✔', m);
const fail = (m) => console.log('  ✘ BUCO:', m);

async function as(who) {
  await signOut(auth).catch(() => {});
  try {
    await signInWithEmailAndPassword(auth, who.email, who.pass);
  } catch {
    await createUserWithEmailAndPassword(auth, who.email, who.pass);
  }
  return auth.currentUser.uid;
}

/** Expects the write to be refused. */
async function refused(what, action) {
  try {
    await action();
    fail(what);
  } catch (e) {
    if (e.code === 'permission-denied') pass(`${what} → rifiutato`);
    else fail(`${what} → errore inatteso ${e.code ?? e.message}`);
  }
}

async function allowed(what, action) {
  try {
    await action();
    pass(what);
  } catch (e) {
    fail(`${what} → rifiutato invece che permesso (${e.code ?? e.message})`);
  }
}

const bandId = `band${stamp}`;
const bandRef = doc(db, 'bands', bandId);

const uidA = await as(A);
await setDoc(bandRef, {
  id: bandId,
  name: 'Attacchi',
  kind: 'band',
  color: 0,
  members: [{ id: 'm1', name: 'A', color: 0, uid: uidA, email: A.email, role: 'owner' }],
  ownerUid: uidA,
  memberUids: [uidA],
  editorUids: [uidA],
  createdAt: stamp,
  updatedAt: stamp,
});

// B è invitato in sola lettura, C non è invitato per niente.
await setDoc(doc(db, 'invites', `${bandId}__${B.email}`), {
  bandId,
  bandName: 'Attacchi',
  bandColor: 0,
  email: B.email,
  role: 'viewer',
  ownerUid: uidA,
  invitedByName: 'A',
  createdAt: stamp,
});

console.log('\n— Chi non è invitato —');
const uidC = await as(C);
await refused('C entra nella band senza invito', () =>
  updateDoc(bandRef, { memberUids: [uidA, uidC], members: [], editorUids: [uidA] })
);
await refused('C scrive nel repertorio', () =>
  setDoc(doc(db, 'bands', bandId, 'songs', 'x'), { id: 'x', title: 'x' })
);
await refused('C cancella la band', () => deleteDoc(bandRef));
await refused('C si crea un invito da solo', () =>
  setDoc(doc(db, 'invites', `${bandId}__${C.email}`), {
    bandId,
    bandName: 'Attacchi',
    bandColor: 0,
    email: C.email,
    role: 'editor',
    ownerUid: uidC,
    invitedByName: 'C',
    createdAt: stamp,
  })
);

console.log('\n— Chi è invitato in sola lettura —');
const uidB = await as(B);
const before = (await getDoc(bandRef)).data();

await refused('B entra promuovendosi a editor', () =>
  updateDoc(bandRef, {
    members: [...before.members, { id: 'm2', name: 'B', color: 1, uid: uidB, role: 'editor' }],
    memberUids: [...before.memberUids, uidB],
    editorUids: [...before.editorUids, uidB],
  })
);
await refused('B entra prendendosi la band', () =>
  updateDoc(bandRef, {
    ownerUid: uidB,
    members: [...before.members, { id: 'm2', name: 'B', color: 1, uid: uidB, role: 'viewer' }],
    memberUids: [...before.memberUids, uidB],
    editorUids: before.editorUids,
  })
);
await refused('B entra portandosi dietro C', () =>
  updateDoc(bandRef, {
    members: [...before.members, { id: 'm2', name: 'B', color: 1, uid: uidB, role: 'viewer' }],
    memberUids: [...before.memberUids, uidB, uidC],
    editorUids: before.editorUids,
  })
);
await refused('B butta fuori il fondatore', () =>
  updateDoc(bandRef, { memberUids: [uidB], editorUids: [], members: [] })
);
await allowed('B entra come era stato invitato', () =>
  updateDoc(bandRef, {
    members: [...before.members, { id: 'm2', name: 'B', color: 1, uid: uidB, role: 'viewer' }],
    memberUids: [...before.memberUids, uidB],
    editorUids: before.editorUids,
    updatedAt: Date.now(),
  })
);

console.log('\n— Chi è dentro in sola lettura —');
await refused('B (viewer) scrive un brano', () =>
  setDoc(doc(db, 'bands', bandId, 'songs', 'y'), { id: 'y', title: 'y' })
);
await refused('B (viewer) scrive una scaletta', () =>
  setDoc(doc(db, 'bands', bandId, 'setlists', 'y'), { id: 'y', name: 'y' })
);
await refused('B (viewer) si promuove a editor', () =>
  updateDoc(bandRef, { editorUids: [uidA, uidB] })
);
await refused('B (viewer) rinomina la band', () => updateDoc(bandRef, { name: 'Mia adesso' }));
await refused('B (viewer) cancella la band', () => deleteDoc(bandRef));
await allowed('B legge il repertorio', async () => {
  await getDoc(doc(db, 'bands', bandId, 'songs', 'nonesiste'));
});
await allowed('B esce dalla band', () =>
  updateDoc(bandRef, {
    members: before.members,
    memberUids: before.memberUids,
    editorUids: before.editorUids,
    updatedAt: Date.now(),
  })
);

console.log('\n— L’invito consumato non si riusa —');
await as(A);
await deleteDoc(doc(db, 'invites', `${bandId}__${B.email}`)).catch(() => {});
await as(B);
await refused('B rientra dopo che l’invito è sparito', () =>
  updateDoc(bandRef, {
    members: [...before.members, { id: 'm3', name: 'B', color: 1, uid: uidB, role: 'viewer' }],
    memberUids: [...before.memberUids, uidB],
    editorUids: before.editorUids,
  })
);

process.exit(0);
