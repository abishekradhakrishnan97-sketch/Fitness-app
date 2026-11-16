import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
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
  const remaining = Math.max(0, target - consumed);

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label}: ${Math.round(consumed)} of ${target} ${unit}`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
    >
      <View style={styles.top}>
        <View style={styles.labelRow}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <AppText variant="label">{label}</AppText>
        </View>
        <AppText variant="label" tone="muted" numeric>
          <AppText variant="label" numeric>
            {Math.round(consumed)}
          </AppText>
          {` / ${target} ${unit}`}
        </AppText>
      </View>
      <View style={[styles.track, { backgroundColor: colors.ringTrack }]}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: ratio > 1.05 ? colors.warning : color }]} />
      </View>
      <AppText variant="caption" tone="subtle" numeric>
        {ratio > 1.05 ? `${Math.round(consumed - target)} ${unit} over` : `${Math.round(remaining)} ${unit} left`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs + 2 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
