import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, hardShadow, radius, spacing, stroke } from '@/theme/tokens';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: 'md' | 'lg' | 'sm';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

/**
 * Neo-brutalist button: ink outline + hard shadow that "presses in" on tap.
 * Ghost buttons are text links (underlined) with a 44px target.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  disabled,
  fullWidth,
  style,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const ghost = variant === 'ghost';
  const bg = { primary: colors.primary, secondary: colors.surface, ghost: 'transparent', danger: colors.dangerSoft }[variant];
  const fg = { primary: colors.onPrimary, secondary: colors.text, ghost: colors.primaryText, danger: colors.danger }[variant];
  const height = { sm: 40, md: 50, lg: 58 }[size];
  const shadowSize = size === 'sm' ? 3 : 4;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={onPress}
      hitSlop={size === 'sm' ? { top: 2, bottom: 2 } : undefined}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          minHeight: ghost ? 44 : height,
          paddingHorizontal: ghost ? spacing.xs : size === 'sm' ? spacing.md : spacing.xl,
          borderColor: ghost ? 'transparent' : variant === 'danger' ? colors.danger : colors.ink,
          borderWidth: ghost ? 0 : stroke.base,
          opacity: isDisabled ? 0.45 : 1,
        },
        !ghost && !isDisabled && (pressed ? styles.pressed : hardShadow(variant === 'danger' ? colors.danger : colors.shadow, shadowSize)),
        fullWidth && { alignSelf: 'stretch' },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Icon name={icon} size={size === 'sm' ? 16 : 20} color={fg} />}
          <AppText
            variant="label"
            uppercase
            color={fg}
            style={[
              { fontFamily: fonts.monoBold, letterSpacing: 0.6, fontSize: size === 'sm' ? 12 : 14 },
              ghost && styles.underline,
            ]}
          >
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ translateX: 3 }, { translateY: 3 }] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  underline: { textDecorationLine: 'underline' },
});
