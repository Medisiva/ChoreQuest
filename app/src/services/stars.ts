import { doc, collection } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import { useChildSessionStore } from '../stores/childSessionStore';

function operationId(): string {
  // Firestore generates the ID locally; no client ledger write occurs.
  return doc(collection(db, 'operationIds')).id;
}
async function adjust(familyId: string, childId: string, amount: number, reason: string, type: 'bonusStar' | 'deduction'): Promise<string> {
  const result = await httpsCallable<Record<string, unknown>, { transactionId: string }>(functions, 'adjustChildStars')({ familyId, childId, amount, reason, type, operationId: operationId() });
  return result.data.transactionId;
}
export function awardBonusStars(familyId: string, childProfileId: string, amount: number, reason: string): Promise<string> {
  return adjust(familyId, childProfileId, amount, reason, 'bonusStar');
}
export function deductStars(familyId: string, childProfileId: string, amount: number, reason: string): Promise<string> {
  return adjust(familyId, childProfileId, amount, reason, 'deduction');
}
export async function redeemReward(familyId: string, childProfileId: string, rewardId: string, _starCost: number): Promise<string> {
  const session = useChildSessionStore.getState();
  if (!session.isSessionValid() || session.activeChildId !== childProfileId) throw new Error('Enter your PIN again.');
  const result = await httpsCallable<Record<string, unknown>, { redemptionId: string }>(functions, 'requestChildRedemption')({ familyId, childId: childProfileId, rewardId, sessionToken: session.sessionToken, operationId: operationId() });
  return result.data.redemptionId;
}
export async function approveRedemption(familyId: string, redemptionId: string, _childProfileId: string, _starCost: number): Promise<void> {
  await httpsCallable(functions, 'reviewChildRedemption')({ familyId, redemptionId, status: 'approved' });
}
export async function declineRedemption(familyId: string, redemptionId: string, reason?: string): Promise<void> {
  await httpsCallable(functions, 'reviewChildRedemption')({ familyId, redemptionId, status: 'declined', ...(reason ? { reason } : {}) });
}

export async function redeemParentReward(familyId: string, rewardId: string): Promise<void> {
  await httpsCallable(functions, 'reviewChildRedemption')({ familyId, rewardId, kind: 'parent', operationId: operationId() });
}
