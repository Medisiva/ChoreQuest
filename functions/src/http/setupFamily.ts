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
export async function childData(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const nickname = text(input.nickname, "nickname", 20);
  const avatarId = text(input.avatarId, "avatar", 40);
  if (!["3-5", "6-8", "9-11", "12-14", "15-17"].includes(String(input.ageGroup))) {
    throw new HttpsError("invalid-argument", "Invalid age group");
  }
  if (typeof input.pin !== "string" || !/^\d{4}$/.test(input.pin)) {
    throw new HttpsError("invalid-argument", "PIN must contain four digits");
  }
  return {
    nickname, avatarId, ageGroup: input.ageGroup, pinHash: await bcrypt.hash(input.pin, 12),
    starBalance: 0, totalStarsEarned: 0, totalStarsRedeemed: 0,
    weeklyTargetStars: integer(input.weeklyTargetStars ?? 20, "weekly target"),
    monthlyTargetStars: integer(input.monthlyTargetStars ?? 80, "monthly target"),
    progressDisplayStyle: "ProgressBar", currentStreakWeeks: 0, consecutiveMissWeeks: 0,
    monthlyConsecutiveMisses: 0, streakThreshold: 4, streakBonusStars: 10,
    failedPinAttempts: 0, lockedUntil: null, createdAt: FieldValue.serverTimestamp(),
  };
}
function rewards(input: unknown): Record<string, unknown>[] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 20) throw new HttpsError("invalid-argument", "Invalid rewards");
  return input.map((reward) => ({ name: text(reward?.name, "reward name"), starCost: integer(reward?.starCost, "reward cost") }));
}

/** Server-owned bootstrap avoids circular membership rules and untrusted PIN hashes. */
export const setupFamily = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first");
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
    if (existing.exists) return { familyId: existing.data()!.familyAccountId, parentId: uid };
    const now = FieldValue.serverTimestamp();
    const parent = { familyAccountId: family.id, firebaseUid: uid, displayName: typeof request.auth!.token.name === "string" ? request.auth!.token.name : "Parent", avatarId: "default-parent", starBalance: 0, totalStarsEarned: 0, totalStarsRedeemed: 0, createdAt: now };
    transaction.create(family, { familyName, ownerUid: uid, memberIds: [uid], createdAt: now, timezone, isDeleted: false });
    transaction.create(family.collection("parentUsers").doc(uid), parent);
    transaction.create(mapping, parent);
    if (child) transaction.create(childRef, { ...child, familyAccountId: family.id });
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

export const createChildProfile = onCall(async (request) => {
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
    transaction.create(child, { ...profile, familyAccountId: familyId });
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
    transaction.update(childRef, { pinHash, failedPinAttempts: 0, lockedUntil: null, sessionsRevokedAt: FieldValue.serverTimestamp() });
  });
  return { success: true };
});
