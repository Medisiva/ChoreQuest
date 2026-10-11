import { createHash } from 'crypto';
import { validTask } from '../utils/validation';
import { getPeriodKey } from '../utils/recurrence';
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { documentId, requireParent, requireChildSession } from "../utils/authorization";

export const claimChildQuest = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first");
  const input = request.data; const familyId = documentId(input?.familyId); const childId = documentId(input?.childId); const taskId = documentId(input?.taskId); const operationId = documentId(input?.operationId);
  const db = admin.firestore(); const task = db.doc(`families/${familyId}/tasks/${taskId}`); const claim = db.doc(`families/${familyId}/taskClaims/${operationId}`);
  await db.runTransaction(async (transaction) => {
    const child = await requireChildSession(transaction, familyId, childId, request.auth!.uid, input.sessionToken);
    const existing = await transaction.get(claim); const snapshot = await transaction.get(task);
    if (existing.exists) {
      if (existing.data()?.childProfileId !== childId || existing.data()?.taskId !== taskId) throw new HttpsError("already-exists", "Claim ID already used");
      return;
    }
    if (!snapshot.exists || !snapshot.data()?.isActive) throw new HttpsError("not-found", "Quest unavailable");
    const data = snapshot.data()!;
    if (!validTask(data)) throw new HttpsError('failed-precondition', 'A parent needs to correct this quest’s reward details.');
    if (data.deadline?.toMillis?.() <= Date.now()) throw new HttpsError('failed-precondition', 'This quest’s deadline has passed. Pick another quest.');
    const family = await transaction.get(db.doc(`families/${familyId}`));
    const recurrence = data.sourceRecurrenceType || data.recurrenceType;
    if (['daily','weekly','monthly'].includes(recurrence)) {
      const period = data.periodKey || (data.createdAt?.toDate ? getPeriodKey(recurrence,data.createdAt.toDate(),family.data()?.timezone || 'UTC') : null);
      if (period !== getPeriodKey(recurrence,new Date(),family.data()?.timezone || 'UTC')) throw new HttpsError('failed-precondition','This recurring quest has expired. Pick the current one.');
    }
    const progressId = createHash('sha256').update(`${childId}/${taskId}`).digest('hex');
    const progress = await transaction.get(db.doc(`families/${familyId}/milestoneProgress/${progressId}`));
    const past = await transaction.get(db.collection(`families/${familyId}/taskClaims`).where('taskId','==',taskId).where('childProfileId','==',childId));
    const legacyPaidSteps = Math.max(0,...(past.docs || []).map(entry=>Math.max(0,(entry.data().currentMilestoneStep || 1)-1)));
    const nextStep = Math.max(progress.data()?.completedSteps || 0,legacyPaidSteps) + 1;
    if (data.isMilestone && nextStep > data.milestoneSteps) throw new HttpsError('failed-precondition','You already finished this project.');
    if (snapshot.data()?.activeClaimId) throw new HttpsError("already-exists", "Someone already claimed this quest");
    const legacy = await transaction.get(db.collection(`families/${familyId}/taskClaims`).where("taskId", "==", taskId).where("status", "in", ["claimed", "submitted", "rejected"]).limit(1));
    if (!legacy.empty) throw new HttpsError("already-exists", "Someone already claimed this quest");
    const previous = await transaction.get(db.collection(`families/${familyId}/taskClaims`).where("childProfileId", "==", childId).where("status", "in", ["claimed", "submitted", "rejected"]).limit(1));
    let stranded: admin.firestore.DocumentSnapshot | undefined;
    let strandedTask: admin.firestore.DocumentSnapshot | undefined;
    const activeQuestId = child.data()?.activeQuestId;
    if (activeQuestId && previous.empty) {
      stranded = await transaction.get(db.doc(`families/${familyId}/taskClaims/${documentId(activeQuestId)}`));
      if (stranded.exists && stranded.data()?.childProfileId === childId && stranded.data()?.status === 'approved') {
        strandedTask = await transaction.get(db.doc(`families/${familyId}/tasks/${documentId(stranded.data()!.taskId)}`));
        const paid = await transaction.get(db.doc(`families/${familyId}/starTransactions/claim-${stranded.id}-step-${stranded.data()?.currentMilestoneStep ?? 0}`));
        // Recover only legacy malformed approvals with no payout. A valid approval
        // may still be awaiting its trigger and must retain the child's lock.
        if (paid.exists || (strandedTask.exists && validTask(strandedTask.data()!))) stranded = undefined;
      } else stranded = undefined;
    }
    if (!previous.empty || (activeQuestId && !stranded)) throw new HttpsError("failed-precondition", "Finish or release your current quest first");
    if (stranded) {
      transaction.update(stranded.ref, { status: 'awardFailed', awardError: 'This old quest had invalid reward details. Choose a new quest.' });
      if (strandedTask?.exists) transaction.update(strandedTask.ref, { isActive: false, activeClaimId: FieldValue.delete() });
    }
    transaction.create(claim, { familyAccountId: familyId, taskId, childProfileId: childId, status: "claimed", ...(snapshot.data()?.isMilestone ? { currentMilestoneStep: nextStep } : {}), claimedAt: FieldValue.serverTimestamp() });
    transaction.update(task, { activeClaimId: operationId });
    transaction.update(child.ref, { activeQuestId: operationId });
  });
  return { claimId: claim.id };
});

export const updateChildQuest = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first");
  const input = request.data; const familyId = documentId(input?.familyId); const claimId = documentId(input?.claimId); const childId = documentId(input?.childId);
  if (!["submitted", "released"].includes(input.status)) throw new HttpsError("invalid-argument", "Invalid quest action");
  const db = admin.firestore(); const claimRef = db.doc(`families/${familyId}/taskClaims/${claimId}`);
  await db.runTransaction(async (transaction) => {
    const child = await requireChildSession(transaction, familyId, childId, request.auth!.uid, input.sessionToken);
    const claim = await transaction.get(claimRef);
    if (!claim.exists || claim.data()?.childProfileId !== childId) throw new HttpsError("permission-denied", "Not your quest");
    const taskRef = db.doc(`families/${familyId}/tasks/${documentId(claim.data()!.taskId)}`); const task = await transaction.get(taskRef);
    if (claim.data()?.status === input.status) return;
    if (!["claimed", "rejected"].includes(claim.data()!.status)) throw new HttpsError("failed-precondition", "Quest cannot be changed now");
    if (input.status === "released") {
      transaction.update(claimRef, { status: "released" });
      if (task.exists && task.data()?.activeClaimId === claimId) transaction.update(taskRef, { activeClaimId: FieldValue.delete() });
      if (child.data()?.activeQuestId === claimId) transaction.update(child.ref, { activeQuestId: FieldValue.delete() });
      return;
    }
    if (!task.exists || !task.data()?.isActive) throw new HttpsError("failed-precondition", "Quest unavailable");
    const proof = input.photoProofUrl;
    if (task.data()?.requiresPhoto || proof) {
      if (typeof proof !== "string") throw new HttpsError("invalid-argument", "Add a photo first");
      let url: URL;
      try { url = new URL(proof); } catch { throw new HttpsError("invalid-argument", "Invalid photo"); }
      const bucket = admin.storage().bucket();
      const objectPath = `families/${familyId}/taskProofs/${claimId}/proof.jpg`;
      const expected = `/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}`;
      if ((!(url.protocol === "https:" && url.hostname === "firebasestorage.googleapis.com") && !(process.env.FIREBASE_STORAGE_EMULATOR_HOST && url.host === process.env.FIREBASE_STORAGE_EMULATOR_HOST)) || url.pathname !== expected) throw new HttpsError("invalid-argument", "Photo must belong to this quest");
      const [exists] = await bucket.file(objectPath).exists();
      if (!exists) throw new HttpsError("invalid-argument", "Photo upload is incomplete");
    }
    transaction.update(claimRef, { status: "submitted", submittedAt: FieldValue.serverTimestamp(), ...(proof ? { photoProofUrl: proof } : {}) });
  });
  return { success: true };
});

export const reviewChildQuests = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first");
  const input = request.data; const familyId = documentId(input?.familyId);
  if (!Array.isArray(input.claimIds) || !input.claimIds.length || input.claimIds.length > 100 || !["approved", "rejected"].includes(input.decision)) throw new HttpsError("invalid-argument", "Invalid review");
  if (input.decision === "rejected" && (typeof input.reason !== "string" || !input.reason.trim() || input.reason.length > 500)) throw new HttpsError("invalid-argument", "Explain what needs another look");
  const claimIds = [...new Set<string>(input.claimIds.map(documentId))]; const db = admin.firestore();
  await db.runTransaction(async (transaction) => {
    await requireParent(transaction, familyId, request.auth!.uid);
    const refs = claimIds.map((id) => db.doc(`families/${familyId}/taskClaims/${id}`));
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
    for (const snapshot of snapshots) if (!snapshot.exists || !["submitted", input.decision].includes(snapshot.data()!.status)) throw new HttpsError("failed-precondition", "Review queue changed. Refresh and try again");
    if(input.decision==='approved'){const taskSnapshots=await Promise.all(snapshots.map(snapshot=>transaction.get(db.doc(`families/${familyId}/tasks/${documentId(snapshot.data()!.taskId)}`))));
      if(taskSnapshots.some(snapshot=>!snapshot.exists || !validTask(snapshot.data()!)))throw new HttpsError('failed-precondition','Correct or replace the quest’s reward details before approving it.');}
    for (let i = 0; i < refs.length; i++) {
      if (snapshots[i].data()?.status === input.decision) continue;
      transaction.update(refs[i], input.decision === "approved" ? { status: "approved", approvedAt: FieldValue.serverTimestamp() } : { status: "rejected", rejectedAt: FieldValue.serverTimestamp(), rejectionReason: input.reason.trim() });
    }
  });
  return { success: true };
});
