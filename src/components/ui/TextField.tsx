import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, hardShadow, radius, spacing, stroke, typography } from '@/theme/tokens';
import { AppText } from './AppText';

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  hint?: string;
  suffix?: string;
}

export function TextField({ label, error, hint, suffix, style, onFocus, onBlur, ...rest }: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : colors.inputBorder;

  return (
    <View style={styles.wrap}>
      <AppText variant="overline" tone="muted" nativeID={`${label}-label`}>
        {label}
      </AppText>
      <View
        style={[
          styles.box,
          { borderColor, backgroundColor: colors.surface, borderWidth: focused || error ? stroke.heavy : stroke.base },
          focused && hardShadow(error ? colors.danger : colors.primary, 3),
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          accessibilityLabelledBy={`${label}-label`}
          placeholderTextColor={colors.textSubtle}
          selectionColor={colors.primaryText}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, typography.body, { color: colors.text }, style]}
          {...rest}
        />
        {suffix ? (
          <AppText variant="caption" tone="muted" style={{ fontFamily: fonts.monoBold }}>
            {suffix.toUpperCase()}
          </AppText>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite" style={{ fontFamily: fonts.monoBold }}>
          ✕ {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="subtle">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs + 2 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md + 2,
    minHeight: 50,
    gap: spacing.sm,
  },
  input: { flex: 1, paddingVertical: spacing.md, outlineStyle: 'none' } as object,
});
