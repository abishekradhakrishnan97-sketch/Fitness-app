import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { kvGet, kvSet } from '@/lib/kvStorage';
import { palettes, type Palette, type ThemeName } from './tokens';

export type ThemePreference = ThemeName | 'system';

interface ThemeContextValue {
  name: ThemeName;
  colors: Palette;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const STORAGE_KEY = 'theme-preference';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStored(): ThemePreference {
  const v = kvGet(STORAGE_KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>(readStored);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    kvSet(STORAGE_KEY, p);
  }, []);

  const name: ThemeName = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
  const value = useMemo(
    () => ({ name, colors: palettes[name], preference, setPreference }),
    [name, preference, setPreference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
