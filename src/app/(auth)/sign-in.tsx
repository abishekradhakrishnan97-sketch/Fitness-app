import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AuthHeader } from '@/components/AuthHeader';
import { AppText, Banner, Button, Screen, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/services/errors';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function SignIn() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(friendlyError(err));
    // On success the root layout's guards route to onboarding or the dashboard.
  };

  return (
    <Screen narrow>
      <AuthHeader title="Welcome back" subtitle="Log meals, hit your targets, track progress." />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="you@example.com"
        returnKeyType="next"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
        returnKeyType="go"
      />
      <View style={{ alignItems: 'flex-end', marginTop: -spacing.sm }}>
        <Link href="/forgot-password" style={{ color: colors.primary, paddingVertical: spacing.xs }}>
          Forgot password?
        </Link>
      </View>
      <Button label="Sign in" size="lg" onPress={submit} loading={busy} fullWidth />
      <AppText tone="muted" align="center">
        New here?{' '}
        <Link href="/sign-up" style={{ color: colors.primary, fontWeight: '600' }}>
          Create an account
        </Link>
      </AppText>
    </Screen>
  );
}
