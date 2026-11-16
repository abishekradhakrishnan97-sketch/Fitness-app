import { supabase } from '@/lib/supabase';
import { draftFromRow, toItemPayload, type DraftItem } from '@/lib/nutrition/mealDraft';
import { categoriseMeal, deviceTimeZone, localParts, type MealType } from '@/lib/time/mealCategory';
import type { Json, MealItemRow, MealRow, MyFoodRow, SavedMealRow } from '@/types/database';
import { unwrap } from './errors';

export type MealKind = 'regular' | 'treat' | 'cheat' | 'social';

export interface MealWithItems extends MealRow {
  meal_items: MealItemRow[];
}

export interface NewMealMeta {
  mealType: MealType;
  categoryAuto: boolean;
  mealKind: MealKind;
  notes?: string;
  source: 'manual' | 'ai_image';
  isEstimate: boolean;
  aiModel?: string | null;
  aiAnalysis?: unknown;
  photoPath?: string | null;
  eatenAt?: Date;
}

/** Category the app would pick for a meal eaten now (counts earlier morning meals today). */
export async function suggestMealType(userId: string, at = new Date()): Promise<MealType> {
  const tz = deviceTimeZone();
  const { localDate, minutes } = localParts(at, tz);
  if (minutes >= 12 * 60) return categoriseMeal(minutes);
  const { count } = await supabase
    .from('meals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('local_date', localDate)
    .in('meal_type', ['breakfast', 'pre_workout', 'snack']);
  return categoriseMeal(minutes, count ?? 0);
}

export async function createMeal(meta: NewMealMeta, items: DraftItem[]): Promise<string> {
  const at = meta.eatenAt ?? new Date();
  const tz = deviceTimeZone();
  const { localDate } = localParts(at, tz);
  return unwrap(
    await supabase.rpc('save_meal', {
      p_meal: {
        eaten_at: at.toISOString(),
        local_date: localDate,
        timezone: tz,
        meal_type: meta.mealType,
        category_auto: meta.categoryAuto,
        meal_kind: meta.mealKind,
        source: meta.source,
        notes: meta.notes?.trim() || null,
        is_estimate: meta.isEstimate,
        ai_model: meta.aiModel ?? null,
        ai_analysis: (meta.aiAnalysis ?? null) as Json,
        photo_path: meta.photoPath ?? null,
      },
      p_items: items.map(toItemPayload) as unknown as Json,
    }),
  );
}

export async function updateMeal(
  mealId: string,
  meta: { mealType: MealType; categoryAuto: boolean; mealKind: MealKind; notes?: string },
  items: DraftItem[],
): Promise<void> {
  unwrap(
    await supabase.rpc('update_meal', {
      p_meal_id: mealId,
      p_meal: {
        meal_type: meta.mealType,
        category_auto: meta.categoryAuto,
        meal_kind: meta.mealKind,
        notes: meta.notes?.trim() ?? '',
      },
      p_items: items.map(toItemPayload) as unknown as Json,
    }),
  );
}

export async function getMeal(mealId: string): Promise<MealWithItems | null> {
  const data = unwrap(
    await supabase.from('meals').select('*, meal_items(*)').eq('id', mealId).maybeSingle(),
  ) as MealWithItems | null;
  if (data) data.meal_items.sort((a, b) => a.position - b.position);
  return data;
}

export async function deleteMeal(meal: Pick<MealRow, 'id' | 'photo_path'>): Promise<void> {
  unwrap(await supabase.from('meals').delete().eq('id', meal.id));
  if (meal.photo_path) {
    // Best effort: the meal row is already gone; an orphaned private photo is harmless.
    await supabase.storage.from('meal-photos').remove([meal.photo_path]);
  }
}

/** Log a copy of a meal now (new timestamp/category, same foods). The original is untouched. */
export async function duplicateMeal(meal: MealWithItems, userId: string): Promise<string> {
  const mealType = await suggestMealType(userId);
  const items = meal.meal_items.map((i) => draftFromRow(i, 'history'));
  return createMeal(
    {
      mealType,
      categoryAuto: true,
      mealKind: meal.meal_kind as MealKind,
      source: 'manual',
      isEstimate: meal.is_estimate,
    },
    items,
  );
}

export async function listMeals(userId: string, fromDate: string, toDate: string): Promise<MealWithItems[]> {
  const data = unwrap(
    await supabase
      .from('meals')
      .select('*, meal_items(*)')
      .eq('user_id', userId)
      .gte('local_date', fromDate)
      .lte('local_date', toDate)
      .order('local_date', { ascending: false })
      .order('eaten_at', { ascending: true }),
  ) as MealWithItems[] | null;
  return (data ?? []).map((m) => ({ ...m, meal_items: m.meal_items.sort((a, b) => a.position - b.position) }));
}

// ---------------------------------------------------------------------------
// Foods history & saved meals
// ---------------------------------------------------------------------------

export async function searchMyFoods(query: string, limit = 20): Promise<MyFoodRow[]> {
  return unwrap(await supabase.rpc('my_foods', { p_query: query.trim() || null, p_limit: limit })) ?? [];
}

export async function listSavedMeals(): Promise<SavedMealRow[]> {
  return (
    unwrap(
      await supabase
        .from('saved_meals')
        .select('*')
        .order('last_used_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }),
    ) ?? []
  );
}

export async function createSavedMeal(userId: string, name: string, items: DraftItem[]): Promise<void> {
  unwrap(
    await supabase.from('saved_meals').insert({
      user_id: userId,
      name: name.trim(),
      items: items.map(toItemPayload) as unknown as Json,
    }),
  );
}

export async function markSavedMealUsed(meal: SavedMealRow): Promise<void> {
  await supabase
    .from('saved_meals')
    .update({ use_count: meal.use_count + 1, last_used_at: new Date().toISOString() })
    .eq('id', meal.id);
}

export async function deleteSavedMeal(id: string): Promise<void> {
  unwrap(await supabase.from('saved_meals').delete().eq('id', id));
}

// ---------------------------------------------------------------------------
// Photos (private bucket, per-user folder)
// ---------------------------------------------------------------------------

export async function uploadMealPhoto(userId: string, bytes: Uint8Array, contentType = 'image/jpeg'): Promise<string> {
  const rand = Math.random().toString(36).slice(2, 10);
  const path = `${userId}/${Date.now()}-${rand}.jpg`;
  unwrap(
    await supabase.storage.from('meal-photos').upload(path, bytes, { contentType, upsert: false }),
  );
  return path;
}

export async function signedPhotoUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('meal-photos').createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
