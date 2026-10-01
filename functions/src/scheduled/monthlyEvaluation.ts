import { onSchedule } from 'firebase-functions/v2/scheduler';
import { evaluateFamilies } from './evaluateFamilies';
// Evaluate the last fully closed family-local period; deterministic logs make retries safe.
export const monthlyEvaluation = onSchedule({ schedule: 'every 6 hours', timeZone: 'UTC', retryCount: 3, memory: '512MiB', timeoutSeconds: 300 }, async () => {
  await evaluateFamilies('monthly');
});
