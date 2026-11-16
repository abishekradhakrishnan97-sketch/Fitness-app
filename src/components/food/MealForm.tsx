import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Banner, Button, Card, ChoiceGroup, Screen, TextField } from '@/components/ui';
import { draftTotals, emptyItem, hasErrors, validateItem, type DraftItem, type ItemErrors } from '@/lib/nutrition/mealDraft';
import { friendlyError } from '@/services/errors';
import { MEAL_TYPE_LABEL, type MealType } from '@/lib/time/mealCategory';
import type { MealKind } from '@/services/meals';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { ItemEditor } from './ItemEditor';

const MEAL_TYPES: { value: MealType; label: string }[] = (
  ['breakfast', 'pre_workout', 'lunch', 'snack', 'dinner', 'other'] as MealType[]
).map((v) => ({ value: v, label: MEAL_TYPE_LABEL[v] }));

const KINDS: { value: MealKind; label: string }[] = [
  { value: 'regular', label: 'Regular' },
  { value: 'treat', label: 'Treat' },
  { value: 'cheat', label: 'Cheat meal' },
  { value: 'social', label: 'Social' },
];

export interface MealFormValue {
  mealType: MealType;
  categoryAuto: boolean;
  mealKind: MealKind;
  notes: string;
  items: DraftItem[];
}

export function MealForm({
  title,
  initial,
  autoMealType,
  header,
  estimateBanner,
  submitLabel,
  onSubmit,
  onCancel,
  extraActions,
}: {
  title: string;
  initial: MealFormValue;
  /** The automatically suggested category, shown as a hint. */
  autoMealType?: MealType | null;
  header?: ReactNode;
  estimateBanner?: boolean;
  submitLabel: string;
  onSubmit: (v: MealFormValue) => Promise<void>;
  onCancel: () => void;
  extraActions?: ReactNode;
}) {
  const { colors } = useTheme();
  const [v, setV] = useState<MealFormValue>(initial);
  const [errors, setErrors] = useState<Record<string, ItemErrors>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totals = draftTotals(v.items);

  const updateItem = (key: string, item: DraftItem) => {
    setV((s) => ({ ...s, items: s.items.map((i) => (i.key === key ? item : i)) }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: validateItem(item) }));
  };

  const submit = async () => {
    const errs: Record<string, ItemErrors> = {};
    for (const i of v.items) errs[i.key] = validateItem(i);
    setErrors(errs);
    if (Object.values(errs).some(hasErrors)) {
      setError('Check the highlighted fields.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(v);
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  };

  return (
    <Screen
      narrow
      footer={
        <View style={{ gap: spacing.sm }}>
          <View style={styles.totalsRow}>
            <AppText variant="bodyStrong" numeric>{Math.round(totals.calories)} kcal</AppText>
            <AppText variant="label" tone="muted" numeric>
              P {Math.round(totals.protein)} · C {Math.round(totals.carbs)} · F {Math.round(totals.fat)} g
            </AppText>
          </View>
          <View style={styles.row}>
            <Button label="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
            <Button label={submitLabel} onPress={submit} loading={busy} style={{ flex: 2 }} />
          </View>
        </View>
      }
    >
      <AppText variant="title" accessibilityRole="header" style={{ marginTop: spacing.sm }}>{title}</AppText>
      {header}
      {estimateBanner ? (
        <Banner tone="warning" title="Estimated nutrition">
          These values were estimated by AI from your photo. Portions, oil and recipes vary — check and correct them before saving.
        </Banner>
      ) : null}

      <ChoiceGroup
        label={autoMealType ? `Meal · auto-selected ${MEAL_TYPE_LABEL[autoMealType]} from the time` : 'Meal'}
        options={MEAL_TYPES}
        value={v.mealType}
        onChange={(t) => setV((s) => ({ ...s, mealType: t, categoryAuto: t === autoMealType }))}
      />

      {v.items.map((item, idx) => (
        <ItemEditor
          key={item.key}
          index={idx}
          item={item}
          errors={errors[item.key] ?? {}}
          onChange={(i) => updateItem(item.key, i)}
          onRemove={() => setV((s) => ({ ...s, items: s.items.filter((i) => i.key !== item.key) }))}
          canRemove={v.items.length > 1}
        />
      ))}
      <Button
        label="Add another food"
        icon="add"
        variant="secondary"
        onPress={() => setV((s) => ({ ...s, items: [...s.items, emptyItem()] }))}
        disabled={v.items.length >= 30}
      />

      <Card tone="inset">
        <View style={{ gap: spacing.md }}>
          <ChoiceGroup label="Type of meal" options={KINDS} value={v.mealKind} onChange={(k) => setV((s) => ({ ...s, mealKind: k }))} />
          <AppText variant="caption" tone="subtle">Every meal counts toward your totals — this is just for your own reflection.</AppText>
          <TextField label="Notes (optional)" value={v.notes} onChangeText={(t) => setV((s) => ({ ...s, notes: t }))} maxLength={1000} multiline />
        </View>
      </Card>
      {extraActions}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <View style={{ height: spacing.sm, backgroundColor: colors.background }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
});
