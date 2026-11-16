import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { LogWeightCard } from '@/components/LogWeightCard';
import { AppText, Button, Card, EmptyState, ErrorState, LoadingState, MacroBar, ProgressRing, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthProvider';
import { MEAL_TYPE_LABEL, type MealType } from '@/lib/time/mealCategory';
import { useAsync } from '@/lib/useAsync';
import { getToday } from '@/services/dashboard';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Today() {
  const { colors } = useTheme();
  const { session, profile } = useAuth();
  const userId = session!.user.id;
  const { data, error, loading, refreshing, reload } = useAsync(() => getToday(userId), [userId]);

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
        <AppText variant="heading">Today's meals</AppText>
        {meals.length ? <AppText variant="caption" tone="subtle">{meals.length} logged</AppText> : null}
      </View>
      {meals.length === 0 ? (
        <Card tone="inset">
          <EmptyState
            icon="restaurant-outline"
            title="Nothing logged yet"
            message="Meal logging with photo recognition is being added next. Saved meals will appear here."
          />
        </Card>
      ) : (
        <Card padded={false}>
          {meals.map((m, i) => (
            <View
              key={m.id}
              style={[styles.mealRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
            >
              <View style={[styles.mealIcon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name={m.source === 'ai_image' ? 'camera' : 'create'} size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{MEAL_TYPE_LABEL[(m.meal_type ?? 'other') as MealType]}</AppText>
                <AppText variant="caption" tone="subtle">
                  {new Date(m.eaten_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  {m.is_estimate ? ' · estimated' : ''}
                  {m.meal_kind !== 'regular' ? ` · ${m.meal_kind}` : ''}
                </AppText>
              </View>
              <AppText variant="bodyStrong" numeric>{Math.round(Number(m.total_calories_kcal))} kcal</AppText>
            </View>
          ))}
        </Card>
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
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  mealIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
