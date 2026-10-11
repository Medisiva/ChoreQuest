import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';

const RECENT_SIGN_IN_SECONDS = 5 * 60;
const RETENTION_DAYS = 30;

/**
 * Google Play account deletion: any adult can delete their own login and personal data.
 * - A co-parent leaves the family; their parent profile, wallet history and push token go.
 * - An owner with a co-parent hands ownership to the co-parent, then leaves.
 * - A sole owner's family is disabled now and purged after the retention period.
 * Requests this parent accepted but has not finished return to "pending" for the other parent.
 */
export async function deleteMyAccount(request: CallableRequest): Promise<{ success: true; familyScheduledForDeletion: boolean }> {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first');
  const uid = request.auth.uid;
  // Callable authentication alone accepts an unexpired token after revocation.
  const header = request.rawRequest.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new HttpsError('unauthenticated', 'Sign in again');
  try {
    const verified = await admin.auth().verifyIdToken(header.slice(7), true);
    if (verified.uid !== uid) throw new Error('Identity mismatch');
  } catch { throw new HttpsError('unauthenticated', 'Sign in again'); }
  if (request.auth.token.role === 'child' || uid.startsWith('child-')) throw new HttpsError('permission-denied', 'Parent sign-in required');
  const authTime = Number(request.auth.token.auth_time);
  if (!Number.isFinite(authTime) || Date.now() / 1000 - authTime > RECENT_SIGN_IN_SECONDS) {
    throw new HttpsError('failed-precondition', 'For your security, sign out and sign in again, then delete your account within 5 minutes.');
  }
  if (request.data?.confirmText !== 'DELETE') throw new HttpsError('invalid-argument', 'Type DELETE to confirm.');

  const db = admin.firestore();
  const mappingRef = db.doc(`parentProfiles/${uid}`);
  const familyScheduledForDeletion = await db.runTransaction(async (tx) => {
    const mapping = await tx.get(mappingRef);
    const familyId = mapping.data()?.familyAccountId;
    if (!mapping.exists || typeof familyId !== 'string' || !familyId || familyId.includes('/')) {
      if (mapping.exists) tx.delete(mappingRef);
      return false;
    }
    const familyRef = db.doc(`families/${familyId}`);
    const family = await tx.get(familyRef);
    const parents = await tx.get(familyRef.collection('parentUsers'));
    const accepted = await tx.get(familyRef.collection('familyRequests').where('acceptedByParentId', '==', uid));
    const wallet = await tx.get(familyRef.collection('parentStarTransactions').where('parentUserId', '==', uid));
    const redemptions = await tx.get(familyRef.collection('parentRedemptions').where('parentUserId', '==', uid));
    if (!family.exists || family.data()?.isDeleted || mapping.data()?.familyDeleted) {
      // Family already gone or scheduled for purge: only this adult's own records remain.
      tx.delete(mappingRef);
      return false;
    }
    const memberIdsBefore: string[] = family.data()?.memberIds || [];
    if (!parents.docs.some(parent => parent.id === uid) || !memberIdsBefore.includes(uid)) {
      throw new HttpsError('permission-denied', 'Family membership could not be verified. Contact support.');
    }
    const others = parents.docs.filter(parent => parent.id !== uid && memberIdsBefore.includes(parent.id));
    const isOwner = (family.data()?.ownerUid ?? family.data()?.memberIds?.[0]) === uid;
    if (isOwner && others.length === 0) {
      const now = Timestamp.now();
      const purgeAfter = Timestamp.fromMillis(now.toMillis() + RETENTION_DAYS * 86400000);
      const queue = db.doc(`familyDeletionQueue/${familyId}`);
      const pending = await tx.get(queue);
      tx.update(familyRef, { isDeleted: true, deletedAt: now });
      if (!pending.exists) tx.create(queue, { familyId, requestedBy: uid, requestedAt: now, purgeAfter, reason: 'ownerAccountDeleted' });
      tx.delete(mappingRef);
      return true;
    }
    const memberIds: string[] = (family.data()?.memberIds || []).filter((member: string) => member !== uid);
    tx.update(familyRef, { memberIds, ...(isOwner ? { ownerUid: others[0].id } : {}), profilesUpdatedAt: Timestamp.now() });
    for (const request of accepted.docs.filter(doc => ['accepted', 'completed'].includes(doc.data().status))) {
      tx.update(request.ref, { status: 'pending', acceptedByParentId: FieldValue.delete(), agreedStars: FieldValue.delete(), acceptedAt: FieldValue.delete(), completedAt: FieldValue.delete() });
    }
    for (const entry of [...wallet.docs, ...redemptions.docs]) tx.delete(entry.ref);
    tx.delete(familyRef.collection('pushTokens').doc(uid));
    tx.delete(familyRef.collection('parentUsers').doc(uid));
    tx.delete(mappingRef);
    return false;
  });

  try { await admin.auth().deleteUser(uid); }
  catch (error) { if ((error as { code?: string }).code !== 'auth/user-not-found') { logger.error('Account deletion: auth removal failed', { uid, error }); throw new HttpsError('internal', 'Your family data was removed, but sign-in deletion failed. Try again.'); } }
  logger.info('Parent account deleted', { familyScheduledForDeletion });
  return { success: true, familyScheduledForDeletion };
}
