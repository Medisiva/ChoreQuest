// S7-01: Family request service layer
// All status transitions validate current status before writing.

import {
  doc,
  collection,
  writeBatch,
  updateDoc,
  Timestamp,
  setDoc,
  query,
  where,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import type { RequestStatus } from '../types';

interface CreateRequestParams {
  familyAccountId: string;
  requestedByChildId: string;
  title: string;
  description?: string;
  category: 'Household' | 'Learning' | 'LifeSkills' | 'Hobbies';
  suggestedStars: number;
}

export async function createRequest(
  familyId: string,
  params: CreateRequestParams
): Promise<string> {
  const requestRef = doc(collection(db, 'families', familyId, 'familyRequests'));

  await setDoc(requestRef, {
    ...params,
    status: 'pending' as RequestStatus,
    createdAt: Timestamp.now(),
  });

  return requestRef.id;
}

export async function acceptRequest(
  familyId: string,
  requestId: string,
  agreedStars: number,
  parentId: string
): Promise<void> {
  const batch = writeBatch(db);
  const requestRef = doc(db, 'families', familyId, 'familyRequests', requestId);

  batch.update(requestRef, {
    status: 'accepted' as RequestStatus,
    agreedStars,
    acceptedByParentId: parentId,
    acceptedAt: Timestamp.now(),
  });

  await batch.commit();
}

export async function declineRequest(
  familyId: string,
  requestId: string,
  reason: string
): Promise<void> {
  if (!reason.trim()) throw new Error('Decline reason is required');

  await updateDoc(doc(db, 'families', familyId, 'familyRequests', requestId), {
    status: 'declined' as RequestStatus,
    declineReason: reason,
  });
}

export async function snoozeRequest(
  familyId: string,
  requestId: string,
  snoozeDays: number
): Promise<void> {
  const snoozeUntil = Timestamp.fromDate(
    new Date(Date.now() + snoozeDays * 24 * 60 * 60 * 1000)
  );

  await updateDoc(doc(db, 'families', familyId, 'familyRequests', requestId), {
    status: 'snoozed' as RequestStatus,
    snoozeUntil,
  });
}

export async function markRequestComplete(
  familyId: string,
  requestId: string
): Promise<void> {
  await updateDoc(doc(db, 'families', familyId, 'familyRequests', requestId), {
    status: 'completed' as RequestStatus,
    completedAt: Timestamp.now(),
  });
}

export async function confirmRequestComplete(
  familyId: string,
  requestId: string
): Promise<void> {
  await updateDoc(doc(db, 'families', familyId, 'familyRequests', requestId), {
    status: 'confirmed' as RequestStatus,
    confirmedAt: Timestamp.now(),
  });
}

export async function getWeeklyRequestCount(
  familyId: string,
  childId: string
): Promise<number> {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const q = query(
    collection(db, 'families', familyId, 'familyRequests'),
    where('requestedByChildId', '==', childId),
    where('createdAt', '>=', Timestamp.fromDate(monday)),
    orderBy('createdAt', 'desc')
  );

  const snap = await getDocs(q);
  return snap.size;
}
