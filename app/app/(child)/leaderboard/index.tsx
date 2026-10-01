// C-08: Child Leaderboard Screen
// Family leaderboard: parents AND kids compete on the SAME board.
// Period selector: Weekly | Monthly | All Time.
// Uses Nunito fonts (child mode), starGold accent.

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
import { useChildSessionStore } from '@/stores/childSessionStore';
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

export default function ChildLeaderboard() {
  const router = useRouter();
  const activeChildId = useChildSessionStore((s) => s.activeChildId);
  const [period, setPeriod] = useState<Period>('weekly');

  const { entries, loading, error, reload } = useLeaderboard(period);

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
            isCurrentUser={item.id === activeChildId}
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
    backgroundColor: colors.cloud,
  },
  header: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
  },
  backButton: {
    minHeight: layout.minTapTarget,
    justifyContent: 'center',
  },
  backText: {
    ...typography.childLabel,
    color: colors.navy700,
  },
  heading: {
    ...typography.childHeading1,
    color: colors.navy900,
    marginTop: spacing[1],
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: layout.screenPadding,
    marginBottom: spacing[4],
    backgroundColor: colors.white,
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
    backgroundColor: colors.starGold,
  },
  tabText: {
    ...typography.childLabel,
    color: colors.ink400,
  },
  tabTextActive: {
    color: colors.white,
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
    backgroundColor: colors.white,
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
    ...typography.childHeading2,
    color: colors.ink400,
  },
  crownIcon: {
    fontSize: 24,
  },

  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.cloud,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  avatarEmoji: {
    fontSize: 28,
  },

  nameContainer: {
    flex: 1,
  },
  nameText: {
    ...typography.childHeading2,
    color: colors.ink950,
    fontSize: 18,
  },
  roleText: {
    ...typography.caption,
    color: colors.ink400,
  },

  starsContainer: {
    marginLeft: spacing[2],
  },
  starsText: {
    ...typography.childLabel,
    color: colors.starGold,
    fontSize: 16,
  },

  // Empty
  emptyContainer: {
    paddingVertical: spacing[10],
    alignItems: 'center',
  },
  emptyText: {
    ...typography.childBody,
    color: colors.ink400,
    textAlign: 'center',
  },
});
