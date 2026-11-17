import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SegmentedProgress, SplitBar } from '@/components/charts/Bars';
import { TrendLine } from '@/components/charts/TrendLine';
import { WeekBars } from '@/components/charts/WeekBars';
import { AppText, Banner, Button, Card, Icon, MacroBar, TextField, useToast, type IconName } from '@/components/ui';
import { daysOnTarget, weightChange } from '@/lib/nutrition/stats';
import { checkRange } from '@/lib/validation';
import { addWater, deleteWater, logWeight, type DayTotals, type TodayData } from '@/services/dashboard';
import { friendlyError } from '@/services/errors';
import { useTheme } from '@/theme/ThemeProvider';
import { hardShadow, radius, spacing, stroke } from '@/theme/tokens';

const fmt = (n: number) => Math.round(n).toLocaleString();

function SectionTitle({ title, meta }: { title: string; meta?: string }) {
  return (
    <View style={styles.sectionHead}>
      <AppText variant="heading" accessibilityRole="header">{title}</AppText>
      {meta ? <AppText variant="overline" tone="subtle">{meta}</AppText> : null}
    </View>
  );
}

// ---------------------------------------------------------------- Calories hero
export function CalorieHero({ totals, target }: { totals: DayTotals; target: number }) {
  const { colors } = useTheme();
  const remaining = target - totals.calories;
  const over = remaining < 0;
  return (
    <Card tone="hero">
      <View style={{ gap: spacing.lg }}>
        <View style={styles.rowBetween}>
          <AppText variant="overline">Calories today</AppText>
          <View style={[styles.tag, { backgroundColor: over ? colors.carbs : colors.primary, borderColor: colors.ink }]}>
            <AppText variant="overline" color={colors.onPrimary}>{over ? 'Over' : 'On track'}</AppText>
          </View>
        </View>
        <View>
          <AppText variant="display" numeric style={{ fontFamily: 'SpaceMono_700Bold', fontSize: 52, lineHeight: 56, letterSpacing: -2 }}>
            {fmt(Math.abs(remaining))}
          </AppText>
          <AppText variant="overline" tone="muted">{over ? 'kcal over goal' : 'kcal left'}</AppText>
        </View>
        <SegmentedProgress value={totals.calories} max={target} label={`${fmt(totals.calories)} of ${fmt(target)} calories eaten`} />
        <View style={[styles.statRow, { borderColor: colors.ink }]}>
          {[
            ['Eaten', fmt(totals.calories)],
            ['Goal', fmt(target)],
            ['Left', over ? '0' : fmt(remaining)],
          ].map(([l, v], i) => (
            <View key={l} style={[styles.statCell, i > 0 && { borderLeftWidth: stroke.base, borderColor: colors.ink }]}>
              <AppText variant="overline" tone="subtle">{l}</AppText>
              <AppText variant="statSm" numeric>{v}</AppText>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------- Quick actions
function ActionTile({ icon, label, onPress, primary }: { icon: IconName; label: string; onPress: () => void; primary?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: primary ? colors.primary : colors.surface, borderColor: colors.ink },
        pressed ? { transform: [{ translateX: 3 }, { translateY: 3 }] } : hardShadow(colors.shadow, 4),
      ]}
    >
      <Icon name={icon} size={26} color={primary ? colors.onPrimary : colors.text} />
      <AppText variant="overline" color={primary ? colors.onPrimary : colors.text}>{label}</AppText>
    </Pressable>
  );
}

export function QuickActions() {
  return (
    <View style={styles.actions}>
      <ActionTile primary icon="camera" label="Photo" onPress={() => router.push({ pathname: '/log/photo', params: { mode: 'camera' } })} />
      <ActionTile icon="barcode-outline" label="Barcode" onPress={() => router.push('/log/barcode')} />
      <ActionTile icon="search" label="Search" onPress={() => router.push('/add')} />
      <ActionTile icon="create-outline" label="Manual" onPress={() => router.push('/log/manual')} />
    </View>
  );
}

// ---------------------------------------------------------------- Macros
export function MacrosCard({ totals, targets }: { totals: DayTotals; targets: { protein_g: number; carbohydrates_g: number; fat_g: number; fibre_g: number } }) {
  const { colors } = useTheme();
  return (
    <Card>
      <SectionTitle title="Macros" meta="Today" />
      <View style={{ gap: spacing.lg }}>
        <SplitBar
          parts={[
            { key: 'p', label: 'Protein', value: totals.protein * 4, color: colors.protein },
            { key: 'c', label: 'Carbs', value: totals.carbohydrates * 4, color: colors.carbs },
            { key: 'f', label: 'Fat', value: totals.fat * 9, color: colors.fat },
          ]}
        />
        <MacroBar label="Protein" consumed={totals.protein} target={targets.protein_g} color={colors.protein} />
        <MacroBar label="Carbs" consumed={totals.carbohydrates} target={targets.carbohydrates_g} color={colors.carbs} />
        <MacroBar label="Fat" consumed={totals.fat} target={targets.fat_g} color={colors.fat} />
        <MacroBar label="Fibre" consumed={totals.fibre} target={targets.fibre_g} color={colors.fibre} />
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------- Water
export function WaterCard({ userId, water, targetMl, onChange }: { userId: string; water: TodayData['water']; targetMl: number; onChange: () => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const glasses = Math.max(1, Math.round(targetMl / 250));
  const filled = Math.min(glasses, Math.floor(water.totalMl / 250));

  const run = async (key: string, fn: () => Promise<void>, msg: string) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      toast(msg);
      onChange();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <SectionTitle title="Water" meta={`Goal ${(targetMl / 1000).toFixed(1)} L`} />
      <View style={{ gap: spacing.md }}>
        <AppText variant="stat" numeric>
          {(water.totalMl / 1000).toFixed(2).replace(/0$/, '')}
          <AppText variant="overline" tone="muted">{`  / ${(targetMl / 1000).toFixed(1)} L`}</AppText>
        </AppText>
        <View
          style={styles.glasses}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`${water.totalMl} of ${targetMl} millilitres`}
          accessibilityValue={{ min: 0, max: glasses, now: filled }}
        >
          {Array.from({ length: glasses }, (_, i) => (
            <View key={i} style={[styles.glass, { borderColor: colors.ink, backgroundColor: i < filled ? colors.water : colors.surface }]} />
          ))}
        </View>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <View style={styles.rowWrap}>
          {[250, 500, 750].map((ml) => (
            <Button key={ml} label={`+${ml} ml`} size="sm" variant="secondary" loading={busy === String(ml)} onPress={() => run(String(ml), () => addWater(userId, ml), `Water +${ml} ml`)} />
          ))}
          {water.entries[0] ? (
            <Button
              label="Undo"
              size="sm"
              variant="ghost"
              icon="arrow-undo"
              loading={busy === 'undo'}
              onPress={() => run('undo', () => deleteWater(water.entries[0].id), `Removed ${water.entries[0].amount_ml} ml`)}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------- Week
export function WeekCard({ data }: { data: TodayData }) {
  const target = data.targets?.calories_kcal ?? 0;
  const logged = data.week.filter((d) => d.value > 0);
  const avg = logged.length ? logged.reduce((s, d) => s + d.value, 0) / logged.length : 0;
  const proteinLogged = data.weekProtein.filter((d) => d.value > 0);
  const avgProtein = proteinLogged.length ? proteinLogged.reduce((s, d) => s + d.value, 0) / proteinLogged.length : 0;
  const { onTarget } = daysOnTarget(data.week, target);
  const { colors } = useTheme();
  return (
    <Card>
      <SectionTitle title="This week" meta="Calories" />
      <WeekBars days={data.week} target={target} today={data.localDate} />
      <View style={[styles.statRow, { borderColor: colors.ink, marginTop: spacing.md }]}>
        {[
          ['Avg / day', logged.length ? fmt(avg) : '–'],
          ['On target', `${onTarget}/${logged.length || 0}`],
          ['Avg protein', proteinLogged.length ? `${Math.round(avgProtein)}g` : '–'],
        ].map(([l, v], i) => (
          <View key={l} style={[styles.statCell, i > 0 && { borderLeftWidth: stroke.base, borderColor: colors.ink }]}>
            <AppText variant="overline" tone="subtle">{l}</AppText>
            <AppText variant="statSm" numeric>{v}</AppText>
          </View>
        ))}
      </View>
      <AppText variant="caption" tone="subtle" style={{ marginTop: spacing.sm }}>
        On target = within ±10% of your goal on days you logged food.
      </AppText>
    </Card>
  );
}

// ---------------------------------------------------------------- Weight
export function WeightCard({ userId, data, onChange }: { userId: string; data: TodayData; onChange: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = data.weights[data.weights.length - 1];
  const change = weightChange(data.weights);
  const goal = data.goal?.target_weight_kg ? Number(data.goal.target_weight_kg) : null;
  const toGo = latest && goal ? Math.round((latest.value - goal) * 10) / 10 : null;

  const save = async () => {
    const c = checkRange(value, 20, 400, 'Weight', true);
    if (c.error || c.value === null) return setError(c.error);
    setBusy(true);
    setError(null);
    try {
      await logWeight(userId, c.value);
      setValue('');
      setOpen(false);
      toast(`Weight logged · ${c.value} kg`);
      onChange();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionTitle title="Weight" meta="90 days" />
      <View style={{ gap: spacing.md }}>
        <View style={styles.rowBetween}>
          <AppText variant="stat" numeric>
            {latest ? latest.value.toFixed(1) : '–'}
            <AppText variant="overline" tone="muted">  kg</AppText>
          </AppText>
          <View style={{ alignItems: 'flex-end' }}>
            {change !== null ? (
              <AppText variant="overline" tone={change <= 0 ? 'success' : 'warning'}>
                {change > 0 ? '▲' : change < 0 ? '▼' : '■'} {Math.abs(change)} kg
              </AppText>
            ) : null}
            {toGo !== null ? <AppText variant="caption" tone="muted">{Math.abs(toGo)} kg {toGo > 0 ? 'to lose' : toGo < 0 ? 'to gain' : '· at goal'}</AppText> : null}
          </View>
        </View>
        {data.weights.length ? (
          <TrendLine points={data.weights} goal={goal} />
        ) : (
          <AppText tone="muted">Log your weight regularly to see your trend here.</AppText>
        )}
        {open ? (
          <View style={{ gap: spacing.md }}>
            <TextField label="Today's weight" value={value} onChangeText={setValue} keyboardType="decimal-pad" suffix="kg" autoFocus onSubmitEditing={save} />
            {error ? <Banner tone="danger">{error}</Banner> : null}
            <View style={styles.rowEnd}>
              <Button label="Cancel" variant="ghost" size="sm" onPress={() => { setOpen(false); setError(null); }} />
              <Button label="Save" size="sm" onPress={save} loading={busy} />
            </View>
          </View>
        ) : (
          <Button label="Log weight" icon="add" variant="secondary" size="sm" onPress={() => setOpen(true)} style={{ alignSelf: 'flex-start' }} />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowEnd: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  tag: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderWidth: stroke.base, borderRadius: radius.sm, transform: [{ rotate: '2deg' }] },
  statRow: { flexDirection: 'row', borderWidth: stroke.base, borderRadius: radius.md },
  statCell: { flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, gap: 2 },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: {
    flex: 1,
    minHeight: 76,
    borderWidth: stroke.base,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  glasses: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  glass: { width: 22, height: 30, borderWidth: stroke.base, borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },
});
