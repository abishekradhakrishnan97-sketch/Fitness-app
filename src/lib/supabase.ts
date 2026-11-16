import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import type { Database } from '@/types/database';
import './kvStorage'; // installs localStorage on native

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** False when the public env vars are missing; the app shows a setup screen instead of crashing. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = createClient<Database>(
  supabaseUrl || 'https://not-configured.invalid',
  supabasePublishableKey || 'not-configured',
  {
    auth: {
      storage: globalThis.localStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Web receives email-verification and password-reset sessions in the URL.
      detectSessionInUrl: Platform.OS === 'web',
    },
  },
);

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Absolute URL for auth email redirects (verification, password reset). */
export function authRedirectUrl(path: string): string | undefined {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}${path}`;
  return process.env.EXPO_PUBLIC_SITE_URL ? `${process.env.EXPO_PUBLIC_SITE_URL}${path}` : undefined;
}
