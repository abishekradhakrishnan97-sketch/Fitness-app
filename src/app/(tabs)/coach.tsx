import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Banner, Button, Card, ChoiceGroup, ErrorState, Icon, LoadingState, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthProvider';
import { assessGoal } from '@/lib/nutrition/targets';
import { CONDITION_LABEL, HEALTH_DISCLAIMER, type Condition } from '@/lib/workout/health';
import { suggestedWeekdays } from '@/lib/workout/plan';
import { useAsync } from '@/lib/useAsync';
import { saveWorkoutPrefs } from '@/services/coach';
import { getCoachData, planFor, setupFrom, type TrainingSetup } from '@/services/coachData';
import { friendlyError } from '@/services/errors';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, stroke } from '@/theme/tokens';

const DAYS = [2, 3, 4, 5, 6].map((d) => ({ value: String(d), label: `${d} days` }));
const MINUTES = [30, 45, 60, 75, 90].map((m) => ({ value: String(m), label: `${m} min` }));
const WHERE = [{ value: 'gym', label: 'Gym' }, { value: 'home', label: 'Home' }];

export default function Coach() {
  const { colors } = useTheme();
  const { session, profile } = useAuth();
  const userId = session!.user.id;
  const { data, loading, error, reload, refreshing } = useAsync(() => getCoachData(userId), [userId], { refetchOnFocus: true });
  const [override, setOverride] = useState<TrainingSetup | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (loading && !data) return <Screen><LoadingState /></Screen>;
  if (error && !data) return <Screen><ErrorState message={error} onRetry={reload} /></Screen>;
  if (!data) return null;

  const setup = override ?? setupFrom(data.prefs);
  const plan = planFor(data, profile, setup);
  const weekdays = suggestedWeekdays(plan.daysPerWeek);
  const conditions = (data.prefs?.health_conditions ?? []) as Condition[];

  const change = (patch: Partial<TrainingSetup>) => {
    const next = { ...setup, ...patch };
    setOverride(next);
    setSaveError(null);
    saveWorkoutPrefs(userId, next).catch((e) => setSaveError(friendlyError(e)));
  };

  const goal = data.goal;
  const current = data.weightKg ?? (goal?.start_weight_kg ? Number(goal.start_weight_kg) : null);
  const assessment =
    goal?.target_weight_kg && goal.target_date && current
      ? assessGoal(current, Number(goal.target_weight_kg), new Date(`${goal.target_date}T00:00:00`))
      : null;
  const safeIn12Weeks = assessment?.suggestedWeeklyRateKg ? Math.round(Math.abs(assessment.suggestedWeeklyRateKg) * 12) : null;

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <View style={{ marginTop: spacing.sm }}>
        <AppText variant="overline" tone="muted">Your personal trainer</AppText>
        <AppText variant="title" accessibilityRole="header">Coach</AppText>
      </View>

      {/* Goal reality check */}
      {goal && current ? (
        <Card tone="hero">
          <AppText variant="overline" tone="muted">Your goal</AppText>
          <AppText variant="stat" numeric>
            {current.toFixed(1)}
            {goal.target_weight_kg ? ` → ${Number(goal.target_weight_kg)}` : ''}
            <AppText variant="overline" tone="muted">  kg</AppText>
          </AppText>
          {goal.target_date ? <AppText variant="caption" tone="muted">BY {goal.target_date}</AppText> : null}
          {assessment ? (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              {assessment.level === 'ok' ? (
                <Banner tone="info" title="Realistic pace">{assessment.message}</Banner>
              ) : (
                <Banner tone={assessment.level === 'unsafe' ? 'danger' : 'warning'} title={assessment.level === 'unsafe' ? 'This timeline isn’t safe' : 'Ambitious timeline'}>
                  <View style={{ gap: spacing.sm }}>
                    <AppText variant="label" tone="muted">{assessment.message}</AppText>
                    {safeIn12Weeks ? (
                      <AppText variant="label" tone="muted">
                        What’s realistic: about {safeIn12Weeks} kg in 3 months with this plan and your calorie target — and you keep your muscle.
                      </AppText>
                    ) : null}
                  </View>
                </Banner>
              )}
            </View>
          ) : (
            <AppText variant="label" tone="muted" style={{ marginTop: spacing.sm }}>
              Add a goal weight and date to get a timeline check.
            </AppText>
          )}
          <View style={styles.rowWrap}>
            {data.targets ? (
              <AppText variant="caption" tone="muted" numeric>
                DAILY TARGET {data.targets.calories_kcal} KCAL · {data.targets.protein_g} G PROTEIN
              </AppText>
            ) : null}
          </View>
          <Button label="Change goal" variant="secondary" size="sm" onPress={() => router.push('/setup')} style={{ alignSelf: 'flex-start', marginTop: spacing.md }} />
        </Card>
      ) : null}

      {/* Health profile */}
      <Card>
        <View style={styles.head}>
          <AppText variant="heading">Health profile</AppText>
          <Button label={conditions.length ? 'Edit' : 'Add'} size="sm" variant="secondary" onPress={() => router.push('/plan/health')} />
        </View>
        {conditions.length ? (
          <View style={styles.tags}>
            {conditions.map((c) => (
              <View key={c} style={[styles.tag, { borderColor: colors.ink, backgroundColor: colors.infoSoft }]}>
                <AppText variant="caption">{(CONDITION_LABEL[c] ?? c).toUpperCase()}</AppText>
              </View>
            ))}
          </View>
        ) : (
          <AppText tone="muted" variant="label">
            Have diabetes, blood pressure, joint pain or take regular medicine? Add it and your workouts and meal ideas adapt.
          </AppText>
        )}
      </Card>

      {plan.health.needsClearance ? (
        <Banner tone="danger" title="Check with your doctor first">
          With your health profile, get medical clearance before starting or changing an exercise programme.
        </Banner>
      ) : null}

      {/* Training setup */}
      <Card>
        <AppText variant="heading" style={{ marginBottom: spacing.md }}>Your training week</AppText>
        <View style={{ gap: spacing.md }}>
          <ChoiceGroup label="Days per week" layout="scroll" options={DAYS} value={String(setup.days)} onChange={(v) => change({ days: Number(v) })} />
          <ChoiceGroup label="Time per session" layout="scroll" options={MINUTES} value={MINUTES.some((m) => m.value === String(setup.minutes)) ? String(setup.minutes) : null} onChange={(v) => change({ minutes: Number(v) })} />
          <ChoiceGroup label="Where" options={WHERE} value={setup.environment} onChange={(v) => change({ environment: v as 'gym' | 'home' })} />
          {saveError ? <Banner tone="danger">{saveError}</Banner> : null}
        </View>
      </Card>

      {/* The plan */}
      <View>
        <View style={styles.head}>
          <AppText variant="heading" accessibilityRole="header">{plan.splitName}</AppText>
        </View>
        <AppText variant="label" tone="muted" style={{ marginBottom: spacing.md }}>{plan.summary}</AppText>
        <View style={{ gap: spacing.md }}>
          {plan.days.map((d, i) => (
            <Pressable
              key={d.key}
              onPress={() => router.push({ pathname: '/plan/workout', params: { d: String(i), days: String(setup.days), minutes: String(setup.minutes), env: setup.environment } })}
              accessibilityRole="button"
              accessibilityLabel={`${weekdays[i]}: ${d.title}, ${d.exercises.length} exercises, about ${d.estMinutes} minutes. Open workout`}
            >
              {({ pressed }) => (
                <Card padded={false} style={pressed ? { transform: [{ translateX: 2 }, { translateY: 2 }] } : undefined}>
                  <View style={styles.dayRow}>
                    <View style={[styles.dayBadge, { backgroundColor: colors.primary, borderColor: colors.ink }]}>
                      <AppText variant="overline" color={colors.onPrimary}>{weekdays[i]}</AppText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyStrong">{d.title}</AppText>
                      <AppText variant="caption" tone="subtle">{d.focus.toUpperCase()}</AppText>
                      <AppText variant="caption" tone="muted" numeric>
                        {d.exercises.length} EXERCISES · ~{d.estMinutes} MIN{d.cardio ? ' · + CARDIO' : ''}
                      </AppText>
                    </View>
                    <Icon name="chevron-forward" size={18} color={colors.text} />
                  </View>
                </Card>
              )}
            </Pressable>
          ))}
        </View>
        <AppText variant="label" tone="muted" style={{ marginTop: spacing.md }}>{plan.restDays}</AppText>
      </View>

      {plan.health.workout.length ? (
        <Card>
          <AppText variant="heading" style={{ marginBottom: spacing.sm }}>Training with your health profile</AppText>
          <View style={{ gap: spacing.sm }}>
            {plan.health.workout.map((w) => (
              <View key={w} style={styles.bullet}>
                <View style={[styles.dot, { backgroundColor: plan.health.hypoRisk && /blood sugar|glucose|carbohydrate/i.test(w) ? colors.danger : colors.ink }]} />
                <AppText variant="label" tone="muted" style={{ flex: 1 }}>{w}</AppText>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <Card fill={colors.primarySoft}>
        <AppText variant="heading">Meal ideas for you</AppText>
        <AppText variant="label" tone="muted" style={{ marginVertical: spacing.sm }}>
          Meals that fit your remaining calories{conditions.length ? ' and your health profile' : ''} — or a full day of eating.
        </AppText>
        <Button label="Get meal ideas" icon="restaurant-outline" onPress={() => router.push('/plan/meals')} style={{ alignSelf: 'flex-start' }} />
      </Card>

      <AppText variant="caption" tone="subtle">{HEALTH_DISCLAIMER}</AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: { borderWidth: stroke.base, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  dayBadge: { width: 52, height: 52, borderWidth: stroke.base, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  bullet: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, marginTop: 6 },
});
