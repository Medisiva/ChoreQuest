import { questRewardLabel } from '@/services/questPresentation';
import { useChildProgress } from '@/hooks/useChildProgress';
import { useDisplayPreferences } from '@/stores/displayPreferences';
import WeeklyProgressBar from '@/components/child/WeeklyProgressBar';
import WeeklyCountdown from '@/components/child/WeeklyCountdown';
import WeeklyFuelGauge from '@/components/child/WeeklyFuelGauge';
import PlaygroundHero from '@/components/shared/PlaygroundHero';
// C-01: Child Home Screen
// Hero greeting, weekly progress, active quest, streak, consequences, badges, quick actions.
// Uses childSessionStore to identify active child, familyStore for profile, taskStore for claims.

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useChildSessionStore } from '@/stores/childSessionStore';
import { useFamilyStore } from '@/stores/familyStore';
import { useTaskStore } from '@/stores/taskStore';
import {
  colors,
  spacing,
  radius,
  typography,
  layout,
  shadows,
} from '@/constants/tokens';

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function ChildHome() {
  const router = useRouter();
  const activeChildId = useChildSessionStore((s) => s.activeChildId);
  const children = useFamilyStore((s) => s.children);
  const family = useFamilyStore((s) => s.family);
  const progress = useChildProgress(family?.id, activeChildId ?? undefined, family?.timezone);
  const preferredStyle = useDisplayPreferences((s) => activeChildId ? s.styles[activeChildId] : undefined);
  const claims = useTaskStore((s) => s.claims);
  const tasks = useTaskStore((s) => s.tasks);

  const child = children.find((c) => c.id === activeChildId);

  // Find active claimed task for this child
  const activeClaim = claims.find(
    (c) => c.childProfileId === activeChildId && ['claimed','submitted','rejected'].includes(c.status)
  );
  const activeTask = activeClaim
    ? tasks.find((t) => t.id === activeClaim.taskId)
    : null;

  const nickname = child?.nickname ?? 'Adventurer';
  const starBalance = child?.starBalance ?? 0;
  const streakWeeks = child?.currentStreakWeeks ?? 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <PlaygroundHero title={`Hi, ${nickname}!`} subtitle="You’ve got this. Every little help counts!" avatarId={child?.avatarId} />
        <View style={[styles.card, { backgroundColor: colors.starGold }]}>
          <Text style={styles.sectionTitle}>★ {starBalance} stars to spend</Text>
          <Text style={{ ...typography.childBody, color: colors.ink950 }}>Your weekly goal: {child?.weeklyTargetStars ?? 0} stars</Text>
        </View>
        <View style={styles.card}><Text style={styles.sectionTitle}>Your weekly wins</Text>
          {progress.loading ? <Text>Loading your progress…</Text> : progress.error ? <Text accessibilityRole="alert">{progress.error}</Text> : (preferredStyle ?? child?.progressDisplayStyle) === 'Countdown' ? <WeeklyCountdown current={progress.weekly} target={child?.weeklyTargetStars ?? 0} /> : (preferredStyle ?? child?.progressDisplayStyle) === 'FuelGauge' ? <WeeklyFuelGauge current={progress.weekly} target={child?.weeklyTargetStars ?? 0} /> : <WeeklyProgressBar current={progress.weekly} target={child?.weeklyTargetStars ?? 0} />}
        </View>
        {/* ── Active Quest Banner ───────────────────────────────────── */}
        {activeTask && activeClaim && (
          <TouchableOpacity
            style={styles.questBanner}
            activeOpacity={0.8}
            onPress={() =>
              router.push(`/(child)/tasks/${activeClaim.taskId}`)
            }
          >
            <Text style={styles.questBannerLabel}>{activeClaim.status === 'rejected' ? 'Try again' : activeClaim.status === 'submitted' ? 'Waiting for parent review' : 'Active Quest'}</Text>
            {activeClaim.status==='rejected' && <Text style={{color:'#16244D'}}>Try again: {activeClaim.rejectionReason || 'Ask your parent what needs another look.'}</Text>}
            <Text style={styles.questBannerTitle}>{activeTask.title}</Text>
            <Text style={styles.questBannerStars}>
              ⭐ {questRewardLabel(activeTask)}
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Streak Badge ──────────────────────────────────────────── */}
        {streakWeeks > 0 && (
          <View style={styles.streakCard}>
            <Text style={styles.streakText}>
              🔥 {streakWeeks} week streak!
            </Text>
          </View>
        )}

        {!activeTask && <View style={styles.card}><Text style={styles.sectionTitle}>Ready for your next little win?</Text><Text style={{ ...typography.childBody, color: colors.ink600 }}>Pick a quest, help out, and ask a parent to cheer you on.</Text></View>}
        <View style={styles.quickActions}>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.white }]} onPress={() => router.push('/(child)/requests')}><Text style={{ ...typography.childButton, color: colors.navy900 }}>My requests</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.white }]} onPress={() => router.push('/(child)/leaderboard')}><Text style={{ ...typography.childButton, color: colors.navy900 }}>Family leaderboard</Text></TouchableOpacity>
        </View>
        {/* ── Quick Actions ─────────────────────────────────────────── */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionQuests]}
            activeOpacity={0.8}
            onPress={() => router.push('/(child)/tasks')}
          >
            <Text style={styles.actionEmoji}>📋</Text>
            <Text style={styles.actionLabel}>View Quests</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionRequest]}
            activeOpacity={0.8}
            onPress={() => router.push('/(child)/requests/create')}
          >
            <Text style={styles.actionEmoji}>💬</Text>
            <Text style={styles.actionLabel}>Ask a Parent</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.cloud,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: layout.screenPadding,
    paddingBottom: layout.tabBarHeight + spacing[4],
  },

  // Hero
  heroSection: {
    marginBottom: layout.sectionGap,
  },
  greeting: {
    ...typography.childDisplay,
    color: colors.navy900,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[2],
  },
  starEmoji: {
    fontSize: 32,
    marginRight: spacing[2],
  },
  starCount: {
    ...typography.childHeading1,
    color: colors.starGold,
  },

  // Card
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: layout.cardGap,
    ...shadows.elevation2,
  },

  // Section title
  sectionHeader: {
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  sectionTitle: {
    ...typography.childHeading2,
    color: colors.ink950,
    marginBottom: spacing[2],
  },

  // Active Quest Banner
  questBanner: {
    backgroundColor: colors.navy900,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: layout.cardGap,
    ...shadows.elevation3,
  },
  questBannerLabel: {
    ...typography.childLabel,
    color: colors.starGold,
    marginBottom: spacing[1],
  },
  questBannerTitle: {
    ...typography.childHeading2,
    color: colors.white,
  },
  questBannerStars: {
    ...typography.childBody,
    color: colors.starGold,
    marginTop: spacing[1],
  },

  // Streak
  streakCard: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.starGold,
    padding: spacing[4],
    marginBottom: layout.cardGap,
    alignItems: 'center',
  },
  streakText: {
    ...typography.childHeading2,
    color: colors.amber,
  },

  // Badges
  badgeRow: {
    paddingBottom: spacing[4],
    gap: spacing[2],
  },
  badgeChip: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    alignItems: 'center',
    minWidth: 80,
    ...shadows.elevation1,
  },
  badgeEmoji: {
    fontSize: 28,
    marginBottom: spacing[1],
  },
  badgeLabel: {
    ...typography.caption,
    color: colors.ink950,
    textAlign: 'center',
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    gap: layout.cardGap,
    marginTop: spacing[4],
  },
  actionButton: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing[5],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    ...shadows.elevation2,
  },
  actionQuests: {
    backgroundColor: colors.starGold,
  },
  actionRequest: {
    backgroundColor: '#A6EDD5',
  },
  actionEmoji: {
    fontSize: 36,
    marginBottom: spacing[2],
  },
  actionLabel: {
    ...typography.childButton,
    color: colors.ink950,
    textAlign: 'center',
  },
});
