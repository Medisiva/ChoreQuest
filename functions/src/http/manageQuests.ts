import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { documentId, requireParent, requireChildSession } from "../utils/authorization";

export const claimChildQuest = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first");
  const input = request.data; const familyId = documentId(input?.familyId); const childId = documentId(input?.childId); const taskId = documentId(input?.taskId); const operationId = documentId(input?.operationId);
  const db = admin.firestore(); const task = db.doc(`families/${familyId}/tasks/${taskId}`); const claim = db.doc(`families/${familyId}/taskClaims/${operationId}`);
  await db.runTransaction(async (transaction) => {
    await requireParent(transaction, familyId, request.auth!.uid);
    const child = await requireChildSession(transaction, familyId, childId, request.auth!.uid, input.sessionToken);
    const existing = await transaction.get(claim); const snapshot = await transaction.get(task);
    if (existing.exists) {
      if (existing.data()?.childProfileId !== childId || existing.data()?.taskId !== taskId) throw new HttpsError("already-exists", "Claim ID already used");
      return;
    }
    if (!snapshot.exists || !snapshot.data()?.isActive) throw new HttpsError("not-found", "Quest unavailable");
    if (snapshot.data()?.activeClaimId) throw new HttpsError("already-exists", "Someone already claimed this quest");
    const legacy = await transaction.get(db.collection(`families/${familyId}/taskClaims`).where("taskId", "==", taskId).where("status", "in", ["claimed", "submitted", "rejected"]).limit(1));
    if (!legacy.empty) throw new HttpsError("already-exists", "Someone already claimed this quest");
    const previous = await transaction.get(db.collection(`families/${familyId}/taskClaims`).where("childProfileId", "==", childId).where("status", "in", ["claimed", "submitted", "rejected"]).limit(1));
    if (!previous.empty || child.data()?.activeQuestId) throw new HttpsError("failed-precondition", "Finish or release your current quest first");
    transaction.create(claim, { familyAccountId: familyId, taskId, childProfileId: childId, status: "claimed", ...(snapshot.data()?.isMilestone ? { currentMilestoneStep: 1 } : {}), claimedAt: admin.firestore.FieldValue.serverTimestamp() });
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
    await requireParent(transaction, familyId, request.auth!.uid);
    const child = await requireChildSession(transaction, familyId, childId, request.auth!.uid, input.sessionToken);
    const claim = await transaction.get(claimRef);
    if (!claim.exists || claim.data()?.childProfileId !== childId) throw new HttpsError("permission-denied", "Not your quest");
    const taskRef = db.doc(`families/${familyId}/tasks/${documentId(claim.data()!.taskId)}`); const task = await transaction.get(taskRef);
    if (claim.data()?.status === input.status) return;
    if (!["claimed", "rejected"].includes(claim.data()!.status)) throw new HttpsError("failed-precondition", "Quest cannot be changed now");
    if (input.status === "released") {
      transaction.update(claimRef, { status: "released" });
      if (task.exists && task.data()?.activeClaimId === claimId) transaction.update(taskRef, { activeClaimId: admin.firestore.FieldValue.delete() });
      if (child.data()?.activeQuestId === claimId) transaction.update(child.ref, { activeQuestId: admin.firestore.FieldValue.delete() });
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
    transaction.update(claimRef, { status: "submitted", submittedAt: admin.firestore.FieldValue.serverTimestamp(), ...(proof ? { photoProofUrl: proof } : {}) });
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
    for (let i = 0; i < refs.length; i++) {
      if (snapshots[i].data()?.status === input.decision) continue;
      transaction.update(refs[i], input.decision === "approved" ? { status: "approved", approvedAt: admin.firestore.FieldValue.serverTimestamp() } : { status: "rejected", rejectedAt: admin.firestore.FieldValue.serverTimestamp(), rejectionReason: input.reason.trim() });
    }
  });
  return { success: true };
});
