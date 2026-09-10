import { Theme } from '@radix-ui/themes';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  readThemePreference,
  resolveTheme,
  themeStorageKey,
  type ThemePreference,
} from './theme-preference';

const mediaQuery = '(prefers-color-scheme: dark)';

interface AdminThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  setPreference: (preference: ThemePreference) => void;
}

const AdminThemeContext = createContext<AdminThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() =>
    readThemePreference(themeStorageKey),
  );
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia(mediaQuery).matches,
  );
  const resolvedTheme = resolveTheme(preference, systemDark);

  useEffect(() => {
    const query = window.matchMedia(mediaQuery);
    const updateSystemTheme = () => setSystemDark(query.matches);

    updateSystemTheme();
    query.addEventListener('change', updateSystemTheme);
    return () => query.removeEventListener('change', updateSystemTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const updatePreference = (nextPreference: ThemePreference) => {
    setPreference(nextPreference);
    try {
      if (nextPreference === 'system') {
        window.localStorage.removeItem(themeStorageKey);
      } else {
        window.localStorage.setItem(themeStorageKey, nextPreference);
      }
    } catch {
      // The active theme remains usable when browser storage is unavailable.
    }
  };

  return (
    <AdminThemeContext.Provider
      value={{
        preference,
        resolvedTheme,
        setPreference: updatePreference,
      }}
    >
      <Theme
        accentColor="violet"
        appearance={resolvedTheme}
        grayColor="slate"
        panelBackground="translucent"
        radius="medium"
        scaling="100%"
      >
        {children}
      </Theme>
    </AdminThemeContext.Provider>
  );
}

export function useAdminTheme(): AdminThemeContextValue {
  const theme = useContext(AdminThemeContext);
  if (!theme) {
    throw new Error('useAdminTheme must be used within a ThemeProvider');
  }

  return theme;
}
