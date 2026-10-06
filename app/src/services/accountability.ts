import { getDocs, query, where, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { activeConsequencesRef, accountabilityLogsRef } from './firestore';
export async function loadAccountability(familyId: string) {
  const [consequences, logs] = await Promise.all([
    getDocs(activeConsequencesRef(familyId)),
    getDocs(query(accountabilityLogsRef(familyId), where('periodStart', '>=', Timestamp.fromMillis(Date.now() - 100 * 86400000)))),
  ]);
  return { consequences: consequences.docs.map((doc) => doc.data()), logs: logs.docs.map((doc) => doc.data()) };
}
export async function clearConsequence(familyId: string, consequenceId: string): Promise<void> {
  await httpsCallable(functions, 'clearConsequence')({ familyId, consequenceId });
}
