import { Text, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { typography, type Palette, type TypographyVariant } from '@/theme/tokens';

type Tone = 'default' | 'muted' | 'subtle' | 'primary' | 'danger' | 'warning' | 'success' | 'onPrimary';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  tone?: Tone;
  color?: string;
  align?: TextStyle['textAlign'];
  /** Tabular numerals so changing numbers don't jitter. */
  numeric?: boolean;
}

const toneColor = (c: Palette, tone: Tone): string =>
  ({
    default: c.text,
    muted: c.textMuted,
    subtle: c.textSubtle,
    primary: c.primary,
    danger: c.danger,
    warning: c.warning,
    success: c.success,
    onPrimary: c.onPrimary,
  })[tone];

export function AppText({ variant = 'body', tone = 'default', color, align, numeric, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  return (
    <Text
      {...rest}
      style={[
        typography[variant],
        { color: color ?? toneColor(colors, tone), textAlign: align },
        variant === 'overline' && { textTransform: 'uppercase' },
        numeric && { fontVariant: ['tabular-nums'] },
        style,
      ]}
    />
  );
}
