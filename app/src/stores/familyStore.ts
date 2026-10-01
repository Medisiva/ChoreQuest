// S1-10: familyStore (Zustand)
// On auth, opens ONE onSnapshot listener on families/{familyId}.
// Loads all childProfiles via single getDocs() call.
// Exposes: family, children[], parentProfile.
// Backend profile-change triggers refresh the family document after profile edits/awards.

import { create } from 'zustand';
import {
  doc,
  onSnapshot,
  collection,
  getDocs,
  getDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import type { FamilyAccount, ChildProfile, ParentUser } from '../types';

interface FamilyState {
  family: FamilyAccount | null;
  children: ChildProfile[];
  parentProfile: ParentUser | null;
  loading: boolean;
  error: string | null;

  // Actions
  subscribeToFamily: (
    familyId: string,
    parentUid: string
  ) => Unsubscribe;
  clearFamily: () => void;
}

export const useFamilyStore = create<FamilyState>((set) => ({
  family: null,
  children: [],
  parentProfile: null,
  loading: true,
  error: null,

  subscribeToFamily: (familyId, parentUid) => {
    set({ loading: true });

    // Single onSnapshot listener on the family document
    const familyRef = doc(db, 'families', familyId);
    let generation = 0;
    let stopped = false;

    const unsubscribe = onSnapshot(
      familyRef,
      async (snapshot) => {
        if (!snapshot.exists()) {
          set({
            family: null,
            children: [],
            parentProfile: null,
            loading: false,
            error: 'Family not found.',
          });
          return;
        }

        const familyData = {
          id: snapshot.id,
          ...snapshot.data(),
        } as FamilyAccount;

        const currentGeneration = ++generation;
        try {
          const [parentSnap, childrenSnap] = await Promise.all([
            getDoc(doc(db, 'families', familyId, 'parentUsers', parentUid)),
            getDocs(collection(db, 'families', familyId, 'childProfiles')),
          ]);
          if (stopped || currentGeneration !== generation) return;
          const parentProfile = parentSnap.exists() ? { id: parentSnap.id, ...parentSnap.data() } as ParentUser : null;
          const children = childrenSnap.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as ChildProfile);

          set({
            family: familyData,
            children,
            parentProfile,
            loading: false,
            error: null,
          });
        } catch (error) {
          if (stopped || currentGeneration !== generation) return;
          console.error('[familyStore] Failed to load family data:', error);
          set({
            family: familyData,
            loading: false,
            error: 'Failed to load family data.',
          });
        }
      },
      (error) => {
        console.error('[familyStore] Snapshot error:', error);
        set({ loading: false, error: 'Lost connection to family data.' });
      }
    );

    return () => { stopped = true; generation++; unsubscribe(); };
  },

  clearFamily: () =>
    set({
      family: null,
      children: [],
      parentProfile: null,
      loading: true,
      error: null,
    }),
}));
