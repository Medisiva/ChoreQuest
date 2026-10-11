import { useFamilyStore } from '@/stores/familyStore';
import { confirmRequestComplete, returnRequestIncomplete } from '@/services/requests';
import { errorMessage } from '@/services/errorMessage';
// S7-05: Request History screen (C-07)
// All requests with status chips. Decline reason shown. Re-submit with cooldown.

import { useMemo, useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useRequestStore } from '@/stores/requestStore';
import { useChildSessionStore } from '@/stores/childSessionStore';
import type { FamilyRequest } from '@/types';

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: 'Waiting', bg: '#302719', color: '#FFE177' },
  accepted: { label: 'Accepted', bg: '#26351D', color: '#CDFF65' },
  declined: { label: 'Declined', bg: '#391D2B', color: '#FF92A7' },
  snoozed: { label: 'Snoozed', bg: '#302445', color: '#B7A1FF' },
  completed: { label: 'Done by parent', bg: '#17363A', color: '#65F3FF' },
  confirmed: { label: 'Confirmed', bg: '#26351D', color: '#CDFF65' },
  'auto-confirmed': { label: 'Auto-confirmed', bg: '#26351D', color: '#CDFF65' },
};

export default function RequestHistoryScreen() {
  const router = useRouter();
  const {family} = useFamilyStore();
  const pending = useRef(new Set<string>());
  const [busy,setBusy] = useState<string[]>([]);
  const [actionError,setActionError] = useState<string | null>(null);
  const respond = useCallback(async (id:string, completed:boolean) => {
    if(!family || pending.current.has(id))return;
    pending.current.add(id);setBusy([...pending.current]);setActionError(null);
    try {await (completed ? confirmRequestComplete : returnRequestIncomplete)(family.id,id);}
    catch(error){setActionError(errorMessage(error,'Could not update the request. Please try again.'));}
    finally{pending.current.delete(id);setBusy([...pending.current]);}
  },[family]);
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
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Confirm parent finished" disabled={busy.includes(item.id)} style={styles.yesButton} onPress={() => void respond(item.id,true)}>
                <Text style={styles.yesText}>Yes!</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" disabled={busy.includes(item.id)} style={styles.notYetButton} onPress={() => void respond(item.id,false)}>
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
    [canResubmit, router, busy, respond]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.heading}>My Requests</Text>{actionError && <Text accessibilityRole="alert" style={{color:"#FF92A7",padding:16}}>{actionError}</Text>}
      {myRequests.length > 0 ? (
        <FlashList
          data={myRequests}
          renderItem={renderRequest}
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
  container: { flex: 1, backgroundColor: '#121219' },
  heading: { fontFamily: 'Nunito_700Bold', fontSize: 28, color: '#F7F5FF', paddingHorizontal: 16, paddingVertical: 12 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  card: { backgroundColor: '#121219', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#060609' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: '#F7F5FF', flex: 1, marginRight: 8 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: {color:'#F7F5FF', fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  cardMeta: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  starValue: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#F7F5FF' },
  category: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#C0BDCF' },
  declineReason: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#FF92A7', fontStyle: 'italic', marginTop: 4 },
  acceptedText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#CDFF65', marginTop: 4 },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  confirmPrompt: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#F7F5FF', flex: 1 },
  yesButton: { backgroundColor: '#CDFF65', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  yesText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#17200C' },
  notYetButton: { backgroundColor: '#23232F', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  notYetText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#C0BDCF' },
  resubmitButton: { marginTop: 8, paddingVertical: 8 },
  resubmitText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#FF76C5' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 48 },
  emptyEmoji: {color:'#F7F5FF', fontSize: 48, marginBottom: 16 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 16, color: '#C0BDCF', textAlign: 'center', lineHeight: 24 },
});
