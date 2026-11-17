import { FunctionsHttpError } from '@supabase/supabase-js';
import type { FoodSearchItem } from '@/lib/nutrition/foodSearch';
import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';
import { FoodAnalysisError } from './foodAnalysis';

async function callCoach<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai-coach', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const b = await (error.context as Response).json().catch(() => null);
      if (b?.error?.code) throw new FoodAnalysisError(b.error.code, b.error.message, !!b.error.retryable);
    }
    throw new FoodAnalysisError('NETWORK', "Couldn't reach the AI service. Check your connection and try again.", true);
  }
  if (!data?.ok) throw new FoodAnalysisError(data?.error?.code ?? 'UNKNOWN', data?.error?.message ?? 'Request failed.', !!data?.error?.retryable);
  return data.data as T;
}

// Small in-memory cache so retyping or backspacing doesn't re-query.
const searchCache = new Map<string, FoodSearchItem[]>();

export async function searchFoodsAi(query: string): Promise<FoodSearchItem[]> {
  const key = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (key.length < 2) return [];
  const hit = searchCache.get(key);
  if (hit) return hit;
  const res = await callCoach<{ items: FoodSearchItem[] }>({ action: 'food_search', query: key });
  searchCache.set(key, res.items);
  return res.items;
}

export interface MealIdeaItem {
  name: string;
  quantity: number;
  unit: string;
  grams: number | null;
  calories_kcal: number;
  protein_g: number;
  carbohydrates_g: number;
  fat_g: number;
  fibre_g: number;
}

export interface MealIdea {
  title: string;
  meal_type: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  why: string | null;
  items: MealIdeaItem[];
  totals: { calories_kcal: number; protein_g: number; carbohydrates_g: number; fat_g: number; fibre_g: number };
}

export interface MealIdeasResult {
  summary: string | null;
  ideas: MealIdea[];
  tips: string[];
  mode: 'meal' | 'day';
  health_used: boolean;
  has_health_profile: boolean;
}

export function getMealIdeas(params: {
  mode: 'meal' | 'day';
  mealType?: string;
  remainingKcal?: number;
  remainingProteinG?: number;
  note?: string;
}): Promise<MealIdeasResult> {
  return callCoach<MealIdeasResult>({
    action: 'meal_ideas',
    mode: params.mode,
    meal_type: params.mealType,
    remaining_kcal: params.remainingKcal,
    remaining_protein_g: params.remainingProteinG,
    note: params.note,
  });
}

export async function saveHealthProfile(
  userId: string,
  v: { conditions: string[]; meds: string[]; notes: string; aiConsent: boolean; hadConsent: boolean },
): Promise<void> {
  unwrap(
    await supabase
      .from('user_preferences')
      .update({
        health_conditions: v.conditions,
        medication_flags: v.meds,
        medication_notes: v.notes.trim() || null,
        ...(v.aiConsent === v.hadConsent ? {} : { health_ai_consent_at: v.aiConsent ? new Date().toISOString() : null }),
      })
      .eq('user_id', userId),
  );
}

export async function saveWorkoutPrefs(
  userId: string,
  v: { days: number; minutes: number; environment: string },
): Promise<void> {
  unwrap(
    await supabase
      .from('user_preferences')
      .update({ workout_days_per_week: v.days, workout_minutes_per_session: v.minutes, workout_environment: v.environment })
      .eq('user_id', userId),
  );
}
