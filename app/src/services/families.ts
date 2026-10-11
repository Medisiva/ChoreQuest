// S1-09: Family account creation in Firestore
// On new user registration, creates family + parentUser atomically via WriteBatch.
// If the batch fails, neither document is created.

import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

interface CreateFamilyParams {
  firebaseUid: string;
  displayName: string;
  familyName: string;
  timezone: string;
}

export async function createFamilyAccount(
  params: CreateFamilyParams
): Promise<{ familyId: string; parentId: string }> {
  const setup = httpsCallable<CreateFamilyParams, { familyId: string; parentId: string }>(functions, 'setupFamily');
  const result = await setup(params);
  return result.data;
}

export async function addChildProfile(
  familyId: string,
  childData: {
    nickname: string;
    avatarId: string;
    ageGroup: string;
    pin: string;
  }
): Promise<string> {
  const create = httpsCallable<Record<string, unknown>, { childId: string }>(functions, 'createChildProfile');
  const result = await create({ familyId, ...childData });
  return result.data.childId;
}

export async function resetChildPin(familyId: string, childId: string, pin: string): Promise<void> {
  await httpsCallable(functions, 'resetChildPin')({ familyId, childId, pin });
}

export async function setupFamily(data: Record<string, unknown>): Promise<void> {
  await httpsCallable(functions, 'setupFamily')(data);
}

export async function manageFamily<T = {success:boolean}>(data: Record<string,unknown>): Promise<T> {
  return (await httpsCallable<Record<string,unknown>,T>(functions,'setupFamily')(data)).data;
}
