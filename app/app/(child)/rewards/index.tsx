// S5: Child Reward Store (C-05)
// 2-column reward grid with type-colored headers. Affordable items show "Redeem",
// unaffordable show "Need X more stars". Confirmation bottom sheet before redeeming.
// "My Requests" section shows pending/approved/declined redemptions.

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useRewardStore } from '../../../src/stores/rewardStore';
import { useChildSessionStore } from '../../../src/stores/childSessionStore';
import { useFamilyStore } from '../../../src/stores/familyStore';
import { redeemReward } from '../../../src/services/stars';
import { colors, spacing, radius, typography, shadows, layout } from '../../../src/constants/tokens';
import type { Reward, Redemption, RewardType, RedemptionStatus } from '../../../src/types';

// ── Reward type color mapping ───────────────────────────────────────────────

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

export default function ChildRewardsScreen() {
  const { childRewards, redemptions, loading } = useRewardStore();
  const { activeChildId } = useChildSessionStore();
  const { family, children } = useFamilyStore();

  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  // Animation for star deduction preview
  const starScale = useSharedValue(1);

  const childProfile = useMemo(
    () => children.find((c) => c.id === activeChildId),
    [children, activeChildId]
  );

  const starBalance = childProfile?.starBalance ?? 0;

  const myRedemptions = useMemo(
    () =>
      redemptions
        .filter((r) => r.childProfileId === activeChildId)
        .sort((a, b) => b.requestedAt.toMillis() - a.requestedAt.toMillis()),
    [redemptions, activeChildId]
  );

  const pendingRedemptions = useMemo(
    () => myRedemptions.filter((r) => r.status === 'pending'),
    [myRedemptions]
  );

  const historyRedemptions = useMemo(
    () => myRedemptions.filter((r) => r.status !== 'pending'),
    [myRedemptions]
  );

  // Subscribe to rewards on mount
  useEffect(() => {
    if (!family?.id) return;
    const unsub = useRewardStore.getState().subscribeToRewards(family.id);
    return unsub;
  }, [family?.id]);

  const handleRedeemPress = useCallback((reward: Reward) => {
    setSelectedReward(reward);
    setShowConfirmSheet(true);
    starScale.value = 1;
  }, [starScale]);

  const handleConfirmRedeem = useCallback(async () => {
    if (!selectedReward || !family?.id || !activeChildId) return;

    setRedeeming(true);
    try {
      await redeemReward(
        family.id,
        activeChildId,
        selectedReward.id,
        selectedReward.starCost
      );

      // Animate star deduction preview
      starScale.value = withSequence(
        withTiming(1.3, { duration: 150, easing: Easing.out(Easing.back(2)) }),
        withTiming(1, { duration: 200 })
      );

      setShowConfirmSheet(false);
      setSelectedReward(null);
      Alert.alert('Request sent!', 'Your parent will review your reward request.');
    } catch (error) {
      console.error('[ChildRewards] Redeem error:', error);
      Alert.alert('Oops', 'Something went wrong. Try again!');
    } finally {
      setRedeeming(false);
    }
  }, [selectedReward, family?.id, activeChildId, starScale]);

  const starAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: starScale.value }],
  }));

  const getRewardName = useCallback(
    (rewardId: string): string => {
      const reward = childRewards.find((r) => r.id === rewardId);
      return reward?.name ?? 'Unknown Reward';
    },
    [childRewards]
  );

  // ── Render Functions ────────────────────────────────────────────────────────

  const renderRewardCard = useCallback(
    ({ item }: { item: Reward }) => {
      const canAfford = starBalance >= item.starCost;
      const deficit = item.starCost - starBalance;
      const typeColor = REWARD_TYPE_COLORS[item.rewardType] ?? colors.navy500;
      const typeIcon = REWARD_TYPE_ICONS[item.rewardType] ?? '🎁';

      return (
        <View style={styles.rewardCard}>
          <View style={[styles.rewardHeader, { backgroundColor: typeColor }]}>
            <Text style={styles.rewardTypeIcon}>{typeIcon}</Text>
            <Text style={styles.rewardTypeLabel}>{item.rewardType}</Text>
          </View>
          <View style={styles.rewardBody}>
            <Text style={styles.rewardName} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.rewardCost}>
              {'⭐ '}{item.starCost}
            </Text>
            {canAfford ? (
              <TouchableOpacity
                style={styles.redeemButton}
                onPress={() => handleRedeemPress(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.redeemButtonText}>Redeem</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.redeemButtonDisabled}>
                <Text style={styles.redeemButtonDisabledText}>
                  Need {deficit} more
                </Text>
              </View>
            )}
          </View>
        </View>
      );
    },
    [starBalance, handleRedeemPress]
  );

  const renderRedemptionRow = useCallback(
    (redemption: Redemption) => {
      const config = STATUS_CONFIG[redemption.status];
      const rewardName = getRewardName(redemption.rewardId);

      return (
        <View key={redemption.id} style={styles.redemptionRow}>
          <View style={styles.redemptionInfo}>
            <Text style={styles.redemptionName} numberOfLines={1}>
              {rewardName}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
              <Text style={[styles.statusBadgeText, { color: config.fg }]}>
                {config.label}
              </Text>
            </View>
          </View>
        </View>
      );
    },
    [getRewardName]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.softPurple} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Star Balance Hero */}
      <View style={styles.balanceHeader}>
        <Animated.View style={[styles.balanceChip, starAnimatedStyle]}>
          <Text style={styles.balanceStar}>{'⭐'}</Text>
          <Text style={styles.balanceAmount}>{starBalance}</Text>
        </Animated.View>
        <Text style={styles.balanceLabel}>Your Stars</Text>
      </View>

      {childRewards.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>{'🎁'}</Text>
          <Text style={styles.emptyText}>
            {"Your parent hasn't added any rewards yet"}
          </Text>
        </View>
      ) : (
        <FlashList
          data={childRewards}
          renderItem={renderRewardCard}
          estimatedItemSize={200}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            <View style={styles.footer}>
              {/* My Requests - Pending */}
              {pendingRedemptions.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{'⏳ Pending Requests'}</Text>
                  {pendingRedemptions.map(renderRedemptionRow)}
                </View>
              )}

              {/* My Requests - History */}
              {historyRedemptions.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{'📋 Past Requests'}</Text>
                  {historyRedemptions.map(renderRedemptionRow)}
                </View>
              )}
            </View>
          }
        />
      )}

      {/* Confirmation Bottom Sheet */}
      <Modal
        visible={showConfirmSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConfirmSheet(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setShowConfirmSheet(false)}
        >
          <View style={styles.sheetContainer}>
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Redeem Reward?</Text>

              {selectedReward && (
                <>
                  <Text style={styles.sheetRewardName}>{selectedReward.name}</Text>

                  <View style={styles.sheetStarRow}>
                    <Text style={styles.sheetStarLabel}>{'⭐ '}{starBalance}</Text>
                    <Text style={styles.sheetArrow}>{'→'}</Text>
                    <Text style={styles.sheetStarResult}>
                      {'⭐ '}{starBalance - selectedReward.starCost}
                    </Text>
                  </View>
                  <Text style={styles.sheetCostLabel}>
                    -{selectedReward.starCost} stars
                  </Text>

                  <Text style={styles.sheetNote}>
                    Your parent will review this request before stars are deducted.
                  </Text>

                  <TouchableOpacity
                    style={styles.sheetConfirmButton}
                    onPress={handleConfirmRedeem}
                    disabled={redeeming}
                    activeOpacity={0.7}
                  >
                    {redeeming ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.sheetConfirmText}>Send Request</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.sheetCancelButton}
                    onPress={() => setShowConfirmSheet(false)}
                  >
                    <Text style={styles.sheetCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.cloud,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[10],
  },
  // ── Balance Header ──────────────────────────────────────────────────────────
  balanceHeader: {
    alignItems: 'center',
    paddingVertical: spacing[5],
    paddingHorizontal: layout.screenPadding,
  },
  balanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cream,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: radius.xl,
    ...shadows.elevation2,
  },
  balanceStar: {
    fontSize: 28,
    marginRight: spacing[2],
  },
  balanceAmount: {
    ...typography.childDisplay,
    color: colors.ink950,
  },
  balanceLabel: {
    ...typography.childLabel,
    color: colors.ink600,
    marginTop: spacing[1],
  },
  // ── Reward Grid ─────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: spacing[3],
    paddingBottom: 120,
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
    fontSize: 16,
    marginRight: spacing[1],
  },
  rewardTypeLabel: {
    ...typography.childLabel,
    color: colors.white,
    fontSize: 11,
  },
  rewardBody: {
    padding: spacing[3],
  },
  rewardName: {
    ...typography.childHeading2,
    fontSize: 15,
    color: colors.ink950,
    marginBottom: spacing[1],
  },
  rewardCost: {
    ...typography.childHeading1,
    fontSize: 18,
    color: colors.starGold,
    marginBottom: spacing[3],
  },
  redeemButton: {
    backgroundColor: colors.softPurple,
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    alignItems: 'center',
  },
  redeemButtonText: {
    ...typography.childButton,
    fontSize: 14,
    color: colors.white,
  },
  redeemButtonDisabled: {
    backgroundColor: colors.ink50,
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    alignItems: 'center',
  },
  redeemButtonDisabledText: {
    ...typography.childLabel,
    fontSize: 12,
    color: colors.ink400,
  },
  // ── My Requests Section ─────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: spacing[1],
    paddingTop: spacing[6],
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    ...typography.childHeading2,
    fontSize: 18,
    color: colors.ink950,
    marginBottom: spacing[3],
    paddingHorizontal: spacing[1],
  },
  redemptionRow: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[2],
    ...shadows.elevation1,
  },
  redemptionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  redemptionName: {
    ...typography.childBody,
    color: colors.ink950,
    flex: 1,
    marginRight: spacing[2],
  },
  statusBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  statusBadgeText: {
    ...typography.childLabel,
    fontSize: 11,
  },
  // ── Empty State ─────────────────────────────────────────────────────────────
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing[4],
  },
  emptyText: {
    ...typography.childBody,
    color: colors.ink600,
    textAlign: 'center',
    lineHeight: 24,
  },
  // ── Confirmation Bottom Sheet ───────────────────────────────────────────────
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing[6],
    paddingBottom: spacing[10],
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.ink400,
    borderRadius: radius.full,
    alignSelf: 'center',
    marginBottom: spacing[5],
  },
  sheetTitle: {
    ...typography.childHeading1,
    color: colors.ink950,
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  sheetRewardName: {
    ...typography.childHeading2,
    color: colors.softPurple,
    textAlign: 'center',
    marginBottom: spacing[5],
  },
  sheetStarRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[2],
  },
  sheetStarLabel: {
    ...typography.childHeading1,
    color: colors.ink950,
  },
  sheetArrow: {
    ...typography.childHeading1,
    color: colors.ink400,
  },
  sheetStarResult: {
    ...typography.childHeading1,
    color: colors.coral,
  },
  sheetCostLabel: {
    ...typography.childLabel,
    color: colors.ink600,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  sheetNote: {
    ...typography.caption,
    color: colors.ink400,
    textAlign: 'center',
    marginBottom: spacing[5],
  },
  sheetConfirmButton: {
    backgroundColor: colors.softPurple,
    paddingVertical: spacing[4],
    borderRadius: radius.lg,
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  sheetConfirmText: {
    ...typography.childButton,
    color: colors.white,
  },
  sheetCancelButton: {
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  sheetCancelText: {
    ...typography.childButton,
    color: colors.ink400,
  },
});
