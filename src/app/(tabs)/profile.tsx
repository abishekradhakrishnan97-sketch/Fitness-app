import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Banner, Button, Card, ChoiceGroup, Screen } from '@/components/ui';
import { friendlyError } from '@/services/errors';
import { getAiPhotoConsent, setAiPhotoConsent } from '@/services/foodAnalysis';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useAsync } from '@/lib/useAsync';
import { getActiveGoal, getCurrentTargets } from '@/services/profile';
import { useTheme, type ThemePreference } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const THEMES = [
  { value: 'dark' as const, label: 'Dark' },
  { value: 'light' as const, label: 'Light' },
  { value: 'system' as const, label: 'System' },
];
const GOAL_LABEL: Record<string, string> = {
  weight_loss: 'Lose weight',
  muscle_gain: 'Build muscle',
  recomposition: 'Body recomposition',
  general_fitness: 'General fitness',
  maintenance: 'Maintain weight',
};

export default function Profile() {
  const { colors, preference, setPreference } = useTheme();
  const { session, profile, roles, signOut } = useAuth();
  const userId = session!.user.id;
  const { data, reload, refreshing } = useAsync(
    async () => ({
      targets: await getCurrentTargets(userId),
      goal: await getActiveGoal(userId),
      aiConsent: await getAiPhotoConsent(userId),
    }),
    [userId],
    { refetchOnFocus: true },
  );
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  const toggleConsent = async (granted: boolean) => {
    setConsentBusy(true);
    setConsentError(null);
    try {
      await setAiPhotoConsent(userId, granted);
      await reload();
    } catch (e) {
      setConsentError(friendlyError(e));
    } finally {
      setConsentBusy(false);
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <AppText variant="title" accessibilityRole="header" style={{ marginTop: spacing.sm }}>Profile</AppText>

      <Card>
        <AppText variant="heading">{profile?.display_name || 'Your account'}</AppText>
        <AppText tone="muted">{session?.user.email}</AppText>
        <AppText variant="caption" tone="subtle" style={{ marginTop: spacing.xs }}>
          {roles.includes('trainer') ? 'Trainer' : roles.includes('client') ? 'Coached client' : 'Personal account'}
        </AppText>
      </Card>

      <Card>
        <View style={styles.head}>
          <AppText variant="heading">Daily targets</AppText>
          <Button label="Edit" size="sm" variant="secondary" onPress={() => router.push('/targets')} />
        </View>
        {data?.targets ? (
          <View style={styles.grid}>
            <Row label="Calories" value={`${data.targets.calories_kcal} kcal`} />
            <Row label="Protein" value={`${data.targets.protein_g} g`} color={colors.protein} />
            <Row label="Carbs" value={`${data.targets.carbohydrates_g} g`} color={colors.carbs} />
            <Row label="Fat" value={`${data.targets.fat_g} g`} color={colors.fat} />
            <Row label="Fibre" value={`${data.targets.fibre_g} g`} color={colors.fibre} />
            <Row label="Water" value={`${(data.targets.water_ml / 1000).toFixed(1)} L`} color={colors.water} />
            <AppText variant="caption" tone="subtle">
              {data.targets.source === 'manual' ? 'Set manually' : data.targets.source === 'trainer' ? 'Set by your trainer' : 'Calculated from your profile'} · since {data.targets.effective_from}
            </AppText>
          </View>
        ) : (
          <AppText tone="muted">No targets set.</AppText>
        )}
      </Card>

      {data?.goal ? (
        <Card>
          <AppText variant="heading">Goal</AppText>
          <View style={styles.grid}>
            <Row label="Goal" value={GOAL_LABEL[data.goal.goal_type] ?? data.goal.goal_type} />
            {data.goal.start_weight_kg ? <Row label="Starting weight" value={`${data.goal.start_weight_kg} kg`} /> : null}
            {data.goal.target_weight_kg ? <Row label="Goal weight" value={`${data.goal.target_weight_kg} kg`} /> : null}
            {data.goal.target_date ? <Row label="Target date" value={data.goal.target_date} /> : null}
          </View>
        </Card>
      ) : null}

      <Card>
        <View style={styles.head}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="heading">AI photo analysis</AppText>
            <AppText variant="label" tone="muted">
              {data?.aiConsent
                ? 'Allowed. Meal photos you choose to analyse are sent securely to Google Gemini to estimate nutrition.'
                : 'Not allowed. Photos are never sent to the AI service. You can still log food manually or by barcode.'}
            </AppText>
          </View>
        </View>
        {consentError ? <Banner tone="danger">{consentError}</Banner> : null}
        <Button
          label={data?.aiConsent ? 'Withdraw permission' : 'Allow AI photo analysis'}
          variant={data?.aiConsent ? 'secondary' : 'primary'}
          size="sm"
          loading={consentBusy}
          onPress={() => toggleConsent(!data?.aiConsent)}
          style={{ alignSelf: 'flex-start', marginTop: spacing.md }}
        />
      </Card>

      <Card>
        <ChoiceGroup<ThemePreference> label="Appearance" options={THEMES} value={preference} onChange={setPreference} />
      </Card>

      <Button label="Sign out" variant="danger" icon="log-out-outline" onPress={signOut} fullWidth />
    </Screen>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLabel}>
        {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
        <AppText tone="muted">{label}</AppText>
      </View>
      <AppText variant="bodyStrong" numeric>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grid: { gap: spacing.md, marginTop: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
