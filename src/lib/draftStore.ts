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
