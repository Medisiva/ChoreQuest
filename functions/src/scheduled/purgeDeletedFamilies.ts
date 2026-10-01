import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

// Queue records survive partial cleanup. Every operation tolerates retries; the
// queue is removed only after storage, mappings, accounts and family data are gone.
export const purgeDeletedFamilies = onSchedule("every 24 hours", async () => {
  const db = admin.firestore();
  const jobs = await db.collection("familyDeletionQueue").where("purgeAfter", "<=", admin.firestore.Timestamp.now()).limit(20).get();
  for (const job of jobs.docs) {
    const familyId = job.id;
    const family = db.doc(`families/${familyId}`);
    const snapshot = await family.get();
    if (snapshot.exists && !snapshot.data()?.isDeleted) {
      logger.error("Refusing purge for an active family", { familyId });
      continue;
    }
    // Resolve mappings on every retry, even when the family has already been removed.
    const mappings = await db.collection("parentProfiles").where("familyAccountId", "==", familyId).get();
    await admin.storage().bucket().deleteFiles({ prefix: `families/${familyId}/`, force: true });
    await db.recursiveDelete(family);
    await db.doc(`leaderboard/${familyId}`).delete();
    for (const mapping of mappings.docs) {
      // Delete Auth first, retaining mapping as a retry marker if Auth deletion fails.
      try { await admin.auth().deleteUser(mapping.id); }
      catch (error) { if ((error as { code?: string }).code !== "auth/user-not-found") throw error; }
      await mapping.ref.delete();
    }
    await job.ref.delete();
    logger.info("Family purge complete", { familyId });
  }
});
