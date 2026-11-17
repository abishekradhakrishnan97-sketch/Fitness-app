import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Banner, Button, Card, ChoiceGroup, Screen, TextField, type Choice } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth/AuthProvider';
import {
  assessGoal,
  calculateTargets,
  type ActivityLevel,
  type GoalType,
  type Sex,
} from '@/lib/nutrition/targets';
import { checkRange } from '@/lib/validation';
import { friendlyError } from '@/services/errors';
import { saveOnboarding } from '@/services/profile';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

const GOALS: Choice<GoalType>[] = [
  { value: 'weight_loss', label: 'Lose weight', description: 'Reduce body fat at a sustainable pace' },
  { value: 'muscle_gain', label: 'Build muscle', description: 'Gain strength and lean mass' },
  { value: 'recomposition', label: 'Body recomposition', description: 'Lose fat and build muscle together' },
  { value: 'general_fitness', label: 'General fitness', description: 'Feel better and build healthy habits' },
  { value: 'maintenance', label: 'Maintain weight', description: 'Keep your current weight steady' },
];
const SEX: Choice<Sex>[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];
const ACTIVITY: Choice<ActivityLevel>[] = [
  { value: 'sedentary', label: 'Sedentary', description: 'Desk job, little exercise' },
  { value: 'light', label: 'Lightly active', description: 'Light exercise 1–3 days a week' },
  { value: 'moderate', label: 'Moderately active', description: 'Exercise 3–5 days a week' },
  { value: 'active', label: 'Very active', description: 'Hard exercise 6–7 days a week' },
  { value: 'very_active', label: 'Athlete / physical job', description: 'Training twice a day or heavy manual work' },
];
const EXPERIENCE: Choice<'beginner' | 'intermediate' | 'advanced'>[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];
const ENVIRONMENT: Choice<'home' | 'gym' | 'outdoor' | 'mixed'>[] = [
  { value: 'gym', label: 'Gym' },
  { value: 'home', label: 'Home' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'mixed', label: 'Mixed' },
];
const DIET: Choice<string>[] = [
  { value: 'no_preference', label: 'No preference' },
  { value: 'non_vegetarian', label: 'Non-vegetarian' },
  { value: 'eggetarian', label: 'Eggetarian' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'jain', label: 'Jain' },
];
const CUISINES: Choice<string>[] = [
  'South Indian', 'Tamil', 'Kerala', 'Karnataka', 'Andhra / Telangana', 'North Indian', 'Bengali', 'Gujarati',
  'Maharashtrian', 'Chinese', 'Continental', 'Mediterranean', 'Middle Eastern', 'East Asian',
].map((c) => ({ value: c, label: c }));
const ALLERGIES: Choice<string>[] = ['Peanuts', 'Tree nuts', 'Dairy', 'Eggs', 'Gluten', 'Soy', 'Fish', 'Shellfish', 'Sesame'].map(
  (c) => ({ value: c, label: c }),
);
const TIMEFRAMES: Choice<string>[] = [
  { value: '0', label: 'No deadline' },
  { value: '1', label: '1 month' },
  { value: '2', label: '2 months' },
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '12', label: '1 year' },
];
const PACE: Choice<string>[] = [
  { value: '0.25', label: 'Gentle · 0.25 kg/wk' },
  { value: '0.5', label: 'Steady · 0.5 kg/wk' },
  { value: '0.75', label: 'Faster · 0.75 kg/wk' },
];

const STEPS = ['About you', 'Your goal', 'Lifestyle', 'Food', 'Your plan'] as const;

function addMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export interface OnboardingInitial {
  name?: string;
  age?: string;
  sex?: Sex | null;
  height?: string;
  weight?: string;
  goal?: GoalType | null;
  goalWeight?: string;
  customDate?: string | null;
  pace?: string;
  activity?: ActivityLevel | null;
  experience?: 'beginner' | 'intermediate' | 'advanced' | null;
  days?: string;
  minutes?: string;
  environment?: 'home' | 'gym' | 'outdoor' | 'mixed' | null;
  diet?: string | null;
  cuisines?: string[];
  allergies?: string[];
  otherAllergies?: string;
  restrictions?: string;
}

/** Onboarding wizard. In "edit" mode it's prefilled and returns to Profile after saving. */
export function OnboardingForm({ initial = {}, mode = 'create' }: { initial?: OnboardingInitial; mode?: 'create' | 'edit' }) {
  const { colors } = useTheme();
  const { session, profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [name, setName] = useState(initial.name ?? profile?.display_name ?? '');
  const [age, setAge] = useState(initial.age ?? '');
  const [sex, setSex] = useState<Sex | null>(initial.sex ?? null);
  const [height, setHeight] = useState(initial.height ?? '');
  const [weight, setWeight] = useState(initial.weight ?? '');
  const [goal, setGoal] = useState<GoalType | null>(initial.goal ?? null);
  const [goalWeight, setGoalWeight] = useState(initial.goalWeight ?? '');
  const [timeframe, setTimeframe] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState<string | null>(initial.customDate ?? null);
  const [pace, setPace] = useState(initial.pace ?? '0.5');
  const [activity, setActivity] = useState<ActivityLevel | null>(initial.activity ?? null);
  const [experience, setExperience] = useState<'beginner' | 'intermediate' | 'advanced' | null>(initial.experience ?? null);
  const [days, setDays] = useState(initial.days ?? '');
  const [minutes, setMinutes] = useState(initial.minutes ?? '');
  const [environment, setEnvironment] = useState<'home' | 'gym' | 'outdoor' | 'mixed' | null>(initial.environment ?? null);
  const [diet, setDiet] = useState<string | null>(initial.diet ?? null);
  const [cuisines, setCuisines] = useState<string[]>(initial.cuisines ?? []);
  const [allergies, setAllergies] = useState<string[]>(initial.allergies ?? []);
  const [otherAllergies, setOtherAllergies] = useState(initial.otherAllergies ?? '');
  const [restrictions, setRestrictions] = useState(initial.restrictions ?? '');
  const [showErrors, setShowErrors] = useState(false);

  const ageC = checkRange(age, 13, 100, 'Age');
  const heightC = checkRange(height, 100, 250, 'Height');
  const weightC = checkRange(weight, 25, 350, 'Weight', true);
  const goalWeightC = checkRange(goalWeight, 25, 350, 'Goal weight');
  const daysC = checkRange(days, 0, 7, 'Days');
  const minutesC = checkRange(minutes, 0, 300, 'Minutes');

  const targetDate = customDate ?? (timeframe && timeframe !== '0' ? addMonths(Number(timeframe)) : null);
  const changesWeight = goal === 'weight_loss' || goal === 'muscle_gain';

  const assessment = useMemo(() => {
    if (!weightC.value || !goalWeightC.value || !targetDate) return null;
    return assessGoal(weightC.value, goalWeightC.value, new Date(`${targetDate}T00:00:00`));
  }, [weightC.value, goalWeightC.value, targetDate]);

  const weeklyRate = goal === 'weight_loss' ? -Number(pace) : goal === 'muscle_gain' ? 0.25 : null;

  const targets = useMemo(() => {
    if (!weightC.value) return null;
    return calculateTargets({
      weightKg: weightC.value,
      heightCm: heightC.value,
      age: ageC.value,
      sex,
      activityLevel: activity,
      goalType: goal,
      weeklyRateKg: weeklyRate,
    });
  }, [weightC.value, heightC.value, ageC.value, sex, activity, goal, weeklyRate]);

  const stepValid = [
    !ageC.error && !heightC.error,
    !!weightC.value && !!goal && !goalWeightC.error,
    !daysC.error && !minutesC.error,
    true,
    !!targets,
  ][step];

  const next = () => {
    if (!stepValid) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const finish = async () => {
    if (!session || !targets || !weightC.value || !goal) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveOnboarding(
        session.user.id,
        {
          displayName: name,
          age: ageC.value,
          heightCm: heightC.value,
          weightKg: weightC.value,
          goalWeightKg: goalWeightC.value,
          targetDate,
          sex,
          activityLevel: activity,
          experience,
          goalType: goal,
          weeklyRateKg: weeklyRate,
          dietaryPreference: diet,
          allergies: [
            ...allergies,
            ...otherAllergies.split(',').map((s) => s.trim()).filter(Boolean),
          ].slice(0, 30),
          restrictions: restrictions.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 30),
          cuisines,
          workoutDays: daysC.value,
          workoutMinutes: minutesC.value,
          workoutEnvironment: environment,
        },
        targets,
      );
      await refreshProfile(); // in create mode the route guard switches to the dashboard
      if (mode === 'edit') {
        toast('Profile & targets updated');
        router.back();
      }
    } catch (e) {
      setSaveError(friendlyError(e));
      setSaving(false);
    }
  };

  const err = (e: string | null) => (showErrors ? e : null);
  const optionalStep = step === 0 || step === 2 || step === 3;

  const footer = (
    <View style={styles.footerRow}>
      {step > 0 ? (
        <Button label="Back" variant="secondary" onPress={() => setStep((s) => s - 1)} style={{ flex: 1 }} />
      ) : mode === 'edit' ? (
        <Button label="Cancel" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
      ) : null}
      {step < STEPS.length - 1 ? (
        <Button label="Continue" onPress={next} style={{ flex: 2 }} />
      ) : (
        <Button label={mode === 'edit' ? 'Save changes' : 'Start tracking'} onPress={finish} loading={saving} style={{ flex: 2 }} />
      )}
    </View>
  );

  return (
    <Screen narrow footer={footer}>
      <View style={styles.header}>
        <View style={styles.progressRow} accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <View key={s} style={[styles.progressSeg, { backgroundColor: i <= step ? colors.primary : colors.surface, borderColor: colors.ink }]} />
          ))}
        </View>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <AppText variant="overline" tone="subtle">
              Step {step + 1} of {STEPS.length}
            </AppText>
            <AppText variant="title" accessibilityRole="header">
              {STEPS[step]}
            </AppText>
          </View>
          {optionalStep ? (
            <Button label="Skip" variant="ghost" size="sm" onPress={() => { setShowErrors(false); setStep((s) => s + 1); }} />
          ) : null}
        </View>
      </View>

      {step === 0 && (
        <>
          <AppText tone="muted">All optional — it makes your calorie target more accurate.</AppText>
          <TextField label="Name" value={name} onChangeText={setName} autoComplete="name" />
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" suffix="yrs" error={err(ageC.error)} />
            </View>
            <View style={styles.flex}>
              <TextField label="Height" value={height} onChangeText={setHeight} keyboardType="decimal-pad" suffix="cm" error={err(heightC.error)} />
            </View>
          </View>
          <ChoiceGroup label="Sex (used for calorie estimates)" options={SEX} value={sex} onChange={setSex} />
        </>
      )}

      {step === 1 && (
        <>
          <TextField
            label="Current weight"
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            suffix="kg"
            error={err(weightC.error)}
          />
          <ChoiceGroup label="Main goal" layout="list" options={GOALS} value={goal} onChange={setGoal} />
          {showErrors && !goal ? <AppText variant="caption" tone="danger">Choose a goal.</AppText> : null}
          {changesWeight ? (
            <>
              <TextField
                label="Goal weight (optional)"
                value={goalWeight}
                onChangeText={setGoalWeight}
                keyboardType="decimal-pad"
                suffix="kg"
                error={err(goalWeightC.error)}
              />
              <ChoiceGroup label="Timeframe (optional)" options={TIMEFRAMES} value={customDate ? null : timeframe} onChange={(v) => { setCustomDate(null); setTimeframe(v); }} />
              {goal === 'weight_loss' ? (
                <ChoiceGroup label="Pace" options={PACE} value={pace} onChange={setPace} />
              ) : null}
              {weightC.value && goalWeightC.value && goal === 'muscle_gain' && goalWeightC.value < weightC.value - 1 ? (
                <Banner tone="warning" title="Goal weight is below your current weight">
                  <View style={{ gap: spacing.sm }}>
                    <AppText variant="label" tone="muted">
                      “Build muscle” adds a calorie surplus, so it won’t help you reach a lower weight. To lose weight while
                      keeping muscle, choose “Body recomposition” or “Lose weight”.
                    </AppText>
                    <Button label="Switch to Lose weight" variant="secondary" size="sm" onPress={() => setGoal('weight_loss')} />
                  </View>
                </Banner>
              ) : null}
              {weightC.value && goalWeightC.value && goal === 'weight_loss' && goalWeightC.value > weightC.value + 1 ? (
                <Banner tone="warning" title="Goal weight is above your current weight">
                  “Lose weight” sets a calorie deficit. If you want to gain, choose “Build muscle”.
                </Banner>
              ) : null}
              {assessment && assessment.level !== 'ok' ? (
                <Banner tone={assessment.level === 'unsafe' ? 'danger' : 'warning'} title={assessment.level === 'unsafe' ? 'This timeline is too aggressive' : 'This is an ambitious timeline'}>
                  <View style={{ gap: spacing.sm }}>
                    <AppText variant="label" tone="muted">{assessment.message}</AppText>
                    {assessment.suggestedDate ? (
                      <Button
                        label={`Use safer date (${assessment.suggestedDate})`}
                        variant="secondary"
                        size="sm"
                        onPress={() => {
                          setCustomDate(assessment.suggestedDate ?? null);
                          setTimeframe(null);
                        }}
                      />
                    ) : null}
                  </View>
                </Banner>
              ) : assessment ? (
                <Banner tone="info">{assessment.message}</Banner>
              ) : null}
              {customDate ? <AppText variant="caption" tone="muted">Target date: {customDate}</AppText> : null}
            </>
          ) : null}
        </>
      )}

      {step === 2 && (
        <>
          <ChoiceGroup label="Daily activity" layout="list" options={ACTIVITY} value={activity} onChange={setActivity} />
          <ChoiceGroup label="Training experience" options={EXPERIENCE} value={experience} onChange={setExperience} />
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField label="Workout days / week" value={days} onChangeText={setDays} keyboardType="number-pad" error={err(daysC.error)} />
            </View>
            <View style={styles.flex}>
              <TextField label="Minutes / session" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" error={err(minutesC.error)} />
            </View>
          </View>
          <ChoiceGroup label="Where do you train?" options={ENVIRONMENT} value={environment} onChange={setEnvironment} />
        </>
      )}

      {step === 3 && (
        <>
          <ChoiceGroup label="Dietary preference" options={DIET} value={diet} onChange={setDiet} />
          <ChoiceGroup label="Cuisines you eat most" multiple options={CUISINES} value={cuisines} onChange={setCuisines} />
          <ChoiceGroup label="Allergies" multiple options={ALLERGIES} value={allergies} onChange={setAllergies} />
          <TextField label="Other allergies" value={otherAllergies} onChangeText={setOtherAllergies} placeholder="Comma separated" />
          <TextField
            label="Food restrictions"
            value={restrictions}
            onChangeText={setRestrictions}
            placeholder="e.g. no beef, no onion/garlic, low sugar"
            hint="Comma separated. Used to tailor suggestions."
          />
        </>
      )}

      {step === 4 && targets && (
        <>
          <AppText tone="muted">
            A starting point based on what you shared. You can change these any time in your profile.
          </AppText>
          <Card tone="hero">
            <AppText variant="overline" tone="subtle">Daily calories</AppText>
            <AppText variant="display" numeric>
              {targets.caloriesKcal.toLocaleString()} <AppText variant="heading" tone="muted">kcal</AppText>
            </AppText>
            <AppText variant="label" tone="subtle" numeric>
              Maintenance ≈ {targets.maintenanceKcal.toLocaleString()} kcal
            </AppText>
            <View style={styles.macroGrid}>
              {[
                { label: 'Protein', v: targets.proteinG, c: colors.protein },
                { label: 'Carbs', v: targets.carbohydratesG, c: colors.carbs },
                { label: 'Fat', v: targets.fatG, c: colors.fat },
                { label: 'Fibre', v: targets.fibreG, c: colors.fibre },
              ].map((m) => (
                <View key={m.label} style={[styles.macroCell, { backgroundColor: colors.surfaceSunken }]}>
                  <View style={[styles.macroDot, { backgroundColor: m.c }]} />
                  <AppText variant="heading" numeric>{m.v} g</AppText>
                  <AppText variant="caption" tone="muted">{m.label}</AppText>
                </View>
              ))}
            </View>
            <AppText variant="label" tone="muted" numeric>
              Water: {(targets.waterMl / 1000).toFixed(2).replace(/0$/, '')} L / day
            </AppText>
          </Card>
          {targets.notes.length ? (
            <Banner tone="info" title="To improve accuracy">
              {targets.notes.join(' ')}
            </Banner>
          ) : null}
          <AppText variant="caption" tone="subtle">
            General guidance only — not medical advice. If you’re pregnant, managing a health condition, or under 18,
            check targets with a qualified professional.
          </AppText>
          {saveError ? <Banner tone="danger">{saveError}</Banner> : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.lg, marginTop: spacing.sm },
  progressRow: { flexDirection: 'row', gap: spacing.xs },
  progressSeg: { flex: 1, height: 10, borderRadius: 2, borderWidth: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  footerRow: { flexDirection: 'row', gap: spacing.md },
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.lg },
  macroCell: { flexGrow: 1, flexBasis: '45%', padding: spacing.md, borderRadius: radius.md, gap: 2 },
  macroDot: { width: 8, height: 8, borderRadius: 4, marginBottom: spacing.xs },
});
