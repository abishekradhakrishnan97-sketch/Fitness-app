import type { AuthError, PostgrestError } from '@supabase/supabase-js';

/** Convert Supabase/network errors into a short, user-facing message. */
export function friendlyError(err: unknown): string {
  if (!err) return 'Something went wrong. Please try again.';
  const e = err as Partial<PostgrestError & AuthError> & { message?: string };
  const msg = e.message ?? String(err);
  if (/Failed to fetch|Network request failed|NetworkError/i.test(msg)) {
    return "Can't reach the server. Check your internet connection and try again.";
  }
  if (/Invalid login credentials/i.test(msg)) return 'Incorrect email or password.';
  if (/Email not confirmed/i.test(msg)) return 'Please verify your email first — check your inbox for the link.';
  if (/User already registered/i.test(msg)) return 'An account with this email already exists. Try signing in.';
  if (/Password should be/i.test(msg)) return msg;
  if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.';
  if (e.code === '23514') return 'One of the values is out of the allowed range.';
  if (e.code === '42501') return "You don't have permission to do that.";
  return msg.length < 160 ? msg : 'Something went wrong. Please try again.';
}

export function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}
