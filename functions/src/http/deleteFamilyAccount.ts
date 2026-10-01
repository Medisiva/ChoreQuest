import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

/** Disable access now, then let the retryable purge worker remove retained data. */
export const deleteFamilyAccount = onRequest(async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) { res.status(401).json({ error: "Sign in first" }); return; }
  let uid: string; let authTime: number;
  try { const token = await admin.auth().verifyIdToken(header.slice(7), true); uid = token.uid; authTime = token.auth_time; }
  catch { res.status(401).json({ error: "Sign in again" }); return; }
  if (!Number.isFinite(authTime) || Date.now() / 1000 - authTime > 5 * 60) { res.status(401).json({ error: "Sign out and sign in again before deleting your family." }); return; }
  const familyId = req.body?.familyId;
  if (typeof familyId !== "string" || !familyId || familyId.includes("/") || req.body?.confirmText !== "DELETE") { res.status(400).json({ error: "Invalid deletion request" }); return; }
  try {
    const db = admin.firestore(); const family = db.doc(`families/${familyId}`);
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(family);
      const parent = await transaction.get(family.collection("parentUsers").doc(uid));
      const queue = db.doc(`familyDeletionQueue/${familyId}`);
      const pending = await transaction.get(queue);
      if (!snapshot.exists || !parent.exists) return { status: 403, error: "Not authorized" };
      const data = snapshot.data()!;
      if ((data.ownerUid ?? data.memberIds?.[0]) !== uid) return { status: 403, error: "Only the family creator can delete the whole family." };
      if (pending.exists) return { status: 200, purgeAfter: pending.data()!.purgeAfter.toDate().toISOString() };
      const now = admin.firestore.Timestamp.now();
      const purgeAfter = admin.firestore.Timestamp.fromMillis(now.toMillis() + 30 * 24 * 60 * 60 * 1000);
      transaction.update(family, { isDeleted: true, deletedAt: now });
      transaction.create(queue, { familyId, requestedBy: uid, requestedAt: now, purgeAfter });
      return { status: 200, purgeAfter: purgeAfter.toDate().toISOString() };
    });
    if (result.error) { res.status(result.status).json({ error: result.error }); return; }
    res.status(200).json({ success: true, message: "Family access disabled. Permanent deletion is scheduled within 30 days plus the next daily cleanup run.", purgeAfter: result.purgeAfter });
  } catch (error) {
    logger.error("Family deletion request failed", { familyId, error });
    res.status(500).json({ error: "Deletion could not be scheduled. Try again." });
  }
});
