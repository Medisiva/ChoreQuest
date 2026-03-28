// taskStore (Zustand)
// Populated on child session start (not on auth).
// Opens TWO onSnapshot listeners:
//   1. tasks subcollection filtered by isActive=true
//   2. taskClaims where status in ['claimed', 'submitted']
// Components subscribe to Zustand only — never call Firestore directly.

import { create } from 'zustand';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Task, TaskClaim, Category, AgeGroup } from '../types';

interface TaskState {
  tasks: Task[];
  claims: TaskClaim[];
  loading: boolean;
  error: string | null;

  // Actions
  subscribeToTasks: (familyId: string) => Unsubscribe;
  getFilteredTasks: (category?: Category, ageGroup?: AgeGroup) => Task[];
  clearTasks: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  claims: [],
  loading: true,
  error: null,

  subscribeToTasks: (familyId: string) => {
    set({ loading: true, error: null });

    // Listener 1: Active tasks
    const tasksQuery = query(
      collection(db, 'families', familyId, 'tasks'),
      where('isActive', '==', true)
    );

    const unsubTasks = onSnapshot(
      tasksQuery,
      (snapshot) => {
        const tasks = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Task
        );
        set({ tasks, loading: false, error: null });
      },
      (error) => {
        console.error('[taskStore] Tasks snapshot error:', error);
        set({ loading: false, error: 'Failed to load tasks.' });
      }
    );

    // Listener 2: Active claims (claimed or submitted)
    const claimsQuery = query(
      collection(db, 'families', familyId, 'taskClaims'),
      where('status', 'in', ['claimed', 'submitted'])
    );

    const unsubClaims = onSnapshot(
      claimsQuery,
      (snapshot) => {
        const claims = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as TaskClaim
        );
        set({ claims });
      },
      (error) => {
        console.error('[taskStore] Claims snapshot error:', error);
        set({ error: 'Failed to load task claims.' });
      }
    );

    // Return combined unsubscribe
    return () => {
      unsubTasks();
      unsubClaims();
    };
  },

  getFilteredTasks: (category?: Category, ageGroup?: AgeGroup) => {
    let filtered = get().tasks;

    if (category) {
      filtered = filtered.filter((t) => t.category === category);
    }

    if (ageGroup) {
      filtered = filtered.filter((t) => t.ageGroupSuggestion === ageGroup);
    }

    return filtered;
  },

  clearTasks: () =>
    set({
      tasks: [],
      claims: [],
      loading: true,
      error: null,
    }),
}));
