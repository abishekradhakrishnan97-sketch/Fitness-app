import { StyleSheet, View } from 'react-native';
import { AppText, Icon } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { hardShadow, radius, spacing, stroke } from '@/theme/tokens';

export const APP_NAME = 'Fitness App';

export function AuthHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.brand}>
        <View style={[styles.logo, { backgroundColor: colors.primary, borderColor: colors.ink }, hardShadow(colors.shadow, 3)]}>
          <Icon name="flash" size={18} color={colors.onPrimary} />
        </View>
        <AppText variant="heading">{APP_NAME}</AppText>
      </View>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="display" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText tone="muted">{subtitle}</AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xxxl, marginTop: spacing.xxl, marginBottom: spacing.sm },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: { width: 34, height: 34, borderRadius: radius.sm, borderWidth: stroke.base, alignItems: 'center', justifyContent: 'center' },
});
