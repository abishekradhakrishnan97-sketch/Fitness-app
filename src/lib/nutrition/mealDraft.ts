// Editable meal drafts shared by manual entry, AI photo review, saved meals and edits.
// Pure functions only (unit-tested). Numbers are kept as strings while editing so
// users can type freely ("1.", ""), and parsed on save.

export type FoodSource = 'manual' | 'ai_image' | 'barcode' | 'saved' | 'history';

export const SERVING_UNITS = ['g', 'ml', 'piece', 'serving', 'katori', 'cup', 'bowl', 'plate', 'tbsp', 'tsp', 'slice', 'glass'] as const;

export const NUTRIENT_FIELDS = ['calories', 'protein', 'carbs', 'fat', 'fibre', 'sugar', 'sodium'] as const;
export type NutrientField = (typeof NUTRIENT_FIELDS)[number];

export interface DraftItem {
  key: string;
  name: string;
  quantity: string;
  unit: string;
  /** Weight in grams, if known (AI estimates, g/ml units, or entered). */
  grams: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fibre: string;
  sugar: string;
  sodium: string;
  source: FoodSource;
  barcode?: string | null;
  localName?: string | null;
  cuisineRegion?: string | null;
  portionDescription?: string | null;
  /** AI identification confidence 0..1 (AI items only). */
  confidence?: number | null;
  alternatives?: string[];
  warnings?: string[];
  /** True when nutrition values are estimates (AI). Stays true after user edits. */
  isEstimate: boolean;
  /** Snapshot of the original AI item, saved for audit. */
  aiOriginal?: unknown;
  edited: boolean;
  /** Last valid quantity, so clearing then retyping the amount still scales correctly. */
  lastQty?: number;
}

let counter = 0;
export const newKey = () => `i${Date.now().toString(36)}${(counter++).toString(36)}`;

export function emptyItem(partial: Partial<DraftItem> = {}): DraftItem {
  return {
    key: newKey(),
    name: '',
    quantity: '1',
    unit: 'serving',
    grams: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    fibre: '',
    sugar: '',
    sodium: '',
    source: 'manual',
    isEstimate: false,
    edited: false,
    ...partial,
  };
}

/** Parse a user-entered number; empty -> null; accepts comma decimals. */
export function num(s: string | number | null | undefined): number | null {
  if (s === null || s === undefined) return null;
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const fmt = (n: number | null | undefined): string => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  return String(Math.round(n * 10) / 10);
};

/**
 * Change an item's quantity and scale grams + all nutrients proportionally,
 * so "2 idli" -> "3 idli" multiplies everything by 1.5.
 */
export function setQuantity(item: DraftItem, quantityText: string): DraftItem {
  const current = num(item.quantity);
  const oldQ = current !== null && current > 0 ? current : (item.lastQty ?? null);
  const newQ = num(quantityText);
  const next: DraftItem = { ...item, quantity: quantityText, edited: true, lastQty: oldQ ?? undefined };
  if (!oldQ || newQ === null || newQ <= 0) return next;
  next.lastQty = newQ;
  const f = newQ / oldQ;
  const scale = (v: string) => {
    const n = num(v);
    return n === null ? v : fmt(n * f);
  };
  next.grams = scale(item.grams);
  for (const k of NUTRIENT_FIELDS) next[k] = scale(item[k]);
  return next;
}

export interface ItemErrors {
  name?: string;
  quantity?: string;
  calories?: string;
  [field: string]: string | undefined;
}

const LIMITS: Record<NutrientField | 'grams', number> = {
  calories: 5000,
  protein: 600,
  carbs: 1200,
  fat: 400,
  fibre: 150,
  sugar: 500,
  sodium: 20000,
  grams: 5000,
};

export function validateItem(item: DraftItem): ItemErrors {
  const e: ItemErrors = {};
  if (!item.name.trim()) e.name = 'Enter a food name';
  else if (item.name.trim().length > 200) e.name = 'Name is too long';
  const q = num(item.quantity);
  if (q === null || q <= 0) e.quantity = 'Enter an amount';
  else if (q > 10000) e.quantity = 'Amount is too large';
  if (num(item.calories) === null) e.calories = 'Enter calories';
  for (const k of [...NUTRIENT_FIELDS, 'grams'] as const) {
    const raw = k === 'grams' ? item.grams : item[k];
    if (!raw.trim()) continue;
    const n = num(raw);
    if (n === null) e[k] = 'Must be a number';
    else if (n < 0) e[k] = "Can't be negative";
    else if (n > LIMITS[k]) e[k] = `Max ${LIMITS[k]}`;
  }
  return e;
}

export const hasErrors = (e: ItemErrors) => Object.values(e).some(Boolean);

export interface Totals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}

export function draftTotals(items: DraftItem[]): Totals {
  const t: Totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };
  for (const i of items) {
    t.calories += num(i.calories) ?? 0;
    t.protein += num(i.protein) ?? 0;
    t.carbs += num(i.carbs) ?? 0;
    t.fat += num(i.fat) ?? 0;
    t.fibre += num(i.fibre) ?? 0;
  }
  for (const k of Object.keys(t) as (keyof Totals)[]) t[k] = Math.round(t[k] * 10) / 10;
  return t;
}

/** Payload for save_meal / update_meal RPCs (matches meal_items columns). */
export function toItemPayload(item: DraftItem) {
  const other: Record<string, number> = {};
  const sugar = num(item.sugar);
  const sodium = num(item.sodium);
  if (sugar !== null) other.sugar_g = sugar;
  if (sodium !== null) other.sodium_mg = sodium;
  const unit = item.unit.trim() || 'serving';
  const qty = num(item.quantity) ?? 1;
  let grams = num(item.grams);
  if (grams === null && unit === 'g') grams = qty;
  return {
    name: item.name.trim(),
    local_name: item.localName ?? null,
    cuisine_region: item.cuisineRegion ?? null,
    portion_grams: grams,
    portion_description: item.portionDescription ?? null,
    serving_quantity: qty,
    serving_unit: unit,
    food_source: item.source,
    barcode: item.barcode ?? null,
    calories_kcal: num(item.calories) ?? 0,
    protein_g: num(item.protein) ?? 0,
    carbohydrates_g: num(item.carbs) ?? 0,
    fat_g: num(item.fat) ?? 0,
    fibre_g: num(item.fibre) ?? 0,
    other_nutrients: other,
    ai_confidence: item.confidence ?? null,
    ai_original: item.aiOriginal ?? null,
    user_edited: item.edited,
  };
}

export type ItemPayload = ReturnType<typeof toItemPayload>;

/** Build a draft from a saved row (meal_items row, my_foods row or saved-meal payload). */
export function draftFromRow(
  row: {
    name: string;
    serving_quantity?: number | null;
    serving_unit?: string | null;
    portion_grams?: number | null;
    portion_description?: string | null;
    local_name?: string | null;
    cuisine_region?: string | null;
    calories_kcal: number;
    protein_g: number;
    carbohydrates_g: number;
    fat_g: number;
    fibre_g: number;
    other_nutrients?: unknown;
    barcode?: string | null;
    ai_confidence?: number | null;
    ai_original?: unknown;
    food_source?: string | null;
    user_edited?: boolean;
  },
  source?: FoodSource,
): DraftItem {
  const other = (row.other_nutrients && typeof row.other_nutrients === 'object' ? row.other_nutrients : {}) as Record<string, unknown>;
  const origSource = (row.food_source ?? 'manual') as FoodSource;
  return emptyItem({
    name: row.name,
    quantity: fmt(Number(row.serving_quantity ?? 1)) || '1',
    unit: row.serving_unit ?? (row.portion_grams ? 'g' : 'serving'),
    grams: fmt(row.portion_grams === null || row.portion_grams === undefined ? null : Number(row.portion_grams)),
    calories: fmt(Number(row.calories_kcal)),
    protein: fmt(Number(row.protein_g)),
    carbs: fmt(Number(row.carbohydrates_g)),
    fat: fmt(Number(row.fat_g)),
    fibre: fmt(Number(row.fibre_g)),
    sugar: fmt(typeof other.sugar_g === 'number' ? other.sugar_g : null),
    sodium: fmt(typeof other.sodium_mg === 'number' ? other.sodium_mg : null),
    source: source ?? origSource,
    barcode: row.barcode ?? null,
    localName: row.local_name ?? null,
    cuisineRegion: row.cuisine_region ?? null,
    portionDescription: row.portion_description ?? null,
    confidence: row.ai_confidence ?? null,
    aiOriginal: row.ai_original ?? undefined,
    isEstimate: origSource === 'ai_image',
    edited: row.user_edited ?? false,
  });
}

/** Shape of one item returned by the analyze-food-image Edge Function. */
export interface AiFoodItem {
  name: string;
  local_name: string | null;
  cuisine_region: string | null;
  portion_grams: number;
  portion_description: string | null;
  confidence: number;
  is_uncertain: boolean;
  alternatives: string[];
  cooking_assumptions: string | null;
  nutrients: Record<string, number | null>;
  warnings: string[];
}

export function draftFromAi(ai: AiFoodItem): DraftItem {
  const n = ai.nutrients;
  return emptyItem({
    name: ai.name,
    quantity: fmt(ai.portion_grams) || '1',
    unit: ai.portion_grams ? 'g' : 'serving',
    grams: fmt(ai.portion_grams),
    calories: fmt(n.calories_kcal),
    protein: fmt(n.protein_g),
    carbs: fmt(n.carbohydrates_g),
    fat: fmt(n.fat_g),
    fibre: fmt(n.fibre_g),
    sugar: fmt(n.sugar_g),
    sodium: fmt(n.sodium_mg),
    source: 'ai_image',
    localName: ai.local_name,
    cuisineRegion: ai.cuisine_region,
    portionDescription: ai.portion_description,
    confidence: ai.confidence,
    alternatives: ai.alternatives,
    warnings: [...ai.warnings, ...(ai.cooking_assumptions ? [`Assumed: ${ai.cooking_assumptions}`] : [])],
    isEstimate: true,
    aiOriginal: ai,
  });
}
