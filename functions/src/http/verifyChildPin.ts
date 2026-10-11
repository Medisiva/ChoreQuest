import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";

// ── Types ──────────────────────────────────────────────────────────────────────

interface VerifyChildPinRequest {
  familyId: string;
  childProfileId: string;
  pin: string;
}

interface ChildProfileData {
  pinHash: string;
  failedPinAttempts: number;
  lockedUntil: Timestamp | null;
  [key: string]: unknown; // allow other fields without casting to any
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_MINUTES = 15;
const SESSION_TOKEN_EXPIRY_MINUTES = 30;

// ── Cloud Function ─────────────────────────────────────────────────────────────

export const verifyChildPin = onRequest({ cors: true }, async (req, res) => {
  const executionId = crypto.randomUUID();
  logger.info("verifyChildPin START", { executionId });

  try {
    // ── Method check ─────────────────────────────────────────────────────────
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // ── Authenticate caller via Firebase Auth token ──────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid Authorization header" });
      return;
    }

    const idToken = authHeader.split("Bearer ")[1];
    let callerUid: string;
    let callerClaims: admin.auth.DecodedIdToken;
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken, true);
      callerClaims = decodedToken;
      callerUid = decodedToken.uid;
    } catch {
      res.status(401).json({ error: "Invalid or expired auth token" });
      return;
    }

    // ── Validate request body ────────────────────────────────────────────────
    const { familyId, childProfileId, pin } =
      req.body as Partial<VerifyChildPinRequest>;

    if (
      typeof familyId !== "string" || !familyId || familyId.includes("/") ||
      typeof childProfileId !== "string" || !childProfileId || childProfileId.includes("/") ||
      typeof pin !== "string" || !/^\d{4}$/.test(pin)
    ) {
      res
        .status(400)
        .json({ error: "Missing required fields: familyId, childProfileId, pin" });
      return;
    }

    // ── Fetch child profile ──────────────────────────────────────────────────
    const db = admin.firestore();
    // A returning child uses another PIN, never an adult password. Delegation
    // remains bound to the same family and the verified original parent session.
    let parentUid = callerUid;
    let sourceIdentity: {childId:string;hash:string} | undefined;
    if (callerClaims.role === 'child') {
      const previousChildId = callerClaims.childProfileId;
      const hash = callerClaims.sessionHash;
      if (callerClaims.familyId !== familyId || typeof previousChildId !== 'string' || !previousChildId || previousChildId.includes('/') || typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) { res.status(403).json({ error: 'Not authorized for this family' }); return; }
      const expectedUid = `child-${crypto.createHash('sha256').update(`${familyId}/${previousChildId}`).digest('hex')}`;
      const source = (await db.doc(`families/${familyId}/childSessions/${hash}`).get()).data();
      if (callerUid !== expectedUid || source?.childAuthUid !== callerUid || source?.childProfileId !== previousChildId || typeof source?.parentUid !== 'string' || source.parentUid.includes('/')) { res.status(403).json({ error: 'Not authorized for this family' }); return; }
      const origin = (await db.doc(`families/${familyId}/childProfiles/${previousChildId}`).get()).data();
      if (!origin || origin.isArchived || (previousChildId !== childProfileId && (!source.expiresAt || source.expiresAt.toMillis() <= Date.now() ||
          !source.createdAt || (origin.sessionsRevokedAt && source.createdAt.toMillis() <= origin.sessionsRevokedAt.toMillis())))) {
        res.status(403).json({ error: 'This child session ended. Ask a parent to sign in again.' }); return;
      }
      parentUid = source.parentUid;
      sourceIdentity={childId:previousChildId,hash};
    }
    const parentSnap = await db.doc(`families/${familyId}/parentUsers/${parentUid}`).get();
    const familySnap = await db.doc(`families/${familyId}`).get();
    if (!parentSnap.exists || !familySnap.exists || familySnap.data()?.isDeleted) {
      res.status(403).json({ error: "Not authorized for this family" });
      return;
    }
    const profileRef = db.doc(
      `families/${familyId}/childProfiles/${childProfileId}`
    );
    const credentialsRef = db.doc(`families/${familyId}/childCredentials/${childProfileId}`);
    // Serialize failed attempts and successful sessions so parallel guesses cannot
    // bypass the lockout counter. Only the token hash is stored on the server.
    const token = crypto.randomBytes(32).toString("hex");
    const childAuthUid = `child-${crypto.createHash("sha256").update(`${familyId}/${childProfileId}`).digest("hex")}`;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const result = await db.runTransaction(async (transaction) => {
      const currentFamily = await transaction.get(db.doc(`families/${familyId}`));
      const currentParent = await transaction.get(db.doc(`families/${familyId}/parentUsers/${parentUid}`));
      if(!currentFamily.exists || currentFamily.data()?.isDeleted || !currentParent.exists)return {status:403,body:{error:'Family unavailable'}};
      if(sourceIdentity && sourceIdentity.childId!==childProfileId){
        const source=await transaction.get(db.doc(`families/${familyId}/childSessions/${sourceIdentity.hash}`));
        const origin=await transaction.get(db.doc(`families/${familyId}/childProfiles/${sourceIdentity.childId}`));
        const data=source.data(),profile=origin.data();
        if(!profile || profile.isArchived || !data?.expiresAt || data.expiresAt.toMillis()<=Date.now() || !data.createdAt || (profile.sessionsRevokedAt && data.createdAt.toMillis()<=profile.sessionsRevokedAt.toMillis()))return {status:403,body:{error:'This child session ended. Ask a parent to sign in again.'}};
      }
      const snapshot = await transaction.get(profileRef);
      if (!snapshot.exists || snapshot.data()?.isArchived) return { status: 404, body: { error: "Child profile not found" } };
      const credentials = await transaction.get(credentialsRef);
      // Legacy profiles are migrated on verification; new hashes are never public.
      const profile = (credentials.exists ? credentials.data() : snapshot.data()) as ChildProfileData;
      const now = Timestamp.now();
      if (profile.lockedUntil && profile.lockedUntil.toMillis() > now.toMillis()) {
        return { status: 403, body: { success: false, locked: true, lockedUntil: profile.lockedUntil.toDate().toISOString() } };
      }
      // Old demo hashes cannot be verified securely; a parent must reset them.
      if (typeof profile.pinHash !== "string" || !/^\$2[aby]\$/.test(profile.pinHash)) {
        return { status: 409, body: { error: "Ask a parent to reset this profile's PIN." } };
      }
      if (await bcrypt.compare(pin, profile.pinHash)) {
        const expiresAt = new Date(now.toMillis() + SESSION_TOKEN_EXPIRY_MINUTES * 60 * 1000);
        transaction.set(credentialsRef, { pinHash: profile.pinHash, failedPinAttempts: 0, lockedUntil: null });
        transaction.update(profileRef, { credentialsPrivate: true, pinHash: FieldValue.delete(), failedPinAttempts: FieldValue.delete(), lockedUntil: FieldValue.delete() });
        transaction.set(db.doc(`families/${familyId}/childSessions/${tokenHash}`), {
          childProfileId, parentUid, childAuthUid,
          expiresAt: Timestamp.fromDate(expiresAt), createdAt: now,
        });
        return { status: 200, body: { success: true, sessionToken: { token, expiresAt: expiresAt.toISOString() } } };
      }
      // An expired lockout starts a new attempt window.
      const attempts = (profile.lockedUntil ? 0 : Math.max(0, profile.failedPinAttempts || 0)) + 1;
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        const lockedUntil = Timestamp.fromDate(new Date(now.toMillis() + LOCKOUT_MINUTES * 60 * 1000));
        transaction.set(credentialsRef, { pinHash: profile.pinHash, failedPinAttempts: attempts, lockedUntil });
        transaction.update(profileRef, { credentialsPrivate: true, pinHash: FieldValue.delete(), failedPinAttempts: FieldValue.delete(), lockedUntil: FieldValue.delete() });
        return { status: 403, body: { success: false, locked: true, lockedUntil: lockedUntil.toDate().toISOString() } };
      }
      transaction.set(credentialsRef, { pinHash: profile.pinHash, failedPinAttempts: attempts, lockedUntil: null });
      transaction.update(profileRef, { credentialsPrivate: true, pinHash: FieldValue.delete(), failedPinAttempts: FieldValue.delete(), lockedUntil: FieldValue.delete() });
      return { status: 401, body: { success: false, attemptsRemaining: MAX_FAILED_ATTEMPTS - attempts } };
    });
    if (result.status === 200 && result.body.success) {
      const presentation = (await profileRef.get()).data();
      const customToken = await admin.auth().createCustomToken(childAuthUid, { role: 'child', familyId, childProfileId, sessionHash: tokenHash, childNickname: typeof presentation?.nickname === 'string' ? presentation.nickname : 'Your profile', childAvatarId: typeof presentation?.avatarId === 'string' ? presentation.avatarId : 'avatar-01' });
      res.status(200).json({ ...result.body, customToken });
    } else res.status(result.status).json(result.body);
    logger.info("verifyChildPin END", { executionId, status: result.status });
  } catch (error: unknown) {
    logger.error("verifyChildPin ERROR", { executionId, error });
    res.status(500).json({ error: "Internal server error" });
  }
});
