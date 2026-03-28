// S11: GDPR Data Export — export all family data as JSON
// Called by parent from settings. Returns JSON blob of all family data.

import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

export const exportFamilyData = onRequest(async (req, res) => {
  const executionId = `export-${Date.now()}`;
  logger.info(`[${executionId}] Export family data started`);

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Verify auth
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const token = authHeader.split("Bearer ")[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;

    const { familyId } = req.body;
    if (!familyId) {
      res.status(400).json({ error: "familyId required" });
      return;
    }

    // Verify caller is a member of the family
    const familyDoc = await db.doc(`families/${familyId}`).get();
    if (!familyDoc.exists) {
      res.status(404).json({ error: "Family not found" });
      return;
    }

    const familyData = familyDoc.data();
    if (!familyData?.memberIds?.includes(uid)) {
      res.status(403).json({ error: "Not a family member" });
      return;
    }

    // Collect all subcollections
    const subcollections = [
      "parentUsers", "childProfiles", "tasks", "taskClaims",
      "starTransactions", "parentStarTransactions", "rewards",
      "redemptions", "parentRewards", "parentRedemptions",
      "familyRequests", "consequenceDefinitions", "activeConsequences",
      "accountabilityLogs", "achievements",
    ];

    const exportData: Record<string, unknown[]> = {
      family: [{ id: familyDoc.id, ...familyData }],
    };

    for (const sub of subcollections) {
      const snap = await db.collection(`families/${familyId}/${sub}`).get();
      exportData[sub] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    logger.info(`[${executionId}] Export complete, ${Object.values(exportData).flat().length} records`);

    res.status(200).json({
      exportDate: new Date().toISOString(),
      familyId,
      data: exportData,
    });
  } catch (error) {
    logger.error(`[${executionId}] Export failed:`, error);
    res.status(500).json({ error: "Export failed" });
  }
});
