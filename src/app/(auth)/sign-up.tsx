import { Link } from 'expo-router';
import { useState } from 'react';
import { AuthHeader } from '@/components/AuthHeader';
import { AppText, Banner, Button, Screen, TextField } from '@/components/ui';
import { authRedirectUrl, supabase } from '@/lib/supabase';
import { friendlyError } from '@/services/errors';
import { useTheme } from '@/theme/ThemeProvider';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUp() {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    setBusy(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() }, emailRedirectTo: authRedirectUrl('/') },
    });
    setBusy(false);
    if (err) return setError(friendlyError(err));
    // With email confirmation on, there is no session until the link is clicked.
    if (!data.session) setSentTo(email.trim());
  };

  if (sentTo) {
    return (
      <Screen narrow>
        <AuthHeader title="Check your email" subtitle={`We sent a verification link to ${sentTo}.`} />
        <AppText tone="muted">
          Open the link on this device to verify your account, then sign in. It can take a minute to arrive — check
          spam if you don't see it.
        </AppText>
        <Link href="/sign-in" asChild>
          <Button label="Back to sign in" variant="secondary" size="lg" fullWidth />
        </Link>
      </Screen>
    );
  }

  return (
    <Screen narrow>
      <AuthHeader title="Create account" subtitle="Free food tracking with AI meal recognition." />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <TextField label="Name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" placeholder="Optional" />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        hint="At least 8 characters"
        onSubmitEditing={submit}
      />
      <Button label="Create account" size="lg" onPress={submit} loading={busy} fullWidth />
      <AppText tone="muted" align="center">
        Already have an account?{' '}
        <Link href="/sign-in" style={{ color: colors.primary, fontWeight: '600' }}>
          Sign in
        </Link>
      </AppText>
    </Screen>
  );
}
