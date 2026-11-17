import { supabase } from '@/lib/supabase';
import { addDays, deviceTimeZone, localParts } from '@/lib/time/mealCategory';
import { lastNDays, loggingStreak } from '@/lib/nutrition/stats';
import type { DailyNutritionRow, MealRow, NutritionTargetRow, UserGoalRow, WaterLogRow, WeightLogRow } from '@/types/database';
import { unwrap } from './errors';
import { getActiveGoal, getCurrentTargets } from './profile';

export interface DayTotals {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fibre: number;
}

export interface TodayData {
  localDate: string;
  timeZone: string;
  targets: NutritionTargetRow | null;
  totals: DayTotals;
  meals: (Pick<MealRow, 'id' | 'meal_type' | 'meal_kind' | 'eaten_at' | 'total_calories_kcal' | 'total_protein_g' | 'source' | 'is_estimate'> & {
    meal_items: { name: string; position: number }[];
  })[];
  latestWeight: WeightLogRow | null;
  previousWeight: WeightLogRow | null;
  /** Last 7 days of calories, oldest first (includes today). */
  week: { date: string; value: number }[];
  /** Last 7 days of protein, oldest first. */
  weekProtein: { date: string; value: number }[];
  streak: number;
  /** Weigh-ins over the last 90 days (one per date, latest value). */
  weights: { date: string; value: number }[];
  goal: UserGoalRow | null;
  water: { totalMl: number; entries: Pick<WaterLogRow, 'id' | 'amount_ml' | 'logged_at'>[] };
}

const ZERO: DayTotals = { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fibre: 0 };

export function totalsFromMeals(meals: Pick<MealRow, 'total_calories_kcal' | 'total_protein_g' | 'total_carbohydrates_g' | 'total_fat_g' | 'total_fibre_g'>[]): DayTotals {
  return meals.reduce<DayTotals>(
    (t, m) => ({
      calories: t.calories + Number(m.total_calories_kcal),
      protein: t.protein + Number(m.total_protein_g),
      carbohydrates: t.carbohydrates + Number(m.total_carbohydrates_g),
      fat: t.fat + Number(m.total_fat_g),
      fibre: t.fibre + Number(m.total_fibre_g),
    }),
    { ...ZERO },
  );
}

export async function getToday(userId: string): Promise<TodayData> {
  const timeZone = deviceTimeZone();
  const localDate = localParts(new Date(), timeZone).localDate;

  const [targets, goal, mealsRes, weightsRes, historyRes, waterRes] = await Promise.all([
    getCurrentTargets(userId),
    getActiveGoal(userId),
    supabase
      .from('meals')
      .select('id, meal_type, meal_kind, eaten_at, source, is_estimate, total_calories_kcal, total_protein_g, total_carbohydrates_g, total_fat_g, total_fibre_g, meal_items(name, position)')
      .eq('user_id', userId)
      .eq('local_date', localDate)
      .order('eaten_at', { ascending: true }),
    supabase
      .from('weight_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('local_date', addDays(localDate, -90))
      .order('local_date', { ascending: false })
      .order('logged_at', { ascending: false }),
    supabase
      .from('daily_nutrition')
      .select('local_date, calories_kcal, protein_g')
      .eq('user_id', userId)
      .gte('local_date', addDays(localDate, -60))
      .lte('local_date', localDate),
    supabase
      .from('water_logs')
      .select('id, amount_ml, logged_at')
      .eq('user_id', userId)
      .eq('local_date', localDate)
      .order('logged_at', { ascending: false }),
  ]);

  const meals = (unwrap(mealsRes) ?? []).map((m) => ({ ...m, meal_items: [...m.meal_items].sort((a, b) => a.position - b.position) }));
  const weightRows = unwrap(weightsRes) ?? [];
  const history = unwrap(historyRes) ?? [];
  const waterRows = waterRes.error ? [] : (waterRes.data ?? []);

  // One weigh-in per date: rows are newest-first, so the first seen per date is that day's latest.
  const byDate = new Map<string, number>();
  for (const w of weightRows) if (!byDate.has(w.local_date)) byDate.set(w.local_date, Number(w.weight_kg));
  const weights = [...byDate.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => (a.date < b.date ? -1 : 1));

  const kcalByDate = new Map<string, number>();
  const proteinByDate = new Map<string, number>();
  for (const d of history) {
    if (!d.local_date) continue;
    kcalByDate.set(d.local_date, Number(d.calories_kcal ?? 0));
    proteinByDate.set(d.local_date, Number(d.protein_g ?? 0));
  }
  const totals = totalsFromMeals(meals);
  // Today's live totals win over the view (same data, but avoids any lag).
  kcalByDate.set(localDate, totals.calories);
  proteinByDate.set(localDate, totals.protein);
  const logged = new Set([...kcalByDate.entries()].filter(([, v]) => v > 0).map(([d]) => d));

  return {
    localDate,
    timeZone,
    targets,
    totals,
    meals,
    latestWeight: weightRows[0] ?? null,
    previousWeight: weightRows[1] ?? null,
    week: lastNDays(kcalByDate, localDate, 7),
    weekProtein: lastNDays(proteinByDate, localDate, 7),
    streak: loggingStreak(logged, localDate),
    weights,
    goal,
    water: { totalMl: waterRows.reduce((s, w) => s + w.amount_ml, 0), entries: waterRows },
  };
}

export async function getDailyHistory(userId: string, days: number): Promise<DailyNutritionRow[]> {
  const today = localParts(new Date()).localDate;
  return unwrap(
    await supabase
      .from('daily_nutrition')
      .select('*')
      .eq('user_id', userId)
      .gte('local_date', addDays(today, -(days - 1)))
      .order('local_date', { ascending: false }),
  ) ?? [];
}

export async function addWater(userId: string, amountMl: number): Promise<void> {
  const { localDate } = localParts(new Date());
  unwrap(await supabase.from('water_logs').insert({ user_id: userId, amount_ml: Math.round(amountMl), local_date: localDate }));
}

export async function deleteWater(id: string): Promise<void> {
  unwrap(await supabase.from('water_logs').delete().eq('id', id));
}

export async function logWeight(userId: string, weightKg: number): Promise<void> {
  const { localDate } = localParts(new Date());
  unwrap(await supabase.from('weight_logs').insert({ user_id: userId, weight_kg: weightKg, local_date: localDate }));
}
