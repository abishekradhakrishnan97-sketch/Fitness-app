// Open Food Facts (https://world.openfoodfacts.org) — free, community-maintained packaged
// food database. No API key. Values come from product labels entered by contributors.

import { emptyItem, type DraftItem } from './mealDraft.ts';

export interface OffNutrients {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fibre: number | null;
  sugar: number | null;
  saturatedFat: number | null;
  /** milligrams */
  sodium: number | null;
}

export interface OffProduct {
  code: string;
  name: string;
  brand: string | null;
  packageQuantity: string | null;
  servingSize: string | null;
  /** grams (or ml) in one labelled serving, if known */
  servingGrams: number | null;
  per100g: OffNutrients;
  imageUrl: string | null;
  /** True when at least calories + one macro are present per 100 g. */
  hasNutrition: boolean;
}

const FIELDS = 'code,product_name,product_name_en,generic_name,brands,quantity,serving_size,serving_quantity,nutriments,image_front_small_url';
const BASE = 'https://world.openfoodfacts.org';

export const isValidBarcode = (s: string) => /^[0-9]{6,14}$/.test(s.trim());

const n = (v: unknown): number | null => {
  const x = typeof v === 'string' ? Number(v) : v;
  return typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null;
};

export function parseProduct(raw: unknown): OffProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const nm = (p.nutriments ?? {}) as Record<string, unknown>;
  const name = String(p.product_name || p.product_name_en || p.generic_name || '').trim();
  const code = String(p.code ?? '').trim();
  if (!code) return null;

  let calories = n(nm['energy-kcal_100g']);
  if (calories === null) {
    const kj = n(nm['energy-kj_100g']) ?? n(nm['energy_100g']);
    if (kj !== null) calories = Math.round((kj / 4.184) * 10) / 10;
  }
  const sodiumG = n(nm['sodium_100g']);
  const saltG = n(nm['salt_100g']);
  const sodiumMg = sodiumG !== null ? sodiumG * 1000 : saltG !== null ? (saltG / 2.5) * 1000 : null;

  const per100g: OffNutrients = {
    calories,
    protein: n(nm['proteins_100g']),
    carbs: n(nm['carbohydrates_100g']),
    fat: n(nm['fat_100g']),
    fibre: n(nm['fiber_100g']),
    sugar: n(nm['sugars_100g']),
    saturatedFat: n(nm['saturated-fat_100g']),
    sodium: sodiumMg === null ? null : Math.round(sodiumMg),
  };
  const brand = typeof p.brands === 'string' ? p.brands.split(',')[0].trim() || null : Array.isArray(p.brands) ? String(p.brands[0] ?? '') || null : null;

  return {
    code,
    name: name || (brand ? `${brand} product` : `Product ${code}`),
    brand,
    packageQuantity: typeof p.quantity === 'string' ? p.quantity : null,
    servingSize: typeof p.serving_size === 'string' ? p.serving_size : null,
    servingGrams: n(p.serving_quantity),
    per100g,
    imageUrl: typeof p.image_front_small_url === 'string' ? p.image_front_small_url : null,
    hasNutrition: calories !== null && (per100g.protein !== null || per100g.carbs !== null || per100g.fat !== null),
  };
}

/** Nutrition for an amount in grams, from per-100 g label values. */
export function nutritionFor(p: OffProduct, grams: number): OffNutrients {
  const f = grams / 100;
  const s = (v: number | null, digits = 1) => (v === null ? null : Math.round(v * f * 10 ** digits) / 10 ** digits);
  return {
    calories: s(p.per100g.calories, 0),
    protein: s(p.per100g.protein),
    carbs: s(p.per100g.carbs),
    fat: s(p.per100g.fat),
    fibre: s(p.per100g.fibre),
    sugar: s(p.per100g.sugar),
    saturatedFat: s(p.per100g.saturatedFat),
    sodium: s(p.per100g.sodium, 0),
  };
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function draftFromProduct(p: OffProduct, grams: number): DraftItem {
  const v = nutritionFor(p, grams);
  const str = (x: number | null) => (x === null ? '' : String(x));
  return emptyItem({
    name: p.brand && !squash(p.name).includes(squash(p.brand)) ? `${p.name} (${p.brand})` : p.name,
    quantity: String(grams),
    unit: 'g',
    grams: String(grams),
    calories: str(v.calories),
    protein: str(v.protein),
    carbs: str(v.carbs),
    fat: str(v.fat),
    fibre: str(v.fibre),
    sugar: str(v.sugar),
    sodium: str(v.sodium),
    source: 'barcode',
    barcode: isValidBarcode(p.code) ? p.code : null,
    portionDescription: p.servingSize ? `Label serving: ${p.servingSize}` : null,
    isEstimate: false,
  });
}

export class OffError extends Error {
  kind: 'not_found' | 'network' | 'invalid';
  constructor(kind: 'not_found' | 'network' | 'invalid', message: string) {
    super(message);
    this.kind = kind;
  }
}

async function getJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (res.status === 404) return null;
    if (!res.ok) throw new OffError('network', 'The product database is unavailable right now. Try again shortly.');
    return await res.json();
  } catch (e) {
    if (e instanceof OffError) throw e;
    throw new OffError('network', "Couldn't reach the product database. Check your connection.");
  } finally {
    clearTimeout(t);
  }
}

export async function lookupBarcode(code: string): Promise<OffProduct> {
  const c = code.trim();
  if (!isValidBarcode(c)) throw new OffError('invalid', 'Barcodes are 6–14 digits.');
  const data = (await getJson(`${BASE}/api/v2/product/${c}.json?fields=${FIELDS}`)) as { status?: number; product?: unknown } | null;
  const product = data?.status === 1 ? parseProduct({ code: c, ...(data.product as object) }) : null;
  if (!product) throw new OffError('not_found', 'This product isn\'t in the Open Food Facts database yet.');
  return product;
}

export async function searchProducts(query: string): Promise<OffProduct[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&json=1&page_size=20&fields=${FIELDS}`;
  const data = (await getJson(url)) as { products?: unknown[] } | null;
  return (data?.products ?? []).map(parseProduct).filter((p): p is OffProduct => !!p);
}
