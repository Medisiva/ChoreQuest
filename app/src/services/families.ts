// S1-09: Family account creation in Firestore
// On new user registration, creates family + parentUser atomically via WriteBatch.
// If the batch fails, neither document is created.

import {
  doc,
  writeBatch,
  collection,
  Timestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { FamilyAccount, ParentUser } from '../types';

interface CreateFamilyParams {
  firebaseUid: string;
  displayName: string;
  familyName: string;
  timezone: string;
}

export async function createFamilyAccount(
  params: CreateFamilyParams
): Promise<{ familyId: string; parentId: string }> {
  const { firebaseUid, displayName, familyName, timezone } = params;

  const batch = writeBatch(db);

  // Create family document
  const familyRef = doc(collection(db, 'families'));
  const familyId = familyRef.id;

  const familyData: Omit<FamilyAccount, 'id'> = {
    familyName,
    memberIds: [firebaseUid],
    createdAt: Timestamp.now(),
    timezone,
    isDeleted: false,
  };

  batch.set(familyRef, familyData);

  // Create parentUser document within the family
  const parentRef = doc(
    db,
    'families',
    familyId,
    'parentUsers',
    firebaseUid
  );

  const parentData: Omit<ParentUser, 'id'> = {
    familyAccountId: familyId,
    firebaseUid,
    displayName,
    avatarId: 'default-parent',
    starBalance: 0,
    totalStarsEarned: 0,
    totalStarsRedeemed: 0,
    createdAt: Timestamp.now(),
  };

  batch.set(parentRef, parentData);

  // Create a top-level parentProfiles mapping doc for quick lookup
  // This allows authStore to find the family without querying all families
  const profileMappingRef = doc(db, 'parentProfiles', firebaseUid);
  batch.set(profileMappingRef, {
    familyAccountId: familyId,
    displayName,
    avatarId: 'default-parent',
    starBalance: 0,
    totalStarsEarned: 0,
    totalStarsRedeemed: 0,
    createdAt: Timestamp.now(),
  });

  // Atomic write — both succeed or both fail
  await batch.commit();

  return { familyId, parentId: firebaseUid };
}

export async function addChildProfile(
  familyId: string,
  childData: {
    nickname: string;
    avatarId: string;
    ageGroup: string;
    pinHash: string;
  }
): Promise<string> {
  const childRef = doc(
    collection(db, 'families', familyId, 'childProfiles')
  );

  const profileData = {
    familyAccountId: familyId,
    nickname: childData.nickname,
    avatarId: childData.avatarId,
    ageGroup: childData.ageGroup,
    pinHash: childData.pinHash,
    starBalance: 0,
    totalStarsEarned: 0,
    totalStarsRedeemed: 0,
    weeklyTargetStars: 20, // Default, parent can change
    monthlyTargetStars: 80,
    progressDisplayStyle: 'ProgressBar',
    currentStreakWeeks: 0,
    consecutiveMissWeeks: 0,
    monthlyConsecutiveMisses: 0,
    streakThreshold: 4,
    streakBonusStars: 10,
    failedPinAttempts: 0,
    createdAt: Timestamp.now(),
  };

  await setDoc(childRef, profileData);

  return childRef.id;
}
