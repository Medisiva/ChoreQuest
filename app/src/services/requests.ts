// S7-01: Family request service layer
// All status transitions validate current status before writing.

import { doc, collection } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import { useChildSessionStore } from '../stores/childSessionStore';

interface CreateRequestParams {
  familyAccountId: string;
  requestedByChildId: string;
  title: string;
  description?: string;
  category: 'Household' | 'Learning' | 'LifeSkills' | 'Hobbies';
  suggestedStars: number;
  operationId?: string;
}

function sessionToken(childId?: string): string {
  const session = useChildSessionStore.getState();
  if (!session.isSessionValid() || !session.sessionToken || (childId && session.activeChildId !== childId)) throw new Error('Enter your PIN again.');
  return session.sessionToken;
}
export async function createRequest(familyId: string, params: CreateRequestParams): Promise<string> {
  const result = await httpsCallable<Record<string, unknown>, { requestId: string }>(functions, 'createFamilyRequest')({ familyId, childId: params.requestedByChildId, title: params.title, category: params.category, suggestedStars: params.suggestedStars, ...(params.description ? { description: params.description } : {}), operationId: params.operationId || doc(collection(db, 'operationIds')).id, sessionToken: sessionToken(params.requestedByChildId) });
  return result.data.requestId;
}
async function update(familyId: string, requestId: string, status: string, fields: Record<string, unknown> = {}): Promise<void> {
  await httpsCallable(functions, 'updateFamilyRequest')({ familyId, requestId, status, ...fields });
}
export function acceptRequest(familyId: string, requestId: string, agreedStars: number, _parentId: string): Promise<void> {
  return update(familyId, requestId, 'accepted', { agreedStars });
}
export function declineRequest(familyId: string, requestId: string, reason: string): Promise<void> {
  return update(familyId, requestId, 'declined', { reason });
}
export function snoozeRequest(familyId: string, requestId: string, snoozeDays: number): Promise<void> {
  return update(familyId, requestId, 'snoozed', { snoozeDays });
}
export function markRequestComplete(familyId: string, requestId: string): Promise<void> {
  return update(familyId, requestId, 'completed');
}
export function confirmRequestComplete(familyId: string, requestId: string): Promise<void> {
  return update(familyId, requestId, 'confirmed', { sessionToken: sessionToken() });
}
export async function getWeeklyRequestCount(familyId: string, childId: string): Promise<number> {
  const result = await httpsCallable<Record<string, unknown>, { count: number }>(functions, 'getChildRequestCount')({ familyId, childId, sessionToken: sessionToken(childId) });
  return result.data.count;
}

export function returnRequestIncomplete(familyId: string, requestId: string): Promise<void> { return update(familyId, requestId, 'returned', {sessionToken:sessionToken()}); }

export async function getWeeklyRequestAllowance(familyId:string,childId:string):Promise<{count:number;limit:number}>{
 const result=await httpsCallable<Record<string,unknown>,{count:number;limit:number}>(functions,'getChildRequestCount')({familyId,childId,sessionToken:sessionToken(childId)});
 return result.data;
}
