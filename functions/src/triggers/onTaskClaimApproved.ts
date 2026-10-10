import { getPeriodKey } from "../utils/recurrence";
import { FieldValue } from "firebase-admin/firestore";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

export const onTaskClaimApproved = onDocumentUpdated(
  "families/{familyId}/taskClaims/{claimId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.status === "approved" || after.status !== "approved") return;
    const { familyId, claimId } = event.params;
    const { taskId, childProfileId } = after;
    if ([taskId, childProfileId].some((id) => typeof id !== "string" || !id || id.includes("/"))) {
      logger.error("Invalid task award references", { familyId, claimId });
      return;
    }
    const taskRef = db.doc(`families/${familyId}/tasks/${taskId}`);
    const childRef = db.doc(`families/${familyId}/childProfiles/${childProfileId}`);
    const claimRef = db.doc(`families/${familyId}/taskClaims/${claimId}`);
    const step = after.currentMilestoneStep ?? 0;
    if (!Number.isSafeInteger(step) || step < 0) throw new Error("Invalid milestone step");
    const ledgerRef = db.doc(`families/${familyId}/starTransactions/claim-${claimId}-step-${step}`);

    await db.runTransaction(async (transaction) => {
      const family = await transaction.get(db.doc(`families/${familyId}`));
      if (!family.exists || family.data()?.isDeleted) return;
      const ledger = await transaction.get(ledgerRef);
      if (ledger.exists) return;
      const taskSnap = await transaction.get(taskRef);
      const childSnap = await transaction.get(childRef);
      if (!taskSnap.exists || !childSnap.exists) throw new Error("Task or child profile not found");
      const task = taskSnap.data()!;
      const child = childSnap.data()!;
      const totalSteps = task.milestoneSteps ?? 1;
      if (task.isMilestone && (!Number.isSafeInteger(totalSteps) || totalSteps < 1 || step < 1 || step > totalSteps)) {
        throw new Error("Invalid milestone progress");
      }
      const complete = !task.isMilestone || step === totalSteps;
      const stars = task.isMilestone
        ? (task.starsPerStep ?? 0) + (complete ? task.milestoneBonus ?? 0 : 0)
        : task.starValue;
      if (!Number.isSafeInteger(stars) || stars < 0 || stars > 10000) throw new Error("Invalid star award");

      transaction.update(childRef, {
        starBalance: (child.starBalance ?? 0) + stars,
        totalStarsEarned: (child.totalStarsEarned ?? 0) + stars,
        ...(complete ? {
          totalTasksCompleted: (child.totalTasksCompleted ?? 0) + 1,
          categoryCounts: { ...(child.categoryCounts ?? {}), [task.category]: (child.categoryCounts?.[task.category] ?? 0) + 1 },
          weeklyCompletionPeriod: getPeriodKey("weekly", new Date(), family.data()?.timezone || "UTC"),
          weeklyTaskCount: (child.weeklyCompletionPeriod === getPeriodKey("weekly", new Date(), family.data()?.timezone || "UTC") ? child.weeklyTaskCount ?? 0 : 0) + 1,
        } : {}),
        ...(complete && child.activeQuestId === claimId ? { activeQuestId: FieldValue.delete() } : {}),
      });
      transaction.set(ledgerRef, {
        familyAccountId: familyId,
        childProfileId,
        deltaStars: stars,
        transactionType: "taskApproval",
        taskClaimId: claimId,
        milestoneStep: step,
        isQuestCompletion: complete,
        reason: `Approved: ${task.title}`,
        createdAt: FieldValue.serverTimestamp(),
      });
      if (!complete) {
        // Keep the same claim open until the next step is submitted and reviewed.
        transaction.update(claimRef, { status: "claimed", currentMilestoneStep: step + 1 });
      } else if (!task.recurrenceType || task.recurrenceType === "none") {
        // A one-off quest must not award stars repeatedly after completion.
        transaction.update(taskRef, { isActive: false, activeClaimId: FieldValue.delete() });
      }
      // Recurring source tasks retain their lock; the scheduler creates the next instance.
    });
  }
);
