import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Banner, Button, Card, TextField, useToast } from '@/components/ui';
import { checkRange } from '@/lib/validation';
import { logWeight } from '@/services/dashboard';
import { friendlyError } from '@/services/errors';
import type { WeightLogRow } from '@/types/database';
import { spacing } from '@/theme/tokens';

export function LogWeightCard({
  userId,
  latest,
  previous,
  onSaved,
}: {
  userId: string;
  latest: WeightLogRow | null;
  previous: WeightLogRow | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const delta = latest && previous ? Number(latest.weight_kg) - Number(previous.weight_kg) : null;

  const save = async () => {
    const c = checkRange(value, 20, 400, 'Weight', true);
    if (c.error || c.value === null) return setError(c.error);
    setBusy(true);
    setError(null);
    try {
      await logWeight(userId, c.value);
      setValue('');
      setOpen(false);
      toast(`Weight logged · ${c.value} kg`);
      onSaved();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="overline" tone="subtle">Weight</AppText>
          {latest ? (
            <AppText variant="title" numeric>
              {Number(latest.weight_kg).toFixed(1)} <AppText variant="label" tone="muted">kg</AppText>
            </AppText>
          ) : (
            <AppText tone="muted">No weigh-ins yet</AppText>
          )}
          {latest ? (
            <AppText variant="caption" tone="subtle" numeric>
              {latest.local_date}
              {delta !== null && Math.abs(delta) >= 0.05
                ? `  ·  ${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)} kg since last`
                : ''}
            </AppText>
          ) : null}
        </View>
        {!open ? <Button label="Log weight" icon="add" size="sm" variant="secondary" onPress={() => setOpen(true)} /> : null}
      </View>
      {open ? (
        <View style={styles.form}>
          <TextField label="Today's weight" value={value} onChangeText={setValue} keyboardType="decimal-pad" suffix="kg" autoFocus onSubmitEditing={save} />
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <View style={styles.actions}>
            <Button label="Cancel" variant="ghost" size="sm" onPress={() => { setOpen(false); setError(null); }} />
            <Button label="Save" size="sm" onPress={save} loading={busy} />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  form: { gap: spacing.md, marginTop: spacing.lg },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
