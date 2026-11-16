import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { layout } from '@/theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

const icon =
  (active: IconName, inactive: IconName) =>
  ({ color, focused, size }: { color: unknown; focused: boolean; size: number }) => (
    <Ionicons name={focused ? active : inactive} color={color as string} size={size} />
  );

export const unstable_settings = { initialRouteName: 'today' };

export default function TabsLayout() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= layout.wideBreakpoint;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, borderRightColor: colors.border },
        tabBarLabelStyle: { fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
        // Desktop: side rail instead of a bottom bar.
        tabBarPosition: wide ? 'left' : 'bottom',
        tabBarVariant: wide ? 'material' : 'uikit',
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: icon('today', 'today-outline') }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal', tabBarIcon: icon('book', 'book-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}
