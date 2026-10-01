import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { documentId, positiveStars, requireParent, requireChildSession } from "../utils/authorization";

export const adjustChildStars = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first");
  const input = request.data; const familyId = documentId(input?.familyId); const childId = documentId(input?.childId); const operationId = documentId(input?.operationId);
  const amount = positiveStars(input.amount);
  if (!["bonusStar", "deduction"].includes(input.type) || typeof input.reason !== "string" || !input.reason.trim() || input.reason.length > 500) throw new HttpsError("invalid-argument", "A reason is required");
  const db = admin.firestore(); const profile = db.doc(`families/${familyId}/childProfiles/${childId}`);
  const ledger = db.doc(`families/${familyId}/starTransactions/adjust-${operationId}`);
  await db.runTransaction(async (transaction) => {
    await requireParent(transaction, familyId, request.auth!.uid);
    const existing = await transaction.get(ledger); const child = await transaction.get(profile);
    if (existing.exists) {
      const previous = existing.data()!;
      if (previous.childProfileId !== childId || previous.transactionType !== input.type || previous.requestedAmount !== amount || previous.createdByParentId !== request.auth!.uid) throw new HttpsError("already-exists", "Operation ID already used");
      return;
    }
    if (!child.exists) throw new HttpsError("not-found", "Profile not found");
    const balance = child.data()!.starBalance;
    if (!Number.isSafeInteger(balance) || balance < 0) throw new HttpsError("failed-precondition", "Invalid balance");
    const delta = input.type === "bonusStar" ? amount : -Math.min(amount, balance);
    const updates: Record<string, unknown> = { starBalance: balance + delta };
    if (delta > 0) updates.totalStarsEarned = (child.data()!.totalStarsEarned || 0) + delta;
    transaction.update(profile, updates);
    transaction.create(ledger, { familyAccountId: familyId, childProfileId: childId, deltaStars: delta, requestedAmount: amount, transactionType: input.type, reason: input.reason.trim(), createdByParentId: request.auth!.uid, createdAt: FieldValue.serverTimestamp() });
  });
  return { transactionId: ledger.id };
});

export const requestChildRedemption = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first");
  const input = request.data; const familyId = documentId(input?.familyId); const childId = documentId(input?.childId); const rewardId = documentId(input?.rewardId); const operationId = documentId(input?.operationId);
  const db = admin.firestore(); const ref = db.doc(`families/${familyId}/redemptions/${operationId}`);
  await db.runTransaction(async (transaction) => {
    await requireParent(transaction, familyId, request.auth!.uid);
    const child = await requireChildSession(transaction, familyId, childId, request.auth!.uid, input.sessionToken);
    const reward = await transaction.get(db.doc(`families/${familyId}/rewards/${rewardId}`));
    const existing = await transaction.get(ref);
    if (existing.exists) {
      if (existing.data()?.childProfileId !== childId || existing.data()?.rewardId !== rewardId) throw new HttpsError("already-exists", "Request ID already used");
      return;
    }
    if (!reward.exists || !reward.data()?.isActive) throw new HttpsError("not-found", "Reward unavailable");
    const cost = positiveStars(reward.data()!.starCost);
    if (child.data()!.starBalance < cost) throw new HttpsError("failed-precondition", "Not enough stars");
    transaction.create(ref, { familyAccountId: familyId, childProfileId: childId, rewardId, starCost: cost, rewardName: reward.data()!.name, status: "pending", requestedAt: FieldValue.serverTimestamp() });
  });
  return { redemptionId: ref.id };
});

export const reviewChildRedemption = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first");
  const input = request.data; const familyId = documentId(input?.familyId); const redemptionId = documentId(input?.redemptionId);
  if (!["approved", "declined"].includes(input.status)) throw new HttpsError("invalid-argument", "Invalid review");
  const db = admin.firestore(); const ref = db.doc(`families/${familyId}/redemptions/${redemptionId}`);
  await db.runTransaction(async (transaction) => {
    await requireParent(transaction, familyId, request.auth!.uid);
    const redemption = await transaction.get(ref);
    if (!redemption.exists) throw new HttpsError("not-found", "Request not found");
    const data = redemption.data()!;
    if (data.status === input.status) return; // Safe repeat of an already-applied review.
    if (data.status !== "pending") throw new HttpsError("failed-precondition", "Request already reviewed");
    if (input.status === "declined") {
      transaction.update(ref, { status: "declined", declinedAt: FieldValue.serverTimestamp(), ...(typeof input.reason === "string" && input.reason.trim() ? { declineReason: input.reason.trim().slice(0, 500) } : {}) }); return;
    }
    const cost = positiveStars(data.starCost); const childId = documentId(data.childProfileId);
    const profile = db.doc(`families/${familyId}/childProfiles/${childId}`); const child = await transaction.get(profile);
    const ledger = db.doc(`families/${familyId}/starTransactions/redemption-${redemptionId}`); const existing = await transaction.get(ledger);
    if (existing.exists) throw new HttpsError("failed-precondition", "Request ledger is inconsistent");
    if (!child.exists || !Number.isSafeInteger(child.data()?.starBalance) || child.data()!.starBalance < cost) throw new HttpsError("failed-precondition", "Child can no longer afford this reward");
    transaction.update(profile, { starBalance: child.data()!.starBalance - cost, totalStarsRedeemed: (child.data()!.totalStarsRedeemed || 0) + cost });
    transaction.create(ledger, { familyAccountId: familyId, childProfileId: childId, deltaStars: -cost, transactionType: "redemption", rewardRedemptionId: redemptionId, reason: "Reward redemption", createdAt: FieldValue.serverTimestamp() });
    transaction.update(ref, { status: "approved", approvedAt: FieldValue.serverTimestamp() });
  });
  return { success: true };
});
