// S1-05: Auth service - signIn, signUp, signOut, Google OAuth, Apple OAuth
// All auth methods return user or throw typed error with human-readable messages.

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  UserCredential,
  AuthError,
} from 'firebase/auth';
import { auth } from './firebase';

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

export async function signIn(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
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
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    return { success: true, credential };
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
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
    const userCredential = await signInWithCredential(auth, credential);
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
    const userCredential = await signInWithCredential(auth, credential);
    return { success: true, credential: userCredential };
  } catch (error) {
    return handleAuthError(error);
  }
}
