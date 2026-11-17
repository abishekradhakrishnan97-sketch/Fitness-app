import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Banner, Button, Card, ChoiceGroup, EmptyState, ErrorState, Icon, LoadingState, Screen, TextField } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthProvider';
import { addDays, localParts, MEAL_TYPE_LABEL, type MealType } from '@/lib/time/mealCategory';
import { useAsync } from '@/lib/useAsync';
import { totalsFromMeals } from '@/services/dashboard';
import { listMeals, type MealWithItems } from '@/services/meals';
import { getCurrentTargets } from '@/services/profile';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

const RANGES = [
  { value: '1', label: 'Today' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '180 days' },
  { value: 'custom', label: 'Custom' },
];
const MEAL_ORDER: MealType[] = ['breakfast', 'pre_workout', 'lunch', 'snack', 'dinner', 'other'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dayLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Journal() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session!.user.id;
  const today = localParts(new Date()).localDate;
  const [range, setRange] = useState('7');
  const [customFrom, setCustomFrom] = useState(addDays(today, -13));
  const [customTo, setCustomTo] = useState(today);
  const [applied, setApplied] = useState<{ from: string; to: string }>({ from: addDays(today, -6), to: today });
  const [customError, setCustomError] = useState<string | null>(null);

  const selectRange = (r: string) => {
    setRange(r);
    if (r !== 'custom') setApplied({ from: addDays(today, -(Number(r) - 1)), to: today });
  };

  const applyCustom = () => {
    if (!DATE_RE.test(customFrom) || !DATE_RE.test(customTo) || Number.isNaN(Date.parse(customFrom)) || Number.isNaN(Date.parse(customTo))) {
      return setCustomError('Use dates like 2026-11-01.');
    }
    if (customFrom > customTo) return setCustomError('Start date must be before end date.');
    if ((Date.parse(customTo) - Date.parse(customFrom)) / 86_400_000 > 366) return setCustomError('Choose a range of up to one year.');
    setCustomError(null);
    setApplied({ from: customFrom, to: customTo });
  };

  const { data, error, loading, refreshing, reload } = useAsync(
    async () => {
      const [meals, targets] = await Promise.all([listMeals(userId, applied.from, applied.to), getCurrentTargets(userId)]);
      return { meals, targets };
    },
    [userId, applied.from, applied.to],
    { refetchOnFocus: true },
  );

  const days = useMemo(() => {
    const byDay = new Map<string, MealWithItems[]>();
    for (const m of data?.meals ?? []) {
      const list = byDay.get(m.local_date) ?? [];
      list.push(m);
      byDay.set(m.local_date, list);
    }
    return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [data?.meals]);

  const avg = useMemo(() => {
    if (!days.length) return null;
    const t = days.map(([, ms]) => totalsFromMeals(ms));
    return {
      calories: Math.round(t.reduce((s, x) => s + x.calories, 0) / t.length),
      protein: Math.round(t.reduce((s, x) => s + x.protein, 0) / t.length),
    };
  }, [days]);

  const target = data?.targets?.calories_kcal ?? 0;

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <View style={styles.titleRow}>
        <AppText variant="title" accessibilityRole="header">Food journal</AppText>
        <Button label="Add" icon="add" size="sm" onPress={() => router.push('/add')} />
      </View>
      <ChoiceGroup layout="scroll" options={RANGES} value={range} onChange={selectRange} />
      {range === 'custom' ? (
        <Card tone="inset">
          <View style={{ gap: spacing.md }}>
            <View style={styles.row}>
              <View style={styles.flex}><TextField label="From" value={customFrom} onChangeText={setCustomFrom} placeholder="YYYY-MM-DD" maxLength={10} /></View>
              <View style={styles.flex}><TextField label="To" value={customTo} onChangeText={setCustomTo} placeholder="YYYY-MM-DD" maxLength={10} /></View>
            </View>
            {customError ? <Banner tone="danger">{customError}</Banner> : null}
            <Button label="Show" size="sm" onPress={applyCustom} style={{ alignSelf: 'flex-start' }} />
          </View>
        </Card>
      ) : null}

      {loading && !data ? (
        <LoadingState />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : days.length === 0 ? (
        <Card tone="inset">
          <EmptyState
            icon="calendar-outline"
            title="No meals in this period"
            message="Meals you log appear here, grouped by day and meal."
            action={<Button label="Add food" size="sm" onPress={() => router.push('/add')} />}
          />
        </Card>
      ) : (
        <>
          {avg && days.length > 1 ? (
            <View style={styles.row}>
              <Card style={styles.flex}>
                <AppText variant="overline" tone="subtle">Avg calories</AppText>
                <AppText variant="title" numeric>{avg.calories.toLocaleString()}</AppText>
                <AppText variant="caption" tone="muted">per logged day</AppText>
              </Card>
              <Card style={styles.flex}>
                <AppText variant="overline" tone="subtle">Avg protein</AppText>
                <AppText variant="title" numeric>{avg.protein} g</AppText>
                <AppText variant="caption" tone="muted">{days.length} days logged</AppText>
              </Card>
            </View>
          ) : null}

          {days.map(([date, meals]) => {
            const t = totalsFromMeals(meals);
            const pct = target ? Math.min(1, t.calories / target) : 0;
            return (
              <View key={date} style={{ gap: spacing.sm }}>
                <View style={styles.dayHead}>
                  <AppText variant="heading">{dayLabel(date, today)}</AppText>
                  <AppText variant="bodyStrong" numeric>
                    {Math.round(t.calories).toLocaleString()}
                    {target ? <AppText variant="label" tone="muted">{` / ${target.toLocaleString()} kcal`}</AppText> : ' kcal'}
                  </AppText>
                </View>
                {target ? (
                  <View style={[styles.track, { backgroundColor: colors.ringTrack }]}>
                    <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: t.calories > target * 1.05 ? colors.warning : colors.accent }]} />
                  </View>
                ) : null}
                <AppText variant="caption" tone="subtle" numeric>
                  Protein {Math.round(t.protein)} g · Carbs {Math.round(t.carbohydrates)} g · Fat {Math.round(t.fat)} g · Fibre {Math.round(t.fibre)} g
                </AppText>
                <Card padded={false}>
                  {MEAL_ORDER.flatMap((type) => meals.filter((m) => (m.meal_type ?? 'other') === type)).map((m, i) => (
                    <Pressable
                      key={m.id}
                      onPress={() => router.push({ pathname: '/meal/[id]', params: { id: m.id } })}
                      accessibilityRole="button"
                      accessibilityLabel={`${MEAL_TYPE_LABEL[(m.meal_type ?? 'other') as MealType]}, ${Math.round(Number(m.total_calories_kcal))} calories. Open to edit or delete`}
                      style={({ pressed }) => [styles.meal, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, pressed && { backgroundColor: colors.surfaceSunken }]}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={styles.mealTitle}>
                          <AppText variant="bodyStrong">{MEAL_TYPE_LABEL[(m.meal_type ?? 'other') as MealType]}</AppText>
                          <AppText variant="caption" tone="subtle">
                            {new Date(m.eaten_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                            {m.is_estimate ? ' · estimated' : ''}
                            {m.meal_kind !== 'regular' ? ` · ${m.meal_kind}` : ''}
                          </AppText>
                          {m.photo_path ? <Icon name="image-outline" size={16} color={colors.textSubtle} label="Has photo" /> : null}
                        </View>
                        <AppText variant="label" tone="muted" numberOfLines={2}>
                          {m.meal_items.map((x) => x.name).join(', ')}
                        </AppText>
                        <AppText variant="caption" tone="subtle" numeric>
                          P {Math.round(Number(m.total_protein_g))} · C {Math.round(Number(m.total_carbohydrates_g))} · F {Math.round(Number(m.total_fat_g))} g
                        </AppText>
                      </View>
                      <AppText variant="bodyStrong" numeric>{Math.round(Number(m.total_calories_kcal))}</AppText>
                      <Icon name="chevron-forward" size={16} color={colors.textSubtle} />
                    </Pressable>
                  ))}
                </Card>
              </View>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.md },
  track: { height: 4, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%' },
  meal: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  mealTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
});
