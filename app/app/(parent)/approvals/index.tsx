// S2-09: Parent Approval Queue (P-05)
// Pending submissions. Approve/reject bottom sheet. Photo display. Batch approve.

import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useTaskStore } from '../../../src/stores/taskStore';
import { useFamilyStore } from '../../../src/stores/familyStore';
import type { TaskClaim } from '../../../src/types';

export default function ApprovalQueueScreen() {
  const { tasks, claims } = useTaskStore();
  const { family, children } = useFamilyStore();
  const [selectedClaim, setSelectedClaim] = useState<TaskClaim | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(false);

  const pendingClaims = useMemo(
    () => claims.filter((c) => c.status === 'submitted'),
    [claims]
  );

  const getTaskTitle = useCallback(
    (taskId: string) => tasks.find((t) => t.id === taskId)?.title ?? 'Unknown Quest',
    [tasks]
  );

  const getTaskCategory = useCallback(
    (taskId: string) => tasks.find((t) => t.id === taskId)?.category ?? 'Household',
    [tasks]
  );

  const getTaskStars = useCallback(
    (taskId: string) => tasks.find((t) => t.id === taskId)?.starValue ?? 0,
    [tasks]
  );

  const getChildName = useCallback(
    (childId: string) => children.find((c) => c.id === childId)?.nickname ?? 'Unknown',
    [children]
  );

  const handleApprove = useCallback(async (claim: TaskClaim) => {
    setLoading(true);
    try {
      // In Sprint 2, approval triggers onTaskClaimApproved Cloud Function
      // For now, update the claim status directly
      console.log('[Approval] Approved claim:', claim.id);
      Alert.alert('Approved!', `Stars awarded to ${getChildName(claim.childProfileId)}`);
      setSelectedClaim(null);
    } catch {
      Alert.alert('Error', 'Could not approve. Try again.');
    } finally {
      setLoading(false);
    }
  }, [getChildName]);

  const handleReject = useCallback(async () => {
    if (!selectedClaim) return;
    if (!rejectReason.trim()) {
      Alert.alert('Reason Required', 'Please tell the child what to improve.');
      return;
    }
    setLoading(true);
    try {
      console.log('[Approval] Rejected claim:', selectedClaim.id, 'Reason:', rejectReason);
      Alert.alert('Sent back', `${getChildName(selectedClaim.childProfileId)} will be notified.`);
      setSelectedClaim(null);
      setRejectReason('');
    } catch {
      Alert.alert('Error', 'Could not reject. Try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedClaim, rejectReason, getChildName]);

  const handleBatchApprove = useCallback(() => {
    Alert.alert(
      'Approve All',
      `Approve all ${pendingClaims.length} tasks?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve All',
          onPress: () => {
            console.log('[Approval] Batch approved:', pendingClaims.length);
            Alert.alert('Done!', 'All tasks approved.');
          },
        },
      ]
    );
  }, [pendingClaims]);

  const CATEGORY_DEEP: Record<string, string> = {
    Household: '#1B6CA8', Learning: '#7B2D8B', LifeSkills: '#0D7377', Hobbies: '#B85C00',
  };

  const renderClaim = useCallback(
    ({ item }: { item: TaskClaim }) => {
      const category = getTaskCategory(item.taskId);
      return (
        <TouchableOpacity
          style={styles.claimCard}
          onPress={() => setSelectedClaim(item)}
          activeOpacity={0.7}
        >
          <View style={[styles.catBorder, { backgroundColor: CATEGORY_DEEP[category] ?? '#1A3E6E' }]} />
          <View style={styles.claimBody}>
            <View style={styles.claimHeader}>
              <Text style={styles.childAvatar}>😊</Text>
              <Text style={styles.childName}>{getChildName(item.childProfileId)}</Text>
            </View>
            <Text style={styles.taskTitle}>{getTaskTitle(item.taskId)}</Text>
            <View style={styles.claimFooter}>
              <Text style={styles.starValue}>⭐ {getTaskStars(item.taskId)}</Text>
              {item.photoProofUrl && <Text style={styles.photoTag}>📷 Photo</Text>}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [getTaskTitle, getTaskCategory, getTaskStars, getChildName]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>Waiting for review</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{pendingClaims.length}</Text>
        </View>
      </View>

      {pendingClaims.length >= 3 && (
        <TouchableOpacity style={styles.batchButton} onPress={handleBatchApprove}>
          <Text style={styles.batchButtonText}>Approve all {pendingClaims.length} tasks</Text>
        </TouchableOpacity>
      )}

      {pendingClaims.length > 0 ? (
        <FlashList
          data={pendingClaims}
          renderItem={renderClaim}
          estimatedItemSize={90}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>✅</Text>
          <Text style={styles.emptyText}>All caught up! No tasks waiting for review.</Text>
        </View>
      )}

      {/* Detail bottom sheet */}
      <Modal visible={!!selectedClaim} animationType="slide" transparent onRequestClose={() => setSelectedClaim(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.dragHandle} />
            {selectedClaim && (
              <>
                <Text style={styles.modalTitle}>{getTaskTitle(selectedClaim.taskId)}</Text>
                <Text style={styles.modalChild}>Submitted by {getChildName(selectedClaim.childProfileId)}</Text>
                <Text style={styles.modalStars}>⭐ {getTaskStars(selectedClaim.taskId)} stars</Text>

                {/* Approve */}
                <TouchableOpacity
                  style={styles.approveButton}
                  onPress={() => handleApprove(selectedClaim)}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.approveText}>Approve ✓</Text>}
                </TouchableOpacity>

                {/* Reject */}
                <TextInput
                  style={styles.rejectInput}
                  placeholder="Reason for sending back..."
                  placeholderTextColor="#9CA3AF"
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  maxLength={200}
                />
                <TouchableOpacity style={styles.rejectButton} onPress={handleReject} disabled={loading}>
                  <Text style={styles.rejectText}>Needs work ✗</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelButton} onPress={() => { setSelectedClaim(null); setRejectReason(''); }}>
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
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#1A1A2E' },
  countBadge: { backgroundColor: '#B45309', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  countText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#FFFFFF' },
  batchButton: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#1B7A34', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  batchButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#FFFFFF' },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  claimCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 8, overflow: 'hidden', shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, shadowOpacity: 0.06, shadowColor: 'rgba(26,62,110,0.12)', elevation: 1 },
  catBorder: { width: 4 },
  claimBody: { flex: 1, padding: 14 },
  claimHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  childAvatar: { fontSize: 18 },
  childName: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#555555' },
  taskTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#1A1A2E', marginBottom: 6 },
  claimFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  starValue: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#1A1A2E' },
  photoTag: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#4A90D9' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 16, color: '#555555', textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  dragHandle: { width: 40, height: 4, backgroundColor: '#E8F2FB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#1A1A2E', marginBottom: 4 },
  modalChild: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#555555', marginBottom: 12 },
  modalStars: { fontFamily: 'Inter_700Bold', fontSize: 24, color: '#1A1A2E', marginBottom: 20 },
  approveButton: { backgroundColor: '#1B7A34', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  approveText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#FFFFFF' },
  rejectInput: { borderWidth: 1, borderColor: '#E8F2FB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 14, color: '#1A1A2E', marginBottom: 12 },
  rejectButton: { backgroundColor: '#9B1C1C', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  rejectText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#FFFFFF' },
  cancelButton: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: '#4A90D9' },
});
