// S7-03: Request Inbox for parents (P-08)
// Pending/Accepted/History tabs. Star edit on Accept. Decline requires reason.

import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Alert from '@/services/dialogs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useRequestStore } from '@/stores/requestStore';
import { useFamilyStore } from '@/stores/familyStore';
import { useAuthStore } from '@/stores/authStore';
import {
  acceptRequest,
  declineRequest,
  markRequestComplete,
} from '@/services/requests';
import type { FamilyRequest } from '@/types';

type Tab = 'pending' | 'accepted' | 'history';

export default function RequestInboxScreen() {
  const { requests } = useRequestStore();
  const { family, children } = useFamilyStore();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('pending');
  const [selectedRequest, setSelectedRequest] = useState<FamilyRequest | null>(null);
  const [editedStars, setEditedStars] = useState(0);
  const [declineReason, setDeclineReason] = useState('');
  const [loading, setLoading] = useState(false);

  const filteredRequests = useMemo(() => {
    switch (tab) {
      case 'pending': return requests.filter((r) => r.status === 'pending' || r.status === 'snoozed');
      case 'accepted': return requests.filter((r) => r.status === 'accepted' || r.status === 'completed');
      case 'history': return requests.filter((r) => ['confirmed', 'auto-confirmed', 'declined'].includes(r.status));
      default: return [];
    }
  }, [requests, tab]);

  const getChildName = useCallback(
    (childId: string) => children.find((c) => c.id === childId)?.nickname ?? 'Child',
    [children]
  );

  const handleAccept = useCallback(async () => {
    if (!family || !user || !selectedRequest) return;
    setLoading(true);
    try {
      await acceptRequest(family.id, selectedRequest.id, editedStars, user.uid);
      setSelectedRequest(null);
    } catch { Alert.alert('Error', 'Could not accept request.'); }
    finally { setLoading(false); }
  }, [family, user, selectedRequest, editedStars]);

  const handleDecline = useCallback(async () => {
    if (!family || !selectedRequest || !declineReason.trim()) {
      Alert.alert('Required', 'Please give a reason.');
      return;
    }
    setLoading(true);
    try {
      await declineRequest(family.id, selectedRequest.id, declineReason);
      setSelectedRequest(null);
      setDeclineReason('');
    } catch { Alert.alert('Error', 'Could not decline.'); }
    finally { setLoading(false); }
  }, [family, selectedRequest, declineReason]);

  const handleMarkDone = useCallback(async (req: FamilyRequest) => {
    if (!family) return;
    try { await markRequestComplete(family.id, req.id); }
    catch { Alert.alert('Error', 'Could not mark as done.'); }
  }, [family]);

  const openAcceptSheet = useCallback((req: FamilyRequest) => {
    setSelectedRequest(req);
    setEditedStars(req.suggestedStars);
    setDeclineReason('');
  }, []);

  const renderRequest = useCallback(
    ({ item }: { item: FamilyRequest }) => (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.childEmoji}>😊</Text>
          <Text style={styles.childName}>{getChildName(item.requestedByChildId)}</Text>
        </View>
        <Text style={styles.requestTitle}>{item.title}</Text>
        {item.description && <Text style={styles.requestDesc}>{item.description}</Text>}
        <Text style={styles.starSuggestion}>⭐ {item.suggestedStars} stars suggested{item.agreedStars ? ` → ${item.agreedStars} agreed` : ''}</Text>

        {item.status === 'pending' && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.acceptBtn} onPress={() => openAcceptSheet(item)}>
              <Text style={styles.acceptText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.declineBtn} onPress={() => { setSelectedRequest(item); setDeclineReason(''); }}>
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.status === 'accepted' && (
          <TouchableOpacity style={styles.markDoneBtn} onPress={() => handleMarkDone(item)}>
            <Text style={styles.markDoneText}>Mark as Done</Text>
          </TouchableOpacity>
        )}

        {item.status === 'declined' && item.declineReason && (
          <Text style={styles.declineReasonText}>Declined: {item.declineReason}</Text>
        )}
      </View>
    ),
    [getChildName, openAcceptSheet, handleMarkDone]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>Requests from your kids</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{requests.filter((r) => r.status === 'pending').length}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['pending', 'accepted', 'history'] as Tab[]).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filteredRequests.length > 0 ? (
        <FlashList data={filteredRequests} renderItem={renderRequest} keyExtractor={(i) => i.id} contentContainerStyle={styles.listContent} />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyText}>
            {tab === 'pending' ? "No requests right now" : "Nothing here yet"}
          </Text>
        </View>
      )}

      {/* Accept/Decline sheet */}
      <Modal visible={!!selectedRequest} animationType="slide" transparent onRequestClose={() => setSelectedRequest(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.dragHandle} />
            {selectedRequest && (
              <>
                <Text style={styles.modalTitle}>{selectedRequest.title}</Text>
                <Text style={styles.modalChild}>From {getChildName(selectedRequest.requestedByChildId)}</Text>

                <Text style={styles.starEditLabel}>Suggested: ⭐ {selectedRequest.suggestedStars} — is this right?</Text>
                <View style={styles.starEditor}>
                  <TouchableOpacity style={styles.starEditBtn} onPress={() => setEditedStars(Math.max(1, editedStars - 1))}>
                    <Text style={styles.starEditBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.starEditValue}>⭐ {editedStars}</Text>
                  <TouchableOpacity style={styles.starEditBtn} onPress={() => setEditedStars(Math.min(100, editedStars + 1))}>
                    <Text style={styles.starEditBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.acceptFullBtn} onPress={handleAccept} disabled={loading}>
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.acceptFullText}>Accept with {editedStars} {editedStars === 1 ? 'star' : 'stars'}</Text>}
                </TouchableOpacity>

                <TextInput style={styles.declineInput} placeholder="Reason for declining..." placeholderTextColor="#A9A7BA" value={declineReason} onChangeText={setDeclineReason} maxLength={120} />
                <TouchableOpacity style={styles.declineFullBtn} onPress={handleDecline} disabled={loading}>
                  <Text style={styles.declineFullText}>Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelectedRequest(null)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#23232F' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#F7F5FF' },
  countBadge: { backgroundColor: '#65F3FF', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  countText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#17200C' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#121219', borderWidth: 1, borderColor: '#17363A' },
  tabActive: { backgroundColor: '#65F3FF', borderColor: '#65F3FF' },
  tabText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#C0BDCF' },
  tabTextActive: { color: '#17200C' },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  card: { backgroundColor: '#121219', borderRadius: 12, padding: 16, marginBottom: 10, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, shadowOpacity: 0.06, shadowColor: 'rgba(26,62,110,0.12)', elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  childEmoji: {color:'#F7F5FF', fontSize: 18 },
  childName: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#C0BDCF' },
  requestTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#F7F5FF', marginBottom: 4 },
  requestDesc: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#C0BDCF', marginBottom: 4 },
  starSuggestion: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#F7F5FF', marginBottom: 10 },
  actionRow: { flexDirection: 'row', gap: 8 },
  acceptBtn: { flex: 1, backgroundColor: '#CDFF65', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  acceptText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#17200C' },
  declineBtn: { flex: 1, backgroundColor: '#391D2B', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  declineText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#FF92A7' },
  markDoneBtn: { backgroundColor: '#FFE177', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  markDoneText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#17200C' },
  declineReasonText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#FF92A7', fontStyle: 'italic', marginTop: 4 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 48 },
  emptyEmoji: {color:'#F7F5FF', fontSize: 48, marginBottom: 16 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 16, color: '#C0BDCF', textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#121219', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  dragHandle: { width: 40, height: 4, backgroundColor: '#17363A', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#F7F5FF', marginBottom: 4 },
  modalChild: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#C0BDCF', marginBottom: 16 },
  starEditLabel: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#C0BDCF', marginBottom: 12, textAlign: 'center' },
  starEditor: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 20 },
  starEditBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#23232F', justifyContent: 'center', alignItems: 'center' },
  starEditBtnText: { fontSize: 24, fontWeight: '700', color: '#F7F5FF' },
  starEditValue: { fontFamily: 'Inter_700Bold', fontSize: 28, color: '#F7F5FF' },
  acceptFullBtn: { backgroundColor: '#CDFF65', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  acceptFullText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#17200C' },
  declineInput: { borderWidth: 1, borderColor: '#17363A', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 14, color: '#F7F5FF', marginBottom: 10 },
  declineFullBtn: { backgroundColor: '#FF92A7', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  declineFullText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#17200C' },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: '#65F3FF' },
});
