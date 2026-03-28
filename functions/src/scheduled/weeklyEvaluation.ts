import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChildProfile {
  childId: string;
  displayName: string;
  weeklyTargetStars: number;
  currentStreakWeeks: number;
  consecutiveMissWeeks: number;
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
  streakWeeks: number;
  missLevel: number | null;
  consequenceApplied: string | null;
  bonusAwarded: number;
  createdAt: admin.firestore.Timestamp;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STREAK_BONUS_THRESHOLD = 4; // 4 consecutive weeks → bonus
const STREAK_BONUS_STARS = 5;
const FAMILY_BATCH_SIZE = 10;

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns Monday 00:00 UTC of the current week (ISO week: Mon-Sun).
 */
function getWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayOfWeek = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

/**
 * Returns Sunday 23:59:59.999 UTC of the current week.
 */
function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setUTCDate(d.getUTCDate() + 6);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * Determines miss severity level:
 * 1 = Yellow (first miss), 2 = Orange, 3+ = Red
 */
function getMissLevel(consecutiveMissWeeks: number): number {
  return Math.min(consecutiveMissWeeks, 3);
}

/**
 * Calculates total approved stars for a child within a date range
 * by querying the starTransactions subcollection.
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
 * Process a single child's weekly evaluation.
 */
async function processChild(
  db: admin.firestore.Firestore,
  familyId: string,
  childDoc: admin.firestore.QueryDocumentSnapshot,
  weekStart: Date,
  weekEnd: Date,
): Promise<void> {
  const child = childDoc.data() as ChildProfile;
  const childId = childDoc.id;

  const periodStartTs = admin.firestore.Timestamp.fromDate(weekStart);

  // ── Idempotency check: skip if log already exists for this period + child ──
  const existingLog = await db
    .collection("families")
    .doc(familyId)
    .collection("accountabilityLogs")
    .where("childId", "==", childId)
    .where("periodType", "==", "weekly")
    .where("periodStart", "==", periodStartTs)
    .limit(1)
    .get();

  if (!existingLog.empty) {
    logger.info(`Weekly log already exists for child ${childId} in family ${familyId}, skipping.`);
    return;
  }

  // ── Calculate earned stars ──
  const earnedStars = await getApprovedStars(db, familyId, childId, weekStart, weekEnd);
  const target = child.weeklyTargetStars || 0;
  const met = earnedStars >= target;

  let newStreakWeeks = child.currentStreakWeeks || 0;
  let newConsecutiveMissWeeks = child.consecutiveMissWeeks || 0;
  let bonusAwarded = 0;
  let missLevel: number | null = null;
  let consequenceApplied: string | null = null;

  if (met) {
    // ── Target met: update streak ──
    newStreakWeeks += 1;
    newConsecutiveMissWeeks = 0;

    // ── Streak bonus via transaction ──
    if (newStreakWeeks > 0 && newStreakWeeks % STREAK_BONUS_THRESHOLD === 0) {
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

      // Record streak bonus as a star transaction
      const bonusTxRef = db
        .collection("families")
        .doc(familyId)
        .collection("starTransactions")
        .doc();

      // We'll add this to the batch below — but since it's a separate concern,
      // create it here as a simple set.
      await bonusTxRef.set({
        transactionId: bonusTxRef.id,
        childId,
        stars: STREAK_BONUS_STARS,
        type: "bonus",
        reason: `${STREAK_BONUS_THRESHOLD}-week streak bonus`,
        status: "approved",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info(
        `Streak bonus of ${STREAK_BONUS_STARS} stars awarded to child ${childId} (streak: ${newStreakWeeks}).`,
      );
    }
  } else {
    // ── Target missed: update miss counter ──
    newConsecutiveMissWeeks += 1;
    newStreakWeeks = 0;
    missLevel = getMissLevel(newConsecutiveMissWeeks);

    // ── Check for consequence definition at this miss level ──
    const consequenceDefs = await db
      .collection("families")
      .doc(familyId)
      .collection("consequenceDefinitions")
      .where("missLevel", "==", missLevel)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (!consequenceDefs.empty) {
      const consDef = consequenceDefs.docs[0].data() as ConsequenceDefinition;
      consequenceApplied = consDef.name;

      // Create active consequence document
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
        periodType: "weekly" as const,
        periodStart: periodStartTs,
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info(
        `Consequence "${consDef.name}" applied to child ${childId} (miss level: ${missLevel}).`,
      );
    }
  }

  // ── WriteBatch: accountability log + profile update (atomic) ──
  const batch = db.batch();

  // 1. Write accountability log (write-once)
  const logRef = db
    .collection("families")
    .doc(familyId)
    .collection("accountabilityLogs")
    .doc();

  const logData: AccountabilityLog = {
    logId: logRef.id,
    familyId,
    childId,
    periodType: "weekly",
    periodStart: periodStartTs,
    periodEnd: admin.firestore.Timestamp.fromDate(weekEnd),
    targetStars: target,
    earnedStars,
    met,
    streakWeeks: newStreakWeeks,
    missLevel,
    consequenceApplied,
    bonusAwarded,
    createdAt: admin.firestore.Timestamp.now(),
  };

  batch.set(logRef, logData);

  // 2. Update child profile with new counters
  const childRef = db
    .collection("families")
    .doc(familyId)
    .collection("children")
    .doc(childId);

  batch.update(childRef, {
    currentStreakWeeks: newStreakWeeks,
    consecutiveMissWeeks: newConsecutiveMissWeeks,
  });

  await batch.commit();

  logger.info(
    `Weekly eval for child ${childId}: earned=${earnedStars}, target=${target}, met=${met}, streak=${newStreakWeeks}, missWeeks=${newConsecutiveMissWeeks}.`,
  );
}

/**
 * Process all children in a single family.
 */
async function processFamily(db: admin.firestore.Firestore, familyId: string): Promise<void> {
  const weekStart = getWeekStart(new Date());
  const weekEnd = getWeekEnd(weekStart);

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
      processChild(db, familyId, childDoc, weekStart, weekEnd),
    ),
  );
}

// ── Cloud Function ────────────────────────────────────────────────────────────

/**
 * Weekly evaluation: runs every Sunday at 23:59 UTC.
 * For each family, for each child, evaluates whether the weekly star target was met.
 * Awards streak bonuses, applies consequences, and writes accountability logs.
 */
export const weeklyEvaluation = onSchedule(
  {
    schedule: "59 23 * * 0", // Sunday 23:59 UTC
    timeZone: "UTC",
    retryCount: 3,
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const db = admin.firestore();
    logger.info("Weekly evaluation started.");

    let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;
    let totalFamilies = 0;

    // Paginate through families
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

    logger.info(`Weekly evaluation complete. Processed ${totalFamilies} families.`);
  },
);
