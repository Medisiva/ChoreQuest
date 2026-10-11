import { validTask } from '../utils/validation';
import { FieldValue } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import { createHash } from "crypto";
import { buildRecurringInstance, getPeriodKey, localDate, RecurrenceType } from "../utils/recurrence";

async function processFamily(
  familyId: string, timezone: string, recurrenceType: RecurrenceType, now: Date,
): Promise<number> {
  const db = admin.firestore();
  const periodKey = getPeriodKey(recurrenceType, now, timezone);
  const tasks = db.collection(`families/${familyId}/tasks`);
  const templates = await tasks.where("recurrenceType", "==", recurrenceType).where("isActive", "==", true).get();
  let created = 0;
  for (const template of templates.docs) {
    const source = template.data();
    if (!validTask(source)) { logger.error('Skipping invalid recurring template', { familyId, taskId: template.id }); continue; }
    // Legacy generated copies must never become new templates.
    if (source.isInstance || source.sourceTaskId) continue;
    if (Array.isArray(source.recurrenceDays) && source.recurrenceDays.length &&
        !source.recurrenceDays.includes(localDate(now, timezone).getUTCDay())) continue;
    // The source itself is the first claimable occurrence.
    const createdAt = source.createdAt?.toDate?.();
    if (createdAt && typeof createdAt.getTime === 'function' && getPeriodKey(recurrenceType, createdAt, timezone) >= periodKey) continue;
    await template.ref.update({ templateOnly: true });
    const previous = await tasks.where('sourceTaskId', '==', template.id).where('isActive', '==', true).get();
    for (const occurrence of previous.docs) {
      if (occurrence.data().periodKey !== periodKey && !occurrence.data().activeClaimId) await occurrence.ref.update({ isActive: false });
    }
    const hash = createHash("sha256").update(`${template.id}:${recurrenceType}:${periodKey}`).digest("hex");
    const ref = tasks.doc(`rec-${hash}`);
    if ((await ref.get()).exists) continue;
    const instance = buildRecurringInstance(source, familyId, template.id, periodKey);
    const batch = db.batch();
    batch.create(ref, { ...instance, sourceRecurrenceType: recurrenceType, createdAt: FieldValue.serverTimestamp() });
    try {
      await batch.commit();
      created++;
    } catch (error: unknown) {
      // Another invocation won the deterministic create race.
      const code = (error as { code?: number | string }).code;
      if (code !== 6 && code !== "already-exists") throw error;
    }
  }
  return created;
}

async function generateRecurrences(recurrenceType: RecurrenceType): Promise<void> {
  const db = admin.firestore();
  const families = await db.collection("families").where("isDeleted", "==", false).get();
  const now = new Date();
  let created = 0;
  for (const family of families.docs) {
    try {
      created += await processFamily(family.id, family.data().timezone || "UTC", recurrenceType, now);
    } catch (error) {
      logger.error("Family recurrence generation failed", { familyId: family.id, recurrenceType, error });
      // Keep malformed or unavailable families isolated from healthy families.
      continue;
    }
  }
  logger.info("Recurrence generation complete", { recurrenceType, created });
}

// Hourly checks support family-local day/week/month boundaries instead of UTC-only cron.
export const dailyRecurrenceGenerate = onSchedule("every 60 minutes", () => generateRecurrences("daily"));
export const weeklyRecurrenceGenerate = onSchedule("every 60 minutes", () => generateRecurrences("weekly"));
export const monthlyRecurrenceGenerate = onSchedule("every 60 minutes", () => generateRecurrences("monthly"));
