// Health-aware guidance for the coach. General, widely published exercise and
// nutrition guidance (e.g. ADA / WHO style recommendations) — never a diagnosis
// or a replacement for the user's own care team.

import type { Tag } from './exercises.ts';

export type Condition =
  | 'type2_diabetes' | 'type1_diabetes' | 'prediabetes' | 'hypertension' | 'heart_condition'
  | 'asthma' | 'knee_pain' | 'back_pain' | 'pcos' | 'thyroid' | 'pregnancy';

export type MedFlag = 'insulin' | 'sulfonylurea' | 'other_diabetes_meds' | 'beta_blocker' | 'blood_pressure_meds';

export const CONDITION_LABEL: Record<Condition, string> = {
  type2_diabetes: 'Type 2 diabetes',
  type1_diabetes: 'Type 1 diabetes',
  prediabetes: 'Prediabetes',
  hypertension: 'High blood pressure',
  heart_condition: 'Heart condition',
  asthma: 'Asthma',
  knee_pain: 'Knee pain',
  back_pain: 'Lower-back pain',
  pcos: 'PCOS',
  thyroid: 'Thyroid condition',
  pregnancy: 'Pregnancy',
};

export const MED_LABEL: Record<MedFlag, string> = {
  insulin: 'Insulin',
  sulfonylurea: 'Sulfonylurea (e.g. glimepiride, gliclazide)',
  other_diabetes_meds: 'Other diabetes tablets (e.g. metformin)',
  beta_blocker: 'Beta blocker',
  blood_pressure_meds: 'Other blood-pressure medicine',
};

export interface HealthGuidance {
  /** Shown at the top of the workout plan. */
  workout: string[];
  /** Shown on the meal ideas page. */
  food: string[];
  /** Exercises with these tags are swapped for safer alternatives. */
  excludeTags: Tag[];
  /** Keep intensity moderate (no max-effort sets, longer rests). */
  moderateOnly: boolean;
  /** The user should get medical clearance before starting. */
  needsClearance: boolean;
  /** Medication can cause low blood sugar. */
  hypoRisk: boolean;
  hasDiabetes: boolean;
}

const has = <T,>(list: readonly string[], v: T & string) => list.includes(v);

export function healthGuidance(conditions: readonly string[], meds: readonly string[]): HealthGuidance {
  const g: HealthGuidance = {
    workout: [], food: [], excludeTags: [], moderateOnly: false, needsClearance: false, hypoRisk: false, hasDiabetes: false,
  };
  const diabetes = has(conditions, 'type2_diabetes') || has(conditions, 'type1_diabetes');
  const pre = has(conditions, 'prediabetes');
  g.hasDiabetes = diabetes;
  g.hypoRisk = diabetes && (has(meds, 'insulin') || has(meds, 'sulfonylurea'));

  if (diabetes || pre) {
    g.workout.push(
      'Exercise makes your body more sensitive to insulin. Aim for 150+ minutes of moderate activity a week, on at least 3 days, and avoid going more than 2 days in a row without moving.',
      'Strength training 2–3 times a week is especially helpful for blood-sugar control — this plan covers it.',
      'A 10–15 minute walk after meals helps lower the blood-sugar rise from that meal.',
    );
    g.food.push(
      'Build meals around vegetables, pulses, whole grains and protein; pair carbohydrates with protein or fibre to slow the blood-sugar rise.',
      'Keep carbohydrate portions steady from meal to meal and limit sugary drinks, sweets and refined flour (maida).',
    );
  }
  if (diabetes) {
    g.workout.push('Check your feet after training and wear well-fitting shoes; stay hydrated.');
  }
  if (g.hypoRisk) {
    g.workout.push(
      'Your medicine can cause low blood sugar during or for hours after exercise. Check your glucose before training: if it is below 5.0 mmol/L (90 mg/dL), have 15–30 g of carbohydrate first.',
      'Always carry fast-acting carbohydrate (glucose tablets, juice). Stop and treat it if you feel shaky, sweaty, dizzy or confused.',
      'Ask your doctor whether your dose should change on training days — do not adjust it yourself.',
    );
    g.food.push(
      'Because your medicine can cause low blood sugar, do not skip meals or cut carbohydrates or calories sharply without talking to your doctor — your dose may need adjusting.',
    );
  } else if (diabetes && has(meds, 'other_diabetes_meds')) {
    g.workout.push('Tablets like metformin on their own rarely cause low blood sugar with exercise, but tell your doctor about your new routine.');
  }
  if (has(conditions, 'type1_diabetes')) {
    g.workout.push('If your glucose is above 13.9 mmol/L (250 mg/dL) and you have ketones or feel unwell, skip hard exercise and follow your care team’s sick-day advice.');
  }
  if (has(conditions, 'hypertension') || has(meds, 'blood_pressure_meds')) {
    g.moderateOnly = true;
    g.workout.push('For blood pressure: breathe out as you lift and never hold your breath; avoid all-out maximum lifts; stand up slowly after floor exercises.');
    g.food.push('For blood pressure, go easy on salt, pickles, papad and packaged snacks.');
  }
  if (has(meds, 'beta_blocker')) {
    g.workout.push('Beta blockers lower your heart rate, so heart-rate targets are unreliable. Use the talk test instead: you should be able to speak in short sentences.');
  }
  if (has(conditions, 'heart_condition')) {
    g.moderateOnly = true;
    g.needsClearance = true;
    g.workout.push('With a heart condition, get your doctor’s clearance before starting. Stop immediately for chest pain, unusual breathlessness or dizziness.');
  }
  if (has(conditions, 'asthma')) {
    g.workout.push('Keep your reliever inhaler with you and take a longer, gentler warm-up.');
  }
  if (has(conditions, 'knee_pain')) {
    g.excludeTags.push('knee_load');
    g.workout.push('For your knees, deep squats and lunges are swapped for joint-friendly options. Work in a pain-free range.');
  }
  if (has(conditions, 'back_pain')) {
    g.excludeTags.push('spine_load');
    g.workout.push('For your back, heavy barbell loading is swapped for supported alternatives. Stop any exercise that causes sharp or radiating pain.');
  }
  if (has(conditions, 'pregnancy')) {
    g.moderateOnly = true;
    g.needsClearance = true;
    g.excludeTags.push('supine', 'prone');
    g.workout.push('During pregnancy, check your plan with your midwife or doctor. Exercises lying flat on your back or front are swapped out; avoid overheating.');
    g.food.push('Weight-loss calorie deficits are not recommended during pregnancy — follow your maternity team’s advice.');
  }
  if (has(conditions, 'pcos')) {
    g.food.push('With PCOS, higher-protein, higher-fibre meals and fewer refined carbohydrates often help with appetite and insulin resistance.');
  }
  if (has(conditions, 'thyroid')) {
    g.workout.push('With a thyroid condition, energy can vary — adjust intensity to how you feel and keep taking your medicine as prescribed.');
  }
  g.excludeTags = [...new Set(g.excludeTags)];
  return g;
}

export const HEALTH_DISCLAIMER =
  'General fitness guidance, not medical advice. It does not replace your doctor, who knows your history and medicines.';
