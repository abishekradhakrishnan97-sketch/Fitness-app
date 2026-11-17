import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { MealForm } from '@/components/food/MealForm';
import { AppText, Banner, Button, Card, Icon, LoadingState, Screen, TextField, useToast } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthProvider';
import { pickImage, prepareImage, type PreparedImage } from '@/lib/image';
import { draftFromAi, draftTotals, emptyItem } from '@/lib/nutrition/mealDraft';
import { categoriseMeal, localParts, type MealType } from '@/lib/time/mealCategory';
import { friendlyError } from '@/services/errors';
import {
  analyzeFoodPhoto,
  FoodAnalysisError,
  getAiPhotoConsent,
  setAiPhotoConsent,
  type FoodAnalysisResult,
} from '@/services/foodAnalysis';
import { createMeal, suggestMealType, uploadMealPhoto } from '@/services/meals';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

type Step =
  | { s: 'checking' }
  | { s: 'consent' }
  | { s: 'pick' }
  | { s: 'preparing' }
  | { s: 'ready'; img: PreparedImage }
  | { s: 'analyzing'; img: PreparedImage }
  | { s: 'error'; img: PreparedImage | null; message: string; retryable: boolean }
  | { s: 'review'; img: PreparedImage; result: FoodAnalysisResult };

export default function PhotoLog() {
  const { mode } = useLocalSearchParams<{ mode?: 'camera' | 'library' }>();
  const { colors } = useTheme();
  const { session } = useAuth();
  const toast = useToast();
  const userId = session!.user.id;
  const [step, setStep] = useState<Step>({ s: 'checking' });
  const [hint, setHint] = useState('');
  const [auto, setAuto] = useState<MealType>(() => categoriseMeal(localParts(new Date()).minutes));
  const [consentBusy, setConsentBusy] = useState(false);

  useEffect(() => {
    suggestMealType(userId).then(setAuto).catch(() => undefined);
    getAiPhotoConsent(userId)
      .then((ok) => setStep(ok ? { s: 'pick' } : { s: 'consent' }))
      .catch(() => setStep({ s: 'consent' }));
  }, [userId]);

  const choose = async (m: 'camera' | 'library') => {
    const r = await pickImage(m);
    if (!r.ok) {
      if (r.reason === 'denied') setStep({ s: 'error', img: null, message: 'Camera permission was denied. Allow camera access in your settings, or upload a photo instead.', retryable: false });
      else if (r.reason === 'error') setStep({ s: 'error', img: null, message: r.message ?? 'Could not open the camera.', retryable: false });
      return;
    }
    setStep({ s: 'preparing' });
    try {
      const img = await prepareImage(r.uri, r.width);
      setStep({ s: 'ready', img });
    } catch (e) {
      setStep({ s: 'error', img: null, message: friendlyError(e), retryable: false });
    }
  };

  const analyze = async (img: PreparedImage) => {
    setStep({ s: 'analyzing', img });
    try {
      const result = await analyzeFoodPhoto(img, hint);
      setStep({ s: 'review', img, result });
    } catch (e) {
      const err = e instanceof FoodAnalysisError ? e : null;
      if (err?.code === 'CONSENT_REQUIRED') return setStep({ s: 'consent' });
      setStep({ s: 'error', img, message: err?.message ?? friendlyError(e), retryable: err?.retryable ?? true });
    }
  };

  // ---------------------------------------------------------------- review
  if (step.s === 'review') {
    const { result, img } = step;
    const items = result.items.length ? result.items.map(draftFromAi) : [emptyItem()];
    return (
      <MealForm
        title="Review your meal"
        autoMealType={auto}
        estimateBanner
        header={
          <View style={{ gap: spacing.md }}>
            <Image source={{ uri: img.uri }} style={[styles.preview, { backgroundColor: colors.surfaceSunken }]} resizeMode="cover" accessibilityLabel="Your meal photo" />
            {result.meal_description ? <AppText tone="muted">{result.meal_description}</AppText> : null}
            {!result.is_food ? (
              <Banner tone="warning" title="No food recognised">
                We couldn’t identify food in this photo. Enter the details below, or go back and try a clearer photo.
              </Banner>
            ) : result.needs_review ? (
              <Banner tone="warning" title="Please double-check">
                {result.warnings.join(' ') || 'Some items are uncertain.'}
              </Banner>
            ) : null}
          </View>
        }
        initial={{ mealType: auto, categoryAuto: true, mealKind: 'regular', notes: '', items }}
        submitLabel="Confirm & save"
        onCancel={() => setStep({ s: 'pick' })}
        onSubmit={async (v) => {
          const photoPath = await uploadMealPhoto(userId, img.bytes, img.mimeType);
          await createMeal(
            {
              mealType: v.mealType,
              categoryAuto: v.categoryAuto,
              mealKind: v.mealKind,
              notes: v.notes,
              source: 'ai_image',
              isEstimate: true,
              aiModel: result.model,
              aiAnalysis: result,
              photoPath,
            },
            v.items,
          );
          toast(`Meal saved · ${Math.round(draftTotals(v.items).calories)} kcal added`);
          router.replace('/today');
        }}
      />
    );
  }

  // ---------------------------------------------------------------- other steps
  return (
    <Screen narrow>
      <View style={styles.top}>
        <Button label="Back" icon="chevron-back" variant="ghost" size="sm" onPress={() => router.back()} />
      </View>
      <AppText variant="title" accessibilityRole="header">Food photo</AppText>

      {step.s === 'checking' || step.s === 'preparing' ? <LoadingState label={step.s === 'preparing' ? 'Preparing photo…' : 'Loading…'} /> : null}

      {step.s === 'consent' ? (
        <Card>
          <View style={{ gap: spacing.md }}>
            <Icon name="shield-checkmark-outline" size={28} color={colors.text} />
            <AppText variant="heading">Before we analyse your photos</AppText>
            <AppText tone="muted">
              To recognise food, your photo is sent securely to Google’s Gemini AI service through our server. It’s used only
              to estimate what’s on your plate.
            </AppText>
            <View style={{ gap: spacing.xs }}>
              {[
                'Photos are resized and location data is removed before upload.',
                'If you save the meal, the photo is stored privately in your account — only you can see it.',
                'Nutrition values from photos are estimates. You review and edit them before saving.',
                'You can withdraw this permission any time in Profile.',
              ].map((t) => (
                <AppText key={t} variant="label" tone="muted">• {t}</AppText>
              ))}
            </View>
            <Button
              label="I agree — continue"
              loading={consentBusy}
              onPress={async () => {
                setConsentBusy(true);
                try {
                  await setAiPhotoConsent(userId, true);
                  setStep({ s: 'pick' });
                } catch (e) {
                  setStep({ s: 'error', img: null, message: friendlyError(e), retryable: false });
                } finally {
                  setConsentBusy(false);
                }
              }}
            />
            <Button label="Not now — enter manually" variant="ghost" onPress={() => router.replace('/log/manual')} />
          </View>
        </Card>
      ) : null}

      {step.s === 'pick' ? (
        <>
          <AppText tone="muted">Photograph your plate from above in good light. Include the whole plate and any bowls.</AppText>
          <Button label={mode === 'library' ? 'Choose a photo' : 'Take a photo'} icon={mode === 'library' ? 'images-outline' : 'camera'} size="lg" onPress={() => choose(mode === 'library' ? 'library' : 'camera')} fullWidth />
          <Button label={mode === 'library' ? 'Use camera instead' : 'Upload from gallery instead'} variant="secondary" onPress={() => choose(mode === 'library' ? 'camera' : 'library')} fullWidth />
        </>
      ) : null}

      {step.s === 'ready' || step.s === 'analyzing' || (step.s === 'error' && step.img) ? (
        <Image
          source={{ uri: (step as { img: PreparedImage }).img.uri }}
          style={[styles.preview, { backgroundColor: colors.surfaceSunken }]}
          resizeMode="cover"
          accessibilityLabel="Selected meal photo"
        />
      ) : null}

      {step.s === 'ready' ? (
        <>
          <TextField
            label="Anything we should know? (optional)"
            value={hint}
            onChangeText={setHint}
            placeholder="e.g. home-made, Kerala style, 2 appams"
            maxLength={300}
          />
          <Button label="Analyse photo" icon="sparkles" size="lg" onPress={() => analyze(step.img)} fullWidth />
          <Button label="Choose a different photo" variant="ghost" onPress={() => setStep({ s: 'pick' })} />
        </>
      ) : null}

      {step.s === 'analyzing' ? <LoadingState label="Identifying your food… this can take up to 30 seconds" /> : null}

      {step.s === 'error' ? (
        <>
          <Banner tone="danger" title="Couldn't analyse the photo">{step.message}</Banner>
          {step.img && step.retryable ? <Button label="Try again" onPress={() => analyze(step.img!)} /> : null}
          <Button label="Pick another photo" variant="secondary" onPress={() => setStep({ s: 'pick' })} />
          <Button label="Enter manually instead" variant="ghost" onPress={() => router.replace('/log/manual')} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', marginLeft: -spacing.md },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg },
});
