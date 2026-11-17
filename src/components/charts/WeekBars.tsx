import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

export interface DayValue {
  date: string; // yyyy-mm-dd
  value: number;
}

/**
 * Calories per day vs. target. Bars over target turn warning-coloured; today is outlined heavier.
 * Values are always printed above bars so colour is never the only signal.
 */
export function WeekBars({ days, target, today, height = 170 }: { days: DayValue[]; target: number; today: string; height?: number }) {
  const { colors } = useTheme();
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  const top = 22;
  const bottom = 26;
  const chartH = height - top - bottom;
  const max = Math.max(target * 1.2, ...days.map((d) => d.value), 1);
  const y = (v: number) => top + chartH - (v / max) * chartH;
  const slot = w / Math.max(days.length, 1);
  const barW = Math.min(34, slot * 0.6);

  const summary = days
    .map((d) => `${new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })} ${Math.round(d.value)} kcal`)
    .join(', ');

  return (
    <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={`Calories per day, target ${target}. ${summary}`}>
      {w > 0 ? (
        <Svg width={w} height={height}>
          {/* baseline */}
          <Line x1={0} x2={w} y1={top + chartH} y2={top + chartH} stroke={colors.ink} strokeWidth={2} />
          {/* target */}
          {target > 0 ? (
            <>
              <Line x1={0} x2={w} y1={y(target)} y2={y(target)} stroke={colors.ink} strokeWidth={1.5} strokeDasharray="6 4" />
              <SvgText x={w - 2} y={y(target) - 5} fontSize={10} fontFamily={fonts.monoBold} fill={colors.textMuted} textAnchor="end">
                {`GOAL ${target}`}
              </SvgText>
            </>
          ) : null}
          {days.map((d, i) => {
            const cx = slot * i + slot / 2;
            const h = Math.max(d.value > 0 ? 3 : 0, top + chartH - y(d.value));
            const over = target > 0 && d.value > target * 1.05;
            const isToday = d.date === today;
            const label = new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' });
            return (
              <SvgGroup key={d.date}>
                {d.value > 0 ? (
                  <Rect
                    x={cx - barW / 2}
                    y={top + chartH - h}
                    width={barW}
                    height={h}
                    fill={over ? colors.carbs : isToday ? colors.primary : colors.protein}
                    stroke={colors.ink}
                    strokeWidth={isToday ? 3 : 2}
                  />
                ) : null}
                {d.value > 0 ? (
                  <Rect x={cx - 15} y={top + chartH - h - 17} width={30} height={14} fill={colors.surface} />
                ) : null}
                <SvgText x={cx} y={top + chartH - h - 6} fontSize={10} fontFamily={fonts.monoBold} fill={colors.text} textAnchor="middle">
                  {d.value > 0 ? (d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}k` : String(Math.round(d.value))) : '–'}
                </SvgText>
                <SvgText
                  x={cx}
                  y={height - 8}
                  fontSize={11}
                  fontFamily={isToday ? fonts.monoBold : fonts.mono}
                  fill={isToday ? colors.text : colors.textMuted}
                  textAnchor="middle"
                >
                  {label.toUpperCase()}
                </SvgText>
              </SvgGroup>
            );
          })}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

function SvgGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
