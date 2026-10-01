import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

// Refresh the single family document listener when profile balances or membership
// change. This avoids collection listeners and keeps all profile summaries current.
async function refreshFamily(familyId: string, eventTime: string): Promise<void> {
  const db = admin.firestore(); const ref = db.doc(`families/${familyId}`);
  const changedAt = admin.firestore.Timestamp.fromDate(new Date(eventTime));
  await db.runTransaction(async (transaction) => {
    const family = await transaction.get(ref);
    if (!family.exists || family.data()?.isDeleted) return;
    const previous = family.data()?.profilesUpdatedAt as admin.firestore.Timestamp | undefined;
    if (previous && previous.toMillis() >= changedAt.toMillis()) return;
    transaction.update(ref, { profilesUpdatedAt: changedAt });
  });
}
export const onChildProfileChanged = onDocumentWritten("families/{familyId}/childProfiles/{childId}", (event) => refreshFamily(event.params.familyId, event.time));
export const onParentProfileChanged = onDocumentWritten("families/{familyId}/parentUsers/{parentId}", (event) => refreshFamily(event.params.familyId, event.time));
