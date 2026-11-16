import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

export interface CardProps {
  children: ReactNode;
  /** hero: emphasised, raised surface; plain: standard; inset: sunken, for secondary info. */
  tone?: 'hero' | 'plain' | 'inset';
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

export function Card({ children, tone = 'plain', style, padded = true }: CardProps) {
  const { colors, name } = useTheme();
  const bg = tone === 'hero' ? colors.surfaceRaised : tone === 'inset' ? colors.surfaceSunken : colors.surface;
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: bg,
          borderColor: tone === 'inset' ? 'transparent' : colors.border,
          padding: padded ? (tone === 'hero' ? spacing.xxl : spacing.xl) : 0,
          borderRadius: tone === 'hero' ? radius.xl : radius.lg,
        },
        name === 'light' && tone !== 'inset' && styles.lightShadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  lightShadow: {
    shadowColor: '#0D1015',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});
