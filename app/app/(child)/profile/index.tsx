// S10: Child Profile screen (C-09)
// Avatar, stats, badge showcase, progress display selector, switch profile

import { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useChildSessionStore } from '../../../src/stores/childSessionStore';
import { useFamilyStore } from '../../../src/stores/familyStore';
import type { ProgressDisplayStyle } from '../../../src/types';

const PROGRESS_OPTIONS: { value: ProgressDisplayStyle; label: string; emoji: string }[] = [
  { value: 'ProgressBar', label: 'Progress Bar', emoji: '📊' },
  { value: 'Countdown', label: 'Countdown', emoji: '🔢' },
  { value: 'FuelGauge', label: 'Fuel Gauge', emoji: '🚀' },
];

export default function ChildProfileScreen() {
  const router = useRouter();
  const { activeChildId, endSession } = useChildSessionStore();
  const { children } = useFamilyStore();

  const child = useMemo(
    () => children.find((c) => c.id === activeChildId),
    [children, activeChildId]
  );

  const handleSwitchProfile = useCallback(() => {
    endSession();
    router.replace('/profiles');
  }, [endSession, router]);

  if (!child) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.notFound}>Profile not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar & Name */}
        <View style={styles.header}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarEmoji}>😊</Text>
          </View>
          <Text style={styles.name}>{child.nickname}</Text>
          <Text style={styles.ageGroup}>Age {child.ageGroup}</Text>
        </View>

        {/* Star Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>⭐ {child.starBalance}</Text>
            <Text style={styles.statLabel}>Balance</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{child.totalStarsEarned}</Text>
            <Text style={styles.statLabel}>Total Earned</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{child.totalStarsRedeemed}</Text>
            <Text style={styles.statLabel}>Redeemed</Text>
          </View>
        </View>

        {/* Streak */}
        {child.currentStreakWeeks > 0 && (
          <View style={styles.streakCard}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakText}>{child.currentStreakWeeks} week streak!</Text>
          </View>
        )}

        {/* Weekly Targets */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly Target</Text>
          <Text style={styles.targetValue}>⭐ {child.weeklyTargetStars} stars per week</Text>
          <Text style={styles.targetValue}>⭐ {child.monthlyTargetStars} stars per month</Text>
        </View>

        {/* Progress Display Style */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How do you want to see your progress?</Text>
          <View style={styles.progressOptions}>
            {PROGRESS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.progressChip,
                  child.progressDisplayStyle === opt.value && styles.progressChipSelected,
                ]}
              >
                <Text style={styles.progressEmoji}>{opt.emoji}</Text>
                <Text
                  style={[
                    styles.progressLabel,
                    child.progressDisplayStyle === opt.value && styles.progressLabelSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Badges Showcase */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Badges</Text>
          <View style={styles.badgeRow}>
            <Text style={styles.badgePlaceholder}>🏆 Badges coming soon!</Text>
          </View>
        </View>

        {/* Switch Profile */}
        <TouchableOpacity style={styles.switchButton} onPress={handleSwitchProfile}>
          <Text style={styles.switchText}>Switch Profile</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  notFound: { fontFamily: 'Inter_400Regular', fontSize: 16, color: '#555555', textAlign: 'center', marginTop: 100 },
  content: { padding: 24, paddingBottom: 48, alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 24 },
  avatarCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, shadowOpacity: 0.1, shadowColor: 'rgba(26,62,110,0.12)' },
  avatarEmoji: { fontSize: 48 },
  name: { fontFamily: 'Nunito_800ExtraBold', fontSize: 28, color: '#1A1A2E' },
  ageGroup: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#9CA3AF', marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, alignItems: 'center' },
  statValue: { fontFamily: 'Nunito_700Bold', fontSize: 20, color: '#1A1A2E', marginBottom: 4 },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#9CA3AF' },
  streakCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginBottom: 20 },
  streakEmoji: { fontSize: 24 },
  streakText: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: '#92400E' },
  section: { width: '100%', marginBottom: 20 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#1A1A2E', marginBottom: 12 },
  targetValue: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#555555', marginBottom: 4 },
  progressOptions: { flexDirection: 'row', gap: 8 },
  progressChip: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  progressChipSelected: { borderColor: '#4FC3F7' },
  progressEmoji: { fontSize: 24, marginBottom: 4 },
  progressLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#555555' },
  progressLabelSelected: { color: '#1A3E6E' },
  badgeRow: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20, alignItems: 'center' },
  badgePlaceholder: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#9CA3AF' },
  switchButton: { marginTop: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8F2FB', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  switchText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#4A90D9' },
});
