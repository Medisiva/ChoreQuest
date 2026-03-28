// S4-01: Milestone task state machine utility
// State machine: claimed -> step_in_progress -> step_pending_approval -> (repeat) -> completed
// Uses runTransaction for atomic step increments (never sequential read-then-write).

import { runTransaction, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Task, TaskClaim, ClaimStatus } from '../types';

// ── Types ────────────────────────────────────────────────────────────────────

export type MilestoneStepState =
  | 'claimed'
  | 'step_in_progress'
  | 'step_pending_approval'
  | 'completed';

export interface MilestoneProgress {
  currentStep: number;
  totalSteps: number;
  percentage: number;
  starsEarned: number;
  starsRemaining: number;
  isComplete: boolean;
}

// ── completeMilestoneStep ────────────────────────────────────────────────────

/**
 * Atomically increments the milestone step on a claim document.
 * State transitions:
 *   - If currentStep < totalSteps: increments currentMilestoneStep,
 *     sets status to 'submitted' (pending parent approval for this step).
 *   - If currentStep === totalSteps: sets status to 'submitted' (final submission).
 *
 * Uses runTransaction to prevent race conditions.
 */
export async function completeMilestoneStep(
  familyId: string,
  claimId: string,
  currentStep: number,
  totalSteps: number
): Promise<void> {
  const claimRef = doc(db, 'families', familyId, 'taskClaims', claimId);

  await runTransaction(db, async (transaction) => {
    const claimSnap = await transaction.get(claimRef);

    if (!claimSnap.exists()) {
      throw new Error('Claim not found');
    }

    const claimData = claimSnap.data();
    const storedStep = claimData.currentMilestoneStep ?? 0;

    // Guard: ensure the client step matches what Firestore has
    if (storedStep !== currentStep) {
      throw new Error(
        `Step mismatch: client=${currentStep}, server=${storedStep}`
      );
    }

    const nextStep = currentStep + 1;
    const isLastStep = nextStep >= totalSteps;

    const updates: Record<string, unknown> = {
      currentMilestoneStep: nextStep,
      status: 'submitted' as ClaimStatus,
      submittedAt: Timestamp.now(),
    };

    // If all steps are done, the parent approval of the final step
    // will transition the claim to 'approved' via the cloud function.
    transaction.update(claimRef, updates);
  });
}

// ── getMilestoneProgress ─────────────────────────────────────────────────────

/**
 * Pure function — computes milestone progress from a claim + task.
 * Safe to call from components (no Firestore calls).
 */
export function getMilestoneProgress(
  claim: TaskClaim,
  task: Task
): MilestoneProgress {
  const totalSteps = task.milestoneSteps ?? 1;
  const starsPerStep = task.starsPerStep ?? 0;
  const milestoneBonus = task.milestoneBonus ?? 0;
  const currentStep = claim.currentMilestoneStep ?? 0;

  const isComplete = currentStep >= totalSteps;
  const percentage = totalSteps > 0
    ? Math.round((currentStep / totalSteps) * 100)
    : 0;

  const starsEarned = currentStep * starsPerStep;
  const starsRemaining = isComplete
    ? 0
    : (totalSteps - currentStep) * starsPerStep + milestoneBonus;

  return {
    currentStep,
    totalSteps,
    percentage,
    starsEarned,
    starsRemaining,
    isComplete,
  };
}
