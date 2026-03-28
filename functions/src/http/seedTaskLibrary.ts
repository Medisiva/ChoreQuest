import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

interface TaskLibraryItem {
  title: string;
  description: string;
  category: "Household" | "Learning" | "LifeSkills" | "Hobbies";
  suggestedStars: number;
  difficulty: "Easy" | "Medium" | "Hard" | "AdultSupervised";
  ageGroupSuggestion: "3-5" | "6-8" | "9-11" | "12-14" | "15-17";
  isMilestone: boolean;
  milestoneSteps?: number;
  starsPerStep?: number;
  milestoneBonus?: number;
}

/**
 * Generates a URL-safe document ID from a task title.
 * Example: "Make Your Bed" -> "make-your-bed"
 */
function titleToDocId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * HTTP Cloud Function that seeds the `taskLibrary` Firestore collection
 * from the taskLibrary.json data file.
 *
 * - Reads taskLibrary.json from the deployed functions bundle
 * - Uses batch writes (max 500 per batch)
 * - Checks if each doc already exists (idempotent)
 * - Returns count of newly seeded items
 */
export const seedTaskLibrary = onRequest(async (req, res) => {
  logger.info("seedTaskLibrary: execution started");

  const db = admin.firestore();
  const dataPath = path.resolve(__dirname, "../../data/taskLibrary.json");
  const raw = fs.readFileSync(dataPath, "utf-8");
  const tasks: TaskLibraryItem[] = JSON.parse(raw);

  logger.info(`seedTaskLibrary: loaded ${tasks.length} tasks from JSON`);

  const collectionRef = db.collection("taskLibrary");

  // Check which docs already exist
  const existingSnapshot = await collectionRef.get();
  const existingIds = new Set(existingSnapshot.docs.map((doc) => doc.id));

  const newTasks = tasks.filter(
    (task) => !existingIds.has(titleToDocId(task.title))
  );

  logger.info(
    `seedTaskLibrary: ${existingIds.size} existing, ${newTasks.length} new tasks to write`
  );

  if (newTasks.length === 0) {
    logger.info("seedTaskLibrary: execution ended (nothing to seed)");
    res.status(200).json({
      message: "Task library already up to date",
      existingCount: existingIds.size,
      seededCount: 0,
    });
    return;
  }

  // Write in batches of 500
  const BATCH_SIZE = 500;
  let seededCount = 0;

  for (let i = 0; i < newTasks.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = newTasks.slice(i, i + BATCH_SIZE);

    for (const task of chunk) {
      const docId = titleToDocId(task.title);
      const docRef = collectionRef.doc(docId);

      const data: Record<string, unknown> = {
        title: task.title,
        description: task.description,
        category: task.category,
        suggestedStars: task.suggestedStars,
        difficulty: task.difficulty,
        ageGroupSuggestion: task.ageGroupSuggestion,
        isMilestone: task.isMilestone,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (task.isMilestone) {
        data.milestoneSteps = task.milestoneSteps;
        data.starsPerStep = task.starsPerStep;
        data.milestoneBonus = task.milestoneBonus;
      }

      batch.set(docRef, data);
    }

    await batch.commit();
    seededCount += chunk.length;
    logger.info(
      `seedTaskLibrary: committed batch (${Math.min(i + BATCH_SIZE, newTasks.length)}/${newTasks.length})`
    );
  }

  logger.info(`seedTaskLibrary: execution ended. Seeded ${seededCount} tasks`);

  res.status(200).json({
    message: "Task library seeded successfully",
    existingCount: existingIds.size,
    seededCount,
    totalCount: existingIds.size + seededCount,
  });
});
