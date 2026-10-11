// Task service layer — all Firestore writes for tasks and claims.
// Uses typed refs from services/firestore.ts. Never called from components directly.

import {
  doc,
  collection,
  writeBatch,
  runTransaction,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, functions } from './firebase';
import { httpsCallable } from 'firebase/functions';
import { useChildSessionStore } from '../stores/childSessionStore';
import { requireOnline } from './network';
import { taskDocRef } from './firestore';
import type {
  Task,
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
  await requireOnline();
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
  await requireOnline();
  const ref = taskDocRef(familyId, taskId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('Quest not found.');
    const restricted = ['starValue', 'starsPerStep', 'milestoneBonus', 'milestoneSteps', 'isMilestone', 'requiresPhoto', 'recurrenceType', 'recurrenceDays'];
    if (snapshot.data().activeClaimId && restricted.some((key) => key in updates)) throw new Error('Reward and completion requirements cannot change while a quest is claimed.');
    transaction.update(ref, updates);
  });
}

/**
 * Soft delete: sets isActive=false so it disappears from active queries
 * but historical claims still reference it.
 */
export async function deleteTask(
  familyId: string,
  taskId: string
): Promise<void> {
  await requireOnline();
  const ref = taskDocRef(familyId, taskId);
  await updateDoc(ref, { isActive: false });
}

// ── Task Claims ──────────────────────────────────────────────────────────────

/**
 * Claims a task for a child. Uses runTransaction() to prevent race conditions
 * where two children try to claim the same task simultaneously.
 * Throws { code: 'ALREADY_CLAIMED' } if the task already has an active claim.
 */
function childSession(childId?: string): { childId: string; sessionToken: string } {
  const session = useChildSessionStore.getState();
  if (!session.isSessionValid() || !session.activeChildId || !session.sessionToken || (childId && childId !== session.activeChildId)) throw new Error('Enter your PIN again.');
  return { childId: session.activeChildId, sessionToken: session.sessionToken };
}
export async function claimTask(familyId: string, taskId: string, childProfileId: string): Promise<string> {
  await requireOnline();
  try {
    const result = await httpsCallable<Record<string, unknown>, { claimId: string }>(functions, 'claimChildQuest')({ familyId, taskId, ...childSession(childProfileId), operationId: doc(collection(db, 'operationIds')).id });
    return result.data.claimId;
  } catch (error) {
    if ((error as { code?: string }).code === 'functions/already-exists') throw { code: 'ALREADY_CLAIMED' };
    throw error;
  }
}
export async function releaseTask(familyId: string, claimId: string): Promise<void> {
  await requireOnline();
  await httpsCallable(functions, 'updateChildQuest')({ familyId, claimId, ...childSession(), status: 'released' });
}
export async function submitTaskCompletion(familyId: string, claimId: string, photoProofUrl?: string): Promise<void> {
  await requireOnline();
  await httpsCallable(functions, 'updateChildQuest')({ familyId, claimId, ...childSession(), status: 'submitted', ...(photoProofUrl ? { photoProofUrl } : {}) });
}
export async function reviewTaskClaims(familyId: string, claimIds: string[], decision: 'approved' | 'rejected', reason?: string): Promise<void> {
  if (!claimIds.length) return;
  await requireOnline();
  await httpsCallable(functions, 'reviewChildQuests')({ familyId, claimIds, decision, ...(reason ? { reason } : {}) });
}
