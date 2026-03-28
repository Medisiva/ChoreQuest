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
  deleteDoc,
  setDoc,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import { tasksRef, taskDocRef, taskClaimsRef, taskClaimDocRef } from './firestore';
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

  batch.set(newTaskRef, data);
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
    // Check for existing active claims on this task
    const claimsQuery = query(
      taskClaimsRef(familyId),
      where('taskId', '==', taskId),
      where('status', 'in', ['claimed', 'submitted'] as ClaimStatus[])
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
  const ref = taskClaimDocRef(familyId, claimId);
  await updateDoc(ref, { status: 'released' as ClaimStatus });
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

  await updateDoc(ref, updates);
}
