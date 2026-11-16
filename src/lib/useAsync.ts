import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlyError } from '@/services/errors';

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  reload: () => Promise<void>;
}

/** Load data with loading / refreshing / error states. Re-runs when `deps` change. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], opts: { refetchOnFocus?: boolean } = {}): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const mounted = useRef(true);

  const run = useCallback(async (kind: 'load' | 'refresh' | 'silent') => {
    if (kind === 'refresh') setRefreshing(true);
    else if (kind === 'load') setLoading(true);
    try {
      const result = await fnRef.current();
      if (mounted.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (mounted.current) setError(friendlyError(e));
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void run('load');
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const reload = useCallback(() => run('refresh'), [run]);

  // Refetch silently when the screen regains focus (e.g. after saving a meal elsewhere).
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!opts.refetchOnFocus) return;
      if (focusedOnce.current) void run('silent');
      focusedOnce.current = true;
    }, [opts.refetchOnFocus, run]),
  );
  return { data, error, loading, refreshing, reload };
}
