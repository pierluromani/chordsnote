import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

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
const A = { email: `ra${stamp}@chordsnote.test`, pass: 'prova123' };
const B = { email: `rb${stamp}@chordsnote.test`, pass: 'prova123' };

const ok = (m) => console.log('  ✔', m);
const bad = (m, e) => console.log('  ✘', m, '→', e?.code ?? e?.message ?? e);

async function as(who) {
  await signOut(auth).catch(() => {});
  try {
    await signInWithEmailAndPassword(auth, who.email, who.pass);
  } catch {
    await createUserWithEmailAndPassword(auth, who.email, who.pass);
  }
  return auth.currentUser.uid;
}

const bandId = `band${stamp}`;

const uidA = await as(A);
console.log('A =', uidA);

// 1. create band
try {
  await setDoc(doc(db, 'bands', bandId), {
    id: bandId,
    name: 'Regole',
    kind: 'band',
    color: 0,
    members: [{ id: 'm1', name: 'A', color: 0, uid: uidA, email: A.email, role: 'owner' }],
    ownerUid: uidA,
    memberUids: [uidA],
    editorUids: [uidA],
    createdAt: stamp,
    updatedAt: stamp,
  });
  ok('A crea la band');
} catch (e) {
  bad('A crea la band', e);
}

// 2. create invite
const inviteId = `${bandId}__${B.email}`;
try {
  await setDoc(doc(db, 'invites', inviteId), {
    bandId,
    bandName: 'Regole',
    bandColor: 0,
    email: B.email,
    role: 'editor',
    ownerUid: uidA,
    invitedByName: 'A',
    createdAt: stamp,
  });
  ok('A crea l’invito');
} catch (e) {
  bad('A crea l’invito', e);
}

// 3. owner lists the band's invites  <-- the failing step in the app
try {
  const snap = await getDocs(query(collection(db, 'invites'), where('ownerUid', '==', uidA), where('bandId', '==', bandId)));
  ok(`A elenca gli inviti della band: ${snap.size}`);
} catch (e) {
  bad('A elenca gli inviti della band', e);
}

// 4. owner lists own bands
try {
  const snap = await getDocs(
    query(collection(db, 'bands'), where('memberUids', 'array-contains', uidA))
  );
  ok(`A elenca le sue band: ${snap.size}`);
} catch (e) {
  bad('A elenca le sue band', e);
}

// --- B ---
const uidB = await as(B);
console.log('B =', uidB);

try {
  const snap = await getDocs(query(collection(db, 'invites'), where('email', '==', B.email)));
  ok(`B trova i suoi inviti: ${snap.size}`);
} catch (e) {
  bad('B trova i suoi inviti', e);
}

try {
  const snap = await getDoc(doc(db, 'bands', bandId));
  ok(`B legge la band grazie all’invito: ${snap.exists()}`);
} catch (e) {
  bad('B legge la band grazie all’invito', e);
}

try {
  const snap = await getDoc(doc(db, 'bands', bandId));
  const data = snap.data();
  await updateDoc(doc(db, 'bands', bandId), {
    members: [...data.members, { id: 'm2', name: 'B', color: 1, uid: uidB, email: B.email, role: 'editor' }],
    memberUids: [...data.memberUids, uidB],
    editorUids: [...data.editorUids, uidB],
    updatedAt: Date.now(),
  });
  ok('B entra nella band');
} catch (e) {
  bad('B entra nella band', e);
}

try {
  await deleteDoc(doc(db, 'invites', inviteId));
  ok('B strappa l’invito');
} catch (e) {
  bad('B strappa l’invito', e);
}

try {
  await setDoc(doc(db, 'bands', bandId, 'songs', 'song1'), {
    id: 'song1',
    title: 'Prova',
    artist: '',
    key: 'C',
    catalogId: bandId,
    favorite: false,
    sections: [],
    createdAt: stamp,
    updatedAt: stamp,
  });
  ok('B (editor) scrive un brano');
} catch (e) {
  bad('B (editor) scrive un brano', e);
}

// --- A demotes B, B must lose write access ---
await as(A);
try {
  await updateDoc(doc(db, 'bands', bandId), { editorUids: [uidA], updatedAt: Date.now() });
  ok('A declassa B a sola lettura');
} catch (e) {
  bad('A declassa B', e);
}

await as(B);
try {
  await setDoc(doc(db, 'bands', bandId, 'songs', 'song2'), { id: 'song2', title: 'No' });
  console.log('  ✘ B declassato riesce ancora a scrivere — REGOLA BUCATA');
} catch (e) {
  ok(`B declassato non può più scrivere (${e.code})`);
}
try {
  const snap = await getDocs(collection(db, 'bands', bandId, 'songs'));
  ok(`B declassato legge ancora: ${snap.size} brani`);
} catch (e) {
  bad('B declassato legge', e);
}

// --- an outsider must see nothing ---
const C = { email: `rc${stamp}@chordsnote.test`, pass: 'prova123' };
await as(C);
try {
  await getDoc(doc(db, 'bands', bandId));
  console.log('  ✘ un estraneo legge la band — REGOLA BUCATA');
} catch (e) {
  ok(`un estraneo non legge la band (${e.code})`);
}
try {
  await getDocs(collection(db, 'bands', bandId, 'songs'));
  console.log('  ✘ un estraneo legge il repertorio — REGOLA BUCATA');
} catch (e) {
  ok(`un estraneo non legge il repertorio (${e.code})`);
}

// --- il fondatore elimina la band: prima i contenuti, poi il documento ---
await as(A);
try {
  const songs = await getDocs(collection(db, 'bands', bandId, 'songs'));
  for (const d of songs.docs) await deleteDoc(doc(db, 'bands', bandId, 'songs', d.id));
  await deleteDoc(doc(db, 'bands', bandId));
  ok('A elimina la band e il suo repertorio');
} catch (e) {
  bad('A elimina la band', e);
}
try {
  const snap = await getDocs(query(collection(db, 'bands'), where('memberUids', 'array-contains', uidA)));
  const still = snap.docs.some((d) => d.id === bandId);
  if (still) bad('la band eliminata torna nella lista di A', 'ancora presente');
  else ok('la band eliminata non risale più al login di A');
} catch (e) {
  bad('A rilegge le sue band', e);
}
await as(B);
try {
  const snap = await getDocs(query(collection(db, 'bands'), where('memberUids', 'array-contains', uidB)));
  const still = snap.docs.some((d) => d.id === bandId);
  if (still) bad('B vede ancora la band eliminata', 'ancora presente');
  else ok('nemmeno B se la ritrova');
} catch (e) {
  bad('B rilegge le sue band', e);
}

process.exit(0);
