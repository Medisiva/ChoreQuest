// P-01: Parent Dashboard
import { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTaskStore } from '../../../../src/stores/taskStore';
import { useFamilyStore } from '../../../../src/stores/familyStore';
import { useAuthStore } from '../../../../src/stores/authStore';
import { useRequestStore } from '../../../../src/stores/requestStore';
import { colors, typography, spacing, radius, layout, shadows } from '../../../../src/constants/tokens';
import type { TaskClaim, ChildProfile, FamilyRequest } from '../../../../src/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function isToday(timestamp: { toDate: () => Date } | undefined): boolean {
  if (!timestamp) return false;
  const d = timestamp.toDate();
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isThisWeek(timestamp: { toDate: () => Date } | undefined): boolean {
  if (!timestamp) return false;
  const d = timestamp.toDate();
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  return d >= startOfWeek;
}

function childName(id: string, children: ChildProfile[]): string {
  return children.find((c) => c.id === id)?.nickname ?? 'Child';
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ParentDashboard() {
  const router = useRouter();
  const { parentProfile } = useAuthStore();
  const { family, children } = useFamilyStore();
  const { tasks, claims } = useTaskStore();
  const { requests } = useRequestStore();

  // Derived data
  const activeTasks = useMemo(() => tasks.filter((t) => t.isActive), [tasks]);

  const pendingApprovals = useMemo(
    () => claims.filter((c) => c.status === 'submitted'),
    [claims]
  );

  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === 'pending'),
    [requests]
  );

  const starsThisWeek = useMemo(() => {
    return claims
      .filter((c) => c.status === 'approved' && isThisWeek(c.approvedAt))
      .reduce((sum, c) => {
        const task = tasks.find((t) => t.id === c.taskId);
        return sum + (task?.starValue ?? 0);
      }, 0);
  }, [claims, tasks]);

  const todayActivity = useMemo(() => {
    const items: { label: string; time: Date }[] = [];

    claims.forEach((c) => {
      if (c.status === 'submitted' && isToday(c.submittedAt)) {
        const task = tasks.find((t) => t.id === c.taskId);
        items.push({
          label: `${childName(c.childProfileId, children)} submitted "${task?.title ?? 'a quest'}"`,
          time: c.submittedAt!.toDate(),
        });
      }
      if (c.status === 'approved' && isToday(c.approvedAt)) {
        const task = tasks.find((t) => t.id === c.taskId);
        items.push({
          label: `"${task?.title ?? 'A quest'}" approved (+${task?.starValue ?? 0} stars)`,
          time: c.approvedAt!.toDate(),
        });
      }
    });

    items.sort((a, b) => b.time.getTime() - a.time.getTime());
    return items;
  }, [claims, tasks, children]);

  const parentDisplayName = parentProfile?.displayName ?? 'Parent';
  const familyDisplayName = family?.familyName ?? 'Family';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>
              Good {getGreeting()}, {parentDisplayName}!
            </Text>
            <Text style={styles.familySubtitle}>{familyDisplayName}</Text>
          </View>
          <View style={styles.starChip}>
            <Text style={styles.starEmoji}>⭐</Text>
            <Text style={styles.starChipText}>
              {parentProfile?.starBalance ?? 0}
            </Text>
          </View>
        </View>

        {/* ── Quick Stats ─────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard
            label="Active Quests"
            value={activeTasks.length}
            bg={colors.navy50}
            textColor={colors.navy900}
          />
          <StatCard
            label="Pending Approvals"
            value={pendingApprovals.length}
            bg={colors.warningLight}
            textColor={colors.warning}
          />
          <StatCard
            label="Pending Requests"
            value={pendingRequests.length}
            bg={colors.navy50}
            textColor={colors.navy900}
          />
          <StatCard
            label="Stars This Week"
            value={starsThisWeek}
            bg={colors.starGold}
            textColor={colors.ink950}
          />
        </View>

        {/* ── Today's Activity ────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Activity</Text>
          {todayActivity.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Nothing yet today</Text>
            </View>
          ) : (
            todayActivity.map((item, i) => (
              <View key={i} style={styles.activityRow}>
                <View style={styles.activityDot} />
                <Text style={styles.activityText} numberOfLines={2}>
                  {item.label}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* ── Children Overview ───────────────────────────────────── */}
        {children.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Children Overview</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.childrenRow}
            >
              {children.map((child) => {
                const weeklyEarned = claims
                  .filter(
                    (c) =>
                      c.childProfileId === child.id &&
                      c.status === 'approved' &&
                      isThisWeek(c.approvedAt)
                  )
                  .reduce((sum, c) => {
                    const task = tasks.find((t) => t.id === c.taskId);
                    return sum + (task?.starValue ?? 0);
                  }, 0);

                const target = child.weeklyTargetStars || 1;
                const progress = Math.min(weeklyEarned / target, 1);

                return (
                  <TouchableOpacity
                    key={child.id}
                    style={styles.childCard}
                    activeOpacity={0.7}
                    onPress={() =>
                      router.push(`/(parent)/children/${child.id}` as never)
                    }
                  >
                    <View style={styles.childAvatar}>
                      <Text style={styles.childAvatarText}>
                        {child.nickname.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.childName} numberOfLines={1}>
                      {child.nickname}
                      {child.currentStreakWeeks > 0 ? ' 🔥' : ''}
                    </Text>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${Math.round(progress * 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressLabel}>
                      {weeklyEarned}/{target} stars
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Pending Approvals Preview ───────────────────────────── */}
        {pendingApprovals.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pending Approvals</Text>
              <TouchableOpacity
                onPress={() => router.push('/(parent)/approvals' as never)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.seeAll}>See all →</Text>
              </TouchableOpacity>
            </View>
            {pendingApprovals.slice(0, 3).map((claim) => (
              <ApprovalMiniCard
                key={claim.id}
                claim={claim}
                tasks={tasks}
                children={children}
              />
            ))}
          </View>
        )}

        {/* ── Pending Requests Preview ────────────────────────────── */}
        {pendingRequests.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pending Requests</Text>
              <TouchableOpacity
                onPress={() => router.push('/(parent)/requests' as never)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.seeAll}>See all →</Text>
              </TouchableOpacity>
            </View>
            {pendingRequests.slice(0, 3).map((req) => (
              <RequestMiniCard
                key={req.id}
                request={req}
                children={children}
              />
            ))}
          </View>
        )}

        {/* Bottom spacing for FAB */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Quick Actions FAB Row ─────────────────────────────────── */}
      <View style={styles.fabRow}>
        <TouchableOpacity
          style={styles.fabPrimary}
          activeOpacity={0.8}
          onPress={() => router.push('/(parent)/tasks/create' as never)}
        >
          <Text style={styles.fabPrimaryText}>+ New Quest</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fabSecondary}
          activeOpacity={0.8}
          onPress={() => router.push('/(parent)/tasks/library' as never)}
        >
          <Text style={styles.fabSecondaryText}>Library</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  bg,
  textColor,
}: {
  label: string;
  value: number;
  bg: string;
  textColor: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <Text style={[styles.statValue, { color: textColor }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: textColor }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function ApprovalMiniCard({
  claim,
  tasks: taskList,
  children: childList,
}: {
  claim: TaskClaim;
  tasks: { id: string; title: string; starValue: number }[];
  children: ChildProfile[];
}) {
  const task = taskList.find((t) => t.id === claim.taskId);
  return (
    <View style={styles.miniCard}>
      <View style={styles.miniCardLeft}>
        <Text style={styles.miniCardTitle} numberOfLines={1}>
          {task?.title ?? 'Unknown Quest'}
        </Text>
        <Text style={styles.miniCardSub}>
          {childName(claim.childProfileId, childList)} · {task?.starValue ?? 0}{' '}
          stars
        </Text>
      </View>
      <View style={styles.pendingBadge}>
        <Text style={styles.pendingBadgeText}>Review</Text>
      </View>
    </View>
  );
}

function RequestMiniCard({
  request,
  children: childList,
}: {
  request: FamilyRequest;
  children: ChildProfile[];
}) {
  return (
    <View style={styles.miniCard}>
      <View style={styles.miniCardLeft}>
        <Text style={styles.miniCardTitle} numberOfLines={1}>
          {request.title}
        </Text>
        <Text style={styles.miniCardSub}>
          {childName(request.requestedByChildId, childList)} ·{' '}
          {request.suggestedStars} stars
        </Text>
      </View>
      <View style={styles.acceptBadge}>
        <Text style={styles.acceptBadgeText}>Pending</Text>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.ink50,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing[4],
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[6],
  },
  headerText: {
    flex: 1,
    marginRight: spacing[3],
  },
  greeting: {
    ...typography.heading1,
    color: colors.navy900,
  },
  familySubtitle: {
    ...typography.body2,
    color: colors.ink600,
    marginTop: spacing[1],
  },
  starChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.starGold,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  starEmoji: {
    fontSize: 14,
    marginRight: spacing[1],
  },
  starChipText: {
    ...typography.label,
    color: colors.ink950,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[6],
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: spacing[3],
    borderRadius: radius.md,
    alignItems: 'center',
    ...shadows.elevation1,
  },
  statValue: {
    ...typography.heading2,
    marginBottom: spacing[1],
  },
  statLabel: {
    ...typography.caption,
    textAlign: 'center',
  },

  // Sections
  section: {
    marginBottom: spacing[6],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  sectionTitle: {
    ...typography.heading3,
    color: colors.ink950,
    marginBottom: spacing[3],
  },
  seeAll: {
    ...typography.label,
    color: colors.navy700,
    marginBottom: spacing[3],
  },

  // Today's activity
  emptyCard: {
    backgroundColor: colors.white,
    padding: spacing[4],
    borderRadius: radius.md,
    alignItems: 'center',
    ...shadows.elevation1,
  },
  emptyText: {
    ...typography.body2,
    color: colors.ink400,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing[3],
    borderRadius: radius.md,
    marginBottom: spacing[2],
    ...shadows.elevation1,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.navy500,
    marginRight: spacing[3],
  },
  activityText: {
    ...typography.body2,
    color: colors.ink950,
    flex: 1,
  },

  // Children overview
  childrenRow: {
    gap: spacing[3],
    paddingVertical: spacing[1],
  },
  childCard: {
    width: 140,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing[3],
    alignItems: 'center',
    ...shadows.elevation2,
  },
  childAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.navy50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  childAvatarText: {
    ...typography.heading3,
    color: colors.navy900,
  },
  childName: {
    ...typography.label,
    color: colors.ink950,
    marginBottom: spacing[2],
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: colors.navy50,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginBottom: spacing[1],
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: radius.full,
  },
  progressLabel: {
    ...typography.caption,
    color: colors.ink600,
  },

  // Mini cards
  miniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing[3],
    borderRadius: radius.md,
    marginBottom: spacing[2],
    ...shadows.elevation1,
  },
  miniCardLeft: {
    flex: 1,
    marginRight: spacing[3],
  },
  miniCardTitle: {
    ...typography.body1,
    color: colors.ink950,
  },
  miniCardSub: {
    ...typography.caption,
    color: colors.ink600,
    marginTop: spacing[1],
  },
  pendingBadge: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  pendingBadgeText: {
    ...typography.caption,
    color: colors.warning,
    fontFamily: 'Inter_600SemiBold',
  },
  acceptBadge: {
    backgroundColor: colors.navy50,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  acceptBadgeText: {
    ...typography.caption,
    color: colors.navy900,
    fontFamily: 'Inter_600SemiBold',
  },

  // FAB row
  fabRow: {
    position: 'absolute',
    bottom: spacing[8],
    left: layout.screenPadding,
    right: layout.screenPadding,
    flexDirection: 'row',
    gap: spacing[3],
  },
  fabPrimary: {
    flex: 1,
    backgroundColor: colors.navy900,
    paddingVertical: spacing[4],
    borderRadius: radius.lg,
    alignItems: 'center',
    ...shadows.elevation3,
  },
  fabPrimaryText: {
    ...typography.button,
    color: colors.white,
  },
  fabSecondary: {
    flex: 1,
    backgroundColor: colors.white,
    paddingVertical: spacing[4],
    borderRadius: radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.navy900,
    ...shadows.elevation2,
  },
  fabSecondaryText: {
    ...typography.button,
    color: colors.navy900,
  },
});
