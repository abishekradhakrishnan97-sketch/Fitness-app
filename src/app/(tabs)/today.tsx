import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { CalorieHero, MacrosCard, QuickActions, WaterCard, WeekCard, WeightCard } from '@/components/dashboard/cards';
import { AppText, Button, Card, EmptyState, ErrorState, Icon, LoadingState, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthProvider';
import { MEAL_TYPE_LABEL, type MealType } from '@/lib/time/mealCategory';
import { useAsync } from '@/lib/useAsync';
import { getToday } from '@/services/dashboard';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, stroke } from '@/theme/tokens';

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
  const dateLabel = new Date(`${data.localDate}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <AppText variant="overline" tone="muted">{dateLabel}</AppText>
          <AppText variant="title" accessibilityRole="header">
            {greeting()}
            {profile?.display_name ? `, ${profile.display_name.split(' ')[0]}` : ''}
          </AppText>
        </View>
        {data.streak > 0 ? (
          <View
            style={[styles.streak, { backgroundColor: colors.carbs, borderColor: colors.ink }]}
            accessible
            accessibilityLabel={`${data.streak} day logging streak`}
          >
            <Icon name="flame" size={18} color="#0A0A0A" />
            <AppText variant="statSm" color="#0A0A0A" numeric>{data.streak}</AppText>
            <AppText variant="caption" color="#0A0A0A">DAY{data.streak === 1 ? '' : 'S'}</AppText>
          </View>
        ) : null}
      </View>

      {targets ? (
        <CalorieHero totals={totals} target={targets.calories_kcal} />
      ) : (
        <Card tone="hero">
          <EmptyState
            icon="speedometer-outline"
            title="Set your daily targets"
            message="Your calorie and macro goals power the dashboard."
            action={<Button label="Set targets" size="sm" onPress={() => router.push('/targets')} />}
          />
        </Card>
      )}

      <QuickActions />

      {targets ? <MacrosCard totals={totals} targets={targets} /> : null}

      <View>
        <View style={styles.sectionHead}>
          <AppText variant="heading" accessibilityRole="header">Today&apos;s meals</AppText>
          <AppText variant="overline" tone="subtle">{meals.length} logged</AppText>
        </View>
        {meals.length === 0 ? (
          <Card tone="inset">
            <EmptyState
              icon="restaurant-outline"
              title="Nothing logged yet"
              message="Snap a photo, scan a barcode or search — calories and macros update instantly."
              action={<Button label="Log a meal" icon="add" size="sm" onPress={() => router.push('/add')} />}
            />
          </Card>
        ) : (
          <View style={{ gap: spacing.md }}>
            {MEAL_ORDER.filter((t) => meals.some((m) => (m.meal_type ?? 'other') === t)).map((type) => {
              const group = meals.filter((m) => (m.meal_type ?? 'other') === type);
              const kcal = group.reduce((s, m) => s + Number(m.total_calories_kcal), 0);
              return (
                <Card key={type} padded={false}>
                  <View style={[styles.groupHead, { borderBottomColor: colors.ink, backgroundColor: colors.surfaceSunken }]}>
                    <AppText variant="overline">{MEAL_TYPE_LABEL[type]}</AppText>
                    <AppText variant="overline" numeric>{Math.round(kcal)} kcal</AppText>
                  </View>
                  {group.map((m, i) => (
                    <Pressable
                      key={m.id}
                      onPress={() => router.push({ pathname: '/meal/[id]', params: { id: m.id } })}
                      accessibilityRole="button"
                      accessibilityLabel={`${MEAL_TYPE_LABEL[type]}: ${m.meal_items.map((x) => x.name).join(', ')}, ${Math.round(Number(m.total_calories_kcal))} calories. Open details`}
                      style={({ pressed }) => [
                        styles.mealRow,
                        i > 0 && { borderTopWidth: stroke.hairline, borderTopColor: colors.border },
                        pressed && { backgroundColor: colors.primarySoft },
                      ]}
                    >
                      <View style={[styles.mealIcon, { backgroundColor: colors.primary, borderColor: colors.ink }]}>
                        <Icon name={m.source === 'ai_image' ? 'camera' : 'create'} size={16} color={colors.onPrimary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText variant="bodyStrong" numberOfLines={1}>{m.meal_items.map((x) => x.name).join(', ')}</AppText>
                        <AppText variant="caption" tone="subtle">
                          {new Date(m.eaten_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                          {m.is_estimate ? ' · AI estimate' : ''}
                          {m.meal_kind !== 'regular' ? ` · ${m.meal_kind}` : ''}
                        </AppText>
                      </View>
                      <AppText variant="statSm" numeric>{Math.round(Number(m.total_calories_kcal))}</AppText>
                      <Icon name="chevron-forward" size={16} color={colors.textMuted} />
                    </Pressable>
                  ))}
                </Card>
              );
            })}
          </View>
        )}
      </View>

      <WaterCard userId={userId} water={data.water} targetMl={targets?.water_ml ?? 2500} onChange={reload} />
      <WeekCard data={data} />
      <WeightCard userId={userId} data={data} onChange={reload} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, marginTop: spacing.sm },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: stroke.base,
    borderRadius: radius.md,
    transform: [{ rotate: '-3deg' }],
  },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.md },
  groupHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: stroke.base,
    borderTopLeftRadius: radius.lg - 2,
    borderTopRightRadius: radius.lg - 2,
  },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  mealIcon: { width: 34, height: 34, borderRadius: radius.sm, borderWidth: stroke.base, alignItems: 'center', justifyContent: 'center' },
});
