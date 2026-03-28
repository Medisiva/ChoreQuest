// S1-10: familyStore (Zustand)
// On auth, opens ONE onSnapshot listener on families/{familyId}.
// Loads all childProfiles via single getDocs() call.
// Exposes: family, children[], parentProfile.
// Only re-queries children if family doc changes (child added/deleted).

import { create } from 'zustand';
import {
  doc,
  onSnapshot,
  collection,
  getDocs,
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

export const useFamilyStore = create<FamilyState>((set, get) => ({
  family: null,
  children: [],
  parentProfile: null,
  loading: true,
  error: null,

  subscribeToFamily: (familyId, parentUid) => {
    set({ loading: true });

    // Single onSnapshot listener on the family document
    const familyRef = doc(db, 'families', familyId);
    let previousMemberCount = -1;

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

        // Load parent profile
        try {
          const parentRef = doc(
            db,
            'families',
            familyId,
            'parentUsers',
            parentUid
          );
          const parentSnap = await getDocs(
            collection(db, 'families', familyId, 'parentUsers')
          );

          let parentProfile: ParentUser | null = null;
          parentSnap.forEach((doc) => {
            if (doc.id === parentUid) {
              parentProfile = { id: doc.id, ...doc.data() } as ParentUser;
            }
          });

          // Only reload children if member count changed (child added/removed)
          const currentMemberCount = familyData.memberIds.length;
          let children = get().children;

          if (
            currentMemberCount !== previousMemberCount ||
            children.length === 0
          ) {
            const childrenSnap = await getDocs(
              collection(db, 'families', familyId, 'childProfiles')
            );

            children = childrenSnap.docs.map(
              (doc) => ({ id: doc.id, ...doc.data() }) as ChildProfile
            );

            previousMemberCount = currentMemberCount;
          }

          set({
            family: familyData,
            children,
            parentProfile,
            loading: false,
            error: null,
          });
        } catch (error) {
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

    return unsubscribe;
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
