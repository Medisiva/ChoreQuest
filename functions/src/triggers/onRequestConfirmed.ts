import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

// A deterministic ledger document makes retries and repeated confirmations safe.
export const onRequestConfirmed = onDocumentUpdated(
  "families/{familyId}/familyRequests/{requestId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.status === "confirmed" || after.status !== "confirmed") return;

    const { familyId, requestId } = event.params;
    const parentId = after.acceptedByParentId;
    const stars = after.agreedStars;
    if (typeof parentId !== "string" || !parentId || parentId.includes("/") ||
        !Number.isSafeInteger(stars) || stars < 0 || stars > 1000) {
      logger.error("Invalid request award", { familyId, requestId });
      return;
    }
    const parentRef = db.doc(`families/${familyId}/parentUsers/${parentId}`);
    const ledgerRef = db.doc(`families/${familyId}/parentStarTransactions/request-${requestId}`);

    await db.runTransaction(async (transaction) => {
      const family = await transaction.get(db.doc(`families/${familyId}`));
      if (!family.exists || family.data()?.isDeleted) return;
      const ledger = await transaction.get(ledgerRef);
      if (ledger.exists) return;
      const parent = await transaction.get(parentRef);
      if (!parent.exists) throw new Error("Parent profile not found");
      const data = parent.data();
      transaction.update(parentRef, {
        starBalance: (data?.starBalance ?? 0) + stars,
        totalStarsEarned: (data?.totalStarsEarned ?? 0) + stars,
      });
      transaction.set(ledgerRef, {
        familyAccountId: familyId,
        parentUserId: parentId,
        deltaStars: stars,
        source: "requestCompletion",
        familyRequestId: requestId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  }
);
