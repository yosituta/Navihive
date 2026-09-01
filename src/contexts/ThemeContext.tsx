import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { createTheme, Theme, ThemeProvider as MuiThemeProvider } from '@mui/material';
import { getLocalStorageItem, setLocalStorageItem } from '../utils/localStorage';

export interface CustomThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
}

export interface ThemePreferences {
  mode: 'light' | 'dark';
  customColors: CustomThemeColors | null;
  lastUpdated: number;
}

export interface ThemeContextValue {
  mode: 'light' | 'dark';
  toggleMode: () => void;
  customColors: CustomThemeColors | null;
  setCustomColors: (colors: CustomThemeColors | null) => void;
  resetToDefault: () => void;
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'navihive.themePreferences';

const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
  mode: 'light',
  customColors: null,
  lastUpdated: Date.now(),
};

/**
 * Validate theme preferences structure
 */
function isValidThemePreferences(value: unknown): value is ThemePreferences {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const pref = value as Partial<ThemePreferences>;

  if (pref.mode !== 'light' && pref.mode !== 'dark') {
    return false;
  }

  if (pref.customColors !== null) {
    if (typeof pref.customColors !== 'object') {
      return false;
    }

    const colors = pref.customColors as Partial<CustomThemeColors>;
    const requiredKeys: (keyof CustomThemeColors)[] = [
      'primary',
      'secondary',
      'background',
      'surface',
      'text',
    ];

    for (const key of requiredKeys) {
      if (typeof colors[key] !== 'string') {
        return false;
      }
    }
  }

  return typeof pref.lastUpdated === 'number';
}

/**
 * Validate CSS color string
 */
function isValidCSSColor(color: string): boolean {
  if (!color || typeof color !== 'string') {
    return false;
  }

  // Check for hex colors
  if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(color)) {
    return true;
  }

  // Check for rgb/rgba
  if (/^rgba?\([\d\s,./]+\)$/.test(color)) {
    return true;
  }

  // Check for hsl/hsla
  if (/^hsla?\([\d\s,%./]+\)$/.test(color)) {
    return true;
  }

  // Check for named colors (basic validation)
  const namedColors = [
    'black',
    'white',
    'red',
    'green',
    'blue',
    'yellow',
    'orange',
    'purple',
    'pink',
    'gray',
    'grey',
    'transparent',
  ];
  if (namedColors.includes(color.toLowerCase())) {
    return true;
  }

  return false;
}

/**
 * Validate custom theme colors
 */
function validateCustomColors(colors: CustomThemeColors): boolean {
  return (
    isValidCSSColor(colors.primary) &&
    isValidCSSColor(colors.secondary) &&
    isValidCSSColor(colors.background) &&
    isValidCSSColor(colors.surface) &&
    isValidCSSColor(colors.text)
  );
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  // Load theme preferences from localStorage
  const [preferences, setPreferences] = useState<ThemePreferences>(() => {
    const stored = getLocalStorageItem(
      THEME_STORAGE_KEY,
      DEFAULT_THEME_PREFERENCES,
      isValidThemePreferences
    );

    // If no stored preference, check system preference
    if (stored.mode === DEFAULT_THEME_PREFERENCES.mode) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return {
        ...stored,
        mode: prefersDark ? 'dark' : 'light',
      };
    }

    return stored;
  });

  // Persist preferences to localStorage whenever they change
  useEffect(() => {
    const updated: ThemePreferences = {
      ...preferences,
      lastUpdated: Date.now(),
    };
    setLocalStorageItem(THEME_STORAGE_KEY, updated);
  }, [preferences]);

  // Sync HTML class for compatibility with existing CSS
  useEffect(() => {
    if (preferences.mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [preferences.mode]);

  const toggleMode = () => {
    setPreferences((prev) => ({
      ...prev,
      mode: prev.mode === 'dark' ? 'light' : 'dark',
    }));
  };

  const setCustomColors = (colors: CustomThemeColors | null) => {
    if (colors !== null && !validateCustomColors(colors)) {
      console.error('Invalid custom colors provided');
      return;
    }

    setPreferences((prev) => ({
      ...prev,
      customColors: colors,
    }));
  };

  const resetToDefault = () => {
    setPreferences((prev) => ({
      ...prev,
      customColors: null,
    }));
  };

  // Create Material-UI theme based on preferences
  const theme = useMemo(() => {
    const isDark = preferences.mode === 'dark';
    const custom = preferences.customColors;

    return createTheme({
      palette: {
        mode: preferences.mode,
        primary: {
          main: custom?.primary || (isDark ? '#5eead4' : '#0f766e'),
          light: isDark ? '#99f6e4' : '#5eead4',
          dark: isDark ? '#0f766e' : '#115e59',
        },
        secondary: {
          main: custom?.secondary || (isDark ? '#fb923c' : '#ea580c'),
          light: isDark ? '#fdba74' : '#fb923c',
          dark: isDark ? '#c2410c' : '#9a3412',
        },
        background: {
          default: custom?.background || (isDark ? '#07131d' : '#edf7f5'),
          paper:
            custom?.surface || (isDark ? 'rgba(10, 23, 33, 0.82)' : 'rgba(255, 255, 255, 0.82)'),
        },
        text: {
          primary: custom?.text || (isDark ? '#f4fbfa' : '#0f172a'),
          secondary: isDark ? '#a7c4cc' : '#4b5563',
        },
      },
      shape: {
        borderRadius: 4,
      },
      typography: {
        fontFamily: 'Roboto, "Segoe UI Variable", "PingFang SC", sans-serif',
        h2: {
          fontWeight: 800,
          letterSpacing: '-0.03em',
        },
        h3: {
          fontWeight: 800,
          letterSpacing: '-0.03em',
        },
        h4: {
          fontWeight: 700,
          letterSpacing: '-0.02em',
        },
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              minHeight: '100vh',
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: 999,
              textTransform: 'none',
              fontWeight: 700,
              boxShadow: 'none',
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backdropFilter: 'blur(14px)',
            },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: {
              borderRadius: 999,
              fontWeight: 600,
            },
          },
        },
      },
    });
  }, [preferences.mode, preferences.customColors]);

  const contextValue: ThemeContextValue = {
    mode: preferences.mode,
    toggleMode,
    customColors: preferences.customColors,
    setCustomColors,
    resetToDefault,
    theme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
