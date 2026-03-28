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
  lockedUntil: admin.firestore.Timestamp | null;
  [key: string]: unknown; // allow other fields without casting to any
}

interface SessionToken {
  token: string;
  expiresAt: string;
}

type VerifyChildPinResponse =
  | { success: true; sessionToken: SessionToken }
  | { success: false; locked: true; lockedUntil: string }
  | { success: false; locked?: false; attemptsRemaining: number };

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
    try {
      await admin.auth().verifyIdToken(idToken);
    } catch {
      res.status(401).json({ error: "Invalid or expired auth token" });
      return;
    }

    // ── Validate request body ────────────────────────────────────────────────
    const { familyId, childProfileId, pin } =
      req.body as Partial<VerifyChildPinRequest>;

    if (!familyId || !childProfileId || !pin) {
      res
        .status(400)
        .json({ error: "Missing required fields: familyId, childProfileId, pin" });
      return;
    }

    // ── Fetch child profile ──────────────────────────────────────────────────
    const db = admin.firestore();
    const profileRef = db.doc(
      `families/${familyId}/childProfiles/${childProfileId}`
    );
    const profileSnap = await profileRef.get();

    if (!profileSnap.exists) {
      res.status(404).json({ error: "Child profile not found" });
      return;
    }

    const profileData = profileSnap.data() as ChildProfileData;

    // ── Check lockout ────────────────────────────────────────────────────────
    const now = admin.firestore.Timestamp.now();

    if (profileData.lockedUntil && profileData.lockedUntil.toMillis() > now.toMillis()) {
      const response: VerifyChildPinResponse = {
        success: false,
        locked: true,
        lockedUntil: profileData.lockedUntil.toDate().toISOString(),
      };
      res.status(403).json(response);
      logger.info("verifyChildPin END - account locked", { executionId });
      return;
    }

    // ── Verify PIN ───────────────────────────────────────────────────────────
    const pinCorrect = await bcrypt.compare(pin, profileData.pinHash);

    if (pinCorrect) {
      // Reset failed attempts via batch (per architecture rule #7)
      const batch = db.batch();
      batch.update(profileRef, {
        failedPinAttempts: 0,
        lockedUntil: null,
      });
      await batch.commit();

      // Generate session token
      const expiresAt = new Date(
        Date.now() + SESSION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
      );
      const sessionToken: SessionToken = {
        token: crypto.randomUUID(),
        expiresAt: expiresAt.toISOString(),
      };

      const response: VerifyChildPinResponse = {
        success: true,
        sessionToken,
      };
      res.status(200).json(response);
      logger.info("verifyChildPin END - success", { executionId });
      return;
    }

    // ── Wrong PIN ────────────────────────────────────────────────────────────
    const newFailedAttempts = (profileData.failedPinAttempts || 0) + 1;
    const batch = db.batch();

    if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
      );
      batch.update(profileRef, {
        failedPinAttempts: newFailedAttempts,
        lockedUntil,
      });
      await batch.commit();

      const response: VerifyChildPinResponse = {
        success: false,
        locked: true,
        lockedUntil: lockedUntil.toDate().toISOString(),
      };
      res.status(403).json(response);
      logger.info("verifyChildPin END - locked after max attempts", {
        executionId,
      });
      return;
    }

    batch.update(profileRef, { failedPinAttempts: newFailedAttempts });
    await batch.commit();

    const response: VerifyChildPinResponse = {
      success: false,
      attemptsRemaining: MAX_FAILED_ATTEMPTS - newFailedAttempts,
    };
    res.status(401).json(response);
    logger.info("verifyChildPin END - wrong pin", { executionId });
  } catch (error: unknown) {
    logger.error("verifyChildPin ERROR", { executionId, error });
    res.status(500).json({ error: "Internal server error" });
  }
});
