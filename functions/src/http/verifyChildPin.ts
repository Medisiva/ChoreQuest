import { Timestamp } from "firebase-admin/firestore";
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
const SESSION_TOKEN_EXPIRY_HOURS = 4;

// ── Cloud Function ─────────────────────────────────────────────────────────────

export const verifyChildPin = onRequest(async (req, res) => {
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
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
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
    const parentSnap = await db.doc(`families/${familyId}/parentUsers/${callerUid}`).get();
    const familySnap = await db.doc(`families/${familyId}`).get();
    if (!parentSnap.exists || !familySnap.exists || familySnap.data()?.isDeleted) {
      res.status(403).json({ error: "Not authorized for this family" });
      return;
    }
    const profileRef = db.doc(
      `families/${familyId}/childProfiles/${childProfileId}`
    );
    // Serialize failed attempts and successful sessions so parallel guesses cannot
    // bypass the lockout counter. Only the token hash is stored on the server.
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(profileRef);
      if (!snapshot.exists) return { status: 404, body: { error: "Child profile not found" } };
      const profile = snapshot.data() as ChildProfileData;
      const now = Timestamp.now();
      if (profile.lockedUntil && profile.lockedUntil.toMillis() > now.toMillis()) {
        return { status: 403, body: { success: false, locked: true, lockedUntil: profile.lockedUntil.toDate().toISOString() } };
      }
      // Old demo hashes cannot be verified securely; a parent must reset them.
      if (typeof profile.pinHash !== "string" || !/^\$2[aby]\$/.test(profile.pinHash)) {
        return { status: 409, body: { error: "Ask a parent to reset this profile's PIN." } };
      }
      if (await bcrypt.compare(pin, profile.pinHash)) {
        const expiresAt = new Date(now.toMillis() + SESSION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
        transaction.update(profileRef, { failedPinAttempts: 0, lockedUntil: null });
        transaction.set(db.doc(`families/${familyId}/childSessions/${tokenHash}`), {
          childProfileId, parentUid: callerUid,
          expiresAt: Timestamp.fromDate(expiresAt), createdAt: now,
        });
        return { status: 200, body: { success: true, sessionToken: { token, expiresAt: expiresAt.toISOString() } } };
      }
      // An expired lockout starts a new attempt window.
      const attempts = (profile.lockedUntil ? 0 : Math.max(0, profile.failedPinAttempts || 0)) + 1;
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        const lockedUntil = Timestamp.fromDate(new Date(now.toMillis() + LOCKOUT_MINUTES * 60 * 1000));
        transaction.update(profileRef, { failedPinAttempts: attempts, lockedUntil });
        return { status: 403, body: { success: false, locked: true, lockedUntil: lockedUntil.toDate().toISOString() } };
      }
      transaction.update(profileRef, { failedPinAttempts: attempts, lockedUntil: null });
      return { status: 401, body: { success: false, attemptsRemaining: MAX_FAILED_ATTEMPTS - attempts } };
    });
    res.status(result.status).json(result.body);
    logger.info("verifyChildPin END", { executionId, status: result.status });
  } catch (error: unknown) {
    logger.error("verifyChildPin ERROR", { executionId, error });
    res.status(500).json({ error: "Internal server error" });
  }
});
