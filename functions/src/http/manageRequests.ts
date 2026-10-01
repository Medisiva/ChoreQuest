import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { documentId, requireParent, requireChildSession } from "../utils/authorization";
import { getPeriodKey } from "../utils/recurrence";

export const createFamilyRequest = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first");
  const input = request.data; const familyId = documentId(input?.familyId); const childId = documentId(input?.childId); const operationId = documentId(input?.operationId);
  if (typeof input.title !== "string" || !input.title.trim() || input.title.length > 120 ||
      (input.description !== undefined && (typeof input.description !== "string" || input.description.length > 1000)) ||
      !["Household", "Learning", "LifeSkills", "Hobbies"].includes(input.category) || !Number.isSafeInteger(input.suggestedStars) || input.suggestedStars < 0 || input.suggestedStars > 1000) throw new HttpsError("invalid-argument", "Check the request details");
  const db = admin.firestore(); const ref = db.doc(`families/${familyId}/familyRequests/${operationId}`);
  await db.runTransaction(async (transaction) => {
    await requireParent(transaction, familyId, request.auth!.uid);
    const child = await requireChildSession(transaction, familyId, childId, request.auth!.uid, input.sessionToken);
    const existing = await transaction.get(ref); const family = await transaction.get(db.doc(`families/${familyId}`));
    const settings = await transaction.get(db.doc(`families/${familyId}/settings/config`));
    if (existing.exists) {
      if (existing.data()?.requestedByChildId !== childId) throw new HttpsError("already-exists", "Request ID already used");
      return;
    }
    const period = getPeriodKey("weekly", new Date(), family.data()?.timezone || "UTC");
    const configured = settings.data()?.weeklyRequestLimitPerChild?.[childId] ?? 3;
    if (!Number.isSafeInteger(configured) || configured < 0 || configured > 100) throw new HttpsError("failed-precondition", "Invalid request limit");
    const count = child.data()?.requestCountPeriod === period ? child.data()?.weeklyRequestCount || 0 : 0;
    if (count >= configured) throw new HttpsError("resource-exhausted", "Weekly request limit reached");
    transaction.create(ref, { familyAccountId: familyId, requestedByChildId: childId, title: input.title.trim(), ...(input.description?.trim() ? { description: input.description.trim() } : {}), category: input.category, suggestedStars: input.suggestedStars, status: "pending", createdAt: FieldValue.serverTimestamp() });
    transaction.update(child.ref, { requestCountPeriod: period, weeklyRequestCount: count + 1 });
  });
  return { requestId: ref.id };
});

export const updateFamilyRequest = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first");
  const input = request.data; const familyId = documentId(input?.familyId); const requestId = documentId(input?.requestId);
  if (!["accepted", "declined", "snoozed", "completed", "confirmed"].includes(input.status)) throw new HttpsError("invalid-argument", "Invalid request action");
  const db = admin.firestore(); const ref = db.doc(`families/${familyId}/familyRequests/${requestId}`);
  await db.runTransaction(async (transaction) => {
    await requireParent(transaction, familyId, request.auth!.uid);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError("not-found", "Request not found");
    const data = snapshot.data()!;
    // Child confirmation is bound to the child that created the request.
    if (input.status === "confirmed") await requireChildSession(transaction, familyId, documentId(data.requestedByChildId), request.auth!.uid, input.sessionToken);
    const now = FieldValue.serverTimestamp();
    const updates: Record<string, unknown> = { status: input.status };
    if (input.status === "accepted") {
      if (!Number.isSafeInteger(input.agreedStars) || input.agreedStars < 0 || input.agreedStars > 1000) throw new HttpsError("invalid-argument", "Invalid star amount");
      updates.agreedStars = input.agreedStars; updates.acceptedByParentId = request.auth!.uid; updates.acceptedAt = now;
    } else if (input.status === "declined") {
      if (typeof input.reason !== "string" || !input.reason.trim() || input.reason.length > 500) throw new HttpsError("invalid-argument", "A reason is required");
      updates.declineReason = input.reason.trim();
    } else if (input.status === "snoozed") {
      if (!Number.isSafeInteger(input.snoozeDays) || input.snoozeDays < 1 || input.snoozeDays > 30) throw new HttpsError("invalid-argument", "Choose 1–30 days");
      updates.snoozeUntil = Timestamp.fromMillis(Date.now() + input.snoozeDays * 86400000);
    } else if (input.status === "completed") {
      if (data.acceptedByParentId !== request.auth!.uid) throw new HttpsError("permission-denied", "Only the accepting parent can mark this done");
      updates.completedAt = now;
    } else updates.confirmedAt = now;
    if (data.status === input.status) {
      if (input.status === "accepted" && (data.acceptedByParentId !== request.auth!.uid || data.agreedStars !== input.agreedStars)) throw new HttpsError("failed-precondition", "Request already accepted");
      return;
    }
    const allowed = input.status === "confirmed" ? ["completed"] : input.status === "completed" ? ["accepted"] : ["pending", "snoozed"];
    if (!allowed.includes(data.status)) throw new HttpsError("failed-precondition", "Request has changed. Refresh and try again");
    transaction.update(ref, updates);
  });
  return { success: true };
});

export const getChildRequestCount = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first");
  const input = request.data; const familyId = documentId(input?.familyId); const childId = documentId(input?.childId);
  return admin.firestore().runTransaction(async (transaction) => {
    await requireParent(transaction, familyId, request.auth!.uid);
    const child = await requireChildSession(transaction, familyId, childId, request.auth!.uid, input.sessionToken);
    const family = await transaction.get(admin.firestore().doc(`families/${familyId}`));
    const period = getPeriodKey("weekly", new Date(), family.data()?.timezone || "UTC");
    return { count: child.data()?.requestCountPeriod === period ? child.data()?.weeklyRequestCount || 0 : 0 };
  });
});
