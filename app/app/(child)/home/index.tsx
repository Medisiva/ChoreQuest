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
import { useChildSessionStore } from '../../../../src/stores/childSessionStore';
import { useFamilyStore } from '../../../../src/stores/familyStore';
import { useTaskStore } from '../../../../src/stores/taskStore';
import {
  colors,
  spacing,
  radius,
  typography,
  layout,
  shadows,
} from '../../../../src/constants/tokens';
import WeeklyProgressBar from '../../../../src/components/child/WeeklyProgressBar';
import WeeklyCountdown from '../../../../src/components/child/WeeklyCountdown';
import WeeklyFuelGauge from '../../../../src/components/child/WeeklyFuelGauge';
import ConsequenceCard from '../../../../src/components/child/ConsequenceCard';
import type { ProgressDisplayStyle } from '../../../../src/types';

// ── Mock data (until stores are fully wired) ────────────────────────────────

const MOCK_WEEKLY_PROGRESS = { current: 15, target: 20 };

const MOCK_ACTIVE_CONSEQUENCE = null as {
  name: string;
  description: string;
} | null;

const MOCK_BADGES = [
  { id: 'B-01', label: 'First Quest', emoji: '🌟' },
  { id: 'B-02', label: '5-Day Streak', emoji: '🔥' },
  { id: 'B-03', label: 'Helping Hand', emoji: '🤝' },
  { id: 'B-04', label: 'Star Collector', emoji: '💎' },
  { id: 'B-05', label: 'Early Bird', emoji: '🐦' },
];

// ── Progress Widget ──────────────────────────────────────────────────────────

function ProgressWidget({
  style,
  current,
  target,
}: {
  style: ProgressDisplayStyle;
  current: number;
  target: number;
}) {
  switch (style) {
    case 'Countdown':
      return <WeeklyCountdown current={current} target={target} />;
    case 'FuelGauge':
      return <WeeklyFuelGauge current={current} target={target} />;
    case 'ProgressBar':
    default:
      return <WeeklyProgressBar current={current} target={target} />;
  }
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function ChildHome() {
  const router = useRouter();
  const activeChildId = useChildSessionStore((s) => s.activeChildId);
  const children = useFamilyStore((s) => s.children);
  const claims = useTaskStore((s) => s.claims);
  const tasks = useTaskStore((s) => s.tasks);

  const child = children.find((c) => c.id === activeChildId);

  // Find active claimed task for this child
  const activeClaim = claims.find(
    (c) => c.childProfileId === activeChildId && c.status === 'claimed'
  );
  const activeTask = activeClaim
    ? tasks.find((t) => t.id === activeClaim.taskId)
    : null;

  const nickname = child?.nickname ?? 'Adventurer';
  const starBalance = child?.starBalance ?? 0;
  const streakWeeks = child?.currentStreakWeeks ?? 0;
  const progressStyle: ProgressDisplayStyle =
    child?.progressDisplayStyle ?? 'ProgressBar';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <View style={styles.heroSection}>
          <Text style={styles.greeting}>Hey, {nickname}!</Text>
          <View style={styles.starRow}>
            <Text style={styles.starEmoji}>⭐</Text>
            <Text style={styles.starCount}>{starBalance} stars</Text>
          </View>
        </View>

        {/* ── Weekly Progress ───────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Weekly Progress</Text>
          <ProgressWidget
            style={progressStyle}
            current={MOCK_WEEKLY_PROGRESS.current}
            target={MOCK_WEEKLY_PROGRESS.target}
          />
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
            <Text style={styles.questBannerLabel}>Active Quest</Text>
            <Text style={styles.questBannerTitle}>{activeTask.title}</Text>
            <Text style={styles.questBannerStars}>
              ⭐ {activeTask.starValue} stars
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

        {/* ── Active Consequence ────────────────────────────────────── */}
        {MOCK_ACTIVE_CONSEQUENCE && (
          <ConsequenceCard
            name={MOCK_ACTIVE_CONSEQUENCE.name}
            description={MOCK_ACTIVE_CONSEQUENCE.description}
          />
        )}

        {/* ── Recent Badges ─────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Badges</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.badgeRow}
        >
          {MOCK_BADGES.map((badge) => (
            <View key={badge.id} style={styles.badgeChip}>
              <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
              <Text style={styles.badgeLabel}>{badge.label}</Text>
            </View>
          ))}
        </ScrollView>

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
    backgroundColor: colors.coral,
  },
  actionRequest: {
    backgroundColor: colors.softPurple,
  },
  actionEmoji: {
    fontSize: 36,
    marginBottom: spacing[2],
  },
  actionLabel: {
    ...typography.childButton,
    color: colors.white,
    textAlign: 'center',
  },
});
