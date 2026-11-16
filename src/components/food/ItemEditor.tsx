import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Card, ChoiceGroup, TextField } from '@/components/ui';
import { SERVING_UNITS, setQuantity, type DraftItem, type ItemErrors } from '@/lib/nutrition/mealDraft';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

const UNIT_CHOICES = SERVING_UNITS.map((u) => ({ value: u, label: u }));

export function ItemEditor({
  item,
  errors,
  onChange,
  onRemove,
  canRemove,
  index,
}: {
  item: DraftItem;
  errors: ItemErrors;
  onChange: (item: DraftItem) => void;
  onRemove: () => void;
  canRemove: boolean;
  index: number;
}) {
  const { colors } = useTheme();
  const [showMore, setShowMore] = useState(!!(item.sugar || item.sodium || item.fibre));
  const set = (patch: Partial<DraftItem>) => onChange({ ...item, ...patch, edited: true });
  const field = (k: 'calories' | 'protein' | 'carbs' | 'fat' | 'fibre' | 'sugar' | 'sodium') => (t: string) => set({ [k]: t });
  const uncertain = item.confidence !== null && item.confidence !== undefined && item.confidence < 0.6;

  return (
    <Card style={uncertain ? { borderColor: colors.warning } : undefined}>
      <View style={styles.head}>
        <AppText variant="overline" tone="subtle">Item {index + 1}</AppText>
        <View style={styles.badges}>
          {item.isEstimate ? (
            <View style={[styles.badge, { backgroundColor: colors.warningSoft }]}>
              <AppText variant="caption" tone="warning">AI estimate</AppText>
            </View>
          ) : null}
          {item.confidence !== null && item.confidence !== undefined ? (
            <View style={[styles.badge, { backgroundColor: uncertain ? colors.dangerSoft : colors.surfaceSunken }]}>
              <AppText variant="caption" tone={uncertain ? 'danger' : 'muted'}>
                {Math.round(item.confidence * 100)}% sure
              </AppText>
            </View>
          ) : null}
          {canRemove ? (
            <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove ${item.name || 'item'}`} hitSlop={10}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        <TextField label="Food" value={item.name} onChangeText={(t) => set({ name: t })} placeholder="e.g. Masala dosa" error={errors.name} />
        {uncertain && item.alternatives?.length ? (
          <View style={{ gap: spacing.xs }}>
            <AppText variant="caption" tone="warning">Not sure — could it be one of these?</AppText>
            <View style={styles.altRow}>
              {item.alternatives.map((a) => (
                <Pressable
                  key={a}
                  onPress={() => set({ name: a })}
                  style={[styles.alt, { borderColor: colors.border, backgroundColor: colors.surfaceSunken }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Rename to ${a}`}
                >
                  <AppText variant="caption">{a}</AppText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        {item.portionDescription ? (
          <AppText variant="caption" tone="subtle">AI portion: {item.portionDescription}</AppText>
        ) : null}

        <View style={styles.row}>
          <View style={{ width: 110 }}>
            <TextField
              label="Amount"
              value={item.quantity}
              onChangeText={(t) => onChange(setQuantity(item, t))}
              keyboardType="decimal-pad"
              error={errors.quantity}
            />
          </View>
          <View style={styles.flex}>
            <TextField label="Weight (optional)" value={item.grams} onChangeText={(t) => set({ grams: t })} keyboardType="decimal-pad" suffix="g" error={errors.grams} />
          </View>
        </View>
        <ChoiceGroup label="Unit" options={UNIT_CHOICES} value={item.unit as (typeof SERVING_UNITS)[number]} onChange={(u) => set({ unit: u })} />
        <AppText variant="caption" tone="subtle">Changing the amount scales the nutrition values below.</AppText>

        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Calories" value={item.calories} onChangeText={field('calories')} keyboardType="decimal-pad" suffix="kcal" error={errors.calories} />
          </View>
          <View style={styles.flex}>
            <TextField label="Protein" value={item.protein} onChangeText={field('protein')} keyboardType="decimal-pad" suffix="g" error={errors.protein} />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Carbs" value={item.carbs} onChangeText={field('carbs')} keyboardType="decimal-pad" suffix="g" error={errors.carbs} />
          </View>
          <View style={styles.flex}>
            <TextField label="Fat" value={item.fat} onChangeText={field('fat')} keyboardType="decimal-pad" suffix="g" error={errors.fat} />
          </View>
        </View>
        {showMore ? (
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField label="Fibre" value={item.fibre} onChangeText={field('fibre')} keyboardType="decimal-pad" suffix="g" error={errors.fibre} />
            </View>
            <View style={styles.flex}>
              <TextField label="Sugar" value={item.sugar} onChangeText={field('sugar')} keyboardType="decimal-pad" suffix="g" error={errors.sugar} />
            </View>
            <View style={styles.flex}>
              <TextField label="Sodium" value={item.sodium} onChangeText={field('sodium')} keyboardType="decimal-pad" suffix="mg" error={errors.sodium} />
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setShowMore(true)} accessibilityRole="button" style={{ paddingVertical: spacing.xs }}>
            <AppText variant="label" tone="primary">+ Fibre, sugar, sodium</AppText>
          </Pressable>
        )}
        {item.warnings?.length ? (
          <View style={{ gap: 2 }}>
            {item.warnings.map((w) => (
              <AppText key={w} variant="caption" tone="subtle">• {w}</AppText>
            ))}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  body: { gap: spacing.md, marginTop: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  altRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  alt: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1 },
});
