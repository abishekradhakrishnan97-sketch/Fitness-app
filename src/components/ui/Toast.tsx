import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, AccessibilityInfo, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from './AppText';
import { Icon } from './Icon';

type Tone = 'success' | 'error';
interface ToastState { id: number; message: string; tone: Tone }

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => undefined);

/** App-wide toast for save/delete confirmations. Announced to screen readers; respects reduced motion. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduceMotion.current = v)).catch(() => undefined);
  }, []);

  const show = useCallback((message: string, tone: Tone = 'success') => {
    setToast({ id: Date.now(), message, tone });
    AccessibilityInfo.announceForAccessibility?.(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const d = reduceMotion.current ? 0 : 180;
    Animated.timing(opacity, { toValue: 1, duration: d, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: reduceMotion.current ? 0 : 140, useNativeDriver: true }).start(() => setToast(null));
    }, 2800);
    return () => clearTimeout(t);
  }, [toast, opacity]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 72 }]}>
          <Animated.View
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={[styles.toast, { opacity, backgroundColor: colors.text, borderColor: colors.border }]}
          >
            <Icon name={toast.tone === 'success' ? 'checkmark-circle' : 'alert-circle'} size={20} color={toast.tone === 'success' ? colors.accent : colors.danger} />
            <AppText variant="label" color={colors.background}>{toast.message}</AppText>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    maxWidth: 480,
  },
});
