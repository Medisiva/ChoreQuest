import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

// ── Types ──────────────────────────────────────────────────────────────────────

type RecurrenceType = "daily" | "weekly" | "monthly";

interface TaskData {
  title: string;
  description: string;
  starsReward: number;
  recurrenceType: RecurrenceType;
  isActive: boolean;
  assignedTo: string | null;
  createdAt: admin.firestore.Timestamp;
  categoryId: string;
  difficulty: string;
  [key: string]: unknown; // allow other fields without casting to any
}

// ── Constants ──────────────────────────────────────────────────────────────────

const FAMILY_BATCH_SIZE = 10;

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns the period key used for idempotency checks.
 * daily   -> "2026-03-27"
 * weekly  -> "2026-W13"
 * monthly -> "2026-03"
 */
function getPeriodKey(recurrenceType: RecurrenceType, date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");

  switch (recurrenceType) {
    case "daily":
      return `${yyyy}-${mm}-${dd}`;
    case "weekly": {
      // ISO week number
      const jan4 = new Date(Date.UTC(yyyy, 0, 4));
      const dayOfYear =
        Math.floor((date.getTime() - jan4.getTime()) / 86400000) + 4;
      const weekNumber = Math.ceil(dayOfYear / 7);
      return `${yyyy}-W${String(weekNumber).padStart(2, "0")}`;
    }
    case "monthly":
      return `${yyyy}-${mm}`;
  }
}

/**
 * Processes recurrence generation for a single family.
 * Returns the number of new task instances created.
 */
async function processFamily(
  familyId: string,
  recurrenceType: RecurrenceType,
  periodKey: string,
): Promise<number> {
  const db = admin.firestore();
  const tasksRef = db.collection(`families/${familyId}/tasks`);

  // Query active tasks with the matching recurrence type
  const tasksSnap = await tasksRef
    .where("recurrenceType", "==", recurrenceType)
    .where("isActive", "==", true)
    .get();

  if (tasksSnap.empty) {
    return 0;
  }

  const batch = db.batch();
  let created = 0;

  for (const taskDoc of tasksSnap.docs) {
    const taskData = taskDoc.data() as TaskData;

    // Idempotency: check if an instance already exists for this period
    const existingSnap = await tasksRef
      .where("sourceTaskId", "==", taskDoc.id)
      .where("periodKey", "==", periodKey)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      continue;
    }

    // Create a new claim-ready task instance
    const newTaskRef = tasksRef.doc();
    batch.set(newTaskRef, {
      title: taskData.title,
      description: taskData.description,
      starsReward: taskData.starsReward,
      recurrenceType: taskData.recurrenceType,
      categoryId: taskData.categoryId,
      difficulty: taskData.difficulty,
      assignedTo: taskData.assignedTo,
      isActive: true,
      isInstance: true,
      sourceTaskId: taskDoc.id,
      periodKey,
      status: "open",
      claimedBy: null,
      completedAt: null,
      approvedAt: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    created++;
  }

  if (created > 0) {
    await batch.commit();
  }

  return created;
}

/**
 * Core recurrence generation logic shared by all three scheduled functions.
 */
async function generateRecurrences(recurrenceType: RecurrenceType): Promise<void> {
  const startTime = Date.now();
  const now = new Date();
  const periodKey = getPeriodKey(recurrenceType, now);

  logger.info(`recurrenceGenerate START`, { recurrenceType, periodKey });

  const db = admin.firestore();
  const familiesSnap = await db.collection("families").get();

  if (familiesSnap.empty) {
    logger.info(`recurrenceGenerate END - no families`, { recurrenceType });
    return;
  }

  const familyIds = familiesSnap.docs.map((doc) => doc.id);
  let totalCreated = 0;

  // Process families in parallel batches of FAMILY_BATCH_SIZE
  for (let i = 0; i < familyIds.length; i += FAMILY_BATCH_SIZE) {
    const batchStart = Date.now();
    const batch = familyIds.slice(i, i + FAMILY_BATCH_SIZE);

    const results = await Promise.all(
      batch.map((familyId) => processFamily(familyId, recurrenceType, periodKey)),
    );

    const batchCreated = results.reduce((sum, count) => sum + count, 0);
    totalCreated += batchCreated;

    logger.info(`recurrenceGenerate batch complete`, {
      recurrenceType,
      batchIndex: Math.floor(i / FAMILY_BATCH_SIZE),
      familiesProcessed: batch.length,
      tasksCreated: batchCreated,
      batchDurationMs: Date.now() - batchStart,
    });
  }

  logger.info(`recurrenceGenerate END`, {
    recurrenceType,
    totalFamilies: familyIds.length,
    totalTasksCreated: totalCreated,
    totalDurationMs: Date.now() - startTime,
  });
}

// ── Scheduled Cloud Functions ──────────────────────────────────────────────────

export const dailyRecurrenceGenerate = onSchedule(
  "every day 00:01",
  async () => {
    await generateRecurrences("daily");
  },
);

export const weeklyRecurrenceGenerate = onSchedule(
  "every monday 00:01",
  async () => {
    await generateRecurrences("weekly");
  },
);

export const monthlyRecurrenceGenerate = onSchedule(
  "1 of month 00:01",
  async () => {
    await generateRecurrences("monthly");
  },
);
