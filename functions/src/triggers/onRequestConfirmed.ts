// Cloud Function trigger — fires when a familyRequest status changes to 'confirmed'.
// Credits agreedStars to the parent's starBalance via runTransaction
// and writes a ParentStarTransaction record.

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

// ── Types ────────────────────────────────────────────────────────────────────

interface FamilyRequestData {
  familyAccountId: string;
  parentUid: string;
  childProfileId: string;
  title: string;
  agreedStars: number;
  status: string;
  [key: string]: unknown;
}

// ── Trigger ──────────────────────────────────────────────────────────────────

export const onRequestConfirmed = onDocumentUpdated(
  "families/{familyId}/familyRequests/{requestId}",
  async (event) => {
    const before = event.data?.before.data() as FamilyRequestData | undefined;
    const after = event.data?.after.data() as FamilyRequestData | undefined;

    if (!before || !after) {
      logger.warn("onRequestConfirmed: missing before/after data");
      return;
    }

    // Only fire when status transitions TO 'confirmed'
    if (before.status === "confirmed" || after.status !== "confirmed") {
      return;
    }

    const familyId = event.params.familyId;
    const requestId = event.params.requestId;
    const { parentUid, agreedStars, title } = after;

    logger.info(
      `[onRequestConfirmed] Request ${requestId} confirmed in family ${familyId}, ` +
        `crediting ${agreedStars} stars to parent ${parentUid}`
    );

    // Credit stars to parent profile via transaction
    const parentRef = db.doc(`families/${familyId}/members/${parentUid}`);
    const txnRef = db.collection(
      `families/${familyId}/parentStarTransactions`
    ).doc();

    await db.runTransaction(async (transaction) => {
      const parentSnap = await transaction.get(parentRef);

      if (!parentSnap.exists) {
        throw new Error(
          `Parent member ${parentUid} not found in family ${familyId}`
        );
      }

      const parentData = parentSnap.data();
      const currentBalance = parentData?.starBalance ?? 0;
      const totalEarned = parentData?.totalStarsEarned ?? 0;

      // Credit stars to parent
      transaction.update(parentRef, {
        starBalance: currentBalance + agreedStars,
        totalStarsEarned: totalEarned + agreedStars,
      });

      // Write ParentStarTransaction record
      transaction.set(txnRef, {
        familyAccountId: familyId,
        parentUid,
        deltaStars: agreedStars,
        transactionType: "requestConfirmed",
        requestId,
        reason: `Request confirmed: ${title}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    logger.info(
      `[onRequestConfirmed] Credited ${agreedStars} stars to parent ${parentUid}`
    );
  }
);
