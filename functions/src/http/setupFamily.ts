import { createHash } from 'crypto';
import { manageFamily } from './manageFamily';
import { nameKey } from '../utils/validation';
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as bcrypt from "bcrypt";

function text(value: unknown, field: string, max = 80): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new HttpsError("invalid-argument", `Invalid ${field}`);
  }
  return value.trim();
}
function integer(value: unknown, field: string, max = 10000): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > max) {
    throw new HttpsError("invalid-argument", `Invalid ${field}`);
  }
  return value as number;
}
export async function childData(input: Record<string, unknown>): Promise<{ profile: Record<string, unknown>; credentials: Record<string, unknown> }> {
  const nickname = text(input.nickname, "nickname", 20);
  const avatarId = text(input.avatarId, "avatar", 40);
  if (!["3-5", "6-8", "9-11", "12-14", "15-17"].includes(String(input.ageGroup))) {
    throw new HttpsError("invalid-argument", "Invalid age group");
  }
  if (typeof input.pin !== "string" || !/^\d{4}$/.test(input.pin)) {
    throw new HttpsError("invalid-argument", "PIN must contain four digits");
  }
  const weekly = integer(input.weeklyTargetStars ?? 20, 'weekly target');
  const monthly = integer(input.monthlyTargetStars ?? 80, 'monthly target');
  if (monthly < weekly) throw new HttpsError('invalid-argument','Monthly target must be at least the weekly target.');
  return { credentials: { pinHash: await bcrypt.hash(input.pin, 12), failedPinAttempts: 0, lockedUntil: null }, profile: {
    nickname, nicknameKey: nameKey(nickname), avatarId, ageGroup: input.ageGroup, credentialsPrivate: true,
    starBalance: 0, totalStarsEarned: 0, totalStarsRedeemed: 0,
    weeklyTargetStars: integer(input.weeklyTargetStars ?? 20, "weekly target"),
    monthlyTargetStars: integer(input.monthlyTargetStars ?? 80, "monthly target"),
    progressDisplayStyle: "ProgressBar", currentStreakWeeks: 0, consecutiveMissWeeks: 0,
    monthlyConsecutiveMisses: 0, streakThreshold: 4, streakBonusStars: 10,
    createdAt: FieldValue.serverTimestamp(),
  } };
}
function rewards(input: unknown): Record<string, unknown>[] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 20) throw new HttpsError("invalid-argument", "Invalid rewards");
  return input.map((reward) => ({ name: text(reward?.name, "reward name"), starCost: integer(reward?.starCost, "reward cost") }));
}

/** Server-owned bootstrap avoids circular membership rules and untrusted PIN hashes. */
export const setupFamily = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first");
  if (request.auth.token?.role === 'child' || request.auth.uid.startsWith('child-')) throw new HttpsError('permission-denied', 'Parent sign-in required');
  if (request.data?.action) return manageFamily.run(request);
  const uid = request.auth.uid;
  const input = request.data as Record<string, unknown>;
  if (!input || typeof input !== "object") throw new HttpsError("invalid-argument", "Invalid setup");
  const familyName = text(input.familyName, "family name");
  const timezone = text(input.timezone, "timezone");
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }); } catch { throw new HttpsError("invalid-argument", "Invalid timezone"); }
  const child = input.child ? await childData(input.child as Record<string, unknown>) : null;
  const childRewards = rewards(input.childRewards); const parentRewards = rewards(input.parentRewards);
  let task: Record<string, unknown> | null = null;
  if (input.task) {
    const data = input.task as Record<string, unknown>;
    if (!["Household", "Learning", "LifeSkills", "Hobbies"].includes(String(data.category))) throw new HttpsError("invalid-argument", "Invalid category");
    task = { title: text(data.title, "quest title", 120), category: data.category, starValue: integer(data.starValue, "quest stars", 1000), difficulty: "Easy", isActive: true, requiresPhoto: false, isMilestone: false, recurrenceType: "none", createdByParentId: uid };
  }
  const weeklyLimit = integer(input.weeklyRequestLimit ?? 3, "request limit", 100);
  const db = admin.firestore(); const mapping = db.doc(`parentProfiles/${uid}`);
  const family = db.collection("families").doc();
  const childRef = family.collection("childProfiles").doc();
  const result = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(mapping);
    // Concurrent retries and a lost HTTP response must not create a second family.
    if (existing.exists && !existing.data()?.familyDeleted) return { familyId: existing.data()!.familyAccountId, parentId: uid };
    const now = FieldValue.serverTimestamp();
    const parent = { familyAccountId: family.id, firebaseUid: uid, displayName: input.displayName ? text(input.displayName,"your name") : typeof request.auth!.token.name === "string" ? request.auth!.token.name : "Parent", avatarId: "default-parent", starBalance: 0, totalStarsEarned: 0, totalStarsRedeemed: 0, createdAt: now };
    transaction.create(family, { familyName, ownerUid: uid, memberIds: [uid], createdAt: now, timezone, isDeleted: false });
    transaction.create(family.collection("parentUsers").doc(uid), parent);
    transaction.set(mapping, parent);
    if (child) {
      transaction.create(childRef, { ...child.profile, familyAccountId: family.id });
      transaction.create(family.collection("childCredentials").doc(childRef.id), child.credentials);
    }
    transaction.create(family.collection("settings").doc("config"), {
      leaderboardEnabled: true, weeklyRequestLimitPerChild: child ? { [childRef.id]: weeklyLimit } : {},
    });
    if (task) transaction.create(family.collection("tasks").doc(), { ...task, familyAccountId: family.id, createdAt: now });
    for (const reward of childRewards) transaction.create(family.collection("rewards").doc(), { ...reward, familyAccountId: family.id, rewardType: "Special", isActive: true, createdByParentId: uid, createdAt: now });
    for (const reward of parentRewards) transaction.create(family.collection("parentRewards").doc(), { ...reward, familyAccountId: family.id, rewardType: "Special", addedBy: "parent", approvedByParent: true, isActive: true, createdAt: now });
    transaction.create(db.doc(`leaderboard/${family.id}`), { familyAccountId: family.id, weekly: {}, monthly: {}, allTime: {}, updatedAt: now });
    return { familyId: family.id, parentId: uid };
  });
  return result;
});

export const createChildProfile = onCall({ invoker: "public" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first");
  const input = request.data as Record<string, unknown>;
  const familyId = text(input?.familyId, "family ID", 150);
  if (familyId.includes("/")) throw new HttpsError("invalid-argument", "Invalid family ID");
  const db = admin.firestore(); const family = db.doc(`families/${familyId}`);
  // Authorize before doing expensive hashing.
  const parent = await family.collection("parentUsers").doc(request.auth.uid).get();
  if (!parent.exists) throw new HttpsError("permission-denied", "Not a family parent");
  const profile = await childData(input);
  const child = family.collection("childProfiles").doc();
  await db.runTransaction(async (transaction) => {
    const familySnap = await transaction.get(family);
    const parentSnap = await transaction.get(parent.ref);
    if (!familySnap.exists || familySnap.data()?.isDeleted || !parentSnap.exists) throw new HttpsError("permission-denied", "Family unavailable");
    const nameRef=family.collection('childNames').doc(createHash('sha256').update(nameKey(String(profile.profile.nickname))).digest('hex'));
    const reserved=await transaction.get(nameRef);
    const children = await transaction.get(family.collection('childProfiles'));
    if(reserved.exists)throw new HttpsError('already-exists','Choose a different nickname; this family already has that name.');
    if(children.docs.some(c=>!c.data().isArchived && nameKey(c.data().nickname)===nameKey(String(profile.profile.nickname))))throw new HttpsError('already-exists','Choose a different nickname; this family already has that name.');
    transaction.create(nameRef,{childId:child.id});
    transaction.create(child, { ...profile.profile, familyAccountId: familyId });
    transaction.create(family.collection("childCredentials").doc(child.id), profile.credentials);
  });
  return { childId: child.id };
});

/** Parent reset clears lockout and marks previous sessions for revocation. */
export const resetChildPin = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first");
  const input = request.data as Record<string, unknown>;
  const familyId = text(input?.familyId, "family ID", 150);
  const childId = text(input?.childId, "child ID", 150);
  if (familyId.includes("/") || childId.includes("/") || typeof input.pin !== "string" || !/^\d{4}$/.test(input.pin)) throw new HttpsError("invalid-argument", "Invalid PIN reset");
  const db = admin.firestore(); const family = db.doc(`families/${familyId}`);
  const parentRef = family.collection("parentUsers").doc(request.auth.uid);
  if (!(await parentRef.get()).exists) throw new HttpsError("permission-denied", "Not a family parent");
  const pinHash = await bcrypt.hash(input.pin, 12);
  const childRef = family.collection("childProfiles").doc(childId);
  await db.runTransaction(async (transaction) => {
    const parent = await transaction.get(parentRef); const familySnap = await transaction.get(family);
    const child = await transaction.get(childRef);
    if (!parent.exists || !familySnap.exists || familySnap.data()?.isDeleted) throw new HttpsError("permission-denied", "Family unavailable");
    if (!child.exists) throw new HttpsError("not-found", "Profile not found");
    // Session consumers compare this timestamp to their creation time.
    transaction.set(family.collection("childCredentials").doc(childId), { pinHash, failedPinAttempts: 0, lockedUntil: null });
    transaction.update(childRef, { credentialsPrivate: true, pinHash: FieldValue.delete(), failedPinAttempts: FieldValue.delete(), lockedUntil: FieldValue.delete(), sessionsRevokedAt: FieldValue.serverTimestamp() });
  });
  return { success: true };
});
