export type RecurrenceType = "daily" | "weekly" | "monthly";

/** Civil dates keep recurrence boundaries in the family's timezone, including DST. */
export function localDate(date: Date, timezone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)!.value);
  return new Date(Date.UTC(value("year"), value("month") - 1, value("day")));
}

export function getPeriodKey(type: RecurrenceType, date: Date, timezone: string): string {
  const civil = localDate(date, timezone);
  if (type === "weekly") {
    civil.setUTCDate(civil.getUTCDate() - ((civil.getUTCDay() + 6) % 7));
  }
  const day = civil.toISOString().slice(0, 10);
  return type === "monthly" ? day.slice(0, 7) : day;
}

export function buildRecurringInstance(
  source: Record<string, unknown>, familyId: string, sourceTaskId: string, periodKey: string,
): Record<string, unknown> {
  const allowed = [
    "title", "description", "category", "starValue", "difficulty", "ageGroupSuggestion",
    "requiresPhoto", "isMilestone", "milestoneSteps", "starsPerStep", "milestoneBonus", "createdByParentId",
  ];
  const instance: Record<string, unknown> = {};
  for (const key of allowed) if (source[key] !== undefined) instance[key] = source[key];
  if (typeof instance.title !== "string" || !instance.title.trim() ||
      !Number.isSafeInteger(instance.starValue) || Number(instance.starValue) < 1) {
    throw new Error("Recurring template requires a title and positive integer starValue");
  }
  return { ...instance, familyAccountId: familyId, recurrenceType: "none", isActive: true,
    isInstance: true, sourceTaskId, periodKey };
}
