import { useChildProgress } from '@/hooks/useChildProgress';
import { useDisplayPreferences } from '@/stores/displayPreferences';
import KidAvatar from '@/components/shared/KidAvatar';
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
import { useChildSessionStore } from '@/stores/childSessionStore';
import { useFamilyStore } from '@/stores/familyStore';
import type { ProgressDisplayStyle } from '@/types';

const PROGRESS_OPTIONS: { value: ProgressDisplayStyle; label: string; emoji: string }[] = [
  { value: 'ProgressBar', label: 'Progress Bar', emoji: '📊' },
  { value: 'Countdown', label: 'Countdown', emoji: '🔢' },
  { value: 'FuelGauge', label: 'Fuel Gauge', emoji: '🚀' },
];

export default function ChildProfileScreen() {
  const router = useRouter();
  const { activeChildId } = useChildSessionStore();
  const { children, family } = useFamilyStore();
  const progress = useChildProgress(family?.id, activeChildId ?? undefined, family?.timezone);
  const { styles: preferredStyles, choose } = useDisplayPreferences();

  const child = useMemo(
    () => children.find((c) => c.id === activeChildId),
    [children, activeChildId]
  );

  const handleSwitchProfile = useCallback(() => {
    router.replace('/profiles');
  }, [router]);

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
            <KidAvatar avatarId={child.avatarId} size={96} />
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
                onPress={() => choose(child.id, opt.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: (preferredStyles[child.id] ?? child.progressDisplayStyle) === opt.value }}
                style={[
                  styles.progressChip,
                  (preferredStyles[child.id] ?? child.progressDisplayStyle) === opt.value && styles.progressChipSelected,
                ]}
              >
                <Text style={styles.progressEmoji}>{opt.emoji}</Text>
                <Text
                  style={[
                    styles.progressLabel,
                    (preferredStyles[child.id] ?? child.progressDisplayStyle) === opt.value && styles.progressLabelSelected,
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
            <Text style={styles.badgePlaceholder}>{progress.badges.length ? progress.badges.map(badge => `🏆 ${badge.badgeName ?? badge.badgeId}`).join(" · ") : "Your first badge is waiting. Complete a quest!"}</Text>
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
  container: { flex: 1, backgroundColor: '#060609' },
  notFound: { fontFamily: 'Inter_400Regular', fontSize: 16, color: '#C0BDCF', textAlign: 'center', marginTop: 100 },
  content: { padding: 24, paddingBottom: 48, alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 24 },
  avatarCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#121219', justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, shadowOpacity: 0.1, shadowColor: 'rgba(26,62,110,0.12)' },
  avatarEmoji: { fontSize: 48 },
  name: { fontFamily: 'Nunito_800ExtraBold', fontSize: 28, color: '#F7F5FF' },
  ageGroup: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#A9A7BA', marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: '#121219', borderRadius: 12, padding: 14, alignItems: 'center' },
  statValue: { fontFamily: 'Nunito_700Bold', fontSize: 20, color: '#F7F5FF', marginBottom: 4 },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#A9A7BA' },
  streakCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#302719', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginBottom: 20 },
  streakEmoji: {color:'#F7F5FF', fontSize: 24 },
  streakText: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: '#FFE177' },
  section: { width: '100%', marginBottom: 20 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#F7F5FF', marginBottom: 12 },
  targetValue: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#C0BDCF', marginBottom: 4 },
  progressOptions: { flexDirection: 'row', gap: 8 },
  progressChip: { flex: 1, backgroundColor: '#121219', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  progressChipSelected: { borderColor: '#65F3FF' },
  progressEmoji: {color:'#F7F5FF', fontSize: 24, marginBottom: 4 },
  progressLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#C0BDCF' },
  progressLabelSelected: { color: '#65F3FF' },
  badgeRow: { backgroundColor: '#121219', borderRadius: 12, padding: 20, alignItems: 'center' },
  badgePlaceholder: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#A9A7BA' },
  switchButton: { marginTop: 16, backgroundColor: '#121219', borderWidth: 1, borderColor: '#17363A', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  switchText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#65F3FF' },
});
