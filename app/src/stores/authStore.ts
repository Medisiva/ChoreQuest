// S1-06: authStore (Zustand)
// Holds: user, parentProfile, loading, error
// Subscribes to onAuthStateChanged ONCE globally in _layout.tsx
// Unsubscribe on unmount. Initializes with loading:true until auth state known.

import { create } from 'zustand';
import { User, onAuthStateChanged, Unsubscribe } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import type { ParentUser } from '../types';

interface AuthState {
  user: User | null;
  parentProfile: ParentUser | null;
  loading: boolean;
  error: string | null;

  // Actions
  initialize: () => Unsubscribe;
  setError: (error: string | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  parentProfile: null,
  loading: true,
  error: null,

  initialize: () => {
    let unsubscribeProfile: Unsubscribe | undefined;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribeProfile?.();
      unsubscribeProfile = undefined;
      set({ user, parentProfile: null, loading: Boolean(user), error: null });
      if (!user) return;
      unsubscribeProfile = onSnapshot(doc(db, 'parentProfiles', user.uid), (snapshot) => {
        set({
          parentProfile: snapshot.exists()
            ? { ...snapshot.data(), id: user.uid, firebaseUid: user.uid } as ParentUser
            : null,
          loading: false,
          error: null,
        });
      }, () => set({ loading: false, error: 'Failed to load profile. Please try again.' }));
    });

    return () => { unsubscribe(); unsubscribeProfile?.(); };
  },

  setError: (error) => set({ error }),

  clearAuth: () =>
    set({
      user: null,
      parentProfile: null,
      loading: false,
      error: null,
    }),
}));
