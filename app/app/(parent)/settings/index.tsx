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
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
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
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [exporting, setExporting] = useState(false);

  const handleExportData = useCallback(async () => {
    if (!family || !user) return;
    setExporting(true);
    try {
      const data = await callBackend<Record<string, unknown>>('exportFamilyData', { familyId: family.id });
      await Share.share({ title: 'ChoreQuest family data', message: JSON.stringify(data, null, 2) });

    } catch {
      Alert.alert('Error', 'Export failed. Try again.');
    } finally {
      setExporting(false);
    }
  }, [family, user]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This disables access for everyone in your family. Family data and accounts are permanently removed after 30 days. Only the family creator can continue.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'Delete the entire family, including all child profiles and parent accounts?',
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
                      Alert.alert('Deletion scheduled', 'Family access is disabled. Permanent cleanup runs after 30 days.');
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

        {/* Preferences */}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Family Leaderboard</Text>
          <Switch
            value={leaderboardEnabled}
            onValueChange={setLeaderboardEnabled}
            trackColor={{ true: '#1A3E6E', false: '#E8F2FB' }}
            thumbColor="#FFFFFF"
          />
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Push Notifications</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ true: '#1A3E6E', false: '#E8F2FB' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Data */}
        <Text style={styles.sectionLabel}>YOUR DATA</Text>
        <TouchableOpacity style={styles.card} onPress={handleExportData} disabled={exporting}>
          <Text style={styles.cardLabel}>Export family data</Text>
          {exporting ? <ActivityIndicator size="small" color="#1A3E6E" /> : <Text style={styles.cardArrow}>↓</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.card, styles.dangerCard]} onPress={handleDeleteAccount}>
          <Text style={styles.dangerLabel}>Delete account</Text>
          <Text style={styles.dangerArrow}>→</Text>
        </TouchableOpacity>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>ChoreQuest v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 24, paddingBottom: 48 },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 28, color: '#1A1A2E', marginBottom: 24 },
  sectionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#9CA3AF', letterSpacing: 1, marginTop: 24, marginBottom: 8 },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 8 },
  cardLabel: { fontFamily: 'Inter_500Medium', fontSize: 15, color: '#1A1A2E' },
  cardValue: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#555555' },
  cardArrow: { fontSize: 18, color: '#9CA3AF' },
  dangerCard: { borderWidth: 1, borderColor: '#FEE2E2' },
  dangerLabel: { fontFamily: 'Inter_500Medium', fontSize: 15, color: '#9B1C1C' },
  dangerArrow: { fontSize: 18, color: '#9B1C1C' },
  signOutButton: { marginTop: 32, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8F2FB', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  signOutText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#1A3E6E' },
  version: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 24 },
});
