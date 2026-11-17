import type React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, hardShadow, radius, spacing, stroke } from '@/theme/tokens';
import { AppText } from './AppText';

export interface Choice<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface BaseProps<T extends string> {
  label?: string;
  options: Choice<T>[];
  /** "chips" wrap inline; "scroll" is one swipeable row of chips; "list" stacks full-width rows with descriptions. */
  layout?: 'chips' | 'scroll' | 'list';
}

interface SingleProps<T extends string> extends BaseProps<T> {
  multiple?: false;
  value: T | null;
  onChange: (v: T) => void;
}

interface MultiProps<T extends string> extends BaseProps<T> {
  multiple: true;
  value: T[];
  onChange: (v: T[]) => void;
}

export function ChoiceGroup<T extends string>(props: SingleProps<T> | MultiProps<T>) {
  const { colors } = useTheme();
  const { label, options, layout = 'chips' } = props;
  const isSelected = (v: T) => (props.multiple ? props.value.includes(v) : props.value === v);
  const toggle = (v: T) => {
    if (props.multiple) {
      props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
    } else {
      props.onChange(v);
    }
  };

  return (
    <View style={styles.wrap} accessibilityRole={props.multiple ? undefined : 'radiogroup'} accessibilityLabel={label}>
      {label ? (
        <AppText variant="overline" tone="muted">
          {label}
        </AppText>
      ) : null}
      <Row layout={layout}>
        {options.map((o) => {
          const selected = isSelected(o.value);
          return (
            <Pressable
              key={o.value}
              onPress={() => toggle(o.value)}
              accessibilityRole={props.multiple ? 'checkbox' : 'radio'}
              accessibilityState={props.multiple ? { checked: selected } : { selected }}
              accessibilityLabel={o.description ? `${o.label}. ${o.description}` : o.label}
              style={({ pressed }) => [
                layout === 'list' ? styles.row : styles.chip,
                {
                  backgroundColor: selected ? colors.primary : colors.surface,
                  borderColor: colors.inputBorder,
                  borderWidth: stroke.base,
                },
                selected && !pressed ? hardShadow(colors.shadow, 2) : null,
                pressed && { transform: [{ translateX: 1 }, { translateY: 1 }] },
              ]}
            >
              <AppText
                variant={layout === 'list' ? 'bodyStrong' : 'label'}
                color={selected ? colors.onPrimary : colors.text}
                style={layout === 'list' ? null : { fontFamily: selected ? fonts.semibold : fonts.medium }}
              >
                {o.label}
              </AppText>
              {layout === 'list' && o.description ? (
                <AppText variant="label" color={selected ? colors.onPrimary : colors.textMuted}>
                  {o.description}
                </AppText>
              ) : null}
            </Pressable>
          );
        })}
      </Row>
    </View>
  );
}

function Row({ layout, children }: { layout: 'chips' | 'scroll' | 'list'; children: React.ReactNode }) {
  if (layout === 'scroll') {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll} style={styles.scrollOuter}>
        {children}
      </ScrollView>
    );
  }
  return <View style={layout === 'chips' ? styles.chips : styles.list}>{children}</View>;
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: 2 },
  list: { gap: spacing.sm },
  chip: { paddingHorizontal: spacing.lg, minHeight: 44, justifyContent: 'center', borderRadius: radius.md },
  scroll: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: 4, paddingRight: spacing.lg + 4 },
  scrollOuter: { marginHorizontal: -spacing.lg },
  row: { padding: spacing.lg, borderRadius: radius.md, gap: 2 },
});
