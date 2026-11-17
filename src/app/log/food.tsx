import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Banner, Button, Card, ChoiceGroup, Screen, TextField, useToast } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthProvider';
import { peekPendingFood, setPendingItems } from '@/lib/draftStore';
import { draftFromSearch, portionFor, unitsFor } from '@/lib/nutrition/foodSearch';
import { categoriseMeal, localParts, MEAL_TYPE_LABEL, type MealType } from '@/lib/time/mealCategory';
import { checkRange } from '@/lib/validation';
import { friendlyError } from '@/services/errors';
import { createMeal, suggestMealType } from '@/services/meals';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, stroke } from '@/theme/tokens';

const MEAL_TYPES: { value: MealType; label: string }[] = (['breakfast', 'pre_workout', 'lunch', 'snack', 'dinner'] as MealType[]).map(
  (v) => ({ value: v, label: MEAL_TYPE_LABEL[v] }),
);

/** Portion picker for a searched food: choose amount + unit, see live nutrition, log in one tap. */
export default function FoodPortion() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const toast = useToast();
  const userId = session!.user.id;
  const [item] = useState(peekPendingFood);
  const [quantity, setQuantity] = useState(() => String(item?.default_quantity ?? 1));
  const [unit, setUnit] = useState(() => item?.default_unit ?? 'g');
  const [mealType, setMealType] = useState<MealType>(() => categoriseMeal(localParts(new Date()).minutes));
  const [auto, setAuto] = useState<MealType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    suggestMealType(userId)
      .then((t) => {
        setAuto(t);
        setMealType(t);
      })
      .catch(() => undefined);
  }, [userId]);

  if (!item) return <Redirect href="/add" />;

  const units = unitsFor(item);
  const unitGrams = units.find((u) => u.unit === unit)?.grams ?? 1;
  const q = checkRange(quantity, 0.01, 5000, 'Amount', true);
  const p = q.value ? portionFor(item, q.value, unit) : null;
  const tooMuch = p ? p.grams > 5000 : false;

  const changeUnit = (next: string) => {
    // Keep roughly the same weight when switching to or from grams.
    if (q.value && (next === 'g' || unit === 'g')) {
      const grams = q.value * unitGrams;
      const nextGrams = units.find((u) => u.unit === next)?.grams ?? 1;
      setQuantity(String(Math.round((grams / nextGrams) * 100) / 100));
    }
    setUnit(next);
  };

  const log = async () => {
    if (!q.value || tooMuch) return;
    setBusy(true);
    setError(null);
    try {
      await createMeal(
        { mealType, categoryAuto: mealType === auto, mealKind: 'regular', source: 'manual', isEstimate: true },
        [draftFromSearch(item, q.value, unit)],
      );
      toast(`${item.name} logged · ${p?.calories ?? 0} kcal`);
      router.replace('/today');
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  };

  return (
    <Screen
      narrow
      footer={
        <View style={styles.row}>
          <Button label="Back" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
          <Button label="Log food" onPress={log} loading={busy} disabled={!q.value || tooMuch} style={{ flex: 2 }} />
        </View>
      }
    >
      <View style={{ marginTop: spacing.sm }}>
        <AppText variant="overline" tone="muted">{item.category ?? 'Food'}</AppText>
        <AppText variant="title" accessibilityRole="header">{item.name}</AppText>
        {item.local_name ? <AppText tone="muted">{item.local_name}</AppText> : null}
      </View>

      <Card tone="hero">
        <AppText variant="overline" tone="muted">For this amount</AppText>
        <AppText variant="display" numeric style={{ fontFamily: 'SpaceMono_700Bold' }}>
          {p ? p.calories : '–'} <AppText variant="heading" tone="muted">kcal</AppText>
        </AppText>
        <View style={[styles.macros, { borderColor: colors.ink }]}>
          {[
            ['Protein', p?.protein, colors.protein],
            ['Carbs', p?.carbs, colors.carbs],
            ['Fat', p?.fat, colors.fat],
            ['Fibre', p?.fibre, colors.fibre],
          ].map(([l, v, c], i) => (
            <View key={l as string} style={[styles.macro, i > 0 && { borderLeftWidth: stroke.base, borderColor: colors.ink }]}>
              <View style={[styles.swatch, { backgroundColor: c as string, borderColor: colors.ink }]} />
              <AppText variant="statSm" numeric>{v ?? '–'}g</AppText>
              <AppText variant="caption" tone="muted">{(l as string).toUpperCase()}</AppText>
            </View>
          ))}
        </View>
        <AppText variant="caption" tone="subtle" numeric>
          {p ? `${p.grams} g` : ''}
          {p && p.sugar !== null ? ` · sugar ${p.sugar} g` : ''}
          {p && p.sodium !== null ? ` · sodium ${p.sodium} mg` : ''}
        </AppText>
      </Card>

      <View style={styles.row}>
        <View style={{ width: 130 }}>
          <TextField
            label="Amount"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            error={q.error ?? (tooMuch ? 'Too large' : null)}
            selectTextOnFocus
          />
        </View>
        <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: spacing.md }}>
          <AppText variant="caption" tone="muted" numeric>
            1 {unit} ≈ {unitGrams} g · {item.per_100g.calories_kcal} kcal per 100 g
          </AppText>
        </View>
      </View>
      <ChoiceGroup label="Unit" layout="scroll" options={units.map((u) => ({ value: u.unit, label: u.unit === 'g' ? 'grams' : u.unit }))} value={unit} onChange={changeUnit} />
      <ChoiceGroup label={auto ? `Meal · auto-selected ${MEAL_TYPE_LABEL[auto]}` : 'Meal'} layout="scroll" options={MEAL_TYPES} value={mealType} onChange={setMealType} />

      <Banner tone="warning" title="AI estimate">
        Nutrition values are estimated by AI from standard food data for a typical recipe. Home and restaurant versions vary — adjust if you know better.
      </Banner>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Button
        label="Edit values or add more foods"
        variant="ghost"
        onPress={() => {
          if (!q.value) return;
          setPendingItems([draftFromSearch(item, q.value, unit)]);
          router.replace('/log/manual');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  macros: { flexDirection: 'row', borderWidth: stroke.base, borderRadius: radius.md, marginVertical: spacing.md },
  macro: { flex: 1, padding: spacing.sm, gap: 2 },
  swatch: { width: 12, height: 12, borderWidth: stroke.base },
});
