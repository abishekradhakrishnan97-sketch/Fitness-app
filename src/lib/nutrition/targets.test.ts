/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageFromBirthYear, assessGoal, bmr, calculateTargets } from './targets.ts';
import { addDays, categoriseMeal, localParts } from '../time/mealCategory.ts';

test('Mifflin-St Jeor BMR', () => {
  assert.equal(bmr(70, 175, 30, 'male'), 1648.75);
  assert.equal(bmr(60, 160, 30, 'female'), 1289);
});

test('weight-loss targets are consistent and above safe floor', () => {
  const t = calculateTargets({
    weightKg: 80, heightCm: 175, age: 30, sex: 'male', activityLevel: 'moderate', goalType: 'weight_loss', weeklyRateKg: -0.5,
  });
  assert.ok(t.caloriesKcal < t.maintenanceKcal);
  assert.ok(t.caloriesKcal >= 1500);
  assert.equal(t.proteinG, 144);
  const kcalFromMacros = t.proteinG * 4 + t.carbohydratesG * 4 + t.fatG * 9;
  assert.ok(Math.abs(kcalFromMacros - t.caloriesKcal) < 40, `${kcalFromMacros} vs ${t.caloriesKcal}`);
  assert.deepEqual(t.notes, []);
});

test('extreme deficit is capped and floored', () => {
  const t = calculateTargets({ weightKg: 50, heightCm: 150, age: 60, sex: 'female', activityLevel: 'sedentary', goalType: 'weight_loss', weeklyRateKg: -1.5 });
  assert.equal(t.caloriesKcal, 1200);
  assert.ok(t.notes.some((n) => n.includes('safe minimum')));
});

test('missing optional info still yields targets with notes', () => {
  const t = calculateTargets({ weightKg: 70 });
  assert.ok(t.caloriesKcal > 1500);
  assert.equal(t.notes.length, 3);
});

test('muscle gain adds a modest surplus', () => {
  const t = calculateTargets({ weightKg: 70, heightCm: 175, age: 25, sex: 'male', activityLevel: 'active', goalType: 'muscle_gain' });
  assert.ok(t.caloriesKcal > t.maintenanceKcal && t.caloriesKcal - t.maintenanceKcal <= 360);
});

test('rejects impossible weight', () => {
  assert.throws(() => calculateTargets({ weightKg: 5 }), RangeError);
});

test('age from birth year', () => {
  assert.equal(ageFromBirthYear(1996, new Date('2026-11-17')), 30);
  assert.equal(ageFromBirthYear(2020, new Date('2026-11-17')), null);
});

test('10 kg in 2 months is flagged unsafe with a safer alternative', () => {
  const today = new Date('2026-11-17T00:00:00Z');
  const a = assessGoal(80, 70, new Date('2027-01-17T00:00:00Z'), today);
  assert.equal(a.level, 'unsafe');
  assert.ok(a.suggestedDate && a.suggestedDate > '2027-01-17');
  assert.match(a.message, /safer pace/);
});

test('0.5 kg/week loss is ok', () => {
  const today = new Date('2026-11-17T00:00:00Z');
  const a = assessGoal(80, 75, new Date(today.getTime() + 10 * 7 * 86_400_000), today);
  assert.equal(a.level, 'ok');
});

test('fast gain is flagged', () => {
  const today = new Date('2026-11-17T00:00:00Z');
  const a = assessGoal(60, 70, new Date(today.getTime() + 8 * 7 * 86_400_000), today);
  assert.equal(a.level, 'unsafe');
});

test('meal categorisation follows the time table', () => {
  assert.equal(categoriseMeal(7 * 60), 'breakfast');
  assert.equal(categoriseMeal(10 * 60, 1), 'snack');
  assert.equal(categoriseMeal(11 * 60 + 59), 'breakfast');
  assert.equal(categoriseMeal(12 * 60), 'lunch');
  assert.equal(categoriseMeal(15 * 60), 'lunch');
  assert.equal(categoriseMeal(15 * 60 + 1), 'snack');
  assert.equal(categoriseMeal(19 * 60 + 59), 'snack');
  assert.equal(categoriseMeal(20 * 60), 'dinner');
  assert.equal(categoriseMeal(23 * 60 + 59), 'dinner');
});

test('local date respects timezone', () => {
  const at = new Date('2026-11-17T20:00:00Z'); // 01:30 next day in India
  assert.deepEqual(localParts(at, 'Asia/Kolkata'), { localDate: '2026-11-18', minutes: 90, timeZone: 'Asia/Kolkata' });
  assert.equal(localParts(at, 'America/New_York').localDate, '2026-11-17');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});
