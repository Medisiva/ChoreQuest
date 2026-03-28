// S5: Parent Reward Store (P-10)
// 2-column reward grid with name, star cost, creator, and "Redeem" button.
// "+Add reward" card at end. Pending kid-added rewards section with approve/decline.
// Collapsible redemption history at bottom.

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useRewardStore } from '../../../src/stores/rewardStore';
import { useFamilyStore } from '../../../src/stores/familyStore';
import { approveRedemption, declineRedemption } from '../../../src/services/stars';
import { colors, spacing, radius, typography, shadows, layout } from '../../../src/constants/tokens';
import type { Reward, ParentReward, Redemption, RewardType, RedemptionStatus } from '../../../src/types';

const REWARD_TYPE_COLORS: Record<RewardType, string> = {
  ScreenTime: colors.navy500,
  Gift: colors.softPurple,
  GiftCard: colors.softPurple,
  Money: '#0D7377',
  Special: '#B85C00',
};

const REWARD_TYPE_ICONS: Record<RewardType, string> = {
  ScreenTime: '📱',
  Gift: '🎁',
  GiftCard: '💳',
  Money: '💰',
  Special: '🌟',
};

const STATUS_CONFIG: Record<RedemptionStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: 'Pending', bg: colors.warningLight, fg: colors.warning },
  approved: { label: 'Approved', bg: colors.successLight, fg: colors.success },
  declined: { label: 'Declined', bg: colors.dangerLight, fg: colors.danger },
  redeemed: { label: 'Redeemed', bg: colors.successLight, fg: colors.success },
};

// Placeholder type for FlashList grid items
type GridItem = Reward | { id: 'add-new'; type: 'add' };

export default function ParentRewardsScreen() {
  const router = useRouter();
  const { childRewards, parentRewards, redemptions, loading } = useRewardStore();
  const { family, children, parentProfile } = useFamilyStore();

  const [showHistory, setShowHistory] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const starBalance = parentProfile?.starBalance ?? 0;

  // Subscribe on mount
  useEffect(() => {
    if (!family?.id) return;
    const unsub = useRewardStore.getState().subscribeToRewards(family.id);
    return unsub;
  }, [family?.id]);

  // Pending redemptions that need parent action
  const pendingRedemptions = useMemo(
    () => redemptions.filter((r) => r.status === 'pending'),
    [redemptions]
  );

  // Redemption history (non-pending)
  const redemptionHistory = useMemo(
    () =>
      redemptions
        .filter((r) => r.status !== 'pending')
        .sort((a, b) => (b.approvedAt?.toMillis() ?? b.requestedAt.toMillis()) - (a.approvedAt?.toMillis() ?? a.requestedAt.toMillis())),
    [redemptions]
  );

  // Pending kid-added parent rewards awaiting approval
  const pendingKidRewards = useMemo(
    () => parentRewards.filter((r) => r.addedBy === 'child' && !r.approvedByParent),
    [parentRewards]
  );

  // Grid data: all child rewards + add-new card
  const gridData: GridItem[] = useMemo(
    () => [...childRewards, { id: 'add-new', type: 'add' } as GridItem],
    [childRewards]
  );

  const getChildName = useCallback(
    (childId: string): string => {
      const child = children.find((c) => c.id === childId);
      return child?.nickname ?? 'Unknown';
    },
    [children]
  );

  const getRewardName = useCallback(
    (rewardId: string): string => {
      const reward = childRewards.find((r) => r.id === rewardId);
      return reward?.name ?? 'Unknown Reward';
    },
    [childRewards]
  );

  const getRewardCost = useCallback(
    (rewardId: string): number => {
      const reward = childRewards.find((r) => r.id === rewardId);
      return reward?.starCost ?? 0;
    },
    [childRewards]
  );

  const handleApproveRedemption = useCallback(
    async (redemption: Redemption) => {
      if (!family?.id) return;
      setProcessingId(redemption.id);
      try {
        const cost = getRewardCost(redemption.rewardId);
        await approveRedemption(family.id, redemption.id, redemption.childProfileId, cost);
        Alert.alert('Approved', 'Stars have been deducted and the reward is granted.');
      } catch (error: unknown) {
        const err = error as { code?: string };
        if (err.code === 'INSUFFICIENT_STARS') {
          Alert.alert('Cannot Approve', 'This child no longer has enough stars.');
        } else {
          Alert.alert('Error', 'Something went wrong. Try again.');
        }
      } finally {
        setProcessingId(null);
      }
    },
    [family?.id, getRewardCost]
  );

  const handleDeclineRedemption = useCallback(
    async (redemptionId: string) => {
      if (!family?.id) return;
      setProcessingId(redemptionId);
      try {
        await declineRedemption(family.id, redemptionId);
      } catch {
        Alert.alert('Error', 'Something went wrong. Try again.');
      } finally {
        setProcessingId(null);
      }
    },
    [family?.id]
  );

  const renderGridItem = useCallback(
    ({ item }: { item: GridItem }) => {
      if ('type' in item && item.type === 'add') {
        return (
          <TouchableOpacity
            style={styles.addCard}
            activeOpacity={0.7}
            onPress={() => {
              // Navigate to add reward screen (to be built)
              Alert.alert('Coming Soon', 'Add Reward form is under construction.');
            }}
          >
            <Text style={styles.addCardIcon}>+</Text>
            <Text style={styles.addCardText}>Add Reward</Text>
          </TouchableOpacity>
        );
      }

      const reward = item as Reward;
      const typeColor = REWARD_TYPE_COLORS[reward.rewardType] ?? colors.navy500;
      const typeIcon = REWARD_TYPE_ICONS[reward.rewardType] ?? '🎁';

      return (
        <View style={styles.rewardCard}>
          <View style={[styles.rewardHeader, { backgroundColor: typeColor }]}>
            <Text style={styles.rewardTypeIcon}>{typeIcon}</Text>
            <Text style={styles.rewardTypeLabel}>{reward.rewardType}</Text>
          </View>
          <View style={styles.rewardBody}>
            <Text style={styles.rewardName} numberOfLines={2}>
              {reward.name}
            </Text>
            <Text style={styles.rewardCost}>
              {'⭐ '}{reward.starCost}
            </Text>
            <Text style={styles.rewardCreator}>
              Added by parent
            </Text>
          </View>
        </View>
      );
    },
    []
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.navy500} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Header with balance chip */}
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Reward Store</Text>
          <View style={styles.balanceChip}>
            <Text style={styles.balanceStar}>{'⭐'}</Text>
            <Text style={styles.balanceAmount}>{starBalance}</Text>
          </View>
        </View>

        {/* Reward Grid */}
        <View style={styles.gridContainer}>
          <FlashList
            data={gridData}
            renderItem={renderGridItem}
            estimatedItemSize={180}
            numColumns={2}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>

        {/* Pending Kid-Added Rewards */}
        {pendingKidRewards.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kid-Suggested Rewards</Text>
            {pendingKidRewards.map((reward) => (
              <View key={reward.id} style={styles.pendingCard}>
                <View style={styles.pendingInfo}>
                  <Text style={styles.pendingName}>{reward.name}</Text>
                  <Text style={styles.pendingCost}>{'⭐ '}{reward.starCost}</Text>
                </View>
                <View style={styles.pendingActions}>
                  <TouchableOpacity style={styles.approveBtn}>
                    <Text style={styles.approveBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.declineBtn}>
                    <Text style={styles.declineBtnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Pending Redemption Requests */}
        {pendingRedemptions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Redemption Requests ({pendingRedemptions.length})
            </Text>
            {pendingRedemptions.map((r) => (
              <View key={r.id} style={styles.pendingCard}>
                <View style={styles.pendingInfo}>
                  <Text style={styles.pendingName}>{getRewardName(r.rewardId)}</Text>
                  <Text style={styles.pendingChild}>
                    from {getChildName(r.childProfileId)}
                  </Text>
                </View>
                <View style={styles.pendingActions}>
                  {processingId === r.id ? (
                    <ActivityIndicator size="small" color={colors.navy500} />
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.approveBtn}
                        onPress={() => handleApproveRedemption(r)}
                      >
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.declineBtn}
                        onPress={() => handleDeclineRedemption(r.id)}
                      >
                        <Text style={styles.declineBtnText}>Decline</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Redemption History (Collapsible) */}
        {redemptionHistory.length > 0 && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.collapseHeader}
              onPress={() => setShowHistory(!showHistory)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>Redemption History</Text>
              <Text style={styles.collapseArrow}>
                {showHistory ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>
            {showHistory &&
              redemptionHistory.map((r) => {
                const config = STATUS_CONFIG[r.status];
                return (
                  <View key={r.id} style={styles.historyRow}>
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyName}>
                        {getRewardName(r.rewardId)}
                      </Text>
                      <Text style={styles.historyChild}>
                        {getChildName(r.childProfileId)}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: config.fg }]}>
                        {config.label}
                      </Text>
                    </View>
                  </View>
                );
              })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.white,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  // ── Header ──────────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing[4],
  },
  heading: {
    ...typography.heading1,
    color: colors.navy900,
  },
  balanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cream,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    ...shadows.elevation1,
  },
  balanceStar: {
    fontSize: 16,
    marginRight: spacing[1],
  },
  balanceAmount: {
    ...typography.heading3,
    color: colors.ink950,
  },
  // ── Reward Grid ─────────────────────────────────────────────────────────────
  gridContainer: {
    minHeight: 200,
    paddingHorizontal: spacing[3],
  },
  rewardCard: {
    flex: 1,
    margin: spacing[1],
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    overflow: 'hidden',
    ...shadows.elevation2,
  },
  rewardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  rewardTypeIcon: {
    fontSize: 14,
    marginRight: spacing[1],
  },
  rewardTypeLabel: {
    ...typography.label,
    color: colors.white,
    fontSize: 11,
  },
  rewardBody: {
    padding: spacing[3],
  },
  rewardName: {
    ...typography.heading3,
    fontSize: 14,
    color: colors.ink950,
    marginBottom: spacing[1],
  },
  rewardCost: {
    ...typography.heading2,
    fontSize: 16,
    color: colors.starGold,
    marginBottom: spacing[1],
  },
  rewardCreator: {
    ...typography.caption,
    color: colors.ink400,
  },
  // ── Add Card ────────────────────────────────────────────────────────────────
  addCard: {
    flex: 1,
    margin: spacing[1],
    borderRadius: radius.lg,
    backgroundColor: colors.ink50,
    borderWidth: 2,
    borderColor: colors.ink400,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 160,
  },
  addCardIcon: {
    fontSize: 36,
    color: colors.ink400,
    marginBottom: spacing[2],
  },
  addCardText: {
    ...typography.label,
    color: colors.ink600,
  },
  // ── Sections ────────────────────────────────────────────────────────────────
  section: {
    paddingHorizontal: layout.screenPadding,
    marginTop: spacing[6],
  },
  sectionTitle: {
    ...typography.heading3,
    color: colors.ink950,
    marginBottom: spacing[3],
  },
  // ── Pending Cards ───────────────────────────────────────────────────────────
  pendingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[2],
    ...shadows.elevation1,
  },
  pendingInfo: {
    flex: 1,
    marginRight: spacing[3],
  },
  pendingName: {
    ...typography.body1,
    color: colors.ink950,
    fontFamily: 'Inter_600SemiBold',
  },
  pendingCost: {
    ...typography.body2,
    color: colors.starGold,
    marginTop: spacing[1],
  },
  pendingChild: {
    ...typography.caption,
    color: colors.ink600,
    marginTop: spacing[1],
  },
  pendingActions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  approveBtn: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
  },
  approveBtnText: {
    ...typography.label,
    color: colors.white,
  },
  declineBtn: {
    backgroundColor: colors.dangerLight,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
  },
  declineBtnText: {
    ...typography.label,
    color: colors.danger,
  },
  // ── Collapsible History ─────────────────────────────────────────────────────
  collapseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  collapseArrow: {
    ...typography.body1,
    color: colors.ink400,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.ink50,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[2],
  },
  historyInfo: {
    flex: 1,
    marginRight: spacing[3],
  },
  historyName: {
    ...typography.body2,
    color: colors.ink950,
    fontFamily: 'Inter_500Medium',
  },
  historyChild: {
    ...typography.caption,
    color: colors.ink600,
    marginTop: spacing[1],
  },
  statusBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  statusBadgeText: {
    ...typography.label,
    fontSize: 11,
  },
});
