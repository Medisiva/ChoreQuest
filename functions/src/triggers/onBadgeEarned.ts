// Cloud Function trigger — fires on any starTransaction write.
// Checks 15 badge conditions against the child's data and awards
// badges that haven't already been earned.

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

// ── Types ────────────────────────────────────────────────────────────────────

interface StarTransactionData {
  familyAccountId: string;
  childProfileId: string;
  deltaStars: number;
  transactionType: string;
  reason: string;
  [key: string]: unknown;
}

interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  check: (context: BadgeContext) => boolean;
}

interface BadgeContext {
  totalStarsEarned: number;
  starBalance: number;
  totalTasksCompleted: number;
  currentStreak: number;
  transactionType: string;
  // Placeholder fields for future badge conditions
  categoryCounts: Record<string, number>;
  weeklyTaskCount: number;
  requestsCompleted: number;
}

// ── Badge Definitions (placeholder logic) ───────────────────────────────────

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "firstTask",
    name: "First Quest",
    description: "Complete your very first task",
    check: (ctx) => ctx.totalTasksCompleted >= 1,
  },
  {
    id: "fiveTasks",
    name: "High Five",
    description: "Complete 5 tasks",
    check: (ctx) => ctx.totalTasksCompleted >= 5,
  },
  {
    id: "tenTasks",
    name: "Task Master",
    description: "Complete 10 tasks",
    check: (ctx) => ctx.totalTasksCompleted >= 10,
  },
  {
    id: "twentyFiveTasks",
    name: "Quarter Century",
    description: "Complete 25 tasks",
    check: (ctx) => ctx.totalTasksCompleted >= 25,
  },
  {
    id: "fiftyTasks",
    name: "Half Century Hero",
    description: "Complete 50 tasks",
    check: (ctx) => ctx.totalTasksCompleted >= 50,
  },
  {
    id: "hundredTasks",
    name: "Centurion",
    description: "Complete 100 tasks",
    check: (ctx) => ctx.totalTasksCompleted >= 100,
  },
  {
    id: "streak3",
    name: "On Fire",
    description: "Maintain a 3-day streak",
    check: (ctx) => ctx.currentStreak >= 3,
  },
  {
    id: "streak7",
    name: "Week Warrior",
    description: "Maintain a 7-day streak",
    check: (ctx) => ctx.currentStreak >= 7,
  },
  {
    id: "streak14",
    name: "Fortnight Force",
    description: "Maintain a 14-day streak",
    check: (ctx) => ctx.currentStreak >= 14,
  },
  {
    id: "streak30",
    name: "Monthly Marvel",
    description: "Maintain a 30-day streak",
    check: (ctx) => ctx.currentStreak >= 30,
  },
  {
    id: "fiftyStars",
    name: "Star Collector",
    description: "Earn 50 stars total",
    check: (ctx) => ctx.totalStarsEarned >= 50,
  },
  {
    id: "hundredStars",
    name: "Star Hoarder",
    description: "Earn 100 stars total",
    check: (ctx) => ctx.totalStarsEarned >= 100,
  },
  {
    id: "fiveHundredStars",
    name: "Constellation",
    description: "Earn 500 stars total",
    check: (ctx) => ctx.totalStarsEarned >= 500,
  },
  {
    id: "weeklyChamp",
    name: "Weekly Champion",
    description: "Complete 7 tasks in a single week",
    check: (ctx) => ctx.weeklyTaskCount >= 7,
  },
  {
    id: "allRounder",
    name: "All-Rounder",
    description: "Complete tasks in every category",
    check: (ctx) => {
      const categories = ["Household", "Learning", "LifeSkills", "Hobbies"];
      return categories.every((cat) => (ctx.categoryCounts[cat] ?? 0) > 0);
    },
  },
];

// ── Trigger ──────────────────────────────────────────────────────────────────

export const onBadgeEarned = onDocumentCreated(
  "families/{familyId}/starTransactions/{txnId}",
  async (event) => {
    const data = event.data?.data() as StarTransactionData | undefined;

    if (!data) {
      logger.warn("onBadgeEarned: missing transaction data");
      return;
    }

    const familyId = event.params.familyId;
    const { childProfileId } = data;

    if (!childProfileId) {
      logger.info("[onBadgeEarned] No childProfileId on transaction, skipping");
      return;
    }

    logger.info(
      `[onBadgeEarned] Checking badge conditions for child ${childProfileId} in family ${familyId}`
    );

    // Read child profile for current stats
    const childRef = db.doc(
      `families/${familyId}/childProfiles/${childProfileId}`
    );
    const childSnap = await childRef.get();

    if (!childSnap.exists) {
      logger.error(
        `[onBadgeEarned] Child profile ${childProfileId} not found`
      );
      return;
    }

    const childData = childSnap.data() ?? {};

    // Build badge context from child data (placeholder — real data sources TBD)
    const context: BadgeContext = {
      totalStarsEarned: childData.totalStarsEarned ?? 0,
      starBalance: childData.starBalance ?? 0,
      totalTasksCompleted: childData.totalTasksCompleted ?? 0,
      currentStreak: childData.currentStreak ?? 0,
      transactionType: data.transactionType,
      categoryCounts: childData.categoryCounts ?? {},
      weeklyTaskCount: childData.weeklyTaskCount ?? 0,
      requestsCompleted: childData.requestsCompleted ?? 0,
    };

    // Read existing achievements to avoid duplicates
    const achievementsSnap = await db
      .collection(`families/${familyId}/achievements`)
      .where("childProfileId", "==", childProfileId)
      .get();

    const earnedBadgeIds = new Set(
      achievementsSnap.docs.map((doc) => doc.data().badgeId)
    );

    // Check each badge definition
    const batch = db.batch();
    let badgesAwarded = 0;

    for (const badge of BADGE_DEFINITIONS) {
      if (earnedBadgeIds.has(badge.id)) {
        continue; // Already earned
      }

      if (badge.check(context)) {
        const achievementRef = db
          .collection(`families/${familyId}/achievements`)
          .doc();

        batch.set(achievementRef, {
          familyAccountId: familyId,
          childProfileId,
          badgeId: badge.id,
          badgeName: badge.name,
          badgeDescription: badge.description,
          earnedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        badgesAwarded++;
        logger.info(
          `[onBadgeEarned] Awarding badge "${badge.name}" to child ${childProfileId}`
        );
      }
    }

    if (badgesAwarded > 0) {
      await batch.commit();
      logger.info(
        `[onBadgeEarned] Awarded ${badgesAwarded} badge(s) to child ${childProfileId}`
      );
    } else {
      logger.info(
        `[onBadgeEarned] No new badges earned for child ${childProfileId}`
      );
    }
  }
);
