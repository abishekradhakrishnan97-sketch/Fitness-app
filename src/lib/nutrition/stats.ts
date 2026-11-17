// Pure dashboard statistics (unit-tested).

const addDaysIso = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Fill a 7-day window ending today (oldest first), using 0 for days without entries. */
export function lastNDays(byDate: Map<string, number>, today: string, n = 7): { date: string; value: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const date = addDaysIso(today, i - (n - 1));
    return { date, value: byDate.get(date) ?? 0 };
  });
}

/**
 * Consecutive days with at least one logged meal, counting back from today.
 * If today has nothing logged yet, the streak is still "alive" from yesterday.
 */
export function loggingStreak(loggedDates: Set<string>, today: string): number {
  let day = loggedDates.has(today) ? today : addDaysIso(today, -1);
  let n = 0;
  while (loggedDates.has(day)) {
    n += 1;
    day = addDaysIso(day, -1);
  }
  return n;
}

/** Days in the window where intake was within ±10% of target (only days with any intake count). */
export function daysOnTarget(days: { value: number }[], target: number): { onTarget: number; logged: number } {
  if (target <= 0) return { onTarget: 0, logged: days.filter((d) => d.value > 0).length };
  const logged = days.filter((d) => d.value > 0);
  return {
    onTarget: logged.filter((d) => Math.abs(d.value - target) <= target * 0.1).length,
    logged: logged.length,
  };
}

/** Change between first and last weigh-in in the window, rounded to 0.1 kg. */
export function weightChange(points: { date: string; value: number }[]): number | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
  return Math.round((sorted[sorted.length - 1].value - sorted[0].value) * 10) / 10;
}
