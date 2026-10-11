import { StatusBar } from 'expo-status-bar';
import OfflineBanner from '@/components/shared/OfflineBanner';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { registerFamilySubscriptions } from '@/services/familySubscriptions';
import { useDeviceRequestAlerts } from '@/hooks/useDeviceRequestAlerts';
import AppDialog from '@/components/shared/AppDialog';
// S1-08: Root _layout.tsx — auth-gated navigation router
// If auth loading: show splash. If not authenticated: redirect to /(auth)/login.
// If authenticated but no family: redirect to /(onboarding).
// If authenticated with family: redirect to /profiles.
// Never flashes wrong screen.
// onAuthStateChanged called ONCE globally here.

import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { initializeFirebase } from '@/services/firebase';
import { useFamilyStore } from '@/stores/familyStore';
import { useTaskStore } from '@/stores/taskStore';
import { useRequestStore } from '@/stores/requestStore';
import { useRewardStore } from '@/stores/rewardStore';
import { useChildSessionStore } from '@/stores/childSessionStore';

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const { user, role, familyId, parentProfile, loading, error, initialize } = useAuthStore();
  const [retry, setRetry] = useState(0);
  useDeviceRequestAlerts(familyId, role);

  const {isOnline} = useNetworkStatus();
  const switching = useChildSessionStore((state) => state.switching);
  const sessionValid = useChildSessionStore((state) => state.isSessionValid());
  // Initialize Firebase ONCE
  useEffect(() => {
    initializeFirebase();
  }, []);

  // Subscribe to auth state ONCE
  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
  }, [initialize, retry]);

  useEffect(() => {
    if (switching || !user || !familyId || (role === 'child' && !sessionValid)) return;
    const unsubscribeFamily = useFamilyStore.getState().subscribeToFamily(familyId, user.uid, role === 'child');
    const unsubscribeTasks = useTaskStore.getState().subscribeToTasks(familyId);
    const unsubscribeRequests = useRequestStore.getState().subscribeToRequests(familyId);
    return registerFamilySubscriptions(() => {
      unsubscribeFamily();
      unsubscribeTasks();
      unsubscribeRequests();
      useFamilyStore.getState().clearFamily();
      useTaskStore.getState().clearTasks();
      useRequestStore.getState().clearRequests();
      useRewardStore.getState().clearRewards();

    });
  }, [user?.uid, familyId, role, sessionValid, switching]);

  useEffect(() => useChildSessionStore.getState().setupBackgroundListener(), []);

  // Auth-gated routing
  useEffect(() => {
    if (loading || switching || error) return;
    if (role === 'child') {
      if (!sessionValid && segments[0] !== 'child-login' && segments[0] !== 'parent-unlock') { router.replace('/child-login'); return; }
      if (segments[0] === '(parent)' || segments[0] === '(onboarding)' || segments[0] === '(auth)') router.replace('/parent-unlock');
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';

    if (!user && !inAuthGroup) {
      // Not authenticated — redirect to login
      router.replace('/(auth)/login');
    } else if (user && (!parentProfile || parentProfile.familyDeleted) && !inOnboardingGroup && segments[0] !== 'join-family') {
      router.replace('/(onboarding)');
    } else if (user && parentProfile && !parentProfile.familyDeleted && (inAuthGroup || inOnboardingGroup || segments[0] === 'join-family')) {
      router.replace('/profiles');
    }
  }, [user, role, familyId, parentProfile, loading, error, switching, sessionValid, segments, router]);

  // Show splash while loading auth state or fonts
  const isAccessForm = segments.some(segment => ['(auth)', 'parent-unlock'].includes(segment));
  if ((loading || switching) && !isAccessForm) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (error && user) {
    return <View style={[styles.splash, { padding: 24 }]}>
      <Text style={{ color: '#F7F5FF', fontSize: 20, textAlign: 'center', marginBottom: 16 }}>{error}</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => setRetry(value => value + 1)} style={{ backgroundColor: '#121219', padding: 16, borderRadius: 12 }}>
        <Text style={{ color: '#65F3FF' }}>Retry loading my family</Text>
      </TouchableOpacity>
    </View>;
  }
  return <View style={{flex:1}}><StatusBar style="light" /><Slot /><OfflineBanner isOnline={isOnline} /></View>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <RootLayoutNav />
      <AppDialog />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#060609', // dark arcade splash
  },
});
