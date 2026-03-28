// S4-03: Cloud Function trigger — fires when a taskClaim status changes to 'approved'
// Credits stars to the child's starBalance via runTransaction,
// writes a StarTransaction record, and logs a placeholder push notification.

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

// ── Types ────────────────────────────────────────────────────────────────────

interface TaskClaimData {
  familyAccountId: string;
  taskId: string;
  childProfileId: string;
  status: string;
  currentMilestoneStep?: number;
  approvedAt?: admin.firestore.Timestamp;
  [key: string]: unknown;
}

interface TaskData {
  starValue: number;
  isMilestone: boolean;
  milestoneSteps?: number;
  starsPerStep?: number;
  milestoneBonus?: number;
  title: string;
  [key: string]: unknown;
}

// ── Trigger ──────────────────────────────────────────────────────────────────

export const onTaskClaimApproved = onDocumentUpdated(
  "families/{familyId}/taskClaims/{claimId}",
  async (event) => {
    const before = event.data?.before.data() as TaskClaimData | undefined;
    const after = event.data?.after.data() as TaskClaimData | undefined;

    if (!before || !after) {
      logger.warn("onTaskClaimApproved: missing before/after data");
      return;
    }

    // Only fire when status transitions TO 'approved'
    if (before.status === "approved" || after.status !== "approved") {
      return;
    }

    const familyId = event.params.familyId;
    const claimId = event.params.claimId;
    const { taskId, childProfileId } = after;

    logger.info(
      `[onTaskClaimApproved] Claim ${claimId} approved for child ${childProfileId}`
    );

    // Read the task to determine star value
    const taskSnap = await db
      .doc(`families/${familyId}/tasks/${taskId}`)
      .get();

    if (!taskSnap.exists) {
      logger.error(
        `[onTaskClaimApproved] Task ${taskId} not found in family ${familyId}`
      );
      return;
    }

    const task = taskSnap.data() as TaskData;

    // Calculate stars to award
    let starsToCredit: number;

    if (task.isMilestone) {
      // For milestone tasks: award starsPerStep for each step + bonus on completion
      const totalSteps = task.milestoneSteps ?? 1;
      const currentStep = after.currentMilestoneStep ?? totalSteps;
      const starsPerStep = task.starsPerStep ?? 0;
      const milestoneBonus = task.milestoneBonus ?? 0;

      if (currentStep >= totalSteps) {
        // Final approval — award remaining step stars + completion bonus
        starsToCredit = starsPerStep + milestoneBonus;
      } else {
        // Individual step approval
        starsToCredit = starsPerStep;
      }
    } else {
      starsToCredit = task.starValue;
    }

    // Use runTransaction to atomically credit stars and write transaction record
    const childRef = db.doc(
      `families/${familyId}/childProfiles/${childProfileId}`
    );
    const txnRef = db.collection(
      `families/${familyId}/starTransactions`
    ).doc();

    await db.runTransaction(async (transaction) => {
      const childSnap = await transaction.get(childRef);

      if (!childSnap.exists) {
        throw new Error(
          `Child profile ${childProfileId} not found in family ${familyId}`
        );
      }

      const childData = childSnap.data();
      const currentBalance = childData?.starBalance ?? 0;
      const totalEarned = childData?.totalStarsEarned ?? 0;

      // Credit stars to child profile
      transaction.update(childRef, {
        starBalance: currentBalance + starsToCredit,
        totalStarsEarned: totalEarned + starsToCredit,
      });

      // Write StarTransaction record
      transaction.set(txnRef, {
        familyAccountId: familyId,
        childProfileId,
        deltaStars: starsToCredit,
        transactionType: "taskApproval",
        taskClaimId: claimId,
        reason: `Approved: ${task.title}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    logger.info(
      `[onTaskClaimApproved] Credited ${starsToCredit} stars to child ${childProfileId}`
    );

    // ── Placeholder: Push Notification ─────────────────────────────────────
    logger.info(
      `[onTaskClaimApproved] TODO: Send push notification to child ${childProfileId} — ` +
        `"Your quest '${task.title}' was approved! +${starsToCredit} stars"`
    );

    // ── Placeholder: Badge Unlock Check ────────────────────────────────────
    logger.info(
      `[onTaskClaimApproved] TODO: Check badge unlock criteria for child ${childProfileId}`
    );
  }
);
