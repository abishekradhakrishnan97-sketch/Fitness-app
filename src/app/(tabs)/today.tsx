import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { LogWeightCard } from '@/components/LogWeightCard';
import { AppText, Button, Card, EmptyState, ErrorState, Icon, LoadingState, MacroBar, ProgressRing, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthProvider';
import { MEAL_TYPE_LABEL, type MealType } from '@/lib/time/mealCategory';
import { useAsync } from '@/lib/useAsync';
import { getToday } from '@/services/dashboard';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
const MEAL_ORDER: MealType[] = ['breakfast', 'pre_workout', 'lunch', 'snack', 'dinner', 'other'];

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Today() {
  const { colors } = useTheme();
  const { session, profile } = useAuth();
  const userId = session!.user.id;
  const { data, error, loading, refreshing, reload } = useAsync(() => getToday(userId), [userId], { refetchOnFocus: true });

  if (loading && !data) return <Screen><LoadingState /></Screen>;
  if (error && !data) return <Screen><ErrorState message={error} onRetry={reload} /></Screen>;
  if (!data) return null;

  const { targets, totals, meals } = data;
  const calTarget = targets?.calories_kcal ?? 0;
  const remaining = calTarget - totals.calories;
  const dateLabel = new Date(`${data.localDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <View style={styles.header}>
        <AppText variant="label" tone="muted">{dateLabel}</AppText>
        <AppText variant="title" accessibilityRole="header">
          {greeting()}
          {profile?.display_name ? `, ${profile.display_name.split(' ')[0]}` : ''}
        </AppText>
      </View>

      {/* Hero: calories */}
      <Card tone="hero">
        {targets ? (
          <View style={styles.hero}>
            <ProgressRing
              progress={calTarget ? totals.calories / calTarget : 0}
              size={168}
              stroke={14}
              accessibilityLabel={`${Math.round(totals.calories)} of ${calTarget} calories eaten`}
            >
              <AppText variant="display" numeric>{Math.abs(Math.round(remaining)).toLocaleString()}</AppText>
              <AppText variant="caption" tone={remaining < 0 ? 'warning' : 'muted'}>
                {remaining < 0 ? 'kcal over' : 'kcal left'}
              </AppText>
            </ProgressRing>
            <View style={styles.heroStats}>
              <Stat label="Target" value={calTarget.toLocaleString()} unit="kcal" />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Stat label="Eaten" value={Math.round(totals.calories).toLocaleString()} unit="kcal" />
            </View>
          </View>
        ) : (
          <EmptyState
            icon="speedometer-outline"
            title="No targets yet"
            message="Set your daily targets to start tracking."
            action={<Button label="Set targets" size="sm" onPress={() => router.push('/targets')} />}
          />
        )}
      </Card>

      <Button label="Add food" icon="add" size="lg" onPress={() => router.push('/add')} fullWidth />

      {targets ? (
        <Card>
          <View style={styles.sectionHead}>
            <AppText variant="heading">Macros</AppText>
            <AppText variant="caption" tone="subtle">Today</AppText>
          </View>
          <View style={{ gap: spacing.lg }}>
            <MacroBar label="Protein" consumed={totals.protein} target={targets.protein_g} color={colors.protein} />
            <MacroBar label="Carbs" consumed={totals.carbohydrates} target={targets.carbohydrates_g} color={colors.carbs} />
            <MacroBar label="Fat" consumed={totals.fat} target={targets.fat_g} color={colors.fat} />
            <MacroBar label="Fibre" consumed={totals.fibre} target={targets.fibre_g} color={colors.fibre} />
          </View>
        </Card>
      ) : null}

      <View style={styles.sectionHead}>
        <AppText variant="heading">Today’s meals</AppText>
        {meals.length ? <AppText variant="caption" tone="subtle">{meals.length} logged</AppText> : null}
      </View>
      {meals.length === 0 ? (
        <Card tone="inset">
          <EmptyState
            icon="restaurant-outline"
            title="Nothing logged yet today"
            message="Snap a photo of your meal or add it manually — your calories and macros update instantly."
          />
        </Card>
      ) : (
        MEAL_ORDER.filter((t) => meals.some((m) => (m.meal_type ?? 'other') === t)).map((type) => {
          const group = meals.filter((m) => (m.meal_type ?? 'other') === type);
          const kcal = group.reduce((s, m) => s + Number(m.total_calories_kcal), 0);
          return (
            <Card key={type} padded={false}>
              <View style={[styles.groupHead, { borderBottomColor: colors.border }]}>
                <AppText variant="bodyStrong">{MEAL_TYPE_LABEL[type]}</AppText>
                <AppText variant="label" tone="muted" numeric>{Math.round(kcal)} kcal</AppText>
              </View>
              {group.map((m, i) => (
                <Pressable
                  key={m.id}
                  onPress={() => router.push({ pathname: '/meal/[id]', params: { id: m.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${MEAL_TYPE_LABEL[type]} at ${new Date(m.eaten_at).toLocaleTimeString()}, ${Math.round(Number(m.total_calories_kcal))} calories. Open details`}
                  style={({ pressed }) => [styles.mealRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, pressed && { backgroundColor: colors.surfaceSunken }]}
                >
                  <View style={[styles.mealIcon, { backgroundColor: colors.primarySoft }]}>
                    <Icon name={m.source === 'ai_image' ? 'camera' : 'create'} size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="label" numberOfLines={1}>{m.meal_items.map((x) => x.name).join(', ')}</AppText>
                    <AppText variant="caption" tone="subtle">
                      {new Date(m.eaten_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                      {m.is_estimate ? ' · estimated' : ''}
                      {m.meal_kind !== 'regular' ? ` · ${m.meal_kind}` : ''}
                    </AppText>
                  </View>
                  <AppText variant="bodyStrong" numeric>{Math.round(Number(m.total_calories_kcal))}</AppText>
                  <Icon name="chevron-forward" size={16} color={colors.textSubtle} />
                </Pressable>
              ))}
            </Card>
          );
        })
      )}

      <LogWeightCard userId={userId} latest={data.latestWeight} previous={data.previousWeight} onSaved={reload} />
    </Screen>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 2, flex: 1 }}>
      <AppText variant="overline" tone="subtle">{label}</AppText>
      <AppText variant="heading" numeric>
        {value} <AppText variant="caption" tone="muted">{unit}</AppText>
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 2, marginTop: spacing.sm },
  hero: { alignItems: 'center', gap: spacing.xl },
  heroStats: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  divider: { width: 1, height: 32 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.md },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  mealIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
