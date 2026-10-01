import { getPeriodKey, localDate } from './recurrence';
export type EvaluationPeriod = 'weekly' | 'monthly';
/** Resolve a civil midnight to its real instant, including DST/offset changes. */
function midnight(civil: Date, timezone: string): Date {
  let low = civil.getTime() - 36 * 3600000;
  let high = civil.getTime() + 36 * 3600000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (localDate(new Date(middle), timezone).getTime() < civil.getTime()) low = middle;
    else high = middle;
  }
  return new Date(high);
}
export function closedPeriod(type: EvaluationPeriod, now: Date, timezone: string) {
  const current = getPeriodKey(type, now, timezone);
  const endCivil = new Date(`${current}${type === 'monthly' ? '-01' : ''}T00:00:00Z`);
  const startCivil = new Date(endCivil);
  if (type === 'weekly') startCivil.setUTCDate(startCivil.getUTCDate() - 7);
  else startCivil.setUTCMonth(startCivil.getUTCMonth() - 1);
  return { key: startCivil.toISOString().slice(0, type === 'weekly' ? 10 : 7), start: midnight(startCivil, timezone), end: midnight(endCivil, timezone) };
}
export function evaluationOutcome(child: Record<string, unknown>, type: EvaluationPeriod, earned: number) {
  const number = (field: string) => Number.isSafeInteger(child[field]) && Number(child[field]) >= 0 ? Number(child[field]) : 0;
  const target = number(type === 'weekly' ? 'weeklyTargetStars' : 'monthlyTargetStars');
  const enabled = target > 0;
  const met = enabled && earned >= target;
  const streak = type === 'weekly' ? met ? number('currentStreakWeeks') + 1 : 0 : number('currentStreakWeeks');
  const missField = type === 'weekly' ? 'consecutiveMissWeeks' : 'monthlyConsecutiveMisses';
  const misses = enabled && !met ? number(missField) + 1 : 0;
  const threshold = number('streakThreshold');
  const bonus = type === 'weekly' && met && threshold > 0 && streak % threshold === 0 ? number('streakBonusStars') : 0;
  return { target, enabled, met, streak, misses, missField, bonus, level: misses > 0 ? (misses === 1 ? 'Yellow' : misses === 2 ? 'Orange' : 'Red') : undefined };
}
