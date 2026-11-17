// AI food search results -> nutrition for any amount/unit. Pure (unit-tested).

import { emptyItem, type DraftItem } from './mealDraft.ts';

export interface FoodUnit {
  unit: string;
  grams: number;
}

export interface Per100g {
  calories_kcal: number;
  protein_g: number;
  carbohydrates_g: number;
  fat_g: number;
  fibre_g: number;
  sugar_g: number | null;
  sodium_mg: number | null;
}

export interface FoodSearchItem {
  name: string;
  local_name: string | null;
  category: string | null;
  per_100g: Per100g;
  default_unit: string;
  default_quantity: number;
  units: FoodUnit[];
  confidence: number;
}

/** Units offered for an item: its household units plus grams (always). */
export function unitsFor(item: FoodSearchItem): FoodUnit[] {
  const seen = new Set<string>();
  const out: FoodUnit[] = [];
  for (const u of [...item.units, { unit: 'g', grams: 1 }]) {
    const key = u.unit.toLowerCase();
    if (seen.has(key) || !(u.grams > 0)) continue;
    seen.add(key);
    out.push({ unit: key, grams: u.grams });
  }
  return out;
}

export function gramsFor(item: FoodSearchItem, quantity: number, unit: string): number {
  const u = unitsFor(item).find((x) => x.unit === unit.toLowerCase());
  return Math.round(quantity * (u?.grams ?? 1) * 10) / 10;
}

export interface Portion {
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  sugar: number | null;
  sodium: number | null;
}

export function portionFor(item: FoodSearchItem, quantity: number, unit: string): Portion {
  const grams = gramsFor(item, quantity, unit);
  const f = grams / 100;
  const r = (v: number, d = 1) => Math.round(v * f * 10 ** d) / 10 ** d;
  const p = item.per_100g;
  return {
    grams,
    calories: r(p.calories_kcal, 0),
    protein: r(p.protein_g),
    carbs: r(p.carbohydrates_g),
    fat: r(p.fat_g),
    fibre: r(p.fibre_g),
    sugar: p.sugar_g === null ? null : r(p.sugar_g),
    sodium: p.sodium_mg === null ? null : r(p.sodium_mg, 0),
  };
}

export function draftFromSearch(item: FoodSearchItem, quantity: number, unit: string): DraftItem {
  const p = portionFor(item, quantity, unit);
  const s = (n: number | null) => (n === null ? '' : String(n));
  return emptyItem({
    name: item.name,
    localName: item.local_name,
    quantity: String(quantity),
    unit: unit.toLowerCase(),
    grams: String(p.grams),
    calories: s(p.calories),
    protein: s(p.protein),
    carbs: s(p.carbs),
    fat: s(p.fat),
    fibre: s(p.fibre),
    sugar: s(p.sugar),
    sodium: s(p.sodium),
    source: 'ai_search',
    confidence: item.confidence,
    isEstimate: true,
    aiOriginal: item,
  });
}
