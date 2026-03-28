// S2-08: Task Detail screen (C-03)
// Full task info. Claim button uses claimTask transaction.
// Submitted state shows waiting message. Release with 15-min cooldown.

import { useState, useMemo, useCallback } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTaskStore } from '../../../src/stores/taskStore';
import { useChildSessionStore } from '../../../src/stores/childSessionStore';
import { claimTask, submitTaskCompletion, releaseTask } from '../../../src/services/tasks';
import { useFamilyStore } from '../../../src/stores/familyStore';

const CATEGORY_CONFIG: Record<string, { icon: string; deep: string; light: string; label: string }> = {
  Household: { icon: '🏠', deep: '#1B6CA8', light: '#DBEAFE', label: 'Household' },
  Learning: { icon: '📚', deep: '#7B2D8B', light: '#EDE9FE', label: 'Learning' },
  LifeSkills: { icon: '🌱', deep: '#0D7377', light: '#CCFBF1', label: 'Life Skills' },
  Hobbies: { icon: '🎨', deep: '#B85C00', light: '#FFEDD5', label: 'Hobbies' },
};

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tasks, claims } = useTaskStore();
  const { activeChildId } = useChildSessionStore();
  const { family } = useFamilyStore();
  const [loading, setLoading] = useState(false);

  const task = useMemo(() => tasks.find((t) => t.id === id), [tasks, id]);
  const myClaim = useMemo(
    () => claims.find((c) => c.taskId === id && c.childProfileId === activeChildId && c.status !== 'released'),
    [claims, id, activeChildId]
  );
  const otherClaim = useMemo(
    () => claims.find((c) => c.taskId === id && c.childProfileId !== activeChildId && (c.status === 'claimed' || c.status === 'submitted')),
    [claims, id, activeChildId]
  );

  const catConfig = task ? CATEGORY_CONFIG[task.category] : null;

  const handleClaim = useCallback(async () => {
    if (!family || !activeChildId || !id) return;
    setLoading(true);
    try {
      await claimTask(family.id, id, activeChildId);
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'ALREADY_CLAIMED') {
        Alert.alert('Oops!', 'Someone else just grabbed this quest!');
      } else {
        Alert.alert('Error', 'Could not claim this quest. Try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [family, activeChildId, id]);

  const handleSubmit = useCallback(async () => {
    if (!family || !myClaim) return;
    Alert.alert('Submit Quest', 'Are you done with this quest?', [
      { text: 'Not yet', style: 'cancel' },
      {
        text: "Yes, I'm done!",
        onPress: async () => {
          setLoading(true);
          try {
            await submitTaskCompletion(family.id, myClaim.id);
          } catch {
            Alert.alert('Error', 'Could not submit. Try again.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  }, [family, myClaim]);

  const handleRelease = useCallback(async () => {
    if (!family || !myClaim) return;
    Alert.alert('Release Quest', 'Are you sure you want to give up this quest?', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Release',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await releaseTask(family.id, myClaim.id);
          } catch {
            Alert.alert('Error', 'Could not release. Try again.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  }, [family, myClaim]);

  if (!task) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.notFound}>Quest not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Category banner */}
      <View style={[styles.banner, { backgroundColor: catConfig?.deep ?? '#1A3E6E' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.bannerIcon}>{catConfig?.icon}</Text>
        <Text style={styles.bannerLabel}>{catConfig?.label}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Title & Description */}
        <Text style={styles.title}>{task.title}</Text>
        {task.description && <Text style={styles.description}>{task.description}</Text>}

        {/* Star value */}
        <View style={styles.starBlock}>
          <Text style={styles.starBig}>⭐ {task.starValue}</Text>
          <Text style={styles.starLabel}>stars</Text>
        </View>

        {/* Info chips */}
        <View style={styles.infoRow}>
          <View style={[styles.infoBadge, getDifficultyBg(task.difficulty)]}>
            <Text style={styles.infoText}>{task.difficulty}</Text>
          </View>
          <View style={styles.infoBadge}>
            <Text style={styles.infoText}>Ages {task.ageGroupSuggestion}</Text>
          </View>
          {task.recurrenceType !== 'none' && (
            <View style={styles.infoBadge}>
              <Text style={styles.infoText}>🔄 {task.recurrenceType}</Text>
            </View>
          )}
        </View>

        {/* Photo notice */}
        {task.requiresPhoto && (
          <View style={styles.photoNotice}>
            <Text style={styles.photoNoticeText}>📷 You&apos;ll need to take a photo when done</Text>
          </View>
        )}

        {/* Milestone notice */}
        {task.isMilestone && (
          <View style={styles.milestoneNotice}>
            <Text style={styles.milestoneText}>📊 Multi-step quest ({task.milestoneSteps} steps)</Text>
          </View>
        )}

        {/* Action area */}
        {otherClaim ? (
          <View style={styles.claimedNotice}>
            <Text style={styles.claimedText}>🔒 Someone else is working on this</Text>
          </View>
        ) : !myClaim ? (
          <TouchableOpacity
            style={styles.claimButton}
            onPress={handleClaim}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.claimButtonText}>Claim this Quest</Text>
            )}
          </TouchableOpacity>
        ) : myClaim.status === 'claimed' ? (
          <View>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>I&apos;ve done it! ✓</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.releaseLink} onPress={handleRelease}>
              <Text style={styles.releaseLinkText}>Release this Quest</Text>
            </TouchableOpacity>
          </View>
        ) : myClaim.status === 'submitted' ? (
          <View style={styles.waitingState}>
            <Text style={styles.waitingText}>⏳ Waiting for your parent to review...</Text>
          </View>
        ) : myClaim.status === 'approved' ? (
          <View style={styles.approvedState}>
            <Text style={styles.approvedText}>🎉 Quest Complete!</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function getDifficultyBg(d: string) {
  switch (d) {
    case 'Easy': return { backgroundColor: '#D1FAE5' };
    case 'Medium': return { backgroundColor: '#FEF3C7' };
    case 'Hard': return { backgroundColor: '#FEE2E2' };
    default: return { backgroundColor: '#EDE9FE' };
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  notFound: { fontFamily: 'Inter_400Regular', fontSize: 16, color: '#555555', textAlign: 'center', marginTop: 100 },
  banner: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  backBtn: { padding: 8 },
  backText: { fontSize: 24, color: '#FFFFFF' },
  bannerIcon: { fontSize: 24 },
  bannerLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#FFFFFF' },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontFamily: 'Nunito_700Bold', fontSize: 28, color: '#1A1A2E', marginBottom: 8 },
  description: { fontFamily: 'Inter_400Regular', fontSize: 16, color: '#555555', lineHeight: 24, marginBottom: 20 },
  starBlock: { alignItems: 'center', marginVertical: 24 },
  starBig: { fontFamily: 'Nunito_800ExtraBold', fontSize: 48, color: '#1A1A2E' },
  starLabel: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#9CA3AF', marginTop: 4 },
  infoRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 20 },
  infoBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F8FAFC' },
  infoText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#1A1A2E' },
  photoNotice: { backgroundColor: '#FEF3C7', padding: 12, borderRadius: 12, marginBottom: 12 },
  photoNoticeText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#92400E' },
  milestoneNotice: { backgroundColor: '#EDE9FE', padding: 12, borderRadius: 12, marginBottom: 20 },
  milestoneText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#7B2D8B' },
  claimedNotice: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, alignItems: 'center' },
  claimedText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#9CA3AF' },
  claimButton: { backgroundColor: '#1B7A34', borderRadius: 12, paddingVertical: 18, alignItems: 'center' },
  claimButtonText: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: '#FFFFFF' },
  submitButton: { backgroundColor: '#FFD700', borderRadius: 12, paddingVertical: 18, alignItems: 'center' },
  submitButtonText: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: '#1A1A2E' },
  releaseLink: { alignItems: 'center', marginTop: 16 },
  releaseLinkText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#9CA3AF' },
  waitingState: { backgroundColor: '#FEF3C7', padding: 20, borderRadius: 12, alignItems: 'center' },
  waitingText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#92400E' },
  approvedState: { backgroundColor: '#D1FAE5', padding: 20, borderRadius: 12, alignItems: 'center' },
  approvedText: { fontFamily: 'Nunito_700Bold', fontSize: 20, color: '#1B7A34' },
});
