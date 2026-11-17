import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Banner, Button, Card, LoadingState, Screen, TextField } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthProvider';
import { ageFromBirthYear, calculateTargets, type ActivityLevel, type GoalType, type Sex } from '@/lib/nutrition/targets';
import { supabase } from '@/lib/supabase';
import { useAsync } from '@/lib/useAsync';
import { checkRange } from '@/lib/validation';
import { friendlyError } from '@/services/errors';
import { getActiveGoal, getCurrentTargets, saveManualTargets } from '@/services/profile';
import { spacing } from '@/theme/tokens';

type Field = 'calories' | 'protein' | 'carbs' | 'fat' | 'fibre' | 'water';

export default function Targets() {
  const { session, profile } = useAuth();
  const userId = session!.user.id;
  const { data, loading } = useAsync(async () => {
    const [targets, goal, weight] = await Promise.all([
      getCurrentTargets(userId),
      getActiveGoal(userId),
      supabase.from('weight_logs').select('weight_kg').eq('user_id', userId).order('logged_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    return { targets, goal, weightKg: weight.data ? Number(weight.data.weight_kg) : null };
  }, [userId]);

  const recommended = useMemo(() => {
    if (!data?.weightKg) return null;
    return calculateTargets({
      weightKg: data.weightKg,
      heightCm: profile?.height_cm ? Number(profile.height_cm) : null,
      age: ageFromBirthYear(profile?.birth_year),
      sex: (profile?.sex as Sex | null) ?? null,
      activityLevel: (profile?.activity_level as ActivityLevel | null) ?? null,
      goalType: (data.goal?.goal_type as GoalType | undefined) ?? null,
      weeklyRateKg: data.goal?.weekly_rate_kg ? Number(data.goal.weekly_rate_kg) : null,
    });
  }, [data, profile]);

  const [edits, setEdits] = useState<Record<Field, string> | null>(null);
  const t0 = data?.targets;
  const v: Record<Field, string> = edits ?? {
    calories: t0 ? String(t0.calories_kcal) : '',
    protein: t0 ? String(t0.protein_g) : '',
    carbs: t0 ? String(t0.carbohydrates_g) : '',
    fat: t0 ? String(t0.fat_g) : '',
    fibre: t0 ? String(t0.fibre_g) : '',
    water: t0 ? String(t0.water_ml) : '',
  };
  const setV = (next: Record<Field, string> | ((s: Record<Field, string>) => Record<Field, string>)) =>
    setEdits(typeof next === 'function' ? next(v) : next);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const checks = {
    calories: checkRange(v.calories, 800, 8000, 'Calories', true),
    protein: checkRange(v.protein, 0, 600, 'Protein', true),
    carbs: checkRange(v.carbs, 0, 1200, 'Carbs', true),
    fat: checkRange(v.fat, 0, 400, 'Fat', true),
    fibre: checkRange(v.fibre, 0, 150, 'Fibre', true),
    water: checkRange(v.water, 0, 10000, 'Water', true),
  };
  const macroKcal =
    (checks.protein.value ?? 0) * 4 + (checks.carbs.value ?? 0) * 4 + (checks.fat.value ?? 0) * 9;
  const mismatch = checks.calories.value ? Math.abs(macroKcal - checks.calories.value) / checks.calories.value > 0.1 : false;
  const lowCalories = checks.calories.value !== null && checks.calories.value < 1200;

  const set = (k: Field) => (text: string) => setV((s) => ({ ...s, [k]: text }));

  const useRecommended = () => {
    if (!recommended) return;
    setV({
      calories: String(recommended.caloriesKcal),
      protein: String(recommended.proteinG),
      carbs: String(recommended.carbohydratesG),
      fat: String(recommended.fatG),
      fibre: String(recommended.fibreG),
      water: String(recommended.waterMl),
    });
  };

  const save = async () => {
    if (Object.values(checks).some((c) => c.error)) return setError('Fix the highlighted values.');
    setBusy(true);
    setError(null);
    try {
      await saveManualTargets(userId, {
        calories_kcal: Math.round(checks.calories.value!),
        protein_g: Math.round(checks.protein.value!),
        carbohydrates_g: Math.round(checks.carbs.value!),
        fat_g: Math.round(checks.fat.value!),
        fibre_g: Math.round(checks.fibre.value!),
        water_ml: Math.round(checks.water.value!),
      });
      router.back();
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  };

  if (loading) return <Screen><LoadingState /></Screen>;

  return (
    <Screen
      narrow
      footer={
        <View style={styles.row}>
          <Button label="Cancel" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
          <Button label="Save targets" onPress={save} loading={busy} style={{ flex: 2 }} />
        </View>
      }
    >
      <AppText variant="title" accessibilityRole="header" style={{ marginTop: spacing.sm }}>Daily targets</AppText>
      {data?.targets?.source === 'trainer' ? (
        <Banner tone="info">Your trainer set these targets. Changes you save will replace them for you.</Banner>
      ) : null}
      {recommended ? (
        <Card tone="inset">
          <AppText variant="label" tone="muted">
            Recommended for your profile: {recommended.caloriesKcal} kcal · P {recommended.proteinG} g · C{' '}
            {recommended.carbohydratesG} g · F {recommended.fatG} g
          </AppText>
          <Button label="Use recommended" variant="ghost" size="sm" onPress={useRecommended} style={{ alignSelf: 'flex-start', marginTop: spacing.sm }} />
        </Card>
      ) : null}
      <TextField label="Calories" value={v.calories} onChangeText={set('calories')} keyboardType="number-pad" suffix="kcal" error={checks.calories.error} />
      <View style={styles.row}>
        <View style={styles.flex}><TextField label="Protein" value={v.protein} onChangeText={set('protein')} keyboardType="number-pad" suffix="g" error={checks.protein.error} /></View>
        <View style={styles.flex}><TextField label="Carbs" value={v.carbs} onChangeText={set('carbs')} keyboardType="number-pad" suffix="g" error={checks.carbs.error} /></View>
      </View>
      <View style={styles.row}>
        <View style={styles.flex}><TextField label="Fat" value={v.fat} onChangeText={set('fat')} keyboardType="number-pad" suffix="g" error={checks.fat.error} /></View>
        <View style={styles.flex}><TextField label="Fibre" value={v.fibre} onChangeText={set('fibre')} keyboardType="number-pad" suffix="g" error={checks.fibre.error} /></View>
      </View>
      <TextField label="Water" value={v.water} onChangeText={set('water')} keyboardType="number-pad" suffix="ml" error={checks.water.error} />
      {mismatch ? (
        <Banner tone="warning">
          {`Your macros add up to about ${Math.round(macroKcal)} kcal, which differs from your calorie target.`}
        </Banner>
      ) : null}
      {lowCalories ? (
        <Banner tone="warning" title="Very low calorie target">
          Eating under 1,200 kcal a day is hard to meet nutrient needs on and isn’t recommended without medical supervision.
        </Banner>
      ) : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: spacing.md }, flex: { flex: 1 } });
