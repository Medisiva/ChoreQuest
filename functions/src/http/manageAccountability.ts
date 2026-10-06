import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { documentId, requireParent } from '../utils/authorization';
export const clearConsequence = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first');
  const familyId = documentId(request.data?.familyId);
  const consequenceId = documentId(request.data?.consequenceId);
  const db = admin.firestore();
  const reference = db.doc(`families/${familyId}/activeConsequences/${consequenceId}`);
  await db.runTransaction(async (transaction) => {
    await requireParent(transaction, familyId, request.auth!.uid);
    const consequence = await transaction.get(reference);
    if (!consequence.exists) throw new HttpsError('not-found', 'Consequence not found');
    if (consequence.data()?.clearedByParentAt) return;
    transaction.update(reference, { clearedByParentAt: FieldValue.serverTimestamp(), clearedByParentId: request.auth!.uid });
  });
  return { cleared: true };
});
