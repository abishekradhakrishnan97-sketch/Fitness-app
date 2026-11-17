import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { AppText, Banner, Button, Card, EmptyState, Icon, Screen, TextField, type IconName } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthProvider';
import { setPendingFood, setPendingItems } from '@/lib/draftStore';
import { portionFor, type FoodSearchItem } from '@/lib/nutrition/foodSearch';
import { draftFromRow, type ItemPayload } from '@/lib/nutrition/mealDraft';
import { searchFoodsAi } from '@/services/coach';
import { friendlyError } from '@/services/errors';
import { deleteSavedMeal, listSavedMeals, markSavedMealUsed, searchMyFoods } from '@/services/meals';
import { useTheme } from '@/theme/ThemeProvider';
import { hardShadow, radius, spacing, stroke } from '@/theme/tokens';
import type { MyFoodRow, SavedMealRow } from '@/types/database';

function ActionTile({ icon, label, hint, onPress, primary }: { icon: IconName; label: string; hint: string; onPress: () => void; primary?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: primary ? colors.primary : colors.surface, borderColor: colors.ink, borderWidth: stroke.base },
        pressed ? { transform: [{ translateX: 3 }, { translateY: 3 }] } : hardShadow(colors.shadow, 4),
      ]}
    >
      <Icon name={icon} size={24} color={primary ? colors.onPrimary : colors.text} />
      <AppText variant="overline" color={primary ? colors.onPrimary : colors.text}>{label}</AppText>
    </Pressable>
  );
}

export default function AddFood() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session!.user.id;
  const [dialog, confirm] = useConfirm();
  const [query, setQuery] = useState('');
  const [foods, setFoods] = useState<MyFoodRow[]>([]);
  const [saved, setSaved] = useState<SavedMealRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  // AI search results are stored with the query they belong to, so stale answers are never shown.
  const [ai, setAi] = useState<{ q: string; items: FoodSearchItem[]; error: string | null } | null>(null);
  const [retry, setRetry] = useState(0);

  const q = query.trim();
  const searching = q.length >= 2 && ai?.q !== q;

  const loadSaved = useCallback(() => {
    listSavedMeals().then(setSaved).catch((e) => setError(friendlyError(e)));
  }, []);
  useFocusEffect(loadSaved);

  // Your own history: instant.
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      searchMyFoods(q, q ? 6 : 8)
        .then((r) => live && setFoods(r))
        .catch((e) => live && setError(friendlyError(e)));
    }, q ? 200 : 0);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, userId]);

  // AI food database: debounced so we don't query on every keystroke.
  useEffect(() => {
    if (q.length < 2) return;
    let live = true;
    const t = setTimeout(() => {
      searchFoodsAi(q)
        .then((items) => live && setAi({ q, items, error: null }))
        .catch((e) => live && setAi({ q, items: [], error: e instanceof Error ? e.message : 'Search failed.' }));
    }, 600);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, retry]);

  const pickFood = (f: MyFoodRow) => {
    setPendingItems([draftFromRow(f, 'history')]);
    router.push('/log/manual');
  };
  const pickAi = (f: FoodSearchItem) => {
    setPendingFood(f);
    router.push('/log/food');
  };
  const pickSaved = (m: SavedMealRow) => {
    const items = (Array.isArray(m.items) ? (m.items as unknown as ItemPayload[]) : []).map((i) => draftFromRow(i, 'saved'));
    if (!items.length) return;
    void markSavedMealUsed(m);
    setPendingItems(items);
    router.push('/log/manual');
  };
  const removeSaved = async (m: SavedMealRow) => {
    if (!(await confirm({ title: `Delete "${m.name}"?`, message: 'This removes the saved meal template. Logged meals are not affected.', confirmLabel: 'Delete', destructive: true }))) return;
    try {
      await deleteSavedMeal(m.id);
      loadSaved();
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  const aiItems = ai?.q === q ? ai.items : [];
  const aiError = ai?.q === q ? ai.error : null;

  return (
    <Screen>
      {dialog}
      <AppText variant="title" accessibilityRole="header" style={{ marginTop: spacing.sm }}>Add food</AppText>

      <TextField
        label="Search any food"
        value={query}
        onChangeText={setQuery}
        placeholder="Try “biri”, “dosa”, “chicken curry”…"
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        hint={q.length < 2 ? 'Type 2+ letters. Nutrition is looked up for you — just pick the amount.' : undefined}
      />

      {q.length < 2 ? (
        <View style={styles.grid}>
          <ActionTile primary icon="camera" label="Photo" hint="AI identifies the food" onPress={() => router.push({ pathname: '/log/photo', params: { mode: 'camera' } })} />
          <ActionTile icon="images-outline" label="Upload" hint="Photo from your gallery" onPress={() => router.push({ pathname: '/log/photo', params: { mode: 'library' } })} />
          <ActionTile icon="barcode-outline" label="Barcode" hint="Packaged food" onPress={() => router.push('/log/barcode')} />
        </View>
      ) : null}

      {error ? <Banner tone="danger">{error}</Banner> : null}

      {q.length >= 2 ? (
        <View>
          <View style={styles.sectionHead}>
            <AppText variant="heading">Results</AppText>
            {searching ? (
              <View style={styles.inline} accessibilityLiveRegion="polite">
                <ActivityIndicator color={colors.text} size="small" />
                <AppText variant="overline" tone="muted">Searching</AppText>
              </View>
            ) : (
              <AppText variant="overline" tone="subtle">AI estimates</AppText>
            )}
          </View>
          {aiError ? (
            <Banner tone="danger" title="Search didn’t work">
              <View style={{ gap: spacing.sm }}>
                <AppText variant="label" tone="muted">{aiError}</AppText>
                <Button
                  label="Try again"
                  size="sm"
                  variant="secondary"
                  onPress={() => {
                    setAi(null);
                    setRetry((n) => n + 1);
                  }}
                  style={{ alignSelf: 'flex-start' }}
                />
              </View>
            </Banner>
          ) : aiItems.length ? (
            <Card padded={false}>
              {aiItems.map((f, i) => {
                const p = portionFor(f, f.default_quantity, f.default_unit);
                return (
                  <Pressable
                    key={`${f.name}-${i}`}
                    onPress={() => pickAi(f)}
                    accessibilityRole="button"
                    accessibilityLabel={`${f.name}, about ${p.calories} calories per ${f.default_quantity} ${f.default_unit}. Choose amount`}
                    style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: stroke.hairline, borderTopColor: colors.border }, pressed && { backgroundColor: colors.primarySoft }]}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyStrong">{f.name}</AppText>
                      <AppText variant="caption" tone="subtle" numeric>
                        {f.default_quantity} {f.default_unit} ({p.grams} g) · P {Math.round(p.protein)} C {Math.round(p.carbs)} F {Math.round(p.fat)}
                      </AppText>
                    </View>
                    <AppText variant="statSm" numeric>{p.calories}</AppText>
                    <Icon name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                );
              })}
            </Card>
          ) : !searching ? (
            <Card tone="inset">
              <EmptyState icon="search" title="No foods found" message="Check the spelling, or enter it yourself." />
            </Card>
          ) : null}
          <Button
            label="Can’t find it? Enter it yourself"
            variant="ghost"
            icon="create-outline"
            onPress={() => router.push('/log/manual')}
            style={{ alignSelf: 'flex-start', marginTop: spacing.sm }}
          />
        </View>
      ) : null}

      {foods.length > 0 ? (
        <View>
          <AppText variant="heading" style={{ marginBottom: spacing.md }}>{q ? 'From your history' : 'Frequent & recent'}</AppText>
          <Card padded={false}>
            {foods.map((f, i) => (
              <Pressable
                key={f.name}
                onPress={() => pickFood(f)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${f.name} again`}
                style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: stroke.hairline, borderTopColor: colors.border }, pressed && { backgroundColor: colors.primarySoft }]}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{f.name}</AppText>
                  <AppText variant="caption" tone="subtle" numeric>
                    {Number(f.serving_quantity ?? 1)} {f.serving_unit ?? 'serving'} · P {Math.round(Number(f.protein_g))} C {Math.round(Number(f.carbohydrates_g))} F {Math.round(Number(f.fat_g))}
                    {f.times_logged > 1 ? ` · ${f.times_logged}×` : ''}
                  </AppText>
                </View>
                <AppText variant="statSm" numeric>{Math.round(Number(f.calories_kcal))}</AppText>
                <Icon name="add-circle" size={24} color={colors.primaryText} />
              </Pressable>
            ))}
          </Card>
        </View>
      ) : q.length < 2 ? (
        <Card tone="inset">
          <EmptyState icon="time-outline" title="Your foods will appear here" message="Foods you log are remembered so you can add them again in one tap." />
        </Card>
      ) : null}

      {q.length < 2 && saved.length > 0 ? (
        <View>
          <AppText variant="heading" style={{ marginBottom: spacing.md }}>Saved meals</AppText>
          <Card padded={false}>
            {saved.map((m, i) => {
              const items = Array.isArray(m.items) ? (m.items as unknown as ItemPayload[]) : [];
              const kcal = items.reduce((s, x) => s + Number(x.calories_kcal ?? 0), 0);
              return (
                <View key={m.id} style={[styles.row, i > 0 && { borderTopWidth: stroke.hairline, borderTopColor: colors.border }]}>
                  <Pressable onPress={() => pickSaved(m)} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`Log saved meal ${m.name}`}>
                    <AppText variant="bodyStrong">{m.name}</AppText>
                    <AppText variant="caption" tone="subtle" numeric>
                      {items.length} item{items.length === 1 ? '' : 's'} · {Math.round(kcal)} kcal
                    </AppText>
                  </Pressable>
                  <Pressable onPress={() => removeSaved(m)} hitSlop={13} style={{ padding: 2 }} accessibilityRole="button" accessibilityLabel={`Delete saved meal ${m.name}`}>
                    <Icon name="trash-outline" size={18} color={colors.textSubtle} />
                  </Pressable>
                  <Pressable onPress={() => pickSaved(m)} hitSlop={11} accessibilityRole="button" accessibilityLabel={`Log ${m.name}`}>
                    <Icon name="add-circle" size={24} color={colors.primaryText} />
                  </Pressable>
                </View>
              );
            })}
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: spacing.md },
  tile: { flex: 1, minHeight: 76, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
});
