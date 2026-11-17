import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText, Banner, Button, Card, ErrorState, LoadingState, Screen } from '@/components/ui';
import { ExerciseAnimation } from '@/components/workout/ExerciseAnimation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { HEALTH_DISCLAIMER } from '@/lib/workout/health';
import { suggestedWeekdays } from '@/lib/workout/plan';
import { useAsync } from '@/lib/useAsync';
import { getCoachData, planFor, setupFrom } from '@/services/coachData';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, stroke } from '@/theme/tokens';

/** One day of the plan: every exercise with an animated demo, sets × reps, rest and form cues. */
export default function WorkoutDay() {
  const params = useLocalSearchParams<{ d?: string; days?: string; minutes?: string; env?: string }>();
  const { colors } = useTheme();
  const { session, profile } = useAuth();
  const userId = session!.user.id;
  const { data, loading, error, reload } = useAsync(() => getCoachData(userId), [userId]);

  if (loading) return <Screen narrow><LoadingState /></Screen>;
  if (error || !data) return <Screen narrow><ErrorState message={error ?? 'Could not load your plan.'} onRetry={reload} /></Screen>;

  const saved = setupFrom(data.prefs);
  const setup = {
    days: Number(params.days) || saved.days,
    minutes: Number(params.minutes) || saved.minutes,
    environment: params.env === 'home' || params.env === 'gym' ? params.env : saved.environment,
  };
  const plan = planFor(data, profile, setup);
  const index = Math.min(plan.days.length - 1, Math.max(0, Number(params.d) || 0));
  const day = plan.days[index];
  const weekday = suggestedWeekdays(plan.daysPerWeek)[index];

  return (
    <Screen narrow>
      <View style={styles.top}>
        <Button label="Back" icon="chevron-back" variant="ghost" size="sm" onPress={() => router.back()} />
      </View>
      <View>
        <AppText variant="overline" tone="muted">{weekday} · ~{day.estMinutes} min · {plan.splitName}</AppText>
        <AppText variant="title" accessibilityRole="header">{day.title}</AppText>
        <AppText tone="muted">{day.focus}</AppText>
      </View>

      {plan.health.hypoRisk ? (
        <Banner tone="danger" title="Before you start">
          Check your blood glucose. If it is below 5.0 mmol/L (90 mg/dL), have 15–30 g of carbohydrate first, and keep fast-acting carbs with you.
        </Banner>
      ) : null}
      {plan.health.moderateOnly ? (
        <Banner tone="warning" title="Keep it moderate">
          Stop each set with 2–3 reps still in the tank, breathe out as you lift, and rest fully between sets.
        </Banner>
      ) : null}

      <Card tone="inset">
        <AppText variant="overline">Warm-up</AppText>
        <AppText variant="label" tone="muted">{day.warmup}</AppText>
      </Card>

      {day.exercises.map((p, i) => (
        <Card key={p.exercise.id}>
          <View style={styles.exRow}>
            <ExerciseAnimation pattern={p.exercise.pattern} label={p.exercise.name} size={112} />
            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText variant="overline" tone="subtle">{i + 1} / {day.exercises.length} · {p.exercise.muscles}</AppText>
              <AppText variant="heading">{p.exercise.name}</AppText>
              <View style={[styles.dose, { borderColor: colors.ink }]}>
                {[
                  ['Sets', String(p.sets)],
                  ['Reps', p.reps],
                  ['Rest', `${p.restSec}s`],
                ].map(([l, v], j) => (
                  <View key={l} style={[styles.doseCell, j > 0 && { borderLeftWidth: stroke.base, borderColor: colors.ink }]}>
                    <AppText variant="caption" tone="subtle">{l.toUpperCase()}</AppText>
                    <AppText variant="statSm" numeric style={{ fontSize: 15 }}>{v}</AppText>
                  </View>
                ))}
              </View>
            </View>
          </View>
          <View style={{ gap: 4, marginTop: spacing.md }}>
            {p.exercise.cues.map((c, k) => (
              <AppText key={c} variant="label" tone="muted">{k + 1}. {c}</AppText>
            ))}
          </View>
        </Card>
      ))}

      {day.cardio ? (
        <Card fill={colors.infoSoft}>
          <View style={styles.exRow}>
            <ExerciseAnimation pattern="cardio" label="Cardio finisher" size={84} />
            <View style={{ flex: 1 }}>
              <AppText variant="overline">Cardio finisher</AppText>
              <AppText variant="label" tone="muted">{day.cardio}</AppText>
            </View>
          </View>
        </Card>
      ) : null}

      <Card tone="inset">
        <AppText variant="overline">How hard?</AppText>
        <AppText variant="label" tone="muted">
          Pick a weight where the last 2 reps are hard but your form stays clean. When you hit the top of the rep range on every set, add a little weight next time. Sharp pain means stop.
        </AppText>
      </Card>
      <AppText variant="caption" tone="subtle">{HEALTH_DISCLAIMER}</AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', marginLeft: -spacing.xs },
  exRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  dose: { flexDirection: 'row', borderWidth: stroke.base, borderRadius: radius.md, marginTop: spacing.xs },
  doseCell: { flex: 1, paddingVertical: 4, paddingHorizontal: spacing.sm },
});
