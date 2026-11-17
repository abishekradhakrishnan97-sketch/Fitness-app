import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { AppText, Banner, Card, EmptyState, Icon, Screen, TextField, type IconName } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthProvider';
import { setPendingItems } from '@/lib/draftStore';
import { draftFromRow, type ItemPayload } from '@/lib/nutrition/mealDraft';
import { friendlyError } from '@/services/errors';
import { deleteSavedMeal, listSavedMeals, markSavedMealUsed, searchMyFoods } from '@/services/meals';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
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
        {
          backgroundColor: primary ? colors.primary : colors.surface,
          borderColor: primary ? colors.primary : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Icon name={icon} size={24} color={primary ? colors.onPrimary : colors.primary} />
      <AppText variant="bodyStrong" color={primary ? colors.onPrimary : colors.text}>{label}</AppText>
      <AppText variant="caption" color={primary ? colors.onPrimary : colors.textMuted}>{hint}</AppText>
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

  const loadSaved = useCallback(() => {
    listSavedMeals().then(setSaved).catch((e) => setError(friendlyError(e)));
  }, []);

  useFocusEffect(loadSaved);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      searchMyFoods(query, query ? 25 : 8)
        .then((r) => live && setFoods(r))
        .catch((e) => live && setError(friendlyError(e)));
    }, query ? 250 : 0);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, userId]);

  const pickFood = (f: MyFoodRow) => {
    setPendingItems([draftFromRow(f, 'history')]);
    router.push('/log/manual');
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

  return (
    <Screen>
      {dialog}
      <AppText variant="title" accessibilityRole="header" style={{ marginTop: spacing.sm }}>Add food</AppText>

      <View style={styles.grid}>
        <ActionTile primary icon="camera" label="Snap a photo" hint="AI identifies the food" onPress={() => router.push({ pathname: '/log/photo', params: { mode: 'camera' } })} />
        <ActionTile icon="images-outline" label="Upload photo" hint="From your gallery" onPress={() => router.push({ pathname: '/log/photo', params: { mode: 'library' } })} />
        <ActionTile icon="create-outline" label="Enter manually" hint="Type name & nutrition" onPress={() => router.push('/log/manual')} />
        <ActionTile icon="barcode-outline" label="Packaged food" hint="Barcode or product search" onPress={() => router.push('/log/barcode')} />
      </View>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <TextField label="Search foods you've logged" value={query} onChangeText={setQuery} placeholder="e.g. idli, chicken curry" returnKeyType="search" autoCorrect={false} />

      <View>
        <AppText variant="heading" style={{ marginBottom: spacing.md }}>{query ? 'Matches' : 'Frequent & recent'}</AppText>
        {foods.length === 0 ? (
          <Card tone="inset">
            <EmptyState
              icon="time-outline"
              title={query ? 'No matches in your history' : 'Your foods will appear here'}
              message={query ? 'Add it manually — next time it will show up here.' : 'Foods you log are remembered so you can add them again in one tap.'}
            />
          </Card>
        ) : (
          <Card padded={false}>
            {foods.map((f, i) => (
              <Pressable
                key={f.name}
                onPress={() => pickFood(f)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${f.name}`}
                style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, pressed && { backgroundColor: colors.surfaceSunken }]}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{f.name}</AppText>
                  <AppText variant="caption" tone="subtle" numeric>
                    {Number(f.serving_quantity ?? 1)} {f.serving_unit ?? 'serving'} · P {Math.round(Number(f.protein_g))} C {Math.round(Number(f.carbohydrates_g))} F {Math.round(Number(f.fat_g))}
                    {f.times_logged > 1 ? ` · logged ${f.times_logged}×` : ''}
                  </AppText>
                </View>
                <AppText variant="bodyStrong" numeric>{Math.round(Number(f.calories_kcal))} kcal</AppText>
                <Icon name="add-circle" size={22} color={colors.primary} />
              </Pressable>
            ))}
          </Card>
        )}
      </View>

      {!query && saved.length > 0 ? (
        <View>
          <AppText variant="heading" style={{ marginBottom: spacing.md }}>Saved meals</AppText>
          <Card padded={false}>
            {saved.map((m, i) => {
              const items = Array.isArray(m.items) ? (m.items as unknown as ItemPayload[]) : [];
              const kcal = items.reduce((s, x) => s + Number(x.calories_kcal ?? 0), 0);
              return (
                <View key={m.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
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
                    <Icon name="add-circle" size={22} color={colors.primary} />
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { flexGrow: 1, flexBasis: '45%', minHeight: 112, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, gap: spacing.xs, justifyContent: 'flex-end' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
});
