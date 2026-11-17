import type { FoodSearchItem } from '@/lib/nutrition/foodSearch';
import type { DraftItem } from '@/lib/nutrition/mealDraft';

/**
 * In-memory hand-off of prefilled items between screens (e.g. picking a past food
 * on the Add screen opens the manual form pre-filled). Not persisted.
 */
let pending: DraftItem[] | null = null;

export function setPendingItems(items: DraftItem[]): void {
  pending = items;
}

export function takePendingItems(): DraftItem[] | null {
  const p = pending;
  pending = null;
  return p;
}

let pendingFood: FoodSearchItem | null = null;

/** Hand a searched food to the portion screen. */
export function setPendingFood(item: FoodSearchItem): void {
  pendingFood = item;
}

export function peekPendingFood(): FoodSearchItem | null {
  return pendingFood;
}
