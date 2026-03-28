// Request store for family requests (kid-to-parent)

import { create } from 'zustand';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import type { FamilyRequest } from '../types';

interface RequestState {
  requests: FamilyRequest[];
  loading: boolean;
  error: string | null;
  subscribeToRequests: (familyId: string) => Unsubscribe;
  clearRequests: () => void;
}

export const useRequestStore = create<RequestState>((set) => ({
  requests: [],
  loading: true,
  error: null,

  subscribeToRequests: (familyId) => {
    set({ loading: true });

    const q = query(
      collection(db, 'families', familyId, 'familyRequests'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const requests = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as FamilyRequest
        );
        set({ requests, loading: false, error: null });
      },
      (error) => {
        console.error('[requestStore] Snapshot error:', error);
        set({ loading: false, error: 'Failed to load requests.' });
      }
    );

    return unsubscribe;
  },

  clearRequests: () => set({ requests: [], loading: true, error: null }),
}));
