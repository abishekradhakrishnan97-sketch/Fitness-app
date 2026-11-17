import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, stroke } from '@/theme/tokens';

/** Chunky segmented progress bar (e.g. 20 blocks). Over 100% shows warning blocks. */
export function SegmentedProgress({ value, max, segments = 20, label }: { value: number; max: number; segments?: number; label: string }) {
  const { colors } = useTheme();
  const ratio = max > 0 ? value / max : 0;
  const filled = Math.min(segments, Math.round(ratio * segments));
  const over = ratio > 1.02;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(ratio, 1) * 100) }}
      style={styles.segments}
    >
      {Array.from({ length: segments }, (_, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            {
              borderColor: colors.ink,
              backgroundColor: i < filled ? (over ? colors.carbs : colors.primary) : colors.surface,
            },
          ]}
        />
      ))}
    </View>
  );
}

export interface SplitPart {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** Single stacked bar showing shares (e.g. calories from protein/carbs/fat), with a text legend. */
export function SplitBar({ parts, unit = '%' }: { parts: SplitPart[]; unit?: string }) {
  const { colors } = useTheme();
  const total = parts.reduce((s, p) => s + p.value, 0);
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  return (
    <View style={{ gap: spacing.sm }}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={total > 0 ? parts.map((p) => `${p.label} ${pct(p.value)} percent`).join(', ') : 'No data yet'}
        style={[styles.split, { borderColor: colors.ink, backgroundColor: colors.surfaceSunken }]}
      >
        {total > 0
          ? parts.map((p, i) => (
              <View
                key={p.key}
                style={{
                  flex: p.value,
                  backgroundColor: p.color,
                  borderLeftWidth: i === 0 ? 0 : stroke.base,
                  borderColor: colors.ink,
                }}
              />
            ))
          : null}
      </View>
      <View style={styles.legend}>
        {parts.map((p) => (
          <View key={p.key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: p.color, borderColor: colors.ink }]} />
            <AppText variant="caption" tone="muted">
              {p.label.toUpperCase()} <AppText variant="caption" style={{ fontFamily: 'SpaceMono_700Bold' }}>{pct(p.value)}{unit}</AppText>
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row', gap: 3 },
  segment: { flex: 1, height: 18, borderWidth: stroke.base, borderRadius: 2 },
  split: { flexDirection: 'row', height: 22, borderWidth: stroke.base, borderRadius: radius.sm, overflow: 'hidden' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: 12, height: 12, borderWidth: stroke.base },
});
