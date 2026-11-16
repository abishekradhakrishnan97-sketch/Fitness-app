import { FunctionsHttpError } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { PreparedImage } from '@/lib/image';
import type { AiFoodItem } from '@/lib/nutrition/mealDraft';
import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';

export interface FoodAnalysisResult {
  is_estimate: true;
  disclaimer: string;
  is_food: boolean;
  image_quality: 'good' | 'fair' | 'poor';
  overall_confidence: number;
  needs_review: boolean;
  meal_description: string | null;
  items: AiFoodItem[];
  warnings: string[];
  model: string;
}

export class FoodAnalysisError extends Error {
  code: string;
  retryable: boolean;
  constructor(code: string, message: string, retryable: boolean) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

export async function getAiPhotoConsent(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('user_preferences').select('ai_photo_consent_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  const row = data as { ai_photo_consent_at: string | null } | null;
  return !!row?.ai_photo_consent_at;
}

export async function setAiPhotoConsent(userId: string, granted: boolean): Promise<void> {
  unwrap(
    await supabase
      .from('user_preferences')
      .update({ ai_photo_consent_at: granted ? new Date().toISOString() : null })
      .eq('user_id', userId),
  );
}

/** Send a prepared photo to the analyze-food-image Edge Function (Gemini runs server-side). */
export async function analyzeFoodPhoto(img: PreparedImage, hint?: string): Promise<FoodAnalysisResult> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    form.append('image', new Blob([img.bytes as BlobPart], { type: img.mimeType }), 'meal.jpg');
  } else {
    // React Native FormData file part
    form.append('image', { uri: img.uri, name: 'meal.jpg', type: img.mimeType } as unknown as Blob);
  }
  if (hint?.trim()) form.append('hint', hint.trim().slice(0, 300));

  const { data, error } = await supabase.functions.invoke('analyze-food-image', { body: form });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await (error.context as Response).json().catch(() => null);
      const e = body?.error;
      if (e?.code) throw new FoodAnalysisError(e.code, e.message, !!e.retryable);
    }
    throw new FoodAnalysisError('NETWORK', "Couldn't reach the food analysis service. Check your connection and try again.", true);
  }
  if (!data?.ok) {
    throw new FoodAnalysisError(data?.error?.code ?? 'UNKNOWN', data?.error?.message ?? 'Analysis failed.', !!data?.error?.retryable);
  }
  return data.data as FoodAnalysisResult;
}
