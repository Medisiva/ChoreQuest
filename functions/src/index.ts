// ChoreQuest Cloud Functions entry point
// Functions are organized by type:
//   - scheduled/  : Cron-triggered functions (weekly eval, recurrence, etc.)
//   - triggers/   : Firestore document triggers (onTaskApproved, etc.)
//   - http/       : HTTP callable functions (verifyPin, exportData, etc.)

import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK (must happen before any function imports)
admin.initializeApp();

// ── HTTP Functions ─────────────────────────────────────────────────────────────
export { verifyChildPin } from "./http/verifyChildPin";
