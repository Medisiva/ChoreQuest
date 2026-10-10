import { getAuth } from 'firebase/auth';
import type { FirebaseApp } from 'firebase/app';
export function initializePlatformAuth(app: FirebaseApp) {
  return getAuth(app);
}
