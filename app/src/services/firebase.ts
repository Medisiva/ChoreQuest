// S1-04: Firebase initialization with emulator detection
// In dev mode, connects to Auth/Firestore/Storage emulators.
// In prod, connects to real Firebase.
// Emulator connections MUST happen BEFORE any auth/firestore calls.

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { Platform } from 'react-native';
import {
  getFirestore,
  connectFirestoreEmulator,
  enableMultiTabIndexedDbPersistence,
} from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase app (singleton)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

// Connect to emulators in development
const isDev = __DEV__;
const useEmulators = __DEV__ && process.env.EXPO_PUBLIC_USE_EMULATORS === 'true';
const emulatorHost = process.env.EXPO_PUBLIC_EMULATOR_HOST || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');

let emulatorsConnected = false;

function connectEmulators(): void {
  if (emulatorsConnected) return;

  if (useEmulators) {
    try {
      connectAuthEmulator(auth, `http://${emulatorHost}:9099`, {
        disableWarnings: true,
      });
      connectFirestoreEmulator(db, emulatorHost, 8080);
      connectStorageEmulator(storage, emulatorHost, 9199);
      connectFunctionsEmulator(functions, emulatorHost, 5001);
      console.log('[Firebase] Connected to emulators');
    } catch (error) {
      console.warn('[Firebase] Emulator connection failed:', error);
    }
  }

  emulatorsConnected = true;
}

// Enable Firestore offline persistence (reduces reads by serving cached data)
async function enableOfflinePersistence(): Promise<void> {
  if (Platform.OS !== 'web') return;
  try {
    await enableMultiTabIndexedDbPersistence(db);
    console.log('[Firebase] Offline persistence enabled');
  } catch (error) {
    // This is expected to fail in some environments (e.g., web workers)
    console.warn('[Firebase] Offline persistence not available:', error);
  }
}

connectEmulators();

// Initialize everything - call this ONCE from _layout.tsx
export async function initializeFirebase(): Promise<void> {
  connectEmulators();
  await enableOfflinePersistence();
}

export { app, auth, db, storage, functions, isDev, useEmulators, emulatorHost };
