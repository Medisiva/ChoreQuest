import { auth, app, useEmulators, emulatorHost } from './firebase';

/** Calls an authenticated HTTP function using the configured Firebase project. */
export async function callBackend<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!auth.currentUser) throw new Error('Please sign in again.');
  const projectId = app.options.projectId;
  if (!projectId) throw new Error('Firebase project is not configured.');
  const token = await auth.currentUser.getIdToken();
  const base = useEmulators
    ? `http://${emulatorHost}:5001/${projectId}/us-central1`
    : `https://us-central1-${projectId}.cloudfunctions.net`;
  const response = await fetch(`${base}/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  // PIN failures carry structured attempts/lockout information.
  if (!response.ok && typeof result.success !== 'boolean') {
    throw new Error(typeof result.error === 'string' ? result.error : 'The request failed. Try again.');
  }
  return result as T;
}

export type PinVerification =
  | { success: true; customToken: string; sessionToken: { token: string; expiresAt: string } }
  | { success: false; locked?: boolean; lockedUntil?: string; attemptsRemaining?: number };
