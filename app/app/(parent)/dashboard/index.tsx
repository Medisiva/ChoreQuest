import { questRewardLabel } from '@/services/questPresentation';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useEffect } from 'react';
import PlaygroundHero from '@/components/shared/PlaygroundHero';
import KidAvatar from '@/components/shared/KidAvatar';
// P-01: Parent Dashboard
import { useFamilyEarnings } from '@/hooks/useFamilyEarnings';
import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTaskStore } from '@/stores/taskStore';
import { useFamilyStore } from '@/stores/familyStore';
import { useAuthStore } from '@/stores/authStore';
import { useRequestStore } from '@/stores/requestStore';
import { colors, typography, spacing, radius, layout, shadows } from '@/constants/tokens';
import type { Task, TaskClaim, ChildProfile, FamilyRequest } from '@/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function childName(id: string, children: ChildProfile[]): string {
  return children.find((c) => c.id === id)?.nickname ?? 'Child';
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ParentDashboard() {
  const router = useRouter();
  const [pendingRewardCount,setPendingRewardCount]=useState(0);

  const { parentProfile } = useAuthStore();
  const { family, children } = useFamilyStore();
  const { tasks, claims } = useTaskStore();
  const { requests } = useRequestStore();

  const earnings = useFamilyEarnings(family?.id, family?.timezone ?? 'UTC');

  // Derived data
  const activeTasks = useMemo(() => tasks.filter(task=>task.isActive && (!task.templateOnly || claims.some(claim=>claim.taskId===task.id && ['claimed','submitted','rejected'].includes(claim.status)))), [tasks,claims]);

  useEffect(()=>{if(!family){setPendingRewardCount(0);return;}return onSnapshot(query(collection(db,'families',family.id,'redemptions'),where('status','==','pending')),snapshot=>setPendingRewardCount(snapshot.size),()=>setPendingRewardCount(0));},[family?.id]);
  const pendingApprovals = useMemo(
    () => claims.filter((c) => c.status === 'submitted'),
    [claims]
  );

  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === 'pending'),
    [requests]
  );

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

    });

    earnings.records.filter(record => record.deltaStars > 0 && isToday(record.createdAt)).forEach(record => items.push({label: `${childName(record.childProfileId, children)}: ${record.reason ?? 'Stars earned'} (+${record.deltaStars} stars)`, time: record.createdAt.toDate()}));
    items.sort((a, b) => b.time.getTime() - a.time.getTime());
    return items;
  }, [claims, tasks, children, earnings.records]);

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
        <PlaygroundHero title={`Hi, ${parentDisplayName}!`} subtitle={`${familyDisplayName} · Make room for little wins today.`} compact />
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
            value={earnings.loading ? '…' : earnings.error ? '—' : earnings.weekly}
            bg={colors.cream}
            textColor={colors.starGold}
          />
        </View>

        {earnings.error && <Text style={{color:'#F7F5FF'}} accessibilityRole="alert">{earnings.error}</Text>}
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
                const weeklyEarned = earnings.weeklyByChild[child.id] ?? 0;

                const target = child.weeklyTargetStars || 1;
                const progress = Math.min(weeklyEarned / target, 1);

                return (
                  <TouchableOpacity
                    key={child.id}
                    style={styles.childCard}
                    activeOpacity={0.7}
                    onPress={() =>
                      router.push('/(parent)/accountability')
                    }
                  >
                    <View style={styles.childAvatar}>
                      <KidAvatar avatarId={child.avatarId} size={56} />
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
                onReview={()=>router.push('/(parent)/approvals')}
              />
            ))}
          </View>
        )}

        {claims.some(claim=>claim.status==='awardFailed') && <View style={styles.section}><Text style={{color:'#F7F5FF'}} accessibilityRole="alert">A quest reward needs attention. The affected quest was retired and the child can choose another. Create a corrected quest to continue.</Text></View>}
        {pendingRewardCount>0 && <TouchableOpacity accessibilityRole="button" onPress={()=>router.push('/(parent)/rewards')} style={styles.miniCard}><Text style={{color:'#F7F5FF'}}>{pendingRewardCount} reward request{pendingRewardCount===1?'':'s'} waiting</Text><Text style={{color:'#F7F5FF'}}>Review rewards →</Text></TouchableOpacity>}
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
  value: number | string;
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
  onReview,
}: {
  claim: TaskClaim;
  tasks: Task[];
  onReview: () => void;
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
          {childName(claim.childProfileId, childList)} · {task ? questRewardLabel(task) : 'Reward unavailable'}
        </Text>
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Review pending quest" onPress={onReview} style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>Review</Text></TouchableOpacity>
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
    color: colors.onAccent,
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
  statValue: {color:'#F7F5FF',
    ...typography.heading2,
    marginBottom: spacing[1],
  },
  statLabel: {color:'#F7F5FF',
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
    backgroundColor: colors.surface,
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
    backgroundColor: colors.surface,
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
    backgroundColor: colors.surface,
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
    backgroundColor: colors.surface,
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
    color: colors.onAccent,
  },
  fabSecondary: {
    flex: 1,
    backgroundColor: colors.surface,
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
