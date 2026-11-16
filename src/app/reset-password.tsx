import { useState } from 'react';
import { AuthHeader } from '@/components/AuthHeader';
import { Banner, Button, Screen, TextField } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/services/errors';

export default function ResetPassword() {
  const { clearPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(friendlyError(err));
    clearPasswordRecovery(); // guards now route into the app
  };

  return (
    <Screen narrow>
      <AuthHeader title="Choose a new password" />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <TextField label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <TextField label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry onSubmitEditing={submit} />
      <Button label="Update password" size="lg" onPress={submit} loading={busy} fullWidth />
    </Screen>
  );
}
