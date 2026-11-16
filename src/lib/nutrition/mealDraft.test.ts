/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  draftFromAi,
  draftFromRow,
  draftTotals,
  emptyItem,
  hasErrors,
  setQuantity,
  toItemPayload,
  validateItem,
} from './mealDraft.ts';

const idli = () =>
  emptyItem({ name: 'Idli', quantity: '2', unit: 'piece', grams: '80', calories: '116', protein: '3.8', carbs: '24', fat: '0.4', fibre: '1.2' });

test('quantity change scales grams and nutrients proportionally', () => {
  const i = setQuantity(idli(), '3');
  assert.equal(i.quantity, '3');
  assert.equal(i.grams, '120');
  assert.equal(i.calories, '174');
  assert.equal(i.protein, '5.7');
  assert.equal(i.carbs, '36');
  assert.equal(i.sugar, ''); // empty stays empty
  assert.equal(i.edited, true);
});

test('partial / invalid quantity input does not scale', () => {
  const i = setQuantity(idli(), '');
  assert.equal(i.calories, '116');
  const j = setQuantity(i, '4'); // cleared then retyped: scales from last valid qty (2)
  assert.equal(j.calories, '232');
  assert.equal(setQuantity(j, '0').calories, '232');
});

test('validation requires name, quantity and calories; rejects negatives', () => {
  const e = validateItem(emptyItem());
  assert.ok(e.name && e.calories);
  assert.ok(hasErrors(e));
  const ok = validateItem(idli());
  assert.equal(hasErrors(ok), false);
  const neg = validateItem({ ...idli(), fat: '-1', protein: 'abc' });
  assert.equal(neg.fat, "Can't be negative");
  assert.equal(neg.protein, 'Must be a number');
});

test('totals sum parsed values and ignore blanks', () => {
  const t = draftTotals([idli(), emptyItem({ name: 'Sambar', calories: '120', protein: '5', carbs: '', fat: '3,5' })]);
  assert.deepEqual(t, { calories: 236, protein: 8.8, carbs: 24, fat: 3.9, fibre: 1.2 });
});

test('payload maps to meal_items columns; grams inferred for g unit', () => {
  const p = toItemPayload(emptyItem({ name: ' Rice ', quantity: '150', unit: 'g', calories: '195', sugar: '0.1', sodium: '2' }));
  assert.equal(p.name, 'Rice');
  assert.equal(p.portion_grams, 150);
  assert.equal(p.serving_quantity, 150);
  assert.equal(p.calories_kcal, 195);
  assert.equal(p.protein_g, 0);
  assert.deepEqual(p.other_nutrients, { sugar_g: 0.1, sodium_mg: 2 });
  assert.equal(p.food_source, 'manual');
});

test('AI items become estimate drafts with confidence and assumptions', () => {
  const d = draftFromAi({
    name: 'Medu vada', local_name: 'Uzhunnu vada', cuisine_region: 'South Indian', portion_grams: 60,
    portion_description: '1 vada', confidence: 0.55, is_uncertain: true, alternatives: ['Dal vada'],
    cooking_assumptions: 'Deep fried', warnings: [],
    nutrients: { calories_kcal: 180, protein_g: 6, carbohydrates_g: 18, fat_g: 9.5, fibre_g: 2, sugar_g: null, sodium_mg: 300 },
  });
  assert.equal(d.isEstimate, true);
  assert.equal(d.source, 'ai_image');
  assert.equal(d.unit, 'g');
  assert.equal(d.quantity, '60');
  assert.equal(d.sugar, '');
  assert.equal(d.sodium, '300');
  assert.ok(d.warnings?.some((w) => w.includes('Deep fried')));
  assert.equal(toItemPayload(d).ai_confidence, 0.55);
});

test('round-trip: payload -> row -> draft preserves values', () => {
  const p = toItemPayload(idli());
  const d = draftFromRow({ ...p, food_source: 'manual' }, 'history');
  assert.equal(d.name, 'Idli');
  assert.equal(d.quantity, '2');
  assert.equal(d.unit, 'piece');
  assert.equal(d.calories, '116');
  assert.equal(d.source, 'history');
  assert.equal(d.isEstimate, false);
});
