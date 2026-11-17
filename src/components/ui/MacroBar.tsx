import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, stroke } from '@/theme/tokens';
import { AppText } from './AppText';

export function MacroBar({
  label,
  consumed,
  target,
  unit = 'g',
  color,
}: {
  label: string;
  consumed: number;
  target: number;
  unit?: string;
  color: string;
}) {
  const { colors } = useTheme();
  const ratio = target > 0 ? consumed / target : 0;
  const pct = Math.min(1, Math.max(0, ratio));
  const over = ratio > 1.05;
  const remaining = Math.max(0, target - consumed);

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label}: ${Math.round(consumed)} of ${target} ${unit}${over ? ', over target' : ''}`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
    >
      <View style={styles.top}>
        <AppText variant="overline">{label}</AppText>
        <AppText variant="caption" tone="muted" numeric>
          <AppText variant="statSm" numeric style={{ fontSize: 15 }}>
            {Math.round(consumed)}
          </AppText>
          {` / ${target}${unit}`}
        </AppText>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceSunken, borderColor: colors.ink }]}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: over ? colors.carbs : color, borderColor: colors.ink, borderRightWidth: pct > 0 && pct < 1 ? stroke.base : 0 }]} />
      </View>
      <AppText variant="caption" tone={over ? 'warning' : 'subtle'} numeric>
        {over ? `+${Math.round(consumed - target)}${unit} OVER` : `${Math.round(remaining)}${unit} LEFT`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs + 2 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  track: { height: 16, borderRadius: radius.sm, overflow: 'hidden', borderWidth: stroke.base },
  fill: { height: '100%' },
});
