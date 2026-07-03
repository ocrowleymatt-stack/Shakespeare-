/**
 * Firebase STUB — preview/offline mode
 * All Firebase calls are replaced with no-ops; data persists in localStorage via App.tsx.
 */

// Fake auth user
const DEMO_USER: any = {
  uid: 'demo-user',
  displayName: 'Demo Author',
  email: 'demo@novelwrite.local',
  photoURL: null,
};

export const auth: any = { currentUser: DEMO_USER };
export const db: any = {};
export const googleProvider: any = {};

export function onAuthStateChanged(_auth: any, callback: (user: any) => void) {
  setTimeout(() => callback(DEMO_USER), 0);
  return () => {};
}

export async function loginWithGoogle() { return DEMO_USER; }
export async function handleRedirectLogin() { return null; }
export async function logout() {}
export async function loginAnonymously() { return DEMO_USER; }

let _token: string | null = null;
export function setCachedAccessToken(t: string | null) { _token = t; }
export function getCachedAccessToken(): string | null { return _token; }
