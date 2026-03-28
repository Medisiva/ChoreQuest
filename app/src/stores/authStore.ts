// S1-06: authStore (Zustand)
// Holds: user, parentProfile, loading, error
// Subscribes to onAuthStateChanged ONCE globally in _layout.tsx
// Unsubscribe on unmount. Initializes with loading:true until auth state known.

import { create } from 'zustand';
import { User, onAuthStateChanged, Unsubscribe } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  parentProfile: null,
  loading: true,
  error: null,

  initialize: () => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Fetch parent profile from Firestore
          // We need to find which family this parent belongs to
          // The parentUser doc is stored at families/{familyId}/parentUsers/{uid}
          // For now, we store a top-level mapping doc at parentProfiles/{uid}
          const profileRef = doc(db, 'parentProfiles', user.uid);
          const profileSnap = await getDoc(profileRef);

          if (profileSnap.exists()) {
            const parentProfile = {
              id: profileSnap.id,
              ...profileSnap.data(),
            } as ParentUser;
            set({ user, parentProfile, loading: false, error: null });
          } else {
            // New user - no profile yet (will be created during onboarding)
            set({ user, parentProfile: null, loading: false, error: null });
          }
        } catch (error) {
          console.error('[authStore] Failed to fetch parent profile:', error);
          set({
            user,
            parentProfile: null,
            loading: false,
            error: 'Failed to load profile.',
          });
        }
      } else {
        set({
          user: null,
          parentProfile: null,
          loading: false,
          error: null,
        });
      }
    });

    return unsubscribe;
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
