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
  role: 'parent' | 'child' | null;
  familyId: string | null;
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
  familyId: null,
  role: null,
  user: null,
  parentProfile: null,
  loading: true,
  error: null,

  initialize: () => {
    let unsubscribeProfile: Unsubscribe | undefined;
    let generation = 0;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const current = ++generation;
      unsubscribeProfile?.();
      unsubscribeProfile = undefined;
      set({ user, familyId: null, role: null, parentProfile: null, loading: Boolean(user), error: null });
      if (!user) return;
      try {
        const { claims } = await user.getIdTokenResult();
        if (current !== generation) return;
        if (claims.role === 'child' && typeof claims.familyId === 'string') {
          set({ role: 'child', familyId: claims.familyId, parentProfile: null, loading: false });
          return;
        }
        set({ role: 'parent' });
      } catch { if (current === generation) set({ loading: false, error: 'Please sign in again.' }); return; }
      unsubscribeProfile = onSnapshot(doc(db, 'parentProfiles', user.uid), (snapshot) => {
        if (current !== generation) return;
        set({
          familyId: snapshot.exists() ? snapshot.data().familyAccountId : null,
          parentProfile: snapshot.exists()
            ? { ...snapshot.data(), id: user.uid, firebaseUid: user.uid } as ParentUser
            : null,
          loading: false,
          error: null,
        });
      }, () => set({ loading: false, error: 'Failed to load profile. Please try again.' }));
    });

    return () => { generation++; unsubscribe(); unsubscribeProfile?.(); };
  },

  setError: (error) => set({ error }),

  clearAuth: () =>
    set({
      user: null,
      familyId: null,
      role: null,
      parentProfile: null,
      loading: false,
      error: null,
    }),
}));
