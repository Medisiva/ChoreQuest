// Task service layer — all Firestore writes for tasks and claims.
// Uses typed refs from services/firestore.ts. Never called from components directly.

import {
  doc,
  collection,
  writeBatch,
  runTransaction,
  Timestamp,
  query,
  where,
  getDocs,
  updateDoc,
  deleteField,
} from 'firebase/firestore';
import { db } from './firebase';
import { taskDocRef, taskClaimsRef, taskClaimDocRef } from './firestore';
import type {
  Task,
  TaskClaim,
  ClaimStatus,
  Category,
  Difficulty,
  AgeGroup,
  RecurrenceType,
} from '../types';

// ── Types ────────────────────────────────────────────────────────────────────

interface CreateTaskData {
  title: string;
  description?: string;
  category: Category;
  starValue: number;
  difficulty: Difficulty;
  ageGroupSuggestion: AgeGroup;
  requiresPhoto: boolean;
  isMilestone: boolean;
  milestoneSteps?: number;
  starsPerStep?: number;
  milestoneBonus?: number;
  recurrenceType: RecurrenceType;
  recurrenceDays?: number[];
  deadline?: Timestamp;
  createdByParentId: string;
}

// ── Task CRUD ────────────────────────────────────────────────────────────────

/**
 * Creates a task in families/{familyId}/tasks using a WriteBatch.
 * Returns the generated task ID.
 */
export async function createTask(
  familyId: string,
  taskData: CreateTaskData
): Promise<string> {
  const batch = writeBatch(db);

  const newTaskRef = doc(collection(db, 'families', familyId, 'tasks'));
  const taskId = newTaskRef.id;

  const data: Omit<Task, 'id'> = {
    familyAccountId: familyId,
    title: taskData.title,
    description: taskData.description,
    category: taskData.category,
    starValue: taskData.starValue,
    difficulty: taskData.difficulty,
    ageGroupSuggestion: taskData.ageGroupSuggestion,
    requiresPhoto: taskData.requiresPhoto,
    isMilestone: taskData.isMilestone,
    milestoneSteps: taskData.milestoneSteps,
    starsPerStep: taskData.starsPerStep,
    milestoneBonus: taskData.milestoneBonus,
    recurrenceType: taskData.recurrenceType,
    recurrenceDays: taskData.recurrenceDays,
    deadline: taskData.deadline,
    createdByParentId: taskData.createdByParentId,
    isActive: true,
    createdAt: Timestamp.now(),
  };

  const definedData = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  batch.set(newTaskRef, definedData);
  await batch.commit();

  return taskId;
}

/**
 * Partial update on a task document.
 */
export async function updateTask(
  familyId: string,
  taskId: string,
  updates: Partial<Omit<Task, 'id' | 'familyAccountId' | 'createdAt' | 'createdByParentId'>>
): Promise<void> {
  const ref = taskDocRef(familyId, taskId);
  await updateDoc(ref, updates);
}

/**
 * Soft delete: sets isActive=false so it disappears from active queries
 * but historical claims still reference it.
 */
export async function deleteTask(
  familyId: string,
  taskId: string
): Promise<void> {
  const ref = taskDocRef(familyId, taskId);
  await updateDoc(ref, { isActive: false });
}

// ── Task Claims ──────────────────────────────────────────────────────────────

/**
 * Claims a task for a child. Uses runTransaction() to prevent race conditions
 * where two children try to claim the same task simultaneously.
 * Throws { code: 'ALREADY_CLAIMED' } if the task already has an active claim.
 */
export async function claimTask(
  familyId: string,
  taskId: string,
  childProfileId: string
): Promise<string> {
  const claimId = await runTransaction(db, async (transaction) => {
    const taskRef = taskDocRef(familyId, taskId);
    const taskSnapshot = await transaction.get(taskRef);
    if (!taskSnapshot.exists() || !taskSnapshot.data().isActive) {
      throw new Error('This quest is no longer available.');
    }
    if (taskSnapshot.data().activeClaimId) throw { code: 'ALREADY_CLAIMED' };
    // Check pre-existing claims created before task locking was introduced.
    const claimsQuery = query(
      taskClaimsRef(familyId),
      where('taskId', '==', taskId),
      where('status', 'in', ['claimed', 'submitted', 'rejected'] as ClaimStatus[])
    );

    const existingClaims = await getDocs(claimsQuery);

    if (!existingClaims.empty) {
      throw { code: 'ALREADY_CLAIMED' };
    }

    // Create the new claim
    const newClaimRef = doc(collection(db, 'families', familyId, 'taskClaims'));

    const claimData: Omit<TaskClaim, 'id'> = {
      familyAccountId: familyId,
      taskId,
      childProfileId,
      status: 'claimed',
      claimedAt: Timestamp.now(),
    };

    transaction.set(newClaimRef, claimData);
    transaction.update(taskRef, { activeClaimId: newClaimRef.id });

    return newClaimRef.id;
  });

  return claimId;
}

/**
 * Releases a claim so another child can pick up the task.
 */
export async function releaseTask(
  familyId: string,
  claimId: string
): Promise<void> {
  const claimRef = taskClaimDocRef(familyId, claimId);
  await runTransaction(db, async (transaction) => {
    const claim = await transaction.get(claimRef);
    if (!claim.exists() || !['claimed', 'rejected'].includes(claim.data().status)) {
      throw new Error('Only an unfinished quest can be released.');
    }
    const taskRef = taskDocRef(familyId, claim.data().taskId);
    const task = await transaction.get(taskRef);
    transaction.update(claimRef, { status: 'released' });
    if (task.exists() && task.data().activeClaimId === claimId) {
      transaction.update(taskRef, { activeClaimId: deleteField() });
    }
  });
}

/**
 * Marks a claimed task as submitted for parent review.
 * Optionally attaches a photo proof URL.
 */
export async function submitTaskCompletion(
  familyId: string,
  claimId: string,
  photoProofUrl?: string
): Promise<void> {
  const ref = taskClaimDocRef(familyId, claimId);

  const updates: Record<string, unknown> = {
    status: 'submitted' as ClaimStatus,
    submittedAt: Timestamp.now(),
  };

  if (photoProofUrl) {
    updates.photoProofUrl = photoProofUrl;
  }

  await runTransaction(db, async (transaction) => {
    const claim = await transaction.get(ref);
    if (!claim.exists() || !['claimed', 'rejected'].includes(claim.data().status)) {
      throw new Error('Only an active quest can be submitted.');
    }
    transaction.update(ref, updates);
  });
}

/** Reviews submitted claims atomically, including the approve-all flow. */
export async function reviewTaskClaims(
  familyId: string,
  claimIds: string[],
  decision: 'approved' | 'rejected',
  reason?: string
): Promise<void> {
  if (!claimIds.length) return;
  if (claimIds.length > 100) throw new Error('Review at most 100 quests at a time.');
  if (decision === 'rejected' && !reason?.trim()) throw new Error('A reason is required.');
  await runTransaction(db, async (transaction) => {
    const refs = [...new Set(claimIds)].map((id) => taskClaimDocRef(familyId, id));
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
    for (const snapshot of snapshots) {
      if (!snapshot.exists() || snapshot.data().status !== 'submitted') {
        throw new Error('The review queue changed. Refresh and try again.');
      }
    }
    for (const ref of refs) {
      transaction.update(ref, decision === 'approved'
        ? { status: 'approved', approvedAt: Timestamp.now() }
        : { status: 'rejected', rejectedAt: Timestamp.now(), rejectionReason: reason!.trim() });
    }
  });
}
