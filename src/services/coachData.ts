import { supabase } from '@/lib/supabase';
import { generatePlan, type Experience, type GoalType, type WorkoutPlan } from '@/lib/workout/plan';
import type { NutritionTargetRow, ProfileRow, UserGoalRow, UserPreferencesRow } from '@/types/database';
import { getActiveGoal, getCurrentTargets, getPreferences } from './profile';

export interface CoachData {
  prefs: UserPreferencesRow | null;
  goal: UserGoalRow | null;
  targets: NutritionTargetRow | null;
  weightKg: number | null;
}

export async function getCoachData(userId: string): Promise<CoachData> {
  const [prefs, goal, targets, weight] = await Promise.all([
    getPreferences(userId),
    getActiveGoal(userId),
    getCurrentTargets(userId),
    supabase.from('weight_logs').select('weight_kg').eq('user_id', userId).order('logged_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  return { prefs, goal, targets, weightKg: weight.data ? Number(weight.data.weight_kg) : null };
}

export interface TrainingSetup {
  days: number;
  minutes: number;
  environment: 'gym' | 'home';
}

export function setupFrom(prefs: UserPreferencesRow | null): TrainingSetup {
  const env = prefs?.workout_environment;
  return {
    days: Math.min(6, Math.max(2, prefs?.workout_days_per_week ?? 3)),
    minutes: prefs?.workout_minutes_per_session ?? 45,
    environment: env === 'home' || env === 'outdoor' ? 'home' : 'gym',
  };
}

export function planFor(data: CoachData, profile: ProfileRow | null, setup: TrainingSetup): WorkoutPlan {
  return generatePlan({
    daysPerWeek: setup.days,
    minutes: setup.minutes,
    environment: setup.environment,
    experience: (profile?.fitness_experience as Experience | null) ?? 'beginner',
    goal: (data.goal?.goal_type as GoalType | undefined) ?? 'general_fitness',
    conditions: data.prefs?.health_conditions ?? [],
    meds: data.prefs?.medication_flags ?? [],
  });
}
