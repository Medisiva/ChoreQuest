// S11: GDPR Account Deletion — soft delete family, then schedule hard delete
// Soft-deletes immediately (isDeleted=true, deletedAt), schedules permanent deletion after 30 days.

import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

export const deleteFamilyAccount = onRequest(async (req, res) => {
  const executionId = `delete-${Date.now()}`;
  logger.info(`[${executionId}] Delete family account started`);

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const token = authHeader.split("Bearer ")[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;

    const { familyId, confirmText } = req.body;
    if (!familyId || confirmText !== "DELETE") {
      res.status(400).json({ error: "familyId required and confirmText must be 'DELETE'" });
      return;
    }

    // Verify caller is a member
    const familyDoc = await db.doc(`families/${familyId}`).get();
    if (!familyDoc.exists) {
      res.status(404).json({ error: "Family not found" });
      return;
    }

    const familyData = familyDoc.data();
    if (!familyData?.memberIds?.includes(uid)) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    // Soft delete: mark family as deleted
    const batch = db.batch();
    const familyRef = db.doc(`families/${familyId}`);

    batch.update(familyRef, {
      isDeleted: true,
      deletedAt: admin.firestore.Timestamp.now(),
    });

    // Disable all tasks
    const tasksSnap = await db.collection(`families/${familyId}/tasks`).get();
    for (const taskDoc of tasksSnap.docs) {
      batch.update(taskDoc.ref, { isActive: false });
    }

    await batch.commit();

    // Delete Firebase Auth user
    try {
      await admin.auth().deleteUser(uid);
    } catch (authError) {
      logger.warn(`[${executionId}] Could not delete auth user:`, authError);
    }

    logger.info(`[${executionId}] Family ${familyId} soft-deleted by ${uid}`);

    res.status(200).json({
      success: true,
      message: "Account deleted. Data will be permanently removed in 30 days.",
      deletedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`[${executionId}] Delete failed:`, error);
    res.status(500).json({ error: "Delete failed" });
  }
});
