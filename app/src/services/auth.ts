// S1-05: Auth service - signIn, signUp, signOut, Google OAuth, Apple OAuth
// All auth methods return user or throw typed error with human-readable messages.

import {
  signInWithEmailAndPassword,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  UserCredential,
  AuthError,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { auth, db, restartFirestoreForIdentityChange } from './firebase';
import { getDocFromServer, doc } from 'firebase/firestore';
import { stopFamilySubscriptions } from './familySubscriptions';
import { useChildSessionStore } from '../stores/childSessionStore';

// Human-readable error messages for Firebase Auth error codes
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled. Contact support.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/weak-password': 'Password must be at least 8 characters.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/network-request-failed': 'Network error. Check your connection.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled.',
};

export interface AuthResult {
  success: true;
  credential: UserCredential;
}

export interface AuthFailure {
  success: false;
  message: string;
  code: string;
}

type AuthResponse = AuthResult | AuthFailure;

function handleAuthError(error: unknown): AuthFailure {
  const authError = error as AuthError;
  const code = authError.code || 'auth/unknown';
  const message =
    AUTH_ERROR_MESSAGES[code] || 'Something went wrong. Please try again.';

  return { success: false, message, code };
}

async function replaceIdentity<T>(action: () => Promise<T>): Promise<T> {
  const session = useChildSessionStore.getState();
  session.setSwitching(true);
  stopFamilySubscriptions();
  try {
    await restartFirestoreForIdentityChange();
    return await action();
  } finally { session.setSwitching(false); }
}

export async function signIn(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const credential = await replaceIdentity(() => signInWithEmailAndPassword(auth, email, password));
    useChildSessionStore.getState().unlockParent();
    return { success: true, credential };
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function signUp(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const credential = await replaceIdentity(() => createUserWithEmailAndPassword(auth, email, password));
    useChildSessionStore.getState().unlockParent();
    return { success: true, credential };
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function signOut(): Promise<void> {
  await replaceIdentity(() => firebaseSignOut(auth));
  useChildSessionStore.getState().endSession();
  useChildSessionStore.getState().lockParent();
}

export async function resetPassword(
  email: string
): Promise<{ success: boolean; message: string }> {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true, message: 'Check your inbox for a reset link.' };
  } catch (error) {
    const failure = handleAuthError(error);
    return { success: false, message: failure.message };
  }
}

export async function signInWithGoogle(
  idToken: string
): Promise<AuthResponse> {
  try {
    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await replaceIdentity(() => signInWithCredential(auth, credential));
    useChildSessionStore.getState().unlockParent();
    return { success: true, credential: userCredential };
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function signInWithApple(
  identityToken: string,
  nonce: string
): Promise<AuthResponse> {
  try {
    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({
      idToken: identityToken,
      rawNonce: nonce,
    });
    const userCredential = await replaceIdentity(() => signInWithCredential(auth, credential));
    useChildSessionStore.getState().unlockParent();
    return { success: true, credential: userCredential };
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function unlockParentMode(password: string, emailOverride?: string): Promise<void> {
  const user = auth.currentUser;
  const email = emailOverride?.trim() || user?.email || useChildSessionStore.getState().parentEmail;
  if (!email) throw new Error('Sign in with your parent account again.');
  try {
    if (user?.email === email) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    else {
      const session = useChildSessionStore.getState(); session.setSwitching(true); stopFamilySubscriptions();
      try { await restartFirestoreForIdentityChange(); await signInWithEmailAndPassword(auth, email, password); }
      finally { session.setSwitching(false); }
    }
    useChildSessionStore.getState().unlockParent();
  } catch (error) { throw new Error(handleAuthError(error).message); }
}

export async function enterChildMode(childId: string, sessionToken: string, customToken: string): Promise<void> {
  const session = useChildSessionStore.getState();
  if (!auth.currentUser) throw new Error('Sign in to your family first.');
  if (auth.currentUser.email) session.rememberParent(auth.currentUser.email);
  session.setSwitching(true);
  session.lockParent();
  stopFamilySubscriptions();
  let identityReplaced = false;
  try {
    await restartFirestoreForIdentityChange();
    identityReplaced = true;
    // Replace the principal; no parent credential is retained in another Auth instance.
    await firebaseSignOut(auth);
    const credential = await signInWithCustomToken(auth, customToken);
    await credential.user.getIdToken(true);
    const { claims } = await credential.user.getIdTokenResult();
    if (claims.role !== 'child' || typeof claims.familyId !== 'string') throw new Error('Could not confirm child access. Please try the PIN again.');

    // Wait for an actual server-authorized read before opening live listeners.
    // An Auth callback alone does not establish Firestore transport readiness.
    const family = await getDocFromServer(doc(db, 'families', claims.familyId));
    if (!family.exists()) throw new Error('This family is unavailable. Ask a parent to sign in.');
    session.startSession(childId, sessionToken);
  } catch (error) {
    if (identityReplaced) await firebaseSignOut(auth);
    session.endSession();
    throw error;
  } finally { session.setSwitching(false); }
}
