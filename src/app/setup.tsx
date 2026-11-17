import { OnboardingForm, type OnboardingInitial } from '@/components/onboarding/OnboardingForm';
import { ErrorState, LoadingState, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthProvider';
import { ageFromBirthYear, type ActivityLevel, type GoalType, type Sex } from '@/lib/nutrition/targets';
import { supabase } from '@/lib/supabase';
import { useAsync } from '@/lib/useAsync';
import { getActiveGoal, getPreferences } from '@/services/profile';

const KNOWN_ALLERGIES = ['Peanuts', 'Tree nuts', 'Dairy', 'Eggs', 'Gluten', 'Soy', 'Fish', 'Shellfish', 'Sesame'];
const str = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(Number(n)));

/** Edit profile, goal and preferences after onboarding (recalculates targets on save). */
export default function EditSetup() {
  const { session, profile } = useAuth();
  const userId = session!.user.id;
  const { data, loading, error, reload } = useAsync(async (): Promise<OnboardingInitial> => {
    const [goal, prefs, weight] = await Promise.all([
      getActiveGoal(userId),
      getPreferences(userId),
      supabase.from('weight_logs').select('weight_kg').eq('user_id', userId).order('logged_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const age = ageFromBirthYear(profile?.birth_year);
    const weekly = goal?.weekly_rate_kg ? Math.abs(Number(goal.weekly_rate_kg)) : null;
    return {
      name: profile?.display_name ?? '',
      age: age ? String(age) : '',
      sex: (profile?.sex as Sex | null) ?? null,
      height: str(profile?.height_cm),
      weight: str(weight.data?.weight_kg ?? goal?.start_weight_kg),
      goal: (goal?.goal_type as GoalType | undefined) ?? null,
      goalWeight: str(goal?.target_weight_kg),
      customDate: goal?.target_date ?? null,
      pace: weekly && ['0.25', '0.5', '0.75'].includes(String(weekly)) ? String(weekly) : '0.5',
      activity: (profile?.activity_level as ActivityLevel | null) ?? null,
      experience: (profile?.fitness_experience as OnboardingInitial['experience']) ?? null,
      days: str(prefs?.workout_days_per_week),
      minutes: str(prefs?.workout_minutes_per_session),
      environment: (prefs?.workout_environment as OnboardingInitial['environment']) ?? null,
      diet: prefs?.dietary_preference ?? null,
      cuisines: prefs?.preferred_cuisines ?? [],
      allergies: (prefs?.allergies ?? []).filter((a) => KNOWN_ALLERGIES.includes(a)),
      otherAllergies: (prefs?.allergies ?? []).filter((a) => !KNOWN_ALLERGIES.includes(a)).join(', '),
      restrictions: (prefs?.food_restrictions ?? []).join(', '),
    };
  }, [userId]);

  if (loading) return <Screen narrow><LoadingState /></Screen>;
  if (error || !data) return <Screen narrow><ErrorState message={error ?? 'Could not load your profile.'} onRetry={reload} /></Screen>;
  return <OnboardingForm mode="edit" initial={data} />;
}
