import { Link } from 'expo-router';
import { useState } from 'react';
import { AuthHeader } from '@/components/AuthHeader';
import { Banner, Button, Screen, TextField } from '@/components/ui';
import { authRedirectUrl, supabase } from '@/lib/supabase';
import { friendlyError } from '@/services/errors';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email.trim()) return setError('Enter your email address.');
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authRedirectUrl('/reset-password'),
    });
    setBusy(false);
    if (err) return setError(friendlyError(err));
    setSent(true);
  };

  return (
    <Screen narrow>
      <AuthHeader title="Reset password" subtitle="We'll email you a link to choose a new password." />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {sent ? (
        <Banner tone="info" title="Check your email">
          If an account exists for that address, a reset link is on its way.
        </Banner>
      ) : (
        <>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onSubmitEditing={submit}
          />
          <Button label="Send reset link" size="lg" onPress={submit} loading={busy} fullWidth />
        </>
      )}
      <Link href="/sign-in" asChild>
        <Button label="Back to sign in" variant="ghost" fullWidth />
      </Link>
    </Screen>
  );
}
