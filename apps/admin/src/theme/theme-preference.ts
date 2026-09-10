export type ThemePreference = 'light' | 'dark' | 'system';

export const themeStorageKey = 'spark-admin-theme';

// This self-contained reader is also serialized into the pre-paint HTML script.
export function readThemePreference(storageKey: string): ThemePreference {
  try {
    const value = window.localStorage.getItem(storageKey);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(
  preference: ThemePreference,
  systemDark: boolean,
): 'light' | 'dark' {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
}
