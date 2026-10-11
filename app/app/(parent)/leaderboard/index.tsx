// P-Leaderboard: Parent Leaderboard Screen
// Same leaderboard as child but in parent theme (Inter font, navy900 accent).
// Parents and kids on the SAME leaderboard — the key differentiator.

import React, { useState } from 'react';
import { useLeaderboard } from '@/utils/useLeaderboard';
import type { LeaderboardEntry, LeaderboardPeriod } from '@/utils/leaderboard';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFamilyStore } from '@/stores/familyStore';
import {
  colors,
  spacing,
  radius,
  typography,
  layout,
  shadows,
} from '@/constants/tokens';

// ── Types ────────────────────────────────────────────────────────────────────

type Period = LeaderboardPeriod;

const PERIOD_LABELS: Record<Period, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  allTime: 'All Time',
};

// ── Components ───────────────────────────────────────────────────────────────

function PeriodTab({
  period,
  active,
  onPress,
}: {
  period: Period;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {PERIOD_LABELS[period]}
      </Text>
    </TouchableOpacity>
  );
}

function LeaderboardRow({
  entry,
  rank,
  isCurrentUser,
}: {
  entry: LeaderboardEntry;
  rank: number;
  isCurrentUser: boolean;
}) {
  const isWinner = rank === 1;

  return (
    <View
      style={[
        styles.row,
        isCurrentUser && styles.rowHighlighted,
        isWinner && styles.rowWinner,
      ]}
    >
      <View style={styles.rankContainer}>
        {isWinner ? (
          <Text style={styles.crownIcon}>👑</Text>
        ) : (
          <Text style={styles.rankText}>{rank}</Text>
        )}
      </View>

      <View style={styles.avatarContainer}>
        <Text style={styles.avatarEmoji}>{entry.avatarEmoji}</Text>
      </View>

      <View style={styles.nameContainer}>
        <Text style={styles.nameText}>{entry.name}</Text>
        <Text style={styles.roleText}>
          {entry.role === 'parent' ? 'Parent' : 'Kid'}
        </Text>
      </View>

      <View style={styles.starsContainer}>
        <Text style={styles.starsText}>⭐ {entry.stars}</Text>
      </View>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function ParentLeaderboard() {
  const router = useRouter();
  const parentProfile = useFamilyStore((s) => s.parentProfile);
  const [period, setPeriod] = useState<Period>('weekly');

  const { entries, loading, error, reload } = useLeaderboard(period);
  const currentParentId = parentProfile?.id ?? null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>{'< Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Family Leaderboard</Text>
      </View>

      {/* Period Selector */}
      <View style={styles.tabBar}>
        {(['weekly', 'monthly', 'allTime'] as Period[]).map((p) => (
          <PeriodTab
            key={p}
            period={p}
            active={period === p}
            onPress={() => setPeriod(p)}
          />
        ))}
      </View>

      {/* Leaderboard List */}
      <FlatList
        data={entries}
        refreshing={loading}
        onRefresh={reload}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <LeaderboardRow
            entry={item}
            rank={index + 1}
            isCurrentUser={item.id === currentParentId}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {loading ? 'Loading scores…' : error ?? 'No family profiles yet. Add a profile to get started.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.ink50,
  },
  header: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
  },
  backButton: {
    minHeight: layout.minTapTargetParent,
    justifyContent: 'center',
  },
  backText: {
    ...typography.label,
    color: colors.navy700,
  },
  heading: {
    ...typography.heading1,
    color: colors.navy900,
    marginTop: spacing[1],
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: layout.screenPadding,
    marginBottom: spacing[4],
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing[1],
    ...shadows.elevation1,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.navy900,
  },
  tabText: {
    ...typography.label,
    color: colors.ink400,
  },
  tabTextActive: {
    ...typography.label,
    color: colors.onAccent,
  },

  // List
  listContent: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: layout.tabBarHeight + spacing[4],
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[2],
    ...shadows.elevation1,
  },
  rowHighlighted: {
    borderWidth: 2,
    borderColor: colors.navy500,
  },
  rowWinner: {
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: colors.starGold,
  },

  rankContainer: {
    width: 36,
    alignItems: 'center',
  },
  rankText: {
    ...typography.heading2,
    color: colors.ink400,
  },
  crownIcon: {color:'#F7F5FF',
    fontSize: 24,
  },

  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.navy50,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  avatarEmoji: {color:'#F7F5FF',
    fontSize: 24,
  },

  nameContainer: {
    flex: 1,
  },
  nameText: {
    ...typography.heading3,
    color: colors.ink950,
  },
  roleText: {
    ...typography.caption,
    color: colors.ink400,
  },

  starsContainer: {
    marginLeft: spacing[2],
  },
  starsText: {
    ...typography.label,
    color: colors.starGold,
    fontSize: 15,
  },

  // Empty
  emptyContainer: {
    paddingVertical: spacing[10],
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body1,
    color: colors.ink400,
    textAlign: 'center',
  },
});
