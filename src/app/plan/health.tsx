import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText, Banner, Button, Card, ChoiceGroup, ErrorState, LoadingState, Screen, TextField, useToast } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthProvider';
import { CONDITION_LABEL, HEALTH_DISCLAIMER, healthGuidance, MED_LABEL, type Condition, type MedFlag } from '@/lib/workout/health';
import { useAsync } from '@/lib/useAsync';
import { saveHealthProfile } from '@/services/coach';
import { friendlyError } from '@/services/errors';
import { getPreferences } from '@/services/profile';
import { spacing } from '@/theme/tokens';

const CONDITIONS = (Object.keys(CONDITION_LABEL) as Condition[]).map((c) => ({ value: c, label: CONDITION_LABEL[c] }));
const MEDS = (Object.keys(MED_LABEL) as MedFlag[]).map((m) => ({ value: m, label: MED_LABEL[m] }));

interface FormState { conditions: Condition[]; meds: MedFlag[]; notes: string; aiConsent: boolean }

export default function HealthProfile() {
  const { session } = useAuth();
  const toast = useToast();
  const userId = session!.user.id;
  const { data: prefs, loading, error, reload } = useAsync(() => getPreferences(userId), [userId]);
  const [edits, setEdits] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (loading) return <Screen narrow><LoadingState /></Screen>;
  if (error) return <Screen narrow><ErrorState message={error} onRetry={reload} /></Screen>;

  const hadConsent = !!prefs?.health_ai_consent_at;
  const v: FormState = edits ?? {
    conditions: (prefs?.health_conditions ?? []) as Condition[],
    meds: (prefs?.medication_flags ?? []) as MedFlag[],
    notes: prefs?.medication_notes ?? '',
    aiConsent: hadConsent,
  };
  const set = (patch: Partial<FormState>) => setEdits({ ...v, ...patch });
  const preview = healthGuidance(v.conditions, v.meds);

  const save = async () => {
    setBusy(true);
    setSaveError(null);
    try {
      await saveHealthProfile(userId, { ...v, hadConsent });
      toast('Health profile saved · plan updated');
      router.back();
    } catch (e) {
      setSaveError(friendlyError(e));
      setBusy(false);
    }
  };

  return (
    <Screen
      narrow
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button label="Cancel" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
          <Button label="Save" onPress={save} loading={busy} style={{ flex: 2 }} />
        </View>
      }
    >
      <View style={{ marginTop: spacing.sm }}>
        <AppText variant="title" accessibilityRole="header">Health profile</AppText>
        <AppText tone="muted">Optional. Your coach swaps exercises and adds safety guidance based on this. Only you can see it.</AppText>
      </View>

      <ChoiceGroup<Condition> label="Conditions" multiple options={CONDITIONS} value={v.conditions} onChange={(c) => set({ conditions: c })} />
      <ChoiceGroup<MedFlag> label="Medicines that affect exercise" multiple layout="list" options={MEDS} value={v.meds} onChange={(m) => set({ meds: m })} />
      <TextField
        label="Your medicines (private note)"
        value={v.notes}
        onChangeText={(t) => set({ notes: t })}
        placeholder="e.g. Metformin 500 mg twice a day"
        maxLength={500}
        multiline
        hint="For your own reference. This note is never sent to the AI."
      />

      {preview.workout.length || preview.food.length ? (
        <Card>
          <AppText variant="heading" style={{ marginBottom: spacing.sm }}>What changes for you</AppText>
          <View style={{ gap: spacing.sm }}>
            {[...preview.workout, ...preview.food].map((w) => (
              <AppText key={w} variant="label" tone="muted">• {w}</AppText>
            ))}
          </View>
        </Card>
      ) : null}

      <Card tone="inset">
        <View style={{ gap: spacing.sm }}>
          <AppText variant="heading">Use this for AI meal ideas?</AppText>
          <AppText variant="label" tone="muted">
            If you allow it, your conditions and medicine types (not your private note, name or email) are sent to Google’s Gemini AI through our server so meal ideas suit them. Workout changes happen on your device and never need this.
          </AppText>
          <ChoiceGroup
            options={[{ value: 'yes', label: 'Allow' }, { value: 'no', label: 'Don’t allow' }]}
            value={v.aiConsent ? 'yes' : 'no'}
            onChange={(x) => set({ aiConsent: x === 'yes' })}
          />
        </View>
      </Card>

      {saveError ? <Banner tone="danger">{saveError}</Banner> : null}
      <AppText variant="caption" tone="subtle">{HEALTH_DISCLAIMER}</AppText>
    </Screen>
  );
}
