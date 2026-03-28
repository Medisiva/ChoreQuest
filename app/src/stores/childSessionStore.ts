// S1-13: childSessionStore (Zustand)
// Holds: activeChildId, sessionToken, sessionExpiry
// NEVER persisted to AsyncStorage — memory only
// Auto-clears on 30min inactivity or app background > 30 seconds

import { create } from 'zustand';
import { AppState, AppStateStatus } from 'react-native';

interface ChildSessionState {
  activeChildId: string | null;
  sessionToken: string | null;
  sessionExpiry: Date | null;

  // Actions
  startSession: (childId: string, token: string) => void;
  endSession: () => void;
  isSessionValid: () => boolean;
  setupBackgroundListener: () => () => void;
}

const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const BACKGROUND_TIMEOUT_MS = 30 * 1000; // 30 seconds in background → clear

export const useChildSessionStore = create<ChildSessionState>((set, get) => ({
  activeChildId: null,
  sessionToken: null,
  sessionExpiry: null,

  startSession: (childId, token) => {
    const expiry = new Date(Date.now() + SESSION_DURATION_MS);
    set({
      activeChildId: childId,
      sessionToken: token,
      sessionExpiry: expiry,
    });
  },

  endSession: () => {
    set({
      activeChildId: null,
      sessionToken: null,
      sessionExpiry: null,
    });
  },

  isSessionValid: () => {
    const { sessionExpiry, sessionToken } = get();
    if (!sessionToken || !sessionExpiry) return false;
    return new Date() < sessionExpiry;
  },

  setupBackgroundListener: () => {
    let backgroundTimer: ReturnType<typeof setTimeout> | null = null;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        // Start timer — if app doesn't return to foreground, clear session
        backgroundTimer = setTimeout(() => {
          const { activeChildId } = get();
          if (activeChildId) {
            console.log(
              '[childSession] Clearing session after background timeout'
            );
            get().endSession();
          }
        }, BACKGROUND_TIMEOUT_MS);
      } else if (nextState === 'active') {
        // App returned to foreground — cancel the timer
        if (backgroundTimer) {
          clearTimeout(backgroundTimer);
          backgroundTimer = null;
        }

        // Check if session has expired while in background
        if (!get().isSessionValid() && get().activeChildId) {
          console.log('[childSession] Session expired during background');
          get().endSession();
        }
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );

    // Return cleanup function
    return () => {
      subscription.remove();
      if (backgroundTimer) {
        clearTimeout(backgroundTimer);
      }
    };
  },
}));
