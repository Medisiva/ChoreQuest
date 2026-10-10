import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FirebaseAuth from 'firebase/auth';
import type { FirebaseApp } from 'firebase/app';
import type { Persistence } from 'firebase/auth';

export function initializePlatformAuth(app: FirebaseApp) {
  // Firebase's native entry point exposes this helper, while its shared web
  // declaration omits it. Metro selects this file only for Android and iOS.
  const nativeAuth = FirebaseAuth as typeof FirebaseAuth & {
    getReactNativePersistence(storage: typeof AsyncStorage): Persistence;
  };
  try {
    return nativeAuth.initializeAuth(app, {
      persistence: nativeAuth.getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'auth/already-initialized') return nativeAuth.getAuth(app);
    throw error;
  }
}
