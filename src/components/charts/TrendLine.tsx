import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

export interface Point {
  date: string; // yyyy-mm-dd
  value: number;
}

/** Weight-style trend line with optional goal line. Points are time-scaled, not evenly spaced. */
export function TrendLine({
  points,
  goal,
  unit = 'kg',
  height = 150,
}: {
  points: Point[];
  goal?: number | null;
  unit?: string;
  height?: number;
}) {
  const { colors } = useTheme();
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));

  const padL = 6;
  const padR = 52;
  const top = 14;
  const bottom = 22;
  const values = sorted.map((p) => p.value).concat(goal ? [goal] : []);
  const min = Math.min(...values) - 0.5;
  const max = Math.max(...values) + 0.5;
  const t0 = sorted.length ? Date.parse(sorted[0].date) : 0;
  const t1 = sorted.length ? Date.parse(sorted[sorted.length - 1].date) : 1;
  const span = Math.max(t1 - t0, 86_400_000);
  const x = (d: string) => padL + ((Date.parse(d) - t0) / span) * (w - padL - padR);
  const y = (v: number) => top + (1 - (v - min) / (max - min || 1)) * (height - top - bottom);

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const label = sorted.length
    ? `Weight trend: ${first.value} ${unit} on ${first.date} to ${last.value} ${unit} on ${last.date}${goal ? `, goal ${goal} ${unit}` : ''}.`
    : 'No weight entries yet.';

  return (
    <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={label}>
      {w > 0 && sorted.length ? (
        <Svg width={w} height={height}>
          {goal ? (
            <>
              <Line x1={padL} x2={w - padR} y1={y(goal)} y2={y(goal)} stroke={colors.success} strokeWidth={2} strokeDasharray="6 4" />
              <SvgText x={w - padR + 11} y={y(goal) + 4} fontSize={10} fontFamily={fonts.monoBold} fill={colors.success}>
                {`GOAL`}
              </SvgText>
            </>
          ) : null}
          <Line x1={padL} x2={w - padR} y1={height - bottom} y2={height - bottom} stroke={colors.ink} strokeWidth={2} />
          {sorted.length > 1 ? (
            <Polyline
              points={sorted.map((p) => `${x(p.date)},${y(p.value)}`).join(' ')}
              fill="none"
              stroke={colors.ink}
              strokeWidth={3}
              strokeLinejoin="miter"
            />
          ) : null}
          {sorted.map((p, i) => (
            <Circle
              key={`${p.date}-${i}`}
              cx={x(p.date)}
              cy={y(p.value)}
              r={i === sorted.length - 1 ? 6 : 3.5}
              fill={i === sorted.length - 1 ? colors.primary : colors.surface}
              stroke={colors.ink}
              strokeWidth={2}
            />
          ))}
          <SvgText x={w - padR + 11} y={y(last.value) + 4} fontSize={11} fontFamily={fonts.monoBold} fill={colors.text}>
            {`${last.value}`}
          </SvgText>
          <SvgText x={padL} y={height - 6} fontSize={10} fontFamily={fonts.mono} fill={colors.textMuted}>
            {shortDate(first.date)}
          </SvgText>
          {sorted.length > 1 ? (
            <SvgText x={w - padR} y={height - 6} fontSize={10} fontFamily={fonts.mono} fill={colors.textMuted} textAnchor="end">
              {shortDate(last.date)}
            </SvgText>
          ) : null}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

const shortDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toUpperCase();
