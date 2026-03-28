import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChildProfile {
  childId: string;
  displayName: string;
  monthlyTargetStars: number;
  currentStreakMonths: number;
  monthlyConsecutiveMisses: number;
  starBalance: number;
  [key: string]: unknown;
}

interface ConsequenceDefinition {
  consequenceId: string;
  name: string;
  description: string;
  missLevel: number;
  familyId: string;
  isActive: boolean;
  periodType: string;
  [key: string]: unknown;
}

interface AccountabilityLog {
  logId: string;
  familyId: string;
  childId: string;
  periodType: "weekly" | "monthly";
  periodStart: admin.firestore.Timestamp;
  periodEnd: admin.firestore.Timestamp;
  targetStars: number;
  earnedStars: number;
  met: boolean;
  streakMonths: number;
  missLevel: number | null;
  consequenceApplied: string | null;
  bonusAwarded: number;
  createdAt: admin.firestore.Timestamp;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STREAK_BONUS_THRESHOLD = 3; // 3 consecutive months → bonus
const STREAK_BONUS_STARS = 10;
const FAMILY_BATCH_SIZE = 10;

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns the first day of the current month at 00:00 UTC.
 */
function getMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * Returns the last day of the current month at 23:59:59.999 UTC.
 */
function getMonthEnd(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * Determines miss severity level:
 * 1 = Yellow (first miss), 2 = Orange, 3+ = Red
 */
function getMissLevel(consecutiveMisses: number): number {
  return Math.min(consecutiveMisses, 3);
}

/**
 * Calculates total approved stars for a child within a date range.
 */
async function getApprovedStars(
  db: admin.firestore.Firestore,
  familyId: string,
  childId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const snap = await db
    .collection("families")
    .doc(familyId)
    .collection("starTransactions")
    .where("childId", "==", childId)
    .where("type", "==", "earn")
    .where("status", "==", "approved")
    .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(periodStart))
    .where("createdAt", "<=", admin.firestore.Timestamp.fromDate(periodEnd))
    .get();

  let total = 0;
  snap.forEach((doc) => {
    const data = doc.data();
    total += (data.stars as number) || 0;
  });
  return total;
}

/**
 * Process a single child's monthly evaluation.
 */
async function processChild(
  db: admin.firestore.Firestore,
  familyId: string,
  childDoc: admin.firestore.QueryDocumentSnapshot,
  monthStart: Date,
  monthEnd: Date,
): Promise<void> {
  const child = childDoc.data() as ChildProfile;
  const childId = childDoc.id;

  const periodStartTs = admin.firestore.Timestamp.fromDate(monthStart);

  // ── Idempotency check ──
  const existingLog = await db
    .collection("families")
    .doc(familyId)
    .collection("accountabilityLogs")
    .where("childId", "==", childId)
    .where("periodType", "==", "monthly")
    .where("periodStart", "==", periodStartTs)
    .limit(1)
    .get();

  if (!existingLog.empty) {
    logger.info(`Monthly log already exists for child ${childId} in family ${familyId}, skipping.`);
    return;
  }

  // ── Calculate earned stars ──
  const earnedStars = await getApprovedStars(db, familyId, childId, monthStart, monthEnd);
  const target = child.monthlyTargetStars || 0;
  const met = earnedStars >= target;

  let newStreakMonths = child.currentStreakMonths || 0;
  let newMonthlyMisses = child.monthlyConsecutiveMisses || 0;
  let bonusAwarded = 0;
  let missLevel: number | null = null;
  let consequenceApplied: string | null = null;

  if (met) {
    // ── Target met ──
    newStreakMonths += 1;
    newMonthlyMisses = 0;

    // ── Streak bonus via transaction ──
    if (newStreakMonths > 0 && newStreakMonths % STREAK_BONUS_THRESHOLD === 0) {
      bonusAwarded = STREAK_BONUS_STARS;
      const childRef = db
        .collection("families")
        .doc(familyId)
        .collection("children")
        .doc(childId);

      await db.runTransaction(async (tx) => {
        const freshDoc = await tx.get(childRef);
        const freshData = freshDoc.data() as ChildProfile;
        const currentBalance = freshData.starBalance || 0;
        tx.update(childRef, { starBalance: currentBalance + STREAK_BONUS_STARS });
      });

      // Record streak bonus transaction
      const bonusTxRef = db
        .collection("families")
        .doc(familyId)
        .collection("starTransactions")
        .doc();

      await bonusTxRef.set({
        transactionId: bonusTxRef.id,
        childId,
        stars: STREAK_BONUS_STARS,
        type: "bonus",
        reason: `${STREAK_BONUS_THRESHOLD}-month streak bonus`,
        status: "approved",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info(
        `Monthly streak bonus of ${STREAK_BONUS_STARS} stars awarded to child ${childId} (streak: ${newStreakMonths}).`,
      );
    }
  } else {
    // ── Target missed ──
    newMonthlyMisses += 1;
    newStreakMonths = 0;
    missLevel = getMissLevel(newMonthlyMisses);

    // ── Check for monthly consequence definition ──
    const consequenceDefs = await db
      .collection("families")
      .doc(familyId)
      .collection("consequenceDefinitions")
      .where("missLevel", "==", missLevel)
      .where("periodType", "==", "monthly")
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (!consequenceDefs.empty) {
      const consDef = consequenceDefs.docs[0].data() as ConsequenceDefinition;
      consequenceApplied = consDef.name;

      const activeConsRef = db
        .collection("families")
        .doc(familyId)
        .collection("activeConsequences")
        .doc();

      await activeConsRef.set({
        consequenceId: activeConsRef.id,
        childId,
        familyId,
        definitionId: consequenceDefs.docs[0].id,
        name: consDef.name,
        description: consDef.description,
        missLevel,
        periodType: "monthly" as const,
        periodStart: periodStartTs,
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info(
        `Monthly consequence "${consDef.name}" applied to child ${childId} (miss level: ${missLevel}).`,
      );
    }
  }

  // ── WriteBatch: log + profile update (atomic) ──
  const batch = db.batch();

  const logRef = db
    .collection("families")
    .doc(familyId)
    .collection("accountabilityLogs")
    .doc();

  const logData: AccountabilityLog = {
    logId: logRef.id,
    familyId,
    childId,
    periodType: "monthly",
    periodStart: periodStartTs,
    periodEnd: admin.firestore.Timestamp.fromDate(monthEnd),
    targetStars: target,
    earnedStars,
    met,
    streakMonths: newStreakMonths,
    missLevel,
    consequenceApplied,
    bonusAwarded,
    createdAt: admin.firestore.Timestamp.now(),
  };

  batch.set(logRef, logData);

  const childRef = db
    .collection("families")
    .doc(familyId)
    .collection("children")
    .doc(childId);

  batch.update(childRef, {
    currentStreakMonths: newStreakMonths,
    monthlyConsecutiveMisses: newMonthlyMisses,
  });

  await batch.commit();

  logger.info(
    `Monthly eval for child ${childId}: earned=${earnedStars}, target=${target}, met=${met}, streak=${newStreakMonths}, misses=${newMonthlyMisses}.`,
  );
}

/**
 * Process all children in a single family.
 */
async function processFamily(db: admin.firestore.Firestore, familyId: string): Promise<void> {
  const now = new Date();
  const monthStart = getMonthStart(now);
  const monthEnd = getMonthEnd(now);

  const childrenSnap = await db
    .collection("families")
    .doc(familyId)
    .collection("children")
    .where("isActive", "==", true)
    .get();

  if (childrenSnap.empty) {
    logger.info(`No active children in family ${familyId}, skipping.`);
    return;
  }

  await Promise.all(
    childrenSnap.docs.map((childDoc) =>
      processChild(db, familyId, childDoc, monthStart, monthEnd),
    ),
  );
}

// ── Cloud Function ────────────────────────────────────────────────────────────

/**
 * Monthly evaluation: runs on the last day of each month at 23:59 UTC.
 * Uses "28-31 23 * * *" which fires every day from the 28th onward;
 * the function checks if today is actually the last day of the month.
 */
export const monthlyEvaluation = onSchedule(
  {
    schedule: "59 23 28-31 * *", // fires 28th-31st; filtered inside
    timeZone: "UTC",
    retryCount: 3,
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const now = new Date();
    const lastDayOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
    ).getUTCDate();

    // Only run on the actual last day of the month
    if (now.getUTCDate() !== lastDayOfMonth) {
      logger.info(
        `Today is the ${now.getUTCDate()}th, not the last day (${lastDayOfMonth}). Skipping.`,
      );
      return;
    }

    const db = admin.firestore();
    logger.info("Monthly evaluation started.");

    let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;
    let totalFamilies = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let query = db
        .collection("families")
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(FAMILY_BATCH_SIZE);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const familySnap = await query.get();

      if (familySnap.empty) {
        break;
      }

      await Promise.all(
        familySnap.docs.map((doc) => processFamily(db, doc.id)),
      );

      totalFamilies += familySnap.size;
      lastDoc = familySnap.docs[familySnap.docs.length - 1];

      if (familySnap.size < FAMILY_BATCH_SIZE) {
        break;
      }
    }

    logger.info(`Monthly evaluation complete. Processed ${totalFamilies} families.`);
  },
);
