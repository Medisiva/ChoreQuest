// Sprint 6 — P-06: Accountability Tab (Parent View)
// Child selector tabs, weekly/monthly progress, streak tracking,
// active consequences, 13-week grid, and consequence history.

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography, shadows, layout } from '../../../../src/constants/tokens';

// ── Placeholder types until Zustand stores are wired ──────────────────────────

interface Child {
  childId: string;
  displayName: string;
  avatarEmoji: string;
  weeklyTargetStars: number;
  monthlyTargetStars: number;
  currentStreakWeeks: number;
  consecutiveMissWeeks: number;
}

interface ActiveConsequence {
  consequenceId: string;
  childId: string;
  name: string;
  description: string;
  missLevel: number;
  periodType: 'weekly' | 'monthly';
  status: 'active' | 'done';
}

interface WeekLog {
  weekIndex: number;
  met: boolean | null; // null = future
  missLevel: number | null;
}

interface ConsequenceHistory {
  consequenceId: string;
  name: string;
  periodStart: string;
  missLevel: number;
}

// ── Mock data (replace with Zustand store subscriptions) ──────────────────────

const MOCK_CHILDREN: Child[] = [
  {
    childId: 'c1',
    displayName: 'Emma',
    avatarEmoji: '🦄',
    weeklyTargetStars: 20,
    monthlyTargetStars: 80,
    currentStreakWeeks: 3,
    consecutiveMissWeeks: 0,
  },
  {
    childId: 'c2',
    displayName: 'Liam',
    avatarEmoji: '🐉',
    weeklyTargetStars: 15,
    monthlyTargetStars: 60,
    currentStreakWeeks: 0,
    consecutiveMissWeeks: 1,
  },
];

const MOCK_WEEKLY_STARS: Record<string, number> = { c1: 14, c2: 8 };
const MOCK_MONTHLY_STARS: Record<string, number> = { c1: 52, c2: 30 };

const MOCK_CONSEQUENCES: ActiveConsequence[] = [
  {
    consequenceId: 'cons1',
    childId: 'c2',
    name: 'No screen time Wednesday',
    description: 'Missed weekly target — screen time paused for Wednesday.',
    missLevel: 1,
    periodType: 'weekly',
    status: 'active',
  },
];

function buildMockGrid(): WeekLog[] {
  const grid: WeekLog[] = [];
  for (let i = 0; i < 13; i++) {
    if (i < 10) {
      grid.push({ weekIndex: i, met: Math.random() > 0.3, missLevel: Math.random() > 0.7 ? 1 : null });
    } else {
      grid.push({ weekIndex: i, met: null, missLevel: null });
    }
  }
  return grid;
}

const MOCK_HISTORY: ConsequenceHistory[] = [
  { consequenceId: 'h1', name: 'No screen time Wednesday', periodStart: '2026-03-09', missLevel: 1 },
  { consequenceId: 'h2', name: 'Extra chore Saturday', periodStart: '2026-02-23', missLevel: 2 },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function ChildTabs({
  children,
  selectedId,
  onSelect,
}: {
  children: Child[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabRow}
    >
      {children.map((child) => {
        const active = child.childId === selectedId;
        return (
          <TouchableOpacity
            key={child.childId}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onSelect(child.childId)}
            activeOpacity={0.7}
          >
            <Text style={styles.tabEmoji}>{child.avatarEmoji}</Text>
            <Text style={[styles.tabName, active && styles.tabNameActive]}>
              {child.displayName}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function WeeklyTargetCard({ child, weeklyStars }: { child: Child; weeklyStars: number }) {
  const progress = Math.min(weeklyStars / Math.max(child.weeklyTargetStars, 1), 1);
  const met = weeklyStars >= child.weeklyTargetStars;
  const barColor = met ? colors.starGold : progress < 0.5 ? colors.warning : colors.navy500;

  return (
    <View style={[styles.card, styles.cardShadow]}>
      <Text style={styles.cardTitle}>Weekly Target</Text>
      <View style={styles.targetRow}>
        <Text style={styles.targetNumber}>{weeklyStars}</Text>
        <Text style={styles.targetSlash}>/</Text>
        <Text style={styles.targetNumber}>{child.weeklyTargetStars}</Text>
        <Text style={styles.targetUnit}>stars</Text>
        {met && <Text style={styles.metBadge}>Met!</Text>}
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${progress * 100}%`, backgroundColor: barColor },
          ]}
        />
      </View>
    </View>
  );
}

function MonthlyProgressCard({ child, monthlyStars }: { child: Child; monthlyStars: number }) {
  const progress = Math.min(monthlyStars / Math.max(child.monthlyTargetStars, 1), 1);
  const met = monthlyStars >= child.monthlyTargetStars;
  const barColor = met ? colors.starGold : colors.navy500;

  return (
    <View style={[styles.card, styles.cardShadow]}>
      <Text style={styles.cardTitle}>Monthly Progress</Text>
      <View style={styles.targetRow}>
        <Text style={styles.targetNumber}>{monthlyStars}</Text>
        <Text style={styles.targetSlash}>/</Text>
        <Text style={styles.targetNumber}>{child.monthlyTargetStars}</Text>
        <Text style={styles.targetUnit}>stars</Text>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${progress * 100}%`, backgroundColor: barColor },
          ]}
        />
      </View>
    </View>
  );
}

function StreakCard({ streakWeeks }: { streakWeeks: number }) {
  return (
    <View style={[styles.card, styles.cardShadow, styles.streakCard]}>
      <Text style={styles.streakEmoji}>🔥</Text>
      <View style={styles.streakInfo}>
        <Text style={styles.streakNumber}>{streakWeeks}</Text>
        <Text style={styles.streakLabel}>
          {streakWeeks === 1 ? 'week streak' : 'weeks streak'}
        </Text>
      </View>
    </View>
  );
}

function ActiveConsequenceCard({
  consequence,
  onMarkDone,
}: {
  consequence: ActiveConsequence;
  onMarkDone: (id: string) => void;
}) {
  const levelColors: Record<number, string> = {
    1: colors.warning,
    2: '#F97316', // orange
    3: colors.danger,
  };

  const borderColor = levelColors[consequence.missLevel] || colors.danger;

  return (
    <View style={[styles.card, styles.cardShadow, { borderLeftWidth: 4, borderLeftColor: borderColor }]}>
      <View style={styles.consequenceHeader}>
        <Text style={styles.consequenceTitle}>{consequence.name}</Text>
        <View style={[styles.levelBadge, { backgroundColor: borderColor }]}>
          <Text style={styles.levelBadgeText}>Level {consequence.missLevel}</Text>
        </View>
      </View>
      <Text style={styles.consequenceDesc}>{consequence.description}</Text>
      <TouchableOpacity
        style={styles.markDoneButton}
        onPress={() => onMarkDone(consequence.consequenceId)}
        activeOpacity={0.7}
      >
        <Text style={styles.markDoneText}>Mark as Done</Text>
      </TouchableOpacity>
    </View>
  );
}

function ThirteenWeekGrid({ weeks }: { weeks: WeekLog[] }) {
  return (
    <View style={[styles.card, styles.cardShadow]}>
      <Text style={styles.cardTitle}>13-Week Overview</Text>
      <View style={styles.gridRow}>
        {weeks.map((week) => {
          let bgColor = colors.ink400; // grey = future
          if (week.met === true) {
            bgColor = colors.success;
          } else if (week.met === false) {
            bgColor = week.missLevel && week.missLevel >= 2 ? colors.danger : colors.warning;
          }

          return (
            <View
              key={week.weekIndex}
              style={[styles.gridSquare, { backgroundColor: bgColor }]}
            />
          );
        })}
      </View>
      <View style={styles.legendRow}>
        <LegendDot color={colors.success} label="Met" />
        <LegendDot color={colors.danger} label="Missed" />
        <LegendDot color={colors.warning} label="Warning" />
        <LegendDot color={colors.ink400} label="Future" />
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function ConsequenceHistorySection({ history }: { history: ConsequenceHistory[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.card, styles.cardShadow]}>
      <Pressable
        style={styles.collapsibleHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={styles.cardTitle}>Consequence History</Text>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.historyList}>
          {history.length === 0 ? (
            <Text style={styles.emptyText}>No consequence history yet.</Text>
          ) : (
            history.map((item) => (
              <View key={item.consequenceId} style={styles.historyItem}>
                <View style={styles.historyDot} />
                <View style={styles.historyContent}>
                  <Text style={styles.historyName}>{item.name}</Text>
                  <Text style={styles.historyMeta}>
                    Week of {item.periodStart} — Level {item.missLevel}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function Accountability() {
  const [selectedChildId, setSelectedChildId] = useState(MOCK_CHILDREN[0]?.childId ?? '');
  const selectedChild = MOCK_CHILDREN.find((c) => c.childId === selectedChildId) ?? MOCK_CHILDREN[0];

  const weeklyStars = MOCK_WEEKLY_STARS[selectedChildId] ?? 0;
  const monthlyStars = MOCK_MONTHLY_STARS[selectedChildId] ?? 0;
  const childConsequences = MOCK_CONSEQUENCES.filter(
    (c) => c.childId === selectedChildId && c.status === 'active',
  );
  const weekGrid = buildMockGrid();

  const handleMarkDone = useCallback((consequenceId: string) => {
    // TODO: Wire to Firestore via service layer
    console.log('Mark consequence done:', consequenceId);
  }, []);

  if (!selectedChild) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyContainer}>
          <Text style={styles.heading}>Accountability</Text>
          <Text style={styles.emptyText}>No children in this family yet.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Accountability</Text>

        {/* Child selector tabs */}
        <ChildTabs
          children={MOCK_CHILDREN}
          selectedId={selectedChildId}
          onSelect={setSelectedChildId}
        />

        {/* Weekly target card with progress */}
        <WeeklyTargetCard child={selectedChild} weeklyStars={weeklyStars} />

        {/* Monthly progress */}
        <MonthlyProgressCard child={selectedChild} monthlyStars={monthlyStars} />

        {/* Streak card */}
        <StreakCard streakWeeks={selectedChild.currentStreakWeeks} />

        {/* Active consequences */}
        {childConsequences.map((cons) => (
          <ActiveConsequenceCard
            key={cons.consequenceId}
            consequence={cons}
            onMarkDone={handleMarkDone}
          />
        ))}

        {/* 13-week grid */}
        <ThirteenWeekGrid weeks={weekGrid} />

        {/* Consequence history (collapsible) */}
        <ConsequenceHistorySection history={MOCK_HISTORY} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: layout.screenPadding,
    paddingBottom: layout.tabBarHeight + spacing[4],
    gap: layout.cardGap,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: layout.screenPadding,
  },
  heading: {
    ...typography.heading1,
    color: colors.navy900,
    marginBottom: spacing[2],
  },

  // ── Child tabs ──
  tabRow: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingBottom: spacing[2],
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.navy50,
    minHeight: layout.minTapTargetParent,
  },
  tabActive: {
    backgroundColor: colors.navy900,
  },
  tabEmoji: {
    fontSize: 18,
    marginRight: spacing[2],
  },
  tabName: {
    ...typography.label,
    color: colors.navy900,
  },
  tabNameActive: {
    color: colors.white,
  },

  // ── Cards ──
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.navy50,
  },
  cardShadow: {
    ...shadows.elevation2,
  },
  cardTitle: {
    ...typography.heading3,
    color: colors.navy900,
    marginBottom: spacing[2],
  },

  // ── Target rows ──
  targetRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing[2],
  },
  targetNumber: {
    ...typography.heading1,
    color: colors.navy900,
  },
  targetSlash: {
    ...typography.heading2,
    color: colors.ink400,
    marginHorizontal: spacing[1],
  },
  targetUnit: {
    ...typography.body1,
    color: colors.ink600,
    marginLeft: spacing[1],
  },
  metBadge: {
    ...typography.label,
    color: colors.starGold,
    marginLeft: spacing[2],
  },

  // ── Progress bar ──
  progressTrack: {
    height: spacing[2],
    backgroundColor: colors.navy50,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
  },

  // ── Streak ──
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakEmoji: {
    fontSize: 32,
    marginRight: spacing[3],
  },
  streakInfo: {
    flex: 1,
  },
  streakNumber: {
    ...typography.heading1,
    color: colors.navy900,
  },
  streakLabel: {
    ...typography.body2,
    color: colors.ink600,
  },

  // ── Consequence ──
  consequenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  consequenceTitle: {
    ...typography.heading3,
    color: colors.ink950,
    flex: 1,
  },
  consequenceDesc: {
    ...typography.body2,
    color: colors.ink600,
    marginBottom: spacing[3],
  },
  levelBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
  },
  levelBadgeText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
  },
  markDoneButton: {
    backgroundColor: colors.success,
    borderRadius: radius.md,
    paddingVertical: spacing[2],
    alignItems: 'center',
    minHeight: layout.minTapTargetParent,
    justifyContent: 'center',
  },
  markDoneText: {
    ...typography.button,
    color: colors.white,
  },

  // ── 13-week grid ──
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1],
    marginBottom: spacing[2],
  },
  gridSquare: {
    width: spacing[6],
    height: spacing[6],
    borderRadius: radius.sm,
  },
  legendRow: {
    flexDirection: 'row',
    gap: spacing[4],
    marginTop: spacing[1],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  legendDot: {
    width: spacing[2],
    height: spacing[2],
    borderRadius: radius.full,
  },
  legendLabel: {
    ...typography.caption,
    color: colors.ink600,
  },

  // ── Consequence history ──
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chevron: {
    ...typography.body1,
    color: colors.ink400,
  },
  historyList: {
    marginTop: spacing[3],
    gap: spacing[3],
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  historyDot: {
    width: spacing[2],
    height: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.ink400,
    marginTop: spacing[1],
    marginRight: spacing[2],
  },
  historyContent: {
    flex: 1,
  },
  historyName: {
    ...typography.label,
    color: colors.ink950,
  },
  historyMeta: {
    ...typography.caption,
    color: colors.ink600,
    marginTop: 2,
  },
  emptyText: {
    ...typography.body2,
    color: colors.ink400,
    textAlign: 'center',
    marginTop: spacing[4],
  },
});
