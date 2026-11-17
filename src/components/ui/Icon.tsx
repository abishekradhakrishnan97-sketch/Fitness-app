import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Icon from the single app icon family (Ionicons).
 * Decorative by default (hidden from screen readers) because icons here always sit
 * beside visible text. Pass `label` when an icon carries meaning on its own.
 */
export function Icon({ name, size, color, label }: { name: IconName; size: number; color: string; label?: string }) {
  if (label) return <Ionicons name={name} size={size} color={color} accessibilityLabel={label} accessibilityRole="image" />;
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
