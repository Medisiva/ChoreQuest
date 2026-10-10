import { collection, doc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { RewardType } from '../types';
export async function createReward(familyId: string, parentId: string, input: { name: string; starCost: number; rewardType: RewardType }) {
 if (!input.name.trim() || !Number.isSafeInteger(input.starCost) || input.starCost < 1 || input.starCost > 1000) throw new Error('Enter a reward name and a cost from 1 to 1000 stars.');
 const ref = doc(collection(db, 'families', familyId, 'rewards'));
 await setDoc(ref, { familyAccountId: familyId, name: input.name.trim(), starCost: input.starCost, rewardType: input.rewardType, isActive: true, createdByParentId: parentId, createdAt: Timestamp.now() });
 return ref.id;
}
export async function reviewSuggestedParentReward(familyId: string, rewardId: string, approve: boolean) {
 await updateDoc(doc(db, 'families', familyId, 'parentRewards', rewardId), approve ? { approvedByParent: true } : { isActive: false });
}
