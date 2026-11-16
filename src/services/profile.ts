import { supabase } from '@/lib/supabase';
import type { NutritionTargets, ActivityLevel, GoalType, Sex } from '@/lib/nutrition/targets';
import { deviceTimeZone, localParts } from '@/lib/time/mealCategory';
import type { NutritionTargetRow, ProfileRow, UserGoalRow, UserPreferencesRow } from '@/types/database';
import { unwrap } from './errors';

export interface OnboardingData {
  displayName: string;
  age: number | null;
  heightCm: number | null;
  weightKg: number;
  goalWeightKg: number | null;
  targetDate: string | null;
  sex: Sex | null;
  activityLevel: ActivityLevel | null;
  experience: 'beginner' | 'intermediate' | 'advanced' | null;
  goalType: GoalType;
  weeklyRateKg: number | null;
  dietaryPreference: string | null;
  allergies: string[];
  restrictions: string[];
  cuisines: string[];
  workoutDays: number | null;
  workoutMinutes: number | null;
  workoutEnvironment: 'home' | 'gym' | 'outdoor' | 'mixed' | null;
}

/**
 * Persist onboarding. Steps are ordered so that `onboarding_completed_at` is written last:
 * if anything fails midway the user simply resumes onboarding.
 */
export async function saveOnboarding(userId: string, d: OnboardingData, targets: NutritionTargets): Promise<void> {
  const tz = deviceTimeZone();
  const today = localParts(new Date(), tz).localDate;

  unwrap(
    await supabase
      .from('user_preferences')
      .update({
        dietary_preference: d.dietaryPreference,
        allergies: d.allergies,
        food_restrictions: d.restrictions,
        preferred_cuisines: d.cuisines,
        workout_days_per_week: d.workoutDays,
        workout_minutes_per_session: d.workoutMinutes,
        workout_environment: d.workoutEnvironment,
      })
      .eq('user_id', userId),
  );

  // Keep goal history: deactivate the old active goal, then insert the new one.
  unwrap(await supabase.from('user_goals').update({ is_active: false }).eq('user_id', userId).eq('is_active', true));
  unwrap(
    await supabase.from('user_goals').insert({
      user_id: userId,
      goal_type: d.goalType,
      start_weight_kg: d.weightKg,
      target_weight_kg: d.goalWeightKg,
      target_date: d.targetDate,
      weekly_rate_kg: d.weeklyRateKg,
    }),
  );

  unwrap(
    await supabase.from('weight_logs').insert({ user_id: userId, weight_kg: d.weightKg, local_date: today }),
  );

  unwrap(
    await supabase.from('nutrition_targets').insert({
      user_id: userId,
      set_by: userId,
      source: 'calculated',
      effective_from: today,
      calories_kcal: targets.caloriesKcal,
      protein_g: targets.proteinG,
      carbohydrates_g: targets.carbohydratesG,
      fat_g: targets.fatG,
      fibre_g: targets.fibreG,
      water_ml: targets.waterMl,
    }),
  );

  unwrap(
    await supabase
      .from('profiles')
      .update({
        display_name: d.displayName.trim() || null,
        birth_year: d.age ? new Date().getFullYear() - d.age : null,
        height_cm: d.heightCm,
        sex: d.sex,
        activity_level: d.activityLevel,
        fitness_experience: d.experience,
        timezone: tz,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq('id', userId),
  );
}

export async function getCurrentTargets(userId: string): Promise<NutritionTargetRow | null> {
  return unwrap(
    await supabase
      .from('nutrition_targets')
      .select('*')
      .eq('user_id', userId)
      .order('effective_from', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
}

export async function saveManualTargets(
  userId: string,
  t: Pick<NutritionTargetRow, 'calories_kcal' | 'protein_g' | 'carbohydrates_g' | 'fat_g' | 'fibre_g' | 'water_ml'>,
): Promise<void> {
  unwrap(
    await supabase.from('nutrition_targets').insert({
      ...t,
      user_id: userId,
      set_by: userId,
      source: 'manual',
      effective_from: localParts(new Date()).localDate,
    }),
  );
}

export async function getActiveGoal(userId: string): Promise<UserGoalRow | null> {
  return unwrap(
    await supabase.from('user_goals').select('*').eq('user_id', userId).eq('is_active', true).maybeSingle(),
  );
}

export async function getPreferences(userId: string): Promise<UserPreferencesRow | null> {
  return unwrap(await supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle());
}

export async function updateProfile(userId: string, patch: Partial<ProfileRow>): Promise<void> {
  unwrap(await supabase.from('profiles').update(patch).eq('id', userId));
}
