// S5: rewardStore (Zustand)
// Opens onSnapshot listeners on rewards, parentRewards, and redemptions collections.
// Components subscribe to Zustand only — never call Firestore directly.

import { create } from 'zustand';
import {
  collection,
  query,
  where,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Reward, ParentReward, Redemption } from '../types';

interface RewardState {
  childRewards: Reward[];
  parentRewards: ParentReward[];
  redemptions: Redemption[];
  loading: boolean;
  error: string | null;

  // Actions
  subscribeToRewards: (familyId: string) => Unsubscribe;
  clearRewards: () => void;
}

export const useRewardStore = create<RewardState>((set) => ({
  childRewards: [],
  parentRewards: [],
  redemptions: [],
  loading: true,
  error: null,

  subscribeToRewards: (familyId: string) => {
    set({ loading: true, error: null });

    // Listener 1: Active child rewards
    const rewardsQuery = query(
      collection(db, 'families', familyId, 'rewards'),
      where('isActive', '==', true)
    );

    const unsubRewards = onSnapshot(
      rewardsQuery,
      (snapshot) => {
        const childRewards = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Reward
        );
        set({ childRewards, loading: false, error: null });
      },
      (error) => {
        console.error('[rewardStore] Rewards snapshot error:', error);
        set({ loading: false, error: 'Failed to load rewards.' });
      }
    );

    // Listener 2: Active parent rewards
    const parentRewardsQuery = query(
      collection(db, 'families', familyId, 'parentRewards'),
      where('isActive', '==', true)
    );

    const unsubParentRewards = onSnapshot(
      parentRewardsQuery,
      (snapshot) => {
        const parentRewards = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as ParentReward
        );
        set({ parentRewards });
      },
      (error) => {
        console.error('[rewardStore] Parent rewards snapshot error:', error);
        set({ error: 'Failed to load parent rewards.' });
      }
    );

    // Listener 3: Redemptions (all statuses for history)
    const redemptionsQuery = query(
      collection(db, 'families', familyId, 'redemptions')
    );

    const unsubRedemptions = onSnapshot(
      redemptionsQuery,
      (snapshot) => {
        const redemptions = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Redemption
        );
        set({ redemptions });
      },
      (error) => {
        console.error('[rewardStore] Redemptions snapshot error:', error);
        set({ error: 'Failed to load redemptions.' });
      }
    );

    // Return combined unsubscribe
    return () => {
      unsubRewards();
      unsubParentRewards();
      unsubRedemptions();
    };
  },

  clearRewards: () =>
    set({
      childRewards: [],
      parentRewards: [],
      redemptions: [],
      loading: true,
      error: null,
    }),
}));
