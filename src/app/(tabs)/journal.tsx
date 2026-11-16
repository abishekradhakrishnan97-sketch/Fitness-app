import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Card, ChoiceGroup, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useAsync } from '@/lib/useAsync';
import { getDailyHistory } from '@/services/dashboard';
import { getCurrentTargets } from '@/services/profile';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

const RANGES = ['7', '30', '60', '90', '180'].map((d) => ({ value: d, label: `${d} days` }));

export default function Journal() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session!.user.id;
  const [range, setRange] = useState('7');
  const { data, error, loading, refreshing, reload } = useAsync(
    async () => {
      const [days, targets] = await Promise.all([getDailyHistory(userId, Number(range)), getCurrentTargets(userId)]);
      return { days, targets };
    },
    [userId, range],
  );

  const days = data?.days ?? [];
  const avg = (k: 'calories_kcal' | 'protein_g') =>
    days.length ? Math.round(days.reduce((s, d) => s + Number(d[k] ?? 0), 0) / days.length) : 0;

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <AppText variant="title" accessibilityRole="header" style={{ marginTop: spacing.sm }}>Food journal</AppText>
      <ChoiceGroup options={RANGES} value={range} onChange={setRange} />

      {loading && !data ? (
        <LoadingState />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : days.length === 0 ? (
        <Card tone="inset">
          <EmptyState icon="calendar-outline" title="No meals in this period" message="Days with logged meals will appear here with their totals." />
        </Card>
      ) : (
        <>
          <View style={styles.summary}>
            <Card style={styles.flex}>
              <AppText variant="overline" tone="subtle">Avg calories</AppText>
              <AppText variant="title" numeric>{avg('calories_kcal').toLocaleString()}</AppText>
              <AppText variant="caption" tone="muted">per logged day</AppText>
            </Card>
            <Card style={styles.flex}>
              <AppText variant="overline" tone="subtle">Avg protein</AppText>
              <AppText variant="title" numeric>{avg('protein_g')} g</AppText>
              <AppText variant="caption" tone="muted">{days.length} days logged</AppText>
            </Card>
          </View>
          <Card padded={false}>
            {days.map((d, i) => {
              const target = data?.targets?.calories_kcal ?? 0;
              const pct = target ? Math.min(1, Number(d.calories_kcal ?? 0) / target) : 0;
              return (
                <View key={d.local_date} style={[styles.dayRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <AppText variant="bodyStrong">
                      {new Date(`${d.local_date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                    </AppText>
                    <AppText variant="caption" tone="subtle" numeric>
                      {d.meal_count} meals · P {Math.round(Number(d.protein_g))} · C {Math.round(Number(d.carbohydrates_g))} · F {Math.round(Number(d.fat_g))}
                    </AppText>
                    {target ? (
                      <View style={[styles.track, { backgroundColor: colors.ringTrack }]}>
                        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: colors.accent }]} />
                      </View>
                    ) : null}
                  </View>
                  <AppText variant="bodyStrong" numeric>{Math.round(Number(d.calories_kcal)).toLocaleString()} kcal</AppText>
                </View>
              );
            })}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { flexDirection: 'row', gap: spacing.md },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg },
  track: { height: 4, borderRadius: radius.pill, overflow: 'hidden', marginTop: spacing.xs },
  fill: { height: '100%' },
});
