// S7-05: Request History screen (C-07)
// All requests with status chips. Decline reason shown. Re-submit with cooldown.

import { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useRequestStore } from '../../../src/stores/requestStore';
import { useChildSessionStore } from '../../../src/stores/childSessionStore';
import type { FamilyRequest } from '../../../src/types';

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: 'Waiting', bg: '#FEF3C7', color: '#B45309' },
  accepted: { label: 'Accepted', bg: '#D1FAE5', color: '#1B7A34' },
  declined: { label: 'Declined', bg: '#FEE2E2', color: '#9B1C1C' },
  snoozed: { label: 'Snoozed', bg: '#EDE9FE', color: '#7B2D8B' },
  completed: { label: 'Done by parent', bg: '#DBEAFE', color: '#1B6CA8' },
  confirmed: { label: 'Confirmed', bg: '#D1FAE5', color: '#1B7A34' },
  'auto-confirmed': { label: 'Auto-confirmed', bg: '#D1FAE5', color: '#1B7A34' },
};

export default function RequestHistoryScreen() {
  const router = useRouter();
  const { requests } = useRequestStore();
  const { activeChildId } = useChildSessionStore();

  const myRequests = useMemo(
    () => requests.filter((r) => r.requestedByChildId === activeChildId),
    [requests, activeChildId]
  );

  const canResubmit = useCallback((req: FamilyRequest): boolean => {
    if (req.status !== 'declined') return false;
    // 7-day cooldown check would go here
    return true;
  }, []);

  const renderRequest = useCallback(
    ({ item }: { item: FamilyRequest }) => {
      const statusConfig = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;

      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <View style={[styles.statusChip, { backgroundColor: statusConfig.bg }]}>
              <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
            </View>
          </View>

          <View style={styles.cardMeta}>
            <Text style={styles.starValue}>⭐ {item.suggestedStars}{item.agreedStars ? ` → ${item.agreedStars}` : ''}</Text>
            <Text style={styles.category}>{item.category}</Text>
          </View>

          {item.status === 'declined' && item.declineReason && (
            <Text style={styles.declineReason}>"{item.declineReason}"</Text>
          )}

          {item.status === 'accepted' && (
            <Text style={styles.acceptedText}>Your parent said yes! ⭐ {item.agreedStars} stars agreed</Text>
          )}

          {item.status === 'completed' && (
            <View style={styles.confirmRow}>
              <Text style={styles.confirmPrompt}>Did your parent do this?</Text>
              <TouchableOpacity style={styles.yesButton}>
                <Text style={styles.yesText}>Yes!</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.notYetButton}>
                <Text style={styles.notYetText}>Not yet</Text>
              </TouchableOpacity>
            </View>
          )}

          {canResubmit(item) && (
            <TouchableOpacity style={styles.resubmitButton} onPress={() => router.push('/(child)/requests/create' as never)}>
              <Text style={styles.resubmitText}>Ask again</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    },
    [canResubmit, router]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.heading}>My Requests</Text>
      {myRequests.length > 0 ? (
        <FlashList
          data={myRequests}
          renderItem={renderRequest}
          estimatedItemSize={120}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>💭</Text>
          <Text style={styles.emptyText}>
            You haven&apos;t made any requests yet.{'\n'}Tap the + button to ask your parent for something!
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  heading: { fontFamily: 'Nunito_700Bold', fontSize: 28, color: '#1A1A2E', paddingHorizontal: 16, paddingVertical: 12 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F0F9FF' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: '#1A1A2E', flex: 1, marginRight: 8 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  cardMeta: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  starValue: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#1A1A2E' },
  category: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#555555' },
  declineReason: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#9B1C1C', fontStyle: 'italic', marginTop: 4 },
  acceptedText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#1B7A34', marginTop: 4 },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  confirmPrompt: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#1A1A2E', flex: 1 },
  yesButton: { backgroundColor: '#1B7A34', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  yesText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#FFFFFF' },
  notYetButton: { backgroundColor: '#F8FAFC', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  notYetText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#555555' },
  resubmitButton: { marginTop: 8, paddingVertical: 8 },
  resubmitText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#FF6B6B' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 16, color: '#555555', textAlign: 'center', lineHeight: 24 },
});
