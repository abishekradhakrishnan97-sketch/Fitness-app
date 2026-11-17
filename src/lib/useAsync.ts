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

interface Result<T> {
  key: string | null;
  data: T | null;
  error: string | null;
}

/**
 * Load data with loading / refreshing / error states. Re-runs when `deps` change.
 * `loading` is derived: true until a result for the current deps has arrived.
 * Responses for stale deps are ignored, so a slow old request can't overwrite newer data.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], opts: { refetchOnFocus?: boolean } = {}): AsyncState<T> {
  const key = JSON.stringify(deps);
  const [result, setResult] = useState<Result<T>>({ key: null, data: null, error: null });
  const [refreshing, setRefreshing] = useState(false);

  const fnRef = useRef(fn);
  const latestKey = useRef(key);
  const mounted = useRef(true);
  useEffect(() => {
    fnRef.current = fn;
    latestKey.current = key;
  });

  const fetchFor = useCallback(async (k: string) => {
    try {
      const data = await fnRef.current();
      if (mounted.current && k === latestKey.current) setResult({ key: k, data, error: null });
    } catch (e) {
      if (mounted.current && k === latestKey.current) setResult((r) => ({ key: k, data: r.data, error: friendlyError(e) }));
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    latestKey.current = key;
    void fetchFor(key);
    return () => {
      mounted.current = false;
    };
  }, [key, fetchFor]);

  const reload = useCallback(async () => {
    setRefreshing(true);
    await fetchFor(latestKey.current);
    if (mounted.current) setRefreshing(false);
  }, [fetchFor]);

  // Refetch silently when the screen regains focus (e.g. after saving a meal elsewhere).
  const focusedOnce = useRef(false);
  const refetchOnFocus = !!opts.refetchOnFocus;
  useFocusEffect(
    useCallback(() => {
      if (!refetchOnFocus) return;
      if (focusedOnce.current) void fetchFor(latestKey.current);
      focusedOnce.current = true;
    }, [refetchOnFocus, fetchFor]),
  );

  return {
    data: result.data,
    error: result.key === key ? result.error : null,
    loading: result.key !== key,
    refreshing,
    reload,
  };
}
