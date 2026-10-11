import Constants from 'expo-constants';
import { exportArtifact } from '@/services/exportArtifact';
import { useDeviceAlerts } from '@/stores/deviceAlerts';
import { requestDeviceAlertsPermission } from '@/services/notifications';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useEffect } from 'react';
// S11: Parent Settings screen
// Manage family, notification prefs, leaderboard toggle, data export, account deletion.

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Alert from '@/services/dialogs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useFamilyStore } from '@/stores/familyStore';
import { signOut } from '@/services/auth';
import { callBackend } from '@/services/backend';

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { family } = useFamilyStore();
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(true);
  const { enabled, choose } = useDeviceAlerts();
  const notificationsEnabled = Boolean(family && enabled[family.id]);
  useEffect(() => { if (!family) return; return onSnapshot(doc(db, "families", family.id, "settings", "config"), snapshot => setLeaderboardEnabled(snapshot.data()?.leaderboardEnabled !== false)); }, [family?.id]);
  const [exporting, setExporting] = useState(false);

  const handleExportData = useCallback(async () => {
    if (!family || !user) return;
    setExporting(true);
    try {
      const data = await callBackend<Record<string, unknown>>('exportFamilyData', { familyId: family.id });
      await exportArtifact(data);

    } catch {
      Alert.alert('Error', 'Export failed. Try again.');
    } finally {
      setExporting(false);
    }
  }, [family, user]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete family data',
      'This disables access for everyone in your family. Family data is permanently removed after 30 days. Adult sign-ins are preserved; the owner can restore the family during the retention period. Only the family creator can continue.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'Disable this family and schedule its data for deletion? Adult sign-ins are preserved.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await callBackend('deleteFamilyAccount', { familyId: family?.id, confirmText: 'DELETE' });
                      await signOut();
                      router.replace('/(auth)/login');
                      Alert.alert('Deletion scheduled', 'Family access is disabled. Sign in again to restore your family within 30 days, or start a new family. Permanent family-data cleanup runs after 30 days.');
                    } catch (error) {
                      Alert.alert('Could not delete account', error instanceof Error ? error.message : 'Please try again.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, [family, router]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace('/(auth)/login');
  }, [router]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Settings</Text>

        {/* Family Section */}
        <Text style={styles.sectionLabel}>FAMILY</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Family Name</Text>
          <Text style={styles.cardValue}>{family?.familyName ?? 'Unknown'}</Text>
        </View>
        <TouchableOpacity style={styles.card} onPress={() => router.push('/(parent)/children/create' as never)}>
          <Text style={styles.cardLabel}>Add another child</Text>
          <Text style={styles.cardArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => router.push('/(parent)/children/pin' as never)}>
          <Text style={styles.cardLabel}>Reset a child’s PIN</Text>
          <Text style={styles.cardArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={()=>router.push('/(parent)/children/manage')}><Text style={styles.cardLabel}>Child profiles, stars and consequences</Text><Text>→</Text></TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={()=>router.push('/(parent)/settings/family')}><Text style={styles.cardLabel}>Family settings and parent invitation</Text><Text>→</Text></TouchableOpacity>
        {/* Preferences */}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Family Leaderboard</Text>
          <Switch
            value={leaderboardEnabled}
            onValueChange={(value) => { if (family) void setDoc(doc(db, "families", family.id, "settings", "config"), { leaderboardEnabled: value }, { merge: true }).catch(() => Alert.alert("Could not save", "Reconnect and try again.")); }}
            trackColor={{ true: '#1555E8', false: '#E5EFFF' }}
            thumbColor="#FFFFFF"
          />
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Device alerts while the app is open</Text>
          <Switch
            value={notificationsEnabled}
            disabled={Platform.OS === "web"}
            onValueChange={async (value) => { if (!family) return; if (!value) { choose(family.id, false); return; } try { const granted = await requestDeviceAlertsPermission(); choose(family.id, granted); if (!granted) Alert.alert("Device alerts off", "Allow notifications in your phone settings to enable device alerts."); } catch { Alert.alert("Could not enable alerts", "Please try again on your Android phone."); } }}
            trackColor={{ true: '#1555E8', false: '#E5EFFF' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Data */}
        <Text style={styles.sectionLabel}>YOUR DATA</Text>
        <TouchableOpacity style={styles.card} onPress={handleExportData} disabled={exporting}>
          <Text style={styles.cardLabel}>Export family data</Text>
          {exporting ? <ActivityIndicator size="small" color="#1555E8" /> : <Text style={styles.cardArrow}>↓</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.card, styles.dangerCard]} onPress={handleDeleteAccount}>
          <Text style={styles.dangerLabel}>Delete family data</Text>
          <Text style={styles.dangerArrow}>→</Text>
        </TouchableOpacity>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>ChoreQuest v{Constants.expoConfig?.version ?? '1.0.1'}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F8FF' },
  content: { padding: 24, paddingBottom: 48 },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 28, color: '#16244D', marginBottom: 24 },
  sectionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#6C7893', letterSpacing: 1, marginTop: 24, marginBottom: 8 },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 8 },
  cardLabel: { fontFamily: 'Inter_500Medium', fontSize: 15, color: '#16244D' },
  cardValue: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#4B5875' },
  cardArrow: { fontSize: 18, color: '#6C7893' },
  dangerCard: { borderWidth: 1, borderColor: '#FEE2E2' },
  dangerLabel: { fontFamily: 'Inter_500Medium', fontSize: 15, color: '#9B1C1C' },
  dangerArrow: { fontSize: 18, color: '#9B1C1C' },
  signOutButton: { marginTop: 32, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5EFFF', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  signOutText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#1555E8' },
  version: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6C7893', textAlign: 'center', marginTop: 24 },
});
