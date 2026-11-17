import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { MealForm } from '@/components/food/MealForm';
import { LoadingState, Screen, useToast } from '@/components/ui';
import { draftTotals } from '@/lib/nutrition/mealDraft';
import { useAuth } from '@/lib/auth/AuthProvider';
import { takePendingItems } from '@/lib/draftStore';
import { emptyItem, type DraftItem } from '@/lib/nutrition/mealDraft';
import { categoriseMeal, localParts, type MealType } from '@/lib/time/mealCategory';
import { createMeal, suggestMealType } from '@/services/meals';

export default function ManualEntry() {
  const { session } = useAuth();
  const toast = useToast();
  const userId = session!.user.id;
  const [items] = useState<DraftItem[]>(() => takePendingItems() ?? [emptyItem()]);
  const [auto, setAuto] = useState<MealType | null>(null);

  useEffect(() => {
    suggestMealType(userId)
      .then(setAuto)
      .catch(() => setAuto(categoriseMeal(localParts(new Date()).minutes)));
  }, [userId]);

  if (!auto) return <Screen narrow><LoadingState /></Screen>;

  const fromHistory = items.some((i) => i.source !== 'manual');

  return (
    <MealForm
      title={fromHistory ? 'Log food' : 'Add food manually'}
      autoMealType={auto}
      estimateBanner={items.some((i) => i.isEstimate)}
      initial={{ mealType: auto, categoryAuto: true, mealKind: 'regular', notes: '', items }}
      submitLabel="Save meal"
      onCancel={() => router.back()}
      onSubmit={async (v) => {
        await createMeal(
          {
            mealType: v.mealType,
            categoryAuto: v.categoryAuto,
            mealKind: v.mealKind,
            notes: v.notes,
            source: 'manual',
            isEstimate: v.items.some((i) => i.isEstimate),
          },
          v.items,
        );
        toast(`Meal saved · ${Math.round(draftTotals(v.items).calories)} kcal added`);
        router.replace('/today');
      }}
    />
  );
}
