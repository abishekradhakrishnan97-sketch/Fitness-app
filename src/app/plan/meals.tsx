import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Banner, Button, Card, ChoiceGroup, LoadingState, Screen, TextField } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthProvider';
import { setPendingItems } from '@/lib/draftStore';
import { emptyItem } from '@/lib/nutrition/mealDraft';
import { categoriseMeal, localParts, MEAL_TYPE_LABEL, type MealType } from '@/lib/time/mealCategory';
import { HEALTH_DISCLAIMER, healthGuidance } from '@/lib/workout/health';
import { useAsync } from '@/lib/useAsync';
import { getMealIdeas, type MealIdea, type MealIdeasResult } from '@/services/coach';
import { getToday } from '@/services/dashboard';
import { getPreferences } from '@/services/profile';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, stroke } from '@/theme/tokens';

type Mode = 'meal' | 'day';
const MEALS = (['breakfast', 'lunch', 'snack', 'dinner'] as const).map((m) => ({ value: m, label: MEAL_TYPE_LABEL[m] }));

function nowMeal(): 'breakfast' | 'lunch' | 'snack' | 'dinner' {
  const t = categoriseMeal(localParts(new Date()).minutes) as MealType;
  return t === 'breakfast' || t === 'lunch' || t === 'dinner' ? t : 'snack';
}

export default function MealIdeas() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session!.user.id;
  const { data } = useAsync(async () => ({ today: await getToday(userId), prefs: await getPreferences(userId) }), [userId], { refetchOnFocus: true });
  const [mode, setMode] = useState<Mode>('meal');
  const [mealType, setMealType] = useState(nowMeal);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MealIdeasResult | null>(null);

  const target = data?.today.targets?.calories_kcal ?? null;
  const remaining = target !== null && data ? Math.max(0, Math.round(target - data.today.totals.calories)) : null;
  const remainingProtein = data?.today.targets ? Math.max(0, Math.round(data.today.targets.protein_g - data.today.totals.protein)) : null;
  const guidance = healthGuidance(data?.prefs?.health_conditions ?? [], data?.prefs?.medication_flags ?? []);
  const hasHealth = (data?.prefs?.health_conditions ?? []).length > 0;
  const consent = !!data?.prefs?.health_ai_consent_at;

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(
        await getMealIdeas({
          mode,
          mealType,
          remainingKcal: remaining && remaining > 100 ? remaining : undefined,
          remainingProteinG: remainingProtein ?? undefined,
          note,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get meal ideas.');
    } finally {
      setBusy(false);
    }
  };

  const logIdea = (idea: MealIdea) => {
    setPendingItems(
      idea.items.map((i) =>
        emptyItem({
          name: i.name,
          quantity: String(i.quantity),
          unit: i.unit.slice(0, 24),
          grams: i.grams === null ? '' : String(i.grams),
          calories: String(i.calories_kcal),
          protein: String(i.protein_g),
          carbs: String(i.carbohydrates_g),
          fat: String(i.fat_g),
          fibre: String(i.fibre_g),
          source: 'ai_search',
          isEstimate: true,
        }),
      ),
    );
    router.push('/log/manual');
  };

  return (
    <Screen narrow>
      <View style={styles.top}>
        <Button label="Back" icon="chevron-back" variant="ghost" size="sm" onPress={() => router.back()} />
      </View>
      <View>
        <AppText variant="overline" tone="muted">Coach</AppText>
        <AppText variant="title" accessibilityRole="header">Meal ideas</AppText>
      </View>

      {target !== null ? (
        <Card tone="hero">
          <AppText variant="overline" tone="muted">Left today</AppText>
          <AppText variant="stat" numeric>
            {remaining} <AppText variant="overline" tone="muted">kcal · {remainingProtein} g protein to go</AppText>
          </AppText>
        </Card>
      ) : null}

      {guidance.food.length ? (
        <Card>
          <AppText variant="heading" style={{ marginBottom: spacing.sm }}>Eating with your health profile</AppText>
          <View style={{ gap: spacing.sm }}>
            {guidance.food.map((f) => (
              <AppText key={f} variant="label" tone="muted">• {f}</AppText>
            ))}
          </View>
        </Card>
      ) : null}
      {hasHealth && !consent ? (
        <Banner tone="warning" title="Ideas won’t use your health profile yet">
          <View style={{ gap: spacing.sm }}>
            <AppText variant="label" tone="muted">You haven’t allowed your conditions to be shared with the AI, so suggestions are general.</AppText>
            <Button label="Review permission" size="sm" variant="secondary" onPress={() => router.push('/plan/health')} style={{ alignSelf: 'flex-start' }} />
          </View>
        </Banner>
      ) : null}

      <ChoiceGroup<Mode>
        label="What do you need?"
        options={[{ value: 'meal', label: 'Ideas for one meal' }, { value: 'day', label: 'A full day of eating' }]}
        value={mode}
        onChange={setMode}
      />
      {mode === 'meal' ? <ChoiceGroup label="Meal" layout="scroll" options={MEALS} value={mealType} onChange={setMealType} /> : null}
      <TextField
        label="Anything specific? (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="e.g. Kerala style, no cooking, I have eggs and rice"
        maxLength={200}
      />
      <Button label={result ? 'Get new ideas' : 'Get ideas'} icon="sparkles" size="lg" onPress={generate} loading={busy} fullWidth />
      {busy ? <LoadingState label="Planning meals… up to 30 seconds" /> : null}
      {error ? <Banner tone="danger" title="Couldn’t get ideas">{error}</Banner> : null}

      {result && !busy ? (
        <>
          {result.summary ? <AppText tone="muted">{result.summary}</AppText> : null}
          {result.mode === 'day' ? (
            <Card tone="inset">
              <AppText variant="overline">Day total</AppText>
              <AppText variant="statSm" numeric>
                {result.ideas.reduce((s, i) => s + i.totals.calories_kcal, 0)} kcal · {Math.round(result.ideas.reduce((s, i) => s + i.totals.protein_g, 0))} g protein
              </AppText>
            </Card>
          ) : null}
          {result.ideas.map((idea, n) => (
            <Card key={`${idea.title}-${n}`}>
              <View style={styles.head}>
                <View style={{ flex: 1 }}>
                  <AppText variant="overline" tone="subtle">{MEAL_TYPE_LABEL[idea.meal_type]}</AppText>
                  <AppText variant="heading">{idea.title}</AppText>
                </View>
                <View style={[styles.kcal, { backgroundColor: colors.primary, borderColor: colors.ink }]}>
                  <AppText variant="statSm" color={colors.onPrimary} numeric>{idea.totals.calories_kcal}</AppText>
                  <AppText variant="caption" color={colors.onPrimary}>KCAL</AppText>
                </View>
              </View>
              <AppText variant="caption" tone="muted" numeric style={{ marginTop: spacing.xs }}>
                P {Math.round(idea.totals.protein_g)} · C {Math.round(idea.totals.carbohydrates_g)} · F {Math.round(idea.totals.fat_g)} · FIBRE {Math.round(idea.totals.fibre_g)} G
              </AppText>
              <View style={{ marginVertical: spacing.md, gap: 4 }}>
                {idea.items.map((i, k) => (
                  <View key={`${i.name}-${k}`} style={styles.item}>
                    <AppText variant="label" style={{ flex: 1 }}>
                      {i.name} <AppText variant="caption" tone="subtle">{i.quantity} {i.unit}{i.grams ? ` · ${i.grams} g` : ''}</AppText>
                    </AppText>
                    <AppText variant="caption" numeric>{Math.round(i.calories_kcal)}</AppText>
                  </View>
                ))}
              </View>
              {idea.why ? <AppText variant="label" tone="muted">{idea.why}</AppText> : null}
              <Button label="Log this meal" icon="add" size="sm" variant="secondary" onPress={() => logIdea(idea)} style={{ alignSelf: 'flex-start', marginTop: spacing.md }} />
            </Card>
          ))}
          {result.tips.length ? (
            <Card tone="inset">
              <AppText variant="overline">Tips</AppText>
              {result.tips.map((t) => (
                <AppText key={t} variant="label" tone="muted">• {t}</AppText>
              ))}
            </Card>
          ) : null}
          <AppText variant="caption" tone="subtle">
            Nutrition values are AI estimates. {hasHealth ? HEALTH_DISCLAIMER : 'Check labels and adjust portions to what you actually eat.'}
          </AppText>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', marginLeft: -spacing.xs },
  head: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  kcal: { borderWidth: stroke.base, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 2, alignItems: 'center' },
  item: { flexDirection: 'row', gap: spacing.sm, alignItems: 'baseline' },
});
