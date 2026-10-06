import { HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { createHash } from "crypto";

export function documentId(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > 150 || value.includes("/")) throw new HttpsError("invalid-argument", "Invalid document ID");
  return value;
}
export function positiveStars(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > 10000) throw new HttpsError("invalid-argument", "Invalid star amount");
  return value as number;
}
export async function requireParent(transaction: admin.firestore.Transaction, familyId: string, uid: string): Promise<void> {
  if (uid.startsWith("child-")) throw new HttpsError("permission-denied", "Parent sign-in required");
  const db = admin.firestore();
  const family = await transaction.get(db.doc(`families/${familyId}`));
  const parent = await transaction.get(db.doc(`families/${familyId}/parentUsers/${uid}`));
  if (!family.exists || family.data()?.isDeleted || !parent.exists) throw new HttpsError("permission-denied", "Family unavailable");
}
export async function requireChildSession(transaction: admin.firestore.Transaction, familyId: string, childId: string, uid: string, token: unknown): Promise<admin.firestore.DocumentSnapshot> {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) throw new HttpsError("unauthenticated", "Enter your PIN again");
  const db = admin.firestore(); const hash = createHash("sha256").update(token).digest("hex");
  const session = await transaction.get(db.doc(`families/${familyId}/childSessions/${hash}`));
  const child = await transaction.get(db.doc(`families/${familyId}/childProfiles/${childId}`));
  const data = session.data();
  const family = await transaction.get(db.doc(`families/${familyId}`));
  const parent = data?.parentUid ? await transaction.get(db.doc(`families/${familyId}/parentUsers/${data.parentUid}`)) : null;
  if (!family.exists || family.data()?.isDeleted || !parent?.exists) throw new HttpsError("permission-denied", "Family unavailable");
  if (!child.exists || !session.exists || (data?.childAuthUid !== uid && data?.parentUid !== uid) || !family.exists || family.data()?.isDeleted || !parent?.exists || data?.childProfileId !== childId ||
      !data.expiresAt || data.expiresAt.toMillis() <= Date.now() ||
      (child.data()?.sessionsRevokedAt && (!data.createdAt || data.createdAt.toMillis() <= child.data()!.sessionsRevokedAt.toMillis()))) {
    throw new HttpsError("unauthenticated", "Enter your PIN again");
  }
  return child;
}
