import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { MealForm } from '@/components/food/MealForm';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { AppText, Banner, Button, Card, ErrorState, LoadingState, Screen, TextField } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthProvider';
import { draftFromRow } from '@/lib/nutrition/mealDraft';
import { MEAL_TYPE_LABEL, type MealType } from '@/lib/time/mealCategory';
import { useAsync } from '@/lib/useAsync';
import { friendlyError } from '@/services/errors';
import { createSavedMeal, deleteMeal, duplicateMeal, getMeal, signedPhotoUrl, updateMeal, type MealKind } from '@/services/meals';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

export default function MealDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session!.user.id;
  const [dialog, confirm] = useConfirm();
  const { data: meal, loading, error, reload } = useAsync(() => getMeal(id), [id]);
  const [editing, setEditing] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveName, setSaveName] = useState<string | null>(null);

  useEffect(() => {
    if (meal?.photo_path) signedPhotoUrl(meal.photo_path).then(setPhotoUrl);
  }, [meal?.photo_path]);

  if (loading) return <Screen narrow><LoadingState /></Screen>;
  if (error) return <Screen narrow><ErrorState message={error} onRetry={reload} /></Screen>;
  if (!meal) {
    return (
      <Screen narrow>
        <ErrorState message="This meal doesn't exist or was deleted." />
        <Button label="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const mealType = (meal.meal_type ?? 'other') as MealType;

  if (editing) {
    return (
      <MealForm
        title="Edit meal"
        estimateBanner={meal.is_estimate}
        initial={{
          mealType,
          categoryAuto: meal.category_auto,
          mealKind: meal.meal_kind as MealKind,
          notes: meal.notes ?? '',
          items: meal.meal_items.map((i) => draftFromRow(i)),
        }}
        submitLabel="Save changes"
        onCancel={() => setEditing(false)}
        onSubmit={async (v) => {
          await updateMeal(meal.id, { mealType: v.mealType, categoryAuto: v.categoryAuto && v.mealType === mealType, mealKind: v.mealKind, notes: v.notes }, v.items);
          setEditing(false);
          setNotice('Changes saved.');
          await reload();
        }}
      />
    );
  }

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setActionError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setActionError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Delete this meal?',
      message: `${MEAL_TYPE_LABEL[mealType]} · ${Math.round(Number(meal.total_calories_kcal))} kcal. This can't be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) await run('delete', async () => {
      await deleteMeal(meal);
      router.back();
    });
  };

  const eaten = new Date(meal.eaten_at);

  return (
    <Screen narrow>
      {dialog}
      <View style={styles.top}>
        <Button label="Back" icon="chevron-back" variant="ghost" size="sm" onPress={() => router.back()} />
      </View>
      <View>
        <AppText variant="overline" tone="subtle">
          {new Date(`${meal.local_date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </AppText>
        <AppText variant="title" accessibilityRole="header">
          {MEAL_TYPE_LABEL[mealType]}
          {meal.meal_kind !== 'regular' ? <AppText variant="heading" tone="muted">{`  · ${meal.meal_kind}`}</AppText> : null}
        </AppText>
        <AppText variant="label" tone="muted">
          {eaten.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          {meal.timezone ? ` (${meal.timezone})` : ''}
        </AppText>
      </View>

      {notice ? <Banner tone="info">{notice}</Banner> : null}
      {actionError ? <Banner tone="danger">{actionError}</Banner> : null}

      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={[styles.photo, { backgroundColor: colors.surfaceSunken }]} resizeMode="cover" accessibilityLabel="Meal photo" />
      ) : null}

      <Card tone="hero">
        <AppText variant="display" numeric>
          {Math.round(Number(meal.total_calories_kcal))} <AppText variant="heading" tone="muted">kcal</AppText>
        </AppText>
        <View style={styles.macros}>
          {[
            ['Protein', meal.total_protein_g, colors.protein],
            ['Carbs', meal.total_carbohydrates_g, colors.carbs],
            ['Fat', meal.total_fat_g, colors.fat],
            ['Fibre', meal.total_fibre_g, colors.fibre],
          ].map(([l, v, c]) => (
            <View key={l as string} style={styles.macro}>
              <View style={[styles.dot, { backgroundColor: c as string }]} />
              <AppText variant="bodyStrong" numeric>{Math.round(Number(v) * 10) / 10} g</AppText>
              <AppText variant="caption" tone="muted">{l as string}</AppText>
            </View>
          ))}
        </View>
        {meal.is_estimate ? (
          <AppText variant="caption" tone="warning">Includes AI-estimated values — not exact measurements.</AppText>
        ) : null}
      </Card>

      <Card padded={false}>
        {meal.meal_items.map((i, idx) => (
          <View key={i.id} style={[styles.item, idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong">{i.name}</AppText>
              <AppText variant="caption" tone="subtle" numeric>
                {Number(i.serving_quantity ?? 1)} {i.serving_unit ?? 'serving'}
                {i.portion_grams && i.serving_unit !== 'g' ? ` (${Number(i.portion_grams)} g)` : ''} · P {Number(i.protein_g)} · C {Number(i.carbohydrates_g)} · F {Number(i.fat_g)}
                {i.food_source === 'ai_image' ? ' · AI estimate' : ''}
              </AppText>
            </View>
            <AppText variant="bodyStrong" numeric>{Math.round(Number(i.calories_kcal))} kcal</AppText>
          </View>
        ))}
      </Card>

      {meal.notes ? (
        <Card tone="inset"><AppText tone="muted">{meal.notes}</AppText></Card>
      ) : null}

      <View style={styles.actions}>
        <Button label="Edit" icon="create-outline" onPress={() => setEditing(true)} style={styles.flex} />
        <Button
          label="Log again"
          icon="copy-outline"
          variant="secondary"
          loading={busy === 'dup'}
          onPress={() => run('dup', async () => {
            await duplicateMeal(meal, userId);
            setNotice('Logged again for now. You can find it on Today.');
          })}
          style={styles.flex}
        />
      </View>

      {saveName === null ? (
        <Button label="Save as a reusable meal" icon="bookmark-outline" variant="secondary" onPress={() => setSaveName(`${MEAL_TYPE_LABEL[mealType]} — ${meal.meal_items[0]?.name ?? 'meal'}`.slice(0, 80))} />
      ) : (
        <Card>
          <View style={{ gap: spacing.md }}>
            <TextField label="Name this meal" value={saveName} onChangeText={setSaveName} maxLength={80} autoFocus />
            <View style={styles.actions}>
              <Button label="Cancel" variant="ghost" size="sm" onPress={() => setSaveName(null)} />
              <Button
                label="Save"
                size="sm"
                loading={busy === 'save'}
                disabled={!saveName.trim()}
                onPress={() => run('save', async () => {
                  await createSavedMeal(userId, saveName, meal.meal_items.map((i) => draftFromRow(i)));
                  setSaveName(null);
                  setNotice('Saved. Find it under Saved meals on the Add tab.');
                })}
              />
            </View>
          </View>
        </Card>
      )}

      <Button label="Delete meal" icon="trash-outline" variant="danger" loading={busy === 'delete'} onPress={onDelete} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', marginLeft: -spacing.md },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg },
  macros: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, marginBottom: spacing.sm, flexWrap: 'wrap' },
  macro: { flex: 1, minWidth: 70, gap: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' },
  flex: { flex: 1 },
});
