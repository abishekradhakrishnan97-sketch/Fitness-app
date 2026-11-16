import { supabase } from '@/lib/supabase';
import { addDays, deviceTimeZone, localParts } from '@/lib/time/mealCategory';
import type { DailyNutritionRow, MealRow, NutritionTargetRow, WeightLogRow } from '@/types/database';
import { unwrap } from './errors';
import { getCurrentTargets } from './profile';

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

  const [targets, mealsRes, weightsRes] = await Promise.all([
    getCurrentTargets(userId),
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
      .order('local_date', { ascending: false })
      .order('logged_at', { ascending: false })
      .limit(2),
  ]);

  const meals = (unwrap(mealsRes) ?? []).map((m) => ({ ...m, meal_items: [...m.meal_items].sort((a, b) => a.position - b.position) }));
  const weights = unwrap(weightsRes) ?? [];
  return {
    localDate,
    timeZone,
    targets,
    totals: totalsFromMeals(meals),
    meals,
    latestWeight: weights[0] ?? null,
    previousWeight: weights[1] ?? null,
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

export async function logWeight(userId: string, weightKg: number): Promise<void> {
  const { localDate } = localParts(new Date());
  unwrap(await supabase.from('weight_logs').insert({ user_id: userId, weight_kg: weightKg, local_date: localDate }));
}
