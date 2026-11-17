// Curated exercise library. Every exercise maps to an animation pattern
// (see components/workout/ExerciseAnimation) so each one has a moving demo.

export type Pattern =
  | 'squat' | 'lunge' | 'pushup' | 'press' | 'row' | 'pulldown' | 'curl' | 'hinge'
  | 'bench' | 'plank' | 'crunch' | 'raise' | 'pushdown' | 'bridge' | 'calf' | 'cardio' | 'chestpress' | 'pressout';

export type Role =
  | 'squat' | 'hinge' | 'lunge' | 'push_h' | 'push_v' | 'pull_v' | 'pull_h'
  | 'shoulder' | 'biceps' | 'triceps' | 'core' | 'calf' | 'glute';

/** Tags used to swap exercises out for health reasons. */
export type Tag = 'knee_load' | 'spine_load' | 'overhead' | 'supine' | 'prone';

export interface Exercise {
  id: string;
  name: string;
  muscles: string;
  role: Role;
  pattern: Pattern;
  where: 'gym' | 'home' | 'any';
  /** Compound lifts go first and use lower reps. */
  compound: boolean;
  tags: Tag[];
  cues: string[];
}

const ex = (
  id: string, name: string, muscles: string, role: Role, pattern: Pattern, where: Exercise['where'],
  compound: boolean, tags: Tag[], cues: string[],
): Exercise => ({ id, name, muscles, role, pattern, where, compound, tags, cues });

// Order within a role = preference order.
export const EXERCISES: Exercise[] = [
  // --- squat
  ex('barbell_squat', 'Barbell back squat', 'Quads, glutes', 'squat', 'squat', 'gym', true, ['knee_load', 'spine_load'],
    ['Feet shoulder-width, brace your core', 'Sit back and down until thighs are parallel', 'Drive up through mid-foot, knees tracking over toes']),
  ex('goblet_squat', 'Goblet squat', 'Quads, glutes', 'squat', 'squat', 'any', true, ['knee_load'],
    ['Hold one dumbbell (or a loaded backpack) at your chest', 'Keep chest tall, sit between your heels', 'Stand up fully, squeeze glutes']),
  ex('leg_press', 'Leg press', 'Quads, glutes', 'squat', 'squat', 'gym', true, [],
    ['Feet hip-width on the platform', 'Lower until knees reach about 90°', 'Press without locking knees hard']),
  ex('bodyweight_squat', 'Bodyweight squat', 'Quads, glutes', 'squat', 'squat', 'home', true, ['knee_load'],
    ['Arms forward for balance', 'Hips back, knees out', 'Slow down, strong up']),
  ex('box_squat', 'Sit-to-stand (chair squat)', 'Quads, glutes', 'squat', 'squat', 'any', true, [],
    ['Stand in front of a chair or bench', 'Sit back lightly, then stand without using hands', 'Keep the movement pain-free']),
  // --- hinge
  ex('romanian_deadlift', 'Romanian deadlift', 'Hamstrings, glutes', 'hinge', 'hinge', 'gym', true, ['spine_load'],
    ['Soft knees, push hips straight back', 'Bar stays close to your legs, back flat', 'Stop at mid-shin, squeeze glutes to stand']),
  ex('db_rdl', 'Dumbbell Romanian deadlift', 'Hamstrings, glutes', 'hinge', 'hinge', 'any', true, ['spine_load'],
    ['Hold dumbbells or a loaded backpack', 'Hinge at the hips with a flat back', 'Feel the hamstrings stretch, then stand tall']),
  ex('hip_thrust', 'Hip thrust', 'Glutes, hamstrings', 'hinge', 'bridge', 'gym', true, ['supine'],
    ['Upper back on a bench, bar over hips', 'Drive hips up until body is level', 'Pause and squeeze at the top']),
  ex('glute_bridge', 'Glute bridge', 'Glutes, hamstrings', 'glute', 'bridge', 'any', false, ['supine'],
    ['Lie on your back, feet flat near hips', 'Press through heels, lift hips', 'Pause 1 second at the top']),
  // --- lunge
  ex('walking_lunge', 'Walking lunge', 'Quads, glutes', 'lunge', 'lunge', 'any', true, ['knee_load'],
    ['Long step forward, torso upright', 'Back knee lowers toward the floor', 'Push through the front heel']),
  ex('split_squat', 'Split squat', 'Quads, glutes', 'lunge', 'lunge', 'any', true, ['knee_load'],
    ['Staggered stance, most weight on front leg', 'Lower straight down', 'Hold a wall for balance if needed']),
  ex('step_up', 'Low step-up', 'Quads, glutes', 'lunge', 'lunge', 'any', true, [],
    ['Use a low, stable step', 'Step up through the whole foot', 'Lower slowly under control']),
  // --- horizontal push
  ex('bench_press', 'Bench press', 'Chest, triceps', 'push_h', 'bench', 'gym', true, ['supine'],
    ['Shoulder blades squeezed back and down', 'Lower the bar to mid-chest', 'Press up and slightly back']),
  ex('incline_db_press', 'Incline dumbbell press', 'Upper chest, shoulders', 'push_h', 'bench', 'gym', true, [],
    ['Bench at about 30°', 'Lower dumbbells to chest level', 'Press up without clashing them']),
  ex('chest_press_machine', 'Machine chest press', 'Chest, triceps', 'push_h', 'chestpress', 'gym', true, [],
    ['Seat so handles are at mid-chest', 'Press forward smoothly', 'Return slowly, keep breathing']),
  ex('pushup', 'Push-up', 'Chest, triceps, core', 'push_h', 'pushup', 'any', true, ['prone'],
    ['Hands just wider than shoulders', 'Body in one straight line', 'Chest to just above the floor, press up']),
  ex('incline_pushup', 'Incline push-up (hands on bench)', 'Chest, triceps', 'push_h', 'pushup', 'any', true, [],
    ['Hands on a bench, table or wall', 'Keep hips in line with shoulders', 'Easier than floor push-ups — build up from here']),
  // --- vertical push
  ex('overhead_press', 'Overhead press', 'Shoulders, triceps', 'push_v', 'press', 'gym', true, ['overhead', 'spine_load'],
    ['Bar at collarbone, elbows slightly forward', 'Press straight up, head through at the top', 'Ribs down, do not lean back']),
  ex('db_shoulder_press', 'Seated dumbbell shoulder press', 'Shoulders, triceps', 'push_v', 'press', 'any', true, ['overhead'],
    ['Sit tall with back supported', 'Press dumbbells (or water bottles) overhead', 'Lower to ear level under control']),
  ex('landmine_or_incline', 'High-incline dumbbell press', 'Shoulders, upper chest', 'push_v', 'bench', 'gym', true, [],
    ['Bench at about 60°', 'Press up and slightly in', 'A shoulder-friendly alternative to overhead pressing']),
  // --- vertical pull
  ex('lat_pulldown', 'Lat pulldown', 'Lats, biceps', 'pull_v', 'pulldown', 'gym', true, [],
    ['Grip just wider than shoulders', 'Pull the bar to your upper chest', 'Lead with elbows, control the return']),
  ex('assisted_pullup', 'Assisted pull-up', 'Lats, biceps', 'pull_v', 'pulldown', 'gym', true, ['overhead'],
    ['Use the assist machine or a band', 'Pull chest toward the bar', 'Lower all the way down']),
  ex('band_pulldown', 'Band or towel pulldown', 'Lats', 'pull_v', 'pulldown', 'home', true, [],
    ['Anchor a band high (or hold a towel taut overhead)', 'Pull elbows down to your sides', 'Squeeze shoulder blades together']),
  // --- horizontal pull
  ex('seated_row', 'Seated cable row', 'Mid-back, biceps', 'pull_h', 'row', 'gym', true, [],
    ['Sit tall, slight knee bend', 'Pull the handle to your lower ribs', 'Squeeze shoulder blades, return slowly']),
  ex('db_row', 'One-arm dumbbell row', 'Lats, mid-back', 'pull_h', 'row', 'any', true, [],
    ['One hand and knee on a bench or chair', 'Pull the weight (or a loaded backpack) to your hip', 'Keep your back flat']),
  ex('bent_over_row', 'Barbell bent-over row', 'Back, biceps', 'pull_h', 'row', 'gym', true, ['spine_load'],
    ['Hinge to about 45°, back flat', 'Pull the bar to your belly button', 'Lower with control']),
  // --- shoulders
  ex('lateral_raise', 'Lateral raise', 'Side shoulders', 'shoulder', 'raise', 'any', false, [],
    ['Light weights or water bottles', 'Raise arms to shoulder height', 'Lead with elbows, lower slowly']),
  // --- arms
  ex('biceps_curl', 'Biceps curl', 'Biceps', 'biceps', 'curl', 'any', false, [],
    ['Elbows pinned to your sides', 'Curl without swinging', 'Lower for a slow 2-count']),
  ex('triceps_pushdown', 'Triceps pushdown', 'Triceps', 'triceps', 'pushdown', 'gym', false, [],
    ['Elbows at your sides', 'Push the bar down until arms are straight', 'Control it back to chest height']),
  ex('overhead_triceps', 'Overhead triceps extension', 'Triceps', 'triceps', 'press', 'any', false, ['overhead'],
    ['One dumbbell or bottle held in both hands', 'Lower behind your head, elbows forward', 'Extend arms fully']),
  ex('bench_dip', 'Bench dip', 'Triceps', 'triceps', 'pushdown', 'home', false, [],
    ['Hands on a sturdy chair behind you', 'Bend elbows to about 90°', 'Press back up, shoulders down']),
  // --- core
  ex('plank', 'Plank', 'Core', 'core', 'plank', 'any', false, ['prone'],
    ['Elbows under shoulders', 'Straight line from head to heels', 'Breathe steadily — never hold your breath']),
  ex('dead_bug', 'Dead bug', 'Deep core', 'core', 'crunch', 'any', false, ['supine'],
    ['On your back, arms up, knees at 90°', 'Lower opposite arm and leg slowly', 'Keep lower back gently pressed down']),
  ex('standing_pallof', 'Standing band anti-rotation press', 'Core', 'core', 'pressout', 'any', false, [],
    ['Band or cable anchored at chest height to your side', 'Press hands straight out and resist the twist', 'A standing core option — no floor work needed']),
  // --- calves
  ex('calf_raise', 'Standing calf raise', 'Calves', 'calf', 'calf', 'any', false, [],
    ['Rise onto the balls of your feet', 'Pause at the top', 'Lower heels slowly']),
];

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
