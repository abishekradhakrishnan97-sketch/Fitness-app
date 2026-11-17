import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { Icon, type IconName } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, layout, stroke } from '@/theme/tokens';


function icon(active: IconName, inactive: IconName) {
  function TabIcon({ color, focused, size }: { color: unknown; focused: boolean; size: number }) {
    return <Icon name={focused ? active : inactive} color={color as string} size={size} />;
  }
  return TabIcon;
}

export const unstable_settings = { initialRouteName: 'today' };

export default function TabsLayout() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= layout.wideBreakpoint;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.onPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarActiveBackgroundColor: colors.primary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.ink,
          borderTopWidth: stroke.base,
          borderRightColor: colors.ink,
          borderRightWidth: wide ? stroke.base : 0,
        },
        tabBarItemStyle: { borderRadius: 0 },
        tabBarLabelStyle: { fontFamily: fonts.monoBold, fontSize: 11, lineHeight: 16, letterSpacing: 0.4, textTransform: 'uppercase', paddingBottom: 2 },
        sceneStyle: { backgroundColor: colors.background },
        // Desktop: side rail instead of a bottom bar.
        tabBarPosition: wide ? 'left' : 'bottom',
        tabBarVariant: wide ? 'material' : 'uikit',
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: icon('today', 'today-outline') }} />
      <Tabs.Screen name="add" options={{ title: 'Add food', tabBarIcon: icon('add-circle', 'add-circle-outline') }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal', tabBarIcon: icon('book', 'book-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}
