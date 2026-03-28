// S1-01: TypeScript interfaces for all Firestore entities
// Every interface matches ADR-001 / PRD v1.3 schema exactly.
// Union types for enums — enables compile-time safety throughout.

import { Timestamp } from 'firebase/firestore';

// ── Union Types (enums as union types for compile-time safety) ────────────────

export type Category = 'Household' | 'Learning' | 'LifeSkills' | 'Hobbies';

export type AgeGroup = '3-5' | '6-8' | '9-11' | '12-14' | '15-17';

export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'AdultSupervised';

export type TaskStatus = 'active' | 'paused' | 'archived';

export type ClaimStatus = 'claimed' | 'submitted' | 'approved' | 'rejected' | 'released';

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

export type RewardType = 'ScreenTime' | 'Gift' | 'GiftCard' | 'Money' | 'Special';

export type RedemptionStatus = 'pending' | 'approved' | 'declined' | 'redeemed';

export type RequestStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'snoozed'
  | 'completed'
  | 'confirmed'
  | 'auto-confirmed';

export type ConsequenceLevel = 'Yellow' | 'Orange' | 'Red';

export type PeriodType = 'weekly' | 'monthly';

export type ProgressDisplayStyle = 'ProgressBar' | 'Countdown' | 'FuelGauge';

export type FuelGaugeTheme = 'rocket' | 'potion' | 'treasure';

export type TransactionType =
  | 'taskApproval'
  | 'bonusStar'
  | 'deduction'
  | 'redemption'
  | 'streakBonus';

export type ParentTransactionSource = 'requestCompletion';

export type BadgeId =
  | 'B-01' | 'B-02' | 'B-03' | 'B-04' | 'B-05'
  | 'B-06' | 'B-07' | 'B-08' | 'B-09' | 'B-10'
  | 'B-11' | 'B-12' | 'B-13' | 'B-14' | 'B-15';

// ── Firestore Document Interfaces ─────────────────────────────────────────────

export interface FamilyAccount {
  id: string;
  familyName: string;
  memberIds: string[];
  createdAt: Timestamp;
  timezone: string;
  isDeleted: boolean;
  deletedAt?: Timestamp;
}

export interface ParentUser {
  id: string;
  familyAccountId: string;
  firebaseUid: string;
  displayName: string;
  avatarId: string;
  starBalance: number;
  totalStarsEarned: number;
  totalStarsRedeemed: number;
  createdAt: Timestamp;
}

export interface ChildProfile {
  id: string;
  familyAccountId: string;
  nickname: string;
  avatarId: string;
  ageGroup: AgeGroup;
  pinHash: string;
  starBalance: number;
  totalStarsEarned: number;
  totalStarsRedeemed: number;
  weeklyTargetStars: number;
  monthlyTargetStars: number;
  progressDisplayStyle: ProgressDisplayStyle;
  fuelGaugeTheme?: FuelGaugeTheme;
  currentStreakWeeks: number;
  consecutiveMissWeeks: number;
  monthlyConsecutiveMisses: number;
  streakThreshold: number;
  streakBonusStars: number;
  createdAt: Timestamp;
  failedPinAttempts: number;
  lockedUntil?: Timestamp;
}

export interface Task {
  id: string;
  familyAccountId: string;
  title: string;
  description?: string;
  category: Category;
  starValue: number;
  difficulty: Difficulty;
  ageGroupSuggestion: AgeGroup;
  isActive: boolean;
  requiresPhoto: boolean;
  isMilestone: boolean;
  milestoneSteps?: number;
  starsPerStep?: number;
  milestoneBonus?: number;
  recurrenceType: RecurrenceType;
  recurrenceDays?: number[];
  deadline?: Timestamp;
  createdByParentId: string;
  createdAt: Timestamp;
}

export interface TaskClaim {
  id: string;
  familyAccountId: string;
  taskId: string;
  childProfileId: string;
  status: ClaimStatus;
  submittedAt?: Timestamp;
  approvedAt?: Timestamp;
  rejectedAt?: Timestamp;
  rejectionReason?: string;
  photoProofUrl?: string;
  thumbnailUrl?: string;
  claimedAt: Timestamp;
  currentMilestoneStep?: number;
}

export interface StarTransaction {
  id: string;
  familyAccountId: string;
  childProfileId: string;
  deltaStars: number;
  transactionType: TransactionType;
  taskClaimId?: string;
  rewardRedemptionId?: string;
  reason?: string;
  createdAt: Timestamp;
}

export interface ParentStarTransaction {
  id: string;
  parentUserId: string;
  deltaStars: number;
  source: ParentTransactionSource;
  familyRequestId: string;
  createdAt: Timestamp;
}

export interface Reward {
  id: string;
  familyAccountId: string;
  name: string;
  description?: string;
  starCost: number;
  rewardType: RewardType;
  isActive: boolean;
  redemptionCap?: number;
  createdByParentId: string;
  createdAt: Timestamp;
}

export interface Redemption {
  id: string;
  familyAccountId: string;
  rewardId: string;
  childProfileId: string;
  status: RedemptionStatus;
  requestedAt: Timestamp;
  approvedAt?: Timestamp;
  declinedAt?: Timestamp;
  declineReason?: string;
  redeemedAt?: Timestamp;
}

export interface ParentReward {
  id: string;
  familyAccountId: string;
  name: string;
  description?: string;
  starCost: number;
  rewardType: RewardType;
  addedBy: 'parent' | 'child';
  approvedByParent: boolean;
  isActive: boolean;
  createdAt: Timestamp;
}

export interface ParentRedemption {
  id: string;
  parentRewardId: string;
  parentUserId: string;
  requestedAt: Timestamp;
  status: 'redeemed';
  redeemedAt: Timestamp;
}

export interface FamilyRequest {
  id: string;
  familyAccountId: string;
  requestedByChildId: string;
  title: string;
  description?: string;
  category: Category;
  suggestedStars: number;
  agreedStars?: number;
  status: RequestStatus;
  declineReason?: string;
  snoozeUntil?: Timestamp;
  acceptedByParentId?: string;
  createdAt: Timestamp;
  acceptedAt?: Timestamp;
  completedAt?: Timestamp;
  confirmedAt?: Timestamp;
}

export interface ConsequenceDefinition {
  id: string;
  familyAccountId: string;
  childProfileId: string;
  level: ConsequenceLevel;
  name: string;
  description: string;
  durationLabel?: string;
  createdAt: Timestamp;
}

export interface ActiveConsequence {
  id: string;
  familyAccountId: string;
  childProfileId: string;
  consequenceDefinitionId: string;
  level: ConsequenceLevel;
  name: string;
  description: string;
  activatedAt: Timestamp;
  clearedByParentAt?: Timestamp;
}

export interface AccountabilityLog {
  id: string;
  familyAccountId: string;
  childProfileId: string;
  periodType: PeriodType;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  starsEarned: number;
  targetStars: number;
  met: boolean;
  missLevel?: ConsequenceLevel;
  consequenceActivated: boolean;
  streakWeeksAtEval: number;
  createdAt: Timestamp;
}

export interface Achievement {
  id: string;
  familyAccountId: string;
  childProfileId: string;
  badgeId: BadgeId;
  earnedAt: Timestamp;
}

export interface FamilySettings {
  id: string;
  leaderboardEnabled: boolean;
  weeklyRequestLimitPerChild: Record<string, number>;
}

export interface LeaderboardSummary {
  id: string;
  weekly: Record<string, number>;
  monthly: Record<string, number>;
  allTime: Record<string, number>;
  updatedAt: Timestamp;
}

export interface TaskLibraryItem {
  id: string;
  title: string;
  description: string;
  category: Category;
  suggestedStars: number;
  difficulty: Difficulty;
  ageGroupSuggestion: AgeGroup;
  isMilestone: boolean;
  milestoneSteps?: number;
  starsPerStep?: number;
  milestoneBonus?: number;
}
