// Timezone-aware local date/time helpers and automatic meal categorisation.
//
// Rules (user's local time):
//   00:00–11:59  breakfast; any further entry before noon on the same day -> snack
//   12:00–15:00  lunch
//   15:01–19:59  snack
//   20:00–23:59  dinner
// The user can always override the category; the exact timestamp, local date and
// IANA timezone are stored with every meal so history stays correct across travel.

export type MealType = 'breakfast' | 'pre_workout' | 'lunch' | 'snack' | 'dinner' | 'other';

export const MEAL_TYPE_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast',
  pre_workout: 'Pre-workout',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
  other: 'Other',
};

export interface LocalParts {
  /** yyyy-mm-dd in the given timezone */
  localDate: string;
  /** minutes after local midnight, 0–1439 */
  minutes: number;
  timeZone: string;
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function localParts(at: Date, timeZone: string = deviceTimeZone()): LocalParts {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(at)) p[part.type] = part.value;
  return {
    localDate: `${p.year}-${p.month}-${p.day}`,
    minutes: Number(p.hour) * 60 + Number(p.minute),
    timeZone,
  };
}

/**
 * @param minutes local minutes after midnight
 * @param earlierMorningEntries number of meals already logged before noon on the same local date
 */
export function categoriseMeal(minutes: number, earlierMorningEntries = 0): MealType {
  if (minutes < 12 * 60) return earlierMorningEntries > 0 ? 'snack' : 'breakfast';
  if (minutes <= 15 * 60) return 'lunch';
  if (minutes < 20 * 60) return 'snack';
  return 'dinner';
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
