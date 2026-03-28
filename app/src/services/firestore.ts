// S1-03: Firestore service layer — typed collection references
// Uses withConverter() on all collection refs — eliminates all casting.
// One function per collection reference. All collection paths centralised here.

import {
  collection,
  doc,
  CollectionReference,
  DocumentReference,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  FamilyAccount,
  ParentUser,
  ChildProfile,
  Task,
  TaskClaim,
  StarTransaction,
  ParentStarTransaction,
  Reward,
  Redemption,
  ParentReward,
  ParentRedemption,
  FamilyRequest,
  ConsequenceDefinition,
  ActiveConsequence,
  AccountabilityLog,
  Achievement,
  FamilySettings,
  LeaderboardSummary,
  TaskLibraryItem,
} from '../types';

// Generic converter factory — adds `id` from the document snapshot
function createConverter<T extends { id: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore(data: T) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...rest } = data;
      return rest;
    },
    fromFirestore(
      snapshot: QueryDocumentSnapshot,
      options?: SnapshotOptions
    ): T {
      const data = snapshot.data(options);
      return { id: snapshot.id, ...data } as T;
    },
  };
}

// ── Converters ────────────────────────────────────────────────────────────────

const familyConverter = createConverter<FamilyAccount>();
const parentUserConverter = createConverter<ParentUser>();
const childProfileConverter = createConverter<ChildProfile>();
const taskConverter = createConverter<Task>();
const taskClaimConverter = createConverter<TaskClaim>();
const starTransactionConverter = createConverter<StarTransaction>();
const parentStarTransactionConverter = createConverter<ParentStarTransaction>();
const rewardConverter = createConverter<Reward>();
const redemptionConverter = createConverter<Redemption>();
const parentRewardConverter = createConverter<ParentReward>();
const parentRedemptionConverter = createConverter<ParentRedemption>();
const familyRequestConverter = createConverter<FamilyRequest>();
const consequenceDefConverter = createConverter<ConsequenceDefinition>();
const activeConsequenceConverter = createConverter<ActiveConsequence>();
const accountabilityLogConverter = createConverter<AccountabilityLog>();
const achievementConverter = createConverter<Achievement>();
const familySettingsConverter = createConverter<FamilySettings>();
const leaderboardConverter = createConverter<LeaderboardSummary>();
const taskLibraryConverter = createConverter<TaskLibraryItem>();

// ── Collection References ─────────────────────────────────────────────────────

export function familiesRef(): CollectionReference<FamilyAccount> {
  return collection(db, 'families').withConverter(familyConverter);
}

export function familyDocRef(familyId: string): DocumentReference<FamilyAccount> {
  return doc(db, 'families', familyId).withConverter(familyConverter);
}

export function parentUsersRef(familyId: string): CollectionReference<ParentUser> {
  return collection(db, 'families', familyId, 'parentUsers').withConverter(parentUserConverter);
}

export function parentUserDocRef(familyId: string, parentId: string): DocumentReference<ParentUser> {
  return doc(db, 'families', familyId, 'parentUsers', parentId).withConverter(parentUserConverter);
}

export function childProfilesRef(familyId: string): CollectionReference<ChildProfile> {
  return collection(db, 'families', familyId, 'childProfiles').withConverter(childProfileConverter);
}

export function childProfileDocRef(familyId: string, childId: string): DocumentReference<ChildProfile> {
  return doc(db, 'families', familyId, 'childProfiles', childId).withConverter(childProfileConverter);
}

export function tasksRef(familyId: string): CollectionReference<Task> {
  return collection(db, 'families', familyId, 'tasks').withConverter(taskConverter);
}

export function taskDocRef(familyId: string, taskId: string): DocumentReference<Task> {
  return doc(db, 'families', familyId, 'tasks', taskId).withConverter(taskConverter);
}

export function taskClaimsRef(familyId: string): CollectionReference<TaskClaim> {
  return collection(db, 'families', familyId, 'taskClaims').withConverter(taskClaimConverter);
}

export function taskClaimDocRef(familyId: string, claimId: string): DocumentReference<TaskClaim> {
  return doc(db, 'families', familyId, 'taskClaims', claimId).withConverter(taskClaimConverter);
}

export function starTransactionsRef(familyId: string): CollectionReference<StarTransaction> {
  return collection(db, 'families', familyId, 'starTransactions').withConverter(starTransactionConverter);
}

export function parentStarTransactionsRef(familyId: string): CollectionReference<ParentStarTransaction> {
  return collection(db, 'families', familyId, 'parentStarTransactions').withConverter(parentStarTransactionConverter);
}

export function rewardsRef(familyId: string): CollectionReference<Reward> {
  return collection(db, 'families', familyId, 'rewards').withConverter(rewardConverter);
}

export function redemptionsRef(familyId: string): CollectionReference<Redemption> {
  return collection(db, 'families', familyId, 'redemptions').withConverter(redemptionConverter);
}

export function parentRewardsRef(familyId: string): CollectionReference<ParentReward> {
  return collection(db, 'families', familyId, 'parentRewards').withConverter(parentRewardConverter);
}

export function parentRedemptionsRef(familyId: string): CollectionReference<ParentRedemption> {
  return collection(db, 'families', familyId, 'parentRedemptions').withConverter(parentRedemptionConverter);
}

export function familyRequestsRef(familyId: string): CollectionReference<FamilyRequest> {
  return collection(db, 'families', familyId, 'familyRequests').withConverter(familyRequestConverter);
}

export function familyRequestDocRef(familyId: string, requestId: string): DocumentReference<FamilyRequest> {
  return doc(db, 'families', familyId, 'familyRequests', requestId).withConverter(familyRequestConverter);
}

export function consequenceDefsRef(familyId: string): CollectionReference<ConsequenceDefinition> {
  return collection(db, 'families', familyId, 'consequenceDefinitions').withConverter(consequenceDefConverter);
}

export function activeConsequencesRef(familyId: string): CollectionReference<ActiveConsequence> {
  return collection(db, 'families', familyId, 'activeConsequences').withConverter(activeConsequenceConverter);
}

export function accountabilityLogsRef(familyId: string): CollectionReference<AccountabilityLog> {
  return collection(db, 'families', familyId, 'accountabilityLogs').withConverter(accountabilityLogConverter);
}

export function achievementsRef(familyId: string): CollectionReference<Achievement> {
  return collection(db, 'families', familyId, 'achievements').withConverter(achievementConverter);
}

export function familySettingsDocRef(familyId: string): DocumentReference<FamilySettings> {
  return doc(db, 'families', familyId, 'settings', 'config').withConverter(familySettingsConverter);
}

export function leaderboardDocRef(familyId: string): DocumentReference<LeaderboardSummary> {
  return doc(db, 'leaderboard', familyId).withConverter(leaderboardConverter);
}

export function taskLibraryRef(): CollectionReference<TaskLibraryItem> {
  return collection(db, 'taskLibrary').withConverter(taskLibraryConverter);
}
