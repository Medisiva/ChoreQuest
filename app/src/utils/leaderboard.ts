export type LeaderboardPeriod = 'weekly' | 'monthly' | 'allTime';
export interface LeaderboardEntry { id: string; name: string; avatarEmoji: string; stars: number; role: 'parent' | 'child' }
export function periodKey(date: Date, timezone: string, period: 'weekly' | 'monthly'): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  if (period === 'monthly') return `${part('year')}-${part('month')}`;
  const civil = new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`);
  civil.setUTCDate(civil.getUTCDate() - (civil.getUTCDay() + 6) % 7);
  return civil.toISOString().slice(0, 10);
}
export function earnedInPeriod(records: { deltaStars: number; createdAt: { toDate(): Date } }[], timezone: string, period: 'weekly' | 'monthly', now: Date): number {
  const key = periodKey(now, timezone, period);
  return records.reduce((sum, record) => sum + (record.deltaStars > 0 && record.createdAt.toDate() <= now && periodKey(record.createdAt.toDate(), timezone, period) === key ? record.deltaStars : 0), 0);
}
