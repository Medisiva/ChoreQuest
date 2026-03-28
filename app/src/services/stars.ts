// S5: Star transaction service — all star balance mutations.
// Uses runTransaction() for every balance change — never sequential read-then-write.
// Redemptions follow a two-phase flow: request (no deduction) → parent approval (deduction).

import {
  runTransaction,
  doc,
  collection,
  setDoc,
  updateDoc,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { StarTransaction, TransactionType, RedemptionStatus } from '../types';

// ── Award Bonus Stars ───────────────────────────────────────────────────────

/**
 * Awards bonus stars to a child. Uses runTransaction to atomically
 * read the current balance, add the amount, and write both the updated
 * balance and a StarTransaction document.
 */
export async function awardBonusStars(
  familyId: string,
  childProfileId: string,
  amount: number,
  reason: string
): Promise<string> {
  const childRef = doc(db, 'families', familyId, 'childProfiles', childProfileId);
  const txnRef = doc(collection(db, 'families', familyId, 'starTransactions'));
  const txnId = txnRef.id;

  await runTransaction(db, async (transaction) => {
    const childSnap = await transaction.get(childRef);
    if (!childSnap.exists()) {
      throw new Error('Child profile not found');
    }

    const currentBalance = childSnap.data().starBalance as number;
    const currentTotalEarned = childSnap.data().totalStarsEarned as number;

    transaction.update(childRef, {
      starBalance: currentBalance + amount,
      totalStarsEarned: currentTotalEarned + amount,
    });

    const txnData: Omit<StarTransaction, 'id'> = {
      familyAccountId: familyId,
      childProfileId,
      deltaStars: amount,
      transactionType: 'bonusStar' as TransactionType,
      reason,
      createdAt: Timestamp.now(),
    };

    transaction.set(txnRef, txnData);
  });

  return txnId;
}

// ── Deduct Stars ────────────────────────────────────────────────────────────

/**
 * Deducts stars from a child. Floors the balance at 0 (never goes negative).
 * Creates a StarTransaction with a negative delta.
 */
export async function deductStars(
  familyId: string,
  childProfileId: string,
  amount: number,
  reason: string
): Promise<string> {
  const childRef = doc(db, 'families', familyId, 'childProfiles', childProfileId);
  const txnRef = doc(collection(db, 'families', familyId, 'starTransactions'));
  const txnId = txnRef.id;

  await runTransaction(db, async (transaction) => {
    const childSnap = await transaction.get(childRef);
    if (!childSnap.exists()) {
      throw new Error('Child profile not found');
    }

    const currentBalance = childSnap.data().starBalance as number;
    // Cap deduction so balance never goes below 0
    const actualDeduction = Math.min(amount, currentBalance);

    transaction.update(childRef, {
      starBalance: currentBalance - actualDeduction,
    });

    const txnData: Omit<StarTransaction, 'id'> = {
      familyAccountId: familyId,
      childProfileId,
      deltaStars: -actualDeduction,
      transactionType: 'deduction' as TransactionType,
      reason,
      createdAt: Timestamp.now(),
    };

    transaction.set(txnRef, txnData);
  });

  return txnId;
}

// ── Redeem Reward (Request Phase) ───────────────────────────────────────────

/**
 * Creates a Redemption doc with status 'pending'.
 * Does NOT deduct stars — deduction only happens on parent approval.
 */
export async function redeemReward(
  familyId: string,
  childProfileId: string,
  rewardId: string,
  starCost: number
): Promise<string> {
  const redemptionRef = doc(collection(db, 'families', familyId, 'redemptions'));
  const redemptionId = redemptionRef.id;

  await setDoc(redemptionRef, {
    familyAccountId: familyId,
    rewardId,
    childProfileId,
    starCost,
    status: 'pending' as RedemptionStatus,
    requestedAt: Timestamp.now(),
  });

  return redemptionId;
}

// ── Approve Redemption (Deduction Phase) ────────────────────────────────────

/**
 * Parent approves a redemption: verifies the child can still afford it,
 * deducts stars atomically, writes a StarTransaction, and updates the
 * redemption status to 'approved'.
 */
export async function approveRedemption(
  familyId: string,
  redemptionId: string,
  childProfileId: string,
  starCost: number
): Promise<void> {
  const childRef = doc(db, 'families', familyId, 'childProfiles', childProfileId);
  const redemptionRef = doc(db, 'families', familyId, 'redemptions', redemptionId);
  const txnRef = doc(collection(db, 'families', familyId, 'starTransactions'));

  await runTransaction(db, async (transaction) => {
    const childSnap = await transaction.get(childRef);
    if (!childSnap.exists()) {
      throw new Error('Child profile not found');
    }

    const currentBalance = childSnap.data().starBalance as number;
    if (currentBalance < starCost) {
      throw { code: 'INSUFFICIENT_STARS', message: 'Child can no longer afford this reward' };
    }

    const currentTotalRedeemed = childSnap.data().totalStarsRedeemed as number;

    // Deduct stars
    transaction.update(childRef, {
      starBalance: currentBalance - starCost,
      totalStarsRedeemed: currentTotalRedeemed + starCost,
    });

    // Write star transaction
    const txnData: Omit<StarTransaction, 'id'> = {
      familyAccountId: familyId,
      childProfileId,
      deltaStars: -starCost,
      transactionType: 'redemption' as TransactionType,
      rewardRedemptionId: redemptionId,
      reason: 'Reward redemption',
      createdAt: Timestamp.now(),
    };

    transaction.set(txnRef, txnData);

    // Update redemption status
    transaction.update(redemptionRef, {
      status: 'approved' as RedemptionStatus,
      approvedAt: Timestamp.now(),
    });
  });
}

// ── Decline Redemption ──────────────────────────────────────────────────────

/**
 * Parent declines a redemption. No star deduction occurs.
 */
export async function declineRedemption(
  familyId: string,
  redemptionId: string,
  reason?: string
): Promise<void> {
  const redemptionRef = doc(db, 'families', familyId, 'redemptions', redemptionId);

  await updateDoc(redemptionRef, {
    status: 'declined' as RedemptionStatus,
    declinedAt: Timestamp.now(),
    ...(reason ? { declineReason: reason } : {}),
  });
}
