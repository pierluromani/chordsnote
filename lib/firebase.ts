import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

/**
 * The project this app talks to.
 *
 * These values are not secrets: a Firebase web config identifies the project,
 * it doesn't grant access to it. What keeps other people's songs out of reach
 * is Auth plus the Firestore rules in `firestore.rules`, not hiding this.
 */
const config = {
  apiKey: 'AIzaSyDNbM0KK-sky86zHWai-Az9VLRnRi5k52o',
  // The Hosting domain the app is served from, not Firebase's default
  // *.firebaseapp.com, so sign-in stays same-origin: browsers partition
  // storage across sites, and a redirect returning to a different origin
  // than it left from loses the session on the way back. The project's
  // OAuth client lists https://chordsnote.web.app/__/auth/handler as an
  // authorized redirect URI to match; changing this domain means changing
  // that list too, or Google answers with redirect_uri_mismatch.
  authDomain: 'chordsnote.web.app',
  projectId: 'chordsnote',
  storageBucket: 'chordsnote.firebasestorage.app',
  messagingSenderId: '696926494489',
  appId: '1:696926494489:web:74d19ffc20f1fc562caf88',
};

const app = getApps().length > 0 ? getApp() : initializeApp(config);

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

/**
 * Firestore refuses `undefined` anywhere, including deep inside a section, so
 * optional fields have to be dropped rather than sent empty.
 */
export function prune<T>(value: T): T {
  if (Array.isArray(value)) return value.map(prune) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry !== undefined) out[key] = prune(entry);
    }
    return out as T;
  }
  return value;
}
