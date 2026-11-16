// Small key-value store. On web this is window.localStorage; on native,
// `expo-sqlite/localStorage/install` (imported in kvStorage.native.ts) provides it.
// Every access is guarded: storage can be unavailable (private mode, SSR).

export function kvGet(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function kvSet(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function kvRemove(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    /* ignore */
  }
}
