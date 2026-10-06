// ChoreQuest Cloud Functions entry point
// Functions are organized by type:
//   - scheduled/  : Cron-triggered functions (weekly eval, recurrence, etc.)
//   - triggers/   : Firestore document triggers (onTaskApproved, etc.)
//   - http/       : HTTP callable functions (verifyPin, exportData, etc.)

import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/v2";

// Internal testing: bound scale and avoid warm-instance charges.
setGlobalOptions({ maxInstances: 2, minInstances: 0 });

// Initialize Firebase Admin SDK (must happen before any function imports)
admin.initializeApp();

// ── Scheduled Functions ───────────────────────────────────────────────────────
export {
  dailyRecurrenceGenerate,
  weeklyRecurrenceGenerate,
  monthlyRecurrenceGenerate,
} from "./scheduled/recurrenceGenerate";

export { weeklyEvaluation } from "./scheduled/weeklyEvaluation";
export { monthlyEvaluation } from "./scheduled/monthlyEvaluation";

// ── Firestore Triggers ────────────────────────────────────────────────────────
export { onTaskClaimApproved } from "./triggers/onTaskClaimApproved";
export { onRequestConfirmed } from "./triggers/onRequestConfirmed";
export { onBadgeEarned } from "./triggers/onBadgeEarned";

// ── HTTP Functions ─────────────────────────────────────────────────────────────
export { verifyChildPin } from "./http/verifyChildPin";
export { seedTaskLibrary } from "./http/seedTaskLibrary";
export { exportFamilyData } from "./http/exportFamilyData";
export { deleteFamilyAccount } from "./http/deleteFamilyAccount";
export { setupFamily, createChildProfile, resetChildPin } from "./http/setupFamily";
export { onChildProfileChanged, onParentProfileChanged } from "./triggers/onProfileChanged";
export { purgeDeletedFamilies } from "./scheduled/purgeDeletedFamilies";
export { adjustChildStars, requestChildRedemption, reviewChildRedemption } from "./http/manageStars";
export { claimChildQuest, updateChildQuest, reviewChildQuests } from "./http/manageQuests";
export { createFamilyRequest, updateFamilyRequest, getChildRequestCount } from "./http/manageRequests";
export { clearConsequence } from './http/manageAccountability';
