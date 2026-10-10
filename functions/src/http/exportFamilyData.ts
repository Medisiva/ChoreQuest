import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

// Credential material is never included in a portable family export.
const PRIVATE_FIELDS = new Set(["pinHash", "failedPinAttempts", "lockedUntil", "sessionsRevokedAt", "pushToken", "expoPushToken", "fcmToken"]);
export function exportRecord(id: string, data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries({ ...data, id }).filter(([key]) => !PRIVATE_FIELDS.has(key)));
}

export const exportFamilyData = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) { res.status(401).json({ error: "Sign in first" }); return; }
  let uid: string;
  try { uid = (await admin.auth().verifyIdToken(header.slice(7), true)).uid; }
  catch { res.status(401).json({ error: "Sign in again" }); return; }
  const familyId = req.body?.familyId;
  if (typeof familyId !== "string" || !familyId || familyId.includes("/")) { res.status(400).json({ error: "Invalid family ID" }); return; }
  try {
    const db = admin.firestore(); const family = db.doc(`families/${familyId}`);
    const parent = await family.collection("parentUsers").doc(uid).get();
    if (!parent.exists) { res.status(403).json({ error: "Not a family parent" }); return; }
    const snapshot = await family.get();
    if (!snapshot.exists || snapshot.data()?.isDeleted) { res.status(404).json({ error: "Family unavailable" }); return; }
    const subcollections = ["parentUsers", "childProfiles", "tasks", "taskClaims", "starTransactions", "parentStarTransactions", "rewards", "redemptions", "parentRewards", "parentRedemptions", "familyRequests", "consequenceDefinitions", "activeConsequences", "accountabilityLogs", "achievements", "settings"];
    const data: Record<string, unknown[]> = { family: [exportRecord(snapshot.id, snapshot.data()!)] };
    for (const name of subcollections) {
      const records = await family.collection(name).get();
      data[name] = records.docs.map((record) => exportRecord(record.id, record.data()));
    }
    const leaderboard = await db.doc(`leaderboard/${familyId}`).get();
    data.leaderboard = leaderboard.exists ? [exportRecord(leaderboard.id, leaderboard.data()!)] : [];
    res.set("Cache-Control", "no-store");
    res.status(200).json({ schemaVersion: 1, exportDate: new Date().toISOString(), familyId, data });
  } catch (error) {
    logger.error("Family export failed", { familyId, error });
    res.status(500).json({ error: "Export failed. Try again." });
  }
});
