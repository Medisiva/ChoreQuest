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
import { manageFamily } from '@/services/families';
import { PRIVACY_POLICY_URL } from '@/constants/legal';
import { Linking } from 'react-native';

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

  const handleDeleteMyAccount = useCallback(() => {
    Alert.alert(
      'Delete my account',
      'This permanently deletes your ChoreQuest sign-in, your parent profile and your star wallet history. If another parent shares this family, they keep it and become its owner. If you are the only parent, the whole family is disabled now and permanently deleted after 30 days.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Delete your account now?', 'This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete my account',
                style: 'destructive',
                onPress: async () => {
                  try {
                    const result = await manageFamily<{ familyScheduledForDeletion?: boolean }>({ action: 'deleteAccount', confirmText: 'DELETE' });
                    await signOut().catch(() => undefined);
                    router.replace('/(auth)/login');
                    Alert.alert('Account deleted', result.familyScheduledForDeletion
                      ? 'Your sign-in is deleted. Your family is disabled and its data will be permanently removed within 30 days.'
                      : 'Your sign-in and parent data are deleted. The family stays with the other parent.');
                  } catch (error) {
                    Alert.alert('Could not delete account', error instanceof Error ? error.message.replace(/^Firebase:\s*/, '') : 'Please try again.');
                  }
                },
              },
            ]);
          },
        },
      ]
    );
  }, [router]);

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

        <TouchableOpacity style={styles.card} onPress={()=>router.push('/(parent)/children/manage')}><Text style={styles.cardLabel}>Child profiles, stars and consequences</Text><Text style={{color:'#F7F5FF'}}>→</Text></TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={()=>router.push('/(parent)/settings/family')}><Text style={styles.cardLabel}>Family settings and parent invitation</Text><Text style={{color:'#F7F5FF'}}>→</Text></TouchableOpacity>
        {/* Preferences */}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Family Leaderboard</Text>
          <Switch
            accessibilityLabel="Family Leaderboard"
            value={leaderboardEnabled}
            onValueChange={(value) => { if (family) void setDoc(doc(db, "families", family.id, "settings", "config"), { leaderboardEnabled: value }, { merge: true }).catch(() => Alert.alert("Could not save", "Reconnect and try again.")); }}
            trackColor={{ true: '#65F3FF', false: '#17363A' }}
            thumbColor="#FFFFFF"
          />
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Device alerts while the app is open</Text>
          <Switch
            accessibilityLabel="Device alerts while the app is open"
            value={notificationsEnabled}
            disabled={Platform.OS === "web"}
            onValueChange={async (value) => { if (!family) return; if (!value) { choose(family.id, false); return; } try { const granted = await requestDeviceAlertsPermission(); choose(family.id, granted); if (!granted) Alert.alert("Device alerts off", "Allow notifications in your phone settings to enable device alerts."); } catch { Alert.alert("Could not enable alerts", "Please try again on your Android phone."); } }}
            trackColor={{ true: '#65F3FF', false: '#17363A' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Data */}
        <Text style={styles.sectionLabel}>YOUR DATA</Text>
        <TouchableOpacity style={styles.card} onPress={handleExportData} disabled={exporting}>
          <Text style={styles.cardLabel}>Export family data</Text>
          {exporting ? <ActivityIndicator size="small" color="#65F3FF" /> : <Text style={styles.cardArrow}>↓</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.card, styles.dangerCard]} onPress={handleDeleteAccount}>
          <Text style={styles.dangerLabel}>Delete family data</Text>
          <Text style={styles.dangerArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity accessibilityRole="button" style={[styles.card, styles.dangerCard]} onPress={handleDeleteMyAccount}>
          <Text style={styles.dangerLabel}>Delete my account</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="link" style={styles.card} onPress={() => { void Linking.openURL(PRIVACY_POLICY_URL); }}>
          <Text style={styles.cardLabel}>Privacy policy</Text>
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
  container: { flex: 1, backgroundColor: '#23232F' },
  content: { padding: 24, paddingBottom: 48 },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 28, color: '#F7F5FF', marginBottom: 24 },
  sectionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#A9A7BA', letterSpacing: 1, marginTop: 24, marginBottom: 8 },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#121219', borderRadius: 12, padding: 16, marginBottom: 8 },
  cardLabel: { fontFamily: 'Inter_500Medium', fontSize: 15, color: '#F7F5FF' },
  cardValue: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#C0BDCF' },
  cardArrow: { fontSize: 18, color: '#A9A7BA' },
  dangerCard: { borderWidth: 1, borderColor: '#391D2B' },
  dangerLabel: { fontFamily: 'Inter_500Medium', fontSize: 15, color: '#FF92A7' },
  dangerArrow: { fontSize: 18, color: '#FF92A7' },
  signOutButton: { marginTop: 32, backgroundColor: '#121219', borderWidth: 1, borderColor: '#17363A', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  signOutText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#65F3FF' },
  version: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#A9A7BA', textAlign: 'center', marginTop: 24 },
});
