// S4-04: Milestone Task Detail screen (C-04)
// Multi-step task view with circular progress, step list, and step completion.
// Category color theming throughout. Steps show check/highlight/lock states.

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
import { useTaskStore } from '../../../../src/stores/taskStore';
import { useChildSessionStore } from '../../../../src/stores/childSessionStore';
import { useFamilyStore } from '../../../../src/stores/familyStore';
import {
  completeMilestoneStep,
  getMilestoneProgress,
} from '../../../../src/utils/milestoneUtils';
import {
  colors,
  spacing,
  radius,
  typography,
  categoryColors,
} from '../../../../src/constants/tokens';
import type { Category } from '../../../../src/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryConfig(category: Category) {
  return categoryColors[category] ?? categoryColors.Household;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MilestoneDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tasks, claims } = useTaskStore();
  const { activeChildId } = useChildSessionStore();
  const { family } = useFamilyStore();
  const [loading, setLoading] = useState(false);

  const task = useMemo(() => tasks.find((t) => t.id === id), [tasks, id]);
  const myClaim = useMemo(
    () =>
      claims.find(
        (c) =>
          c.taskId === id &&
          c.childProfileId === activeChildId &&
          c.status !== 'released'
      ),
    [claims, id, activeChildId]
  );

  const catConfig = task ? getCategoryConfig(task.category) : null;
  const deepColor = catConfig?.deep ?? colors.navy900;

  const progress = useMemo(() => {
    if (!myClaim || !task) return null;
    return getMilestoneProgress(myClaim, task);
  }, [myClaim, task]);

  const totalSteps = task?.milestoneSteps ?? 1;
  const starsPerStep = task?.starsPerStep ?? 0;
  const milestoneBonus = task?.milestoneBonus ?? 0;
  const currentStep = progress?.currentStep ?? 0;
  const percentage = progress?.percentage ?? 0;

  // Determine if the current step is awaiting parent approval
  const isWaitingForApproval = myClaim?.status === 'submitted';

  const handleCompleteStep = useCallback(async () => {
    if (!family || !myClaim || !task) return;

    Alert.alert(
      `Complete Step ${currentStep + 1}`,
      `Mark step ${currentStep + 1} of ${totalSteps} as done?`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Done!',
          onPress: async () => {
            setLoading(true);
            try {
              await completeMilestoneStep(
                family.id,
                myClaim.id,
                currentStep,
                totalSteps
              );
            } catch (error) {
              console.error('[milestone] Step completion failed:', error);
              Alert.alert('Error', 'Could not complete this step. Try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }, [family, myClaim, task, currentStep, totalSteps]);

  // ── Not Found ──────────────────────────────────────────────────────────────

  if (!task || !task.isMilestone) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.notFound}>Milestone quest not found</Text>
      </SafeAreaView>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header / Back */}
      <View style={[styles.header, { backgroundColor: deepColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<-'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {task.title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ── Circular Progress Hero ──────────────────────────────────── */}
        <View style={styles.heroSection}>
          <View
            style={[
              styles.circularProgress,
              { borderColor: deepColor },
            ]}
          >
            <Text style={[styles.stepText, { color: deepColor }]}>
              {currentStep}/{totalSteps}
            </Text>
            <Text style={styles.percentText}>{percentage}%</Text>
          </View>
          <Text style={styles.heroLabel}>
            Step {Math.min(currentStep + 1, totalSteps)} of {totalSteps}
          </Text>
        </View>

        {/* ── Full-Width Progress Bar ─────────────────────────────────── */}
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${percentage}%`,
                backgroundColor: deepColor,
              },
            ]}
          />
        </View>

        {/* ── Stars Summary ───────────────────────────────────────────── */}
        <View style={styles.starsRow}>
          <View style={styles.starItem}>
            <Text style={styles.starValue}>{progress?.starsEarned ?? 0}</Text>
            <Text style={styles.starCaption}>Earned</Text>
          </View>
          <View style={styles.starDivider} />
          <View style={styles.starItem}>
            <Text style={styles.starValue}>{progress?.starsRemaining ?? 0}</Text>
            <Text style={styles.starCaption}>Remaining</Text>
          </View>
          <View style={styles.starDivider} />
          <View style={styles.starItem}>
            <Text style={[styles.starValue, { color: colors.starGold }]}>
              +{milestoneBonus}
            </Text>
            <Text style={styles.starCaption}>Bonus</Text>
          </View>
        </View>

        {/* ── Step List ───────────────────────────────────────────────── */}
        <View style={styles.stepList}>
          {Array.from({ length: totalSteps }, (_, i) => {
            const stepNum = i + 1;
            const isCompleted = i < currentStep;
            const isCurrent = i === currentStep;
            const isFuture = i > currentStep;

            return (
              <View
                key={stepNum}
                style={[
                  styles.stepRow,
                  isCurrent && { backgroundColor: catConfig?.light ?? colors.navy50 },
                  isCurrent && { borderLeftColor: deepColor, borderLeftWidth: 4 },
                ]}
              >
                {/* Step icon */}
                <View
                  style={[
                    styles.stepIcon,
                    isCompleted && { backgroundColor: colors.success },
                    isCurrent && { backgroundColor: deepColor },
                    isFuture && { backgroundColor: colors.ink400 },
                  ]}
                >
                  <Text style={styles.stepIconText}>
                    {isCompleted ? '\u2713' : isFuture ? '\uD83D\uDD12' : stepNum}
                  </Text>
                </View>

                {/* Step label */}
                <View style={styles.stepInfo}>
                  <Text
                    style={[
                      styles.stepLabel,
                      isCompleted && { color: colors.ink400, textDecorationLine: 'line-through' },
                      isCurrent && { color: deepColor, fontFamily: 'Nunito_700Bold' },
                      isFuture && { color: colors.ink400 },
                    ]}
                  >
                    Step {stepNum}
                  </Text>
                  <Text style={styles.stepStars}>
                    {starsPerStep} star{starsPerStep !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Action Area ─────────────────────────────────────────────── */}
        {progress?.isComplete ? (
          <View style={styles.celebrationBlock}>
            <Text style={styles.celebrationText}>
              All steps complete! Great job!
            </Text>
            <Text style={styles.celebrationSubtext}>
              You earned {(progress.starsEarned)} stars total
            </Text>
          </View>
        ) : isWaitingForApproval ? (
          <View style={styles.waitingBlock}>
            <Text style={styles.waitingText}>
              Waiting for parent to approve step {currentStep}...
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* ── Bottom Button ─────────────────────────────────────────────── */}
      {!progress?.isComplete && !isWaitingForApproval && myClaim && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.completeBtn, { backgroundColor: deepColor }]}
            onPress={handleCompleteStep}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.completeBtnText}>
                Complete Step {currentStep + 1}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  notFound: {
    ...typography.body1,
    color: colors.ink600,
    textAlign: 'center',
    marginTop: 100,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[3],
  },
  backBtn: {
    padding: spacing[2],
  },
  backText: {
    fontSize: 24,
    color: colors.white,
  },
  headerTitle: {
    ...typography.childHeading2,
    color: colors.white,
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 120,
  },

  // Hero circular progress
  heroSection: {
    alignItems: 'center',
    paddingTop: spacing[8],
    paddingBottom: spacing[5],
  },
  circularProgress: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink50,
  },
  stepText: {
    ...typography.childHeading1,
  },
  percentText: {
    ...typography.caption,
    color: colors.ink400,
    marginTop: 2,
  },
  heroLabel: {
    ...typography.childLabel,
    color: colors.ink600,
    marginTop: spacing[3],
  },

  // Progress bar
  progressBarTrack: {
    height: 8,
    backgroundColor: colors.ink50,
    marginHorizontal: spacing[4],
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    borderRadius: radius.full,
  },

  // Stars summary
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginHorizontal: spacing[4],
    marginTop: spacing[6],
    paddingVertical: spacing[4],
    backgroundColor: colors.ink50,
    borderRadius: radius.md,
  },
  starItem: {
    alignItems: 'center',
    flex: 1,
  },
  starValue: {
    ...typography.childHeading2,
    color: colors.ink950,
  },
  starCaption: {
    ...typography.caption,
    color: colors.ink400,
    marginTop: 2,
  },
  starDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.ink400,
    opacity: 0.3,
  },

  // Step list
  stepList: {
    marginTop: spacing[6],
    marginHorizontal: spacing[4],
    gap: spacing[2],
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    gap: spacing[3],
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: 'Nunito_700Bold',
  },
  stepInfo: {
    flex: 1,
  },
  stepLabel: {
    ...typography.childBody,
    color: colors.ink950,
  },
  stepStars: {
    ...typography.caption,
    color: colors.ink400,
  },

  // Celebration
  celebrationBlock: {
    marginHorizontal: spacing[4],
    marginTop: spacing[6],
    padding: spacing[5],
    backgroundColor: colors.successLight,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  celebrationText: {
    ...typography.childHeading2,
    color: colors.success,
  },
  celebrationSubtext: {
    ...typography.childBody,
    color: colors.success,
    marginTop: spacing[2],
  },

  // Waiting
  waitingBlock: {
    marginHorizontal: spacing[4],
    marginTop: spacing[6],
    padding: spacing[5],
    backgroundColor: colors.warningLight,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  waitingText: {
    ...typography.childBody,
    color: colors.amber,
    fontFamily: 'Inter_600SemiBold',
  },

  // Bottom button
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing[4],
    paddingBottom: spacing[8],
    backgroundColor: colors.white,
  },
  completeBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing[5],
    alignItems: 'center',
  },
  completeBtnText: {
    ...typography.childButton,
    color: colors.white,
  },
});
