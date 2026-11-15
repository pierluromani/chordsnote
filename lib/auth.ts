import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { auth } from './firebase';

type Account = {
  uid: string;
  email: string | null;
  name: string | null;
};

type AuthState = {
  account: Account | null;
  /** False until Firebase has told us whether a session was restored. */
  ready: boolean;
  setAccount: (account: Account | null) => void;
};

export const useAuth = create<AuthState>()((set) => ({
  account: null,
  ready: false,
  setAccount: (account) => set({ account, ready: true }),
}));

const toAccount = (user: User | null): Account | null =>
  user ? { uid: user.uid, email: user.email, name: user.displayName } : null;

onAuthStateChanged(
  auth,
  (user) => useAuth.getState().setAccount(toAccount(user)),
  () => useAuth.getState().setAccount(null)
);

/**
 * Firebase speaks in error codes; this is what the screen actually says. An
 * unrecognised code falls through to its own text rather than a shrug, so a
 * problem we didn't anticipate still tells the user something.
 */
export function authMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'Questo indirizzo email non è valido.';
    case 'auth/missing-password':
      return 'Manca la password.';
    case 'auth/weak-password':
      return 'La password deve avere almeno 6 caratteri.';
    case 'auth/email-already-in-use':
      return 'Esiste già un account con questa email. Prova ad accedere.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email o password non corretti.';
    case 'auth/too-many-requests':
      return 'Troppi tentativi. Riprova fra qualche minuto.';
    case 'auth/network-request-failed':
      return 'Nessuna connessione. Riprova quando sei online.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Accesso annullato.';
    case 'auth/operation-not-allowed':
      return 'Questo modo di accedere non è ancora attivo sul progetto.';
    case 'auth/unauthorized-domain':
      return 'Questo indirizzo non è fra i domini autorizzati del progetto.';
    default:
      return (error as { message?: string })?.message ?? 'Qualcosa è andato storto.';
  }
}

export async function signUp(email: string, password: string, name: string) {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const clean = name.trim();
  if (clean) {
    await updateProfile(credential.user, { displayName: clean });
    useAuth.getState().setAccount({
      uid: credential.user.uid,
      email: credential.user.email,
      name: clean,
    });
  }
}

export async function signIn(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

/**
 * Google, through the browser. Always the redirect flow, never a popup: it
 * behaves the same in a tab and in an installed PWA, where window.open is
 * blocked, and it sidesteps the cross-origin-opener policy that stops the
 * opener from seeing whether a popup is still there — which Firebase reads
 * as the user having closed it.
 */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  if (Platform.OS !== 'web') {
    throw new Error('Su questa piattaforma usa email e password.');
  }

  await signInWithRedirect(auth, provider);
}

/**
 * Called once when the account screen mounts, in case it's the landing page
 * after a Google redirect. onAuthStateChanged picks up a successful sign-in
 * on its own; this exists so a failure has somewhere to surface instead of
 * vanishing along with the redirect.
 */
export async function checkGoogleRedirectResult(): Promise<void> {
  await getRedirectResult(auth);
}

export async function signOutAccount() {
  await signOut(auth);
}

export async function updateAccountName(name: string) {
  const user = auth.currentUser;
  if (!user) return;
  const clean = name.trim();
  await updateProfile(user, { displayName: clean || null });
  useAuth.getState().setAccount({ uid: user.uid, email: user.email, name: clean || null });
}
