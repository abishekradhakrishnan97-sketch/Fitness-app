/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftFromProduct, isValidBarcode, nutritionFor, parseProduct } from './openFoodFacts.ts';
import { toItemPayload } from './mealDraft.ts';

// Shape taken from a real Open Food Facts response (Parle-G, 8901719100956).
const parleG = {
  code: '8901719100956',
  product_name: 'Parle G',
  brands: 'Parle-G',
  quantity: '80g',
  nutriments: {
    'carbohydrates_100g': 77.3,
    'energy-kcal_100g': 454,
    'fat_100g': 13,
    'proteins_100g': 7,
    'salt_100g': 0,
    'saturated-fat_100g': 6,
    'sodium_100g': 0,
    'sugars_100g': 25,
  },
};

test('parses an Open Food Facts product', () => {
  const p = parseProduct(parleG)!;
  assert.equal(p.name, 'Parle G');
  assert.equal(p.brand, 'Parle-G');
  assert.equal(p.per100g.calories, 454);
  assert.equal(p.per100g.fibre, null);
  assert.equal(p.per100g.sodium, 0);
  assert.equal(p.hasNutrition, true);
});

test('falls back to kJ and salt when kcal/sodium are missing', () => {
  const p = parseProduct({ code: '123456', product_name: 'X', nutriments: { 'energy-kj_100g': 418.4, 'salt_100g': 1.25, 'proteins_100g': 1 } })!;
  assert.equal(p.per100g.calories, 100);
  assert.equal(p.per100g.sodium, 500);
});

test('scales label values to the chosen amount', () => {
  const p = parseProduct(parleG)!;
  const v = nutritionFor(p, 30);
  assert.equal(v.calories, 136);
  assert.equal(v.protein, 2.1);
  assert.equal(v.carbs, 23.2);
});

test('creates a non-estimate barcode draft', () => {
  const d = draftFromProduct(parseProduct(parleG)!, 40);
  assert.equal(d.source, 'barcode');
  assert.equal(d.isEstimate, false);
  assert.equal(d.barcode, '8901719100956');
  assert.equal(d.name, 'Parle G');
  const payload = toItemPayload(d);
  assert.equal(payload.portion_grams, 40);
  assert.equal(payload.calories_kcal, 182);
});

test('barcode validation', () => {
  assert.ok(isValidBarcode('8901719100956'));
  assert.ok(!isValidBarcode('12a45'));
  assert.ok(!isValidBarcode('123'));
});

test('rejects garbage', () => {
  assert.equal(parseProduct(null), null);
  assert.equal(parseProduct({ product_name: 'no code' }), null);
});
