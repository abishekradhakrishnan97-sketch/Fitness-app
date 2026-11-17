import { useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import type { Pattern } from '@/lib/workout/exercises';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Animated stick-figure demo of an exercise (side view), drawn in a 100×100 box.
 * Each movement pattern has a start and end pose; we ease back and forth between them.
 * With "reduce motion" on, both poses are shown statically (end pose faded) instead.
 */
type P = [number, number];
interface Pose {
  head: P; neck: P; hip: P; knee: P; foot: P; elbow: P; hand: P;
  knee2?: P; foot2?: P;
}
interface Prop { kind: 'bar' | 'dumbbell' | 'bench' | 'seat' | 'cable'; }
interface Move { a: Pose; b: Pose; props?: Prop['kind'][]; }

const stand: Pose = { head: [50, 16], neck: [50, 26], hip: [50, 55], knee: [50, 72], foot: [50, 90], elbow: [51, 41], hand: [52, 54] };

const MOVES: Record<Pattern, Move> = {
  squat: {
    a: { ...stand, elbow: [57, 36], hand: [66, 32] },
    b: { head: [47, 33], neck: [46, 43], hip: [38, 68], knee: [58, 71], foot: [50, 90], elbow: [56, 50], hand: [67, 46] },
  },
  lunge: {
    a: { ...stand, knee2: [49, 72], foot2: [47, 90] },
    b: { head: [50, 28], neck: [50, 38], hip: [50, 66], knee: [64, 70], foot: [64, 90], elbow: [51, 52], hand: [53, 64], knee2: [42, 84], foot2: [28, 86] },
  },
  pushup: {
    a: { head: [21, 54], neck: [29, 60], hip: [58, 71], knee: [74, 78], foot: [90, 88], elbow: [30, 75], hand: [30, 89] },
    b: { head: [21, 76], neck: [29, 80], hip: [58, 82], knee: [74, 85], foot: [90, 88], elbow: [20, 79], hand: [30, 89] },
  },
  press: {
    a: { ...stand, elbow: [60, 38], hand: [58, 25] },
    b: { ...stand, elbow: [55, 14], hand: [56, 2] },
    props: ['dumbbell'],
  },
  row: {
    a: { head: [24, 39], neck: [32, 43], hip: [56, 55], knee: [53, 72], foot: [51, 90], elbow: [33, 58], hand: [34, 72] },
    b: { head: [24, 39], neck: [32, 43], hip: [56, 55], knee: [53, 72], foot: [51, 90], elbow: [45, 44], hand: [37, 55] },
    props: ['dumbbell'],
  },
  pulldown: {
    a: { head: [50, 30], neck: [50, 40], hip: [50, 66], knee: [67, 66], foot: [67, 90], elbow: [55, 24], hand: [57, 9] },
    b: { head: [50, 30], neck: [50, 40], hip: [50, 66], knee: [67, 66], foot: [67, 90], elbow: [62, 50], hand: [57, 35] },
    props: ['seat', 'bar', 'cable'],
  },
  curl: {
    a: { ...stand, elbow: [52, 42], hand: [55, 56] },
    b: { ...stand, elbow: [52, 42], hand: [60, 29] },
    props: ['dumbbell'],
  },
  hinge: {
    a: { ...stand },
    b: { head: [73, 42], neck: [65, 46], hip: [43, 56], knee: [48, 73], foot: [50, 90], elbow: [66, 60], hand: [64, 74] },
    props: ['bar'],
  },
  bench: {
    a: { head: [20, 61], neck: [28, 63], hip: [57, 63], knee: [71, 62], foot: [74, 90], elbow: [31, 47], hand: [31, 32] },
    b: { head: [20, 61], neck: [28, 63], hip: [57, 63], knee: [71, 62], foot: [74, 90], elbow: [40, 70], hand: [31, 55] },
    props: ['bench', 'bar'],
  },
  plank: {
    a: { head: [20, 66], neck: [28, 70], hip: [58, 75], knee: [74, 81], foot: [90, 88], elbow: [29, 88], hand: [41, 88] },
    b: { head: [20, 65], neck: [28, 69], hip: [58, 73], knee: [74, 80], foot: [90, 88], elbow: [29, 88], hand: [41, 88] },
  },
  crunch: {
    a: { head: [20, 84], neck: [29, 86], hip: [55, 87], knee: [67, 70], foot: [79, 89], elbow: [28, 77], hand: [22, 79] },
    b: { head: [30, 67], neck: [36, 75], hip: [55, 87], knee: [67, 70], foot: [79, 89], elbow: [42, 67], hand: [34, 62] },
  },
  raise: {
    a: { ...stand },
    b: { ...stand, elbow: [61, 30], hand: [74, 27] },
    props: ['dumbbell'],
  },
  pushdown: {
    a: { ...stand, elbow: [54, 42], hand: [62, 33] },
    b: { ...stand, elbow: [54, 42], hand: [57, 57] },
    props: ['bar'],
  },
  bridge: {
    a: { head: [18, 86], neck: [26, 87], hip: [52, 87], knee: [66, 69], foot: [73, 89], elbow: [36, 89], hand: [47, 89] },
    b: { head: [18, 86], neck: [26, 86], hip: [52, 70], knee: [66, 66], foot: [73, 89], elbow: [36, 89], hand: [47, 89] },
  },
  calf: {
    a: { ...stand },
    b: { head: [50, 11], neck: [50, 21], hip: [50, 50], knee: [50, 67], foot: [50, 85], elbow: [51, 36], hand: [52, 49] },
  },
  chestpress: {
    a: { head: [46, 30], neck: [46, 40], hip: [46, 66], knee: [63, 66], foot: [63, 90], elbow: [50, 54], hand: [58, 44] },
    b: { head: [46, 30], neck: [46, 40], hip: [46, 66], knee: [63, 66], foot: [63, 90], elbow: [60, 46], hand: [74, 43] },
    props: ['seat', 'bar'],
  },
  pressout: {
    a: { ...stand, elbow: [57, 43], hand: [59, 35] },
    b: { ...stand, elbow: [62, 37], hand: [75, 35] },
  },
  cardio: {
    a: { ...stand, knee: [59, 68], foot: [57, 84], knee2: [45, 73], foot2: [39, 89], elbow: [43, 40], hand: [51, 46] },
    b: { ...stand, knee: [45, 73], foot: [39, 89], knee2: [59, 68], foot2: [57, 84], elbow: [58, 40], hand: [64, 34] },
  },
};

const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function mix(a: Pose, b: Pose, t: number): Pose {
  const out = {} as Pose;
  (Object.keys(a) as (keyof Pose)[]).forEach((k) => {
    const pa = a[k];
    const pb = b[k] ?? pa;
    if (pa && pb) out[k] = lerp(pa, pb, t);
  });
  return out;
}

function Figure({ pose, color, width, opacity = 1 }: { pose: Pose; color: string; width: number; opacity?: number }) {
  const seg = (p: P, q: P, key: string) => (
    <Line key={key} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={color} strokeWidth={width} strokeLinecap="round" opacity={opacity} />
  );
  return (
    <>
      {pose.knee2 && pose.foot2 ? [seg(pose.hip, pose.knee2, 'l2a'), seg(pose.knee2, pose.foot2, 'l2b')] : null}
      {seg(pose.neck, pose.hip, 'torso')}
      {seg(pose.hip, pose.knee, 'thigh')}
      {seg(pose.knee, pose.foot, 'shin')}
      {seg(pose.neck, pose.elbow, 'upper')}
      {seg(pose.elbow, pose.hand, 'fore')}
      <Circle cx={pose.head[0]} cy={pose.head[1]} r={6.5} fill={color} opacity={opacity} />
    </>
  );
}

export function ExerciseAnimation({ pattern, size = 120, label }: { pattern: Pattern; size?: number; label: string }) {
  const { colors } = useTheme();
  const [t, setT] = useState(0);
  const [reduce, setReduce] = useState(false);
  const move = MOVES[pattern];

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => live && setReduce(v)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (reduce) return;
    const start = Date.now();
    const period = pattern === 'plank' ? 3200 : pattern === 'cardio' ? 900 : 2400;
    const id = setInterval(() => {
      const phase = ((Date.now() - start) % period) / period;
      setT((1 - Math.cos(phase * 2 * Math.PI)) / 2); // ease in-out, 0 -> 1 -> 0
    }, 50);
    return () => clearInterval(id);
  }, [reduce, pattern]);

  const pose = reduce ? move.a : mix(move.a, move.b, t);
  const hand = pose.hand;
  const props = move.props ?? [];

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Animated demonstration: ${label}`}
      style={{ width: size, height: size, backgroundColor: colors.surfaceSunken, borderWidth: 2, borderColor: colors.ink, borderRadius: 6 }}
    >
      <Svg width={size - 4} height={size - 4} viewBox="0 0 100 100">
        <Line x1={4} y1={92} x2={96} y2={92} stroke={colors.ink} strokeWidth={2} />
        {props.includes('bench') ? <Rect x={14} y={66} width={50} height={5} fill={colors.protein} stroke={colors.ink} strokeWidth={1.5} /> : null}
        {props.includes('bench') ? <Line x1={22} y1={71} x2={22} y2={92} stroke={colors.ink} strokeWidth={2} /> : null}
        {props.includes('bench') ? <Line x1={56} y1={71} x2={56} y2={92} stroke={colors.ink} strokeWidth={2} /> : null}
        {props.includes('seat') ? <Rect x={36} y={69} width={22} height={5} fill={colors.protein} stroke={colors.ink} strokeWidth={1.5} /> : null}
        {props.includes('seat') ? <Line x1={50} y1={74} x2={50} y2={92} stroke={colors.ink} strokeWidth={2} /> : null}
        {props.includes('cable') ? <Line x1={hand[0]} y1={hand[1]} x2={57} y2={0} stroke={colors.textMuted} strokeWidth={1.2} strokeDasharray="3 2" /> : null}
        {reduce ? <Figure pose={move.b} color={colors.textSubtle} width={4} opacity={0.45} /> : null}
        <Figure pose={pose} color={colors.ink} width={4.5} />
        {props.includes('bar') ? (
          <Line x1={hand[0] - 9} y1={hand[1]} x2={hand[0] + 9} y2={hand[1]} stroke={colors.carbs} strokeWidth={4} strokeLinecap="round" />
        ) : null}
        {props.includes('dumbbell') ? (
          <Rect x={hand[0] - 5} y={hand[1] - 3} width={10} height={6} rx={1.5} fill={colors.carbs} stroke={colors.ink} strokeWidth={1.2} />
        ) : null}
      </Svg>
    </View>
  );
}
