// Nutrition target and goal-safety calculations. Pure functions: shared by web,
// native and tests. Values are general guidance, not medical advice.

export type Sex = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type GoalType = 'weight_loss' | 'muscle_gain' | 'recomposition' | 'general_fitness' | 'maintenance';

export interface TargetInput {
  weightKg: number;
  heightCm?: number | null;
  age?: number | null;
  sex?: Sex | null;
  activityLevel?: ActivityLevel | null;
  goalType?: GoalType | null;
  /** Desired weekly change in kg: negative = loss, positive = gain. */
  weeklyRateKg?: number | null;
}

export interface NutritionTargets {
  caloriesKcal: number;
  proteinG: number;
  carbohydratesG: number;
  fatG: number;
  fibreG: number;
  waterMl: number;
  bmrKcal: number;
  maintenanceKcal: number;
  notes: string[];
}

export const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const KCAL_PER_KG = 7700;
const round = (n: number, step = 1) => Math.round(n / step) * step;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function ageFromBirthYear(birthYear: number | null | undefined, now = new Date()): number | null {
  if (!birthYear) return null;
  const age = now.getFullYear() - birthYear;
  return age >= 13 && age <= 120 ? age : null;
}

/** Mifflin-St Jeor. Unknown sex uses the midpoint of the male/female constants. */
export function bmr(weightKg: number, heightCm: number, age: number, sex?: Sex | null): number {
  const s = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + s;
}

export function calculateTargets(input: TargetInput): NutritionTargets {
  const notes: string[] = [];
  const weight = input.weightKg;
  if (!(weight >= 20 && weight <= 400)) throw new RangeError('weightKg must be between 20 and 400');

  let height = input.heightCm ?? null;
  let age = input.age ?? null;
  if (!height) {
    height = input.sex === 'male' ? 172 : input.sex === 'female' ? 158 : 165;
    notes.push('Add your height for a more accurate target.');
  }
  if (!age) {
    age = 30;
    notes.push('Add your age for a more accurate target.');
  }
  const activity = input.activityLevel ?? 'light';
  if (!input.activityLevel) notes.push('Assumed a lightly active lifestyle.');

  const base = bmr(weight, height, age, input.sex);
  const maintenance = base * ACTIVITY_MULTIPLIER[activity];
  const goal = input.goalType ?? 'maintenance';

  let calories = maintenance;
  if (goal === 'weight_loss') {
    const rate = Math.abs(input.weeklyRateKg ?? 0.5);
    const deficit = Math.min((rate * KCAL_PER_KG) / 7, maintenance * 0.25, 1000);
    calories = maintenance - deficit;
  } else if (goal === 'muscle_gain') {
    calories = maintenance + Math.min(maintenance * 0.1, 350);
  } else if (goal === 'recomposition') {
    calories = maintenance - maintenance * 0.1;
  }

  const floor = input.sex === 'male' ? 1500 : input.sex === 'female' ? 1200 : 1350;
  if (calories < floor) {
    calories = floor;
    notes.push(`Calories were raised to a safe minimum of ${floor} kcal.`);
  }
  calories = round(calories, 10);

  // Protein per kg; for higher BMI use a reference weight at BMI 25.
  const bmi = weight / (height / 100) ** 2;
  const proteinWeight = bmi > 30 ? 25 * (height / 100) ** 2 : weight;
  const perKg = goal === 'recomposition' ? 2.0 : goal === 'weight_loss' || goal === 'muscle_gain' ? 1.8 : 1.4;
  const proteinG = round(clamp(proteinWeight * perKg, 50, 250));

  const fatG = round(Math.max((calories * 0.27) / 9, weight * 0.6));
  const carbohydratesG = round(Math.max((calories - proteinG * 4 - fatG * 9) / 4, 50));
  const fibreG = round(clamp((calories / 1000) * 14, 25, 45));
  const waterMl = round(clamp(weight * 35, 1500, 4500), 250);

  return {
    caloriesKcal: calories,
    proteinG,
    carbohydratesG,
    fatG,
    fibreG,
    waterMl,
    bmrKcal: round(base),
    maintenanceKcal: round(maintenance, 10),
    notes,
  };
}

// ---------------------------------------------------------------------------
// Goal safety
// ---------------------------------------------------------------------------

export type GoalSafety = 'ok' | 'aggressive' | 'unsafe';

export interface GoalAssessment {
  level: GoalSafety;
  weeklyChangeKg: number;
  weeks: number;
  message: string;
  /** A safer target date (ISO yyyy-mm-dd) when the requested one is too aggressive. */
  suggestedDate?: string;
  suggestedWeeklyRateKg?: number;
}

const DAY_MS = 86_400_000;

export function assessGoal(
  currentKg: number,
  targetKg: number,
  targetDate: Date,
  today = new Date(),
): GoalAssessment {
  const diff = targetKg - currentKg;
  const days = Math.max(1, Math.round((targetDate.getTime() - today.getTime()) / DAY_MS));
  const weeks = days / 7;
  const weekly = diff / weeks;
  const pct = Math.abs(weekly) / currentKg;
  const fmt = (n: number) => Math.round(n * 100) / 100;

  if (Math.abs(diff) < 0.5) {
    return { level: 'ok', weeklyChangeKg: 0, weeks, message: 'Your target is close to your current weight.' };
  }

  const losing = diff < 0;
  // Losing: <=0.75%/wk comfortable, <=1%/wk aggressive, above unsafe.
  // Gaining: <=0.5 kg/wk comfortable, <=0.75 aggressive, above unsafe (mostly fat gain).
  const level: GoalSafety = losing
    ? pct <= 0.0075 ? 'ok' : pct <= 0.01 ? 'aggressive' : 'unsafe'
    : weekly <= 0.5 ? 'ok' : weekly <= 0.75 ? 'aggressive' : 'unsafe';

  if (level === 'ok') {
    return {
      level,
      weeklyChangeKg: fmt(weekly),
      weeks,
      message: `That's about ${fmt(Math.abs(weekly))} kg per week — a realistic, sustainable pace.`,
    };
  }

  const safeRate = losing ? Math.min(currentKg * 0.0075, 0.75) : 0.35;
  const safeWeeks = Math.ceil(Math.abs(diff) / safeRate);
  const suggested = new Date(today.getTime() + safeWeeks * 7 * DAY_MS).toISOString().slice(0, 10);
  const verb = losing ? 'losing' : 'gaining';

  return {
    level,
    weeklyChangeKg: fmt(weekly),
    weeks,
    suggestedDate: suggested,
    suggestedWeeklyRateKg: fmt(losing ? -safeRate : safeRate),
    message: level === 'unsafe'
      ? `This means ${verb} about ${fmt(Math.abs(weekly))} kg every week, which is faster than is safe or sustainable` +
        `${losing ? ' and risks muscle loss, fatigue and rebound weight gain' : ' and would mostly add fat, not muscle'}. ` +
        `A safer pace of about ${fmt(safeRate)} kg per week would reach your goal around ${suggested}.`
      : `This means ${verb} about ${fmt(Math.abs(weekly))} kg per week. It's possible but demanding; ` +
        `about ${fmt(safeRate)} kg per week (reaching your goal around ${suggested}) is easier to sustain.`,
  };
}
