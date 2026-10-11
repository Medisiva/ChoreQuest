import { earnedInPeriod } from '@/utils/leaderboard';
// S5: Parent Wallet (P-09)
// Large star balance hero, weekly/monthly/all-time earnings breakdown,
// chronological transaction list, and "Browse your reward store" CTA.

import { useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { useState } from 'react';
import { db } from '@/services/firebase';
import { useFamilyStore } from '@/stores/familyStore';
import { colors, spacing, radius, typography, shadows, layout } from '@/constants/tokens';
import type { ParentStarTransaction, TransactionType } from '@/types';

const TXN_TYPE_LABELS: Record<TransactionType, string> = {
  taskApproval: 'Task completed',
  bonusStar: 'Bonus stars',
  deduction: 'Star deduction',
  redemption: 'Reward redeemed',
  streakBonus: 'Streak bonus',
};

const TXN_TYPE_ICONS: Record<TransactionType, string> = {
  taskApproval: '✅',
  bonusStar: '🌟',
  deduction: '📉',
  redemption: '🎁',
  streakBonus: '🔥',
};

export default function ParentWalletScreen() {
  const router = useRouter();
  const { family, parentProfile } = useFamilyStore();

  const [transactions, setTransactions] = useState<ParentStarTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const starBalance = parentProfile?.starBalance ?? 0;
  const totalEarned = parentProfile?.totalStarsEarned ?? 0;

  // Subscribe to star transactions for the family
  useEffect(() => {
    if (!family?.id) return;

    const txnQuery = query(
      collection(db, 'families', family.id, 'parentStarTransactions'),
      where('parentUserId', '==', parentProfile?.id ?? '')
    );

    const unsub = onSnapshot(
      txnQuery,
      (snapshot) => {
        const txns = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as ParentStarTransaction
        );
        setTransactions(txns);
        setLoading(false);
      },
      (error) => {
        console.error('[ParentWallet] Transactions snapshot error:', error);
        setLoading(false);
      }
    );

    return unsub;
  }, [family?.id, parentProfile?.id]);

  // Compute time-based earnings
  const { weeklyEarnings, monthlyEarnings } = useMemo(() => {
    const records = transactions.filter(record => record.createdAt);
    return { weeklyEarnings: earnedInPeriod(records, family?.timezone || 'UTC', 'weekly', new Date()), monthlyEarnings: earnedInPeriod(records, family?.timezone || 'UTC', 'monthly', new Date()) };
  }, [transactions, family?.timezone]);

  const formatDate = useCallback((timestamp: Timestamp): string => {
    const date = timestamp.toDate();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, []);

  const renderTransaction = useCallback(
    ({ item }: { item: ParentStarTransaction }) => {
      const icon = TXN_TYPE_ICONS.taskApproval;
      const label = TXN_TYPE_LABELS.taskApproval;
      const isPositive = item.deltaStars > 0;
      const description = item.source === 'requestCompletion' ? 'Family request completed' : item.source === 'redemption' ? 'Parent reward redeemed' : label;


      return (
        <View style={styles.txnRow}>
          <View style={styles.txnIcon}>
            <Text style={styles.txnIconText}>{icon}</Text>
          </View>
          <View style={styles.txnInfo}>
            <Text style={styles.txnDescription} numberOfLines={1}>
              {description}
            </Text>
            <Text style={styles.txnDate}>{formatDate(item.createdAt)}</Text>
          </View>
          <Text
            style={[
              styles.txnDelta,
              { color: isPositive ? colors.success : colors.coral },
            ]}
          >
            {isPositive ? '+' : ''}{item.deltaStars}
          </Text>
        </View>
      );
    },
    [formatDate]
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
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around' }}>
        <TouchableOpacity onPress={() => router.push('/(parent)/settings')}><Text style={{ padding: 16, color: colors.navy900 }}>Family settings</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(parent)/leaderboard')}><Text style={{ padding: 16, color: colors.navy900 }}>Leaderboard</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/profiles')}><Text style={{ padding: 16, color: colors.navy900 }}>Switch profiles</Text></TouchableOpacity>
      </View>
      {/* Star Balance Hero */}
      <View style={styles.heroSection}>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Star Balance</Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroStar}>{'⭐'}</Text>
            <Text style={styles.heroBalance}>{starBalance}</Text>
          </View>
        </View>

        {/* Earnings Breakdown */}
        <View style={styles.earningsRow}>
          <View style={styles.earningCard}>
            <Text style={styles.earningLabel}>This Week</Text>
            <Text style={styles.earningValue}>+{weeklyEarnings}</Text>
          </View>
          <View style={styles.earningCard}>
            <Text style={styles.earningLabel}>This Month</Text>
            <Text style={styles.earningValue}>+{monthlyEarnings}</Text>
          </View>
          <View style={styles.earningCard}>
            <Text style={styles.earningLabel}>All-Time</Text>
            <Text style={styles.earningValue}>{totalEarned}</Text>
          </View>
        </View>
      </View>

      {/* Transaction List */}
      {transactions.length > 0 ? (
        <View style={styles.txnSection}>
          <Text style={styles.txnSectionTitle}>Transaction History</Text>
          <FlashList
            data={[...transactions].sort((a,b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))}
            renderItem={renderTransaction}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.txnList}
          />
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>{'📭'}</Text>
          <Text style={styles.emptyText}>
            {"No stars yet \u2014 complete a request from your kids"}
          </Text>

          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => router.push('/(parent)/rewards' as never)}
            activeOpacity={0.7}
          >
            <Text style={styles.ctaButtonText}>Browse your reward store</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* CTA Button (when there ARE transactions) */}
      {transactions.length > 0 && (
        <View style={styles.ctaContainer}>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => router.push('/(parent)/rewards' as never)}
            activeOpacity={0.7}
          >
            <Text style={styles.ctaButtonText}>Browse your reward store</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ── Hero Section ────────────────────────────────────────────────────────────
  heroSection: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing[4],
    paddingBottom: spacing[5],
  },
  heroCard: {
    backgroundColor: colors.hero,
    borderRadius: radius.xl,
    padding: spacing[6],
    alignItems: 'center',
    ...shadows.elevation3,
  },
  heroLabel: {
    ...typography.label,
    color: colors.ink600,
    marginBottom: spacing[2],
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStar: {color:'#F7F5FF',
    fontSize: 36,
    marginRight: spacing[3],
  },
  heroBalance: {
    ...typography.display1,
    color: colors.starGold,
  },
  // ── Earnings Row ────────────────────────────────────────────────────────────
  earningsRow: {
    flexDirection: 'row',
    marginTop: spacing[4],
    gap: spacing[3],
  },
  earningCard: {
    flex: 1,
    backgroundColor: colors.ink50,
    borderRadius: radius.md,
    padding: spacing[3],
    alignItems: 'center',
    ...shadows.elevation1,
  },
  earningLabel: {
    ...typography.caption,
    color: colors.ink600,
    marginBottom: spacing[1],
  },
  earningValue: {
    ...typography.heading3,
    color: colors.navy900,
  },
  // ── Transaction List ────────────────────────────────────────────────────────
  txnSection: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
  },
  txnSectionTitle: {
    ...typography.heading3,
    color: colors.ink950,
    marginBottom: spacing[3],
  },
  txnList: {
    paddingBottom: 100,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.ink50,
  },
  txnIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.ink50,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  txnIconText: {color:'#F7F5FF',
    fontSize: 18,
  },
  txnInfo: {
    flex: 1,
    marginRight: spacing[3],
  },
  txnDescription: {
    ...typography.body2,
    color: colors.ink950,
    fontFamily: 'Inter_500Medium',
  },
  txnDate: {
    ...typography.caption,
    color: colors.ink400,
    marginTop: spacing[1],
  },
  txnDelta: {color:'#F7F5FF',
    ...typography.heading3,
    minWidth: 50,
    textAlign: 'right',
  },
  // ── Empty State ─────────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[10],
  },
  emptyEmoji: {color:'#F7F5FF',
    fontSize: 48,
    marginBottom: spacing[4],
  },
  emptyText: {
    ...typography.body1,
    color: colors.ink600,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing[6],
  },
  // ── CTA Button ──────────────────────────────────────────────────────────────
  ctaContainer: {
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing[4],
    paddingBottom: spacing[8],
  },
  ctaButton: {
    backgroundColor: colors.navy500,
    paddingVertical: spacing[4],
    borderRadius: radius.lg,
    alignItems: 'center',
    ...shadows.elevation2,
  },
  ctaButtonText: {
    ...typography.button,
    color: colors.onAccent,
  },
});
