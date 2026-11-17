import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, stroke } from '@/theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

export function Banner({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warning' | 'danger';
  title?: string;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const bg = { info: colors.infoSoft, warning: colors.warningSoft, danger: colors.dangerSoft }[tone];
  const fg = { info: colors.text, warning: colors.warning, danger: colors.danger }[tone];
  const icon: IconName = { info: 'information-circle', warning: 'warning', danger: 'alert-circle' }[tone] as IconName;
  return (
    <View style={[styles.banner, { backgroundColor: bg, borderColor: tone === 'info' ? colors.ink : fg }]} accessibilityRole="alert">
      <View style={{ marginTop: 1 }}><Icon name={icon} size={20} color={fg} /></View>
      <View style={styles.flex}>
        {title ? <AppText variant="bodyStrong" color={colors.text}>{title}</AppText> : null}
        {typeof children === 'string' ? (
          <AppText variant="label" color={colors.textMuted}>
            {children}
          </AppText>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.centered} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.text} size="large" />
      <AppText variant="label" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.centered}>
      <Icon name="cloud-offline-outline" size={36} color={colors.textSubtle} />
      <AppText variant="bodyStrong" align="center">
        Something went wrong
      </AppText>
      <AppText variant="label" tone="muted" align="center">
        {message}
      </AppText>
      {onRetry ? <Button label="Try again" variant="secondary" size="sm" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: IconName;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primary, borderColor: colors.ink }]}>
        <Icon name={icon} size={24} color={colors.onPrimary} />
      </View>
      <AppText variant="bodyStrong" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText variant="label" tone="muted" align="center">
          {message}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  banner: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radius.md, borderWidth: stroke.base },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xxl, minHeight: 200 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyIcon: { width: 52, height: 52, borderRadius: radius.md, borderWidth: stroke.base, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs, transform: [{ rotate: '-4deg' }] },
});
