import { createHash } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

// Queue records survive partial cleanup. Every operation tolerates retries; the
// queue is removed only after storage, mappings, accounts and family data are gone.
export const purgeDeletedFamilies = onSchedule("every 24 hours", async () => {
  const db = admin.firestore();
  const jobs = await db.collection("familyDeletionQueue").where("purgeAfter", "<=", Timestamp.now()).limit(20).get();
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
    const children = await family.collection('childProfiles').get();
    for (const child of children.docs) {
      const childUid = `child-${createHash('sha256').update(`${familyId}/${child.id}`).digest('hex')}`;
      try { await admin.auth().deleteUser(childUid); }
      catch (error) { if ((error as { code?: string }).code !== 'auth/user-not-found') throw error; }
    }
    await db.recursiveDelete(family);
    await db.doc(`leaderboard/${familyId}`).delete();
    for (const mapping of mappings.docs) {
      // Family-data deletion never deletes an adult's independent sign-in.
      await mapping.ref.delete();
    }
    await job.ref.delete();
    logger.info("Family purge complete", { familyId });
  }
});
