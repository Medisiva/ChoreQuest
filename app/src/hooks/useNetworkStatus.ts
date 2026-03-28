// S10: Offline-aware hook
// Shows banner when offline. Firestore offline persistence handles data.

import { useState, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';

// Simple connectivity check using fetch — React Native's NetInfo is more robust
// but this avoids an extra dependency
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    const checkConnectivity = async () => {
      try {
        const response = await fetch('https://clients3.google.com/generate_204', {
          method: 'HEAD',
        });
        setIsOnline(response.ok);
      } catch {
        setIsOnline(false);
      }
    };

    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        checkConnectivity();
      }
    };

    // Check on mount
    checkConnectivity();

    // Check every 30 seconds
    intervalId = setInterval(checkConnectivity, 30000);

    // Check when app returns to foreground
    const subscription = AppState.addEventListener('change', handleAppState);

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, []);

  return { isOnline };
}
