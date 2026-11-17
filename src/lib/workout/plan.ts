// Deterministic weekly workout plan generator (works offline, unit-tested).
// Inputs: days per week, minutes per session, experience, where you train, goal, health profile.

import { EXERCISES, type Exercise, type Role } from './exercises.ts';
import { healthGuidance, type HealthGuidance } from './health.ts';

export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type GoalType = 'weight_loss' | 'muscle_gain' | 'recomposition' | 'general_fitness' | 'maintenance';

export interface PlanInput {
  daysPerWeek: number;
  minutes: number;
  experience?: Experience | null;
  environment?: 'home' | 'gym' | 'outdoor' | 'mixed' | null;
  goal?: GoalType | null;
  conditions?: readonly string[];
  meds?: readonly string[];
}

export interface PlannedExercise {
  exercise: Exercise;
  sets: number;
  reps: string;
  restSec: number;
}

export interface PlanDay {
  key: string;
  title: string;
  focus: string;
  warmup: string;
  exercises: PlannedExercise[];
  /** Cardio finisher, if time allows. */
  cardio: string | null;
  estMinutes: number;
}

export interface WorkoutPlan {
  splitName: string;
  summary: string;
  days: PlanDay[];
  /** Suggested activity on non-gym days. */
  restDays: string;
  health: HealthGuidance;
  daysPerWeek: number;
  minutes: number;
}

interface Template { key: string; title: string; focus: string; roles: Role[] }

const T: Record<string, Template> = {
  fullA: { key: 'fullA', title: 'Full body A', focus: 'Squat · push · pull', roles: ['squat', 'push_h', 'pull_h', 'hinge', 'core', 'shoulder', 'biceps'] },
  fullB: { key: 'fullB', title: 'Full body B', focus: 'Hinge · press · pull', roles: ['hinge', 'push_v', 'pull_v', 'lunge', 'core', 'triceps', 'calf'] },
  fullC: { key: 'fullC', title: 'Full body C', focus: 'Legs · chest · back', roles: ['lunge', 'push_h', 'pull_v', 'glute', 'shoulder', 'core', 'biceps'] },
  push: { key: 'push', title: 'Push', focus: 'Chest · shoulders · triceps', roles: ['push_h', 'push_v', 'push_h', 'shoulder', 'triceps', 'core'] },
  pull: { key: 'pull', title: 'Pull', focus: 'Back · biceps', roles: ['pull_v', 'pull_h', 'pull_h', 'biceps', 'core', 'shoulder'] },
  legs: { key: 'legs', title: 'Legs', focus: 'Quads · hamstrings · glutes', roles: ['squat', 'hinge', 'lunge', 'squat', 'calf', 'core'] },
  upper: { key: 'upper', title: 'Upper body', focus: 'Chest · back · arms', roles: ['push_h', 'pull_h', 'push_v', 'pull_v', 'biceps', 'triceps'] },
  lower: { key: 'lower', title: 'Lower body', focus: 'Legs · glutes · core', roles: ['squat', 'hinge', 'lunge', 'glute', 'calf', 'core'] },
};

function splitFor(days: number, exp: Experience): { name: string; days: Template[] } {
  if (days <= 2) return { name: 'Full body ×2', days: [T.fullA, T.fullB] };
  if (days === 3) {
    return exp === 'beginner'
      ? { name: 'Full body ×3', days: [T.fullA, T.fullB, T.fullC] }
      : { name: 'Push / Pull / Legs', days: [T.push, T.pull, T.legs] };
  }
  if (days === 4) return { name: 'Upper / Lower ×2', days: [T.upper, T.lower, T.upper, T.lower] };
  if (days === 5) return { name: 'Push / Pull / Legs + Upper / Lower', days: [T.push, T.pull, T.legs, T.upper, T.lower] };
  return { name: 'Push / Pull / Legs ×2', days: [T.push, T.pull, T.legs, T.push, T.pull, T.legs] };
}

function pick(role: Role, gym: boolean, exclude: readonly string[], used: Set<string>): Exercise | null {
  const ok = (e: Exercise, strict: boolean) =>
    e.role === role &&
    !used.has(e.id) &&
    (gym ? e.where !== 'home' : e.where !== 'gym') &&
    (!strict || !e.tags.some((t) => exclude.includes(t)));
  // Glute role falls back to hinge options and vice versa.
  const alt: Role | null = role === 'glute' ? 'hinge' : role === 'hinge' ? 'glute' : role === 'lunge' ? 'squat' : null;
  return (
    EXERCISES.find((e) => ok(e, true)) ??
    (alt ? EXERCISES.find((e) => e.role === alt && !used.has(e.id) && (gym ? e.where !== 'home' : e.where !== 'gym') && !e.tags.some((t) => exclude.includes(t))) : undefined) ??
    null
  );
}

const WEEKDAYS: Record<number, string[]> = {
  2: ['Mon', 'Thu'],
  3: ['Mon', 'Wed', 'Fri'],
  4: ['Mon', 'Tue', 'Thu', 'Fri'],
  5: ['Mon', 'Tue', 'Wed', 'Fri', 'Sat'],
  6: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};
export const suggestedWeekdays = (days: number) => WEEKDAYS[Math.min(6, Math.max(2, days))];

export function generatePlan(input: PlanInput): WorkoutPlan {
  const days = Math.min(6, Math.max(2, Math.round(input.daysPerWeek || 3)));
  const minutes = Math.min(120, Math.max(20, Math.round(input.minutes || 45)));
  const exp: Experience = input.experience ?? 'beginner';
  const goal: GoalType = input.goal ?? 'general_fitness';
  const gym = input.environment === 'gym' || input.environment === 'mixed' || !input.environment;
  const health = healthGuidance(input.conditions ?? [], input.meds ?? []);
  const split = splitFor(days, exp);

  const fatLoss = goal === 'weight_loss' || goal === 'recomposition';
  const warmupMin = 5;
  const cardioMin = fatLoss && minutes >= 40 ? (minutes >= 60 ? 12 : 8) : 0;
  const sets = exp === 'beginner' || health.moderateOnly ? (minutes < 35 ? 2 : 3) : goal === 'muscle_gain' && minutes >= 60 ? 4 : 3;
  const rest = health.moderateOnly ? 90 : goal === 'muscle_gain' ? 90 : fatLoss ? 60 : 75;
  // Time per exercise: sets × (≈40 s work + rest) + ~1 min setup.
  const perExercise = (sets * (40 + rest)) / 60 + 1;
  const count = Math.min(8, Math.max(3, Math.floor((minutes - warmupMin - cardioMin) / perExercise)));

  const repsFor = (e: Exercise): string => {
    if (e.pattern === 'plank') return exp === 'beginner' ? '20–30 s' : '30–45 s';
    if (health.moderateOnly) return '10–15';
    if (goal === 'muscle_gain') return e.compound ? '6–10' : '10–15';
    if (fatLoss) return e.compound ? '10–12' : '12–15';
    return e.compound ? '8–12' : '12–15';
  };

  const planDays: PlanDay[] = split.days.map((t, i) => {
    const used = new Set<string>();
    const exercises: PlannedExercise[] = [];
    for (const role of t.roles) {
      if (exercises.length >= count) break;
      const e = pick(role, gym, health.excludeTags, used);
      if (!e) continue;
      used.add(e.id);
      exercises.push({ exercise: e, sets: e.compound ? sets : Math.max(2, sets - (sets > 3 ? 1 : 0)), reps: repsFor(e), restSec: e.compound ? rest : Math.max(45, rest - 15) });
    }
    return {
      key: `${t.key}-${i}`,
      title: t.title,
      focus: t.focus,
      warmup: `${warmupMin} min easy walk or cycle, then one light set of the first exercise`,
      exercises,
      cardio: cardioMin
        ? `${cardioMin} min brisk incline walk or cycling at a pace where you can still talk`
        : null,
      estMinutes: Math.round(warmupMin + cardioMin + exercises.length * perExercise),
    };
  });

  const goalLine: Record<GoalType, string> = {
    weight_loss: 'Lifting keeps your muscle while you lose fat; the calorie deficit comes mostly from food.',
    recomposition: 'Train hard with enough protein to lose fat and gain muscle slowly.',
    muscle_gain: 'Add a little weight or one more rep each week (progressive overload).',
    general_fitness: 'A balanced routine for strength, stamina and joints.',
    maintenance: 'Enough training to keep strength and fitness steady.',
  };

  return {
    splitName: split.name,
    summary: `${days} days × ${minutes} min · ${gym ? 'gym' : 'home'} · ${exp}. ${goalLine[goal]}`,
    days: planDays,
    restDays: fatLoss
      ? 'On other days: 30–45 min brisk walk (aim for 8,000–10,000 steps a day) and one full rest day.'
      : 'On other days: an easy walk or stretching, and at least one full rest day.',
    health,
    daysPerWeek: days,
    minutes,
  };
}
