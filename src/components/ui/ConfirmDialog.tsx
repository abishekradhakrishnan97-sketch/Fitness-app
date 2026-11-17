import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { hardShadow, radius, spacing, stroke } from '@/theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

/**
 * Cross-platform confirm dialog (React Native's Alert does not work on web).
 * const [dialog, confirm] = useConfirm(); ... if (await confirm({...})) ...; render {dialog}
 */
export function useConfirm(): [ReactNode, (o: ConfirmOptions) => Promise<boolean>] {
  const { colors } = useTheme();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };

  const dialog = (
    <Modal visible={!!opts} transparent animationType="fade" onRequestClose={() => close(false)}>
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={() => close(false)} accessibilityLabel="Dismiss">
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.ink }, hardShadow(colors.shadow, 6)]}
          accessibilityRole="alert"
          onPress={() => undefined}
        >
          <AppText variant="heading">{opts?.title}</AppText>
          {opts?.message ? <AppText tone="muted">{opts.message}</AppText> : null}
          <View style={styles.actions}>
            <Button label="Cancel" variant="secondary" onPress={() => close(false)} style={{ flex: 1 }} />
            <Button
              label={opts?.confirmLabel ?? 'Confirm'}
              variant={opts?.destructive ? 'danger' : 'primary'}
              onPress={() => close(true)}
              style={{ flex: 1 }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  return [dialog, confirm];
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  sheet: { width: '100%', maxWidth: 400, borderRadius: radius.lg, borderWidth: stroke.base, padding: spacing.xxl, gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
});
