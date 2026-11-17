import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { hardShadow, radius, spacing, stroke } from '@/theme/tokens';

export interface CardProps {
  children: ReactNode;
  /**
   * hero: lime-accented, heavy shadow — one per screen for the key number.
   * plain: outlined card with hard shadow. inset: flat, sunken, no shadow (secondary info).
   */
  tone?: 'hero' | 'plain' | 'inset';
  /** Optional flat fill (e.g. a macro colour) for stat tiles. */
  fill?: string;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

export function Card({ children, tone = 'plain', fill, style, padded = true }: CardProps) {
  const { colors } = useTheme();
  const bg = fill ?? (tone === 'inset' ? colors.surfaceSunken : colors.surface);
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: bg,
          borderColor: tone === 'inset' ? colors.border : colors.ink,
          borderWidth: tone === 'inset' ? stroke.hairline : stroke.base,
          padding: padded ? (tone === 'hero' ? spacing.xxl : spacing.xl) : 0,
        },
        tone !== 'inset' && hardShadow(tone === 'hero' ? colors.primary : colors.shadow, tone === 'hero' ? 6 : 4),
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'visible' },
});
