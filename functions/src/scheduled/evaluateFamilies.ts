import * as admin from 'firebase-admin';
import { FieldPath, Timestamp } from 'firebase-admin/firestore';
import { closedPeriod, evaluationOutcome, EvaluationPeriod } from '../utils/evaluation';
export async function evaluateFamilies(type: EvaluationPeriod, now = new Date()): Promise<void> {
  const db = admin.firestore();
  let cursor: admin.firestore.QueryDocumentSnapshot | undefined;
  while (true) {
    let query = db.collection('families').orderBy(FieldPath.documentId()).limit(10);
    if (cursor) query = query.startAfter(cursor);
    const families = await query.get();
    if (families.empty) return;
    for (const family of families.docs) {
      if (family.data().isDeleted) continue;
      const period = closedPeriod(type, now, family.data().timezone || 'UTC');
      const children = await family.ref.collection('childProfiles').get();
      for (const child of children.docs) {
        const id = `${type}-${period.key}-${child.id}`;
        const log = family.ref.collection('accountabilityLogs').doc(id);
        await db.runTransaction(async (tx) => {
          const [freshFamily, freshChild, existing] = await Promise.all([tx.get(family.ref), tx.get(child.ref), tx.get(log)]);
          if (!freshFamily.exists || freshFamily.data()?.isDeleted || !freshChild.exists || existing.exists) return;
          // Children created during/after this period begin evaluation next period.
          const data = freshChild.data()!;
          if (!data.createdAt || data.createdAt.toMillis() >= period.start.getTime()) return;
          const ledger = await tx.get(family.ref.collection('starTransactions').where('createdAt', '>=', Timestamp.fromDate(period.start)).where('createdAt', '<', Timestamp.fromDate(period.end)));
          const earned = ledger.docs.reduce((sum, entry) => {
            const record = entry.data();
            return sum + (record.childProfileId === child.id && Number.isSafeInteger(record.deltaStars) && record.deltaStars > 0 && record.transactionType !== 'streakBonus' ? record.deltaStars : 0);
          }, 0);
          const outcome = evaluationOutcome(data, type, earned);
          if (!outcome.enabled) return;
          const definitions = outcome.level ? await tx.get(family.ref.collection('consequenceDefinitions')) : null;
          const definition = definitions?.docs.find((doc) => doc.data().childProfileId === child.id && doc.data().level === outcome.level);
          const updates: Record<string, unknown> = { [outcome.missField]: outcome.misses };
          if (type === 'weekly') updates.currentStreakWeeks = outcome.streak;
          const createdAt = Timestamp.fromDate(now);
          if (outcome.bonus) {
            updates.starBalance = (data.starBalance || 0) + outcome.bonus;
            updates.totalStarsEarned = (data.totalStarsEarned || 0) + outcome.bonus;
            tx.create(family.ref.collection('starTransactions').doc(`streak-${id}`), { familyAccountId: family.id, childProfileId: child.id, deltaStars: outcome.bonus, transactionType: 'streakBonus', reason: `${outcome.streak}-week streak bonus`, createdAt });
          }
          if (definition) {
            const consequence = definition.data();
            tx.create(family.ref.collection('activeConsequences').doc(id), { familyAccountId: family.id, childProfileId: child.id, consequenceDefinitionId: definition.id, level: outcome.level, name: consequence.name, description: consequence.description || '', activatedAt: createdAt });
          }
          tx.update(child.ref, updates);
          tx.create(log, { familyAccountId: family.id, childProfileId: child.id, periodType: type, periodKey: period.key, periodStart: Timestamp.fromDate(period.start), periodEnd: Timestamp.fromMillis(period.end.getTime() - 1), starsEarned: earned, targetStars: outcome.target, met: outcome.met, ...(outcome.level ? { missLevel: outcome.level } : {}), consequenceActivated: Boolean(definition), streakWeeksAtEval: outcome.streak, bonusAwarded: outcome.bonus, createdAt });
        });
      }
    }
    cursor = families.docs[families.docs.length - 1];
    if (families.size < 10) return;
  }
}
