import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from './AppText';

export interface Choice<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface BaseProps<T extends string> {
  label?: string;
  options: Choice<T>[];
  /** "chips" wrap inline; "list" stacks full-width rows with descriptions. */
  layout?: 'chips' | 'list';
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
        <AppText variant="label" tone="muted">
          {label}
        </AppText>
      ) : null}
      <View style={layout === 'chips' ? styles.chips : styles.list}>
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
                layout === 'chips' ? styles.chip : styles.row,
                {
                  backgroundColor: selected ? colors.primarySoft : colors.surfaceSunken,
                  borderColor: selected ? colors.primary : colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <AppText variant={layout === 'chips' ? 'label' : 'bodyStrong'} color={selected ? colors.primary : colors.text}>
                {o.label}
              </AppText>
              {layout === 'list' && o.description ? (
                <AppText variant="label" tone="muted">
                  {o.description}
                </AppText>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  list: { gap: spacing.sm },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: radius.pill, borderWidth: 1 },
  row: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, gap: 2 },
});
