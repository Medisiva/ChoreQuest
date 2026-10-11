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
  childProfileId: string | null;
  childNickname: string | null;
  childAvatarId: string | null;
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
  childProfileId: null, childNickname: null, childAvatarId: null,
  role: null,
  user: null,
  parentProfile: null,
  loading: true,
  error: null,

  initialize: () => {
    let unsubscribeProfile: Unsubscribe | undefined;
    let generation = 0;
    let profileTimeout: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const current = ++generation;
      clearTimeout(profileTimeout);
      unsubscribeProfile?.();
      unsubscribeProfile = undefined;
      set({ user, familyId: null, childProfileId: null, childNickname: null, childAvatarId: null, role: null, parentProfile: null, loading: Boolean(user), error: null });
      if (!user) return;
      try {
        const { claims } = await user.getIdTokenResult();
        if (current !== generation) return;
        if (claims.role === 'child' && typeof claims.familyId === 'string') {
          set({ role: 'child', familyId: claims.familyId, childProfileId: typeof claims.childProfileId === 'string' ? claims.childProfileId : null, childNickname: typeof claims.childNickname === 'string' ? claims.childNickname : null, childAvatarId: typeof claims.childAvatarId === 'string' ? claims.childAvatarId : null, parentProfile: null, loading: false });
          return;
        }
        set({ role: 'parent' });
      } catch { if (current === generation) set({ loading: false, error: 'Please sign in again.' }); return; }
      profileTimeout = setTimeout(() => {
        if (current === generation) set({ loading: false, error: 'Could not confirm your family. Check your connection and retry.' });
      }, 10000);
      unsubscribeProfile = onSnapshot(doc(db, 'parentProfiles', user.uid), { includeMetadataChanges: true }, (snapshot) => {
        if (current !== generation) return;
        // An empty local cache is not proof that a returning user needs setup.
        if (!snapshot.exists() && snapshot.metadata.fromCache) return;
        clearTimeout(profileTimeout);
        set({
          familyId: snapshot.exists() && !snapshot.data().familyDeleted ? snapshot.data().familyAccountId : null,
          parentProfile: snapshot.exists()
            ? { ...snapshot.data(), id: user.uid, firebaseUid: user.uid } as ParentUser
            : null,
          loading: false,
          error: null,
        });
      }, () => {
        if (current !== generation) return;
        clearTimeout(profileTimeout);
        set({ loading: false, error: 'Failed to load profile. Please try again.' });
      });
    });

    return () => { generation++; clearTimeout(profileTimeout); unsubscribe(); unsubscribeProfile?.(); };
  },

  setError: (error) => set({ error }),

  clearAuth: () =>
    set({
      user: null,
      childProfileId: null, childNickname: null, childAvatarId: null,
      familyId: null,
      role: null,
      parentProfile: null,
      loading: false,
      error: null,
    }),
}));
