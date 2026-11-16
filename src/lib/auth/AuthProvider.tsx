import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { AppRole, ProfileRow } from '@/types/database';

interface AuthState {
  /** True until the persisted session (and profile) have been loaded. */
  loading: boolean;
  session: Session | null;
  profile: ProfileRow | null;
  roles: AppRole[];
  /** Set when the user arrives from a password-reset email. */
  passwordRecovery: boolean;
  onboarded: boolean;
  refreshProfile: () => Promise<void>;
  clearPasswordRecovery: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  // Which user the profile/roles currently in state belong to (avoids flashing onboarding on sign-in).
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      setRoles([]);
      setLoadedFor(null);
      return;
    }
    const [p, r] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ]);
    setProfile(p.data ?? null);
    setRoles((r.data ?? []).map((x) => x.role));
    setLoadedFor(userId);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      setSession(next);
      // Defer DB calls out of the auth callback (supabase-js recommendation).
      setTimeout(() => {
        if (active) void loadProfile(next?.user.id);
      }, 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(() => loadProfile(session?.user.id), [loadProfile, session?.user.id]);
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setPasswordRecovery(false);
  }, []);

  const profileReady = !session || loadedFor === session.user.id;

  const value = useMemo<AuthState>(
    () => ({
      loading: loading || !profileReady,
      session,
      profile,
      roles,
      passwordRecovery,
      onboarded: Boolean(profile?.onboarding_completed_at),
      refreshProfile,
      clearPasswordRecovery: () => setPasswordRecovery(false),
      signOut,
    }),
    [loading, profileReady, session, profile, roles, passwordRecovery, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
