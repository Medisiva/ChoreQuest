/** Validate untrusted and legacy quest data before it reaches award/scheduler code. */
export function validTask(data: Record<string, any>): boolean {
  const number = (v: unknown, min: number, max: number) => Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max;
  return typeof data.title === 'string' && data.title.trim().length > 0 && data.title.length <= 120 &&
    ['Household','Learning','LifeSkills','Hobbies'].includes(data.category) &&
    number(data.starValue, data.isMilestone ? 0 : 1, 1000) &&
    (!data.isMilestone || (number(data.milestoneSteps,1,31) && number(data.starsPerStep,1,1000) && number(data.milestoneBonus ?? 0,0,1000))) &&
    (data.description === undefined || (typeof data.description === 'string' && data.description.length <= 1000));
}
export function validTimezone(value: unknown): value is string {
  if(typeof value!=='string' || !value || value.length>80)return false;
  try { new Intl.DateTimeFormat('en-US',{timeZone:value}); return true; } catch { return false; }
}

export const nameKey = (name: unknown): string => (typeof name === 'string' ? name : '').trim().normalize('NFKC').toLocaleLowerCase('en-US');
