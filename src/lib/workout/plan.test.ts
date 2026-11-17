/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePlan } from './plan.ts';
import { healthGuidance } from './health.ts';
import { EXERCISES } from './exercises.ts';
import { draftFromSearch, portionFor, unitsFor, type FoodSearchItem } from '../nutrition/foodSearch.ts';

test('5 days × 45 min gym plan fits the time and uses a 5-day split', () => {
  const p = generatePlan({ daysPerWeek: 5, minutes: 45, experience: 'intermediate', environment: 'gym', goal: 'weight_loss' });
  assert.equal(p.days.length, 5);
  assert.deepEqual(p.days.map((d) => d.title), ['Push', 'Pull', 'Legs', 'Upper body', 'Lower body']);
  for (const d of p.days) {
    assert.ok(d.exercises.length >= 3, d.title);
    assert.ok(d.estMinutes <= 45, `${d.title} ${d.estMinutes}`);
    assert.ok(d.cardio, 'weight loss gets a cardio finisher');
    assert.equal(new Set(d.exercises.map((e) => e.exercise.id)).size, d.exercises.length, 'no duplicates');
  }
});

test('home plans never use gym-only equipment', () => {
  const p = generatePlan({ daysPerWeek: 3, minutes: 30, experience: 'beginner', environment: 'home', goal: 'general_fitness' });
  assert.equal(p.splitName, 'Full body ×3');
  for (const d of p.days) for (const e of d.exercises) assert.notEqual(e.exercise.where, 'gym', e.exercise.name);
});

test('knee and back pain swap out loaded exercises', () => {
  const p = generatePlan({ daysPerWeek: 4, minutes: 60, environment: 'gym', goal: 'muscle_gain', conditions: ['knee_pain', 'back_pain'] });
  for (const d of p.days) {
    for (const e of d.exercises) {
      assert.ok(!e.exercise.tags.includes('knee_load'), e.exercise.name);
      assert.ok(!e.exercise.tags.includes('spine_load'), e.exercise.name);
    }
    assert.ok(d.exercises.length >= 3);
  }
});

test('insulin with diabetes produces low-blood-sugar safety guidance', () => {
  const g = healthGuidance(['type2_diabetes'], ['insulin']);
  assert.equal(g.hypoRisk, true);
  assert.ok(g.workout.some((w) => /90 mg\/dL/.test(w)));
  assert.ok(g.food.some((f) => /doctor/.test(f)));
  assert.equal(healthGuidance(['type2_diabetes'], ['other_diabetes_meds']).hypoRisk, false);
  assert.deepEqual(healthGuidance([], []).workout, []);
});

test('heart condition and pregnancy require clearance and moderate intensity', () => {
  const p = generatePlan({ daysPerWeek: 3, minutes: 45, goal: 'muscle_gain', conditions: ['heart_condition'] });
  assert.equal(p.health.needsClearance, true);
  assert.ok(p.days[0].exercises.every((e) => e.reps === '10–15' || e.reps.endsWith('s')));
  const preg = generatePlan({ daysPerWeek: 3, minutes: 45, conditions: ['pregnancy'] });
  for (const d of preg.days) for (const e of d.exercises) assert.ok(!e.exercise.tags.includes('supine') && !e.exercise.tags.includes('prone'), e.exercise.name);
});

test('inputs are clamped and every exercise has cues', () => {
  const p = generatePlan({ daysPerWeek: 9, minutes: 5 });
  assert.equal(p.days.length, 6);
  assert.ok(p.days[0].exercises.length >= 3);
  for (const e of EXERCISES) assert.ok(e.cues.length >= 2, e.id);
});

const biryani: FoodSearchItem = {
  name: 'Chicken biryani', local_name: null, category: 'Rice dish', confidence: 0.8,
  per_100g: { calories_kcal: 165, protein_g: 8.2, carbohydrates_g: 20.5, fat_g: 5.4, fibre_g: 0.9, sugar_g: null, sodium_mg: 310 },
  default_unit: 'plate', default_quantity: 1,
  units: [{ unit: 'Plate', grams: 350 }, { unit: 'cup', grams: 200 }, { unit: 'g', grams: 1 }],
};

test('food search portions scale by unit weight', () => {
  assert.deepEqual(unitsFor(biryani).map((u) => u.unit), ['plate', 'cup', 'g']);
  const plate = portionFor(biryani, 1, 'plate');
  assert.equal(plate.grams, 350);
  assert.equal(plate.calories, 578);
  assert.equal(plate.protein, 28.7);
  assert.equal(plate.sugar, null);
  assert.equal(portionFor(biryani, 1.5, 'cup').grams, 300);
  assert.equal(portionFor(biryani, 250, 'g').calories, 413);
});

test('search result becomes an estimate draft', () => {
  const d = draftFromSearch(biryani, 2, 'cup');
  assert.equal(d.source, 'ai_search');
  assert.equal(d.isEstimate, true);
  assert.equal(d.grams, '400');
  assert.equal(d.calories, '660');
});
