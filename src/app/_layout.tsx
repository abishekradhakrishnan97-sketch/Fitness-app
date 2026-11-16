import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppText, LoadingState, Screen } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth/AuthProvider';
import { isSupabaseConfigured } from '@/lib/supabase';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

function RootNavigator() {
  const { colors, name } = useTheme();
  const { loading, session, onboarded, passwordRecovery } = useAuth();

  if (!isSupabaseConfigured) {
    return (
      <Screen narrow>
        <AppText variant="title">Setup required</AppText>
        <AppText tone="muted">
          EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set. Copy .env.example to .env and
          restart the dev server.
        </AppText>
      </Screen>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <LoadingState label="Loading your data…" />
      </View>
    );
  }

  const signedIn = !!session && !passwordRecovery;

  return (
    <>
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="targets" options={{ presentation: 'modal' }} />
        </Stack.Protected>
        <Stack.Protected guard={!!session && passwordRecovery}>
          <Stack.Screen name="reset-password" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
