/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysOnTarget, lastNDays, loggingStreak, weightChange } from './stats.ts';

test('lastNDays fills gaps oldest-first ending today', () => {
  const d = lastNDays(new Map([['2026-11-17', 1800], ['2026-11-15', 2100]]), '2026-11-17', 7);
  assert.equal(d.length, 7);
  assert.equal(d[0].date, '2026-11-11');
  assert.equal(d[6].date, '2026-11-17');
  assert.equal(d[6].value, 1800);
  assert.equal(d[4].value, 2100);
  assert.equal(d[5].value, 0);
});

test('streak counts back from today, or from yesterday if today is empty', () => {
  const s = new Set(['2026-11-17', '2026-11-16', '2026-11-15', '2026-11-13']);
  assert.equal(loggingStreak(s, '2026-11-17'), 3);
  assert.equal(loggingStreak(new Set(['2026-11-16', '2026-11-15']), '2026-11-17'), 2);
  assert.equal(loggingStreak(new Set(['2026-11-14']), '2026-11-17'), 0);
  assert.equal(loggingStreak(new Set(['2026-12-31', '2027-01-01']), '2027-01-01'), 2);
});

test('days on target uses ±10% and ignores empty days', () => {
  const r = daysOnTarget([{ value: 0 }, { value: 2000 }, { value: 2250 }, { value: 1500 }], 2100);
  assert.deepEqual(r, { onTarget: 2, logged: 3 });
});

test('weight change between first and last weigh-in', () => {
  assert.equal(weightChange([{ date: '2026-11-17', value: 97.4 }, { date: '2026-11-01', value: 99 }]), -1.6);
  assert.equal(weightChange([{ date: '2026-11-17', value: 97 }]), null);
});
