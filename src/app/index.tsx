import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth/AuthProvider';

/** Entry point: send people to the right place for their auth/onboarding state. */
export default function Index() {
  const { session, onboarded, passwordRecovery } = useAuth();
  if (!session) return <Redirect href="/sign-in" />;
  if (passwordRecovery) return <Redirect href="/reset-password" />;
  if (!onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/today" />;
}
